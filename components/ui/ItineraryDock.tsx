import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackState,
  TravelMode,
} from "../../lib/data/types";
import {
  getActiveLegLabel,
  getTravelModeCounts,
  getTripDateSpan,
} from "../../lib/state/selectors";
import { ItineraryPanel } from "./ItineraryPanel";
import styles from "./ItineraryDock.module.css";

type ItineraryDockProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: PlaybackState;
  mode: "playback" | "edit";
  collapsed: boolean;
  isTouchDevice: boolean;
  showRecenter?: boolean;
  onSetMode: (mode: "playback" | "edit") => void;
  onToggleCollapsed: () => void;
  onRecenter?: () => void;
  onSelectStop: (stopId: string) => void;
  onMoveStopUp: (stopId: string) => void;
  onMoveStopDown: (stopId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onInsertAfter: (index: number, stopId: string) => void;
  onUpdateStop: (stopId: string, patch: Partial<ItineraryStop>) => void;
  onReplaceAnchor: (stopId: string) => void;
  onSetLegMode: (legId: string, mode: TravelMode) => void;
  onPlayLeg: (legId: string) => void;
};

function formatDateSpan(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${start}T00:00:00Z`))} to ${formatter.format(
    new Date(`${end}T00:00:00Z`)
  )}`;
}

export function ItineraryDock({
  stops,
  legs,
  selection,
  playback,
  mode,
  collapsed,
  isTouchDevice,
  showRecenter = false,
  onSetMode,
  onToggleCollapsed,
  onRecenter = () => undefined,
  onSelectStop,
  onMoveStopUp,
  onMoveStopDown,
  onRemoveStop,
  onInsertAfter,
  onUpdateStop,
  onReplaceAnchor,
  onSetLegMode,
  onPlayLeg,
}: ItineraryDockProps) {
  const modeCounts = getTravelModeCounts(legs);
  const dateSpan = getTripDateSpan(stops);

  if (collapsed) {
    return (
      <aside
        className={isTouchDevice ? styles.mobileCollapsedDock : styles.collapsedDock}
        data-testid="itinerary-dock"
      >
        <button
          type="button"
          className={styles.toggleButton}
          onClick={onToggleCollapsed}
        >
          Expand
        </button>
        <div>
          <p className={styles.kicker}>Trip</p>
          <h2 className={styles.title}>{getActiveLegLabel(stops, legs, playback)}</h2>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={isTouchDevice ? styles.mobileDock : styles.dock}
      data-testid="itinerary-dock"
    >
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Itinerary</p>
          <h2 className={styles.title}>Travel itinerary</h2>
        </div>
        <button type="button" className={styles.toggleButton} onClick={onToggleCollapsed}>
          Collapse
        </button>
      </div>

      <div className={styles.tabRow}>
        <button
          type="button"
          className={mode === "playback" ? styles.activeTab : styles.tab}
          onClick={() => onSetMode("playback")}
        >
          Playback
        </button>
        <button
          type="button"
          className={mode === "edit" ? styles.activeTab : styles.tab}
          onClick={() => onSetMode("edit")}
        >
          Edit
        </button>
      </div>

      {mode === "playback" ? (
        <div className={styles.playbackPane}>
          <div className={styles.summaryGrid}>
            <div className={styles.card}>
              <dt>Stops</dt>
              <dd>{stops.length}</dd>
            </div>
            <div className={styles.card}>
              <dt>Legs</dt>
              <dd>{legs.length}</dd>
            </div>
            <div className={styles.card}>
              <dt>Air</dt>
              <dd>{modeCounts.air}</dd>
            </div>
            <div className={styles.card}>
              <dt>Ground</dt>
              <dd>{modeCounts.ground}</dd>
            </div>
          </div>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Current route</h3>
            <p className={styles.primaryCopy}>{getActiveLegLabel(stops, legs, playback)}</p>
            <p className={styles.muted}>
              {dateSpan ? formatDateSpan(dateSpan.start, dateSpan.end) : "Dates unavailable"}
            </p>
            {showRecenter ? (
              <button
                type="button"
                className={styles.toggleButton}
                onClick={onRecenter}
              >
                Recenter
              </button>
            ) : null}
          </div>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Selected</h3>
            <p className={styles.muted}>
              {selection
                ? selection.kind === "stop"
                  ? `Stop ${selection.stopId}`
                  : `Leg ${selection.legId}`
                : "Nothing selected"}
            </p>
          </div>
        </div>
      ) : (
        <ItineraryPanel
          stops={stops}
          legs={legs}
          selection={selection}
          onSelectStop={onSelectStop}
          onMoveStopUp={onMoveStopUp}
          onMoveStopDown={onMoveStopDown}
          onRemoveStop={onRemoveStop}
          onInsertAfter={onInsertAfter}
          onUpdateStop={onUpdateStop}
          onReplaceAnchor={onReplaceAnchor}
          onSetLegMode={onSetLegMode}
          onPlayLeg={onPlayLeg}
        />
      )}
    </aside>
  );
}
