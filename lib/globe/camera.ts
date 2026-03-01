export type GlobePointOfView = {
  lat: number;
  lng: number;
  altitude: number;
};

type LocatedPoint = {
  lat: number | null;
  lon: number | null;
};

export function getAirportPointOfView(lat: number, lng: number): GlobePointOfView {
  return {
    lat,
    lng,
    altitude: 1.6,
  };
}

export function getFlyDurationMs(isClose: boolean) {
  return isClose ? 450 : 900;
}

export function getOverviewPointOfView(points: LocatedPoint[]): GlobePointOfView {
  const resolved = points.filter(
    (point): point is { lat: number; lon: number } =>
      point.lat !== null && point.lon !== null
  );

  if (resolved.length === 0) {
    return { lat: 22, lng: -32, altitude: 2.05 };
  }

  const meanLat =
    resolved.reduce((sum, point) => sum + point.lat, 0) / resolved.length;
  const meanLon =
    resolved.reduce((sum, point) => sum + point.lon, 0) / resolved.length;

  return {
    lat: meanLat,
    lng: meanLon,
    altitude: resolved.length > 4 ? 1.95 : 1.6,
  };
}
