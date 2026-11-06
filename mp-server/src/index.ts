import { GameServer } from "./game-server";

const udpPort = Number(process.env.MP_UDP_PORT ?? "5000");
const httpPort = Number(process.env.MP_HTTP_PORT ?? "5001");
const token = process.env.MP_TOKEN || undefined;
const tickRate = Number(process.env.MP_TICK_RATE ?? "20");
const jwtSecret = process.env.MP_JWT_SECRET || undefined;
const requireAuth = process.env.MP_REQUIRE_AUTH === "1";
const apiUrl = process.env.MP_API_URL || undefined;
const internalApiKey = process.env.MP_INTERNAL_KEY || undefined;

const server = new GameServer({
  udpPort,
  httpPort,
  token,
  tickRate,
  jwtSecret,
  requireAuth,
  apiUrl,
  internalApiKey,
});

server
  .start()
  .then(() => {
    console.log("");
    console.log("[MP] ================================================");
    console.log(`[MP]  Serveur multijoueur FreightMP prêt`);
    console.log(`[MP]  UDP  : 0.0.0.0:${udpPort}`);
    console.log(`[MP]  HTTP : http://localhost:${httpPort}/rooms`);
    console.log(`[MP]  Tick : ${tickRate} Hz`);
    console.log(
      `[MP]  Auth : ${
        jwtSecret ? (requireAuth ? "obligatoire" : "optionnelle") : "désactivée"
      }`,
    );
    console.log("[MP] ================================================");
    console.log("");
  })
  .catch((error) => {
    console.error("[MP] Erreur de démarrage", error);
    process.exit(1);
  });

process.on("SIGINT", () => {
  console.log("[MP] Arrêt…");
  server.stop();
  process.exit(0);
});
