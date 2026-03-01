export type GlobePointOfView = {
  lat: number;
  lng: number;
  altitude: number;
};

type LocatedPoint = {
  lat: number | null;
  lon: number | null;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function normalizeLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function getWrappedLongitudeDelta(lngA: number, lngB: number) {
  const delta = Math.abs(normalizeLongitude(lngA) - normalizeLongitude(lngB));
  return Math.min(delta, 360 - delta);
}

function getCircularMeanLongitude(points: Array<{ lon: number }>) {
  const sinSum = points.reduce(
    (sum, point) => sum + Math.sin(toRadians(point.lon)),
    0
  );
  const cosSum = points.reduce(
    (sum, point) => sum + Math.cos(toRadians(point.lon)),
    0
  );

  return normalizeLongitude(toDegrees(Math.atan2(sinSum, cosSum)));
}

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

export function getLegPointOfView(
  fromPoint: LocatedPoint,
  toPoint: LocatedPoint
): GlobePointOfView {
  if (
    fromPoint.lat === null ||
    fromPoint.lon === null ||
    toPoint.lat === null ||
    toPoint.lon === null
  ) {
    return getOverviewPointOfView([fromPoint, toPoint]);
  }

  const latSpan = Math.abs(fromPoint.lat - toPoint.lat);
  const lonSpan = getWrappedLongitudeDelta(fromPoint.lon, toPoint.lon);
  const span = Math.max(latSpan, lonSpan);

  return {
    lat: (fromPoint.lat + toPoint.lat) / 2,
    lng: getCircularMeanLongitude([
      { lon: fromPoint.lon },
      { lon: toPoint.lon },
    ]),
    altitude: Math.max(1.85, Math.min(2.35, 1.55 + span / 90)),
  };
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

  return {
    lat: meanLat,
    lng: getCircularMeanLongitude(resolved),
    altitude: resolved.length > 4 ? 1.95 : 1.6,
  };
}
