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

console.log(`\nResults: ${passed}/${passed + failed} tests passed.\n`);
if (failed > 0) {
  process.exit(1);
}
