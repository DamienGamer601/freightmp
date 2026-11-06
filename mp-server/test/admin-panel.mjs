// Test d'intégration UDP du panneau admin in-game.
//
//   node test/admin-panel.mjs
//
// Démarre un GameServer sur des ports de test, simule un admin et un joueur,
// puis vérifie kick / announce / time / set-environment et les refus.
import dgram from "node:dgram";
import http from "node:http";
import jwt from "jsonwebtoken";
import { GameServer } from "../dist/game-server.js";

const UDP_PORT = 5191;
const HTTP_PORT = 5192;
const JWT_SECRET = "test-admin-panel-secret";

let failures = 0;
function assert(condition, label) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`  KO  ${label}`);
  }
}

function json(path, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port: HTTP_PORT,
        path,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Socket UDP + file de messages reçus. */
function makeClient() {
  const socket = dgram.createSocket("udp4");
  const messages = [];
  const waiters = [];

  socket.on("message", (buffer) => {
    const text = buffer.toString("utf8");
    if (!text.startsWith("{")) return; // snapshots binaires ignorés
    const message = JSON.parse(text);
    messages.push(message);
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      if (waiters[i].predicate(message)) {
        waiters[i].resolve(message);
        waiters.splice(i, 1);
      }
    }
  });

  return {
    socket,
    waitFor(predicate, timeoutMs = 2000) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        waiters.push({
          predicate,
          resolve: (message) => {
            clearTimeout(timer);
            resolve(message);
          },
        });
      });
    },
    send(message) {
      const buffer = Buffer.from(JSON.stringify(message), "utf8");
      socket.send(buffer, UDP_PORT, "127.0.0.1");
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // --- Fausse API FreightMP (vérification + création de bans) ---
  const bans = new Map(); // userId -> { reason }
  const apiServer = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "GET" && url.pathname === "/api/v1/internal/bans/check") {
      if (req.headers["x-internal-key"] !== "test-key") {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "forbidden" }));
        return;
      }
      const userId = url.searchParams.get("userId") ?? "";
      const ban = bans.get(userId);
      res.end(JSON.stringify(ban ? { banned: true, reason: ban.reason } : { banned: false }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/internal/bans") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          bans.set(parsed.userId, { reason: parsed.reason });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "bad json" }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise((resolve) => apiServer.listen(5193, "127.0.0.1", resolve));

  const server = new GameServer({
    udpPort: UDP_PORT,
    httpPort: HTTP_PORT,
    tickRate: 20,
    jwtSecret: JWT_SECRET,
    requireAuth: false,
    apiUrl: "http://127.0.0.1:5193",
    internalApiKey: "test-key",
  });
  await server.start();
  await sleep(150);

  const created = await json("/rooms", "POST", { name: "Test Admin", game: "ETS2" });
  const roomId = created.body.id;

  const adminToken = jwt.sign(
    { kind: "mp", sub: "u-admin", username: "Admin", role: "ADMIN", tag: "FIC", country: "FR" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
  const driverToken = jwt.sign(
    { kind: "mp", sub: "u-driver", username: "Driver", role: "DRIVER" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  const admin = makeClient();
  const driver = makeClient();

  console.log("\n=== join ===");
  admin.send({ t: "join", roomId, truckId: "admin-truck", token: adminToken });
  const adminJoin = await admin.waitFor((m) => m.t === "join-ok");
  assert(adminJoin.role === "ADMIN", "l'admin reçoit son rôle dans join-ok");

  driver.send({ t: "join", roomId, truckId: "driver-truck", token: driverToken });
  const driverJoin = await driver.waitFor((m) => m.t === "join-ok");
  assert(driverJoin.role === "DRIVER", "le joueur reçoit DRIVER");

  await sleep(2200); // laisse passer un cycle de diffusion des pseudos
  const playersMsg = await admin.waitFor((m) => m.t === "players");
  const adminEntry = playersMsg.players.find((p) => p.u === "Admin");
  const driverEntry = playersMsg.players.find((p) => p.u === "Driver");
  assert(adminEntry?.r === "ADMIN", "players expose r=ADMIN");
  assert(driverEntry?.r === "DRIVER", "players expose r=DRIVER");

  console.log("\n=== annonce ===");
  admin.send({ t: "announce", message: "Convoi dans 5 minutes" });
  const adminOk = await admin.waitFor((m) => m.t === "admin-ok" && m.action === "announce");
  assert(adminOk.detail === "Annonce diffusée", "l'admin reçoit admin-ok");
  const chat = await driver.waitFor((m) => m.t === "chat" && m.system === true);
  assert(chat.message === "Convoi dans 5 minutes", "le joueur reçoit l'annonce système");

  console.log("\n=== refus (joueur non admin) ===");
  driver.send({ t: "announce", message: "Je ne suis pas admin" });
  const refused = await driver.waitFor((m) => m.t === "error");
  assert(refused.reason === "Réservé aux admins", "annonce refusée au non-admin");

  console.log("\n=== météo / heure ===");
  admin.send({ t: "set-environment", weather: "rain", timeOfDay: 780 });
  const env = await driver.waitFor((m) => m.t === "environment" && m.weather === "rain");
  assert(env.weather === "rain", "météo partagée = rain");
  assert(env.timeOfDay === 780, "heure partagée = 780");

  admin.send({ t: "time", delta: 60 });
  const env2 = await driver.waitFor((m) => m.t === "environment" && m.timeOfDay === 840);
  assert(env2.timeOfDay === 840, "heure +60 min");

  console.log("\n=== kick ===");
  admin.send({ t: "kick", target: driverJoin.numId });
  const kicked = await driver.waitFor((m) => m.t === "kicked");
  assert(kicked.reason.length > 0, "le joueur reçoit kicked");
  const kickOk = await admin.waitFor((m) => m.t === "admin-ok" && m.action === "kick");
  assert(kickOk.detail.includes(String(driverJoin.numId)), "l'admin reçoit admin-ok");

  const room = await json(`/rooms/${roomId}`);
  assert(room.body.playerCount === 1, "le joueur expulsé n'est plus dans la salle");

  console.log("\n=== auto-expulsion ===");
  admin.send({ t: "kick", target: adminJoin.numId });
  const selfKick = await admin.waitFor((m) => m.t === "error");
  assert(selfKick.reason.includes("soi-même"), "auto-expulsion refusée");

  console.log("\n=== ban (via l'API) ===");
  const victim = makeClient();
  const victimToken = jwt.sign(
    { kind: "mp", sub: "u-victim", username: "Victime", role: "DRIVER" },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
  victim.send({ t: "join", roomId, truckId: "victim-truck", token: victimToken });
  const victimJoin = await victim.waitFor((m) => m.t === "join-ok");
  assert(typeof victimJoin.numId === "number", "le futur banni rejoint d'abord");

  await sleep(300);
  admin.send({ t: "ban", target: victimJoin.numId, reason: "Conduite dangereuse" });
  const victimKicked = await victim.waitFor((m) => m.t === "kicked");
  assert(victimKicked.reason.includes("Banni"), "le banni reçoit kicked");
  const banOk = await admin.waitFor((m) => m.t === "admin-ok" && m.action === "ban");
  assert(banOk.detail.includes("Conduite dangereuse"), "l'admin reçoit admin-ok");
  assert(bans.get("u-victim")?.reason === "Conduite dangereuse", "ban enregistré via l'API");

  victim.socket.close();
  const rejoin = makeClient();
  rejoin.send({ t: "join", roomId, truckId: "victim-truck", token: victimToken });
  const rejoinErr = await rejoin.waitFor((m) => m.t === "join-err");
  assert(rejoinErr.reason.includes("banni"), "un compte banni est refusé au join");
  rejoin.socket.close();

  admin.socket.close();
  driver.socket.close();
  server.stop();
  await new Promise((resolve) => apiServer.close(resolve));

  console.log("");
  if (failures === 0) {
    console.log("TOUS LES TESTS ADMIN PASSENT");
    process.exit(0);
  }
  console.log(`${failures} test(s) en échec`);
  process.exit(1);
}

main().catch((error) => {
  console.error("Erreur du test :", error);
  process.exit(1);
});
