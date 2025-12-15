import Phaser from 'phaser';
import { ShipEntity } from '../entities/ShipEntity';
import type { ShipClass } from '@shared/types';


interface ScoreEntry {
  name: string;
  score: number;
  date: string;
}

interface LeaderboardData {
  lastGame: ScoreEntry | null;
  highScores: ScoreEntry[];
}

export class TitleScene extends Phaser.Scene {
  private nameInput!: HTMLInputElement;
  private playButton!: Phaser.GameObjects.Container;
  private helpButton!: Phaser.GameObjects.Text;


  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Ocean background
    this.cameras.main.setBackgroundColor(0x1a2a3a);
    this.createWaterEffect();

    // Title
    const title = this.add.text(width / 2, height * 0.2, 'NAVAL WAR', {
      font: 'bold 72px Arial',
      color: '#ffffff',
      stroke: '#1a5276',
      strokeThickness: 8
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height * 0.2 + 60, 'Dominate the Seas', {
      font: 'italic 24px Arial',
      color: '#85c1e9'
    }).setOrigin(0.5);

    // Pulsing title effect
    this.tweens.add({
      targets: title,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const centerX = width / 2;

    // Main flow layout (centered, clean vertical stack)
    const nameLabelY = height * 0.40;
    const nameInputY = nameLabelY + 50;
    const playButtonY = nameInputY + 80;

    // Name input label
    this.add.text(centerX, nameLabelY, 'Enter Your Name', {
      font: '20px Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Create HTML input for name
    this.createNameInput(centerX, nameInputY);

    // Play button
    this.createPlayButton(centerX, playButtonY);



    // Help button (bottom-right, small)
    this.helpButton = this.add.text(width - 100, height - 40, '📖 How to Play', {
      font: '16px Arial',
      color: '#3498db',
      backgroundColor: '#1a2a3a',
      padding: { x: 12, y: 8 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    this.helpButton.on('pointerdown', () => {
      window.open('/manual.html', '_blank');
    });
    this.helpButton.on('pointerover', () => this.helpButton.setColor('#ffffff'));
    this.helpButton.on('pointerout', () => this.helpButton.setColor('#3498db'));

    // Credits
    this.add.text(width / 2, height - 20, 'A Multiplayer Naval Battle Game', {
      font: '14px Arial',
      color: '#666666'
    }).setOrigin(0.5);

    // Ship previews
    this.createShipPreviews(width, height);

    // Leaderboard
    this.createLeaderboard(width);
  }

  private createLeaderboard(width: number): void {
    const saved = localStorage.getItem('navalwar_leaderboard');
    if (!saved) return;

    try {
      const data = JSON.parse(saved) as LeaderboardData;
      const lastGame = data.lastGame;
      const highScores = data.highScores || [];

      // Last Game (Top Left)
      if (lastGame) {
        const date = new Date(lastGame.date).toLocaleDateString();
        this.add.text(40, 40, 'LAST BATTLE', { font: 'bold 18px Arial', color: '#85c1e9' });
        this.add.text(40, 70, `${lastGame.name}`, { font: '16px Arial', color: '#ffffff' });
        this.add.text(40, 95, `Score: ${lastGame.score}`, { font: 'bold 20px Arial', color: '#e74c3c' });
        this.add.text(40, 120, `${date}`, { font: '12px Arial', color: '#aaaaaa' });
      }

      // Hall of Fame (Top Right)
      if (highScores.length > 0) {
        const x = width - 250;
        let y = 40;

        this.add.text(x, y, 'HALL OF FAME', { font: 'bold 18px Arial', color: '#f39c12' });
        y += 30;

        highScores.forEach((entry, index: number) => {
          const rank = index + 1;
          const date = new Date(entry.date).toLocaleDateString();

          this.add.text(x, y, `#${rank} ${entry.name}`, { font: 'bold 16px Arial', color: '#ffffff' });
          this.add.text(x + 140, y, `${entry.score}`, { font: 'bold 16px Arial', color: '#2ecc71' }).setOrigin(1, 0);
          y += 20;
          this.add.text(x, y, `${date}`, { font: '12px Arial', color: '#666666' });
          y += 25;
        });
      }

    } catch (e) {
      console.error('Error loading leaderboard', e);
    }
  }



  private createWaterEffect(): void {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();

    // Draw wave patterns
    graphics.lineStyle(1, 0x2a4a6a, 0.3);

    for (let y = 0; y < height; y += 50) {
      graphics.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const offsetY = Math.sin(x * 0.02) * 5;
        if (x === 0) {
          graphics.moveTo(x, y + offsetY);
        } else {
          graphics.lineTo(x, y + offsetY);
        }
      }
      graphics.strokePath();
    }
  }

  private createNameInput(x: number, y: number): void {
    // Create HTML input element
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Captain';
    this.nameInput.maxLength = 16;
    this.nameInput.value = localStorage.getItem('playerName') || '';

    // Style the input
    this.nameInput.style.cssText = `
      position: absolute;
      width: 250px;
      padding: 12px 20px;
      font-size: 18px;
      font-family: Arial, sans-serif;
      text-align: center;
      border: 2px solid #3498db;
      border-radius: 25px;
      background: rgba(26, 42, 58, 0.9);
      color: white;
      outline: none;
      transform: translate(-50%, -50%);
    `;

    // Position the input
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    this.nameInput.style.left = `${rect.left + x * scaleX}px`;
    this.nameInput.style.top = `${rect.top + y * scaleY}px`;

    // Add focus effects
    this.nameInput.addEventListener('focus', () => {
      this.nameInput.style.borderColor = '#e94560';
      this.nameInput.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.5)';
    });

    this.nameInput.addEventListener('blur', () => {
      this.nameInput.style.borderColor = '#3498db';
      this.nameInput.style.boxShadow = 'none';
    });

    // Enter key to start
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        void this.startGame();
      }
    });

    document.body.appendChild(this.nameInput);

    // Handle resize
    this.scale.on('resize', () => this.repositionInput(x, y));
  }

  private repositionInput(x: number, y: number): void {
    if (!this.nameInput) return;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    this.nameInput.style.left = `${rect.left + x * scaleX}px`;
    this.nameInput.style.top = `${rect.top + y * scaleY}px`;
  }

  private createPlayButton(x: number, y: number): void {
    this.playButton = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(0xe94560, 1);
    bg.fillRoundedRect(-100, -30, 200, 60, 30);
    this.playButton.add(bg);

    // Button text
    const text = this.add.text(0, 0, '⚓ SET SAIL', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.playButton.add(text);

    // Make interactive
    this.playButton.setSize(200, 60);
    this.playButton.setInteractive({ useHandCursor: true });

    // Hover effects
    this.playButton.on('pointerover', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100
      });
    });

    this.playButton.on('pointerout', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    });

    this.playButton.on('pointerdown', () => {
      void this.startGame();
    });
  }

  private createShipPreviews(width: number, height: number): void {
    const ships: Array<{ name: string; shipClass: ShipClass; x: number }> = [
      { name: 'Destroyer', shipClass: 'destroyer', x: width * 0.15 },
      { name: 'Cruiser', shipClass: 'cruiser', x: width * 0.35 },
      { name: 'Battleship', shipClass: 'battleship', x: width * 0.65 },
      { name: 'Carrier', shipClass: 'carrier', x: width * 0.85 }
    ];

    const y = height * 0.9;

    // Ensure ship textures exist (generated once per class)
    for (const s of ships) ShipEntity.ensureBodyTexture(this, s.shipClass);

    for (const s of ships) {
      const img = this.add.image(s.x, y, ShipEntity.getBodyTextureKey(s.shipClass)).setOrigin(0.5);
      // Match in-game size (GameScene camera zoom is 1).
      img.setScale(1);

      // Label
      this.add.text(s.x, y + 70, s.name, {
        font: '12px Arial',
        color: '#666666'
      }).setOrigin(0.5);
    }
  }

  private async startGame(): Promise<void> {
    const playerName = this.nameInput.value.trim() || 'Captain';

    // Save name for next time
    localStorage.setItem('playerName', playerName);

    // Clean up input
    this.nameInput.remove();

    // Start game with player name
    this.scene.start('GameScene', { playerName });
  }

  shutdown(): void {
    if (this.nameInput && this.nameInput.parentNode) {
      this.nameInput.remove();
    }
  }
}
