import { MENU_ITEMS } from './MenuBar';

export function SettingsPanel({ activePanel, onClose }) {
  const activeItem = MENU_ITEMS.find((item) => item.id === activePanel);

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
          <p className="settings-panel__eyebrow">Phase 1 foundation</p>
          <h2 id="settings-panel-title">
            {activeItem ? `${activeItem.icon} ${activeItem.name}` : 'Feature panel'}
          </h2>
          <p>
            {activeItem
              ? `${activeItem.name} is wired into the menu system and ready for detailed controls in Phase 2.`
              : 'Feature coming in Phase 2...'}
          </p>
        </div>
      </section>
    </div>
  );
}
