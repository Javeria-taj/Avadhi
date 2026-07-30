# 03 — Architecture & Interface Contract

Stack: **Python + FastAPI** (inference in-process), **React + Next.js** (App Router) over local HTTPS. Python because the whole backend is model orchestration; a JS backend would shell out to Python anyway.

---

## Pipeline

```
Kannada speech
     ↓
[1] ASR — Gemma native audio, else faster-whisper       (both offline)
     ↓  transcript
[2] Gemma — extraction via function calling → EventReport
     ↓
[3] DETERMINISTIC rules engine → ClaimWindow[]           ← no model here
     ↓
[4] Gemma — Kannada explanation of what to do now
     ↓
[5] Intimation document generated (pypdf)
     ↓
[6] Countdown UI + spoken output
```

**The line that wins Technical Execution:** the model never computes a deadline and never decides eligibility. It extracts an event and explains a result. Arithmetic on someone's claim window is done by code that cannot hallucinate, and every rule carries a source citation.

Say it in exactly those terms. Most teams will have let the model do everything.

---

## Interface contract — FREEZE AT T+4

After the freeze, no field changes. B builds the entire UI against mock JSON matching these shapes and never blocks on A. This is the single reason two people can ship in 36 hours.

### `POST /api/intake`
Request: `multipart/form-data` with `audio` (webm/wav), optional `lang` (default `kn`).

```jsonc
// 200 response
{
  "transcript": "…",
  "event": {
    "event_type": "hailstorm",
    "event_datetime": "2026-07-30T21:30:00+05:30",
    "event_datetime_confidence": 0.7,
    "crop": "cotton",
    "area_acres": 1.5,
    "loss_scope": "individual_field",
    "has_pmfby_policy": true,
    "district": "Ballari",
    "state": "KA",
    "missing_fields": ["policy_number"],
    "confidence": { "area_acres": 0.8, "event_datetime": 0.7 }
  },
  "claims": [ /* ClaimWindow[] — see below */ ],
  "clarifying_question_kn": "ನಿಮ್ಮ ಪಾಲಿಸಿ ಸಂಖ್ಯೆ ಇದೆಯೇ?"   // null if nothing needed
}
```

### `ClaimWindow`
```jsonc
{
  "rule_id": "PMFBY_LOCALISED",
  "scheme_name_en": "Pradhan Mantri Fasal Bima Yojana",
  "scheme_name_kn": "…",
  "status": "open" | "closing_soon" | "expired" | "need_info",
  "deadline_iso": "2026-08-02T21:30:00+05:30",
  "hours_remaining": 48.2,
  "matched_rules": ["event_type in [hailstorm,…]", "has_pmfby_policy == true"],
  "missing_info": [],
  "evidence_checklist_kn": ["…", "…"],
  "channels": ["…"],
  "explanation_kn": "…",
  "source_url": "https://pmfby.gov.in/…",
  "verified_on": "2026-07-29",
  "form_id": "pmfby_intimation_v1"
}
```

### `POST /api/document`
Request: `{ "rule_id": "...", "event": { ... } }` → returns `application/pdf`.

### `GET /health`
`{ "status": "ok", "model_loaded": true, "asr_ready": true, "rules_loaded": 3 }`
Hit this before you walk on stage.

---

## Status semantics (B needs these to build the UI)

| status | UI treatment |
|---|---|
| `open` | Green. Countdown in hours. |
| `closing_soon` | Amber, <12h remaining. Prominent. |
| `expired` | Grey, but **still show it** — tell the user what they can still do (grievance route). Never silently hide a missed claim. |
| `need_info` | Blue. Show the clarifying question. |

Handling `expired` honestly is a small thing judges notice. A system that hides bad news isn't trustworthy with money.

---

## Directory layout

```
api/
  main.py                 app, CORS, /health, graceful shutdown
  config.py               env validation at startup — crash fast if unset
  routes/intake.py        HTTP only: parse, call service, return
  routes/document.py
  services/asr.py         audio → transcript
  services/extract.py     transcript → EventReport (Gemma + function calling)
  services/explain.py     ClaimWindow[] → Kannada explanation (Gemma)
  services/document.py    EventReport → filled PDF
  rules/engine.py         predicate evaluation + deadline arithmetic — PURE, NO MODEL
  rules/loader.py         reads data/schemes/*.json
  models/schemas.py       Pydantic — EventReport, ClaimWindow
data/
  schemes/*.json          one file per rule, from doc 02
  forms/*.pdf             blank intimation forms
ui/
  app/            layout.jsx  page.jsx  globals.css
  components/     Recorder.jsx  ClaimCard.jsx  Countdown.jsx
  lib/            api.js  mocks.js
  next.config.mjs proxies /api/* to FastAPI — same origin, no CORS
  certs/          TLS for the microphone
```

Keep the layering. Not for scale — for parallelism, and because judges open the repo.

**Deliberate omissions, and say so if asked:** no database (JSON on disk), no auth, no migrations, no containers. A 36-hour prototype that ships a Postgres schema it doesn't need is showing off, not engineering.

---

## Rules engine — the part that must be right

Pure function, no I/O, no model:

```
evaluate(event, rules) -> ClaimWindow[]
  for each rule:
    if any predicate references a field absent from event → status = need_info
    elif all predicates true:
        deadline = event.event_datetime + (window_hours or window_days)
        hours_remaining = deadline - now
        status = expired if remaining <= 0
                 else closing_soon if remaining < 12
                 else open
    else: skip
```

**Two traps:**

1. **Timezone.** Everything in IST, timezone-aware datetimes throughout. A naive-datetime bug produces a deadline 5.5 hours wrong — invisible in testing, fatal on stage.
2. **Relative time.** "Last night" must resolve against the actual current time. Have Gemma emit a relative descriptor plus a confidence, and resolve it in code — do not ask the model to do date arithmetic. When confidence is low, ask the user to confirm the date. That confirmation step is a *feature*: it's how a careful system behaves when someone's claim depends on the answer.

**Write unit tests for this before wiring the UI.** Fifteen hand-written event fixtures covering every rule, both boundaries of each window, and the missing-field path. It's the only part where a silent error costs someone money, and it's the part a judge can inspect.

---

## Parallel split

**A (backend):** ASR → extraction → rules engine → PDF. Owns `data/schemes/*.json`.
**B (frontend):** recorder, countdown, claim cards, checklist, PDF preview. Owns the deck and the Kaggle write-up from T+10.

Sync points only: **T+4** contract freeze, **T+14** mutual walkthrough, **T+24** end-to-end checkpoint. Otherwise heads down.
