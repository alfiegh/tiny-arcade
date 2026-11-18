// All sounds are synthesised — no audio files needed.
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = window.CONFIG.volume;
      // gentle limiter so lots of mashing never gets harsh
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(comp).connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  // In a plain browser audio needs a click/key first; Electron is configured to allow it.
  addEventListener('keydown', ctx, { once: true });
  addEventListener('pointerdown', ctx, { once: true });

  function tone(freq, { type = 'triangle', dur = 0.35, vol = 0.35, slideTo = null, delay = 0, attack = 0.005 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.15, vol = 0.3, type = 'highpass', freq = 2000, delay = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const src = a.createBufferSource(); src.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // Major pentatonic: any sequence of these sounds pleasant
  const PENTA = [0, 2, 4, 7, 9];
  const noteFreq = i => 261.63 * Math.pow(2, (PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)) / 12);

  // Richer voice: oscillator → optional filter, with optional vibrato
  function synth({ type = 'sawtooth', freq = 200, slideTo = null, dur = 0.5, vol = 0.3, delay = 0, filter = 'lowpass', cutoff = 1200, q = 1, vibRate = 0, vibDepth = 0, attack = 0.02 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (vibRate) {
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = vibRate; lg.gain.value = vibDepth;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    f.type = filter; f.frequency.value = cutoff; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // A continuous engine sound whose pitch follows speed. Call stop() when leaving!
  function engine() {
    const a = ctx(); if (!a) return { set() {}, stop() {} };
    const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = 45; o2.frequency.value = 22.5;
    f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 4;
    g.gain.value = 0.0001;
    const g2 = a.createGain(); g2.gain.value = 0.4;
    o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(master);
    o.start(); o2.start();
    let alive = true;
    return {
      set(speed, on = true) {
        if (!alive) return;
        const t = a.currentTime, s = Math.min(1, Math.abs(speed));
        o.frequency.setTargetAtTime(42 + s * 55, t, 0.1);
        o2.frequency.setTargetAtTime(21 + s * 27, t, 0.1);
        f.frequency.setTargetAtTime(300 + s * 500, t, 0.1);
        g.gain.setTargetAtTime(on ? 0.07 + s * 0.08 : 0.0001, t, 0.15);
      },
      stop() {
        if (!alive) return; alive = false;
        const t = a.currentTime;
        g.gain.setTargetAtTime(0.0001, t, 0.05);
        o.stop(t + 0.3); o2.stop(t + 0.3);
      },
    };
  }

  let speakTimer = 0;
  return {
    synth, engine,
    roar() {
      synth({ type: 'sawtooth', freq: 190, slideTo: 70, dur: 1.1, vol: 0.45, cutoff: 900, q: 3, vibRate: 18, vibDepth: 14 });
      synth({ type: 'square', freq: 95, slideTo: 45, dur: 1.1, vol: 0.25, cutoff: 500, vibRate: 11, vibDepth: 6 });
      noise({ dur: 0.9, vol: 0.25, type: 'bandpass', freq: 700 });
    },
    sneeze() {
      synth({ type: 'triangle', freq: 280, slideTo: 520, dur: 0.55, vol: 0.18, cutoff: 3000 });
      noise({ dur: 0.3, vol: 0.6, type: 'bandpass', freq: 3200, delay: 0.62 });
      synth({ type: 'square', freq: 700, slideTo: 300, dur: 0.2, vol: 0.12, cutoff: 2500, delay: 0.62 });
    },
    boing() { tone(160, { type: 'sine', dur: 0.32, vol: 0.4, slideTo: 640 }); },
    stomp() { tone(120, { type: 'sine', dur: 0.35, vol: 0.8, slideTo: 38 }); noise({ dur: 0.2, vol: 0.3, type: 'lowpass', freq: 400 }); },
    horn() {
      [0, 0.26].forEach(d => {
        synth({ type: 'square', freq: 440, dur: 0.2, vol: 0.22, cutoff: 1800, delay: d, attack: 0.01 });
        synth({ type: 'square', freq: 554, dur: 0.2, vol: 0.18, cutoff: 1800, delay: d, attack: 0.01 });
      });
    },
    tick() { synth({ type: 'square', freq: 1800, dur: 0.03, vol: 0.12, cutoff: 5000, attack: 0.002 }); },
    servo() { synth({ type: 'sawtooth', freq: 180, slideTo: 320, dur: 0.6, vol: 0.08, cutoff: 900, vibRate: 30, vibDepth: 8 }); },
    moo() { synth({ type: 'sawtooth', freq: 150, slideTo: 115, dur: 1.0, vol: 0.3, cutoff: 650, q: 4, vibRate: 5, vibDepth: 4, attack: 0.12 }); },
    baa() { synth({ type: 'sawtooth', freq: 420, slideTo: 380, dur: 0.7, vol: 0.2, cutoff: 1600, q: 5, vibRate: 8, vibDepth: 30, attack: 0.05 }); },
    cluck() { [0, 0.12, 0.2].forEach(d => synth({ type: 'square', freq: 820, slideTo: 520, dur: 0.07, vol: 0.12, cutoff: 2400, delay: d, attack: 0.005 })); },
    firework() {
      tone(300, { type: 'sine', dur: 0.4, vol: 0.2, slideTo: 1400 });
      noise({ dur: 0.5, vol: 0.45, type: 'lowpass', freq: 900, delay: 0.35 });
      for (let i = 0; i < 8; i++) noise({ dur: 0.04, vol: 0.2, freq: 6000, delay: 0.45 + Math.random() * 0.5 });
    },
    melody(steps = [0, 2, 4, 5, 7, 5, 4, 2], gap = 0.13, base = 5) {
      steps.forEach((n, k) => tone(noteFreq(n + base), { dur: 0.22, vol: 0.2, delay: k * gap }));
    },
    chime() { [0, 4, 7].forEach((n, k) => tone(noteFreq(n + 8), { type: 'sine', dur: 0.4, vol: 0.15, delay: k * 0.07 })); },
    unlock: ctx,
    note(i, opts = {}) { tone(noteFreq(i), { dur: 0.45, vol: 0.28, ...opts }); },
    pop() { noise({ dur: 0.08, vol: 0.5, freq: 1200 }); tone(700, { type: 'sine', dur: 0.12, vol: 0.35, slideTo: 180 }); },
    boop() { tone(320, { type: 'sine', dur: 0.15, vol: 0.2, slideTo: 260 }); },
    bubble() { tone(U.rand(500, 900), { type: 'sine', dur: 0.12, vol: 0.18, slideTo: U.rand(1200, 1800) }); },
    sparkle() { [0, 0.06, 0.12].forEach((d, k) => tone(1200 + k * 400, { type: 'sine', dur: 0.2, vol: 0.12, delay: d })); },
    whoosh() { noise({ dur: 0.35, vol: 0.18, type: 'bandpass', freq: 900 }); },
    cheer() { [0, 2, 4, 5, 7].forEach((n, k) => tone(noteFreq(n + 5), { dur: 0.3, vol: 0.22, delay: k * 0.08 })); },
    drum(kind) {
      switch (kind) {
        case 'kick': tone(150, { type: 'sine', dur: 0.4, vol: 0.9, slideTo: 40 }); break;
        case 'clap': noise({ dur: 0.18, vol: 0.6, type: 'bandpass', freq: 1500 }); noise({ dur: 0.12, vol: 0.4, type: 'bandpass', freq: 1500, delay: 0.02 }); break;
        case 'hat': noise({ dur: 0.07, vol: 0.35, freq: 7000 }); break;
        case 'bell': [1, 2.76, 5.4].forEach((m, k) => tone(523 * m, { type: 'sine', dur: 1.0 - k * 0.25, vol: 0.18 / (k + 1) })); break;
        case 'cymbal': noise({ dur: 0.8, vol: 0.3, freq: 5000 }); break;
        case 'tom': tone(220, { type: 'sine', dur: 0.35, vol: 0.6, slideTo: 110 }); break;
      }
    },
    speak(text, { force = false } = {}) {
      if (!window.CONFIG.voice || !window.speechSynthesis) return;
      const now = performance.now();
      if (!force && now < speakTimer) return;          // don't chatter
      speakTimer = now + 1500;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = window.CONFIG.voiceLang; u.rate = 0.95; u.pitch = 1.25; u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* no voices */ }
    },
  };
})();
