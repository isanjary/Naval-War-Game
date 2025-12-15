import Phaser from 'phaser';

export class MobileControls {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private joystickBase!: Phaser.GameObjects.Graphics;
  private joystickThumb!: Phaser.GameObjects.Graphics;
  private fireButton!: Phaser.GameObjects.Container;
  private abilityButton!: Phaser.GameObjects.Container;
  
  // Joystick state
  private joystickActive = false;
  private joystickStartX = 0;
  private joystickStartY = 0;
  private joystickDeltaX = 0;
  private joystickDeltaY = 0;
  private readonly JOYSTICK_RADIUS = 50;
  private readonly DEAD_ZONE = 10;
  
  // Button state
  private firePressed = false;
  private abilityPressed = false;
  
  // Touch support check
  private enabled = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.enabled = this.isTouchDevice();
    
    if (this.enabled) {
      this.createControls();
    }
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  private createControls(): void {
    const { width, height } = this.scene.cameras.main;
    
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);
    
    // Joystick (left side)
    this.createJoystick(120, height - 150);
    
    // Fire button (right side)
    this.createFireButton(width - 120, height - 150);
    
    // Ability button (above fire)
    this.createAbilityButton(width - 120, height - 260);
    
    // Setup touch handlers
    this.setupTouchHandlers();
  }

  private createJoystick(x: number, y: number): void {
    // Base
    this.joystickBase = this.scene.add.graphics();
    this.joystickBase.fillStyle(0x333333, 0.5);
    this.joystickBase.fillCircle(x, y, this.JOYSTICK_RADIUS + 10);
    this.joystickBase.lineStyle(2, 0xffffff, 0.3);
    this.joystickBase.strokeCircle(x, y, this.JOYSTICK_RADIUS + 10);
    this.container.add(this.joystickBase);
    
    // Thumb
    this.joystickThumb = this.scene.add.graphics();
    this.joystickThumb.fillStyle(0xffffff, 0.7);
    this.joystickThumb.fillCircle(x, y, 25);
    this.container.add(this.joystickThumb);
    
    // Store base position
    this.joystickStartX = x;
    this.joystickStartY = y;
  }

  private createFireButton(x: number, y: number): void {
    this.fireButton = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xe74c3c, 0.7);
    bg.fillCircle(0, 0, 45);
    bg.lineStyle(3, 0xffffff, 0.5);
    bg.strokeCircle(0, 0, 45);
    this.fireButton.add(bg);
    
    const icon = this.scene.add.text(0, 0, '🔥', {
      font: '32px Arial'
    }).setOrigin(0.5);
    this.fireButton.add(icon);
    
    this.container.add(this.fireButton);
  }

  private createAbilityButton(x: number, y: number): void {
    this.abilityButton = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x3498db, 0.7);
    bg.fillCircle(0, 0, 35);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeCircle(0, 0, 35);
    this.abilityButton.add(bg);
    
    const icon = this.scene.add.text(0, 0, '⚡', {
      font: '24px Arial'
    }).setOrigin(0.5);
    this.abilityButton.add(icon);
    
    this.container.add(this.abilityButton);
  }

  private setupTouchHandlers(): void {
    const { width } = this.scene.cameras.main;
    
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Left half - joystick
      if (pointer.x < width / 2) {
        this.joystickActive = true;
        this.updateJoystickThumb(pointer.x, pointer.y);
      }
      
      // Fire button area
      const fireDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y, 
        this.fireButton.x, this.fireButton.y
      );
      if (fireDist < 50) {
        this.firePressed = true;
      }
      
      // Ability button area
      const abilityDist = Phaser.Math.Distance.Between(
        pointer.x, pointer.y, 
        this.abilityButton.x, this.abilityButton.y
      );
      if (abilityDist < 40) {
        this.abilityPressed = true;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.x < width / 2) {
        this.updateJoystickThumb(pointer.x, pointer.y);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < width / 2) {
        this.joystickActive = false;
        this.joystickDeltaX = 0;
        this.joystickDeltaY = 0;
        // Reset thumb position
        this.joystickThumb.clear();
        this.joystickThumb.fillStyle(0xffffff, 0.7);
        this.joystickThumb.fillCircle(this.joystickStartX, this.joystickStartY, 25);
      }
      
      this.firePressed = false;
      this.abilityPressed = false;
    });
  }

  private updateJoystickThumb(x: number, y: number): void {
    const dx = x - this.joystickStartX;
    const dy = y - this.joystickStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp to joystick radius
    const clampedDist = Math.min(distance, this.JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    
    const thumbX = this.joystickStartX + Math.cos(angle) * clampedDist;
    const thumbY = this.joystickStartY + Math.sin(angle) * clampedDist;
    
    // Redraw thumb
    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0xffffff, 0.7);
    this.joystickThumb.fillCircle(thumbX, thumbY, 25);
    
    // Store normalized delta
    if (distance > this.DEAD_ZONE) {
      this.joystickDeltaX = dx / this.JOYSTICK_RADIUS;
      this.joystickDeltaY = dy / this.JOYSTICK_RADIUS;
    } else {
      this.joystickDeltaX = 0;
      this.joystickDeltaY = 0;
    }
  }

  public getInput(): { thrust: boolean; rotateLeft: boolean; rotateRight: boolean; fire: boolean; useAbility: boolean } {
    if (!this.enabled) {
      return { thrust: false, rotateLeft: false, rotateRight: false, fire: false, useAbility: false };
    }
    
    // Joystick: Up = thrust, Left/Right = rotate
    const thrust = this.joystickDeltaY < -0.3;
    const rotateLeft = this.joystickDeltaX < -0.3;
    const rotateRight = this.joystickDeltaX > 0.3;
    
    return {
      thrust,
      rotateLeft,
      rotateRight,
      fire: this.firePressed,
      useAbility: this.abilityPressed
    };
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public destroy(): void {
    if (this.container) {
      this.container.destroy();
    }
  }
}
