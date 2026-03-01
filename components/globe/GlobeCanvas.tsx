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
  getAirportPointOfView,
  getBufferedLegPointOfView,
  getFlyDurationMs,
  getStopContextPointOfView,
} from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { interpolateTravelerPosition } from "../../lib/itinerary/interpolation";
import {
  getItineraryFitPointOfView,
  getVisibleLegRenderState,
} from "../../lib/state/selectors";
import styles from "./GlobeCanvas.module.css";

type CountryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
};

type GlobeCanvasProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: PlaybackState;
  enableHover: boolean;
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

const countryBorders = countries.features as CountryFeature[];

function getStopById(stops: ItineraryStop[], stopId: string) {
  return stops.find((stop) => stop.id === stopId) ?? null;
}

function getStopIndex(stops: ItineraryStop[], stopId: string) {
  return stops.findIndex((stop) => stop.id === stopId);
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

export function GlobeCanvas({
  stops,
  legs,
  selection,
  playback,
  enableHover,
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
  const globeReadyRef = useRef(false);
  const hasMountedRef = useRef(false);
  const [size, setSize] = useState({ width: 1280, height: 720 });

  const visibleStops = useMemo(
    () =>
      stops.filter(
        (stop): stop is ItineraryStop & { lat: number; lon: number } =>
          stop.lat !== null && stop.lon !== null
      ),
    [stops]
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
    controls.minDistance = 180;
    controls.maxDistance = 360;
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.85;
    applyGlobeMaterialSettings();
  }, [applyGlobeMaterialSettings, size.height, size.width]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || visibleStops.length === 0) {
      return;
    }

    if (playback.status === "playing") {
      const focusKey = "trip:playing";
      if (lastFocusKeyRef.current === focusKey) {
        return;
      }

      lastFocusKeyRef.current = focusKey;
      globe.pointOfView(getItineraryFitPointOfView(stops), 900);
      return;
    }

    if (selection?.kind === "stop") {
      const stop = getStopById(stops, selection.stopId);
      if (!stop || stop.lat === null || stop.lon === null) {
        return;
      }

      const stopIndex = getStopIndex(stops, stop.id);
      const previousStop = stopIndex > 0 ? stops[stopIndex - 1] ?? null : null;
      const nextStop = stopIndex < stops.length - 1 ? stops[stopIndex + 1] ?? null : null;
      const adjacentLegs = [
        stopIndex > 0 ? legs[stopIndex - 1] ?? null : null,
        stopIndex >= 0 ? legs[stopIndex] ?? null : null,
      ].filter((leg): leg is ItineraryLeg => leg !== null);
      const shouldUseContextFocus = adjacentLegs.some(
        (leg) => leg.mode === "air" || (leg.distanceKm ?? 0) > 600
      );
      const pointOfView = shouldUseContextFocus
        ? getStopContextPointOfView(stop, [previousStop, nextStop])
        : getAirportPointOfView(stop.lat, stop.lon);
      const focusKey = `stop:${stop.id}`;
      if (lastFocusKeyRef.current === focusKey) {
        return;
      }

      lastFocusKeyRef.current = focusKey;
      const current = globe.pointOfView();
      const isClose =
        Math.abs(current.lat - pointOfView.lat) < 12 &&
        Math.abs(current.lng - pointOfView.lng) < 12;
      globe.pointOfView(pointOfView, getFlyDurationMs(isClose));
      return;
    }

    if (selection?.kind === "leg") {
      const leg = legs.find((entry) => entry.id === selection.legId);
      const fromPoint = leg?.pathPoints[0] ?? null;
      const toPoint = leg?.pathPoints[leg.pathPoints.length - 1] ?? null;
      if (!leg || !fromPoint || !toPoint) {
        return;
      }

      const focusKey = `leg:${leg.id}`;
      if (lastFocusKeyRef.current === focusKey) {
        return;
      }

      lastFocusKeyRef.current = focusKey;
      globe.pointOfView(getBufferedLegPointOfView(fromPoint, toPoint), 900);
      return;
    }

    const focusKey = "trip:idle";
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }

    lastFocusKeyRef.current = focusKey;
    globe.pointOfView(getItineraryFitPointOfView(stops), 0);
  }, [legs, playback.status, selection, stops, visibleStops.length]);

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
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointAltitude={(point: object) => {
          const datum = point as GlobePointDatum;
          return datum.kind === "traveler" ? datum.altitude : 0;
        }}
        pointRadius={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler") {
            return 0.18;
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
        pathsData={renderedLegs}
        pathPoints={(leg: object) => (leg as RenderLegDatum).pathPoints}
        pathPointLat="lat"
        pathPointLng="lon"
        pathPointAlt="altitude"
        pathResolution={8}
        pathStroke={(leg: object) => getLegRenderStroke(leg as RenderLegDatum)}
        pathColor={(leg: object) => getLegRenderColor(leg as RenderLegDatum)}
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

          const leg = path as RenderLegDatum;
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
          const leg = path as RenderLegDatum | null;
          if (!leg) {
            return;
          }

          onSelectLeg(leg.id);
        }}
        onGlobeClick={() => onClearSelection()}
      />
    </div>
  );
}
