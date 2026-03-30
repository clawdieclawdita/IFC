const QUALITY_PRESETS = [75, 85, 95, 100];

export function QualityPanel({ settings, onChange }) {
  const quality = settings.quality ?? 85;
  const estimatedSizeLabel = settings.estimatedSizeLabel || '—';
  const qualityActive = settings.qualityAppliesToTarget !== false;

  return (
    <div className="settings-panel__content">
      <h3>Quality</h3>
      <p className="settings-panel__description">
        Compression is applied to JPG and WEBP outputs. Other formats use their default encoder settings.
      </p>

      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="quality-slider">Compression</label>
          <span className="slider-value">{quality}%</span>
        </div>
        <input
          id="quality-slider"
          type="range"
          min="0"
          max="100"
          value={quality}
          onChange={(event) => onChange('quality', Number(event.target.value))}
        />
      </div>

      <div className="presets" role="group" aria-label="Quality presets">
        {QUALITY_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`preset-button ${quality === preset ? 'preset-button--active' : ''}`}
            onClick={() => onChange('quality', preset)}
          >
            {preset === 100 ? 'Best Quality' : `${preset}%`}
          </button>
        ))}
      </div>

      <div className="preview-block">
        <p className="preview-label">Estimated output size</p>
        <strong className="preview-value">~{estimatedSizeLabel}</strong>
        <p className="preview-hint">
          {qualityActive
            ? 'Preview uses the current quality setting, output format, and source size.'
            : 'Target format ignores quality controls, so the estimate uses the format default.'}
        </p>
      </div>
    </div>
  );
}
