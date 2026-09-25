/**
 * Синтезированные звуковые эффекты на WebAudio — без аудиофайлов и
 * сетевых запросов. AudioContext разблокируется первым жестом игрока.
 */
import { TIMING } from './game/config';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private spinOsc: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private riser: { osc: OscillatorNode; gain: GainNode } | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  /** Вызывается на первый pointerdown/keydown. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Буфер белого шума для щелчков/вжухов
      const len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      // Аудио недоступно — игра работает без звука
      this.ctx = null;
    }
  }

  private ready(): boolean {
    return this.ctx !== null && this.master !== null && this.ctx.state === 'running';
  }

  /** Короткий шумовой всплеск через фильтр. */
  private noiseBurst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ready() || !this.noiseBuffer || !this.ctx || !this.master) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Тон с огибающей. */
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    const t = this.ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  uiClick(): void {
    this.noiseBurst(0.06, 2600, 0.25);
    this.tone(660, 0.05, 0.06, 'triangle');
  }

  spinStart(): void {
    this.noiseBurst(0.35, 900, 0.18, 'lowpass');
    this.tone(140, 0.3, 0.1, 'sawtooth', 0, 90);
    if (!this.ready() || !this.ctx || !this.master) return;
    this.stopSpinHum();
    // Низкий гул прокрутки
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    lfo.frequency.value = 9;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.value = 0.045;
    osc.connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    this.spinOsc = { osc, gain, lfo };
  }

  stopSpinHum(): void {
    if (this.spinOsc && this.ctx) {
      const { osc, gain, lfo } = this.spinOsc;
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      osc.stop(this.ctx.currentTime + 0.2);
      lfo.stop(this.ctx.currentTime + 0.2);
      this.spinOsc = null;
    }
  }

  reelStop(index: number): void {
    // Щелчок с небольшим варьированием высоты по номеру барабана
    this.noiseBurst(0.05, 1800 + index * 250, 0.3);
    this.tone(170 - index * 9, 0.09, 0.16, 'square');
  }

  anticipation(on: boolean): void {
    if (!this.ready() || !this.ctx || !this.master) return;
    if (on && !this.riser) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.09, this.ctx.currentTime, 0.3);
      osc.frequency.linearRampToValueAtTime(520, this.ctx.currentTime + TIMING.anticipationMaxMs / 1000);
      osc.connect(gain).connect(this.master);
      osc.start();
      this.riser = { osc, gain };
    } else if (!on && this.riser) {
      const { osc, gain } = this.riser;
      gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.05);
      osc.stop(this.ctx!.currentTime + 0.25);
      this.riser = null;
    }
  }

  winTick(): void {
    this.tone(950 + Math.random() * 250, 0.045, 0.05, 'square');
  }

  coin(): void {
    this.tone(1760, 0.1, 0.05, 'triangle');
    this.tone(2350, 0.14, 0.04, 'triangle', 0.03);
  }

  /** Фанфары выигрыша: size 0 = малый, 1 = big, 2 = mega/divine. */
  winFanfare(size: number): void {
    const base = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const n = size === 0 ? 3 : size === 1 ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const f = base[i % 4] * (i >= 4 ? 2 : 1);
      this.tone(f, 0.32, 0.12, 'triangle', i * 0.09);
      if (size > 0) this.tone(f / 2, 0.32, 0.07, 'sine', i * 0.09);
    }
  }

  bigWinSparkle(): void {
    this.tone(1400 + Math.random() * 1600, 0.18, 0.035, 'sine');
  }
}

export const audio = new AudioEngine();
