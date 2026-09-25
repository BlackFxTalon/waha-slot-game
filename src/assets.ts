/**
 * Загрузка ассетов: фон + нарезка 9 символов из атласа (сетка 3×3).
 * Никакого препроцессинга: суб-текстуры создаются frame'ами поверх
 * одного TextureSource.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import { ATLAS, type SymbolId, SYMBOLS } from './game/config';
import symbolsUrl from '../assets/symbols.png';
import backgroundUrl from '../assets/background.png';

export interface GameAssets {
  bg: Texture;
  symbols: Record<SymbolId, Texture>;
}

export async function loadAssets(onProgress: (p: number) => void): Promise<GameAssets> {
  onProgress(0.05);

  // Параллельная загрузка двух изображений
  const [bg, atlas] = await Promise.all([
    Assets.load<Texture>(backgroundUrl),
    Assets.load<Texture>(symbolsUrl),
  ]);
  onProgress(0.7);

  const source = atlas.source;
  const symbols = {} as Record<SymbolId, Texture>;
  let done = 0;
  for (const def of SYMBOLS) {
    const [col, row] = def.atlas;
    symbols[def.id] = new Texture({
      source,
      frame: new Rectangle(col * ATLAS.cell, row * ATLAS.cell, ATLAS.cell, ATLAS.cell),
    });
    done++;
    onProgress(0.7 + 0.3 * (done / SYMBOLS.length));
  }
  onProgress(1);
  return { bg, symbols };
}
