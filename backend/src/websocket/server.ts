import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../lib/logger";
import { gameToWgs84 } from "../lib/game-coords";

interface ChannelClient extends WebSocket {
  username?: string;
  channels: Set<string>;
}

interface ClientMessage {
  type: string;
  channel?: string;
  message?: string;
  payload?: unknown;
  username?: string;
}

export interface TelemetryPayload {
  truckId?: string;
  game?: string;
  // Coordonnées jeu (source de vérité).
  x?: number;
  z?: number;
  // WGS84, calculées par le serveur à partir de x/z.
  latitude?: number;
  longitude?: number;
  speedKmh?: number;
  heading?: number;
  fuelLiters?: number;
}

interface TelemetryRecord extends TelemetryPayload {
  truckId: string;
  lastSeenAt: string;
}

const clients = new Set<ChannelClient>();
const channels = new Map<string, Set<ChannelClient>>();

// Dernière télémétrie connue par camion (exposée via l'endpoint REST /telemetry).
const latestTelemetry = new Map<string, TelemetryRecord>();
const TELEMETRY_TTL_MS = 30_000;

/** Enrichit la télémétrie : convertit les coordonnées jeu en WGS84. */
function enrichTelemetry(payload: unknown): TelemetryPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const p = payload as Record<string, unknown>;

  const result: TelemetryPayload = {
    truckId: typeof p.truckId === "string" ? p.truckId : undefined,
    game: typeof p.game === "string" ? p.game : undefined,
    x: typeof p.x === "number" ? p.x : undefined,
    z: typeof p.z === "number" ? p.z : undefined,
    latitude: typeof p.latitude === "number" ? p.latitude : undefined,
    longitude: typeof p.longitude === "number" ? p.longitude : undefined,
    speedKmh: typeof p.speedKmh === "number" ? p.speedKmh : undefined,
    heading: typeof p.heading === "number" ? p.heading : undefined,
    fuelLiters: typeof p.fuelLiters === "number" ? p.fuelLiters : undefined,
  };

  const needsTransform =
    (result.latitude === undefined || result.longitude === undefined) &&
    result.x !== undefined &&
    result.z !== undefined &&
    (result.game === "ETS2" || result.game === "ATS");

  if (needsTransform) {
    const [lng, lat] = gameToWgs84(result.game as "ETS2" | "ATS", result.x!, result.z!);
    result.longitude = lng;
    result.latitude = lat;
  }

  return result;
}

function updateTelemetry(payload: unknown): TelemetryPayload {
  const enriched = enrichTelemetry(payload);
  const truckId = enriched.truckId ?? `truck-${latestTelemetry.size + 1}`;

  const record: TelemetryRecord = {
    ...enriched,
    truckId,
    lastSeenAt: new Date().toISOString(),
  };
  latestTelemetry.set(truckId, record);

  return record;
}

/** Snapshot des camions actifs (purge les entrées trop anciennes). */
export function getTelemetrySnapshot(): {
  updatedAt: string;
  trucks: TelemetryRecord[];
} {
  const now = Date.now();
  const trucks: TelemetryRecord[] = [];

  for (const [id, record] of latestTelemetry) {
    if (now - new Date(record.lastSeenAt).getTime() > TELEMETRY_TTL_MS) {
      latestTelemetry.delete(id);
      continue;
    }
    trucks.push(record);
  }

  return { updatedAt: new Date().toISOString(), trucks };
}

function send(client: WebSocket, data: unknown): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}

function subscribe(client: ChannelClient, channel: string): void {
  client.channels.add(channel);
  const subscribers = channels.get(channel) ?? new Set<ChannelClient>();
  subscribers.add(client);
  channels.set(channel, subscribers);
}

function broadcastToChannel(channel: string, data: unknown): void {
  const subscribers = channels.get(channel);
  if (!subscribers) {
    return;
  }
  for (const client of subscribers) {
    send(client, data);
  }
}

/**
 * Soumet une télémétrie (via REST POST /telemetry ou WebSocket) et la diffuse
 * aux abonnés du canal « telemetry ».
 */
export function submitTelemetry(payload: unknown): TelemetryPayload {
  const enriched = updateTelemetry(payload);
  broadcastToChannel("telemetry", {
    type: "telemetry:update",
    payload: enriched,
    at: new Date().toISOString(),
  });
  return enriched;
}

/** Send an event to every connected client (e.g. server status updates). */
export function broadcastAll(event: Record<string, unknown>): void {
  for (const client of clients) {
    send(client, event);
  }
}

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket) => {
    const client = socket as ChannelClient;
    client.channels = new Set();
    clients.add(client);

    socket.on("message", (raw) => {
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return; // ignore malformed JSON
      }

      if (!parsed || typeof parsed.type !== "string") {
        return;
      }

      if (typeof parsed.username === "string" && parsed.username) {
        client.username = parsed.username;
      }

      switch (parsed.type) {
        case "subscribe": {
          if (parsed.channel === "telemetry" || parsed.channel === "chat") {
            subscribe(client, parsed.channel);
          }
          break;
        }
        case "chat": {
          if (typeof parsed.message === "string" && parsed.message.trim()) {
            broadcastToChannel("chat", {
              type: "chat:message",
              message: parsed.message,
              username: client.username ?? "Anonymous",
              at: new Date().toISOString(),
            });
          }
          break;
        }
        case "telemetry": {
          submitTelemetry(parsed.payload);
          break;
        }
        default:
          break;
      }
    });

    socket.on("close", () => {
      clients.delete(client);
      for (const [channel, subscribers] of channels) {
        subscribers.delete(client);
        if (subscribers.size === 0) {
          channels.delete(channel);
        }
      }
    });

    socket.on("error", (error) => {
      logger.warn("WebSocket client error", error.message);
    });
  });

  return wss;
}
