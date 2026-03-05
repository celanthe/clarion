/**
 * Client-side TTS service.
 *
 * Chrome requires audio.play() to be called synchronously within a user
 * gesture handler. Since we need to fetch audio first (async), we pre-start
 * the audio element with a silent clip before the fetch, which locks in the
 * gesture and allows the subsequent play() with real audio to succeed.
 */

import { getServerUrl } from './storage/agent-storage.js';

// Minimal silent WAV (8 samples) — used to unlock the audio element
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let _audio = null;
let _blobUrl = null;
let _pageUnlocked = false;

// Web Audio API — for the waveform visualizer
let _audioCtx = null;
let _analyser = null;
let _source = null;

/** Returns the current AnalyserNode, or null if nothing is playing. */
export function getAnalyser() {
  return _analyser;
}

function cleanup() {
  // Null analyser reference immediately so the visualizer stops reading
  const analyser = _analyser;
  const source = _source;
  _analyser = null;
  _source = null;
  if (source) source.disconnect();
  if (analyser) analyser.disconnect();

  if (_audio) {
    _audio.onended = null;
    _audio.onerror = null;
    _audio.pause();
    _audio.src = '';
    _audio.remove();
    _audio = null;
  }
  if (_blobUrl) {
    URL.revokeObjectURL(_blobUrl);
    _blobUrl = null;
  }
}

export async function speak(text, options = {}) {
  cleanup();

  const serverUrl = getServerUrl();
  const { backend = 'edge', voice, speed = 1.0 } = options;

  // Play a silent clip synchronously to unlock autoplay on this page.
  // Only needed once — after the first successful play(), Chrome marks the
  // page as activated and all subsequent audio.play() calls work freely.
  // Also create the AudioContext here while we're inside a user gesture.
  if (!_pageUnlocked) {
    const unlock = new Audio(SILENT);
    unlock.play().then(() => { _pageUnlocked = true; }).catch(() => {});
  }
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }

  // Fetch the real audio
  const response = await fetch(`${serverUrl}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, backend, voice, speed })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const blob = new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
  _blobUrl = URL.createObjectURL(blob);

  const audio = new Audio(_blobUrl);
  audio.style.display = 'none';
  document.body.appendChild(audio);
  _audio = audio;

  // Connect to Web Audio graph for the visualizer
  try {
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 64; // 32 frequency bins → 32 bars
    _source = _audioCtx.createMediaElementSource(audio);
    _source.connect(_analyser);
    _analyser.connect(_audioCtx.destination);
  } catch {
    // Non-fatal — audio still plays, visualizer just won't work
    _analyser = null;
    _source = null;
  }

  try {
    await audio.play();
  } catch (err) {
    cleanup();
    throw new Error(`Playback blocked: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => {
      const msg = audio.error?.message || 'unknown error';
      cleanup();
      reject(new Error(`Playback error: ${msg}`));
    };
  });
}

export async function speakAsAgent(text, agent) {
  return speak(text, {
    backend: agent.backend,
    voice: agent.voice,
    speed: agent.speed
  });
}

export function stop() {
  cleanup();
}

export async function fetchVoices(backend) {
  const serverUrl = getServerUrl();
  const res = await fetch(`${serverUrl}/voices?backend=${backend}`);
  if (!res.ok) throw new Error(`Failed to fetch voices: ${res.status}`);
  const data = await res.json();
  return data.voices || [];
}

export async function fetchHealth() {
  const serverUrl = getServerUrl();
  const res = await fetch(`${serverUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
