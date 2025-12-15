import Phaser from 'phaser';
import { NetworkManager } from '../systems/NetworkManager';
import { SoundManager } from '../systems/SoundManager';
import { VisualEffects } from '../systems/VisualEffects';
import { MobileControls } from '../systems/MobileControls';
import { ShipEntity } from '../entities/ShipEntity';
import { BulletEntity } from '../entities/BulletEntity';
import { NeutralEntity } from '../entities/NeutralEntity';
import { IslandEntity } from '../entities/IslandEntity';
import type { Ship, Bullet, NeutralObject, GameState, ShipClass, PlayerStats, Island, Drone } from '@shared/types';

export class GameScene extends Phaser.Scene {
  private playerShip!: ShipEntity;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerId: string = '';
  private playerName: string = 'Player';

  private isDead = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private abilityKey!: Phaser.Input.Keyboard.Key;
  private networkManager!: NetworkManager;
  private soundManager!: SoundManager;
  private visualEffects!: VisualEffects;
  private mobileControls!: MobileControls;

  // Entity maps for multiplayer
  private ships: Map<string, ShipEntity> = new Map();
  private bullets: Map<string, BulletEntity> = new Map();
  private neutrals: Map<string, NeutralEntity> = new Map();
  private islands: Map<string, IslandEntity> = new Map();
  private worldIslands: Island[] = [];
  private drones: Map<string, Phaser.GameObjects.Image> = new Map();

  // Reused temp sets to avoid per-snapshot allocations
  private readonly currentShipIds = new Set<string>();
  private readonly currentBulletIds = new Set<string>();
  private readonly currentNeutralIds = new Set<string>();
  private readonly currentDroneIds = new Set<string>();

  // Ship physics constants
  private readonly BASE_SHIP_SPEED = 250;
  private readonly TURN_RATE = 0.0175; // Radians per frame
  private speedBonus = 0; // Updated from server

  // Firing
  // (Visual firing effects currently disabled)

  // Input throttling (send at 10Hz to reduce load)
  private lastInputSendTime = 0;
  private readonly INPUT_SEND_INTERVAL = 100; // 10Hz

  // World constants
  private readonly WORLD_WIDTH = 3000;
  private readonly WORLD_HEIGHT = 3000;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { playerName?: string }): void {
    this.playerName = data.playerName || 'Player';
  }

  create(): void {
    // Initialize sound manager
    this.soundManager = new SoundManager(this);
    this.soundManager.startEngine();

    // Initialize visual effects
    this.visualEffects = new VisualEffects(this);

    // Initialize mobile controls (only shows on touch devices)
    this.mobileControls = new MobileControls(this);

    // Initialize network connection
    this.networkManager = new NetworkManager();
    this.networkManager.onPlayerId = this.handlePlayerId.bind(this);
    this.networkManager.onPlayerDied = this.handlePlayerDied.bind(this);
    this.networkManager.onDeathTimer = this.handleDeathTimer.bind(this);
    this.networkManager.onRespawnDenied = this.handleRespawnDenied.bind(this);
    this.networkManager.onLevelUp = this.handleLevelUp.bind(this);
    this.networkManager.onPlayerStats = this.handlePlayerStats.bind(this);
    this.networkManager.onRespawned = this.handleRespawned.bind(this);
    this.networkManager.onKillFeed = this.handleKillFeed.bind(this);
    this.networkManager.onDamageDealt = this.handleDamageDealt.bind(this);
    this.networkManager.onXpGained = this.handleXpGained.bind(this);

    this.networkManager.onWorldInit = ({ islands }: { islands: Island[] }) => {
      this.worldIslands = islands;
      this.updateIslandsFromState(islands);

      // Ensure minimap has island data even if gameState omits islands (static world).
      this.events.emit('updateMinimap', {
        ships: [],
        neutrals: [],
        islands: this.worldIslands,
        playerId: this.playerId
      });
    };

    // Handle game state updates directly when they arrive
    this.networkManager.onGameState = (state: GameState) => {
      this.handleGameState(state);
    };

    // UI-driven exit (settings -> Exit)
    this.events.on('exitGame', this.handleExitGame, this);

    // Create ocean background grid
    this.createOceanGrid();

    // Create player ship (will be positioned when server sends state)
    this.playerShip = new ShipEntity(
      this,
      this.WORLD_WIDTH / 2,
      this.WORLD_HEIGHT / 2,
      'local-player',
      'patrol_boat',
      'You'
    );
    this.playerShip.setDepth(20);

    // Enable physics for local player
    this.physics.add.existing(this.playerShip);
    this.playerBody = this.playerShip.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setDrag(50, 50);
    this.playerBody.setMaxVelocity(this.BASE_SHIP_SPEED);
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setCircle(25, -25, -25); // Radius 25, offset to center on ship

    // Resolve local island collisions is handled by server now for consistency
    // (removed client-side prediction for collisions to avoid stutter)

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.abilityKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Camera follows player
    this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
    this.cameras.main.startFollow(this.playerShip, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    // Start UI scene in parallel
    this.scene.launch('UIScene');

    // Listen for UI events
    this.events.on('upgradeStat', (stat: keyof PlayerStats) => {
      this.networkManager.upgradeStat(stat);
    });
    this.events.on('upgradeShipClass', (shipClass: ShipClass) => {
      this.networkManager.upgradeShipClass(shipClass);
    });
    this.events.on('requestRespawn', () => {
      this.networkManager.requestRespawn();
    });
    this.events.on('setMasterVolume', (vol: number) => {
      this.soundManager.setMasterVolume(vol);
    });
    this.events.on('setSfxVolume', (vol: number) => {
      this.soundManager.setSfxVolume(vol);
    });

    // Join the game with player name
    this.networkManager.joinGame(this.playerName);
  }

  private createOceanGrid(): void {
    const key = 'ocean-grid-100';
    const gridSize = 100;

    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.setVisible(false);
      g.lineStyle(1, 0x2a4a6a, 0.25);
      // Draw a single cell with top/left lines (tiling creates the full grid)
      g.strokeRect(0, 0, gridSize, gridSize);
      g.generateTexture(key, gridSize, gridSize);
      g.destroy();
    }

    const tile = this.add.tileSprite(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT, key);
    tile.setOrigin(0, 0);
    tile.setDepth(-1);

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
  }

  private handlePlayerId(id: string): void {
    this.playerId = id;
    this.playerShip.shipId = id;
    if (import.meta.env.DEV) console.log('Assigned player ID:', id);
  }

  private handlePlayerDied(data: { killerId: string; victimId: string; killerName: string }): void {
    if (data.victimId === this.playerId) {
      this.isDead = true;
      this.playerShip.setVisible(false);
      this.soundManager.playDeath();
      this.events.emit('playerDied', { killerName: data.killerName });
    }
  }

  private handleDeathTimer(data: { deathTime: number }): void {
    this.events.emit('deathTimer', data);
  }

  private handleRespawnDenied(data: { remainingTime: number }): void {
    this.events.emit('respawnDenied', data);
  }

  private handleLevelUp(data: { newLevel: number; upgradePoints: number; availableShipClasses: ShipClass[] }): void {
    this.soundManager.playLevelUp();
    this.visualEffects.createLevelUpEffect(this.playerShip.x, this.playerShip.y);
    this.events.emit('showLevelUp', data);
  }

  private handlePlayerStats(data: { stats: PlayerStats; upgradePoints: number; xpToNextLevel: number }): void {
    // Update local speed bonus for physics
    this.speedBonus = data.stats.speedBonus;
    this.events.emit('updateStats', data);
  }

  private handleRespawned(data: { x: number; y: number }): void {
    this.isDead = false;
    this.playerShip.setPosition(data.x, data.y);
    this.playerShip.setVisible(true);
    this.playerShip.rotation = 0;

    // Reset velocity
    const body = this.playerShip.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Forward to UIScene to hide death overlay
    this.events.emit('respawned');
  }

  private handleKillFeed(data: { killerName: string; victimName: string; weapon: string }): void {
    // Forward to UI
    this.events.emit('killFeed', data);
  }

  private handleXpGained(data: { x: number; y: number; amount: number }): void {
    // Create floating XP number (green)
    const xpText = this.add.text(data.x, data.y - 30, `+${data.amount} XP`, {
      font: 'bold 20px Arial',
      color: '#2ecc71',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(21);

    this.tweens.add({
      targets: xpText,
      y: data.y - 80,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => xpText.destroy()
    });
  }

  private handleDamageDealt(data: { x: number; y: number; damage: number; isCritical: boolean }): void {
    // Create floating damage number
    this.createDamageNumber(data.x, data.y, data.damage, data.isCritical);

    // Play hit sound
    if (data.damage > 0) {
      this.soundManager.playHit();
      if (data.isCritical) {
        this.visualEffects.shakeScreen('light');
      }
    }
  }

  private createDamageNumber(x: number, y: number, damage: number, isCritical: boolean): void {
    const text = damage === 0 ? 'BLOCKED' : `-${damage}`;
    const color = damage === 0 ? '#3498db' : isCritical ? '#e74c3c' : '#f39c12';
    const size = isCritical ? '24px' : '18px';

    const damageText = this.add.text(x, y - 20, text, {
      font: `bold ${size} Arial`,
      color,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: damageText,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => damageText.destroy()
    });
  }

  private handleGameState(state: GameState): void {
    // In dev, fail loudly so we catch issues early.
    // In production, keep a boundary so one malformed packet doesn't take down the scene.
    if (import.meta.env.DEV) {
      this.applyGameState(state);
      return;
    }

    try {
      this.applyGameState(state);
    } catch (error) {
      console.error('Error handling game state:', error);
    }
  }

  private applyGameState(state: GameState): void {
    // Update islands (only once, they're static)
    this.updateIslandsFromState(state.islands);

    // Update ships
    this.updateShipsFromState(state.ships);

    // Update bullets
    this.updateBulletsFromState(state.bullets);

    // Update neutrals
    this.updateNeutralsFromState(state.neutrals);

    // Update drones
    this.updateDronesFromState(state.drones || []);

    // Update leaderboard in UI
    this.events.emit('updateLeaderboard', state.leaderboard);

    // Update minimap
    this.events.emit('updateMinimap', {
      ships: state.ships || [],
      neutrals: state.neutrals || [],
      islands: this.worldIslands.length > 0 ? this.worldIslands : (state.islands || []),
      playerId: this.playerId
    });
  }

  private updateIslandsFromState(islands: Island[]): void {
    // Islands are static, only create them once
    if (this.islands.size > 0) return;

    for (const islandData of islands) {
      const island = new IslandEntity(this, islandData);
      this.islands.set(islandData.id, island);
    }
  }

  private updateShipsFromState(ships: Ship[]): void {
    const currentIds = this.currentShipIds;
    currentIds.clear();

    for (const shipData of ships) {
      currentIds.add(shipData.id);

      // Handle local player
      if (shipData.id === this.playerId) {
        // Update health/XP from server
        this.playerShip.updateHealth(shipData.health, shipData.maxHealth);
        this.playerShip.setShipClass(shipData.shipClass);
        this.playerShip.setShielded(shipData.isShielded);

        // Emit UI update
        this.events.emit('updateUI', {
          health: shipData.health,
          maxHealth: shipData.maxHealth,
          xp: shipData.xp,
          level: shipData.level,
          score: shipData.score,
          kills: shipData.kills,
          abilityCooldown: shipData.abilityCooldown,
          abilityActive: shipData.abilityActive,
          shipClass: shipData.shipClass
        });
        continue;
      }

      let ship = this.ships.get(shipData.id);

      if (!ship) {
        // Create new ship
        ship = new ShipEntity(
          this,
          shipData.x,
          shipData.y,
          shipData.id,
          shipData.shipClass,
          `Player ${shipData.id.slice(0, 4)}`
        );
        ship.setDepth(20);
        this.ships.set(shipData.id, ship);
      }

      // Update target for interpolation
      ship.setTargetPosition(shipData.x, shipData.y, shipData.rotation);
      ship.updateHealth(shipData.health, shipData.maxHealth);
      ship.setShipClass(shipData.shipClass);
      ship.setStealthed(shipData.isStealthed);
      ship.setShielded(shipData.isShielded);
    }

    // Remove disconnected ships
    for (const [id, ship] of this.ships) {
      if (!currentIds.has(id)) {
        ship.destroy();
        this.ships.delete(id);
      }
    }
  }

  private updateBulletsFromState(bullets: Bullet[]): void {
    const currentIds = this.currentBulletIds;
    currentIds.clear();

    for (const bulletData of bullets) {
      currentIds.add(bulletData.id);

      let bullet = this.bullets.get(bulletData.id);

      if (!bullet) {
        // Create new bullet
        bullet = new BulletEntity(
          this,
          bulletData.x,
          bulletData.y,
          bulletData.id,
          bulletData.ownerId,
          bulletData.type,
          bulletData.damage
        );
        bullet.setDepth(10); // Ensure bullets are above islands/neutrals
        this.bullets.set(bulletData.id, bullet);
      }

      // Update target for interpolation
      bullet.setTargetPosition(bulletData.x, bulletData.y);
    }

    // Remove expired bullets
    for (const [id, bullet] of this.bullets) {
      if (!currentIds.has(id)) {
        bullet.destroy();
        this.bullets.delete(id);
      }
    }
  }

  private updateNeutralsFromState(neutrals: NeutralObject[]): void {
    const currentIds = this.currentNeutralIds;
    currentIds.clear();

    for (const neutralData of neutrals) {
      currentIds.add(neutralData.id);

      let neutral = this.neutrals.get(neutralData.id);

      if (!neutral) {
        // Create new neutral
        neutral = new NeutralEntity(
          this,
          neutralData.x,
          neutralData.y,
          neutralData.id,
          neutralData.type,
          neutralData.maxHealth
        );
        neutral.setDepth(5); // Above islands, below bullets/ships
        this.neutrals.set(neutralData.id, neutral);
      }

      // Update position (for moving cargo ships)
      neutral.setPosition(neutralData.x, neutralData.y);
      if (neutralData.rotation !== undefined) {
        neutral.setRotation(neutralData.rotation);
      }

      // Update health
      neutral.updateHealth(neutralData.health);
    }

    // Remove destroyed neutrals
    for (const [id, neutral] of this.neutrals) {
      if (!currentIds.has(id)) {
        this.visualEffects.createExplosion(neutral.x, neutral.y, 'medium');
        this.soundManager.playExplosion();
        this.visualEffects.shakeScreen('light');
        neutral.destroy();
        this.neutrals.delete(id);
      }
    }
  }

  private updateDronesFromState(drones: Drone[]): void {
    const currentIds = this.currentDroneIds;
    currentIds.clear();

    const ownKey = 'drone:own';
    const enemyKey = 'drone:enemy';
    this.ensureDroneTexture(ownKey, 0x00ff00);
    this.ensureDroneTexture(enemyKey, 0xff6600);

    for (const droneData of drones) {
      currentIds.add(droneData.id);

      let drone = this.drones.get(droneData.id);

      if (!drone) {
        // Create new drone visual (texture-backed image)
        const isOwn = droneData.ownerId === this.playerId;
        drone = this.add.image(droneData.x, droneData.y, isOwn ? ownKey : enemyKey);
        drone.setDepth(15);
        drone.setOrigin(0.5, 0.5);
        this.drones.set(droneData.id, drone);
      }

      // Update transform and texture (ownership can change if ids get reused)
      const isOwn = droneData.ownerId === this.playerId;
      const desiredKey = isOwn ? ownKey : enemyKey;
      if (drone.texture.key !== desiredKey) {
        drone.setTexture(desiredKey);
      }

      drone.setPosition(droneData.x, droneData.y);
      drone.setRotation(droneData.rotation);
    }

    // Remove expired drones
    for (const [id, drone] of this.drones) {
      if (!currentIds.has(id)) {
        drone.destroy();
        this.drones.delete(id);
      }
    }
  }

  private ensureDroneTexture(key: string, color: number): void {
    if (this.textures.exists(key)) return;

    const size = 64;
    const g = this.add.graphics();
    g.setVisible(false);

    const cx = size / 2;
    const cy = size / 2;

    // Glow
    g.lineStyle(3, color, 0.3);
    g.beginPath();
    g.moveTo(cx + 12, cy);
    g.lineTo(cx - 8, cy - 7);
    g.lineTo(cx - 4, cy);
    g.lineTo(cx - 8, cy + 7);
    g.closePath();
    g.strokePath();

    // Body
    g.fillStyle(color, 0.8);
    g.beginPath();
    g.moveTo(cx + 10, cy);
    g.lineTo(cx - 6, cy - 5);
    g.lineTo(cx - 3, cy);
    g.lineTo(cx - 6, cy + 5);
    g.closePath();
    g.fillPath();

    g.generateTexture(key, size, size);
    g.destroy();
  }

  update(time: number, delta: number): void {
    // Skip input handling if dead
    if (this.isDead) {
      // Still update interpolation for other entities
      for (const ship of this.ships.values()) {
        ship.updateInterpolation();
      }
      for (const bullet of this.bullets.values()) {
        bullet.updateInterpolation();
      }
      for (const neutral of this.neutrals.values()) {
        neutral.update(time, delta);
      }
      return;
    }

    const body = this.playerBody;

    // Get mobile input if on touch device
    const mobileInput = this.mobileControls.getInput();
    const isMobile = this.mobileControls.isEnabled();

    // Rotation (Arrow keys, A/D, or mobile joystick)
    const rotateLeft = this.cursors.left.isDown || this.wasdKeys.A.isDown || mobileInput.rotateLeft;
    const rotateRight = this.cursors.right.isDown || this.wasdKeys.D.isDown || mobileInput.rotateRight;

    if (rotateLeft) {
      this.playerShip.rotation -= this.TURN_RATE;
    } else if (rotateRight) {
      this.playerShip.rotation += this.TURN_RATE;
    }

    // Calculate current speed with bonus
    const currentSpeed = this.BASE_SHIP_SPEED + (this.speedBonus * 20);

    // Thrust (Up arrow, W, or mobile joystick up)
    const thrusting = this.cursors.up.isDown || this.wasdKeys.W.isDown || mobileInput.thrust;
    if (thrusting) {
      const velocityX = Math.cos(this.playerShip.rotation) * currentSpeed;
      const velocityY = Math.sin(this.playerShip.rotation) * currentSpeed;
      body.setVelocity(velocityX, velocityY);
    } else {
      // Instant stop when thrust is released (no drifting).
      body.setVelocity(0, 0);
    }

    // Update max velocity based on current speed
    body.setMaxVelocity(currentSpeed);

    // Firing (Left mouse button, Space, or mobile fire button)
    const mouseFire = this.input.mousePointer?.primaryDown ?? false;
    const keyFire = this.spaceKey.isDown;
    const mobileFire = isMobile ? mobileInput.fire : false;

    // Combine inputs (allow keyboard/mouse even if touch is detected for hybrid devices)
    const actualFiring = mouseFire || keyFire || mobileFire;

    // Ability (E key or mobile ability button)
    const useAbility = Phaser.Input.Keyboard.JustDown(this.abilityKey) || mobileInput.useAbility;

    // Throttle input sending to 10Hz
    if (time - this.lastInputSendTime >= this.INPUT_SEND_INTERVAL) {
      this.lastInputSendTime = time;

      this.networkManager.sendInput({
        x: this.playerShip.x,
        y: this.playerShip.y,
        rotation: this.playerShip.rotation,
        thrust: thrusting,
        fire: actualFiring,
        useAbility
      });
    }

    // Update interpolation for remote entities
    for (const ship of this.ships.values()) {
      ship.updateInterpolation();
    }

    for (const bullet of this.bullets.values()) {
      bullet.updateInterpolation();
    }
  }

  private handleExitGame(): void {
    this.networkManager.disconnect();
    this.scene.stop('UIScene');
    this.scene.start('TitleScene');
    this.scene.stop();
  }

  shutdown(): void {
    // Clean up entity maps
    for (const ship of this.ships.values()) {
      ship.destroy();
    }
    this.ships.clear();

    for (const bullet of this.bullets.values()) {
      bullet.destroy();
    }
    this.bullets.clear();

    for (const neutral of this.neutrals.values()) {
      neutral.destroy();
    }
    this.neutrals.clear();

    for (const island of this.islands.values()) {
      island.destroy();
    }
    this.islands.clear();

    for (const drone of this.drones.values()) {
      drone.destroy();
    }
    this.drones.clear();

    // Clean up systems
    this.soundManager.destroy();
    this.visualEffects.destroy();
    this.networkManager.disconnect();
    this.mobileControls.destroy();
  }
}
