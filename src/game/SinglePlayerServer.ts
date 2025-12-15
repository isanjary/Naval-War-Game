import Phaser from 'phaser';
import {
    SHIP_STATS,
    XP_PER_LEVEL,
    MAX_LEVEL,
    DEFAULT_STATS,
    SHIP_UPGRADE_PATHS,
    SHIP_UNLOCK_LEVELS,
    SHIP_ABILITIES,
    MAX_STAT_POINTS,

    type PlayerInput,
    type Ship,
    type Bullet,
    type NeutralObject,
    type NeutralType,
    type ShipClass,
    type PlayerStats,
    type Island,
    type Drone,
    type GameState
} from '@shared/types';

const TICK_RATE = 20; // 20 Hz = 50ms per tick
const TICK_INTERVAL = 1000 / TICK_RATE;

// World constants
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;

// Neutral spawn settings
const MAX_NEUTRALS = 50;
const NEUTRAL_SPAWN_INTERVAL = 2000; // ms

// Cargo ship movement
const CARGO_SPEED = 60; // pixels per second

// Drone settings
const DRONE_SPEED = 280;
const DRONE_DAMAGE = 5;
const DRONE_RANGE = 200;
const DRONE_LIFETIME = 5000;
const SHIP_RADIUS = 25;
const BULLET_RADIUS = 6;
const DRONE_RADIUS = 12;

// Defensive structure settings
const LIGHTHOUSE_RANGE = 500;
const LIGHTHOUSE_DAMAGE = 15;
const LIGHTHOUSE_FIRE_RATE = 2000; // ms

const TANK_RANGE = 400;
const TANK_DAMAGE = 20;
const TANK_FIRE_RATE = 1500; // ms - faster fire rate

interface Player {
    id: string;
    name: string;
    ship: Ship;
    lastInput: PlayerInput;
    spawnProtectionUntil: number; // Timestamp checking for invulnerability
    lastFireTime: number;
    upgradePoints: number;
    isDead: boolean;
    deathTime: number;
    abilityActiveUntil: number;
    abilityCooldownUntil: number;
}



// Leaderboard Persistence
interface ScoreEntry {
    name: string;
    score: number;
    date: string;
}

interface LeaderboardData {
    lastGame: ScoreEntry | null;
    highScores: ScoreEntry[];
}

export class SinglePlayerServer extends Phaser.Events.EventEmitter {
    private players: Map<string, Player> = new Map();
    private bullets: Bullet[] = [];
    private neutrals: NeutralObject[] = [];
    private islands: Island[] = [];
    private drones: Drone[] = [];
    private gameLoopId: number | null = null;
    private lastNeutralSpawn = Date.now();
    private droneIdCounter = 0;
    private bulletIdCounter = 0;
    private neutralIdCounter = 0;

    // Local interaction
    public readonly localPlayerId = 'local-player';

    constructor() {
        super();
        this.generateIslands();
        // Auto-start game loop
        this.start();
    }

    // --- PUBLIC API (MOCKING SOCKET.IO) ---

    public emitInput(input: PlayerInput) {
        this.handlePlayerInput(this.localPlayerId, input);
    }

    public emitUpgradeShip(shipClass: ShipClass) {
        this.handleUpgradeShipClass(this.localPlayerId, shipClass);
    }

    public emitUpgradeStat(stat: keyof PlayerStats) {
        this.handleUpgradeStat(this.localPlayerId, stat);
    }

    public emitRespawn() {
        this.handleRespawn(this.localPlayerId);
    }

    public joinGame(playerName: string) {
        this.handleJoinGame(this.localPlayerId, playerName);
    }

    // --- INTERNAL LOGIC ---

    private generateIslandPoints(baseRadius: number, seed: number): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const numPoints = 12 + Math.floor((seed % 100) / 10);

        const seededRandom = (s: number) => {
            const x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        };

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radiusVariation = 0.6 + seededRandom(seed + i * 137) * 0.5;
            const r = baseRadius * radiusVariation;
            const jaggedness = seededRandom(seed + i * 251) * 0.25;
            const finalR = r * (1 + (i % 3 === 0 ? -jaggedness : jaggedness * 0.5));

            points.push({
                x: Math.cos(angle) * finalR,
                y: Math.sin(angle) * finalR
            });
        }
        return points;
    }

    private generateIslands(): void {
        const islandConfigs = [
            { x: 500, y: 500, radius: 100 },
            { x: 2500, y: 500, radius: 120 },
            { x: 500, y: 2500, radius: 110 },
            { x: 2500, y: 2500, radius: 105 },
            { x: 1500, y: 1500, radius: 150 },
            { x: 1000, y: 800, radius: 75 },
            { x: 2000, y: 800, radius: 85 },
            { x: 800, y: 1800, radius: 80 },
            { x: 2200, y: 2000, radius: 90 },
            { x: 1500, y: 700, radius: 65 },
            { x: 1500, y: 2300, radius: 70 },
            { x: 700, y: 1200, radius: 60 },
            { x: 2300, y: 1200, radius: 65 },
        ];

        this.islands = islandConfigs.map((config, index) => {
            const seed = 12345 + index * 777;
            return {
                id: `island_${index}`,
                x: config.x,
                y: config.y,
                radius: config.radius,
                shape: 'irregular' as const,
                points: this.generateIslandPoints(config.radius, seed),
                seed: seed
            };
        });
    }

    private start() {
        if (import.meta.env.DEV) console.log('SinglePlayerServer started');
        // Use setInterval for game loop to simulate server tick
        this.gameLoopId = window.setInterval(() => {
            this.tick();
        }, TICK_INTERVAL);

        this.spawnInitialNeutrals();
        this.spawnTanks();
    }

    public stop() {
        if (this.gameLoopId) {
            clearInterval(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    private tick() {
        const now = Date.now();
        const fixedDeltaTime = TICK_INTERVAL / 1000;

        if (Date.now() - this.lastNeutralSpawn > NEUTRAL_SPAWN_INTERVAL) {
            this.spawnNeutral();
            this.lastNeutralSpawn = Date.now();
        }

        this.updatePlayers(fixedDeltaTime, now);
        this.updateNeutrals(fixedDeltaTime);
        this.updateDrones(fixedDeltaTime);
        this.updateBullets(fixedDeltaTime);
        this.checkCollisions();
        this.broadcastGameState();
    }

    private broadcastGameState() {
        const state: GameState = {
            timestamp: Date.now(),
            ships: Array.from(this.players.values()).map(p => p.ship),
            bullets: this.bullets,
            neutrals: this.neutrals,
            islands: this.islands,
            drones: this.drones,
            leaderboard: this.getLeaderboard()
        };

        // Emit locally using Phaser events
        this.emit('gameState', state);
    }

    private getLeaderboard() {
        return Array.from(this.players.values())
            .filter(p => !p.isDead) // Only living players on leaderboard? Or all? Server sent living mostly.
            .map(p => ({
                id: p.id,
                name: p.name,
                score: p.ship.score,
                kills: p.ship.kills,
                level: p.ship.level,
                shipClass: p.ship.shipClass
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    private spawnTanks() {
        // Spawn a tank on 50% of islands
        for (const island of this.islands) {
            if (Math.random() < 0.5) {
                this.neutrals.push({
                    id: `neutral-${this.neutralIdCounter++}`,
                    x: island.x,
                    y: island.y,
                    type: 'tank',
                    health: 120,
                    maxHealth: 120,
                    xpValue: 250, // High reward for defeating tanks
                    rotation: Math.random() * Math.PI * 2,
                    velocityX: 0,
                    velocityY: 0,
                    lastFireTime: 0
                });
            }
        }
    }

    private handleJoinGame(playerId: string, playerName: string) {
        const spawnX = Math.random() * 2000 + 500;
        const spawnY = Math.random() * 2000 + 500;
        const baseStats = SHIP_STATS['patrol_boat'];

        const player: Player = {
            id: playerId,
            name: playerName || 'Player',
            ship: {
                id: playerId,
                x: spawnX,
                y: spawnY,
                rotation: 0,
                velocityX: 0,
                velocityY: 0,
                health: baseStats.maxHealth,
                maxHealth: baseStats.maxHealth,
                level: 1,
                xp: 0,
                shipClass: 'patrol_boat',
                kills: 0,
                score: 0,
                stats: { ...DEFAULT_STATS },
                abilityActive: false,
                abilityCooldown: 0,
                isStealthed: false,
                isShielded: false
            },
            lastInput: { x: spawnX, y: spawnY, rotation: 0, thrust: false, fire: false, useAbility: false },
            lastFireTime: 0,
            upgradePoints: 0,
            isDead: false,
            deathTime: 0,
            abilityActiveUntil: 0,
            abilityCooldownUntil: 0,
            spawnProtectionUntil: Date.now() + 3000 // 3 seconds immunity on join
        };

        // Attempt to load from localStorage
        this.loadPlayerState(player);

        this.players.set(playerId, player);

        this.emit('playerId', playerId);
        this.emit('worldInit', { islands: this.islands });
        this.sendStats(player);
    }

    private sendStats(player: Player) {
        this.emit('playerStats', {
            stats: player.ship.stats,
            upgradePoints: player.upgradePoints,
            xpToNextLevel: this.getXPToNextLevel(player.ship.level)
        });
    }

    private savePlayerState(player: Player) {
        if (player.id !== this.localPlayerId) return;
        const state = {
            score: player.ship.score,
            level: player.ship.level,
            xp: player.ship.xp,
            shipClass: player.ship.shipClass,
            stats: player.ship.stats,
            upgradePoints: player.upgradePoints
        };
        localStorage.setItem('navalwar_save', JSON.stringify(state));
    }

    // private saveGameResult(player: Player) { ... } unused - handled by savePlayerState



    private loadPlayerState(player: Player) {
        try {
            const saved = localStorage.getItem('navalwar_save');
            if (saved) {
                const state = JSON.parse(saved);
                player.ship.score = state.score || 0;
                player.ship.level = state.level || 1;
                player.ship.xp = state.xp || 0;
                player.ship.shipClass = state.shipClass || 'patrol_boat';
                player.ship.stats = state.stats || { ...DEFAULT_STATS };
                player.upgradePoints = state.upgradePoints || 0;

                // Recalculate health based on loaded stats
                this.recalculateShipStats(player);
                player.ship.health = player.ship.maxHealth;
            }
        } catch (e) {
            console.warn('Failed to load save', e);
        }
    }

    private handlePlayerInput(playerId: string, input: PlayerInput) {
        const player = this.players.get(playerId);
        if (player) {
            player.lastInput = input;
        }
    }

    private spawnBullet(player: Player) {
        const stats = SHIP_STATS[player.ship.shipClass];
        const angle = player.ship.rotation;
        const speed = 600;

        // Offset spawn point to front of ship
        const spawnX = player.ship.x + Math.cos(angle) * 30;
        const spawnY = player.ship.y + Math.sin(angle) * 30;

        // Slight spread for some weapons could be added here

        this.bullets.push({
            id: `bullet-${this.bulletIdCounter++}`,
            ownerId: player.id,
            x: spawnX,
            y: spawnY,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            damage: stats.damage + (player.ship.stats.damageBonus * 2), // Damage bonus
            lifetime: 2000, // 2s lifetime
            type: 'cannon', // TODO: vary by class
            ignoreTerrain: true // Allow bullets to pass through islands to hit tanks
        });
    }

    // ... (Port remaining methods: updatePlayers, updateBullets, updateNeutrals, checkCollisions, etc.)
    // I will fill these in via a separate tool call to ensure they are complete, 
    // or I can try to fit them all here if I am careful. 

    // For brevity and to avoid cutting off, I will port the ESSENTIAL physics first
    // and then use a MultiReplace to add the rest if needed, or just write a big file.
    // Given the file size, I should try to include as much as possible.

    private updatePlayers(dt: number, now: number) {
        for (const player of this.players.values()) {
            if (player.isDead) continue;

            const { ship, lastInput } = player;
            const shipStats = SHIP_STATS[ship.shipClass];

            // Apply speed boost if active (Destroyer ability)
            const speedMultiplier = ship.abilityActive && SHIP_ABILITIES[ship.shipClass]?.ability === 'boost' ? 1.5 : 1;
            const speed = (shipStats.speed + (ship.stats.speedBonus * 20)) * speedMultiplier * (lastInput.thrust ? 1 : 0);

            const prevX = ship.x;
            const prevY = ship.y;

            // Rotation
            ship.rotation = lastInput.rotation;

            // Client authoritative pos if provided (local player)
            // Actually for single player, we trust the input x/y if we want strict client auth,
            // BUT since WE ARE the "server" now, we should probably run the physics ourselves 
            // based on thrust/rotation to avoid "teleporting" if the update loop desyncs slightly.
            // However, to keep it smooth and consistent with the "Client sends Input" model:
            // We'll trust the input X/Y from the "client scenes" for now if valid, OR calculate it.
            // Actually, in single player, GameScene calculates position for smooth rendering.
            // So we can accept it, but we must validate collisions.

            if (lastInput.x !== undefined && lastInput.y !== undefined) {
                ship.x = lastInput.x;
                ship.y = lastInput.y;
            } else {
                // Fallback / Bot logic
                ship.velocityX = Math.cos(ship.rotation) * speed;
                ship.velocityY = Math.sin(ship.rotation) * speed;
                ship.x += ship.velocityX * dt;
                ship.y += ship.velocityY * dt;
            }

            // World bounds
            ship.x = Math.max(30, Math.min(WORLD_WIDTH - 30, ship.x));
            ship.y = Math.max(30, Math.min(WORLD_HEIGHT - 30, ship.y));

            // Island collisions (prevent tunneling)
            for (const island of this.islands) {
                const swept = this.clampEntityOutsideIslandAlongSegment(prevX, prevY, ship.x, ship.y, SHIP_RADIUS, island);
                ship.x = swept.x;
                ship.y = swept.y;
            }

            // Fire
            const fireCooldown = Math.max(100, shipStats.fireRate - (ship.stats.reloadBonus * 50));
            if (lastInput.fire && now - player.lastFireTime > fireCooldown) {
                this.spawnBullet(player);
                player.lastFireTime = now;
            }

            // Abilities
            this.updateAbility(player, now, lastInput);
        }
    }

    private updateAbility(player: Player, now: number, lastInput: PlayerInput) {
        const { ship } = player;
        const abilityConfig = SHIP_ABILITIES[ship.shipClass];
        if (!abilityConfig) return;

        ship.abilityCooldown = Math.max(0, player.abilityCooldownUntil - now);

        if (player.abilityActiveUntil > 0 && now >= player.abilityActiveUntil) {
            ship.abilityActive = false;
            ship.isStealthed = false;
            ship.isShielded = false;
            player.abilityActiveUntil = 0;
        }

        if (lastInput.useAbility && now >= player.abilityCooldownUntil && !ship.abilityActive) {
            ship.abilityActive = true;
            player.abilityActiveUntil = now + abilityConfig.duration;
            player.abilityCooldownUntil = now + abilityConfig.cooldown;

            switch (abilityConfig.ability) {
                case 'stealth': ship.isStealthed = true; break;
                case 'shield': ship.isShielded = true; break;
                case 'drone': this.spawnDrone(player); break;
                case 'boost': /* Speed boost applied in updatePlayers */ break;
            }
        }
    }

    private spawnDrone(player: Player) {
        this.drones.push({
            id: `drone-${this.droneIdCounter++}`,
            ownerId: player.id,
            x: player.ship.x,
            y: player.ship.y,
            rotation: player.ship.rotation,
            health: 30,
            lifetime: DRONE_LIFETIME
        });
    }

    private updateBullets(dt: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.velocityX * dt;
            b.y += b.velocityY * dt;
            b.lifetime -= dt * 1000;

            // Remove if expired or out of bounds
            if (b.lifetime <= 0 || b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Island collision for bullets
            if (!b.ignoreTerrain) {
                for (const island of this.islands) {
                    const expanded = island.radius + BULLET_RADIUS;
                    const hitT = this.getFirstSegmentCircleHitT(b.x - b.velocityX * dt, b.y - b.velocityY * dt, b.x, b.y, island.x, island.y, expanded);
                    if (hitT !== null || this.isPointInIsland(b.x, b.y, island)) {
                        this.bullets.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    private updateNeutrals(dt: number) {
        for (const n of this.neutrals) {
            if (n.type === 'cargo' && n.rotation !== undefined && n.velocityX !== undefined && n.velocityY !== undefined) {
                // Basic movement
                const prevX = n.x;
                const prevY = n.y;

                n.x += n.velocityX * dt;
                n.y += n.velocityY * dt;

                // Bounce at world bounds
                if (n.x < 50 || n.x > WORLD_WIDTH - 50) {
                    n.x = Phaser.Math.Clamp(n.x, 50, WORLD_WIDTH - 50);
                    n.rotation = Math.PI - n.rotation;
                    n.velocityX = Math.cos(n.rotation) * CARGO_SPEED;
                }
                if (n.y < 50 || n.y > WORLD_HEIGHT - 50) {
                    n.y = Phaser.Math.Clamp(n.y, 50, WORLD_HEIGHT - 50);
                    n.rotation = -n.rotation;
                    n.velocityY = Math.sin(n.rotation) * CARGO_SPEED;
                }

                // Island collision for Cargo ships
                for (const island of this.islands) {
                    const neutralRadius = 30; // Approx cargo radius
                    const swept = this.clampEntityOutsideIslandAlongSegment(prevX, prevY, n.x, n.y, neutralRadius, island);
                    if (swept.x !== n.x || swept.y !== n.y) {
                        // Collision happened - bounce/slide
                        n.x = swept.x;
                        n.y = swept.y;
                        // Simple bounce: reverse direction or random new direction
                        n.rotation += Math.PI + (Math.random() * 0.5 - 0.25);
                        n.velocityX = Math.cos(n.rotation) * CARGO_SPEED;
                        n.velocityY = Math.sin(n.rotation) * CARGO_SPEED;
                    }
                }
            }

            // Defensive structures shooting logic
            if (n.type === 'lighthouse' || n.type === 'tank') {
                const now = Date.now();
                const fireRate = n.type === 'lighthouse' ? LIGHTHOUSE_FIRE_RATE : TANK_FIRE_RATE;
                const range = n.type === 'lighthouse' ? LIGHTHOUSE_RANGE : TANK_RANGE;

                // Initialize lastFireTime if 0 (spawn) to prevent immediate mass fire on load if using saved timestamp? 
                // Actually initial 0 means they can fire immediately. That is fine.
                // Issue might be they are not finding targets.
                // Debug log:
                // if (Math.random() < 0.01) console.log('Tank check', n.id, now, n.lastFireTime);

                if (!n.lastFireTime || now - n.lastFireTime > fireRate) {
                    // Find nearest player
                    let target: Player | null = null;
                    let minDist = range;

                    for (const p of this.players.values()) {
                        if (p.isDead || p.ship.isStealthed) continue;
                        // Ignore players with active spawn protection
                        if (now < p.spawnProtectionUntil) continue;

                        // Tanks target ALL ships now

                        const dist = Phaser.Math.Distance.Between(n.x, n.y, p.ship.x, p.ship.y);
                        if (dist < minDist) {
                            minDist = dist;
                            target = p;
                        }
                    }

                    if (target) {
                        // Rotate tank towards target
                        if (n.type === 'tank') {
                            n.rotation = Phaser.Math.Angle.Between(n.x, n.y, target.ship.x, target.ship.y);
                        }
                        this.spawnNeutralBullet(n, target);
                        n.lastFireTime = now;
                    }
                }
            }
        }
    }

    private spawnNeutralBullet(source: NeutralObject, target: Player) {
        const speed = 400;
        const angle = Phaser.Math.Angle.Between(source.x, source.y, target.ship.x, target.ship.y);
        const damage = source.type === 'lighthouse' ? LIGHTHOUSE_DAMAGE : TANK_DAMAGE;

        // Offset for visual accuracy (Tank barrel is approx 30-40px)
        const offset = source.type === 'tank' ? 40 : 50;

        this.bullets.push({
            id: `bullet-${this.bulletIdCounter++}`,
            ownerId: source.id, // Neutral ID as owner
            x: source.x + Math.cos(angle) * offset,
            y: source.y + Math.sin(angle) * offset,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            damage: damage,
            lifetime: 3000,
            type: 'cannon',
            ignoreTerrain: source.type === 'tank' // Tanks on islands shoot through them
        });
    }

    private updateDrones(dt: number) {
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const d = this.drones[i];
            d.lifetime -= dt * 1000;
            if (d.lifetime <= 0) {
                this.drones.splice(i, 1);
                continue;
            }

            // Simple homing logic for drones (find nearest enemy/neutral)
            let target: NeutralObject | undefined;
            let minDist = 9999;

            // Just attack neutrals for now in single player
            for (const n of this.neutrals) {
                const dist = Phaser.Math.Distance.Between(d.x, d.y, n.x, n.y);
                if (dist < DRONE_RANGE && dist < minDist) {
                    minDist = dist;
                    target = n;
                }
            }

            if (target) {
                const angle = Phaser.Math.Angle.Between(d.x, d.y, target.x, target.y);
                d.rotation = angle;
                const vx = Math.cos(angle) * DRONE_SPEED;
                const vy = Math.sin(angle) * DRONE_SPEED;
                d.x += vx * dt;
                d.y += vy * dt;

                if (minDist < 20) {
                    // Hit
                    this.damageNeutral(target, DRONE_DAMAGE, 'drone');
                    this.drones.splice(i, 1);
                    continue;
                }
            } else {
                // Orbit owner? or just move forward
                d.x += Math.cos(d.rotation) * DRONE_SPEED * dt;
                d.y += Math.sin(d.rotation) * DRONE_SPEED * dt;
            }
        }
    }

    private checkCollisions(): void {
        const livingPlayers: Player[] = [];
        for (const p of this.players.values()) {
            if (!p.isDead) livingPlayers.push(p);
        }
        const shipGrid = new SpatialHashGrid<Player>(140);
        for (const p of livingPlayers) shipGrid.insert(p.ship.x, p.ship.y, p);

        const neutralGrid = new SpatialHashGrid<NeutralObject>(140);
        for (const n of this.neutrals) neutralGrid.insert(n.x, n.y, n);

        const bulletsToRemove = new Set<string>();
        const neutralsToRemove = new Set<string>();

        // Bullet vs Ship
        this.checkBulletShipCollisions(shipGrid, bulletsToRemove);

        // Bullet vs Neutral
        this.checkBulletNeutralCollisions(neutralGrid, bulletsToRemove, neutralsToRemove);

        // Ship vs Ship
        this.checkShipShipCollisions(livingPlayers, shipGrid);

        // Drone vs Enemy/Neutral
        this.checkDroneCollisions(shipGrid, neutralGrid, neutralsToRemove);

        // Apply removals
        if (bulletsToRemove.size > 0) {
            let writeIndex = 0;
            for (let i = 0; i < this.bullets.length; i++) {
                const b = this.bullets[i];
                if (!bulletsToRemove.has(b.id)) this.bullets[writeIndex++] = b;
            }
            this.bullets.length = writeIndex;
        }

        if (neutralsToRemove.size > 0) {
            let writeIndex = 0;
            for (let i = 0; i < this.neutrals.length; i++) {
                const n = this.neutrals[i];
                if (!neutralsToRemove.has(n.id)) this.neutrals[writeIndex++] = n;
            }
            this.neutrals.length = writeIndex;
        }
    }

    private checkBulletShipCollisions(shipGrid: SpatialHashGrid<Player>, bulletsToRemove: Set<string>): void {
        const hitDistance = SHIP_RADIUS + BULLET_RADIUS;
        const hitDistanceSq = hitDistance * hitDistance;
        const candidates: Player[] = [];

        for (const bullet of this.bullets) {
            if (bulletsToRemove.has(bullet.id)) continue;

            shipGrid.queryInto(bullet.x, bullet.y, hitDistance, candidates);
            for (const player of candidates) {
                if (bullet.ownerId === player.id) continue;
                if (player.isDead) continue;
                if (player.ship.isStealthed) continue;
                // Bullets pass harmlessly through protected players
                if (Date.now() < player.spawnProtectionUntil) continue;

                const dx = bullet.x - player.ship.x;
                const dy = bullet.y - player.ship.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < hitDistanceSq) {
                    bulletsToRemove.add(bullet.id);

                    if (player.ship.isShielded) {
                        this.emit('damageDealt', { x: player.ship.x, y: player.ship.y, damage: 0, isCritical: false });
                        continue;
                    }

                    player.ship.health -= bullet.damage;
                    this.emit('damageDealt', {
                        x: player.ship.x,
                        y: player.ship.y,
                        damage: bullet.damage,
                        isCritical: bullet.damage >= 30
                    });

                    if (player.ship.health <= 0) {
                        this.handlePlayerDeath(player, bullet.ownerId, bullet.type);
                    }
                    break;
                }
            }
        }
    }

    private checkBulletNeutralCollisions(
        neutralGrid: SpatialHashGrid<NeutralObject>,
        bulletsToRemove: Set<string>,
        neutralsToRemove: Set<string>
    ): void {
        const maxNeutralRadius = 30;
        const queryRange = BULLET_RADIUS + maxNeutralRadius;
        const candidates: NeutralObject[] = [];

        for (const bullet of this.bullets) {
            if (bulletsToRemove.has(bullet.id)) continue;

            neutralGrid.queryInto(bullet.x, bullet.y, queryRange, candidates);
            for (const neutral of candidates) {
                // Determine radius
                let neutralRadius = 30;
                switch (neutral.type) {
                    case 'buoy': neutralRadius = 15; break;
                    case 'cargo': neutralRadius = 30; break;
                    case 'lighthouse': neutralRadius = 25; break;
                    case 'tank': neutralRadius = 20; break;
                }

                if (bullet.ownerId === neutral.id) continue;
                // Prevent neutrals (Tanks/Lighthouses) from damaging other neutrals (Cargo/Buoys)
                // Only players should be able to destroy neutrals
                if (!this.players.has(bullet.ownerId)) continue;

                const hitDistance = neutralRadius + BULLET_RADIUS;
                const hitDistanceSq = hitDistance * hitDistance;

                const dx = bullet.x - neutral.x;
                const dy = bullet.y - neutral.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < hitDistanceSq) {
                    neutral.health -= bullet.damage;
                    bulletsToRemove.add(bullet.id);

                    if (neutral.health <= 0) {
                        neutralsToRemove.add(neutral.id);
                        const shooter = this.players.get(bullet.ownerId);
                        if (shooter) {
                            this.awardXP(shooter, neutral.xpValue);
                            this.emit('xpGained', { x: neutral.x, y: neutral.y, amount: neutral.xpValue });
                        }
                    }
                    break;
                }
            }
        }
    }

    private checkShipShipCollisions(livingPlayers: Player[], shipGrid: SpatialHashGrid<Player>): void {
        const hitDistance = SHIP_RADIUS * 2;
        const hitDistanceSq = hitDistance * hitDistance;
        const candidates: Player[] = [];
        const playerIndex = new Map<string, number>();
        for (let i = 0; i < livingPlayers.length; i++) playerIndex.set(livingPlayers[i].id, i);

        for (let i = 0; i < livingPlayers.length; i++) {
            const p1 = livingPlayers[i];
            shipGrid.queryInto(p1.ship.x, p1.ship.y, hitDistance, candidates);

            for (const p2 of candidates) {
                const j = playerIndex.get(p2.id);
                if (j === undefined || j <= i) continue;

                const dx = p2.ship.x - p1.ship.x;
                const dy = p2.ship.y - p1.ship.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < hitDistanceSq && distanceSq > 1e-9) {
                    const distance = Math.sqrt(distanceSq);
                    const overlap = (hitDistance - distance) / 2;
                    const nx = dx / distance;
                    const ny = dy / distance;

                    p1.ship.x -= nx * overlap;
                    p1.ship.y -= ny * overlap;
                    p2.ship.x += nx * overlap;
                    p2.ship.y += ny * overlap;

                    p1.ship.health -= 1;
                    p2.ship.health -= 1;

                    if (p1.ship.health <= 0 && !p1.isDead) this.handlePlayerDeath(p1, p2.id, 'collision');
                    if (p2.ship.health <= 0 && !p2.isDead) this.handlePlayerDeath(p2, p1.id, 'collision');
                }
            }
        }
    }

    private checkDroneCollisions(
        shipGrid: SpatialHashGrid<Player>,
        neutralGrid: SpatialHashGrid<NeutralObject>,
        neutralsToRemove: Set<string>
    ): void {
        const shipHitDistance = DRONE_RADIUS + SHIP_RADIUS;
        const shipHitDistanceSq = shipHitDistance * shipHitDistance;
        const maxNeutralRadius = 30;
        const neutralQueryRange = DRONE_RADIUS + maxNeutralRadius;

        const shipCandidates: Player[] = [];
        const neutralCandidates: NeutralObject[] = [];

        for (const drone of this.drones) {
            const owner = this.players.get(drone.ownerId);
            if (!owner) continue;

            // Drone vs Ships
            shipGrid.queryInto(drone.x, drone.y, shipHitDistance, shipCandidates);
            for (const player of shipCandidates) {
                if (player.id === drone.ownerId || player.isDead) continue;
                if (player.ship.isStealthed) continue;
                // Drones ignore protected players
                if (Date.now() < player.spawnProtectionUntil) continue;

                const dx = drone.x - player.ship.x;
                const dy = drone.y - player.ship.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < shipHitDistanceSq && distanceSq > 1e-9) {
                    if (!player.ship.isShielded) {
                        player.ship.health -= DRONE_DAMAGE;
                        this.emit('damageDealt', { x: player.ship.x, y: player.ship.y, damage: DRONE_DAMAGE, isCritical: false });
                        if (player.ship.health <= 0) {
                            this.handlePlayerDeath(player, drone.ownerId, 'drone');
                        }
                    }
                    const distance = Math.sqrt(distanceSq);
                    drone.x += (dx / distance) * 30;
                    drone.y += (dy / distance) * 30;
                }
            }

            // Drone vs Neutrals
            neutralGrid.queryInto(drone.x, drone.y, neutralQueryRange, neutralCandidates);
            for (const neutral of neutralCandidates) {
                if (neutralsToRemove.has(neutral.id)) continue;
                const neutralRadius = this.getNeutralRadius(neutral.type);
                const hitDistance = DRONE_RADIUS + neutralRadius;
                const hitDistanceSq = hitDistance * hitDistance;

                const dx = drone.x - neutral.x;
                const dy = drone.y - neutral.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq < hitDistanceSq) {
                    neutral.health -= DRONE_DAMAGE;
                    if (neutral.health <= 0) {
                        neutralsToRemove.add(neutral.id);
                        this.awardXP(owner, neutral.xpValue);
                        this.emit('xpGained', { x: neutral.x, y: neutral.y, amount: neutral.xpValue });
                    }
                }
            }
        }
    }

    private handlePlayerDeath(player: Player, killerId: string, weaponType: string) {
        if (player.isDead) return;

        // Save progress to leaderboard before death logic (for local player)
        if (player.id === this.localPlayerId) {
            this.saveGameResult(player);
            // Clear active game save so new games start fresh
            localStorage.removeItem('navalwar_save');
        }

        player.ship.health = 0;
        player.isDead = true;
        player.deathTime = Date.now();

        let killerName = 'Unknown';
        let killerWeapon = weaponType;

        const killer = this.players.get(killerId);
        if (killer) {
            killerName = killer.name;
            killerWeapon = killer.ship.shipClass;
            killer.ship.kills++;
            killer.ship.score += 100 + (player.ship.level * 10);
            this.awardXP(killer, 100 + (player.ship.level * 20));
        } else {
            // Check if killer is a neutral object (e.g., tank, lighthouse)
            const killerNeutral = this.neutrals.find(n => n.id === killerId);
            if (killerNeutral) {
                killerName = killerNeutral.type === 'tank' ? 'Island Tank' :
                    killerNeutral.type === 'lighthouse' ? 'Defense Tower' : 'Enemy';
                killerWeapon = killerNeutral.type;
            }
        }

        this.emit('playerDied', { killerId, victimId: player.id, killerName });
        this.emit('deathTimer', { deathTime: player.deathTime });
        this.emit('killFeed', { killerName, victimName: player.name, weapon: killerWeapon });
    }

    private saveGameResult(player: Player) {
        try {
            const entry: ScoreEntry = {
                name: player.name,
                score: player.ship.score,
                date: new Date().toISOString()
            };

            // Load existing
            let data: LeaderboardData = { lastGame: null, highScores: [] };
            const saved = localStorage.getItem('navalwar_leaderboard');
            if (saved) {
                data = JSON.parse(saved);
            }

            // Update last game
            data.lastGame = entry;

            // Update high scores
            data.highScores.push(entry);
            data.highScores.sort((a, b) => b.score - a.score);
            data.highScores = data.highScores.slice(0, 10);

            localStorage.setItem('navalwar_leaderboard', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save leaderboard', e);
        }
    }

    private getNeutralRadius(type: NeutralType): number {
        switch (type) {
            case 'buoy': return 15;
            case 'cargo': return 30;
            case 'lighthouse': return 25;
            case 'tank': return 20;
        }
    }

    private getFirstSegmentCircleHitT(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): number | null {
        const dx = bx - ax;
        const dy = by - ay;
        const a = dx * dx + dy * dy;
        if (a <= 1e-9) return null;
        const fx = ax - cx;
        const fy = ay - cy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return null;
        const sqrtDisc = Math.sqrt(disc);
        const inv2a = 1 / (2 * a);
        const t1 = (-b - sqrtDisc) * inv2a;
        const t2 = (-b + sqrtDisc) * inv2a;
        if (t1 >= 0 && t1 <= 1) return t1;
        if (t2 >= 0 && t2 <= 1) return t2;
        return null;
    }

    private isPointInIsland(px: number, py: number, island: Island): boolean {
        const dx = px - island.x;
        const dy = py - island.y;
        return (dx * dx + dy * dy) < (island.radius * island.radius);
    }

    private clampEntityOutsideIslandAlongSegment(
        prevX: number,
        prevY: number,
        nextX: number,
        nextY: number,
        entityRadius: number,
        island: Island
    ): { x: number; y: number } {
        const expanded = island.radius + entityRadius;
        const endDx = nextX - island.x;
        const endDy = nextY - island.y;
        const endDistSq = endDx * endDx + endDy * endDy;

        if (endDistSq < expanded * expanded) {
            const endDist = Math.sqrt(endDistSq);
            const epsilon = 0.01;
            if (endDist > 1e-6) {
                return {
                    x: island.x + (endDx / endDist) * (expanded + epsilon),
                    y: island.y + (endDy / endDist) * (expanded + epsilon)
                };
            }
            const mvx = nextX - prevX;
            const mvy = nextY - prevY;
            const mvLen = Math.sqrt(mvx * mvx + mvy * mvy) || 1;
            return {
                x: island.x + (mvx / mvLen) * (expanded + epsilon),
                y: island.y + (mvy / mvLen) * (expanded + epsilon)
            };
        }

        const t = this.getFirstSegmentCircleHitT(prevX, prevY, nextX, nextY, island.x, island.y, expanded);
        if (t === null) return { x: nextX, y: nextY };

        const hitX = prevX + (nextX - prevX) * t;
        const hitY = prevY + (nextY - prevY) * t;
        const nx = hitX - island.x;
        const ny = hitY - island.y;
        const len = Math.sqrt(nx * nx + ny * ny) || 1;
        const epsilon = 0.01;

        return {
            x: island.x + (nx / len) * (expanded + epsilon),
            y: island.y + (ny / len) * (expanded + epsilon)
        };
    }

    private damageNeutral(n: NeutralObject, damage: number, attackerId: string) {
        n.health -= damage;
        // Show damage number
        this.emit('damageDealt', { x: n.x, y: n.y, damage, isCritical: false });

        if (n.health <= 0) {
            // Destroy
            const idx = this.neutrals.indexOf(n);
            if (idx !== -1) this.neutrals.splice(idx, 1);

            // Award XP
            const player = this.players.get(attackerId);
            if (player) {
                this.awardXP(player, n.xpValue);
                this.emit('xpGained', { x: n.x, y: n.y, amount: n.xpValue });
            }
        }
    }

    private awardXP(player: Player, amount: number) {
        player.ship.xp += amount;
        player.ship.score += amount * 10;

        const xpNeeded = this.getXPToNextLevel(player.ship.level);
        if (player.ship.xp >= xpNeeded && player.ship.level < MAX_LEVEL) {
            player.ship.level++;
            player.ship.xp -= xpNeeded;
            player.upgradePoints++;
            player.ship.health = player.ship.maxHealth; // Heal on level up

            // Filter ships by unlock level
            const allPossible = SHIP_UPGRADE_PATHS[player.ship.shipClass];
            const availableShipClasses = allPossible.filter(
                shipClass => player.ship.level >= SHIP_UNLOCK_LEVELS[shipClass]
            );

            this.emit('levelUp', {
                newLevel: player.ship.level,
                upgradePoints: player.upgradePoints,
                availableShipClasses
            });
        }

        this.sendStats(player);
        this.savePlayerState(player);
    }

    private getXPToNextLevel(level: number): number {
        if (level >= MAX_LEVEL) return 999999;
        return XP_PER_LEVEL[level] || 9999;
    }

    private spawnInitialNeutrals() {
        for (let i = 0; i < 30; i++) this.spawnNeutral();
    }

    private spawnNeutral() {
        if (this.neutrals.length >= MAX_NEUTRALS) return;
        const rand = Math.random();
        let type: NeutralType = rand < 0.6 ? 'buoy' : rand < 0.9 ? 'cargo' : 'lighthouse';
        let health = type === 'buoy' ? 25 : type === 'cargo' ? 60 : 120;
        let xp = type === 'buoy' ? 8 : type === 'cargo' ? 25 : 60;

        let valid = false;
        let x = 0, y = 0;
        let attempts = 0;
        while (!valid && attempts < 20) {
            x = Math.random() * (WORLD_WIDTH - 200) + 100;
            y = Math.random() * (WORLD_HEIGHT - 200) + 100;
            valid = true;
            for (const isl of this.islands) {
                if (Phaser.Math.Distance.Between(x, y, isl.x, isl.y) < isl.radius + 80) valid = false;
            }
            attempts++;
        }

        if (valid) {
            const rotation = type === 'cargo' ? Math.random() * Math.PI * 2 : 0;
            const velocityX = type === 'cargo' ? Math.cos(rotation) * CARGO_SPEED : 0;
            const velocityY = type === 'cargo' ? Math.sin(rotation) * CARGO_SPEED : 0;

            this.neutrals.push({
                id: `${type}-${this.neutralIdCounter++}`,
                x, y, type, health, maxHealth: health, xpValue: xp,
                rotation,
                velocityX,
                velocityY
            });
        }
    }

    // Handle other upgrades
    private handleUpgradeShipClass(playerId: string, shipClass: ShipClass) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Check if player has reached the required level for this ship
        if (player.ship.level < SHIP_UNLOCK_LEVELS[shipClass]) return;

        const playerStats = SHIP_STATS[shipClass];
        player.ship.shipClass = shipClass;
        player.ship.maxHealth = playerStats.maxHealth + (player.ship.stats.healthBonus * 10);
        player.ship.health = player.ship.maxHealth;

        this.sendStats(player);
        this.savePlayerState(player);
    }

    private handleUpgradeStat(playerId: string, stat: keyof PlayerStats) {
        const player = this.players.get(playerId);
        if (!player || player.upgradePoints <= 0) return;
        if (player.ship.stats[stat] >= MAX_STAT_POINTS) return;

        player.ship.stats[stat]++;
        player.upgradePoints--;

        this.recalculateShipStats(player);
        this.sendStats(player);
        this.savePlayerState(player);
    }

    private recalculateShipStats(player: Player) {
        const base = SHIP_STATS[player.ship.shipClass];
        const oldMax = player.ship.maxHealth;
        player.ship.maxHealth = base.maxHealth + (player.ship.stats.healthBonus * 10);
        if (oldMax > 0) {
            const ratio = player.ship.health / oldMax;
            player.ship.health = Math.round(ratio * player.ship.maxHealth);
        }
    }

    private handleRespawn(playerId: string) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Reset player progress on death (Roguelite style)
        player.isDead = false;
        player.ship.score = 0;
        player.ship.level = 1;
        player.ship.xp = 0;
        player.ship.shipClass = 'patrol_boat';
        player.ship.stats = { ...DEFAULT_STATS };
        player.upgradePoints = 0;
        player.ship.kills = 0;

        // Reset Health & Position
        const baseStats = SHIP_STATS['patrol_boat'];
        player.ship.maxHealth = baseStats.maxHealth;
        player.ship.health = player.ship.maxHealth;
        player.ship.x = Math.random() * 2000 + 500;
        player.ship.y = Math.random() * 2000 + 500;
        player.ship.rotation = 0;

        // Grant 3 seconds of immunity
        player.spawnProtectionUntil = Date.now() + 3000;

        // Save the reset state so reloading the page doesn't bring back old score
        this.savePlayerState(player);

        this.emit('respawned', { x: player.ship.x, y: player.ship.y });
        // Emit initial stats again to update client UI
        this.sendStats(player);
    }
}


class SpatialHashGrid<T> {
    private readonly cellSize: number;
    private readonly buckets = new Map<number, T[]>();

    constructor(cellSize: number) {
        this.cellSize = Math.max(1, cellSize);
    }

    private key(cx: number, cy: number): number {
        return ((((cx & 0xffff) << 16) | (cy & 0xffff)) >>> 0);
    }

    insert(x: number, y: number, value: T): void {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const key = this.key(cx, cy);
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(value);
        else this.buckets.set(key, [value]);
    }

    queryInto(x: number, y: number, range: number, out: T[]): void {
        out.length = 0;
        const r = Math.max(0, range);
        const minCx = Math.floor((x - r) / this.cellSize);
        const maxCx = Math.floor((x + r) / this.cellSize);
        const minCy = Math.floor((y - r) / this.cellSize);
        const maxCy = Math.floor((y + r) / this.cellSize);

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const bucket = this.buckets.get(this.key(cx, cy));
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
            }
        }
    }
}
