"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type Map as MaplibreMap,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  fetchTelemetrySnapshot,
  getWsUrl,
  type TruckTelemetry,
} from "@/lib/telemetry";

type ViewMode = "markers" | "heatmap";

const GAME_COLORS: Record<string, string> = {
  ETS2: "#E23A3A",
  ATS: "#F59E0B",
};
const DEFAULT_COLOR = "#E23A3A";

const HEAT_MAX_POINTS = 5000;
const GAME_MAP_URL = "/map/ets2.geojson";

interface TelemetryWsMessage {
  type: string;
  payload?: TruckTelemetry;
  at?: string;
}

function colorFor(game: string): string {
  return GAME_COLORS[game] ?? DEFAULT_COLOR;
}

function truckToFeature(t: TruckTelemetry): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [t.longitude ?? 0, t.latitude ?? 0],
    },
    properties: { truckId: t.truckId, game: t.game ?? "ETS2" },
  };
}

function addGameMapLayers(
  map: MaplibreMap,
  sourceId: string,
  url: string,
  prefix: string,
): void {
  map.addSource(sourceId, { type: "geojson", data: url });

  map.addLayer({
    id: `${prefix}-mapArea`,
    type: "fill",
    source: sourceId,
    filter: ["==", ["get", "type"], "mapArea"],
    paint: { "fill-color": "#14181d" },
  });
  map.addLayer({
    id: `${prefix}-prefab`,
    type: "fill",
    source: sourceId,
    filter: ["==", ["get", "type"], "prefab"],
    paint: { "fill-color": "#23272b", "fill-opacity": 0.85 },
  });
  map.addLayer({
    id: `${prefix}-ferry`,
    type: "line",
    source: sourceId,
    filter: ["==", ["get", "type"], "ferry"],
    paint: {
      "line-color": "#3b82f6",
      "line-width": 1.2,
      "line-dasharray": [2, 2],
    },
  });
  map.addLayer({
    id: `${prefix}-road`,
    type: "line",
    source: sourceId,
    filter: ["==", ["get", "type"], "road"],
    paint: { "line-color": "#a7b0ba", "line-width": 1.1 },
  });
  map.addLayer({
    id: `${prefix}-city`,
    type: "symbol",
    source: sourceId,
    filter: ["==", ["get", "type"], "city"],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-font": ["Noto Sans Regular"],
    },
    paint: {
      "text-color": "#e5e7eb",
      "text-halo-color": "#08090b",
      "text-halo-width": 1.5,
    },
  });
}

export default function LiveMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MaplibreMap | null>(null);
  const currentRef = useRef<Map<string, TruckTelemetry>>(new Map());
  const trailRef = useRef<Array<[number, number]>>([]);

  const [count, setCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("markers");

  function applyMode(map: MaplibreMap, m: ViewMode): void {
    if (!map.getLayer("truck-circles")) return;
    map.setLayoutProperty(
      "truck-circles",
      "visibility",
      m === "markers" ? "visible" : "none",
    );
    map.setLayoutProperty(
      "truck-heat",
      "visibility",
      m === "heatmap" ? "visible" : "none",
    );
  }

  function refreshTrucks(map: MaplibreMap): void {
    const current = Array.from(currentRef.current.values()).map(truckToFeature);
    const trail: GeoJSON.Feature<GeoJSON.Point>[] = trailRef.current.map(
      ([lng, lat]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      }),
    );

    (map.getSource("trucks") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: current,
    });
    (map.getSource("trucks-trail") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: trail,
    });
  }

  function handleTruck(truck: TruckTelemetry): void {
    if (truck.latitude == null || truck.longitude == null) return;
    currentRef.current.set(truck.truckId, truck);
    trailRef.current.push([truck.longitude, truck.latitude]);
    if (trailRef.current.length > HEAT_MAX_POINTS) {
      trailRef.current.splice(0, trailRef.current.length - HEAT_MAX_POINTS);
    }
    setCount(currentRef.current.size);

    const map = mapInstanceRef.current;
    if (map && map.loaded()) refreshTrucks(map);
  }

  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstanceRef.current) return;

    let active = true;
    setCount(0);
    setError(null);

    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {},
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": "#08090b" },
          },
        ],
      },
      center: [12, 51],
      zoom: 5,
      minZoom: 3,
      maxZoom: 14,
    });
    mapInstanceRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    map.on("load", () => {
      // ---- Fond de carte : cartes du jeu (GeoJSON ETS2 + ATS) ----
      addGameMapLayers(map, "gamemap-eu", "/map/ets2.geojson", "eu");
      addGameMapLayers(map, "gamemap-usa", "/map/ats.geojson", "usa");

      // ---- Camions ----
      map.addSource("trucks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("trucks-trail", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "truck-circles",
        type: "circle",
        source: "trucks",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "game"],
            "ATS",
            "#F59E0B",
            "#E23A3A",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "truck-heat",
        type: "heatmap",
        source: "trucks-trail",
        paint: {
          "heatmap-weight": 0.5,
          "heatmap-radius": 25,
          "heatmap-intensity": 1,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(56,189,248,0)",
            0.35,
            "#38bdf8",
            0.6,
            "#fbbf24",
            0.8,
            "#f97316",
            1,
            "#e23a3a",
          ],
        },
      });

      applyMode(map, "markers");

      // Snapshot initial.
      fetchTelemetrySnapshot()
        .then((snapshot) => {
          if (active) snapshot.trucks.forEach(handleTruck);
        })
        .catch(() => {
          if (active) setError("Impossible de joindre l'API de télémétrie.");
        });

      // Flux temps réel via WebSocket.
      try {
        const ws = new WebSocket(getWsUrl());
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "subscribe", channel: "telemetry" }));
        };
        ws.onmessage = (event) => {
          if (!active) return;
          let msg: TelemetryWsMessage;
          try {
            msg = JSON.parse(event.data) as TelemetryWsMessage;
          } catch {
            return;
          }
          if (msg.type === "telemetry:update" && msg.payload) {
            handleTruck(msg.payload);
          }
        };
        ws.onerror = () => {
          if (active) setError("Connexion temps réel indisponible.");
        };
      } catch {
        if (active) setError("Connexion temps réel indisponible.");
      }
    });

    return () => {
      active = false;
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.loaded()) return;
    applyMode(map, mode);
  }, [mode]);

  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-rouge-400">
              Télémétrie
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              🛺 Carte en direct
            </h1>
            <p className="mt-2 text-zinc-400">
              Position en temps réel des camions connectés — fond de carte ETS2.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-charbon-800/70 px-4 py-3 text-sm text-zinc-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span>
                <span className="font-semibold text-white">{count}</span>{" "}
                camion{count > 1 ? "s" : ""} en direct
              </span>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-charbon-800/70 px-4 py-3 text-sm text-zinc-400">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rouge-500" />
                ETS2
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                ATS
              </span>
            </div>

            <div className="flex items-center rounded-xl border border-white/5 bg-charbon-800/70 p-1">
              <button
                type="button"
                onClick={() =>
                  mapInstanceRef.current?.flyTo({ center: [12, 51], zoom: 5 })
                }
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                Europe
              </button>
              <button
                type="button"
                onClick={() =>
                  mapInstanceRef.current?.flyTo({ center: [-108, 39], zoom: 5 })
                }
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                USA
              </button>
            </div>

            <div className="flex items-center rounded-xl border border-white/5 bg-charbon-800/70 p-1">
              <button
                type="button"
                onClick={() => setMode("markers")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "markers"
                    ? "bg-rouge-500 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Marqueurs
              </button>
              <button
                type="button"
                onClick={() => setMode("heatmap")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "heatmap"
                    ? "bg-rouge-500 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Heatmap
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-rouge-500/30 bg-rouge-500/10 px-4 py-3 text-sm text-rouge-400">
            {error}
          </div>
        )}

        <div className="mt-6">
          <div
            ref={mapRef}
            className="h-[70vh] w-full overflow-hidden rounded-2xl border border-white/5 bg-charbon-800"
          />

          {count === 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              Lancez{" "}
              <code className="rounded bg-carbone-600 px-1.5 py-0.5 text-xs text-zinc-200">
                npm run telemetry:sim
              </code>{" "}
              dans{" "}
              <code className="rounded bg-carbone-600 px-1.5 py-0.5 text-xs text-zinc-200">
                backend/
              </code>{" "}
              pour voir des camions.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
