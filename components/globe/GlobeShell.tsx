"use client";

import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useReducer } from "react";
import { loadDataset } from "../../lib/data/loadDataset";
import { searchAirports } from "../../lib/data/search";
import type {
  AirportRecord,
  HoverState,
  LoadedDataset,
  RouteRecord,
} from "../../lib/data/types";
import { appReducer, initialAppState } from "../../lib/state/appState";
import {
  filterAndSortDestinations,
  getAirportBySelection,
  getAirportDestinations,
  getRouteBySelection,
  parseSelectionFromQuery,
  serializeSelectionToQuery,
} from "../../lib/state/selectors";
import { ErrorState } from "../ui/ErrorState";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { SidePanel } from "../ui/SidePanel";
import { SearchBox } from "../ui/SearchBox";
import { Tooltip } from "../ui/Tooltip";
import { EmptyState } from "../ui/EmptyState";
import styles from "./GlobeShell.module.css";
import { GlobeLegend } from "./GlobeLegend";

const GlobeCanvas = dynamic(
  () =>
    process.env.NEXT_PUBLIC_E2E === "1"
      ? import("./TestGlobeCanvas").then((mod) => mod.TestGlobeCanvas)
      : import("./GlobeCanvas").then((mod) => mod.GlobeCanvas),
  { ssr: false }
);

declare global {
  interface Window {
    __GLOBAL_PLANNER_TEST_API__?: {
      selectAirport: (airportId: string) => void;
      selectRoute: (routeId: string) => void;
      getState: () => {
        selection: ReturnType<typeof serializeSelectionToQuery>;
      };
    };
  }
}

export function getHoverContent(
  hover: HoverState,
  dataset: LoadedDataset
): { x: number; y: number; title: string; lines: string[] } | null {
  if (!hover) {
    return null;
  }

  if (hover.kind === "airport") {
    const airport = dataset.indexes.airportsById.get(hover.airportId);
    if (!airport) {
      return null;
    }

    return {
      x: hover.x,
      y: hover.y,
      title: airport.name,
      lines: [
        `${airport.city}, ${airport.country}`,
        `${airport.iata ?? airport.icao ?? "Code unavailable"}`,
        `${airport.routeCount} direct connections`,
      ],
    };
  }

  const route = dataset.indexes.routesById.get(hover.routeId);
  if (!route) {
    return null;
  }

  const airportA = dataset.indexes.airportsById.get(route.airportAId);
  const airportB = dataset.indexes.airportsById.get(route.airportBId);
  if (!airportA || !airportB) {
    return null;
  }

  return {
    x: hover.x,
    y: hover.y,
    title: `${airportA.name} ↔ ${airportB.name}`,
    lines: [
      `${route.distanceKm.toLocaleString()} km`,
      `${route.estimatedDurationMin} min est.`,
      route.directionality,
    ],
  };
}

export function GlobeShell() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const deferredSearchQuery = useDeferredValue(state.searchQuery);

  useEffect(() => {
    dispatch({ type: "dataset/loading" });

    loadDataset()
      .then((dataset) => {
        dispatch({ type: "dataset/loaded", dataset });
      })
      .catch((error: Error) => {
        dispatch({ type: "dataset/error", message: error.message });
      });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTouchMode = () => {
      dispatch({ type: "device/touch", value: mediaQuery.matches });
    };

    updateTouchMode();
    mediaQuery.addEventListener("change", updateTouchMode);

    return () => mediaQuery.removeEventListener("change", updateTouchMode);
  }, []);

  useEffect(() => {
    if (state.loadState.status !== "ready") {
      return;
    }

    if (state.hasHydratedUrl) {
      return;
    }

    dispatch({
      type: "selection/hydrate",
      selection: parseSelectionFromQuery(
        window.location.search,
        state.loadState.dataset.indexes
      ),
    });
  }, [state.hasHydratedUrl, state.loadState]);

  useEffect(() => {
    if (state.loadState.status !== "ready" || !state.hasHydratedUrl) {
      return;
    }

    const query = serializeSelectionToQuery(state.selection);
    const targetUrl = `${window.location.pathname}${query}`;
    window.history.replaceState({}, "", targetUrl);
  }, [state.hasHydratedUrl, state.loadState.status, state.selection]);

  useEffect(() => {
    if (state.loadState.status !== "ready" || !state.hasHydratedUrl) {
      return;
    }

    const { dataset } = state.loadState;
    const handlePopState = () => {
      dispatch({
        type: "selection/hydrate",
        selection: parseSelectionFromQuery(
          window.location.search,
          dataset.indexes
        ),
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [state.hasHydratedUrl, state.loadState]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1") {
      return;
    }

    window.__GLOBAL_PLANNER_TEST_API__ = {
      selectAirport: (airportId: string) => {
        dispatch({ type: "selection/airport", airportId });
      },
      selectRoute: (routeId: string) => {
        if (state.loadState.status !== "ready") {
          return;
        }

        const route = state.loadState.dataset.indexes.routesById.get(routeId);
        if (!route) {
          return;
        }

        dispatch({
          type: "selection/route",
          routeId,
          airportId: route.airportAId,
        });
      },
      getState: () => ({
        selection: serializeSelectionToQuery(state.selection),
      }),
    };

    return () => {
      delete window.__GLOBAL_PLANNER_TEST_API__;
    };
  }, [state.loadState, state.selection]);

  if (state.loadState.status === "error") {
    return (
      <ErrorState
        message={state.loadState.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const dataset = state.loadState.status === "ready" ? state.loadState.dataset : null;
  const searchResults = dataset
    ? searchAirports(dataset.airports, deferredSearchQuery, 8)
    : [];
  const hoverContent = dataset ? getHoverContent(state.hover, dataset) : null;
  const selectedAirport = dataset
    ? getAirportBySelection(state.selection, dataset.indexes)
    : null;
  const selectedRoute = dataset
    ? getRouteBySelection(state.selection, dataset.indexes)
    : null;
  const destinationItems =
    dataset && selectedAirport
      ? filterAndSortDestinations(
          getAirportDestinations(selectedAirport.id, dataset.indexes),
          state.panelFilterQuery,
          state.panelSortKey
        )
      : [];

  return (
    <main className={styles.shell}>
      <div className={styles.backgroundGlow} />
      {dataset ? (
        <GlobeCanvas
          airports={dataset.airports}
          routes={dataset.routes}
          indexes={dataset.indexes}
          selection={state.selection}
          enableHover={!state.isTouchDevice}
          onHoverAirport={(airportId, x, y) =>
            dispatch({ type: "hover/airport", airportId, x, y })
          }
          onHoverRoute={(routeId, x, y) =>
            dispatch({ type: "hover/route", routeId, x, y })
          }
          onClearHover={() => dispatch({ type: "hover/clear" })}
          onSelectAirport={(airportId) =>
            dispatch({ type: "selection/airport", airportId })
          }
          onSelectRoute={(routeId, airportId) =>
            dispatch({ type: "selection/route", routeId, airportId })
          }
          onClearSelection={() => dispatch({ type: "selection/clear" })}
        />
      ) : (
        <div className={styles.canvasPlaceholder} />
      )}

      <div className={styles.topBar}>
        <SearchBox
          query={state.searchQuery}
          results={searchResults}
          onQueryChange={(value) => {
            startTransition(() => {
              dispatch({ type: "search/query", value });
            });
          }}
          onSelect={(airport) => {
            dispatch({ type: "search/query", value: "" });
            dispatch({ type: "selection/airport", airportId: airport.id });
          }}
        />
      </div>

      <div className={styles.legendWrap}>
        {dataset ? <GlobeLegend manifest={dataset.manifest} /> : null}
      </div>

      <div className={styles.panelWrap}>
        {dataset ? (
          selectedAirport || selectedRoute ? (
            <SidePanel
              airport={selectedAirport}
              route={selectedRoute}
              destinationItems={destinationItems}
              panelFilterQuery={state.panelFilterQuery}
              panelSortKey={state.panelSortKey}
              indexes={dataset.indexes}
              isTouchDevice={state.isTouchDevice}
              onClose={() => dispatch({ type: "selection/clear" })}
              onFilterChange={(value) =>
                dispatch({ type: "panel/filter", value })
              }
              onSortChange={(value) => dispatch({ type: "panel/sort", value })}
              onSelectAirport={(airportId) =>
                dispatch({ type: "selection/airport", airportId })
              }
              onSelectRoute={(routeId, airportId) =>
                dispatch({ type: "selection/route", routeId, airportId })
              }
            />
          ) : (
            <EmptyState />
          )
        ) : null}
      </div>

      {hoverContent ? <Tooltip {...hoverContent} /> : null}

      <div className="sr-only" aria-live="polite" data-testid="dataset-status">
        {dataset
          ? `Loaded ${dataset.manifest.airportCount} airports and ${dataset.manifest.routeCount} routes`
          : "Loading dataset"}
      </div>

      {state.loadState.status !== "ready" ? <LoadingOverlay /> : null}
    </main>
  );
}
