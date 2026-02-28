"use client";

import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type {
  AirportRecord,
  DatasetIndexes,
  RouteRecord,
  SelectionState,
} from "../../lib/data/types";
import { getAirportPointOfView, getFlyDurationMs } from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { getRouteAltitude, getRouteStroke } from "../../lib/globe/routeGeometry";
import styles from "./GlobeCanvas.module.css";

type GlobeCanvasProps = {
  airports: AirportRecord[];
  routes: RouteRecord[];
  indexes: DatasetIndexes;
  selection: SelectionState;
  enableHover: boolean;
  onHoverAirport: (airportId: string, x: number, y: number) => void;
  onHoverRoute: (routeId: string, x: number, y: number) => void;
  onClearHover: () => void;
  onSelectAirport: (airportId: string) => void;
  onSelectRoute: (routeId: string, airportId: string) => void;
  onClearSelection: () => void;
};

function getScreenCoordsForAirport(globe: GlobeMethods, airport: AirportRecord) {
  const coords = globe.getScreenCoords(airport.lat, airport.lon, 0.02);
  return coords ?? { x: 0, y: 0 };
}

function getScreenCoordsForRoute(
  globe: GlobeMethods,
  route: RouteRecord,
  indexes: DatasetIndexes
) {
  const airportA = indexes.airportsById.get(route.airportAId);
  const airportB = indexes.airportsById.get(route.airportBId);

  if (!airportA || !airportB) {
    return { x: 0, y: 0 };
  }

  const coords = globe.getScreenCoords(
    (airportA.lat + airportB.lat) / 2,
    (airportA.lon + airportB.lon) / 2,
    getRouteAltitude(route.distanceKm) / 2
  );

  return coords ?? { x: 0, y: 0 };
}

export function GlobeCanvas({
  airports,
  routes,
  indexes,
  selection,
  enableHover,
  onHoverAirport,
  onHoverRoute,
  onClearHover,
  onSelectAirport,
  onSelectRoute,
  onClearSelection,
}: GlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 1280, height: 720 });

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

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 140;
    controls.maxDistance = 360;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !selection) {
      return;
    }

    const airportId =
      selection.kind === "airport" ? selection.airportId : selection.airportId;
    const airport = indexes.airportsById.get(airportId);

    if (!airport) {
      return;
    }

    const current = globe.pointOfView();
    const isClose =
      Math.abs(current.lat - airport.lat) < 12 &&
      Math.abs(current.lng - airport.lon) < 12;

    globe.pointOfView(
      getAirportPointOfView(airport.lat, airport.lon),
      getFlyDurationMs(isClose)
    );
  }, [indexes, selection]);

  const selectedAirportId =
    selection?.kind === "airport" ? selection.airportId : selection?.airportId;
  const selectedRouteId = selection?.kind === "route" ? selection.routeId : null;

  return (
    <div className={styles.canvas} ref={containerRef} data-testid="globe-canvas">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl="/textures/stars.svg"
        globeImageUrl="/textures/earth-day.svg"
        bumpImageUrl="/textures/earth-bump.svg"
        showAtmosphere
        atmosphereColor="#5ee6ff"
        atmosphereAltitude={0.16}
        pointsData={airports}
        pointLat="lat"
        pointLng="lon"
        pointAltitude={(airport: object) =>
          (airport as AirportRecord).id === selectedAirportId ? 0.026 : 0.016
        }
        pointRadius={(airport: object) =>
          (airport as AirportRecord).id === selectedAirportId ? 0.42 : 0.32
        }
        pointColor={(airport: object) => {
          const airportRecord = airport as AirportRecord;
          if (airportRecord.id === selectedAirportId) {
            return globeColors.airportSelected;
          }
          return globeColors.airport;
        }}
        pointsMerge={false}
        pointResolution={10}
        arcsData={routes}
        arcStartLat={(route: object) =>
          indexes.airportsById.get((route as RouteRecord).airportAId)?.lat ?? 0
        }
        arcStartLng={(route: object) =>
          indexes.airportsById.get((route as RouteRecord).airportAId)?.lon ?? 0
        }
        arcEndLat={(route: object) =>
          indexes.airportsById.get((route as RouteRecord).airportBId)?.lat ?? 0
        }
        arcEndLng={(route: object) =>
          indexes.airportsById.get((route as RouteRecord).airportBId)?.lon ?? 0
        }
        arcAltitude={(route: object) =>
          getRouteAltitude((route as RouteRecord).distanceKm)
        }
        arcStroke={(route: object) =>
          getRouteStroke(
            (route as RouteRecord).distanceKm,
            (route as RouteRecord).id === selectedRouteId
          )
        }
        arcColor={(route: object) => {
          const routeRecord = route as RouteRecord;
          if (routeRecord.id === selectedRouteId) {
            return globeColors.routeSelected;
          }
          return globeColors.route;
        }}
        arcDashLength={0.45}
        arcDashGap={1.4}
        arcDashAnimateTime={0}
        arcsTransitionDuration={500}
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

          const airport = point as AirportRecord;
          const coords = getScreenCoordsForAirport(globe, airport);
          onHoverAirport(airport.id, coords.x, coords.y);
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

          const route = arc as RouteRecord;
          const coords = getScreenCoordsForRoute(globe, route, indexes);
          onHoverRoute(route.id, coords.x, coords.y);
        }}
        onPointClick={(point: object) => {
          onSelectAirport((point as AirportRecord).id);
        }}
        onArcClick={(arc: object) => {
          const route = arc as RouteRecord;
          onSelectRoute(route.id, route.airportAId);
        }}
        onGlobeClick={() => {
          onClearHover();
          onClearSelection();
        }}
      />
    </div>
  );
}
