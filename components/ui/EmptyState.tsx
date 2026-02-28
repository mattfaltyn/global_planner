import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <aside className={styles.empty}>
      <p className={styles.kicker}>Ready</p>
      <h2>Pick a connection to inspect the network.</h2>
      <p>
        Search for a hub, click a route, or rotate the globe to explore how major
        airports connect.
      </p>
    </aside>
  );
}
