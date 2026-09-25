/** Общие вспомогательные вещи для инструментов (без зависимостей от pixi). */
import { mulberry32 } from '../src/core/rng';

export { LINE_BETS, LINES, STRIPS, SYMBOLS } from '../src/game/config';
export const mulberry32Seed = mulberry32;
