/**
 * Проверка RTP: точный аналитический расчёт (с учётом wild) + Монте-Карло.
 * Использует ТОТ ЖЕ конфиг, что и игра (src/game/config.ts).
 *
 * Запуск: npm run simulate [-- spins]
 */
import {
  evaluate,
  gridFromStops,
  pickStops,
} from '../src/game/math';
import { LINE_BETS, LINES, STRIPS, SYMBOL_BY_ID, type SymbolId } from '../src/game/config';
import { mulberry32 } from '../src/core/rng';

/**
 * Точный расчёт по одной линии: перебор всех кортежей символов
 * (s0..s4) с их вероятностями; для каждого кортежа — лучший
 * wild-кандидат (та же логика, что в evaluate()).
 */
function exactExpectation(lineBetIndex: number): { rtp: number; perSymbol: Map<SymbolId, number> } {
  const perReel = STRIPS.map((strip) => {
    const m = new Map<SymbolId, number>();
    for (const s of strip) m.set(s, (m.get(s) ?? 0) + 1);
    for (const [k, v] of m) m.set(k, v / strip.length);
    return [...m.entries()];
  });

  const perSymbol = new Map<SymbolId, number>();
  let totalPerLineBet = 0; // ожидание на линию при lineBet = 1

  const bestLinePay = (tuple: SymbolId[]): { s: SymbolId; pay: number } | null => {
    let best: { s: SymbolId; pay: number } | null = null;
    for (const s of new Set<SymbolId>(tuple)) {
      let count = 0;
      while (count < 5 && (tuple[count] === s || tuple[count] === 'wild')) count++;
      if (count < 3) continue;
      const pay = SYMBOL_BY_ID[s].pays[count - 3];
      if (best === null || pay > best.pay) best = { s, pay };
    }
    return best;
  };

  const rec = (line: readonly number[], r: number, tuple: SymbolId[], prob: number): void => {
    if (r === 5) {
      const w = bestLinePay(tuple);
      if (w) {
        totalPerLineBet += prob * w.pay;
        perSymbol.set(w.s, (perSymbol.get(w.s) ?? 0) + prob * w.pay);
      }
      return;
    }
    for (const [s, p] of perReel[r]) {
      tuple.push(s);
      rec(line, r + 1, tuple, prob * p);
      tuple.pop();
    }
  };

  for (let li = 0; li < LINES.length; li++) rec(LINES[li], 0, [], 1);

  return { rtp: totalPerLineBet / LINES.length, perSymbol };
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
  console.log(`\nТочный расчёт (аналитический, с wild):`);
  console.log(`  RTP ≈ ${(rtp * 100).toFixed(2)}%`);
  for (const [id, v] of [...perSymbol.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${id.padEnd(10)} вклад в RTP: ${(v * 100).toFixed(2)}%`);
  }

  // Монте-Карло
  const rng = mulberry32(20260925);
  let totalWin = 0;
  let hits = 0;
  const dist = new Map<number, number>();
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
      dist.set(x, (dist.get(x) ?? 0) + 1);
    }
  }
  const mcRtp = totalWin / (spins * totalBet);
  console.log(`\nМонте-Карло (${spins.toLocaleString('ru')} спинов, ${((Date.now() - t0) / 1000).toFixed(1)} с):`);
  console.log(`  RTP  = ${(mcRtp * 100).toFixed(2)}%`);
  console.log(`  Hit rate = ${((hits / spins) * 100).toFixed(2)}%`);
  const top = [...dist.entries()]
    .map(([x, n]) => [x, n] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 8);
  console.log('  Крупнейшие выплаты (×общей ставки : частота):');
  for (const [x, n] of top) console.log(`    ${String(x).padStart(5)}× : 1 к ${Math.round(spins / n).toLocaleString('ru')}`);

  const ok = mcRtp >= 0.92 && mcRtp <= 0.96;
  console.log(`\nЦелевой диапазон 92–96%: ${ok ? '✔ ВЫПОЛНЕН' : '✘ НЕ ВЫПОЛНЕН — подстроить STRIP_COUNTS/pays'}`);
  process.exitCode = ok ? 0 : 1;
}

main();
