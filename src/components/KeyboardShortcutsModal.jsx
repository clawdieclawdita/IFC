const SHORTCUT_GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['?', 'Ctrl/Cmd + K'], description: 'Open keyboard shortcuts' },
      { keys: ['Ctrl/Cmd + L'], description: 'Open Gamification Lab' },
      { keys: ['Esc'], description: 'Close open modal or panel' },
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      { keys: ['1'], description: 'Toggle Upload / Settings panel' },
      { keys: ['2'], description: 'Toggle Format / Quality panel' },
      { keys: ['3'], description: 'Toggle Size / Gamification Lab panel' },
      { keys: ['4'], description: 'Toggle Quality / Queue panel' },
      { keys: ['5'], description: 'Toggle Queue / Privacy panel' },
      { keys: ['6'], description: 'Toggle Privacy / Filename panel' },
      { keys: ['7'], description: 'Toggle Filename / Progress panel' },
      { keys: ['8'], description: 'Toggle Progress / Advanced panel' },
      { keys: ['9'], description: 'Toggle Progress panel' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="keyboard-shortcuts-modal" role="presentation">
      <div className="keyboard-shortcuts-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="keyboard-shortcuts-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close keyboard shortcuts">
          ✕
        </button>

        <div className="panel-content keyboard-shortcuts-modal__content">
          <p className="settings-panel__eyebrow">Keyboard shortcuts</p>
          <h2 id="keyboard-shortcuts-title">Keyboard shortcuts</h2>
          <p className="settings-panel__description">
            Quick access for panels and accessibility controls.
          </p>

          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="shortcut-group">
              <h3>{group.title}</h3>
              <div className="shortcut-list" role="list">
                {group.shortcuts.map((shortcut) => (
                  <div key={`${group.title}-${shortcut.description}`} className="shortcut-row" role="listitem">
                    <div className="shortcut-keys" aria-label={shortcut.keys.join(' or ')}>
                      {shortcut.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </div>
                    <span>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
