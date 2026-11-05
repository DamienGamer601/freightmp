// Fusionne un GeoJSON de carte de jeu en un seul MultiPolygon :
//  - supprime les propriétés répétées (~65% du poids),
//  - arrondit les coordonnées,
//  - optionnellement décime les anneaux.
//
// Usage : node merge-geojson.mjs <entree> <sortie> [decimales=5] [pas=1]
import fs from "node:fs";
import readline from "node:readline";

const [, , inputPath, outputPath, decimalsArg, stepArg] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: node merge-geojson.mjs <entree> <sortie> [decimales=5] [pas=1]");
  process.exit(1);
}
const decimals = Math.max(3, Number(decimalsArg) || 5);
const step = Math.max(1, Number(stepArg) || 1);
const factor = 10 ** decimals;

function roundCoord(coord) {
  return [Math.round(coord[0] * factor) / factor, Math.round(coord[1] * factor) / factor];
}

function simplifyRing(ring) {
  if (!Array.isArray(ring) || ring.length <= 4) {
    return ring.map(roundCoord);
  }
  const out = [];
  for (let i = 0; i < ring.length - 1; i += step) {
    out.push(roundCoord(ring[i]));
  }
  out.push(roundCoord(ring[ring.length - 1]));
  return out.length >= 4 ? out : ring.map(roundCoord);
}

const polygons = [];
let skipped = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed.startsWith('{"type":"Feature"')) {
    return;
  }
  let feature;
  try {
    feature = JSON.parse(trimmed);
  } catch {
    skipped += 1;
    return;
  }
  const geom = feature.geometry;
  if (!geom) {
    return;
  }
  if (geom.type === "Polygon") {
    polygons.push(geom.coordinates.map(simplifyRing));
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      polygons.push(poly.map(simplifyRing));
    }
  }
});

rl.on("close", () => {
  const merged = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } }] };
  fs.writeFileSync(outputPath, JSON.stringify(merged));
  const size = fs.statSync(outputPath).size;
  console.log(`${outputPath} : ${polygons.length} polygones, ${skipped} ignores, ${(size / 1024 / 1024).toFixed(2)} Mo`);
});
