/**
 * Simulateur de télémétrie ETS2/ATS.
 *
 * Émet des coordonnées de JEU (x, z en mètres) — le même format que produit
 * la vraie télémétrie du SDK SCS — autour de villes réelles. Le backend les
 * convertit en WGS84 (lng/lat) pour affichage.
 *
 * Usage :
 *   npm run telemetry:sim
 *
 * Variables d'environnement optionnelles :
 *   FMP_WS_URL        (défaut ws://localhost:4000/ws)
 *   FMP_TRUCK_COUNT   (défaut 6)
 *   FMP_INTERVAL_MS   (défaut 2000)
 */
import WebSocket from "ws";
import { wgs84ToGame, type GameId, type GameCoords } from "../src/lib/game-coords";

const WS_URL = process.env.FMP_WS_URL ?? "ws://localhost:4000/ws";
const TRUCK_COUNT = Number.parseInt(process.env.FMP_TRUCK_COUNT ?? "6", 10);
const INTERVAL_MS = Number.parseInt(process.env.FMP_INTERVAL_MS ?? "2000", 10);

interface City {
  game: GameId;
  lng: number;
  lat: number;
}

const CITIES: City[] = [
  // ETS2 — Europe
  { game: "ETS2", lng: 6.76, lat: 51.43 }, // Duisburg
  { game: "ETS2", lng: 1.86, lat: 50.95 }, // Calais
  { game: "ETS2", lng: 4.9, lat: 52.37 }, // Amsterdam
  { game: "ETS2", lng: 9.18, lat: 48.78 }, // Stuttgart
  // ATS — Amérique du Nord
  { game: "ATS", lng: -118.24, lat: 34.05 }, // Los Angeles
  { game: "ATS", lng: -115.14, lat: 36.17 }, // Las Vegas
  { game: "ATS", lng: -112.07, lat: 33.45 }, // Phoenix
  { game: "ATS", lng: -122.33, lat: 47.61 }, // Seattle
];

interface Truck {
  id: string;
  game: GameId;
  x: number;
  z: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function makeTrucks(count: number): Truck[] {
  const trucks: Truck[] = [];
  for (let i = 0; i < count; i += 1) {
    const city = CITIES[i % CITIES.length];
    const [cx, cz] = wgs84ToGame(city.game, city.lng, city.lat);
    trucks.push({
      id: `truck-${i + 1}`,
      game: city.game,
      x: cx + rand(-1000, 1000),
      z: cz + rand(-1000, 1000),
    });
  }
  return trucks;
}

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log(`[telemetry-sim] connecté à ${WS_URL}`);
  ws.send(JSON.stringify({ type: "subscribe", channel: "telemetry" }));

  const trucks = makeTrucks(TRUCK_COUNT);
  let tick = 0;

  setInterval(() => {
    tick += 1;
    for (const t of trucks) {
      // Petit déplacement aléatoire (quelques mètres par tick).
      t.x += rand(-200, 200);
      t.z += rand(-200, 200);

      const payload = {
        truckId: t.id,
        game: t.game,
        x: Math.round(t.x),
        z: Math.round(t.z),
        speedKmh: Math.round(rand(0, 90)),
        heading: Math.round(rand(0, 359)),
        fuelLiters: Math.round(rand(50, 800)),
        tick,
      };

      ws.send(JSON.stringify({ type: "telemetry", payload }));
    }
    console.log(`[telemetry-sim] tick #${tick} — ${trucks.length} camions émis`);
  }, INTERVAL_MS);
});

ws.on("message", (raw) => {
  console.log("[telemetry-sim] recv", raw.toString());
});

ws.on("error", (error) => {
  console.error("[telemetry-sim] error:", error.message);
});

ws.on("close", () => {
  console.log("[telemetry-sim] connexion fermée");
  process.exit(0);
});
