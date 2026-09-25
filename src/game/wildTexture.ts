/**
 * Текстура wild-символа «Череп-реликвия»: генерируется вектором
 * (золотая рамка в духе арта + костяной череп + плашка WILD),
 * т.к. в исходном атласе отдельного черепа нет.
 */
import { Container, Graphics, Renderer, Text, Texture, TextStyle } from 'pixi.js';
import { ATLAS } from './config';

export function makeWildTexture(renderer: Renderer): Texture {
  const S = ATLAS.cell; // 418 — размер ячейки атласа
  const c = new Container();

  const g = new Graphics();
  // Тёмный фон
  g.roundRect(6, 6, S - 12, S - 12, 36).fill({ color: 0x100c14, alpha: 0.97 });
  // Двойная золотая рамка
  g.roundRect(10, 10, S - 20, S - 20, 32).stroke({ color: 0x6e5410, width: 10 });
  g.roundRect(24, 24, S - 48, S - 48, 24).stroke({ color: 0xc9a227, width: 4, alpha: 0.95 });
  // Костяной череп
  const bone = 0xe9dfc8;
  g.ellipse(S / 2, S * 0.43, S * 0.205, S * 0.225).fill({ color: bone });
  g.roundRect(S * 0.355, S * 0.52, S * 0.29, S * 0.21, 14).fill({ color: bone });
  // Глазницы
  g.circle(S * 0.435, S * 0.43, S * 0.058).fill({ color: 0x0b0810 });
  g.circle(S * 0.565, S * 0.43, S * 0.058).fill({ color: 0x0b0810 });
  // Красное свечение в глазницах
  g.circle(S * 0.435, S * 0.43, S * 0.02).fill({ color: 0xd93636 });
  g.circle(S * 0.565, S * 0.43, S * 0.02).fill({ color: 0xd93636 });
  // Нос
  g.moveTo(S / 2, S * 0.49);
  g.lineTo(S * 0.478, S * 0.55);
  g.lineTo(S * 0.522, S * 0.55);
  g.closePath();
  g.fill({ color: 0x0b0810 });
  // Зубы
  for (let i = 0; i < 5; i++) {
    g.rect(S * (0.39 + i * 0.045), S * 0.6, S * 0.018, S * 0.11).fill({ color: 0x0b0810 });
  }
  c.addChild(g);

  // Плашка WILD
  const plate = new Graphics()
    .roundRect(S * 0.21, S * 0.79, S * 0.58, S * 0.125, 12)
    .fill({ color: 0x1c0d08, alpha: 0.95 })
    .roundRect(S * 0.21, S * 0.79, S * 0.58, S * 0.125, 12)
    .stroke({ color: 0xc9a227, width: 3 });
  c.addChild(plate);
  const label = new Text({
    text: 'WILD',
    style: new TextStyle({
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: S * 0.082,
      fill: 0xf1d97a,
      fontWeight: 'bold',
      letterSpacing: 6,
    }),
  });
  label.anchor.set(0.5);
  label.position.set(S / 2, S * 0.852);
  c.addChild(label);

  return renderer.generateTexture(c);
}
