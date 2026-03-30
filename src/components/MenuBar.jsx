const MENU_ITEMS = [
  { id: 'settings', name: 'Settings', icon: '⚙️' },
  { id: 'quality', name: 'Quality', icon: '📊' },
  { id: 'size', name: 'Size', icon: '📐' },
  { id: 'queue', name: 'Queue', icon: '📋' },
  { id: 'privacy', name: 'Privacy', icon: '🔒' },
  { id: 'filename', name: 'Filename', icon: '📝' },
  { id: 'progress', name: 'Progress', icon: '📈' },
  { id: 'advanced', name: 'Advanced', icon: '⚡' },
  { id: 'pwa', name: 'PWA', icon: '📱' },
];

export function MenuBar({ activePanel, onSelectPanel, collapsed = false, onToggleCollapsed }) {
  return (
    <header className={`menu-bar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="menu-bar__inner">
        <button
          type="button"
          className="menu-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="top-menu-items"
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? '☰' : '✕'}
        </button>

        <nav
          id="top-menu-items"
          className="menu-items"
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
