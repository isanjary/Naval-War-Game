import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const isDev = import.meta.env.DEV;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  parent: 'game-container',
  width: 1920,
  height: 1080,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 800,
      height: 600
    },
    max: {
      width: 1920,
      height: 1080
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // Top-down, no gravity
      debug: isDev
    }
  },
  scene: [BootScene, TitleScene, GameScene, UIScene],
  backgroundColor: '#1a3a5c'
};

new Phaser.Game(config);
