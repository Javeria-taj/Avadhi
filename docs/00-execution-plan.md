# Neo-Nexus 36.1 — Execution Plan

**Team:** 2 (A = backend-lead, B = frontend-lead) · Both Kannada-fluent
**Domain:** AI for Humanitarian Tech · **Focus:** FOCUS-06 Financial Inclusion
**Project:** Voice-first welfare & insurance entitlement navigator, fully offline
**Event:** 30–31 July 2026, BITM Ballari · Hardware: MacBook M4, Galaxy S24

> ### ⚠️ Partially superseded — read this first
>
> This document was written for the earlier **welfare scheme navigator** concept, before the
> pivot to the **claim-window enforcer**. Its two-person analysis, timeline, sleep discipline
> and risk register are all still correct and still worth reading.
>
> Where it disagrees with the newer docs, the newer docs win:
>
> | For this | Use |
> |---|---|
> | Domain rules and content | `02-claim-rules-knowledge-base.md` |
> | Architecture and the frozen contract | `03-architecture-and-contract.md` |
> | Demo script, judge Q&A, Kaggle write-up | `04-demo-qa-writeup.md` |
> | Setup steps | `01-setup-runbook.md` |
>
> Ignore any mention of "ten schemes" or eligibility determination — the project now computes
> **claim deadlines** from three verified rules.


---

## 0. The two-person reality

You are at the minimum team size, competing against teams of four. Three consequences:

1. **No exploration.** Every hour spent evaluating an alternative is an hour a 4-person team spends building. Decisions in this doc are pre-made. Don't relitigate them at hour 12.
2. **The deliverable tax is doubled.** Video + Kaggle write-up + slides costs roughly the same wall-clock for 2 people as for 4, but it's half your capacity. B starts write-up assets at hour 4.
3. **Your advantage is coordination.** No merge conflicts, no idle members, no consensus meetings. Use it: define the interface contract early, then work in parallel without checking in.

**Scope law:** one P0 path, demoed flawlessly. Everything else is a slide.

---

## 1. Pre-event: 26–29 July

This week decides the event. Do all of it before you travel.

### 1.1 The architecture gate (do this FIRST — by evening of 28th)

Neither of you is an Android-native dev, so "Gemma on the S24" is the highest-risk unknown left. Attempt it, with a hard cutoff.

**Path A — true on-device (attempt first):**
- Install Termux on the S24, build/install `llama.cpp`, load a quantized Gemma 4 E4B (Q4_K_M).
- Success criteria: loads without OOM, ≥8 tok/s sustained, survives a 3-minute run without thermal collapse.

**Path B — kiosk architecture (fallback):**
- Gemma runs on the M4 under MLX or llama.cpp/Metal. The S24 is a thin client over **the phone's own hotspot** (never venue Wi-Fi).
- Still 100% offline — no internet, no cloud, no API. That claim survives intact.
- Reframe the pitch: a shared village kiosk at the panchayat office or Common Service Centre, operated by an assistant. This is arguably the *more* realistic deployment — the target user often doesn't own a smartphone. Don't present it apologetically.

**Decide by the evening of the 28th and stop.** If Path A isn't clean by then, ship Path B and rewrite two slides. Do not carry this uncertainty into the event.

### 1.2 Benchmarks to capture (you need these numbers on a slide)

Whichever path wins, record: peak resident RAM, sustained tokens/sec, cold model load time. Then do one deliberately handicapped run (fewer threads, or a smaller quant) and record that it still completes. You have no midrange device, so you *measure* the envelope instead of claiming it.

### 1.3 Content research (allowed pre-work — this is research, not product code)

Curate **exactly ten** financial-inclusion schemes. Ten you have hand-verified beats a hundred you haven't. Suggested set:

| # | Scheme | Instrument type |
|---|---|---|
| 1 | PMFBY | Crop insurance |
| 2 | PMJJBY | Life insurance |
| 3 | PMSBY | Accident insurance |
| 4 | Atal Pension Yojana | Pension |
| 5 | PM-KISAN | Income support |
| 6 | Kisan Credit Card | Credit |
| 7 | NSAP — old-age pension | Pension |
| 8 | Widow pension (IGNWPS) | Pension |
| 9 | Sukanya Samriddhi | Savings |
| 10 | PMMY / Mudra | Micro-credit |

For each, capture: eligibility rules as structured predicates, benefit summary in Kannada and English, the official blank application PDF, and the source URL. This is your entire knowledge base — build it now, offline-ready.

### 1.4 Integrity check

Message Dr Abdul Lateef Haroon (+91 9738973034) or A Ananda (+91 8904282081) and confirm what pre-work is permitted. Standard practice: environment setup, model downloads, and research assets are fine; product code is written during the event window. **Get this in writing and keep your commit history inside the event window.** A disqualification on a technicality would be the worst possible way to lose this.

### 1.5 Kit checklist

- [ ] Model weights on **both** devices — never download at the venue
- [ ] All 10 scheme PDFs + blank forms, stored locally
- [ ] **USB-C → HDMI adapter** and a wired screen-mirror path for the S24 (venue Wi-Fi will be saturated by 40 teams; wireless casting will fail)
- [ ] **Local HTTPS via `mkcert`** — `getUserMedia` (microphone) is blocked on non-secure origins, so a LAN IP without TLS silently kills your mic. Solve this at home, not at hour 20.
- [ ] Power bank, spare cables, phone stand
- [ ] Both devices' OS updates done and disabled
- [ ] Repo initialized, README skeleton, `.env.example`

---

## 2. Architecture

**Stack:** Python + FastAPI backend (ML inference in-process), React + Next.js (App Router) frontend. Python because the whole pipeline is inference and orchestration; a JS backend would mean shelling out to Python anyway.

```
Kannada speech in
      ↓
[1] ASR  → Gemma 4 native audio, else faster-whisper (both fully offline)
      ↓  raw transcript
[2] Gemma 4 — profile extraction via function calling → UserProfile JSON
      ↓
[3] DETERMINISTIC rules engine → EligibilityResult[]     ← no LLM here
      ↓
[4] Gemma 4 — explanation generation in Kannada
      ↓
[5] PDF form fill (pypdf) → completed application
      ↓
[6] Kannada TTS + on-screen result
```

### The design decision that wins Technical Execution

**The model never decides eligibility.** Gemma does extraction and explanation — what language models are genuinely good at. A deterministic, auditable rules engine decides yes/no — what must never hallucinate.

Say this out loud to the judges. It is the single sharpest engineering statement in your pitch, it pre-empts the "what about hallucination?" question, and most teams will have let the LLM decide everything.

### The contract — freeze this at hour 4

```jsonc
// UserProfile — output of step 2
{
  "age": 46, "gender": "female", "occupation": "small_farmer",
  "land_acres": 1.8, "annual_income_band": "under_1L", "state": "KA",
  "caste_category": "OBC", "has_bank_account": true, "aadhaar_linked": true,
  "dependents": 3, "existing_coverage": ["PMJJBY"],
  "confidence": { "land_acres": 0.6 }   // low confidence → clarifying question
}

// EligibilityResult — output of step 3
{
  "scheme_id": "PMFBY", "name_en": "...", "name_kn": "...",
  "status": "eligible" | "likely" | "need_info" | "ineligible",
  "matched_rules": ["land_acres <= 2", "occupation == small_farmer"],
  "missing_info": [],
  "benefit_summary_kn": "...", "annual_value_inr": 12000,
  "form_id": "pmfby_v3"
}
```

B codes the entire frontend against mock JSON matching this from hour 4 and never blocks on A. This is the whole reason a 2-person team can ship.

### Deliberate departures from production practice

This is a 36-hour prototype, so: no database (JSON files on disk), no auth, no migrations, no containerization. Keep the layer separation (`routes / services / rules / models`) purely because it lets two people work in parallel and because judges do a repository check — not because it needs to scale.

---

## 3. The 36 hours

T+0 = event start. Adjust if the actual start time differs.

| Window | A (backend) | B (frontend) |
|---|---|---|
| **T+0–2** | Stand up FastAPI skeleton, load model, verify inference path end-to-end with a hardcoded string | Next.js app shell, record-button flow, results screen against mock JSON |
| **T+2–4** | ASR wired: audio in → transcript out. **Gate: if Kannada ASR is bad, switch to faster-whisper now** | Kannada UI strings, layout locked to phone viewport |
| **T+4** | **Freeze the contract.** 15-minute sync. No interface changes after this point | |
| **T+4–10** | Profile extraction prompt + function calling. Iterate until it reliably fills UserProfile from messy Kannada speech | Full result UI, per-scheme cards, then **start write-up assets**: architecture diagram, screenshots |
| **T+10–14** | Rules engine for all 10 schemes + unit tests on 15 hand-written profiles | PDF preview screen; begin slide skeleton |
| **T+14–15** | Handover sync: A demos backend to B, B demos UI to A | |
| **T+15–20** | **Both sleep. Same window.** A tired 2-person team at the demo is worse than 5 extra hours of code | |
| **T+20–24** | PDF form fill + Kannada explanation generation | Wire real API, kill the mocks |
| **T+24** | **Hard checkpoint: first full end-to-end run must work.** If it doesn't, cut PDF fill and ship without it | |
| **T+24–28** | Error handling, edge cases, repo cleanup, README | Polish, loading states, the airplane-mode indicator |
| **T+28** | **CODE FREEZE. No exceptions.** | |
| **T+28–32** | Architectural walkthrough video (A narrates) | Kaggle write-up finalized, slides finalized |
| **T+32–34** | **Rehearse the demo 15+ times.** Record a clean backup video of a successful run | |
| **T+34–36** | Buffer. Sleep if possible. Charge everything | |

**The P1 kill list** — cut these without hesitation if behind at T+24: the M4 kiosk tier as a live second run (becomes one slide), TTS output (screen text is fine), any scheme beyond the first six, all animation.

---

## 4–5. Demo script and Q&A — MOVED

These sections described the earlier welfare-navigator concept and would contradict the
current plan. **Use `04-demo-qa-writeup.md`** — it is the only current version.

## 6. Risk register

| Risk | Trigger | Response |
|---|---|---|
| On-device path fails | Pre-event, by 28th | Ship kiosk architecture, reframe as village CSC deployment |
| Kannada ASR poor | T+4 gate | faster-whisper for ASR, Gemma for reasoning — still fully offline |
| Mic blocked on phone | Any time | mkcert local HTTPS (solved pre-event); fallback to laptop mic |
| Nothing works end-to-end | T+24 checkpoint | Cut PDF fill, demo speech → eligibility only |
| Live demo crashes on stage | Demo | Backup video recorded at T+32–34. Never demo without it |
| Projector/mirroring fails | Demo | Wired USB-C→HDMI, tested on arrival, not at the podium |
| Both exhausted | T+30+ | Sleep discipline at T+15–20 is non-negotiable |

---

**The three things that actually decide this:** the pre-event architecture gate settled before you travel, the T+28 freeze held without exception, and the deterministic-eligibility line delivered clearly to the judges.
