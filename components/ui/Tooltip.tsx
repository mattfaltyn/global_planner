import styles from "./Tooltip.module.css";

type TooltipProps = {
  x: number;
  y: number;
  title: string;
  lines: string[];
};

export function Tooltip({ x, y, title, lines }: TooltipProps) {
  return (
    <div
      className={styles.tooltip}
      style={{ left: x, top: y }}
      role="status"
      aria-live="polite"
    >
      <strong>{title}</strong>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}
