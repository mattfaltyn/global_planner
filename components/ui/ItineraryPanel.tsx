import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  PlaybackSpeed,
  PlaybackState,
  TravelMode,
} from "../../lib/data/types";
import {
  getLegByIndex,
  getSelectedLeg,
  getSelectedStop,
  getTravelModeCounts,
  getTripDateSpan,
} from "../../lib/state/selectors";
import { LegEditor } from "./LegEditor";
import { PlaybackControls } from "./PlaybackControls";
import { StopEditor } from "./StopEditor";
import { StopList } from "./StopList";
import styles from "./ItineraryPanel.module.css";

type ItineraryPanelProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
  playback: PlaybackState;
  isTouchDevice: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectLeg: (legId: string) => void;
  onMoveStopUp: (stopId: string) => void;
  onMoveStopDown: (stopId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onInsertAfter: (index: number, stopId: string) => void;
  onUpdateStop: (stopId: string, patch: Partial<ItineraryStop>) => void;
  onReplaceAnchor: (stopId: string) => void;
  onSetLegMode: (legId: string, mode: TravelMode) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onProgressChange: (progress: number) => void;
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

export function ItineraryPanel({
  stops,
  legs,
  selection,
  playback,
  isTouchDevice,
  onClose,
  onSelectStop,
  onSelectLeg,
  onMoveStopUp,
  onMoveStopDown,
  onRemoveStop,
  onInsertAfter,
  onUpdateStop,
  onReplaceAnchor,
  onSetLegMode,
  onPlay,
  onPause,
  onReset,
  onStepPrev,
  onStepNext,
  onSpeedChange,
  onProgressChange,
  onPlayLeg,
}: ItineraryPanelProps) {
  const selectedStop = getSelectedStop(selection, stops);
  const selectedLeg = getSelectedLeg(selection, legs);
  const activeLeg = getLegByIndex(legs, playback.activeLegIndex);
  const modeCounts = getTravelModeCounts(legs);
  const dateSpan = getTripDateSpan(stops);

  return (
    <aside
      className={isTouchDevice ? styles.mobilePanel : styles.panel}
      data-testid="itinerary-panel"
    >
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Itinerary</p>
          <h2 className={styles.title}>Travel itinerary</h2>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          Close
        </button>
      </div>

      <PlaybackControls
        playback={playback}
        legCount={legs.length}
        onPlay={onPlay}
        onPause={onPause}
        onReset={onReset}
        onStepPrev={onStepPrev}
        onStepNext={onStepNext}
        onSpeedChange={onSpeedChange}
        onProgressChange={onProgressChange}
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Summary</h3>
          <p className={styles.muted}>
            {dateSpan ? formatDateSpan(dateSpan.start, dateSpan.end) : "Dates unavailable"}
          </p>
        </div>
        <dl className={styles.tripSummary}>
          <div className={styles.summaryCard}>
            <dt>Stops</dt>
            <dd>{stops.length}</dd>
          </div>
          <div className={styles.summaryCard}>
            <dt>Legs</dt>
            <dd>{legs.length}</dd>
          </div>
          <div className={styles.summaryCard}>
            <dt>Air legs</dt>
            <dd>{modeCounts.air}</dd>
          </div>
          <div className={styles.summaryCard}>
            <dt>Ground legs</dt>
            <dd>{modeCounts.ground}</dd>
          </div>
        </dl>
        {activeLeg ? (
          <p className={styles.muted}>
            Active leg: {activeLeg.fromStopId} to {activeLeg.toStopId}
          </p>
        ) : null}
      </section>

      <StopList
        stops={stops}
        selection={selection}
        onSelect={onSelectStop}
        onMoveUp={onMoveStopUp}
        onMoveDown={onMoveStopDown}
        onRemove={onRemoveStop}
        onInsertAfter={onInsertAfter}
      />

      <StopEditor
        stop={selectedStop}
        onUpdate={onUpdateStop}
        onReplaceAnchor={onReplaceAnchor}
      />

      <LegEditor
        leg={selectedLeg}
        stops={stops}
        onModeChange={onSetLegMode}
        onPlayLeg={onPlayLeg}
      />

      {!selectedStop && !selectedLeg ? (
        <section className={styles.section}>
          <p className={styles.kicker}>Ready</p>
          <h3>This is your itinerary.</h3>
          <p className={styles.muted}>
            Add a stop or press play. No global route network is shown unless it
            belongs to the itinerary.
          </p>
        </section>
      ) : null}
    </aside>
  );
}
