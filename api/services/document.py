"""Generate the intimation document the person carries to the bank.

If a blank official PDF exists in data/forms/, overlay onto it. Otherwise
generate a clean one-page summary from scratch - which is genuinely useful,
because the counter staff need the same facts either way.
"""
from __future__ import annotations

import io
from datetime import datetime

from api.models.schemas import ClaimWindow, EventReport


def build_intimation_pdf(event: EventReport, claim: ClaimWindow) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 25 * mm

    def line(text: str, size: int = 11, gap: float = 7 * mm, bold: bool = False) -> None:
        nonlocal y
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawString(20 * mm, y, text)
        y -= gap

    line("CROP LOSS INTIMATION", 16, 10 * mm, bold=True)
    line(claim.scheme_name_en, 12, 10 * mm)

    line(f"Generated: {datetime.now().strftime('%d-%m-%Y %H:%M')}", 9)
    if claim.deadline_iso:
        line(f"Report before: {claim.deadline_iso.strftime('%d-%m-%Y %H:%M')} IST", 11, bold=True)
    y -= 4 * mm

    line("EVENT", 12, 8 * mm, bold=True)
    line(f"Cause of loss:  {event.event_type.value}")
    if event.event_datetime:
        line(f"Date and time:  {event.event_datetime.strftime('%d-%m-%Y %H:%M')}")
    if event.crop:
        line(f"Crop:  {event.crop}")
    if event.area_acres:
        line(f"Area affected:  {event.area_acres} acres")
    if event.district:
        line(f"District:  {event.district}")
    y -= 4 * mm

    line("TO BE FILLED BY HAND", 12, 8 * mm, bold=True)
    for field in ("Policy number", "Survey number(s)", "Bank account number", "Mobile number"):
        line(f"{field}: " + "_" * 45, 11, 9 * mm)
    y -= 2 * mm

    line("REPORT THROUGH ANY ONE OF", 12, 8 * mm, bold=True)
    for channel in claim.channels:
        line(f"  -  {channel}", 10, 6 * mm)

    y -= 4 * mm
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(20 * mm, y, f"Rule source: {claim.source_url}  |  verified {claim.verified_on}")
    y -= 5 * mm
    pdf.drawString(20 * mm, y, "Generated on-device. Verify details before submission.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
