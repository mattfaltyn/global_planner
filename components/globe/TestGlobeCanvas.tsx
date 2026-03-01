import type { ItineraryLeg, ItinerarySelection, ItineraryStop } from "../../lib/data/types";
import styles from "./GlobeCanvas.module.css";

type TestGlobeCanvasProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: {
    status: "idle" | "playing" | "paused";
    speed: 0.5 | 1 | 2 | 4;
    tripProgress: number;
    activeLegIndex: number;
    activeLegProgress: number;
    phase: "travel" | "dwell";
  };
  onSelectStop: (stopId: string) => void;
  onSelectLeg: (legId: string) => void;
  onClearSelection: () => void;
};

export function TestGlobeCanvas({
  stops,
  legs,
  selection,
  playback,
  onSelectStop,
  onSelectLeg,
  onClearSelection,
}: TestGlobeCanvasProps) {
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
        </div>
      </div>
    </div>
  );
}
