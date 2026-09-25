/**
 * Проверка RTP: точный аналитический расчёт + Монте-Карло.
 * Использует ТОТ ЖЕ конфиг, что и игра (src/game/config.ts).
 *
 * Запуск: npm run simulate [-- spins]
 */
import {
  evaluate,
  gridFromStops,
  pickStops,
} from '../src/game/math';
import { LINE_BETS, LINES, STRIPS, SYMBOLS, mulberry32Seed } from './simulate-shared';

function exactExpectation(lineBetIndex: number): { rtp: number; perSymbol: Map<string, number> } {
  // Вероятность символа s на барабане r в конкретной строке линии:
  // q = count_r(s) / len_r (позиция остановки равномерна, ленты без соседних
  // одинаковых символов — приближение точное с высокой точностью).
  const q = STRIPS.map((strip) => {
    const m = new Map<string, number>();
    for (const s of strip) m.set(s, (m.get(s) ?? 0) + 1);
    for (const [k, v] of m) m.set(k, v / strip.length);
    return m;
  });

  const lineBet = LINE_BETS[lineBetIndex];
  const perSymbol = new Map<string, number>();
  let rtp = 0;

  for (let li = 0; li < LINES.length; li++) {
    for (const sym of SYMBOLS) {
      const ps = q.map((m) => m.get(sym.id) ?? 0);
      const p3 = ps[0] * ps[1] * ps[2];
      const p4 = p3 * ps[3];
      const p5 = p4 * ps[4];
      const pays = sym.pays;
      const exp = (p3 * (1 - ps[3]) * pays[0] + p4 * (1 - ps[4]) * pays[1] + p5 * pays[2]) * lineBet;
      rtp += exp;
      perSymbol.set(sym.id, (perSymbol.get(sym.id) ?? 0) + exp);
    }
  }
  // RTP относительно общей ставки = 10 × lineBet; LINES.length = 10,
  // поэтому rtp (сумма по 10 линиям) уже нормирована корректно.
  return { rtp: rtp / (LINE_BETS[lineBetIndex] * LINES.length), perSymbol };
}

function main() {
  const spins = Number(process.argv[2] ?? 10_000_000);
  const lineBetIndex = 3;
  const lineBet = LINE_BETS[lineBetIndex];
  const totalBet = lineBet * LINES.length;

  console.log('══════════════════════════════════════════════════');
  console.log(' GRIM FORTUNE — проверка математической модели');
  console.log('══════════════════════════════════════════════════');

  const { rtp, perSymbol } = exactExpectation(lineBetIndex);
  console.log(`\nТочный расчёт (аналитический):`);
  console.log(`  RTP ≈ ${(rtp * 100).toFixed(2)}%`);
  for (const [id, v] of [...perSymbol.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${id.padEnd(10)} вклад в RTP: ${((v / (totalBet)) * 100).toFixed(2)}%`);
  }

  // Монте-Карло
  const rng = mulberry32Seed(20260925);
  let totalWin = 0;
  let hits = 0;
  const dist = new Map<string, number>();
  const t0 = Date.now();
  for (let i = 0; i < spins; i++) {
    const stops = pickStops(rng);
    const grid = gridFromStops(stops);
    const wins = evaluate(grid, lineBetIndex);
    const pay = wins.reduce((s, w) => s + w.pay, 0);
    totalWin += pay;
    if (pay > 0) {
      hits++;
      const x = Math.round(pay / totalBet);
      dist.set(String(x), (dist.get(String(x)) ?? 0) + 1);
    }
  }
  const mcRtp = totalWin / (spins * totalBet);
  console.log(`\nМонте-Карло (${spins.toLocaleString('ru')} спинов, ${((Date.now() - t0) / 1000).toFixed(1)} с):`);
  console.log(`  RTP  = ${(mcRtp * 100).toFixed(2)}%`);
  console.log(`  Hit rate = ${((hits / spins) * 100).toFixed(2)}%`);
  const top = [...dist.entries()]
    .map(([x, n]) => [Number(x), n] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 8);
  console.log('  Крупнейшие выплаты (×общая ставки : частота):');
  for (const [x, n] of top) console.log(`    ${String(x).padStart(5)}× : 1 к ${Math.round(spins / n).toLocaleString('ru')}`);

  const ok = mcRtp >= 0.92 && mcRtp <= 0.96;
  console.log(`\nЦелевой диапазон 92–96%: ${ok ? '✔ ВЫПОЛНЕН' : '✘ НЕ ВЫПОЛНЕН — подстроить STRIP_COMPOSITION/pays'}`);
  process.exitCode = ok ? 0 : 1;
}

main();
