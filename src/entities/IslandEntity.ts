import Phaser from 'phaser';
import type { Island } from '@shared/types';

export class IslandEntity extends Phaser.GameObjects.Container {
  public islandId: string;
  public radius: number;
  public points: { x: number; y: number }[] | undefined;
  
  private graphics: Phaser.GameObjects.Graphics;
  private seed: number;

  constructor(
    scene: Phaser.Scene,
    island: Island
  ) {
    super(scene, island.x, island.y);

    this.islandId = island.id;
    this.radius = island.radius;
    this.points = island.points;
    this.seed = island.seed || 12345;

    // Create graphics for island
    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // Draw the island
    this.drawIsland(island);

    // Cache static island art into a texture for performance
    this.cacheIslandToTexture(island);

    // Set depth so islands appear behind ships
    this.setDepth(-5);

    // Add to scene
    scene.add.existing(this);
  }

  private cacheIslandToTexture(island: Island): void {
    // The island drawing uses coordinates around (0,0) with negative extents.
    // RenderTexture lets us draw the Graphics at the center of an offscreen buffer.
    const padding = 80;
    const diameter = island.radius * 2;
    const size = Math.max(128, Math.ceil(diameter * 1.6 + padding));

    const rt = this.scene.add.renderTexture(0, 0, size, size);
    rt.setOrigin(0.5, 0.5);
    rt.draw(this.graphics, size / 2, size / 2);

    this.graphics.destroy();
    this.addAt(rt, 0);
  }

  // Seeded random for consistent visuals
  private seededRandom(offset: number): number {
    const x = Math.sin(this.seed + offset) * 10000;
    return x - Math.floor(x);
  }

  private drawIsland(island: Island): void {
    if (island.points && island.points.length > 2) {
      this.drawIrregularIsland(island);
    } else {
      this.drawCircleIsland(island);
    }
  }

  private drawIrregularIsland(island: Island): void {
    const points = island.points!;
    
    // === SHALLOW WATER / REEF RING ===
    this.graphics.fillStyle(0x5dade2, 0.4);
    const reefPoints = points.map(p => ({ x: p.x * 1.15, y: p.y * 1.15 }));
    this.graphics.fillPoints(reefPoints, true);
    
    // === SAND BEACH ===
    this.graphics.fillStyle(0xf5deb3, 1);
    this.graphics.lineStyle(3, 0xdeb887, 0.8);
    const beachPoints = points.map(p => ({ x: p.x * 1.05, y: p.y * 1.05 }));
    this.graphics.fillPoints(beachPoints, true);
    this.graphics.strokePoints(beachPoints, true);
    
    // === MAIN LAND (GREEN) ===
    this.graphics.fillStyle(0x27ae60, 1);
    this.graphics.fillPoints(points, true);
    
    // === INNER DARKER GREEN (VEGETATION) ===
    this.graphics.fillStyle(0x1e8449, 0.9);
    const innerPoints = points.map(p => ({ x: p.x * 0.7, y: p.y * 0.7 }));
    this.graphics.fillPoints(innerPoints, true);
    
    // === MOUNTAIN/HILL IN CENTER (for larger islands) ===
    if (island.radius > 80) {
      // Brown hill
      this.graphics.fillStyle(0x8b6914, 0.9);
      const hillPoints = points.map((p, i) => {
        const variation = 0.25 + this.seededRandom(i * 31) * 0.15;
        return { x: p.x * variation, y: p.y * variation };
      });
      this.graphics.fillPoints(hillPoints, true);
      
      // Rocky peak
      this.graphics.fillStyle(0x6b5344, 1);
      const peakPoints = points.map((p, i) => {
        const variation = 0.1 + this.seededRandom(i * 47) * 0.05;
        return { x: p.x * variation, y: p.y * variation };
      });
      this.graphics.fillPoints(peakPoints, true);
    }
    
    // === PALM TREES ===
    const numTrees = Math.floor(island.radius / 18);
    for (let i = 0; i < numTrees; i++) {
      // Position trees in the green areas
      const pointIdx = Math.floor(this.seededRandom(i * 73) * points.length);
      const p = points[pointIdx];
      const distFactor = 0.4 + this.seededRandom(i * 97) * 0.4;
      const treeX = p.x * distFactor;
      const treeY = p.y * distFactor;
      
      this.drawPalmTree(treeX, treeY, 8 + this.seededRandom(i * 113) * 6);
    }
    
    // === ROCKS ON BEACH ===
    const numRocks = Math.floor(island.radius / 25);
    for (let i = 0; i < numRocks; i++) {
      const pointIdx = Math.floor(this.seededRandom(i * 137) * points.length);
      const p = points[pointIdx];
      const rockX = p.x * (0.95 + this.seededRandom(i * 151) * 0.1);
      const rockY = p.y * (0.95 + this.seededRandom(i * 163) * 0.1);
      const rockSize = 3 + this.seededRandom(i * 179) * 5;
      
      this.graphics.fillStyle(0x7f8c8d, 0.9);
      this.graphics.fillCircle(rockX, rockY, rockSize);
      this.graphics.fillStyle(0x95a5a6, 0.6);
      this.graphics.fillCircle(rockX - 1, rockY - 1, rockSize * 0.6);
    }
    
    // === WAVE FOAM AT EDGES ===
    this.graphics.lineStyle(2, 0xffffff, 0.3);
    const wavePoints = beachPoints.map((p, i) => ({
      x: p.x * (1.02 + Math.sin(i * 0.5) * 0.02),
      y: p.y * (1.02 + Math.cos(i * 0.5) * 0.02)
    }));
    this.graphics.strokePoints(wavePoints, true);
  }

  private drawPalmTree(x: number, y: number, size: number): void {
    // Trunk (slightly curved brown)
    this.graphics.fillStyle(0x8B4513, 1);
    
    // Draw trunk as multiple segments for slight curve
    const trunkHeight = size * 1.5;
    const trunkWidth = size * 0.25;
    
    // Trunk base
    this.graphics.fillStyle(0x654321, 1);
    this.graphics.fillRect(x - trunkWidth/2, y - trunkHeight * 0.2, trunkWidth, trunkHeight);
    
    // Trunk texture lines
    this.graphics.lineStyle(1, 0x4a3728, 0.5);
    for (let i = 0; i < 4; i++) {
      const lineY = y - trunkHeight * 0.1 + i * trunkHeight * 0.2;
      this.graphics.lineBetween(x - trunkWidth/2, lineY, x + trunkWidth/2, lineY);
    }
    
    // Palm fronds (leaves) - draw 6-8 fronds radiating outward
    const numFronds = 6 + Math.floor(this.seededRandom(x * y) * 3);
    const topY = y - trunkHeight;
    
    for (let i = 0; i < numFronds; i++) {
      const angle = (i / numFronds) * Math.PI * 2 + this.seededRandom(i + x) * 0.3;
      const frondLength = size * (1.2 + this.seededRandom(i * 7 + y) * 0.4);
      
      // Main frond stem
      this.graphics.lineStyle(2, 0x228B22, 1);
      const endX = x + Math.cos(angle) * frondLength;
      const endY = topY + Math.sin(angle) * frondLength * 0.5 - size * 0.3;
      
      // Curved frond
      this.graphics.beginPath();
      this.graphics.moveTo(x, topY);
      
      // Control point for curve (drooping effect)
      const cpX = x + Math.cos(angle) * frondLength * 0.6;
      const cpY = topY + Math.sin(angle) * frondLength * 0.3;
      
      // Draw as line (simplified)
      this.graphics.lineTo(cpX, cpY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();
      
      // Leaflets along the frond
      this.graphics.fillStyle(0x2ecc71, 0.9);
      const numLeaflets = 5;
      for (let j = 1; j <= numLeaflets; j++) {
        const t = j / numLeaflets;
        const leafX = x + (endX - x) * t * 0.8;
        const leafY = topY + (endY - topY) * t * 0.8;
        const leafSize = size * 0.3 * (1 - t * 0.5);
        
        // Small leaf segments
        this.graphics.fillEllipse(
          leafX + Math.cos(angle + Math.PI/2) * leafSize * 0.5,
          leafY + Math.sin(angle + Math.PI/2) * leafSize * 0.3,
          leafSize,
          leafSize * 0.4
        );
        this.graphics.fillEllipse(
          leafX + Math.cos(angle - Math.PI/2) * leafSize * 0.5,
          leafY + Math.sin(angle - Math.PI/2) * leafSize * 0.3,
          leafSize,
          leafSize * 0.4
        );
      }
    }
    
    // Coconuts at the top
    const numCoconuts = Math.floor(this.seededRandom(x + y * 2) * 4);
    this.graphics.fillStyle(0x8B4513, 1);
    for (let i = 0; i < numCoconuts; i++) {
      const coconutAngle = this.seededRandom(i * 17 + x) * Math.PI * 2;
      const coconutDist = size * 0.2;
      this.graphics.fillCircle(
        x + Math.cos(coconutAngle) * coconutDist,
        topY + Math.sin(coconutAngle) * coconutDist * 0.5 + size * 0.15,
        size * 0.2
      );
    }
  }

  private drawCircleIsland(island: Island): void {
    const r = island.radius;
    
    // Sand beach ring (outer)
    this.graphics.fillStyle(0xf4d03f, 0.9);
    this.graphics.fillCircle(0, 0, r);
    
    // Inner land (green)
    this.graphics.fillStyle(0x27ae60, 0.95);
    this.graphics.fillCircle(0, 0, r * 0.85);
    
    // Darker green patches (trees/vegetation)
    this.graphics.fillStyle(0x1e8449, 0.8);
    const numPatches = Math.floor(r / 15);
    for (let i = 0; i < numPatches; i++) {
      const angle = this.seededRandom(i * 23) * Math.PI * 2;
      const dist = this.seededRandom(i * 37) * r * 0.5;
      const patchSize = 5 + this.seededRandom(i * 41) * 10;
      this.graphics.fillCircle(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        patchSize
      );
    }
    
    // Palm trees
    const numTrees = Math.floor(r / 25);
    for (let i = 0; i < numTrees; i++) {
      const angle = this.seededRandom(i * 53) * Math.PI * 2;
      const dist = this.seededRandom(i * 67) * r * 0.6;
      const treeX = Math.cos(angle) * dist;
      const treeY = Math.sin(angle) * dist;
      
      this.drawPalmTree(treeX, treeY, 8 + this.seededRandom(i * 71) * 4);
    }
    
    // Rocks on beach
    this.graphics.fillStyle(0x7f8c8d, 0.9);
    const numRocks = Math.floor(r / 30);
    for (let i = 0; i < numRocks; i++) {
      const angle = this.seededRandom(i * 83) * Math.PI * 2;
      const dist = r * 0.85 + this.seededRandom(i * 89) * r * 0.15;
      const rockSize = 3 + this.seededRandom(i * 97) * 5;
      this.graphics.fillCircle(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        rockSize
      );
    }
    
    // Outline
    this.graphics.lineStyle(2, 0x935116, 0.6);
    this.graphics.strokeCircle(0, 0, r);
  }

  public getCollisionPoints(): { x: number; y: number }[] | undefined {
    return this.points;
  }

  public getCollisionRadius(): number {
    return this.radius;
  }
}
