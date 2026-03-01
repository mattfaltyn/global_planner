import styles from "./LoadingOverlay.module.css";

export function LoadingOverlay() {
  return (
    <div className={styles.overlay} data-testid="loading-overlay">
      <div className={styles.card}>
        <p className={styles.kicker}>Loading dataset</p>
        <h2>Preparing the itinerary globe</h2>
        <p>
          Airports, borders, and itinerary anchors are being loaded into the browser.
        </p>
      </div>
    </div>
  );
}
