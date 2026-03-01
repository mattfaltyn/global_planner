import type {
  ItineraryLeg,
  ItinerarySelection,
  ItineraryStop,
  TravelMode,
} from "../../lib/data/types";
import { getSelectedLeg, getSelectedStop } from "../../lib/state/selectors";
import { LegEditor } from "./LegEditor";
import { StopEditor } from "./StopEditor";
import { StopList } from "./StopList";
import styles from "./ItineraryPanel.module.css";

type ItineraryPanelProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  selection: ItinerarySelection;
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

export function ItineraryPanel({
  stops,
  legs,
  selection,
  onSelectStop,
  onMoveStopUp,
  onMoveStopDown,
  onRemoveStop,
  onInsertAfter,
  onUpdateStop,
  onReplaceAnchor,
  onSetLegMode,
  onPlayLeg,
}: ItineraryPanelProps) {
  const selectedStop = getSelectedStop(selection, stops);
  const selectedLeg = getSelectedLeg(selection, legs);

  return (
    <div className={styles.panelBody} data-testid="itinerary-panel">
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
            Edit stops, change travel modes, or use the trip controls below to
            play the whole route.
          </p>
        </section>
      ) : null}
    </div>
  );
}
