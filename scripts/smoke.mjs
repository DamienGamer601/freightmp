/**
 * Smoke test de la pile FreightMP.
 *
 * Vérifie : API publique, endpoints admin (si jeton fourni), serveur MP et
 * pont WebSocket.
 *
 * Usage :
 *   node scripts/smoke.mjs
 *   $env:SMOKE_ADMIN_TOKEN="<jwt>"; node scripts/smoke.mjs
 */

const API = (process.env.SMOKE_API ?? "http://localhost:4000").replace(/\/+$/, "");
const MP = (process.env.SMOKE_MP ?? "http://localhost:5001").replace(/\/+$/, "");
const WS = process.env.SMOKE_WS ?? `${MP.replace(/^http/, "ws")}/ws`;
const ADMIN_TOKEN = process.env.SMOKE_ADMIN_TOKEN ?? "";

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`❌ ${name} — ${error.message}`);
  }
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log(`\n=== API publique (${API}) ===`);
  await check("health", async () => {
    const data = await getJson(`${API}/api/v1/health`);
    assert(data.status === "ok", "statut inattendu");
  });
  await check("servers/status", async () => {
    const data = await getJson(`${API}/api/v1/servers/status`);
    assert(Array.isArray(data.servers), "servers manquant");
    assert(typeof data.totalOnline === "number", "totalOnline manquant");
  });
  await check("leaderboard", async () => {
    const data = await getJson(`${API}/api/v1/leaderboard?metric=km`);
    assert(Array.isArray(data.entries), "entries manquant");
  });
  await check("announcements", async () => {
    const data = await getJson(`${API}/api/v1/announcements`);
    assert(Array.isArray(data), "liste attendue");
  });
  await check("events", async () => {
    const data = await getJson(`${API}/api/v1/events`);
    assert(Array.isArray(data), "liste attendue");
  });
  await check("profil public", async () => {
    const data = await getJson(`${API}/api/v1/profiles/FIC-Admin`);
    assert(data.username === "FIC-Admin", "profil inattendu");
  });

  if (ADMIN_TOKEN) {
    console.log(`\n=== Admin (jeton fourni) ===`);
    const headers = { Authorization: `Bearer ${ADMIN_TOKEN}` };
    await check("admin dashboard", async () => {
      const data = await getJson(`${API}/api/v1/admin/dashboard`, headers);
      assert(typeof data.users === "number", "users manquant");
    });
    await check("admin users", async () => {
      const data = await getJson(`${API}/api/v1/admin/users`, headers);
      assert(Array.isArray(data), "liste attendue");
    });
    await check("admin events", async () => {
      const data = await getJson(`${API}/api/v1/admin/events`, headers);
      assert(Array.isArray(data), "liste attendue");
    });
    await check("admin audit-log", async () => {
      const data = await getJson(`${API}/api/v1/admin/audit-log`, headers);
      assert(Array.isArray(data), "liste attendue");
    });
  } else {
    console.log("\nℹ️  SMOKE_ADMIN_TOKEN absent : tests admin ignorés.");
  }

  console.log(`\n=== Serveur multijoueur (${MP}) ===`);
  await check("MP health", async () => {
    const data = await getJson(`${MP}/health`);
    assert(data.ok === true, "health KO");
  });
  await check("MP rooms", async () => {
    const data = await getJson(`${MP}/rooms`);
    assert(Array.isArray(data.rooms), "rooms manquant");
  });

  if (typeof globalThis.WebSocket === "function") {
    await check("MP WebSocket bridge", async () => {
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(WS);
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error("timeout"));
        }, 5000);
        socket.onmessage = (event) => {
          clearTimeout(timer);
          socket.close();
          const data = JSON.parse(event.data);
          if (!data.type) {
            reject(new Error("message sans type"));
          } else {
            resolve();
          }
        };
        socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error("erreur WebSocket"));
        };
      });
    });
  } else {
    console.log("ℹ️  WebSocket global indisponible : test WS ignoré.");
  }

  console.log(`\n=== Résultat : ${passed} OK, ${failed} échec(s) ===\n`);
  // Laisse le temps au WebSocket de se fermer proprement (évite un assert libuv).
  await new Promise((resolve) => setTimeout(resolve, 250));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Erreur fatale :", error);
  process.exit(1);
});
