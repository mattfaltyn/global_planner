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

function getMaxWrappedLongitudeSpan(points: Array<{ lon: number }>) {
  if (points.length < 2) {
    return 0;
  }

  let maxSpan = 0;

  for (let outerIndex = 0; outerIndex < points.length; outerIndex += 1) {
    for (let innerIndex = outerIndex + 1; innerIndex < points.length; innerIndex += 1) {
      maxSpan = Math.max(
        maxSpan,
        getWrappedLongitudeDelta(points[outerIndex].lon, points[innerIndex].lon)
      );
    }
  }

  return maxSpan;
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

export function getBufferedLegPointOfView(
  fromPoint: LocatedPoint,
  toPoint: LocatedPoint
): GlobePointOfView {
  const pointOfView = getLegPointOfView(fromPoint, toPoint);

  return {
    ...pointOfView,
    altitude: Math.min(2.85, pointOfView.altitude + 0.36),
  };
}

export function getStopContextPointOfView(
  stopPoint: LocatedPoint,
  contextPoints: Array<LocatedPoint | null>
): GlobePointOfView {
  if (stopPoint.lat === null || stopPoint.lon === null) {
    return getOverviewPointOfView([stopPoint, ...contextPoints]);
  }

  const resolvedContext = contextPoints.filter(
    (point): point is { lat: number; lon: number } =>
      point !== null && point.lat !== null && point.lon !== null
  );

  if (resolvedContext.length === 0) {
    return getAirportPointOfView(stopPoint.lat, stopPoint.lon);
  }

  const allPoints = [{ lat: stopPoint.lat, lon: stopPoint.lon }, ...resolvedContext];
  const latitudes = allPoints.map((point) => point.lat);
  const latSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const lonSpan = getMaxWrappedLongitudeSpan(allPoints);
  const span = Math.max(latSpan, lonSpan);
  const weightedLat =
    (stopPoint.lat * 2 + resolvedContext.reduce((sum, point) => sum + point.lat, 0)) /
    (resolvedContext.length + 2);

  return {
    lat: weightedLat,
    lng: getCircularMeanLongitude([
      { lon: stopPoint.lon },
      { lon: stopPoint.lon },
      ...resolvedContext.map((point) => ({ lon: point.lon })),
    ]),
    altitude: Math.max(2.08, Math.min(2.9, 1.78 + span / 75)),
  };
}

export function getOverviewPointOfView(
  points: Array<LocatedPoint | null>
): GlobePointOfView {
  const resolved = points.filter(
    (point): point is { lat: number; lon: number } =>
      point !== null && point.lat !== null && point.lon !== null
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
