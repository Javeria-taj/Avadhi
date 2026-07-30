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


def transcribe(audio_path: str | Path) -> str:
    if settings.mock_mode:
        return MOCK_TRANSCRIPT
    segments, _ = _load().transcribe(str(audio_path), language=settings.language)
    return " ".join(seg.text for seg in segments).strip()


def is_ready() -> bool:
    return settings.mock_mode or _model is not None
