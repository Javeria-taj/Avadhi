"""Answer one question about an official PDF: can we fill it automatically?

    python scripts/inspect_form.py path/to/CLAIMFORM.pdf

If it reports AcroForm fields, auto-filling is ~20 lines and robust.
If it reports a flat PDF, filling means overlaying text at hand-mapped
coordinates - roughly 1-2 hours per form, and it breaks whenever the form is
revised.

With --grid it also writes a coordinate-grid overlay so you can read field
positions straight off the page instead of guessing.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def inspect(path: Path) -> dict:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    info: dict = {
        "pages": len(reader.pages),
        "encrypted": reader.is_encrypted,
        "acroform_fields": {},
        "page_sizes": [],
    }

    for page in reader.pages:
        box = page.mediabox
        info["page_sizes"].append((round(float(box.width), 1), round(float(box.height), 1)))

    try:
        fields = reader.get_fields()
        if fields:
            for name, field in fields.items():
                info["acroform_fields"][name] = {
                    "type": field.get("/FT"),
                    "value": field.get("/V"),
                }
    except Exception as exc:  # noqa: BLE001
        info["acroform_error"] = str(exc)

    text = ""
    try:
        text = reader.pages[0].extract_text() or ""
    except Exception:  # noqa: BLE001
        pass
    info["has_extractable_text"] = len(text.strip()) > 50
    info["first_page_text_sample"] = text.strip()[:300]

    return info


def write_grid(path: Path, out: Path) -> None:
    """Overlay a labelled 10mm grid so field coordinates can be read off directly."""
    import io

    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    reader = PdfReader(str(path))
    writer = PdfWriter()

    for page in reader.pages:
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)

        buffer = io.BytesIO()
        overlay = canvas.Canvas(buffer, pagesize=(width, height))
        overlay.setStrokeColorRGB(1, 0, 0)
        overlay.setFillColorRGB(1, 0, 0)
        overlay.setLineWidth(0.25)
        overlay.setFont("Helvetica", 5)

        step = 10 * mm
        x = 0
        while x < width:
            overlay.line(x, 0, x, height)
            overlay.drawString(x + 1, 3, f"{int(x / mm)}")
            x += step
        y = 0
        while y < height:
            overlay.line(0, y, width, y)
            overlay.drawString(2, y + 1, f"{int(y / mm)}")
            y += step

        overlay.save()
        buffer.seek(0)
        page.merge_page(PdfReader(buffer).pages[0])
        writer.add_page(page)

    with out.open("wb") as handle:
        writer.write(handle)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--grid", action="store_true",
                        help="write <name>-grid.pdf with a labelled 10mm coordinate grid")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"Not found: {args.pdf}")
        return 1

    info = inspect(args.pdf)

    print(f"\n{args.pdf.name}")
    print(f"  pages         {info['pages']}")
    print(f"  page size     {info['page_sizes'][0]} pt "
          f"({round(info['page_sizes'][0][0] / 2.835)}x"
          f"{round(info['page_sizes'][0][1] / 2.835)} mm)")
    print(f"  encrypted     {info['encrypted']}")
    print(f"  text layer    {'yes' if info['has_extractable_text'] else 'NO - likely a scan'}")

    fields = info["acroform_fields"]
    print(f"\n  AcroForm fields: {len(fields)}")

    if fields:
        print("\n  FILLABLE. Auto-fill is ~20 lines with pypdf and robust to layout tweaks.\n")
        for name, meta in list(fields.items())[:40]:
            print(f"    {name}   type={meta['type']}")
        if len(fields) > 40:
            print(f"    ... and {len(fields) - 40} more")
    else:
        print("\n  FLAT PDF - no form fields.")
        print("  Filling means overlaying text at hand-mapped (x, y) coordinates.")
        print("  Budget 1-2 hours per form, and expect it to break if the form is revised.")
        if not info["has_extractable_text"]:
            print("  No text layer either - this is a scanned image. Hardest case.")
        print("\n  Re-run with --grid to get a coordinate overlay for mapping.")

    if args.grid:
        out = args.pdf.with_name(f"{args.pdf.stem}-grid.pdf")
        write_grid(args.pdf, out)
        print(f"\n  Grid written: {out}")
        print("  Open it, read the mm coordinates of each blank, and put them in")
        print("  data/forms/templates/<form_id>.json")

    return 0


if __name__ == "__main__":
    sys.exit(main())
