/**
 * Zen2048 - UI controller: menu, Journey/Classic sessions, rendering with
 * slide animations, input (swipe / mouse drag / keyboard), pause, results,
 * settings, statistics and local persistence.
 */
(function () {
  'use strict';

  var Logic = window.Zen2048Logic;
  var Audio = window.ZenAudio;
  var Ads = window.ZenAds || { init: function () {}, onGameFinished: function () {} };

  var KEYS = {
    stats: 'zen2048_stats',
    progress: 'zen2048_progress',
    saved: 'zen2048_saved_v2',
    legacySaved: 'zen2048_saved_game',
    theme: 'zen2048_theme',
    anim: 'zen2048_anim'
  };
  var THEMES = ['dark', 'sunset', 'light'];
  var THEME_COLORS = { dark: '#0f172a', sunset: '#1c1917', light: '#f8fafc' };
  var JOURNEY = Logic.JOURNEY;
  var JOURNEY_UNDOS = 3;
  var SLIDE_MS = 110;

  function $(id) { return document.getElementById(id); }

  // DOM
  var boardContainer = $('board-container');
  var gridBg = $('grid-bg');
  var tileLayer = $('tile-layer');
  var scoreEl = $('current-score');
  var bestEl = $('best-score');
  var movesLabelEl = $('moves-label');
  var movesEl = $('moves-value');
  var scoreSlot = $('score-addition-slot');
  var modeLabel = $('mode-label');
  var goalLabel = $('goal-label');
  var undoBtn = $('undo-btn');
  var undoText = $('undo-text');
  var restartBtn = $('restart-btn');
  var soundToggleBtn = $('sound-toggle');
  var menuScreen = $('menu-screen');
  var toastEl = $('toast');
  var pauseModal = $('pause-modal');
  var resultModal = $('result-modal');
  var settingsModal = $('settings-modal');
  var journeyModal = $('journey-modal');
  var statsModal = $('stats-modal');
  var helpModal = $('help-modal');

  // State
  var game = null;
  var session = { mode: 'classic', size: 4 };
  var elapsed = 0;
  var paused = false;
  var roundFinished = false; // journey stage cleared or board lost and acknowledged
  var roundCounted = false;
  var roundReported = false;
  var animEnabled = true;
  var currentTheme = 'dark';
  var pendingAnim = null;
  var timerId = null;
  var toastTimer = null;
  var restartArmed = false;
  var restartTimer = null;
  var resetArmed = false;
  var modalStack = [];

  // ---------- Storage ----------
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/disabled */ }
  }
  function removeKey(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function getStats() {
    var s = readJSON(KEYS.stats, {});
    return {
      played: s.played || 0,
      won: s.won || 0,
      highestTile: s.highestTile || 0,
      totalScore: s.totalScore || 0,
      bestScores: s.bestScores && typeof s.bestScores === 'object' ? s.bestScores : {}
    };
  }
  function getProgress() {
    var p = readJSON(KEYS.progress, {});
    return {
      unlocked: Math.max(1, Math.min(JOURNEY.length, p.unlocked || 1)),
      stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      bestScores: p.bestScores && typeof p.bestScores === 'object' ? p.bestScores : {},
      bestMoves: p.bestMoves && typeof p.bestMoves === 'object' ? p.bestMoves : {}
    };
  }
  function totalStars(progress) {
    var t = 0;
    Object.keys(progress.stars).forEach(function (k) { t += progress.stars[k] || 0; });
    return t;
  }
  function clearedCount(progress) {
    return Object.keys(progress.stars).filter(function (k) { return progress.stars[k] > 0; }).length;
  }

  function saveCurrentGame() {
    if (!game) return;
    if (roundFinished || game.moves === 0) { removeKey(KEYS.saved); return; }
    writeJSON(KEYS.saved, {
      session: session,
      elapsed: elapsed,
      counted: roundCounted,
      game: JSON.parse(Logic.serialize(game))
    });
  }
  function loadSavedGame() {
    var data = readJSON(KEYS.saved, null);
    if (!data) {
      // Migrate a board saved by v1.0
      var legacy = null;
      try { legacy = localStorage.getItem(KEYS.legacySaved); } catch (e) { legacy = null; }
      if (legacy) {
        var g = Logic.deserialize(legacy);
        removeKey(KEYS.legacySaved);
        if (g && !g.isGameOver) {
          return { session: { mode: 'classic', size: g.size }, elapsed: 0, counted: true, game: g };
        }
      }
      return null;
    }
    var restored = Logic.deserialize(data.game);
    var sess = data.session || {};
    if (!restored) return null;
    if (sess.mode === 'journey') {
      var st = parseInt(sess.stage, 10);
      if (!(st >= 1 && st <= JOURNEY.length)) return null;
      sess = { mode: 'journey', stage: st };
    } else {
      sess = { mode: 'classic', size: restored.size };
    }
    return { session: sess, elapsed: data.elapsed || 0, counted: !!data.counted, game: restored };
  }

  // ---------- Helpers ----------
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function formatTime(total) {
    total = Math.max(0, Math.floor(total || 0));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function currentLevel() {
    return session.mode === 'journey' ? JOURNEY[session.stage - 1] : null;
  }
  function sessionDef(sess) {
    if (sess.mode === 'journey') {
      var lv = JOURNEY[sess.stage - 1];
      return { size: lv.size, target: lv.target, stones: lv.stones, moveLimit: lv.moveLimit, undoLimit: JOURNEY_UNDOS };
    }
    var c = Logic.CLASSIC[sess.size] || Logic.CLASSIC[4];
    return { size: c.size, target: c.target };
  }
  function sessionLabel(sess) {
    if (sess.mode === 'journey') {
      var lv = JOURNEY[sess.stage - 1];
      return 'Stage ' + sess.stage + ' · ' + lv.size + '×' + lv.size;
    }
    return (Logic.CLASSIC[sess.size] || Logic.CLASSIC[4]).name;
  }
  function bestFor(sess) {
    if (sess.mode === 'journey') return getProgress().bestScores[sess.stage] || 0;
    return getStats().bestScores[sess.size] || 0;
  }
  function isGameScreen() { return !menuScreen.classList.contains('open'); }
  function inputBlocked() {
    return !game || paused || !isGameScreen() || modalStack.length > 0 || roundFinished || game.isGameOver;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }
  function announce(msg) { $('sr-status').textContent = msg; }

  // ---------- Timer ----------
  function startTimer() {
    if (timerId) return;
    timerId = setInterval(function () {
      if (game && !paused && isGameScreen() && !roundFinished && !game.isGameOver &&
          !resultModal.classList.contains('open') && !document.hidden && game.moves > 0) {
        elapsed++;
        if (elapsed % 10 === 0) saveCurrentGame();
      }
    }, 1000);
  }

  // ---------- Rendering ----------
  function buildBoard() {
    var n = game.size;
    boardContainer.style.setProperty('--n', n);
    boardContainer.classList.toggle('size-6', n === 6);
    gridBg.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = document.createElement('div');
        cell.className = 'grid-cell' + (game.grid[r][c] === Logic.STONE ? ' stone' : '');
        frag.appendChild(cell);
      }
    }
    gridBg.appendChild(frag);
    measureBoard();
  }

  function measureBoard() {
    if (!game) return;
    var w = tileLayer.clientWidth;
    if (!w) return;
    var gap = parseFloat(getComputedStyle(boardContainer).getPropertyValue('--gap')) || 8;
    var cell = (w - (game.size - 1) * gap) / game.size;
    boardContainer.style.setProperty('--cell-px', cell.toFixed(1) + 'px');
  }

  function tileClass(v) {
    return v <= 2048 ? 'tile-' + v : 'tile-super';
  }

  function makeTile(r, c, v, extra) {
    var el = document.createElement('div');
    el.className = 'tile';
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
    var inner = document.createElement('div');
    inner.className = 'tile-inner ' + tileClass(v) + (extra ? ' ' + extra : '');
    inner.setAttribute('data-digits', String(v).length);
    inner.textContent = v;
    el.appendChild(inner);
    el._key = r + '-' + c;
    return el;
  }

  function renderTiles(merges, spawned) {
    var mergeMap = {};
    (merges || []).forEach(function (m) { mergeMap[m.r + '-' + m.c] = true; });
    tileLayer.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var r = 0; r < game.size; r++) {
      for (var c = 0; c < game.size; c++) {
        var v = game.grid[r][c];
        if (v > 0) {
          var key = r + '-' + c;
          var extra = mergeMap[key] ? 'tile-merged' : (spawned && spawned.r === r && spawned.c === c ? 'tile-new' : '');
          frag.appendChild(makeTile(r, c, v, extra));
        }
      }
    }
    tileLayer.appendChild(frag);
  }

  function flushAnimation() {
    if (pendingAnim) {
      clearTimeout(pendingAnim.timer);
      var p = pendingAnim;
      pendingAnim = null;
      renderTiles(p.merges, p.spawned);
    }
  }

  function animateMove(res) {
    if (!animEnabled) {
      renderTiles(res.merges, res.spawned);
      return;
    }
    var byKey = {};
    Array.prototype.forEach.call(tileLayer.children, function (el) { byKey[el._key] = el; });
    res.transitions.forEach(function (t) {
      var el = byKey[t.from.r + '-' + t.from.c];
      if (!el) return;
      el.style.setProperty('--r', t.to.r);
      el.style.setProperty('--c', t.to.c);
    });
    pendingAnim = {
      merges: res.merges,
      spawned: res.spawned,
      timer: setTimeout(function () {
        var p = pendingAnim;
        pendingAnim = null;
        if (p) renderTiles(p.merges, p.spawned);
      }, SLIDE_MS)
    };
  }

  function updateHud() {
    if (!game) return;
    var lv = currentLevel();
    modeLabel.textContent = sessionLabel(session);
    var goal = 'Goal ' + game.target;
    if (lv && lv.stones.length) goal += ' · 🪨' + lv.stones.length;
    goalLabel.textContent = goal;
    goalLabel.classList.toggle('reached', game.hasWon);
    scoreEl.textContent = fmt(game.score);
    bestEl.textContent = fmt(Math.max(bestFor(session), game.score));
    if (game.moveLimit) {
      var left = Logic.movesLeft(game);
      movesLabelEl.textContent = 'Moves left';
      movesEl.textContent = left;
      movesEl.classList.toggle('low', left <= 15);
    } else {
      movesLabelEl.textContent = 'Moves';
      movesEl.textContent = fmt(game.moves);
      movesEl.classList.remove('low');
    }
    undoBtn.disabled = !Logic.canUndo(game) || roundFinished;
    undoText.textContent = game.undosLeft >= 0 ? 'Undo (' + game.undosLeft + ')' : 'Undo';
  }

  function fullRender() {
    flushAnimation();
    buildBoard();
    renderTiles([], null);
    updateHud();
  }

  function showFloatingScore(amount) {
    if (!amount) return;
    var el = document.createElement('div');
    el.className = 'score-addition';
    el.textContent = '+' + fmt(amount);
    scoreSlot.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
  }

  // ---------- Game flow ----------
  function newBoard() {
    flushAnimation();
    closeModal(resultModal);
    game = Logic.createGame(sessionDef(session));
    elapsed = 0;
    paused = false;
    roundFinished = false;
    roundCounted = false;
    roundReported = false;
    disarmRestart();
    document.body.classList.remove('is-paused');
    fullRender();
    saveCurrentGame();
  }

  function startSession(sess) {
    session = sess.mode === 'journey'
      ? { mode: 'journey', stage: Math.max(1, Math.min(JOURNEY.length, sess.stage || 1)) }
      : { mode: 'classic', size: Logic.CLASSIC[sess.size] ? sess.size : 4 };
    closeAllModals();
    hideMenu();
    newBoard();
    if (session.mode === 'journey') {
      var lv = currentLevel();
      var bits = ['Reach ' + lv.target];
      if (lv.moveLimit) bits.push('in ' + lv.moveLimit + ' moves');
      if (lv.stones.length) bits.push('around ' + lv.stones.length + ' stone' + (lv.stones.length > 1 ? 's' : ''));
      showToast('Stage ' + lv.stage + ': ' + bits.join(' '));
    }
  }

  function handleMove(direction) {
    if (inputBlocked()) return;
    if (game.hasWon && !game.wonAcknowledged && session.mode === 'classic') return;
    flushAnimation();
    disarmRestart();

    var res = Logic.makeMove(game, direction);
    if (!res.moved) {
      Audio.playBlocked();
      boardContainer.classList.remove('nudge');
      void boardContainer.offsetWidth;
      boardContainer.classList.add('nudge');
      return;
    }

    if (!roundCounted) {
      roundCounted = true;
      var st0 = getStats();
      st0.played++;
      writeJSON(KEYS.stats, st0);
    }
    var stats = getStats();
    if (res.highestTile > stats.highestTile) stats.highestTile = res.highestTile;
    stats.totalScore += res.scoreGained;
    if (session.mode === 'classic' && game.score > (stats.bestScores[session.size] || 0)) {
      stats.bestScores[session.size] = game.score;
    }
    writeJSON(KEYS.stats, stats);

    showFloatingScore(res.scoreGained);
    animateMove(res);

    if (res.newlyWon) {
      Audio.playWin();
    } else if (res.isGameOver) {
      Audio.playGameOver();
    } else if (res.merges.length) {
      var top = 0;
      res.merges.forEach(function (m) { if (m.value > top) top = m.value; });
      Audio.playMerge(top);
    } else {
      Audio.playSlide();
    }

    updateHud();
    saveCurrentGame();

    if (res.newlyWon) {
      onWin();
    } else if (res.isGameOver) {
      onLose(res.outOfMoves);
    }
  }

  function reportRoundOnce() {
    if (roundReported) return;
    roundReported = true;
    Ads.onGameFinished();
  }

  function onWin() {
    var lv = currentLevel();
    var stats = getStats();
    stats.won++;
    writeJSON(KEYS.stats, stats);
    if (lv) {
      var progress = getProgress();
      var stars = Logic.starsFor(lv, game.moves);
      var prevStars = progress.stars[lv.stage] || 0;
      var first = prevStars === 0;
      progress.stars[lv.stage] = Math.max(prevStars, stars);
      progress.bestScores[lv.stage] = Math.max(progress.bestScores[lv.stage] || 0, game.score);
      progress.bestMoves[lv.stage] = progress.bestMoves[lv.stage] ? Math.min(progress.bestMoves[lv.stage], game.moves) : game.moves;
      if (lv.stage < JOURNEY.length) progress.unlocked = Math.max(progress.unlocked, lv.stage + 1);
      writeJSON(KEYS.progress, progress);
      roundFinished = true;
      removeKey(KEYS.saved);
      updateHud();
      var text = lv.stage < JOURNEY.length
        ? (first ? 'Stage ' + (lv.stage + 1) + ' unlocked.' : 'Par for 3 ★: ' + lv.par + ' moves.')
        : 'You finished the whole Journey. Remarkable!';
      setTimeout(function () {
        showResult({ win: true, stars: stars, title: 'Stage ' + lv.stage + ' cleared!', emoji: '🎉', text: text });
      }, animEnabled ? 380 : 120);
    } else {
      setTimeout(function () {
        showResult({ win: true, title: 'You made ' + game.target + '!', emoji: '🏆', text: 'Keep merging for a bigger score, or start fresh.' });
      }, animEnabled ? 380 : 120);
    }
    announce('Goal tile reached');
  }

  function onLose(outOfMoves) {
    setTimeout(function () {
      showResult({
        win: false,
        title: outOfMoves ? 'Out of moves' : 'No moves left',
        emoji: outOfMoves ? '⏱' : '🧩',
        text: outOfMoves ? 'The goal was ' + game.target + '. Undo a few moves or try again.' : 'The board is full. Undo a move or try again.'
      });
    }, animEnabled ? 420 : 150);
    announce('Game over');
  }

  function showResult(r) {
    var lv = currentLevel();
    $('result-emoji').textContent = r.emoji;
    $('result-title').textContent = r.title;
    $('result-text').textContent = r.text;
    $('result-score').textContent = fmt(game.score);
    $('result-moves').textContent = fmt(game.moves);
    $('result-time').textContent = formatTime(elapsed);
    var starsEl = $('result-stars');
    starsEl.innerHTML = '';
    if (r.win && lv) {
      for (var i = 1; i <= 3; i++) {
        var s = document.createElement('span');
        s.className = 'star' + (i <= r.stars ? ' on' : '');
        s.textContent = '★';
        s.style.animationDelay = (i * 0.12) + 's';
        starsEl.appendChild(s);
      }
      starsEl.setAttribute('aria-label', r.stars + ' of 3 stars');
      starsEl.hidden = false;
    } else {
      starsEl.hidden = true;
    }
    $('result-next').hidden = !(r.win && lv && lv.stage < JOURNEY.length);
    $('result-continue').hidden = !(r.win && !lv);
    $('result-undo').hidden = r.win || !Logic.canUndo(game);
    $('result-retry').textContent = r.win ? '🔄 Play again' : '🔄 Try again';
    resultModal.classList.toggle('is-win', !!r.win);
    reportRoundOnce();
    openModal(resultModal, $(r.win ? (lv && lv.stage < JOURNEY.length ? 'result-next' : (lv ? 'result-retry' : 'result-continue')) : 'result-retry'));
  }

  function doUndo() {
    if (!game || paused || roundFinished || !Logic.canUndo(game)) return false;
    flushAnimation();
    if (!Logic.undo(game)) return false;
    roundReported = false;
    Audio.playUndo();
    renderTiles([], null);
    updateHud();
    saveCurrentGame();
    return true;
  }

  function disarmRestart() {
    restartArmed = false;
    restartBtn.classList.remove('armed');
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  }

  function requestRestart() {
    if (!game) return;
    if (game.moves > 0 && !game.isGameOver && !roundFinished && !restartArmed) {
      restartArmed = true;
      restartBtn.classList.add('armed');
      showToast('Tap Restart again to start a new board');
      restartTimer = setTimeout(disarmRestart, 2600);
      return;
    }
    Audio.playClick();
    newBoard();
  }

  // ---------- Pause ----------
  function openPause() {
    if (!game || paused || !isGameScreen() || modalStack.length) return;
    flushAnimation();
    paused = true;
    document.body.classList.add('is-paused');
    $('pause-mode').textContent = sessionLabel(session);
    $('pause-score').textContent = fmt(game.score);
    $('pause-time').textContent = formatTime(elapsed);
    Audio.playPause();
    saveCurrentGame();
    openModal(pauseModal, $('pause-resume'));
  }
  function resumeGame() {
    closeModal(pauseModal);
    paused = false;
    document.body.classList.remove('is-paused');
  }

  // ---------- Menu ----------
  function refreshMenu() {
    var saved = loadSavedGame();
    var cont = $('menu-continue');
    if (saved && !saved.game.isGameOver) {
      cont.hidden = false;
      $('menu-continue-info').textContent = sessionLabel(saved.session) + ' · ' + fmt(saved.game.score);
    } else {
      cont.hidden = true;
    }
    var progress = getProgress();
    var next = Math.min(progress.unlocked, JOURNEY.length);
    $('menu-journey-info').textContent = 'Stage ' + next + ' / ' + JOURNEY.length + ' · ' + totalStars(progress) + ' ★';
  }

  function showMenu() {
    flushAnimation();
    if (game && !roundFinished && !game.isGameOver) saveCurrentGame();
    if (game && (roundFinished || game.isGameOver)) removeKey(KEYS.saved);
    closeAllModals();
    paused = false;
    document.body.classList.remove('is-paused');
    disarmRestart();
    refreshMenu();
    menuScreen.classList.add('open');
    menuScreen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    var first = !$('menu-continue').hidden ? $('menu-continue') : $('menu-journey');
    if (first) first.focus();
  }
  function hideMenu() {
    menuScreen.classList.remove('open');
    menuScreen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
  }

  function continueSaved() {
    var saved = loadSavedGame();
    if (!saved) { refreshMenu(); return; }
    session = saved.session;
    game = saved.game;
    elapsed = saved.elapsed;
    roundCounted = saved.counted;
    roundFinished = false;
    roundReported = false;
    paused = false;
    closeAllModals();
    hideMenu();
    fullRender();
    if (game.hasWon && !game.wonAcknowledged && session.mode === 'classic') {
      showResult({ win: true, title: 'You made ' + game.target + '!', emoji: '🏆', text: 'Keep merging for a bigger score, or start fresh.' });
    }
  }

  function renderJourney() {
    var progress = getProgress();
    var gridEl = $('journey-grid');
    gridEl.innerHTML = '';
    JOURNEY.forEach(function (lv) {
      var locked = lv.stage > progress.unlocked;
      var stars = progress.stars[lv.stage] || 0;
      var btn = document.createElement('button');
      btn.className = 'stage-btn' + (locked ? ' locked' : '') + (stars ? ' cleared' : '');
      btn.disabled = locked;
      var tags = lv.size + '×' + lv.size + (lv.stones.length ? ' 🪨' : '') + (lv.moveLimit ? ' ⏱' : '');
      btn.innerHTML = '<span class="stage-num">' + (locked ? '🔒' : lv.stage) + '</span>' +
        '<span class="stage-goal">' + lv.target + '</span>' +
        '<span class="stage-meta">' + tags + '</span>' +
        '<span class="stage-stars">' + '★★★'.slice(0, stars) + '<i>' + '★★★'.slice(stars) + '</i></span>';
      btn.setAttribute('aria-label', 'Stage ' + lv.stage + ', ' + lv.size + ' by ' + lv.size + ', goal ' + lv.target +
        (lv.moveLimit ? ', ' + lv.moveLimit + ' moves' : '') + (locked ? ', locked' : ', ' + stars + ' stars'));
      btn.addEventListener('click', function () {
        Audio.playClick();
        startSession({ mode: 'journey', stage: lv.stage });
      });
      gridEl.appendChild(btn);
    });
    $('journey-progress').textContent = clearedCount(progress) + ' / ' + JOURNEY.length;
    $('journey-stars').textContent = totalStars(progress) + ' / ' + (JOURNEY.length * 3);
  }

  function showStats() {
    var s = getStats();
    var p = getProgress();
    $('stat-played').textContent = fmt(s.played);
    $('stat-won').textContent = fmt(s.won);
    $('stat-highest-tile').textContent = fmt(s.highestTile);
    $('stat-total-score').textContent = fmt(s.totalScore);
    $('stat-journey').textContent = clearedCount(p) + '/' + JOURNEY.length;
    $('stat-stars').textContent = totalStars(p);
    var list = $('stat-bests');
    list.innerHTML = '';
    [3, 4, 5, 6].forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'best-row';
      row.innerHTML = '<span>' + Logic.CLASSIC[n].name + '</span><strong>' + fmt(s.bestScores[n] || 0) + '</strong>';
      list.appendChild(row);
    });
    openModal(statsModal);
  }

  // ---------- Modals ----------
  function openModal(modal, focusEl) {
    if (modal.classList.contains('open')) return;
    modalStack.push({ modal: modal, opener: document.activeElement });
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    var target = focusEl || modal.querySelector('.close-modal-btn') || modal.querySelector('button');
    if (target) target.focus();
  }
  function closeModal(modal) {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    for (var i = modalStack.length - 1; i >= 0; i--) {
      if (modalStack[i].modal === modal) {
        var opener = modalStack[i].opener;
        modalStack.splice(i, 1);
        if (opener && typeof opener.focus === 'function' && document.body.contains(opener)) opener.focus();
        break;
      }
    }
    if (modal === settingsModal) disarmReset();
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(function (m) {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
    modalStack = [];
    disarmReset();
  }
  function topModal() {
    return modalStack.length ? modalStack[modalStack.length - 1].modal : null;
  }
  /** Close button / Escape / backdrop / Android back. */
  function dismissModal(modal) {
    if (!modal) return;
    if (modal === pauseModal) resumeGame();
    else if (modal === resultModal) {
      // Result dialogs need an explicit choice; Keep playing is the safe default for a Classic win.
      if (!$('result-continue').hidden) keepPlaying();
    } else closeModal(modal);
  }

  function keepPlaying() {
    if (game) {
      game.wonAcknowledged = true;
      saveCurrentGame();
    }
    closeModal(resultModal);
  }

  /** Leave a finished round, then run the next action. */
  function finishRoundThen(action) {
    if (game && game.isGameOver) {
      roundFinished = true;
      removeKey(KEYS.saved);
    }
    closeModal(resultModal);
    action();
  }

  // ---------- Settings ----------
  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'dark';
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEYS.theme, theme); } catch (e) { /* ignore */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
    $('set-theme').value = theme;
  }
  function applyAnim(on) {
    animEnabled = !!on;
    document.body.classList.toggle('no-anim', !animEnabled);
    try { localStorage.setItem(KEYS.anim, animEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
    $('set-anim').checked = animEnabled;
  }
  function syncSoundUI() {
    var on = Audio.isSoundEnabled();
    soundToggleBtn.textContent = on ? '🔊' : '🔇';
    soundToggleBtn.setAttribute('aria-pressed', String(on));
    soundToggleBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
    $('set-sound').checked = on;
  }
  function setSound(on) {
    Audio.setSoundEnabled(on);
    syncSoundUI();
    if (on) Audio.playClick();
  }
  function openSettings() {
    syncSoundUI();
    $('set-haptics').checked = Audio.isHapticsEnabled();
    $('set-anim').checked = animEnabled;
    $('set-theme').value = currentTheme;
    openModal(settingsModal);
  }
  function disarmReset() {
    resetArmed = false;
    var btn = $('set-reset');
    btn.textContent = 'Reset';
    btn.classList.remove('armed');
  }
  function handleReset() {
    var btn = $('set-reset');
    if (!resetArmed) {
      resetArmed = true;
      btn.textContent = 'Tap again to confirm';
      btn.classList.add('armed');
      return;
    }
    removeKey(KEYS.stats);
    removeKey(KEYS.progress);
    removeKey(KEYS.saved);
    disarmReset();
    Audio.playClick();
    session = { mode: 'classic', size: 4 };
    newBoard();
    showMenu();
    showToast('Progress and statistics reset.');
  }

  // ---------- Input ----------
  var KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down',
    h: 'left', l: 'right', k: 'up', j: 'down'
  };

  function bindInput() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z') && isGameScreen() && !modalStack.length) {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        var top = topModal();
        if (top) dismissModal(top);
        else if (isGameScreen()) openPause();
        e.preventDefault();
        return;
      }
      if (modalStack.length || !isGameScreen()) return;
      var dir = KEYMAP[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      } else if (e.key === 'p' || e.key === 'P') {
        openPause();
      } else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') {
        doUndo();
      } else if (e.key === 'r' || e.key === 'R') {
        requestRestart();
      }
    });

    // Swipe with finger, pen or mouse drag.
    var start = null;
    boardContainer.addEventListener('pointerdown', function (e) {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { boardContainer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    function end(e) {
      if (!start || e.pointerId !== start.id) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      start = null;
      var ax = Math.abs(dx);
      var ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) return;
      if (ax > ay * 1.1) handleMove(dx > 0 ? 'right' : 'left');
      else if (ay > ax * 1.1) handleMove(dy > 0 ? 'down' : 'up');
    }
    boardContainer.addEventListener('pointerup', end);
    boardContainer.addEventListener('pointercancel', function () { start = null; });
    // Stop the page scrolling / pull-to-refresh while swiping the board.
    boardContainer.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  function isNativeApp() {
    var cap = window.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }

  function on(id, handler) { $(id).addEventListener('click', handler); }

  // ---------- Init ----------
  function init() {
    Audio.init();
    var savedTheme = 'dark';
    var savedAnim = '1';
    try {
      savedTheme = localStorage.getItem(KEYS.theme) || 'dark';
      savedAnim = localStorage.getItem(KEYS.anim);
    } catch (e) { /* storage disabled */ }
    applyTheme(savedTheme);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    applyAnim(savedAnim === null ? !reduce : savedAnim !== '0');
    syncSoundUI();
    bindInput();

    // Header + toolbar
    soundToggleBtn.addEventListener('click', function () { setSound(!Audio.isSoundEnabled()); });
    on('stats-btn', function () { Audio.playClick(); showStats(); });
    on('help-btn', function () { Audio.playClick(); openModal(helpModal); });
    on('settings-btn', function () { Audio.playClick(); openSettings(); });
    on('pause-btn', openPause);
    on('undo-btn', doUndo);
    restartBtn.addEventListener('click', requestRestart);

    // Menu
    on('menu-continue', function () { Audio.playClick(); continueSaved(); });
    on('menu-journey', function () { Audio.playClick(); renderJourney(); openModal(journeyModal); });
    document.querySelectorAll('.menu-diff [data-size]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Audio.playClick();
        startSession({ mode: 'classic', size: parseInt(btn.getAttribute('data-size'), 10) });
      });
    });
    on('menu-settings', function () { Audio.playClick(); openSettings(); });
    on('menu-stats', function () { Audio.playClick(); showStats(); });
    on('menu-help', function () { Audio.playClick(); openModal(helpModal); });

    // Pause dialog
    on('pause-resume', function () { Audio.playClick(); resumeGame(); });
    on('pause-restart', function () { Audio.playClick(); closeModal(pauseModal); newBoard(); });
    on('pause-settings', function () { Audio.playClick(); openSettings(); });
    on('pause-menu', function () { Audio.playClick(); showMenu(); });

    // Result dialog
    on('result-next', function () {
      Audio.playClick();
      finishRoundThen(function () { startSession({ mode: 'journey', stage: session.stage + 1 }); });
    });
    on('result-continue', function () { Audio.playClick(); keepPlaying(); });
    on('result-undo', function () { closeModal(resultModal); doUndo(); });
    on('result-retry', function () { Audio.playClick(); finishRoundThen(newBoard); });
    on('result-menu', function () { Audio.playClick(); finishRoundThen(showMenu); });

    // Settings
    $('set-sound').addEventListener('change', function () { setSound(this.checked); });
    $('set-haptics').addEventListener('change', function () {
      Audio.setHapticsEnabled(this.checked);
      Audio.playClick();
    });
    $('set-anim').addEventListener('change', function () { applyAnim(this.checked); Audio.playClick(); });
    $('set-theme').addEventListener('change', function () { Audio.playClick(); applyTheme(this.value); });
    on('set-reset', handleReset);

    document.querySelectorAll('.close-modal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Audio.playClick();
        dismissModal(btn.closest('.modal-overlay'));
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal && modal !== resultModal) dismissModal(modal);
      });
    });

    // Auto-pause when the app is backgrounded; always persist.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        saveCurrentGame();
        if (game && isGameScreen() && !paused && !modalStack.length && !roundFinished && !game.isGameOver && game.moves > 0) openPause();
      }
    });
    window.addEventListener('pagehide', saveCurrentGame);

    // Android hardware back button (native app only, via @capacitor/app)
    var capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (isNativeApp() && capApp && typeof capApp.addListener === 'function') {
      capApp.addListener('backButton', function () {
        var top = topModal();
        if (top === resultModal) {
          finishRoundThen(showMenu);
        } else if (top) {
          dismissModal(top);
        } else if (isGameScreen()) {
          if (game && !game.isGameOver && !roundFinished && game.moves > 0) openPause(); else showMenu();
        } else if (typeof capApp.minimizeApp === 'function') {
          capApp.minimizeApp();
        }
      });
    }

    var resizeRaf = null;
    window.addEventListener('resize', function () {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(measureBoard);
    });

    if ('serviceWorker' in navigator && !isNativeApp() && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline cache optional */ });
    }

    Ads.init();
    startTimer();

    // Board behind the menu: the saved game if any, otherwise a fresh Classic 4×4.
    var saved = loadSavedGame();
    if (saved && !saved.game.isGameOver) {
      session = saved.session;
      game = saved.game;
      elapsed = saved.elapsed;
      roundCounted = saved.counted;
      writeJSON(KEYS.saved, { session: session, elapsed: elapsed, counted: roundCounted, game: JSON.parse(Logic.serialize(game)) });
      fullRender();
    } else {
      removeKey(KEYS.saved);
      session = { mode: 'classic', size: 4 };
      game = Logic.createGame(sessionDef(session));
      fullRender();
    }
    showMenu();
  }

  // Read-only helpers for the automated smoke test.
  window.Zen2048App = {
    getGame: function () { return game; },
    getSession: function () { return session; },
    isPaused: function () { return paused; },
    getElapsed: function () { return elapsed; },
    startSession: startSession,
    showMenu: showMenu,
    rerender: fullRender
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
