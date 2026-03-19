# Backend Setup

Clarion supports five TTS backends. Edge TTS works with zero configuration. The others require either a running local server or an API key.

---

## Configuring environment variables

The Clarion server reads backend configuration from environment variables. Copy `.env.example` to `.env` and fill in the values you need:

```sh
cp .env.example .env
```

How the env vars reach the server depends on how you run it:

- **Wrangler dev (`npm run dev` in `server/`):** Create `server/.dev.vars` with your key/value pairs. This file is gitignored.
- **Node server (`node server/src/node-server.js`):** Set vars in your shell or in a `.env` file loaded by your process manager.
- **Docker Compose:** Add them to the `environment` block in `docker-compose.yml`.
- **Cloudflare Worker (deployed):** Use `wrangler secret put <VAR_NAME>` for secrets, or set plain vars in the Cloudflare dashboard under Workers > Settings > Variables.

---

## Edge TTS (zero config)

Uses Microsoft's neural voices via an undocumented endpoint. No API key, no server to run. Works immediately after starting Clarion.

**No configuration needed.** The backend is always available.

Available voices: 27 neural English voices (US, UK, AU, IE, CA, ZA, NZ, IN). View the full list in the Clarion UI under Audition > Edge TTS.

**Stability note:** This backend uses a Microsoft endpoint that is not publicly documented. It has been reliable in practice, but it is not guaranteed to stay available. For long-term local use, Kokoro is a more stable choice.

### Optional: override the HMAC key

The Edge TTS backend authenticates using a publicly known key from the Microsoft Translator Android app. You should not need to change this. If for some reason you need to override it:

```
EDGE_TTS_KEY=your-override-key
```

---

## Kokoro (self-hosted, recommended)

A local ONNX model that produces natural-sounding speech. Runs on CPU -- no GPU required. Best quality of the self-hosted options.

Available voices (11 total):

| ID | Name | Accent | Gender |
|----|------|--------|--------|
| `af_heart` | Heart | American | F |
| `af_bella` | Bella | American | F |
| `af_nicole` | Nicole | American | F |
| `af_sarah` | Sarah | American | F |
| `af_sky` | Sky | American | F |
| `am_adam` | Adam | American | M |
| `am_michael` | Michael | American | M |
| `bf_emma` | Emma | British | F |
| `bf_isabella` | Isabella | British | F |
| `bm_george` | George | British | M |
| `bm_lewis` | Lewis | British | M |

### Option A: Docker Compose (easiest)

Docker Compose pulls a pre-built Kokoro image and starts both Kokoro and the Clarion server together:

```sh
docker-compose up
```

This starts:
- Kokoro at `http://localhost:8880` (image: `ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.4`)
- Clarion server at `http://localhost:8080`

The `KOKORO_SERVER` variable is wired automatically between the two containers. No further configuration needed.

CPU inference can take 10-60 seconds per paragraph on a modest machine. The first request after startup triggers model loading -- subsequent requests are faster.

### Option B: Manual install (kokoro-server.py)

Use this if you do not want Docker or want to run Kokoro outside of Compose.

**Install Python dependencies:**

```sh
pip install kokoro-onnx soundfile
pip install onnxruntime        # CPU
# or: pip install onnxruntime-gpu   # if you have CUDA
pip install phonemizer-fork==3.3.1
```

On macOS Intel (x86), `onnxruntime` is capped at version 1.19.2:

```sh
pip install onnxruntime==1.19.2 --no-deps
pip install phonemizer-fork==3.3.1 soundfile
```

**Download model files** into the project root:

```sh
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

Both files must be in the same directory you run `kokoro-server.py` from.

**Start the server:**

```sh
python3 kokoro-server.py
# Running at http://127.0.0.1:8880
```

The model loads at startup. The first request does not incur a loading delay.

**Configure Clarion to use it:**

```
KOKORO_SERVER=http://localhost:8880
```

### Kokoro env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `KOKORO_SERVER` | (none) | URL of the Kokoro server. Required to enable this backend. |
| `KOKORO_HOST` | `127.0.0.1` | Host for `kokoro-server.py` to bind to |
| `KOKORO_PORT` | `8880` | Port for `kokoro-server.py` to bind to |

`KOKORO_HOST` and `KOKORO_PORT` are read by `kokoro-server.py`, not by Clarion itself. `KOKORO_SERVER` is what Clarion reads to know where to find Kokoro.

---

## Piper (self-hosted, lightweight)

A fully offline TTS engine. Lower quality than Kokoro but fast and very low resource usage. Good for constrained environments.

Available voices (6 total):

| ID | Model file | Accent | Gender |
|----|-----------|--------|--------|
| `amy` | `en_US-amy-medium` | American | F |
| `kathleen` | `en_US-kathleen-low` | American | F |
| `lessac` | `en_US-lessac-medium` | American | M |
| `ryan` | `en_US-ryan-medium` | American | M |
| `alan` | `en_GB-alan-medium` | British | M |
| `jenny_dioco` | `en_GB-jenny_dioco-medium` | British | F |

Speed control is not supported by Piper. The `--speed` flag is ignored for this backend.

### Install the piper binary

Download the release for your platform from [github.com/rhasspy/piper/releases](https://github.com/rhasspy/piper/releases). Extract it and place the `piper` binary somewhere on your `PATH`.

```sh
# Verify it is on your PATH
piper --version
```

### Download voice models

Create a `piper-models/` directory and download the `.onnx` and `.onnx.json` files for each voice you want:

```sh
mkdir piper-models
cd piper-models

# Amy (US, F)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

# Kathleen (US, F)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kathleen/low/en_US-kathleen-low.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kathleen/low/en_US-kathleen-low.onnx.json

# Lessac (US, M)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

# Ryan (US, M)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json

# Alan (UK, M)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json

# Jenny Dioco (UK, F)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx.json
```

You only need to download the voices you plan to use. The full list of available Piper voices is at [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).

### Start the server

```sh
python3 piper-server.py
# Running at http://127.0.0.1:5000
# Models directory: /path/to/clarion/piper-models
```

**Configure Clarion to use it:**

```
PIPER_SERVER=http://localhost:5000
```

### Piper env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `PIPER_SERVER` | (none) | URL of the Piper server. Required to enable this backend. |
| `PIPER_HOST` | `127.0.0.1` | Host for `piper-server.py` to bind to |
| `PIPER_PORT` | `5000` | Port for `piper-server.py` to bind to |
| `PIPER_MODELS` | `./piper-models` | Directory where model files are stored |

`PIPER_HOST`, `PIPER_PORT`, and `PIPER_MODELS` are read by `piper-server.py`, not by Clarion itself.

---

## ElevenLabs (paid API)

High quality, cloud-hosted. Uses the `eleven_turbo_v2_5` model. Billed per character. Speed control is not supported by this backend.

### Setup

1. Create an account at [elevenlabs.io](https://elevenlabs.io)
2. Go to Profile > API Keys and generate a key
3. Set the key in your server environment:

```
ELEVENLABS_API_KEY=your-api-key
```

### Available voices

Clarion includes a curated set of pre-made ElevenLabs voices. The default (when no voice is specified) is Roger (`CwhRBWXzGAHq8TQ4Fs17`).

**Note:** Some voices (e.g., Rachel) may be paywalled on the free tier. The voices listed below are available on both free and paid plans.

| ID | Name | Accent | Gender |
|----|------|--------|--------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | American | F |
| `MF3mGyEYCl7XYWbV9V6O` | Elli | American | F |
| `XrExE9yKIg1WjnnlVkGX` | Matilda | American | F |
| `pNInz6obpgDQGcFmaJgB` | Adam | American | M |
| `TxGEqnHWrfWFTfGW9XjX` | Josh | American | M |
| `SOYHLrjzK2X1ezoPC6cr` | Harry | American | M |
| `TX3LPaxmHKxFdv7VOQHJ` | Liam | American | M |
| `onwK4e9ZLuTAKqWW03F9` | Daniel | British | M |
| `ThT5KcBeYPX3keUQqHPh` | Dorothy | British | F |
| `LcfcDJNUP1GQjkzn1xUU` | Emily | British | F |
| `IKne3meq5aSn9XLyUdCD` | Charlie | Australian | M |

You can use any voice from your ElevenLabs library -- pass its voice ID directly in the API request body or via `--voice <id>` in the CLI.

### Cost note

With paid backends configured and no rate limit set, a malfunctioning client or script could generate unexpected charges. Set `RATE_LIMIT=20` (or another appropriate value) in your server environment to cap requests per minute per IP:

```
RATE_LIMIT=20
```

---

## Google Chirp 3 HD (paid API)

Google's highest-quality neural voices. Supports speed control. Billed per character.

### Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select or create a project
3. Go to APIs & Services > Library and enable the **Cloud Text-to-Speech API**
4. Go to APIs & Services > Credentials and create an API key
5. (Recommended) Restrict the key to the Cloud Text-to-Speech API under "API restrictions"
6. Set the key in your server environment:

```
GOOGLE_TTS_API_KEY=your-api-key
```

### Available voices

The default voice (when none is specified) is `en-US-Chirp3-HD-Achernar`.

**American English:**

| ID | Name | Gender |
|----|------|--------|
| `en-US-Chirp3-HD-Achernar` | Achernar | F |
| `en-US-Chirp3-HD-Aoede` | Aoede | F |
| `en-US-Chirp3-HD-Kore` | Kore | F |
| `en-US-Chirp3-HD-Leda` | Leda | F |
| `en-US-Chirp3-HD-Vindemiatrix` | Vindemiatrix | F |
| `en-US-Chirp3-HD-Charon` | Charon | M |
| `en-US-Chirp3-HD-Fenrir` | Fenrir | M |
| `en-US-Chirp3-HD-Orus` | Orus | M |
| `en-US-Chirp3-HD-Puck` | Puck | M |
| `en-US-Chirp3-HD-Rasalgethi` | Rasalgethi | M |

**British English:**

| ID | Name | Gender |
|----|------|--------|
| `en-GB-Chirp3-HD-Achernar` | Achernar | F |
| `en-GB-Chirp3-HD-Aoede` | Aoede | F |
| `en-GB-Chirp3-HD-Leda` | Leda | F |
| `en-GB-Chirp3-HD-Charon` | Charon | M |
| `en-GB-Chirp3-HD-Fenrir` | Fenrir | M |
| `en-GB-Chirp3-HD-Puck` | Puck | M |

Full voice list: [cloud.google.com/text-to-speech/docs/chirp3-hd](https://cloud.google.com/text-to-speech/docs/chirp3-hd)

### Cost note

Same advice as ElevenLabs: set `RATE_LIMIT` in your server environment if you expose Clarion beyond localhost.

---

## Server environment variable reference

These are set on the Clarion server, not in the CLI.

| Variable | Description |
|----------|-------------|
| `KOKORO_SERVER` | URL of a running Kokoro server, e.g. `http://localhost:8880` |
| `PIPER_SERVER` | URL of a running Piper server, e.g. `http://localhost:5000` |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `GOOGLE_TTS_API_KEY` | Google Cloud TTS API key |
| `API_KEY` | Optional. If set, all requests must include `Authorization: Bearer <key>`. The browser UI uses HMAC-SHA256 signing. The CLI uses the `Bearer` token directly. |
| `ALLOWED_ORIGIN` | Optional. Restricts CORS to a specific origin. Default: `*` (open). |
| `RATE_LIMIT` | Optional. Max `/speak` requests per minute per IP. Default: `0` (no limit). Recommended when using paid backends. |
| `EDGE_TTS_KEY` | Optional. Overrides the default Edge TTS HMAC key. Leave unset unless you have a specific reason to change it. |
| `PORT` | Port for the Node server (`node-server.js`). Default: `8080`. Not used by wrangler dev. |

### For wrangler dev

Create `server/.dev.vars` (this file is gitignored):

```
KOKORO_SERVER=http://localhost:8880
PIPER_SERVER=http://localhost:5000
ELEVENLABS_API_KEY=your-key
GOOGLE_TTS_API_KEY=your-key
```

### For the Node server

Set variables in your shell before starting, or export them from a `.env` file:

```sh
KOKORO_SERVER=http://localhost:8880 node server/src/node-server.js
```

### For Cloudflare Workers (deployed)

Use `wrangler secret put` for sensitive values:

```sh
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put GOOGLE_TTS_API_KEY
wrangler secret put API_KEY
```

Non-secret values (like `KOKORO_SERVER`) can be set in `wrangler.toml` under `[vars]` or in the Cloudflare dashboard.

---

## Checking backend status

The `/health` endpoint returns the status of all backends:

```sh
curl http://localhost:8080/health
```

```json
{
  "edge": "up",
  "kokoro": "up",
  "piper": "unconfigured",
  "elevenlabs": "unconfigured",
  "google": "down",
  "timestamp": "2026-03-07T00:00:00.000Z"
}
```

Status values:
- `up` -- reachable and responding
- `down` -- configured but not responding (server is down or key is invalid)
- `unconfigured` -- no env var set for this backend
