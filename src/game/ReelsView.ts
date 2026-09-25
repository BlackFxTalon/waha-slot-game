/**
 * ReelsView — визуальный движок 5 барабанов.
 *
 * Модель: непрерывная позиция pos ТОЛЬКО растёт (барабаны движутся вниз),
 * символ j рисуется в y = (pos - j) * CELL; видимое окно j ∈ [pos-3, pos].
 * Отдых: pos = vstop (целое), где vstop = L-1-stop на ЗЕРКАЛЬНОЙ ленте —
 * тогда ряд r показывает visual[(vstop - r) mod L] = logical[(stop + r) mod L],
 * в точности сетку из gridFromStops().
 */
import { BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { REELS, ROWS, STRIPS, TIMING, type SymbolId } from './config';
import { CELL, REELS_AREA } from '../layout';

const VISUAL_STRIPS: SymbolId[][] = STRIPS.map((s) => [...s].reverse());
const VMAX = 44; // символов в секунду на полной скорости
const DRIFT_CELLS = 8; // тормозной путь остановки (в ячейках)
const DRIFT_MS = 620; // длительность торможения
const SKIP_FACTOR = 3; // множитель скорости быстрой остановки
const BOUNCE_CELLS = 0.18; // отскок после посадки

type Phase = 'idle' | 'spinup' | 'cruise' | 'stoppingFast' | 'stoppingSlow' | 'bounce';

interface ReelState {
  pos: number;
  speed: number;
  phase: Phase;
  clock: number;
  t: number;
  stopAt: number | null;
  fastFactor: number;
  targetPos: number;
  bounceT: number;
}

export interface ReelsCallbacks {
  onReelStop?: (reel: number) => void;
  onAllStopped?: () => void;
  onAnticipation?: (active: boolean) => void;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export class ReelsView extends Container {
  private reels: Container[] = [];
  private pools: Sprite[][] = [];
  private blur: BlurFilter[] = [];
  private states: ReelState[] = [];
  private anticipFrame: Graphics;
  private anticipClock = 0;
  private anticipationActive = false;
  private anticipateRequested = false;
  private fastStopRequested = false;
  private stops: number[] = [];
  private callbacks: ReelsCallbacks = {};
  private stoppedCount = 0;

  constructor(private symbols: Record<SymbolId, Texture>) {
    super();
    this.position.set(REELS_AREA.x, REELS_AREA.y);

    for (let i = 0; i < REELS; i++) {
      const reel = new Container();
      reel.x = i * CELL;
      this.addChild(reel);
      this.reels.push(reel);

      // Маска — окно 3 рядов, в позиции колонки барабана
      const mask = new Graphics().rect(0, -1, CELL, CELL * ROWS + 2).fill(0xffffff);
      mask.position.set(i * CELL, 0);
      this.addChild(mask);
      reel.mask = mask;

      // Пул спрайтов: 3 видимых + по одному сверху/снизу
      const pool: Sprite[] = [];
      for (let k = 0; k < ROWS + 2; k++) {
        const sp = new Sprite();
        sp.width = CELL;
        sp.height = CELL;
        reel.addChild(sp);
        pool.push(sp);
      }
      this.pools.push(pool);

      this.states.push({
        pos: 0,
        speed: 0,
        phase: 'idle',
        clock: 0,
        t: 0,
        stopAt: null,
        fastFactor: 1,
        targetPos: 0,
        bounceT: 0,
      });

      this.blur.push(new BlurFilter({ strength: 6, quality: 2 }));
    }

    // Пульсирующая рамка anticipation (5-й барабан)
    this.anticipFrame = new Graphics()
      .rect(REELS * CELL - CELL, 0, CELL, CELL * ROWS)
      .stroke({ color: 0xd93636, width: 5, alpha: 1 });
    this.anticipFrame.visible = false;
    this.addChild(this.anticipFrame);

    // Стартовые позиции (презентационные, до первого спина)
    for (const st of this.states) st.pos = Math.floor(Math.random() * 100);
    this.renderCells();
  }

  get spinning(): boolean {
    return this.states.some((s) => s.phase !== 'idle');
  }

  startSpin(stops: number[], anticipate: boolean, callbacks: ReelsCallbacks): void {
    this.stops = stops;
    this.callbacks = callbacks;
    this.anticipateRequested = anticipate;
    this.fastStopRequested = false;
    this.anticipationActive = false;
    this.stoppedCount = 0;

    this.states.forEach((st, i) => {
      const extra = anticipate && i === REELS - 1 ? TIMING.anticipationMinMs : 0;
      st.phase = 'spinup';
      st.clock = 0;
      st.t = 0;
      st.fastFactor = 1;
      st.stopAt = TIMING.reelSpinUpMs + TIMING.reelStopGapMs * (i + 1) + extra;
      st.speed = 0;
    });
    this.renderCells();
  }

  /** Быстрая остановка по требованию игрока. */
  fastStop(): void {
    if (!this.spinning) return;
    this.fastStopRequested = true;
    this.states.forEach((st, i) => {
      if (st.phase === 'spinup' || st.phase === 'cruise') {
        st.stopAt = Math.min(st.stopAt ?? Number.POSITIVE_INFINITY, st.clock + 120 + i * 50);
        st.fastFactor = SKIP_FACTOR;
      } else if (st.phase === 'stoppingFast') {
        st.fastFactor = SKIP_FACTOR;
      }
    });
  }

  /** dt в миллисекундах. */
  update(dtMs: number): void {
    if (this.anticipationActive) {
      // Пульс красной рамки 5-го барабана
      this.anticipClock = (this.anticipClock + dtMs) % 1000;
      const k = Math.sin((this.anticipClock / 1000) * Math.PI * 2);
      this.anticipFrame.alpha = 0.45 + 0.45 * (0.5 + 0.5 * k);
    }
    if (!this.spinning) return;
    const dt = Math.min(dtMs, 50) / 1000;

    this.states.forEach((st, i) => {
      if (st.phase === 'idle') return;
      st.clock += dtMs;

      switch (st.phase) {
        case 'spinup': {
          const k = Math.min(1, st.clock / TIMING.reelSpinUpMs);
          st.speed = VMAX * k * k;
          st.pos += st.speed * dt;
          if (k >= 1) st.phase = 'cruise';
          break;
        }
        case 'cruise': {
          st.speed = VMAX;
          st.pos += st.speed * dt;
          if (st.stopAt !== null && st.clock >= st.stopAt) this.beginStopping(st);
          break;
        }
        case 'stoppingFast': {
          // Ход на полной скорости до выравнивания с тормозной дистанцией
          st.speed = VMAX * st.fastFactor;
          st.pos += st.speed * dt;
          if (st.pos >= st.targetPos - DRIFT_CELLS) {
            st.pos = st.targetPos - DRIFT_CELLS;
            st.phase = 'stoppingSlow';
            st.t = 0;
          }
          break;
        }
        case 'stoppingSlow': {
          st.t += dtMs;
          const u = Math.min(1, st.t / DRIFT_MS);
          const e = easeOutCubic(u);
          st.pos = st.targetPos - DRIFT_CELLS + DRIFT_CELLS * e;
          st.speed = VMAX * (1 - e) + 0.001;
          if (u >= 1) {
            st.phase = 'bounce';
            st.bounceT = 0;
          }
          break;
        }
        case 'bounce': {
          st.bounceT += dtMs;
          const u = Math.min(1, st.bounceT / TIMING.reelStopBounceMs);
          st.pos = st.targetPos + BOUNCE_CELLS * Math.sin(Math.PI * u) * (1 - u * 0.6);
          st.speed = 0.001;
          if (u >= 1) {
            st.pos = st.targetPos;
            st.phase = 'idle';
            st.speed = 0;
            this.stoppedCount++;
            this.callbacks.onReelStop?.(i);
            // Anticipation: стартует, когда 4-й барабан видимо остановился
            if (
              this.anticipateRequested && !this.fastStopRequested &&
              i === REELS - 2 && !this.anticipationActive
            ) {
              this.anticipationActive = true;
              this.anticipFrame.visible = true;
              this.callbacks.onAnticipation?.(true);
            }
            if (this.anticipationActive && i === REELS - 1) {
              this.anticipationActive = false;
              this.anticipFrame.visible = false;
              this.callbacks.onAnticipation?.(false);
            }
            if (this.stoppedCount === REELS) {
              this.renderCells();
              this.callbacks.onAllStopped?.();
              return;
            }
          }
          break;
        }
      }
    });

    this.renderCells();
    this.updateBlur();
  }

  private beginStopping(st: ReelState): void {
    const i = this.states.indexOf(st);
    const L = VISUAL_STRIPS[i].length;
    const vstop = L - 1 - this.stops[i];
    // Ближайшая выровненная цель впереди (pos растёт) не ближе DRIFT_CELLS
    let target = vstop + Math.ceil((st.pos + DRIFT_CELLS - vstop) / L) * L;
    if (target < st.pos + DRIFT_CELLS) target += L;
    st.phase = 'stoppingFast';
    st.targetPos = target;
  }

  private updateBlur(): void {
    this.states.forEach((st, i) => {
      const f = this.blur[i];
      const k = Math.min(1, st.speed / VMAX);
      if (k < 0.03) {
        this.reels[i].filters = null;
        return;
      }
      this.reels[i].filters = [f];
      f.blurY = 16 * k;
      f.blurX = 2 * k;
    });
  }

  /** Раскладывает спрайты пула: окно j ∈ [pos-3, pos], y = (pos - j) * CELL. */
  private renderCells(): void {
    this.states.forEach((st, i) => {
      const L = VISUAL_STRIPS[i].length;
      const pool = this.pools[i];
      const base = Math.floor(st.pos);
      for (let k = 0; k < pool.length; k++) {
        const j = base - 3 + k;
        const y = (st.pos - j) * CELL;
        const sp = pool[k];
        if (y < -CELL || y > CELL * ROWS) {
          sp.visible = false;
          continue;
        }
        sp.visible = true;
        const sym = VISUAL_STRIPS[i][((j % L) + L) % L];
        sp.texture = this.symbols[sym];
        sp.y = y;
      }
    });
  }

  /** Спрайт символа в ячейке (после остановки). */
  cellSprite(reel: number, row: number): Sprite | undefined {
    return this.pools[reel]?.find(
      (sp) => sp.visible && sp.texture && Math.abs(sp.y - row * CELL) < 1,
    );
  }

  /** Показанная сетка 5×3 (когда все барабаны в покое). Для тестов. */
  displayedGrid(): SymbolId[][] | null {
    const grid: SymbolId[][] = [];
    for (let i = 0; i < REELS; i++) {
      const st = this.states[i];
      if (st.phase !== 'idle') return null;
      const L = VISUAL_STRIPS[i].length;
      const p = Math.round(st.pos);
      grid.push(
        [0, 1, 2].map((r) => VISUAL_STRIPS[i][(((p - r) % L) + L) % L]),
      );
    }
    return grid;
  }
}
