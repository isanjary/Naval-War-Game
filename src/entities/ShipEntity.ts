import Phaser from 'phaser';
import type { ShipClass } from '@shared/types';

// Ship visual configurations by class
const SHIP_CONFIGS: Record<ShipClass, {
  color: number;
  size: number;
  shape: 'patrol' | 'destroyer' | 'cruiser' | 'battleship' | 'submarine' | 'carrier';
}> = {
  patrol_boat: { color: 0x3498db, size: 2, shape: 'patrol' },
  destroyer: { color: 0xe74c3c, size: 2.5, shape: 'destroyer' },
  cruiser: { color: 0x9b59b6, size: 2.75, shape: 'cruiser' },
  battleship: { color: 0x2c3e50, size: 3, shape: 'battleship' },
  submarine: { color: 0x1abc9c, size: 2, shape: 'submarine' },
  carrier: { color: 0xf39c12, size: 3.5, shape: 'carrier' }
};

export class ShipEntity extends Phaser.GameObjects.Container {
  private static readonly TEXTURE_SIZE = 512;

  public shipId: string;
  public shipClass: ShipClass;
  public health: number;
  public maxHealth: number;
  public level: number;
  public isStealthed: boolean = false;
  public isShielded: boolean = false;
  
  // Interpolation
  private targetX: number;
  private targetY: number;
  private targetRotation: number;
  private readonly LERP_SPEED = 0.15;

  private bodyImage: Phaser.GameObjects.Image;
  private healthBar: Phaser.GameObjects.Graphics;
  private shieldGraphics: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shipId: string,
    shipClass: ShipClass = 'patrol_boat',
    playerName: string = ''
  ) {
    super(scene, x, y);

    this.shipId = shipId;
    this.shipClass = shipClass;
    this.health = 100;
    this.maxHealth = 100;
    this.level = 1;
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = 0;

    // Create cached ship body texture (static per ship class)
    ShipEntity.ensureBodyTexture(scene, shipClass);
    this.bodyImage = scene.add.image(0, 0, ShipEntity.getBodyTextureKey(shipClass));
    this.bodyImage.setOrigin(0.5, 0.5);
    this.add(this.bodyImage);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);

    // Create shield effect graphics
    this.shieldGraphics = scene.add.graphics();
    this.add(this.shieldGraphics);

    // Create name text
    this.nameText = scene.add.text(0, -45, playerName, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.add(this.nameText);

    // Update body texture
    this.updateBodyTexture();
    this.updateHealthBar();

    // Add to scene
    scene.add.existing(this);
  }

  public static getBodyTextureKey(shipClass: ShipClass): string {
    return `ship-body:${shipClass}`;
  }

  public static ensureBodyTexture(scene: Phaser.Scene, shipClass: ShipClass): void {
    const key = ShipEntity.getBodyTextureKey(shipClass);
    if (scene.textures.exists(key)) return;

    const g = scene.add.graphics();
    g.setVisible(false);

    // Draw ship centered at (0,0)
    const config = SHIP_CONFIGS[shipClass];
    const scale = config.size;
    g.fillStyle(config.color, 1);
    g.lineStyle(2, 0xffffff, 0.8);

    // Shift drawing into the middle of our render target
    const cx = ShipEntity.TEXTURE_SIZE / 2;
    const cy = ShipEntity.TEXTURE_SIZE / 2;
    g.save();
    // Phaser Graphics doesn't support translate directly; we offset coordinates manually.

    const offsetPoints = (pts: { x: number; y: number }[]) => pts.map(p => ({ x: p.x + cx, y: p.y + cy }));

    const fillPoints = (pts: { x: number; y: number }[], close = true) => {
      g.fillPoints(offsetPoints(pts), close);
      g.strokePoints(offsetPoints(pts), close);
    };

    const fillRect = (x: number, y: number, w: number, h: number) => g.fillRect(x + cx, y + cy, w, h);
    const fillRoundedRect = (x: number, y: number, w: number, h: number, r: number) => g.fillRoundedRect(x + cx, y + cy, w, h, r);
    const fillCircle = (x: number, y: number, r: number) => g.fillCircle(x + cx, y + cy, r);
    const fillEllipse = (x: number, y: number, w: number, h: number) => g.fillEllipse(x + cx, y + cy, w, h);
    const strokeEllipse = (x: number, y: number, w: number, h: number) => g.strokeEllipse(x + cx, y + cy, w, h);
    const lineBetween = (x1: number, y1: number, x2: number, y2: number) => g.lineBetween(x1 + cx, y1 + cy, x2 + cx, y2 + cy);

    const drawMiniAircraft = (x: number, y: number, s: number) => {
      const aircraft = [
        { x: x + 8 * s, y: y },
        { x: x - 4 * s, y: y - 6 * s },
        { x: x - 6 * s, y: y },
        { x: x - 4 * s, y: y + 6 * s }
      ];
      g.fillPoints(offsetPoints(aircraft), true);
    };

    switch (config.shape) {
      case 'patrol': {
        const hull = [
          { x: 32 * scale, y: 0 },
          { x: 22 * scale, y: -8 * scale },
          { x: 5 * scale, y: -10 * scale },
          { x: -18 * scale, y: -9 * scale },
          { x: -24 * scale, y: -5 * scale },
          { x: -26 * scale, y: 0 },
          { x: -24 * scale, y: 5 * scale },
          { x: -18 * scale, y: 9 * scale },
          { x: 5 * scale, y: 10 * scale },
          { x: 22 * scale, y: 8 * scale }
        ];
        fillPoints(hull);
        g.fillStyle(0x2980b9, 1);
        fillRoundedRect(-10 * scale, -5 * scale, 18 * scale, 10 * scale, 3);
        g.fillStyle(0x85c1e9, 1);
        fillRect(-2 * scale, -3 * scale, 6 * scale, 6 * scale);
        g.fillStyle(0x2c3e50, 1);
        fillCircle(15 * scale, 0, 4 * scale);
        fillRect(17 * scale, -2, 12 * scale, 4);
        g.lineStyle(1, 0xffffff, 0.3);
        lineBetween(-26 * scale, 0, -30 * scale, 0);
        break;
      }
      case 'destroyer': {
        const hull = [
          { x: 38 * scale, y: 0 },
          { x: 28 * scale, y: -7 * scale },
          { x: 10 * scale, y: -10 * scale },
          { x: -12 * scale, y: -11 * scale },
          { x: -26 * scale, y: -8 * scale },
          { x: -30 * scale, y: 0 },
          { x: -26 * scale, y: 8 * scale },
          { x: -12 * scale, y: 11 * scale },
          { x: 10 * scale, y: 10 * scale },
          { x: 28 * scale, y: 7 * scale }
        ];
        fillPoints(hull);
        g.fillStyle(0xc0392b, 1);
        fillRoundedRect(-8 * scale, -6 * scale, 20 * scale, 12 * scale, 2);
        g.fillStyle(0xecf0f1, 0.8);
        fillRect(-4 * scale, -4 * scale, 3 * scale, 3 * scale);
        fillRect(1 * scale, -4 * scale, 3 * scale, 3 * scale);
        fillRect(6 * scale, -4 * scale, 3 * scale, 3 * scale);
        g.fillStyle(0x2c3e50, 1);
        fillCircle(20 * scale, 0, 5 * scale);
        fillRect(23 * scale, -5, 12 * scale, 3);
        fillRect(23 * scale, 2, 12 * scale, 3);
        fillCircle(-18 * scale, 0, 3 * scale);
        g.lineStyle(1, 0xffffff, 0.4);
        lineBetween(30 * scale, -4 * scale, 35 * scale, -2 * scale);
        lineBetween(30 * scale, 4 * scale, 35 * scale, 2 * scale);
        break;
      }
      case 'cruiser': {
        const hull = [
          { x: 32 * scale, y: 0 },
          { x: 24 * scale, y: -12 * scale },
          { x: 5 * scale, y: -15 * scale },
          { x: -15 * scale, y: -14 * scale },
          { x: -28 * scale, y: -10 * scale },
          { x: -32 * scale, y: 0 },
          { x: -28 * scale, y: 10 * scale },
          { x: -15 * scale, y: 14 * scale },
          { x: 5 * scale, y: 15 * scale },
          { x: 24 * scale, y: 12 * scale }
        ];
        fillPoints(hull);
        g.fillStyle(0x8e44ad, 1);
        fillRoundedRect(-12 * scale, -8 * scale, 24 * scale, 16 * scale, 3);
        g.fillStyle(0x6c3483, 1);
        fillRect(-2 * scale, -12 * scale, 10 * scale, 6 * scale);
        g.fillStyle(0xd7bde2, 0.8);
        fillRect(-8 * scale, -5 * scale, 4 * scale, 4 * scale);
        fillRect(4 * scale, -5 * scale, 4 * scale, 4 * scale);
        g.fillStyle(0x2c3e50, 1);
        fillCircle(18 * scale, 0, 6 * scale);
        fillRect(22 * scale, -3, 14 * scale, 6);
        fillCircle(-5 * scale, -12 * scale, 4 * scale);
        fillCircle(-5 * scale, 12 * scale, 4 * scale);
        g.lineStyle(1, 0xffffff, 0.2);
        lineBetween(-20 * scale, -8 * scale, -20 * scale, 8 * scale);
        lineBetween(15 * scale, -8 * scale, 15 * scale, 8 * scale);
        break;
      }
      case 'battleship': {
        const hull = [
          { x: 40 * scale, y: 0 },
          { x: 30 * scale, y: -14 * scale },
          { x: 8 * scale, y: -18 * scale },
          { x: -20 * scale, y: -17 * scale },
          { x: -38 * scale, y: -12 * scale },
          { x: -44 * scale, y: 0 },
          { x: -38 * scale, y: 12 * scale },
          { x: -20 * scale, y: 17 * scale },
          { x: 8 * scale, y: 18 * scale },
          { x: 30 * scale, y: 14 * scale }
        ];
        fillPoints(hull);
        g.fillStyle(0x1a252f, 1);
        fillRoundedRect(-30 * scale, -10 * scale, 50 * scale, 20 * scale, 4);
        g.fillStyle(0x34495e, 1);
        fillRect(-10 * scale, -14 * scale, 18 * scale, 10 * scale);
        fillRect(-5 * scale, -18 * scale, 10 * scale, 6 * scale);
        g.fillStyle(0x2c3e50, 1);
        fillCircle(15 * scale, 0, 10 * scale);
        fillRect(22 * scale, -5, 22 * scale, 10);
        g.fillStyle(0x1a1a2e, 1);
        fillRect(22 * scale, -4, 20 * scale, 2);
        fillRect(22 * scale, -1, 20 * scale, 2);
        fillRect(22 * scale, 2, 20 * scale, 2);
        g.fillStyle(0x2c3e50, 1);
        fillCircle(-22 * scale, -10 * scale, 5 * scale);
        fillCircle(-22 * scale, 10 * scale, 5 * scale);
        fillCircle(-32 * scale, 0, 6 * scale);
        g.lineStyle(1, 0x566573, 0.5);
        lineBetween(-35 * scale, -8 * scale, -35 * scale, 8 * scale);
        lineBetween(5 * scale, -12 * scale, 5 * scale, 12 * scale);
        break;
      }
      case 'submarine': {
        fillEllipse(0, 0, 55 * scale, 14 * scale);
        strokeEllipse(0, 0, 55 * scale, 14 * scale);
        g.fillStyle(0x148f77, 1);
        fillEllipse(22 * scale, 0, 15 * scale, 10 * scale);
        g.fillStyle(0x17a589, 1);
        fillRoundedRect(-8 * scale, -14 * scale, 18 * scale, 10 * scale, 4);
        g.fillStyle(0x2c3e50, 1);
        fillRect(4 * scale, -20 * scale, 3 * scale, 8 * scale);
        fillCircle(5.5 * scale, -21 * scale, 2 * scale);
        g.fillStyle(0x1a1a2e, 1);
        fillRect(25 * scale, -3, 6 * scale, 2);
        fillRect(25 * scale, 1, 6 * scale, 2);
        g.fillStyle(0x117864, 1);
        fillEllipse(-25 * scale, 0, 8 * scale, 8 * scale);
        g.fillStyle(0x0e6655, 1);
        for (let i = -15; i <= 15; i += 10) {
          fillCircle(i * scale, -5 * scale, 1.5);
          fillCircle(i * scale, 5 * scale, 1.5);
        }
        break;
      }
      case 'carrier': {
        const hull = [
          { x: 45 * scale, y: -10 * scale },
          { x: 45 * scale, y: 10 * scale },
          { x: -38 * scale, y: 14 * scale },
          { x: -50 * scale, y: 10 * scale },
          { x: -52 * scale, y: 0 },
          { x: -50 * scale, y: -10 * scale },
          { x: -38 * scale, y: -14 * scale }
        ];
        fillPoints(hull);
        g.fillStyle(0x7d6608, 1);
        fillRect(-40 * scale, -9 * scale, 80 * scale, 18 * scale);
        g.lineStyle(2, 0xffffff, 0.6);
        lineBetween(-35 * scale, 0, 35 * scale, 0);
        g.lineStyle(1, 0xffffff, 0.4);
        for (let i = -30; i <= 20; i += 15) {
          lineBetween(i * scale, -6 * scale, i * scale, 6 * scale);
        }
        g.lineStyle(1, 0xe74c3c, 0.5);
        lineBetween(-20 * scale, -8 * scale, 15 * scale, 5 * scale);
        lineBetween(-20 * scale, -5 * scale, 15 * scale, 8 * scale);
        g.fillStyle(0x2c3e50, 1);
        fillRect(8 * scale, -18 * scale, 20 * scale, 12 * scale);
        g.fillStyle(0x566573, 1);
        fillRect(15 * scale, -24 * scale, 3 * scale, 8 * scale);
        fillCircle(16.5 * scale, -26 * scale, 4 * scale);
        g.fillStyle(0x85c1e9, 0.7);
        fillRect(12 * scale, -16 * scale, 4 * scale, 3 * scale);
        fillRect(18 * scale, -16 * scale, 4 * scale, 3 * scale);
        fillRect(24 * scale, -16 * scale, 4 * scale, 3 * scale);
        g.fillStyle(0x7f8c8d, 0.8);
        drawMiniAircraft(-25 * scale, -4 * scale, scale * 0.6);
        drawMiniAircraft(-10 * scale, 3 * scale, scale * 0.6);
        drawMiniAircraft(5 * scale, -3 * scale, scale * 0.6);
        break;
      }
    }

    g.restore();
    g.generateTexture(key, ShipEntity.TEXTURE_SIZE, ShipEntity.TEXTURE_SIZE);
    g.destroy();
  }

  private updateBodyTexture(): void {
    this.bodyImage.setTexture(ShipEntity.getBodyTextureKey(this.shipClass));
  }


  private updateHealthBar(): void {
    this.healthBar.clear();
    
    const barWidth = 40;
    const barHeight = 4;
    const y = -35;
    
    // Background
    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(-barWidth / 2, y, barWidth, barHeight);
    
    // Health fill
    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? 0x2ecc71 : healthPercent > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.healthBar.fillStyle(healthColor, 1);
    this.healthBar.fillRect(-barWidth / 2, y, barWidth * healthPercent, barHeight);
  }

  public setTargetPosition(x: number, y: number, rotation: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
  }

  public updateInterpolation(): void {
    // Smooth position interpolation
    this.x += (this.targetX - this.x) * this.LERP_SPEED;
    this.y += (this.targetY - this.y) * this.LERP_SPEED;
    
    // Smooth rotation interpolation (handle wrapping)
    let rotationDiff = this.targetRotation - this.rotation;
    if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    this.rotation += rotationDiff * this.LERP_SPEED;
  }

  public updateHealth(health: number, maxHealth: number): void {
    this.health = health;
    this.maxHealth = maxHealth;
    this.updateHealthBar();
  }

  public setShipClass(shipClass: ShipClass): void {
    if (this.shipClass !== shipClass) {
      this.shipClass = shipClass;
      ShipEntity.ensureBodyTexture(this.scene, shipClass);
      this.updateBodyTexture();
      this.updateShieldVisual();
    }
  }

  public setPlayerName(name: string): void {
    this.nameText.setText(name);
  }

  public setStealthed(stealthed: boolean): void {
    if (this.isStealthed !== stealthed) {
      this.isStealthed = stealthed;
      // Make semi-transparent when stealthed
      this.setAlpha(stealthed ? 0.3 : 1);
    }
  }

  public setShielded(shielded: boolean): void {
    if (this.isShielded !== shielded) {
      this.isShielded = shielded;
      this.updateShieldVisual();
    }
  }

  private updateShieldVisual(): void {
    this.shieldGraphics.clear();
    if (this.isShielded) {
      const config = SHIP_CONFIGS[this.shipClass];
      const radius = 40 * config.size;
      
      // Outer glow
      this.shieldGraphics.lineStyle(6, 0x3498db, 0.2);
      this.shieldGraphics.strokeCircle(0, 0, radius + 5);
      
      // Main shield ring
      this.shieldGraphics.lineStyle(3, 0x5dade2, 0.8);
      this.shieldGraphics.strokeCircle(0, 0, radius);
      
      // Inner glow
      this.shieldGraphics.fillStyle(0x3498db, 0.15);
      this.shieldGraphics.fillCircle(0, 0, radius);
      
      // Hex pattern effect
      this.shieldGraphics.lineStyle(1, 0x85c1e9, 0.3);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x1 = Math.cos(angle) * radius * 0.7;
        const y1 = Math.sin(angle) * radius * 0.7;
        const nextAngle = ((i + 1) * Math.PI * 2) / 6;
        const x2 = Math.cos(nextAngle) * radius * 0.7;
        const y2 = Math.sin(nextAngle) * radius * 0.7;
        this.shieldGraphics.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  public getCollisionRadius(): number {
    const config = SHIP_CONFIGS[this.shipClass];
    return 25 * config.size;
  }
}
