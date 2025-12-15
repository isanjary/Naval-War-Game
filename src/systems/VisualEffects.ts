import Phaser from 'phaser';

export class VisualEffects {
  private scene: Phaser.Scene;
  private wakeParticles: Map<string, Phaser.GameObjects.Graphics[]> = new Map();
  private lastWakeTime: Map<string, number> = new Map();
  private readonly MAX_WAKE_PARTICLES = 15;
  private readonly WAKE_INTERVAL = 100; // Only create wake every 100ms

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Create wake trail behind a ship (throttled to prevent performance issues)
  public createWakeTrail(shipId: string, x: number, y: number, rotation: number, speed: number): void {
    if (speed < 50) return; // No wake if barely moving

    // Throttle wake creation
    const now = Date.now();
    const lastTime = this.lastWakeTime.get(shipId) || 0;
    if (now - lastTime < this.WAKE_INTERVAL) return;
    this.lastWakeTime.set(shipId, now);

    // Get or create particle array for this ship
    let particles = this.wakeParticles.get(shipId);
    if (!particles) {
      particles = [];
      this.wakeParticles.set(shipId, particles);
    }

    // Calculate spawn position (behind ship)
    const spawnX = x - Math.cos(rotation) * 30;
    const spawnY = y - Math.sin(rotation) * 30;

    // Create wake particle
    const particle = this.scene.add.graphics();
    const size = 3 + Math.random() * 4;
    const alpha = 0.3 + (speed / 300) * 0.3;
    
    particle.fillStyle(0xffffff, alpha);
    particle.fillCircle(0, 0, size);
    particle.setPosition(spawnX, spawnY);
    particle.setDepth(-1);

    particles.push(particle);

    // Animate and fade
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        particle.destroy();
        const idx = particles!.indexOf(particle);
        if (idx > -1) particles!.splice(idx, 1);
      }
    });

    // Limit particles per ship
    while (particles.length > this.MAX_WAKE_PARTICLES) {
      const old = particles.shift();
      old?.destroy();
    }
  }

  // Enhanced explosion effect
  public createExplosion(x: number, y: number, size: 'small' | 'medium' | 'large' = 'medium'): void {
    const particleCount = size === 'small' ? 8 : size === 'medium' ? 16 : 24;
    const baseSize = size === 'small' ? 8 : size === 'medium' ? 12 : 20;
    const spread = size === 'small' ? 40 : size === 'medium' ? 60 : 100;
    const duration = size === 'small' ? 300 : size === 'medium' ? 500 : 700;

    // Core flash
    const flash = this.scene.add.circle(x, y, baseSize * 2, 0xffffff, 1);
    flash.setDepth(10);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: duration / 3,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });

    // Fire particles (orange/yellow)
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
      const distance = spread * (0.5 + Math.random() * 0.5);
      const particleSize = baseSize * (0.3 + Math.random() * 0.7);
      
      const color = Math.random() > 0.5 ? 0xf39c12 : 0xe74c3c;
      const particle = this.scene.add.circle(x, y, particleSize, color, 1);
      particle.setDepth(9);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: duration,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // Smoke particles (gray)
    for (let i = 0; i < particleCount / 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * 0.8 * Math.random();
      const smokeSize = baseSize * (0.5 + Math.random() * 0.5);
      
      const smoke = this.scene.add.circle(x, y, smokeSize, 0x555555, 0.6);
      smoke.setDepth(8);

      this.scene.tweens.add({
        targets: smoke,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 30, // Rise up
        alpha: 0,
        scale: 2,
        duration: duration * 1.5,
        delay: duration * 0.3,
        ease: 'Power1',
        onComplete: () => smoke.destroy()
      });
    }
  }

  // Damage indicator (red flash on hit)
  public createDamageFlash(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 30, 0xe74c3c, 0.5);
    flash.setDepth(5);
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });
  }

  // Screen shake
  public shakeScreen(intensity: 'light' | 'medium' | 'heavy' = 'medium'): void {
    const amounts = { light: 0.002, medium: 0.005, heavy: 0.01 };
    const durations = { light: 100, medium: 200, heavy: 400 };
    
    this.scene.cameras.main.shake(durations[intensity], amounts[intensity]);
  }

  // Muzzle flash effect
  public createMuzzleFlash(x: number, y: number, rotation: number): void {
    // Flash
    const flash = this.scene.add.circle(x, y, 15, 0xf39c12, 0.9);
    flash.setDepth(10);
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 80,
      onComplete: () => flash.destroy()
    });

    // Smoke puff
    const smokeX = x + Math.cos(rotation) * 10;
    const smokeY = y + Math.sin(rotation) * 10;
    const smoke = this.scene.add.circle(smokeX, smokeY, 8, 0x888888, 0.5);
    smoke.setDepth(9);
    
    this.scene.tweens.add({
      targets: smoke,
      x: smokeX + Math.cos(rotation) * 20,
      y: smokeY + Math.sin(rotation) * 20,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => smoke.destroy()
    });
  }

  // Water splash (bullet hitting water)
  public createWaterSplash(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const droplet = this.scene.add.circle(x, y, 3, 0x3498db, 0.7);
      droplet.setDepth(5);

      this.scene.tweens.add({
        targets: droplet,
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20 - 10,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => droplet.destroy()
      });
    }
  }

  // Level up visual effect
  public createLevelUpEffect(x: number, y: number): void {
    // Rising rings
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.circle(x, y, 20, 0xf1c40f, 0);
      ring.setStrokeStyle(3, 0xf1c40f, 1);
      ring.setDepth(15);

      this.scene.tweens.add({
        targets: ring,
        scale: 3 + i,
        alpha: 0,
        y: y - 50,
        duration: 800,
        delay: i * 150,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // Sparkles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const sparkle = this.scene.add.star(x, y, 4, 2, 6, 0xf1c40f, 1);
      sparkle.setDepth(16);

      this.scene.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 80,
        alpha: 0,
        rotation: Math.PI * 2,
        duration: 600,
        ease: 'Power2',
        onComplete: () => sparkle.destroy()
      });
    }
  }

  // Cleanup wake trails for a destroyed ship
  public cleanupWake(shipId: string): void {
    const particles = this.wakeParticles.get(shipId);
    if (particles) {
      particles.forEach(p => p.destroy());
      this.wakeParticles.delete(shipId);
    }
  }

  public destroy(): void {
    for (const [_, particles] of this.wakeParticles) {
      particles.forEach(p => p.destroy());
    }
    this.wakeParticles.clear();
  }
}
