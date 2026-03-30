import { useMemo } from 'react';

const MENU_ITEMS = [
  { id: 'settings', name: 'Settings', icon: '⚙️' },
  { id: 'quality', name: 'Quality', icon: '📊' },
  { id: 'size', name: 'Size', icon: '📐' },
  { id: 'queue', name: 'Queue', icon: '📋' },
  { id: 'privacy', name: 'Privacy', icon: '🔒' },
  { id: 'preserve', name: 'Preserve', icon: '💾' },
  { id: 'theme', name: 'Theme', icon: '🌙' },
  { id: 'progress', name: 'Progress', icon: '📈' },
  { id: 'advanced', name: 'Advanced', icon: '⚡' },
  { id: 'pwa', name: 'PWA', icon: '📱' },
];

export function MenuBar({ isExpanded, activePanel, onToggleExpanded, onSelectPanel }) {
  const activeItem = useMemo(
    () => MENU_ITEMS.find((item) => item.id === activePanel) ?? null,
    [activePanel],
  );

  return (
    <header className={`menu-bar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="menu-bar__inner">
        <button
          type="button"
          className="menu-toggle"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-controls="top-menu-items"
          aria-label={isExpanded ? 'Collapse top menu' : 'Expand top menu'}
        >
          <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
          <span className="menu-toggle__label">Menu</span>
        </button>

        <div className="menu-bar__status" aria-live="polite">
          {activeItem ? `${activeItem.icon} ${activeItem.name}` : 'Panels ready'}
        </div>

        <nav
          id="top-menu-items"
          className={`menu-items ${isExpanded ? 'visible' : 'hidden'}`}
          aria-label="Feature panels"
        >
          {MENU_ITEMS.map((item) => {
            const isActive = activePanel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPanel(item.id)}
                className={`menu-item ${isActive ? 'active' : ''}`}
                aria-pressed={isActive}
                title={item.name}
              >
                <span className="menu-item__icon" aria-hidden="true">{item.icon}</span>
                <span className="menu-item__label">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export { MENU_ITEMS };
