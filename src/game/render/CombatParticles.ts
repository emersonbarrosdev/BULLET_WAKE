import Phaser from 'phaser';
import { GAME_HEIGHT, PLAYFIELD_X, PLAYFIELD_RIGHT } from '../constants';

interface Particle {
  node: Phaser.GameObjects.Image;
  vx: number; vy: number; age: number; life: number; size: number;
  spin: number;
}

/** Bounded, short-lived debris and spray; movement is independent of sprite animation. */
export class CombatParticles {
  private readonly particles: Particle[] = [];
  constructor(private readonly scene: Phaser.Scene) {}

  burst(x: number, y: number, strength = 1, water = false, tint?: number): void {
    const count = Math.round(14 * strength);
    for (let i = 0; i < count && this.particles.length < 120; i++) {
      const angle = i * 2.39996 + Math.random() * .3;
      const speed = (65 + Math.random() * 125) * Math.sqrt(strength);
      const size = 3 + Math.random() * 5;
      const node = this.scene.add.image(x, y, 'polish-explosion', 0)
        .setDisplaySize(size, size).setDepth(20)
        .setTint(tint ?? (water ? 0xb4f4f3 : i%3===0 ? 0xffffff : 0xffae35));
      this.particles.push({node,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,age:0,life:160+Math.random()*180,size,spin:(Math.random()-.5)*8});
    }
  }

  update(dt: number): void {
    const seconds = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.age += dt;
      if (p.age >= p.life || p.node.x<PLAYFIELD_X || p.node.x>PLAYFIELD_RIGHT || p.node.y<0 || p.node.y>GAME_HEIGHT) {p.node.destroy();this.particles.splice(i,1);continue;}
      p.node.x += p.vx*seconds; p.node.y += p.vy*seconds;
      p.vx *= Math.exp(-seconds*1.2); p.vy += 34*seconds;
      p.node.rotation += p.spin*seconds;
      const progress = p.age/p.life;
      p.node.setAlpha((1-progress)*.95).setDisplaySize(p.size*(1-progress*.65),p.size*(1-progress*.65));
    }
  }

  get activeCount(): number {return this.particles.length;}
}
