"""Application entrypoint.

Run:  uvicorn api.main:app --host 0.0.0.0 --port 8000
Mock: MOCK_MODE=true uvicorn api.main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.models.schemas import HealthResponse
from api.routes import document, intake
from api.rules.loader import load_rules
from api.services import asr, extract

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Claim Window Navigator", version="0.1.0")

# Wide open on purpose: this runs on a local network with no internet,
# for 36 hours. Do not ship this configuration anywhere real.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router, prefix="/api")
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
    )
