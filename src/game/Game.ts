/**
 * Game — оркестратор: конечный автомат
 * idle → spinning → presenting/bigwin → idle (→ autoplay → spinning…),
 * ввод (мышь + клавиатура), баланс/ставки, сохранение в localStorage.
 */
import { Application, Container, Sprite } from 'pixi.js';
import {
  AUTOPLAY_PRESETS,
  BIG_WIN_TIERS,
  DEFAULT_LINE_BET_INDEX,
  LOSS_LIMIT_MULTS,
  LINE_BETS,
  LINES,
  SAVE_KEY,
  START_BALANCE,
  STRIPS,
  TIMING,
  WIN_LIMIT_MULTS,
} from './config';
import { DESIGN_H, DESIGN_W } from '../layout';
import { needsAnticipation, pickStops, spinResult, type SpinResult } from './math';
import { ReelsView } from './ReelsView';
import { WinPresenter } from './WinPresenter';
import { BigWinOverlay } from './BigWinOverlay';
import { PaytableView } from './PaytableView';
import { Ui } from './Ui';
import { audio } from '../audio';
import { Embers } from './Embers';
import type { GameAssets } from '../assets';

type GameState = 'idle' | 'spinning' | 'presenting' | 'bigwin';

interface SaveData {
  balance: number;
  betIndex: number;
  muted: boolean;
  turbo: boolean;
  winLimitMult: number;
  lossLimitMult: number;
}

function loadSave(): SaveData {
  const fallback: SaveData = {
    balance: START_BALANCE,
    betIndex: DEFAULT_LINE_BET_INDEX,
    muted: false,
    turbo: false,
    winLimitMult: 0,
    lossLimitMult: 0,
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      balance: typeof data.balance === 'number' && data.balance >= 0 ? data.balance : START_BALANCE,
      betIndex:
        typeof data.betIndex === 'number' && data.betIndex >= 0 && data.betIndex < LINE_BETS.length
          ? data.betIndex
          : DEFAULT_LINE_BET_INDEX,
      muted: data.muted === true,
      turbo: data.turbo === true,
      winLimitMult: typeof data.winLimitMult === 'number' ? data.winLimitMult : 0,
      lossLimitMult: typeof data.lossLimitMult === 'number' ? data.lossLimitMult : 0,
    };
  } catch {
    return fallback;
  }
}

function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage недоступен — играем без сохранения
  }
}

export class Game extends Container {
  private state: GameState = 'idle';
  private balance: number;
  private betIndex: number;
  private muted: boolean;
  private autoplayRemaining: number | null = null;
  private autoplayPresetIndex = 0;
  private lastResult: SpinResult | null = null;
  private spinHistory: Array<{ pay: number; balance: number }> = [];
  private autoplayTimer: ReturnType<typeof setTimeout> | null = null;

  private reels: ReelsView;
  private presenter: WinPresenter;
  private bigWin: BigWinOverlay;
  private paytable: PaytableView;
  private ui: Ui;
  private balanceShown: number;
  private balanceTarget: number;
  private forceWin: boolean;
  private forceWild: boolean;
  private turbo: boolean;
  private winLimitMult: number;
  private lossLimitMult: number;
  private autoplayStartBalance = 0;
  private embers!: Embers;

  constructor(app: Application, assets: GameAssets) {
    super();
    const save = loadSave();
    this.balance = save.balance;
    this.balanceShown = save.balance;
    this.balanceTarget = save.balance;
    this.betIndex = save.betIndex;
    this.muted = save.muted;
    this.turbo = save.turbo;
    this.winLimitMult = save.winLimitMult;
    this.lossLimitMult = save.lossLimitMult;
    this.forceWin = new URLSearchParams(window.location.search).has('forceWin');
    this.forceWild = new URLSearchParams(window.location.search).has('forceWild');
    audio.setMuted(this.muted);

    // ── Фон ────────────────────────────────────────────────────────
    const bgSprite = new Sprite(assets.bg);
    bgSprite.width = DESIGN_W;
    bgSprite.height = DESIGN_H;
    this.addChild(bgSprite);

    // ── Эмберы ─────────────────────────────────────────────────────
    this.embers = new Embers();
    this.addChild(this.embers);

    // ── Барабаны ───────────────────────────────────────────────────
    this.reels = new ReelsView(assets.symbols);
    this.addChild(this.reels);

    // ── Презентация выигрыша ───────────────────────────────────────
    this.presenter = new WinPresenter();
    this.addChild(this.presenter);

    this.bigWin = new BigWinOverlay();
    this.paytable = new PaytableView(assets.symbols);

    // ── UI ─────────────────────────────────────────────────────────
    this.ui = new Ui({
      onSpin: () => this.onSpinAction(),
      onBetChange: (d) => this.changeBet(d),
      onAutoplay: () => this.toggleAutoplay(),
      onPaytable: () => this.togglePaytable(),
      onMute: () => this.toggleMute(),
      onTurbo: () => this.toggleTurbo(),
      onWinLimit: () => this.cycleWinLimit(),
      onLossLimit: () => this.cycleLossLimit(),
    });
    this.addChild(this.ui);
    this.ui.setTurbo(this.turbo);
    this.ui.setAutoplayLimits(this.winLimitMult, this.lossLimitMult);

    // Оверлеи поверх HUD: таблица выплат и Big Win
    this.addChild(this.paytable);
    this.addChild(this.bigWin);
    this.ui.setBalance(this.balance);
    this.ui.setBet(this.betIndex);
    this.ui.setMuted(this.muted);
    this.ui.setWin(0);

    // ── Клавиатура ─────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      audio.unlock();
      if (e.repeat) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.onSpinAction();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.changeBet(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.changeBet(-1);
          break;
        case 'KeyA':
          this.toggleAutoplay();
          break;
        case 'KeyI':
        case 'KeyP':
          this.togglePaytable();
          break;
        case 'KeyM':
          this.toggleMute();
          break;
        case 'Escape':
          if (this.paytable.open) this.paytable.close();
          break;
      }
    });
    window.addEventListener('pointerdown', () => audio.unlock());

    // Отладочный хук для smoke-тестов (?debug=1): сверка сетки и результата
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__grim = {
        grid: () => this.reels.displayedGrid(),
        result: () => this.lastResult,
        spinning: () => this.reels.spinning,
        state: () => this.state,
        balance: () => this.balance,
        history: () => this.spinHistory,
      };
    }

    // ── Тикер ──────────────────────────────────────────────────────
    app.ticker.add((ticker) => {
      const dt = ticker.deltaMS;
      this.embers.update(dt);
      this.reels.update(dt);
      this.presenter.update(dt);
      this.bigWin.update(dt);
      this.ui.update(dt);
      if (this.balanceShown !== this.balanceTarget) {
        const diff = this.balanceTarget - this.balanceShown;
        const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt / 200));
        if (Math.abs(diff) <= Math.abs(step) + 0.5) this.balanceShown = this.balanceTarget;
        else this.balanceShown += step;
        this.ui.setBalance(this.balanceShown);
      }
    });
  }

  // ── Действия игрока ──────────────────────────────────────────────

  private onSpinAction(): void {
    if (this.paytable.open) {
      this.paytable.close();
      return;
    }
    switch (this.state) {
      case 'spinning':
        this.reels.fastStop();
        break;
      case 'presenting':
        this.presenter.skip();
        break;
      case 'bigwin':
        this.bigWin.skip();
        break;
      case 'idle':
        this.spin();
        break;
    }
  }

  private totalBet(): number {
    return LINE_BETS[this.betIndex] * LINES.length;
  }

  private spin(): void {
    if (this.state !== 'idle') return;
    const bet = this.totalBet();
    if (this.balance < bet) {
      this.ui.toast('Недостаточно средств!');
      this.stopAutoplay();
      return;
    }
    this.presenter.clear();
    this.ui.setWin(0);

    this.state = 'spinning';
    this.balance -= bet;
    this.balanceTarget = this.balance;
    this.persist();
    if (this.autoplayRemaining !== null) {
      // Декремент в начале каждого авто-спина
      this.autoplayRemaining =
        this.autoplayRemaining === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : this.autoplayRemaining - 1;
      this.ui.setAutoplay(this.autoplayRemaining);
    }

    // Исход фиксируется ДО анимации и не меняется
    let stops = pickStops(Math.random);
    if (this.forceWild) {
      // Тестовый режим (?forceWild=1): wild по центральной линии на всех барабанах
      stops = STRIPS.map((strip) => {
        const L = strip.length;
        return (strip.indexOf('wild') - 1 + L) % L;
      });
    } else if (this.forceWin) {
      // Тестовый режим (?forceWin=1): три короны по центральной линии
      const crown = (reel: number): number => {
        const L = STRIPS[reel].length;
        return (STRIPS[reel].indexOf('crown') - 1 + L) % L;
      };
      stops = [crown(0), crown(1), crown(2), stops[3], stops[4]];
    }
    const result = spinResult(stops, this.betIndex);
    this.lastResult = result;
    const anticipate = needsAnticipation(result.grid);

    audio.spinStart();
    this.reels.startSpin(stops, anticipate, this.turbo, {
      onReelStop: (i) => audio.reelStop(i),
      onAnticipation: (active) => audio.anticipation(active),
      onAllStopped: () => this.onReelsStopped(),
    });
  }

  private onReelsStopped(): void {
    audio.stopSpinHum();
    const result = this.lastResult;
    if (!result) return;

    const bet = this.totalBet();
    const bigWinThreshold = BIG_WIN_TIERS[BIG_WIN_TIERS.length - 1].mult; // 15×

    if (result.totalPay >= bet * bigWinThreshold) {
      this.state = 'bigwin';
      // Big Win всегда прерывает автоигру (требование spec)
      this.stopAutoplay();
      this.balance += result.totalPay;
      this.balanceTarget = this.balance;
      this.persist();
      this.presenter.present(result, (r, row) => this.reels.cellSprite(r, row), {
        fast: false,
        turbo: this.turbo,
        flash: true,
        onCount: () => undefined,
        onDone: () => undefined,
      });
      this.bigWin.show(result.totalPay, bet, () => this.finishCycle());
    } else if (result.totalPay > 0) {
      this.state = 'presenting';
      this.balance += result.totalPay;
      this.balanceTarget = this.balance;
      this.persist();
      this.presenter.present(result, (r, row) => this.reels.cellSprite(r, row), {
        fast: this.autoplayRemaining !== null,
        turbo: this.turbo,
        flash: false,
        onCount: (shown) => this.ui.setWin(shown),
        onDone: () => this.finishCycle(),
      });
    } else {
      this.finishCycle();
    }
  }

  private finishCycle(): void {
    this.spinHistory.push({ pay: this.lastResult?.totalPay ?? 0, balance: this.balance });
    this.presenter.clear();
    this.state = 'idle';
    if (this.autoplayRemaining === null) return;
    if (this.autoplayRemaining === 0) {
      this.stopAutoplay();
      this.ui.toast('Серия автоигры завершена');
      return;
    }
    // Лимиты автоигры — накопительно от старта серии
    const net = this.balance - this.autoplayStartBalance;
    const bet = this.totalBet();
    if (this.winLimitMult > 0 && net >= this.winLimitMult * bet) {
      this.stopAutoplay();
      this.ui.toast('Лимит выигрыша достигнут — автоигра остановлена');
      return;
    }
    if (this.lossLimitMult > 0 && -net >= this.lossLimitMult * bet) {
      this.stopAutoplay();
      this.ui.toast('Лимит проигрыша — автоигра остановлена');
      return;
    }
    // Пауза между авто-спинами — короче в режиме автоигры
    const gap = this.autoplayRemaining !== null ? 420 * TIMING.autoplayFastFactor : 420;
    this.autoplayTimer = setTimeout(() => {
      this.autoplayTimer = null;
      if (this.state === 'idle') this.spin();
    }, gap);
  }

  // ── Ставка ───────────────────────────────────────────────────────

  private changeBet(delta: number): void {
    if (this.state !== 'idle') {
      this.ui.toast('Ставка меняется между спинами');
      return;
    }
    const next = this.betIndex + delta;
    if (next < 0 || next >= LINE_BETS.length) return;
    this.betIndex = next;
    this.ui.setBet(this.betIndex);
    this.persist();
  }

  // ── Автоигра ─────────────────────────────────────────────────────

  private toggleAutoplay(): void {
    if (this.autoplayRemaining !== null) {
      this.stopAutoplay();
      this.ui.toast('Автоигра остановлена');
      return;
    }
    const preset = AUTOPLAY_PRESETS[this.autoplayPresetIndex];
    this.autoplayPresetIndex = (this.autoplayPresetIndex + 1) % AUTOPLAY_PRESETS.length;
    this.autoplayRemaining = preset === -1 ? Number.POSITIVE_INFINITY : preset;
    this.autoplayStartBalance = this.balance;
    this.ui.setAutoplay(this.autoplayRemaining);
    if (this.state === 'idle') this.spin();
  }

  private stopAutoplay(): void {
    this.autoplayRemaining = null;
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    this.ui.setAutoplay(null);
  }

  // ── Таблица выплат / звук ────────────────────────────────────────

  private togglePaytable(): void {
    this.paytable.toggle();
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    audio.setMuted(this.muted);
    this.ui.setMuted(this.muted);
    this.persist();
  }

  private toggleTurbo(): void {
    this.turbo = !this.turbo;
    this.ui.setTurbo(this.turbo);
    this.persist();
  }

  private cycleWinLimit(): void {
    const idx = (WIN_LIMIT_MULTS.indexOf(this.winLimitMult as never) + 1) % WIN_LIMIT_MULTS.length;
    this.winLimitMult = WIN_LIMIT_MULTS[idx];
    this.ui.setAutoplayLimits(this.winLimitMult, this.lossLimitMult);
    this.persist();
  }

  private cycleLossLimit(): void {
    const idx = (LOSS_LIMIT_MULTS.indexOf(this.lossLimitMult as never) + 1) % LOSS_LIMIT_MULTS.length;
    this.lossLimitMult = LOSS_LIMIT_MULTS[idx];
    this.ui.setAutoplayLimits(this.winLimitMult, this.lossLimitMult);
    this.persist();
  }

  private persist(): void {
    saveGame({
      balance: this.balance,
      betIndex: this.betIndex,
      muted: this.muted,
      turbo: this.turbo,
      winLimitMult: this.winLimitMult,
      lossLimitMult: this.lossLimitMult,
    });
  }
}
