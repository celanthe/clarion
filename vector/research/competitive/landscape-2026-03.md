# Clarion — Competitive Landscape
**Date:** March 2026

---

## Executive Summary

No single product occupies the exact same position as Clarion. The space fractures into three adjacent clusters: (1) multi-engine TTS proxy servers, (2) CLI tools that pipe LLM/agent output to speech, and (3) voice agent frameworks built for telephony or real-time conversation. Clarion sits at the intersection of all three while adding the one thing none of them have: **named agent voice profiles** — a persistent, auditioned identity layer that travels with an agent across sessions. That gap is real and currently unclaimed.

---

## Competitors and Adjacent Tools

### 1. agent-tts (kiliman)
**URL:** https://github.com/kiliman/agent-tts

**What it does:** Real-time TTS for AI coding assistants. Monitors Claude Code, OpenCode, and other agents and speaks their output aloud via a local server with a React/browser UI. Supports ElevenLabs, OpenAI TTS, Kokoro, and any OpenAI-compatible service. Has global hotkeys, playback controls (pause/skip/stop), message history, and markdown-cleaning for natural speech.

**Overlap with Clarion:**
- Same core use case: pipe agentic CLI output to audio
- Multi-provider TTS backend support (Kokoro, ElevenLabs, OpenAI)
- Browser-accessible UI
- Targets Claude Code specifically
- Cognitive load reduction is an implicit benefit

**What it does that Clarion doesn't:**
- Real-time streaming speech as the agent types (not just on completion)
- Global hotkeys for playback control
- Message history/replay with infinite scroll

**What Clarion does that it doesn't:**
- Named, persistent agent voice profiles (agent-tts has no concept of "this agent always sounds like X")
- Voice auditioning across backends — comparing the same text across Edge TTS, Kokoro, ElevenLabs side by side
- Multi-agent fleet management (distinct voice per agent role)
- Self-hosted proxy layer that routes by agent name
- Google Chirp 3 HD and Piper as backends

**Assessment:** Closest direct competitor in the "agentic CLI to audio" space. Meaningful overlap on use case 3 (cognitive load). Lacks the identity/profile layer entirely.

---

### 2. VoiceMode MCP
**URL:** https://getvoicemode.com / https://github.com/mbailey/voicemode

**What it does:** An MCP server that adds two-way voice conversation to Claude Code and Claude Desktop. Uses Whisper for STT and OpenAI TTS or local Kokoro for output. Designed for hands-free back-and-forth dialogue, not passive listening.

**Overlap with Clarion:**
- TTS output from Claude Code
- Kokoro backend support
- Self-hostable / local-first option

**What it does that Clarion doesn't:**
- Full bidirectional voice (STT input + TTS output — a full conversation loop)
- MCP-native integration, no separate proxy layer needed
- Works with Claude Desktop, not just CLI
- Smart silence detection for natural conversation turns

**What Clarion does that it doesn't:**
- Named agent profiles — no identity management
- Multi-backend auditioning
- Fleet management for multiple concurrent agents
- Edge TTS, Piper, ElevenLabs, Google Chirp 3 HD

**Assessment:** Overlaps on "hear Claude Code." Diverges sharply on direction — VoiceMode is building a conversational interface; Clarion is building a voice identity system.

---

### 3. ospeak (simonw)
**URL:** https://github.com/simonw/ospeak

**What it does:** Minimal CLI tool that pipes text through OpenAI TTS. `llm -m gpt-4 "..." | ospeak -v nova`. Supports all OpenAI voices, adjustable speed, optional file output.

**What it does that Clarion doesn't:**
- Extremely lightweight — no server required

**What Clarion does that it doesn't:**
- Agent identity and voice profiles
- Multi-backend support (ospeak is OpenAI-only)
- Self-hosted backends (no cost per character)
- Browser UI, fleet management, voice audition

**Assessment:** A simple utility, not a platform. Clarion is what ospeak would be if someone asked "what if the agent always sounded the same, and you got to choose how?"

---

### 4. OpenTTS
**URL:** https://github.com/synesthesiam/opentts

**What it does:** Self-hosted Python TTS server aggregating multiple engines (eSpeak NG, Festival, Coqui TTS, MaryTTS, Flite) behind a single REST API. Has a browser UI for auditioning voices.

**Overlap with Clarion:**
- Self-hosted, multi-engine TTS server
- Browser UI for voice audition
- REST API proxy layer

**What it does that Clarion doesn't:**
- Broader language support (multi-lingual, dozens of languages)
- SSML support
- Longer maintenance history

**What Clarion does that it doesn't:**
- Named agent profiles
- Support for modern neural backends (Kokoro, ElevenLabs, Google Chirp 3 HD, Edge TTS)
- CLI piping from agent output
- Fleet management

**Assessment:** Architectural cousin built for a different era. OpenTTS auditions voices for content creation; Clarion auditions voices for agents.

---

### 5. open-unified-tts
**URL:** https://github.com/loserbcc/open-unified-tts

**What it does:** OpenAI-compatible TTS proxy unifying Kokoro (67+ voices), Fish Speech/OpenAudio, and VoxCPM voice cloning. Smart text chunking, backend routing with failover, Docker deployment.

**What it does that Clarion doesn't:**
- Voice cloning (VoxCPM)
- Smart long-text chunking with crossfade stitching
- GPU/CPU Docker variants
- Failover routing

**What Clarion does that it doesn't:**
- Named agent profiles
- ElevenLabs, Google Chirp 3 HD, Edge TTS, Piper
- Browser voice audition UI
- CLI integration, fleet management

**Assessment:** Closest structural overlap on the proxy/backend-unification axis. No conceptual overlap on agent identity.

---

### 6. LocalAI (TTS features)
**URL:** https://localai.io

**What it does:** Broad self-hosted OpenAI-compatible API for LLMs, images, audio. TTS module supports Piper and others.

**Assessment:** Infrastructure overlap (proxy layer, Piper support) but LocalAI is a general-purpose inference platform. Agent voice identity is not in scope.

---

### 7. RealtimeTTS (KoljaB)
**URL:** https://github.com/KoljaB/RealtimeTTS

**What it does:** Python library for streaming TTS with sub-100ms latency. Supports OpenAI TTS, ElevenLabs, Azure, Piper, Edge TTS, Kokoro, Coqui, and others. Engine fallback. Designed as the audio output layer for conversational voice agents.

**What it does that Clarion doesn't:**
- Streaming TTS (sentence-by-sentence as LLM generates)
- Automatic engine failover
- Voice cloning via Coqui/XTTS
- Python library (embeddable in code)

**What Clarion does that it doesn't:**
- Named agent profiles, self-hosted proxy server, browser UI, CLI pipe, fleet concept

**Assessment:** Lives in a different layer of the stack. RealtimeTTS is a building block for developers; Clarion is an end-user tool for people running agents.

---

### 8. TTS-WebUI (rsxdalv)
**URL:** https://github.com/rsxdalv/TTS-WebUI

**What it does:** Gradio + React web UI aggregating 20+ TTS and voice models: Bark, Kokoro, Piper, XTTSv2, F5-TTS, GPT-SoVITS, and many more. Extension system. OpenAI-compatible TTS API endpoint.

**Overlap with Clarion:**
- Browser UI for TTS
- Kokoro and Piper backend support
- Multi-model voice audition in browser

**What it does that Clarion doesn't:**
- Extremely broad model support (20+ engines)
- Voice cloning and RVC voice conversion
- Established community and extension ecosystem

**What Clarion does that it doesn't:**
- Named agent voice profiles with persistence
- CLI integration for agent output piping
- Multi-agent fleet management
- Focused, streamlined audition workflow
- ElevenLabs and Google Chirp 3 HD as managed backends

**Assessment:** High overlap on "audition TTS voices in browser." Diverges completely on agent identity. TTS-WebUI is a power-user audio studio; Clarion is a workflow tool for people running named agents.

---

### 9. awesome-tts / tetos / others
Smaller projects (awesome-tts by isaacgounton, tetos by frostming) overlap on the multi-backend proxy or CLI utility axis but have no agent identity concept. Not primary threats.

---

## Summary Matrix

| Tool | Multi-backend | Voice auditioning UI | Named agent profiles | Fleet mgmt | CLI agent pipe | Self-hosted |
|------|--------------|---------------------|---------------------|------------|---------------|-------------|
| **Clarion** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| agent-tts | Partial | ✗ | ✗ | ✗ | ✓ | ✓ |
| VoiceMode MCP | ✗ | ✗ | ✗ | ✗ | ✓ (MCP) | Optional |
| ospeak | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| OpenTTS | ✓ (older) | ✓ | ✗ | ✗ | ✗ | ✓ |
| open-unified-tts | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| LocalAI | Partial | ✗ | ✗ | ✗ | ✗ | ✓ |
| RealtimeTTS | ✓ | ✗ | ✗ | ✗ | ✗ (library) | ✓ |
| TTS-WebUI | ✓ (many) | ✓ | ✗ | ✗ | ✗ | ✓ |

---

## Key Findings

**The named agent profile gap is real and unclaimed.** No tool surveyed has a concept of a persistent, auditioned voice identity assigned to a specific named agent. Every other tool treats TTS as a function call. Clarion treats it as character assignment.

**Closest competitor for use case 3 (cognitive load / hear the output): agent-tts.** Most direct functional overlap, especially for Claude Code users. It is ahead on real-time streaming and playback controls. Has no auditioning, no profiles, no fleet concept. Worth watching closely.

**Closest competitor for use case 1 (voice auditioning): TTS-WebUI.** Rich browser UI for exploring many models. A studio tool, not a workflow tool — no agent identity layer.

**Fleet management (use case 2) is completely unclaimed.** No tool surveyed has any notion of routing different named agents to different voices, or managing a roster of agent voice assignments. This is Clarion's most defensible differentiator.

**The self-hosted proxy + modern backends niche is crowded at the infrastructure layer** (LocalAI, open-unified-tts, RealtimeTTS) but none surface into a usable product for the agent-voice-identity use case.
