/**
 * Zen2048 - Procedural Web Audio Engine & Haptic Feedback
 * Generates all audio procedurally via Web Audio API. Zero external audio downloads.
 */

var ZenAudio = (function () {
  'use strict';

  var audioCtx = null;
  var soundEnabled = true;

  try {
    var stored = localStorage.getItem('zen2048_sound');
    if (stored !== null) {
      soundEnabled = stored === 'true';
    }
  } catch (e) {}

  function getContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function vibrate(ms) {
    try {
      if (soundEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms || 15);
      }
    } catch (e) {}
  }

  function playSlide() {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'sine';
    var now = ctx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
    vibrate(10);
  }

  function playMerge(value) {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    // Harmonic pitch calculation based on tile value:
    // 4 -> C5, 8 -> D5, 16 -> E5, 32 -> G5, 64 -> A5, 128 -> C6, 256 -> D6, etc.
    var baseFreq = 261.63; // C4
    var power = Math.round(Math.log2(value || 4));
    var freq = baseFreq * Math.pow(2, (power - 1) * 0.16);

    var now = ctx.currentTime;

    // Primary bell tone
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    // Harmonic overtone
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.5, now);

    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);

    vibrate(25);
  }

  function playUndo() {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
    vibrate(15);
  }

  function playWin() {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    var notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach(function (freq, index) {
      var now = ctx.currentTime + index * 0.12;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    });

    vibrate([40, 60, 40, 80]);
  }

  function playGameOver() {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    var notes = [293.66, 261.63, 220.00]; // D4, C4, A3
    notes.forEach(function (freq, index) {
      var now = ctx.currentTime + index * 0.16;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    });

    vibrate(50);
  }

  function playClick() {
    if (!soundEnabled) return;
    var ctx = getContext();
    if (!ctx) return;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
    vibrate(8);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem('zen2048_sound', String(soundEnabled));
    } catch (e) {}
    if (soundEnabled) {
      playClick();
    }
    return soundEnabled;
  }

  function isSoundEnabled() {
    return soundEnabled;
  }

  return {
    playSlide: playSlide,
    playMerge: playMerge,
    playUndo: playUndo,
    playWin: playWin,
    playGameOver: playGameOver,
    playClick: playClick,
    toggleSound: toggleSound,
    isSoundEnabled: isSoundEnabled
  };
})();

if (typeof window !== 'undefined') {
  window.ZenAudio = ZenAudio;
}
