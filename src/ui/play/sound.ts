// UI V3 (U2): every sound is synthesized with the Web Audio API (no audio files). Sound starts after the
// player's first tap (browsers need a gesture), stays moderate, never loops, and the mute button in the
// top bar is remembered in this browser (try/catch: blocked storage just means sound is on next time).
// Haptics: navigator.vibrate on stamps and wheel hits where supported; off with reduced motion.

export type Sfx =
  | 'tap'
  | 'lock'
  | 'pop'
  | 'tick'
  | 'safe'
  | 'hit'
  | 'gain'
  | 'loss'
  | 'stamp'
  | 'sting'
  | 'fanfare'
  | 'finale';

const KEY = 'veil.play.muted';
const VOLUME = 0.18;

let ctx: AudioContext | null = null;
let unlocked = false;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  listeners.forEach((f) => f(m));
}

export function onMuted(f: (m: boolean) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Called on the first tap anywhere: creates the audio context inside a user gesture. */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  } catch {
    ctx = null;
  }
}

if (typeof window !== 'undefined') {
  const first = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', first, true);
    window.removeEventListener('keydown', first, true);
  };
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 1, slideTo?: number): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(VOLUME * gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(at: number, dur: number, gain = 1, lowpass = 900): void {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = VOLUME * gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(at);
}

/** Play one effect now (or `delay` seconds from now). Silent when muted or before the first tap. */
export function sfx(name: Sfx, delay = 0): void {
  if (muted || !ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const n = ctx.currentTime + delay;
    switch (name) {
      case 'tap':
        tone(660, n, 0.05, 'triangle', 0.5);
        break;
      case 'lock':
        tone(520, n, 0.08, 'square', 0.4);
        tone(780, n + 0.07, 0.12, 'square', 0.4);
        break;
      case 'pop':
        tone(900, n, 0.07, 'sine', 0.7, 1400);
        break;
      case 'tick':
        tone(1800, n, 0.02, 'square', 0.3);
        break;
      case 'safe':
        tone(784, n, 0.18, 'sine', 0.8);
        tone(1047, n + 0.12, 0.3, 'sine', 0.8);
        break;
      case 'hit':
        tone(140, n, 0.35, 'sawtooth', 0.9, 50);
        noise(n, 0.25, 0.9, 500);
        break;
      case 'gain':
        [988, 1319].forEach((f, i) => tone(f, n + i * 0.07, 0.12, 'triangle', 0.6));
        break;
      case 'loss':
        tone(392, n, 0.15, 'triangle', 0.6, 330);
        tone(311, n + 0.12, 0.22, 'triangle', 0.6, 262);
        break;
      case 'stamp':
        noise(n, 0.12, 1.2, 300);
        tone(90, n, 0.12, 'sine', 1);
        break;
      case 'sting':
        [440, 554, 659, 880].forEach((f, i) => tone(f, n + i * 0.05, 0.12, 'sawtooth', 0.35));
        break;
      case 'fanfare':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, n + i * 0.12, i === 3 ? 0.5 : 0.14, 'triangle', 0.7));
        break;
      case 'finale':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, n + i * 0.13, i === 5 ? 0.9 : 0.16, 'triangle', 0.75));
        tone(262, n + 0.65, 0.9, 'sine', 0.5);
        break;
    }
  } catch {
    // Audio failed: the game goes on in silence.
  }
}

/** A short vibration where supported (the caller checks reduced motion). */
export function buzz(ms: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    // No vibration here.
  }
}
