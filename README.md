# Naval War

A browser-based single-player tactical naval combat game built with Phaser 3. Command your warship, destroy enemy fleets, and climb the leaderboard.

## Live Demo

**Play Now:** [https://naval-war-game.vercel.app](https://naval-war-game.vercel.app)

**Game Manual:** [https://naval-war-game.vercel.app/manual.html](https://naval-war-game.vercel.app/manual.html)

## Screenshots

### Main Menu
![Main Menu](public/download%20(3).png)

### Gameplay
![Gameplay](public/download%20(1).png)

### Settings
![Settings](public/download%20(2).png)

## Features

- **Single-Player Campaign**: Battle against AI-controlled ships and defensive structures
- **Ship Progression System**: Unlock and upgrade 5 unique ship classes
  - Patrol Boat (Starter)
  - Destroyer (Speed Boost ability)
  - Cruiser (Shield ability)
  - Battleship (Heavy firepower)
  - Submarine (Stealth ability)
  - Carrier (Drone deployment)
- **Tiered Unlocks**: Progressively unlock ships as you level up (Levels 2-7)
- **Stat Upgrades**: Enhance Health, Speed, Damage, and Reload speed
- **XP & Leveling**: Gain experience by destroying targets, max level 10
- **Local Leaderboard**: Track your best scores with localStorage persistence
- **Responsive Controls**: Full keyboard/mouse and mobile touch support
- **Dynamic Abilities**: Each ship class has unique tactical abilities

## Gameplay

- **Objective**: Destroy neutral targets and enemy ships to gain XP and level up
- **Targets**:
  - Buoys (8 XP) - Easy targets
  - Cargo Ships (25 XP) - Moving targets
  - Lighthouses (60 XP) - Defensive structures that shoot back
  - Tanks (250 XP) - High-reward armored units on islands
- **Instant Respawn**: Get back into action immediately after defeat
- **Spawn Protection**: 3-second invulnerability after spawning

## Controls

### Keyboard & Mouse
- **W / Arrow Up**: Thrust Forward
- **A / Arrow Left**: Turn Left
- **D / Arrow Right**: Turn Right
- **Space / Left Click**: Fire Weapons
- **E**: Activate Ship Ability
- **1-4**: Upgrade Stats (Health, Speed, Damage, Reload)

### Mobile
- On-screen joystick for movement
- Tap buttons for firing and abilities

## Technology Stack

- **Game Engine**: Phaser 3
- **Language**: TypeScript
- **Build Tool**: Vite
- **Deployment**: Vercel
- **State Management**: localStorage (leaderboard & progress)

## Local Development

### Prerequisites
- Node.js 20+ 
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/isanjary/Naval-War-Game.git
cd Naval-War-Game

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Build output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
Naval-War-Game/
├── src/
│   ├── entities/       # Ship, Bullet, Neutral, Island visual classes
│   ├── game/           # SinglePlayerServer game logic
│   ├── scenes/         # Phaser scenes (Boot, Title, Game, UI)
│   ├── systems/        # NetworkManager, Controls, Audio, Effects
│   └── shared/         # Types and constants
├── public/             # Static assets (manual.html)
├── index.html          # Entry point
└── vite.config.ts      # Vite configuration
```

## Game Balance

### XP Values
- Buoy: 8 XP
- Cargo Ship: 25 XP  
- Lighthouse: 60 XP
- Tank: 250 XP

### Ship Unlock Levels
- Destroyer: Level 2+
- Cruiser: Level 4+
- Battleship: Level 5+
- Submarine: Level 6+
- Carrier: Level 7+

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Developed by [isanjary](https://github.com/isanjary)

## Feedback & Issues

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/isanjary/Naval-War-Game/issues).
