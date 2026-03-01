import type { ItineraryStop } from "../../lib/data/types";
import styles from "./ItineraryPanel.module.css";

type StopEditorProps = {
  stop: ItineraryStop | null;
  onUpdate: (stopId: string, patch: Partial<ItineraryStop>) => void;
  onReplaceAnchor: (stopId: string) => void;
};

export function StopEditor({
  stop,
  onUpdate,
  onReplaceAnchor,
}: StopEditorProps) {
  if (!stop) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Stop editor</h3>
        <p className={styles.muted}>{stop.kind === "origin" ? "Origin" : "Stay"}</p>
      </div>
      <div className={styles.editorGrid}>
        <div className={styles.editorFull}>
          <label className={styles.label} htmlFor="stop-label">
            Label
          </label>
          <input
            id="stop-label"
            className={styles.input}
            value={stop.label}
            onChange={(event) =>
              onUpdate(stop.id, { label: event.target.value })
            }
          />
        </div>
        <div>
          <label className={styles.label} htmlFor="stop-arrival">
            Arrival date
          </label>
          <input
            id="stop-arrival"
            className={styles.input}
            type="date"
            value={stop.arrivalDate ?? ""}
            onChange={(event) =>
              onUpdate(stop.id, {
                arrivalDate: event.target.value || null,
              })
            }
          />
        </div>
        <div>
          <label className={styles.label} htmlFor="stop-departure">
            Departure date
          </label>
          <input
            id="stop-departure"
            className={styles.input}
            type="date"
            value={stop.departureDate ?? ""}
            onChange={(event) =>
              onUpdate(stop.id, {
                departureDate: event.target.value || null,
              })
            }
          />
        </div>
        <div>
          <span className={styles.label}>Anchor</span>
          <div className={styles.summaryCard}>
            {stop.anchorAirportId ?? "Unresolved"}
          </div>
        </div>
        <div>
          <span className={styles.label}>Day count</span>
          <div className={styles.summaryCard}>
            {stop.dayCount === null ? "Origin" : stop.dayCount}
          </div>
        </div>
        <div className={styles.editorFull}>
          <label className={styles.label} htmlFor="stop-notes">
            Notes
          </label>
          <textarea
            id="stop-notes"
            className={styles.textarea}
            value={stop.notes}
            onChange={(event) =>
              onUpdate(stop.id, { notes: event.target.value })
            }
          />
        </div>
      </div>
      {stop.unresolved ? (
        <p className={styles.warning}>
          This stop is unresolved. Use search to replace its anchor airport.
        </p>
      ) : null}
      <div className={styles.playbackActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onReplaceAnchor(stop.id)}
        >
          Replace anchor with search
        </button>
      </div>
    </section>
  );
}
