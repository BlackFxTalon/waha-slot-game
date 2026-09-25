/**
 * Embers — ambient-слой живого огня: тлеющие искры, поднимающиеся вверх,
 * И мерцающие ореолы свечей/огня на фоне (микро-анимация пламени).
 * Живёт между фоном и барабанами; blend 'add'.
 */
import { Container, Graphics } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';

const PALETTE = [0xff8c3a, 0xf1d97a, 0xd95536, 0xffc46a];

interface Particle {
  g: Graphics;
  vy: number;
  sway: number;
  phase: number;
  baseAlpha: number;
}

interface Glow {
  g: Graphics;
  baseAlpha: number;
  phase: number;
  speed: number;
}

/** Очаги света на фоне (координаты дизайна 1920×1080): кадильницы, чаши, свечи. */
const GLOW_POINTS: Array<{ x: number; y: number; r: number; a: number }> = [
  { x: 285, y: 155, r: 95, a: 0.14 },   // левая кадильница
  { x: 1650, y: 140, r: 95, a: 0.14 },  // правая кадильница
  { x: 110, y: 590, r: 85, a: 0.12 },   // левая чаша
  { x: 185, y: 645, r: 65, a: 0.10 },
  { x: 65, y: 690, r: 90, a: 0.12 },
  { x: 1815, y: 590, r: 85, a: 0.12 },  // правая чаша
  { x: 1745, y: 645, r: 65, a: 0.10 },
  { x: 1855, y: 690, r: 90, a: 0.12 },
  { x: 245, y: 705, r: 55, a: 0.09 },   // свечи на ступенях
  { x: 1672, y: 705, r: 55, a: 0.09 },
];

export class Embers extends Container {
  private particles: Particle[] = [];
  private glows: Glow[] = [];
  private clock = 0;

  constructor(count = 34) {
    super();

    // Мерцающие ореолы огня (за искрами)
    for (const p of GLOW_POINTS) {
      const g = new Graphics()
        .circle(0, 0, p.r)
        .fill({ color: 0xff7a2a, alpha: 1 })
        .circle(0, 0, p.r * 0.55)
        .fill({ color: 0xffb347, alpha: 0.6 });
      g.blendMode = 'add';
      g.position.set(p.x, p.y);
      g.alpha = p.a;
      this.addChild(g);
      this.glows.push({ g, baseAlpha: p.a, phase: Math.random() * Math.PI * 2, speed: 0.7 + Math.random() * 0.9 });
    }

    for (let i = 0; i < count; i++) {
      const g = new Graphics()
        .circle(0, 0, 1.2 + Math.random() * 2.6)
        .fill({ color: PALETTE[i % PALETTE.length] });
      g.blendMode = 'add';
      g.x = Math.random() * DESIGN_W;
      g.y = Math.random() * DESIGN_H;
      g.alpha = 0;
      this.addChild(g);
      this.particles.push({
        g,
        vy: 12 + Math.random() * 26,
        sway: 10 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: 0.16 + Math.random() * 0.34,
      });
    }
  }

  update(dtMs: number): void {
    this.clock += dtMs / 1000;
    const dt = Math.min(dtMs, 50) / 1000;

    // Фликер пламени: наложение двух синусоид + лёгкий шум
    for (const gl of this.glows) {
      const n = 0.72
        + 0.18 * Math.sin(this.clock * gl.speed * 7 + gl.phase)
        + 0.10 * Math.sin(this.clock * gl.speed * 17.3 + gl.phase * 2.7);
      gl.g.alpha = Math.max(0.03, gl.baseAlpha * n);
      const s = 0.94 + 0.06 * Math.sin(this.clock * gl.speed * 11 + gl.phase);
      gl.g.scale.set(s);
    }

    for (const p of this.particles) {
      p.g.y -= p.vy * dt;
      p.g.x += Math.sin(this.clock * 0.9 + p.phase) * p.sway * dt;
      const twinkle = 0.6 + 0.4 * Math.sin(this.clock * (1.4 + (p.phase % 1)) + p.phase);
      p.g.alpha = p.baseAlpha * twinkle;
      if (p.g.y < -10) {
        p.g.y = DESIGN_H + 10;
        p.g.x = Math.random() * DESIGN_W;
      }
    }
  }
}
