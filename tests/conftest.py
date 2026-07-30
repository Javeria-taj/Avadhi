"""Test-wide setup.

MOCK_MODE must be set before any api.* import, because api.config validates the
model path at import time and crashes if it is missing. That crash is correct
behaviour in production - it means you find out at boot, not at hour 20 - but
tests must not need a 3GB model on disk.
"""
import os
import tempfile
from pathlib import Path

os.environ["MOCK_MODE"] = "true"

# Point case storage at a throwaway directory so tests never touch real cases.
_tmp = Path(tempfile.mkdtemp(prefix="neonexus-tests-"))
(_tmp / "schemes").mkdir(parents=True, exist_ok=True)
os.environ.setdefault("DATA_DIR", str(_tmp))
