"""One place that talks to Gemma.

Why an abstraction instead of calling MLX directly
--------------------------------------------------
MLX is Apple-Silicon only. If you develop on Windows and demo on a Mac, a
direct MLX call means the path you demo is not the path you tested. So all
inference goes through generate() here, and the backend is config.

Backends
--------
  mock     No model at all. The whole product still works. Use for UI work,
           and as the emergency fallback if inference dies before the demo.

  server   A local OpenAI-compatible HTTP server on 127.0.0.1. This is the
           recommended one: Ollama, llama-server, and LM Studio all speak it,
           it runs on Windows and macOS, and it is still fully offline -
           nothing leaves the machine. Verify with the address bar: 127.0.0.1.

  mlx      Direct in-process MLX on Apple Silicon. Lowest latency, no separate
           process. Mac only.

The offline claim survives all three. "Local HTTP server" is not "cloud API" -
be ready to say that plainly if a judge asks, and be ready to prove it by
pulling the network.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from api.config import settings

log = logging.getLogger(__name__)

_mlx_model = None
_mlx_tokenizer = None


class InferenceError(RuntimeError):
    """Raised when the backend cannot produce a completion.

    Callers must handle this. Nothing user-facing may depend on generation
    succeeding - explain.py falls back to hand-written templates for exactly
    this reason.
    """


def _generate_server(system: str, user: str, max_tokens: int) -> str:
    payload = json.dumps(
        {
            "model": settings.model_name,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            # Deterministic-ish. Extraction is not a creative task, and a
            # different answer on the second run during a demo is a disaster.
            "temperature": 0.1,
            "stream": False,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{settings.llm_base_url}/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.llm_timeout_s) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise InferenceError(
            f"Could not reach the local model server at {settings.llm_base_url}. "
            "Is Ollama or llama-server running?"
        ) from exc
    except TimeoutError as exc:
        raise InferenceError(
            f"Model server timed out after {settings.llm_timeout_s}s."
        ) from exc

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise InferenceError(f"Unexpected response shape: {body}") from exc


def _generate_mlx(system: str, user: str, max_tokens: int) -> str:
    global _mlx_model, _mlx_tokenizer
    try:
        from mlx_lm import generate as mlx_generate
        from mlx_lm import load
    except ImportError as exc:
        raise InferenceError(
            "mlx_lm is not installed. It is Apple-Silicon only - "
            "use BACKEND=server on Windows."
        ) from exc

    if _mlx_model is None:
        log.info("Loading Gemma via MLX from %s", settings.model_path)
        _mlx_model, _mlx_tokenizer = load(settings.model_path)

    prompt = _mlx_tokenizer.apply_chat_template(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        tokenize=False,
        add_generation_prompt=True,
    )
    return mlx_generate(
        _mlx_model, _mlx_tokenizer, prompt=prompt, max_tokens=max_tokens
    ).strip()


def generate(system: str, user: str, max_tokens: int = 400) -> str:
    """Run a completion. Raises InferenceError on any backend failure."""
    if settings.mock_mode:
        raise InferenceError("mock_mode is on - callers must use their mock path")

    if settings.backend == "server":
        return _generate_server(system, user, max_tokens)
    if settings.backend == "mlx":
        return _generate_mlx(system, user, max_tokens)

    raise InferenceError(f"Unknown BACKEND: {settings.backend!r}")


def is_ready() -> bool:
    """Cheap readiness check for /health. Does not run a completion."""
    if settings.mock_mode:
        return True
    if settings.backend == "mlx":
        return _mlx_model is not None
    try:
        with urllib.request.urlopen(f"{settings.llm_base_url}/v1/models", timeout=3):
            return True
    except Exception:
        return False


def warmup() -> bool:
    """Force a first completion so the model is resident before the demo.

    Cold load can take 10-30 seconds. Discovering that on stage is avoidable.
    """
    try:
        generate("Reply with the single word: ok", "ping", max_tokens=8)
        return True
    except InferenceError:
        log.exception("Warmup failed")
        return False
