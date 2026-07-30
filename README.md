# Claim Window Navigator

Voice-first, offline claim-deadline navigator for Indian insurance and welfare schemes.

Someone speaks, in Kannada, about a loss that just happened. The system works out which
claim clocks are now running, how long is left on each, what evidence to capture right now,
and generates the document they carry to the bank. It runs with the network off.

**Start here → [`docs/ASSEMBLY-GUIDE.html`](docs/ASSEMBLY-GUIDE.html)**

## The core design decision

The language model extracts facts and explains results. A **deterministic rules engine**
decides which schemes apply and computes every deadline. No claim window is ever produced
by a model, and every rule carries a source citation.

## Quick start — works with no model at all

```bash
make install
make test      # 76 tests: engine, working-day arithmetic, persistence, i18n
make mock      # API with MOCK_MODE=true — full pipeline, zero inference

# separate terminal
cp ui/.env.example ui/.env.local   # set NEXT_PUBLIC_USE_MOCKS=true
make ui
```

> Read `ui/certs/README.md` **before** opening the UI on a phone, and start with
> `npm run dev:https`. `getUserMedia` is blocked on non-secure origins, so a plain-HTTP LAN
> address gives you no microphone and no error message.

Then `make check` before you demo.

## Layout

```
api/rules/engine.py       ★ deterministic. no model, no network.
api/rules/workdays.py     ★ RBI working-day arithmetic. 23 tests.
api/services/cases.py     ★ persistence + state machine — why this isn't a chatbot
api/models/schemas.py     ★ the interface contract. freeze at T+4.
data/schemes/*.json       ★ the domain content. adding a scheme is a data change.
ui/certs/README.md        ★ the HTTPS/microphone setup. read it first.
ui/next.config.mjs        proxies /api/* to FastAPI — same origin, no CORS
api/services/             asr · extract · explain · document
ui/app/                   layout · page · globals.css
ui/components/            Countdown · Recorder · ClaimCard
ui/lib/                   api.js · mocks.js
docs/                     assembly guide + 5 planning documents
```

## Rules

PMFBY (72h localised calamity), RBI unauthorised transaction (3 working days), PMSBY
(30d accident), PMJJBY (30d death). The loader
refuses to start if any rule lacks `source_url` and `verified_on`.

Two conflicts between official sources are documented in the rule files rather than papered
over — see `verification_note` in each. **The PMFBY helpline number is unresolved across
three sources; verify on pmfby.gov.in before the demo.**

## Docs

| File | What it's for |
|---|---|
| `docs/ASSEMBLY-GUIDE.html` | Every file explained, build order, troubleshooting |
| `docs/00-execution-plan.md` | 36-hour timeline (partially superseded — see its banner) |
| `docs/01-setup-runbook.md` | Environment prep, Edge Gallery benchmark, HTTPS |
| `docs/02-claim-rules-knowledge-base.md` | Domain research, source conflicts |
| `docs/03-architecture-and-contract.md` | The frozen interface |
| `docs/04-demo-qa-writeup.md` | Demo script, judge Q&A, Kaggle skeleton |
| `docs/05-LOCKED-SPEC.md` | Frozen feature set, screens, work split |
| `docs/07-bring-up-runbook.md` | Step-by-step bring-up and verification |
| `docs/08-deployment-two-paths.md` | Mac kiosk vs true on-device on the S24 |
