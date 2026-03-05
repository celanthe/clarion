import './VoiceSelector.css';

// Static voice lists — same data as server/src/*.js but client-side for instant UI
const VOICES = {
  edge: [
    { id: 'en-US-JennyNeural',       label: 'Jenny',       lang: 'en-US', gender: 'F' },
    { id: 'en-US-AriaNeural',        label: 'Aria',        lang: 'en-US', gender: 'F' },
    { id: 'en-US-MichelleNeural',    label: 'Michelle',    lang: 'en-US', gender: 'F' },
    { id: 'en-US-AnaNeural',         label: 'Ana',         lang: 'en-US', gender: 'F' },
    { id: 'en-US-GuyNeural',         label: 'Guy',         lang: 'en-US', gender: 'M' },
    { id: 'en-US-RyanNeural',        label: 'Ryan',        lang: 'en-US', gender: 'M' },
    { id: 'en-US-ChristopherNeural', label: 'Christopher', lang: 'en-US', gender: 'M' },
    { id: 'en-US-EricNeural',        label: 'Eric',        lang: 'en-US', gender: 'M' },
    { id: 'en-GB-SoniaNeural',       label: 'Sonia',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-LibbyNeural',       label: 'Libby',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-MiaNeural',         label: 'Mia',         lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-RyanNeural',        label: 'Ryan (UK)',   lang: 'en-GB', gender: 'M' },
    { id: 'en-GB-ThomasNeural',      label: 'Thomas',      lang: 'en-GB', gender: 'M' },
    { id: 'en-AU-NatashaNeural',     label: 'Natasha',     lang: 'en-AU', gender: 'F' },
    { id: 'en-AU-WilliamNeural',     label: 'William',     lang: 'en-AU', gender: 'M' },
    { id: 'en-IE-EmilyNeural',       label: 'Emily',       lang: 'en-IE', gender: 'F' },
    { id: 'en-IE-ConnorNeural',      label: 'Connor',      lang: 'en-IE', gender: 'M' },
    { id: 'en-CA-ClaraNeural',       label: 'Clara',       lang: 'en-CA', gender: 'F' },
    { id: 'en-CA-LiamNeural',        label: 'Liam',        lang: 'en-CA', gender: 'M' },
    { id: 'en-ZA-LeahNeural',        label: 'Leah',        lang: 'en-ZA', gender: 'F' },
    { id: 'en-ZA-LukeNeural',        label: 'Luke',        lang: 'en-ZA', gender: 'M' },
    { id: 'en-NZ-MollyNeural',       label: 'Molly',       lang: 'en-NZ', gender: 'F' },
    { id: 'en-NZ-MitchellNeural',    label: 'Mitchell',    lang: 'en-NZ', gender: 'M' },
    { id: 'en-IN-NeerjaNeural',      label: 'Neerja',      lang: 'en-IN', gender: 'F' },
    { id: 'en-IN-PrabhatNeural',     label: 'Prabhat',     lang: 'en-IN', gender: 'M' },
  ],
  kokoro: [
    { id: 'af_heart',    label: 'Heart',    lang: 'en-US', gender: 'F' },
    { id: 'af_bella',    label: 'Bella',    lang: 'en-US', gender: 'F' },
    { id: 'af_nicole',   label: 'Nicole',   lang: 'en-US', gender: 'F' },
    { id: 'af_sarah',    label: 'Sarah',    lang: 'en-US', gender: 'F' },
    { id: 'af_sky',      label: 'Sky',      lang: 'en-US', gender: 'F' },
    { id: 'am_adam',     label: 'Adam',     lang: 'en-US', gender: 'M' },
    { id: 'am_michael',  label: 'Michael',  lang: 'en-US', gender: 'M' },
    { id: 'bf_emma',     label: 'Emma',     lang: 'en-GB', gender: 'F' },
    { id: 'bf_isabella', label: 'Isabella', lang: 'en-GB', gender: 'F' },
    { id: 'bm_george',   label: 'George',   lang: 'en-GB', gender: 'M' },
    { id: 'bm_lewis',    label: 'Lewis',    lang: 'en-GB', gender: 'M' },
  ],
  piper: [
    { id: 'amy',         label: 'Amy',      lang: 'en-US', gender: 'F' },
    { id: 'kathleen',    label: 'Kathleen', lang: 'en-US', gender: 'F' },
    { id: 'lessac',      label: 'Lessac',   lang: 'en-US', gender: 'F' },
    { id: 'ryan',        label: 'Ryan',     lang: 'en-US', gender: 'M' },
    { id: 'hfc_male',    label: 'HFC Male', lang: 'en-US', gender: 'M' },
    { id: 'alan',        label: 'Alan',     lang: 'en-GB', gender: 'M' },
    { id: 'jenny_dioco', label: 'Jenny',    lang: 'en-GB', gender: 'F' },
  ]
};

const LANG_LABELS = {
  'en-US': 'American English',
  'en-GB': 'British English',
  'en-AU': 'Australian English',
  'en-IE': 'Irish English',
  'en-CA': 'Canadian English',
  'en-ZA': 'South African English',
  'en-NZ': 'New Zealand English',
  'en-IN': 'Indian English'
};

/**
 * Grouped voice picker for a given backend.
 * @param {{ backend: string, value: string, onChange: (id: string) => void }} props
 */
export default function VoiceSelector({ backend, value, onChange }) {
  const voices = VOICES[backend] || [];

  // Group by lang
  const groups = {};
  for (const v of voices) {
    const group = LANG_LABELS[v.lang] || v.lang;
    if (!groups[group]) groups[group] = [];
    groups[group].push(v);
  }

  return (
    <div className="voice-selector">
      <select
        className="voice-selector__select"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Voice"
      >
        {Object.entries(groups).map(([groupLabel, groupVoices]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {groupVoices.map(v => (
              <option key={v.id} value={v.id}>
                {v.label} ({v.gender === 'F' ? 'F' : 'M'})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export { VOICES };
