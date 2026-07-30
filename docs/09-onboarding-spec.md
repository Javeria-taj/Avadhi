# 09 — Onboarding (spec addition)

**Status: additive to the locked spec.** No P0 feature changes. This adds one screen pair
and a Profile object.

---

## The design principle

**Report first, profile later.** Onboarding is always skippable. If a registration form
stands between a farmer and a running 72-hour clock, the product has rebuilt the exact
barrier it exists to remove.

Say this to judges in those words. It reframes "you have no onboarding" from a gap into a
decision.

## Why not typing

A policy number is a long alphanumeric string. It cannot be reliably spoken in Kannada by a
non-literate user, and the app has no text input by design. So the document is
**photographed**, Gemma reads it, and **the person confirms the values on screen**.

This is not the prescription-reading idea that was rejected earlier. Those were handwritten
medical instructions with an unbounded failure mode. These are printed documents with fixed
layouts, and every value is confirmed before anything depends on it. An unconfirmed field is
left **blank** on the generated form rather than guessed.

## What is scanned

| Document | Fields read |
|---|---|
| PMFBY policy certificate / premium receipt | policy number, insurer, crop, area, survey numbers, season |
| Bank passbook first page | account number, IFSC, branch, name |
| Land record (RTC / Pahani) — optional | survey numbers, extent, district |

## What is deliberately NOT collected

- **Aadhaar.** Not required to intimate a claim. Storing it is liability with no benefit.
  `test_profile_has_no_aadhaar_field` enforces this, and the passbook prompt explicitly
  instructs the model not to read an Aadhaar number even if one is visible on the page.
- **Debit or credit cards.** Never photographed. Passbook only.
- **No account, no login, no password.** One profile per device. The person holding the phone
  is the user — correct for a kiosk or assisted-operator deployment, and one less barrier.

Both exclusions are worth volunteering in the Q&A.

---

## Screens for Javeria — two new, one modified

### S0 · First run (new)

Shown only when `GET /api/profile/completeness` returns `completeness: 0`.

- Two large tappable cards: **scan policy certificate**, **scan bank passbook**
- A third, visually primary action: **"ಈಗ ಬೇಡ — ಹಾನಿ ವರದಿ ಮಾಡಬೇಕು"** / *Skip — I need to
  report damage now* → straight to S2 intake
- Footer line: stored on this device only, Aadhaar is never collected

The skip button is the **most prominent element on the screen**. That is the whole point.

### S0b · Confirm what was read (new)

- Any field in `needs_confirmation` renders **large, monospace, amber-bordered**, with its
  confidence shown and an editable value
- Fields above the threshold render as small confirmed chips
- One button: **confirm and save**
- The person can edit any value before saving. What they approve is what persists.

### S1 · Home (modified)

- When `completeness < 1`, show a quiet single-line nudge: *"Add your policy certificate —
  reporting will take 30 seconds next time"* → S0
- Never a modal, never blocking, dismissible

---

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/profile` | Always 200. First run returns an empty profile, never 404. |
| GET | `/api/profile/completeness` | `{completeness, scanned_documents, account_last4, has_pmfby_policy}` — drives the nudge |
| POST | `/api/profile/scan` | multipart: `image` + `kind`. Returns proposed fields. **Saves nothing.** |
| POST | `/api/profile/confirm` | form: `kind` + `fields` (JSON object of approved values). Persists. |
| POST | `/api/profile/reset` | Wipes the profile. Needed between demo runs. |

`ScanResult`:
```jsonc
{
  "kind": "pmfby_certificate",
  "fields": {
    "pmfby_policy_number": { "value": "PMFBY/KA/2026/8841", "confidence": 0.72, "confirmed": false },
    "crop":                { "value": "Cotton",             "confidence": 0.97, "confirmed": false }
  },
  "needs_confirmation": ["pmfby_policy_number", "crop"]
}
```

Anything below **0.95** confidence lands in `needs_confirmation`. In practice almost
everything read off a photograph does — confirmation is the normal path, not an error path.

`POST /api/profile/confirm` body example:
```
kind=pmfby_certificate
fields={"pmfby_policy_number":"PMFBY/KA/2026/8841","crop":"Cotton","land_acres":"1.5"}
```

---

## What this buys, mechanically

`POST /api/intake` now calls `prefill_event()` before evaluating. Fields the profile knows
get filled — but **only fields the speech left empty**. What the person just said always wins.

The measurable effect, covered by `test_prefill_turns_a_need_info_claim_into_an_actionable_one`:

- **Without a profile:** "hail destroyed my cotton" → `need_info`, because we don't know
  whether they hold a policy
- **With a confirmed profile:** same sentence → `open`, 48 hours remaining, checklist ready

That is the demo beat. First report asks a question; every report after that just works.

---

## Demo sequencing

Scan the certificate **during setup, before you go on stage**, so the live demo starts from a
populated profile and goes straight to the money shot.

Then, if you have time in Q&A, hit `POST /api/profile/reset` and show the first-run flow —
including the skip path — to answer "how does a new user start?" That is a much stronger
answer than a slide.

## Judge Q&A additions

**"How does the app know his policy number?"**
He photographs the certificate once. Gemma reads it, he confirms it on screen, and it's
stored on the device. He never types anything.

**"What if the model misreads a digit?"**
Anything below 0.95 confidence is shown large and must be confirmed, and he can correct it.
An unconfirmed field is left blank on the generated form rather than guessed — the form has
a handwriting line for exactly that case.

**"Do you collect Aadhaar?"**
No, deliberately. It isn't required to intimate a claim, so storing it would be liability
with no benefit. We also instruct the model not to read an Aadhaar number even when one is
visible on a passbook page.

**"What if he has no documents to hand when the crop is destroyed?"**
He skips onboarding and reports immediately. The clock matters more than the paperwork. The
system tells him the policy number is still needed and he adds it later.
