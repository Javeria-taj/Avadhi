"""Application entrypoint.

Run:  uvicorn api.main:app --host 0.0.0.0 --port 8000
Mock: MOCK_MODE=true uvicorn api.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models.schemas import HealthResponse
from api.routes import cases, document, intake, profile
from api.rules.loader import load_rules
from api.config import settings
from api.services import asr, extract, llm

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Cold model load can take 10-30s. Pay that at boot, not on stage."""
    if settings.mock_mode:
        logging.info("MOCK_MODE on - no model will be loaded")
    else:
        logging.info("Warming %s backend at %s", settings.backend, settings.llm_base_url)
        if llm.warmup():
            logging.info("Model warm and ready")
        else:
            logging.error("Model warmup FAILED - check the server, or set MOCK_MODE=true")
    yield


app = FastAPI(title="Claim Window Navigator", version="0.1.0", lifespan=lifespan)

# Wide open on purpose: this runs on a local network with no internet,
# for 36 hours. Do not ship this configuration anywhere real.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(document.router, prefix="/api")


@app.exception_handler(Exception)
async def unhandled(request, exc):
    """Never leak a stack trace to the client - including on stage."""
    logging.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "internal_error",
                                             "message": "Something went wrong. Try again."}},
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Hit this before you walk on stage."""
    return HealthResponse(
        status="ok",
        model_loaded=extract.is_loaded(),
        asr_ready=asr.is_ready(),
        rules_loaded=len(load_rules()),
        backend="mock" if settings.mock_mode else settings.backend,
        model_name=settings.model_name,
        deployment=settings.deployment,
    )
