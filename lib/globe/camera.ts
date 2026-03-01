import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PathPoint,
  PlaybackPhase,
  PlaybackState,
  TravelMode,
} from "../data/types";

export type GlobePointOfView = {
  lat: number;
  lng: number;
  altitude: number;
};

export type CameraMode =
  | "overview"
  | "stop-focus"
  | "leg-focus"
  | "playback-follow"
  | "manual-override";

export type CameraIntent = {
  mode: CameraMode;
  target: GlobePointOfView;
  transitionMs: number;
  smoothingFactor: number;
};

export type CameraContext = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: PlaybackState;
  travelerPoint: PathPoint | null;
  isTouchDevice: boolean;
  autoFollowSuspendedUntil: number | null;
  nowMs: number;
  currentPointOfView?: GlobePointOfView | null;
};

export type CameraSnapshot = {
  mode: CameraMode;
  targetPointOfView: GlobePointOfView;
  currentPointOfView: GlobePointOfView;
  autoFollowSuspended: boolean;
};

export type PointOfViewThresholds = {
  lat: number;
  lng: number;
  altitude: number;
};

export type ZoomProfile = {
  altitude: number;
  leadWeight: number;
  smoothingFactor: number;
  transitionMs: number;
};

export type PlaybackSmoothingProfile = {
  latLngFactor: number;
  altitudeFactor: number;
};

export type PlaybackSmoothingVelocity = {
  angularDelta: number;
  altitudeDelta: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolvePoints(points: Array<LocatedPoint | null>) {
  return points.filter(
    (point): point is { lat: number; lon: number } =>
      point !== null && point.lat !== null && point.lon !== null
  );
}

export function normalizeLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function getShortestLongitudeDelta(fromLng: number, toLng: number) {
  const normalizedFrom = normalizeLongitude(fromLng);
  const normalizedTo = normalizeLongitude(toLng);
  return normalizeLongitude(normalizedTo - normalizedFrom);
}

export function getWrappedLongitudeDelta(lngA: number, lngB: number) {
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

function getLegDistanceKm(fromPoint: LocatedPoint, toPoint: LocatedPoint) {
  if (
    fromPoint.lat === null ||
    fromPoint.lon === null ||
    toPoint.lat === null ||
    toPoint.lon === null
  ) {
    return 0;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(toPoint.lat - fromPoint.lat);
  const dLon = toRadians(toPoint.lon - fromPoint.lon);
  const originLat = toRadians(fromPoint.lat);
  const destinationLat = toRadians(toPoint.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOverviewProfile(stopCount: number): ZoomProfile {
  if (stopCount <= 2) {
    return {
      altitude: 1.32,
      leadWeight: 0,
      smoothingFactor: 0.18,
      transitionMs: 750,
    };
  }

  if (stopCount <= 5) {
    return {
      altitude: 1.46,
      leadWeight: 0,
      smoothingFactor: 0.16,
      transitionMs: 850,
    };
  }

  return {
    altitude: 1.62,
    leadWeight: 0,
    smoothingFactor: 0.14,
    transitionMs: 950,
  };
}

function getStopFocusProfile(adjacentLegs: ItineraryLeg[]): ZoomProfile {
  if (adjacentLegs.length === 0) {
    return {
      altitude: 0.76,
      leadWeight: 0,
      smoothingFactor: 0.22,
      transitionMs: 700,
    };
  }

  const usesWideContext = adjacentLegs.some(
    (leg) => leg.mode === "air" || (leg.distanceKm ?? 0) > 450
  );

  return usesWideContext
    ? {
        altitude: 1.02,
        leadWeight: 0,
        smoothingFactor: 0.18,
        transitionMs: 850,
      }
    : {
        altitude: 0.86,
        leadWeight: 0,
        smoothingFactor: 0.2,
        transitionMs: 750,
      };
}

function getLegFocusProfile(distanceKm: number): ZoomProfile {
  if (distanceKm <= 180) {
    return { altitude: 0.76, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
  }
  if (distanceKm <= 450) {
    return { altitude: 0.86, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
  }
  if (distanceKm <= 1000) {
    return { altitude: 0.98, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
  }
  if (distanceKm <= 2500) {
    return { altitude: 1.12, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
  }
  if (distanceKm <= 6000) {
    return { altitude: 1.28, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
  }

  return { altitude: 1.42, leadWeight: 0, smoothingFactor: 0.18, transitionMs: 850 };
}

function getPlaybackProfile(
  mode: TravelMode,
  distanceKm: number,
  phase: PlaybackPhase
): ZoomProfile {
  if (phase === "dwell") {
    return {
      altitude: mode === "air" ? 0.92 : 0.56,
      leadWeight: 0,
      smoothingFactor: 0.2,
      transitionMs: 0,
    };
  }

  if (mode === "ground") {
    if (distanceKm <= 180) {
      return { altitude: 0.48, leadWeight: 0.14, smoothingFactor: 0.28, transitionMs: 0 };
    }
    if (distanceKm <= 350) {
      return { altitude: 0.56, leadWeight: 0.18, smoothingFactor: 0.24, transitionMs: 0 };
    }

    return { altitude: 0.68, leadWeight: 0.22, smoothingFactor: 0.22, transitionMs: 0 };
  }

  if (distanceKm <= 1000) {
    return { altitude: 0.94, leadWeight: 0.16, smoothingFactor: 0.18, transitionMs: 0 };
  }
  if (distanceKm <= 2500) {
    return { altitude: 1.06, leadWeight: 0.18, smoothingFactor: 0.16, transitionMs: 0 };
  }
  if (distanceKm <= 6000) {
    return { altitude: 1.2, leadWeight: 0.22, smoothingFactor: 0.15, transitionMs: 0 };
  }

  return { altitude: 1.34, leadWeight: 0.26, smoothingFactor: 0.14, transitionMs: 0 };
}

function getResolvedStopPoints(stops: ItineraryStop[]) {
  return stops
    .filter(
      (stop): stop is ItineraryStop & { lat: number; lon: number } =>
        stop.lat !== null && stop.lon !== null
    )
    .map((stop) => ({ lat: stop.lat, lon: stop.lon }));
}

function getOverviewTarget(points: Array<LocatedPoint | null>, atlanticBiasLng = 0) {
  const resolved = resolvePoints(points);
  const profile = getOverviewProfile(resolved.length);

  if (resolved.length === 0) {
    return {
      lat: 22,
      lng: -32,
      altitude: profile.altitude,
    };
  }

  const meanLat =
    resolved.reduce((sum, point) => sum + point.lat, 0) / resolved.length;

  return {
    lat: meanLat,
    lng: normalizeLongitude(getCircularMeanLongitude(resolved) + atlanticBiasLng),
    altitude: profile.altitude,
  };
}

function getPointOfViewFromLegPoints(
  fromPoint: LocatedPoint,
  toPoint: LocatedPoint,
  altitude: number
): GlobePointOfView {
  if (
    fromPoint.lat === null ||
    fromPoint.lon === null ||
    toPoint.lat === null ||
    toPoint.lon === null
  ) {
    return getOverviewTarget([fromPoint, toPoint]);
  }

  return {
    lat: (fromPoint.lat + toPoint.lat) / 2,
    lng: getCircularMeanLongitude([{ lon: fromPoint.lon }, { lon: toPoint.lon }]),
    altitude,
  };
}

export function getPlaybackAnchorPoint(
  travelerPoint: PathPoint,
  destinationPoint: LocatedPoint,
  leadWeight: number
) {
  if (destinationPoint.lat === null || destinationPoint.lon === null) {
    return { lat: travelerPoint.lat, lng: travelerPoint.lon };
  }

  return {
    lat:
      travelerPoint.lat * (1 - leadWeight) + destinationPoint.lat * leadWeight,
    lng: normalizeLongitude(
      travelerPoint.lon +
        getShortestLongitudeDelta(travelerPoint.lon, destinationPoint.lon) *
          leadWeight
    ),
  };
}

function getPlaybackLeadWeight(
  baseLeadWeight: number,
  mode: TravelMode,
  phase: PlaybackPhase,
  legProgress: number
) {
  if (mode !== "ground" || phase === "dwell") {
    return baseLeadWeight;
  }

  const clampedProgress = clamp(legProgress, 0, 1);
  const easedProgress = 1 - (1 - clampedProgress) ** 2;
  return clamp(baseLeadWeight + easedProgress * 0.08, baseLeadWeight, baseLeadWeight + 0.08);
}

export function getOverviewCameraIntent(stops: ItineraryStop[]): CameraIntent {
  const target = getOverviewTarget(getResolvedStopPoints(stops), stops.length >= 4 ? -10 : 0);
  const profile = getOverviewProfile(getResolvedStopPoints(stops).length);

  return {
    mode: "overview",
    target,
    transitionMs: profile.transitionMs,
    smoothingFactor: profile.smoothingFactor,
  };
}

export function getStopFocusCameraIntent(
  stop: ItineraryStop,
  adjacentStops: Array<ItineraryStop | null>,
  adjacentLegs: ItineraryLeg[]
): CameraIntent {
  if (stop.lat === null || stop.lon === null) {
    return getOverviewCameraIntent([stop, ...adjacentStops.filter(Boolean)] as ItineraryStop[]);
  }

  const profile = getStopFocusProfile(adjacentLegs);
  const resolvedAdjacent = adjacentStops.filter(
    (point): point is ItineraryStop & { lat: number; lon: number } =>
      point !== null && point.lat !== null && point.lon !== null
  );

  if (resolvedAdjacent.length === 0) {
    return {
      mode: "stop-focus",
      target: {
        lat: stop.lat,
        lng: stop.lon,
        altitude: profile.altitude,
      },
      transitionMs: profile.transitionMs,
      smoothingFactor: profile.smoothingFactor,
    };
  }

  return {
    mode: "stop-focus",
    target: {
      lat:
        (stop.lat * 2 +
          resolvedAdjacent.reduce((sum, point) => sum + point.lat, 0)) /
        (resolvedAdjacent.length + 2),
      lng: getCircularMeanLongitude([
        { lon: stop.lon },
        { lon: stop.lon },
        ...resolvedAdjacent.map((point) => ({ lon: point.lon })),
      ]),
      altitude: profile.altitude,
    },
    transitionMs: profile.transitionMs,
    smoothingFactor: profile.smoothingFactor,
  };
}

export function getLegFocusCameraIntent(
  leg: ItineraryLeg,
  fromStop: ItineraryStop | null,
  toStop: ItineraryStop | null
): CameraIntent {
  const fromPoint = fromStop ?? leg.pathPoints[0] ?? { lat: null, lon: null };
  const toPoint =
    toStop ?? leg.pathPoints[leg.pathPoints.length - 1] ?? { lat: null, lon: null };
  const distanceKm =
    leg.distanceKm ?? getLegDistanceKm(fromPoint, toPoint);
  const profile = getLegFocusProfile(distanceKm);

  return {
    mode: "leg-focus",
    target: getPointOfViewFromLegPoints(fromPoint, toPoint, profile.altitude),
    transitionMs: profile.transitionMs,
    smoothingFactor: profile.smoothingFactor,
  };
}

export function getPlaybackFollowCameraIntent(
  leg: ItineraryLeg,
  travelerPoint: PathPoint,
  destinationStop: ItineraryStop,
  phase: PlaybackPhase,
  legProgress = 0
): CameraIntent {
  const profile = getPlaybackProfile(leg.mode, leg.distanceKm ?? 0, phase);
  const leadWeight = getPlaybackLeadWeight(
    profile.leadWeight,
    leg.mode,
    phase,
    legProgress
  );
  const anchor =
    phase === "dwell"
      ? destinationStop.lat !== null && destinationStop.lon !== null
        ? { lat: destinationStop.lat, lng: destinationStop.lon }
        : { lat: travelerPoint.lat, lng: travelerPoint.lon }
      : getPlaybackAnchorPoint(travelerPoint, destinationStop, leadWeight);

  return {
    mode: "playback-follow",
    target: {
      lat: anchor.lat,
      lng: anchor.lng,
      altitude: profile.altitude,
    },
    transitionMs: profile.transitionMs,
    smoothingFactor: profile.smoothingFactor,
  };
}

export function resolveCameraIntent(context: CameraContext): CameraIntent {
  const {
    stops,
    legs,
    selection,
    playback,
    travelerPoint,
    autoFollowSuspendedUntil,
    nowMs,
    currentPointOfView,
  } = context;

  const autoFollowSuspended =
    autoFollowSuspendedUntil !== null && autoFollowSuspendedUntil > nowMs;

  if (autoFollowSuspended && currentPointOfView) {
    return {
      mode: "manual-override",
      target: currentPointOfView,
      transitionMs: 0,
      smoothingFactor: 0.18,
    };
  }

  if (selection?.kind === "stop") {
    const stop = stops.find((entry) => entry.id === selection.stopId) ?? null;
    if (stop) {
      const stopIndex = stops.findIndex((entry) => entry.id === stop.id);
      const adjacentStops = [
        stopIndex > 0 ? stops[stopIndex - 1] ?? null : null,
        stopIndex < stops.length - 1 ? stops[stopIndex + 1] ?? null : null,
      ];
      const adjacentLegs = [
        stopIndex > 0 ? legs[stopIndex - 1] ?? null : null,
        stopIndex >= 0 ? legs[stopIndex] ?? null : null,
      ].filter((leg): leg is ItineraryLeg => leg !== null);

      return getStopFocusCameraIntent(stop, adjacentStops, adjacentLegs);
    }
  }

  if (selection?.kind === "leg") {
    const leg = legs.find((entry) => entry.id === selection.legId) ?? null;
    if (leg) {
      const fromStop = stops.find((entry) => entry.id === leg.fromStopId) ?? null;
      const toStop = stops.find((entry) => entry.id === leg.toStopId) ?? null;
      return getLegFocusCameraIntent(leg, fromStop, toStop);
    }
  }

  const activeLeg = legs[playback.activeLegIndex] ?? null;
  const activeDestinationStop =
    activeLeg ? stops.find((stop) => stop.id === activeLeg.toStopId) ?? null : null;
  const shouldTrackPlayback =
    activeLeg &&
    travelerPoint &&
    activeDestinationStop &&
    (playback.status === "playing" ||
      (playback.tripProgress > 0 && selection === null));

  if (shouldTrackPlayback && activeDestinationStop) {
    return getPlaybackFollowCameraIntent(
      activeLeg,
      travelerPoint as PathPoint,
      activeDestinationStop,
      playback.phase,
      playback.activeLegProgress
    );
  }

  return getOverviewCameraIntent(stops);
}

export function shouldApplyPointOfViewUpdate(
  current: GlobePointOfView,
  next: GlobePointOfView,
  thresholds: PointOfViewThresholds = {
    lat: 0.08,
    lng: 0.08,
    altitude: 0.02,
  }
) {
  return !(
    Math.abs(current.lat - next.lat) < thresholds.lat &&
    Math.abs(getShortestLongitudeDelta(current.lng, next.lng)) < thresholds.lng &&
    Math.abs(current.altitude - next.altitude) < thresholds.altitude
  );
}

export function interpolatePointOfView(
  current: GlobePointOfView,
  target: GlobePointOfView,
  factor: number
): GlobePointOfView {
  const clampedFactor = clamp(factor, 0, 1);

  return {
    lat: current.lat + (target.lat - current.lat) * clampedFactor,
    lng: normalizeLongitude(
      current.lng + getShortestLongitudeDelta(current.lng, target.lng) * clampedFactor
    ),
    altitude:
      current.altitude + (target.altitude - current.altitude) * clampedFactor,
  };
}

export function getPlaybackSmoothingProfile(
  mode: TravelMode,
  phase: PlaybackPhase
): PlaybackSmoothingProfile {
  if (phase === "dwell") {
    return {
      latLngFactor: 0.2,
      altitudeFactor: 0.16,
    };
  }

  if (mode === "ground") {
    return {
      latLngFactor: 0.34,
      altitudeFactor: 0.14,
    };
  }

  return {
    latLngFactor: 0.18,
    altitudeFactor: 0.12,
  };
}

export function getPlaybackSmoothingVelocity(
  current: GlobePointOfView,
  target: GlobePointOfView
): PlaybackSmoothingVelocity {
  return {
    angularDelta: Math.max(
      Math.abs(current.lat - target.lat),
      Math.abs(getShortestLongitudeDelta(current.lng, target.lng))
    ),
    altitudeDelta: Math.abs(current.altitude - target.altitude),
  };
}

export function getVelocityAdjustedPlaybackSmoothingProfile(
  baseProfile: PlaybackSmoothingProfile,
  velocity: PlaybackSmoothingVelocity,
  mode: TravelMode
): PlaybackSmoothingProfile {
  if (mode === "ground") {
    const angularBoost = clamp(velocity.angularDelta / 1.25, 0, 1);
    const altitudeBoost = clamp(velocity.altitudeDelta / 0.2, 0, 1);

    return {
      latLngFactor: clamp(
        baseProfile.latLngFactor * (0.72 + angularBoost * 0.42),
        0.16,
        0.44
      ),
      altitudeFactor: clamp(
        baseProfile.altitudeFactor * (0.82 + altitudeBoost * 0.28),
        0.1,
        0.2
      ),
    };
  }

  const angularBoost = clamp(velocity.angularDelta / 2.2, 0, 1);
  const altitudeBoost = clamp(velocity.altitudeDelta / 0.45, 0, 1);

  return {
    latLngFactor: clamp(
      baseProfile.latLngFactor * (1.04 + angularBoost * 0.24),
      0.18,
      0.28
    ),
    altitudeFactor: clamp(
      baseProfile.altitudeFactor * (1.02 + altitudeBoost * 0.18),
      0.12,
      0.18
    ),
  };
}

export function interpolatePlaybackPointOfView(
  current: GlobePointOfView,
  target: GlobePointOfView,
  profile: PlaybackSmoothingProfile
): GlobePointOfView {
  const latLngFactor = clamp(profile.latLngFactor, 0, 1);
  const altitudeFactor = clamp(profile.altitudeFactor, 0, 1);

  return {
    lat: current.lat + (target.lat - current.lat) * latLngFactor,
    lng: normalizeLongitude(
      current.lng + getShortestLongitudeDelta(current.lng, target.lng) * latLngFactor
    ),
    altitude:
      current.altitude + (target.altitude - current.altitude) * altitudeFactor,
  };
}

export function getAirportPointOfView(lat: number, lng: number): GlobePointOfView {
  return {
    lat,
    lng,
    altitude: 0.76,
  };
}

export function getFlyDurationMs(isClose: boolean) {
  return isClose ? 450 : 900;
}

export function getLegPointOfView(
  fromPoint: LocatedPoint,
  toPoint: LocatedPoint
): GlobePointOfView {
  const distanceKm = getLegDistanceKm(fromPoint, toPoint);
  return getPointOfViewFromLegPoints(
    fromPoint,
    toPoint,
    getLegFocusProfile(distanceKm).altitude
  );
}

export function getBufferedLegPointOfView(
  fromPoint: LocatedPoint,
  toPoint: LocatedPoint
): GlobePointOfView {
  const pointOfView = getLegPointOfView(fromPoint, toPoint);

  return {
    ...pointOfView,
    altitude: clamp(pointOfView.altitude + 0.12, pointOfView.altitude, 1.78),
  };
}

export function getStopContextPointOfView(
  stopPoint: LocatedPoint,
  contextPoints: Array<LocatedPoint | null>
): GlobePointOfView {
  if (stopPoint.lat === null || stopPoint.lon === null) {
    return getOverviewTarget([stopPoint, ...contextPoints]);
  }

  const resolvedContext = resolvePoints(contextPoints);
  if (resolvedContext.length === 0) {
    return getAirportPointOfView(stopPoint.lat, stopPoint.lon);
  }

  const maxDistance = resolvedContext.reduce(
    (max, point) => Math.max(max, getLegDistanceKm(stopPoint, point)),
    0
  );
  const altitude = maxDistance > 450 ? 1.02 : 0.86;

  return {
    lat:
      (stopPoint.lat * 2 +
        resolvedContext.reduce((sum, point) => sum + point.lat, 0)) /
      (resolvedContext.length + 2),
    lng: getCircularMeanLongitude([
      { lon: stopPoint.lon },
      { lon: stopPoint.lon },
      ...resolvedContext.map((point) => ({ lon: point.lon })),
    ]),
    altitude,
  };
}

export function getOverviewPointOfView(
  points: Array<LocatedPoint | null>
): GlobePointOfView {
  return getOverviewTarget(points);
}

export function getPlaybackFollowPointOfView(
  travelerPoint: LocatedPoint,
  destinationPoint: LocatedPoint,
  mode: TravelMode,
  distanceKm: number | null,
  phase: PlaybackPhase,
  legProgress = 0
): GlobePointOfView {
  if (travelerPoint.lat === null || travelerPoint.lon === null) {
    return getOverviewTarget([travelerPoint, destinationPoint]);
  }

  const profile = getPlaybackProfile(mode, distanceKm ?? 0, phase);
  const leadWeight = getPlaybackLeadWeight(
    profile.leadWeight,
    mode,
    phase,
    legProgress
  );
  if (phase === "dwell") {
    return {
      lat: destinationPoint.lat ?? travelerPoint.lat,
      lng: destinationPoint.lon ?? travelerPoint.lon,
      altitude: profile.altitude,
    };
  }

  return {
    ...getPlaybackAnchorPoint(
      {
        lat: travelerPoint.lat,
        lon: travelerPoint.lon,
        altitude: 0,
      },
      destinationPoint,
      leadWeight
    ),
    altitude: profile.altitude,
  };
}
