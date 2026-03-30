import { FilenamePanel } from './FilenamePanel';
import { MENU_ITEMS } from './MenuBar';
import { PrivacyPanel } from './PrivacyPanel';
import { QualityPanel } from './QualityPanel';
import { SizePanel } from './SizePanel';

const PANEL_COPY = {
  settings: 'Global app settings will land here in a future phase.',
  queue: 'Queue controls are reserved for upcoming batching features.',
  filename: 'Filename controls are reserved for a future phase.',
  theme: 'Theme customization is planned for a future phase.',
  progress: 'Detailed progress controls are planned for a future phase.',
  advanced: 'Advanced conversion controls are planned for a future phase.',
  pwa: 'Install and offline options are planned for a future phase.',
};

export function SettingsPanel({ activePanel, onClose, settings, onChange }) {
  const activeItem = MENU_ITEMS.find((item) => item.id === activePanel);

  const renderContent = () => {
    if (activePanel === 'quality') {
      return <QualityPanel settings={settings} onChange={onChange} />;
    }

    if (activePanel === 'size') {
      return <SizePanel settings={settings} onChange={onChange} />;
    }

    if (activePanel === 'privacy') {
      return <PrivacyPanel settings={settings} onChange={onChange} />;
    }

    if (activePanel === 'filename') {
      return <FilenamePanel settings={settings} onChange={onChange} />;
    }

    return (
      <div className="settings-panel__content">
        <h3>{activeItem?.name || 'Feature panel'}</h3>
        <p className="settings-panel__description">
          {PANEL_COPY[activePanel] || 'Feature coming in a future phase.'}
        </p>
      </div>
    );
  };

  return (
    <div className={`settings-panel ${activePanel ? 'visible' : 'hidden'}`} role="presentation">
      <div className="settings-panel__backdrop" onClick={onClose} aria-hidden={!activePanel} />

      <section
        className="settings-panel__dialog"
        role="dialog"
        aria-modal="false"
        aria-labelledby="settings-panel-title"
      >
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>

        <div className="panel-content">
          <p className="settings-panel__eyebrow">Phase 5 controls</p>
          <h2 id="settings-panel-title">
            {activeItem ? `${activeItem.icon} ${activeItem.name}` : 'Feature panel'}
          </h2>
          {renderContent()}
        </div>
      </section>
    </div>
  );
}
