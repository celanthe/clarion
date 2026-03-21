# Chatterbox Backend

Chatterbox is an open-source TTS model by Resemble AI (MIT license) that produces ElevenLabs-quality voice synthesis with zero-shot voice cloning. Unlike Kokoro, it requires a GPU to run at usable speeds.

## What you get

- ElevenLabs-quality voices, fully self-hosted
- Zero-shot voice cloning from 5-10 seconds of reference audio
- Emotion control (exaggeration, pacing, temperature)
- No per-character costs, no API quotas
- Your text never leaves your infrastructure

## Requirements

- **GPU**: NVIDIA with 8+ GB VRAM (Turbo model uses ~4.5 GB)
- **Docker**: For containerized deployment
- **Network**: Clarion server must be able to reach the Chatterbox server

Chatterbox does **not** run well on CPU. If you don't have GPU access, use Kokoro (runs on CPU) or Edge TTS (cloud, no setup).

---

## Option A: RunPod (cloud GPU)

Best if you don't have a local NVIDIA GPU.

### 1. Create a pod

1. Go to [runpod.io](https://runpod.io) > Pods > Create Pod
2. Select a GPU with 8+ GB VRAM (RTX 3060, RTX A4000, or similar)
3. Set Docker image: `travisvn/chatterbox-tts-api:latest`
4. Expose HTTP port: `4123`
5. Set environment variables:
   - `TTS_MODEL_TYPE=turbo`
   - `DEVICE=cuda`
6. Optionally attach a network volume at `/cache` (persistent model weights) and `/voices` (voice library)
7. Deploy

First startup downloads model weights (~2 GB). Subsequent starts are faster if you attached a volume.

### 2. Verify it's running

```sh
curl https://<pod-id>-4123.proxy.runpod.net/health
```

### 3. Tell Clarion about it

Add to your server's `.dev.vars` (local) or Cloudflare secrets (deployed):

```
CHATTERBOX_SERVER=https://<pod-id>-4123.proxy.runpod.net
```

Restart the Clarion server. Verify with:

```sh
curl http://localhost:8080/health
# chatterbox should show "up"
```

---

## Option B: Local Docker (NVIDIA GPU)

Best if you have a machine with an NVIDIA GPU and Docker with CUDA support.

### 1. Run the container

```sh
docker run -d \
  --gpus all \
  -p 4123:4123 \
  -e TTS_MODEL_TYPE=turbo \
  -e DEVICE=cuda \
  -v chatterbox-cache:/cache \
  -v chatterbox-voices:/voices \
  travisvn/chatterbox-tts-api:latest
```

### 2. Tell Clarion about it

Add to `.dev.vars`:

```
CHATTERBOX_SERVER=http://localhost:4123
```

Or add to `docker-compose.yml` alongside Kokoro:

```yaml
services:
  chatterbox:
    image: travisvn/chatterbox-tts-api:latest
    ports:
      - "4123:4123"
    environment:
      TTS_MODEL_TYPE: turbo
      DEVICE: cuda
    volumes:
      - chatterbox-cache:/cache
      - chatterbox-voices:/voices
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    restart: unless-stopped

  clarion:
    # ... existing config ...
    environment:
      KOKORO_SERVER: http://kokoro:8880
      CHATTERBOX_SERVER: http://chatterbox:4123
```

---

## Uploading voices

Chatterbox has no pre-built voices. Every voice is cloned from a reference audio sample.

### Register a voice

```sh
curl -X POST https://<chatterbox-server>/voices \
  -F "name=my-voice" \
  -F "file=@reference-audio.wav"
```

Use a clean 5-10 second clip of the target voice. WAV or MP3. No background noise.

### List registered voices

```sh
curl https://<chatterbox-server>/voices
```

### Use in an agent profile

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "backend": "chatterbox",
  "voice": "my-voice",
  "speed": 1.0
}
```

---

## Tuning

Chatterbox exposes three knobs via server-side environment variables:

| Variable | Default | Range | What it does |
|----------|---------|-------|--------------|
| `EXAGGERATION` | `0.5` | 0.25 - 2.0 | Emotion intensity |
| `CFG_WEIGHT` | `0.5` | 0.0 - 1.0 | Pace control (higher = more measured) |
| `TEMPERATURE` | `0.8` | 0.0 - 1.0 | Sampling randomness |

These are server-wide defaults. For per-request control, the API accepts these as body parameters on `/v1/audio/speech`.

---

## Troubleshooting

**`clarion-doctor` says chatterbox is down?**
Check that the Chatterbox server is running and that `CHATTERBOX_SERVER` is set in your Clarion server environment. For RunPod, make sure the pod is active and port 4123 is exposed.

**First request is slow?**
Model loading happens on first synthesis request. Subsequent requests are faster. Attach a persistent volume to avoid re-downloading weights on pod restart.

**Voice sounds wrong?**
Voice cloning quality depends on the reference audio. Use a clean recording with no background noise, no music, and consistent volume. 5-10 seconds is the sweet spot.

**Out of VRAM?**
The Turbo model needs ~4.5 GB. If you're running other models on the same GPU, you may need to free memory. Use `nvidia-smi` to check usage.
