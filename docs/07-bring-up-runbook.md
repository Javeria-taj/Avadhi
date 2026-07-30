# 07 — Bring-up runbook

Run these in order. Stop at the first failure; each step depends on the one before.

---

## Step 0 — Confirm the tree survived the file move

Antigravity reported **62 tests**. The shipped tree has **67**. Five tests are missing:
the bank-vertical tests appended to the end of `tests/test_engine.py`.

```bash
pytest -q                                       # expect 67
grep -c "^def test" tests/test_engine.py        # expect 22
grep -c "^def test" tests/test_workdays.py      # expect 23
grep -c "^def test" tests/test_cases.py         # expect 22
```

If `test_engine.py` shows 17, it is the pre-append version and **the RBI rule is
completely untested**. Re-copy that file.

Then verify the contract survived — Antigravity said it *created* `schemas.py`, which
may have regenerated it without the bank-fraud fields:

```bash
python scripts/preflight.py
```

This checks contract integrity, all four rules, the working-day arithmetic, both
verticals through the engine, and the full request path. It exits non-zero on failure.

---

## Step 1 — Prove it works with no model

```bash
MOCK_MODE=true uvicorn api.main:app --host 0.0.0.0 --port 8000
curl localhost:8000/health
```

Windows PowerShell:
```powershell
$env:MOCK_MODE="true"; uvicorn api.main:app --host 0.0.0.0 --port 8000
```

You now have a working end-to-end product with zero inference. Everything after this
is upgrading a system that already runs.

---

## Step 2 — Connect Gemma

`BACKEND=server` talks to a local OpenAI-compatible HTTP server. This is still fully
offline — nothing leaves the machine, and you can prove it by pulling the network.
It also means Windows development and the Mac demo run the **same code path**.

### Ollama (simplest)

```bash
ollama serve                 # listens on 127.0.0.1:11434
ollama pull gemma3:4b        # substitute the exact Gemma the track requires
ollama list                  # confirm the tag
```

Set in `.env`:
```
BACKEND=server
LLM_BASE_URL=http://127.0.0.1:11434
MODEL_NAME=gemma3:4b
MOCK_MODE=false
```

### llama.cpp server (more control over quantisation)

```bash
llama-server -m ./models/gemma-4b-Q4_K_M.gguf --port 8080 -c 4096
```
```
LLM_BASE_URL=http://127.0.0.1:8080
```

### Verify

```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000
curl localhost:8000/health
```

Expect `"model_loaded": true` and the backend name. Startup runs a warmup completion,
so a 10–30s cold load is paid at boot rather than on stage. If warmup fails you will
see `Model warmup FAILED` in the log — the server is not running or the model name is
wrong.

### Then test extraction with real text

```bash
python - <<'PY'
import os; os.environ["MOCK_MODE"]="false"
from api.services.extract import extract
r = extract("ನಿನ್ನೆ ರಾತ್ರಿ ಆಲಿಕಲ್ಲು ಮಳೆಯಿಂದ ನನ್ನ ಹತ್ತಿ ಬೆಳೆ ಹಾಳಾಗಿದೆ. "
            "ಸುಮಾರು ಒಂದೂವರೆ ಎಕರೆ. ಬ್ಯಾಂಕಿನಲ್ಲಿ ಫಸಲ್ ಬಿಮಾ ಪಾಲಿಸಿ ಇದೆ.")
print(r.model_dump_json(indent=2))
PY
```

**What good looks like:** `event_type: "hailstorm"`, `crop: "cotton"`,
`area_acres: 1.5`, `has_pmfby_policy: true`, `event_datetime_raw: "last night"` or the
Kannada equivalent.

**If extraction is poor**, tune `SYSTEM_PROMPT` in `api/services/extract.py` — not the
engine. Add two or three worked examples of transcript → JSON directly in the prompt.
That single change usually fixes more than any parameter tweak.

---

## Step 3 — The ASR gate

Do the Audio Scribe test in Google AI Edge Gallery on the S24 first: speak the Kannada
intake line and read the transcription.

- **Clean** → Gemma-native audio is viable
- **Mushy** → `ASR_BACKEND=whisper`, still fully offline

Then test the real path:

```bash
python - <<'PY'
import os; os.environ["MOCK_MODE"]="false"
from api.services.asr import transcribe
print(transcribe("test_kannada.wav"))
PY
```

Record `test_kannada.wav` yourself saying the demo line. **Decide this before T+4** and
do not revisit it.

---

## Step 4 — The phone

```bash
cd ui
# see certs/README.md — generate certs for your LAN IP first
npm run dev:https
```

On the S24, over **the phone's own hotspot** (not venue Wi-Fi):

- [ ] Page loads over HTTPS
- [ ] Microphone permission prompt appears
- [ ] Camera permission prompt appears
- [ ] Location permission prompt appears at capture time
- [ ] A full voice → countdown → checklist → photo → PDF run completes

---

## Step 5 — Airplane mode

The actual demo condition. With Ollama or llama-server running locally, turn on
airplane mode on the Mac and run the full flow. **Everything must still work.** If it
doesn't, something is reaching the network and you need to find it before a judge does.

---

## Pre-demo checklist

```bash
pytest                        # 67 green
python scripts/preflight.py   # all checks pass
curl localhost:8000/health    # model_loaded true, 4 rules
```

- [ ] Airplane-mode run completed
- [ ] Backup video recorded and playable offline
- [ ] HDMI adapter tested on the real projector
- [ ] `data/holidays.json` replaced with the real RBI list, or the limitation stated on the slide
- [ ] PMFBY helpline (14447) confirmed on pmfby.gov.in
- [ ] M4 Air: no sustained inference in the 20 minutes before you go on
