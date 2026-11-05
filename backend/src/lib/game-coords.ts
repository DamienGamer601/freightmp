/**
 * Conversion entre les coordonnées du jeu (ETS2/ATS, en mètres) et WGS84
 * (longitude/latitude), identique à celle utilisée par le projet TruckerMudgeon
 * (https://github.com/truckermudgeon/maps — packages/libs/map/projections.ts).
 *
 * Les paramètres proviennent de `def/climate.sii` des jeux :
 *  - ETS2 : projection LCC, mapOffset [16660, 4150], mapFactor, lat_0=50, lon_0=15
 *  - ATS  : projection LCC, lat_0=39, lon_0=-96
 *
 * NOTE : le « hack UK » de TruckerMudgeon (échelle 0.75 pour le Royaume-Uni)
 * n'est volontairement pas reproduit ici ; il n'affecte que le contenu UK.
 */
import proj4 from "proj4";

const earthRadiusMeters = 6_370_997;
const lengthOfDegree = (earthRadiusMeters * Math.PI) / 180;

export type GameId = "ETS2" | "ATS";
export type LngLat = [number, number]; // [lng, lat]
export type GameCoords = [number, number]; // [x, z] en mètres

const atsProjection = proj4(
  `+proj=lcc +R=${earthRadiusMeters} +lat_1=33 +lat_2=45 +lat_0=39 +lon_0=-96`,
);
const atsMapFactor = [-0.00017706234, 0.000176689948];

const ets2Projection = proj4(
  `+proj=lcc +R=${earthRadiusMeters} +lat_1=37 +lat_2=65 +lat_0=50 +lon_0=15`,
);
const ets2MapOffset = [16660, 4150];
const ets2MapFactor = [-0.000171570875, 0.0001729241463];

/** Coordonnées jeu (x, z en mètres) → WGS84 [lng, lat]. */
export function gameToWgs84(game: GameId, x: number, z: number): LngLat {
  if (game === "ATS") {
    const lcc: LngLat = [
      x * atsMapFactor[1] * lengthOfDegree,
      z * atsMapFactor[0] * lengthOfDegree,
    ];
    return atsProjection.inverse(lcc);
  }

  const gx = x - ets2MapOffset[0];
  const gz = z - ets2MapOffset[1];
  const lcc: LngLat = [
    gx * ets2MapFactor[1] * lengthOfDegree,
    gz * ets2MapFactor[0] * lengthOfDegree,
  ];
  return ets2Projection.inverse(lcc);
}

/** WGS84 [lng, lat] → coordonnées jeu (x, z en mètres). */
export function wgs84ToGame(game: GameId, lng: number, lat: number): GameCoords {
  if (game === "ATS") {
    const lcc = atsProjection.forward([lng, lat]);
    return [
      lcc[0] / atsMapFactor[1] / lengthOfDegree,
      lcc[1] / atsMapFactor[0] / lengthOfDegree,
    ];
  }

  const lcc = ets2Projection.forward([lng, lat]);
  return [
    lcc[0] / ets2MapFactor[1] / lengthOfDegree + ets2MapOffset[0],
    lcc[1] / ets2MapFactor[0] / lengthOfDegree + ets2MapOffset[1],
  ];
}
