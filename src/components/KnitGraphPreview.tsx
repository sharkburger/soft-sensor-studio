import { useEffect, useMemo, useRef } from "react";
import type { Project } from "../models/project";
import { buildCoursePlan, buildKnitGraph, summarizeCoursePlan } from "../services/knitGraph";

const colors = ["#c06448", "#327b7c", "#6a6597", "#b18127", "#527554"];

export function KnitGraphPreview({ project }: { project: Project }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const graph = useMemo(() => buildKnitGraph(project), [project]);
  const coursePlan = useMemo(() => buildCoursePlan(graph), [graph]);
  const operationCounts = useMemo(() => summarizeCoursePlan(coursePlan), [coursePlan]);
  const exportPythonHandoff = () => {
    const payload = {
      format: "soft-sensor-studio-knit-handoff-v1",
      targetMachineFamily: "Shima Seiki SWG / WHOLEGARMENT",
      generatedAt: new Date().toISOString(),
      project,
      graph,
      coursePlan,
      notes: [
        "Intermediate design handoff only; not a KnitScript program, Knitout file, or Shima Seiki DAT file.",
        "The Python adapter must map graph operations, gauge, needle beds, and yarn carriers to the selected SWG model.",
        "Conductive paths are design intent and have not been validated for yarn inlay or electrical continuity.",
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9-_]/gi, "_")}-shima-swg-handoff.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { columns, rows } = graph, pad = 24;
    const loopById = new Map(graph.loops.map(loop => [loop.id, loop]));
    const cell = Math.min((canvas.width - pad * 2) / columns, (canvas.height - pad * 2) / rows);
    const left = (canvas.width - cell * columns) / 2;
    const top = (canvas.height - cell * rows) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fbfaf6"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wale/stitch relationships and yarn continuity in the base Jersey swatch.
    ctx.lineWidth = Math.max(.45, cell * .12);
    ctx.strokeStyle = "#c9c8bd";
    ctx.beginPath();
    for (const edge of graph.edges) {
      if (edge.kind !== "stitch") continue;
      const a = loopById.get(edge.from)!;
      const b = loopById.get(edge.to)!;
      ctx.moveTo(left + (a.column + .5) * cell, top + (rows - a.row - .5) * cell);
      ctx.lineTo(left + (b.column + .5) * cell, top + (rows - b.row - .5) * cell);
    }
    ctx.stroke();
    ctx.strokeStyle = "#968f7f";
    ctx.beginPath();
    for (const edge of graph.edges) {
      if (edge.kind !== "yarn") continue;
      const a = loopById.get(edge.from)!;
      const b = loopById.get(edge.to)!;
      ctx.moveTo(left + (a.column + .5) * cell, top + (rows - a.row - .5) * cell);
      ctx.lineTo(left + (b.column + .5) * cell, top + (rows - b.row - .5) * cell);
    }
    ctx.stroke();

    // Show the sensor footprint; the resistor itself is not a conductive trace.
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "#b66547";
    for (const sensor of project.sensors) {
      ctx.strokeRect(left + sensor.column * cell, top + (rows - sensor.row - sensor.height) * cell, sensor.width * cell, sensor.height * cell);
    }
    ctx.setLineDash([]);

    graph.conductivePaths.forEach((path, index) => {
      const color = colors[index % colors.length];
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1.6, cell * .48);
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      for (const [from, to] of path.edges) {
        const [, ac, ar] = from.split(":").map(Number), [, bc, br] = to.split(":").map(Number);
        ctx.moveTo(left + (ac + .5) * cell, top + (rows - ar - .5) * cell);
        ctx.lineTo(left + (bc + .5) * cell, top + (rows - br - .5) * cell);
      }
      ctx.stroke();
      for (const id of path.nodeIds) {
        const [, column, row] = id.split(":").map(Number);
        ctx.beginPath(); ctx.arc(left + (column + .5) * cell, top + (rows - row - .5) * cell, Math.max(1.5, cell * .3), 0, Math.PI * 2); ctx.fill();
      }
    });
  }, [graph, project.sensors]);

  return <details className="knit-graph-preview">
    <summary><span>Knit Graph · loop topology</span><small>{graph.loops.length.toLocaleString()} loops</small></summary>
    <div className="knit-graph-content"><p className="hint">Loop-level preview following the <a href="https://mhofmann-khoury.github.io/knit_graph/" target="_blank" rel="noreferrer">Knit Graph representation</a>. Dotted outline = sensor region; colored loops = assigned conductive-yarn route. Structure: {graph.structure}.</p>
    {graph.legacyRoutePreview && <p className="hint">Existing template routes are grouped by their A/B labels for preview; this does not add or infer saved electrical connections.</p>}
    <canvas ref={ref} width={720} height={480} aria-label={`Knit graph with ${graph.loops.length} stitch loops and ${graph.conductivePaths.length} conductive yarn paths`} />
    <div className="knit-graph-stats"><span>{graph.loops.length.toLocaleString()} loop nodes</span><span>{graph.edges.filter(edge => edge.kind === "stitch").length.toLocaleString()} stitch links</span><span>{graph.conductivePaths.length} conductive nets</span></div>
    {graph.conductivePaths.map((path, index) => <p className="knit-graph-net" key={path.netId}><i style={{ background: colors[index % colors.length] }} />{path.name}<strong>{path.connected ? "Topology connected" : "Topology disconnected"}</strong></p>)}
    {graph.warnings.length > 0 && <ul className="knit-graph-warnings">{graph.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    <details className="knit-course-plan"><summary>Course-by-course knitting plan · abstract</summary>
      <p className="hint">Loops are ordered into alternating carriage passes. This is not machine code: cast-on/bind-off, carrier changes, yarn inlay and machine-specific legality are not generated yet.</p>
      <div className="knit-graph-stats"><span>{coursePlan.length} courses</span><span>{coursePlan.reduce((n, course) => n + course.operations.length, 0).toLocaleString()} stitch operations</span><span>Serpentine pass order</span></div>
      <div className="knit-course-ops">{operationCounts.map(item => <span key={item.stitch}><b>{item.stitch}</b> {item.count.toLocaleString()}</span>)}</div>
      <ol>{coursePlan.slice(0, 8).map(course => <li key={course.row}>Course {course.row + 1} · {course.direction} · {course.operations.length} stitches · {course.operations.filter(operation => operation.conductiveNets.length).length} conductive route stitches</li>)}</ol>
      {coursePlan.length > 8 && <p className="hint">Showing first 8 of {coursePlan.length} courses.</p>}
      <p className="knit-machine-blocked"><strong>Machine verification pending.</strong> Select the knitting machine and define its beds, carriers, gauge and supported operations before treating this route as knittable.</p>
      <div className="knit-machine-export">
        <button type="button" onClick={exportPythonHandoff}>Export Python handoff · JSON</button>
        <a href="https://github.com/mhofmann-Khoury/knit_script" target="_blank" rel="noreferrer">KnitScript compiler ↗</a>
        <a href="https://github.com/mhofmann-Khoury/knitout_to_dat_python" target="_blank" rel="noreferrer">SWG Knitout → DAT converter ↗</a>
        <a href="https://www.shimaseiki.com/product/knit/swg_n2/" target="_blank" rel="noreferrer">SHIMA SEIKI SWG machine ↗</a>
        <small>The JSON is a project handoff for a future Python adapter. It cannot be loaded by the knitting machine as-is.</small>
      </div>
    </details>
    <p className="hint">This is a graph-topology preview, not machine instruction output. Actual knittability still depends on machine, gauge, carriers, yarn and fabrication checks.</p>
    </div>
  </details>;
}
