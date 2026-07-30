# 08 — Deployment: two paths

Both are fully offline. Both are honest. They differ in effort and in what you can claim.

| | Path A — Mac kiosk | Path B — true on-device |
|---|---|---|
| Where Gemma runs | Mac Air, Ollama | S24, llama-server in Termux |
| Where the backend runs | Mac | S24 |
| Phone's role | Browser client | Runs everything |
| Setup time | ~30 min | 3–5 hours, and may fail |
| TLS / mkcert needed | **Yes** | **No** — see below |
| Claim on stage | "Runs offline at a village kiosk" | "Runs entirely on a ₹70k phone" |

**Do Path A first.** Get a demo that works, then attempt Path B only with hours to spare and Path A intact as the fallback. A working kiosk demo beats a half-built on-device one, and Path A is the more realistic deployment anyway — the target farmer often shares a device.

---

## The one genuine advantage of Path B

Browsers treat `localhost` and `127.0.0.1` as **secure contexts**. So when the browser on the phone loads `http://127.0.0.1:8000`, `getUserMedia`, the camera, and geolocation all work over plain HTTP — **the entire mkcert/TLS problem disappears.**

That is worth knowing, but it is not worth 5 hours on its own. `ui/certs/` already solves it for Path A.

---

# Path A — Mac kiosk (do this first)

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
BACKEND=server
LLM_BASE_URL=http://127.0.0.1:11434
MODEL_NAME=gemma3:4b
ASR_BACKEND=whisper
ASR_MODEL=small
LANGUAGE=kn
MOCK_MODE=false
```
```bash
pytest                            # expect 76
python scripts/preflight.py       # expect ALL CHECKS PASSED
uvicorn api.main:app --host 0.0.0.0 --port 8000
curl localhost:8000/health        # model_loaded true, backend "server", 4 rules
```
Startup runs a warmup completion, so the cold load is paid at boot rather than on stage.

## A3. Frontend + TLS
```bash
ipconfig getifaddr en0            # your Mac's IP on the phone hotspot
cd ui
mkcert <that-ip> localhost 127.0.0.1
mv <that-ip>+2-key.pem certs/key.pem
mv <that-ip>+2.pem     certs/cert.pem
npm install
npm run dev:https
```

## A4. Network
**Connect the Mac to the S24's hotspot.** Not venue Wi-Fi — it will be saturated and may block device-to-device traffic. Then on the phone browse to `https://<mac-ip>:3000` and accept the certificate once.

## A5. Verify
- [ ] Page loads over HTTPS
- [ ] Mic prompt appears, recording works
- [ ] Camera prompt appears at capture
- [ ] Location prompt appears at capture, not on load
- [ ] Full run: voice → countdown → checklist → photo → PDF
- [ ] **Airplane mode on the Mac, repeat the full run.** Everything must still work.

---

# Path B — true on-device on the S24

Attempt only after Path A works. Time-box it hard.

## B1. Termux
Install Termux from **F-Droid or GitHub releases**, not the Play Store — the Play Store build is abandoned and its packages are years stale.

```bash
pkg update && pkg upgrade
pkg install git cmake clang make python rust binutils ffmpeg wget
termux-setup-storage
```

## B2. llama.cpp server
```bash
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build -DGGML_NATIVE=OFF && cmake --build build --config Release -j4
```
Get a quantised Gemma GGUF onto the device (`~/storage/downloads`), then:
```bash
./build/bin/llama-server -m ~/gemma-e2b-Q4_K_M.gguf --host 127.0.0.1 --port 8080 -c 4096
```
Verify: `curl 127.0.0.1:8080/v1/models`

**This is why `BACKEND=server` was the right abstraction** — llama-server speaks the same OpenAI-compatible API as Ollama, so no application code changes.

## B3. whisper.cpp for ASR

`faster-whisper` will not install: it needs `ctranslate2`, which has no aarch64-Android wheel. whisper.cpp compiles fine.

```bash
cd ~ && git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build && cmake --build build --config Release -j4
bash ./models/download-ggml-model.sh small
```
Then set `ASR_BACKEND=whispercpp` — the subprocess backend is already implemented in `api/services/asr.py`.

## B4. Python backend in Termux
```bash
cd ~/Avadhi
pip install fastapi "uvicorn[standard]" pydantic python-multipart reportlab pypdf
```
> `pydantic` builds its Rust core from source here. Expect 10–30 minutes. Do not
> interrupt it. **Skip `faster-whisper` and `mlx` entirely** — neither will build.

`.env` on the phone:
```
BACKEND=server
LLM_BASE_URL=http://127.0.0.1:8080
MODEL_NAME=gemma-e2b
ASR_BACKEND=whispercpp
WHISPERCPP_BIN=/data/data/com.termux/files/home/whisper.cpp/build/bin/whisper-cli
WHISPERCPP_MODEL=/data/data/com.termux/files/home/whisper.cpp/models/ggml-small.bin
LANGUAGE=kn
MOCK_MODE=false
```

## B5. Serve the UI as static files

Do not run the Next.js dev server on the phone. Build a static export **on the Mac**, copy it over, and let FastAPI serve it.

On the Mac, add to `ui/next.config.mjs`:
```js
output: 'export'
```
Then:
```bash
cd ui && npm run build          # produces ui/out/
```
Copy `ui/out/` to the phone, and mount it in `api/main.py`:
```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="ui/out", html=True), name="ui")
```
> Mount this **after** the API routers, or it will swallow `/api/*`.

Note: with `output: 'export'` the rewrite proxy in `next.config.mjs` no longer applies, so the UI and API must be same-origin — which they are, both on `127.0.0.1:8000`.

## B6. Run and verify
```bash
uvicorn api.main:app --host 127.0.0.1 --port 8000
```
Open Chrome on the phone at `http://127.0.0.1:8000`.

- [ ] `/health` shows backend "server", 4 rules
- [ ] Mic works **without any TLS setup** (localhost is a secure context)
- [ ] Camera and location work
- [ ] Full run completes
- [ ] **Airplane mode, repeat.** Nothing should change.
- [ ] Watch for thermal throttling on a 3-minute continuous run

## Memory budget on 8 GB

llama-server with E2B Q4 (~2 GB) + whisper.cpp small (~0.5 GB) + Python (~0.3 GB) is roughly 3 GB — feasible, but close enough that you should close every other app. **Use E2B, not E4B**, on the phone.

---

## What to say on stage

**Path A:** "Gemma runs locally on this machine, framed as a shared kiosk at a panchayat office or Common Service Centre — which matches how the target user actually accesses services. Fully offline; we'll prove it in airplane mode."

**Path B:** "Everything you're seeing — speech recognition, Gemma, the rules engine, the document — runs on this phone. No server, no network."

**Either way**, show the AI Edge Gallery benchmark screenshot as third-party evidence the model runs on phone-class hardware, and label it accurately as a benchmark rather than as your app.

## Honest caveat about ASR

Audio Scribe proved Gemma transcribes your Kannada demo line cleanly on-device. But feeding audio into Gemma from Python needs a runtime with the audio encoder wired up, and neither Ollama's `gemma3` nor stock llama.cpp provides that today. So the app uses whisper for ASR and Gemma for reasoning — both offline.

If a judge asks whether you used Gemma for speech: say no, whisper handles ASR, Gemma handles extraction and explanation, and you verified Gemma's native audio capability separately in AI Edge Gallery. That is a better answer than a vague yes.
