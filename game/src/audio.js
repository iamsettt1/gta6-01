// Synthesised sound only: no audio files. Engine hum, sirens, gunshots,
// pickup blips, a mission jingle and a light music bed, all built from
// oscillators and filtered noise in the Web Audio API.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startEngine();
      this.startMusic();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) {
      this.ctx.suspend();
      if (!muted) this.ctx.resume();
    }
  }

  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  // speedRatio 0..1 while driving; 0 and the hum fades out.
  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.02 + speedRatio * 0.05 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 90, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.018;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + dur);
  }

  playEvent(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shot':
        this.noise(0.14, 0.25, 2400);
        this.blip(180, 0.08, 'square', 0.06);
        break;
      case 'dryfire':
        this.blip(900, 0.05, 'square', 0.04);
        break;
      case 'crash':
        this.noise(0.25, 0.2, 700);
        break;
      case 'thud':
        this.noise(0.15, 0.18, 400);
        break;
      case 'pickup':
        this.blip(660, 0.09, 'sine', 0.09);
        setTimeout(() => this.blip(990, 0.12, 'sine', 0.09), 70);
        break;
      case 'reload':
        this.blip(440, 0.05, 'square', 0.05);
        setTimeout(() => this.blip(550, 0.05, 'square', 0.05), 90);
        break;
      case 'jingle': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.1), i * 130));
        break;
      }
      case 'fail': {
        const notes = [392, 330, 262];
        notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.25, 'sawtooth', 0.05), i * 160));
        break;
      }
      default:
        break;
    }
  }

  // A slow, sunny bass-and-pluck loop: C major pentatonic walking bass with a
  // soft pluck on top, scheduled a bar ahead so it never gaps.
  startMusic() {
    const bass = [130.8, 98, 110, 146.8];
    const pluck = [523.25, 587.33, 659.25, 783.99, 880];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep % 8;
      const bar = Math.floor(this.musicStep / 8) % 4;
      if (step % 2 === 0) this.blip(bass[bar], 0.5, 'triangle', 0.045);
      if (step === 1 || step === 5) this.blip(pluck[(this.musicStep * 3) % pluck.length], 0.18, 'sine', 0.03);
      this.musicStep += 1;
    }, 300);
  }
}
