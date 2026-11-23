class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    const saved = localStorage.getItem('ascii_photobooth_sound');
    this.enabled = saved !== null ? saved === 'true' : true;
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setSoundEnabled(val: boolean) {
    this.enabled = val;
    localStorage.setItem('ascii_photobooth_sound', String(val));
  }

  // Short terminal UI click
  public playKeyClick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {
      // AudioContext could fail on locked mobile before gesture
    }
  }

  // Countdown beep (3, 2, 1)
  public playCountdownBeep(high: boolean = false) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const freq = high ? 1760 : 880;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (high ? 0.25 : 0.12));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + (high ? 0.25 : 0.12));
    } catch {}
  }

  // Camera mechanical shutter sound
  public playShutterSound() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;

      // 1. Click phase
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(350, t);
      osc1.frequency.exponentialRampToValueAtTime(100, t + 0.06);

      gain1.gain.setValueAtTime(0.2, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.06);

      // 2. Clack phase (after 70ms)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(180, t + 0.07);
      osc2.frequency.exponentialRampToValueAtTime(60, t + 0.16);

      gain2.gain.setValueAtTime(0.25, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.16);
    } catch {}
  }

  // Retro printer mechanical sound
  public playPrintSound() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const stepTime = t + i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400 + i * 80, stepTime);

        gain.gain.setValueAtTime(0.05, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(stepTime);
        osc.stop(stepTime + 0.05);
      }
    } catch {}
  }
}

export const sound = new SoundEngine();
