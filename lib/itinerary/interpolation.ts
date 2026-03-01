import type {
  ItineraryLeg,
  ItineraryStop,
  PathPoint,
  TravelMode,
} from "../data/types";

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const originLat = toRadians(lat1);
  const destinationLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateGreatCirclePoint(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  progress: number
) {
  const phi1 = toRadians(fromLat);
  const lambda1 = toRadians(fromLon);
  const phi2 = toRadians(toLat);
  const lambda2 = toRadians(toLon);

  const delta = 2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) *
            Math.cos(phi2) *
            Math.sin((lambda2 - lambda1) / 2) ** 2
      )
    );

  if (delta === 0) {
    return { lat: fromLat, lon: fromLon };
  }

  const a = Math.sin((1 - progress) * delta) / Math.sin(delta);
  const b = Math.sin(progress * delta) / Math.sin(delta);
  const x =
    a * Math.cos(phi1) * Math.cos(lambda1) +
    b * Math.cos(phi2) * Math.cos(lambda2);
  const y =
    a * Math.cos(phi1) * Math.sin(lambda1) +
    b * Math.cos(phi2) * Math.sin(lambda2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))),
    lon: toDegrees(Math.atan2(y, x)),
  };
}

function easeInOut(progress: number) {
  return 0.5 - Math.cos(progress * Math.PI) / 2;
}

function getAirAltitude(progress: number) {
  const eased = easeInOut(progress);
  return 0.04 + Math.sin(eased * Math.PI) * 0.14;
}

function buildPathPoints(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  mode: TravelMode
) {
  const steps = mode === "air" ? 32 : 20;
  const points: PathPoint[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const position = interpolateGreatCirclePoint(
      fromLat,
      fromLon,
      toLat,
      toLon,
      progress
    );

    points.push({
      lat: position.lat,
      lon: position.lon,
      altitude: mode === "air" ? getAirAltitude(progress) : 0.002,
    });
  }

  return points;
}

export function buildLegPathPoints(
  fromStop: ItineraryStop,
  toStop: ItineraryStop,
  mode: TravelMode
) {
  if (
    fromStop.lat === null ||
    fromStop.lon === null ||
    toStop.lat === null ||
    toStop.lon === null
  ) {
    return [];
  }

  return buildPathPoints(fromStop.lat, fromStop.lon, toStop.lat, toStop.lon, mode);
}

export function interpolateTravelerPosition(leg: ItineraryLeg, progress: number) {
  if (leg.pathPoints.length === 0) {
    return null;
  }

  if (progress <= 0) {
    return leg.pathPoints[0];
  }

  if (progress >= 1) {
    return leg.pathPoints[leg.pathPoints.length - 1];
  }

  const scaled = progress * (leg.pathPoints.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(leg.pathPoints.length - 1, lowerIndex + 1);
  const innerProgress = scaled - lowerIndex;
  const lower = leg.pathPoints[lowerIndex];
  const upper = leg.pathPoints[upperIndex];

  return {
    lat: lower.lat + (upper.lat - lower.lat) * innerProgress,
    lon: lower.lon + (upper.lon - lower.lon) * innerProgress,
    altitude:
      lower.altitude + (upper.altitude - lower.altitude) * innerProgress,
  };
}
