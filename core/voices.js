/**
 * Single source of truth for all voice lists.
 * Imported by VoiceSelector, VoiceAudition, and (in the future) any other UI that needs voices.
 * Server-side modules (edge.js, kokoro.js, piper.js) maintain their own lists for validation.
 */

export const LANG_LABELS = {
  'en-US': 'American English',
  'en-GB': 'British English',
  'en-AU': 'Australian English',
  'en-IE': 'Irish English',
  'en-CA': 'Canadian English',
  'en-ZA': 'South African English',
  'en-NZ': 'New Zealand English',
  'en-IN': 'Indian English'
};

export const VOICES = {
  edge: [
    // American English
    { id: 'en-US-JennyNeural',       label: 'Jenny',       lang: 'en-US', gender: 'F' },
    { id: 'en-US-AriaNeural',        label: 'Aria',        lang: 'en-US', gender: 'F' },
    { id: 'en-US-MichelleNeural',    label: 'Michelle',    lang: 'en-US', gender: 'F' },
    { id: 'en-US-AnaNeural',         label: 'Ana',         lang: 'en-US', gender: 'F' },
    { id: 'en-US-GuyNeural',         label: 'Guy',         lang: 'en-US', gender: 'M' },
    { id: 'en-US-RyanNeural',        label: 'Ryan',        lang: 'en-US', gender: 'M' },
    { id: 'en-US-ChristopherNeural', label: 'Christopher', lang: 'en-US', gender: 'M' },
    { id: 'en-US-EricNeural',        label: 'Eric',        lang: 'en-US', gender: 'M' },
    // British English
    { id: 'en-GB-SoniaNeural',       label: 'Sonia',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-LibbyNeural',       label: 'Libby',       lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-MiaNeural',         label: 'Mia',         lang: 'en-GB', gender: 'F' },
    { id: 'en-GB-RyanNeural',        label: 'Ryan (UK)',   lang: 'en-GB', gender: 'M' },
    { id: 'en-GB-ThomasNeural',      label: 'Thomas',      lang: 'en-GB', gender: 'M' },
    // Australian English
    { id: 'en-AU-NatashaNeural',     label: 'Natasha',     lang: 'en-AU', gender: 'F' },
    { id: 'en-AU-AnnetteNeural',     label: 'Annette',     lang: 'en-AU', gender: 'F' },
    { id: 'en-AU-WilliamNeural',     label: 'William',     lang: 'en-AU', gender: 'M' },
    { id: 'en-AU-DarrenNeural',      label: 'Darren',      lang: 'en-AU', gender: 'M' },
    // Irish English
    { id: 'en-IE-EmilyNeural',       label: 'Emily',       lang: 'en-IE', gender: 'F' },
    { id: 'en-IE-ConnorNeural',      label: 'Connor',      lang: 'en-IE', gender: 'M' },
    // Canadian English
    { id: 'en-CA-ClaraNeural',       label: 'Clara',       lang: 'en-CA', gender: 'F' },
    { id: 'en-CA-LiamNeural',        label: 'Liam',        lang: 'en-CA', gender: 'M' },
    // South African English
    { id: 'en-ZA-LeahNeural',        label: 'Leah',        lang: 'en-ZA', gender: 'F' },
    { id: 'en-ZA-LukeNeural',        label: 'Luke',        lang: 'en-ZA', gender: 'M' },
    // New Zealand English
    { id: 'en-NZ-MollyNeural',       label: 'Molly',       lang: 'en-NZ', gender: 'F' },
    { id: 'en-NZ-MitchellNeural',    label: 'Mitchell',    lang: 'en-NZ', gender: 'M' },
    // Indian English
    { id: 'en-IN-NeerjaNeural',      label: 'Neerja',      lang: 'en-IN', gender: 'F' },
    { id: 'en-IN-PrabhatNeural',     label: 'Prabhat',     lang: 'en-IN', gender: 'M' },
  ],
  kokoro: [
    // American Female
    { id: 'af_heart',    label: 'Heart',    lang: 'en-US', gender: 'F' },
    { id: 'af_bella',    label: 'Bella',    lang: 'en-US', gender: 'F' },
    { id: 'af_nicole',   label: 'Nicole',   lang: 'en-US', gender: 'F' },
    { id: 'af_sarah',    label: 'Sarah',    lang: 'en-US', gender: 'F' },
    { id: 'af_sky',      label: 'Sky',      lang: 'en-US', gender: 'F' },
    // American Male
    { id: 'am_adam',     label: 'Adam',     lang: 'en-US', gender: 'M' },
    { id: 'am_michael',  label: 'Michael',  lang: 'en-US', gender: 'M' },
    // British Female
    { id: 'bf_emma',     label: 'Emma',     lang: 'en-GB', gender: 'F' },
    { id: 'bf_isabella', label: 'Isabella', lang: 'en-GB', gender: 'F' },
    // British Male
    { id: 'bm_george',   label: 'George',   lang: 'en-GB', gender: 'M' },
    { id: 'bm_lewis',    label: 'Lewis',    lang: 'en-GB', gender: 'M' },
  ],
  piper: [
    // American English
    { id: 'amy',         label: 'Amy',      lang: 'en-US', gender: 'F' },
    { id: 'kathleen',    label: 'Kathleen', lang: 'en-US', gender: 'F' },
    { id: 'lessac',      label: 'Lessac',   lang: 'en-US', gender: 'F' },
    { id: 'ryan',        label: 'Ryan',     lang: 'en-US', gender: 'M' },
    // British English
    { id: 'alan',        label: 'Alan',     lang: 'en-GB', gender: 'M' },
    { id: 'jenny_dioco', label: 'Jenny',    lang: 'en-GB', gender: 'F' },
  ]
};

/** Group a flat voice list by human-readable language label. */
export function groupByLang(voices) {
  const groups = {};
  for (const v of voices) {
    const label = LANG_LABELS[v.lang] || v.lang;
    if (!groups[label]) groups[label] = [];
    groups[label].push(v);
  }
  return groups;
}
