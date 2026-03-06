# Backend Setup

Clarion supports five TTS backends. Edge TTS works with zero configuration. The others require either a running local server or an API key.

## Edge TTS (zero config)

Uses Microsoft's neural voices. No API key, no server — works immediately after `npm run dev`. Good quality, slight Microsoft TTS character.

> Note: This uses an undocumented Microsoft endpoint. For long-term stability in production, run Kokoro instead.

## Kokoro (self-hosted, recommended)

A local ONNX model that produces genuinely natural speech — less "AI voice", more character. Runs on CPU, no GPU required.

### Docker (easiest)

```sh
docker-compose up
# Kokoro at :8880, Clarion server at :8080
```

### Manual install

**Install dependencies:**
```sh
pip install kokoro-onnx soundfile
pip install onnxruntime        # or onnxruntime-gpu if you have CUDA
pip install phonemizer-fork==3.3.1
```

> **macOS Intel:** `onnxruntime` is capped at 1.19.2 on x86. Use `pip install onnxruntime==1.19.2 --no-deps` then install `phonemizer-fork` and `soundfile` separately.

**Download model files** (into the project root):
```sh
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

**Start the server:**
```sh
python3 kokoro-server.py
# → http://127.0.0.1:8880
```

Set `KOKORO_SERVER=http://localhost:8880` in your `.env`. The model loads at startup — first request is immediate.

## Piper (self-hosted, lightweight)

A fully offline ONNX TTS engine. Lower quality than Kokoro but very fast and minimal resource usage.

```sh
# 1. Install the piper binary
#    → https://github.com/rhasspy/piper/releases
#    Extract and put `piper` on your PATH

# 2. Download voice models (into ./piper-models/)
mkdir piper-models
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
# Repeat for: kathleen, lessac, ryan (US) and alan, jenny_dioco (GB)

# 3. Start the server
python3 piper-server.py
# → http://127.0.0.1:5000
```

Set `PIPER_SERVER=http://localhost:5000` in your `.env`.

Available voices: `amy`, `kathleen`, `lessac`, `ryan` (US English), `alan`, `jenny_dioco` (British English). Full model list at [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).

## ElevenLabs (paid API)

High quality, fast. Uses the `eleven_turbo_v2_5` model. Billed per character.

1. Get an API key at [elevenlabs.io](https://elevenlabs.io) → Profile → API Keys
2. Set `ELEVENLABS_API_KEY=your-key` in your `.env`

Speed control is not supported (model limitation). Any voice from your ElevenLabs library works — pass its ID with `--voice <id>` in the CLI or directly in the API.

## Google Chirp 3 HD (paid API)

Google's highest-quality neural voices. Supports speed control.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Enable the **Cloud Text-to-Speech API**
3. Create an API key and set `GOOGLE_TTS_API_KEY=your-key` in your `.env`

Full voice list: [cloud.google.com/text-to-speech/docs/chirp3-hd](https://cloud.google.com/text-to-speech/docs/chirp3-hd)
