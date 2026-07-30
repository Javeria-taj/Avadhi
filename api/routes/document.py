from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from api.models.schemas import DocumentRequest
from api.rules.engine import evaluate
from api.rules.loader import load_rules
from api.services.document import build_intimation_pdf

router = APIRouter()
RULES = load_rules()


@router.post("/document")
async def document(request: DocumentRequest) -> Response:
    claims = evaluate(request.event, RULES)
    claim = next((c for c in claims if c.rule_id == request.rule_id), None)
    if claim is None:
        raise HTTPException(status_code=404, detail=f"No active claim for {request.rule_id}")

    pdf = build_intimation_pdf(request.event, claim)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{request.rule_id}_intimation.pdf"'},
    )
