/**
 * Самопроверка математики: фиксированные сиды → известные сетки,
 * ручная проверка оценки линий.
 * Запуск: npm run selftest
 */
import assert from 'node:assert';
import { evaluate, gridFromStops, pickStops, spinResult, needsAnticipation } from '../src/game/math';
import { LINES, LINE_BETS, STRIPS } from '../src/game/config';
import { mulberry32 } from '../src/core/rng';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

console.log('GRIM FORTUNE — самопроверка математики\n');

test('детерминизм: один seed → одна сетка', () => {
  const a = gridFromStops(pickStops(mulberry32(42)));
  const b = gridFromStops(pickStops(mulberry32(42)));
  assert.deepStrictEqual(a, b);
});

test('исход не зависит от баланса/ставки: сетка одна и та же', () => {
  const stops = pickStops(mulberry32(7));
  const r1 = spinResult(stops, 0);
  const r2 = spinResult(stops, 6);
  assert.deepStrictEqual(r1.grid, r2.grid);
});

test('ленты не содержат соседних одинаковых символов (внутри ленты)', () => {
  for (const strip of STRIPS) {
    for (let i = 0; i < strip.length - 1; i++) {
      assert.ok(strip[i] !== strip[i + 1], `соседние ${strip[i]} в ленте`);
    }
  }
});

test('центральная линия из трёх корон оплачивается по таблице', () => {
  // Кроны в центральной строке (row 1) — по ним идёт линия 0
  const grid = [
    ['gemGreen', 'crown', 'gemBlue'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemRed', 'crown', 'gemRed'],
    ['seven', 'gemBlue', 'gemGreen'],
    ['star', 'gemGreen', 'gemBlue'],
  ] as const;
  const wins = evaluate(grid.map((r) => [...r]) as any, 3);
  const line0 = wins.find((w) => w.lineIndex === 0);
  assert.ok(line0, 'линия 0 должна выиграть');
  assert.strictEqual(line0.symbol, 'crown');
  assert.strictEqual(line0.count, 3);
  // crown pays[0] = 50, lineBet = LINE_BETS[3] = 10
  assert.strictEqual(line0.pay, 50 * LINE_BETS[3]);
});

test('пять корон по центру дают джекпот-выплату', () => {
  const grid = [
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemGreen', 'crown', 'gemBlue'],
    ['gemRed', 'crown', 'gemRed'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemGreen', 'crown', 'gemBlue'],
  ] as const;
  const wins = evaluate(grid.map((r) => [...r]) as any, 0);
  const line0 = wins.find((w) => w.lineIndex === 0)!;
  assert.strictEqual(line0.count, 5);
  assert.strictEqual(line0.pay, 15000 * LINE_BETS[0]); // crown 5ok = 15000
});

test('два одинаковых подряд не оплачиваются', () => {
  const grid = [
    ['gemGreen', 'crown', 'gemBlue'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemRed', 'seven', 'gemRed'],
    ['seven', 'gemBlue', 'gemGreen'],
    ['seven', 'gemGreen', 'gemBlue'],
  ] as const;
  const wins = evaluate(grid.map((r) => [...r]) as any, 3);
  assert.strictEqual(wins.length, 0);
});

test('несколько линий суммируются', () => {
  // Вся сетка из одного символа: выигрывают ВСЕ 10 линий пятёрками
  const grid = STRIPS.slice(0, 5).map(() => ['bell', 'bell', 'bell']) as any;
  const wins = evaluate(grid, 2);
  assert.strictEqual(wins.length, LINES.length);
  assert.strictEqual(wins.every((w) => w.count === 5), true);
});

test('anticipation: 4 короны слева требуют anticipation', () => {
  const grid = [
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemGreen', 'crown', 'gemBlue'],
    ['gemRed', 'crown', 'gemRed'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['seven', 'gemGreen', 'gemBlue'],
  ] as const;
  assert.strictEqual(needsAnticipation(grid.map((r) => [...r]) as any), true);
});

test('anticipation: без 4 в ряд — не требуется', () => {
  const grid = [
    ['gemGreen', 'crown', 'gemBlue'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemRed', 'seven', 'gemRed'],
    ['gemBlue', 'crown', 'gemGreen'],
    ['gemGreen', 'crown', 'gemBlue'],
  ] as const;
  assert.strictEqual(needsAnticipation(grid.map((r) => [...r]) as any), false);
});

console.log(`\nВсе проверки пройдены: ${passed}`);
