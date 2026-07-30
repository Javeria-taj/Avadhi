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

  server   Any OpenAI-compatible /v1/chat/completions endpoint.

           LOCAL (the demo): Ollama or llama-server on 127.0.0.1. Fully
           offline - nothing leaves the machine, provable in airplane mode.

           HOSTED (the submission link): a hosted Gemma endpoint, reached with
           LLM_API_KEY. Same code, same commit, different LLM_BASE_URL.

           The distinction is config, not code. Demo the local one.

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


def _user_content(user: str, image_b64: str | None) -> object:
    """OpenAI-style multimodal content. Gemma 3 is multimodal, and Ollama's
    /v1/chat/completions accepts a base64 data URI."""
    if image_b64 is None:
        return user
    return [
        {"type": "text", "text": user},
        {"type": "image_url",
         "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
    ]


def _generate_server(
    system: str, user: str, max_tokens: int, image_b64: str | None = None
) -> str:
    payload = json.dumps(
        {
            "model": settings.model_name,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": _user_content(user, image_b64)},
            ],
            "max_tokens": max_tokens,
            # Deterministic-ish. Extraction is not a creative task, and a
            # different answer on the second run during a demo is a disaster.
            "temperature": 0.1,
            "stream": False,
        }
    ).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    # Only set when talking to a hosted endpoint. A local Ollama or
    # llama-server needs no key and ignores the header if sent.
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"

    request = urllib.request.Request(
        f"{settings.llm_base_url}/v1/chat/completions",
        data=payload,
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.llm_timeout_s) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        if exc.code in (401, 403):
            raise InferenceError(
                f"Model endpoint rejected the credentials ({exc.code}). Check LLM_API_KEY."
            ) from exc
        if exc.code == 429:
            raise InferenceError("Model endpoint rate-limited the request (429).") from exc
        raise InferenceError(f"Model endpoint returned {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise InferenceError(
            f"Could not reach the model endpoint at {settings.llm_base_url}. "
            "If local: is Ollama or llama-server running? If hosted: check the URL."
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


def generate(
    system: str, user: str, max_tokens: int = 400, image_b64: str | None = None
) -> str:
    """Run a completion. Raises InferenceError on any backend failure."""
    if settings.mock_mode:
        raise InferenceError("mock_mode is on - callers must use their mock path")

    if settings.backend == "server":
        return _generate_server(system, user, max_tokens, image_b64)
    if settings.backend == "mlx":
        if image_b64 is not None:
            raise InferenceError(
                "Image input is not wired for the mlx backend. Use BACKEND=server."
            )
        return _generate_mlx(system, user, max_tokens)

    raise InferenceError(f"Unknown BACKEND: {settings.backend!r}")


def is_ready() -> bool:
    """Cheap readiness check for /health. Does not run a completion."""
    if settings.mock_mode:
        return True
    if settings.backend == "mlx":
        return _mlx_model is not None
    request = urllib.request.Request(f"{settings.llm_base_url}/v1/models")
    if settings.llm_api_key:
        request.add_header("Authorization", f"Bearer {settings.llm_api_key}")
    try:
        with urllib.request.urlopen(request, timeout=5):
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
