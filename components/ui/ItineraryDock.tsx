import type {
  DockMode,
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackState,
  ShellLayoutMode,
  SheetSnapPoint,
  TravelMode,
} from "../../lib/data/types";
import {
  getActiveLegLabel,
  getSelectedLeg,
  getSelectedStop,
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
  layoutMode: ShellLayoutMode;
  shellState: {
    mode: DockMode;
    collapsed: boolean;
    snapPoint?: SheetSnapPoint;
  };
  showRecenter?: boolean;
  onSetMode: (mode: DockMode) => void;
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
  layoutMode,
  shellState,
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
  const selectedStop = getSelectedStop(selection, stops);
  const selectedLeg = getSelectedLeg(selection, legs);
  const activeLabel = getActiveLegLabel(stops, legs, playback);
  const isMobile = layoutMode === "mobile";
  const isCollapsed = isMobile
    ? (shellState.snapPoint ?? "collapsed") === "collapsed"
    : shellState.collapsed;
  const rootClassName = [
    styles.dock,
    isMobile ? styles.mobileDock : styles.desktopDock,
    shellState.mode === "edit" ? styles.editDock : styles.playbackDock,
    isCollapsed ? styles.collapsed : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isCollapsed) {
    return (
      <aside
        className={rootClassName}
        data-layout-mode={layoutMode}
        data-snap-point={shellState.snapPoint ?? "collapsed"}
        data-testid="itinerary-dock"
      >
        {isMobile ? <div className={styles.sheetHandle} /> : null}
        <div className={styles.collapsedSummary}>
          <p className={styles.kicker}>Trip</p>
          <h2 className={styles.titleCompact}>{activeLabel}</h2>
          <button type="button" className={styles.toggleButton} onClick={onToggleCollapsed}>
            Expand
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={rootClassName}
      data-layout-mode={layoutMode}
      data-snap-point={shellState.snapPoint ?? "full"}
      data-testid="itinerary-dock"
    >
      {isMobile ? <div className={styles.sheetHandle} /> : null}

      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Itinerary</p>
          <h2 className={styles.title}>Travel itinerary</h2>
        </div>
        <button type="button" className={styles.toggleButton} onClick={onToggleCollapsed}>
          {isMobile ? "Close" : "Collapse"}
        </button>
      </div>

      <div className={styles.tabRow}>
        <button
          type="button"
          className={shellState.mode === "playback" ? styles.activeTab : styles.tab}
          onClick={() => onSetMode("playback")}
        >
          Playback
        </button>
        <button
          type="button"
          className={shellState.mode === "edit" ? styles.activeTab : styles.tab}
          onClick={() => onSetMode("edit")}
        >
          Edit
        </button>
      </div>

      {shellState.mode === "playback" ? (
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

          {dateSpan ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Trip span</h3>
              <p className={styles.primaryCopy}>{formatDateSpan(dateSpan.start, dateSpan.end)}</p>
            </div>
          ) : null}

          {selection ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Selection</h3>
              <p className={styles.primaryCopy}>
                {selectedStop
                  ? `${selectedStop.label}, ${selectedStop.country}`
                  : selectedLeg
                    ? activeLabel
                    : "Selection unavailable"}
              </p>
            </div>
          ) : null}

          {showRecenter ? (
            <div className={styles.section}>
              <button type="button" className={styles.toggleButton} onClick={onRecenter}>
                Recenter
              </button>
            </div>
          ) : null}
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
