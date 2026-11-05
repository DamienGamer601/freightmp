/**
 * Client de référence du serveur multijoueur FreightMP.
 *
 * - Rejoint une salle (plan de contrôle HTTP).
 * - Envoie son état en **binaire compact** à 10 Hz.
 * - Reçoit les snapshots binaires et **interpole** les positions des autres
 *   joueurs pour un rendu fluide.
 *
 * Usage : npm run client
 * Variables : MP_HOST, MP_UDP_PORT, MP_HTTP_PORT, MP_ROOM, MP_TOKEN, MP_TRUCK_ID
 */

import dgram from "node:dgram";
import {
  decode,
  decodeSnapshotBinary,
  encode,
  encodeStateBinary,
  isJsonMessage,
  type ClientMessage,
  type ServerMessage,
} from "./protocol";

const host = process.env.MP_HOST ?? "127.0.0.1";
const udpPort = Number(process.env.MP_UDP_PORT ?? "5000");
const httpPort = Number(process.env.MP_HTTP_PORT ?? "5001");
const roomFilter = process.env.MP_ROOM ?? "";
const token = process.env.MP_TOKEN ?? "";
const truckId = process.env.MP_TRUCK_ID ?? `client-${process.pid}`;

const RENDER_DELAY_MS = 100;

interface RoomSummary {
  id: string;
  name: string;
}

interface BufferedSnapshot {
  receivedAt: number;
  players: Map<number, { x: number; z: number; heading: number; speed: number }>;
}

interface InterpolatedPlayer {
  numId: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

const snapshots: BufferedSnapshot[] = [];
let myNumId = -1;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateAt(renderTime: number): InterpolatedPlayer[] {
  if (snapshots.length === 0) {
    return [];
  }

  // Trouve la paire de snapshots encadrant renderTime.
  let a = snapshots[0];
  let b = snapshots[snapshots.length - 1];
  for (let index = 1; index < snapshots.length; index += 1) {
    if (snapshots[index].receivedAt >= renderTime) {
      a = snapshots[index - 1];
      b = snapshots[index];
      break;
    }
  }

  const span = b.receivedAt - a.receivedAt;
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.receivedAt) / span)) : 1;

  const players: InterpolatedPlayer[] = [];
  for (const [numId, current] of b.players) {
    const previous = a.players.get(numId);
    players.push({
      numId,
      x: previous ? lerp(previous.x, current.x, t) : current.x,
      z: previous ? lerp(previous.z, current.z, t) : current.z,
      heading: current.heading,
      speed: current.speed,
    });
  }
  return players;
}

async function main(): Promise<void> {
  const response = await fetch(`http://${host}:${httpPort}/rooms`);
  const { rooms } = (await response.json()) as { rooms: RoomSummary[] };

  const room = roomFilter
    ? rooms.find((item) => item.id === roomFilter || item.name === roomFilter)
    : rooms[0];

  if (!room) {
    console.error("[MP] Aucune salle disponible. Lance le serveur d'abord.");
    process.exit(1);
  }

  console.log(`[MP] Salle : ${room.name} (${room.id})`);
  console.log(`[MP] Connexion UDP ${host}:${udpPort} (protocole binaire)…`);

  const socket = dgram.createSocket("udp4");
  let seq = 0;
  let tick = 0;
  let latencyMs = 0;
  let lastPrint = 0;

  socket.on("message", (buffer) => {
    if (isJsonMessage(buffer)) {
      const message = decode<ServerMessage>(buffer);
      if (!message) {
        return;
      }
      switch (message.t) {
        case "join-ok":
          myNumId = message.numId;
          console.log(`[MP] Connecté (numId=${message.numId}, playerId=${message.playerId})`);
          break;
        case "join-err":
          console.error(`[MP] Refusé : ${message.reason}`);
          socket.close();
          process.exit(1);
          break;
        case "pong":
          latencyMs = Date.now() - message.ts;
          socket.send(
            encode({ t: "latency", value: latencyMs }),
            udpPort,
            host,
          );
          break;
        case "players":
          console.log(
            `[MP] pseudos: ${message.players
              .map(
                (p) =>
                  `${p.n}:${p.u} (${p.p}ms)${p.g ? ` [${p.g}]` : ""}${
                    p.c ? ` ${p.c}` : ""
                  }`,
              )
              .join(", ")}`,
          );
          break;
        case "chat":
          console.log(`[MP] chat <${message.name}> ${message.message}`);
          break;
        case "collision":
          console.log(`[MP] 💥 COLLISION avec #${message.other}`);
          break;
        case "environment":
          console.log(
            `[MP] météo=${message.weather} · heure=${String(Math.floor(message.timeOfDay / 60)).padStart(2, "0")}:${String(message.timeOfDay % 60).padStart(2, "0")}`,
          );
          break;
      }
      return;
    }

    const snapshot = decodeSnapshotBinary(buffer);
    if (!snapshot) {
      return;
    }
    snapshots.push({
      receivedAt: Date.now(),
      players: new Map(
        snapshot.players.map((player) => [
          player.numId,
          { x: player.x, z: player.z, heading: player.heading, speed: player.speed },
        ]),
      ),
    });
    if (snapshots.length > 30) {
      snapshots.shift();
    }
  });

  socket.bind(0, () => {
    const join: ClientMessage = {
      t: "join",
      roomId: room.id,
      truckId,
      token: token || undefined,
    };
    socket.send(encode(join), udpPort, host);

    // Message de chat de test après 3 s.
    setTimeout(() => {
      socket.send(
        encode({ t: "chat", message: `Salut, c'est ${truckId} !` }),
        udpPort,
        host,
      );
    }, 3000);
  });

  // Envoi d'état binaire à 10 Hz (mock).
  const fixedX = process.env.MP_TEST_X ? Number(process.env.MP_TEST_X) : null;
  const fixedZ = process.env.MP_TEST_Z ? Number(process.env.MP_TEST_Z) : null;
  setInterval(() => {
    const angle = tick++ * 0.02;
    const state = encodeStateBinary({
      seq: seq++,
      x: fixedX !== null ? fixedX : 3000 + Math.cos(angle) * 500,
      z: fixedZ !== null ? fixedZ : 2000 + Math.sin(angle) * 500,
      heading: Math.round(((angle * 180) / Math.PI) % 360),
      speed: Math.round(60 + Math.sin(tick * 0.2) * 10),
    });
    socket.send(state, udpPort, host);
  }, 100);

  // Ping.
  setInterval(() => {
    socket.send(encode({ t: "ping", ts: Date.now() }), udpPort, host);
  }, 2000);

  // Rendu interpolé.
  setInterval(() => {
    const now = Date.now();
    if (now - lastPrint < 2000) {
      return;
    }
    lastPrint = now;

    const players = interpolateAt(now - RENDER_DELAY_MS);
    const others = players.filter((player) => player.numId !== myNumId);
    const me = players.find((player) => player.numId === myNumId);

    console.log(
      `[MP] joueurs=${players.length} · moi=${
        me ? `${Math.round(me.x)},${Math.round(me.z)}` : "?"
      } · ping=${latencyMs}ms`,
    );
    for (const other of others) {
      console.log(
        `      ↳ #${other.numId} @ ${Math.round(other.x)},${Math.round(other.z)} ` +
          `(${Math.round(other.speed)} km/h)`,
      );
    }
  }, 50);
}

main().catch((error) => {
  console.error("[MP] Erreur client :", error);
  process.exit(1);
});
