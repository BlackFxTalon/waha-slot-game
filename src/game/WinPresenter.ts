/**
 * WinPresenter — показ выигрыша: затемнение невыигравших символов,
 * трассы линий, пульс выигрышных символов, цикличный перебор линий
 * и набегание суммы выигрыша.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL, REELS_AREA, cellCenter } from '../layout';
import { COLORS } from './ui/widgets';
import { ATLAS, TIMING } from './config';

/** Базовый масштаб спрайта символа: текстура 418px → ячейка. */
const SYM_SCALE = CELL / ATLAS.cell;
import type { LineWin, SpinResult } from './math';
import { audio } from '../audio';

const GOLD = COLORS.goldBright;

interface WinCellRef {
  sprite: Sprite;
  baseY: number;
  reel: number;
  row: number;
}

export interface PresentOptions {
  /** Ускоренная презентация (автоигра). */
  fast: boolean;
  /** Режим flash: без цикла линий (для Big Win). */
  flash: boolean;
  onCount: (shownWin: number) => void;
  onDone: () => void;
}

export class WinPresenter extends Container {
  private traces: Graphics;
  private winCells: WinCellRef[] = [];
  private clock = 0;
  private active = false;
  private opts: PresentOptions | null = null;
  private wins: LineWin[] = [];
  private countTo = 0;
  private countDur = 0;
  private countShown = 0;
  private lastTickAt = 0;
  private totalDur = 0;

  constructor() {
    super();
    this.position.set(REELS_AREA.x, REELS_AREA.y);
    this.eventMode = 'none';
    this.traces = new Graphics();
    this.addChild(this.traces);
  }

  get presenting(): boolean {
    return this.active;
  }

  present(result: SpinResult, cellAt: (reel: number, row: number) => Sprite | undefined, opts: PresentOptions): void {
    this.clear();
    this.active = true;
    this.opts = opts;
    this.wins = result.wins;
    this.clock = 0;
    const speed = opts.fast ? TIMING.autoplayFastFactor : 1;

    // Затемнение невыигравших ячеек
    const winning = new Set<string>();
    for (const w of result.wins) for (const [r, row] of w.cells) winning.add(`${r}:${row}`);
    for (let r = 0; r < 5; r++) {
      for (let row = 0; row < 3; row++) {
        const sp = cellAt(r, row);
        if (!sp) continue;
        if (winning.has(`${r}:${row}`)) {
          // Пульс: якорь в центре
          sp.anchor.set(0.5);
          sp.x = CELL / 2;
          sp.y = row * CELL + CELL / 2;
          this.winCells.push({ sprite: sp, baseY: sp.y, reel: r, row });
        } else {
          sp.tint = 0x555555;
          sp.alpha = 0.55;
        }
      }
    }

    this.drawTraces(-1);

    // Набегание суммы
    this.countTo = result.totalPay;
    this.countShown = 0;
    this.countDur = Math.max(300, TIMING.winCountMs * speed);
    this.totalDur = opts.flash
      ? this.countDur + 600
      : Math.max(this.countDur + TIMING.lineShowMs, (1 + result.wins.length) * TIMING.lineShowMs * speed);
    opts.onCount(0);
  }

  /** Быстрая вспышка выигрышных символов без перебора линий (Big Win). */
  private drawTraces(highlightLine: number): void {
    const g = this.traces.clear();
    this.wins.forEach((w, i) => {
      const solo = highlightLine === -1 || highlightLine === i;
      const alpha = solo ? 0.95 : 0.12;
      const first = cellCenter(w.cells[0][0], w.cells[0][1]);
      const last = cellCenter(w.cells[w.cells.length - 1][0], w.cells[w.cells.length - 1][1]);
      const x0 = first.x - REELS_AREA.x - CELL / 2;
      const x1 = last.x - REELS_AREA.x + CELL / 2;
      const points: Array<[number, number]> = [[x0, first.y - REELS_AREA.y]];
      for (const [r, row] of w.cells) {
        const c = cellCenter(r, row);
        points.push([c.x - REELS_AREA.x, c.y - REELS_AREA.y]);
      }
      points.push([x1, last.y - REELS_AREA.y]);
      // Свечение + линия
      g.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) g.lineTo(x, y);
      g.stroke({ color: GOLD, width: 16, alpha: 0.22 * alpha });
      g.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) g.lineTo(x, y);
      g.stroke({ color: GOLD, width: 5, alpha });
      // Узлы на барабанах
      for (const [x, y] of points.slice(1, -1)) {
        g.circle(x, y, 10).fill({ color: GOLD, alpha });
      }
    });
  }

  update(dtMs: number): void {
    if (!this.active) return;
    this.clock += dtMs;
    const speed = this.opts?.fast ? TIMING.autoplayFastFactor : 1;

    // Пульс выигрышных символов
    const t = this.clock / 1000;
    for (const wc of this.winCells) {
      const s = SYM_SCALE * (1 + 0.05 * Math.max(0, Math.sin(t * 6)));
      wc.sprite.scale.set(s);
    }

    // Набегание счёта
    if (this.clock <= this.countDur) {
      const k = Math.min(1, this.clock / this.countDur);
      const eased = 1 - Math.pow(1 - k, 2);
      const shown = Math.round(this.countTo * eased);
      if (shown !== this.countShown) {
        this.countShown = shown;
        this.opts?.onCount(shown);
      }
      if (this.clock - this.lastTickAt > 55 && k < 1) {
        this.lastTickAt = this.clock;
        audio.winTick();
      }
    } else if (this.countShown !== this.countTo) {
      this.countShown = this.countTo;
      this.opts?.onCount(this.countTo);
      audio.coin();
    }

    // Цикличный перебор линий после первичного показа всех
    if (!this.opts?.flash && this.clock > this.countDur + TIMING.lineShowMs * speed) {
      const cycleT = this.clock - (this.countDur + TIMING.lineShowMs * speed);
      const idx = Math.floor(cycleT / (TIMING.lineShowMs * speed)) % this.wins.length;
      this.drawTraces(idx);
    }

    if (this.clock >= this.totalDur) this.done();
  }

  skip(): void {
    if (!this.active) return;
    if (this.countShown !== this.countTo) {
      this.countShown = this.countTo;
      this.opts?.onCount(this.countTo);
    }
    this.done();
  }

  private done(): void {
    const cb = this.opts?.onDone;
    this.clear();
    cb?.();
  }

  /** Полный сброс к состоянию «до показа». */
  clear(): void {
    this.active = false;
    this.opts = null;
    this.wins = [];
    this.traces.clear();
    for (const wc of this.winCells) {
      wc.sprite.anchor.set(0, 0);
      wc.sprite.x = 0;
      wc.sprite.y = wc.row * CELL;
      wc.sprite.scale.set(SYM_SCALE);
      wc.sprite.tint = 0xffffff;
      wc.sprite.alpha = 1;
    }
    this.winCells = [];
  }
}
