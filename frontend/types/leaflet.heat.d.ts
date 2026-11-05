import "leaflet";

declare module "leaflet" {
  type HeatLatLng = [number, number] | [number, number, number];

  interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<string, string>;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: HeatLatLng[]): this;
    addLatLng(latlng: HeatLatLng): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }

  function heatLayer(latlngs: HeatLatLng[], options?: HeatMapOptions): HeatLayer;
}

declare module "leaflet.heat";
