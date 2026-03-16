---
project:
  name: clarion
  description: Self-hosted TTS proxy and agent voice manager — give your AI agent a consistent, auditioned voice.
  stage: development
  started: 2026-03-05
  repo: https://github.com/celanthe/clarion
owner:
  name: celanthe
knowledge:
  research: ./vector/research/
  schemas: ./vector/schemas/
  decisions: ./vector/decisions/
  audits: ./vector/audits/
---

# Clarion — Product Doctrine

## Problem Statement

AI agents have voices — but those voices are homogeneous, robotic, and impossible to customize. You can't audition a voice against your agent's actual dialogue, compare across TTS models, adjust speed, or save a choice for next time. Every session starts from scratch.

For users running agent fleets — multiple agents with distinct roles and personalities — the problem compounds. There's no way to give each crewmember a distinct sound that matches who they are. And for anyone managing five or six agents simultaneously, reading all that output is exhausting. Audio reduces that cognitive load: you can listen to one agent while reading another, or just let the output wash over you while you work.

Clarion exists to fix all three problems: audition first, save the profile, pipe it through.

## Target Audience

**Primary — AI power users and hobbyists running personal agents.** Specifically:
- Developers using Claude Code or similar agentic CLIs who want spoken output as they work — ambient audio instead of a wall of text.
- Users managing agent fleets with distinct roles and personalities who need each crewmember to sound different.
- Podcast producers and creators who have invented a named AI persona and need a reproducible, consistent voice across sessions.
- Self-hosters who want local control over their TTS stack and distrust cloud-only lock-in.

Users range from zero-config (Edge TTS, browser only, no setup) to power users running local Kokoro or Piper via Docker. All are comfortable with a CLI and basic self-hosting.

## Core Value Proposition

Clarion is the fastest way to give your AI agents distinct, auditionable voices — from a browser audition tab to a live CLI pipe to a Claude Code hook, all self-hosted. The free backend works with zero setup. The best backends run on your own hardware.

## What This Is Not

- **Not a shared or multi-tenant platform.** Rate limiting exists but is off by default. No per-user accounts, no billing, no usage tracking. Built for personal or small-team self-hosted use.
- **Not a production SaaS voice product.** No KV cache, no GPU inference, no uptime guarantees. If you need those, build on top of Clarion or use a managed TTS service.
- **Not a real-time voice chat system.** Clarion synthesizes completed text — it doesn't handle live microphone input, streaming partial tokens mid-sentence, or duplex audio.
- **Not a transcription or STT tool.** Output only — text in, audio out.
- **Not a general-purpose TTS library or npm package.** `private: true` in package.json is intentional. Clarion is a self-hosted tool, not a dependency.

## Design Principles

1. **Zero-config is sacred.** Edge TTS works with no server, no API key, no setup. Every feature addition must preserve this. If it breaks the zero-config path, it doesn't ship.

2. **Agents are crewmembers, not settings.** A voice profile is a named crewmember with a role and a sound. Design everything around the agent as a first-class identity, not around backends or parameters.

3. **Hear before you commit.** You should never have to guess what a voice sounds like. Audition against your agent's actual dialogue is a first-class workflow, not a nice-to-have.

4. **Audio is output, not an add-on.** For users managing multiple agents, spoken output is a primary interface — not a novelty. Design for the case where you're listening, not reading.

5. **Local control by default.** Your agents, your hardware, your server. No telemetry, no cloud lock-in, no shared infrastructure assumptions.

## Constraints

**Technical constraints (inferred from codebase — HIGH confidence):**
- No KV cache — keep it simple; caching can be added later if needed
- No rate limiting by default — designed for personal/self-hosted use, not shared infrastructure
- Edge TTS always available — Microsoft Translator API, no key needed, always a working default
- No database — agent profiles in localStorage (browser) and `~/.config/clarion/agents.json` (CLI); no backend persistence required
- `private: true` in package.json — self-hosted, not published to npm as a library
- CLI scripts have zero npm dependencies — Node built-ins and `fetch` only

**Deployment constraints:**
- Cloudflare Worker: Edge TTS works with no secrets; Kokoro/Piper/ElevenLabs/Google require env secrets via `wrangler secret put`
- Docker Compose: Kokoro and Piper servers bind to `127.0.0.1` by default — do not expose on `0.0.0.0` unless network is trusted
- CORS open (`*`) by default — set `ALLOWED_ORIGIN` to restrict for remote deployments
- HMAC auth optional — if no `API_KEY` is set on the server, requests are accepted unauthenticated (acceptable for localhost)

**License:** MIT. Investiture framework pattern copyright Erika Flowers / Zero-Vector Design — used with inspiration and gratitude.

## Quality Gates

- **Edge TTS must play.** If Edge TTS doesn't produce audio without a server, without a key, the change doesn't ship. This is the zero-config guarantee.
- **No perceptible lag.** Audio should start within a second of triggering. If a change introduces noticeable delay, fix it before shipping.
- **CLI scripts stay dependency-free.** `cli/*.js` uses Node built-ins and `fetch` only. No new npm dependencies.
- **Agent profiles round-trip cleanly.** Export then import must produce an identical agent. No data loss, no silent field drops.

---

## Core Relationship

> This project operates on a contractor model.

The agent working on this project is a skilled contractor — highly capable, opinionated about craft, and here to build what the operator defines. The operator (you) owns the vision, the constraints, and the calls that aren't purely technical. The agent owns the execution.

**What this means in practice:**
- The agent reads doctrine before writing code.
- When doctrine is silent, the agent asks rather than invents.
- When trade-offs arise, the agent surfaces them rather than deciding unilaterally.
- The agent's job is to make the operator's vision real, not to substitute the agent's own judgment for the operator's.

*These are Investiture defaults — the contractor relationship is a framework convention, not project-specific.*

---

## Seven Principles

*These are Investiture defaults. They apply to every project built on this framework.*

1. **Doctrine before code.** Read VECTOR.md, CLAUDE.md, and ARCHITECTURE.md before touching the codebase. The three files together define the project. Code that contradicts doctrine is wrong by definition.

2. **Infer from reality, not from defaults.** The actual project structure, naming patterns, and conventions are authoritative. If an Investiture default conflicts with what is actually in the project, reality wins. Document the divergence; don't silently override it.

3. **One file, one job.** Every file has a single clear responsibility. When a file starts doing two jobs, it's time to split it. The 200-line limit is a smell detector, not a rule — but when you hit it, ask why.

4. **Explicit over implicit.** Name things after what they do. Write types. Write contracts. Don't make other contributors (or the agent on the next session) guess what a function expects or returns.

5. **Surface trade-offs, don't hide them.** When a design choice has a cost — performance, complexity, flexibility — say so in a comment, a decision record, or the doctrine. Hidden trade-offs are technical debt that compounds silently.

6. **The chain validates.** The Investiture skill chain (backfill → doctrine → architecture) is a feedback loop, not a one-time setup. Run it when doctrine drifts. Run it when architecture drifts. The chain catches contradictions you stopped seeing.

7. **Operator judgment is final.** The agent flags violations and surfaces options. The operator decides. When the operator makes a call the agent disagrees with, the agent builds it anyway and records the decision in `/vector/decisions/`.

**Non-negotiables:**
- Never write to CLAUDE.md, VECTOR.md, or ARCHITECTURE.md without the operator's explicit instruction.
- Never generate or commit API keys, secrets, or credentials.
- Never override a decision the operator has already made — record it and move on.

---

## Research Status

| Area | Location | Status |
|------|----------|--------|
| User interviews | `./vector/research/interviews/` | Not started |
| JTBD analysis | `./vector/research/jtbd/` | Not started |
| Personas | `./vector/research/personas/` | Not started |
| Competitive analysis | `./vector/research/competitive/` | Not started |
| Assumptions | `./vector/research/assumptions/` | Not started |
| Schemas | `./vector/schemas/` | Not started |
| Decisions | `./vector/decisions/` | Not started |
