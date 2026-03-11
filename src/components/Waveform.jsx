import { useEffect, useRef } from 'react';
import { getAnalyser } from '../../services/tts.js';
import './Waveform.css';

const BAR_COUNT = 32;
const GAP = 3;

export default function Waveform({ active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Keep canvas pixel resolution in sync with its CSS display width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sync = () => {
      const w = canvas.offsetWidth;
      if (w > 0 && canvas.width !== w) canvas.width = w;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!active) {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const freqData = new Uint8Array(BAR_COUNT);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Frequency-mapped color palette:
    // Low frequencies → warm rose/amber, high frequencies → cool lavender/blue
    // Each bar's color is determined by its position (frequency band), not amplitude.
    // Amplitude modulates height and opacity only.
    const WARM = { r: 220, g: 100, b: 120 };  // rose — bass/low-mid
    const MID  = { r: 130, g: 114, b: 240 };  // accent purple — mid
    const COOL = { r:  80, g: 180, b: 220 };  // teal — high frequencies

    function freqColor(pos) {
      // pos: 0 (lowest freq) → 1 (highest freq)
      // Blend warm→mid for the first half, mid→cool for the second
      if (pos < 0.5) {
        const p = pos * 2;
        return {
          r: Math.round(WARM.r + (MID.r - WARM.r) * p),
          g: Math.round(WARM.g + (MID.g - WARM.g) * p),
          b: Math.round(WARM.b + (MID.b - WARM.b) * p),
        };
      } else {
        const p = (pos - 0.5) * 2;
        return {
          r: Math.round(MID.r + (COOL.r - MID.r) * p),
          g: Math.round(MID.g + (COOL.g - MID.g) * p),
          b: Math.round(MID.b + (COOL.b - MID.b) * p),
        };
      }
    }

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      const barW = Math.floor((W - GAP * (BAR_COUNT - 1)) / BAR_COUNT);
      ctx.clearRect(0, 0, W, H);

      const now = Date.now();

      const analyser = getAnalyser();
      if (analyser) {
        const raw = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(raw);
        for (let i = 0; i < BAR_COUNT; i++) {
          freqData[i] = raw[Math.floor(i * raw.length / BAR_COUNT)];
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        // Real data when analyser is live; gentle ripple while loading (skipped if reduced motion)
        const t = analyser
          ? freqData[i] / 255
          : prefersReduced ? 0.08 : 0.08 + 0.07 * Math.sin((i / BAR_COUNT) * Math.PI * 4 + now * 0.003);

        const barH = Math.max(3, Math.round(t * H));
        const x = i * (barW + GAP);
        const y = H - barH;

        // Color by frequency position; amplitude drives opacity so quiet bars recede
        const { r, g, b } = freqColor(i / (BAR_COUNT - 1));
        const alpha = 0.3 + 0.7 * t;

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x, y, barW, barH);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div className={`waveform-wrap${active ? ' waveform-wrap--active' : ''}`}>
      <canvas ref={canvasRef} className="waveform" height={80} aria-hidden="true" />
      <span role="status" className="sr-only">{active ? 'Playing' : ''}</span>
    </div>
  );
}
