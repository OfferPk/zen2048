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
  var gameStatus = document.getElementById('game-status');
  var currentScoreEl = document.getElementById('current-score');
  var bestScoreEl = document.getElementById('best-score');
  var scoreAdditionSlot = document.getElementById('score-addition-slot');
  var gridSelect = document.getElementById('grid-select');
  var undoBtn = document.getElementById('undo-btn');
  var newGameBtn = document.getElementById('new-game-btn');
  var soundToggleBtn = document.getElementById('sound-toggle');
  var soundOnIcon = document.getElementById('sound-on-icon');
  var soundOffIcon = document.getElementById('sound-off-icon');
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
  var modalReturnFocus = null;

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
    if (statTotal) statTotal.textContent = formatNumber(stats.totalScore);
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
      bestScoreEl.textContent = formatNumber(score);
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function updateSoundButton(enabled) {
    soundToggleBtn.setAttribute('aria-pressed', String(enabled));
    soundToggleBtn.setAttribute('aria-label', enabled ? 'Mute sound' : 'Turn sound on');
    soundToggleBtn.title = enabled ? 'Sound on' : 'Sound off';
    soundOnIcon.classList.toggle('hidden', !enabled);
    soundOffIcon.classList.toggle('hidden', enabled);
  }

  function updateThemeButton(theme) {
    var themeNames = { dark: 'dark', sunset: 'sunset', light: 'light' };
    var themeIcons = { dark: '🌙', sunset: '🌅', light: '☀️' };
    themeToggleBtn.textContent = themeIcons[theme] || themeIcons.dark;
    themeToggleBtn.setAttribute('aria-label', 'Theme: ' + (themeNames[theme] || 'dark') + '. Change theme.');
    themeToggleBtn.title = 'Change theme (' + (themeNames[theme] || 'dark') + ')';
  }

  function openModal(modal, trigger) {
    modalReturnFocus = trigger;
    modal.removeAttribute('inert');
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    var initialFocus = modal.querySelector('.close-modal-btn') || modal.querySelector('[role="dialog"]');
    if (initialFocus) window.requestAnimationFrame(function () { initialFocus.focus(); });
  }

  function closeModal(modal) {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    var returnFocus = modalReturnFocus;
    modalReturnFocus = null;
    if (returnFocus) returnFocus.focus();
  }

  function setBoardOverlayOpen(isOpen, focusTarget) {
    var wasOpen = boardOverlay.classList.contains('active');
    if (isOpen) boardOverlay.removeAttribute('inert');
    else boardOverlay.setAttribute('inert', '');
    boardOverlay.classList.toggle('active', isOpen);
    boardOverlay.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen && !wasOpen && focusTarget) {
      window.requestAnimationFrame(function () { focusTarget.focus(); });
    } else if (!isOpen && wasOpen) {
      gridBoard.focus();
    }
  }

  function undoLastMove() {
    if (game && Logic.undo(game)) {
      Audio.playUndo();
      renderBoard([]);
      saveGameState();
      gameStatus.textContent = 'Last move undone. Score ' + formatNumber(game.score) + '.';
    }
  }

  function showFloatingScore(amount) {
    if (!amount || amount <= 0) return;
    var el = document.createElement('div');
    el.className = 'score-addition';
    el.textContent = '+' + formatNumber(amount);
    scoreAdditionSlot.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }

  function renderBoard(merges) {
    if (!game) return;
    gridBoard.innerHTML = '';
    var size = game.size;
    gridBoard.setAttribute('aria-rowcount', String(size));
    gridBoard.setAttribute('aria-colcount', String(size));

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
      var row = document.createElement('div');
      row.className = 'grid-row';
      row.setAttribute('role', 'row');
      row.style.gridTemplateColumns = 'repeat(' + size + ', minmax(0, 1fr))';
      for (var c = 0; c < size; c++) {
        var cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-rowindex', String(r + 1));
        cell.setAttribute('aria-colindex', String(c + 1));

        var val = game.grid[r][c];
        cell.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + ': ' + (val ? 'tile ' + val : 'empty'));
        if (val > 0) {
          var tile = document.createElement('div');
          var isMerged = Boolean(mergeMap[r + '-' + c]);
          var colorClass = val <= 2048 ? 'tile-' + val : 'tile-super';
          tile.className = 'tile ' + colorClass + (isMerged ? ' tile-merged' : '');
          tile.textContent = val;
          tile.setAttribute('aria-hidden', 'true');
          cell.appendChild(tile);
        }
        row.appendChild(cell);
      }
      gridBoard.appendChild(row);
    }

    currentScoreEl.textContent = formatNumber(game.score);
    bestScoreEl.textContent = formatNumber(Math.max(getBestScore(size), game.score));
    undoBtn.disabled = !game.history || game.history.length === 0;
    gridBoard.setAttribute('aria-label', '2048 game board. ' + size + ' by ' + size + ' grid. Score ' + formatNumber(game.score) + '. Highest tile ' + formatNumber(Logic.getHighestTile(game.grid)) + '.');

    // Check overlays
    if (game.isGameOver) {
      overlayTitle.textContent = 'Game Over';
      overlaySubtitle.textContent = 'No moves remain. Start a fresh board when you are ready.';
      overlayContinueBtn.hidden = true;
      setBoardOverlayOpen(true, overlayRestartBtn);
    } else if (game.hasWon && !game.wonAcknowledged) {
      overlayTitle.textContent = 'You Reached 2048!';
      overlaySubtitle.textContent = 'Remarkable logic! Continue playing for higher scores?';
      overlayContinueBtn.hidden = false;
      setBoardOverlayOpen(true, overlayContinueBtn);
    } else {
      setBoardOverlayOpen(false);
    }
  }

  function handleMove(direction) {
    if (!game || game.isGameOver) return;
    if (game.hasWon && !game.wonAcknowledged) return; // wait for player acknowledgment

    var res = Logic.makeMove(game, direction);
    if (!res.moved) {
      gameStatus.textContent = 'The board did not change. Try another direction.';
      return;
    }

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
      gameStatus.textContent = 'Moved ' + direction + '. Score ' + formatNumber(game.score) + '. Highest tile ' + formatNumber(highest) + '.' + (res.newlyWon ? ' You reached 2048.' : (res.isGameOver ? ' No moves remain.' : ''));
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
    gameStatus.textContent = 'New ' + s + ' by ' + s + ' game started. Use arrow keys or swipe to slide the tiles.';
  }

  function init() {
    // Theme setup
    try {
      var savedTheme = localStorage.getItem('zen2048_theme') || 'dark';
      currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', currentTheme);
      updateThemeButton(currentTheme);
    } catch (e) {}

    // Sound toggle state
    updateSoundButton(Audio.isSoundEnabled());

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

    // Keyboard controls and modal focus management.
    document.addEventListener('keydown', function (e) {
      var openDialog = document.querySelector('.modal-overlay.open');
      if (openDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModal(openDialog);
          return;
        }
        if (e.key === 'Tab') {
          var focusable = Array.prototype.slice.call(openDialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (element) { return !element.hidden; });
          if (focusable.length) {
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }

      var isControl = e.target.closest && e.target.closest('input, select, textarea, button, a, [contenteditable="true"]');
      var isTextEntry = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
      if (boardOverlay.classList.contains('active') && !e.target.closest('input, select, textarea') && (e.key === 'Escape' || (e.key === 'Enter' && !isControl))) {
        e.preventDefault();
        if (game && game.hasWon) {
          game.wonAcknowledged = true;
          saveGameState();
        }
        setBoardOverlayOpen(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTextEntry) {
        e.preventDefault();
        undoLastMove();
        return;
      }
      if (isControl) return;

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
      undoLastMove();
    });

    soundToggleBtn.addEventListener('click', function () {
      var enabled = Audio.toggleSound();
      updateSoundButton(enabled);
    });

    themeToggleBtn.addEventListener('click', function () {
      Audio.playClick();
      if (currentTheme === 'dark') currentTheme = 'sunset';
      else if (currentTheme === 'sunset') currentTheme = 'light';
      else currentTheme = 'dark';

      document.documentElement.setAttribute('data-theme', currentTheme);
      updateThemeButton(currentTheme);
      try {
        localStorage.setItem('zen2048_theme', currentTheme);
      } catch (e) {}
    });

    // Modals
    statsBtn.addEventListener('click', function () {
      Audio.playClick();
      updateStatsView();
      openModal(statsModal, statsBtn);
    });

    helpBtn.addEventListener('click', function () {
      Audio.playClick();
      openModal(helpModal, helpBtn);
    });

    document.querySelectorAll('.close-modal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Audio.playClick();
        closeModal(btn.closest('.modal-overlay'));
      });
    });

    [statsModal, helpModal].forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Overlay Buttons
    overlayRestartBtn.addEventListener('click', function () {
      setBoardOverlayOpen(false);
      startNewGame(parseInt(gridSelect.value, 10));
    });

    overlayContinueBtn.addEventListener('click', function () {
      Audio.playClick();
      setBoardOverlayOpen(false);
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
