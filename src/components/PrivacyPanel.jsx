import { useEffect, useState } from 'react';

export function PrivacyPanel({ settings, onChange }) {
  const [autoClearOnExit, setAutoClearOnExit] = useState(Boolean(settings.autoClearOnExit));
  const [stripMetadata, setStripMetadata] = useState(Boolean(settings.stripMetadata));
  const [preserveMetadata, setPreserveMetadata] = useState(Boolean(settings.preserveMetadata));
  const [preserveFolderStructure, setPreserveFolderStructure] = useState(Boolean(settings.preserveFolderStructure));

  useEffect(() => {
    setAutoClearOnExit(Boolean(settings.autoClearOnExit));
  }, [settings.autoClearOnExit]);

  useEffect(() => {
    setStripMetadata(Boolean(settings.stripMetadata));
  }, [settings.stripMetadata]);

  useEffect(() => {
    setPreserveMetadata(Boolean(settings.preserveMetadata));
  }, [settings.preserveMetadata]);

  useEffect(() => {
    setPreserveFolderStructure(Boolean(settings.preserveFolderStructure));
  }, [settings.preserveFolderStructure]);

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

  const handlePreserveMetadataToggle = (event) => {
    const checked = event.target.checked;
    setPreserveMetadata(checked);
    onChange('preserveMetadata', checked);
  };

  const handlePreserveFolderStructureToggle = (event) => {
    const checked = event.target.checked;
    setPreserveFolderStructure(checked);
    onChange('preserveFolderStructure', checked);
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
        <label className="checkbox-label" htmlFor="privacy-preserve-metadata">
          <input
            id="privacy-preserve-metadata"
            type="checkbox"
            checked={preserveMetadata}
            disabled={stripMetadata}
            onChange={handlePreserveMetadataToggle}
          />
          <span>Keep metadata (EXIF/IPTC/camera/GPS)</span>
        </label>
        <p className="setting-helper">Preserve EXIF data, camera info, location data</p>
        <p className="setting-note">More detailed but larger file sizes</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="privacy-strip-metadata">
          <input
            id="privacy-strip-metadata"
            type="checkbox"
            checked={stripMetadata}
            disabled={preserveMetadata}
            onChange={handleStripMetadataToggle}
          />
          <span>Strip metadata (EXIF/IPTC)</span>
        </label>
        <p className="setting-helper">Remove EXIF data, camera info, location data from images</p>
      </div>

      <div className="setting-item">
        <label className="checkbox-label" htmlFor="privacy-preserve-folders">
          <input
            id="privacy-preserve-folders"
            type="checkbox"
            checked={preserveFolderStructure}
            onChange={handlePreserveFolderStructureToggle}
          />
          <span>Preserve folder structure</span>
        </label>
        <p className="setting-helper">Maintain original folder hierarchy for folder uploads</p>
        <p className="setting-note">When uploading multiple files from folders, recreate same structure</p>
      </div>
    </div>
  );
}
