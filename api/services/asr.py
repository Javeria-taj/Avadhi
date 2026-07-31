"""Speech to text. Offline in every path.

The Gemma-native-audio route is preferred. faster-whisper is the fallback
we install up front so that the T+4 gate is a config change, not a scramble.
"""
from __future__ import annotations

import logging
from pathlib import Path

from api.config import settings

log = logging.getLogger(__name__)
_model = None

MOCK_TRANSCRIPT = (
    "ನಿನ್ನೆ ರಾತ್ರಿ ಆಲಿಕಲ್ಲು ಮಳೆಯಿಂದ ನನ್ನ ಹತ್ತಿ ಬೆಳೆ ಹಾಳಾಗಿದೆ. "
    "ಸುಮಾರು ಒಂದೂವರೆ ಎಕರೆ. ಬ್ಯಾಂಕಿನಲ್ಲಿ ಫಸಲ್ ಬಿಮಾ ಪಾಲಿಸಿ ಇದೆ."
)


def _load():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        log.info("Loading ASR model: %s", settings.asr_model)
        _model = WhisperModel(settings.asr_model, device="cpu", compute_type="int8")
    return _model


def _transcribe_whispercpp(audio_path: str | Path, lang: str | None) -> tuple[str, str]:
    """Shell out to a whisper.cpp binary.

    Why this exists: faster-whisper depends on ctranslate2, which has no
    prebuilt aarch64-Android wheel. whisper.cpp compiles cleanly under Termux,
    so this is the only practical ASR route for true on-device operation on the
    S24. Same offline guarantee either way.
    """
    import json as _json
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        out_prefix = str(Path(tmpdir) / "out")
        cmd = [
            settings.whispercpp_bin,
            "-m", settings.whispercpp_model,
            "-f", str(audio_path),
            "-oj", "-of", out_prefix,
            "-nt",
        ]
        if lang:
            cmd += ["-l", lang]

        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=180)
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"whisper.cpp binary not found at {settings.whispercpp_bin}. "
                "Set WHISPERCPP_BIN, or use ASR_BACKEND=whisper."
            ) from exc
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                f"whisper.cpp failed: {exc.stderr.decode('utf-8', 'replace')[:400]}"
            ) from exc

        payload = _json.loads(Path(f"{out_prefix}.json").read_text(encoding="utf-8"))

    text = " ".join(
        seg.get("text", "").strip() for seg in payload.get("transcription", [])
    ).strip()
    detected = payload.get("result", {}).get("language") or lang or settings.language
    return text, detected


MOCK_TRANSCRIPT_EN = (
    "Last night's hailstorm destroyed my cotton crop. About one and a half acres. "
    "I have a Fasal Bima policy through the bank."
)


def transcribe(audio_path: str | Path, lang: str | None = None) -> tuple[str, str]:
    """Return (transcript, detected_language).

    lang=None lets the model auto-detect, which is what makes the app usable by
    someone who does not speak Kannada. Passing an explicit lang is more
    accurate when you already know it.
    """
    if settings.mock_mode:
        chosen = lang or settings.language
        return (MOCK_TRANSCRIPT_EN if chosen == "en" else MOCK_TRANSCRIPT), chosen

    if settings.asr_backend == "whispercpp":
        return _transcribe_whispercpp(audio_path, lang)

    segments, info = _load().transcribe(str(audio_path), language=lang)
    text = " ".join(seg.text for seg in segments).strip()
    detected = getattr(info, "language", None) or lang or settings.language
    return text, detected


def warmup() -> bool:
    """Load the ASR model at startup.

    faster-whisper downloads its weights on FIRST USE, not at install. That
    means the first recording of the day triggers a ~500MB download - which
    fails outright when offline, and shows up as a 500 on the intake endpoint
    with no obvious cause.

    Loading here means the download happens at boot, on a machine that still
    has network, instead of on stage.
    """
    if settings.mock_mode:
        return True
    if settings.asr_backend == "whispercpp":
        return Path(settings.whispercpp_bin).exists()
    try:
        _load()
        return True
    except Exception:
        log.exception("ASR warmup failed - check ASR_MODEL and network")
        return False


def is_ready() -> bool:
    if settings.mock_mode:
        return True
    if settings.asr_backend == "whispercpp":
        return Path(settings.whispercpp_bin).exists()
    return _model is not None