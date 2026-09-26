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
    // Cover-посадка фона (арт 1672×941) — та же формула, что в Game
    const k = Math.max(DESIGN_W / 1672, DESIGN_H / 941);
    const bgX = (DESIGN_W - 1672 * k) / 2;
    const bgY = (DESIGN_H - 941 * k) / 2;
    // Тёмная зона фона в координатах дизайна
    const zx = BG.zone.x0 * 1672 * k + bgX;
    const zy = BG.zone.y0 * 941 * k + bgY;
    const zw = (BG.zone.x1 - BG.zone.x0) * 1672 * k;
    const zh = (BG.zone.y1 - BG.zone.y0) * 941 * k;
    // Сетка — строго внутри тёмной зоны (по центру), ширина не больше экрана
    CELL = Math.min((DESIGN_W - 60) / REELS, (zh * 0.9) / ROWS);
    const gridW = CELL * REELS;
    const gridH = CELL * ROWS;
    const gx = Math.min(Math.max(zx + (zw - gridW) / 2, 20), DESIGN_W - 20 - gridW);
    const gy = zy + (zh - gridH) / 2;
    REELS_AREA = { x: gx, y: gy, w: gridW, h: gridH };
    BOTTOM_BAR.y = Math.min(DESIGN_H - 620, gy + gridH + 160);
    BOTTOM_BAR.h = DESIGN_H - BOTTOM_BAR.y;
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
