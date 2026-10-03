/** WebAudio で合成する SE（アセット不要・音程を自由に変えられる） */

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let lastBlipAt = 0;

// ペンタトニック（ドレミソラ）で上がっていくと気持ちいい
const PENTATONIC = [0, 2, 4, 7, 9];

const getAudio = () => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    master = audioCtx.createGain();
    master.gain.value = 0.12;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return { ctx: audioCtx, out: master! };
};

const tone = (
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 1,
) => {
  const { ctx, out } = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + duration);
};

const comboFreq = (step: number) => {
  const octave = Math.floor(step / PENTATONIC.length);
  const semitone = PENTATONIC[step % PENTATONIC.length] + octave * 12;
  return 523.25 * 2 ** (semitone / 12);
};

/** 1px 置いたときのピコッ。コンボで音程が上がる */
export const playBlip = (combo: number) => {
  const now = performance.now();
  if (now - lastBlipAt < 35) return;
  lastBlipAt = now;
  const freq = comboFreq(Math.min(combo - 1, 14));
  tone(freq, 0, 0.09, "square", 0.6);
  tone(freq * 2, 0.03, 0.06, "triangle", 0.4);
};

/** コンボ節目のキュイーン */
export const playMilestone = (tier: number) => {
  for (let i = 0; i < 4 + tier; i++) {
    tone(comboFreq(i * 2 + tier), i * 0.05, 0.15, "square", 0.5);
  }
};

/** 確定時のファンファーレ */
export const playFanfare = (big: boolean) => {
  const notes = big
    ? [0, 4, 7, 12, 7, 12, 16, 19, 24]
    : [0, 4, 7, 12, 16];
  notes.forEach((n, i) =>
    tone(523.25 * 2 ** (n / 12), i * 0.08, 0.25, "square", 0.6),
  );
  const end = notes.length * 0.08;
  tone(523.25 * 2 ** (notes[notes.length - 1] / 12), end, 0.6, "sawtooth", 0.4);
};

export const closeAudio = () => {
  audioCtx?.close();
  audioCtx = null;
  master = null;
};

/** ハズレのブッ */
export const playMiss = () => {
  tone(110, 0, 0.18, "sawtooth", 0.5);
  tone(82.4, 0.06, 0.2, "sawtooth", 0.4);
};
