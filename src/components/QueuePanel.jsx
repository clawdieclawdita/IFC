export default function QueuePanel({ paused, converting, queueSummary, onPause, onResume }) {
  const { converted = 0, total = 0, pending = 0, processing = 0 } = queueSummary || {};

  return (
    <div className="queue-panel" role="status" aria-live="polite">
      <div className="queue-panel__summary">
        <div>
          <p className="queue-panel__eyebrow">Queue</p>
          <strong>{converted} of {total} converted</strong>
        </div>
        <div className="queue-panel__stats">
          <span>{pending} pending</span>
          <span>{processing} processing</span>
          <span className={`queue-panel__state ${paused ? 'queue-panel__state--paused' : converting ? 'queue-panel__state--active' : ''}`}>
            {paused ? 'Paused' : converting ? 'Running' : 'Ready'}
          </span>
        </div>
      </div>

      <div className="queue-panel__actions">
        <button
          type="button"
          className="secondary-button secondary-button--small"
          onClick={onPause}
          disabled={!converting}
        >
          Pause
        </button>
        {paused ? (
          <button
            type="button"
            className="secondary-button secondary-button--small"
            onClick={onResume}
          >
            Resume
          </button>
        ) : null}
      </div>
    </div>
  );
}
