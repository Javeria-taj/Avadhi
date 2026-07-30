"""Environment config, validated at startup. Crash at boot, never at runtime."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Settings:
    def __init__(self) -> None:
        # "server" = local OpenAI-compatible HTTP server (Ollama / llama-server).
        # Works on Windows and macOS, still fully offline. Recommended.
        # "mlx" = in-process Apple Silicon inference. Mac only.
        self.backend: str = os.getenv("BACKEND", "server")
        self.model_path: str = os.getenv("MODEL_PATH", str(ROOT / "models" / "gemma-4b"))
        self.model_name: str = os.getenv("MODEL_NAME", "gemma3:4b")
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "http://127.0.0.1:11434")
        self.llm_timeout_s: int = int(os.getenv("LLM_TIMEOUT_S", "120"))
        # "whisper"    = faster-whisper in-process (Mac / Windows / Linux)
        # "whispercpp" = shell out to a whisper.cpp binary (required on Termux,
        #                where ctranslate2 has no aarch64-Android wheel)
        self.asr_backend: str = os.getenv("ASR_BACKEND", "whisper")
        self.whispercpp_bin: str = os.getenv("WHISPERCPP_BIN", "whisper-cli")
        self.whispercpp_model: str = os.getenv(
            "WHISPERCPP_MODEL", "./models/ggml-small.bin"
        )
        self.asr_model: str = os.getenv("ASR_MODEL", "small")
        self.language: str = os.getenv("LANGUAGE", "kn")
        # MOCK_MODE lets the whole pipeline run with no model loaded.
        # This is how B builds the UI while A is still wiring inference,
        # and it is the emergency fallback if inference dies before the demo.
        self.mock_mode: bool = os.getenv("MOCK_MODE", "false").lower() == "true"
        self.schemes_dir: Path = Path(os.getenv("SCHEMES_DIR", ROOT / "data" / "schemes"))
        self.data_dir: Path = Path(os.getenv("DATA_DIR", ROOT / "data"))
        self.forms_dir: Path = Path(os.getenv("FORMS_DIR", ROOT / "data" / "forms"))

        # Only the in-process backend needs weights on disk. The server backend
        # is validated by /health hitting the server, not by a path check.
        if not self.mock_mode and self.backend == "mlx" and not Path(self.model_path).exists():
            raise RuntimeError(
                f"MODEL_PATH does not exist: {self.model_path}\n"
                "Download the model, use BACKEND=server, or start with MOCK_MODE=true"
            )


settings = Settings()
