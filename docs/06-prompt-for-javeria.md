# Prompt for Javeria — paste everything below into a new chat in this project

---

I'm Javeria, the frontend lead on a two-person team building a project for the Neo-Nexus 36.1 hackathon (36 hours, BITM Ballari). My teammate Rafi owns the backend and architecture. I own the entire UI. The product spec is **locked** — I'm not redesigning the concept, I'm building the screens.

Please read `docs/05-LOCKED-SPEC.md` and `docs/ASSEMBLY-GUIDE.html` in this project before responding, then help me build.

## What the product is

A **deadline engine for financial rights**. Someone speaks in Kannada about a loss that just happened — hail destroyed their cotton, or money vanished from their bank account. The system works out which insurance/legal claim deadlines are now running, how long is left on each, what evidence to capture right now, and generates a document they carry to the bank. It runs fully offline on-device.

Two verticals:
- **Crop loss** (PMFBY) — must be reported within **72 hours** or the claim is rejected even if the loss was real. This is the most common cause of crop insurance claim rejection in India.
- **Unauthorised bank transaction** (RBI 2017 circular) — reporting within **3 working days** of the bank's communication means zero customer liability. Most people have never heard of this.

## The single most important UI principle

**This must not look or feel like a chatbot or a summariser.** The judges have explicitly said outputs must not be a chatbot or summariser, so this is a scoring criterion, not a preference.

What makes it structurally not-a-chatbot:

1. **Cold open shows state, not a prompt.** Open the app and you see your open cases with live ticking countdowns. A chatbot can't do that because it has nothing to remember.
2. **There is no text input anywhere in the app.** Not one. Voice is an input method for a single event report, not a conversation channel.
3. **No message bubbles, no transcript view, no scrolling chat history.**
4. **The checklist is interactive, not prose.** Each evidence step is a tappable row that persists. The user works through the screen over hours.
5. **Cases have a visible state machine** — `open → reported → surveyed → settled`, shown as progress.

If anything I ask for would push this toward a chat interface, push back and tell me.

## My scope — five screens, and no more

**S1 · Home (cold open)** — case count + offline indicator, reminder banner when any case is under 12h, case rows (countdown, status pill, Kannada scheme name, deadline, progress bar), large mic button at the bottom. Empty state with the mic.

**S2 · Intake** — one large record button, tap to start / tap to stop. Recording state shows a pulse. Processing state disabled. If the backend returns a clarifying question, show the question and **2–3 large tappable option cards** (never a text field).

**S3 · Case detail** — the countdown as hero element, a short Kannada explanation, the numbered evidence checklist with tick + camera buttons, the reporting channels list, a "generate document" button, and the rule's source URL + verified date visible in the footer (not buried — a judge will ask how we know the rule is right).

**S4 · Capture** — live camera preview, one large shutter button. After capture: thumbnail + confirmation, return to S3 with that step ticked. Coordinates/timestamp burned into the image as a corner overlay. If location permission is denied, still save the photo and mark location unverified — never block.

**S5 · Document** — PDF preview, open/share, back to S3.

## Stack and what already exists

- **Next.js 14, App Router, JavaScript (not TypeScript)**
- Plain CSS in `ui/app/globals.css` — **no Tailwind**
- Path alias `@/` is configured in `jsconfig.json`
- `ui/next.config.mjs` rewrites `/api/*` to FastAPI on port 8000

Already built and working — extend these, don't rewrite them:

```
ui/app/layout.jsx          lang="kn", viewport
ui/app/page.jsx            current single-screen version
ui/app/globals.css         the design system — read the comment block at the top
ui/components/Countdown.jsx
ui/components/Recorder.jsx
ui/components/ClaimCard.jsx
ui/lib/api.js              USE_MOCKS switch
ui/lib/mocks.js            mirrors the backend contract exactly
```

## I work entirely against mocks — I am not blocked on Rafi

```bash
cd ui && npm install
cp .env.example .env.local     # set NEXT_PUBLIC_USE_MOCKS=true
npm run dev:https
```

**First task: extend `lib/mocks.js`** to cover the `Case` shape below and all five statuses (`open`, `closing_soon`, `expired`, `need_info`, plus a `reported` state case), so every screen state is reachable without a backend.

## The data contract — FROZEN, do not change

If I need a field that isn't here, I ask Rafi and we both stop to re-sync. Don't invent fields.

```jsonc
// Case — the persistent object behind S1 and S3
{
  "case_id": "c_7f3a",
  "created_at": "2026-07-30T09:14:00+05:30",
  "rule_id": "PMFBY_LOCALISED",
  "event": {
    "event_type": "hailstorm",
    "event_datetime": "2026-07-29T21:30:00+05:30",
    "event_datetime_raw": "last night",
    "crop": "cotton",
    "area_acres": 1.5,
    "has_pmfby_policy": true,
    "confidence": { "event_datetime": 0.7 }
  },
  "claim": {
    "rule_id": "PMFBY_LOCALISED",
    "scheme_name_en": "Pradhan Mantri Fasal Bima Yojana",
    "scheme_name_kn": "ಪ್ರಧಾನ ಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ",
    "status": "open",
    "deadline_iso": "2026-08-01T21:30:00+05:30",
    "hours_remaining": 48.0,
    "evidence_checklist_kn": ["…"],
    "channels": ["…"],
    "explanation_kn": "…",
    "failure_consequence_kn": "…",
    "source_url": "https://pmfby.gov.in/",
    "verified_on": "2026-07-29"
  },
  "state": "open",
  "steps": [
    { "step_id": "s1", "text_kn": "…", "done": false,
      "needs_photo": true, "photo_id": null }
  ],
  "photos": [
    { "photo_id": "p_01", "path": "…", "lat": 15.1394, "lon": 76.9214,
      "accuracy_m": 8.0, "captured_at": "2026-07-30T09:20:11+05:30",
      "location_verified": true }
  ],
  "reminders_sent": []
}
```

Endpoints I call: `GET /api/cases` · `GET /api/cases/{id}` · `POST /api/intake` (multipart audio) · `PATCH /api/cases/{id}/steps/{step_id}` · `POST /api/cases/{id}/photo` (multipart) · `POST /api/document` → PDF.

## Design constraints — these are decided, please respect them

- **No web fonts.** The app runs offline; a network font request is a blank screen. Kannada renders via `'Noto Sans Kannada'` with a system fallback, already in `globals.css`.
- **High contrast, large type.** The real user is holding a phone in daylight, in a field, under time pressure. Normal greys are unreadable there.
- **Colour carries status only, never decoration.** Green = open, amber = closing soon, grey = expired, neutral = needs info.
- **The countdown is the one loud element.** Everything else stays quiet. It ticks every second, and it reports **hours** — "48 hours" creates urgency, "2 days" doesn't.
- **Touch targets minimum 44px.** Camera and record buttons much larger.
- **Expired cases are always shown**, greyed and sunk to the bottom, never hidden. A system that conceals bad news isn't trustworthy with someone's money.
- **The word "geotag" never appears in the UI.** The user taps a camera button; coordinates are captured silently. If the user has to know what geotagging is, the feature is designed wrong.

## Known traps — these have already bitten us

1. **Camera and microphone require HTTPS.** `getUserMedia` and `navigator.geolocation` are blocked on non-secure origins, and they fail **silently with no error message**. Certs live in `ui/certs/` — see the README there. Always use `npm run dev:https`, and test on a real phone over the phone's own hotspot (venue Wi-Fi won't work).
2. **Never read `Date.now()` during render.** Server and client compute different values and Next throws a hydration mismatch. Initialise state to `null` and set it inside `useEffect` — `Countdown.jsx` already does this correctly; copy the pattern.
3. **Env vars need the `NEXT_PUBLIC_` prefix** or they're `undefined` in the browser and mocks silently never turn on.
4. **Request geolocation permission at capture time, not on app load.** Asking on load gets denied.
5. **Browser camera capture does not write EXIF GPS.** Get coordinates from the Geolocation API separately, draw them onto the image via canvas as a visible corner overlay, and send them as separate form fields.
6. Every interactive component needs `'use client'`.

## Build order

1. Extend `lib/mocks.js` to cover the Case shape and all statuses
2. S1 case list with live countdowns
3. S3 case detail with the tappable checklist
4. S2 intake including the clarifying-options state
5. S4 camera capture with the overlay
6. S5 document viewer
7. Reminder banner (only if ahead of schedule)

## How I'd like you to work with me

- One screen at a time. Show me the component, let me react, then move on.
- Give me complete file contents I can paste, not diffs.
- Keep the existing design language in `globals.css` — extend the token set if needed, don't replace it.
- If something I ask for would break the not-a-chatbot principle, the frozen contract, or the offline constraint, say so before building it.
- Don't touch anything under `api/`, `data/`, or `tests/` — that's Rafi's.

Start by reading the two docs, then confirm your understanding of the five screens and ask me anything genuinely ambiguous. Then let's do S1.
