import { useEffect, useRef } from 'react';
import { getAnalyser } from '../../services/tts.js';
import './Waveform.css';

const BAR_COUNT = 32;
const GAP = 3;

export default function Waveform({ active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!active) {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const W = canvas.width;
    const H = canvas.height;
    const barW = Math.floor((W - GAP * (BAR_COUNT - 1)) / BAR_COUNT);

    function draw() {
      ctx.clearRect(0, 0, W, H);

      const analyser = getAnalyser();
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        for (let i = 0; i < BAR_COUNT; i++) {
          const di = Math.floor(i * data.length / BAR_COUNT);
          const t = data[di] / 255;
          const barH = Math.max(2, Math.round(t * H));
          const x = i * (barW + GAP);
          const y = H - barH;

          // Rainbow: red → orange → yellow → green → cyan → blue → violet
          const hue = Math.round((i / (BAR_COUNT - 1)) * 270);
          ctx.shadowColor = `hsl(${hue}, 100%, 75%)`;
          ctx.shadowBlur = 8;
          ctx.fillStyle = `hsl(${hue}, 100%, 62%)`;
          ctx.fillRect(x, y, barW, barH);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div className={`waveform-wrap${active ? ' waveform-wrap--active' : ''}`}>
      <canvas ref={canvasRef} className="waveform" width={640} height={80} />
    </div>
  );
}
