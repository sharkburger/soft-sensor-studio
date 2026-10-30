import type { Project } from "../models/project";
import type { CircuitElement, CircuitNet, Point } from "../models/circuit";
import { grid } from "./geometry";
import { resolveBaseStructureId, stitchAt } from "./knitPatternGenerator";

export type KnitLoop = { id: string; column: number; row: number; stitch: string };
export type KnitEdge = { id: string; from: string; to: string; kind: "stitch" | "yarn" };
export type ConductivePath = { netId: string; name: string; nodeIds: string[]; edges: Array<[string, string]>; connected: boolean };
export type CourseOperation = { column: number; row: number; stitch: string; conductiveNets: string[] };
export type CoursePlan = { row: number; direction: "right" | "left"; operations: CourseOperation[] };
export type KnitGraphModel = {
  columns: number;
  rows: number;
  loops: KnitLoop[];
  edges: KnitEdge[];
  conductivePaths: ConductivePath[];
  warnings: string[];
  structure: string;
  legacyRoutePreview?: boolean;
};

const loopId = (column: number, row: number) => `L:${column}:${row}`;

function cellsOnSegment(a: Point, b: Point): Point[] {
  let x = Math.round(a.column), y = Math.round(a.row);
  const x1 = Math.round(b.column), y1 = Math.round(b.row);
  const dx = Math.abs(x1 - x), sx = x < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y), sy = y < y1 ? 1 : -1;
  let error = dx + dy;
  const cells: Point[] = [];
  while (true) {
    cells.push({ column: x, row: y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x += sx; }
    if (e2 <= dx) { error += dx; y += sy; }
  }
  return cells;
}

function routeNodes(trace: CircuitElement, columns: number, rows: number): string[] {
  const nodes: string[] = [];
  for (let i = 1; i < trace.points.length; i++) {
    for (const cell of cellsOnSegment(trace.points[i - 1], trace.points[i])) {
      const column = Math.max(0, Math.min(columns - 1, cell.column));
      const row = Math.max(0, Math.min(rows - 1, cell.row));
      const id = loopId(column, row);
      if (nodes.at(-1) !== id) nodes.push(id);
    }
  }
  return nodes;
}

function edgeConnected(edges: Array<[string, string]>, nodeIds: string[]): boolean {
  if (!nodeIds.length || !edges.length) return false;
  const adjacent = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    if (!adjacent.has(b)) adjacent.set(b, new Set());
    adjacent.get(a)!.add(b); adjacent.get(b)!.add(a);
  }
  const visited = new Set<string>(), queue = [nodeIds[0]];
  while (queue.length) {
    const node = queue.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adjacent.get(node) ?? []) if (!visited.has(next)) queue.push(next);
  }
  return nodeIds.every(id => visited.has(id));
}

/** Build a stitch-level topology preview inspired by Knit Graph's loop/yarn/stitch model.
 * It is a topology visualization, not a machine compiler or electrical simulation. */
export function buildKnitGraph(project: Project): KnitGraphModel {
  const { columns, rows } = grid(project.garment);
  const structureId = resolveBaseStructureId(project.knitStructureId, project.structure) ?? "jersey";
  if (columns * rows > 100_000) return { columns, rows, loops: [], edges: [], conductivePaths: [], warnings: ["Graph preview is limited to 100,000 loops. Reduce garment dimensions or increase stitch gauge."], structure: structureId };
  const loops: KnitLoop[] = [];
  const edges: KnitEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (a: string, b: string, kind: KnitEdge["kind"]) => {
    if (a === b) return;
    const key = `${kind}:${a < b ? a + ">" + b : b + ">" + a}`;
    if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push({ id: key, from: a, to: b, kind }); }
  };

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      loops.push({ id: loopId(column, row), column, row, stitch: stitchAt(structureId, column, row) });
      if (row > 0) addEdge(loopId(column, row - 1), loopId(column, row), "stitch");
      if (column > 0) addEdge(loopId(column - 1, row), loopId(column, row), "yarn");
    }
  }

  const circuit = project.circuit;
  const nets: CircuitNet[] = [...(circuit?.nets ?? [])];
  const tracesByNet = new Map<string, CircuitElement[]>();
  let legacyRoutePreview = false;
  for (const trace of circuit?.elements.filter(element => element.kind === "trace") ?? []) {
    let netId = trace.netId;
    if (!netId && trace.sensorTemplateVersion === 3) {
      const side = trace.name.match(/(?:Contact|Lead) ([AB])$/)?.[1];
      if (side) {
        legacyRoutePreview = true;
        netId = `legacy:${trace.sensorId ?? trace.channel}:${side}`;
        if (!nets.some(net => net.id === netId)) nets.push({ id: netId, name: `${trace.channel || "Sensor"} · ${side} (legacy route)`, notes: "Preview grouped by the existing sensor template labels; not stored as an explicit net." });
      }
    }
    if (netId) {
      const list = tracesByNet.get(netId) ?? [];
      list.push(trace); tracesByNet.set(netId, list);
    }
  }
  const conductivePaths = nets.map(net => {
    const traces = tracesByNet.get(net.id) ?? [];
    const nodeIds = new Set<string>(), pathEdges: Array<[string, string]> = [];
    for (const trace of traces) {
      const route = routeNodes(trace, columns, rows);
      for (const id of route) nodeIds.add(id);
      for (let i = 1; i < route.length; i++) pathEdges.push([route[i - 1], route[i]]);
    }
    const nodes = [...nodeIds];
    return { netId: net.id, name: net.name, nodeIds: nodes, edges: pathEdges, connected: edgeConnected(pathEdges, nodes) };
  });

  const warnings: string[] = [];
  for (const net of nets) {
    const traces = tracesByNet.get(net.id) ?? [];
    if (!traces.length) warnings.push(`${net.name}: no conductive-yarn route is assigned.`);
    else if (!conductivePaths.find(path => path.netId === net.id)!.connected) warnings.push(`${net.name}: route is not one continuous path across stitch nodes.`);
  }
  const shared = new Map<string, string[]>();
  for (const path of conductivePaths) for (const id of new Set(path.nodeIds)) {
    const owners = shared.get(id) ?? []; owners.push(path.name); shared.set(id, owners);
  }
  for (const [id, owners] of shared) if (new Set(owners).size > 1) warnings.push(`Separate nets share stitch ${id}; possible unintended conductive contact.`);

  return { columns, rows, loops, edges, conductivePaths, warnings, structure: structureId, legacyRoutePreview };
}

/** Order graph loops into course-wise carriage passes. This is an abstract
 * operation schedule; cast-on, bind-off, carrier choreography and machine
 * legality are intentionally left to a selected machine backend. */
export function buildCoursePlan(graph: KnitGraphModel): CoursePlan[] {
  if (!graph.loops.length) return [];
  const loopsByRow = Array.from({ length: graph.rows }, () => [] as KnitLoop[]);
  for (const loop of graph.loops) loopsByRow[loop.row]?.push(loop);
  const conductiveAt = new Map<string, string[]>();
  for (const path of graph.conductivePaths) for (const id of path.nodeIds) {
    const nets = conductiveAt.get(id) ?? [];
    if (!nets.includes(path.name)) nets.push(path.name);
    conductiveAt.set(id, nets);
  }
  return loopsByRow.map((loops, row) => {
    const direction = row % 2 === 0 ? "right" : "left";
    const ordered = [...loops].sort((a, b) => direction === "right" ? a.column - b.column : b.column - a.column);
    return { row, direction, operations: ordered.map(loop => ({ column: loop.column, row, stitch: loop.stitch, conductiveNets: conductiveAt.get(loop.id) ?? [] })) };
  });
}

export function summarizeCoursePlan(plan: CoursePlan[]) {
  const counts = new Map<string, number>();
  for (const course of plan) for (const operation of course.operations)
    counts.set(operation.stitch, (counts.get(operation.stitch) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([stitch, count]) => ({ stitch, count }));
}
