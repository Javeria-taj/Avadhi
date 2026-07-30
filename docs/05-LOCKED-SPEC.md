# 05 — LOCKED SPEC

**Status: FROZEN.** Nothing in the P0 list changes after this. New ideas go in the P2 slide list, not the build.

---

## 1. What the product is, in one sentence

A deadline engine for financial rights: you say what happened, it tells you which claim clocks are now running, walks you through capturing the evidence before it decays, and keeps reminding you until the claim is filed or dead.

**Not** a chatbot. **Not** a summariser. The proof of that is structural: open the app cold and you see your open cases with live countdowns, because the app has state. A chatbot has nothing to remember.

---

## 2. Locked decisions

| Question | Locked answer |
|---|---|
| Inference | **On-device.** Gemma on the M4 (kiosk tier), S24 as client over the phone's hotspot. API keys allowed for development speed only — never for the demo. |
| Track / focus | AI for Humanitarian Tech → FOCUS-06 Financial Inclusion |
| Verticals | Two: crop loss (PMFBY, 72h) and unauthorised bank transaction (RBI, 3 working days) |
| Photos | Yes. Silent GPS + timestamp. The word "geotag" never appears in the UI. |
| Language | Kannada primary, English labels secondary |
| Storage | JSON files on disk. No database. |
| Who decides eligibility | The deterministic rules engine. Never the model. |

**M4 is fanless — do not run sustained inference in the 20 minutes before the demo.**

---

## 3. Feature list — final

### P0 — must exist. This is the demo.

1. **Case list home screen.** Cold open shows open cases with live countdowns, sorted most-urgent-first. Includes expired cases, never hidden.
2. **Voice intake.** Tap mic, speak in Kannada, tap stop. No text input anywhere in the app.
3. **Extraction.** Gemma → `EventReport`. Proposes `event_type`; never decides eligibility, never computes a date.
4. **Clarifying options.** When `event_type` is unknown or date confidence is low, ask ONE question, spoken in Kannada, answered by 2–3 large tappable cards. Never asks the user to classify a peril — asks what they saw.
5. **Rules engine.** Two rule sets live: `PMFBY_LOCALISED` (72 hours) and `RBI_UNAUTH_TXN` (3 working days, working-day arithmetic).
6. **Live countdown.** Ticks every second. Hours, not days.
7. **Evidence checklist.** Numbered, tappable, persists across sessions. Order matters (wide shot before you walk into the field).
8. **Guided photo capture.** Camera button inside a checklist step. Coordinates + timestamp + accuracy captured silently and burned as a corner overlay. Stored locally.
9. **Case persistence.** Cases survive app restart. State: `open → reported → surveyed → settled`, plus `expired`.
10. **Generated document.** Intimation PDF with the event facts, blank fields for what must be handwritten, the reporting channels, and the rule's source citation.
11. **Offline operation.** Full flow completes in airplane mode.

### P1 — build only if ahead at T+20

12. Reminder banner on the case list at T-48 / T-24 / T-6 (in-app; real push notifications are P2).
13. Kannada text-to-speech for the explanation.
14. Second live voice intake for the bank-fraud vertical during the demo.

### P2 — slide only. Do not build. Do not discuss building.

PMSBY / PMJJBY / EPF / Ombudsman escalation rules · real push notifications · handoff/upload into the official Crop Insurance app · severity estimation from photos (**deliberately excluded** — that is the surveyor's statutory job and the one output that would be checked against reality) · multi-user accounts · sync between devices.

---

## 4. Screens — five, and no more

### S1 · Home (cold open)
- Header: case count + offline indicator
- Reminder banner (P1) when any case is under 12h
- Case rows: countdown, status pill, scheme name in Kannada, deadline, progress bar
- Bottom: large mic button → S2
- Empty state: "Report something new" + mic

### S2 · Intake
- Large record button, tap to start / tap to stop
- Recording state: pulse + "ನಿಲ್ಲಿಸಿ"
- Processing state: disabled + "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…"
- If a clarifying question comes back: spoken question + 2–3 tappable option cards
- On success → S3

### S3 · Case detail
- Countdown (hero element, status-coloured)
- Kannada explanation, one short paragraph
- Evidence checklist: numbered rows, each with a tick and, where relevant, a camera button → S4
- Reporting channels list
- "ದಾಖಲೆ ತಯಾರಿಸಿ" → S5
- Footer: rule source URL + verified date, visible not buried

### S4 · Capture
- Live camera preview, one large shutter button
- After capture: thumbnail + "ಫೋಟೋ ಉಳಿಸಲಾಗಿದೆ ✓", returns to S3 with that step ticked
- Coordinate/time overlay burned into the image
- If location permission is denied: still save the photo, mark it as unverified location, do not block

### S5 · Document
- PDF preview, open/share button, back to S3

**No chat surface. No message bubbles. No transcript view. No text input on any screen.**

---

## 5. Contract additions

Everything in `api/models/schemas.py` stays. These are additive.

```jsonc
// Case — the new persistent object
{
  "case_id": "c_7f3a",
  "created_at": "2026-07-30T09:14:00+05:30",
  "rule_id": "PMFBY_LOCALISED",
  "event": { /* EventReport */ },
  "claim": { /* ClaimWindow */ },
  "state": "open" | "reported" | "surveyed" | "settled" | "expired",
  "steps": [
    { "step_id": "s1", "text_kn": "…", "done": false,
      "needs_photo": true, "photo_id": null }
  ],
  "photos": [
    { "photo_id": "p_01", "path": "data/photos/p_01.jpg",
      "lat": 15.1394, "lon": 76.9214, "accuracy_m": 8.0,
      "captured_at": "2026-07-30T09:20:11+05:30",
      "location_verified": true }
  ],
  "reminders_sent": []
}
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cases` | Case list for S1. Recomputes countdowns server-side. |
| POST | `/api/intake` | *(exists)* audio → transcript + event + claims. Now also creates a Case and returns `case_id`. |
| GET | `/api/cases/{id}` | S3 detail |
| PATCH | `/api/cases/{id}/steps/{step_id}` | `{ "done": true }` |
| POST | `/api/cases/{id}/photo` | multipart: image + lat + lon + accuracy + captured_at |
| POST | `/api/document` | *(exists)* → PDF |
| GET | `/health` | *(exists)* pre-demo check |

**Freeze this at T+4.** After the freeze, no field changes without both people stopping to re-sync.

---

## 6. Work split

### Teammate — UI. Can start immediately, blocked on nothing.

Set `NEXT_PUBLIC_USE_MOCKS=true` and build every screen against `lib/mocks.js`. Extend the mocks to cover the Case shape above and all five statuses.

Build order:
1. S1 case list with live countdowns (two mock cases, different statuses)
2. S3 case detail with tappable checklist
3. S2 intake with the clarifying-options state
4. S4 camera capture — `getUserMedia({video:true})` + `navigator.geolocation.getCurrentPosition()`, canvas overlay, POST as multipart
5. S5 document viewer
6. Reminder banner (P1)

Also owns: slides, the Kaggle write-up from T+10, and creating/verifying the Kaggle account tonight.

**Camera gotchas:** camera and geolocation both need HTTPS — already solved via `ui/certs/`. Request the location permission at capture time, not on app load. Handle denial by saving the photo anyway.

### You — backend.

1. Working-day calculator + tests (holiday list is data). **Highest-risk correctness item after the timezone handling.**
2. `RBI_UNAUTH_TXN` rule JSON
3. Case store: `data/cases.json`, load/save, and the state machine
4. New endpoints above
5. Photo storage + metadata
6. Extraction prompt tuning until `EventReport` fills reliably from messy Kannada speech
7. Clarifying-question logic: which single question actually changes the outcome
8. Reminder scheduling (P1)

### Sync points only
**T+4** contract freeze · **T+14** mutual walkthrough · **T+24** end-to-end must work · **T+28** code freeze.

---

## 7. What we are deliberately not claiming

Rehearse these. Volunteering a limit beats being caught at one.

- **We are not the submission channel.** The official routes are the Crop Insurance app, CROPIC, 14447, the insurer, the bank, or an agriculture officer. We prepare the report and the evidence; the farmer or the officer files it.
- **We do not assess severity or loss percentage.** A surveyor does that on site, by statute.
- **We demoed on a flagship phone.** Here are our measured numbers and a handicapped run. Field testing on real hardware comes before any stronger claim.
- **Two verticals, verified against primary sources.** Not twenty unverified ones.
- **Where official sources conflict, we say "verify" rather than asserting.** We found two such conflicts. The PMFBY helpline appears as 14447 in Agriculture Ministry material — confirm on pmfby.gov.in before the demo.
