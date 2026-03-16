# Doctrine Audit

**Run date:** 2026-03-16
**Files audited:** VECTOR.md, CLAUDE.md, ARCHITECTURE.md
**Project stage:** development (from VECTOR.md)

---

## Findings

### STRUCTURE — medium

- `tasks/` exists on disk with content (`tasks/arasellae-brief.md`) but was not declared in ARCHITECTURE.md's project structure tree. **Fixed** — `tasks/` added to ARCHITECTURE.md structure tree.

### DRIFT — medium

- `CLAUDE.md` (lines 14–45) contained an inline architecture tree that predated ARCHITECTURE.md. It was missing `cli/`, `server/src/elevenlabs.js`, `server/src/google.js`, `server/src/node-server.js`, `services/crypto.js`, `core/voices.js`, `VoiceAudition.jsx`, `Waveform.jsx`, `vector/`, `docs/`, and `test/`. **Fixed** — inline tree replaced with abbreviated reference pointing to ARCHITECTURE.md as the technical authority.

### GAP — low

- `VECTOR.md` has no Key Assumptions or Open Questions sections. Useful in active development; these sections ground decisions in what is still uncertain. [OPERATOR: Consider adding 2–3 key assumptions (e.g., "users are running locally," "one user per installation") and open questions as you discover them.]
- `CLAUDE.md` (Self-Improvement Loop section) references `tasks/lessons.md`, but that file does not exist in `tasks/`. [OPERATOR: Either create `tasks/lessons.md` or update the rule to point to the correct file.]

### PLACEHOLDER — info

- `VECTOR.md`: Problem Statement, Target Audience, Core Value Proposition, What This Is Not, Design Principles, and Quality Gates are all `[OPERATOR: ...]` prompts. Expected for freshly generated doctrine in active development.

### DRIFT — info

- `VECTOR.md` research status marks `./vector/schemas/` as "Not started" but the directory contains 6 JSON schema template files (zv-*.json). They are scaffolding templates, not filled research artifacts — technically accurate but worth noting.

---

## Summary

- Critical: 0 | High: 0 | Medium: 2 (both fixed) | Low: 2 | Info: 2
- **Doctrine health: GAPS FOUND** — no CRITICAL or HIGH findings remaining after fixes.

## Recommended Actions

1. **Fill VECTOR.md operator prompts.** Problem Statement, Target Audience, and Design Principles are the highest-value — they inform every future agent decision. Run `/invest-doctrine` again after filling them.
2. **Create `tasks/lessons.md`** or update the CLAUDE.md self-improvement rule to point to the correct file path.
3. **Add Key Assumptions to VECTOR.md** — 2–3 statements about what is assumed to be true that would change the architecture if proven wrong. Run `/invest-architecture` now if doctrine completeness is not blocking.
