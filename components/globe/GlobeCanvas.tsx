"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "../../lib/data/types";
import {
  getAirportPointOfView,
  getFlyDurationMs,
  getLegPointOfView,
  getOverviewPointOfView,
} from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { interpolateTravelerPosition } from "../../lib/itinerary/interpolation";
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
  playback: {
    status: "idle" | "playing" | "paused";
    activeLegIndex: number;
    progress: number;
  };
  enableHover: boolean;
  onHoverStop: (stopId: string, x: number, y: number) => void;
  onHoverLeg: (legId: string, x: number, y: number) => void;
  onClearHover: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectLeg: (legId: string) => void;
  onClearSelection: () => void;
};

const countryBorders = countries.features as CountryFeature[];

function getStopById(stops: ItineraryStop[], stopId: string) {
  return stops.find((stop) => stop.id === stopId) ?? null;
}

function getLegMidpoint(leg: ItineraryLeg) {
  if (leg.pathPoints.length === 0) {
    return null;
  }

  return leg.pathPoints[Math.floor(leg.pathPoints.length / 2)] ?? null;
}

function getScreenCoords(
  globe: GlobeMethods,
  lat: number,
  lon: number,
  altitude: number
) {
  const coords = globe.getScreenCoords(lat, lon, altitude);
  return coords ?? { x: 0, y: 0 };
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
  const initialViewSetRef = useRef(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [size, setSize] = useState({ width: 1280, height: 720 });

  const visibleStops = useMemo(
    () =>
      stops
        .filter(
          (stop): stop is ItineraryStop & { lat: number; lon: number } =>
            stop.lat !== null && stop.lon !== null
        )
        .map((stop) => ({
          kind: "stop" as const,
          stopId: stop.id,
          lat: stop.lat,
          lon: stop.lon,
        })),
    [stops]
  );

  const airLegs = useMemo(() => legs.filter((leg) => leg.mode === "air"), [legs]);
  const groundLegs = useMemo(
    () => legs.filter((leg) => leg.mode === "ground"),
    [legs]
  );
  const activeLeg = legs[playback.activeLegIndex] ?? null;
  const travelerPoint = useMemo(() => {
    if (playback.status === "idle" || !activeLeg) {
      return null;
    }

    const interpolated = interpolateTravelerPosition(activeLeg, playback.progress);
    if (!interpolated) {
      return null;
    }

    return {
      kind: "traveler" as const,
      lat: interpolated.lat,
      lon: interpolated.lon,
      altitude: interpolated.altitude,
    };
  }, [activeLeg, playback.progress, playback.status]);

  const pointsData = useMemo(
    () =>
      travelerPoint ? ([...visibleStops, travelerPoint] satisfies GlobePointDatum[]) : visibleStops,
    [travelerPoint, visibleStops]
  );

  const selectedStopId = selection?.kind === "stop" ? selection.stopId : null;
  const selectedLegId = selection?.kind === "leg" ? selection.legId : null;
  const activeDestinationStopId = activeLeg?.toStopId ?? null;
  const visitedStopIds = new Set(
    playback.status === "idle"
      ? []
      : stops.slice(0, Math.min(stops.length, playback.activeLegIndex + 1)).map((stop) => stop.id)
  );

  useEffect(() => {
    const container = containerRef.current;
    /* c8 ignore next 3 */
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
    controls.maxDistance = 360;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;
  }, [size.height, size.width]);

  useEffect(() => {
    const globe = globeRef.current as
      | (GlobeMethods & { globeMaterial?: () => MeshPhongMaterial | undefined })
      | undefined;
    if (!globe || !globeReady) {
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
  }, [globeReady]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || initialViewSetRef.current) {
      return;
    }

    const initialLeg = legs[0];
    const fromPoint = initialLeg?.pathPoints[0] ?? null;
    const toPoint = initialLeg?.pathPoints[initialLeg.pathPoints.length - 1] ?? null;

    if (fromPoint && toPoint) {
      globe.pointOfView(getLegPointOfView(fromPoint, toPoint), 0);
      initialViewSetRef.current = true;
      return;
    }

    if (visibleStops.length === 0) {
      return;
    }

    globe.pointOfView(getOverviewPointOfView(visibleStops), 0);
    initialViewSetRef.current = true;
  }, [legs, visibleStops]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) {
      return;
    }

    if (selection?.kind === "stop") {
      const stop = getStopById(stops, selection.stopId);
      if (!stop || stop.lat === null || stop.lon === null) {
        return;
      }

      const current = globe.pointOfView();
      const isClose =
        Math.abs(current.lat - stop.lat) < 12 && Math.abs(current.lng - stop.lon) < 12;
      const focusKey = `stop:${stop.id}`;
      if (lastFocusKeyRef.current === focusKey) {
        return;
      }

      lastFocusKeyRef.current = focusKey;
      globe.pointOfView(
        getAirportPointOfView(stop.lat, stop.lon),
        getFlyDurationMs(isClose)
      );
      return;
    }

    const focusLeg =
      selection?.kind === "leg"
        ? legs.find((leg) => leg.id === selection.legId) ?? null
        : playback.status !== "idle"
          ? activeLeg
          : null;

    if (!focusLeg) {
      lastFocusKeyRef.current = null;
      return;
    }

    const midpoint = getLegMidpoint(focusLeg);
    if (!midpoint) {
      return;
    }

    const focusKey = `leg:${focusLeg.id}`;
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }

    lastFocusKeyRef.current = focusKey;
    globe.pointOfView(
      {
        lat: midpoint.lat,
        lng: midpoint.lon,
        altitude: 1.9,
      },
      900
    );
  }, [activeLeg, legs, playback.status, selection, stops]);

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
        onGlobeReady={() => setGlobeReady(true)}
        showAtmosphere
        atmosphereColor="#5ee6ff"
        atmosphereAltitude={0.11}
        polygonsData={countryBorders}
        polygonCapColor={() => "rgba(0, 0, 0, 0)"}
        polygonSideColor={() => "rgba(0, 0, 0, 0)"}
        polygonStrokeColor={() => "rgba(221, 243, 255, 0.36)"}
        polygonAltitude={0.002}
        polygonsTransitionDuration={0}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointAltitude={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler") {
            return datum.altitude;
          }

          if (datum.stopId === selectedStopId) {
            return 0.02;
          }

          if (datum.stopId === activeDestinationStopId) {
            return 0.016;
          }

          return visitedStopIds.has(datum.stopId) ? 0.008 : 0.011;
        }}
        pointRadius={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler") {
            return 0.16;
          }

          if (datum.stopId === selectedStopId) {
            return 0.17;
          }

          if (datum.stopId === activeDestinationStopId) {
            return 0.15;
          }

          return visitedStopIds.has(datum.stopId) ? 0.09 : 0.11;
        }}
        pointColor={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "traveler") {
            return globeColors.traveler;
          }

          if (datum.stopId === selectedStopId) {
            return globeColors.stopSelected;
          }

          if (datum.stopId === activeDestinationStopId) {
            return globeColors.stopActive;
          }

          return visitedStopIds.has(datum.stopId)
            ? globeColors.stopVisited
            : globeColors.stop;
        }}
        pointsMerge={false}
        pointResolution={10}
        arcsData={airLegs}
        arcStartLat={(leg: object) => (leg as ItineraryLeg).pathPoints[0]?.lat ?? 0}
        arcStartLng={(leg: object) => (leg as ItineraryLeg).pathPoints[0]?.lon ?? 0}
        arcEndLat={(leg: object) => {
          const pathPoints = (leg as ItineraryLeg).pathPoints;
          return pathPoints[pathPoints.length - 1]?.lat ?? 0;
        }}
        arcEndLng={(leg: object) => {
          const pathPoints = (leg as ItineraryLeg).pathPoints;
          return pathPoints[pathPoints.length - 1]?.lon ?? 0;
        }}
        arcAltitude={(leg: object) => {
          const midpoint = getLegMidpoint(leg as ItineraryLeg);
          return midpoint?.altitude ?? 0.08;
        }}
        arcStroke={(leg: object) =>
          (leg as ItineraryLeg).id === selectedLegId ? 1.1 : 0.5
        }
        arcColor={(leg: object) =>
          (leg as ItineraryLeg).id === selectedLegId
            ? globeColors.airLegSelected
            : globeColors.airLeg
        }
        arcDashLength={0.6}
        arcDashGap={1.4}
        arcDashAnimateTime={0}
        arcsTransitionDuration={300}
        pathsData={groundLegs}
        pathPoints={(leg: object) => (leg as ItineraryLeg).pathPoints}
        pathPointLat="lat"
        pathPointLng="lon"
        pathPointAlt="altitude"
        pathResolution={2}
        pathStroke={(leg: object) =>
          (leg as ItineraryLeg).id === selectedLegId ? 1.2 : 0.7
        }
        pathColor={(leg: object) =>
          (leg as ItineraryLeg).id === selectedLegId
            ? globeColors.groundLegSelected
            : globeColors.groundLeg
        }
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

          const coords = getScreenCoords(globe, datum.lat, datum.lon, 0.02);
          onHoverStop(datum.stopId, coords.x, coords.y);
        }}
        onArcHover={(arc: object | null) => {
          if (!enableHover) {
            return;
          }

          const globe = globeRef.current;
          if (!arc || !globe) {
            onClearHover();
            return;
          }

          const midpoint = getLegMidpoint(arc as ItineraryLeg);
          if (!midpoint) {
            onClearHover();
            return;
          }

          const coords = getScreenCoords(
            globe,
            midpoint.lat,
            midpoint.lon,
            midpoint.altitude
          );
          onHoverLeg((arc as ItineraryLeg).id, coords.x, coords.y);
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

          const midpoint = getLegMidpoint(path as ItineraryLeg);
          if (!midpoint) {
            onClearHover();
            return;
          }

          const coords = getScreenCoords(
            globe,
            midpoint.lat,
            midpoint.lon,
            midpoint.altitude
          );
          onHoverLeg((path as ItineraryLeg).id, coords.x, coords.y);
        }}
        onPointClick={(point: object) => {
          const datum = point as GlobePointDatum;
          if (datum.kind === "stop") {
            onSelectStop(datum.stopId);
          }
        }}
        onArcClick={(arc: object) => {
          onSelectLeg((arc as ItineraryLeg).id);
        }}
        onPathClick={(path: object) => {
          onSelectLeg((path as ItineraryLeg).id);
        }}
        onGlobeClick={() => {
          onClearHover();
          onClearSelection();
        }}
      />
    </div>
  );
}
