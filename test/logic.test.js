/**
 * Comprehensive Node.js Unit Tests for Zen2048Logic
 */

const assert = require('assert');
const Logic = require('../src/logic.js');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(err);
    failed++;
  }
}

console.log('\nRunning Zen2048 Logic Tests...\n');

it('Initializes game with default 4x4 grid and 2 non-zero tiles', () => {
  const game = Logic.createGame({ size: 4 });
  assert.strictEqual(game.size, 4);
  assert.strictEqual(game.grid.length, 4);
  assert.strictEqual(game.score, 0);
  assert.strictEqual(game.moves, 0);
  assert.strictEqual(game.isGameOver, false);

  let nonZero = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (game.grid[r][c] !== 0) nonZero++;
    }
  }
  assert.strictEqual(nonZero, 2);
});

it('Initializes custom grid sizes (3x3, 5x5, 6x6)', () => {
  const g3 = Logic.createGame({ size: 3 });
  assert.strictEqual(g3.size, 3);
  assert.strictEqual(g3.grid.length, 3);

  const g5 = Logic.createGame({ size: 5 });
  assert.strictEqual(g5.size, 5);
  assert.strictEqual(g5.grid.length, 5);

  const g6 = Logic.createGame({ size: 6 });
  assert.strictEqual(g6.size, 6);
  assert.strictEqual(g6.grid.length, 6);
});

it('Clamps invalid grid sizes to [3, 6]', () => {
  const gLow = Logic.createGame({ size: 1 });
  assert.strictEqual(gLow.size, 3);

  const gHigh = Logic.createGame({ size: 10 });
  assert.strictEqual(gHigh.size, 6);
});

it('Slide line left merges adjacent equal tiles and shifts', () => {
  const res = Logic.slideLineLeft([2, 2, 0, 0]);
  assert.deepStrictEqual(res.line, [4, 0, 0, 0]);
  assert.strictEqual(res.scoreGained, 4);
});

it('Slide line left does not double-merge a newly created tile', () => {
  // [2, 2, 2, 2] should merge into [4, 4, 0, 0], NOT [8, 0, 0, 0]
  const res = Logic.slideLineLeft([2, 2, 2, 2]);
  assert.deepStrictEqual(res.line, [4, 4, 0, 0]);
  assert.strictEqual(res.scoreGained, 8);
});

it('Slide line left respects left-to-right precedence', () => {
  // [2, 2, 4, 0] -> [4, 4, 0, 0]
  const res1 = Logic.slideLineLeft([2, 2, 4, 0]);
  assert.deepStrictEqual(res1.line, [4, 4, 0, 0]);
  assert.strictEqual(res1.scoreGained, 4);

  // [4, 2, 2, 0] -> [4, 4, 0, 0]
  const res2 = Logic.slideLineLeft([4, 2, 2, 0]);
  assert.deepStrictEqual(res2.line, [4, 4, 0, 0]);
  assert.strictEqual(res2.scoreGained, 4);
});

it('Slide right shifts and merges correctly', () => {
  const grid = [
    [2, 0, 2, 4],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.slide(grid, 'right');
  assert.strictEqual(res.moved, true);
  assert.deepStrictEqual(res.grid[0], [0, 0, 4, 4]);
  assert.strictEqual(res.scoreGained, 4);
});

it('Slide up shifts and merges vertically', () => {
  const grid = [
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.slide(grid, 'up');
  assert.strictEqual(res.moved, true);
  assert.deepStrictEqual(res.grid[0][0], 4);
  assert.deepStrictEqual(res.grid[1][0], 4);
  assert.deepStrictEqual(res.grid[2][0], 0);
  assert.deepStrictEqual(res.grid[3][0], 0);
  assert.strictEqual(res.scoreGained, 4);
});

it('Slide down shifts and merges vertically towards bottom', () => {
  const grid = [
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [2, 0, 0, 0],
    [2, 0, 0, 0]
  ];
  const res = Logic.slide(grid, 'down');
  assert.strictEqual(res.moved, true);
  assert.deepStrictEqual(res.grid[3][0], 4);
  assert.deepStrictEqual(res.grid[2][0], 4);
  assert.deepStrictEqual(res.grid[1][0], 0);
  assert.deepStrictEqual(res.grid[0][0], 0);
  assert.strictEqual(res.scoreGained, 4);
});

it('Reports moved: false when no tiles can move or merge', () => {
  const grid = [
    [2, 4, 8, 16],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.slide(grid, 'left');
  assert.strictEqual(res.moved, false);
});

it('canMove detects valid moves on partially empty grid', () => {
  const grid = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 0, 2],
    [4, 8, 16, 32]
  ];
  assert.strictEqual(Logic.canMove(grid), true);
});

it('canMove detects valid moves on full grid with adjacent equals', () => {
  // Horizontal neighbor match
  const gridH = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [2, 4, 4, 8],
    [16, 32, 64, 128]
  ];
  assert.strictEqual(Logic.canMove(gridH), true);

  // Vertical neighbor match
  const gridV = [
    [2, 4, 8, 16],
    [32, 4, 128, 256],
    [2, 64, 512, 8],
    [16, 32, 64, 128]
  ];
  assert.strictEqual(Logic.canMove(gridV), true);
});

it('canMove detects game over when no moves are possible', () => {
  const gridJammed = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2]
  ];
  assert.strictEqual(Logic.canMove(gridJammed), false);
});

it('Triggers win state when tile reaches target', () => {
  const game = Logic.createGame({ size: 4, target: 2048 });
  game.grid = [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.makeMove(game, 'left', () => 0.5);
  assert.strictEqual(res.moved, true);
  assert.strictEqual(res.newlyWon, true);
  assert.strictEqual(game.hasWon, true);
  assert.strictEqual(game.grid[0][0], 2048);
});

it('Undo restores previous grid, score, and moves', () => {
  const game = Logic.createGame({ size: 4 });
  const initialGrid = Logic.cloneGrid(game.grid);
  const initialScore = game.score;

  // Perform a move
  const moveRes = Logic.makeMove(game, 'left', () => 0);
  if (moveRes.moved) {
    const undoSuccess = Logic.undo(game);
    assert.strictEqual(undoSuccess, true);
    assert.deepStrictEqual(game.grid, initialGrid);
    assert.strictEqual(game.score, initialScore);
    assert.strictEqual(game.moves, 0);
  }
});

it('Undo returns false on empty history', () => {
  const game = Logic.createGame({ size: 4 });
  assert.strictEqual(Logic.undo(game), false);
});

it('Serializes and deserializes game state accurately', () => {
  const game = Logic.createGame({ size: 4 });
  game.score = 520;
  game.moves = 42;
  game.grid[1][1] = 128;

  const json = Logic.serialize(game);
  const restored = Logic.deserialize(json);

  assert.strictEqual(restored.size, 4);
  assert.strictEqual(restored.score, 520);
  assert.strictEqual(restored.moves, 42);
  assert.strictEqual(restored.grid[1][1], 128);
});


// ---------- v1.1: stones, move limits, journey, transitions ----------
const S = Logic.STONE;

it('Stones split a line: tiles stop at and never cross a stone', () => {
  const res = Logic.slideLineLeft([0, 2, S, 2]);
  assert.deepStrictEqual(res.line, [2, 0, S, 2]);
  assert.strictEqual(res.scoreGained, 0);
});

it('Stones never merge with each other and never move', () => {
  const grid = [
    [S, S, 0],
    [0, 0, 0],
    [0, 2, 0]
  ];
  const res = Logic.slide(grid, 'down');
  assert.strictEqual(res.grid[0][0], S);
  assert.strictEqual(res.grid[0][1], S);
  assert.strictEqual(res.grid[2][1], 2);
  assert.strictEqual(res.moved, false);
});

it('canMove ignores adjacent stones (no false positive)', () => {
  const grid = [
    [S, S, 2],
    [4, 8, 4],
    [2, 4, 2]
  ];
  assert.strictEqual(Logic.canMove(grid), false);
});

it('createGame places stones and spawns tiles only on empty cells', () => {
  const g = Logic.createGame({ size: 4, stones: [[1, 2], [3, 0]] });
  assert.strictEqual(g.grid[1][2], S);
  assert.strictEqual(g.grid[3][0], S);
  let tiles = 0;
  g.grid.forEach(row => row.forEach(v => { if (v > 0) tiles++; }));
  assert.strictEqual(tiles, 2);
});

it('Transitions map every moving tile to its destination', () => {
  const grid = [
    [0, 2, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 0]
  ];
  const res = Logic.slide(grid, 'left');
  const fromTo = res.transitions.map(t => `${t.from.r},${t.from.c}->${t.to.r},${t.to.c}`).sort();
  assert.deepStrictEqual(fromTo, ['0,1->0,0', '0,3->0,0', '3,0->3,0'].sort());
  assert.deepStrictEqual(res.merges, [{ r: 0, c: 0, value: 4 }]);
});

it('Move limit ends the game when the goal was not reached', () => {
  const g = Logic.createGame({ size: 4, target: 2048, moveLimit: 1 });
  g.grid = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.makeMove(g, 'right', () => 0);
  assert.strictEqual(res.moved, true);
  assert.strictEqual(g.isGameOver, true);
  assert.strictEqual(g.outOfMoves, true);
  assert.strictEqual(Logic.movesLeft(g), 0);
});

it('Reaching the goal on the last allowed move is a win, not a loss', () => {
  const g = Logic.createGame({ size: 4, target: 8, moveLimit: 1 });
  g.grid = [
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const res = Logic.makeMove(g, 'left', () => 0.99);
  assert.strictEqual(res.newlyWon, true);
  assert.strictEqual(g.isGameOver, false);
  assert.strictEqual(g.outOfMoves, false);
});

it('Undo limit is enforced and counts down', () => {
  const g = Logic.createGame({ size: 4, undoLimit: 1 });
  g.grid = [
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  Logic.makeMove(g, 'right', () => 0);
  Logic.makeMove(g, 'down', () => 0);
  assert.strictEqual(Logic.undo(g), true);
  assert.strictEqual(g.undosLeft, 0);
  assert.strictEqual(Logic.canUndo(g), false);
  assert.strictEqual(Logic.undo(g), false);
});

it('Undo clears game-over and keeps an acknowledged win', () => {
  const g = Logic.createGame({ size: 4, target: 4 });
  g.grid = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  Logic.makeMove(g, 'left', () => 0);
  assert.strictEqual(g.hasWon, true);
  g.wonAcknowledged = true;
  Logic.undo(g);
  assert.strictEqual(g.hasWon, true, 'win is not re-triggered after Keep playing');
  g.isGameOver = true;
  Logic.makeMove(g, 'right');
  assert.strictEqual(Logic.makeMove(g, 'right').moved, false);
});

it('Journey has 24 well-formed stages', () => {
  assert.strictEqual(Logic.JOURNEY.length, 24);
  Logic.JOURNEY.forEach((lv, i) => {
    assert.strictEqual(lv.stage, i + 1);
    assert.ok(lv.size >= 3 && lv.size <= 6);
    assert.ok(lv.target >= 64 && (lv.target & (lv.target - 1)) === 0);
    assert.ok(lv.par > 0);
    assert.ok(lv.stones.length < lv.size * lv.size / 3);
    lv.stones.forEach(([r, c]) => assert.ok(r >= 0 && r < lv.size && c >= 0 && c < lv.size));
    const g = Logic.createGame(lv);
    assert.strictEqual(Logic.getEmptyCells(g.grid).length, lv.size * lv.size - lv.stones.length - 2);
  });
});

it('Classic difficulties cover 3x3 to 6x6', () => {
  assert.deepStrictEqual(Object.keys(Logic.CLASSIC).map(Number), [3, 4, 5, 6]);
  assert.strictEqual(Logic.CLASSIC[4].target, 2048);
});

it('starsFor awards 3/2/1 stars by moves vs par', () => {
  const lv = Logic.JOURNEY[0];
  assert.strictEqual(Logic.starsFor(lv, lv.par), 3);
  assert.strictEqual(Logic.starsFor(lv, lv.par + 1), 2);
  assert.strictEqual(Logic.starsFor(lv, lv.par * 3), 1);
});

it('Serialize round-trips stones, limits, undo budget and history', () => {
  const g = Logic.createGame({ size: 5, target: 512, stones: [[2, 2]], moveLimit: 50, undoLimit: 3 });
  g.grid = Logic.createEmptyGrid(5);
  g.grid[2][2] = S;
  g.grid[0][4] = 2;
  Logic.makeMove(g, 'left', () => 0);
  const r = Logic.deserialize(Logic.serialize(g));
  assert.strictEqual(r.grid[2][2], S);
  assert.strictEqual(r.moveLimit, 50);
  assert.strictEqual(r.undosLeft, 3);
  assert.strictEqual(r.history.length, 1);
  assert.strictEqual(Logic.undo(r), true);
});

it('Deserialize rejects corrupt saves', () => {
  assert.strictEqual(Logic.deserialize('not json'), null);
  assert.strictEqual(Logic.deserialize(JSON.stringify({ grid: [[3, 0], [0, 0]] })), null);
  assert.strictEqual(Logic.deserialize(JSON.stringify({ grid: [[0, 0, 0], [0, 7, 0], [0, 0, 0]] })), null);
});

it('Random play always terminates with a consistent game state', () => {
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const dirs = ['left', 'up', 'right', 'down'];
  for (const lv of Logic.JOURNEY.slice(0, 8)) {
    const g = Logic.createGame(Object.assign({ randomFn: rng }, lv));
    let guard = 0;
    while (!g.isGameOver && !g.hasWon && guard++ < 5000) {
      Logic.makeMove(g, dirs[Math.floor(rng() * 4)], rng);
    }
    assert.ok(g.isGameOver || g.hasWon);
    lv.stones.forEach(([r, c]) => assert.strictEqual(g.grid[r][c], S));
  }
});

console.log(`\nResults: ${passed}/${passed + failed} tests passed.\n`);
if (failed > 0) {
  process.exit(1);
}
