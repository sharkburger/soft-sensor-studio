import { beforeEach, describe, expect, it } from "vitest";
import { sampleProject } from "../models/project";
import { emptyCircuit } from "../models/circuit";
import {
  createCircuitElement,
  applyIntentTemplate,
  circuitChecks,
  designSummary,
  finishTrace,
  segmentDistance,
  translateElement,
  updateCircuitElement,
} from "../services/circuit";
import { parseProject, serialize } from "../services/projectIO";
import { useStudio } from "../stores/studio";
import { circuitLibrary } from "../data/softCircuitLibrary";
const base = () => ({
  ...sampleProject(),
  sensors: [],
  circuit: emptyCircuit(),
});
const point = (column: number, row: number) => ({ column, row });
describe("soft circuit schema and library", () => {
  it("covers every required profile category without measured performance claims", () => {
    expect([...new Set(circuitLibrary.map((m) => m.category))].sort()).toEqual([
      "Capacitive sensor", "Conductive fabric", "Conductive yarn", "Connector",
      "Dielectric material", "Electrode", "Power source", "Resistive sensor",
    ]);
    expect(circuitLibrary.every((m) => m.consideration.length > 20)).toBe(true);
  });
  it("leaves legacy files unchanged and round trips circuit intent, materials, nodes and links", () => {
    const legacy = sampleProject();
    expect(parseProject(serialize(legacy))).toEqual(legacy);
    const p = applyIntentTemplate(base());
    expect(parseProject(serialize(p))).toEqual(p);
    expect(p.circuit!.elements).toHaveLength(6);
    expect(new Set(p.circuit!.elements.map((e) => e.kind)).size).toBe(5);
  });
  it("rejects malformed nested data and ID collisions", () => {
    const p = applyIntentTemplate(base());
    for (const circuit of [
      null,
      { ...p.circuit, version: 2 },
      { ...p.circuit, intent: null },
      {
        ...p.circuit,
        elements: [{ ...p.circuit!.elements[0], points: [point(0, 0)] }],
      },
      { ...p.circuit, elements: [{ ...p.circuit!.elements[0], width: -1 }] },
      {
        ...p.circuit,
        elements: [p.circuit!.elements[0], p.circuit!.elements[0]],
      },
    ])
      expect(() => parseProject(JSON.stringify({ ...p, circuit }))).toThrow(
        "soft circuit",
      );
    const legacy = sampleProject();
    expect(() =>
      parseProject(
        JSON.stringify({
          ...legacy,
          circuit: {
            ...emptyCircuit(),
            elements: [
              {
                ...createCircuitElement("terminal", point(4, 4)),
                id: legacy.sensors[0].id,
              },
            ],
          },
        }),
      ),
    ).toThrow("soft circuit");
  });
  it("rejects oversized / noninteger traces but preserves unknown references for review", () => {
    const p = finishTrace(base(), [point(5, 5), point(10, 10)]);
    const e = p.circuit!.elements[0];
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          circuit: {
            ...p.circuit,
            elements: [{ ...e, points: [point(0.5, 5), point(10, 10)] }],
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          circuit: {
            ...p.circuit,
            elements: [
              { ...e, points: Array.from({ length: 65 }, () => point(1, 1)) },
            ],
          },
        }),
      ),
    ).toThrow();
    const future = updateCircuitElement(p, e.id, {
      materialId: "future-yarn",
      fromId: "unknown-pad",
    });
    expect(parseProject(serialize(future))).toEqual(future);
    expect(circuitChecks(future).join(" ")).toContain("missing");
  });
});
describe("schematic circuit geometry checks", () => {
  it("does not infer a terminal connection from overlapping geometry", () => {
    let p = finishTrace(base(), [point(10, 10), point(20, 20)]);
    const terminal = createCircuitElement("terminal", point(8, 8), "connector");
    terminal.channel = "CH-01";
    p.circuit!.elements.push(terminal);
    const warnings = circuitChecks(p).join(" ");
    expect(warnings).toContain("no explicitly assigned");
    expect(warnings).toContain("connection unassigned");
    expect(warnings).toContain("channel unassigned");
  });
  it("checks explicit endpoints and channels rather than treating IDs as electrical validation", () => {
    let p = finishTrace(base(), [point(10, 10), point(20, 20)]);
    const a = createCircuitElement("terminal", point(8, 8), "connector"),
      b = createCircuitElement("electrode", point(30, 30), "electrode");
    a.channel = "CH-01";
    b.channel = "CH-02";
    p.circuit!.elements.push(a, b);
    p = updateCircuitElement(p, p.circuit!.elements[0].id, {
      fromId: a.id,
      toId: b.id,
      channel: "CH-01",
    });
    const warnings = circuitChecks(p).join(" ");
    expect(warnings).not.toContain("no explicitly assigned");
    expect(warnings).toContain("does not geometrically land");
    expect(warnings).toContain("channel differs");
    expect(warnings).not.toContain("verify physical junction");
    expect(warnings).not.toContain("crossing or touching conductive geometry");
    // Removing the declared connection must expose the overlapping terminal.
    const unassigned = updateCircuitElement(p, p.circuit!.elements[0].id, {
      fromId: undefined,
    });
    expect(circuitChecks(unassigned).join(" ")).toContain(
      "crossing or touching conductive geometry",
    );
  });
  it("detects crossing, touching, collinear and near-miss trace geometry including widths", () => {
    expect(
      segmentDistance(point(0, 0), point(10, 10), point(0, 10), point(10, 0)),
    ).toBe(0);
    expect(
      segmentDistance(point(0, 0), point(10, 0), point(5, 0), point(15, 0)),
    ).toBe(0);
    expect(
      segmentDistance(point(0, 0), point(10, 0), point(0, 4), point(10, 4)),
    ).toBe(4);
    let p = finishTrace(base(), [point(10, 10), point(30, 30)]);
    p = finishTrace(p, [point(10, 30), point(30, 10)]);
    expect(circuitChecks(p).join(" ")).toContain("crossing or touching");
  });
  it("detects self-crossing and out-of-bounds trace thickness", () => {
    let p = finishTrace(base(), [
      point(0, 10),
      point(10, 20),
      point(0, 20),
      point(10, 10),
    ]);
    expect(circuitChecks(p).join(" ")).toContain("self-crossing");
    expect(circuitChecks(p).join(" ")).toContain("outside garment");
  });
  it("detects pad contact and does not let insulation prove isolation", () => {
    const p = base(),
      a = createCircuitElement("electrode", point(10, 10), "c-fabric"),
      b = createCircuitElement("terminal", point(14, 10), "connector"),
      i = createCircuitElement("insulation", point(10, 10), "dielectric");
    p.circuit.elements = [a, b, i];
    expect(circuitChecks(p).join(" ")).toContain(
      "crossing or touching conductive geometry",
    );
  });
  it("reviews contacts with legacy sensing areas and nonconductive trace materials", () => {
    let p = finishTrace(
      { ...sampleProject(), circuit: emptyCircuit() },
      [point(70, 40), point(100, 40)],
      "dielectric",
    );
    expect(circuitChecks(p).join(" ")).toContain("nonconductive profile");
    p = updateCircuitElement(p, p.circuit!.elements[0].id, {
      materialId: "c-yarn",
    });
    expect(circuitChecks(p).join(" ")).toContain(
      "unintended contact with sensing area",
    );
  });
  it("does not flag separated conductive regions as touching", () => {
    const p = base();
    p.circuit.elements = [
      createCircuitElement("electrode", point(10, 10), "c-fabric"),
      createCircuitElement("electrode", point(40, 40), "c-fabric"),
    ];
    expect(circuitChecks(p).join(" ")).not.toContain("crossing or touching");
  });
});
describe("circuit editing and brief", () => {
  beforeEach(() =>
    useStudio.setState({
      project: base(),
      past: [],
      future: [],
      selected: null,
    }),
  );
  it("moves trace vertices in stitch coordinates and retains explicit endpoint IDs", () => {
    const e = createCircuitElement("trace", point(4, 5), "c-yarn");
    e.points = [point(4, 5), point(8, 10)];
    e.fromId = "pad";
    expect(translateElement(e, 3, -2)).toMatchObject({
      column: 7,
      row: 3,
      points: [point(7, 3), point(11, 8)],
      fromId: "pad",
    });
  });
  it("duplicates, deletes, undoes and redoes circuit objects without stale endpoint assignments", () => {
    const p = applyIntentTemplate(base()),
      terminal = p.circuit!.elements.find((e) => e.kind === "terminal")!;
    useStudio.setState({ project: p, selected: terminal.id });
    useStudio.getState().duplicate();
    expect(useStudio.getState().project.circuit!.elements).toHaveLength(7);
    useStudio.getState().select(terminal.id);
    useStudio.getState().remove();
    expect(
      useStudio
        .getState()
        .project.circuit!.elements.some((e) => e.toId === terminal.id),
    ).toBe(false);
    useStudio.getState().undo();
    expect(
      useStudio
        .getState()
        .project.circuit!.elements.some((e) => e.toId === terminal.id),
    ).toBe(true);
    useStudio.getState().redo();
    expect(
      useStudio
        .getState()
        .project.circuit!.elements.some((e) => e.toId === terminal.id),
    ).toBe(false);
  });
  it("exports intent, layout, materials, explicit links, assumptions and unresolved validation", () => {
    const p = applyIntentTemplate(base());
    p.circuit!.intent.goal = "Explore knee flexion during a task";
    const text = designSummary(p);
    for (const term of [
      "Explore knee flexion",
      "LAYOUT AND MATERIALS",
      "explicit start",
      "FABRICATION ASSUMPTIONS",
      "UNRESOLVED VALIDATION",
      "do not establish electrical continuity",
      "No Kniterate",
    ])
      expect(text).toContain(term);
  });
  it("refuses unusable trace drafts and excessive objects", () => {
    const p = base();
    expect(finishTrace(p, [point(2, 2)])).toBe(p);
    p.circuit.elements = Array.from({ length: 200 }, () =>
      createCircuitElement("terminal", point(4, 4)),
    );
    expect(finishTrace(p, [point(2, 2), point(4, 4)])).toBe(p);
    expect(applyIntentTemplate(p)).toBe(p);
  });
});
