# 01 — Setup Runbook

Target: **environment fully ready in ≤60 minutes** on arrival. Nothing here is product code, so all of it is safe to do before the clock starts.

Work top to bottom. Do not skip the verification step at the end of each block.

---

## Block A — MacBook M4 (25 min)

### A1. Toolchain
```bash
# Verify what you already have
python3 --version        # need 3.11+
node --version           # need 20+
brew --version

# If missing
brew install python@3.12 node git cmake
```

### A2. Python environment
```bash
mkdir -p ~/neonexus && cd ~/neonexus
python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install fastapi uvicorn[standard] pydantic pypdf python-multipart
pip install mlx mlx-lm                # Apple Silicon inference
pip install faster-whisper            # ASR fallback — install NOW, not at hour 4
```

**Verify:** `python -c "import mlx.core; print(mlx.core.default_device())"` → should print a GPU device.

### A3. Model weights — download tonight, never at the venue
```bash
pip install huggingface_hub
huggingface-cli download google/gemma-3-4b-it --local-dir ~/neonexus/models/gemma-4b
```
> Substitute the exact Gemma 4 repo ID the hackathon's Gemma track specifies. Check the track page before downloading — if the required model differs, download that one instead. Pull an E2B/E4B edge variant too if listed.

Also pre-pull the ASR model so it's cached:
```bash
python -c "from faster_whisper import WhisperModel; WhisperModel('small')"
```

**Verify:** run a single throwaway prompt through `mlx_lm.generate` and confirm you get tokens back. Record tokens/sec — you need this number for the slide.

### A4. Node dependencies

> **Do NOT run `create-next-app`.** The `ui/` directory already contains the built
> interface. Scaffolding over it destroys your work.

```bash
cd ~/neonexus/ui
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_USE_MOCKS=true for now
```

**Verify:** `npm run dev` serves the app, and with mocks on you should see a live
countdown and a claim card without the backend running at all.

---

## Block B — The HTTPS/microphone problem (10 min)

This silently kills demos. `getUserMedia` is blocked on non-secure origins, so the S24 opening `http://192.168.x.x:5173` will have **no microphone** and no obvious error.

```bash
brew install mkcert nss
mkcert -install
cd ~/neonexus
# Replace with your actual LAN IP — find it with: ipconfig getifaddr en0
mkcert 192.168.1.50 localhost 127.0.0.1
```

Rename the generated files into `ui/certs/` as `key.pem` and `cert.pem`, then start with
`npm run dev:https`. Full instructions are in `ui/certs/README.md`.

**Verify — do this tonight, not tomorrow:** open the HTTPS URL on the S24, load any page that calls `navigator.mediaDevices.getUserMedia({audio:true})`, and confirm the mic permission prompt appears. If it doesn't, you have a demo with no voice input.

> Use **the phone's own hotspot**, not venue Wi-Fi. Connect the MacBook to the S24 hotspot. Venue Wi-Fi will be unusable and may block device-to-device traffic entirely.

---

## Block C — S24 measurement, via Google AI Edge Gallery (20 min)

**Do this instead of compiling llama.cpp in Termux.** AI Edge Gallery is Google's open-source (Apache 2.0) on-device showcase app, it officially supports the Gemma 4 family, and it ships a built-in benchmark. You get the numbers in ten minutes rather than an hour.

1. Sideload the APK from the `google-ai-edge/gallery` GitHub releases.
2. Download a Gemma 4 E4B (or E2B) model inside the app.
3. Run **Model Management & Benchmark**. Screenshot the result.
4. Open **Audio Scribe** and speak your Kannada demo line into it.

**Record:** tok/s, peak memory, cold load time. The screenshot goes straight onto the measurements slide — third-party-verifiable evidence that the model runs on phone-class hardware.

### C2. The Kannada ASR gate — answered here, tonight

Audio Scribe does on-device transcription. Speak the intake line:

> "Last night's hail destroyed my cotton, about one and a half acres, I have a Fasal Bima policy through the bank." *(in Kannada)*

- **Clean transcription** → Gemma-native audio is viable. Set `ASR_BACKEND=gemma`.
- **Mushy** → set `ASR_BACKEND=whisper`. Still fully offline. Decision made before the clock starts instead of at hour 4.

### C3. What Edge Gallery cannot do

It is a sandbox with **no local API server**. Your FastAPI app cannot call into it. It is a measurement instrument, not your backend.

The real in-app integration path is **LiteRT-LM** — and note that MediaPipe's LLM Inference Android/iOS implementations are now marked deprecated, so don't go that way. But LiteRT-LM means a native Kotlin app, and neither of you is a mobile dev with 36 hours on the clock. **Don't take that trade.**

### C4. So where does the model actually run?

**Path B (kiosk) is the plan.** Gemma runs on the M4 under MLX; the S24 is a browser client over the phone's own hotspot. Fully offline, zero cloud. Pitch it as the panchayat/CSC deployment — arguably more realistic anyway, since the target farmer often shares a device.

The Edge Gallery benchmark is what substantiates the on-device claim. Label it honestly on the slide as a benchmark, not as your app, and it strengthens your position rather than exposing it.

---

## Block D — Repo skeleton (5 min)

Directories only. No product code.

```bash
cd ~/neonexus
git init
mkdir -p api/{routes,services,rules,models} data/{schemes,forms} ui docs
touch .env.example README.md
printf ".venv/\nnode_modules/\nmodels/\n*.pem\n.env\n" > .gitignore
git add -A && git commit -m "chore: project scaffold"
```

**Keep every commit inside the event window.** If you commit tonight, commit only scaffolding and config — and be ready to show the log.

---

## Block E — Physical kit

- [ ] USB-C → HDMI adapter **tested against a real projector or TV before you need it**
- [ ] Both devices charged + power bank + spare cables
- [ ] Phone stand or tripod for the demo
- [ ] OS updates done and auto-update disabled on both devices
- [ ] Model weights present on both devices, verified by running inference once
- [ ] All PDFs from `02-claim-rules-knowledge-base.md` downloaded locally
- [ ] Airplane-mode toggle practised — you'll do it on stage

---

## The one thing to confirm with organizers

Message Dr Abdul Lateef Haroon (+91 9738973034) or A Ananda (+91 8904282081) and ask plainly: *is environment setup, model download, and research data collection permitted before the event start?*

Get it in writing. Standard practice says yes, but you don't want to discover otherwise at judging.
