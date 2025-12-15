import Phaser from 'phaser';
import type { ShipClass, PlayerStats, LeaderboardEntry, Ship, NeutralObject, Island } from '@shared/types';
import { SHIP_ABILITIES, MAX_STAT_POINTS } from '@shared/types';

// World constants (must match GameScene)
const WORLD_WIDTH = 3000;
// const WORLD_HEIGHT = 3000; // Unused


export class UIScene extends Phaser.Scene {
  // HUD elements
  private healthBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;

  // Ability indicator
  private abilityContainer!: Phaser.GameObjects.Container;
  private abilityBar!: Phaser.GameObjects.Graphics;
  private abilityText!: Phaser.GameObjects.Text;
  // private currentShipClass: ShipClass = 'patrol_boat'; // Unused


  // Minimap
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private readonly MINIMAP_SIZE = 150;
  private readonly MINIMAP_PADDING = 15;

  // Upgrade UI
  private upgradeContainer!: Phaser.GameObjects.Container;
  private statButtons: Phaser.GameObjects.Container[] = [];
  private upgradePointsText!: Phaser.GameObjects.Text;

  // Leaderboard
  private leaderboardContainer!: Phaser.GameObjects.Container;
  private leaderboardTexts: Phaser.GameObjects.Text[] = [];

  // Death screen
  private deathOverlay!: Phaser.GameObjects.Container;
  private respawnTimerText!: Phaser.GameObjects.Text;
  private respawnButton!: Phaser.GameObjects.Container;
  // private deathTime: number = 0; // Removed - instant respawn
  private respawnTimerEvent: Phaser.Time.TimerEvent | null = null;

  // Kill feed
  private killFeedContainer!: Phaser.GameObjects.Container;
  private killFeedEntries: Phaser.GameObjects.Text[] = [];
  private readonly MAX_KILL_FEED_ENTRIES = 5;

  // Settings
  private settingsContainer!: Phaser.GameObjects.Container;
  private settingsOpen = false;
  private masterVolumeSlider = 0.5;
  private sfxVolumeSlider = 0.7;
  private settingsGearBtn!: Phaser.GameObjects.Text;

  // Stats panel
  private statsContainer!: Phaser.GameObjects.Container;
  private statTexts!: {
    hp: Phaser.GameObjects.Text;
    spd: Phaser.GameObjects.Text;
    dmg: Phaser.GameObjects.Text;
    rld: Phaser.GameObjects.Text;
  };

  // State
  private upgradePoints = 0;
  private xpToNextLevel = 100;
  private maxHealth = 100;
  private playerId = '';
  private currentStats = { healthBonus: 0, speedBonus: 0, damageBonus: 0, reloadBonus: 0 };

  // Cached game state for minimap
  private cachedShips: Ship[] = [];
  private cachedNeutrals: NeutralObject[] = [];
  private cachedIslands: Island[] = [];

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Health bar (top left)
    this.healthBar = this.add.graphics();
    this.drawHealthBar(100);

    // XP bar (bottom)
    this.xpBar = this.add.graphics();
    this.drawXPBar(0, 100);

    // Level display
    this.levelText = this.add.text(20, 50, 'Level: 1', {
      font: '24px Arial',
      color: '#ffffff'
    });

    // Score display
    this.scoreText = this.add.text(20, 80, 'Score: 0', {
      font: '18px Arial',
      color: '#aaaaaa'
    });

    // Kills display
    this.killsText = this.add.text(20, 105, 'Kills: 0', {
      font: '18px Arial',
      color: '#e74c3c'
    });

    // Create stats panel (shows current stat levels)
    this.createStatsPanel();

    // Create ability indicator
    this.createAbilityIndicator();

    // Create upgrade UI (hidden by default)
    this.createUpgradeUI();

    // Create leaderboard
    this.createLeaderboard();

    // Create death screen (hidden by default)
    this.createDeathScreen();

    // Create minimap
    this.createMinimap();

    // Create kill feed
    this.createKillFeed();

    // Create settings menu
    this.createSettingsMenu();

    // Listen for events from GameScene
    const gameScene = this.scene.get('GameScene');
    gameScene.events.on('updateUI', this.handleUIUpdate, this);
    gameScene.events.on('showLevelUp', this.showLevelUpUI, this);
    gameScene.events.on('playerDied', this.showDeathScreen, this);
    gameScene.events.on('deathTimer', this.startRespawnTimer, this);
    gameScene.events.on('respawnDenied', this.handleRespawnDenied, this);
    gameScene.events.on('respawned', this.handleRespawned, this);
    gameScene.events.on('updateLeaderboard', this.updateLeaderboard, this);
    gameScene.events.on('updateStats', this.updateStats, this);
    gameScene.events.on('updateMinimap', this.updateMinimap, this);
    gameScene.events.on('setPlayerId', (id: string) => { this.playerId = id; }, this);
    gameScene.events.on('killFeed', this.addKillFeedEntry, this);
  }

  private drawHealthBar(health: number): void {
    const barWidth = 200;
    const barHeight = 20;
    const x = 20;
    const y = 20;

    this.healthBar.clear();

    // Background
    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Health fill
    const healthPercent = Math.max(0, health / this.maxHealth);
    const healthWidth = healthPercent * barWidth;
    const healthColor = healthPercent > 0.5 ? 0x2ecc71 : healthPercent > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.healthBar.fillStyle(healthColor, 1);
    this.healthBar.fillRect(x, y, healthWidth, barHeight);

    // Border
    this.healthBar.lineStyle(2, 0xffffff, 0.5);
    this.healthBar.strokeRect(x, y, barWidth, barHeight);
  }

  private createStatsPanel(): void {
    // Position below kills text
    this.statsContainer = this.add.container(20, 140);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(0, 0, 140, 95, 8);
    this.statsContainer.add(bg);

    // Title
    const title = this.add.text(70, 8, 'STATS', {
      font: 'bold 11px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5, 0);
    this.statsContainer.add(title);

    // Stat displays with colored bars
    const stats = [
      { key: 'hp', label: '❤️ HP', color: '#e74c3c', y: 28 },
      { key: 'spd', label: '⚡ SPD', color: '#3498db', y: 44 },
      { key: 'dmg', label: '💥 DMG', color: '#f39c12', y: 60 },
      { key: 'rld', label: '🔄 RLD', color: '#9b59b6', y: 76 }
    ];

    this.statTexts = {} as typeof this.statTexts;

    stats.forEach(stat => {
      const label = this.add.text(8, stat.y, stat.label, {
        font: '11px Arial',
        color: '#ffffff'
      });
      this.statsContainer.add(label);

      const valueText = this.add.text(130, stat.y, '0/7', {
        font: 'bold 11px Arial',
        color: stat.color
      }).setOrigin(1, 0);
      this.statsContainer.add(valueText);

      this.statTexts[stat.key as keyof typeof this.statTexts] = valueText;
    });
  }

  private updateStatsPanel(): void {
    this.statTexts.hp.setText(`${this.currentStats.healthBonus}/${MAX_STAT_POINTS}`);
    this.statTexts.spd.setText(`${this.currentStats.speedBonus}/${MAX_STAT_POINTS}`);
    this.statTexts.dmg.setText(`${this.currentStats.damageBonus}/${MAX_STAT_POINTS}`);
    this.statTexts.rld.setText(`${this.currentStats.reloadBonus}/${MAX_STAT_POINTS}`);
  }

  private drawXPBar(xp: number, xpNeeded: number): void {
    const barWidth = this.cameras.main.width - 40;
    const barHeight = 15;
    const x = 20;
    const y = this.cameras.main.height - 35;

    this.xpBar.clear();

    // Background
    this.xpBar.fillStyle(0x333333, 0.8);
    this.xpBar.fillRect(x, y, barWidth, barHeight);

    // XP fill
    const xpWidth = xpNeeded > 0 ? (xp / xpNeeded) * barWidth : barWidth;
    this.xpBar.fillStyle(0x9b59b6, 1);
    this.xpBar.fillRect(x, y, Math.min(xpWidth, barWidth), barHeight);

    // Border
    this.xpBar.lineStyle(2, 0xffffff, 0.3);
    this.xpBar.strokeRect(x, y, barWidth, barHeight);
  }

  private createUpgradeUI(): void {
    const { width } = this.cameras.main;

    this.upgradeContainer = this.add.container(width / 2, 150);
    this.upgradeContainer.setVisible(false);

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-250, -40, 500, 80, 10);
    this.upgradeContainer.add(bg);

    // Upgrade points text
    this.upgradePointsText = this.add.text(0, -30, 'Upgrade Points: 0', {
      font: '14px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5);
    this.upgradeContainer.add(this.upgradePointsText);

    // Stat upgrade buttons
    const statNames: (keyof PlayerStats)[] = ['healthBonus', 'speedBonus', 'damageBonus', 'reloadBonus'];
    const statLabels = ['❤️ HP', '⚡ SPD', '💥 DMG', '🔄 RLD'];
    const colors = [0xe74c3c, 0x3498db, 0xf39c12, 0x9b59b6];

    statNames.forEach((stat, i) => {
      const x = -150 + (i * 100);
      const btn = this.createStatButton(x, 10, statLabels[i], colors[i], stat);
      this.upgradeContainer.add(btn);
      this.statButtons.push(btn);
    });
  }

  private createAbilityIndicator(): void {
    const { height } = this.cameras.main;

    this.abilityContainer = this.add.container(20, height - 80);
    this.abilityContainer.setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(0, 0, 120, 50, 8);
    this.abilityContainer.add(bg);

    // Ability bar
    this.abilityBar = this.add.graphics();
    this.abilityContainer.add(this.abilityBar);

    // Text
    this.abilityText = this.add.text(60, 10, '[E] Ability', {
      font: '12px Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0);
    this.abilityContainer.add(this.abilityText);
  }

  private updateAbilityIndicator(cooldown: number, active: boolean, shipClass: ShipClass): void {
    const abilityConfig = SHIP_ABILITIES[shipClass];

    // Hide if no ability for this ship
    if (!abilityConfig) {
      this.abilityContainer.setVisible(false);
      return;
    }

    this.abilityContainer.setVisible(true);
    // this.currentShipClass = shipClass; // Unused


    // Update text
    const abilityName = abilityConfig.ability.charAt(0).toUpperCase() + abilityConfig.ability.slice(1);
    this.abilityText.setText(active ? `${abilityName} ACTIVE` : `[E] ${abilityName}`);
    this.abilityText.setColor(active ? '#2ecc71' : '#ffffff');

    // Update bar
    this.abilityBar.clear();
    const barWidth = 100;
    const barHeight = 8;
    const x = 10;
    const y = 32;

    // Background
    this.abilityBar.fillStyle(0x333333, 0.8);
    this.abilityBar.fillRect(x, y, barWidth, barHeight);

    // Fill based on cooldown
    if (active) {
      // Active - full green bar
      this.abilityBar.fillStyle(0x2ecc71, 1);
      this.abilityBar.fillRect(x, y, barWidth, barHeight);
    } else if (cooldown > 0) {
      // On cooldown - fill proportionally
      const cooldownPercent = 1 - (cooldown / abilityConfig.cooldown);
      this.abilityBar.fillStyle(0x9b59b6, 1);
      this.abilityBar.fillRect(x, y, barWidth * cooldownPercent, barHeight);
    } else {
      // Ready - full cyan bar
      this.abilityBar.fillStyle(0x3498db, 1);
      this.abilityBar.fillRect(x, y, barWidth, barHeight);
    }
  }

  private createStatButton(x: number, y: number, label: string, color: number, stat: keyof PlayerStats): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.8);
    bg.fillRoundedRect(-35, -18, 70, 36, 6);
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      font: '14px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(text);

    // Make interactive
    const hitArea = this.add.rectangle(0, 0, 70, 36, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      if (this.upgradePoints > 0) {
        this.scene.get('GameScene').events.emit('upgradeStat', stat);
      }
    });
    hitArea.on('pointerover', () => bg.setAlpha(1));
    hitArea.on('pointerout', () => bg.setAlpha(0.8));
    container.add(hitArea);

    return container;
  }

  private createLeaderboard(): void {
    const { width } = this.cameras.main;

    this.leaderboardContainer = this.add.container(width - 20, 20);

    // Title
    const title = this.add.text(0, 0, '🏆 Leaderboard', {
      font: 'bold 14px Arial',
      color: '#f1c40f'
    }).setOrigin(1, 0);
    this.leaderboardContainer.add(title);

    // Create 10 text entries
    for (let i = 0; i < 10; i++) {
      const text = this.add.text(0, 22 + (i * 18), '', {
        font: '11px Arial',
        color: '#ffffff'
      }).setOrigin(1, 0);
      this.leaderboardTexts.push(text);
      this.leaderboardContainer.add(text);
    }
  }

  private createMinimap(): void {
    const { width, height } = this.cameras.main;
    const x = width - this.MINIMAP_SIZE - this.MINIMAP_PADDING;
    const y = height - this.MINIMAP_SIZE - this.MINIMAP_PADDING;

    this.minimapContainer = this.add.container(x, y);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a2a3a, 0.9);
    bg.fillRect(0, 0, this.MINIMAP_SIZE, this.MINIMAP_SIZE);
    bg.lineStyle(2, 0x3498db, 0.8);
    bg.strokeRect(0, 0, this.MINIMAP_SIZE, this.MINIMAP_SIZE);
    this.minimapContainer.add(bg);

    // Graphics for entities
    this.minimapGraphics = this.add.graphics();
    this.minimapContainer.add(this.minimapGraphics);

    // Label
    const label = this.add.text(this.MINIMAP_SIZE / 2, -8, 'MAP', {
      font: 'bold 10px Arial',
      color: '#3498db'
    }).setOrigin(0.5, 1);
    this.minimapContainer.add(label);
  }

  private createKillFeed(): void {
    const { width } = this.cameras.main;

    // Position in top right, below leaderboard
    this.killFeedContainer = this.add.container(width - 20, 220);
  }

  private addKillFeedEntry(data: { killerName: string; victimName: string; weapon: string }): void {
    // Create new entry text
    const entryText = this.add.text(0, 0, `☠ ${data.killerName} → ${data.victimName}`, {
      font: '12px Arial',
      color: '#e74c3c'
    }).setOrigin(1, 0);

    // Add to container
    this.killFeedContainer.add(entryText);
    this.killFeedEntries.push(entryText);

    // Shift existing entries down
    this.killFeedEntries.forEach((entry, i) => {
      entry.setY((this.killFeedEntries.length - 1 - i) * 18);
    });

    // Remove old entries
    while (this.killFeedEntries.length > this.MAX_KILL_FEED_ENTRIES) {
      const oldEntry = this.killFeedEntries.shift();
      oldEntry?.destroy();
    }

    // Fade out after delay
    this.tweens.add({
      targets: entryText,
      alpha: 0,
      duration: 500,
      delay: 5000,
      onComplete: () => {
        const idx = this.killFeedEntries.indexOf(entryText);
        if (idx > -1) {
          this.killFeedEntries.splice(idx, 1);
          entryText.destroy();
        }
      }
    });
  }

  private createSettingsMenu(): void {
    const { width, height } = this.cameras.main;

    // Settings gear button
    // Place it away from the leaderboard top-right stack.
    this.settingsGearBtn = this.add.text(width - 210, 18, '⚙️', {
      font: '28px Arial'
    }).setInteractive({ useHandCursor: true });

    this.settingsGearBtn.on('pointerdown', () => this.toggleSettings());

    // Settings panel (hidden by default)
    this.settingsContainer = this.add.container(width / 2, height / 2);
    this.settingsContainer.setVisible(false);
    this.settingsContainer.setDepth(200);

    // Background (sized to fit content on smaller screens)
    const panelWidth = Math.min(440, width - 60);
    const panelHeight = Math.min(520, height - 60);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15);
    this.settingsContainer.add(bg);

    const topY = -panelHeight / 2 + 30;
    const bottomY = panelHeight / 2 - 30;

    // Title
    const title = this.add.text(0, topY, '⚙️ Settings', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.settingsContainer.add(title);

    // Volume controls
    this.createVolumeSlider(topY + 55, 'Master Volume', this.masterVolumeSlider, (val) => {
      this.masterVolumeSlider = val;
      this.scene.get('GameScene').events.emit('setMasterVolume', val);
    });

    this.createVolumeSlider(topY + 125, 'SFX Volume', this.sfxVolumeSlider, (val) => {
      this.sfxVolumeSlider = val;
      this.scene.get('GameScene').events.emit('setSfxVolume', val);
    });

    // Controls info
    const controlsTitle = this.add.text(0, topY + 190, 'Controls', {
      font: 'bold 18px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5);
    this.settingsContainer.add(controlsTitle);

    const controls = [
      'W/↑ - Thrust forward',
      'A/D or ←/→ - Rotate',
      'Space/Click - Fire',
      'E - Use ability'
    ];

    controls.forEach((text, i) => {
      const controlText = this.add.text(0, topY + 220 + i * 20, text, {
        font: '14px Arial',
        color: '#cccccc'
      }).setOrigin(0.5);
      this.settingsContainer.add(controlText);
    });

    // Manual (quick in-panel help so players don't need a new tab)
    const manualTitle = this.add.text(0, topY + 315, 'Manual', {
      font: 'bold 18px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5);
    this.settingsContainer.add(manualTitle);

    const manualText = this.add.text(0, topY + 345,
      '• Destroy buoys/cargo/lighthouses to gain XP\n' +
      '• Level up to get upgrade points and new ships\n' +
      '• Avoid islands — they block movement and shots',
      {
        font: '14px Arial',
        color: '#cccccc',
        align: 'center',
        lineSpacing: 6
      }
    ).setOrigin(0.5, 0);
    this.settingsContainer.add(manualText);

    // Close button
    const closeBtn = this.add.text(0, bottomY - 35, '[ Close ]', {
      font: 'bold 18px Arial',
      color: '#3498db'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.toggleSettings());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#3498db'));
    this.settingsContainer.add(closeBtn);

    // Exit button (return to title / leave game)
    const exitBtn = this.add.text(0, bottomY, '[ Exit ]', {
      font: 'bold 18px Arial',
      color: '#e74c3c'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    exitBtn.on('pointerdown', () => {
      this.toggleSettings(false);
      this.scene.get('GameScene').events.emit('exitGame');
    });
    exitBtn.on('pointerover', () => exitBtn.setColor('#ffffff'));
    exitBtn.on('pointerout', () => exitBtn.setColor('#e74c3c'));
    this.settingsContainer.add(exitBtn);
  }

  private createVolumeSlider(y: number, label: string, initialValue: number, onChange: (val: number) => void): void {
    const sliderWidth = 200;
    const sliderHeight = 10;

    // Label
    const labelText = this.add.text(0, y - 15, label, {
      font: '14px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.settingsContainer.add(labelText);

    // Track
    const track = this.add.graphics();
    track.fillStyle(0x333333, 1);
    track.fillRoundedRect(-sliderWidth / 2, y, sliderWidth, sliderHeight, 5);
    this.settingsContainer.add(track);

    // Fill
    const fill = this.add.graphics();
    this.settingsContainer.add(fill);

    const updateFill = (value: number) => {
      fill.clear();
      fill.fillStyle(0x3498db, 1);
      fill.fillRoundedRect(-sliderWidth / 2, y, sliderWidth * value, sliderHeight, 5);
    };
    updateFill(initialValue);

    // Handle
    const handleX = -sliderWidth / 2 + sliderWidth * initialValue;
    const handle = this.add.circle(handleX, y + sliderHeight / 2, 10, 0xffffff);
    handle.setInteractive({ useHandCursor: true, draggable: true });
    this.settingsContainer.add(handle);

    // Drag handling
    handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const clampedX = Math.max(-sliderWidth / 2, Math.min(sliderWidth / 2, dragX));
      handle.x = clampedX;
      const value = (clampedX + sliderWidth / 2) / sliderWidth;
      updateFill(value);
      onChange(value);
    });
  }

  private toggleSettings(force?: boolean): void {
    this.settingsOpen = force ?? !this.settingsOpen;
    this.settingsContainer.setVisible(this.settingsOpen);

    // Avoid overlap/visual clutter when the modal settings panel is open.
    if (this.leaderboardContainer) {
      this.leaderboardContainer.setVisible(!this.settingsOpen);
    }
  }

  private updateMinimap(data: { ships: Ship[]; neutrals: NeutralObject[]; islands: Island[]; playerId: string }): void {
    if (!data) {
      if (import.meta.env.DEV) console.warn('Minimap: received null data');
      return;
    }
    this.cachedShips = data.ships || [];
    this.cachedNeutrals = data.neutrals || [];
    this.cachedIslands = data.islands || [];
    this.playerId = data.playerId || '';
    this.drawMinimap();
  }

  private drawMinimap(): void {
    this.minimapGraphics.clear();

    const scale = this.MINIMAP_SIZE / WORLD_WIDTH;

    // Draw islands first (background) - simplified to circles for stability
    for (const island of this.cachedIslands) {
      const mx = island.x * scale;
      const my = island.y * scale;
      const mr = island.radius * scale;

      this.minimapGraphics.fillStyle(0x27ae60, 0.8);
      this.minimapGraphics.fillCircle(mx, my, mr);
    }

    // Draw neutrals (small dots)
    for (const neutral of this.cachedNeutrals) {
      const mx = neutral.x * scale;
      const my = neutral.y * scale;

      // Color by type
      const color = neutral.type === 'buoy' ? 0xf1c40f :
        neutral.type === 'cargo' ? 0x3498db : 0x9b59b6;
      this.minimapGraphics.fillStyle(color, 0.6);
      this.minimapGraphics.fillCircle(mx, my, 2);
    }

    // Draw ships and capture player ship in the same pass
    let playerMx = 0;
    let playerMy = 0;
    let playerRot = 0;
    let hasPlayer = false;

    for (const ship of this.cachedShips) {
      const mx = ship.x * scale;
      const my = ship.y * scale;

      if (ship.id === this.playerId) {
        playerMx = mx;
        playerMy = my;
        playerRot = ship.rotation;
        hasPlayer = true;
        continue;
      }

      this.minimapGraphics.fillStyle(0xe74c3c, 0.8);
      this.minimapGraphics.fillCircle(mx, my, 3);
    }

    // Draw player ship (larger, different color)
    if (hasPlayer) {
      // Player indicator (green with direction)
      this.minimapGraphics.fillStyle(0x2ecc71, 1);
      this.minimapGraphics.fillCircle(playerMx, playerMy, 4);

      // Direction indicator
      const dirX = playerMx + Math.cos(playerRot) * 8;
      const dirY = playerMy + Math.sin(playerRot) * 8;
      this.minimapGraphics.lineStyle(2, 0x2ecc71, 1);
      this.minimapGraphics.lineBetween(playerMx, playerMy, dirX, dirY);
    }
  }

  private createDeathScreen(): void {
    const { width, height } = this.cameras.main;

    this.deathOverlay = this.add.container(width / 2, height / 2);
    this.deathOverlay.setVisible(false);
    this.deathOverlay.setDepth(100);

    // Dark overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(-width / 2, -height / 2, width, height);
    this.deathOverlay.add(overlay);

    // Death text
    const deathText = this.add.text(0, -60, 'YOU WERE DESTROYED', {
      font: 'bold 48px Arial',
      color: '#e74c3c'
    }).setOrigin(0.5);
    this.deathOverlay.add(deathText);

    // Killer text
    const killerText = this.add.text(0, 0, '', {
      font: '24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    killerText.setName('killerText');
    this.deathOverlay.add(killerText);

    // Timer text (shows countdown)
    this.respawnTimerText = this.add.text(0, 40, '', {
      font: 'bold 20px Arial',
      color: '#f39c12'
    }).setOrigin(0.5);
    this.respawnTimerText.setName('timerText');
    this.deathOverlay.add(this.respawnTimerText);

    // Respawn button
    this.respawnButton = this.add.container(0, 120);

    // Respawn button
    this.respawnButton = this.add.container(0, 120);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x2ecc71, 1);
    btnBg.fillRoundedRect(-100, -25, 200, 50, 10);
    btnBg.setName('btnBg');
    this.respawnButton.add(btnBg);

    const btnText = this.add.text(0, 0, 'RESPAWN', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.respawnButton.add(btnText);

    const btnHitArea = this.add.rectangle(0, 0, 200, 50, 0x000000, 0);
    btnHitArea.setInteractive({ useHandCursor: true });
    btnHitArea.on('pointerdown', () => {
      this.scene.get('GameScene').events.emit('requestRespawn');
    });
    btnHitArea.on('pointerover', () => btnBg.setAlpha(0.8));
    btnHitArea.on('pointerout', () => btnBg.setAlpha(1));
    this.respawnButton.add(btnHitArea);

    this.deathOverlay.add(this.respawnButton);
  }

  private showLevelUpUI(data: { newLevel: number; upgradePoints: number; availableShipClasses: ShipClass[] }): void {
    this.upgradePoints = data.upgradePoints;

    this.updateUpgradeUI();

    // Flash level up notification - BIGGER and more visible
    const { width, height } = this.cameras.main;

    // Screen flash effect
    const flash = this.add.graphics();
    flash.fillStyle(0xf1c40f, 0.3);
    flash.fillRect(0, 0, width, height);
    flash.setDepth(49);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy()
    });

    const levelUpText = this.add.text(width / 2, height / 2 - 80, `🎉 LEVEL ${data.newLevel}! 🎉`, {
      font: 'bold 48px Arial',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(50);

    // Add hint about upgrade points
    const hintText = this.add.text(width / 2, height / 2 - 30, `+1 Upgrade Point! Click buttons at top ⬆️`, {
      font: 'bold 20px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(50);

    // Scale animation
    this.tweens.add({
      targets: levelUpText,
      scaleX: 1.2,
      scaleY: 1.2,
      yoyo: true,
      duration: 300,
      repeat: 2,
      onComplete: () => {
        this.tweens.add({
          targets: [levelUpText, hintText],
          y: '-=50',
          alpha: 0,
          duration: 1500,
          ease: 'Power2',
          onComplete: () => {
            levelUpText.destroy();
            hintText.destroy();
          }
        });
      }
    });

    // Pulse the upgrade container
    if (this.upgradeContainer.visible) {
      this.tweens.add({
        targets: this.upgradeContainer,
        scaleX: 1.1,
        scaleY: 1.1,
        yoyo: true,
        duration: 200,
        repeat: 5
      });
    }

    // Show ship class selection if available
    if (data.availableShipClasses.length > 0) {
      this.showShipClassSelection(data.availableShipClasses);
    }
  }

  private showShipClassSelection(classes: ShipClass[]): void {
    const { width, height } = this.cameras.main;

    const container = this.add.container(width / 2, height / 2);
    container.setDepth(60);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-300, -150, 600, 300, 15);
    container.add(bg);

    // Title
    const title = this.add.text(0, -120, 'Choose Your Ship Class!', {
      font: 'bold 28px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5);
    container.add(title);

    // Ship class buttons
    const classColors: Record<ShipClass, number> = {
      patrol_boat: 0x3498db,
      destroyer: 0xe74c3c,
      cruiser: 0x9b59b6,
      battleship: 0x2c3e50,
      submarine: 0x1abc9c,
      carrier: 0xf39c12
    };

    const classDescriptions: Record<ShipClass, string> = {
      patrol_boat: 'Balanced starter',
      destroyer: 'Fast, rapid fire',
      cruiser: 'Tanky, turrets',
      battleship: 'Slow, big damage',
      submarine: 'Stealth, torpedoes',
      carrier: 'Drone support'
    };

    classes.forEach((shipClass, i) => {
      const x = -200 + (i % 3) * 200;
      const y = -50 + Math.floor(i / 3) * 100;

      const btn = this.add.container(x, y);

      const btnBg = this.add.graphics();
      btnBg.fillStyle(classColors[shipClass], 0.9);
      btnBg.fillRoundedRect(-80, -35, 160, 70, 8);
      btn.add(btnBg);

      const name = this.add.text(0, -10, shipClass.replace('_', ' ').toUpperCase(), {
        font: 'bold 12px Arial',
        color: '#ffffff'
      }).setOrigin(0.5);
      btn.add(name);

      const desc = this.add.text(0, 10, classDescriptions[shipClass], {
        font: '10px Arial',
        color: '#cccccc'
      }).setOrigin(0.5);
      btn.add(desc);

      const hitArea = this.add.rectangle(0, 0, 160, 70, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.scene.get('GameScene').events.emit('upgradeShipClass', shipClass);
        container.destroy();
      });
      hitArea.on('pointerover', () => btnBg.setAlpha(1));
      hitArea.on('pointerout', () => btnBg.setAlpha(0.9));
      btn.add(hitArea);

      container.add(btn);
    });

    // Keep patrol boat button
    const skipBtn = this.add.text(0, 110, 'Keep Patrol Boat', {
      font: '14px Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => container.destroy());
    skipBtn.on('pointerover', () => skipBtn.setColor('#ffffff'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#aaaaaa'));
    container.add(skipBtn);
  }

  private updateUpgradeUI(): void {
    this.upgradePointsText.setText(`Upgrade Points: ${this.upgradePoints}`);
    this.upgradeContainer.setVisible(this.upgradePoints > 0);
  }

  private showDeathScreen(data: { killerName: string }): void {
    this.deathOverlay.setVisible(true);

    const killerText = this.deathOverlay.getByName('killerText') as Phaser.GameObjects.Text;
    if (killerText) {
      killerText.setText(`Destroyed by ${data.killerName}`);
    }

    // Disable respawn button until timer finishes
    this.respawnButton.setAlpha(0.5);
    const btnHitArea = this.respawnButton.getAt(2) as Phaser.GameObjects.Rectangle;
    btnHitArea.removeInteractive();
  }

  private startRespawnTimer(_data: { deathTime: number }): void {
    // Instant respawn - no cooldown needed

    // Stop any existing timer
    if (this.respawnTimerEvent) {
      this.respawnTimerEvent.destroy();
    }

    // Update countdown every second
    this.respawnTimerEvent = this.time.addEvent({
      delay: 100,
      callback: this.updateRespawnTimer,
      callbackScope: this,
      loop: true
    });
  }

  private updateRespawnTimer(): void {
    // INSTANT RESPAWN - no cooldown for browser-only single player
    this.respawnTimerText.setText('Click to Respawn');
    this.respawnButton.setAlpha(1);
    const btnHitArea = this.respawnButton.getAt(2) as Phaser.GameObjects.Rectangle;
    btnHitArea.setInteractive({ useHandCursor: true });

    // Stop timer immediately
    if (this.respawnTimerEvent) {
      this.respawnTimerEvent.destroy();
      this.respawnTimerEvent = null;
    }
  }

  private handleRespawnDenied(_data: { remainingTime: number }): void {

    // Flash the timer text red
    this.respawnTimerText.setColor('#e74c3c');
    this.time.delayedCall(500, () => {
      this.respawnTimerText.setColor('#f39c12');
    });
  }

  private handleRespawned(): void {
    // Hide death overlay on successful respawn
    this.deathOverlay.setVisible(false);
  }

  private handleUIUpdate(data: {
    health: number;
    maxHealth: number;
    xp: number;
    level: number;
    score: number;
    kills: number;
    abilityCooldown?: number;
    abilityActive?: boolean;
    shipClass?: ShipClass;
  }): void {
    this.maxHealth = data.maxHealth;
    this.drawHealthBar(data.health);
    this.drawXPBar(data.xp, this.xpToNextLevel);
    this.levelText.setText(`Level: ${data.level}`);
    this.scoreText.setText(`Score: ${data.score}`);
    this.killsText.setText(`Kills: ${data.kills}`);

    // Update ability indicator
    if (data.shipClass) {
      this.updateAbilityIndicator(
        data.abilityCooldown || 0,
        data.abilityActive || false,
        data.shipClass
      );
    }
  }

  private updateLeaderboard(entries: LeaderboardEntry[]): void {
    entries.forEach((entry, i) => {
      if (this.leaderboardTexts[i]) {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        this.leaderboardTexts[i].setText(`${medal} ${entry.name} - ${entry.score}`);
      }
    });

    // Clear unused entries
    for (let i = entries.length; i < this.leaderboardTexts.length; i++) {
      this.leaderboardTexts[i].setText('');
    }
  }

  private updateStats(data: { stats: PlayerStats; upgradePoints: number; xpToNextLevel: number }): void {
    this.upgradePoints = data.upgradePoints;
    this.xpToNextLevel = data.xpToNextLevel;
    this.currentStats = data.stats;
    this.updateUpgradeUI();
    this.updateStatsPanel();
  }

  // Public methods
  public updateHealth(health: number): void {
    this.drawHealthBar(health);
  }

  public updateXP(xp: number): void {
    this.drawXPBar(xp, this.xpToNextLevel);
  }

  public updateLevel(level: number): void {
    this.levelText.setText(`Level: ${level}`);
  }

  public updateScore(score: number): void {
    this.scoreText.setText(`Score: ${score}`);
  }
}
