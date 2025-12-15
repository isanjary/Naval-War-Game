// ============================================
// SHIP TYPES & CLASSES
// ============================================

export type ShipClass =
  | 'patrol_boat'    // Starter ship
  | 'destroyer'      // Speed/Agility path
  | 'cruiser'        // Defense/Health path
  | 'battleship'     // Damage/Range path
  | 'submarine'      // Stealth path
  | 'carrier';       // Support/Drone path

export interface Ship {
  id: string;
  x: number;
  y: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  health: number;
  maxHealth: number;
  level: number;
  xp: number;
  shipClass: ShipClass;
  kills: number;
  score: number;
  stats: PlayerStats;
  // Ability state
  abilityActive: boolean;
  abilityCooldown: number; // ms remaining
  isStealthed: boolean;
  isShielded: boolean;
}

// Player upgradeable stats
export interface PlayerStats {
  healthBonus: number;      // +10 max health per point
  speedBonus: number;       // +20 speed per point
  damageBonus: number;      // +2 damage per point
  reloadBonus: number;      // -50ms cooldown per point (min 100ms)
}

export const DEFAULT_STATS: PlayerStats = {
  healthBonus: 0,
  speedBonus: 0,
  damageBonus: 0,
  reloadBonus: 0
};

// Max stat points per stat
export const MAX_STAT_POINTS = 7;

// ============================================
// PROJECTILES
// ============================================

export type BulletType = 'cannon' | 'machinegun' | 'torpedo';

export interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  lifetime: number;
  type: BulletType;
  ignoreTerrain?: boolean;
}

// ============================================
// NEUTRAL OBJECTS (XP Sources)
// ============================================

export type NeutralType = 'buoy' | 'cargo' | 'lighthouse' | 'tank';

export interface NeutralObject {
  id: string;
  x: number;
  y: number;
  type: NeutralType;
  health: number;
  maxHealth: number;
  xpValue: number;
  // Movement for cargo ships
  rotation?: number;
  velocityX?: number;
  velocityY?: number;
  // Target tracking for lighthouse turrets
  lastFireTime?: number;
}

// Carrier drone
export interface Drone {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  rotation: number;
  health: number;
  lifetime: number;
  targetId?: string; // Currently targeted ship or neutral
}

// ============================================
// ISLANDS (Static Obstacles)
// ============================================

export interface Island {
  id: string;
  x: number;
  y: number;
  radius: number;  // Used as bounding radius for rough checks
  shape: 'circle' | 'irregular';
  // For irregular shapes, points relative to center (clockwise)
  points?: { x: number; y: number }[];
  // Seed for deterministic visual generation (trees, rocks, etc.)
  seed?: number;
}

// ============================================
// GAME STATE (Server → Client)
// ============================================

export interface GameState {
  timestamp: number;
  ships: Ship[];
  bullets: Bullet[];
  neutrals: NeutralObject[];
  islands: Island[];
  leaderboard: LeaderboardEntry[];
  drones: Drone[];
}

// Leaderboard
export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  level: number;
  shipClass: ShipClass;
}

// ============================================
// PLAYER INPUT (Client → Server)
// ============================================

export interface PlayerInput {
  x: number;
  y: number;
  rotation: number;
  thrust: boolean;
  fire: boolean;
  useAbility: boolean;
}

// ============================================
// SOCKET.IO EVENT TYPES
// ============================================

export interface ClientEvents {
  joinGame: (data: { playerName: string }) => void;
  playerInput: (input: PlayerInput) => void;
  upgradeShipClass: (shipClass: ShipClass) => void;
  upgradeStat: (stat: keyof PlayerStats) => void;
  requestRespawn: () => void;
}

export interface ServerEvents {
  playerId: (id: string) => void;
  worldInit: (data: { islands: Island[] }) => void;
  gameState: (state: GameState) => void;
  playerDied: (data: { killerId: string; victimId: string; killerName: string }) => void;
  deathTimer: (data: { deathTime: number }) => void;
  respawnDenied: (data: { remainingTime: number }) => void;
  levelUp: (data: { newLevel: number; upgradePoints: number; availableShipClasses: ShipClass[] }) => void;
  playerStats: (data: { stats: PlayerStats; upgradePoints: number; xpToNextLevel: number }) => void;
  respawned: (data: { x: number; y: number }) => void;
  killFeed: (data: { killerName: string; victimName: string; weapon: string }) => void;
  damageDealt: (data: { x: number; y: number; damage: number; isCritical: boolean }) => void;
  xpGained: (data: { x: number; y: number; amount: number }) => void;
}

// ============================================
// UPGRADE PATHS
// ============================================

export const SHIP_UPGRADE_PATHS: Record<ShipClass, ShipClass[]> = {
  patrol_boat: ['destroyer', 'cruiser', 'battleship', 'submarine', 'carrier'],
  destroyer: [],
  cruiser: [],
  battleship: [],
  submarine: [],
  carrier: []
};

// Level required to unlock each ship class
export const SHIP_UNLOCK_LEVELS: Record<ShipClass, number> = {
  patrol_boat: 1,  // Starting ship
  destroyer: 2,    // Fast, rapid fire
  cruiser: 4,      // Tanky, balanced
  battleship: 5,   // High damage
  submarine: 6,    // Stealth
  carrier: 7       // Drone support
};

export const SHIP_STATS: Record<ShipClass, {
  maxHealth: number;
  speed: number;
  turnRate: number;
  fireRate: number;
  damage: number;
}> = {
  patrol_boat: { maxHealth: 100, speed: 300, turnRate: 0.05, fireRate: 400, damage: 12 },
  destroyer: { maxHealth: 90, speed: 380, turnRate: 0.065, fireRate: 250, damage: 10 },
  cruiser: { maxHealth: 180, speed: 220, turnRate: 0.035, fireRate: 500, damage: 15 },
  battleship: { maxHealth: 160, speed: 160, turnRate: 0.025, fireRate: 800, damage: 35 },
  submarine: { maxHealth: 80, speed: 280, turnRate: 0.045, fireRate: 1500, damage: 55 },
  carrier: { maxHealth: 140, speed: 200, turnRate: 0.03, fireRate: 600, damage: 8 }
};

// XP required per level (cumulative) - faster early game
export const XP_PER_LEVEL = [
  0,      // Level 1 (start)
  50,     // Level 2 - quick early levels
  150,    // Level 3
  300,    // Level 4
  500,    // Level 5 - ship class unlock
  800,    // Level 6
  1200,   // Level 7
  1700,   // Level 8
  2400,   // Level 9
  3500    // Level 10 (max)
];

export const MAX_LEVEL = 10;
export const UPGRADE_LEVEL_THRESHOLD = 5; // Can upgrade ship class at level 5+

// ============================================
// SHIP ABILITIES
// ============================================

export type AbilityType = 'stealth' | 'shield' | 'boost' | 'drone';

export interface AbilityState {
  type: AbilityType;
  active: boolean;
  cooldownRemaining: number;
  durationRemaining: number;
}

// Ability configuration per ship class
export const SHIP_ABILITIES: Record<ShipClass, {
  ability: AbilityType;
  cooldown: number;  // ms
  duration: number;  // ms
  description: string;
} | null> = {
  patrol_boat: null,
  destroyer: { ability: 'boost', cooldown: 8000, duration: 2000, description: 'Speed boost (2s)' },
  cruiser: { ability: 'shield', cooldown: 15000, duration: 3000, description: 'Damage shield (3s)' },
  battleship: null, // Battleship relies on raw firepower
  submarine: { ability: 'stealth', cooldown: 12000, duration: 4000, description: 'Invisibility (4s)' },
  carrier: { ability: 'drone', cooldown: 10000, duration: 5000, description: 'Deploy drone (5s)' }
};
