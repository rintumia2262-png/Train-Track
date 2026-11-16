/**
 * Procedural Web Audio synthesizer for BD Train Track ("শব্দ চালু" feature).
 * Synthesizes rhythmic railway track clacks, low diesel-electric rumble, and Bangladesh dual-tone horn.
 */
export class TrainAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private clackTimer: number | null = null;
  private enabled = false;

  public setEnabled(enable: boolean, speedKmh = 40): void {
    this.enabled = enable;
    if (!enable) {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      if (this.clackTimer !== null) {
        window.clearInterval(this.clackTimer);
        this.clackTimer = null;
      }
      return;
    }

    this.initContext();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.08);
    }
    this.playHorn();
    this.startClackLoop(speedKmh);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 135;

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.value = 0.28;

      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'sawtooth';
      this.rumbleOsc.frequency.value = 46;

      this.rumbleOsc.connect(filter);
      filter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.masterGain);
      this.rumbleOsc.start();
    } catch {
      // Ignore audio block
    }
  }

  private startClackLoop(speedKmh: number): void {
    if (this.clackTimer !== null) {
      window.clearInterval(this.clackTimer);
    }
    const intervalMs = Math.max(420, Math.min(1300, 32000 / Math.max(15, speedKmh)));
    this.clackTimer = window.setInterval(() => {
      if (!this.enabled) return;
      this.playTrackClack();
    }, intervalMs);
  }

  private playTrackClack(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [0, 0.14].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145, now + offset);
      osc.frequency.exponentialRampToValueAtTime(52, now + offset + 0.06);

      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  public playHorn(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [277.18, 349.23]; // Dual-tone diesel locomotive horn

    freqs.forEach((f) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);

      filter.type = 'lowpass';
      filter.frequency.value = 950;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gain.gain.setValueAtTime(0.12, now + 0.48);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    });
  }

  public dispose(): void {
    if (this.clackTimer !== null) {
      window.clearInterval(this.clackTimer);
      this.clackTimer = null;
    }
    try {
      this.rumbleOsc?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
