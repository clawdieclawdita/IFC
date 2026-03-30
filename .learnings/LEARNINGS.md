## [LRN-20260330-001] best_practice

**Logged**: 2026-03-30T01:39:39Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
For this app, format-selection tests must set the target format before uploading when the source file matches the default target, otherwise the upload is rejected before conversion begins.

### Details
The upload component blocks files whose extension already matches the current target format. Playwright tests that upload PNG while the default target is PNG will fail before conversion and can be mistaken for format-conversion regressions.

### Suggested Action
In future E2E tests, explicitly choose the target format first for same-as-default sources and keep a separate assertion that same-target uploads are rejected by design.

### Metadata
- Source: error
- Related Files: e2e/basic.spec.ts, e2e/format-conversion.spec.ts, src/components/UploadZone.jsx
- Tags: playwright, upload-validation, regression-testing

---

## [LRN-20260330-002] knowledge_gap

**Logged**: 2026-03-30T01:51:30Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Sharp support advertised by app code must be validated against the actual runtime build; this environment's Sharp/libvips bundle can convert common formats but does not natively decode BMP input.

### Details
`server.js` listed BMP as supported and attempted to use Sharp directly, but runtime inspection showed `sharp.format.bmp` was missing and `sharp(file).metadata()` failed on valid BMP files with `Input file contains unsupported image format`. MIME type and extension alone were not reliable because uploads can be misnamed, so BMP handling now detects the `BM` file signature and BMP MIME types, logs the detected format, and falls back to `bmp-js` decoding before passing raw RGBA data into Sharp.

### Suggested Action
For any future format claimed in `SUPPORTED_FORMATS`, verify runtime support with `sharp.format` and add explicit fallbacks or remove the format from the public support list.

### Metadata
- Source: error
- Related Files: server.js, package.json
- Tags: sharp, bmp, mime-detection, file-signature, image-conversion
- See Also: ERR-20260330-002

### Resolution
- **Resolved**: 2026-03-30T01:51:30Z
- **Commit/PR**: local workspace change
- **Notes**: Added signature-aware BMP detection, `bmp-js` fallback decode/encode paths, and conversion logging; verified BMP → JPG succeeds through the live API.

---
## [LRN-20260329-001] best_practice

**Logged**: 2026-03-30T02:15:00Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Prefer real fixture files and existing Playwright helpers for image conversion E2E tests instead of synthetic minimal byte buffers.

### Details
A BMP/JPG verification task initially suggested tiny inline buffers for uploaded files. The app already has stable Playwright fixtures and helper utilities that exercise the real upload and conversion flow more reliably. Reusing those fixtures reduces false negatives from invalid image payloads and keeps new tests aligned with the actual production path.

### Suggested Action
When adding future image-format E2E coverage, import shared helpers and upload canonical fixture files from `e2e/fixtures/`.

### Metadata
- Source: conversation
- Related Files: tests/bmp-fix.spec.ts, e2e/helpers.ts
- Tags: playwright, e2e, fixtures, conversion

---
## [LRN-20260330-001] best_practice

**Logged**: 2026-03-30T03:20:00Z
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
For resize UIs, cap selectable dimensions to the smallest uploaded original image and mirror the same limit on the server.

### Details
This bug existed because the UI tracked only the first file's dimensions and allowed sliders up to 4000px. The safer pattern is to store original dimensions per uploaded file, compute the smallest width/height across the batch, cap all UI state and preview calculations to those values, disable oversize presets, and keep backend validation as a final guardrail.

### Suggested Action
Reuse this pattern for any batch image resize feature: batch minimum dimensions in client state, capped settings sent to API, and server rejection for any upscale attempt.

### Metadata
- Source: conversation
- Related Files: src/App.jsx,src/components/SizePanel.jsx,server.js
- Tags: resize,validation,ux,image-processing
- Pattern-Key: harden.image_resize_no_upscale

### Resolution
- **Resolved**: 2026-03-30T03:20:00Z
- **Notes**: Implemented smallest-original-dimension caps in UI and API.

---
