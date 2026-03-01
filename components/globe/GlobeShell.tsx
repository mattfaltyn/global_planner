"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { formatDistance } from "../../lib/data/formatters";
import { loadDataset } from "../../lib/data/loadDataset";
import { searchAirports } from "../../lib/data/search";
import type {
  GlobeSafeAreaInsets,
  HoverState,
  ItineraryLeg,
  ItineraryStop,
  ShellLayoutMode,
  SheetSnapPoint,
} from "../../lib/data/types";
import type { CameraSnapshot } from "../../lib/globe/camera";
import { resolveSeededItinerary } from "../../lib/itinerary/resolveStops";
import { appReducer, initialAppState } from "../../lib/state/appState";
import {
  getSelectedLeg,
  getTimelineSegments,
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
} from "../../lib/state/selectors";
import { ErrorState } from "../ui/ErrorState";
import { ItineraryDock } from "../ui/ItineraryDock";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { SearchBox } from "../ui/SearchBox";
import { Tooltip } from "../ui/Tooltip";
import { TripPlaybackBar } from "../ui/TripPlaybackBar";
import styles from "./GlobeShell.module.css";

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
      selectStop: (stopId: string) => void;
      selectLeg: (legId: string) => void;
      getState: () => {
        selection: ReturnType<typeof serializeItinerarySelectionToQuery>;
        stopCount: number;
        legCount: number;
        playbackStatus: string;
        tripProgress: number;
        activeLegIndex: number;
      };
      getCameraState: () => CameraSnapshot | null;
      getRenderState: () => {
        visibleLabelCount: number;
        visiblePathCount: number;
        visibleStopCount: number;
        playbackStatus: string;
        activeLegIndex: number;
      } | null;
    };
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function getHoverContent(
  hover: HoverState,
  stops: ItineraryStop[],
  legs: ItineraryLeg[]
): { x: number; y: number; title: string; lines: string[] } | null {
  if (!hover) {
    return null;
  }

  if (hover.kind === "stop") {
    const stop = stops.find((entry) => entry.id === hover.stopId);
    if (!stop) {
      return null;
    }

    return {
      x: hover.x,
      y: hover.y,
      title: stop.label,
      lines: [
        `${stop.city}, ${stop.country}`,
        `${formatDate(stop.arrivalDate)} -> ${formatDate(stop.departureDate)}`,
        stop.unresolved
          ? "Anchor unresolved"
          : stop.dayCount === null
            ? "Origin stop"
            : `${stop.dayCount} days`,
      ],
    };
  }

  const leg = legs.find((entry) => entry.id === hover.legId);
  if (!leg) {
    return null;
  }

  const fromStop = stops.find((entry) => entry.id === leg.fromStopId);
  const toStop = stops.find((entry) => entry.id === leg.toStopId);
  if (!fromStop || !toStop) {
    return null;
  }

  return {
    x: hover.x,
    y: hover.y,
    title: `${fromStop.label} -> ${toStop.label}`,
    lines: [
      `${leg.mode === "air" ? "Air" : "Ground"} leg`,
      leg.distanceKm === null ? "Distance unavailable" : formatDistance(leg.distanceKm),
      `${fromStop.city}, ${fromStop.country} to ${toStop.city}, ${toStop.country}`,
    ],
  };
}

export function GlobeShell() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [autoFollowSuspended, setAutoFollowSuspended] = useState(false);
  const [forceRecenterToken, setForceRecenterToken] = useState(0);
  const [layoutMode, setLayoutMode] = useState<ShellLayoutMode>("mobile");
  const [sheetSnapPoint, setSheetSnapPoint] = useState<SheetSnapPoint>("collapsed");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [safeAreaInsets, setSafeAreaInsets] = useState<GlobeSafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
  const playbackStatusRef = useRef(state.playback.status);
  const playbackFrameIdRef = useRef<number | null>(null);
  const playbackLastTickRef = useRef<number | null>(null);
  const cameraStateRef = useRef<CameraSnapshot | null>(null);
  const renderStateRef = useRef<{
    visibleLabelCount: number;
    visiblePathCount: number;
    visibleStopCount: number;
    playbackStatus: string;
    activeLegIndex: number;
  } | null>(null);
  const deferredSearchQuery = useDeferredValue(state.searchQuery);
  const dataset = state.loadState.status === "ready" ? state.loadState.dataset : null;
  const searchResults =
    dataset && deferredSearchQuery.trim().length > 0
      ? searchAirports(dataset.airports, deferredSearchQuery, 8)
      : [];
  const hoverContent = getHoverContent(
    state.hover,
    state.itinerary.stops,
    state.itinerary.legs
  );
  const selectedLeg = getSelectedLeg(state.selection, state.itinerary.legs);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const playbackRailRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const timelineSegments = useMemo(
    () => getTimelineSegments(state.itinerary.legs, state.itinerary.stops),
    [state.itinerary.legs, state.itinerary.stops]
  );
  const handleCameraStateChange = useCallback((snapshot: CameraSnapshot) => {
    cameraStateRef.current = snapshot;
  }, []);
  const handleRenderStateChange = useCallback(
    (snapshot: {
      visibleLabelCount: number;
      visiblePathCount: number;
      visibleStopCount: number;
      playbackStatus: string;
      activeLegIndex: number;
    }) => {
      renderStateRef.current = snapshot;
    },
    []
  );

  useEffect(() => {
    dispatch({ type: "dataset/loading" });

    loadDataset()
      .then((nextDataset) => {
        dispatch({ type: "dataset/loaded", dataset: nextDataset });
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
    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const updateLayoutMode = () => {
      setLayoutMode(mediaQuery.matches ? "mobile" : "desktop");
    };

    updateLayoutMode();
    mediaQuery.addEventListener("change", updateLayoutMode);
    return () => mediaQuery.removeEventListener("change", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (layoutMode !== "mobile") {
      setSheetSnapPoint("collapsed");
      return;
    }

    if (state.dockMode === "edit") {
      setSheetSnapPoint("full");
    }
  }, [layoutMode, state.dockMode]);

  useEffect(() => {
    const topBar = topBarRef.current;
    const playbackRail = playbackRailRef.current;
    const dock = dockRef.current;

    const updateInsets = () => {
      if (layoutMode === "desktop") {
        setSafeAreaInsets({
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        });
        return;
      }

      const topInset = (topBar?.getBoundingClientRect().height ?? 0) + 16;
      const playbackInset = (playbackRail?.getBoundingClientRect().height ?? 0) + 16;
      const dockInset =
        sheetSnapPoint !== "collapsed"
          ? (dock?.getBoundingClientRect().height ?? 0) + 8
          : 0;

      setSafeAreaInsets({
        top: topInset,
        right: 0,
        bottom: playbackInset + dockInset,
        left: 0,
      });
    };

    updateInsets();

    const observer = new ResizeObserver(() => updateInsets());
    if (topBar) {
      observer.observe(topBar);
    }
    if (playbackRail) {
      observer.observe(playbackRail);
    }
    if (dock) {
      observer.observe(dock);
    }

    return () => observer.disconnect();
  }, [layoutMode, sheetSnapPoint, state.dockCollapsed, state.dockMode]);

  useEffect(() => {
    if (state.loadState.status !== "ready" || state.itinerary.stops.length > 0) {
      return;
    }

    dispatch({
      type: "itinerary/seed",
      stops: resolveSeededItinerary(state.loadState.dataset.airports),
    });
  }, [state.itinerary.stops.length, state.loadState]);

  useEffect(() => {
    if (
      state.loadState.status !== "ready" ||
      state.itinerary.stops.length === 0 ||
      state.hasHydratedUrl
    ) {
      return;
    }

    dispatch({
      type: "selection/hydrate",
      selection: parseItinerarySelectionFromQuery(
        window.location.search,
        state.itinerary.stops,
        state.itinerary.legs
      ),
    });
  }, [
    state.hasHydratedUrl,
    state.itinerary.legs,
    state.itinerary.stops,
    state.loadState,
  ]);

  useEffect(() => {
    if (state.loadState.status !== "ready" || !state.hasHydratedUrl) {
      return;
    }

    const query = serializeItinerarySelectionToQuery(state.selection);
    window.history.replaceState({}, "", `${window.location.pathname}${query}`);
  }, [state.hasHydratedUrl, state.loadState.status, state.selection]);

  useEffect(() => {
    if (
      state.loadState.status !== "ready" ||
      state.itinerary.stops.length === 0 ||
      !state.hasHydratedUrl
    ) {
      return;
    }

    const handlePopState = () => {
      dispatch({
        type: "selection/hydrate",
        selection: parseItinerarySelectionFromQuery(
          window.location.search,
          state.itinerary.stops,
          state.itinerary.legs
        ),
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    state.hasHydratedUrl,
    state.itinerary.legs,
    state.itinerary.stops,
    state.loadState,
  ]);

  useEffect(() => {
    playbackStatusRef.current = state.playback.status;
  }, [state.playback.status]);

  useEffect(() => {
    if (state.playback.status !== "playing") {
      if (playbackFrameIdRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameIdRef.current);
        playbackFrameIdRef.current = null;
      }
      playbackLastTickRef.current = null;
      return;
    }

    let cancelled = false;

    const frame = (now: number) => {
      if (cancelled || playbackStatusRef.current !== "playing") {
        playbackFrameIdRef.current = null;
        playbackLastTickRef.current = null;
        return;
      }

      const lastTick = playbackLastTickRef.current ?? now;
      const deltaMs = Math.max(0, Math.min(64, now - lastTick));
      playbackLastTickRef.current = now;

      if (deltaMs > 0) {
        dispatch({ type: "playback/advance-frame", deltaMs });
      }

      playbackFrameIdRef.current = window.requestAnimationFrame(frame);
    };

    if (playbackFrameIdRef.current === null) {
      playbackFrameIdRef.current = window.requestAnimationFrame(frame);
    }

    return () => {
      cancelled = true;
      if (playbackFrameIdRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameIdRef.current);
        playbackFrameIdRef.current = null;
      }
      playbackLastTickRef.current = null;
    };
  }, [state.playback.status]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== "1") {
      return;
    }

    window.__GLOBAL_PLANNER_TEST_API__ = {
      selectStop: (stopId: string) => {
        if (!state.itinerary.stops.some((stop) => stop.id === stopId)) {
          return;
        }

        dispatch({ type: "itinerary/select-stop", stopId });
      },
      selectLeg: (legId: string) => {
        if (!state.itinerary.legs.some((leg) => leg.id === legId)) {
          return;
        }

        dispatch({ type: "itinerary/select-leg", legId });
      },
      getState: () => ({
        selection: serializeItinerarySelectionToQuery(state.selection),
        stopCount: state.itinerary.stops.length,
        legCount: state.itinerary.legs.length,
        playbackStatus: state.playback.status,
        tripProgress: state.playback.tripProgress,
        activeLegIndex: state.playback.activeLegIndex,
      }),
      getCameraState: () => cameraStateRef.current,
      getRenderState: () => renderStateRef.current,
    };

    return () => {
      delete window.__GLOBAL_PLANNER_TEST_API__;
    };
  }, [state.itinerary.legs, state.itinerary.stops, state.playback, state.selection]);

  const handleSetMode = useCallback(
    (mode: "playback" | "edit") => {
      dispatch({ type: "dock/set-mode", mode });
      if (layoutMode === "mobile") {
        setSheetSnapPoint(mode === "edit" ? "full" : "half");
      }
    },
    [layoutMode]
  );

  const handleToggleCollapsed = useCallback(() => {
    if (layoutMode === "mobile") {
      setSheetSnapPoint((current) =>
        current === "collapsed" ? (state.dockMode === "edit" ? "full" : "half") : "collapsed"
      );
      return;
    }

    dispatch({ type: "dock/toggle-collapsed" });
  }, [layoutMode, state.dockMode]);

  const handleOpenEdit = useCallback(() => {
    dispatch({ type: "dock/set-mode", mode: "edit" });
    if (layoutMode === "mobile") {
      setSheetSnapPoint("full");
    }
  }, [layoutMode]);

  const handleSelectStop = useCallback(
    (stopId: string) => {
      dispatch({ type: "itinerary/select-stop", stopId });
      if (layoutMode === "mobile") {
        setSheetSnapPoint("full");
      }
    },
    [layoutMode]
  );

  const handleSelectLeg = useCallback(
    (legId: string) => {
      dispatch({ type: "itinerary/select-leg", legId });
      if (layoutMode === "mobile") {
        setSheetSnapPoint("full");
      }
    },
    [layoutMode]
  );

  if (state.loadState.status === "error") {
    return <ErrorState message={state.loadState.message} onRetry={() => window.location.reload()} />;
  }

  return (
    <main className={layoutMode === "desktop" ? styles.desktopShell : styles.mobileShell}>
      <div className={styles.backgroundGlow} />
      {dataset ? (
        <>
          {layoutMode === "desktop" ? (
            <div className={styles.desktopMain}>
              <aside className={styles.desktopLeftRail}>
                <div className={styles.desktopSearchWrap}>
                  <SearchBox
                    layoutMode={layoutMode}
                    expanded={searchExpanded}
                    query={state.searchQuery}
                    results={searchResults}
                    placeholder={
                      state.searchIntent.kind === "replace-anchor"
                        ? "Replace anchor with a city or airport"
                        : "Add a city or airport"
                    }
                    onQueryChange={(value) => dispatch({ type: "search/query", value })}
                    onFocus={() => setSearchExpanded(true)}
                    onBlur={() => {
                      if (state.searchQuery.trim().length === 0) {
                        setSearchExpanded(false);
                      }
                    }}
                    onSelect={(airport) => {
                      setSearchExpanded(false);
                      startTransition(() => {
                        dispatch({ type: "itinerary/add-stop", airport });
                      });
                    }}
                  />
                </div>

                <div className={styles.desktopDockWrap} ref={dockRef}>
                  <ItineraryDock
                    stops={state.itinerary.stops}
                    legs={state.itinerary.legs}
                    selection={state.selection}
                    playback={state.playback}
                    layoutMode={layoutMode}
                    shellState={{
                      mode: state.dockMode,
                      collapsed: state.dockCollapsed,
                    }}
                    showRecenter={autoFollowSuspended && state.playback.status === "playing"}
                    onSetMode={handleSetMode}
                    onToggleCollapsed={handleToggleCollapsed}
                    onRecenter={() => {
                      setAutoFollowSuspended(false);
                      setForceRecenterToken((token) => token + 1);
                    }}
                    onSelectStop={handleSelectStop}
                    onMoveStopUp={(stopId) =>
                      dispatch({ type: "itinerary/move-stop-up", stopId })
                    }
                    onMoveStopDown={(stopId) =>
                      dispatch({ type: "itinerary/move-stop-down", stopId })
                    }
                    onRemoveStop={(stopId) =>
                      dispatch({ type: "itinerary/remove-stop", stopId })
                    }
                    onInsertAfter={(index, stopId) => {
                      dispatch({ type: "itinerary/set-insert-index", index });
                      handleSelectStop(stopId);
                    }}
                    onUpdateStop={(stopId, patch) =>
                      dispatch({ type: "itinerary/update-stop", stopId, patch })
                    }
                    onReplaceAnchor={(stopId) =>
                      dispatch({ type: "itinerary/replace-anchor", stopId })
                    }
                    onSetLegMode={(legId, mode) =>
                      dispatch({ type: "itinerary/set-leg-mode", legId, mode })
                    }
                    onPlayLeg={(legId) => {
                      dispatch({ type: "dock/set-mode", mode: "playback" });
                      dispatch({ type: "playback/jump-to-leg-start", legId });
                      dispatch({ type: "playback/play" });
                    }}
                  />
                </div>
              </aside>

              <section className={styles.desktopStage}>
                <GlobeCanvas
                  stops={state.itinerary.stops}
                  legs={state.itinerary.legs}
                  selection={state.selection}
                  playback={state.playback}
                  safeAreaInsets={safeAreaInsets}
                  isTouchDevice={state.isTouchDevice}
                  enableHover={!state.isTouchDevice}
                  forceRecenterToken={forceRecenterToken}
                  onAutoFollowSuspendedChange={setAutoFollowSuspended}
                  onCameraStateChange={handleCameraStateChange}
                  onRenderStateChange={handleRenderStateChange}
                  onHoverStop={(stopId, x, y) =>
                    dispatch({ type: "hover/stop", stopId, x, y })
                  }
                  onHoverLeg={(legId, x, y) =>
                    dispatch({ type: "hover/leg", legId, x, y })
                  }
                  onClearHover={() => dispatch({ type: "hover/clear" })}
                  onSelectStop={handleSelectStop}
                  onSelectLeg={handleSelectLeg}
                  onClearSelection={() => dispatch({ type: "selection/clear" })}
                />
              </section>

              <aside className={styles.desktopRightRail}>
                <div className={styles.desktopPlaybackPanel} ref={playbackRailRef}>
                  <TripPlaybackBar
                  stops={state.itinerary.stops}
                  legs={state.itinerary.legs}
                  playback={state.playback}
                  layoutMode={layoutMode}
                  compact
                  showRecenter={autoFollowSuspended && state.playback.status === "playing"}
                  onPlay={() => dispatch({ type: "playback/play" })}
                  onPause={() => dispatch({ type: "playback/pause" })}
                  onReset={() => dispatch({ type: "playback/reset" })}
                  onStepPrev={() => dispatch({ type: "playback/step-prev" })}
                  onStepNext={() => dispatch({ type: "playback/step-next" })}
                  onSpeedChange={(speed) => dispatch({ type: "playback/set-speed", speed })}
                  onProgressChange={(progress) =>
                    dispatch({ type: "playback/set-trip-progress", progress })
                  }
                  onOpenEdit={handleOpenEdit}
                  onRecenter={() => {
                    setAutoFollowSuspended(false);
                    setForceRecenterToken((token) => token + 1);
                  }}
                />
                </div>
              </aside>
            </div>
          ) : null}

          {layoutMode === "mobile" ? (
            <>
              <div className={styles.mobileTopBar} ref={topBarRef}>
                <SearchBox
                  layoutMode={layoutMode}
                  expanded={searchExpanded}
                  query={state.searchQuery}
                  results={searchResults}
                  placeholder={
                    state.searchIntent.kind === "replace-anchor"
                      ? "Replace anchor with a city or airport"
                      : "Add a city or airport"
                  }
                  onQueryChange={(value) => dispatch({ type: "search/query", value })}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => {
                    if (state.searchQuery.trim().length === 0) {
                      setSearchExpanded(false);
                    }
                  }}
                  onSelect={(airport) => {
                    setSearchExpanded(false);
                    startTransition(() => {
                      dispatch({ type: "itinerary/add-stop", airport });
                    });
                  }}
                />
              </div>

              <section className={styles.mobileStage}>
                <GlobeCanvas
                  stops={state.itinerary.stops}
                  legs={state.itinerary.legs}
                  selection={state.selection}
                  playback={state.playback}
                  safeAreaInsets={safeAreaInsets}
                  isTouchDevice={state.isTouchDevice}
                  enableHover={!state.isTouchDevice}
                  forceRecenterToken={forceRecenterToken}
                  onAutoFollowSuspendedChange={setAutoFollowSuspended}
                  onCameraStateChange={handleCameraStateChange}
                  onRenderStateChange={handleRenderStateChange}
                  onHoverStop={(stopId, x, y) =>
                    dispatch({ type: "hover/stop", stopId, x, y })
                  }
                  onHoverLeg={(legId, x, y) =>
                    dispatch({ type: "hover/leg", legId, x, y })
                  }
                  onClearHover={() => dispatch({ type: "hover/clear" })}
                  onSelectStop={handleSelectStop}
                  onSelectLeg={handleSelectLeg}
                  onClearSelection={() => dispatch({ type: "selection/clear" })}
                />
              </section>

              <div className={styles.mobilePlaybackRail} ref={playbackRailRef}>
                <TripPlaybackBar
                  stops={state.itinerary.stops}
                  legs={state.itinerary.legs}
                  playback={state.playback}
                  layoutMode={layoutMode}
                  compact
                  showRecenter={autoFollowSuspended && state.playback.status === "playing"}
                  onPlay={() => dispatch({ type: "playback/play" })}
                  onPause={() => dispatch({ type: "playback/pause" })}
                  onReset={() => dispatch({ type: "playback/reset" })}
                  onStepPrev={() => dispatch({ type: "playback/step-prev" })}
                  onStepNext={() => dispatch({ type: "playback/step-next" })}
                  onSpeedChange={(speed) => dispatch({ type: "playback/set-speed", speed })}
                  onProgressChange={(progress) =>
                    dispatch({ type: "playback/set-trip-progress", progress })
                  }
                  onOpenEdit={handleOpenEdit}
                  onRecenter={() => {
                    setAutoFollowSuspended(false);
                    setForceRecenterToken((token) => token + 1);
                  }}
                />
              </div>

              <div className={styles.mobileBottomSheet} ref={dockRef}>
                <ItineraryDock
                  stops={state.itinerary.stops}
                  legs={state.itinerary.legs}
                  selection={state.selection}
                  playback={state.playback}
                  layoutMode={layoutMode}
                  shellState={{
                    mode: state.dockMode,
                    collapsed: sheetSnapPoint === "collapsed",
                    snapPoint: sheetSnapPoint,
                  }}
                  showRecenter={autoFollowSuspended && state.playback.status === "playing"}
                  onSetMode={handleSetMode}
                  onToggleCollapsed={handleToggleCollapsed}
                  onRecenter={() => {
                    setAutoFollowSuspended(false);
                    setForceRecenterToken((token) => token + 1);
                  }}
                  onSelectStop={handleSelectStop}
                  onMoveStopUp={(stopId) =>
                    dispatch({ type: "itinerary/move-stop-up", stopId })
                  }
                  onMoveStopDown={(stopId) =>
                    dispatch({ type: "itinerary/move-stop-down", stopId })
                  }
                  onRemoveStop={(stopId) =>
                    dispatch({ type: "itinerary/remove-stop", stopId })
                  }
                  onInsertAfter={(index, stopId) => {
                    dispatch({ type: "itinerary/set-insert-index", index });
                    handleSelectStop(stopId);
                  }}
                  onUpdateStop={(stopId, patch) =>
                    dispatch({ type: "itinerary/update-stop", stopId, patch })
                  }
                  onReplaceAnchor={(stopId) =>
                    dispatch({ type: "itinerary/replace-anchor", stopId })
                  }
                  onSetLegMode={(legId, mode) =>
                    dispatch({ type: "itinerary/set-leg-mode", legId, mode })
                  }
                  onPlayLeg={(legId) => {
                    setSheetSnapPoint("half");
                    dispatch({ type: "dock/set-mode", mode: "playback" });
                    dispatch({ type: "playback/jump-to-leg-start", legId });
                    dispatch({ type: "playback/play" });
                  }}
                />
              </div>
            </>
          ) : null}

          {hoverContent ? (
            <Tooltip
              x={hoverContent.x}
              y={hoverContent.y}
              title={hoverContent.title}
              lines={hoverContent.lines}
            />
          ) : null}

          <p
            data-testid="dataset-status"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            Loaded {dataset.manifest.airportCount} airports and {dataset.manifest.routeCount} routes
          </p>

          {selectedLeg ? (
            <p
              data-testid="selected-leg-mode"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              {selectedLeg.mode}
            </p>
          ) : null}

          <p
            data-testid="timeline-state"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {timelineSegments.length} timeline segments
          </p>
        </>
      ) : null}

      {state.loadState.status !== "ready" ? <LoadingOverlay /> : null}
    </main>
  );
}
