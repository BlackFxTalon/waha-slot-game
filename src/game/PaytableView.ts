/**
 * PaytableView — оверлей «Таблица выплат»: символы с множителями,
 * схема 10 линий, правила. Открывается/закрывается по «i»/Escape/клику мимо.
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';
import { ATLAS, LINES, SYMBOLS, type SymbolId } from './config';
import { COLORS, makePanel, makeText } from './ui/widgets';

export class PaytableView extends Container {
  private veil: Graphics;
  private panel: Container;
  open = false;

  constructor(symbols: Record<SymbolId, Texture>) {
    super();
    this.eventMode = 'static';
    this.visible = false;

    this.veil = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x000000, alpha: 0.82 });
    this.addChild(this.veil);

    const W = 1240;
    const H = 880;
    this.panel = makePanel(W, H, 16);
    this.panel.position.set((DESIGN_W - W) / 2, (DESIGN_H - H) / 2);
    this.addChild(this.panel);

    const title = makeText('ТАБЛИЦА ВЫПЛАТ', 44, COLORS.goldBright, 'bold', 6);
    title.anchor.set(0.5);
    title.position.set(W / 2, 58);
    this.panel.addChild(title);

    // --- Символы: 3 колонки × 3 ряда ---
    const iconSize = 64;
    const colW = 380;
    const rowH = 118;
    const tableX = 56;
    const tableY = 120;
    SYMBOLS.forEach((def, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = tableX + col * colW;
      const y = tableY + row * rowH;

      const iconHolder = new Container();
      iconHolder.position.set(x + iconSize / 2, y + iconSize / 2);
      const icon = new Sprite(symbols[def.id]);
      icon.anchor.set(0.5);
      const k = (iconSize / ATLAS.cell) * 1.08;
      icon.scale.set(k);
      iconHolder.addChild(icon);
      this.panel.addChild(iconHolder);

      const name = makeText(def.name, 20, COLORS.parchment, 'bold', 1);
      name.position.set(x + iconSize + 14, y + 2);
      this.panel.addChild(name);

      const pays = makeText(
        `3 — ×${def.pays[0]}   4 — ×${def.pays[1]}   5 — ×${def.pays[2]}`,
        17,
        '#b9a86f',
        'normal',
        0,
      );
      pays.position.set(x + iconSize + 14, y + 32);
      this.panel.addChild(pays);
    });

    const note = makeText('Множители применяются к ставке на линию (общая ставка / 10)', 19, '#8a7a52');
    note.position.set(tableX, tableY + 3 * rowH + 8);
    this.panel.addChild(note);

    // --- Схема линий: 10 мини-сеток 5×3 ---
    const linesTitle = makeText('ЛИНИИ ВЫПЛАТ', 26, COLORS.goldBright, 'bold', 4);
    linesTitle.position.set(tableX, tableY + 3 * rowH + 48);
    this.panel.addChild(linesTitle);

    const miniCell = 13;
    const miniGapX = 92;
    const miniGapY = 74;
    const linesY = tableY + 3 * rowH + 92;
    LINES.forEach((line, li) => {
      const lx = tableX + (li % 5) * miniGapX;
      const ly = linesY + Math.floor(li / 5) * miniGapY;
      const g = new Graphics();
      for (let reel = 0; reel < 5; reel++) {
        for (let row = 0; row < 3; row++) {
          const on = line[reel] === row;
          g.circle(lx + 6 + reel * miniCell, ly + 6 + row * miniCell, on ? 4.4 : 2.4)
            .fill({ color: on ? COLORS.goldBright : 0x4a3d22 });
        }
      }
      this.panel.addChild(g);
      const num = makeText(String(li + 1), 15, '#8a7a52', 'bold', 0);
      num.position.set(lx + 66, ly + 8);
      this.panel.addChild(num);
    });

    // --- Правила ---
    const rulesY = linesY + 2 * miniGapY + 16;
    const rules = makeText(
      'Выигрыш считается слева направо, начиная с крайнего левого барабана. ' +
      'Выплачивается только самая длинная серия на каждой линии. Выигрыши по разным линиям суммируются. ' +
      'Барабаны останавливаются поочерёдно; при 4 одинаковых символах на линии пятый барабан замедляется. ' +
      'Выигрыш от 15× общей ставки открывает БОЛЬШОЙ ВЫИГРЫШ, от 30× — МЕГА, от 60× — БОЖЕСТВЕННЫЙ.',
      19,
      '#b9a86f',
      'normal',
      0,
    );
    rules.style.wordWrap = true;
    rules.style.wordWrapWidth = W - 120;
    rules.style.lineHeight = 27;
    rules.position.set(tableX, rulesY);
    this.panel.addChild(rules);

    const hint = makeText('ESC / i / клик мимо — закрыть', 18, '#6e5e3c', 'normal', 2);
    hint.anchor.set(0.5, 0);
    hint.position.set(W / 2, H - 34);
    this.panel.addChild(hint);

    // Клик мимо панели закрывает
    this.on('pointerdown', (e) => {
      const p = e.global;
      const px = this.panel.x;
      const py = this.panel.y;
      if (p.x < px || p.x > px + W || p.y < py || p.y > py + H) this.close();
    });
  }

  openView(): void {
    this.open = true;
    this.visible = true;
  }

  close(): void {
    this.open = false;
    this.visible = false;
  }

  toggle(): boolean {
    if (this.open) this.close();
    else this.openView();
    return this.open;
  }
}
