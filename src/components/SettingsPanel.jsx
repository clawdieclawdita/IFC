import { FilenamePanel } from './FilenamePanel';
import { MENU_ITEMS } from './MenuBar';
import { PrivacyPanel } from './PrivacyPanel';
import { QualityPanel } from './QualityPanel';
import { SizePanel } from './SizePanel';

const PANEL_COPY = {
  queue: 'Queue controls are reserved for upcoming batching features.',
  theme: 'Theme customization is available in the main Settings panel.',
  progress: 'Detailed progress controls are planned for a future phase.',
  advanced: 'Advanced conversion controls are planned for a future phase.',
  pwa: 'Install and offline options are planned for a future phase.',
};

function AppearancePanel({ settings, onChange, onOpenKeyboardShortcuts }) {
  const reducedMotionValue = settings.reducedMotion === null ? 'auto' : String(settings.reducedMotion);

  return (
    <div className="settings-panel__content">
      <h3>Settings</h3>
      <p className="settings-panel__description">
        Personalize the interface accessibility behavior.
      </p>

      <div className="setting-item">
        <label className="select-label" htmlFor="appearance-reduced-motion">
          <span>Reduced motion</span>
          <select
            id="appearance-reduced-motion"
            value={reducedMotionValue}
            onChange={(event) => onChange('reducedMotion', event.target.value === 'auto' ? 'auto' : event.target.value === 'true')}
          >
            <option value="auto">Auto ({settings.resolvedReducedMotion ? 'System reduce' : 'System full motion'})</option>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        </label>
        <p className="setting-helper">Disable transitions and animations for a calmer experience.</p>
      </div>

      <div className="setting-item">
        <button type="button" className="secondary-button secondary-button--small" onClick={onOpenKeyboardShortcuts}>
          View keyboard shortcuts
        </button>
        <p className="setting-helper setting-helper--inline">Press <code>?</code> or <code>Ctrl/Cmd + K</code> anytime.</p>
      </div>
    </div>
  );
}

export function SettingsPanel({ activePanel, onClose, settings, onChange, onOpenKeyboardShortcuts }) {
  const activeItem = MENU_ITEMS.find((item) => item.id === activePanel);

  const renderContent = () => {
    if (activePanel === 'settings') {
      return <AppearancePanel settings={settings} onChange={onChange} onOpenKeyboardShortcuts={onOpenKeyboardShortcuts} />;
    }

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
          <p className="settings-panel__eyebrow">Phase 6 controls</p>
          <h2 id="settings-panel-title">
            {activeItem ? `${activeItem.icon} ${activeItem.name}` : 'Feature panel'}
          </h2>
          {renderContent()}
        </div>
      </section>
    </div>
  );
}
