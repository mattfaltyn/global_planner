import type { ItineraryLeg, ItineraryStop, PlaybackSpeed, PlaybackState } from "../../lib/data/types";
import {
  getActiveLegLabel,
  getCurrentStopPair,
  getTripProgressPercent,
} from "../../lib/state/selectors";
import styles from "./TripPlaybackBar.module.css";

type TripPlaybackBarProps = {
  stops: ItineraryStop[];
  legs: ItineraryLeg[];
  playback: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onProgressChange: (progress: number) => void;
  onOpenEdit: () => void;
};

export function TripPlaybackBar({
  stops,
  legs,
  playback,
  onPlay,
  onPause,
  onReset,
  onStepPrev,
  onStepNext,
  onSpeedChange,
  onProgressChange,
  onOpenEdit,
}: TripPlaybackBarProps) {
  const { currentStop, nextStop } = getCurrentStopPair(stops, playback, legs);

  return (
    <section className={styles.bar} data-testid="trip-playback-bar">
      <div className={styles.meta}>
        <p className={styles.kicker}>Trip playback</p>
        <h2 className={styles.routeLabel}>{getActiveLegLabel(stops, legs, playback)}</h2>
        <p className={styles.stopLabel}>
          {currentStop?.label ?? "Start"} {"->"} {nextStop?.label ?? "Finish"}
          <span className={styles.phase}>
            {playback.phase === "dwell" ? " · Arrived" : " · En route"}
          </span>
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={playback.status === "playing" ? onPause : onPlay}>
            {playback.status === "playing" ? "Pause" : "Play"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onReset}>
            Reset
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onStepPrev}>
            Previous
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onStepNext}>
            Next
          </button>
          <select
            aria-label="Playback speed"
            className={styles.speedSelect}
            value={playback.speed}
            onChange={(event) =>
              onSpeedChange(Number(event.target.value) as PlaybackSpeed)
            }
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>
          <button type="button" className={styles.secondaryButton} onClick={onOpenEdit}>
            Edit trip
          </button>
        </div>

        <div className={styles.sliderWrap}>
          <label className={styles.sliderLabel} htmlFor="trip-progress">
            Trip progress: {getTripProgressPercent(playback)}%
          </label>
          <input
            id="trip-progress"
            className={styles.slider}
            type="range"
            min="0"
            max="100"
            value={getTripProgressPercent(playback)}
            onChange={(event) => onProgressChange(Number(event.target.value) / 100)}
          />
        </div>
      </div>
    </section>
  );
}
