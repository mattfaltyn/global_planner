"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhongMaterial,
  SRGBColorSpace,
} from "three";
import countries from "../../lib/data/countries.json";
import type {
  GlobePointDatum,
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackState,
  RenderLegState,
} from "../../lib/data/types";
import {
  type CameraSnapshot,
  getPlaybackSmoothingProfile,
  getPlaybackSmoothingVelocity,
  getVelocityAdjustedPlaybackSmoothingProfile,
  interpolatePlaybackPointOfView,
  resolveCameraIntent,
  interpolatePointOfView,
  shouldApplyPointOfViewUpdate,
} from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { interpolateTravelerPosition } from "../../lib/itinerary/interpolation";
import { getVisibleLegRenderState } from "../../lib/state/selectors";
import styles from "./GlobeCanvas.module.css";

type CountryFeature = {
  type: "Feature";
  properties: Record<string, unknown> & {
    NAME?: string;
    NAME_LONG?: string;
    MIN_LABEL?: number;
    POP_EST?: number;
    featurecla?: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
};

type CountryLabelDatum = {
  lat: number;
  lng: number;
  text: string;
  size: number;
};

type GlobeCanvasProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: PlaybackState;
  isTouchDevice?: boolean;
  enableHover: boolean;
  forceRecenterToken?: number;
  onAutoFollowSuspendedChange?: (suspended: boolean) => void;
  onCameraStateChange?: (snapshot: CameraSnapshot) => void;
  onHoverStop: (stopId: string, x: number, y: number) => void;
  onHoverLeg: (legId: string, x: number, y: number) => void;
  onClearHover: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectLeg: (legId: string) => void;
  onClearSelection: () => void;
};

type RenderLegDatum = ItineraryLeg & {
  renderState: RenderLegState;
};

type TravelerTrailDatum = {
  kind: "traveler-trail";
  pathPoints: Array<{ lat: number; lon: number; altitude: number }>;
};

type GlobePathDatum = RenderLegDatum | TravelerTrailDatum;

const countryBorders = countries.features as CountryFeature[];

function getRingPlanarArea(ring: number[][]) {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (!current || !next) {
      continue;
    }

    area += current[0] * next[1] - next[0] * current[1];
  }

  return area / 2;
}

function getRingCentroid(ring: number[][]) {
  const area = getRingPlanarArea(ring);
  if (Math.abs(area) < 1e-6) {
    const totals = ring.reduce(
      (sum, point) => {
        sum.lng += point[0] ?? 0;
        sum.lat += point[1] ?? 0;
        return sum;
      },
      { lat: 0, lng: 0 }
    );

    return {
      lng: totals.lng / Math.max(ring.length, 1),
      lat: totals.lat / Math.max(ring.length, 1),
      area: 0,
    };
  }

  let centroidLng = 0;
  let centroidLat = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (!current || !next) {
      continue;
    }

    const factor = current[0] * next[1] - next[0] * current[1];
    centroidLng += (current[0] + next[0]) * factor;
    centroidLat += (current[1] + next[1]) * factor;
  }

  return {
    lng: centroidLng / (6 * area),
    lat: centroidLat / (6 * area),
    area: Math.abs(area),
  };
}

function getCountryLabelAnchor(feature: CountryFeature) {
  const geometry = feature.geometry;
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  let best: { lat: number; lng: number; area: number } | null = null;

  for (const polygon of polygons) {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length < 3) {
      continue;
    }

    const centroid = getRingCentroid(outerRing);
    if (!best || centroid.area > best.area) {
      best = centroid;
    }
  }

  if (!best) {
    return null;
  }

  return {
    lat: best.lat,
    lng: best.lng,
  };
}

function getCountryLabelSize(feature: CountryFeature) {
  const population = Number(feature.properties.POP_EST ?? 0);
  const minLabel = Number(feature.properties.MIN_LABEL ?? 10);

  if (population > 200_000_000 || minLabel <= 2) {
    return 0.78;
  }
  if (population > 80_000_000 || minLabel <= 3) {
    return 0.68;
  }

  return 0.58;
}

function shouldRenderCountryLabel(feature: CountryFeature) {
  const name = feature.properties.NAME_LONG ?? feature.properties.NAME ?? "";
  const minLabel = Number(feature.properties.MIN_LABEL ?? 10);
  const population = Number(feature.properties.POP_EST ?? 0);
  const featureClass = String(feature.properties.featurecla ?? "");

  if (!name || name === "Antarctica") {
    return false;
  }

  if (!featureClass.includes("Admin-0 country")) {
    return false;
  }

  return minLabel <= 4 || population >= 25_000_000;
}

function getScreenCoords(
  globe: GlobeMethods,
  lat: number,
  lon: number,
  altitude: number
) {
  return globe.getScreenCoords(lat, lon, altitude) ?? { x: 0, y: 0 };
}

function getLegRenderColor(leg: RenderLegDatum) {
  if (leg.mode === "air") {
    switch (leg.renderState) {
      case "selected":
        return globeColors.airLegSelected;
      case "active":
        return globeColors.airLegActive;
      case "context":
        return globeColors.airLegContext;
      case "past":
        return globeColors.airLegContext;
      case "future":
      default:
        return globeColors.airLeg;
    }
  }

  switch (leg.renderState) {
    case "selected":
      return globeColors.groundLegSelected;
    case "active":
      return globeColors.groundLegActive;
    case "context":
      return globeColors.groundLegContext;
    case "past":
      return globeColors.groundLegContext;
    case "future":
    default:
      return globeColors.groundLeg;
  }
}

function getLegRenderStroke(leg: RenderLegDatum) {
  if (leg.mode === "air") {
    switch (leg.renderState) {
      case "selected":
        return 0.54;
      case "active":
        return 0.44;
      case "context":
        return 0.3;
      case "past":
        return 0.22;
      case "future":
      default:
        return 0.12;
    }
  }

  switch (leg.renderState) {
    case "selected":
      return 0.58;
    case "active":
      return 0.48;
    case "context":
      return 0.32;
    case "past":
      return 0.26;
    case "future":
    default:
      return 0.16;
  }
}

function getTravelerTrailPath(
  activeLeg: ItineraryLeg | null,
  travelerPoint: { lat: number; lon: number; altitude: number } | null,
  progress: number,
  phase: PlaybackState["phase"]
): TravelerTrailDatum | null {
  if (!activeLeg || !travelerPoint || activeLeg.mode !== "ground" || phase !== "travel") {
    return null;
  }

  const pathPoints = activeLeg.pathPoints;
  if (pathPoints.length < 2) {
    return null;
  }

  const currentIndex = Math.min(
    pathPoints.length - 1,
    Math.max(0, Math.ceil(progress * (pathPoints.length - 1)))
  );
  const lookAheadCount = Math.max(4, Math.min(8, Math.ceil(pathPoints.length * 0.18)));
  const trailingPoints = pathPoints.slice(
    currentIndex,
    Math.min(pathPoints.length, currentIndex + lookAheadCount)
  );

  return {
    kind: "traveler-trail",
    pathPoints: [
      {
        lat: travelerPoint.lat,
        lon: travelerPoint.lon,
        altitude: travelerPoint.altitude,
      },
      ...trailingPoints,
    ],
  };
}

function getTravelerPulseStrength(playback: PlaybackState) {
  if (playback.status !== "playing") {
    return 0;
  }

  const cyclePhase =
    playback.tripProgress * Math.PI * (playback.phase === "dwell" ? 10 : 18) +
    playback.activeLegProgress * Math.PI * (playback.phase === "dwell" ? 3 : 6);
  const wave = 0.5 + 0.5 * Math.sin(cyclePhase);

  if (playback.phase === "dwell") {
    return 0.12 + wave * 0.18;
  }

  return 0.45 + wave * 0.55;
}

function getTravelerGlowColor(pulseStrength: number) {
  return `rgba(255, 210, 122, ${0.2 + pulseStrength * 0.16})`;
}

function getTravelerHaloColor(pulseStrength: number) {
  return `rgba(255, 132, 76, ${0.44 + pulseStrength * 0.14})`;
}

export function GlobeCanvas({
  stops,
  legs,
  selection,
  playback,
  isTouchDevice = false,
  enableHover,
  forceRecenterToken = 0,
  onAutoFollowSuspendedChange,
  onCameraStateChange,
  onHoverStop,
  onHoverLeg,
  onClearHover,
  onSelectStop,
  onSelectLeg,
  onClearSelection,
}: GlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const lastFocusKeyRef = useRef<string | null>(null);
  const lastCameraModeRef = useRef<CameraSnapshot["mode"] | null>(null);
  const globeReadyRef = useRef(false);
  const hasMountedRef = useRef(false);
  const autoFollowSuspendedUntilRef = useRef<number | null>(null);
  const lastManualInteractionAtRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });

  const visibleStops = useMemo(
    () =>
      stops.filter(
        (stop): stop is ItineraryStop & { lat: number; lon: number } =>
          stop.lat !== null && stop.lon !== null
      ),
    [stops]
  );

  const countryLabels = useMemo<CountryLabelDatum[]>(
    () =>
      countryBorders
        .filter(shouldRenderCountryLabel)
        .map((feature) => {
          const anchor = getCountryLabelAnchor(feature);
          if (!anchor) {
            return null;
          }

          return {
            lat: anchor.lat,
            lng: anchor.lng,
            text: String(feature.properties.NAME_LONG ?? feature.properties.NAME ?? ""),
            size: getCountryLabelSize(feature),
          };
        })
        .filter((label): label is CountryLabelDatum => label !== null),
    []
  );

  const activeLeg = legs[playback.activeLegIndex] ?? null;
  const travelerPoint = useMemo(() => {
    if ((playback.status === "idle" && playback.tripProgress === 0) || !activeLeg) {
      return null;
    }

    const position = interpolateTravelerPosition(
      activeLeg,
      playback.activeLegProgress ?? 0
    );
    if (!position) {
      return null;
    }

    return {
      kind: "traveler" as const,
      lat: position.lat,
      lon: position.lon,
      altitude: position.altitude,
    };
  }, [activeLeg, playback.activeLegProgress, playback.status, playback.tripProgress]);

  const pointsData = useMemo(
    () =>
      travelerPoint
        ? ([
            ...visibleStops.map((stop) => ({
              kind: "stop" as const,
              stopId: stop.id,
              lat: stop.lat,
              lon: stop.lon,
            })),
            {
              kind: "traveler-glow" as const,
              lat: travelerPoint.lat,
              lon: travelerPoint.lon,
              altitude: travelerPoint.altitude,
            },
            {
              kind: "traveler-halo" as const,
              lat: travelerPoint.lat,
              lon: travelerPoint.lon,
              altitude: travelerPoint.altitude,
            },
            travelerPoint,
          ] satisfies GlobePointDatum[])
        : visibleStops.map((stop) => ({
            kind: "stop" as const,
            stopId: stop.id,
            lat: stop.lat,
            lon: stop.lon,
          })),
    [travelerPoint, visibleStops]
  );

  const renderedLegs = useMemo(
    () =>
      legs.map((leg) => ({
        ...leg,
        renderState: getVisibleLegRenderState(leg, legs, playback, selection),
      })),
    [legs, playback, selection]
  );

  const travelerTrail = useMemo(
    () =>
      getTravelerTrailPath(
        activeLeg,
        travelerPoint,
        playback.activeLegProgress ?? 0,
        playback.phase
      ),
    [activeLeg, playback.activeLegProgress, playback.phase, travelerPoint]
  );

  const travelerPulseStrength = useMemo(
    () => getTravelerPulseStrength(playback),
    [playback]
  );

  const pathData = useMemo<GlobePathDatum[]>(
    () => (travelerTrail ? [...renderedLegs, travelerTrail] : renderedLegs),
    [renderedLegs, travelerTrail]
  );

  const selectedStopId = selection?.kind === "stop" ? selection.stopId : null;
  const selectedLegId = selection?.kind === "leg" ? selection.legId : null;
  const activeOriginStopId = activeLeg?.fromStopId ?? null;
  const activeDestinationStopId = activeLeg?.toStopId ?? null;
  const visitedStopIds = new Set(
    playback.status === "idle"
      ? []
      : stops
          .slice(
            0,
            Math.min(
              stops.length,
              playback.activeLegIndex + (playback.phase === "dwell" ? 2 : 1)
            )
          )
          .map((stop) => stop.id)
  );

  const applyGlobeMaterialSettings = useCallback(() => {
    const globe = globeRef.current as
      | (GlobeMethods & { globeMaterial?: () => MeshPhongMaterial | undefined })
      | undefined;
    if (!globe || !globeReadyRef.current) {
      return;
    }

    const renderer = globe.renderer();
    const material = globe.globeMaterial?.();
    if (!material) {
      return;
    }

    material.shininess = 4;
    material.bumpScale = 0.28;
    material.specular = new Color("#16314b");

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    if (material.map) {
      material.map.colorSpace = SRGBColorSpace;
      material.map.anisotropy = maxAnisotropy;
      material.map.minFilter = LinearMipmapLinearFilter;
      material.map.magFilter = LinearFilter;
      material.map.needsUpdate = true;
    }

    if (material.bumpMap) {
      material.bumpMap.anisotropy = maxAnisotropy;
      material.bumpMap.minFilter = LinearMipmapLinearFilter;
      material.bumpMap.magFilter = LinearFilter;
      material.bumpMap.needsUpdate = true;
    }

    material.needsUpdate = true;
  }, []);

  const handleGlobeReady = useCallback(() => {
    globeReadyRef.current = true;

    if (hasMountedRef.current) {
      applyGlobeMaterialSettings();
    }
  }, [applyGlobeMaterialSettings]);

  useEffect(() => {
    hasMountedRef.current = true;
    if (globeReadyRef.current) {
      applyGlobeMaterialSettings();
    }

    return () => {
      hasMountedRef.current = false;
    };
  }, [applyGlobeMaterialSettings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) {
      return;
    }

    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 140;
    controls.maxDistance = 300;
    controls.rotateSpeed = 0.36;
    controls.zoomSpeed = 0.72;
    applyGlobeMaterialSettings();
  }, [applyGlobeMaterialSettings, size.height, size.width]);

  const suspendAutoFollow = useCallback(() => {
    if (playback.status !== "playing") {
      return;
    }

    const nowMs = Date.now();
    if (
      lastManualInteractionAtRef.current !== null &&
      nowMs - lastManualInteractionAtRef.current < 250
    ) {
      return;
    }

    lastManualInteractionAtRef.current = nowMs;
    autoFollowSuspendedUntilRef.current = nowMs + 4500;
    onAutoFollowSuspendedChange?.(true);
  }, [onAutoFollowSuspendedChange, playback.status]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handlePointerDown = () => suspendAutoFollow();
    const handleWheel = () => suspendAutoFollow();
    const handleTouchStart = () => suspendAutoFollow();
    const handleTouchMove = () => suspendAutoFollow();

    container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [suspendAutoFollow]);

  useEffect(() => {
    if (autoFollowSuspendedUntilRef.current === null) {
      return;
    }

    autoFollowSuspendedUntilRef.current = null;
    onAutoFollowSuspendedChange?.(false);
    lastCameraModeRef.current = null;
    lastFocusKeyRef.current = null;
  }, [forceRecenterToken, onAutoFollowSuspendedChange]);

  useEffect(() => {
    if (playback.status === "playing") {
      return;
    }

    if (autoFollowSuspendedUntilRef.current !== null) {
      autoFollowSuspendedUntilRef.current = null;
      onAutoFollowSuspendedChange?.(false);
    }
  }, [onAutoFollowSuspendedChange, playback.status]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || visibleStops.length === 0) {
      return;
    }
    const nowMs = Date.now();
    if (
      autoFollowSuspendedUntilRef.current !== null &&
      nowMs >= autoFollowSuspendedUntilRef.current
    ) {
      autoFollowSuspendedUntilRef.current = null;
      onAutoFollowSuspendedChange?.(false);
    }

    const currentPointOfView = globe.pointOfView();
    const intent = resolveCameraIntent({
      stops,
      legs,
      selection,
      playback,
      travelerPoint,
      isTouchDevice,
      autoFollowSuspendedUntil: autoFollowSuspendedUntilRef.current,
      nowMs,
      currentPointOfView,
    });
    const playbackSmoothingProfile =
      intent.mode === "playback-follow" && activeLeg
        ? getVelocityAdjustedPlaybackSmoothingProfile(
            getPlaybackSmoothingProfile(activeLeg.mode, playback.phase),
            getPlaybackSmoothingVelocity(currentPointOfView, intent.target),
            activeLeg.mode
          )
        : null;
    const nextPointOfView =
      intent.mode === "playback-follow"
        ? interpolatePlaybackPointOfView(
            currentPointOfView,
            intent.target,
            playbackSmoothingProfile ?? {
              latLngFactor: intent.smoothingFactor,
              altitudeFactor: intent.smoothingFactor,
            }
          )
        : intent.target;
    const pointOfViewThresholds =
      intent.mode === "playback-follow" && activeLeg?.mode === "ground"
        ? {
            lat: 0.008,
            lng: 0.008,
            altitude: 0.002,
          }
        : intent.mode === "playback-follow" && activeLeg?.mode === "air" && (activeLeg.distanceKm ?? 0) > 2500
          ? {
              lat: 0.012,
              lng: 0.012,
              altitude: 0.004,
            }
        : intent.mode === "playback-follow"
          ? {
              lat: 0.02,
              lng: 0.02,
              altitude: 0.006,
            }
          : undefined;
    const autoFollowSuspended =
      autoFollowSuspendedUntilRef.current !== null &&
      autoFollowSuspendedUntilRef.current > nowMs;

    onCameraStateChange?.({
      mode: intent.mode,
      targetPointOfView: intent.target,
      currentPointOfView: shouldApplyPointOfViewUpdate(
        currentPointOfView,
        nextPointOfView,
        pointOfViewThresholds
      )
        ? nextPointOfView
        : currentPointOfView,
      autoFollowSuspended,
    });

    if (intent.mode === "manual-override") {
      lastCameraModeRef.current = intent.mode;
      lastFocusKeyRef.current = "manual-override";
      return;
    }

    const focusKey =
      selection?.kind === "stop"
        ? `stop:${selection.stopId}`
        : selection?.kind === "leg"
          ? `leg:${selection.legId}`
          : intent.mode === "playback-follow"
            ? `playback:${activeLeg?.id ?? "none"}:${playback.phase}`
            : "overview";
    const hasMeaningfulDelta = shouldApplyPointOfViewUpdate(
      currentPointOfView,
      nextPointOfView,
      pointOfViewThresholds
    );

    if (
      !hasMeaningfulDelta &&
      lastCameraModeRef.current === intent.mode &&
      lastFocusKeyRef.current === focusKey
    ) {
      return;
    }

    const transitionMs =
      intent.mode === "playback-follow" || lastFocusKeyRef.current === focusKey
        ? 0
        : intent.transitionMs;

    lastCameraModeRef.current = intent.mode;
    lastFocusKeyRef.current = focusKey;
    globe.pointOfView(nextPointOfView, transitionMs);
  }, [
    activeLeg,
    forceRecenterToken,
    isTouchDevice,
    legs,
    onAutoFollowSuspendedChange,
    onCameraStateChange,
    playback.phase,
    playback.status,
    playback.tripProgress,
    selection,
    stops,
    travelerPoint,
    visibleStops.length,
  ]);

  return (
    <div className={styles.canvas} ref={containerRef} data-testid="globe-canvas">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        rendererConfig={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl="/textures/stars.svg"
        globeImageUrl="/textures/earth-day.jpg"
        bumpImageUrl="/textures/earth-topology.png"
        onGlobeReady={handleGlobeReady}
        showAtmosphere
        atmosphereColor="#5ee6ff"
        atmosphereAltitude={0.1}
        polygonsData={countryBorders}
        polygonCapColor={() => "rgba(0, 0, 0, 0)"}
        polygonSideColor={() => "rgba(0, 0, 0, 0)"}
        polygonStrokeColor={() => "rgba(221, 243, 255, 0.28)"}
        polygonAltitude={0.0005}
        polygonsTransitionDuration={0}
        labelsData={countryLabels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelColor={() => globeColors.countryLabel}
        labelAltitude={0.012}
        labelSize="size"
        labelResolution={4}
        labelIncludeDot={false}
        labelsTransitionDuration={0}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointAltitude={(point: object) => {
          const datum = point as GlobePointDatum;
          return datum.kind === "stop" ? 0 : datum.altitude;
        }}
        pointRadius={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler-glow") {
            return 0.56 + travelerPulseStrength * 0.14;
          }

          if (datum.kind === "traveler-halo") {
            return 0.38 + travelerPulseStrength * 0.06;
          }

          if (datum.kind === "traveler") {
            return 0.2 + travelerPulseStrength * 0.02;
          }

          if (datum.stopId === selectedStopId) {
            return 0.16;
          }

          if (datum.stopId === activeOriginStopId || datum.stopId === activeDestinationStopId) {
            return 0.15;
          }

          return visitedStopIds.has(datum.stopId) ? 0.08 : 0.1;
        }}
        pointColor={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler-glow") {
            return getTravelerGlowColor(travelerPulseStrength);
          }

          if (datum.kind === "traveler-halo") {
            return getTravelerHaloColor(travelerPulseStrength);
          }

          if (datum.kind === "traveler") {
            return globeColors.traveler;
          }

          if (datum.stopId === selectedStopId) {
            return globeColors.stopSelected;
          }

          if (datum.stopId === activeOriginStopId || datum.stopId === activeDestinationStopId) {
            return globeColors.stopActive;
          }

          return visitedStopIds.has(datum.stopId)
            ? globeColors.stopVisited
            : globeColors.stop;
        }}
        pointsMerge={false}
        pointResolution={16}
        pathsData={pathData}
        pathPoints={(leg: object) => (leg as GlobePathDatum).pathPoints}
        pathPointLat="lat"
        pathPointLng="lon"
        pathPointAlt="altitude"
        pathResolution={8}
        pathStroke={(leg: object) => {
          const datum = leg as GlobePathDatum;
          return datum.kind === "traveler-trail" ? 0.42 : getLegRenderStroke(datum);
        }}
        pathColor={(leg: object) => {
          const datum = leg as GlobePathDatum;
          return datum.kind === "traveler-trail"
            ? globeColors.travelerTrail
            : getLegRenderColor(datum);
        }}
        enablePointerInteraction
        showPointerCursor
        onPointHover={(point: object | null) => {
          if (!enableHover) {
            return;
          }

          const globe = globeRef.current;
          if (!point || !globe) {
            onClearHover();
            return;
          }

          const datum = point as GlobePointDatum;
          if (datum.kind !== "stop") {
            onClearHover();
            return;
          }

          const coords = getScreenCoords(globe, datum.lat, datum.lon, 0);
          onHoverStop(datum.stopId, coords.x, coords.y);
        }}
        onPathHover={(path: object | null) => {
          if (!enableHover) {
            return;
          }

          const globe = globeRef.current;
          if (!path || !globe) {
            onClearHover();
            return;
          }

          const leg = path as GlobePathDatum;
          if ("kind" in leg && leg.kind === "traveler-trail") {
            onClearHover();
            return;
          }

          const midpoint = leg.pathPoints[Math.floor(leg.pathPoints.length / 2)];
          if (!midpoint) {
            onClearHover();
            return;
          }

          const coords = getScreenCoords(globe, midpoint.lat, midpoint.lon, midpoint.altitude);
          onHoverLeg(leg.id, coords.x, coords.y);
        }}
        onPointClick={(point: object | null) => {
          const datum = point as GlobePointDatum | null;
          if (!datum || datum.kind !== "stop") {
            return;
          }

          onSelectStop(datum.stopId);
        }}
        onPathClick={(path: object | null) => {
          const leg = path as GlobePathDatum | null;
          if (!leg || ("kind" in leg && leg.kind === "traveler-trail")) {
            return;
          }

          onSelectLeg(leg.id);
        }}
        onGlobeClick={() => onClearSelection()}
      />
    </div>
  );
}
