import type { Project } from "../models/project";
import {
  emptyCircuit,
  kindLabel,
  type CircuitElement,
  type CircuitKind,
  type Point,
} from "../models/circuit";
import { findCircuitProfile } from "../data/softCircuitLibrary";
import { grid } from "./geometry";
export function createCircuitElement(
  kind: CircuitKind,
  point: Point,
  materialId = "",
): CircuitElement {
  return {
    id: crypto.randomUUID(),
    kind,
    name: kindLabel[kind],
    materialId,
    channel: "",
    ...point,
    width:
      kind === "battery"
        ? 14
        :
      kind === "trace"
        ? 1
        : kind === "sensing-region"
          ? 12
          : kind === "insulation"
            ? 16
            : 4,
    height: kind === "battery" ? 8 : kind === "sensing-region" ? 24 : kind === "insulation" ? 28 : 4,
    points: [],
    notes: "",
    textileLayer: kind === "trace" || kind === "insulation" ? "integrated" : "surface",
  };
}
export function addBatteryAssembly(
  p: Project,
  point: Point,
  layer: CircuitElement["textileLayer"] = "surface",
): Project {
  const c = p.circuit ?? emptyCircuit(p.garment.joint);
  if (c.elements.length > 196) return p;
  const battery = createCircuitElement("battery", point, "battery-pack");
  battery.name = "Battery pack";
  battery.textileLayer = layer;
  const plus = createCircuitElement("terminal", { column: point.column - 2, row: point.row + 3 }, "connector");
  plus.name = "Battery · VBAT+";
  plus.channel = "VBAT+";
  plus.batteryId = battery.id;
  plus.textileLayer = layer;
  const ground = createCircuitElement("terminal", { column: point.column + battery.width, row: point.row + 3 }, "connector");
  ground.name = "Battery · GND−";
  ground.channel = "GND−";
  ground.batteryId = battery.id;
  ground.textileLayer = layer;
  return { ...p, circuit: { ...c, elements: [...c.elements, battery, plus, ground] } };
}
export function updateCircuitElement(
  p: Project,
  id: string,
  patch: Partial<CircuitElement>,
): Project {
  const circuit = p.circuit ?? emptyCircuit(p.garment.joint);
  return {
    ...p,
    circuit: {
      ...circuit,
      elements: circuit.elements.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    },
  };
}
export function finishTrace(
  p: Project,
  points: Point[],
  materialId = "c-yarn",
  activeLayer: CircuitElement["textileLayer"] = "surface",
): Project {
  if (
    points.length < 2 ||
    points.length > 64 ||
    (p.circuit?.elements.reduce((n, e) => n + e.points.length, 0) ?? 0) +
      points.length >
      2048 ||
    (p.circuit?.elements.length ?? 0) >= 200
  )
    return p;
  const c = p.circuit ?? emptyCircuit(p.garment.joint);
  const targets = [
    ...c.elements.filter((item) => item.kind === "electrode" || item.kind === "terminal"),
  ];
  const nearest = (q: Point, layer?: CircuitElement["textileLayer"]) => {
    const ranked = targets
      .filter((item) => layer === undefined || (item.textileLayer ?? "surface") === layer)
      .map((item) => {
        const point = {
          column: Math.max(item.column, Math.min(item.column + item.width, q.column)),
          row: Math.max(item.row, Math.min(item.row + item.height, q.row)),
        };
        return { item, point, distance: Math.hypot(point.column - q.column, point.row - q.row) };
      })
      .filter((item) => item.distance <= 3)
      .sort((a, b) => a.distance - b.distance);
    return ranked[0];
  };
  const start = nearest(points[0], activeLayer);
  const end = nearest(points.at(-1)!, start?.item.textileLayer ?? activeLayer);
  const routed = points.map((q) => ({ ...q }));
  if (start) routed[0] = start.point;
  if (end) routed[routed.length - 1] = end.point;
  const e = createCircuitElement("trace", routed[0], materialId);
  e.points = routed;
  e.fromId = start?.item.id;
  e.toId = end?.item.id;
  e.textileLayer = start?.item.textileLayer ?? end?.item.textileLayer ?? activeLayer;
  e.channel = start?.item.channel ?? end?.item.channel ?? "";
  return { ...p, circuit: { ...c, elements: [...c.elements, e] } };
}
const distance = (p: Point, a: Point, b: Point) => {
  const x = b.column - a.column,
    y = b.row - a.row,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.column - a.column) * x + (p.row - a.row) * y) /
          (x * x + y * y || 1),
      ),
    );
  return Math.hypot(p.column - a.column - t * x, p.row - a.row - t * y);
};
const cross = (a: Point, b: Point, c: Point) =>
  (b.column - a.column) * (c.row - a.row) -
  (b.row - a.row) * (c.column - a.column);
export function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  if (
    cross(a, b, c) * cross(a, b, d) < 0 &&
    cross(c, d, a) * cross(c, d, b) < 0
  )
    return 0;
  return Math.min(
    distance(a, c, d),
    distance(b, c, d),
    distance(c, a, b),
    distance(d, a, b),
  );
}
const segments = (e: CircuitElement) =>
  e.kind === "trace"
    ? e.points.slice(1).map((p, i) => [e.points[i], p] as [Point, Point])
    : [];
const corners = (e: {
  column: number;
  row: number;
  width: number;
  height: number;
}): Point[] => [
  { column: e.column, row: e.row },
  { column: e.column + e.width, row: e.row },
  { column: e.column + e.width, row: e.row + e.height },
  { column: e.column, row: e.row + e.height },
];
const inside = (
  q: Point,
  e: { column: number; row: number; width: number; height: number },
) =>
  q.column >= e.column &&
  q.column <= e.column + e.width &&
  q.row >= e.row &&
  q.row <= e.row + e.height;
const padDistance = (q: Point, e: CircuitElement) =>
  Math.hypot(
    Math.max(e.column - q.column, 0, q.column - e.column - e.width),
    Math.max(e.row - q.row, 0, q.row - e.row - e.height),
  );
export function circuitChecks(p: Project): string[] {
  const es = p.circuit?.elements ?? [],
    out: string[] = [],
    dims = grid(p.garment);
  const nodes = [
    ...es.filter((e) => e.kind !== "trace" && e.kind !== "insulation"),
    ...p.sensors,
  ];
  const layerOf = (element: CircuitElement) => element.textileLayer ?? (element.kind === "trace" || element.kind === "insulation" ? "integrated" : "surface");
  for (const e of es) {
    if (!e.channel && e.kind !== "insulation")
      out.push(`${e.name}: channel unassigned.`);
    if (
      !findCircuitProfile(e.materialId) &&
      !p.materials.some((m) => m.id === e.materialId)
    )
      out.push(`${e.name}: material unassigned or unavailable.`);
    const qs = e.kind === "trace" ? e.points : corners(e);
    const margin = e.kind === "trace" ? e.width / 2 : 0;
    if (
      qs.some(
        (q) =>
          q.column - margin < 0 ||
          q.row - margin < 0 ||
          q.column + margin > dims.columns ||
          q.row + margin > dims.rows,
      )
    )
      out.push(`${e.name}: extends outside garment / seam boundary.`);
    if (
      e.kind === "terminal" &&
      !es.some(
        (t) => t.kind === "trace" && (t.fromId === e.id || t.toId === e.id),
      )
    )
      out.push(`${e.name}: no explicitly assigned trace connection.`);
    if (e.kind === "trace") {
      if (
        e.points.every(
          (q) => q.column === e.points[0].column && q.row === e.points[0].row,
        )
      )
        out.push(`${e.name}: trace has zero geometric length.`);
      if (
        findCircuitProfile(e.materialId)?.conductive === false ||
        p.materials.find((m) => m.id === e.materialId)?.yarnType ===
          "Nonconductive"
      )
        out.push(`${e.name}: trace uses a nonconductive profile.`);
      if (e.fromId && e.fromId === e.toId)
        out.push(
          `${e.name}: start and end assign the same object; review routing intent.`,
        );
      const ss = segments(e);
      if (
        ss.some(([a, b], i) =>
          ss.some(
            ([c, d], j) => j > i + 1 && segmentDistance(a, b, c, d) <= e.width,
          ),
        )
      )
        out.push(
          `${e.name}: possible self-crossing or touching trace geometry.`,
        );
      for (const [field, q] of [
        ["fromId", e.points[0]],
        ["toId", e.points.at(-1)],
      ] as const) {
        const id = e[field],
          node = nodes.find((n) => n.id === id);
        if (!node || !q)
          out.push(
            `${e.name}: ${field === "fromId" ? "start" : "end"} connection unassigned or missing.`,
          );
        else {
          if (!inside(q, node))
            out.push(
              `${e.name}: assigned endpoint does not geometrically land on ${node.name}.`,
            );
          if (e.channel && node.channel && e.channel !== node.channel)
            out.push(`${e.name}: channel differs from ${node.name}.`);
        }
      }
    }
  }
  for (const s of p.sensors)
    if (!s.channel) out.push(`${s.name}: channel unassigned.`);
  const conductors = es.filter(
    (e) =>
      e.kind !== "insulation" &&
      (findCircuitProfile(e.materialId)?.conductive ?? true),
  );
  const intentionalConnections = new Set<string>();
  for (const trace of es.filter((element) => element.kind === "trace"))
    if (trace.fromId && trace.toId)
      intentionalConnections.add([trace.fromId, trace.toId].sort().join("::"));
  const linked = (a: CircuitElement, b: CircuitElement) =>
    intentionalConnections.has([a.id, b.id].sort().join("::"));
  for (let i = 0; i < conductors.length; i++)
    for (let j = i + 1; j < conductors.length; j++) {
      const a = conductors[i],
        b = conductors[j];
      if (layerOf(a) !== layerOf(b)) continue;
      let contact = false;
      if (a.kind === "trace" && b.kind === "trace")
        contact = segments(a).some(([u, v]) =>
          segments(b).some(
            ([x, y]) => segmentDistance(u, v, x, y) <= (a.width + b.width) / 2,
          ),
        );
      else if (a.kind === "trace" || b.kind === "trace") {
        const t = a.kind === "trace" ? a : b,
          r = a.kind === "trace" ? b : a;
        const cs = corners(r);
        contact = segments(t).some(
          ([u, v]) =>
            inside(u, r) ||
            inside(v, r) ||
            cs.some(
              (x, k) =>
                segmentDistance(u, v, x, cs[(k + 1) % 4]) <= t.width / 2,
            ),
        );
        const assigned = t.fromId === r.id || t.toId === r.id;
        if (assigned && contact) continue;
      } else
        contact =
          a.column <= b.column + b.width &&
          a.column + a.width >= b.column &&
          a.row <= b.row + b.height &&
          a.row + a.height >= b.row;
      const tracesShareAssignedNode =
        a.kind === "trace" && b.kind === "trace" &&
        [a.fromId, a.toId].some((id) => !!id && (id === b.fromId || id === b.toId));
      if (contact && (linked(a, b) || tracesShareAssignedNode)) continue;
      if (contact)
        out.push(
          `${a.name} / ${b.name}: possible crossing or touching conductive geometry; review isolation and intended connections.`,
        );
    }
  // Include legacy sensing areas in geometric contact review.
  for (const e of conductors)
    for (const s of p.sensors) {
      if (e.sensorId === s.id) continue;
      if (layerOf(e) !== (s.textileLayer ?? "surface")) continue;
      if (e.kind === "trace") {
        if (e.fromId === s.id || e.toId === s.id) continue;
        const cs = corners(s);
        if (
          segments(e).some(
            ([u, v]) =>
              inside(u, s) ||
              inside(v, s) ||
              cs.some(
                (q, i) =>
                  segmentDistance(u, v, q, cs[(i + 1) % 4]) <= e.width / 2,
              ),
          )
        )
          out.push(
            `${e.name} / ${s.name}: possible unintended contact with sensing area.`,
          );
      } else if (
        corners(e).some((q) => inside(q, s)) ||
        corners(s).some((q) => inside(q, e)) ||
        (e.column <= s.column + s.width &&
          e.column + e.width >= s.column &&
          e.row <= s.row + s.height &&
          e.row + e.height >= s.row)
      )
        out.push(
          `${e.name} / ${s.name}: possible unintended conductive region contact.`,
        );
    }
  return out;
}
export function applyIntentTemplate(p: Project): Project {
  const c = p.circuit ?? emptyCircuit(p.garment.joint);
  if (
    c.elements.length > 194 ||
    c.elements.reduce((n, e) => n + e.points.length, 0) > 2043
  )
    return p;
  const { columns, rows } = grid(p.garment);
  const x = Math.max(4, Math.floor(columns * 0.3)),
    y = Math.max(8, Math.floor(rows * 0.35));
  const sensing = createCircuitElement(
    "sensing-region",
    { column: x, row: y },
    c.intent.measurement === "Joint movement"
      ? "resistive"
      : c.intent.measurement === "Other"
        ? ""
        : "capacitive",
  );
  sensing.name = `${c.intent.measurement} concept`;
  sensing.width = Math.max(2, Math.min(12, Math.floor(columns * 0.15)));
  sensing.height = Math.max(2, Math.min(24, Math.floor(rows * 0.3)));
  const pad = createCircuitElement(
    "electrode",
    { column: x, row: y - 4 },
    "c-fabric",
  );
  const terminal = createCircuitElement(
    "terminal",
    { column: x + 24, row: 8 },
    "connector",
  );
  const trace = createCircuitElement(
    "trace",
    { column: x + 2, row: y - 2 },
    "c-yarn",
  );
  trace.points = [
    { column: x + 2, row: y - 2 },
    { column: x + 26, row: y - 2 },
    { column: x + 26, row: 10 },
  ];
  trace.fromId = pad.id;
  trace.toId = terminal.id;
  const contact = createCircuitElement(
    "trace",
    { column: x + 2, row: y - 2 },
    "c-yarn",
  );
  contact.points = [
    { column: x + 2, row: y - 2 },
    { column: x + 2, row: y + 2 },
  ];
  contact.fromId = pad.id;
  contact.toId = sensing.id;
  const insulation = createCircuitElement(
    "insulation",
    { column: x - 2, row: y - 6 },
    "dielectric",
  );
  for (const e of [sensing, pad, terminal, trace, contact]) e.channel = "CH-01";
  return {
    ...p,
    circuit: {
      ...c,
      elements: [
        ...c.elements,
        insulation,
        sensing,
        pad,
        terminal,
        trace,
        contact,
      ],
    },
  };
}
/** Add a two-terminal textile sensor template with every segment assigned to
 * explicit endpoint objects. This is an editable concept layout, not a
 * validated or electrically simulated circuit. */
export function applySensorCircuitTemplate(p: Project, sensor: Project["sensors"][number]): Project {
  const c = p.circuit ?? emptyCircuit(p.garment.joint);
  const { columns, rows } = grid(p.garment);
  if (c.elements.length > 190 || sensor.width < 8 || sensor.height < 6) return p;
  const y = sensor.row + Math.floor(sensor.height / 2);
  const padY = y - 2;
  const routeLane = Math.max(4, sensor.row - 8);
  const leftPad = createCircuitElement("electrode", { column: sensor.column - 4, row: padY }, "c-fabric");
  leftPad.name = `${sensor.name} · Pin A`;
  leftPad.width = 4; leftPad.height = 4;
  const rightPad = createCircuitElement("electrode", { column: sensor.column + sensor.width, row: padY }, "c-fabric");
  rightPad.name = `${sensor.name} · Pin B`;
  rightPad.width = 4; rightPad.height = 4;
  const leftTerminal = createCircuitElement("terminal", { column: sensor.column - 16, row: routeLane - 2 }, "connector");
  leftTerminal.name = `${sensor.name} · Readout A`;
  const rightTerminal = createCircuitElement("terminal", { column: sensor.column + sensor.width + 12, row: routeLane - 2 }, "connector");
  rightTerminal.name = `${sensor.name} · Readout B`;
  const sensing = createCircuitElement("sensing-region", { column: sensor.column, row: sensor.row }, sensor.materialId);
  sensing.name = `${sensor.name} · Sensing element`;
  sensing.width = sensor.width; sensing.height = sensor.height;
  const makeTrace = (name: string, points: Point[], fromId: string, toId: string) => {
    const trace = createCircuitElement("trace", points[0], "c-yarn");
    Object.assign(trace, { name, points, fromId, toId, channel: sensor.channel, sensorId: sensor.id, textileLayer: "integrated" as const, knitStructureId: sensor.knitStructureId });
    return trace;
  };
  const traces = [
    makeTrace(`${sensor.name} · Contact A`, [{ column: sensor.column - 2, row: y }, { column: sensor.column, row: y }], leftPad.id, sensing.id),
    makeTrace(`${sensor.name} · Contact B`, [{ column: sensor.column + sensor.width + 2, row: y }, { column: sensor.column + sensor.width, row: y }], rightPad.id, sensing.id),
    makeTrace(`${sensor.name} · Lead A`, [{ column: sensor.column - 2, row: y }, { column: sensor.column - 2, row: routeLane }, { column: sensor.column - 14, row: routeLane }], leftPad.id, leftTerminal.id),
    makeTrace(`${sensor.name} · Lead B`, [{ column: sensor.column + sensor.width + 2, row: y }, { column: sensor.column + sensor.width + 2, row: routeLane }, { column: sensor.column + sensor.width + 14, row: routeLane }], rightPad.id, rightTerminal.id),
  ];
  // Logical connectivity is separate from the drawn route. Each side is its
  // own net; the sensing element is a two-terminal component between them.
  const netA = { id: crypto.randomUUID(), name: `${sensor.channel || sensor.name} · A`, notes: "Intended connection; not electrically validated." };
  const netB = { id: crypto.randomUUID(), name: `${sensor.channel || sensor.name} · B`, notes: "Intended connection; not electrically validated." };
  const pin = (elementId: string, name: string, netId: string, point: Point) => ({ id: crypto.randomUUID(), elementId, name, netId, point });
  const pins = [
    pin(sensing.id, "A", netA.id, { column: sensor.column, row: y }),
    pin(leftPad.id, "Pad A", netA.id, { column: sensor.column - 2, row: y }),
    pin(leftTerminal.id, "Readout A", netA.id, { column: sensor.column - 14, row: routeLane }),
    pin(sensing.id, "B", netB.id, { column: sensor.column + sensor.width, row: y }),
    pin(rightPad.id, "Pad B", netB.id, { column: sensor.column + sensor.width + 2, row: y }),
    pin(rightTerminal.id, "Readout B", netB.id, { column: sensor.column + sensor.width + 14, row: routeLane }),
  ];
  const pinAt = (elementId: string, netId: string) => pins.find(item => item.elementId === elementId && item.netId === netId)!.id;
  Object.assign(traces[0], { netId: netA.id, fromPinId: pinAt(leftPad.id, netA.id), toPinId: pinAt(sensing.id, netA.id) });
  Object.assign(traces[2], { netId: netA.id, fromPinId: pinAt(leftPad.id, netA.id), toPinId: pinAt(leftTerminal.id, netA.id) });
  Object.assign(traces[1], { netId: netB.id, fromPinId: pinAt(rightPad.id, netB.id), toPinId: pinAt(sensing.id, netB.id) });
  Object.assign(traces[3], { netId: netB.id, fromPinId: pinAt(rightPad.id, netB.id), toPinId: pinAt(rightTerminal.id, netB.id) });
  const isolation = createCircuitElement("insulation", { column: sensor.column - 8, row: sensor.row - 4 }, "dielectric");
  isolation.name = `${sensor.name} · Isolation layer`;
  isolation.width = sensor.width + 16; isolation.height = sensor.height + 8;
  for (const element of [sensing, leftPad, rightPad, leftTerminal, rightTerminal, isolation, ...traces]) {
    element.sensorId = sensor.id;
    element.sensorTemplateVersion = 3;
    element.channel = sensor.channel;
    element.knitStructureId = sensor.knitStructureId;
    element.textileLayer = element.kind === "insulation" ? "integrated" : sensor.textileLayer ?? "surface";
  }
  const group = [leftPad, rightPad, leftTerminal, rightTerminal, sensing, isolation, ...traces];
  if (group.some((e) => {
    const points = e.kind === "trace" ? e.points : [
      { column: e.column, row: e.row },
      { column: e.column + e.width, row: e.row + e.height },
    ];
    return points.some((q) => q.column < 0 || q.row < 0 || q.column > columns || q.row > rows);
  })) return p;
  return { ...p, circuit: { ...c, pins: [...(c.pins ?? []), ...pins], nets: [...(c.nets ?? []), netA, netB], elements: [...c.elements, ...group] } };
}
export function syncSensorCircuit(p: Project, before: Project["sensors"][number], sensor: Project["sensors"][number]): Project {
  if (!p.circuit?.elements.some((element) => element.sensorId === sensor.id)) return p;
  const y = sensor.row + Math.floor(sensor.height / 2), padY = y - 2, routeLane = Math.max(4, sensor.row - 8);
  const patchElement = (element: CircuitElement): CircuitElement => {
    const suffix = element.name.includes(" · ") ? element.name.slice(element.name.lastIndexOf(" · ")) : "";
    const base = { ...element, sensorTemplateVersion: 3, name: `${sensor.name}${suffix}`, channel: sensor.channel, knitStructureId: sensor.knitStructureId };
    if (element.kind === "sensing-region") return { ...base, column: sensor.column, row: sensor.row, width: sensor.width, height: sensor.height, materialId: sensor.materialId, textileLayer: sensor.textileLayer ?? "surface" };
    if (element.kind === "electrode" && element.name.endsWith("Pin A")) return { ...base, column: sensor.column - 4, row: padY, textileLayer: sensor.textileLayer ?? "surface" };
    if (element.kind === "electrode" && element.name.endsWith("Pin B")) return { ...base, column: sensor.column + sensor.width, row: padY, textileLayer: sensor.textileLayer ?? "surface" };
    if (element.kind === "terminal" && element.name.endsWith("Readout A")) return { ...base, column: sensor.column - 16, row: routeLane - 2, textileLayer: sensor.textileLayer ?? "surface" };
    if (element.kind === "terminal" && element.name.endsWith("Readout B")) return { ...base, column: sensor.column + sensor.width + 12, row: routeLane - 2, textileLayer: sensor.textileLayer ?? "surface" };
    if (element.kind === "insulation") return { ...base, column: sensor.column - 8, row: sensor.row - 4, width: sensor.width + 16, height: sensor.height + 8 };
    if (element.kind === "trace") {
      const left = sensor.column, right = sensor.column + sensor.width;
      const points = element.name.endsWith("Contact A") ? [{ column: left - 2, row: y }, { column: left, row: y }]
        : element.name.endsWith("Contact B") ? [{ column: right + 2, row: y }, { column: right, row: y }]
        : element.name.endsWith("Lead A") ? [{ column: left - 2, row: y }, { column: left - 2, row: routeLane }, { column: left - 14, row: routeLane }]
        : [{ column: right + 2, row: y }, { column: right + 2, row: routeLane }, { column: right + 14, row: routeLane }];
      return { ...base, points, column: points[0].column, row: points[0].row, textileLayer: sensor.textileLayer ?? "surface" };
    }
    return base;
  };
  const previous = p.circuit.elements;
  const elements = previous.map((element) =>
    element.sensorId === sensor.id ? patchElement(element) : element,
  );
  const moved = new Map(
    elements
      .filter((element) => element.sensorId === sensor.id)
      .map((element) => {
        const before = previous.find((item) => item.id === element.id)!;
        return [element.id, { dx: element.column - before.column, dy: element.row - before.row }] as const;
      }),
  );
  const routed = elements.map((element) => {
    if (element.kind !== "trace" || element.sensorId === sensor.id) return element;
    const points = element.points.map((point) => ({ ...point }));
    const start = moved.get(element.fromId ?? "");
    const end = moved.get(element.toId ?? "");
    if (start && points.length) {
      points[0].column += start.dx;
      points[0].row += start.dy;
    }
    if (end && points.length) {
      points[points.length - 1].column += end.dx;
      points[points.length - 1].row += end.dy;
    }
    return { ...element, points, column: points[0]?.column ?? element.column, row: points[0]?.row ?? element.row };
  });
  const elementById = new Map(routed.map(element => [element.id, element]));
  const previousById = new Map(previous.map(element => [element.id, element]));
  const pins = (p.circuit.pins ?? []).map(pin => {
    const after = elementById.get(pin.elementId);
    const beforeElement = previousById.get(pin.elementId);
    if (!after || !beforeElement || after.sensorId !== sensor.id) return pin;
    if (after.kind === "sensing-region") {
      const isB = pin.name === "B";
      return { ...pin, point: { column: isB ? after.column + after.width : after.column, row: after.row + Math.floor(after.height / 2) } };
    }
    return { ...pin, point: { column: pin.point.column + after.column - beforeElement.column, row: pin.point.row + after.row - beforeElement.row } };
  });
  return { ...p, circuit: { ...p.circuit, elements: routed, pins } };
}
export function designSummary(p: Project) {
  const c = p.circuit ?? emptyCircuit(p.garment.joint);
  return `SOFT SENSOR STUDIO — CO-DESIGN BRIEF\nResearch prototype; not a clinically validated design.\n\nProject: ${p.name}\nBody location: ${c.intent.bodyLocation}\nDesired measurement: ${c.intent.measurement}\nClinical / research goal: ${c.intent.goal || "Not specified"}\nGarment: ${p.garment.joint}; ${p.garment.circumferenceMm} × ${p.garment.lengthMm} mm\nTextile structure: ${p.structure}\nGrid: wale upward, course around circumference, column 0 at seam.\n\nLAYOUT AND MATERIALS\n${p.sensors.map((s) => `${s.name} (legacy sensing region): (${s.column},${s.row}) ${s.width}×${s.height}; ${p.materials.find((m) => m.id === s.materialId)?.name ?? s.materialId}; channel ${s.channel || "unassigned"}`).join("\n")}\n${c.elements.map((e) => `${e.name} [${e.id}] (${e.kind}): ${e.kind === "trace" ? e.points.map((q) => `(${q.column},${q.row})`).join(" → ") : `(${e.column},${e.row}) ${e.width}×${e.height}`}; material ${findCircuitProfile(e.materialId)?.name ?? p.materials.find((m) => m.id === e.materialId)?.name ?? "unassigned"}; channel ${e.channel || "unassigned"}; notes: ${e.notes || "none"}${e.kind === "trace" ? `; explicit start ${e.fromId || "unassigned"}, end ${e.toId || "unassigned"}` : ""}`).join("\n")}\n\nSCHEMATIC GEOMETRY REVIEW\n${circuitChecks(p).join("\n") || "No flagged geometric issues."}\nOverlap, adjacency, endpoint assignments and shared stitches do not establish electrical continuity. No electrical behavior is simulated. Insulation geometry does not prove isolation.\n\nFABRICATION ASSUMPTIONS\n${c.assumptions}\n\nUNRESOLVED VALIDATION\n${c.validationNotes}\nNo Kniterate or fabrication export is included. Template layouts may be incomplete circuits and must be reviewed by fabrication and electronics specialists.`;
}
export function translateElement(
  e: CircuitElement,
  dx: number,
  dy: number,
): CircuitElement {
  const moved = {
    ...e,
    column: e.column + dx,
    row: e.row + dy,
    points: e.points.map((q) => ({ column: q.column + dx, row: q.row + dy })),
  };
  return [moved, ...moved.points].some(
    (q) => Math.abs(q.column) > 100000 || Math.abs(q.row) > 100000,
  )
    ? e
    : moved;
}
export function translateBatteryAssembly(p: Project, batteryId: string, dx: number, dy: number): Project {
  const c = p.circuit;
  if (!c) return p;
  const members = new Set([batteryId, ...c.elements.filter((e) => e.batteryId === batteryId).map((e) => e.id)]);
  const moved = c.elements.map((e) => members.has(e.id) ? translateElement(e, dx, dy) : e);
  const deltas = new Map(moved.filter((e) => members.has(e.id)).map((e) => {
    const old = c.elements.find((item) => item.id === e.id)!;
    return [e.id, { dx: e.column - old.column, dy: e.row - old.row }] as const;
  }));
  const elements = moved.map((e) => {
    if (e.kind !== "trace") return e;
    const start = deltas.get(e.fromId ?? ""), end = deltas.get(e.toId ?? "");
    if (!start && !end) return e;
    const points = e.points.map((q, i) => ({
      column: q.column + (i === 0 ? start?.dx ?? 0 : i === e.points.length - 1 ? end?.dx ?? 0 : 0),
      row: q.row + (i === 0 ? start?.dy ?? 0 : i === e.points.length - 1 ? end?.dy ?? 0 : 0),
    }));
    return { ...e, points, column: points[0]?.column ?? e.column, row: points[0]?.row ?? e.row };
  });
  return { ...p, circuit: { ...c, elements } };
}
export { padDistance };
