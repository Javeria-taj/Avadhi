# Blank official forms

Drop official blank PDFs here (e.g. `pmfby_intimation_v1.pdf`) if you want to overlay
onto the real government form instead of generating a clean summary sheet.

`api/services/document.py` currently generates a summary from scratch, which works with
this directory empty. Overlaying is a P1 nicety, not a P0 requirement — counter staff need
the same facts either way.
