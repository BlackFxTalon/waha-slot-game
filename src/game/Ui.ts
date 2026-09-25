/**
 * Ui — игровой HUD: баланс/ставка/выигрыш, спин, автоигра,
 * таблица выплат, mute, тосты. Управление мышью и клавиатурой.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { LINE_BETS, LINES } from './config';
import { BOTTOM_BAR, DESIGN_H, DESIGN_W, TOP_BAR } from '../layout';
import { Button, COLORS, makePanel, makeText } from './ui/widgets';
import { audio } from '../audio';

export interface UiCallbacks {
  onSpin: () => void;
  onBetChange: (delta: number) => void;
  onAutoplay: () => void;
  onPaytable: () => void;
  onMute: () => void;
  onTurbo: () => void;
  onWinLimit: () => void;
  onLossLimit: () => void;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('ru-RU');

export class Ui extends Container {
  private balanceText: Text;
  private betText: Text;
  private winText: Text;
  private winLabel: Text;
  private toastText: Text;
  private toastClock = 0;
  private spinBtn: Button;
  private autoBtn: Button;
  private autoLabel: Text;
  private betDownBtn: Button;
  private betUpBtn: Button;
  private muteIcon: Container;
  private muteIconParts: Graphics;
  private turboBtn: Button;
  private turboBolt: Graphics;
  private winLimitBtn: Button;
  private lossLimitBtn: Button;
  private winLimitLabel: Text;
  private lossLimitLabel: Text;
  private autoplayRemaining: number | null = null;

  constructor(cb: UiCallbacks) {
    super();

    // ── Верхняя панель ──────────────────────────────────────────────
    const title = makeText('GRIM FORTUNE', 34, COLORS.goldBright, 'bold', 10);
    title.position.set(46, TOP_BAR.h / 2 - 34);
    this.addChild(title);
    const subtitle = makeText('тёмные барабаны императора', 16, '#7a6a45', 'normal', 3);
    subtitle.position.set(48, TOP_BAR.h / 2 + 8);
    this.addChild(subtitle);

    // Таблица выплат
    const infoBtn = new Button(56, 56, 'rect', () => {
      audio.uiClick();
      cb.onPaytable();
    });
    infoBtn.position.set(DESIGN_W - 46 - 56 * 2 - 12, TOP_BAR.h / 2 - 28);
    const infoTxt = makeText('i', 34, COLORS.parchment, 'bold', 0);
    infoTxt.anchor.set(0.5);
    infoTxt.position.set(28, 26);
    infoBtn.content.addChild(infoTxt);
    this.addChild(infoBtn);

    // Звук
    const muteBtn = new Button(56, 56, 'rect', () => {
      audio.uiClick();
      cb.onMute();
    });
    muteBtn.position.set(DESIGN_W - 46 - 56, TOP_BAR.h / 2 - 28);
    this.muteIcon = new Container();
    this.muteIcon.position.set(28, 28);
    muteBtn.content.addChild(this.muteIcon);
    this.muteIconParts = new Graphics();
    this.muteIcon.addChild(this.muteIconParts);
    this.addChild(muteBtn);
    this.drawMuteIcon(false);

    // ── Нижняя панель ───────────────────────────────────────────────
    const bar = new Graphics()
      .rect(0, BOTTOM_BAR.y + 8, DESIGN_W, BOTTOM_BAR.h)
      .fill({ color: 0x070503, alpha: 0.62 })
      .rect(0, BOTTOM_BAR.y + 8, DESIGN_W, 2)
      .fill({ color: COLORS.goldDark, alpha: 0.7 });
    this.addChild(bar);

    // Баланс (слева)
    const balancePanel = makePanel(400, 96);
    balancePanel.position.set(60, BOTTOM_BAR.y + 34);
    this.addChild(balancePanel);
    const balanceLabel = makeText('БАЛАНС', 20, '#8a7a52', 'bold', 4);
    balanceLabel.position.set(24, 14);
    balancePanel.addChild(balanceLabel);
    this.balanceText = makeText('0', 38, COLORS.parchment, 'bold', 1);
    this.balanceText.position.set(24, 42);
    balancePanel.addChild(this.balanceText);

    // Ставка (справа)
    const betPanel = makePanel(430, 96);
    betPanel.position.set(DESIGN_W - 60 - 430, BOTTOM_BAR.y + 34);
    this.addChild(betPanel);
    const betLabel = makeText('ОБЩАЯ СТАВКА', 20, '#8a7a52', 'bold', 3);
    betLabel.position.set(24, 14);
    betPanel.addChild(betLabel);
    this.betText = makeText('0', 38, COLORS.parchment, 'bold', 1);
    this.betText.position.set(24, 42);
    betPanel.addChild(this.betText);

    this.betDownBtn = new Button(52, 52, 'rect', () => {
      audio.uiClick();
      cb.onBetChange(-1);
    });
    this.betDownBtn.position.set(DESIGN_W - 60 - 430 + 310, BOTTOM_BAR.y + 56);
    const minus = makeText('−', 36, COLORS.parchment, 'bold', 0);
    minus.anchor.set(0.5);
    minus.position.set(26, 24);
    this.betDownBtn.content.addChild(minus);
    this.addChild(this.betDownBtn);

    this.betUpBtn = new Button(52, 52, 'rect', () => {
      audio.uiClick();
      cb.onBetChange(1);
    });
    this.betUpBtn.position.set(DESIGN_W - 60 - 430 + 368, BOTTOM_BAR.y + 56);
    const plus = makeText('+', 36, COLORS.parchment, 'bold', 0);
    plus.anchor.set(0.5);
    plus.position.set(26, 24);
    this.betUpBtn.content.addChild(plus);
    this.addChild(this.betUpBtn);

    // Выигрыш (центр, над спином)
    // Счётчик выигрыша — над нижней панелью, на свободной зоне пола
    // (не за кнопкой спина)
    this.winLabel = makeText('ВЫИГРЫШ', 22, '#8a7a52', 'bold', 6);
    this.winLabel.anchor.set(0.5);
    this.winLabel.position.set(DESIGN_W / 2, 828);
    this.winLabel.visible = false;
    this.addChild(this.winLabel);
    this.winText = makeText('', 48, COLORS.goldBright, 'bold', 3);
    this.winText.anchor.set(0.5);
    this.winText.position.set(DESIGN_W / 2, 878);
    this.addChild(this.winText);

    // Спин (центр)
    this.spinBtn = new Button(116, 116, 'circle', () => {
      audio.uiClick();
      cb.onSpin();
    }, { base: 0x241207, accent: COLORS.redBright });
    this.spinBtn.position.set(DESIGN_W / 2 - 58, DESIGN_H - 74 - 58);
    this.addChild(this.spinBtn);
    // Иконка спина: круговая стрелка по центру кнопки
    const spinIcon = new Graphics();
    const ic = 58; // центр кнопки
    spinIcon.arc(ic, ic, 26, -Math.PI * 0.3, Math.PI * 1.25)
      .stroke({ color: COLORS.parchment, width: 8, cap: 'round' });
    // Наконечник стрелки на конце дуги
    const endX = ic + 26 * Math.cos(-Math.PI * 0.3);
    const endY = ic + 26 * Math.sin(-Math.PI * 0.3);
    spinIcon.moveTo(endX + 14, endY - 2);
    spinIcon.lineTo(endX - 10, endY - 14);
    spinIcon.lineTo(endX - 4, endY + 12);
    spinIcon.closePath();
    spinIcon.fill({ color: COLORS.parchment });
    this.spinBtn.content.addChild(spinIcon);

    // Турбо (слева от АВТО)
    this.turboBtn = new Button(64, 64, 'rect', () => {
      audio.uiClick();
      cb.onTurbo();
    }, { base: 0x241a06 });
    this.turboBtn.position.set(DESIGN_W / 2 - 58 - 96 - 36 - 20 - 64, DESIGN_H - 74 - 32);
    this.turboBolt = new Graphics();
    this.turboBolt.position.set(32, 32);
    this.turboBtn.content.addChild(this.turboBolt);
    this.addChild(this.turboBtn);

    // Автоигра (слева от спина)
    this.autoBtn = new Button(96, 64, 'rect', () => {
      audio.uiClick();
      cb.onAutoplay();
    });
    this.autoBtn.position.set(DESIGN_W / 2 - 58 - 96 - 36, DESIGN_H - 74 - 32);
    this.autoLabel = makeText('АВТО', 22, COLORS.parchment, 'bold', 2);
    this.autoLabel.anchor.set(0.5);
    this.autoLabel.position.set(48, 24);
    this.autoBtn.content.addChild(this.autoLabel);
    const autoSub = makeText('10', 16, '#8a7a52', 'bold', 1);
    autoSub.anchor.set(0.5);
    autoSub.position.set(48, 46);
    autoSub.name = 'autoSub';
    this.autoBtn.content.addChild(autoSub);
    this.addChild(this.autoBtn);

    // Тост (сообщения)
    this.toastText = makeText('', 30, COLORS.redBright, 'bold', 2);
    this.toastText.anchor.set(0.5);
    this.toastText.position.set(DESIGN_W / 2, BOTTOM_BAR.y - 36);
    this.toastText.alpha = 0;
    this.addChild(this.toastText);

    // Лимиты автоигры (верхняя панель, центр)
    this.winLimitBtn = new Button(240, 40, 'rect', () => {
      audio.uiClick();
      cb.onWinLimit();
    });
    this.winLimitBtn.position.set(DESIGN_W / 2 - 250 - 12, TOP_BAR.h / 2 - 20);
    this.winLimitLabel = makeText('', 19, COLORS.parchment, 'bold', 1);
    this.winLimitLabel.anchor.set(0.5);
    this.winLimitLabel.position.set(120, 20);
    this.winLimitBtn.content.addChild(this.winLimitLabel);
    this.addChild(this.winLimitBtn);

    this.lossLimitBtn = new Button(240, 40, 'rect', () => {
      audio.uiClick();
      cb.onLossLimit();
    });
    this.lossLimitBtn.position.set(DESIGN_W / 2 + 12, TOP_BAR.h / 2 - 20);
    this.lossLimitLabel = makeText('', 19, COLORS.parchment, 'bold', 1);
    this.lossLimitLabel.anchor.set(0.5);
    this.lossLimitLabel.position.set(120, 20);
    this.lossLimitBtn.content.addChild(this.lossLimitLabel);
    this.addChild(this.lossLimitBtn);

    this.addChild(this.makeLinesHint());
  }

  private makeLinesHint(): Container {
    const c = new Container();
    c.position.set(DESIGN_W / 2 + 58 + 36, DESIGN_H - 74 - 32);
    const t = makeText(`${LINES.length} ЛИНИЙ`, 20, '#7a6a45', 'bold', 3);
    t.position.set(0, 22);
    c.addChild(t);
    return c;
  }

  private drawTurboBolt(on: boolean): void {
    const g = this.turboBolt.clear();
    const color = on ? 0x1a1208 : COLORS.parchment;
    if (on) {
      // Золотая подложка-заряд
      g.poly([0, -17, 9, -4, 4, -4, 10, 17, -8, 1, -2, 1, -9, 12])
        .fill({ color: 0xf1d97a, alpha: 0.25 });
    }
    g.poly([1, -16, 8, -4, 3, -4, 9, 15, -9, 0, -3, 0, -8, 14])
      .fill({ color })
      .stroke({ color: on ? COLORS.goldBright : 0x5a4a30, width: 1.5 });
  }

  setTurbo(on: boolean): void {
    this.drawTurboBolt(on);
    this.turboBtn.setEnabled(true);
    this.turboBtn.alpha = on ? 1 : 0.75;
  }

  setAutoplayLimits(winMult: number, lossMult: number): void {
    this.winLimitLabel.text = winMult > 0 ? `ВЫИГРЫШ ≥ ${winMult}×` : 'ВЫИГРЫШ ≥ выкл';
    this.lossLimitLabel.text = lossMult > 0 ? `ПРОИГРЫШ ≤ ${lossMult}×` : 'ПРОИГРЫШ ≤ выкл';
    this.winLimitLabel.style.fill = winMult > 0 ? COLORS.goldBright : '#6a5a3a';
    this.lossLimitLabel.style.fill = lossMult > 0 ? COLORS.goldBright : '#6a5a3a';
  }

  private drawMuteIcon(muted: boolean): void {
    const g = this.muteIconParts.clear();
    const color = muted ? 0x8a7a52 : COLORS.parchment;
    // Динамик: корпус + конус, симметрично по вертикали
    g.roundRect(-15, -6, 8, 12, 2).fill({ color });
    g.poly([-7, -6, 1, -13, 1, 13, -7, 6]).fill({ color });
    if (muted) {
      // Красный крест — однозначный сигнал «выключено»
      g.moveTo(9, -8).lineTo(20, 8).moveTo(20, -8).lineTo(9, 8)
        .stroke({ color: COLORS.redBright, width: 4, cap: 'round' });
    } else {
      // Две дуги-волны строго правее конуса, ничего не пересекают
      g.arc(1, 0, 8, -0.8, 0.8).stroke({ color, width: 3.5, cap: 'round' });
      g.arc(1, 0, 14, -0.7, 0.7).stroke({ color, width: 3.5, cap: 'round', alpha: 0.6 });
    }
  }

  setMuted(muted: boolean): void {
    this.drawMuteIcon(muted);
  }

  setBalance(v: number): void {
    this.balanceText.text = fmt(v);
  }

  setBet(lineBetIndex: number): void {
    const total = LINE_BETS[lineBetIndex] * LINES.length;
    this.betText.text = fmt(total);
    const can = lineBetIndex > 0;
    const canUp = lineBetIndex < LINE_BETS.length - 1;
    this.betDownBtn.setEnabled(can);
    this.betUpBtn.setEnabled(canUp);
  }

  setWin(v: number, showLabel = true): void {
    this.winText.text = v > 0 ? fmt(v) : '';
    this.winLabel.visible = showLabel && v > 0;
  }

  setSpinEnabled(enabled: boolean): void {
    this.spinBtn.setEnabled(enabled);
  }

  setAutoplay(remaining: number | null): void {
    this.autoplayRemaining = remaining;
    const sub = this.autoBtn.content.getChildByName('autoSub') as Text;
    if (remaining === null) {
      this.autoLabel.text = 'АВТО';
      sub.text = '10';
      this.autoBtn.setEnabled(true);
    } else {
      this.autoLabel.text = 'СТОП';
      sub.text = remaining === Number.POSITIVE_INFINITY ? '∞' : String(remaining);
    }
  }

  getAutoplayLabel(): number | null {
    return this.autoplayRemaining;
  }

  toast(msg: string): void {
    this.toastText.text = msg;
    this.toastText.alpha = 1;
    this.toastClock = 0;
  }

  update(dtMs: number): void {
    if (this.toastText.alpha > 0) {
      this.toastClock += dtMs;
      if (this.toastClock > 1600) {
        this.toastText.alpha = Math.max(0, 1 - (this.toastClock - 1600) / 500);
      }
    }
  }
}
