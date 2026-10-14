/**
 * Zen2048 - Pure Functional Logic Module
 * Zero DOM dependencies; fully testable in Node.js
 */

var Zen2048Logic = (function () {
  'use strict';

  function createEmptyGrid(size) {
    var grid = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) {
        row.push(0);
      }
      grid.push(row);
    }
    return grid;
  }

  function cloneGrid(grid) {
    var size = grid.length;
    var copy = [];
    for (var r = 0; r < size; r++) {
      copy.push(grid[r].slice());
    }
    return copy;
  }

  function getEmptyCells(grid) {
    var empty = [];
    var size = grid.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (grid[r][c] === 0) {
          empty.push({ r: r, c: c });
        }
      }
    }
    return empty;
  }

  function spawnRandomTile(grid, randomFn) {
    var rng = typeof randomFn === 'function' ? randomFn : Math.random;
    var empty = getEmptyCells(grid);
    if (empty.length === 0) return null;

    var index = Math.floor(rng() * empty.length);
    var cell = empty[index];
    // 90% chance of 2, 10% chance of 4
    var value = rng() < 0.9 ? 2 : 4;
    grid[cell.r][cell.c] = value;

    return { r: cell.r, c: cell.c, value: value };
  }

  function slideLineLeft(line) {
    // 1. Filter out zeros
    var nonZero = [];
    for (var i = 0; i < line.length; i++) {
      if (line[i] !== 0) nonZero.push(line[i]);
    }

    var merged = [];
    var scoreGained = 0;
    var mergedIndices = []; // target indices where merge occurred

    var p = 0;
    while (p < nonZero.length) {
      if (p + 1 < nonZero.length && nonZero[p] === nonZero[p + 1]) {
        var newVal = nonZero[p] * 2;
        merged.push(newVal);
        scoreGained += newVal;
        mergedIndices.push(merged.length - 1);
        p += 2; // skip both merged items
      } else {
        merged.push(nonZero[p]);
        p++;
      }
    }

    // Fill remaining with zeros
    while (merged.length < line.length) {
      merged.push(0);
    }

    return {
      line: merged,
      scoreGained: scoreGained,
      mergedIndices: mergedIndices
    };
  }

  function slide(grid, direction) {
    var size = grid.length;
    var newGrid = createEmptyGrid(size);
    var totalScoreGained = 0;
    var moved = false;
    var merges = [];

    if (direction === 'left') {
      for (var r = 0; r < size; r++) {
        var res = slideLineLeft(grid[r]);
        newGrid[r] = res.line;
        totalScoreGained += res.scoreGained;
        for (var i = 0; i < size; i++) {
          if (grid[r][i] !== newGrid[r][i]) moved = true;
        }
        for (var m = 0; m < res.mergedIndices.length; m++) {
          merges.push({ r: r, c: res.mergedIndices[m], value: newGrid[r][res.mergedIndices[m]] });
        }
      }
    } else if (direction === 'right') {
      for (var r = 0; r < size; r++) {
        var reversed = grid[r].slice().reverse();
        var res = slideLineLeft(reversed);
        var originalLine = res.line.slice().reverse();
        newGrid[r] = originalLine;
        totalScoreGained += res.scoreGained;
        for (var i = 0; i < size; i++) {
          if (grid[r][i] !== newGrid[r][i]) moved = true;
        }
        for (var m = 0; m < res.mergedIndices.length; m++) {
          var targetC = size - 1 - res.mergedIndices[m];
          merges.push({ r: r, c: targetC, value: newGrid[r][targetC] });
        }
      }
    } else if (direction === 'up') {
      for (var c = 0; c < size; c++) {
        var col = [];
        for (var r = 0; r < size; r++) {
          col.push(grid[r][c]);
        }
        var res = slideLineLeft(col);
        totalScoreGained += res.scoreGained;
        for (var r = 0; r < size; r++) {
          newGrid[r][c] = res.line[r];
          if (grid[r][c] !== newGrid[r][c]) moved = true;
        }
        for (var m = 0; m < res.mergedIndices.length; m++) {
          var targetR = res.mergedIndices[m];
          merges.push({ r: targetR, c: c, value: newGrid[targetR][c] });
        }
      }
    } else if (direction === 'down') {
      for (var c = 0; c < size; c++) {
        var col = [];
        for (var r = 0; r < size; r++) {
          col.push(grid[r][c]);
        }
        var reversed = col.slice().reverse();
        var res = slideLineLeft(reversed);
        var originalCol = res.line.slice().reverse();
        totalScoreGained += res.scoreGained;
        for (var r = 0; r < size; r++) {
          newGrid[r][c] = originalCol[r];
          if (grid[r][c] !== newGrid[r][c]) moved = true;
        }
        for (var m = 0; m < res.mergedIndices.length; m++) {
          var targetR = size - 1 - res.mergedIndices[m];
          merges.push({ r: targetR, c: c, value: newGrid[targetR][c] });
        }
      }
    }

    return {
      grid: newGrid,
      scoreGained: totalScoreGained,
      moved: moved,
      merges: merges
    };
  }

  function getHighestTile(grid) {
    var max = 0;
    var size = grid.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (grid[r][c] > max) max = grid[r][c];
      }
    }
    return max;
  }

  function canMove(grid) {
    var size = grid.length;
    // Check for empty cell
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (grid[r][c] === 0) return true;
      }
    }

    // Check adjacent horizontally
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size - 1; c++) {
        if (grid[r][c] === grid[r][c + 1]) return true;
      }
    }

    // Check adjacent vertically
    for (var c = 0; c < size; c++) {
      for (var r = 0; r < size - 1; r++) {
        if (grid[r][c] === grid[r + 1][c]) return true;
      }
    }

    return false;
  }

  function createGame(options) {
    var opts = options || {};
    var size = opts.size || 4;
    var target = opts.target || 2048;
    var randomFn = opts.randomFn || Math.random;

    if (size < 3) size = 3;
    if (size > 6) size = 6;

    var grid = createEmptyGrid(size);

    // Initial 2 tiles
    spawnRandomTile(grid, randomFn);
    spawnRandomTile(grid, randomFn);

    return {
      size: size,
      target: target,
      grid: grid,
      score: 0,
      moves: 0,
      isGameOver: false,
      hasWon: false,
      wonAcknowledged: false,
      history: []
    };
  }

  function makeMove(game, direction, randomFn) {
    if (game.isGameOver) return { moved: false };

    var res = slide(game.grid, direction);
    if (!res.moved) return { moved: false };

    // Push current state to undo history (limit 20 frames)
    if (game.history.length >= 20) {
      game.history.shift();
    }
    game.history.push({
      grid: cloneGrid(game.grid),
      score: game.score,
      moves: game.moves,
      hasWon: game.hasWon
    });

    game.grid = res.grid;
    game.score += res.scoreGained;
    game.moves++;

    // Spawn new tile
    var spawned = spawnRandomTile(game.grid, randomFn);

    // Check win condition
    var highest = getHighestTile(game.grid);
    var newlyWon = false;
    if (highest >= game.target && !game.hasWon && !game.wonAcknowledged) {
      game.hasWon = true;
      newlyWon = true;
    }

    // Check game over
    if (!canMove(game.grid)) {
      game.isGameOver = true;
    }

    return {
      moved: true,
      scoreGained: res.scoreGained,
      merges: res.merges,
      spawned: spawned,
      newlyWon: newlyWon,
      isGameOver: game.isGameOver,
      highestTile: highest
    };
  }

  function undo(game) {
    if (!game.history || game.history.length === 0) return false;

    var previous = game.history.pop();
    game.grid = cloneGrid(previous.grid);
    game.score = previous.score;
    game.moves = previous.moves;
    game.hasWon = previous.hasWon;
    game.isGameOver = false;

    return true;
  }

  function serialize(game) {
    return JSON.stringify({
      size: game.size,
      target: game.target,
      grid: game.grid,
      score: game.score,
      moves: game.moves,
      isGameOver: game.isGameOver,
      hasWon: game.hasWon,
      wonAcknowledged: game.wonAcknowledged
    });
  }

  function deserialize(json) {
    try {
      var data = JSON.parse(json);
      if (!data || !Array.isArray(data.grid)) return null;
      return {
        size: data.size || data.grid.length,
        target: data.target || 2048,
        grid: data.grid,
        score: data.score || 0,
        moves: data.moves || 0,
        isGameOver: Boolean(data.isGameOver),
        hasWon: Boolean(data.hasWon),
        wonAcknowledged: Boolean(data.wonAcknowledged),
        history: []
      };
    } catch (e) {
      return null;
    }
  }

  return {
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
    undo: undo,
    serialize: serialize,
    deserialize: deserialize
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Zen2048Logic;
}
