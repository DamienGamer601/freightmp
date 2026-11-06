// Analyse un GeoJSON de carte de jeu : compte les types de géométrie et de
// propriétés `type` (et les `name` pour les villes).
import fs from "node:fs";
import readline from "node:readline";

const input = process.argv[2];
const geomCount = {};
const typeCount = {};
const namesByType = {};

const rl = readline.createInterface({
  input: fs.createReadStream(input, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed.startsWith('{"type":"Feature"')) return;
  let feature;
  try {
    feature = JSON.parse(trimmed);
  } catch {
    return;
  }
  const geom = feature.geometry;
  if (!geom) return;
  geomCount[geom.type] = (geomCount[geom.type] ?? 0) + 1;
  const t = feature.properties?.type ?? "(sans type)";
  typeCount[t] = (typeCount[t] ?? 0) + 1;
  if (feature.properties?.name) {
    namesByType[t] = (namesByType[t] ?? 0) + 1;
  }
});

rl.on("close", () => {
  console.log("Types de géométrie :", geomCount);
  console.log("Types de feature  :", typeCount);
  console.log("Avec name         :", namesByType);
});
