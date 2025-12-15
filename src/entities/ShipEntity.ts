import Phaser from 'phaser';
import type { ShipClass } from '@shared/types';

// Ship visual configurations by class
const SHIP_CONFIGS: Record<ShipClass, {
  color: number;
  size: number;
  shape: 'patrol' | 'destroyer' | 'cruiser' | 'battleship' | 'submarine' | 'carrier';
}> = {
  patrol_boat: { color: 0x4CAF50, size: 2, shape: 'patrol' },      // Vibrant Green
  destroyer: { color: 0x2980B9, size: 2.5, shape: 'destroyer' },   // Strong Blue
  cruiser: { color: 0x8E44AD, size: 2.75, shape: 'cruiser' },      // Royal Purple
  battleship: { color: 0xC0392B, size: 3, shape: 'battleship' },   // Aggressive Red
  submarine: { color: 0x16A085, size: 2, shape: 'submarine' },     // Deep Teal
  carrier: { color: 0xD35400, size: 3.5, shape: 'carrier' }        // Burnt Orange
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

    // Helper for carrier aircraft (used in carrier shape)
    // const drawMiniAircraft = (x: number, y: number, s: number) => { ... }

    switch (config.shape) {
      case 'patrol': {
        // Agile, sharp, green camo feel
        const hull = [
          { x: 32 * scale, y: 0 },
          { x: 20 * scale, y: -8 * scale },
          { x: -24 * scale, y: -8 * scale },
          { x: -30 * scale, y: 0 },
          { x: -24 * scale, y: 8 * scale },
          { x: 20 * scale, y: 8 * scale }
        ];
        fillPoints(hull);
        // Camo / Detail stripes
        g.fillStyle(0x81C784, 1);
        fillPoints([{ x: 10 * scale, y: -8 * scale }, { x: 20 * scale, y: 0 }, { x: 10 * scale, y: 8 * scale }, { x: 0, y: 0 }], true);
        g.fillStyle(0x1B5E20, 1);
        fillRect(-20 * scale, -4 * scale, 12 * scale, 8 * scale); // Cockpit area
        break;
      }
      case 'destroyer': {
        // Fast, sleek, blue with racing stripes
        const hull = [
          { x: 40 * scale, y: 0 },
          { x: 25 * scale, y: -6 * scale },
          { x: -25 * scale, y: -8 * scale },
          { x: -35 * scale, y: -4 * scale },
          { x: -35 * scale, y: 4 * scale },
          { x: -25 * scale, y: 8 * scale },
          { x: 25 * scale, y: 6 * scale }
        ];
        fillPoints(hull);
        // Racing stripes
        g.fillStyle(0x5DADE2, 1);
        fillRect(-30 * scale, -2 * scale, 60 * scale, 4 * scale);
        // Engine vents
        g.fillStyle(0x154360, 1);
        fillRect(-32 * scale, -8 * scale, 8 * scale, 4 * scale);
        fillRect(-32 * scale, 4 * scale, 8 * scale, 4 * scale);
        break;
      }
      case 'cruiser': {
        // Tanky, purple, shield generators
        const hull = [
          { x: 35 * scale, y: 0 },
          { x: 25 * scale, y: -12 * scale },
          { x: -25 * scale, y: -12 * scale },
          { x: -35 * scale, y: -6 * scale },
          { x: -35 * scale, y: 6 * scale },
          { x: -25 * scale, y: 12 * scale },
          { x: 25 * scale, y: 12 * scale }
        ];
        fillPoints(hull);
        // Shield Generator Cores
        g.fillStyle(0xD2B4DE, 1);
        fillCircle(0, 0, 8 * scale); // Central core
        g.fillStyle(0x4A235A, 1);
        fillCircle(0, 0, 4 * scale);
        // Flank armor
        g.fillStyle(0x5B2C6F, 1);
        fillRect(-20 * scale, -14 * scale, 30 * scale, 4 * scale);
        fillRect(-20 * scale, 10 * scale, 30 * scale, 4 * scale);
        break;
      }
      case 'battleship': {
        // Massive, red, heavy guns
        const hull = [
          { x: 45 * scale, y: 0 },
          { x: 35 * scale, y: -16 * scale },
          { x: -35 * scale, y: -16 * scale },
          { x: -45 * scale, y: 0 },
          { x: -35 * scale, y: 16 * scale },
          { x: 35 * scale, y: 16 * scale }
        ];
        fillPoints(hull);
        // Heavy Gun Turrets
        const drawTurret = (tx: number, ty: number) => {
          g.fillStyle(0x641E16, 1);
          fillCircle(tx, ty, 8 * scale);
          g.lineStyle(3 * scale, 0x17202A, 1);
          lineBetween(tx, ty, tx + 18 * scale, ty); // Gun barrel
          g.lineStyle(2, 0xffffff, 0.8);
        };
        drawTurret(15 * scale, 0);
        drawTurret(-15 * scale, 0);
        drawTurret(0, 0); // Center turret
        break;
      }
      case 'submarine': {
        // Stealthy, teal/black, sleek oval
        fillEllipse(0, 0, 55 * scale, 16 * scale);
        strokeEllipse(0, 0, 55 * scale, 16 * scale);
        // Conning tower
        g.fillStyle(0x0E6251, 1);
        fillRoundedRect(-5 * scale, -6 * scale, 16 * scale, 12 * scale, 4);
        // Stealth markings
        g.fillStyle(0x0B5345, 1);
        fillRect(-15 * scale, -18 * scale, 4 * scale, 36 * scale); // Fins?
        break;
      }
      case 'carrier': {
        // Flat deck, orange/grey, runway
        const hullLines = [
          { x: 50 * scale, y: -12 * scale },
          { x: 50 * scale, y: 12 * scale },
          { x: -40 * scale, y: 16 * scale },
          { x: -50 * scale, y: 0 },
          { x: -40 * scale, y: -16 * scale }
        ];
        fillPoints(hullLines);
        // Runway
        g.fillStyle(0x566573, 1);
        fillRect(-45 * scale, -5 * scale, 90 * scale, 10 * scale);
        // Runway dashed lines
        g.fillStyle(0xF1C40F, 1);
        for (let i = -40; i < 40; i += 15) {
          fillRect(i * scale, -1 * scale, 8 * scale, 2 * scale);
        }
        // Control tower island
        g.fillStyle(0xBA4A00, 1);
        fillRect(10 * scale, -18 * scale, 20 * scale, 6 * scale);
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
    // Early-exit if already at target (within 0.1 pixels)
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
      return;
    }

    // Smooth position interpolation
    this.x += dx * this.LERP_SPEED;
    this.y += dy * this.LERP_SPEED;

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

  destroy(fromScene?: boolean): void {
    this.bodyImage.destroy();
    this.healthBar.destroy();
    this.shieldGraphics.destroy();
    this.nameText.destroy();
    super.destroy(fromScene);
  }
}
