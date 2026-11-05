import { randomUUID } from "node:crypto";

export interface Player {
  /** Clé unique : `address:port` du socket UDP du joueur. */
  key: string;
  id: string;
  /** Identifiant numérique compact (uint16) utilisé dans le protocole binaire. */
  numId: number;
  address: string;
  port: number;
  truckId: string;
  /** Pseudo FreightMP (si authentifié via jeton MP). */
  username?: string;
  /** Rôle FreightMP (ADMIN, DRIVER…). */
  role?: string;
  /** Tag de la VTC du joueur (ex. FIC), si connu. */
  tag?: string;
  /** Code pays ISO (ex. FR), si connu. */
  country?: string;
  /** Latence mesurée par le client (ms). */
  latencyMs?: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  lastSeen: number;
  lastSeq: number;
}

export interface Room {
  id: string;
  name: string;
  game: "ETS2" | "ATS";
  maxPlayers: number;
  players: Map<string, Player>;
  tick: number;
  nextNumId: number;
  createdAt: number;
  /** Météo partagée : clear | rain | snow | fog. */
  weather: string;
  /** Heure du jour partagée (minutes depuis minuit). */
  timeOfDay: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  game: "ETS2" | "ATS";
  maxPlayers: number;
  playerCount: number;
  createdAt: number;
}

function newRoom(input: {
  name: string;
  game?: "ETS2" | "ATS";
  maxPlayers?: number;
}): Room {
  return {
    id: randomUUID(),
    name: input.name,
    game: input.game ?? "ETS2",
    maxPlayers: input.maxPlayers ?? 100,
    players: new Map(),
    tick: 0,
    nextNumId: 1,
    createdAt: Date.now(),
    weather: "clear",
    timeOfDay: 12 * 60,
  };
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor() {
    const room = newRoom({ name: "FMP EU #1", game: "ETS2", maxPlayers: 100 });
    this.rooms.set(room.id, room);
  }

  all(): Room[] {
    return Array.from(this.rooms.values());
  }

  summaries(): RoomSummary[] {
    return this.all().map((room) => ({
      id: room.id,
      name: room.name,
      game: room.game,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.size,
      createdAt: room.createdAt,
    }));
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /** Retrouve une salle par id **ou** par nom. */
  find(idOrName: string): Room | undefined {
    return this.rooms.get(idOrName) ?? this.all().find((room) => room.name === idOrName);
  }

  create(input: {
    name: string;
    game?: "ETS2" | "ATS";
    maxPlayers?: number;
  }): Room {
    const room = newRoom(input);
    this.rooms.set(room.id, room);
    return room;
  }

  delete(id: string): boolean {
    return this.rooms.delete(id);
  }
}
