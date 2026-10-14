/**
 * Zen2048 - Frontend Controller & Event Handling
 */

(function () {
  'use strict';

  var Logic = window.Zen2048Logic;
  var Audio = window.ZenAudio;

  var game = null;
  var currentTheme = 'dark';

  // DOM references
  var gridBoard = document.getElementById('grid-board');
  var currentScoreEl = document.getElementById('current-score');
  var bestScoreEl = document.getElementById('best-score');
  var scoreAdditionSlot = document.getElementById('score-addition-slot');
  var gridSelect = document.getElementById('grid-select');
  var undoBtn = document.getElementById('undo-btn');
  var newGameBtn = document.getElementById('new-game-btn');
  var soundToggleBtn = document.getElementById('sound-toggle');
  var themeToggleBtn = document.getElementById('theme-toggle');
  var statsBtn = document.getElementById('stats-btn');
  var helpBtn = document.getElementById('help-btn');

  // Overlay
  var boardOverlay = document.getElementById('board-overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlaySubtitle = document.getElementById('overlay-subtitle');
  var overlayContinueBtn = document.getElementById('overlay-continue-btn');
  var overlayRestartBtn = document.getElementById('overlay-restart-btn');

  // Modals
  var statsModal = document.getElementById('stats-modal');
  var helpModal = document.getElementById('help-modal');

  // Statistics
  function loadStats() {
    try {
      var raw = localStorage.getItem('zen2048_stats');
      return raw ? JSON.parse(raw) : {
        played: 0,
        won: 0,
        highestTile: 0,
        totalScore: 0,
        bestScores: { 3: 0, 4: 0, 5: 0, 6: 0 }
      };
    } catch (e) {
      return { played: 0, won: 0, highestTile: 0, totalScore: 0, bestScores: { 3: 0, 4: 0, 5: 0, 6: 0 } };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem('zen2048_stats', JSON.stringify(stats));
    } catch (e) {}
  }

  function updateStatsView() {
    var stats = loadStats();
    var statPlayed = document.getElementById('stat-played');
    var statWon = document.getElementById('stat-won');
    var statHighest = document.getElementById('stat-highest-tile');
    var statTotal = document.getElementById('stat-total-score');

    if (statPlayed) statPlayed.textContent = stats.played || 0;
    if (statWon) statWon.textContent = stats.won || 0;
    if (statHighest) statHighest.textContent = stats.highestTile || 0;
    if (statTotal) statTotal.textContent = (stats.totalScore || 0).toLocaleString();
  }

  function getBestScore(size) {
    var stats = loadStats();
    if (!stats.bestScores) stats.bestScores = {};
    return stats.bestScores[size] || 0;
  }

  function setBestScore(size, score) {
    var stats = loadStats();
    if (!stats.bestScores) stats.bestScores = {};
    if (score > (stats.bestScores[size] || 0)) {
      stats.bestScores[size] = score;
      saveStats(stats);
      bestScoreEl.textContent = score;
    }
  }

  function showFloatingScore(amount) {
    if (!amount || amount <= 0) return;
    var el = document.createElement('div');
    el.className = 'score-addition';
    el.textContent = '+' + amount;
    scoreAdditionSlot.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }

  function renderBoard(merges) {
    if (!game) return;
    gridBoard.innerHTML = '';
    var size = game.size;

    gridBoard.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
    gridBoard.style.gridTemplateRows = 'repeat(' + size + ', 1fr)';

    // Font size scaling based on grid dimensions
    var baseFontSize = size === 3 ? 2.4 : (size === 4 ? 1.8 : (size === 5 ? 1.35 : 1.1));
    document.documentElement.style.setProperty('--tile-font-size', baseFontSize + 'rem');

    var mergeMap = {};
    if (merges && merges.length) {
      for (var i = 0; i < merges.length; i++) {
        mergeMap[merges[i].r + '-' + merges[i].c] = true;
      }
    }

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var cell = document.createElement('div');
        cell.className = 'grid-cell';

        var val = game.grid[r][c];
        if (val > 0) {
          var tile = document.createElement('div');
          var isMerged = Boolean(mergeMap[r + '-' + c]);
          var colorClass = val <= 2048 ? 'tile-' + val : 'tile-super';
          tile.className = 'tile ' + colorClass + (isMerged ? ' tile-merged' : '');
          tile.textContent = val;
          cell.appendChild(tile);
        }
        gridBoard.appendChild(cell);
      }
    }

    currentScoreEl.textContent = game.score;
    bestScoreEl.textContent = Math.max(getBestScore(size), game.score);
    undoBtn.disabled = !game.history || game.history.length === 0;

    // Check overlays
    if (game.isGameOver) {
      overlayTitle.textContent = 'Game Over';
      overlaySubtitle.textContent = 'No available moves left on the grid.';
      overlayContinueBtn.style.display = 'none';
      boardOverlay.classList.add('active');
    } else if (game.hasWon && !game.wonAcknowledged) {
      overlayTitle.textContent = 'You Reached 2048!';
      overlaySubtitle.textContent = 'Remarkable logic! Continue playing for higher scores?';
      overlayContinueBtn.style.display = 'inline-block';
      boardOverlay.classList.add('active');
    } else {
      boardOverlay.classList.remove('active');
    }
  }

  function handleMove(direction) {
    if (!game || game.isGameOver) return;
    if (game.hasWon && !game.wonAcknowledged) return; // wait for player acknowledgment

    var prevScore = game.score;
    var res = Logic.makeMove(game, direction);

    if (res.moved) {
      var highest = Logic.getHighestTile(game.grid);
      var stats = loadStats();
      if (highest > (stats.highestTile || 0)) {
        stats.highestTile = highest;
      }
      stats.totalScore = (stats.totalScore || 0) + res.scoreGained;
      saveStats(stats);
      setBestScore(game.size, game.score);

      showFloatingScore(res.scoreGained);

      if (res.newlyWon) {
        Audio.playWin();
        stats.won = (stats.won || 0) + 1;
        saveStats(stats);
      } else if (res.isGameOver) {
        Audio.playGameOver();
      } else if (res.merges && res.merges.length > 0) {
        var highestMerge = 0;
        for (var i = 0; i < res.merges.length; i++) {
          if (res.merges[i].value > highestMerge) highestMerge = res.merges[i].value;
        }
        Audio.playMerge(highestMerge);
      } else {
        Audio.playSlide();
      }

      renderBoard(res.merges);
      saveGameState();
    }
  }

  function saveGameState() {
    if (!game) return;
    try {
      localStorage.setItem('zen2048_saved_game', Logic.serialize(game));
    } catch (e) {}
  }

  function startNewGame(size) {
    Audio.playClick();
    var s = size || parseInt(gridSelect.value, 10) || 4;
    game = Logic.createGame({ size: s, target: 2048 });

    var stats = loadStats();
    stats.played = (stats.played || 0) + 1;
    saveStats(stats);

    renderBoard([]);
    saveGameState();
  }

  function init() {
    // Theme setup
    try {
      var savedTheme = localStorage.getItem('zen2048_theme') || 'dark';
      currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', currentTheme);
      themeToggleBtn.textContent = currentTheme === 'light' ? '☀️' : (currentTheme === 'sunset' ? '🌅' : '🌙');
    } catch (e) {}

    // Sound toggle state
    soundToggleBtn.textContent = Audio.isSoundEnabled() ? '🔊' : '🔇';

    // Attempt to restore saved game
    try {
      var saved = localStorage.getItem('zen2048_saved_game');
      if (saved) {
        var restored = Logic.deserialize(saved);
        if (restored) {
          game = restored;
          gridSelect.value = String(game.size);
        }
      }
    } catch (e) {}

    if (!game) {
      startNewGame(parseInt(gridSelect.value, 10));
    } else {
      renderBoard([]);
    }

    // Keyboard controls
    window.addEventListener('keydown', function (e) {
      if (boardOverlay.classList.contains('active') && !e.target.matches('input, select, textarea')) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          boardOverlay.classList.remove('active');
          if (game && game.hasWon) game.wonAcknowledged = true;
          return;
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          handleMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          handleMove('right');
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          handleMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          handleMove('down');
          break;
      }
    });

    // Touch Swipe Detection
    var boardContainer = document.getElementById('board-container');
    var touchStartX = 0;
    var touchStartY = 0;
    var touchEndX = 0;
    var touchEndY = 0;

    boardContainer.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    boardContainer.addEventListener('touchend', function (e) {
      if (e.changedTouches && e.changedTouches.length > 0) {
        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;

        var dx = touchEndX - touchStartX;
        var dy = touchEndY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);
        var minThreshold = 25; // minimum swipe length

        if (Math.max(absDx, absDy) > minThreshold) {
          if (absDx > absDy) {
            handleMove(dx > 0 ? 'right' : 'left');
          } else {
            handleMove(dy > 0 ? 'down' : 'up');
          }
        }
      }
    }, { passive: true });

    // Buttons
    newGameBtn.addEventListener('click', function () {
      startNewGame(parseInt(gridSelect.value, 10));
    });

    gridSelect.addEventListener('change', function () {
      startNewGame(parseInt(gridSelect.value, 10));
    });

    undoBtn.addEventListener('click', function () {
      if (game && Logic.undo(game)) {
        Audio.playUndo();
        renderBoard([]);
        saveGameState();
      }
    });

    soundToggleBtn.addEventListener('click', function () {
      var enabled = Audio.toggleSound();
      soundToggleBtn.textContent = enabled ? '🔊' : '🔇';
    });

    themeToggleBtn.addEventListener('click', function () {
      Audio.playClick();
      if (currentTheme === 'dark') currentTheme = 'sunset';
      else if (currentTheme === 'sunset') currentTheme = 'light';
      else currentTheme = 'dark';

      document.documentElement.setAttribute('data-theme', currentTheme);
      themeToggleBtn.textContent = currentTheme === 'light' ? '☀️' : (currentTheme === 'sunset' ? '🌅' : '🌙');
      try {
        localStorage.setItem('zen2048_theme', currentTheme);
      } catch (e) {}
    });

    // Modals
    statsBtn.addEventListener('click', function () {
      Audio.playClick();
      updateStatsView();
      statsModal.classList.add('open');
    });

    helpBtn.addEventListener('click', function () {
      Audio.playClick();
      helpModal.classList.add('open');
    });

    document.querySelectorAll('.close-modal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Audio.playClick();
        statsModal.classList.remove('open');
        helpModal.classList.remove('open');
      });
    });

    // Overlay Buttons
    overlayRestartBtn.addEventListener('click', function () {
      boardOverlay.classList.remove('active');
      startNewGame(parseInt(gridSelect.value, 10));
    });

    overlayContinueBtn.addEventListener('click', function () {
      Audio.playClick();
      boardOverlay.classList.remove('active');
      if (game) {
        game.wonAcknowledged = true;
        saveGameState();
      }
    });

    // Service Worker Registration for 100% Offline PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
