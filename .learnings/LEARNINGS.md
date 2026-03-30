## [LRN-20260330-001] best_practice

**Logged**: 2026-03-30T13:10:00Z
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For static navigation chrome, remove dormant expand/collapse state entirely instead of forcing it true in props or CSS.

### Details
The menu bar UI had a collapse toggle, expanded/collapsed classes, persisted menu state, and toggle handlers even though the desired behavior was an always-visible menu. The clean fix is to delete the state, localStorage key, toggle button, toggle handler, and hidden/collapsed CSS so the component shape matches the product requirement.

### Suggested Action
When a UI element becomes permanently visible, simplify the component API and styling to a single always-on layout and remove stale persistence logic.

### Metadata
- Source: simplify-and-harden
- Related Files: src/App.jsx, src/components/MenuBar.jsx, src/styles.css, src/components/OfflineBadge.jsx
- Tags: frontend, ui, static-components, status-labels
- Pattern-Key: simplify.static_ui.remove_toggle_state
- Recurrence-Count: 1
- First-Seen: 2026-03-30
- Last-Seen: 2026-03-30

---

## [LRN-20260330-002] best_practice

**Logged**: 2026-03-30T13:10:00Z
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
Local environment badges should describe execution context accurately; “LOCAL” is clearer than “OFFLINE” for a Docker-hosted app with active networking.

### Details
The badge used a lock icon with “Offline”, which inaccurately described the app because it runs locally over HTTP in Docker rather than in a disconnected/offline mode. Keeping the styling and icon while correcting the label preserves the UI while improving user understanding.

### Suggested Action
Review status badges and helper labels for environment accuracy whenever deployment mode changes.

### Metadata
- Source: conversation
- Related Files: src/components/OfflineBadge.jsx
- Tags: frontend, ux-copy, status-indicators
- Pattern-Key: harden.status_labels.match_runtime_context
- Recurrence-Count: 1
- First-Seen: 2026-03-30
- Last-Seen: 2026-03-30

---
## [LRN-20260330-001] best_practice

**Logged**: 2026-03-30T10:19:21-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When removing transient status copy from a top navigation bar, remove the whole status container and rebalance layout with centered flex navigation instead of leaving an empty placeholder.

### Details
The  copy lived in  inside a dedicated status div. The clean fix was to delete that element entirely, then update  so  centers its contents and  owns the full horizontal layout. Typography was increased by raising  font size to , adding slightly larger padding, and keeping a smaller responsive override on mobile.

### Suggested Action
For similar UI polish tasks, remove dead status wrappers in JSX and re-center the primary nav with  on the container that actually owns the menu items.

### Metadata
- Source: conversation
- Related Files: src/components/MenuBar.jsx,src/styles.css
- Tags: ui, typography, alignment, cleanup
- Pattern-Key: simplify.dead_ui_status_and_recenter_nav

### Resolution
- **Resolved**: 2026-03-30T10:19:21-03:00
- **Commit/PR**: local workspace change
- **Notes**: Verified by successful production build and screenshots from the running app.

---
## [LRN-20260330-001] best_practice

**Logged**: 2026-03-30T10:19:37-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When removing transient status copy from a top navigation bar, remove the whole status container and rebalance layout with centered flex navigation instead of leaving an empty placeholder.

### Details
The `Panels ready` copy lived in `src/components/MenuBar.jsx` inside a dedicated status div. The clean fix was to delete that element entirely, then update `src/styles.css` so `.menu-bar__inner` centers its contents and `.menu-items` owns the full horizontal layout. Typography was increased by raising `.menu-item` font size to `0.9rem`, adding slightly larger padding, and keeping a smaller responsive override on mobile.

### Suggested Action
For similar UI polish tasks, remove dead status wrappers in JSX and re-center the primary nav with `justify-content: center` on the container that actually owns the menu items.

### Metadata
- Source: conversation
- Related Files: src/components/MenuBar.jsx,src/styles.css
- Tags: ui, typography, alignment, cleanup
- Pattern-Key: simplify.dead_ui_status_and_recenter_nav

### Resolution
- **Resolved**: 2026-03-30T10:19:37-03:00
- **Commit/PR**: local workspace change
- **Notes**: Verified by successful production build and screenshots from the running app.

---
