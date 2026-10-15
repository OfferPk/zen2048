/**
 * Zen2048 - Pure game rules (no DOM). Fully testable in Node.js.
 *
 * Cell values: 0 = empty, -1 = stone (fixed blocker, never moves or merges),
 * any power of two = tile.
 */
var Zen2048Logic = (function () {
  'use strict';

  var STONE = -1;
  var HISTORY_LIMIT = 30;

  /**
   * Classic modes (difficulty = board size). Reaching the target wins, then the
   * player may keep going for a higher score.
   */
  var CLASSIC = {
    3: { size: 3, target: 256, name: 'Mini 3×3' },
    4: { size: 4, target: 2048, name: 'Classic 4×4' },
    5: { size: 5, target: 4096, name: 'Big 5×5' },
    6: { size: 6, target: 8192, name: 'Huge 6×6' }
  };

  /**
   * Journey levels. Each stage sets a board size, target tile, optional fixed
   * stones and an optional move limit. Clearing a stage unlocks the next.
   * Move limits are ~1.6x the typical number of moves needed for the target.
   */
  var JOURNEY = [
    { size: 3, target: 64 },
    { size: 4, target: 128 },
    { size: 4, target: 256 },
    { size: 3, target: 128 },
    { size: 4, target: 128, moveLimit: 100 },
    { size: 4, target: 256, stones: [[1, 2]] },
    { size: 4, target: 256, moveLimit: 190 },
    { size: 5, target: 512 },
    { size: 5, target: 512, stones: [[1, 1], [3, 3]] },
    { size: 4, target: 512 },
    { size: 4, target: 512, stones: [[0, 3], [3, 0]] },
    { size: 4, target: 1024 },
    { size: 5, target: 1024 },
    { size: 5, target: 512, stones: [[1, 1], [1, 3], [3, 1], [3, 3]] },
    { size: 4, target: 512, moveLimit: 360 },
    { size: 6, target: 1024, stones: [[0, 0], [0, 5], [5, 0], [5, 5]] },
    { size: 4, target: 1024, stones: [[2, 1]] },
    { size: 5, target: 2048 },
    { size: 4, target: 2048 },
    { size: 5, target: 1024, moveLimit: 680 },
    { size: 6, target: 2048, stones: [[2, 2], [2, 3], [3, 2], [3, 3], [0, 5], [5, 0]] },
    { size: 5, target: 2048, stones: [[2, 0], [2, 2], [2, 4]] },
    { size: 6, target: 4096 },
    { size: 5, target: 4096 }
  ].map(function (lv, i) {
    lv.stage = i + 1;
    lv.stones = lv.stones || [];
    lv.moveLimit = lv.moveLimit || 0;
    // Par for 3 stars: roughly the number of moves a tidy player needs.
    lv.par = Math.round(lv.target * 0.55);
    return lv;
  });

  function createEmptyGrid(size) {
    var grid = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) row.push(0);
      grid.push(row);
    }
    return grid;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) { return row.slice(); });
  }

  function getEmptyCells(grid) {
    var empty = [];
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === 0) empty.push({ r: r, c: c });
      }
    }
    return empty;
  }

  function spawnRandomTile(grid, randomFn) {
    var rng = typeof randomFn === 'function' ? randomFn : Math.random;
    var empty = getEmptyCells(grid);
    if (empty.length === 0) return null;
    var cell = empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))];
    var value = rng() < 0.9 ? 2 : 4; // 90% twos, 10% fours
    grid[cell.r][cell.c] = value;
    return { r: cell.r, c: cell.c, value: value };
  }

  /**
   * Slide one line towards index 0. Stones split the line into independent
   * segments. Returns the new line plus, for every input tile, where it went.
   */
  function slideLineLeft(line) {
    var out = [];
    var dest = []; // dest[i] = output index of input tile i (or -1)
    var mergedIndices = [];
    var scoreGained = 0;
    var i;
    for (i = 0; i < line.length; i++) { out.push(0); dest.push(-1); }

    var start = 0;
    while (start < line.length) {
      if (line[start] === STONE) {
        out[start] = STONE;
        start++;
        continue;
      }
      var end = start;
      while (end < line.length && line[end] !== STONE) end++;
      // Segment [start, end)
      var write = start;
      var lastVal = 0;
      var lastMerged = true; // nothing to merge with yet
      for (i = start; i < end; i++) {
        var v = line[i];
        if (v === 0) continue;
        if (!lastMerged && lastVal === v) {
          out[write - 1] = v * 2;
          scoreGained += v * 2;
          mergedIndices.push(write - 1);
          dest[i] = write - 1;
          lastMerged = true;
        } else {
          out[write] = v;
          dest[i] = write;
          lastVal = v;
          lastMerged = false;
          write++;
        }
      }
      start = end;
    }

    return { line: out, scoreGained: scoreGained, mergedIndices: mergedIndices, dest: dest };
  }

  /** Coordinates of every line, ordered in the direction tiles travel. */
  function linesFor(size, direction) {
    var lines = [];
    for (var a = 0; a < size; a++) {
      var line = [];
      for (var b = 0; b < size; b++) {
        if (direction === 'left') line.push({ r: a, c: b });
        else if (direction === 'right') line.push({ r: a, c: size - 1 - b });
        else if (direction === 'up') line.push({ r: b, c: a });
        else line.push({ r: size - 1 - b, c: a });
      }
      lines.push(line);
    }
    return lines;
  }

  function slide(grid, direction) {
    var size = grid.length;
    var newGrid = createEmptyGrid(size);
    var total = 0;
    var moved = false;
    var merges = [];
    var transitions = [];

    if (['left', 'right', 'up', 'down'].indexOf(direction) === -1) {
      return { grid: cloneGrid(grid), scoreGained: 0, moved: false, merges: [], transitions: [] };
    }

    linesFor(size, direction).forEach(function (coords) {
      var values = coords.map(function (p) { return grid[p.r][p.c]; });
      var res = slideLineLeft(values);
      total += res.scoreGained;
      coords.forEach(function (p, idx) {
        newGrid[p.r][p.c] = res.line[idx];
        if (grid[p.r][p.c] !== res.line[idx]) moved = true;
        if (res.dest[idx] >= 0) {
          var to = coords[res.dest[idx]];
          transitions.push({ from: { r: p.r, c: p.c }, to: { r: to.r, c: to.c }, value: values[idx] });
        }
      });
      res.mergedIndices.forEach(function (mi) {
        var q = coords[mi];
        merges.push({ r: q.r, c: q.c, value: res.line[mi] });
      });
    });

    return { grid: newGrid, scoreGained: total, moved: moved, merges: merges, transitions: transitions };
  }

  function getHighestTile(grid) {
    var max = 0;
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (grid[r][c] > max) max = grid[r][c];
      }
    }
    return max;
  }

  function canMove(grid) {
    var size = grid.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var v = grid[r][c];
        if (v === 0) return true;
        if (v === STONE) continue;
        if (c + 1 < size && grid[r][c + 1] === v) return true;
        if (r + 1 < size && grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  function placeStones(grid, stones) {
    (stones || []).forEach(function (s) {
      var r = s[0];
      var c = s[1];
      if (grid[r] && c >= 0 && c < grid.length) grid[r][c] = STONE;
    });
  }

  function createGame(options) {
    var opts = options || {};
    var size = parseInt(opts.size, 10) || 4;
    if (size < 3) size = 3;
    if (size > 6) size = 6;
    var randomFn = opts.randomFn || Math.random;

    var grid = createEmptyGrid(size);
    placeStones(grid, opts.stones);
    spawnRandomTile(grid, randomFn);
    spawnRandomTile(grid, randomFn);

    return {
      size: size,
      target: opts.target || 2048,
      moveLimit: opts.moveLimit || 0,
      undosLeft: typeof opts.undoLimit === 'number' ? opts.undoLimit : -1, // -1 = unlimited
      grid: grid,
      score: 0,
      moves: 0,
      isGameOver: false,
      outOfMoves: false,
      hasWon: false,
      wonAcknowledged: false,
      history: []
    };
  }

  function movesLeft(game) {
    return game.moveLimit ? Math.max(0, game.moveLimit - game.moves) : Infinity;
  }

  function makeMove(game, direction, randomFn) {
    if (game.isGameOver) return { moved: false };

    var res = slide(game.grid, direction);
    if (!res.moved) return { moved: false };

    if (game.history.length >= HISTORY_LIMIT) game.history.shift();
    game.history.push({
      grid: cloneGrid(game.grid),
      score: game.score,
      moves: game.moves,
      hasWon: game.hasWon,
      wonAcknowledged: game.wonAcknowledged
    });

    game.grid = res.grid;
    game.score += res.scoreGained;
    game.moves++;

    var spawned = spawnRandomTile(game.grid, randomFn);
    var highest = getHighestTile(game.grid);
    var newlyWon = false;
    if (highest >= game.target && !game.hasWon) {
      game.hasWon = true;
      newlyWon = true;
    }

    game.outOfMoves = false;
    if (!canMove(game.grid)) {
      game.isGameOver = true;
    } else if (game.moveLimit && game.moves >= game.moveLimit && !game.hasWon) {
      game.isGameOver = true;
      game.outOfMoves = true;
    }

    return {
      moved: true,
      scoreGained: res.scoreGained,
      merges: res.merges,
      transitions: res.transitions,
      spawned: spawned,
      newlyWon: newlyWon,
      isGameOver: game.isGameOver,
      outOfMoves: game.outOfMoves,
      highestTile: highest
    };
  }

  function canUndo(game) {
    return !!(game && game.history && game.history.length > 0 && game.undosLeft !== 0);
  }

  function undo(game) {
    if (!canUndo(game)) return false;
    var previous = game.history.pop();
    game.grid = cloneGrid(previous.grid);
    game.score = previous.score;
    game.moves = previous.moves;
    // Once a win was acknowledged ("Keep playing") undo never re-triggers it.
    game.wonAcknowledged = !!(game.wonAcknowledged || previous.wonAcknowledged);
    game.hasWon = !!(previous.hasWon || game.wonAcknowledged);
    game.isGameOver = false;
    game.outOfMoves = false;
    if (game.undosLeft > 0) game.undosLeft--;
    return true;
  }

  /** 1-3 stars for a cleared journey stage, based on moves used vs par. */
  function starsFor(level, moves) {
    if (!level) return 0;
    if (moves <= level.par) return 3;
    if (moves <= Math.round(level.par * 1.3)) return 2;
    return 1;
  }

  function serialize(game) {
    return JSON.stringify({
      size: game.size,
      target: game.target,
      moveLimit: game.moveLimit,
      undosLeft: game.undosLeft,
      grid: game.grid,
      score: game.score,
      moves: game.moves,
      isGameOver: game.isGameOver,
      outOfMoves: game.outOfMoves,
      hasWon: game.hasWon,
      wonAcknowledged: game.wonAcknowledged,
      history: game.history
    });
  }

  function isValidGrid(grid) {
    if (!Array.isArray(grid) || grid.length < 3 || grid.length > 6) return false;
    return grid.every(function (row) {
      return Array.isArray(row) && row.length === grid.length && row.every(function (v) {
        return typeof v === 'number' && (v === 0 || v === STONE || (v >= 2 && (v & (v - 1)) === 0));
      });
    });
  }

  function deserialize(json) {
    try {
      var data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || !isValidGrid(data.grid)) return null;
      var history = Array.isArray(data.history) ? data.history.filter(function (h) {
        return h && isValidGrid(h.grid) && h.grid.length === data.grid.length;
      }).slice(-HISTORY_LIMIT) : [];
      return {
        size: data.grid.length,
        target: data.target || 2048,
        moveLimit: data.moveLimit || 0,
        undosLeft: typeof data.undosLeft === 'number' ? data.undosLeft : -1,
        grid: data.grid,
        score: data.score || 0,
        moves: data.moves || 0,
        isGameOver: Boolean(data.isGameOver),
        outOfMoves: Boolean(data.outOfMoves),
        hasWon: Boolean(data.hasWon),
        wonAcknowledged: Boolean(data.wonAcknowledged),
        history: history
      };
    } catch (e) {
      return null;
    }
  }

  return {
    STONE: STONE,
    CLASSIC: CLASSIC,
    JOURNEY: JOURNEY,
    createEmptyGrid: createEmptyGrid,
    cloneGrid: cloneGrid,
    getEmptyCells: getEmptyCells,
    spawnRandomTile: spawnRandomTile,
    slideLineLeft: slideLineLeft,
    slide: slide,
    canMove: canMove,
    getHighestTile: getHighestTile,
    createGame: createGame,
    makeMove: makeMove,
    movesLeft: movesLeft,
    canUndo: canUndo,
    undo: undo,
    starsFor: starsFor,
    serialize: serialize,
    deserialize: deserialize
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Zen2048Logic;
}
