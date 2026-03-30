## [ERR-20260328-001] google-chrome-headless

**Logged**: 2026-03-28T17:48:00-03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
Headless Google Chrome did not complete a local screenshot capture in this environment.

### Error
```
[383155:383155:0328/174630.385855:ERROR:base/memory/shared_memory_switch.cc:289] Failed global descriptor lookup: 7
Process still running.
```

### Context
- Command/operation attempted: `google-chrome --headless --disable-gpu --no-sandbox --run-all-compositor-stages-before-draw --virtual-time-budget=3000 --window-size=1440,1400 --screenshot=/home/pschivo/.openclaw/workspace-devo/image-converter-app/ui-layout.png http://127.0.0.1:4173`
- Local Vite dev server was running at `http://127.0.0.1:4173`
- Screenshot file was not produced

### Suggested Fix
Try an alternate screenshot path for this environment, such as Playwright, a different Chromium binary/flags, or a browser-driven capture tool known to work in the sandbox.

### Metadata
- Reproducible: unknown
- Related Files: ui-layout.png

---
## [ERR-20260328-001] edit-tool

**Logged**: 2026-03-28T17:45:00-03:00
**Priority**: low
**Status**: pending
**Area**: frontend

### Summary
An exact-text CSS edit failed because the targeted block had already diverged from the expected content.

### Error
```
Could not find the exact text in /home/pschivo/.openclaw/workspace-devo/image-converter-app/src/styles.css. The old text must match exactly including all whitespace and newlines.
```

### Context
- Operation attempted: exact replacement of the action-panel and flow-arrow CSS block
- Cause: the stylesheet had prior compaction/sizing edits, so the original search block no longer matched exactly

### Suggested Fix
Re-read the narrower section first, then replace the current exact block instead of relying on stale text.

### Metadata
- Reproducible: yes
- Related Files: src/styles.css

---
## [ERR-20260328-001] search-command

**Logged**: 2026-03-28T17:55:00-03:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
`rg` was not available in the environment while locating relevant CSS/component classes.

### Error
```text
/bin/bash: line 1: rg: command not found
```

### Context
- Command/operation attempted: `rg -n "image-card|image-grid|convert-button|Convert images|button" -S src /home/pschivo/.openclaw/workspace-devo/image-converter-app`
- Environment details: sandbox shell on local workspace

### Suggested Fix
Use `grep -RInE` as a portable fallback when ripgrep is unavailable.

### Metadata
- Reproducible: yes
- Related Files: src/styles.css, src/components/ImageList.jsx, src/components/ConvertedImageList.jsx, src/components/ConvertButton.jsx

### Resolution
- **Resolved**: 2026-03-28T17:56:00-03:00
- **Commit/PR**: local workspace change
- **Notes**: Switched to `grep -RInE` and continued the task successfully.

---
## [ERR-20260329-001] functions.edit

**Logged**: 2026-03-29T18:58:00-03:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
A CSS edit failed because the replacement payload used an invalid parameter name.

### Error
```
Missing required parameter: newText alias. Supply correct parameters before retrying.
```

### Context
- Command/operation attempted: edit tool replacement in `src/styles.css`
- Input or parameters used: typo used `.newText` instead of `newText`
- Environment details if relevant: OpenClaw file edit tool

### Suggested Fix
Double-check edit payload keys before submitting tool calls.

### Metadata
- Reproducible: yes
- Related Files: src/styles.css

### Resolution
- **Resolved**: 2026-03-29T18:58:30-03:00
- **Commit/PR**: local workspace change
- **Notes**: Re-ran the edit with the correct `newText` key and continued successfully.

---
