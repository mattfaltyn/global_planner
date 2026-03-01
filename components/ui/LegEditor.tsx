import { formatDistance } from "../../lib/data/formatters";
import type { ItineraryLeg, ItineraryStop, TravelMode } from "../../lib/data/types";
import styles from "./ItineraryPanel.module.css";

type LegEditorProps = {
  leg: ItineraryLeg | null;
  stops: ItineraryStop[];
  onModeChange: (legId: string, mode: TravelMode) => void;
  onPlayLeg: (legId: string) => void;
};

function getStopLabel(stops: ItineraryStop[], stopId: string) {
  return stops.find((stop) => stop.id === stopId)?.label ?? stopId;
}

export function LegEditor({
  leg,
  stops,
  onModeChange,
  onPlayLeg,
}: LegEditorProps) {
  if (!leg) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Leg editor</h3>
        <p className={styles.muted}>
          {getStopLabel(stops, leg.fromStopId)} to {getStopLabel(stops, leg.toStopId)}
        </p>
      </div>
      <div className={styles.legCard}>
        <div className={styles.legMeta}>
          <span>Mode</span>
          <span>{leg.distanceKm === null ? "Unknown distance" : formatDistance(leg.distanceKm)}</span>
        </div>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={leg.mode === "air" ? styles.activeModeButton : styles.modeButton}
            onClick={() => onModeChange(leg.id, "air")}
          >
            Air
          </button>
          <button
            type="button"
            className={leg.mode === "ground" ? styles.activeModeButton : styles.modeButton}
            onClick={() => onModeChange(leg.id, "ground")}
          >
            Ground
          </button>
        </div>
        <div className={styles.playbackActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onPlayLeg(leg.id)}
          >
            Play this leg
          </button>
        </div>
      </div>
    </section>
  );
}
