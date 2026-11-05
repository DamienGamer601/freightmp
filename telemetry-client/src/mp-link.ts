/**
 * Lien vers le serveur multijoueur FreightMP (UDP, protocole binaire).
 *
 * Permet au client de télémétrie de pousser l'état réel du jeu dans une salle
 * MP : le camion du joueur apparaît alors sur la page /multiplayer.
 */

import dgram from "node:dgram";

const MP_STATE = 0x10;

export interface MpLinkOptions {
  host: string;
  udpPort: number;
  httpPort: number;
  room: string;
  token?: string;
  truckId: string;
}

export interface MpState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface MpLink {
  send(state: MpState): void;
  readonly joined: boolean;
  close(): void;
}

interface RoomSummary {
  id: string;
  name: string;
}

function encodeHeading(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized * 100) % 36000;
}

function encodeSpeed(kmh: number): number {
  return Math.max(0, Math.min(65_535, Math.round(kmh * 10)));
}

function encodeState(seq: number, state: MpState): Buffer {
  const buffer = Buffer.allocUnsafe(17);
  buffer.writeUInt8(MP_STATE, 0);
  buffer.writeUInt32LE(seq >>> 0, 1);
  buffer.writeFloatLE(state.x, 5);
  buffer.writeFloatLE(state.z, 9);
  buffer.writeUInt16LE(encodeHeading(state.heading), 13);
  buffer.writeUInt16LE(encodeSpeed(state.speed), 15);
  return buffer;
}

export async function createMpLink(options: MpLinkOptions): Promise<MpLink> {
  const response = await fetch(`http://${options.host}:${options.httpPort}/rooms`);
  const data = (await response.json()) as { rooms: RoomSummary[] };

  const room = options.room
    ? data.rooms.find(
        (item) => item.id === options.room || item.name === options.room,
      )
    : data.rooms[0];

  if (!room) {
    throw new Error("Aucune salle multijoueur disponible");
  }

  const socket = dgram.createSocket("udp4");
  let joined = false;
  let seq = 0;

  socket.on("message", (buffer) => {
    try {
      const message = JSON.parse(buffer.toString("utf8")) as {
        t: string;
        numId?: number;
        reason?: string;
      };
      if (message.t === "join-ok") {
        joined = true;
        console.log(`[MP] Rejoint la salle « ${room.name} » (numId=${message.numId})`);
      } else if (message.t === "join-err") {
        console.error(`[MP] Refusé : ${message.reason}`);
      }
    } catch {
      /* snapshot binaire : ignoré côté émetteur */
    }
  });

  socket.on("error", (error) => {
    console.error("[MP] Erreur UDP :", error.message);
  });

  socket.bind(0, () => {
    socket.send(
      JSON.stringify({
        t: "join",
        roomId: room.id,
        truckId: options.truckId,
        token: options.token,
      }),
      options.udpPort,
      options.host,
    );
  });

  return {
    get joined() {
      return joined;
    },
    send(state: MpState) {
      if (!joined) {
        return;
      }
      socket.send(encodeState(seq++, state), options.udpPort, options.host);
    },
    close() {
      socket.close();
    },
  };
}
