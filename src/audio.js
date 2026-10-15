/**
 * Zen2048 - Procedural Web Audio sound effects + haptics.
 * Every sound is synthesised on-device with the Web Audio API: no audio files, no CDN.
 */
var ZenAudio = (function () {
  'use strict';

  var KEY_SOUND = 'zen2048_sound';
  var KEY_HAPTICS = 'zen2048_haptics';
  var audioCtx = null;
  var soundEnabled = true;
  var hapticsEnabled = true;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  function getContext() {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      var Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!Ctx) return null;
      try { audioCtx = new Ctx(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      audioCtx.resume().catch(function () { /* needs a user gesture */ });
    }
    return audioCtx;
  }

  function vibrate(pattern) {
    if (!hapticsEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch (e) { /* not supported */ }
  }

  /** One enveloped oscillator note. */
  function tone(ctx, opts) {
    var t0 = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol || 0.1, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  var api = {
    init: function () {
      var s = read(KEY_SOUND);
      soundEnabled = !(s === '0' || s === 'false');
      hapticsEnabled = read(KEY_HAPTICS) !== '0';
      var unlock = function () {
        getContext();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', unlock);
        document.addEventListener('keydown', unlock);
      }
    },
    isSoundEnabled: function () { return soundEnabled; },
    setSoundEnabled: function (on) {
      soundEnabled = !!on;
      write(KEY_SOUND, soundEnabled ? '1' : '0');
      if (!soundEnabled && audioCtx && typeof audioCtx.suspend === 'function') {
        audioCtx.suspend().catch(function () {});
      }
    },
    isHapticsEnabled: function () { return hapticsEnabled; },
    setHapticsEnabled: function (on) {
      hapticsEnabled = !!on;
      write(KEY_HAPTICS, hapticsEnabled ? '1' : '0');
    },
    vibrate: vibrate,

    playClick: function () {
      var ctx = getContext();
      if (ctx) tone(ctx, { freq: 640, to: 260, dur: 0.04, vol: 0.05 });
      vibrate(6);
    },
    playSlide: function () {
      var ctx = getContext();
      if (ctx) tone(ctx, { freq: 150, to: 85, dur: 0.08, vol: 0.07 });
      vibrate(8);
    },
    playMerge: function (value) {
      var ctx = getContext();
      if (ctx) {
        // Pitch climbs a pentatonic ladder as tiles grow.
        var ladder = [0, 2, 4, 7, 9];
        var step = Math.max(0, Math.round(Math.log2(value || 4)) - 2);
        var semis = Math.floor(step / 5) * 12 + ladder[step % 5];
        var freq = 329.63 * Math.pow(2, semis / 12);
        tone(ctx, { freq: freq, dur: 0.22, vol: 0.16, type: 'triangle' });
        tone(ctx, { freq: freq * 1.5, dur: 0.18, vol: 0.06 });
      }
      vibrate(value >= 512 ? 30 : 16);
    },
    playUndo: function () {
      var ctx = getContext();
      if (ctx) tone(ctx, { freq: 300, to: 180, dur: 0.12, vol: 0.09 });
      vibrate(10);
    },
    playBlocked: function () {
      var ctx = getContext();
      if (ctx) tone(ctx, { freq: 110, dur: 0.07, vol: 0.05, type: 'square' });
    },
    playPause: function () {
      var ctx = getContext();
      if (ctx) {
        tone(ctx, { freq: 523.25, dur: 0.1, vol: 0.07 });
        tone(ctx, { freq: 392, dur: 0.14, vol: 0.07, delay: 0.08 });
      }
    },
    playWin: function () {
      var ctx = getContext();
      if (ctx) {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone(ctx, { freq: f, dur: 0.36, vol: 0.18, type: 'triangle', delay: i * 0.11 });
        });
      }
      vibrate([30, 50, 30, 50, 60]);
    },
    playGameOver: function () {
      var ctx = getContext();
      if (ctx) {
        [293.66, 261.63, 220].forEach(function (f, i) {
          tone(ctx, { freq: f, dur: 0.3, vol: 0.14, delay: i * 0.16 });
        });
      }
      vibrate([60, 40, 60]);
    }
  };
  return api;
})();

if (typeof window !== 'undefined') window.ZenAudio = ZenAudio;
