# Soft Circuit Design — prototype implementation

## Using the prototype

Run `npm ci`, then `npm run dev`. Open **Circuit** in the existing CAD sidebar.

1. Choose a body location and desired measurement; describe the clinical / research goal. These labels are design intent, not measurement predictions. Garment dimensions remain under Design.
2. **Add editable concept layout** adds six objects: a sensing placeholder, contact pad, terminal, two explicit traces, and an insulation region. Templates are intentionally labeled incomplete assembly concepts. They do not provide a complete readout circuit, a resistance model, or a fabricated capacitive stack.
3. Select a tool or a generic profile in **Soft Circuit Library**. Click to place a rectangular object. For a trace, click successive stitch-grid vertices and choose **Finish trace**. Escape cancels a draft. Up to 64 vertices per trace are supported.
4. Use **Select / move** to drag an object. Trace vertex handles can be dragged individually. Properties edits names, materials, channels, dimensions, vertices, endpoint assignments and notes. Delete, Duplicate, Undo and Redo cover circuit objects. Duplicated traces deliberately have no assigned endpoints.
5. Assign trace **Start connection** and **End connection** explicitly to sensing areas, pads or terminals. A pad can be assigned to multiple traces to express a junction intention. Geometry never creates a connection automatically.
6. Toggle textile, sensing, routing, contact and insulation visibility in **Visual layers**. These apply to both 2D and the cylindrical 3D sleeve. Visibility does not change checks or connectivity. These are display layers, not a verified physical stack-up.
7. Review the schematic geometry warnings. Add fabrication assumptions and unresolved validation notes. **Show design summary** and **Download design brief** provide a readable handoff; **Save project / Open** retain the editable JSON project.

All default application text is English. The existing Knit Structure Library, Pattern Playground, Threadlines, sensors and yarn editor remain available.

## Delivered scope

The library includes seven generic profiles: conductive yarn, conductive fabric, dielectric spacer, resistive region, capacitive region, textile electrode and connector terminal. Profiles have material considerations and explicit unknowns; no vendor qualifications or quantitative performance data are invented. Circuit elements can also reference existing project yarns.

Five editable object kinds use integer stitch-grid coordinates: `sensing-region`, `trace`, `electrode`, `terminal`, `insulation`. Trace width is in schematic stitch cells. Rectangular widths/heights use stitch/course cells. Circuit objects map through the same `patternToCylinder` convention as existing sensor regions: column zero at the seam, row zero at the bottom. 3D trace tubes follow the unwrapped segments around the cylinder, while regions become curved patches outside the representative yarn relief. Insulation is translucent. Sensor and circuit selection are retained.

## Geometric checks, not electrical validation

Checks flag:

- Terminals without an explicitly assigned trace;
- Unassigned channels or materials, missing endpoint references, endpoint-to-pad geometric mismatch and channel mismatch;
- Out-of-bounds regions and traces, including nominal trace width at garment/seam boundaries;
- Crossing, collinear, touching, near-contact and self-crossing trace geometry;
- Potential unintended contacts between circuit conductors, and with legacy sensing areas;
- Nonconductive material assigned to a trace, zero-length traces and both endpoints assigned to the same target.

Assigned contacts are also called out for physical junction/isolation review. Insulation graphics do not suppress contact warnings or prove isolation. Distances are evaluated in stitch-coordinate space, not calibrated physical clearance. Anisotropic gauge, physical layers, yarn cross-sections, contact resistance, crossings, tolerances and fabrication methods require external review. Shared channel names, adjacent cells, overlaps and shared stitches do not establish electrical continuity.

No electrical, mechanical, physiological or clinical predictions are implemented. Fabrication/Kniterate export remains separate and is not provided by this extension.

## Persistence and backward compatibility

The existing outer `schemaVersion: 1` is retained with an optional additive `circuit` object. The nested circuit format has `version: 1`, intent, elements, assumptions and validation notes. Existing files without `circuit` parse unchanged. Endpoint and material IDs are preserved even if unavailable, allowing the checks and property editor to report them instead of silently inventing replacements.

JSON import validates nested shapes, known object kinds, integer coordinates, positive dimensions, unique IDs across legacy/circuit objects, endpoint field types and bounded data. Limits: 200 circuit objects, 64 vertices per trace, and 2,048 total trace vertices. Bad JSON data is rejected before rendering. Deleted targets clear explicit endpoint references; undo restores both objects and links. Draft traces are discarded on load and history operations.

## Files changed

New:

- `src/models/circuit.ts`: object, intent, connection and display types.
- `src/data/softCircuitLibrary.ts`: unmeasured generic profiles and considerations.
- `src/services/circuit.ts`: creation, templates, edits, geometric checks and brief generation.
- `src/services/circuitIO.ts`: nested schema validation and limits.
- `src/stores/circuitUI.ts`: drawing state, drafts and shared layer visibility.
- `src/components/CircuitPanel.tsx`: intent workflow, library, tools, layers, object list and summary.
- `src/components/CircuitProperties.tsx`: object geometry, metadata and explicit endpoint editing.
- `src/components/CircuitCanvas.tsx`: Konva geometry, drawing preview and drag interactions.
- `src/components/Circuit3D.tsx`: curved regions and trace tubes.
- `src/tests/circuit.test.ts`: persistence, malformed imports, rule cases, editing/history and summary tests.

Extended: `src/models/project.ts`, `src/services/projectIO.ts`, `src/stores/studio.ts`, `src/components/Editor2D.tsx`, `src/components/Viewer3D.tsx`, `src/App.tsx`, `src/styles.css`.

## Validation

All **61 tests across 6 files pass**, and the production build passes. Browser smoke checks covered intent entry, template creation, manual three-vertex trace drawing, material/channel/name editing, snapped movement, deletion/undo, 3D display, brief download, project JSON download and re-import. The exported example contains seven objects, including the manually edited routing study; its saved vertices and channel were checked from the downloaded JSON. The production bundle retains the existing Three.js size warning.

The example JSON and brief are co-design artifacts with deliberate unresolved schematic warnings, not fabrication-ready designs. No commits, pushes or deployments were performed.
