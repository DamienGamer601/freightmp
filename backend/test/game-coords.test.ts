import { describe, it, expect } from "vitest";
import {
  gameToWgs84,
  wgs84ToGame,
  type GameId,
} from "../src/lib/game-coords";

const cases: { game: GameId; x: number; z: number }[] = [
  { game: "ETS2", x: 0, z: 0 },
  { game: "ETS2", x: 3000, z: 2000 },
  { game: "ETS2", x: -5000, z: 12000 },
  { game: "ATS", x: 0, z: 0 },
  { game: "ATS", x: 3000, z: 2000 },
  { game: "ATS", x: -8000, z: -3000 },
];

describe("gameToWgs84 / wgs84ToGame", () => {
  for (const { game, x, z } of cases) {
    it(`aller-retour ${game} (${x}, ${z})`, () => {
      const [lng, lat] = gameToWgs84(game, x, z);
      const [roundX, roundZ] = wgs84ToGame(game, lng, lat);
      expect(roundX).toBeCloseTo(x, 3);
      expect(roundZ).toBeCloseTo(z, 3);
    });
  }

  it("produit des longitudes/latitudes finies", () => {
    const [lng, lat] = gameToWgs84("ETS2", 3000, 2000);
    expect(Number.isFinite(lng)).toBe(true);
    expect(Number.isFinite(lat)).toBe(true);
    expect(lng).toBeGreaterThan(-180);
    expect(lng).toBeLessThan(180);
    expect(lat).toBeGreaterThan(-90);
    expect(lat).toBeLessThan(90);
  });

  it("place l'Europe dans des bornes plausibles", () => {
    const [lng, lat] = gameToWgs84("ETS2", 3000, 2000);
    expect(lng).toBeGreaterThan(-15);
    expect(lng).toBeLessThan(40);
    expect(lat).toBeGreaterThan(30);
    expect(lat).toBeLessThan(72);
  });

  it("place l'Amérique du Nord dans des bornes plausibles", () => {
    const [lng, lat] = gameToWgs84("ATS", 3000, 2000);
    expect(lng).toBeGreaterThan(-130);
    expect(lng).toBeLessThan(-60);
    expect(lat).toBeGreaterThan(20);
    expect(lat).toBeLessThan(60);
  });

  it("est déterministe", () => {
    const a = gameToWgs84("ETS2", 1234, 5678);
    const b = gameToWgs84("ETS2", 1234, 5678);
    expect(a).toEqual(b);
  });
});
