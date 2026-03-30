export default function ProgressBar({ value, visible }) {
  if (!visible) return null;

  return (
    <div className="progress-block" aria-live="polite">
      <div className="progress-block__meta">
        <span>Conversion progress</span>
        <strong>{value}%</strong>
      </div>
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
