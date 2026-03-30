import { useEffect, useMemo, useState } from 'react';

const replacePatternVariables = ({ pattern, name, format, timestamp, date, seq }) => pattern
  .replaceAll('{name}', name)
  .replaceAll('{format}', format)
  .replaceAll('{timestamp}', timestamp)
  .replaceAll('{date}', date)
  .replaceAll('{seq}', seq);

export function FilenamePanel({ settings, onChange }) {
  const [convention, setConvention] = useState(settings.filenameConvention || 'original');
  const [customPattern, setCustomPattern] = useState(settings.customFilenamePattern || '');

  useEffect(() => {
    setConvention(settings.filenameConvention || 'original');
  }, [settings.filenameConvention]);

  useEffect(() => {
    setCustomPattern(settings.customFilenamePattern || '');
  }, [settings.customFilenamePattern]);

  const example = useMemo(() => {
    const name = 'my-photo';
    const originalExtension = 'jpg';
    const format = settings.targetFormat || 'png';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace(/Z$/, '');
    const date = timestamp.split('T')[0];
    const seq = '1';

    if (convention === 'timestamp') {
      return `${name}.${originalExtension} → ${name}_${date}.${format}`;
    }

    if (convention === 'custom' && customPattern.trim()) {
      const generatedName = replacePatternVariables({
        pattern: customPattern.trim(),
        name,
        format,
        timestamp,
        date,
        seq,
      });
      return `${name}.${originalExtension} → ${generatedName}.${format}`;
    }

    return `${name}.${originalExtension} → ${name}.${format}`;
  }, [convention, customPattern, settings.targetFormat]);

  const handleConventionChange = (value) => {
    setConvention(value);
    onChange('filenameConvention', value);

    if (value !== 'custom') {
      onChange('customFilenamePattern', customPattern);
    }
  };

  const handlePatternChange = (event) => {
    const value = event.target.value;
    setCustomPattern(value);
    onChange('customFilenamePattern', value);
  };

  return (
    <div className="settings-panel__content">
      <h3>Filename</h3>
      <p className="settings-panel__description">
        Customize filename format using variables like {'{name}'}, {'{format}'}, {'{timestamp}'}, {'{date}'}, {'{seq}'}.
      </p>

      <div className="convention-options" role="radiogroup" aria-label="Filename convention">
        <label className="radio-option" htmlFor="filename-original">
          <input
            id="filename-original"
            type="radio"
            name="filename-convention"
            checked={convention === 'original'}
            onChange={() => handleConventionChange('original')}
          />
          <span>Original</span>
        </label>

        <label className="radio-option" htmlFor="filename-timestamp">
          <input
            id="filename-timestamp"
            type="radio"
            name="filename-convention"
            checked={convention === 'timestamp'}
            onChange={() => handleConventionChange('timestamp')}
          />
          <span>Timestamp</span>
        </label>

        <label className="radio-option" htmlFor="filename-custom">
          <input
            id="filename-custom"
            type="radio"
            name="filename-convention"
            checked={convention === 'custom'}
            onChange={() => handleConventionChange('custom')}
          />
          <span>Custom</span>
        </label>
      </div>

      {convention === 'custom' ? (
        <div className="custom-pattern-input">
          <label className="custom-pattern-input__label" htmlFor="filename-pattern">
            <span>Pattern</span>
            <input
              id="filename-pattern"
              type="text"
              value={customPattern}
              onChange={handlePatternChange}
              placeholder="{name}_{format}"
            />
          </label>
          <p className="setting-helper setting-helper--inline">
            Available variables: {'{name}'}, {'{format}'}, {'{timestamp}'}, {'{date}'}, {'{seq}'}
          </p>
        </div>
      ) : null}

      <div className="preview-block preview-block--filename">
        <span className="preview-label">Example</span>
        <strong className="preview-value preview-value--filename">{example}</strong>
      </div>
    </div>
  );
}
