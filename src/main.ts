/**
 * Точка входа: инициализация PIXI Application, экран загрузки,
 * scale-to-fit + letterbox для дизайн-разрешения 1920×1080, запуск Game.
 */
import { Application, Container, Graphics } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from './layout';
import { loadAssets } from './assets';
import { Game } from './game/Game';
import { COLORS, makeText } from './game/ui/widgets';

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({
    background: COLORS.black,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('app')?.appendChild(app.canvas);

  // ── Корневой слой с масштабированием (letterbox) ──────────────────
  const root = new Container();
  app.stage.addChild(root);
  const fit = (): void => {
    const scale = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
    root.scale.set(scale);
    root.position.set(
      (app.screen.width - DESIGN_W * scale) / 2,
      (app.screen.height - DESIGN_H * scale) / 2,
    );
  };
  fit();
  window.addEventListener('resize', fit);

  // ── Экран загрузки ────────────────────────────────────────────────
  const loading = new Container();
  const veil = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x070503 });
  loading.addChild(veil);

  const title = makeText('GRIM FORTUNE', 84, COLORS.goldBright, 'bold', 14);
  title.anchor.set(0.5);
  title.position.set(DESIGN_W / 2, DESIGN_H / 2 - 60);
  loading.addChild(title);

  const subtitle = makeText('барабаны готического собора пробуждаются…', 26, '#7a6a45', 'normal', 3);
  subtitle.anchor.set(0.5);
  subtitle.position.set(DESIGN_W / 2, DESIGN_H / 2 + 4);
  loading.addChild(subtitle);

  const barW = 560;
  const barBg = new Graphics()
    .roundRect(DESIGN_W / 2 - barW / 2, DESIGN_H / 2 + 70, barW, 10, 5)
    .fill({ color: 0x241c10 });
  const barFill = new Graphics();
  loading.addChild(barBg, barFill);
  root.addChild(loading);

  const drawProgress = (p: number): void => {
    barFill.clear();
    barFill.roundRect(DESIGN_W / 2 - barW / 2, DESIGN_H / 2 + 70, Math.max(2, barW * p), 10, 5)
      .fill({ color: COLORS.gold });
  };
  drawProgress(0);

  try {
    const assets = await loadAssets(drawProgress);
    loading.destroy({ children: true });

    const game = new Game(app, assets);
    root.addChild(game);
  } catch (err) {
    console.error('Не удалось загрузить ассеты:', err);
    const errText = makeText('Ошибка загрузки. Перезагрузите страницу.', 32, COLORS.redBright, 'bold', 2);
    errText.anchor.set(0.5);
    errText.position.set(DESIGN_W / 2, DESIGN_H / 2 + 130);
    loading.addChild(errText);
  }
}

void bootstrap();
