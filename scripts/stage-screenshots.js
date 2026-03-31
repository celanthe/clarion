// Paste this into the browser console at localhost:5173 to stage screenshot data.
// Then refresh the page.
//
// Uses the exact schema from core/domain/agent.js and the 'clarion_agents'
// localStorage key from services/storage/agent-storage.js.

const agents = [
  {
    id: "arynna",
    name: "Arynna",
    backend: "kokoro",
    voice: "af_bella",
    speed: 1.0,
    proseOnly: true,
    createdAt: "2026-03-28T14:22:00.000Z"
  },
  {
    id: "thessara",
    name: "Thessara",
    backend: "edge",
    voice: "en-GB-SoniaNeural",
    speed: 0.9,
    proseOnly: true,
    createdAt: "2026-03-29T09:15:00.000Z"
  },
  {
    id: "river",
    name: "River",
    backend: "elevenlabs",
    voice: "jBpfuIE2acCO8z3wKNLl",
    speed: 1.0,
    proseOnly: true,
    createdAt: "2026-03-30T11:00:00.000Z"
  }
];

localStorage.setItem('clarion_agents', JSON.stringify(agents));
console.log('%c Clarion screenshot data staged.', 'color: #a78bfa; font-weight: bold');
console.log('3 agents written to clarion_agents:', agents.map(a => `${a.name} (${a.backend})`).join(', '));
console.log('Refresh the page to see them.');
