/**
 * Embers — ambient-слой огненных частиц: медленно поднимаются,
 * покачиваются, мерцают и перерождаются внизу. Живёт между фоном
 * и барабанами; blend 'add' даёт эффект тлеющих искр от свечей.
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

export class Embers extends Container {
  private particles: Particle[] = [];
  private clock = 0;

  constructor(count = 34) {
    super();
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
