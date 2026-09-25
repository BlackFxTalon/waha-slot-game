/**
 * Runtime smoke-тест: запускает vite preview, открывает игру в headless
 * Chromium, делает спины, проверяет отсутствие ошибок консоли,
 * сохранение баланса и снимает скриншоты.
 *
 * Запуск: node tools/smoke.mjs
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 4173;
const GAME_URL = `http://127.0.0.1:${PORT}/`;
const shotsDir = new URL('../screenshots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function waitForServer(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve();
      } catch { /* ещё не поднялся */ }
      if (Date.now() - t0 > timeoutMs) return reject(new Error('preview server не поднялся'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

/** Убивает процессы, слушающие порт (Windows: netstat+taskkill). */
function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { shell: true }).toString();
    const pids = new Set(
      out
        .split('\n')
        .map((l) => l.trim().split(/\s+/).pop())
        .filter((p) => /^\d+$/.test(p) && p !== String(process.pid)),
    );
    for (const pid of pids) {
      try { execSync(`taskkill /F /T /PID ${pid}`, { shell: true, stdio: 'ignore' }); } catch { /* уже мёртв */ }
    }
  } catch { /* порт свободен */ }
}

killPort(PORT); // зачистка хвостов прошлых запусков

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
});

const errors = [];
const pageErrors = [];
let failed = false;

try {
  await waitForServer(GAME_URL);
  mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(GAME_URL + '?debug=1&forceWin=1', { waitUntil: 'networkidle' });

  // Ждём загрузку ассетов и инициализацию (канвас + фон)
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shotsDir + '01-idle.png' });

  // Первый спин кликом по спин-кнопке (центр внизу)
  const canvas = await page.locator('canvas').boundingBox();
  const scale = Math.min(canvas.width / 1920, canvas.height / 1080);
  const offX = (canvas.width - 1920 * scale) / 2;
  const offY = (canvas.height - 1080 * scale) / 2;
  const px = (x, y) => [offX + x * scale, offY + y * scale];

  await page.mouse.click(...px(960, 1006)); // спин
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shotsDir + '02-spinning.png' });

  // Ждём остановки барабанов и захватываем презентацию выигрыша (forceWin)
  await page.waitForFunction(() => {
    const d = window.__grim;
    return d && !d.spinning();
  }, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: shotsDir + '03-win-presentation.png' });

  // Ждём завершения презентации
  await page.waitForFunction(() => {
    const d = window.__grim;
    return d && !d.spinning() && d.state() === 'idle';
  }, { timeout: 20000 });
  const check = await page.evaluate(() => {
    const d = window.__grim;
    return { grid: d.grid(), result: d.result() };
  });
  if (JSON.stringify(check.grid) !== JSON.stringify(check.result.grid)) {
    errors.push(`Сетка не совпала с исходом!\n показано: ${JSON.stringify(check.grid)}\n исход:    ${JSON.stringify(check.result.grid)}`);
  }

  // Сохранение баланса: должно появиться в localStorage
  const saved = await page.evaluate(() => localStorage.getItem('grim-fortune:save:v1'));
  const expectedBalance = 10000 - 100 + (check.result?.totalPay ?? 0);
  const saveOk = saved !== null && JSON.parse(saved).balance === expectedBalance;
  if (!saveOk) errors.push(`Баланс после спина не сохранился: ${saved}, ожидалось ${expectedBalance}`);

  // Ещё спины клавишей Space; Space в презентации = skip, в покое = новый спин
  const waitIdle = (timeout) => page.waitForFunction(() => {
    const d = window.__grim;
    return d && !d.spinning() && d.state() === 'idle';
  }, { timeout });
  const waitSpinning = (timeout) => page.waitForFunction(() => {
    const d = window.__grim;
    return d && d.spinning();
  }, { timeout });

  await page.keyboard.press('Space'); // skip презентации (если шла) или старт спина
  await waitIdle(60000);               // idle — гарантированно (даём презентации доиграть)
  await page.keyboard.press('Space'); // старт спина #2
  await waitSpinning(15000);
  await page.waitForTimeout(600);
  await page.keyboard.press('Space'); // skip
  await waitIdle(60000);
  const r2 = await page.evaluate(() => {
    const d = window.__grim;
    return { pay: d.result().totalPay, grid: d.grid() };
  });
  console.log(`  спин #2: выплата=${r2.pay}`);
  if (r2.result && r2.grid && JSON.stringify(r2.grid) !== JSON.stringify(r2.result.grid)) {
    errors.push(`Сетка спина #2 не совпала с исходом`);
  }
  await page.keyboard.press('Space'); // skip
  await page.waitForTimeout(4000);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const d = window.__grim;
    return d && !d.spinning() && d.state() === 'idle';
  }, { timeout: 25000 });
  const r3 = await page.evaluate(() => {
    const d = window.__grim;
    return { pay: d.result().totalPay, balance: d.balance ? null : null, save: JSON.parse(localStorage.getItem('grim-fortune:save:v1')) };
  });
  console.log(`  спин #3: выплата=${r3.pay}, баланс=${r3.save.balance}`);
  const hist = await page.evaluate(() => window.__grim.history());
  console.log('  история:', JSON.stringify(hist));
  await page.screenshot({ path: shotsDir + '04-after-3-spins.png' });

  // Портрет (мобильный): спин кнопкой, проверка баланса
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(GAME_URL + '?debug=1', { waitUntil: 'networkidle' });
  await m.waitForSelector('canvas');
  await m.waitForTimeout(2200);
  await m.mouse.click(195, 706); // кнопка спина в портретной раскладке
  await m.waitForFunction(() => {
    const d = window.__grim;
    return d && d.spinning();
  }, { timeout: 15000 });
  await m.waitForFunction(() => {
    const d = window.__grim;
    return d && !d.spinning() && d.state() === 'idle';
  }, { timeout: 45000 });
  const mBal = await m.evaluate(() => {
    const d = window.__grim;
    return { balance: d.balance(), hist: d.history() };
  });
  await m.screenshot({ path: shotsDir + '11-portrait.png' });
  // Баланс должен сходиться: старт − ставка + выплата первого спина
  if (mBal.hist.length !== 1) {
    errors.push(`Портрет: спин не выполнен (история: ${JSON.stringify(mBal.hist)})`);
  } else {
    const expected = 10000 - 100 + mBal.hist[0].pay;
    if (mBal.balance !== expected) {
      errors.push(`Портрет: баланс ${mBal.balance} ≠ ожидаемых ${expected}`);
    }
  }
  await m.close();

  // Таблица выплат
  await page.keyboard.press('KeyI');
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotsDir + '05-paytable.png' });
  await page.keyboard.press('Escape');

  // Баланс после 3 спинов: 9900 - 200 + возможные выигрыши ≥ 0
  const saved2 = JSON.parse(await page.evaluate(() => localStorage.getItem('grim-fortune:save:v1')));
  if (typeof saved2.balance !== 'number' || saved2.balance < 0) {
    errors.push(`Некорректный баланс: ${JSON.stringify(saved2)}`);
  }

  await browser.close();

  failed = errors.length > 0 || pageErrors.length > 0;
  console.log('══════════ SMOKE ══════════');
  console.log(`Console errors : ${errors.length}`);
  errors.slice(0, 10).forEach((e) => console.log('  [console]', e.slice(0, 300)));
  console.log(`Page errors    : ${pageErrors.length}`);
  pageErrors.slice(0, 10).forEach((e) => console.log('  [pageerror]', e.slice(0, 300)));
  console.log(`Баланс в localStorage: ${saved2.balance} (ставка ${saved2.betIndex}, mute ${saved2.muted})`);
  console.log(`Скриншоты: ${shotsDir}`);
  writeFileSync(shotsDir + 'results.json', JSON.stringify({ errors, pageErrors, save: saved2 }, null, 2));
  console.log(failed ? '✘ SMOKE FAILED' : '✔ SMOKE PASSED');
} catch (e) {
  console.error('SMOKE ERROR:', e);
  failed = true;
} finally {
  try { server.kill(); } catch { /* завершён */ }
  killPort(PORT);
}
process.exit(failed ? 1 : 0);
