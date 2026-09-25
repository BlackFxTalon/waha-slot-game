/**
 * Конфигурация игры GRIM FORTUNE.
 * Единственный источник правды для математики и презентации.
 * Файл не зависит от pixi — используется и игрой, и инструментами
 * (tools/simulate.ts, tools/selftest.ts).
 */

/** Дизайн-разрешение канваса (scale-to-fit + letterbox). */
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

// ---------------------------------------------------------------------------
// Ассеты
// ---------------------------------------------------------------------------

/** Атлас символов: изображение 1254×1254, сетка 3×3, ячейка 418×418. */
export const ATLAS = {
  cols: 3,
  rows: 3,
  cell: 418,
} as const;

/** Фон с тёмной центральной зоной (измерено tools/analyze-bg.mjs). */
export const BG = {
  /** Тёмная зона в долях ширины/высоты изображения. */
  zone: { x0: 0.2, x1: 0.8, y0: 0.148, y1: 0.711 },
} as const;

// ---------------------------------------------------------------------------
// Символы
// ---------------------------------------------------------------------------

export type SymbolId =
  | 'wild'
  | 'crown'
  | 'diamond'
  | 'seven'
  | 'star'
  | 'bell'
  | 'horseshoe'
  | 'gemRed'
  | 'gemGreen'
  | 'gemBlue';

export interface SymbolDef {
  id: SymbolId;
  /** Название по-русски (для paytable). */
  name: string;
  /** Позиция ячейки в атласе: [col, row]. */
  atlas: readonly [number, number];
  /** Выплаты за 3/4/5 на линии, множители ставки на линию. */
  pays: readonly [number, number, number];
  /** Относительная ценность (для сортировки в paytable). */
  tier: number;
}

/** Порядок в списке — от старшего к младшему. */
export const SYMBOLS: readonly SymbolDef[] = [
  { id: 'wild',     name: 'Череп-реликвия WILD', atlas: [0, 0], pays: [60, 900, 20000], tier: 10 },
  { id: 'crown',    name: 'Корона императора', atlas: [0, 0], pays: [50, 800, 15000], tier: 9 },
  { id: 'diamond',  name: 'Бриллиант',         atlas: [2, 2], pays: [150, 1200, 6000], tier: 8 },
  { id: 'seven',    name: 'Семёрка',           atlas: [2, 1], pays: [60, 350, 2000],  tier: 7 },
  { id: 'star',     name: 'Звезда',            atlas: [0, 2], pays: [24, 140, 830],  tier: 6 },
  { id: 'bell',     name: 'Колокол',           atlas: [1, 2], pays: [24, 140, 555],   tier: 5 },
  { id: 'horseshoe',name: 'Подкова',           atlas: [1, 1], pays: [18, 148, 440],   tier: 4 },
  { id: 'gemRed',   name: 'Красный кристалл',  atlas: [1, 0], pays: [15, 88, 300],   tier: 3 },
  { id: 'gemGreen', name: 'Зелёный кристалл',  atlas: [2, 0], pays: [12, 55, 250],    tier: 2 },
  { id: 'gemBlue',  name: 'Синий кристалл',    atlas: [0, 1], pays: [11, 48, 220],    tier: 1 },
];

export const SYMBOL_BY_ID: Record<SymbolId, SymbolDef> = Object.fromEntries(
  SYMBOLS.map((s) => [s.id, s]),
) as Record<SymbolId, SymbolDef>;

// ---------------------------------------------------------------------------
// Линии и ставки
// ---------------------------------------------------------------------------

/** 10 фиксированных линий; значение — строка (0 = верх, 1 = середина, 2 = низ). */
export const LINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1], // центр
  [0, 0, 0, 0, 0], // верх
  [2, 2, 2, 2, 2], // низ
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // Λ
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [0, 1, 1, 1, 0],
];

export const REELS = 5;
export const ROWS = 3;

/** Ставка на линию (кредиты). Общая ставка = lineBet × LINES.length. */
export const LINE_BETS: readonly number[] = [1, 2, 5, 10, 20, 50, 100];
export const DEFAULT_LINE_BET_INDEX = 3; // общая ставка 100

export const START_BALANCE = 10_000;

// ---------------------------------------------------------------------------
// Reel strips (виртуальные ленты барабанов)
// ---------------------------------------------------------------------------

/**
 * Состав каждой ленты: сколько позиций занимает каждый символ, по барабанам
 * [r1..r5]. Длины лент могут отличаться; веса задают вероятности и RTP.
 */
const STRIP_COUNTS: Record<SymbolId, number[]> = {
  //        r1  r2  r3  r4  r5
  wild:     [1, 1, 1, 1, 1],
  crown:    [3, 3, 3, 3, 3],
  diamond:  [2, 2, 2, 2, 2],
  seven:    [4, 4, 4, 4, 4],
  star:     [6, 6, 6, 6, 6],
  bell:     [7, 7, 7, 7, 7],
  horseshoe:[8, 8, 8, 8, 8],
  gemRed:   [10, 10, 10, 10, 10],
  gemGreen: [12, 12, 12, 12, 12],
  gemBlue:  [13, 13, 13, 13, 13],
};

/** Символы от старших к младшим — для стабильной сборки лент. */
const SYMBOL_ORDER: SymbolId[] = SYMBOLS.map((s) => s.id);

/** Собирает список символов ленты по весам. */
function expandCounts(reel: number): SymbolId[] {
  const out: SymbolId[] = [];
  for (const id of SYMBOL_ORDER) {
    for (let i = 0; i < STRIP_COUNTS[id][reel]; i++) out.push(id);
  }
  return out;
}

/**
 * Детерминированное «расшивание» ленты без соседних одинаковых символов.
 * Классический жадный алгоритм: на каждом шаге — крупнейшая группа,
 * не совпадающая с предыдущим символом (только группы с n > 0).
 * Корректен, пока max-группа ≤ ⌈n/2⌉, что для наших весов выполнено.
 */
function interleave(counts: SymbolId[]): SymbolId[] {
  const rest = new Map<SymbolId, number>();
  for (const s of counts) rest.set(s, (rest.get(s) ?? 0) + 1);
  const out: SymbolId[] = [];
  let prev: SymbolId | null = null;
  for (let i = 0; i < counts.length; i++) {
    let best: SymbolId | null = null;
    let bestN = 0;
    for (const [id, n] of rest) {
      if (n > bestN && id !== prev) {
        best = id;
        bestN = n;
      }
    }
    if (best === null) throw new Error('interleave: невозможно расшить ленту');
    out.push(best);
    rest.set(best, bestN - 1);
    prev = best;
  }
  return out;
}

/** Готовые ленты барабанов (детерминированы). */
export const STRIPS: readonly SymbolId[][] = [0, 1, 2, 3, 4].map((r) => interleave(expandCounts(r)));

// ---------------------------------------------------------------------------
// Пороги и тайминги презентации
// ---------------------------------------------------------------------------

/** Пороги Big Win (кратные общей ставке). */
export const BIG_WIN_TIERS = [
  { mult: 60, title: 'БОЖЕСТВЕННЫЙ ВЫИГРЫШ' },
  { mult: 30, title: 'МЕГА ВЫИГРЫШ' },
  { mult: 15, title: 'БОЛЬШОЙ ВЫИГРЫШ' },
] as const;

export const TIMING = {
  reelSpinUpMs: 240,       // разгон барабана
  reelStopGapMs: 300,      // интервал между остановками
  reelStopBounceMs: 180,   // отскок при остановке
  anticipationMinMs: 1600, // минимальное доп. время anticipation
  anticipationMaxMs: 2600,
  lineShowMs: 1300,        // цикл показа одной линии
  winCountMs: 900,         // набегание суммы обычного выигрыша
  bigWinCountPerMult: 60,  // мс набегания на каждый ×ставки
  autoplayFastFactor: 0.45, // ускорение презентации в автоигре
  turboTimeFactor: 0.45,    // турбо: множитель временных констант
  turboSpeedFactor: 1.6,    // турбо: множитель скорости лент
} as const;

/** Ключ localStorage. */
export const SAVE_KEY = 'grim-fortune:save:v1';

/** Ставки автоигры. Infinity обозначается -1. */
export const AUTOPLAY_PRESETS = [10, 25, 50, -1] as const;

/** Циклы лимитов автоигры: 0 = выключено (множители общей ставки). */
export const WIN_LIMIT_MULTS = [0, 25, 50, 100] as const;
export const LOSS_LIMIT_MULTS = [0, 25, 50, 100] as const;
