import { describe, it, expect } from "vitest";
import {
  decode,
  decodeSnapshotBinary,
  decodeStateBinary,
  encode,
  encodeSnapshotBinary,
  encodeStateBinary,
  isJsonMessage,
} from "../src/protocol";

describe("encode / decode JSON", () => {
  it("fait un aller-retour sur un message", () => {
    const message = { t: "chat" as const, message: "salut" };
    expect(decode(encode(message))).toEqual(message);
  });

  it("détecte un message JSON", () => {
    expect(isJsonMessage(encode({ t: "ping", ts: 123 }))).toBe(true);
  });

  it("retourne null pour un contenu invalide", () => {
    expect(decode(Buffer.from("not json"))).toBeNull();
  });
});

describe("état binaire", () => {
  it("fait un aller-retour", () => {
    const state = { seq: 42, x: 1234.5, z: -99.25, heading: 270, speed: 88 };
    const decoded = decodeStateBinary(encodeStateBinary(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(42);
    expect(decoded!.x).toBeCloseTo(1234.5, 1);
    expect(decoded!.z).toBeCloseTo(-99.25, 1);
    expect(decoded!.heading).toBeCloseTo(270, 1);
    expect(decoded!.speed).toBeCloseTo(88, 1);
  });

  it("produit un buffer de 17 octets", () => {
    const buffer = encodeStateBinary({ seq: 0, x: 0, z: 0, heading: 0, speed: 0 });
    expect(buffer.length).toBe(17);
  });

  it("normalise le cap dans [0, 360[", () => {
    const decoded = decodeStateBinary(
      encodeStateBinary({ seq: 0, x: 0, z: 0, heading: 450, speed: 0 }),
    );
    expect(decoded!.heading).toBeCloseTo(90, 1);
  });

  it("rejette un buffer trop court", () => {
    expect(decodeStateBinary(Buffer.alloc(4))).toBeNull();
  });

  it("rejette un mauvais type de message", () => {
    const buffer = encodeStateBinary({ seq: 0, x: 0, z: 0, heading: 0, speed: 0 });
    buffer.writeUInt8(0x99, 0);
    expect(decodeStateBinary(buffer)).toBeNull();
  });
});

describe("snapshot binaire", () => {
  it("fait un aller-retour", () => {
    const snapshot = {
      tick: 7,
      serverTime: 1_700_000_000_000,
      players: [
        { numId: 1, x: 10, z: 20, heading: 90, speed: 50 },
        { numId: 2, x: -5, z: 3.5, heading: 180, speed: 0 },
      ],
    };
    const decoded = decodeSnapshotBinary(encodeSnapshotBinary(snapshot));
    expect(decoded).not.toBeNull();
    expect(decoded!.tick).toBe(7);
    expect(decoded!.serverTime).toBe(1_700_000_000_000);
    expect(decoded!.players).toHaveLength(2);
    expect(decoded!.players[0]).toMatchObject({ numId: 1 });
    expect(decoded!.players[0].x).toBeCloseTo(10, 1);
    expect(decoded!.players[1].numId).toBe(2);
    expect(decoded!.players[1].x).toBeCloseTo(-5, 1);
  });

  it("gère un snapshot vide", () => {
    const decoded = decodeSnapshotBinary(
      encodeSnapshotBinary({ tick: 0, serverTime: 0, players: [] }),
    );
    expect(decoded).not.toBeNull();
    expect(decoded!.players).toHaveLength(0);
  });

  it("a la bonne taille", () => {
    const buffer = encodeSnapshotBinary({
      tick: 1,
      serverTime: 2,
      players: [{ numId: 1, x: 0, z: 0, heading: 0, speed: 0 }],
    });
    expect(buffer.length).toBe(15 + 14);
  });

  it("rejette un buffer invalide", () => {
    expect(decodeSnapshotBinary(Buffer.alloc(3))).toBeNull();
  });
});
