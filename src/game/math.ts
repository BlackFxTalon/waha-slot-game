/**
 * Математика слота: генерация исхода и оценка выигрыша.
 * Чистые функции, без зависимостей — используются игрой и инструментами.
 */
import { LINES, LINE_BETS, REELS, ROWS, STRIPS, SYMBOL_BY_ID, type SymbolId } from './config';
import type { Rng } from '../core/rng';

/** Сетка исхода: grid[reel][row] → символ. */
export type Grid = SymbolId[][];

export interface LineWin {
  /** Индекс линии в LINES. */
  lineIndex: number;
  symbol: SymbolId;
  /** Длина серии (3, 4 или 5). */
  count: number;
  /** Позиции выигрышных символов: [reel, row]. */
  cells: Array<readonly [number, number]>;
  /** Выплата в кредитах (уже с учётом ставки на линию). */
  pay: number;
}

export interface SpinResult {
  grid: Grid;
  /** Индексы остановки каждого барабана (позиция в STRIPS). */
  stops: number[];
  wins: LineWin[];
  /** Суммарная выплата в кредитах. */
  totalPay: number;
}

/**
 * Случайная остановка барабанов: равномерный выбор позиции в ленте.
 * Исход фиксируется ДО начала анимации и больше не меняется.
 */
export function pickStops(rng: Rng): number[] {
  return STRIPS.map((strip) => Math.floor(rng() * strip.length));
}

/** Видимая сетка 5×3 для заданных остановок: row r = strip[(stop + r) % len]. */
export function gridFromStops(stops: number[]): Grid {
  return STRIPS.map((strip, reel) => {
    const len = strip.length;
    const stop = stops[reel] % len;
    return [strip[stop], strip[(stop + 1) % len], strip[(stop + 2) % len]];
  });
}

/** Полный исход спина: сетка + оценка линий. */
export function spinResult(stops: number[], lineBetIndex: number): SpinResult {
  const grid = gridFromStops(stops);
  const wins = evaluate(grid, lineBetIndex);
  const totalPay = wins.reduce((s, w) => s + w.pay, 0);
  return { grid, stops, wins, totalPay };
}

/**
 * Оценка выигрыша: по всем линиям слева направо, серии 3/4/5.
 * Wild заменяет любой символ; для каждой линии выбирается лучший кандидат
 * (максимальная выплата) среди всех символов, встречающихся на линии.
 */
export function evaluate(grid: Grid, lineBetIndex: number): LineWin[] {
  const lineBet = LINE_BETS[lineBetIndex];
  const wins: LineWin[] = [];
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    const onLine: SymbolId[] = [];
    for (let r = 0; r < REELS; r++) onLine.push(grid[r][line[r]]);

    let best: LineWin | null = null;
    for (const s of new Set<SymbolId>(onLine)) {
      // Длина серии с левого края: кандидат s или wild
      let count = 0;
      while (count < REELS && (onLine[count] === s || onLine[count] === 'wild')) count++;
      if (count < 3) continue;
      const pay = SYMBOL_BY_ID[s].pays[count - 3] * lineBet;
      if (best !== null && pay <= best.pay) continue;
      const cells: Array<readonly [number, number]> = [];
      for (let r = 0; r < count; r++) cells.push([r, line[r]] as const);
      best = { lineIndex: li, symbol: s, count, cells, pay };
    }
    if (best) wins.push(best);
  }
  return wins;
}

/**
 * Anticipation 5-го барабана: есть ли после 4 барабанов серия из 4 совпадений
 * (одинаковый символ или wild). Решается по сетке, а не по анимации.
 */
export function needsAnticipation(grid: Grid): boolean {
  for (const line of LINES) {
    let base: SymbolId | null = null;
    for (let r = 0; r < 4; r++) {
      const c = grid[r][line[r]];
      if (c !== 'wild') {
        base = c;
        break;
      }
    }
    if (base === null) return true; // четыре wild подряд
    let count = 0;
    while (count < 4) {
      const c = grid[count][line[count]];
      if (c === base || c === 'wild') count++;
      else break;
    }
    if (count === 4) return true;
  }
  return false;
}

export const GRID_INFO = { REELS, ROWS };
