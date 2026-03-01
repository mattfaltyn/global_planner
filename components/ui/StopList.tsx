import type { ItinerarySelection, ItineraryStop } from "../../lib/data/types";
import styles from "./ItineraryPanel.module.css";

type StopListProps = {
  stops: ItineraryStop[];
  selection: ItinerarySelection;
  onSelect: (stopId: string) => void;
  onMoveUp: (stopId: string) => void;
  onMoveDown: (stopId: string) => void;
  onRemove: (stopId: string) => void;
  onInsertAfter: (index: number, stopId: string) => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function StopList({
  stops,
  selection,
  onSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  onInsertAfter,
}: StopListProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Stops</h3>
        <p className={styles.muted}>{stops.length} total</p>
      </div>
      <ol className={styles.stopList}>
        {stops.map((stop, index) => (
          <li
            key={stop.id}
            className={
              selection?.kind === "stop" && selection.stopId === stop.id
                ? styles.activeStopItem
                : styles.stopItem
            }
          >
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => onSelect(stop.id)}
            >
              {index + 1}. {stop.label}
            </button>
            <div className={styles.stopMeta}>
              <span>
                {stop.city}, {stop.country}
              </span>
              <span>{formatDate(stop.arrivalDate)}</span>
              <span>{formatDate(stop.departureDate)}</span>
              <span>{stop.dayCount === null ? "Origin" : `${stop.dayCount} days`}</span>
            </div>
            <div className={styles.stopActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onMoveUp(stop.id)}
              >
                Up
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onMoveDown(stop.id)}
              >
                Down
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onRemove(stop.id)}
              >
                Remove
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => onInsertAfter(index, stop.id)}
              >
                Insert after
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
