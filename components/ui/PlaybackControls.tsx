import type { PlaybackSpeed, PlaybackState } from "../../lib/data/types";
import { getPlaybackProgressPercent } from "../../lib/state/selectors";
import styles from "./ItineraryPanel.module.css";

type PlaybackControlsProps = {
  playback: PlaybackState;
  legCount: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onProgressChange: (progress: number) => void;
};

export function PlaybackControls({
  playback,
  legCount,
  onPlay,
  onPause,
  onReset,
  onStepPrev,
  onStepNext,
  onSpeedChange,
  onProgressChange,
}: PlaybackControlsProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>Playback</h3>
        <p className={styles.muted}>
          Leg {Math.min(playback.activeLegIndex + 1, Math.max(legCount, 1))} of{" "}
          {Math.max(legCount, 1)}
        </p>
      </div>
      <div className={styles.playbackRow}>
        <div className={styles.playbackActions}>
          <button
            type="button"
            className={styles.button}
            onClick={playback.status === "playing" ? onPause : onPlay}
          >
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
        </div>
        <select
          aria-label="Playback speed"
          className={styles.speedSelect}
          value={playback.speed}
          onChange={(event) => onSpeedChange(Number(event.target.value) as PlaybackSpeed)}
        >
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
        </select>
      </div>
      <label className={styles.label} htmlFor="playback-progress">
        Progress: {getPlaybackProgressPercent(playback)}%
      </label>
      <input
        id="playback-progress"
        className={styles.slider}
        type="range"
        min="0"
        max="100"
        value={getPlaybackProgressPercent(playback)}
        onChange={(event) => onProgressChange(Number(event.target.value) / 100)}
      />
    </section>
  );
}
