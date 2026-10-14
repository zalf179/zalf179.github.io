import { FEATURES } from './config.js';

// Short generated UI tones keep the optional sound layer asset-free. AudioContext
// is created only in response to an explicit unmute or a later user action.
export function createAudioController() {
  const button = document.getElementById('audio-toggle');
  if (!button || !FEATURES.interactionAudio) {
    if (button) button.hidden = true;
    return { play() {}, dispose() {} };
  }

  let context = null;
  let master = null;
  let ambientOscillator = null;
  let muted = true;
  try { muted = localStorage.getItem('portfolio-muted') !== 'false'; } catch { /* storage may be blocked */ }

  function updateButton() {
    button.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    button.setAttribute('aria-label', muted ? 'Unmute interface sounds' : 'Mute interface sounds');
    button.setAttribute('aria-pressed', String(!muted));
  }
  function ensureAudio() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.65;
      master.connect(context.destination);
      if (FEATURES.ambientAudio) {
        ambientOscillator = context.createOscillator();
        const ambientGain = context.createGain();
        ambientOscillator.type = 'sine';
        ambientOscillator.frequency.value = 58;
        ambientGain.gain.value = 0.0025;
        ambientOscillator.connect(ambientGain);
        ambientGain.connect(master);
        ambientOscillator.start();
      }
    }
    if (context.state === 'suspended') context.resume();
    return true;
  }

  button.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('portfolio-muted', String(muted)); } catch { /* storage may be blocked */ }
    if (!muted) ensureAudio();
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.65, context.currentTime, 0.025);
    updateButton();
  });
  updateButton();

  function play(kind = 'click') {
    if (muted || !ensureAudio()) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const boot = kind === 'boot';
    osc.type = boot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(boot ? 220 : 650, now);
    osc.frequency.exponentialRampToValueAtTime(boot ? 440 : 480, now + (boot ? 0.24 : 0.045));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(boot ? 0.045 : 0.025, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (boot ? 0.32 : 0.075));
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + (boot ? 0.34 : 0.08));
  }

  return { play, dispose() { if (context) context.close(); } };
}
