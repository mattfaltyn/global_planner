import styles from "./ErrorState.module.css";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <main className={styles.errorState}>
      <div className={styles.card}>
        <p className={styles.kicker}>Load error</p>
        <h1>Global Planner could not start.</h1>
        <p>{message}</p>
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Retry
        </button>
      </div>
    </main>
  );
}
