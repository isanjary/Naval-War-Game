import { SinglePlayerServer } from '../game/SinglePlayerServer';
import type { PlayerInput, GameState, ShipClass, PlayerStats, Island } from '@shared/types';



export class NetworkManager {
  private server: SinglePlayerServer;
  private connected = true;
  private readonly isDev = import.meta.env.DEV;

  // Callbacks for game state updates
  public onGameState: ((state: GameState) => void) | null = null;
  public onWorldInit: ((data: { islands: Island[] }) => void) | null = null;
  public onPlayerId: ((id: string) => void) | null = null;
  public onPlayerDied: ((data: { killerId: string; victimId: string; killerName: string }) => void) | null = null;
  public onDeathTimer: ((data: { deathTime: number }) => void) | null = null;
  public onRespawnDenied: ((data: { remainingTime: number }) => void) | null = null;
  public onLevelUp: ((data: { newLevel: number; upgradePoints: number; availableShipClasses: ShipClass[] }) => void) | null = null;
  public onPlayerStats: ((data: { stats: PlayerStats; upgradePoints: number; xpToNextLevel: number }) => void) | null = null;
  public onRespawned: ((data: { x: number; y: number }) => void) | null = null;
  public onKillFeed: ((data: { killerName: string; victimName: string; weapon: string }) => void) | null = null;
  public onDamageDealt: ((data: { x: number; y: number; damage: number; isCritical: boolean }) => void) | null = null;
  public onXpGained: ((data: { x: number; y: number; amount: number }) => void) | null = null;

  constructor() {
    this.server = new SinglePlayerServer();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Map local server events to our callbacks
    this.server.on('playerId', (id: string) => {
      if (this.isDev) console.log('Received player ID:', id);
      if (this.onPlayerId) this.onPlayerId(id);
    });

    this.server.on('worldInit', (data: { islands: Island[] }) => {
      if (this.onWorldInit) this.onWorldInit(data);
    });

    this.server.on('gameState', (state: GameState) => {
      if (this.onGameState) this.onGameState(state);
    });

    this.server.on('playerDied', (data: { killerId: string; victimId: string; killerName: string }) => {
      if (this.onPlayerDied) this.onPlayerDied(data);
    });

    this.server.on('deathTimer', (data: { deathTime: number }) => {
      if (this.onDeathTimer) this.onDeathTimer(data);
    });

    this.server.on('levelUp', (data: { newLevel: number; upgradePoints: number; availableShipClasses: ShipClass[] }) => {
      if (this.onLevelUp) this.onLevelUp(data);
    });

    this.server.on('playerStats', (data: { stats: PlayerStats; upgradePoints: number; xpToNextLevel: number }) => {
      if (this.onPlayerStats) this.onPlayerStats(data);
    });

    this.server.on('respawned', (data: { x: number; y: number }) => {
      if (this.onRespawned) this.onRespawned(data);
    });

    this.server.on('killFeed', (data: { killerName: string; victimName: string; weapon: string }) => {
      if (this.onKillFeed) this.onKillFeed(data);
    });

    this.server.on('damageDealt', (data: { x: number; y: number; damage: number; isCritical: boolean }) => {
      if (this.onDamageDealt) this.onDamageDealt(data);
    });

    this.server.on('xpGained', (data: { x: number; y: number; amount: number }) => {
      if (this.onXpGained) this.onXpGained(data);
    });
  }

  public sendInput(input: PlayerInput): void {
    this.server.emitInput(input);
  }

  public joinGame(playerName: string): void {
    this.server.joinGame(playerName);
  }

  public upgradeShipClass(shipClass: ShipClass): void {
    this.server.emitUpgradeShip(shipClass);
  }

  public upgradeStat(stat: keyof PlayerStats): void {
    this.server.emitUpgradeStat(stat);
  }

  public requestRespawn(): void {
    this.server.emitRespawn();
  }

  public disconnect(): void {
    this.server.stop();
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getPlayerId(): string | undefined {
    return this.server.localPlayerId;
  }
}
