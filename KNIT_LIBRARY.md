# Knit Structure Library — implementation and inspection

## Expanded catalog (current version)

The library now covers all 26 numbered catalog positions, with **26 named schematic studies and no unnamed placeholders**. This is not 26 fully authenticated digital structures. This section supersedes the five-entry MVP counts and pending-reference statements below.

21 name/number pairs were visually checked in official product photographs linked from https://fashionary.org/products/the-knit-swatches. Each verified entry links directly to its identity evidence; verification applies only to name and number, not construction, repeat, mechanics or yarn topology. Official images were inspected as research references and are not bundled in the app.

| Slot | Entry | Identity |
|---|---|---|
|01|Jersey|Verified|
|02|Double Jersey|Verified|
|03|1×1 Rib|Verified|
|04|2×2 Rib variant|Exact in/out arrangement pending|
|05|2×2 Rib variant|Exact in/out arrangement pending|
|06|Simple Rib|Verified|
|07|Board Rib|Verified|
|08|Tubular / Split Welt|Verified|
|09|Ottoman|Verified|
|10|Half Milano|Verified|
|11|Full Milano|User brief; independent number verification pending|
|12|Ponte di Roma|Verified|
|13|Half Cardigan|Verified|
|14|Full Cardigan|Verified|
|15|Interlock|Verified|
|16|Links / Links-Links|User-supplied mapping; Fashionary numbering pending; generic technical definition supported|
|17|Moss Stitch|Verified|
|18|Seed Stitch|Verified|
|19|Double Seed Stitch|Verified|
|20|Plain Piqué / Single Piqué|User-supplied mapping; Fashionary numbering pending; generic technical definition supported|
|21|Double Piqué|Verified in official bundle image|
|22|Lacoste|Verified|
|23|Skip Stitch|Verified|
|24|Racked Stitch|Verified|
|25|Double Face|Verified|
|26|Plush|Verified|

Expanded implementation adds `src/data/knitCatalog.ts`, catalog positions, direct identity-source links, optional original pattern matrices, unavailable visualization status, name/number search, identity filtering and dynamic categories. Shared SVG/Canvas rendering now distinguishes tuck, miss/float, displacement and pile concepts. Mechanical properties for new entries remain unknown. Original repeats are explanatory motifs, not reproductions of kit diagrams or validated needle sequences. Ambiguous or unsupported constructions disable CAD application.

The exact Fashionary number-to-name mapping for 16/20, the 04/05 variants and independent evidence for 11 still require direct catalog confirmation. Slots 16/20 now use generic definitions explicitly authorized in the user’s supplemental research, with pending-number labels. All 26 have original schematic views; not all are fabrication implementations or CAD-applicable.

Validation: 40 tests pass across 4 files, covering all 26 unique positions, evidence states, unavailable-pattern safety, repeat periodicity, concept symbols and persistence for all CAD-supported structures. Production build passes with the existing large Three.js chunk warning. Browser smoke checks confirm the expanded count, Cardigan search, Half Cardigan application and details.

## Completed generic studies for positions 16 and 20

The user supplied technical research and explicitly instructed use of Links at position 16 and Plain Piqué at 20, retaining pending Fashionary number verification. Both now have names, English-only aliases and search terms, technical reference links, source-backed qualitative properties, original schematic views, garment CAD previews and JSON persistence. Former placeholder IDs `unresolved-16` / `unresolved-20` resolve as aliases, preserving any imported references.

- **Links:** 1 column × 2 courses, `K / P` fabric-face alternation. [Kniterate Links-links](https://support.kniterate.com/hc/en-us/articles/360013026098-Links-links) confirms opposite-bed knitting on consecutive courses and transfers after each course. The app explains those transfers but does not generate them or simulate continuous yarn topology. Lengthwise extensibility, horizontal stretch and low edge curling are qualitative, individually sourced. Reversibility is recorded. Thickness remains unknown as a measurement; no Nm7 machine settings were copied.
- **Plain Piqué:** 2 columns × 4 courses, `KK / KT / KK / TK`. [Stedman 2024, printed p.131](https://shakeradv.com/catalogues/Stedman-2024.pdf#page=131) describes this Single Piqué repeat. It is a generic reference, not proof of Fashionary sample 20’s exact repeat. Surface stability is qualitative and sample dependent. No quantitative thickness, elasticity, recovery or breathability was added.
- Source-backed generic technical definitions, pending kit numbering and schematic visualization precision remain distinct in the UI. No official Fashionary diagram was copied and no machine-knitting export or validation is claimed.

The earlier official bundle research identified position 21 as **Double Piqué**, using [the wider official image](https://cdn.shopify.com/s/files/1/0875/5554/files/knit_industry.webp?v=1742964942) on [The Knit Swatches Bundle](https://fashionary.org/products/the-knit-swatches-bundle).

Updated files in this pass: `src/models/knitStructure.ts`, `src/data/knitCatalog.ts`, `src/data/knitStructures.ts`, `src/components/KnitLibrary/KnitLibrary.tsx`, `src/tests/knitLibrary.test.ts`, and this report. All 40 tests and the production build pass; the existing Three.js size warning remains. No commit, push or deployment performed.

## Original MVP implementation notes


## Three-dimensional yarn preview

Garment preview now defaults to **3D yarn relief**: instanced tube meshes wrap around the existing cylindrical sleeve. Knit/purl, front/back bed concepts, tuck, miss, displacement and pile markers use different geometric silhouettes. Rib receives wale-based relief; Links alternates face silhouettes by course. These are representative local motifs, not continuous or structurally verified yarn topology.

- Toggle **3D yarn relief** to compare geometric relief with the prior Canvas surface texture.
- Choose **Stitch detail** in the camera selector for a close view of the raised loops. Orbit, scroll, camera presets, transparency and seam remain available.
- Geometry density is capped at 96 representative columns × 72 courses, respecting repeat sizes. The preview explicitly labels representative density; it does not display one geometric loop per CAD cell on large grids.
- Shared geometry and instanced meshes bound draw calls. Generated geometries are disposed on changes/unmount. Sensor surfaces are offset outside the yarn relief and retain selection behavior. Their original data and JSON coordinates are unchanged.
- Neutral rough yarn material, hemisphere fill and directional lights make relief visible. No physical deformation, manufacturing, fit, yarn tension or electrical simulation is implied.
- Existing legacy Single jersey and Rib labels also render geometric previews; custom/unknown structures retain their plain cylinder fallback.

Files for this addition: `src/services/knitGeometry3D.ts`, `src/components/KnitYarn3D.tsx`, `src/components/Viewer3D.tsx`, `src/styles.css`, `src/tests/knitGeometry3D.test.ts`. Validation: 46 tests pass across 5 files; production build passes with the existing large Three.js chunk warning. Geometry tests cover bounded density, repeat alignment, finite meshes, cylindrical placement and distinct relief silhouettes. Browser smoke testing covers visible yarn relief, camera controls and retained sensor overlays. App text remains English-only.

## Run locally

Use Node 24 LTS (the existing Vitest dependency declares Node 22.12, 24, or 26+).

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the Vite URL, then choose **Knit Structure Library** in the CAD header or **Browse knit structures** in Materials. Select **Use in CAD**, close the library, and inspect the existing 2D editor and cylindrical 3D preview. Save/open JSON retains `knitStructureId`. Undo and redo include selection changes.

## Delivered

- Five original, deterministic structure studies: Jersey, 1×1 Rib, Full Milano, Interlock and a conceptual Tubular Knit.
- Responsive cards, construction/category/stretch/stability/reversibility filters, details and side-by-side comparison.
- Separate surface, operation/face-symbol and loop-relationship schematics; controls for stitch count, courses, zoom, face and stitch direction. Repeat dimensions are defined per structure.
- Garment-level selection for Jersey, Rib, Milano and Interlock, leaving sensor regions and their existing assignments intact. Tubular application is disabled while its construction identity remains unresolved.
- Canvas schematic under the existing grid and sensors, plus a disposable repeating CanvasTexture on the existing cylinder. Row zero remains at the bottom and column zero at the seam. More than 80,000 garment cells omit the 2D texture to bound rendering work; the grid and sensors remain available.
- Optional additive `knitStructureId` in schema version 1; no destructive migration. Legacy files are unchanged. Unknown future string references persist but are not rendered. Malformed references are rejected.
- Property-level qualitative/unknown evidence and separate classification, visualization and mechanics provenance. A typed future measurement model accommodates values/curves, units, method, sample ID, provenance and conditions. No invented numerical properties or measurement UI.
- Native modal focus containment, Escape/close support and focus return. Editor keyboard shortcuts pause while the library is open.

## Repository inspection

Soft Sensor Studio: React 19 / TypeScript / Vite, Zustand project history and local storage, Konva 2D, Three.js / R3F cylinder. Integration extends these components without replacing the CAD editor. Showcase and Threadlines entry points are unchanged.

ACT Lab repository: https://github.com/ACT-Lab-Classrooms/representing-knitted-structures-WeiWu0115

Inspected `Loop.py`, `basic_knit_graph_generators.py`, `Knit_Graph_Visualizer.py`, README and LICENSE. It contains parent-loop relationships, pull directions, yarn-order and float concepts, jersey/rib/tube generators and a Plotly/NetworkX visualizer. License: MIT, copyright 2024 Megan Hofmann. Direct reuse would require a Python backend or a graph/topology port and validation beyond this MVP. No code was copied or adapted; the new TypeScript schematics are independent. The diagrams do not implement the Python graph model or claim equivalent accuracy.

## References and verification (2026-10-28)

- Supplied URL https://fashionary.org/products/the-knit-swatches-kit returns a storefront 404. The current official product is https://fashionary.org/products/the-knit-swatches, also linked by https://fashionary.org/products/the-knit-swatches-bundle.
- Official text confirms 26 swatches and numbered technical cards. It does not enumerate individual names/numbers in the accessible page text.
- Jersey 01, 1×1 Rib 03 and Full Milano 11 are supplied by the user brief, retained as **proposed** references. No entry is marked as an authenticated Fashionary sample. Interlock and Tubular references remain unknown. No speculative remaining 21 entries were added.
- Mechanical qualitative tendencies come from the user brief and say so at property level. Other values are unknown. They are not independently validated literature data. No measured values are present.
- Fashionary attribution is visible inside the library, with independent visualization authorship and no endorsement claim. No Fashionary photography, diagrams or proprietary descriptions were copied.

## Modified files

- `src/models/knitStructure.ts`: structure, evidence and future measurement types.
- `src/data/knitStructures.ts`: incremental catalog and provenance.
- `src/services/knitPatternGenerator.ts`: deterministic symbols and bounded Canvas surface renderer.
- `src/components/KnitLibrary/KnitLibrary.tsx`: browsing, filters, comparison, detail, attribution and garment application.
- `src/components/KnitLibrary/KnitPatternViewer.tsx`: SVG views and parameter controls.
- `src/App.tsx`: library entry points, selection summary and shortcut gating.
- `src/models/project.ts`, `src/services/projectIO.ts`: optional persistent reference and validation.
- `src/components/Editor2D.tsx`, `src/components/Viewer3D.tsx`: schematic garment previews.
- `src/styles.css`: library styling.
- `src/tests/knitLibrary.test.ts`: periodicity, distinct patterns, evidence guards, legacy/future JSON, reference validation, selection/history persistence.

## Validation and limits

Production build passes; all 34 tests across 4 files pass. Build emits a large Three.js chunk warning. Local Node 25 runs the checks successfully but is outside Vitest's declared engine range; Node 24 LTS is recommended. Browser smoke checks cover library opening, applying Rib, details and switching diagrams.

All visualizations are explicitly schematic, particularly double-bed structures and loop links. These are not verified continuous yarn topology, machine instructions, deformation, electrical behavior, fit or manufacturability. Surface appearance and mechanical behavior require real sample validation. Sensor-region-specific library assignment and per-region texture overrides are future work; existing sensor structure labels remain editable as before. Measurements, data import and physical simulation are not implemented.

No commit, push or deployment performed.
