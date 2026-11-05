/**
 * Protocole du serveur multijoueur FreightMP.
 *
 * Plan de données : UDP, messages JSON (simple et lisible).
 * Pour la production, on remplacerait par un encodage binaire compact.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface PlayerState {
  id: string;
  truckId: string;
  /** Pseudo FreightMP (si le joueur s'est authentifié). */
  username?: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  latencyMs: number;
}

/* ---------- Client → Serveur ---------- */

export type ClientMessage =
  | { t: "join"; roomId: string; truckId?: string; token?: string }
  | {
      t: "state";
      seq: number;
      x: number;
      z: number;
      heading?: number;
      speed?: number;
    }
  | { t: "leave" }
  | { t: "ping"; ts: number }
  | { t: "chat"; message: string }
  | { t: "latency"; value: number }
  | { t: "set-environment"; weather?: string; timeOfDay?: number };

/* ---------- Serveur → Client ---------- */

export type ServerMessage =
  | { t: "join-ok"; playerId: string; numId: number; roomId: string; tick: number }
  | { t: "join-err"; reason: string }
  | { t: "snapshot"; tick: number; serverTime: number; players: PlayerState[] }
  | { t: "pong"; ts: number }
  | { t: "error"; reason: string }
  | {
      t: "players";
      players: { n: number; u: string; p: number; g?: string; c?: string }[];
    }
  | { t: "chat"; numId: number; name: string; message: string; at: number }
  | { t: "collision"; other: number; x: number; z: number; at: number }
  | { t: "environment"; weather: string; timeOfDay: number; at: number };

export function encode(message: ClientMessage | ServerMessage): Buffer {
  return Buffer.from(JSON.stringify(message), "utf8");
}

export function decode<T>(buffer: Buffer): T | null {
  try {
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Garde-fous anti-triche de base (côté serveur). */
export const LIMITS = {
  /** Vitesse max tolérée (km/h) — au-delà, la valeur est plafonnée. */
  MAX_SPEED_KMH: 200,
  /** Téléportation : distance max par mise à jour (unités de jeu). */
  MAX_STEP_PER_UPDATE: 500,
  /** Un joueur sans mise à jour pendant ce délai est retiré (ms). */
  PLAYER_TIMEOUT_MS: 15_000,
  /** Fréquence du tick serveur (Hz). */
  TICK_RATE_HZ: 20,
} as const;

/* ============================================================
 * Protocole binaire compact (plan de données haute fréquence)
 *
 * Les messages de contrôle (join/leave/ping/errors) restent en JSON ;
 * seuls `state` (client→serveur) et `snapshot` (serveur→client) passent
 * en binaire pour réduire la bande passante.
 *
 * Détection : 1er octet = 0x7B ('{') → JSON, sinon type binaire.
 * ============================================================ */

export const BINARY = {
  STATE: 0x10,
  SNAPSHOT: 0x20,
} as const;

export interface StatePayload {
  seq: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface SnapshotPlayer {
  numId: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface SnapshotPayload {
  tick: number;
  serverTime: number;
  players: SnapshotPlayer[];
}

const STATE_SIZE = 17;
const PLAYER_SIZE = 14;
const SNAPSHOT_HEADER = 15;

function encodeHeading(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized * 100) % 36000;
}

function decodeHeading(value: number): number {
  return value / 100;
}

function encodeSpeed(kmh: number): number {
  return Math.max(0, Math.min(65_535, Math.round(kmh * 10)));
}

function decodeSpeed(value: number): number {
  return value / 10;
}

export function encodeStateBinary(state: StatePayload): Buffer {
  const buffer = Buffer.allocUnsafe(STATE_SIZE);
  buffer.writeUInt8(BINARY.STATE, 0);
  buffer.writeUInt32LE(state.seq >>> 0, 1);
  buffer.writeFloatLE(state.x, 5);
  buffer.writeFloatLE(state.z, 9);
  buffer.writeUInt16LE(encodeHeading(state.heading), 13);
  buffer.writeUInt16LE(encodeSpeed(state.speed), 15);
  return buffer;
}

export function decodeStateBinary(buffer: Buffer): StatePayload | null {
  if (buffer.length !== STATE_SIZE || buffer.readUInt8(0) !== BINARY.STATE) {
    return null;
  }
  return {
    seq: buffer.readUInt32LE(1),
    x: buffer.readFloatLE(5),
    z: buffer.readFloatLE(9),
    heading: decodeHeading(buffer.readUInt16LE(13)),
    speed: decodeSpeed(buffer.readUInt16LE(15)),
  };
}

export function encodeSnapshotBinary(snapshot: SnapshotPayload): Buffer {
  const buffer = Buffer.allocUnsafe(
    SNAPSHOT_HEADER + snapshot.players.length * PLAYER_SIZE,
  );
  let offset = 0;
  buffer.writeUInt8(BINARY.SNAPSHOT, offset);
  offset += 1;
  buffer.writeUInt32LE(snapshot.tick >>> 0, offset);
  offset += 4;
  buffer.writeDoubleLE(snapshot.serverTime, offset);
  offset += 8;
  buffer.writeUInt16LE(snapshot.players.length, offset);
  offset += 2;

  for (const player of snapshot.players) {
    buffer.writeUInt16LE(player.numId, offset);
    offset += 2;
    buffer.writeFloatLE(player.x, offset);
    offset += 4;
    buffer.writeFloatLE(player.z, offset);
    offset += 4;
    buffer.writeUInt16LE(encodeHeading(player.heading), offset);
    offset += 2;
    buffer.writeUInt16LE(encodeSpeed(player.speed), offset);
    offset += 2;
  }

  return buffer;
}

export function decodeSnapshotBinary(buffer: Buffer): SnapshotPayload | null {
  if (buffer.length < SNAPSHOT_HEADER || buffer.readUInt8(0) !== BINARY.SNAPSHOT) {
    return null;
  }
  const tick = buffer.readUInt32LE(1);
  const serverTime = buffer.readDoubleLE(5);
  const count = buffer.readUInt16LE(13);
  if (buffer.length < SNAPSHOT_HEADER + count * PLAYER_SIZE) {
    return null;
  }

  const players: SnapshotPlayer[] = [];
  let offset = SNAPSHOT_HEADER;
  for (let index = 0; index < count; index += 1) {
    players.push({
      numId: buffer.readUInt16LE(offset),
      x: buffer.readFloatLE(offset + 2),
      z: buffer.readFloatLE(offset + 6),
      heading: decodeHeading(buffer.readUInt16LE(offset + 10)),
      speed: decodeSpeed(buffer.readUInt16LE(offset + 12)),
    });
    offset += PLAYER_SIZE;
  }

  return { tick, serverTime, players };
}

/** Vrai si le buffer ressemble à du JSON (commence par '{'). */
export function isJsonMessage(buffer: Buffer): boolean {
  return buffer.length > 0 && buffer.readUInt8(0) === 0x7b;
}
