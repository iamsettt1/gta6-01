// Synthesized sound: no audio files, everything is WebAudio oscillators and noise.
// Engine hum follows the driven car's speed, the siren wails while the player is
// wanted, and gunshots, punches, pickups and cash blips are short bursts. A
// mellow bass-and-hat loop plays under it all. Nothing is created until the
// first user gesture (browsers block audio before that); in screenshot mode the
// game never gestures, so it stays silent there.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that sweeps between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      startMusic();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A lazy bassline in A minor with a hat tick: 8 steps a bar, 100 BPM.
  const BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
  function startMusic() {
    if (musicTimer !== null || !ctx) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      if (note > 0) tone(note, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
      musicStep += 1;
    }, 300);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    isMuted() {
      return muted;
    },
    engine(speedRatio, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + 0.1 * speedRatio : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + 130 * speedRatio, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx || muted) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 900);
      tone(140, 0.08, 'square', 0.2, 60);
    },
    punch() {
      noiseBurst(0.08, 0.3, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      window.setTimeout(() => tone(990, 0.12, 'sine', 0.25), 90);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.22);
      window.setTimeout(() => tone(1174, 0.1, 'sine', 0.22), 80);
      window.setTimeout(() => tone(1568, 0.14, 'sine', 0.22), 160);
    },
    crash() {
      noiseBurst(0.25, 0.45, 400);
    },
    busted() {
      tone(392, 0.25, 'sawtooth', 0.2, 196);
      window.setTimeout(() => tone(311, 0.4, 'sawtooth', 0.2, 155), 260);
    },
    missionDone() {
      tone(523, 0.12, 'sine', 0.25);
      window.setTimeout(() => tone(659, 0.12, 'sine', 0.25), 120);
      window.setTimeout(() => tone(784, 0.22, 'sine', 0.25), 240);
    },
  };
}
