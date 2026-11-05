// Simplifie les cartes GeoJSON du jeu (polygones auto-sécants que mapshaper
// ne peut pas réparer). Décime les anneaux + arrondit les coordonnées.
//
// Usage : node simplify-geojson.mjs <entree> <sortie> [pas] [decimales]
import fs from "node:fs";
import readline from "node:readline";

const [, , inputPath, outputPath, stepArg, decimalsArg] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: node simplify-geojson.mjs <entree> <sortie> [pas=4] [decimales=6]");
  process.exit(1);
}
const step = Math.max(1, Number(stepArg) || 4);
const decimals = Math.max(3, Number(decimalsArg) || 6);
const factor = 10 ** decimals;

function roundCoord(coord) {
  if (Array.isArray(coord)) {
    return [Math.round(coord[0] * factor) / factor, Math.round(coord[1] * factor) / factor];
  }
  return coord;
}

function simplifyRing(ring, step) {
  if (!Array.isArray(ring) || ring.length <= 4) {
    return ring;
  }
  const out = [];
  for (let i = 0; i < ring.length - 1; i += step) {
    out.push(roundCoord(ring[i]));
  }
  // Ferme l'anneau avec le dernier point d'origine.
  out.push(roundCoord(ring[ring.length - 1]));
  return out.length >= 4 ? out : ring.map(roundCoord);
}

function simplifyGeometry(geometry) {
  if (!geometry) {
    return geometry;
  }
  if (geometry.type === "Polygon") {
    geometry.coordinates = geometry.coordinates.map((ring) => simplifyRing(ring, step));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates = geometry.coordinates.map((poly) =>
      poly.map((ring) => simplifyRing(ring, step)),
    );
  }
  return geometry;
}

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});
const out = fs.createWriteStream(outputPath, { encoding: "utf8" });

let first = true;
let kept = 0;
out.write('{"type":"FeatureCollection","features":[\n');

rl.on("line", (line) => {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed.startsWith('{"type":"Feature"')) {
    return;
  }
  let feature;
  try {
    feature = JSON.parse(trimmed);
  } catch {
    return;
  }
  feature = simplifyGeometry(feature);
  out.write((first ? "" : ",\n") + JSON.stringify(feature));
  first = false;
  kept += 1;
});

rl.on("close", () => {
  out.write("\n]}\n");
  out.end(() => {
    const size = fs.statSync(outputPath).size;
    console.log(`${outputPath} : ${kept} features, ${(size / 1024 / 1024).toFixed(2)} Mo`);
  });
});
