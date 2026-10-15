// Headless browser smoke test for Zen2048 (www/ build).
// Uses playwright-core with a system Chrome/Chromium (set CHROME_PATH to override).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executablePath = candidates.find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { failures++; console.error('  ✗', msg); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
// Overlays fade out; wait for the transition before asserting they are gone.
const gone = (page, sel) => page.waitForSelector(sel, { state: 'hidden', timeout: 2000 }).then(() => true, () => false);

// Replace the board with a fixed grid (test helper; stones = -1).
async function setGrid(page, grid, extra = {}) {
  await page.evaluate(([g, x]) => {
    const game = Zen2048App.getGame();
    game.grid = g;
    Object.assign(game, x);
    Zen2048App.rerender();
  }, [grid, extra]);
}
const grid = page => page.evaluate(() => Zen2048App.getGame().grid);

async function swipe(page, cdp, dir, isMobile) {
  const box = await page.locator('#board-container').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const d = { left: [-120, 0], right: [120, 0], up: [0, -120], down: [0, 120] }[dir];
  if (isMobile) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + d[0] / 2, y: cy + d[1] / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + d[0], y: cy + d[1] }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + d[0], cy + d[1], { steps: 4 });
    await page.mouse.up();
  }
  await page.waitForTimeout(160);
}

async function run(label, viewport, isMobile) {
  console.log(`\n[${label}] ${viewport.width}x${viewport.height}`);
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  ok(await page.isVisible('#menu-screen'), 'main menu visible on launch');
  ok(await page.isHidden('#menu-continue'), 'no Continue button on fresh install');

  // ---- Classic 4x4
  await page.click('.menu-diff [data-size="4"]');
  ok(await gone(page, '#menu-screen'), 'menu hides when starting a game');
  ok((await page.textContent('#mode-label')).includes('Classic 4×4'), 'mode label shows Classic 4×4');
  ok(await page.locator('#grid-bg .grid-cell').count() === 16, '4×4 board has 16 cells');
  ok(await page.locator('#tile-layer .tile').count() === 2, 'new board starts with 2 tiles');

  await setGrid(page, [[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]]);
  await swipe(page, cdp, 'left', isMobile);
  let g = await grid(page);
  ok(g[0][0] === 2 && g[3][0] === 2, `${isMobile ? 'touch swipe' : 'mouse drag'} slides tiles left`);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(160);
  g = await grid(page);
  ok(g[0][0] === 4, 'arrow key Up merges 2+2 into 4');
  ok((await page.textContent('#current-score')) === '4', 'score updated after merge');
  ok((await page.textContent('#moves-value')) === '2', 'move counter updated');
  await page.click('#undo-btn');
  g = await grid(page);
  ok(g[0][0] === 2 && g[3][0] === 2 && (await page.textContent('#current-score')) === '0', 'undo restores previous board and score');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(160);

  // ---- Pause / resume
  await page.click('#pause-btn');
  ok(await page.isVisible('#pause-modal'), 'pause dialog opens');
  ok(await page.evaluate(() => document.body.classList.contains('is-paused') && Zen2048App.isPaused()), 'board hidden and game paused');
  const before = JSON.stringify(await grid(page));
  await page.keyboard.press('ArrowDown');
  ok(JSON.stringify(await grid(page)) === before, 'input ignored while paused');
  await page.click('#pause-resume');
  ok(await gone(page, '#pause-modal') && !(await page.evaluate(() => Zen2048App.isPaused())), 'resume closes the dialog');
  if (!isMobile) {
    await page.keyboard.press('Escape');
    ok(await page.isVisible('#pause-modal'), 'Escape pauses');
    await page.keyboard.press('Escape');
    ok(await gone(page, '#pause-modal'), 'Escape resumes');
  }

  // ---- Save + Continue
  const score = await page.textContent('#current-score');
  ok(await page.evaluate(() => !!localStorage.getItem('zen2048_saved_v2')), 'in-progress board saved to localStorage');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(200);
  ok(await page.isVisible('#menu-continue'), 'Continue offered after reload');
  await page.click('#menu-continue');
  ok((await page.textContent('#current-score')) === score, 'Continue restores the board');

  // ---- Game over + undo from the result dialog
  await page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
  await setGrid(page, [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [0, 8, 16, 8]]);
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector('#result-modal.open', { timeout: 3000 });
  ok((await page.textContent('#result-title')).includes('No moves left'), 'game over dialog when the board locks');
  ok(await page.isVisible('#result-undo'), 'Undo offered on game over');
  await page.click('#result-undo');
  ok(await page.evaluate(() => !Zen2048App.getGame().isGameOver), 'undo from game over revives the board');
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector('#result-modal.open', { timeout: 3000 });
  await page.click('#result-retry');
  ok(await page.evaluate(() => Zen2048App.getGame().moves === 0 && !Zen2048App.getGame().isGameOver), 'Try again starts a fresh board');

  // ---- Classic win + keep playing
  await setGrid(page, [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector('#result-modal.open', { timeout: 3000 });
  ok((await page.textContent('#result-title')).includes('2048'), 'win dialog on reaching 2048');
  await page.click('#result-continue');
  ok(await gone(page, '#result-modal'), 'Keep playing closes the dialog');
  const movesBefore = await page.evaluate(() => Zen2048App.getGame().moves);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(160);
  ok(await page.evaluate(m => Zen2048App.getGame().moves === m + 1, movesBefore), 'play continues after the goal');
  await page.evaluate(() => { Math.random = window.__rand; });

  // ---- Settings
  await page.click('#settings-btn');
  ok(await page.isVisible('#settings-modal'), 'settings open');
  await page.click('label:has(#set-sound)');
  ok(await page.evaluate(() => localStorage.getItem('zen2048_sound') === '0'), 'sound toggle persists (off)');
  ok((await page.textContent('#sound-toggle')).includes('🔇'), 'header sound icon reflects mute');
  await page.selectOption('#set-theme', 'light');
  ok(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), 'theme switch applies');
  await page.click('label:has(#set-anim)');
  ok(await page.evaluate(() => document.body.classList.contains('no-anim') && localStorage.getItem('zen2048_anim') === '0'), 'animation toggle applies and persists');
  await page.click('label:has(#set-anim)');
  await page.click('#settings-modal .modal-footer .close-modal-btn');
  ok(await gone(page, '#settings-modal'), 'settings close');

  // ---- Journey
  await page.evaluate(() => Zen2048App.showMenu());
  await gone(page, '#settings-modal');
  await page.click('#menu-journey');
  ok(await page.locator('#journey-grid .stage-btn').count() === 24, 'journey lists 24 stages');
  ok(await page.locator('#journey-grid .stage-btn.locked').count() === 23, 'only stage 1 unlocked initially');
  await page.click('#journey-grid .stage-btn >> nth=0');
  ok((await page.textContent('#mode-label')).includes('Stage 1'), 'stage 1 started');
  ok((await page.textContent('#goal-label')).includes('64'), 'goal chip shows 64');
  await setGrid(page, [[32, 32, 0], [0, 0, 0], [0, 0, 0]]);
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector('#result-modal.open', { timeout: 3000 });
  ok((await page.textContent('#result-title')).includes('Stage 1 cleared'), 'stage cleared dialog');
  ok(await page.locator('#result-stars .star.on').count() === 3, '3 stars for a 1-move clear');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('zen2048_progress')).unlocked === 2), 'stage 2 unlocked in localStorage');
  await page.click('#result-next');
  ok((await page.textContent('#mode-label')).includes('Stage 2'), 'Next stage starts stage 2');

  // Move-limited stage
  await page.evaluate(() => Zen2048App.startSession({ mode: 'journey', stage: 5 }));
  ok((await page.textContent('#moves-label')) === 'Moves left' && (await page.textContent('#moves-value')) === '100', 'move-limited stage shows moves left');
  ok((await page.textContent('#undo-text')) === 'Undo (3)', 'journey shows undo budget');
  await setGrid(page, [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], { moves: 99 });
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('#result-modal.open', { timeout: 3000 });
  ok((await page.textContent('#result-title')).includes('Out of moves'), 'out-of-moves dialog when the limit is hit');
  await page.click('#result-menu');
  ok(await page.isVisible('#menu-screen'), 'Main menu from result dialog');
  ok(await page.isHidden('#menu-continue'), 'finished board is not offered as Continue');

  // Stone stage renders stones
  await page.evaluate(() => Zen2048App.startSession({ mode: 'journey', stage: 6 }));
  ok(await page.locator('#grid-bg .grid-cell.stone').count() === 1, 'stone stage renders its stone');

  // ---- Stats + reset
  await page.evaluate(() => Zen2048App.showMenu());
  await page.click('#menu-stats');
  ok(Number(await page.textContent('#stat-played')) >= 3, 'stats count games played');
  await page.click('#stats-modal .modal-footer .close-modal-btn');
  await gone(page, '#stats-modal');
  await page.click('#menu-settings');
  await page.click('#set-reset');
  await page.click('#set-reset');
  ok(await page.evaluate(() => !localStorage.getItem('zen2048_progress') && !localStorage.getItem('zen2048_stats')), 'reset clears progress and stats');

  ok(await page.evaluate(() => !!window.ZenAds && window.ZenAds.isAvailable() === false), 'ads are a no-op on the web build');
  await wait(100);
  ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

try {
  await run('mobile', { width: 390, height: 844 }, true);
  await run('desktop', { width: 1280, height: 800 }, false);
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\nSMOKE FAILED (${failures})` : '\nSMOKE PASSED');
process.exit(failures ? 1 : 0);
