// Fusionne un GeoJSON de carte de jeu **en préservant les propriétés** dont
// dépendent les couches MapLibre (`type`, `name`) :
//   - Polygon  -> un MultiPolygon par `type`
//   - LineString -> un MultiLineString par `type`
//   - Point    -> un MultiPoint par (`type`, `name`) ou par `type` sans nom
// Les coordonnées sont arrondies pour réduire le poids.
//
// Usage : node merge-geojson.mjs <entree> <sortie> [decimales=6]
import fs from "node:fs";
import readline from "node:readline";

const [, , inputPath, outputPath, decimalsArg, toleranceArg] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: node merge-geojson.mjs <entree> <sortie> [decimales=5] [tolerance=0.00008]");
  process.exit(1);
}
const decimals = Math.max(3, Number(decimalsArg) || 5);
const tolerance = Number(toleranceArg) || 0.00008;
const factor = 10 ** decimals;

const roundCoord = (coord) => [
  Math.round(coord[0] * factor) / factor,
  Math.round(coord[1] * factor) / factor,
];

const polygons = new Map(); // type -> [ [ [x,y], ... ], ... ]
const lines = new Map(); // type -> [ [x,y], ... ][] (une ligne = un tableau de points)
const pointsByName = new Map(); // `${type}\u0000${name}` -> { type, name, coords: [] }
const pointsPlain = new Map(); // type -> [ [x,y], ... ]

function pushPolygonRing(coords) {
  const ring = coords.map(roundCoord);
  if (ring.length < 4) return;
  return ring;
}

function convertPolygon(coords, type) {
  const rings = coords.map(pushPolygonRing).filter(Boolean);
  if (rings.length === 0) return;
  if (!polygons.has(type)) polygons.set(type, []);
  polygons.get(type).push(rings);
}

function convertLine(coords, type) {
  if (SKIP_TYPES.has(type)) return;
  if (!Array.isArray(coords) || coords.length < 2) return;
  const line = simplifyLine(douglasPeucker(coords.map(roundCoord), tolerance));
  if (!lines.has(type)) lines.set(type, []);
  lines.get(type).push(line);
}

function convertPoint(coords, type, name) {
  if (SKIP_TYPES.has(type)) return;
  const point = roundCoord(coords);
  if (name) {
    const key = `${type}\u0000${name}`;
    if (!pointsByName.has(key)) pointsByName.set(key, { type, name, coords: [] });
    pointsByName.get(key).coords.push(point);
  } else {
    if (!pointsPlain.has(type)) pointsPlain.set(type, []);
    pointsPlain.get(type).push(point);
  }
}

/** Types non utilisés par les couches de la carte : on les ignore. */
const SKIP_TYPES = new Set(["poi", "traffic"]);

/** Distance perpendiculaire d'un point à un segment (approximation planaire). */
function distanceToSegment(point, start, end) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Douglas-Peucker : simplifie une ligne en conservant sa forme. */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distanceToSegment(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

/** Simplification légère : retire les points colinéaires d'une ligne. */
function simplifyLine(line) {
  if (line.length <= 2) return line;
  const out = [line[0]];
  for (let i = 1; i < line.length - 1; i += 1) {
    const a = out[out.length - 1];
    const b = line[i];
    const c = line[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(line[line.length - 1]);
  return out;
}

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let skipped = 0;
rl.on("line", (line) => {
  const trimmed = line.trim().replace(/,$/, "");
  if (!trimmed.startsWith('{"type":"Feature"')) return;
  let feature;
  try {
    feature = JSON.parse(trimmed);
  } catch {
    skipped += 1;
    return;
  }
  const geom = feature.geometry;
  if (!geom || !geom.coordinates) {
    skipped += 1;
    return;
  }
  const type = feature.properties?.type ?? "unknown";
  const name = feature.properties?.name;

  if (geom.type === "Polygon") {
    convertPolygon(geom.coordinates, type);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) convertPolygon(poly, type);
  } else if (geom.type === "LineString") {
    convertLine(geom.coordinates, type);
  } else if (geom.type === "MultiLineString") {
    for (const line of geom.coordinates) convertLine(line, type);
  } else if (geom.type === "Point") {
    convertPoint(geom.coordinates, type, name);
  } else if (geom.type === "MultiPoint") {
    for (const point of geom.coordinates) convertPoint(point, type, name);
  } else {
    skipped += 1;
  }
});

rl.on("close", () => {
  const features = [];

  for (const [type, polys] of polygons) {
    features.push({
      type: "Feature",
      properties: { type },
      geometry: { type: "MultiPolygon", coordinates: polys },
    });
  }
  for (const [type, lineList] of lines) {
    features.push({
      type: "Feature",
      properties: { type },
      geometry: {
        type: "MultiLineString",
        coordinates: lineList.map(simplifyLine),
      },
    });
  }
  for (const [type, pts] of pointsPlain) {
    if (pts.length === 1) {
      features.push({
        type: "Feature",
        properties: { type },
        geometry: { type: "Point", coordinates: pts[0] },
      });
    } else {
      features.push({
        type: "Feature",
        properties: { type },
        geometry: { type: "MultiPoint", coordinates: pts },
      });
    }
  }
  for (const { type, name, coords } of pointsByName.values()) {
    features.push({
      type: "Feature",
      properties: { type, name },
      geometry: { type: "MultiPoint", coordinates: coords },
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify({ type: "FeatureCollection", features }));
  const size = fs.statSync(outputPath).size;
  const summary = features
    .map((f) => f.properties.type)
    .reduce((acc, t) => ((acc[t] = (acc[t] ?? 0) + 1), acc), {});
  console.log(`${outputPath} : ${features.length} features, ${(size / 1024 / 1024).toFixed(2)} Mo`);
  console.log(`  types : ${JSON.stringify(summary)}`);
  if (skipped) console.log(`  ${skipped} features ignorées`);
});
