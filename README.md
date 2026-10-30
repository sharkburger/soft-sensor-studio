# Soft Sensor Studio V2 — Phases 1–3

[Home](https://weiwu0115.github.io/soft-sensor-studio/) · [CAD Studio](https://weiwu0115.github.io/soft-sensor-studio/studio.html) · [Research Database](https://weiwu0115.github.io/soft-sensor-studio/research.html) · [Repository](https://github.com/WeiWu0115/soft-sensor-studio)

A local-first React/TypeScript CAD research prototype for cylindrical knitted sensor sleeves. No backend or account required.

## Run

Requires Node.js 22.12+, 24 LTS, or 26+ (Vitest 5 supports even-numbered Node releases).

```sh
npm install
npm run dev
npm test
npm run build
```

Open the local URL printed by Vite. Production output is in `dist/`.

## Use

1. Choose Knee, Elbow or Wrist. These are starting examples, not clinical recommendations.
2. Set circumference, length, and measured stitch/course gauge. Requested and stitch-rounded achievable sizes are shown separately.
3. Add any number of rectangular sensors; select them from the list or canvas. Drag to move and use the eight handles to resize. All geometry snaps to integer cells. The properties panel edits position, dimensions, material, structure, channel, name and display color.
4. Use V for selection, H for pan, or toolbar buttons. Scroll zooms the pattern. The percentage button resets zoom. Split mode has a draggable divider through the pattern pane's bottom-right resize control.
5. Orbit/zoom the linked 3D sleeve. Select sensors in 3D. Choose camera directions, reset the camera, toggle transparency or seam visibility.
6. Save project downloads editable JSON; Open validates and reloads it. Recent work restores from localStorage. Save to a file for a durable copy. New/reset operations are undoable.
7. Cmd/Ctrl+Z undoes; Cmd/Ctrl+Shift+Z redoes; Cmd/Ctrl+D duplicates; Delete removes; Cmd/Ctrl+S downloads the project.

## Architecture

- `src/models/project.ts`: versioned domain model and illustrative defaults.
- `src/stores/studio.ts`: Zustand source of truth, bounded history, autosave, sensor operations.
- `src/services/geometry.ts`: physical/grid conversion, shared coordinate transforms, snapping, validation.
- `src/services/projectIO.ts`: import validation and lossless JSON persistence.
- `src/components/Editor2D.tsx`: Konva pattern interactions.
- `src/components/Viewer3D.tsx`: Three.js/R3F cylinder, curved sensor meshes, selection, camera.
- `src/components/Properties.tsx`: sensor inspector and numeric editing.
- `src/App.tsx`: shell and garment/material configuration.
- `src/tests/core.test.ts`: geometry, data validation, round trip, editing and history tests.
- `examples/knee-sleeve.json`: importable sample project.

## Coordinate convention

Columns are stitches around the circumference; rows are courses along the length. Column 0 is the seam. Row 0 is the bottom. Counts are `round(requestedMm / cellMm)` and achieved dimensions are `count * cellMm`. Screen `(x,y) = (column * scale, (totalRows-row) * scale)` before viewport translation. Rectangle top uses `row + height`. Cylinder angle is `2π * column / totalColumns`, with seam at +Z and increasing columns toward +X. Cylinder Y is `(row-totalRows/2) * rowHeightMm`; radius uses achieved circumference. Sensors use tessellated cylindrical surfaces at a 1.2 mm offset to avoid z-fighting.

Changing garment dimensions preserves sensor data, including invalid geometry; warnings identify regions outside the new boundaries. Direct edits constrain and round the edited region to the valid grid. Seam-crossing conductive regions are unsupported. Imported invalid boundary geometry is preserved and reported rather than silently rewritten.

## Scope and limitations

Phases 1–3 implemented. JSON persistence belongs to Phase 1. Pixel PNG, CSV, intermediate fabrication grid, fabrication-specific electrode/connectivity validation, verified Kniterate import, and simulation belong to later phases and are not exposed as placeholder controls.

The intended later workflow is CAD → intermediate stitch representation → verified Kniterate Design App import → machine fabrication. Kniterate import requirements have not yet been researched or verified in this phase. No `.kc` or KnitScript is generated. Display colors do not assign carriers or knitting operations. Structure labels do not imply machine support. Default yarn profiles are illustrative and contain no electrical values.

The cylinder is a spatial preview, not a cloth, anatomical fit, electrical or clinical prediction. Regions may overlap with a warning. Transparent surfaces can have normal WebGL sorting artifacts. Large grids are intended for desktop use; zoom/pan is supported. Import files are limited to 5 MB and 500 sensors/materials. There is no machine validation. Actual fabrication requires official import specification review, carrier/operation mapping, swatch gauge measurement, electrode design, electrical calibration and supervised machine trials.

## Verification performed

- `npm install`: completed; final audit reported zero vulnerabilities.
- `npm test`: 10 tests passed.
- `npm run build`: TypeScript and production build passed. Vite reports a large bundle warning from the combined canvas/3D dependencies; code splitting is a future optimization.
- `npm run dev`: started successfully. Browser verified add, numeric move/resize, duplicate, dimension-change warnings, undo, reload/autosave restore, camera switching, and visible curved 3D sensor regions. Browser console error log was empty.
- Pointer drag/resize, orbit gestures and OS file chooser save/open were implemented but not exhaustively automated; data operations and JSON round trip are covered by automated tests.
- PNG/palette and machine compatibility tests are deferred with Phase 4.
- Host Node 25 ran build and tests successfully but Vitest 5 reports its supported-engine warning. Prefer a supported even-numbered Node release listed above.


## GitHub Pages deployment

The pinned GitHub Actions workflow `.github/workflows/deploy.yml` runs tests and builds on Node 24 before deploying `dist/` to Pages. Pushes to `main` redeploy automatically; manual workflow dispatch is also available. The Vite base is `/soft-sensor-studio/`, matching this repository path. Deployment follows the [official Vite GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages). No tokens are embedded in the source or frontend; projects remain in the visitor’s own browser localStorage.

## Pattern Playground — presentation edition

The separate [Pattern Playground](https://weiwu0115.github.io/soft-sensor-studio/showcase.html) is intended for research demos and presentations. The original CAD editor is available at [studio.html](https://weiwu0115.github.io/soft-sensor-studio/studio.html); the root URL is the project homepage.

- Four procedural knitted motifs: Contour, Meander, Chevron, Lattice.
- Paint/erase conductive stitches directly on the textured swatch; undo/redo edits; switch to assignment-grid view; zoom the swatch.
- Adjust motif trace width, illustrative loop length, material display color and sleeve use case.
- Linked textured 3D sleeve with orbit, auto-rotation, reset and transparency.
- Interactive dimensionless demo response with strain slider, playback, direction comparison and expanded chart.
- Exact grid-derived conductive coverage, stitch count and connected-region count.
- Independent local autosave; editable study JSON save/open; visual swatch PNG download. PNG here is a high-resolution visualization, not a one-pixel-per-stitch fabrication file.
- Explicit model notes and study format separate from the CAD project schema. No measured yarn resistance or calibrated conductivity is claimed.

`src/showcase/pattern.ts` contains motif generation, geometric metrics, knit drawing and a documented toy response formula. The curve uses the selected motif label, coverage, loop-length setting, direction and strain; it does not solve the painted network electrically. A/B markers are conceptual contact edges, not validated electrode connections. Pattern adjacency does not establish electrical continuity. Choosing a motif or changing trace width regenerates the painted design and can be undone.

The showcase is a second Vite entry (`showcase.html`). Both entries build and deploy together. No separate services or credentials are required.

## Threadlines — personal data workshop edition

Independent entry: [Threadlines](https://weiwu0115.github.io/soft-sensor-studio/threadlines.html). Earlier CAD and Pattern Playground versions remain available.

Threadlines turns personal time-series data into an artistic textile. It supports a column-mapping import flow for CSV, TSV and JSON record arrays (including `{ "data": [...] }`), three motifs, palette selection, physical size/gauge settings, a textured hanging-object preview, and optional conductive yarn roles with synthesized note playback. Supported files are limited to 8 MB and 100,000 rows. Vendor exports have not been exhaustively validated; inspect and select columns during import. PDF reports and ZIP archives are not parsed.

**Starting with Oura:** request an export in the [Oura Membership Hub](https://support.ouraring.com/hc/en-us/articles/360025441594-Export-Share-Your-Oura-Data). Unzip the download and select a table or JSON record file. Select the date/time field and a numeric metric such as a score. Duration fields may be in seconds. Unit selection labels the original values; it never converts them. The export may take time to become available, as described by Oura.

**Starting with glucose data:** [Dexcom Clarity supports CSV export](https://www.dexcom.com/en-us/faqs/can-i-export-raw-data). Other device tables may work with manual column selection but have not been device-validated. This is an artistic workshop tool, not a clinical chart or treatment aid.

### Data and mapping

- Fictional examples include a 288-point glucose-style day and a 28-day Oura-style score sequence. They are explicitly labeled synthetic.
- No account connection, token, backend upload, analytics or persistence of imported data. Imported measurements are held in browser memory. Refresh or Clear Session removes them. Files explicitly downloaded by the participant remain on that participant's device.
- ISO timestamps are supported; ambiguous slash dates require explicit MDY/DMY selection. Timestamps with offsets retain their absolute times. Offset-free times are treated as UTC; the UI displays UTC.
- Invalid/non-numeric rows are skipped and reported. Duplicate timestamps keep the last value and are reported. Measurements are sorted by time.
- Equal-duration time bins use arithmetic means. The number of bins is the smaller of sample count and course count. When bins are fewer than courses, bin results repeat across courses for a legible textile. Empty bins remain base yarn, without interpolation.
- Four equal-width intervals between selected minimum and maximum assign yarn roles. These are artistic ranges, never medical thresholds. Constant-valued datasets use the middle of the artistic scale.
- Ribbon maps value to width plus color; Strata maps value to color; Steps maps value to bar length plus color. Time is bottom-to-top unless reversed.
- Conductive role, display color and assigned musical note are separate properties. Browser audio is a sound sketch. An actual textile instrument requires electrode routing, touch sensing electronics and physical tests.

### Exports

One pixel equals one cell in the lossless palette PNG. Download its JSON manifest separately for palette meanings, conductive roles, notes and mapping metadata. CSV contains column, row and yarn role. Editable session JSON includes personal measurements and should be kept private; opening it restores the session. No raw participant measurements are included in this repository or deployed site.

The PNG/CSV/manifest are design representations. Yarn carriers, stitch operations and electrode connections are unassigned. Kniterate compatibility and fabrication are unverified. No machine code is generated.

### Verification

28 automated tests cover the original CAD, Material Playground, time parsing, CSV/JSON mapping, missing bins, geometric orientation, exact export pixel colors, manifests and session round trips. Production TypeScript build passes. A fictional local Oura-style CSV was imported through the browser and mapped successfully; conductive role selection and sound controls were exercised. In-app-browser download-event capture is limited; native download behavior should also be checked in the workshop's chosen browser. No physical machine or instrument was tested.
