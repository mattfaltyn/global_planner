import styles from "./GlobeCanvas.module.css";

type TestGlobeCanvasProps = {
  onClearSelection: () => void;
};

export function TestGlobeCanvas({ onClearSelection }: TestGlobeCanvasProps) {
  return (
    <div className={styles.canvas} data-testid="globe-canvas">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "rgba(237, 244, 255, 0.72)",
          background:
            "radial-gradient(circle at center, rgba(108, 228, 255, 0.12), rgba(2, 8, 20, 0) 40%)",
        }}
      >
        <button
          type="button"
          onClick={onClearSelection}
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "10px 14px",
            background: "rgba(8, 15, 28, 0.7)",
            color: "inherit",
          }}
        >
          E2E globe fallback
        </button>
      </div>
    </div>
  );
}
