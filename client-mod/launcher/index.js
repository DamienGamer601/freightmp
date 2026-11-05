/**
 * Launcher FreightMP — lance ETS2/ATS puis injecte la DLL client.
 *
 * Usage :
 *   node index.js ets2 --room <roomId> [--token <jetonMP>] [--truck-id <pseudo>]
 *   node index.js ats  --room <roomId> ...
 *
 * Variables (facultatif, sinon arguments) :
 *   FMP_MP_HOST, FMP_MP_PORT, FMP_MP_ROOM, FMP_MP_TOKEN, FMP_TRUCK_ID
 */

const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const GAME_PATHS = {
  ets2: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2\\bin\\win_x64\\eurotrucks2.exe",
  ats: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\American Truck Simulator\\bin\\win_x64\\amtrucks.exe",
};

function parseArgs(argv) {
  const args = { game: "ets2", room: "", token: "", truckId: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "ets2" || arg === "ats") args.game = arg;
    else if (arg === "--room") args.room = argv[++i] ?? "";
    else if (arg === "--token") args.token = argv[++i] ?? "";
    else if (arg === "--truck-id") args.truckId = argv[++i] ?? "";
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const exe = GAME_PATHS[args.game];
  if (!exe || !fs.existsSync(exe)) {
    console.error(`[launcher] Jeu introuvable : ${exe}`);
    process.exit(1);
  }

  const root = path.resolve(__dirname, "..");
  const dllPath = path.join(root, "build", "fmp-client.dll");
  const injectorPath = path.join(root, "build", "injector.exe");

  if (!fs.existsSync(dllPath) || !fs.existsSync(injectorPath)) {
    console.error("[launcher] Compile d'abord avec : .\\build.ps1");
    process.exit(1);
  }

  const env = {
    ...process.env,
    FMP_MP_HOST: process.env.FMP_MP_HOST ?? "127.0.0.1",
    FMP_MP_PORT: process.env.FMP_MP_PORT ?? "5000",
    FMP_MP_ROOM: args.room || process.env.FMP_MP_ROOM || "",
    FMP_MP_TOKEN: args.token || process.env.FMP_MP_TOKEN || "",
    FMP_TRUCK_ID: args.truckId || process.env.FMP_TRUCK_ID || "dll-client",
  };

  console.log(`[launcher] Lancement de ${path.basename(exe)}…`);
  const game = spawn(exe, [], { env, detached: true, stdio: "ignore" });
  game.unref();

  // Attend que le processus soit prêt.
  await new Promise((resolve) => setTimeout(resolve, 6000));

  // Retrouve le pid du jeu.
  const imageName = path.basename(exe);
  const pid = await findPid(imageName);
  if (!pid) {
    console.error(`[launcher] Processus ${imageName} introuvable.`);
    process.exit(1);
  }

  console.log(`[launcher] Injection dans pid=${pid}…`);
  execFile(
    injectorPath,
    [String(pid), dllPath],
    { windowsVerbatimArguments: false },
    (error, stdout, stderr) => {
      if (error) {
        console.error("[launcher] Injection échouée :", error.message);
        process.exit(1);
      }
      console.log(stdout.trim());
      console.log("[launcher] Injecté. La DLL lit ses variables d'environnement :");
      console.log(`   room=${env.FMP_MP_ROOM || "(à renseigner)"}`);
    },
  );
}

function findPid(imageName) {
  return new Promise((resolve) => {
    execFile(
      "tasklist",
      ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"],
      (error, stdout) => {
        if (error || !stdout) return resolve(null);
        const match = stdout.match(/"([^"]+)","(\d+)"/);
        resolve(match ? Number(match[2]) : null);
      },
    );
  });
}

main().catch((error) => {
  console.error("[launcher]", error);
  process.exit(1);
});
