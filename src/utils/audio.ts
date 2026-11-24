let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export async function playEcoJingle(): Promise<{ played: boolean; blocked: boolean }> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return { played: false, blocked: true };

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return { played: false, blocked: true };
      }
    }

    if (ctx.state !== 'running') {
      return { played: false, blocked: true };
    }

    const now = ctx.currentTime;
    // Warm major-9th eco chime: C5, E5, G5, D6
    const notes = [
      { freq: 523.25, start: 0.0, duration: 0.36, gain: 0.14 },
      { freq: 659.25, start: 0.11, duration: 0.36, gain: 0.13 },
      { freq: 783.99, start: 0.22, duration: 0.42, gain: 0.14 },
      { freq: 1174.66, start: 0.34, duration: 0.65, gain: 0.11 },
    ];

    notes.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(freq * 2, now + start);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.08, now + start);

      gainNode.gain.setValueAtTime(0.0001, now + start);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.025);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gainNode);
      subOsc.connect(subGain);
      subGain.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      subOsc.start(now + start);
      osc.stop(now + start + duration + 0.04);
      subOsc.stop(now + start + duration + 0.04);
    });

    return { played: true, blocked: false };
  } catch {
    return { played: false, blocked: true };
  }
}

export async function playConfirmTone(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const tones = [
      { freq: 587.33, start: 0, duration: 0.18 },
      { freq: 880.0, start: 0.09, duration: 0.32 },
    ];
    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.09, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    });
  } catch {
    // Audio feedback is optional; fail silently
  }
}
