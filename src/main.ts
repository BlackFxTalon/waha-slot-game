/**
 * Точка входа: PIXI Application, экран загрузки, масштабирование
 * с двумя дизайн-режимами (landscape 1920×1080 / portrait 1080×1920).
 * При смене режима (поворот устройства) игра пересоздаётся —
 * баланс/настройки живут в localStorage и переживают пересоздание.
 */
import { Application, Container, Graphics } from 'pixi.js';
import { DESIGN_H, DESIGN_W, computeLayout, MODE, type LayoutMode } from './layout';
import { loadAssets, type GameAssets } from './assets';
import { Game } from './game/Game';
import { COLORS, makeText } from './game/ui/widgets';

let assets: GameAssets | null = null;
let root: Container;
let game: Game | null = null;
let currentMode: LayoutMode | null = null;

function fit(app: Application): void {
  const scale = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
  root.scale.set(scale);
  root.position.set(
    (app.screen.width - DESIGN_W * scale) / 2,
    (app.screen.height - DESIGN_H * scale) / 2,
  );
}

/** Создаёт Game поверх фона (ассеты уже загружены). */
function createGame(app: Application): void {
  if (game) {
    root.removeChild(game);
    game.destroy({ children: true });
    game = null;
  }
  game = new Game(app, assets!);
  root.addChild(game);
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    background: COLORS.black,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('app')?.appendChild(app.canvas);

  root = new Container();
  app.stage.addChild(root);

  computeLayout(app.screen.width, app.screen.height);
  currentMode = MODE;

  // ── Экран загрузки ────────────────────────────────────────────────
  const loading = new Container();
  loading.addChild(new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x070503 }));

  const title = makeText('GRIM FORTUNE', 84, COLORS.goldBright, 'bold', 14);
  title.anchor.set(0.5);
  title.position.set(DESIGN_W / 2, DESIGN_H / 2 - 60);
  loading.addChild(title);

  const subtitle = makeText('тёмные барабаны готического собора', 26, '#7a6a45', 'normal', 3);
  subtitle.anchor.set(0.5);
  subtitle.position.set(DESIGN_W / 2, DESIGN_H / 2 + 4);
  loading.addChild(subtitle);

  const barW = Math.min(560, DESIGN_W * 0.6);
  const barBg = new Graphics()
    .roundRect(DESIGN_W / 2 - barW / 2, DESIGN_H / 2 + 70, barW, 10, 5)
    .fill({ color: 0x241c10 });
  const barFill = new Graphics();
  loading.addChild(barBg, barFill);
  root.addChild(loading);

  const drawProgress = (p: number): void => {
    barFill.clear();
    barFill
      .roundRect(DESIGN_W / 2 - barW / 2, DESIGN_H / 2 + 70, Math.max(2, barW * p), 10, 5)
      .fill({ color: COLORS.gold });
  };
  drawProgress(0);

  const onResize = (): void => {
    fit(app);
    const newMode = MODE;
    if (assets && newMode !== currentMode) {
      // Поворот устройства: пересобираем игру под новый дизайн
      currentMode = newMode;
      createGame(app);
    }
  };
  window.addEventListener('resize', onResize);

  try {
    assets = await loadAssets(drawProgress);
    loading.destroy({ children: true });
    createGame(app);
    fit(app);
  } catch (err) {
    console.error('Не удалось загрузить ассеты:', err);
    const errText = makeText('Ошибка загрузки. Перезагрузите страницу.', 32, COLORS.redBright, 'bold', 2);
    errText.anchor.set(0.5);
    errText.position.set(DESIGN_W / 2, DESIGN_H / 2 + 130);
    loading.addChild(errText);
  }
}

void main();
