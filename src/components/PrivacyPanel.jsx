import { useEffect, useState } from 'react';

export function PrivacyPanel({ settings, onChange }) {
  const [autoClearOnExit, setAutoClearOnExit] = useState(Boolean(settings.autoClearOnExit));
  const [stripMetadata, setStripMetadata] = useState(Boolean(settings.stripMetadata));

  useEffect(() => {
    setAutoClearOnExit(Boolean(settings.autoClearOnExit));
  }, [settings.autoClearOnExit]);

  useEffect(() => {
    setStripMetadata(Boolean(settings.stripMetadata));
  }, [settings.stripMetadata]);

  const handleAutoClearToggle = (event) => {
    const checked = event.target.checked;
    setAutoClearOnExit(checked);
    onChange('autoClearOnExit', checked);
  };

  const handleStripMetadataToggle = (event) => {
    const checked = event.target.checked;
    setStripMetadata(checked);
    onChange('stripMetadata', checked);
  };

  return (
    <div className="settings-panel__content">
      <h3>Privacy</h3>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="privacy-auto-clear">
          <input
            id="privacy-auto-clear"
            type="checkbox"
            checked={autoClearOnExit}
            onChange={handleAutoClearToggle}
          />
          <span>Auto-clear on exit</span>
        </label>
        <p className="setting-helper">Delete all data when closing tab</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="privacy-strip-metadata">
          <input
            id="privacy-strip-metadata"
            type="checkbox"
            checked={stripMetadata}
            onChange={handleStripMetadataToggle}
          />
          <span>Strip metadata (EXIF/IPTC)</span>
        </label>
        <p className="setting-helper">Remove EXIF data, camera info, location data from images</p>
      </div>
    </div>
  );
}
