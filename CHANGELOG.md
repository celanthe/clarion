# Changelog

## 0.2.0 — 2026-03-10

### UI
- Switch primary typeface from Inter to Space Grotesk
- Replace rainbow waveform with monochromatic accent-color bars; remove glow effect
- Header now only shows backends that are actively configured — hides "Not configured" clutter on fresh installs
- Replace "Server settings" text button with gear icon; reduces header visual weight
- Audition save flow: user stays on the Audition tab after saving, with a success card, saved agent name, and "Go to Agents →" CTA — removes the silent auto-redirect
- Fix hover border direction on agent cards and voice rows (was darkening on hover, now lifts)
- Left-align empty state with max-width; remove centered layout
- Remove redundant "Voice Audition" heading (tab label already says it)
- Speed slider gets a subtle 1.0× reference notch
- Hide character counter until the user starts typing
- Backend status collapses to a single aggregate dot on mobile (<600px)
- Differentiate "down" (amber) from "unconfigured" (gray) in status indicators

### Accessibility
- Restore focus rings suppressed by component CSS across VoiceSelector, AgentCard name input, textarea, and save input
- Add `aria-controls` to server config toggle button
- Add `sr-only` utility class to global stylesheet
- Make "Use this voice" button visible when focused via keyboard
- Import error gets `role="alert"` and a dismiss button
- Expand prose-only checkbox touch target to 44×44px without changing visual size
- Add `noreferrer` to all external footer links

### Performance
- Replace `transition: all` with explicit property lists in 7 places
- Replace hardcoded `rgba` color with `color-mix()` token reference
- Switch waveform show/hide from `max-height` (layout) to `clip-path` (composited)

### CLI
- Concurrent `stream.js` instances now queue in completion order — multiple agents speaking from separate sessions no longer overlap
- Stale lock detection: if the lock holder process is dead or has held the lock for more than 60 seconds, the lock is broken automatically
- Instances that wait more than 60 seconds exit silently rather than playing out-of-context audio

### Bug fixes
- Fix server path in UI hint text (`node server/src/node-server.js`, not `node src/node-server.js`)
- Fix prose-only checkbox tap target overflowing into label text
- Fix tagline wrapping in header when backend status cluster is wide

## 0.1.0 — initial release
