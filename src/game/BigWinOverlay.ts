/**
 * BigWinOverlay — полноэкранная заставка крупного выигрыша:
 * тьер (15×/30×/60×), набегающий счёт, золотые искры.
 * Закрывается кликом/Space или автоматически после счёта.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';
import { BIG_WIN_TIERS } from './config';
import { COLORS, makeText, makePanel } from './ui/widgets';
import { audio } from '../audio';

interface Spark {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class BigWinOverlay extends Container {
  private veil: Graphics;
  private panel: Container;
  private title: Text;
  private amount: Text;
  private sub: Text;
  private sparks: Spark[] = [];
  private active = false;
  private counting = false;
  private clock = 0;
  private countDur = 0;
  private amountVal = 0;
  private shown = 0;
  private holdAfter = 0;
  private onDone: (() => void) | null = null;
  private lastSparkle = 0;

  constructor() {
    super();
    this.eventMode = 'static';
    this.visible = false;

    this.veil = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x000000, alpha: 0.78 });
    this.addChild(this.veil);

    this.panel = makePanel(860, 380, 18);
    this.panel.position.set((DESIGN_W - 860) / 2, (DESIGN_H - 380) / 2 - 40);
    this.addChild(this.panel);

    this.title = makeText('БОЛЬШОЙ ВЫИГРЫШ', 54, COLORS.goldBright, 'bold', 8);
    this.title.anchor.set(0.5);
    this.title.position.set(430, 92);
    this.panel.addChild(this.title);

    this.amount = makeText('0', 96, '#ffffff', 'bold', 4);
    this.amount.anchor.set(0.5);
    this.amount.position.set(430, 210);
    this.panel.addChild(this.amount);

    this.sub = makeText('', 30, COLORS.parchment, 'normal', 3);
    this.sub.anchor.set(0.5);
    this.sub.position.set(430, 290);
    this.panel.addChild(this.sub);

    const hint = makeText('нажмите, чтобы продолжить', 20, '#8a7a52', 'normal', 2);
    hint.anchor.set(0.5);
    hint.position.set(430, 344);
    this.panel.addChild(hint);

    this.on('pointerdown', () => this.skip());
  }

  show(winAmount: number, bet: number, onDone: () => void): void {
    void bet;
    const mult = winAmount / bet;
    const tier = [...BIG_WIN_TIERS].sort((a, b) => b.mult - a.mult).find((t) => mult >= t.mult) ?? BIG_WIN_TIERS[BIG_WIN_TIERS.length - 1];
    this.title.text = tier.title;
    this.amount.text = '0';
    this.shown = 0;
    this.amountVal = winAmount;
    // Набегание счёта: 1.6–8 с независимо от размера выигрыша
    this.countDur = Math.min(8000, Math.max(1600, tier.mult * 60));
    this.sub.text = `${Math.round(mult)}× ОБЩЕЙ СТАВКИ`;
    this.onDone = onDone;
    this.active = true;
    this.counting = true;
    this.clock = 0;
    this.holdAfter = 1400;
    this.visible = true;
    audio.winFanfare(mult >= 30 ? 2 : 1);
    if (this.sparks.length === 0) this.spawnSparks();
  }

  skip(): void {
    if (!this.active) return;
    if (this.counting) {
      this.counting = false;
      this.shown = this.amountVal;
      this.amount.text = this.shown.toLocaleString('ru-RU');
      this.clock = this.countDur; // сразу в фазу удержания
    } else {
      this.finish();
    }
  }

  private finish(): void {
    this.active = false;
    this.visible = false;
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  private spawnSparks(): void {
    for (let i = 0; i < 46; i++) {
      const g = new Graphics()
        .circle(0, 0, 2 + Math.random() * 4)
        .fill({ color: Math.random() > 0.3 ? COLORS.goldBright : 0xffffff, alpha: 0.9 });
      g.blendMode = 'add';
      g.x = Math.random() * DESIGN_W;
      g.y = Math.random() * DESIGN_H;
      this.addChild(g);
      this.sparks.push({
        g,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 90,
        life: 0,
        maxLife: 2 + Math.random() * 3,
      });
    }
  }

  update(dtMs: number): void {
    if (!this.active) return;
    this.clock += dtMs;

    if (this.counting) {
      const k = Math.min(1, this.clock / this.countDur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(this.amountVal * eased);
      if (v !== this.shown) {
        this.shown = v;
        this.amount.text = v.toLocaleString('ru-RU');
      }
      if (this.clock - this.lastSparkle > 120) {
        this.lastSparkle = this.clock;
        audio.bigWinSparkle();
      }
      if (k >= 1) {
        this.counting = false;
        this.clock = 0;
        audio.coin();
      }
    } else {
      this.holdAfter -= dtMs;
      if (this.holdAfter <= 0) this.finish();
    }

    // Искры
    for (const s of this.sparks) {
      s.life += dtMs / 1000;
      if (s.life > s.maxLife) {
        s.life = 0;
        s.g.x = Math.random() * DESIGN_W;
        s.g.y = DESIGN_H + 20;
        s.vy = -30 - Math.random() * 90;
      }
      s.g.x += (s.vx * dtMs) / 1000;
      s.g.y += (s.vy * dtMs) / 1000;
      s.g.alpha = Math.max(0, 1 - s.life / s.maxLife) * 0.9;
    }

    // Пульс заголовка
    const p = 1 + 0.03 * Math.sin(this.clock / 120);
    this.title.scale.set(p);
  }
}
