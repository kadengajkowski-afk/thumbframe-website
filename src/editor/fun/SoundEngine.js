let ctx = null;
let enabled = false;
let volume = 0.3;

export function initSoundEngine() {
  window.addEventListener('pointerdown', () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { /* ignore */ }
    }
  }, { once: true });
}

export function loadSoundPreferences() {
  const savedEnabled = localStorage.getItem('tf_sound_enabled');
  const savedVolume = localStorage.getItem('tf_sound_volume');
  if (savedEnabled !== null) enabled = savedEnabled === 'true';
  if (savedVolume !== null) volume = parseFloat(savedVolume);
}

export function setSoundEnabled(bool) {
  enabled = bool;
  localStorage.setItem('tf_sound_enabled', bool);
}

export function setSoundVolume(v) {
  volume = v;
  localStorage.setItem('tf_sound_volume', v);
}

export function isSoundEnabled() {
  return enabled;
}

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone(freq, type, duration, startVol) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(startVol * volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch { /* ignore */ }
}

export function playClick() {
  if (!enabled || !ctx) return;
  playTone(800, 'square', 0.06, 0.15);
}

export function playPop() {
  if (!enabled || !ctx) return;
  playTone(600, 'sine', 0.12, 0.2);
}

export function playWhoosh() {
  if (!enabled || !ctx) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15 * volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.3);
  } catch { /* ignore */ }
}

export function playSuccess() {
  if (!enabled || !ctx) return;
  try {
    const c = getCtx();
    const freqs = [523, 659, 784];
    freqs.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.05);
      gain.gain.setValueAtTime(0.12 * volume, c.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.05 + 0.4);
      osc.start(c.currentTime + i * 0.05);
      osc.stop(c.currentTime + i * 0.05 + 0.4);
    });
  } catch { /* ignore */ }
}

export function playRewind() {
  if (!enabled || !ctx) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1 * volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.2);
  } catch { /* ignore */ }
}

export function playAchievement() {
  if (!enabled || !ctx) return;
  try {
    const c = getCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.15 * volume, c.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.1 + 0.15);
      osc.start(c.currentTime + i * 0.1);
      osc.stop(c.currentTime + i * 0.1 + 0.15);
    });
  } catch { /* ignore */ }
}

export function playDelete() {
  if (!enabled || !ctx) return;
  playTone(150, 'triangle', 0.2, 0.2);
}

export function playLevelUp() {
  if (!enabled || !ctx) return;
  try {
    const c = getCtx();
    const chords = [
      [523, 659, 784],
      [587, 740, 880],
      [659, 831, 988],
    ];
    chords.forEach((chord, ci) => {
      chord.forEach((freq) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, c.currentTime + ci * 0.3);
        gain.gain.setValueAtTime(0.1 * volume, c.currentTime + ci * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ci * 0.3 + 0.3);
        osc.start(c.currentTime + ci * 0.3);
        osc.stop(c.currentTime + ci * 0.3 + 0.3);
      });
    });
  } catch { /* ignore */ }
}
