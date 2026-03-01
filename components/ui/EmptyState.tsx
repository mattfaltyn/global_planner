import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <aside className={styles.empty}>
      <p className={styles.kicker}>Itinerary</p>
      <h2>Build a route and press play.</h2>
      <p>
        Add a stop from search, choose air or ground per leg, and animate the
        trip across the globe.
      </p>
    </aside>
  );
}
