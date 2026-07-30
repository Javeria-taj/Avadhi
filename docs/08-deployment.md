# 08 — Deployment (revised)

Supersedes `08-deployment-two-paths.md`. The Termux path is now an appendix and is **not recommended**.

---

## The decision

**Two build targets, one commit.**

| | **Demo build** | **Hosted build** |
|---|---|---|
| Where | MacBook Air, on stage | Render |
| Model | Ollama, `127.0.0.1` | Hosted Gemma endpoint |
| Network | **Airplane mode** | Online |
| ASR | `small` | `base` (memory limit) |
| Storage | Local JSON, persists | **Ephemeral — wipes on restart** |
| Purpose | The pitch | The submission link |
| Env | `DEPLOYMENT=local` | `DEPLOYMENT=hosted` |

The only difference is `LLM_BASE_URL` and `LLM_API_KEY`. Same code, same commit.

## Why you must demo the local one

Your answer to *"why not just use a cloud model?"* has been: a farmer standing in a flooded
field has no signal precisely when the 72-hour clock starts. Demo a hosted backend and that
argument dies, and the airplane-mode moment — the strongest thirty seconds in your pitch —
dies with it.

**Say this, in these words:**

> The hosted link is there so you can try it from your laptop. The product is designed to run
> on-device. This is the same commit, running here, with the network off.

Then turn on airplane mode and run it. That switching between them is one environment
variable is itself an engineering point — make it.

**Do not** let the hosted URL become the demo because it is easier to set up. Deploy it,
verify it, close the tab.

---

# Path A — Demo build (Mac). Do this first.

## A1. Ollama
```bash
brew install ollama
ollama serve                      # 127.0.0.1:11434
ollama pull gemma3:4b             # substitute the exact model the track requires
ollama list
```

## A2. Backend
```bash
cd ~/Avadhi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
`.env`:
```
DEPLOYMENT=local
BACKEND=server
LLM_BASE_URL=http://127.0.0.1:11434
MODEL_NAME=gemma3:4b
LLM_API_KEY=
ASR_BACKEND=whisper
ASR_MODEL=small
LANGUAGE=kn
MOCK_MODE=false
```
```bash
pytest                            # 110 passed
python scripts/preflight.py       # ALL CHECKS PASSED
uvicorn api.main:app --host 0.0.0.0 --port 8000
curl localhost:8000/health        # deployment "local", backend "server", 4 rules
```
Startup fires a warmup completion, so the 10–30s cold load is paid at boot, not on stage.

## A3. Frontend + TLS
```bash
ipconfig getifaddr en0            # the Mac's IP on the phone hotspot
cd ui
mkcert <that-ip> localhost 127.0.0.1
mv <that-ip>+2-key.pem certs/key.pem
mv <that-ip>+2.pem     certs/cert.pem
npm install
npm run dev:https
```

> `next dev --experimental-https` may auto-generate its own certs into `ui/certificates/`.
> Those work for `localhost` but **not for a LAN IP** — the phone needs the mkcert pair.
> `ui/certificates/` holds a private key; it is gitignored, but never commit it.

## A4. Network
Connect the **Mac to the S24's hotspot**. Not venue Wi-Fi — it will be saturated and may
block device-to-device traffic. Browse to `https://<mac-ip>:3000` on the phone and accept the
certificate once.

## A5. Verify
- [ ] `/health` shows `deployment: local`
- [ ] Mic prompt appears; recording works
- [ ] Camera and location prompts appear **at capture**, not on load
- [ ] Full run: voice → countdown → checklist → photo → PDF
- [ ] Language toggle: switch to English, confirm the checklist comes back English
- [ ] **Airplane mode on the Mac. Repeat the full run.** Everything must still work.

If anything breaks in airplane mode, something is reaching the network. Find it before a
judge does.

---

# Path C — Hosted build (Render). For the submission link.

Do this **after** Path A works. It is not on the critical path for the demo.

## C1. Backend on Render

`render.yaml` and `requirements-hosted.txt` are in the repo. Connect the GitHub repo as a
Blueprint, then set these three in the dashboard (**never in the file**):

```
LLM_BASE_URL     the provider's OpenAI-compatible base URL
MODEL_NAME       the provider's Gemma model id
LLM_API_KEY      the key
```

Any provider exposing `/v1/chat/completions` works — `llm.py` sends `Authorization: Bearer`
when `LLM_API_KEY` is set and omits it when empty.

Verify: `curl https://<your-app>.onrender.com/health` → `deployment: "hosted"`.

## C2. Frontend

Deploy `ui/` to Vercel or Netlify. Set `NEXT_PUBLIC_USE_MOCKS=false`, and point the rewrite in
`next.config.mjs` at the Render URL through an env var rather than hardcoding
`localhost:8000`.

## C3. Four hosted-only constraints — know these before a judge clicks

**Cold start.** Render's free tier spins down after inactivity and takes ~50s to wake. A judge
clicking a cold link sees a hang. Use a paid instance, or hit the URL yourself right before
presenting, or put "first load may take a minute" on the slide.

**Memory.** Free/starter is 512 MB. `faster-whisper` `small` is roughly that on its own —
hence `ASR_MODEL=base` in `render.yaml`. Kannada accuracy is **lower** there than in the demo
build. If asked, say so plainly.

**Ephemeral disk.** `data/cases.json`, `data/profile.json` and photos live on the container
filesystem and vanish on every restart. Fine for a try-it link. Do not claim persistence.

**Never commit the key.** `LLM_API_KEY` goes in the dashboard only. If it lands in a commit,
rotate it — the repo must be public for the Kaggle embed.

---

## Judge Q&A — the questions this setup invites

**"Is it actually offline, or did you just point it at a local server?"**
Both are true and neither is a dodge. Gemma runs on this machine via Ollama on 127.0.0.1;
nothing leaves it. Here — airplane mode, same run.

**"Then why is there a hosted version?"**
So you can try it without our laptop. Same commit; the only difference is one environment
variable. The product is designed for on-device, which is why the deployment target is config
rather than a rewrite.

**"Why not run it on the phone?"**
We measured Gemma on the S24 in Google's AI Edge Gallery — numbers are on the slide. We chose
the shared-kiosk deployment because our user often doesn't own a smartphone, so a panchayat
office or Common Service Centre is the realistic access point. The architecture supports
either.

**"Is Kannada speech recognition as good on the hosted version?"**
No. It runs a smaller model to fit the memory limit. The demo build uses the larger one.

---

## Appendix — Path B, true on-device via Termux. Not recommended.

Kept for completeness. Costs 3–5 hours with a real chance of failure, and buys one claim you
can already substantiate with the Edge Gallery benchmark.

The shape, if you ever want it: Termux from **F-Droid** (not the Play Store); build
`llama.cpp` and run `llama-server` on `127.0.0.1:8080`; build `whisper.cpp` and set
`ASR_BACKEND=whispercpp` (the subprocess backend is already implemented — `faster-whisper`
will not install, as `ctranslate2` has no aarch64-Android wheel); `pip install` the backend,
allowing 10–30 minutes for pydantic's Rust core to compile; build the UI as a static export on
the Mac and serve it from FastAPI.

One genuine perk: browsers treat `127.0.0.1` as a **secure context**, so mic, camera and
geolocation work over plain HTTP and the entire TLS problem disappears.

Not worth five hours. Spend them on rehearsal and the write-up.
