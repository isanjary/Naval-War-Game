import Phaser from 'phaser';

// Procedural sound generation using Web Audio API
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.5;
  private sfxVolume = 0.7;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    void scene;
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  }

  private ensureContext(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Cannon fire sound - low boom
  public playCannonFire(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Main boom oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(this.sfxVolume * this.masterVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    // Add noise burst for impact
    this.playNoiseBurst(0.1, 0.05);
  }

  // Bullet hit sound - short thud
  public playHit(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(this.sfxVolume * this.masterVolume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Explosion sound - big boom with decay
  public playExplosion(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Low frequency boom
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    gain1.gain.setValueAtTime(this.sfxVolume * this.masterVolume * 0.8, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    // Add noise for texture
    this.playNoiseBurst(0.4, 0.3);
  }

  // Level up sound - ascending tones
  public playLevelUp(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(this.sfxVolume * this.masterVolume * 0.3, now + i * 0.1 + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.25);
    });
  }

  // Death sound - descending sad tone
  public playDeath(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    gain.gain.setValueAtTime(this.sfxVolume * this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  // Engine hum - continuous low drone
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  public startEngine(): void {
    if (!this.enabled || !this.audioContext || this.engineOsc) return;
    this.ensureContext();

    const ctx = this.audioContext;

    this.engineOsc = ctx.createOscillator();
    this.engineGain = ctx.createGain();

    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.setValueAtTime(60, ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0, ctx.currentTime);

    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);

    this.engineOsc.start();
  }

  public updateEngine(thrusting: boolean): void {
    if (!this.engineGain || !this.audioContext) return;

    const targetVolume = thrusting ? this.sfxVolume * this.masterVolume * 0.15 : 0.02;
    this.engineGain.gain.linearRampToValueAtTime(targetVolume, this.audioContext.currentTime + 0.1);
  }

  public stopEngine(): void {
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Noise burst helper for texture
  private playNoiseBurst(duration: number, volume: number): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();

    noise.buffer = buffer;
    gain.gain.setValueAtTime(volume * this.sfxVolume * this.masterVolume, now);

    noise.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
  }

  // UI click sound
  public playClick(): void {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(this.sfxVolume * this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Settings
  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopEngine();
    }
  }

  public destroy(): void {
    this.stopEngine();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
