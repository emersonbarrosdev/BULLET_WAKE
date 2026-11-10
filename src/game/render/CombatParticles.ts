import Phaser from 'phaser';

interface Particle {
  node: Phaser.GameObjects.Image;
  vx: number; vy: number; age: number; life: number; size: number;
  spin: number; smoke: boolean;
}

/** Bounded, short-lived debris and spray; movement is independent of sprite animation. */
export class CombatParticles {
  private readonly particles: Particle[] = [];
  constructor(private readonly scene: Phaser.Scene) {}

  burst(x: number, y: number, strength = 1, water = false, tint?: number): void {
    const count = Math.round(14 * strength);
    for (let i = 0; i < count && this.particles.length < 180; i++) {
      const angle = i * 2.39996 + Math.random() * .3;
      const speed = (25 + Math.random() * 95) * Math.sqrt(strength);
      const smoke = !water && i % 4 === 0 && tint === undefined;
      const size = smoke ? 12 : 2 + Math.random() * 4;
      const node = this.scene.add.image(x, y, 'polish-explosion', smoke ? 12 : 1)
        .setDisplaySize(size, size).setDepth(smoke ? 7 : 20)
        .setTint(tint ?? (water ? 0xb4f4f3 : smoke ? 0x5c5552 : 0xffc87e));
      this.particles.push({node,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,age:0,life:smoke?950:350+Math.random()*420,size,spin:(Math.random()-.5)*8,smoke});
    }
  }

  update(dt: number): void {
    const seconds = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.age += dt;
      if (p.age >= p.life) {p.node.destroy();this.particles.splice(i,1);continue;}
      p.node.x += p.vx*seconds; p.node.y += p.vy*seconds;
      p.vx *= Math.exp(-seconds*2); p.vy += (p.smoke?-12:34)*seconds;
      p.node.rotation += p.spin*seconds;
      const progress = p.age/p.life;
      p.node.setAlpha((1-progress)*(p.smoke?.45:.95));
      if (p.smoke) p.node.setDisplaySize(p.size*(1+progress*2),p.size*(1+progress*2));
    }
  }

  get activeCount(): number {return this.particles.length;}
}
