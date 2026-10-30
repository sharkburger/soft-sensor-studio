# Research Database & Evidence Atlas

Local-first scoping-review workspace, separate from the CAD project format and browser storage. English UI. No backend, copyrighted paper figures, PDFs, electrical simulations, clinical recommendations, or fabrication exports added.

## Review locally

```sh
npm install --cache /private/tmp/soft-sensor-npm-cache
npm run dev -- --port 5188
npm test
npm run build
```

Open `http://127.0.0.1:5188/soft-sensor-studio/?view=research`.
Direct record example: `?view=research&section=database&paper=mediknit`.
The existing CAD, `showcase.html` and `threadlines.html` entries remain available. Research and CAD are independently lazy-loaded; CAD stores and keyboard handlers do not initialize in Research.

## Implemented

- Twelve-candidate corpus; case-insensitive search over title, author, notes, abstract (if supplied), keywords and topics; year/type/verification/screening/theme/role/fabrication/representation/modality/maturity filters; reset, active filter summary, title/year sorting, empty state.
- Source details, checked fields and dates, citations, screening history, evidence claims with level/locator/URL, linked requirements and deep links.
- Paper × capability atlas with R/I/H counts and role × explicit authoring-rights matrix. Unknown cells are never evidence of absence. Atlas entries open the supporting record. Counts use latest coding revision per reviewer, retaining full history in backups.
- Append-only independent reviewer screening decisions and coding revisions; conflicts remain visible. Source-linked claims and permissions; editable codebook categories, maturity, limitations and relevance. Local storage persistence with explicit failure reporting.
- Validated versioned Research JSON restore, preview and confirmation; CSV candidate append with per-row errors; DOI and normalized title/year duplicate suggestions. No silent merge. A dedup decision can document disposition while retaining both records for audit.
- Filtered CSV and valid Research JSON subset exports, complete backup, coding table JSON export. CSV formula prefixes escaped. CSV imports never inherit verification status. BibTeX import/export is deliberately not offered.
- Source-linked CAD requirements marked as hypotheses, with actual implementation status separate from research validation.
- Configurable protocol window, research questions, eligibility, codebook explanations, exact discovery queries, retrieval dates, optional actual-export counts, and an append-only search-run form. Historical run windows are retained.
- Fashionary is a separate material reference, excluded from paper counts.

## Metadata verification

Checked 28–29 October 2026 against the linked primary records; the review window remains 1 January 2010–28 October 2026. Bibliographic verification does not constitute a screening verdict. No candidates are seeded as included.

| Record | Verified source / result |
|---|---|
| KnitUI | [Crossref](https://api.crossref.org/works/10.1145/3411764.3445780), [MIT project](https://knitui.csail.mit.edu/). Complete bibliography; DOI title match checked. |
| Loopsense | [Crossref](https://api.crossref.org/works/10.1145/3613904.3642528). Complete bibliography; DOI title match checked. |
| LuxKnit | [Crossref](https://api.crossref.org/works/10.1145/3706598.3713860). Complete bibliography checked by exact DOI after initial rate-limited title lookup. |
| AdaCAD | [Official research bibliography](https://docs.adacad.org/docs/about/research/). Selected 2023 parametric-notation paper; earlier papers remain distinct. An unrelated Crossref title-query result was rejected. |
| Sketch&Stitch | [RWTH project publication list](https://hci.rwth-aachen.de/sketchstitch). Title, complete authors, year and venue checked. DOI remains unknown, not guessed. |
| Embr | [Crossref](https://api.crossref.org/works/10.1145/3491102.3502117), [university repository](https://mavmatrix.uta.edu/utalibraries_acmoapubs/79/). Complete bibliography checked. |
| Knitting Skeletons | [arXiv](https://arxiv.org/abs/1904.05681). Verified 2019 **preprint**, with arXiv-issued DOI. Final publication reconciliation pending. |
| MediKnit | [Cornell institutional project](https://www.hybridbody.human.cornell.edu/mediknit). Complete bibliography; DOI is its linked ACM publication, whose direct retrieval returned 403. |
| EdemaFlex | [Nature publisher](https://www.nature.com/articles/s41528-025-00504-6). Published **24 February 2026**, despite “025” in DOI suffix. |
| Upper-limb biofeedback | [JMIR publisher](https://rehab.jmir.org/2026/1/e77999/). Published **13 April 2026**, distinct from the 2025 preprint. |
| PneuAct | [MIT-hosted paper](https://pneuact.csail.mit.edu/file/CHI2022.pdf), first-page citation. Author order follows paper citation rather than project-page display order. |
| SensorKnits | [MIT institutional project](https://www.media.mit.edu/projects/sensorknits/overview/), [publication tab](https://www.media.mit.edu/projects/sensorknits/publications/). Project-page title verified; article bibliography unresolved. Project credits are not asserted as paper authors. |

Thus 11 bibliographies are verified (including one explicitly identified preprint); one project-page record is partially verified. Not every verified bibliography has a checked DOI. Five preliminary coding records are source-level notes, all `in_progress`; none is a completed full-text review. No formal database search exports or result counts are fabricated. The seed ledger covers recorded discovery queries and exact DOI lookups, not an exhaustive browser history.

## Data architecture and migration

- `src/research/model.ts`: normalized typed Paper, ScreeningRecord, CodingRecord, FeatureRequirement, SearchRun and MaterialReference entities and codebook.
- `src/research/seed.json`: version-controlled fixture; all bibliography unknowns explicit.
- `src/research/service.ts`: schema validation, screening aggregation, reviewer revisions, filtering, dedup, evidence counts and exports.
- `src/research/Research.tsx` / `research.css`: five views, navigation and local editing.
- `src/tests/research.test.ts`: fixture, schema rejection, search/filter/sort, evidence levels, history, dedup and export/import tests.

Research schema is version 1; local key `soft-sensor-research-v1`. The CAD schema remains unchanged. JSON validation checks nested types/enums/limits/dates/URLs and paper/requirement references; unsafe URL schemes, duplicate IDs, missing evidence locators and reasonless exclusions are rejected. Imports are limited to 5 MB / 1,000 papers in the UI. Unknown schema versions are rejected without discarding the supplied file. Future migrations must be explicit pure version-to-version functions with old-version fixtures and round-trip tests; no automatic migration into CAD JSON. Export backups before imports or browser changes.

JSON restore replaces the Research workspace only after preview; CSV adds fresh candidate IDs and suggestions for manual duplicate review. Filtered JSON retains a self-consistent subset, including restricted paper references. Full backups preserve original history and context. The separate coding-table JSON is an analysis export, not a workspace restore file.

## Limitations / future review operations

Formal searches of ACM DL, IEEE Xplore, Scopus and PubMed, full-text eligibility review, independent coding, reconciliation and validated gap synthesis remain human research work. Independent reviewers can already record decisions, but no agreement metric or PRISMA flow is claimed. No server sync, access control, collaborative live editing or participant-data storage. Imported metadata and reviewer assertions still require human verification; schema validity does not certify their truth. Existing CAD requirements are research hypotheses, never clinical or electrical validation.

## Verification

`npm test`: 78 tests passed across 7 files (including 17 Research tests). `npm run build`: passed for all three entries. Existing non-blocking Node localStorage warning in tests and Three.js chunk-size warning in build remain. Browser smoke checks cover search/detail links, saving screening and coding, reload persistence, filtered export, JSON preview/restore, atlas-to-evidence links, CAD return, Material Playground and Threadlines loading. Temporary smoke-test annotations were removed by restoring the clean Research seed; CAD data was preserved. No commit, push, merge or deployment performed.
