/**
 * Базовые UI-виджеты: панели, текст, кнопки — в мрачно-золотой стилистике.
 * Всё рисуется Graphics'ом, без внешних текстур.
 */
import { Container, Graphics, Text, TextStyle, type ColorSource } from 'pixi.js';

export const COLORS = {
  gold: 0xc9a227,
  goldBright: 0xf1d97a,
  goldDark: 0x6e5410,
  parchment: 0xe8d9a0,
  red: 0x9b1c1c,
  redBright: 0xd93636,
  panel: 0x0d0a08,
  panelLight: 0x1a1410,
  black: 0x050403,
} as const;

export function makeText(
  text: string,
  size: number,
  color: ColorSource = COLORS.parchment,
  weight: 'normal' | 'bold' = 'normal',
  letterSpacing = 2,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: size,
      fill: color,
      fontWeight: weight,
      letterSpacing,
      dropShadow: {
        color: 0x000000,
        alpha: 0.85,
        blur: 3,
        distance: 2,
        angle: Math.PI / 2,
      },
    }),
  });
}

/** Тёмная панель с золотой окантовкой. */
export function makePanel(w: number, h: number, radius = 10): Container {
  const c = new Container();
  const g = new Graphics()
    .roundRect(1, 1, w - 2, h - 2, radius)
    .fill({ color: COLORS.panel, alpha: 0.82 })
    .roundRect(1, 1, w - 2, h - 2, radius)
    .stroke({ color: COLORS.goldDark, width: 2, alpha: 0.9 })
    .roundRect(4, 4, w - 8, h - 8, Math.max(2, radius - 3))
    .stroke({ color: COLORS.gold, width: 1, alpha: 0.55 });
  c.addChild(g);
  return c;
}

type ButtonShape = 'circle' | 'rect';

export class Button extends Container {
  private bg: Graphics;
  private _enabled = true;
  private _pressed = false;
  private _hover = false;
  readonly content: Container = new Container();

  constructor(
    w: number,
    h: number,
    shape: ButtonShape,
    private onClick: () => void,
    private opts: { base?: ColorSource; accent?: ColorSource } = {},
  ) {
    super();
    this.bg = new Graphics();
    this.addChild(this.bg, this.content);
    this.draw(w, h, shape);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      this._pressed = true;
      this.redraw(w, h, shape);
    });
    this.on('pointerup', () => {
      if (this._pressed && this._enabled) this.onClick();
      this._pressed = false;
      this.redraw(w, h, shape);
    });
    this.on('pointerupoutside', () => {
      this._pressed = false;
      this.redraw(w, h, shape);
    });
    this.on('pointerover', () => {
      this._hover = true;
      this.redraw(w, h, shape);
    });
    this.on('pointerout', () => {
      this._hover = false;
      this.redraw(w, h, shape);
    });
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
    this.cursor = v ? 'pointer' : 'default';
    this.alpha = v ? 1 : 0.45;
  }

  redraw(w: number, h: number, shape: ButtonShape): void {
    this.draw(w, h, shape);
  }

  private draw(w: number, h: number, shape: ButtonShape): void {
    const base = this.opts.base ?? COLORS.panelLight;
    const accent = this.opts.accent ?? COLORS.gold;
    const g = this.bg.clear();
    const pressed = this._pressed && this._enabled;
    const lighten = (this._hover && this._enabled) || pressed;
    g.roundRect(0, 0, w, h, shape === 'circle' ? Math.min(w, h) / 2 : 8);
    g.fill({ color: pressed ? accent : base, alpha: pressed ? 0.9 : 0.92 });
    g.roundRect(0, 0, w, h, shape === 'circle' ? Math.min(w, h) / 2 : 8);
    g.stroke({ color: accent, width: pressed ? 3 : 2, alpha: lighten ? 1 : 0.75 });
    if (lighten && !pressed) {
      g.roundRect(2, 2, w - 4, h - 4, shape === 'circle' ? Math.min(w, h) / 2 - 2 : 6);
      g.fill({ color: 0xffffff, alpha: 0.07 });
    }
  }
}
