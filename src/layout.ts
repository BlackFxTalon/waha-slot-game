/**
 * Layout: дизайн-разрешение 1920×1080, масштабируется на любое окно
 * (scale-to-fit + letterbox). Зона барабанов вычисляется из тёмной зоны
 * фона (см. tools/analyze-bg.mjs) и центрируется в ней.
 */
import { DESIGN_H, DESIGN_W, BG, REELS, ROWS } from './game/config';

export { DESIGN_H, DESIGN_W };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Тёмная зона фона в координатах дизайна. */
const zone: Rect = {
  x: BG.zone.x0 * DESIGN_W,
  y: BG.zone.y0 * DESIGN_H,
  w: (BG.zone.x1 - BG.zone.x0) * DESIGN_W,
  h: (BG.zone.y1 - BG.zone.y0) * DESIGN_H,
};

/** Размер ячейки символа: ограничен и шириной, и высотой зоны. */
const cell = Math.min(zone.w / REELS, zone.h / ROWS);
const gridW = cell * REELS;
const gridH = cell * ROWS;

/** Прямоугольник всей сетки барабанов (5×3). */
export const REELS_AREA: Rect = {
  x: zone.x + (zone.w - gridW) / 2,
  y: zone.y + (zone.h - gridH) / 2,
  w: gridW,
  h: gridH,
};

export const CELL = cell;

/** Центр ячейки (reel, row) в координатах дизайна. */
export function cellCenter(reel: number, row: number): { x: number; y: number } {
  return {
    x: REELS_AREA.x + (reel + 0.5) * CELL,
    y: REELS_AREA.y + (row + 0.5) * CELL,
  };
}

/** Нижняя панель UI. */
export const BOTTOM_BAR = { y: DESIGN_H - 150, h: 150 };
export const TOP_BAR = { y: 0, h: 130 };
