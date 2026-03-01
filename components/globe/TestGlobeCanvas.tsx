import { useEffect, useMemo, useState } from "react";
import type { ItineraryLeg, ItinerarySelection, ItineraryStop, PathPoint } from "../../lib/data/types";
import {
  type CameraSnapshot,
  resolveCameraIntent,
} from "../../lib/globe/camera";
import { interpolateTravelerPosition } from "../../lib/itinerary/interpolation";
import {
  getPlaybackRenderWindow,
  shouldRenderLegInPlaybackWindow,
  shouldRenderStopInPlaybackWindow,
} from "../../lib/state/selectors";
import styles from "./GlobeCanvas.module.css";

type TestGlobeCanvasProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  isTouchDevice?: boolean;
  playback: {
    status: "idle" | "playing" | "paused";
    speed: 0.5 | 1 | 2 | 4;
    tripProgress: number;
    activeLegIndex: number;
    activeLegProgress: number;
    phase: "travel" | "dwell";
  };
  forceRecenterToken?: number;
  onAutoFollowSuspendedChange?: (suspended: boolean) => void;
  onCameraStateChange?: (snapshot: CameraSnapshot) => void;
  onRenderStateChange?: (snapshot: {
    visibleLabelCount: number;
    visiblePathCount: number;
    visibleStopCount: number;
    playbackStatus: "idle" | "playing" | "paused";
    activeLegIndex: number;
  }) => void;
  onSelectStop: (stopId: string) => void;
  onSelectLeg: (legId: string) => void;
  onClearSelection: () => void;
};

export function TestGlobeCanvas({
  stops,
  legs,
  selection,
  isTouchDevice = false,
  playback,
  forceRecenterToken = 0,
  onAutoFollowSuspendedChange,
  onCameraStateChange,
  onRenderStateChange,
  onSelectStop,
  onSelectLeg,
  onClearSelection,
}: TestGlobeCanvasProps) {
  const [suspended, setSuspended] = useState(false);
  const travelerPoint = useMemo<PathPoint | null>(() => {
    const activeLeg = legs[playback.activeLegIndex] ?? null;
    if (!activeLeg) {
      return null;
    }

    return interpolateTravelerPosition(activeLeg, playback.activeLegProgress);
  }, [legs, playback.activeLegIndex, playback.activeLegProgress]);
  const renderWindow = useMemo(
    () => getPlaybackRenderWindow(stops, legs, playback),
    [legs, playback, stops]
  );
  const intent = useMemo(
    () =>
      resolveCameraIntent({
        stops,
        legs,
        selection,
        playback,
        travelerPoint,
        isTouchDevice,
        autoFollowSuspendedUntil: suspended ? Date.now() + 4500 : null,
        nowMs: Date.now(),
        currentPointOfView: { lat: 22, lng: -32, altitude: 1.74 },
      }),
    [isTouchDevice, legs, playback, selection, stops, suspended, travelerPoint]
  );
  const visiblePathCount = useMemo(
    () =>
      legs.filter((_, index) => shouldRenderLegInPlaybackWindow(index, renderWindow)).length,
    [legs, renderWindow]
  );
  const visibleStopCount = useMemo(
    () =>
      stops.filter((stop, index) =>
        shouldRenderStopInPlaybackWindow(index, stop.id, selection, renderWindow)
      ).length,
    [renderWindow, selection, stops]
  );

  useEffect(() => {
    setSuspended(false);
    onAutoFollowSuspendedChange?.(false);
  }, [forceRecenterToken, onAutoFollowSuspendedChange]);

  useEffect(() => {
    onCameraStateChange?.({
      mode: intent.mode,
      targetPointOfView: intent.target,
      currentPointOfView: intent.target,
      autoFollowSuspended: suspended,
    });
  }, [
    isTouchDevice,
    onCameraStateChange,
    intent,
    suspended,
  ]);

  useEffect(() => {
    onRenderStateChange?.({
      visibleLabelCount: 0,
      visiblePathCount,
      visibleStopCount,
      playbackStatus: playback.status,
      activeLegIndex: playback.activeLegIndex,
    });
  }, [
    onRenderStateChange,
    playback.activeLegIndex,
    playback.status,
    visiblePathCount,
    visibleStopCount,
  ]);

  return (
    <div className={styles.canvas} data-testid="globe-canvas">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          alignContent: "center",
          justifyItems: "center",
          gap: 12,
          color: "rgba(237, 244, 255, 0.72)",
          background:
            "radial-gradient(circle at center, rgba(108, 228, 255, 0.12), rgba(2, 8, 20, 0) 40%)",
        }}
      >
        <p data-testid="test-globe-summary">
          {stops.length} stops · {legs.length} legs · {playback.status} ·{" "}
          {Math.round(playback.tripProgress * 100)}%
        </p>
        <p data-testid="test-globe-selection">
          {selection ? JSON.stringify(selection) : "no-selection"}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {stops.slice(0, 3).map((stop) => (
            <button key={stop.id} type="button" onClick={() => onSelectStop(stop.id)}>
              {stop.label}
            </button>
          ))}
          {legs.slice(0, 2).map((leg) => (
            <button key={leg.id} type="button" onClick={() => onSelectLeg(leg.id)}>
              {leg.id}
            </button>
          ))}
          <button type="button" onClick={onClearSelection}>
            Clear selection
          </button>
          <button
            type="button"
            onClick={() => {
              setSuspended(true);
              onAutoFollowSuspendedChange?.(true);
            }}
          >
            Simulate manual camera
          </button>
        </div>
      </div>
    </div>
  );
}
