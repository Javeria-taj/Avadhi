"""Environment config, validated at startup. Crash at boot, never at runtime."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Settings:
    def __init__(self) -> None:
        # Inference backend: "mlx" (MacBook M4) or "llamacpp" (S24 via Termux)
        self.backend: str = os.getenv("BACKEND", "mlx")
        self.model_path: str = os.getenv("MODEL_PATH", str(ROOT / "models" / "gemma-4b"))
        self.asr_backend: str = os.getenv("ASR_BACKEND", "whisper")
        self.asr_model: str = os.getenv("ASR_MODEL", "small")
        self.language: str = os.getenv("LANGUAGE", "kn")
        # MOCK_MODE lets the whole pipeline run with no model loaded.
        # This is how B builds the UI while A is still wiring inference,
        # and it is the emergency fallback if inference dies before the demo.
        self.mock_mode: bool = os.getenv("MOCK_MODE", "false").lower() == "true"
        self.schemes_dir: Path = Path(os.getenv("SCHEMES_DIR", ROOT / "data" / "schemes"))
        self.forms_dir: Path = Path(os.getenv("FORMS_DIR", ROOT / "data" / "forms"))
        self.data_dir: Path = Path(os.getenv("DATA_DIR", ROOT / "data"))

        if not self.mock_mode and not Path(self.model_path).exists():
            raise RuntimeError(
                f"MODEL_PATH does not exist: {self.model_path}\n"
                "Either download the model or start with MOCK_MODE=true"
            )


settings = Settings()
