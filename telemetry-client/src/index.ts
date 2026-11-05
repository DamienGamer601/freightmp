/**
 * FreightMP — client de télémétrie ETS2/ATS.
 *
 * Lit l'état du jeu via le plugin SCS (`scs-telemetry.dll` → `trucksim-telemetry`)
 * et l'envoie à l'API FreightMP (WebSocket `/ws`, avec repli HTTP POST).
 *
 * Prérequis :
 *   1. Le plugin `scs-telemetry.dll` doit être présent dans
 *      `<jeu>/bin/win_x64/plugins/` (voir README).
 *   2. Le jeu doit être lancé.
 *
 * Usage :
 *   npm run dev          # lecture réelle du jeu
 *   npm run mock         # télémétrie synthétique, sans jeu (test)
 *
 * Variables d'environnement :
 *   FMP_API_URL     URL de l'API (défaut http://localhost:4000)
 *   FMP_GAME        ETS2 | ATS (défaut ETS2)
 *   FMP_TRUCK_ID    identifiant du camion (défaut aléatoire)
 *   FMP_INTERVAL_MS intervalle d'envoi en ms (défaut 500)
 */

import WebSocket from "ws";
import { createMpLink, type MpLink } from "./mp-link";

type GameId = "ETS2" | "ATS";

interface Config {
  apiUrl: string;
  wsUrl: string;
  game: GameId;
  truckId: string;
  intervalMs: number;
  mock: boolean;
  debug: boolean;
  // Lien multijoueur (optionnel).
  mpEnabled: boolean;
  mpHost: string;
  mpUdpPort: number;
  mpHttpPort: number;
  mpRoom: string;
  mpToken?: string;
}

interface TelemetryOut {
  truckId: string;
  game: string;
  x?: number;
  z?: number;
  speedKmh?: number;
  heading?: number;
  fuelLiters?: number;
  cargo?: string;
  truckModel?: string;
}

function log(...args: unknown[]): void {
  console.log("[FMP]", ...args);
}

function loadConfig(): Config {
  const apiUrl = (process.env.FMP_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  const wsUrl =
    process.env.FMP_WS_URL ?? `${apiUrl.replace(/^http/, "ws")}/ws`;

  return {
    apiUrl,
    wsUrl,
    game: process.env.FMP_GAME === "ATS" ? "ATS" : "ETS2",
    truckId:
      process.env.FMP_TRUCK_ID ??
      `truck-${Math.random().toString(36).slice(2, 8)}`,
    intervalMs: Math.max(200, Number(process.env.FMP_INTERVAL_MS ?? "500")),
    mock: process.argv.includes("--mock") || process.env.FMP_MOCK === "1",
    debug: process.argv.includes("--debug") || process.env.FMP_DEBUG === "1",
    mpEnabled: process.argv.includes("--mp") || process.env.FMP_MP === "1",
    mpHost: process.env.MP_HOST ?? "127.0.0.1",
    mpUdpPort: Number(process.env.MP_UDP_PORT ?? "5000"),
    mpHttpPort: Number(process.env.MP_HTTP_PORT ?? "5001"),
    mpRoom: process.env.MP_ROOM ?? "",
    mpToken: process.env.MP_TOKEN || undefined,
  };
}

/* ---------- Normalisation ---------- */

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalize(raw: unknown, config: Config): TelemetryOut | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  // La structure `trucksim-telemetry` est plate : coordinateX/Y/Z,
  // rotationX/Y/Z (radians), speed (m/s), game (1=ETS2, 2=ATS)…
  const data = raw as Record<string, unknown>;

  const gameId =
    data.game === 2 ? "ATS" : data.game === 1 ? "ETS2" : config.game;

  const x = num(data.coordinateX);
  const z = num(data.coordinateZ);
  const rotationY = num(data.rotationY) ?? 0;
  const speedMs = num(data.speed) ?? 0;

  const headingDegrees = (rotationY * 180) / Math.PI;
  const speedKmh = speedMs * 3.6;

  const payload: TelemetryOut = {
    truckId: config.truckId,
    game: gameId,
    x,
    z,
    speedKmh: Math.round(speedKmh * 10) / 10,
    heading: Math.round(((headingDegrees % 360) + 360) % 360),
    fuelLiters: num(data.fuel),
    cargo: typeof data.cargo === "string" ? data.cargo : undefined,
    truckModel: typeof data.truckName === "string" ? data.truckName : undefined,
  };

  // Sans position, rien à afficher sur la carte.
  if (payload.x === undefined || payload.z === undefined) {
    return null;
  }

  return payload;
}

/* ---------- Mode mock ---------- */

function mockSnapshot(config: Config, tick: number): TelemetryOut {
  const angle = tick * 0.02;
  return {
    truckId: config.truckId,
    game: config.game,
    x: 3000 + Math.cos(angle) * 800,
    z: 2000 + Math.sin(angle) * 800,
    speedKmh: Math.round((70 + Math.sin(tick * 0.3) * 12) * 10) / 10,
    heading: Math.round(((angle * 180) / Math.PI) % 360),
    fuelLiters: 300,
    cargo: "Mock cargo",
    truckModel: "mock-truck",
  };
}

/* ---------- Transport ---------- */

function createTransport(config: Config) {
  let ws: WebSocket | null = null;
  let connected = false;

  const connect = () => {
    try {
      ws = new WebSocket(config.wsUrl);
    } catch (error) {
      log("WebSocket: échec de connexion", (error as Error).message);
      setTimeout(connect, 3000);
      return;
    }

    ws.on("open", () => {
      connected = true;
      log(`WebSocket connecté (${config.wsUrl})`);
      ws?.send(JSON.stringify({ type: "subscribe", channel: "telemetry" }));
    });
    ws.on("close", () => {
      if (connected) log("WebSocket déconnecté, reconnexion…");
      connected = false;
      setTimeout(connect, 3000);
    });
    ws.on("error", () => {
      connected = false;
    });
  };

  const send = (payload: TelemetryOut) => {
    const message = JSON.stringify({ type: "telemetry", payload });
    if (connected && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      if (config.debug) log("WS →", message);
      return;
    }

    // Repli HTTP.
    fetch(`${config.apiUrl}/api/v1/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(() => {
        if (config.debug) log("HTTP →", JSON.stringify(payload));
      })
      .catch(() => {
        /* silencieux */
      });
  };

  return { connect, send };
}

/* ---------- Programme principal ---------- */

async function main(): Promise<void> {
  const config = loadConfig();
  const transport = createTransport(config);

  log(`Client de télémétrie FreightMP — ${config.game} — camion ${config.truckId}`);
  log(`API: ${config.apiUrl} · WS: ${config.wsUrl}`);
  transport.connect();

  // Lien multijoueur (optionnel).
  let mp: MpLink | null = null;
  if (config.mpEnabled) {
    try {
      mp = await createMpLink({
        host: config.mpHost,
        udpPort: config.mpUdpPort,
        httpPort: config.mpHttpPort,
        room: config.mpRoom,
        token: config.mpToken,
        truckId: config.truckId,
      });
      log(`[MP] Lien multijoueur activé (${config.mpHost}:${config.mpUdpPort})`);
    } catch (error) {
      log("⚠️  Impossible de rejoindre le serveur MP :", (error as Error).message);
    }
  }

  if (config.mock) {
    log("Mode MOCK activé : télémétrie synthétique (aucun jeu requis).");
    let tick = 0;
    setInterval(() => {
      const snapshot = mockSnapshot(config, tick++);
      transport.send(snapshot);
      mp?.send({
        x: snapshot.x!,
        z: snapshot.z!,
        heading: snapshot.heading ?? 0,
        speed: snapshot.speedKmh ?? 0,
      });
    }, config.intervalMs);
    return;
  }

  // Lecture réelle via le plugin SCS.
  let telemetry: any = null;
  let getData: (() => unknown) | null = null;
  try {
    const mod: any = await import("trucksim-telemetry");
    const factory = mod.truckSimTelemetry ?? mod.default;
    getData = typeof mod.getData === "function" ? mod.getData : null;
    telemetry = factory();
    log("SDK SCS chargé. En attente du jeu…");
  } catch (error) {
    log("");
    log("⚠️  Impossible de charger 'trucksim-telemetry'.");
    log("   → Vérifie que le plugin 'scs-telemetry.dll' est bien dans");
    log("     <jeu>/bin/win_x64/plugins/ et que le jeu est lancé.");
    log("   → Détail :", (error as Error).message);
    log("");
    log("   En attendant, tu peux tester avec :  npm run mock");
    process.exit(1);
  }

  let latest: unknown = null;

  telemetry.on?.("connected", () => log("SDK connecté (jeu détecté)."));
  telemetry.on?.("disconnected", () => log("SDK déconnecté (jeu fermé ?)."));
  telemetry.on?.("data", (data: unknown) => {
    latest = data;
  });

  const readSnapshot = (): unknown => {
    try {
      if (getData) {
        const value = getData();
        if (value) return value;
      }
    } catch {
      /* pas encore connecté */
    }
    return latest;
  };

  setInterval(() => {
    const payload = normalize(readSnapshot(), config);
    if (payload) {
      transport.send(payload);
      mp?.send({
        x: payload.x!,
        z: payload.z!,
        heading: payload.heading ?? 0,
        speed: payload.speedKmh ?? 0,
      });
    }
  }, config.intervalMs);

  log("En attente des données du jeu… Lance ETS2/ATS et prends la route.");
}

main().catch((error) => {
  console.error("[FMP] Erreur fatale :", error);
  process.exit(1);
});
