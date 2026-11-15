let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playClickSound(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.05);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

export function playStampSound(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(720, now + 0.09);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

export function playLineSound(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, idx) => {
    const start = ctx.currentTime + idx * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

export function playWinSound(muted: boolean): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const fanfare = [523.25, 659.25, 783.99, 1046.5];
  fanfare.forEach((freq, idx) => {
    const start = ctx.currentTime + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.38);
  });
}
