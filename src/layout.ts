/**
 * Layout: два дизайн-режима.
 *  - landscape: 1920×1080 (scale-to-fit + letterbox)
 *  - portrait:  1080×1920 (телефоны; фон кроппится по центру, HUD перестраивается)
 *
 * computeLayout(w, h) вызывается из main при каждом resize: он вычисляет режим
 * и актуальные DESIGN_W/H, REELS_AREA, CELL, BOTTOM_BAR. Игра и оверлеи читают
 * эти значения при создании; при смене режима main пересоздаёт игру.
 */
import { BG, REELS, ROWS } from './game/config';

export type LayoutMode = 'landscape' | 'portrait';

export let MODE: LayoutMode = 'landscape';

export let DESIGN_W = 1920;
export let DESIGN_H = 1080;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export let REELS_AREA: Rect = { x: 0, y: 0, w: 0, h: 0 };
export let CELL = 0;

export const BOTTOM_BAR = { y: 930, h: 150 };
export const TOP_BAR = { h: 130 };

export function computeLayout(vw: number, vh: number): LayoutMode {
  MODE = vh > vw * 1.08 ? 'portrait' : 'landscape';

  if (MODE === 'portrait') {
    DESIGN_W = 1080;
    DESIGN_H = 1920;
    // Барабаны: крупная сетка в верхней трети
    CELL = Math.min((DESIGN_W - 60) / REELS, 620 / ROWS); // ≈ 204
    const gridW = CELL * REELS;
    const gridH = CELL * ROWS;
    REELS_AREA = {
      x: (DESIGN_W - gridW) / 2,
      y: 310,
      w: gridW,
      h: gridH,
    };
    BOTTOM_BAR.y = 1290;
    BOTTOM_BAR.h = DESIGN_H - 1290;
  } else {
    DESIGN_W = 1920;
    DESIGN_H = 1080;
    // Тёмная зона фона (измерена tools/analyze-bg.mjs), сетка центрируется в ней
    const zone: Rect = {
      x: BG.zone.x0 * DESIGN_W,
      y: BG.zone.y0 * DESIGN_H,
      w: (BG.zone.x1 - BG.zone.x0) * DESIGN_W,
      h: (BG.zone.y1 - BG.zone.y0) * DESIGN_H,
    };
    CELL = Math.min(zone.w / REELS, zone.h / ROWS);
    const gridW = CELL * REELS;
    const gridH = CELL * ROWS;
    REELS_AREA = {
      x: zone.x + (zone.w - gridW) / 2,
      y: zone.y + (zone.h - gridH) / 2,
      w: gridW,
      h: gridH,
    };
    BOTTOM_BAR.y = DESIGN_H - 150;
    BOTTOM_BAR.h = 150;
  }
  return MODE;
}

// Первичный расчёт до создания чего-либо
computeLayout(window.innerWidth, window.innerHeight);

/** Центр ячейки (reel, row) в координатах дизайна. */
export function cellCenter(reel: number, row: number): { x: number; y: number } {
  return {
    x: REELS_AREA.x + (reel + 0.5) * CELL,
    y: REELS_AREA.y + (row + 0.5) * CELL,
  };
}
