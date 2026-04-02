export function AiPanel({ settings, onChange, previewState, onGeneratePreview, queueSummary }) {
  const activePreset = settings.stylePreset || 'vintage';
  const styleIntensity = settings.styleIntensity ?? 60;

  return (
    <div className="settings-panel__content">
      <h3>AI processing</h3>
      <p className="settings-panel__description">
        Local on-device image enhancement powered by Sharp. Preview uses the first queued image.
      </p>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="ai-auto-enhance">
          <input
            id="ai-auto-enhance"
            type="checkbox"
            checked={Boolean(settings.autoEnhance)}
            onChange={(event) => onChange('autoEnhance', event.target.checked)}
          />
          <span>Auto-enhancement</span>
        </label>
        <p className="setting-helper">Smart brightness, contrast, sharpness, and saturation balancing.</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="ai-enhance-quality">
          <input
            id="ai-enhance-quality"
            type="checkbox"
            checked={Boolean(settings.enhanceQuality)}
            onChange={(event) => onChange('enhanceQuality', event.target.checked)}
            disabled={!settings.autoEnhance}
          />
          <span>Quality improvement pass</span>
        </label>
        <p className="setting-helper">Adds a light gamma + denoise pass after auto-enhancement.</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="ai-remove-background">
          <input
            id="ai-remove-background"
            type="checkbox"
            checked={Boolean(settings.removeBackground)}
            onChange={(event) => onChange('removeBackground', event.target.checked)}
          />
          <span>Background removal</span>
        </label>
        <p className="setting-helper">Creates a transparent cutout by estimating the background from edge colors.</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="ai-style-transfer-enabled">
          <input
            id="ai-style-transfer-enabled"
            type="checkbox"
            checked={Boolean(settings.styleTransferEnabled)}
            onChange={(event) => onChange('styleTransferEnabled', event.target.checked)}
          />
          <span>Style transfer</span>
        </label>
        <p className="setting-helper">Apply a visual preset to the whole batch or a single conversion.</p>
      </div>

      <div className="setting-item">
        <label className="select-label" htmlFor="ai-style-preset">
          <span>Style preset</span>
          <select
            id="ai-style-preset"
            value={activePreset}
            disabled={!settings.styleTransferEnabled}
            onChange={(event) => onChange('stylePreset', event.target.value)}
          >
            <option value="vintage">Vintage</option>
            <option value="blackwhite">Black &amp; White</option>
            <option value="cinematic">Cinematic</option>
            <option value="artistic">Artistic</option>
          </select>
        </label>
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="ai-style-intensity">Style intensity</label>
          <span className="slider-value">{styleIntensity}%</span>
        </div>
        <input
          id="ai-style-intensity"
          type="range"
          min="0"
          max="100"
          value={styleIntensity}
          disabled={!settings.styleTransferEnabled}
          onChange={(event) => onChange('styleIntensity', Number(event.target.value))}
        />
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="ai-batch-enabled">
          <input
            id="ai-batch-enabled"
            type="checkbox"
            checked={Boolean(settings.aiBatchEnabled)}
            onChange={(event) => onChange('aiBatchEnabled', event.target.checked)}
          />
          <span>Apply AI to the full batch</span>
        </label>
        <p className="setting-helper">When disabled, AI settings stay available for previews but do not affect queued conversions.</p>
      </div>

      <div className="preview-block">
        <p className="preview-label">AI batch status</p>
        <strong className="preview-value">{queueSummary?.pending ?? 0} queued · {queueSummary?.processing ?? 0} live</strong>
        <p className="preview-hint">Queue controls already support pause/resume while AI-enabled conversions are running.</p>
      </div>

      <div className="presets" role="group" aria-label="AI preview actions">
        <button type="button" className="preset-button" onClick={() => onGeneratePreview('auto-enhance')} disabled={previewState.loading || !queueSummary?.pending || !settings.autoEnhance}>
          Preview auto-enhance
        </button>
        <button type="button" className="preset-button" onClick={() => onGeneratePreview('remove-background')} disabled={previewState.loading || !queueSummary?.pending || !settings.removeBackground}>
          Preview background removal
        </button>
        <button type="button" className="preset-button" onClick={() => onGeneratePreview('style-transfer')} disabled={previewState.loading || !queueSummary?.pending || !settings.styleTransferEnabled}>
          Preview style transfer
        </button>
      </div>

      {previewState.error ? <p className="helper-text helper-text--error">{previewState.error}</p> : null}

      {previewState.image ? (
        <div className="preview-block">
          <p className="preview-label">Preview result</p>
          <img src={previewState.image} alt={`${previewState.mode || 'AI'} preview`} className="ai-preview-image" />
          <p className="preview-hint">{previewState.mode ? `${previewState.mode} preview generated locally` : 'Preview ready'}</p>
        </div>
      ) : null}
    </div>
  );
}
