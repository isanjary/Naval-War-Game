import Phaser from 'phaser';
import type { BulletType } from '@shared/types';

const BULLET_CONFIGS: Record<BulletType, {
  color: number;
  size: number;
  trailLength: number;
}> = {
  cannon: { color: 0xf39c12, size: 6, trailLength: 3 },
  machinegun: { color: 0xe74c3c, size: 3, trailLength: 2 },
  torpedo: { color: 0x3498db, size: 10, trailLength: 5 }
};

export class BulletEntity extends Phaser.GameObjects.Container {
  private static readonly TEXTURE_SIZE = 64;

  public bulletId: string;
  public ownerId: string;
  public bulletType: BulletType;
  public damage: number;
  
  private bodyImage: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Graphics;
  private prevX: number;
  private prevY: number;

  // Interpolation
  private targetX: number;
  private targetY: number;
  private readonly LERP_SPEED = 0.3;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletId: string,
    ownerId: string,
    bulletType: BulletType = 'cannon',
    damage: number = 10
  ) {
    super(scene, x, y);

    this.bulletId = bulletId;
    this.ownerId = ownerId;
    this.bulletType = bulletType;
    this.damage = damage;
    this.targetX = x;
    this.targetY = y;

    this.prevX = x;
    this.prevY = y;

    // Trail graphics (cheap single-segment)
    this.trail = scene.add.graphics();
    this.add(this.trail);

    BulletEntity.ensureBodyTexture(scene, this.bulletType);
    this.bodyImage = scene.add.image(0, 0, BulletEntity.getBodyTextureKey(this.bulletType));
    this.bodyImage.setOrigin(0.5, 0.5);
    this.add(this.bodyImage);

    scene.add.existing(this);
  }

  private static getBodyTextureKey(type: BulletType): string {
    return `bullet-body:${type}`;
  }

  private static ensureBodyTexture(scene: Phaser.Scene, type: BulletType): void {
    const key = BulletEntity.getBodyTextureKey(type);
    if (scene.textures.exists(key)) return;

    const config = BULLET_CONFIGS[type];
    const s = BulletEntity.TEXTURE_SIZE;
    const cx = s / 2;
    const cy = s / 2;

    const g = scene.add.graphics();
    g.setVisible(false);
    g.fillStyle(config.color, 0.3);
    g.fillCircle(cx, cy, config.size * 1.5);
    g.fillStyle(config.color, 1);
    g.fillCircle(cx, cy, config.size);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(cx, cy, config.size * 0.4);
    g.generateTexture(key, s, s);
    g.destroy();
  }

  public setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public updateInterpolation(): void {
    const config = BULLET_CONFIGS[this.bulletType];

    // Trail: single fading line from previous to current (local coords)
    this.trail.clear();
    this.trail.lineStyle(Math.max(1, config.size * 0.5), config.color, 0.25);
    this.trail.lineBetween(this.prevX - this.x, this.prevY - this.y, 0, 0);

    // Fast interpolation for bullets
    this.x += (this.targetX - this.x) * this.LERP_SPEED;
    this.y += (this.targetY - this.y) * this.LERP_SPEED;

    this.prevX = this.x;
    this.prevY = this.y;
  }

  public getCollisionRadius(): number {
    return BULLET_CONFIGS[this.bulletType].size;
  }

  destroy(fromScene?: boolean): void {
    this.bodyImage.destroy();
    this.trail.destroy();
    super.destroy(fromScene);
  }
}
