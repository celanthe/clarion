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

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      const barW = Math.floor((W - GAP * (BAR_COUNT - 1)) / BAR_COUNT);
      ctx.clearRect(0, 0, W, H);

      const now = Date.now();
      // Rainbow cycles over ~8s unless user prefers reduced motion
      const hueOffset = prefersReduced ? 0 : (now / 25) % 360;

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
        const hue = Math.round(((i / (BAR_COUNT - 1)) * 270 + hueOffset) % 360);

        ctx.shadowColor = `hsl(${hue}, 100%, 78%)`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `hsl(${hue}, 100%, 64%)`;
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
