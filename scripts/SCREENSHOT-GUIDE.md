# Screenshot Guide

How to capture polished screenshots for the Clarion README.

## Setup

1. Start the dev server: `npm run dev`
2. Open http://localhost:5173
3. Open browser console and paste the contents of `stage-screenshots.js`
4. Refresh the page

## Screenshots to capture

### 1. Agent Cards (docs/img/clarion-agents.png)
- Go to the Agents tab
- You should see 3 agent cards: Arynna (Kokoro), Thessara (Edge), River (ElevenLabs)
- Browser window: 1200px wide, capture the full agents grid
- Crop to just the card area, no browser chrome

### 2. Voice Audition (docs/img/clarion-audition.png)
- Go to the Audition tab
- Paste the sample dialogue from sample-dialogue.txt
- Select Kokoro backend
- Click play on a voice to start the waveform
- Screenshot while waveform is active
- Browser window: 1200px wide

### 3. Waveform Close-up (docs/img/clarion-waveform.png)
- While audio is playing, screenshot just the waveform area
- Crop tightly to the waveform visualizer

## Tips
- Use Firefox/Chrome DevTools responsive mode at 1200x800 for consistent sizing
- Dark screenshots on dark backgrounds -- make sure the window is focused
- macOS: Cmd+Shift+4 then Space to capture a window with shadow
- Save as PNG, no compression artifacts
