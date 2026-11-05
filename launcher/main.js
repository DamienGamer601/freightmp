const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  Notification,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const API_URL = process.env.FMP_API_URL ?? "http://localhost:4000";
const MP_URL = process.env.FMP_MP_URL ?? "http://localhost:5001";
const SITE_URL = process.env.FMP_SITE_URL ?? "http://localhost:3000";

const ROOT = path.join(__dirname, "..");
const DLL_PATH = path.join(ROOT, "client-mod", "build", "fmp-client.dll");
const INJECTOR_PATH = path.join(ROOT, "client-mod", "build", "injector.exe");
const ICON_PATH = path.join(__dirname, "assets", "icon.png");
const LOGO_PATH = path.join(__dirname, "assets", "logo.png");

const GAME_PATHS = {
  ets2: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2\\bin\\win_x64\\eurotrucks2.exe",
  ats: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\American Truck Simulator\\bin\\win_x64\\amtrucks.exe",
};

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const DEFAULT_CONFIG = {
  game: "ets2",
  gamePath: "",
  token: "",
  truckId: "",
  room: "",
};

/* ---------- Config ---------- */

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

/* ---------- HTTP ---------- */

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const request = lib.get(url, { timeout: 5000 }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
  });
}

/* ---------- Jeu ---------- */

function waitForPid(imageName, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      execFile(
        "tasklist",
        ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"],
        (error, stdout) => {
          if (!error && stdout) {
            const match = stdout.match(/"([^"]+)","(\d+)"/);
            if (match) {
              resolve(Number(match[2]));
              return;
            }
          }
          if (Date.now() - started > timeoutMs) {
            resolve(null);
            return;
          }
          setTimeout(tick, 1500);
        },
      );
    };
    tick();
  });
}

/* ---------- IPC ---------- */

ipcMain.handle("config:load", () => loadConfig());
ipcMain.handle("config:save", (_event, config) => {
  saveConfig({ ...DEFAULT_CONFIG, ...config });
  return true;
});

ipcMain.handle("games:detect", () => {
  const config = loadConfig();
  const result = {};
  for (const [key, candidate] of Object.entries(GAME_PATHS)) {
    result[key] = { path: candidate, exists: fs.existsSync(candidate) };
  }
  result.custom = { path: config.gamePath, exists: Boolean(config.gamePath && fs.existsSync(config.gamePath)) };
  return result;
});

ipcMain.handle("servers:fetch", async () => {
  const result = { api: false, mp: false, servers: [], rooms: [] };

  try {
    const data = await fetchJson(`${API_URL}/api/v1/servers/status`);
    result.api = true;
    result.servers = data.servers ?? [];
  } catch {
    result.api = false;
  }

  try {
    const data = await fetchJson(`${MP_URL}/rooms`);
    result.mp = true;
    result.rooms = data.rooms ?? [];
  } catch {
    result.mp = false;
  }

  return result;
});

ipcMain.handle("site:open", () => {
  shell.openExternal(`${SITE_URL}/multiplayer`);
  return true;
});

ipcMain.handle("news:fetch", async () => {
  try {
    const data = await fetchJson(`${API_URL}/api/v1/announcements`);
    return { ok: true, items: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, items: [] };
  }
});

/* ---------- Amis (session web) ---------- */

function fetchJsonWithAuth(url, accessToken) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const request = lib.request(
      parsed,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function currentAccessToken() {
  try {
    const cookies = await session.defaultSession.cookies.get({ url: API_URL });
    const access = cookies.find((cookie) => cookie.name === "fmp_access");
    return access?.value ?? null;
  } catch {
    return null;
  }
}

/** Requête JSON authentifiée (GET/POST/PATCH/DELETE). */
function requestJsonWithAuth(url, method, accessToken, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const body =
      payload === undefined ? undefined : JSON.stringify(payload);
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const request = lib.request(parsed, { method, headers }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        try {
          const data = responseBody ? JSON.parse(responseBody) : null;
          if (response.statusCode >= 400) {
            reject(new Error(data?.error?.message ?? `HTTP ${response.statusCode}`));
            return;
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    if (body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

/* ---------- Liaison de comptes (Steam ↔ Discord) ---------- */

ipcMain.handle("auth:link", async (event, provider) => {
  if (provider !== "steam" && provider !== "discord") {
    return { ok: false, error: "Fournisseur invalide" };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Connectez-vous d'abord." };
  }

  let linkUrl;
  try {
    const data = await requestJsonWithAuth(
      `${API_URL}/api/v1/me/link/${provider}`,
      "POST",
      accessToken,
    );
    linkUrl = data?.url;
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (!linkUrl) {
    return { ok: false, error: "URL de liaison indisponible." };
  }

  return new Promise((resolve) => {
    const linkWindow = new BrowserWindow({
      width: 540,
      height: 760,
      parent,
      modal: true,
      title: "Lier un compte FreightMP",
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (!linkWindow.isDestroyed()) {
        linkWindow.close();
      }
      resolve(result);
    };

    const timeout = setTimeout(
      () => finish({ ok: false, error: "Délai dépassé. Réessayez." }),
      120_000,
    );

    linkWindow.webContents.on("did-navigate", (_event, navigatedUrl) => {
      if (navigatedUrl.includes("/auth/callback")) {
        const linked = navigatedUrl.includes("linked=");
        finish({ ok: linked, url: navigatedUrl });
      }
    });

    linkWindow.on("closed", () => finish({ ok: false, error: "Fenêtre fermée." }));
    linkWindow.loadURL(linkUrl);
  });
});

ipcMain.handle("auth:unlink", async (_event, provider) => {
  if (provider !== "steam" && provider !== "discord") {
    return { ok: false, error: "Fournisseur invalide" };
  }
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Connectez-vous d'abord." };
  }
  try {
    await requestJsonWithAuth(
      `${API_URL}/api/v1/me/unlink/${provider}`,
      "POST",
      accessToken,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("auth:logout", async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ["cookies"],
      origins: [API_URL],
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("api:post", async (_event, { path, body }) => {
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, status: 401, data: null };
  }
  try {
    const data = await requestJsonWithAuth(
      `${API_URL}${path}`,
      "POST",
      accessToken,
      body,
    );
    return { ok: true, status: 200, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message, data: null };
  }
});

ipcMain.handle("friends:fetch", async () => {
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, friends: [] };
  }
  try {
    const data = await fetchJsonWithAuth(`${API_URL}/api/v1/friends`, accessToken);
    return { ok: true, friends: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, friends: [] };
  }
});

ipcMain.handle("profile:fetch", async () => {
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, profile: null };
  }
  try {
    const data = await fetchJsonWithAuth(`${API_URL}/api/v1/me`, accessToken);
    return { ok: true, profile: data ?? null };
  } catch {
    return { ok: false, profile: null };
  }
});

ipcMain.handle("game:status", async () => {
  const imageNameAts = "amtrucks.exe";
  const running = await new Promise((resolve) => {
    execFile(
      "tasklist",
      ["/FI", "IMAGENAME eq eurotrucks2.exe", "/FO", "CSV", "/NH"],
      (error, stdout) => {
        if (!error && stdout && stdout.includes("eurotrucks2")) {
          resolve("ETS2");
          return;
        }
        execFile(
          "tasklist",
          ["/FI", `IMAGENAME eq ${imageNameAts}`, "/FO", "CSV", "/NH"],
          (error2, stdout2) => {
            resolve(!error2 && stdout2 && stdout2.includes("amtrucks") ? "ATS" : null);
          },
        );
      },
    );
  });
  return { running };
});

/* ---------- Joueurs en ligne ---------- */

ipcMain.handle("players:fetch", async () => {
  try {
    const rooms = await fetchJson(`${MP_URL}/rooms`);
    const list = Array.isArray(rooms.rooms) ? rooms.rooms : [];
    const players = [];

    for (const room of list) {
      try {
        const detail = await fetchJson(`${MP_URL}/rooms/${room.id}`);
        for (const player of detail.players ?? []) {
          players.push({ ...player, roomName: room.name });
        }
      } catch {
        /* salle injoignable */
      }
    }

    return { ok: true, players };
  } catch {
    return { ok: false, players: [] };
  }
});

/* ---------- Mise à jour ---------- */

function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

ipcMain.handle("update:check", async () => {
  const current = require("./package.json").version;
  let latest = null;
  let notes = null;
  let url = null;

  const localPath = path.join(__dirname, "..", "update.json");
  if (fs.existsSync(localPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localPath, "utf8"));
      latest = data.version ?? null;
      notes = data.notes ?? null;
      url = data.url ?? null;
    } catch {
      /* ignore */
    }
  }

  if (process.env.FMP_UPDATE_URL) {
    try {
      const data = await fetchJson(process.env.FMP_UPDATE_URL);
      if (data.version) {
        latest = data.version;
        notes = data.notes ?? notes;
        url = data.url ?? url;
      }
    } catch {
      /* ignore */
    }
  }

  const available = latest ? compareVersions(latest, current) > 0 : false;
  return { ok: true, current, latest, available, notes, url };
});

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", reject);
  });
}

function copyDirSync(source, destination, exclude = []) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) {
      continue;
    }
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyDirSync(from, to, exclude);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

ipcMain.handle("update:apply", async () => {
  const localPath = path.join(__dirname, "..", "update.json");
  let zipPath = null;
  let zipUrl = null;

  if (fs.existsSync(localPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localPath, "utf8"));
      if (data.zip) {
        if (/^https?:\/\//i.test(data.zip)) {
          zipUrl = data.zip;
        } else {
          zipPath = path.resolve(path.join(__dirname, ".."), data.zip);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!zipPath && !zipUrl) {
    return { ok: false, error: "Aucun paquet (zip) défini dans update.json." };
  }

  const stamp = Date.now();
  const tempRoot = path.join(app.getPath("temp"), `fmp-update-${stamp}`);
  const zipFile = path.join(app.getPath("temp"), `fmp-update-${stamp}.zip`);

  try {
    fs.mkdirSync(tempRoot, { recursive: true });

    if (zipUrl) {
      await downloadFile(zipUrl, zipFile);
    } else {
      fs.copyFileSync(zipPath, zipFile);
    }

    await new Promise((resolve, reject) => {
      execFile(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zipFile}' -DestinationPath '${tempRoot}' -Force`,
        ],
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });

    // Certains zips contiennent un dossier racine : on le détecte.
    let contentRoot = tempRoot;
    const entries = fs.readdirSync(tempRoot, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
      contentRoot = path.join(tempRoot, entries[0].name);
    }

    copyDirSync(contentRoot, __dirname, ["node_modules", "package-lock.json"]);

    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

/* ---------- Proxy API générique (session web) ---------- */

ipcMain.handle("api:get", async (_event, apiPath) => {
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, status: 401, data: null };
  }
  try {
    const data = await fetchJsonWithAuth(`${API_URL}${apiPath}`, accessToken);
    return { ok: true, status: 200, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message, data: null };
  }
});

/* ---------- Météo / heure partagées (serveur MP) ---------- */

ipcMain.handle("mp:setEnvironment", async (_event, payload) => {
  return new Promise((resolve) => {
    const url = new URL(
      `${MP_URL}/rooms/${encodeURIComponent(payload.roomId)}/environment`,
    );
    const lib = url.protocol === "https:" ? https : http;
    const body = JSON.stringify({
      weather: payload.weather,
      timeOfDay: payload.timeOfDay,
    });
    const request = lib.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* ignore */
          }
          resolve({ ok: response.statusCode < 400, data: parsed });
        });
      },
    );
    request.on("error", (error) => resolve({ ok: false, error: error.message }));
    request.write(body);
    request.end();
  });
});

ipcMain.handle("mp:getRoom", async (_event, roomId) => {
  try {
    const data = await fetchJson(
      `${MP_URL}/rooms/${encodeURIComponent(roomId)}`,
    );
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("app:openConfigFolder", () => {
  shell.openPath(app.getPath("userData"));
  return true;
});

/* ---------- Notifications OS ---------- */

ipcMain.handle("notify:show", (_event, payload) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: payload?.title ?? "FreightMP",
        body: payload?.body ?? "",
        icon: LOGO_PATH,
        silent: true,
      }).show();
    }
  } catch {
    /* ignore */
  }
  return true;
});

/* ---------- Logs fichier ---------- */

ipcMain.handle("log:write", (_event, message) => {
  try {
    const file = path.join(app.getPath("userData"), "launcher.log");
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    /* ignore */
  }
  return true;
});

ipcMain.handle("logs:read", () => {
  const sources = {
    launcher: path.join(app.getPath("userData"), "launcher.log"),
    dll: path.join(app.getPath("temp"), "fmp-client.log"),
    mp: path.join(ROOT, "mp-server", "mp-server.log"),
  };
  const result = {};
  for (const [key, file] of Object.entries(sources)) {
    try {
      const stat = fs.statSync(file);
      result[key] = {
        path: file,
        size: stat.size,
        content: fs.readFileSync(file, "utf8").slice(-20000),
      };
    } catch {
      result[key] = null;
    }
  }
  return result;
});

ipcMain.handle("logs:clear", () => {
  for (const file of [
    path.join(app.getPath("userData"), "launcher.log"),
    path.join(app.getPath("temp"), "fmp-client.log"),
  ]) {
    try {
      fs.writeFileSync(file, "", "utf8");
    } catch {
      /* ignore */
    }
  }
  return true;
});

/* ---------- Version client + plugins ---------- */

ipcMain.handle("client:version", () => {
  const result = { dll: null, injector: null, manifest: null };
  try {
    const stat = fs.statSync(DLL_PATH);
    result.dll = { path: DLL_PATH, size: stat.size, mtime: stat.mtime.toISOString() };
  } catch {
    /* ignore */
  }
  try {
    const stat = fs.statSync(INJECTOR_PATH);
    result.injector = {
      path: INJECTOR_PATH,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  } catch {
    /* ignore */
  }
  try {
    result.manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, "client-mod", "version.json"), "utf8"),
    );
  } catch {
    /* ignore */
  }
  return result;
});

ipcMain.handle("plugins:list", () => {
  const config = loadConfig();
  const gamePath = config.gamePath || GAME_PATHS[config.game];
  const pluginsDir = gamePath
    ? path.join(path.dirname(gamePath), "plugins")
    : path.join(ROOT, "client-mod", "build");
  const result = { dir: pluginsDir, exists: fs.existsSync(pluginsDir), plugins: [] };
  if (result.exists) {
    for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
      if (entry.name.toLowerCase().endsWith(".dll")) {
        try {
          const stat = fs.statSync(path.join(pluginsDir, entry.name));
          result.plugins.push({
            name: entry.name,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return result;
});

/* ---------- API PATCH (session web) ---------- */

ipcMain.handle("api:patch", async (_event, payload) => {
  const accessToken = await currentAccessToken();
  if (!accessToken) {
    return { ok: false, status: 401, data: null };
  }
  return new Promise((resolve) => {
    const url = new URL(`${API_URL}${payload.path}`);
    const lib = url.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload.body ?? {});
    const request = lib.request(
      url,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* ignore */
          }
          resolve({
            ok: response.statusCode < 400,
            status: response.statusCode,
            data: parsed,
          });
        });
      },
    );
    request.on("error", (error) => resolve({ ok: false, status: 0, error: error.message }));
    request.write(body);
    request.end();
  });
});

ipcMain.handle("app:paths", () => ({
  userData: app.getPath("userData"),
  appVersion: app.getVersion(),
  apiUrl: API_URL,
  mpUrl: MP_URL,
  siteUrl: SITE_URL,
  dll: DLL_PATH,
  injector: INJECTOR_PATH,
}));

/* ---------- Login embarqué (Steam / Discord) ---------- */

function fetchMpToken(accessToken) {
  return new Promise((resolve) => {
    const url = new URL("/api/v1/mp/token", API_URL);
    const lib = url.protocol === "https:" ? https : http;
    const request = lib.request(
      url,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (!data.token) {
              resolve({ ok: false, error: "Jeton MP absent de la réponse" });
              return;
            }
            resolve({
              ok: true,
              token: data.token,
              username: data.username ?? null,
              tag: data.tag ?? null,
              country: data.country ?? null,
              avatarUrl: data.avatarUrl ?? null,
            });
          } catch {
            resolve({ ok: false, error: "Réponse invalide de l'API" });
          }
        });
      },
    );
    request.on("error", (error) => resolve({ ok: false, error: error.message }));
    request.end();
  });
}

ipcMain.handle("login", async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender);

  return new Promise((resolve) => {
    const loginWindow = new BrowserWindow({
      width: 540,
      height: 760,
      parent,
      modal: true,
      title: "Connexion FreightMP",
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    loginWindow.loadURL(SITE_URL);

    let settled = false;
    let timer;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(timer);
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      resolve(result);
    };

    timer = setInterval(async () => {
      try {
        const cookies = await session.defaultSession.cookies.get({ url: API_URL });
        const access = cookies.find((cookie) => cookie.name === "fmp_access");
        if (access && access.value) {
          const result = await fetchMpToken(access.value);
          if (result.ok) {
            finish(result);
          }
        }
      } catch {
        /* on réessaie au prochain tick */
      }
    }, 900);

    loginWindow.on("closed", () => {
      if (!settled) {
        settled = true;
        clearInterval(timer);
        resolve({ ok: false, error: "Fenêtre fermée" });
      }
    });
  });
});

ipcMain.handle("launch", async (_event, params) => {
  const config = { ...loadConfig(), ...params };
  saveConfig(config);

  const exe = config.gamePath || GAME_PATHS[config.game];
  if (!exe || !fs.existsSync(exe)) {
    return { ok: false, error: `Jeu introuvable : ${exe}` };
  }
  if (!fs.existsSync(DLL_PATH) || !fs.existsSync(INJECTOR_PATH)) {
    return { ok: false, error: "Compile d'abord le client : cd client-mod; .\\build.ps1" };
  }

  const env = {
    ...process.env,
    FMP_MP_HOST: process.env.FMP_MP_HOST ?? "127.0.0.1",
    FMP_MP_PORT: process.env.FMP_MP_PORT ?? "5000",
    FMP_MP_ROOM: config.room ?? "",
    FMP_MP_TOKEN: config.token ?? "",
    FMP_TRUCK_ID: config.truckId || "launcher-client",
  };

  const imageName = path.basename(exe);
  try {
    const game = spawn(exe, [], { env, detached: true, stdio: "ignore" });
    game.unref();
  } catch (error) {
    return { ok: false, error: `Lancement impossible : ${error.message}` };
  }

  const pid = await waitForPid(imageName);
  if (!pid) {
    return { ok: false, error: `Processus ${imageName} introuvable.` };
  }

  const injection = await new Promise((resolve) => {
    execFile(INJECTOR_PATH, [String(pid), DLL_PATH], (error, stdout, stderr) => {
      resolve({
        ok: !error,
        pid,
        output: String(stdout ?? "").trim(),
        error: error ? String(stderr || error.message).trim() : null,
      });
    });
  });

  return injection;
});

/* ---------- Fenêtre ---------- */

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0B0E11",
    autoHideMenuBar: true,
    title: "FreightMP Launcher",
    icon: LOGO_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Réduit dans la tray au lieu de quitter.
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupTray() {
  try {
    const image = nativeImage.createFromPath(LOGO_PATH).resize({ width: 32, height: 32 });
    tray = new Tray(image);
    const menu = Menu.buildFromTemplate([
      {
        label: "Ouvrir FreightMP",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        },
      },
      {
        label: "Jouer",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send("tray:play");
          }
        },
      },
      { type: "separator" },
      {
        label: "Quitter",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setToolTip("FreightMP Launcher");
    tray.setContextMenu(menu);
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch {
    /* tray indisponible */
  }
}

app.whenReady().then(() => {
  setupTray();
  createWindow();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
