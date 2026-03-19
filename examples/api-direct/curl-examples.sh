#!/usr/bin/env bash
# Clarion API — curl examples
# Server must be running: cd server && npm run dev (port 8787)
# Or via Docker: docker-compose up (port 8080)

SERVER="http://localhost:8787"

# ─── Edge TTS (no auth, zero config) ────────────────────────────────

# Speak text with default Edge voice
curl -X POST "$SERVER/speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "The pattern holds.", "backend": "edge", "voice": "en-GB-RyanNeural", "speed": 1.0}' \
  --output speech.mp3

# List available Edge voices
curl "$SERVER/voices?backend=edge" | jq '.voices[:5]'

# ─── Kokoro (self-hosted, needs KOKORO_SERVER) ──────────────────────

curl -X POST "$SERVER/speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "The pattern holds.", "backend": "kokoro", "voice": "bm_george", "speed": 1.0}' \
  --output speech-kokoro.mp3

curl "$SERVER/voices?backend=kokoro" | jq '.voices[:5]'

# ─── ElevenLabs (needs ELEVENLABS_API_KEY) ──────────────────────────

curl -X POST "$SERVER/speak" \
  -H "Content-Type: application/json" \
  -d '{"text": "The pattern holds.", "backend": "elevenlabs", "voice": "21m00Tcm4TlvDq8ikWAM", "speed": 1.0}' \
  --output speech-eleven.mp3

# ─── With API key auth ──────────────────────────────────────────────

# If API_KEY is set on the server, authenticate with Bearer token:
curl -X POST "$SERVER/speak" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"text": "Authenticated request.", "backend": "edge", "voice": "en-US-JennyNeural"}' \
  --output speech-auth.mp3

# ─── Health check ───────────────────────────────────────────────────

curl "$SERVER/health" | jq .
