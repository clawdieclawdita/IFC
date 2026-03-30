const SIZE_PRESETS = [800, 1200, 1920];

const clampDimension = (value, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const safeMax = Math.max(1, Number(max) || 4000);
  return Math.max(1, Math.min(safeMax, Math.round(numeric)));
};

export function SizePanel({ settings, onChange }) {
  const {
    width,
    height,
    originalWidth,
    originalHeight,
    maxAllowedWidth,
    maxAllowedHeight,
    keepAspectRatio = true,
    estimatedSizeLabel = '—',
  } = settings;

  const hasOriginalDimensions = Boolean(maxAllowedWidth && maxAllowedHeight);
  const safeMaxWidth = maxAllowedWidth || originalWidth || 4000;
  const safeMaxHeight = maxAllowedHeight || originalHeight || 4000;
  const widthValue = width ?? safeMaxWidth;
  const heightValue = height ?? safeMaxHeight;
  const minSliderWidth = Math.min(200, safeMaxWidth);
  const minSliderHeight = Math.min(200, safeMaxHeight);
  const widthWasCapped = width != null && width >= safeMaxWidth;
  const heightWasCapped = height != null && height >= safeMaxHeight;
  const showUpscaleWarning = hasOriginalDimensions
    && (widthWasCapped || heightWasCapped || safeMaxWidth < 4000 || safeMaxHeight < 4000);

  const handleWidthChange = (nextWidth) => {
    const safeWidth = clampDimension(nextWidth, safeMaxWidth, safeMaxWidth);
    onChange('width', safeWidth);
  };

  const handleHeightChange = (nextHeight) => {
    const safeHeight = clampDimension(nextHeight, safeMaxHeight, safeMaxHeight);
    onChange('height', safeHeight);
  };

  const handlePreset = (presetWidth) => {
    if (presetWidth == null) {
      onChange('width', null);
      onChange('height', null);
      return;
    }

    const safeWidth = clampDimension(presetWidth, safeMaxWidth, safeMaxWidth);
    onChange('width', safeWidth);
  };

  const widthLabel = width == null ? `Original (${safeMaxWidth}px)` : `${widthValue}px`;
  const heightLabel = height == null ? `Original (${safeMaxHeight}px)` : `${heightValue}px`;

  return (
    <div className="settings-panel__content">
      <h3>Size</h3>
      <p className="settings-panel__description">
        Resize applies to every output format. Limits are based on the smallest uploaded image so nothing gets upscaled.
      </p>

      {hasOriginalDimensions ? (
        <div className="size-limit-info" role="status" aria-live="polite">
          Max allowed: {safeMaxWidth} × {safeMaxHeight}px (smallest original image)
        </div>
      ) : null}

      {showUpscaleWarning ? (
        <p className="size-warning" role="alert">
          Cannot select higher resolution than original.
        </p>
      ) : null}

      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="width-slider">Width</label>
          <span className="slider-value">{widthLabel}</span>
        </div>
        <input
          id="width-slider"
          type="range"
          min={String(minSliderWidth)}
          max={String(safeMaxWidth)}
          value={widthValue}
          onChange={(event) => handleWidthChange(event.target.value)}
          disabled={!hasOriginalDimensions}
        />
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <label htmlFor="height-slider">Height</label>
          <span className="slider-value">{heightLabel}</span>
        </div>
        <input
          id="height-slider"
          type="range"
          min={String(minSliderHeight)}
          max={String(safeMaxHeight)}
          value={heightValue}
          onChange={(event) => handleHeightChange(event.target.value)}
          disabled={!hasOriginalDimensions}
        />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={keepAspectRatio}
          onChange={(event) => onChange('keepAspectRatio', event.target.checked)}
        />
        <span>Keep aspect ratio</span>
      </label>

      <div className="presets" role="group" aria-label="Size presets">
        {SIZE_PRESETS.map((preset) => {
          const disabled = !hasOriginalDimensions || preset > safeMaxWidth;
          return (
            <button
              key={preset}
              type="button"
              className={`preset-button ${width === preset ? 'preset-button--active' : ''}`}
              onClick={() => handlePreset(preset)}
              disabled={disabled}
              title={disabled ? `Unavailable: exceeds ${safeMaxWidth}px original width limit` : `${preset}px width preset`}
            >
              {preset}px
            </button>
          );
        })}
        <button
          type="button"
          className={`preset-button ${width == null && height == null ? 'preset-button--active' : ''}`}
          onClick={() => handlePreset(null)}
          disabled={!hasOriginalDimensions}
        >
          Original
        </button>
      </div>

      <div className="preview-block">
        <p className="preview-label">Estimated output size</p>
        <strong className="preview-value">~{estimatedSizeLabel}</strong>
        <p className="preview-hint">
          Preview uses capped dimensions, so exported images never exceed the original resolution.
        </p>
      </div>
    </div>
  );
}
