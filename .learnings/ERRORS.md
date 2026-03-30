## [ERR-20260330-001] playwright-docker-port-access

**Logged**: 2026-03-30T01:39:39Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
Docker Compose reported the app healthy on localhost:4444, but host-side HTTP requests from Playwright/Node hung and could not reach the published port.

### Error
```
apiRequestContext.get: Timeout 30000ms exceeded
GET http://127.0.0.1:4444/health
```

### Context
- Command/operation attempted: Playwright global setup health check and host-side fetch/curl to port 4444
- Environment: Docker container healthy; healthcheck inside container passed repeatedly
- Workaround used: launched the same app code directly on host port 4455 for E2E coverage

### Suggested Fix
Investigate Docker port publishing / host networking on this machine. Verify `docker compose port app 3000`, host firewall/NAT rules, and whether another local proxy is accepting but not forwarding traffic on 4444.

### Metadata
- Reproducible: yes
- Related Files: docker-compose.yml, Dockerfile, playwright.config.ts

---

## [ERR-20260330-002] bmp-conversion-fails

**Logged**: 2026-03-30T01:39:39Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
BMP → JPG conversion fails in the live app while the UI claims BMP is supported.

### Error
```
Input file contains unsupported image format
```

### Context
- Command/operation attempted: upload `e2e/fixtures/sample-bmp.bmp`, set target format JPG, run conversion
- Server log source: `sharp(...).toFile()` inside `convertImageFile()`
- Frontend result: no converted image appears; error text is shown in the helper error area

### Suggested Fix
Validate real BMP decoding support in the current Sharp/libvips build or normalize BMP uploads before conversion. Add an automated regression test for BMP input once fixed.

### Metadata
- Reproducible: yes
- Related Files: server.js, e2e/format-conversion.spec.ts

### Resolution
- **Resolved**: 2026-03-30T01:51:30Z
- **Commit/PR**: local workspace change
- **Notes**: Confirmed this Sharp 0.33.5 build exposes no BMP input support (`sharp.format.bmp` is absent). Added server-side BMP signature/MIME detection plus a `bmp-js` fallback decoder so BMP uploads can still be converted through Sharp as raw RGBA data. Also added BMP output fallback encoding and request logging for detected format and fallback usage.

---
## [ERR-20260329-001] playwright_remote_host_staleness

**Logged**: 2026-03-30T02:15:00Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Remote Playwright host did not reflect the menu-default code change even though the updated project built successfully.

### Error
```
expect(locator('.menu-bar')).toHaveClass(/expanded/)
Received string: "menu-bar collapsed"
```

### Context
- Command: `npx playwright test tests/bmp-fix.spec.ts e2e/menu-system.spec.ts`
- Base URL: `http://192.168.1.200:4444`
- Result: BMP tests passed on the shared host, but the menu-default assertion failed there.
- Follow-up validation against local built preview (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173`) passed, indicating deployment/runtime staleness rather than a code-level regression.

### Suggested Fix
When validating behavior changes against a shared host, allow the Playwright base URL to be overridden and distinguish code correctness from deployment freshness before concluding the implementation failed.

### Metadata
- Reproducible: yes
- Related Files: playwright.config.ts, e2e/menu-system.spec.ts, src/App.jsx

---
## [ERR-20260330-001] shell_tooling

**Logged**: 2026-03-30T10:19:21-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
 was not available in the container, so codebase search needed a  fallback.

### Error


### Context
- Command/operation attempted: 
- Environment details: project shell on Linux workspace

### Suggested Fix
Prefer  as a portable fallback when ripgrep is unavailable.

### Metadata
- Reproducible: yes
- Related Files: src/components/MenuBar.jsx,src/styles.css

### Resolution
- **Resolved**: 2026-03-30T10:19:21-03:00
- **Commit/PR**: local workspace change
- **Notes**: Switched to  for code search and continued successfully.

---
## [ERR-20260330-001] shell_tooling

**Logged**: 2026-03-30T10:19:37-03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
`rg` was not available in the container, so codebase search needed a `grep -RIn` fallback.

### Error
```
/bin/bash: line 1: rg: command not found
```

### Context
- Command/operation attempted: `rg -n "Panels ready|menu-items|menu-item|MenuBar" src`
- Environment details: project shell on Linux workspace

### Suggested Fix
Prefer `grep -RIn` as a portable fallback when ripgrep is unavailable.

### Metadata
- Reproducible: yes
- Related Files: src/components/MenuBar.jsx,src/styles.css

### Resolution
- **Resolved**: 2026-03-30T10:19:37-03:00
- **Commit/PR**: local workspace change
- **Notes**: Switched to `grep -RIn` for code search and continued successfully.

---
