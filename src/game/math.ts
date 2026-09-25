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
 * Оценка выигрыша: по всем линиям слева направо, 3/4/5 одинаковых.
 * Выплата = pays[count-3] × ставка_на_линию.
 */
export function evaluate(grid: Grid, lineBetIndex: number): LineWin[] {
  const lineBet = LINE_BETS[lineBetIndex];
  const wins: LineWin[] = [];
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    const first: SymbolId = grid[0][line[0]];
    let count = 1;
    while (count < REELS && grid[count][line[count]] === first) count++;
    if (count < 3) continue;
    const def = SYMBOL_BY_ID[first];
    const pay = def.pays[count - 3] * lineBet;
    const cells: Array<readonly [number, number]> = [];
    for (let r = 0; r < count; r++) cells.push([r, line[r]] as const);
    wins.push({ lineIndex: li, symbol: first, count, cells, pay });
  }
  return wins;
}

/**
 * Anticipation 5-го барабана: есть ли после 4 барабанов серия из 4 одинаковых.
 * (Используется презентацией; решается по сетке, а не по анимации.)
 */
export function needsAnticipation(grid: Grid): boolean {
  for (const line of LINES) {
    const s0 = grid[0][line[0]];
    let count = 1;
    while (count < 4 && grid[count][line[count]] === s0) count++;
    if (count === 4) return true;
  }
  return false;
}

export const GRID_INFO = { REELS, ROWS };
