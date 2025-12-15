import Phaser from 'phaser';
import type { NeutralType } from '@shared/types';

const NEUTRAL_CONFIGS: Record<NeutralType, {
  color: number;
  size: number;
  xpValue: number;
}> = {
  buoy: { color: 0xe74c3c, size: 15, xpValue: 10 },
  cargo: { color: 0xf39c12, size: 30, xpValue: 50 },
  lighthouse: { color: 0x9b59b6, size: 25, xpValue: 100 },
  tank: { color: 0x7f8c8d, size: 20, xpValue: 150 }
};

export class NeutralEntity extends Phaser.GameObjects.Container {
  public neutralId: string;
  public neutralType: NeutralType;
  public health: number;
  public maxHealth: number;
  public xpValue: number;

  private graphics: Phaser.GameObjects.Graphics;
  private healthBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    neutralId: string,
    neutralType: NeutralType,
    health: number = 100
  ) {
    super(scene, x, y);

    this.neutralId = neutralId;
    this.neutralType = neutralType;
    this.health = health;
    this.maxHealth = health;
    this.xpValue = NEUTRAL_CONFIGS[neutralType].xpValue;

    // Create graphics
    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);

    this.drawNeutral();
    this.updateHealthBar();

    scene.add.existing(this);
  }

  private drawNeutral(): void {
    const config = NEUTRAL_CONFIGS[this.neutralType];

    this.graphics.clear();

    switch (this.neutralType) {
      case 'buoy':
        this.drawBuoy(config);
        break;
      case 'cargo':
        this.drawCargo(config);
        break;
      case 'lighthouse':
        this.drawLighthouse(config);
        break;
      case 'tank':
        this.drawTank(config);
        break;
    }
  }

  private drawBuoy(config: typeof NEUTRAL_CONFIGS['buoy']): void {
    // Realistic navigation buoy
    const size = config.size * 1.3;

    // Water ring (waves around buoy)
    this.graphics.lineStyle(2, 0x5dade2, 0.4);
    this.graphics.strokeCircle(0, 0, size * 1.2);

    // Buoy base (floating part)
    this.graphics.fillStyle(0xe74c3c, 1); // Red buoy
    this.graphics.lineStyle(2, 0xc0392b, 1);

    // Cone shape
    const points = [
      { x: 0, y: -size * 0.9 },      // Top point
      { x: size * 0.5, y: size * 0.2 },  // Bottom right
      { x: size * 0.4, y: size * 0.5 },  // Float right
      { x: -size * 0.4, y: size * 0.5 }, // Float left
      { x: -size * 0.5, y: size * 0.2 }, // Bottom left
    ];

    this.graphics.fillPoints(points, true);
    this.graphics.strokePoints(points, true);

    // White stripe
    this.graphics.fillStyle(0xffffff, 1);
    this.graphics.fillRect(-size * 0.35, -size * 0.2, size * 0.7, size * 0.2);

    // Light on top
    this.graphics.fillStyle(0xf1c40f, 1);
    this.graphics.fillCircle(0, -size * 0.7, size * 0.15);

    // Light glow
    this.graphics.fillStyle(0xf1c40f, 0.3);
    this.graphics.fillCircle(0, -size * 0.7, size * 0.25);
  }

  private drawCargo(config: typeof NEUTRAL_CONFIGS['cargo']): void {
    // Detailed cargo ship - pointing right (0 rotation)
    const size = config.size;
    const scale = 1.5; // Make cargo ships bigger

    // Hull shape (ship-like with pointed bow)
    this.graphics.fillStyle(0x8b4513, 1); // Brown hull
    this.graphics.lineStyle(2, 0x5d3a1a, 1);

    // Ship hull points (bow pointing right)
    const hullPoints = [
      { x: size * scale, y: 0 },           // Bow (front point)
      { x: size * 0.6 * scale, y: -size * 0.4 * scale },  // Front starboard
      { x: -size * 0.8 * scale, y: -size * 0.45 * scale }, // Rear starboard
      { x: -size * scale, y: -size * 0.3 * scale },       // Stern starboard
      { x: -size * scale, y: size * 0.3 * scale },        // Stern port
      { x: -size * 0.8 * scale, y: size * 0.45 * scale },  // Rear port
      { x: size * 0.6 * scale, y: size * 0.4 * scale },   // Front port
    ];

    this.graphics.fillPoints(hullPoints, true);
    this.graphics.strokePoints(hullPoints, true);

    // Deck (lighter brown)
    this.graphics.fillStyle(0xdeb887, 1);
    const deckPoints = [
      { x: size * 0.7 * scale, y: 0 },
      { x: size * 0.4 * scale, y: -size * 0.3 * scale },
      { x: -size * 0.7 * scale, y: -size * 0.35 * scale },
      { x: -size * 0.85 * scale, y: -size * 0.2 * scale },
      { x: -size * 0.85 * scale, y: size * 0.2 * scale },
      { x: -size * 0.7 * scale, y: size * 0.35 * scale },
      { x: size * 0.4 * scale, y: size * 0.3 * scale },
    ];
    this.graphics.fillPoints(deckPoints, true);

    // Cargo containers (colorful)
    const containerColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];

    // Row of containers
    for (let i = 0; i < 3; i++) {
      const cx = -size * 0.5 * scale + i * size * 0.35 * scale;
      this.graphics.fillStyle(containerColors[i], 1);
      this.graphics.fillRect(cx - size * 0.12 * scale, -size * 0.2 * scale, size * 0.24 * scale, size * 0.4 * scale);
      // Container outline
      this.graphics.lineStyle(1, 0x2c3e50, 0.8);
      this.graphics.strokeRect(cx - size * 0.12 * scale, -size * 0.2 * scale, size * 0.24 * scale, size * 0.4 * scale);
    }

    // Bridge/cabin at the back
    this.graphics.fillStyle(0xecf0f1, 1);
    this.graphics.fillRect(-size * 0.9 * scale, -size * 0.15 * scale, size * 0.25 * scale, size * 0.3 * scale);
    this.graphics.lineStyle(1, 0x7f8c8d, 1);
    this.graphics.strokeRect(-size * 0.9 * scale, -size * 0.15 * scale, size * 0.25 * scale, size * 0.3 * scale);

    // Bridge windows
    this.graphics.fillStyle(0x2c3e50, 1);
    this.graphics.fillRect(-size * 0.85 * scale, -size * 0.08 * scale, size * 0.06 * scale, size * 0.05 * scale);
    this.graphics.fillRect(-size * 0.77 * scale, -size * 0.08 * scale, size * 0.06 * scale, size * 0.05 * scale);

    // Smokestack
    this.graphics.fillStyle(0x2c3e50, 1);
    this.graphics.fillRect(-size * 0.82 * scale, -size * 0.28 * scale, size * 0.1 * scale, size * 0.13 * scale);

    // Smoke puff
    this.graphics.fillStyle(0x95a5a6, 0.6);
    this.graphics.fillCircle(-size * 0.77 * scale, -size * 0.35 * scale, size * 0.08 * scale);
  }

  private drawLighthouse(config: typeof NEUTRAL_CONFIGS['lighthouse']): void {
    const size = config.size * 1.3;

    // Rock/island base
    this.graphics.fillStyle(0x7f8c8d, 1);
    this.graphics.lineStyle(1, 0x5d6d7e, 1);
    const rockPoints = [
      { x: -size * 0.9, y: size * 0.3 },
      { x: -size * 0.7, y: size * 0.6 },
      { x: -size * 0.2, y: size * 0.7 },
      { x: size * 0.3, y: size * 0.65 },
      { x: size * 0.8, y: size * 0.4 },
      { x: size * 0.9, y: size * 0.1 },
      { x: size * 0.6, y: -size * 0.1 },
      { x: -size * 0.5, y: -size * 0.05 },
      { x: -size * 0.85, y: size * 0.1 },
    ];
    this.graphics.fillPoints(rockPoints, true);
    this.graphics.strokePoints(rockPoints, true);

    // Lighthouse tower (white with red stripes)
    this.graphics.fillStyle(0xecf0f1, 1);
    this.graphics.lineStyle(2, 0xbdc3c7, 1);
    const towerPoints = [
      { x: -size * 0.25, y: size * 0.1 },   // Base left
      { x: size * 0.25, y: size * 0.1 },    // Base right
      { x: size * 0.15, y: -size * 0.7 },   // Top right
      { x: -size * 0.15, y: -size * 0.7 },  // Top left
    ];
    this.graphics.fillPoints(towerPoints, true);
    this.graphics.strokePoints(towerPoints, true);

    // Red stripes on tower
    this.graphics.fillStyle(0xe74c3c, 1);
    this.graphics.fillRect(-size * 0.22, -size * 0.15, size * 0.44, size * 0.12);
    this.graphics.fillRect(-size * 0.18, -size * 0.45, size * 0.36, size * 0.1);

    // Light room (glass enclosure)
    this.graphics.fillStyle(0x2c3e50, 1);
    this.graphics.fillRect(-size * 0.18, -size * 0.85, size * 0.36, size * 0.15);

    // Roof
    this.graphics.fillStyle(0xe74c3c, 1);
    const roofPoints = [
      { x: 0, y: -size * 1.05 },
      { x: size * 0.22, y: -size * 0.85 },
      { x: -size * 0.22, y: -size * 0.85 },
    ];
    this.graphics.fillPoints(roofPoints, true);

    // Light beam (rotating effect handled elsewhere)
    this.graphics.fillStyle(0xf1c40f, 0.9);
    this.graphics.fillCircle(0, -size * 0.78, size * 0.1);

    // Light glow
    this.graphics.fillStyle(0xf1c40f, 0.3);
    this.graphics.fillCircle(0, -size * 0.78, size * 0.2);

    // Turret indicator (small cannon)
    this.graphics.fillStyle(0x34495e, 1);
    this.graphics.fillCircle(0, size * 0.35, size * 0.12);
    this.graphics.fillRect(-size * 0.04, size * 0.2, size * 0.08, size * 0.15);
  }

  private drawTank(config: typeof NEUTRAL_CONFIGS['tank']): void {
    const size = config.size;

    // Tank body (Steel Grey - contrasts with Island Green)
    this.graphics.fillStyle(0x7f8c8d, 1);
    this.graphics.lineStyle(2, 0x2c3e50, 1);
    this.graphics.fillRect(-size, -size * 0.8, size * 2, size * 1.6);
    this.graphics.strokeRect(-size, -size * 0.8, size * 2, size * 1.6);

    // Tracks (Dark Grey)
    this.graphics.fillStyle(0x2c3e50, 1);
    this.graphics.fillRect(-size * 1.1, -size * 0.9, size * 2.2, size * 0.4); // Top track
    this.graphics.fillRect(-size * 1.1, size * 0.5, size * 2.2, size * 0.4);  // Bottom track

    // Turret (Darker Steel)
    this.graphics.fillStyle(0x5d6d7e, 1);
    this.graphics.fillCircle(0, 0, size * 0.6);
    this.graphics.strokeCircle(0, 0, size * 0.6);

    // Barrel (Gun Metal)
    this.graphics.fillStyle(0x95a5a6, 1);
    this.graphics.fillRect(0, -size * 0.2, size * 1.4, size * 0.4);
    this.graphics.lineStyle(1, 0x2c3e50, 1);
    this.graphics.strokeRect(0, -size * 0.2, size * 1.4, size * 0.4);

    // Decorative camo (Urban/Dark)
    this.graphics.fillStyle(0x2c3e50, 0.3);
    this.graphics.fillCircle(-size * 0.4, -size * 0.3, size * 0.2);
    this.graphics.fillCircle(size * 0.4, size * 0.4, size * 0.25);
  }

  private updateHealthBar(): void {
    if (this.health >= this.maxHealth) {
      this.healthBar.clear();
      return;
    }

    this.healthBar.clear();

    const config = NEUTRAL_CONFIGS[this.neutralType];
    const barWidth = config.size * 2;
    const barHeight = 4;
    const y = -config.size - 10;

    // Background
    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(-barWidth / 2, y, barWidth, barHeight);

    // Health fill
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.fillStyle(0xe74c3c, 1);
    this.healthBar.fillRect(-barWidth / 2, y, barWidth * healthPercent, barHeight);
  }

  public updateHealth(health: number): void {
    this.health = health;
    this.updateHealthBar();
  }

  public update(_time: number, _delta: number): void {
    // Removed pulse animation - it was causing performance issues
    // The entities already look good without constant scaling
  }

  public getCollisionRadius(): number {
    return NEUTRAL_CONFIGS[this.neutralType].size;
  }

  destroy(fromScene?: boolean): void {
    this.graphics.destroy();
    this.healthBar.destroy();
    super.destroy(fromScene);
  }
}
