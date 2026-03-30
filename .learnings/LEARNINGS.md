## [LRN-20260328-005] best_practice

**Logged**: 2026-03-28T16:55:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When converting a split-screen vertical layout to landscape orientation, use a sticky center rail for primary actions and horizontal scrolling flex containers for image lists to maintain usable screen real estate.

### Details
This image converter originally stacked upload (left) and output (right) zones vertically. Converting to landscape required: (1) a 3-column grid with ~45/20/35 split, (2) sticky positioning for the center action rail, (3) horizontal scrolling flex containers with fixed-width cards for image lists, (4) responsive breakpoints that gracefully collapse to vertical stack on mobile. The center rail with vertical flow arrow provides clear visual cue of left-to-right data flow.

### Suggested Action
Use `grid-template-columns: minmax(0, 1fr) minmax(220px, 0.28fr) minmax(0, 1fr)` for desktop landscape, `position: sticky` for action rails, `display: flex; overflow-x: auto; scroll-snap-type: x proximity` for horizontal image galleries, and collapse to single column at ~1100px and ~640px breakpoints.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/styles.css
- Tags: layout, responsive, horizontal-scrolling, sticky-rail
- Pattern-Key: frontend.layout.landscape-split-screen
- Recurrence-Count: 1
- First-Seen: 2026-03-28
- Last-Seen: 2026-03-28

### Resolution
- **Resolved**: 2026-03-28T16:55:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Implemented 3-column landscape layout with sticky center rail, horizontal scrolling image lists, and responsive collapse behavior while preserving all Phase 2 animations.

---

## [LRN-20260328-006] best_practice

**Logged**: 2026-03-28T17:47:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When merging a dropzone and queue into one panel, keep the drop target visually dominant and move queue content into a secondary block below it instead of nesting another full card.

### Details
This UI change worked best by turning the upload area into a single zone panel with three layers: compact header, drop target, and queue block. Reusing the existing horizontal image grid preserved animations and scrolling behavior while removing the redundant standalone "Input queue" card. Shrinking headings, pills, and helper copy improved fit without changing conversion logic.

### Suggested Action
For similar UI consolidations, keep one outer panel, preserve existing interactive list components inside a lightweight inner wrapper, and reduce typography before reducing functionality.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/components/UploadZone.jsx, src/components/ImageList.jsx, src/styles.css
- Tags: ui, layout, typography, consolidation
- Pattern-Key: frontend.ui.merge-dropzone-and-queue
- Recurrence-Count: 1
- First-Seen: 2026-03-28
- Last-Seen: 2026-03-28

### Resolution
- **Resolved**: 2026-03-28T17:47:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Merged upload and queue into one panel, moved the convert rail below both columns, and tightened text and card sizing while preserving animations.

---
## [LRN-20260328-001] best_practice

**Logged**: 2026-03-28T17:44:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For two-column converter UIs, bottom-spanning action rails simplify responsive behavior better than narrow center columns.

### Details
This image converter layout became easier to tune after moving conversion controls into a bottom rail that spans both upload and output columns. The horizontal rail preserves the transfer metaphor, gives the format selector and buttons more room, and collapses cleanly to a single column on smaller screens without disturbing image grids.

### Suggested Action
Prefer grid-template-areas with a shared bottom rail when a central control strip needs to stay prominent across responsive breakpoints.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/styles.css, src/components/FormatSelector.jsx
- Tags: layout, responsive, rail, frontend

---
## [LRN-20260328-001] best_practice

**Logged**: 2026-03-28T17:56:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For horizontal media cards, use a padded preview container with `object-fit: contain` and explicit min-heights to avoid thumbnail cropping while preserving animations.

### Details
The image converter cards were clipping uploaded and converted thumbnails because preview images filled the full box with `object-fit: cover`. Enlarging the card footprint, giving the preview a stable aspect ratio/min-height, and switching the image itself to `object-fit: contain` allowed full-image visibility without changing the card animation classes.

### Suggested Action
When adjusting image-heavy card layouts, update the preview container sizing and the responsive breakpoints together instead of only changing the `<img>` rule.

### Metadata
- Source: conversation
- Related Files: src/styles.css
- Tags: image-cards, object-fit, responsive-ui, animation-safe
- Pattern-Key: frontend.media-card.contain-preview-sizing

---
## [LRN-20260328-002] best_practice

**Logged**: 2026-03-28T18:03:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For lane-based conversion UIs, remove items from the source list when transfer starts and only append them to the destination list after the arrival animation finishes.

### Details
During final polish of the image converter, keeping an item visible in the upload queue while also animating transfer made the flow feel duplicated and visually sticky. A cleaner interaction is: remove from the source queue at flip start, run any in-flight lane animation separately, then append to the output list only after the arrival timing completes. Also guard the failure path by restoring the source item if conversion fails after removal.

### Suggested Action
When implementing source-to-destination animations, separate queue membership from animation state and make error handling restore the source item if the async operation fails mid-transfer.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/components/ImageList.jsx
- Tags: animation-timing, queue-state, ui-polish, async-state
- Pattern-Key: frontend.transfer-flow.remove-on-start-append-on-arrive

---
## [LRN-20260328-007] best_practice

**Logged**: 2026-03-28T18:10:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When a horizontal card lane sits inside a flex/grid panel, use `min-height: 0` on parent wrappers and avoid `height: 100%` stretching on grid columns so the lane can remain fully visible and scrollable.

### Details
This image converter had queue cards getting clipped and top panels visually crowding into the bottom rail. The root cause was vertical stretching across the split grid (`height: 100%`, `min-height: 100%`, stretch alignment) combined with a scroll lane inside nested flex containers. Switching the split layout to top alignment, removing forced full-height stretching, and applying `min-height: 0` to the column/panel/queue wrappers allowed the image lane to size naturally while preserving horizontal overflow.

### Suggested Action
For similar UIs, define explicit grid rows for top content vs bottom rail, use `align-items: start`, add a real row gap/margin between sections, and give nested flex parents `min-height: 0` before debugging the inner `overflow-x: auto` element.

### Metadata
- Source: conversation
- Related Files: src/styles.css
- Tags: grid, flex, overflow, horizontal-scroll, responsive-layout
- Pattern-Key: frontend.layout.grid-flex-overflow-separation
- Recurrence-Count: 1
- First-Seen: 2026-03-28
- Last-Seen: 2026-03-28

### Resolution
- **Resolved**: 2026-03-28T18:10:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Separated the two-row grid layout, removed forced full-height stretching, and kept the queue/image lanes fully visible with horizontal scrolling intact.

---
## [LRN-20260329-002] best_practice

**Logged**: 2026-03-29T19:20:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
When a media gallery must switch from a horizontal lane to a visible multi-row layout, replace auto-flow scrolling columns with `repeat(auto-fit, minmax(...))` and move bulk download actions to the container toolbar instead of each card.

### Details
This image converter originally used a horizontally scrolling image lane with per-card download controls. For the revised UX, the better pattern was a wrapping CSS grid (`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`) so every converted/uploaded image remains visible without side-scrolling. Once cards became a gallery, per-card download CTA text added noise; centralizing downloads into zone-level buttons made the UI cleaner and aligned with the requirement for ZIP vs individual batch downloads.

### Suggested Action
For similar converter/gallery screens, prefer a responsive wrapping grid for previews, keep cards focused on preview + metadata, and implement bulk download handlers at the section level with a short delay between file triggers to reduce browser popup/download blocking.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/components/ConvertedZone.jsx, src/components/ConvertedImageList.jsx, src/styles.css
- Tags: frontend, grid-layout, batch-downloads, gallery-ui
- Pattern-Key: frontend.gallery.grid-wrap-with-bulk-download-toolbar
- Recurrence-Count: 1
- First-Seen: 2026-03-29
- Last-Seen: 2026-03-29

### Resolution
- **Resolved**: 2026-03-29T19:20:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Replaced horizontal scrolling with a responsive grid, removed per-image download UI, and added toolbar-level batch download actions for ZIP and separate file downloads.

---
## [LRN-20260329-001] best_practice

**Logged**: 2026-03-29T18:57:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For horizontally scrollable image queues, grid auto-columns are more reliable than mixing fixed-width flex cards with overflow inside nested panels.

### Details
The image converter UI risked hiding later cards when multiple images were present. Switching the queue/output strip to `display: grid` with `grid-auto-flow: column` and explicit `grid-auto-columns` keeps every card in a single horizontal lane and preserves scrolling more predictably across nested flex/grid containers.

### Suggested Action
Prefer auto-column grid strips for horizontally scrolling card galleries in this app, especially when the cards need responsive widths and snap behavior.

### Metadata
- Source: conversation
- Related Files: src/styles.css
- Tags: frontend, layout, scrolling, responsive

---
## [LRN-20260329-001] best_practice

**Logged**: 2026-03-29T19:59:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
For card-transfer animations, clarity improves when duration, travel distance, and directional cues are tuned together rather than only slowing the motion down.

### Details
The swipe animation in this image converter felt too subtle at ~0.5s. The clearer result came from synchronizing the JS timing and CSS animation to 1.2s, adding a mid-animation scale curve, extending the travel to viewport-relative distance, and layering glow + arrow/trail cues. This made the left-to-right motion readable without introducing a jerky feel.

### Suggested Action
When a transfer animation feels too fast or ambiguous, update both the state timing constant and the CSS keyframes together, then combine: longer duration, larger start scale, stronger shrink at exit, viewport-relative travel, and an explicit directional indicator.

### Metadata
- Source: conversation
- Related Files: src/App.jsx, src/styles.css
- Tags: animation, motion, timing, visual-clarity
- Pattern-Key: frontend.animation.transfer-clarity-timing-sync
- Recurrence-Count: 1
- First-Seen: 2026-03-29
- Last-Seen: 2026-03-29

### Resolution
- **Resolved**: 2026-03-29T19:59:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Increased swipe timing to 1200ms, added stronger scale/glow/blur states, and added arrow/trail direction cues for the overlay card.

---
## [LRN-20260329-001] best_practice

**Logged**: 2026-03-29T20:50:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
For multi-item swipe animations, start the visual swipe phase in parallel and keep the keyframes simple to avoid perceived pauses and jitter.

### Details
Sequentially awaiting a full swipe animation per image introduced visible gaps between cards. A smoother effect came from launching all swipe overlays together, waiting once for the shared swipe duration, and then running conversions in parallel. Simplifying the swipe keyframes to a single left-to-right motion with a smooth cubic-bezier curve also reduced the choppy feel.

### Suggested Action
When animating batches of items, prefer parallel or lightly staggered starts over fully serialized animations, and avoid multi-stop keyframes unless the extra beats are intentional.

### Metadata
- Source: conversation
- Related Files: src/App.jsx,src/styles.css
- Tags: animation, ux, parallelism, swipe
- Pattern-Key: frontend.parallel-swipe-animation

---
