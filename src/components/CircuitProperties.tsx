import { useStudio } from "../stores/studio";
import { kindLabel } from "../models/circuit";
import { circuitLibrary } from "../data/softCircuitLibrary";
import { updateCircuitElement } from "../services/circuit";
import { NumberField } from "./Properties";
export function CircuitProperties() {
  const { project: p, selected, commit, remove, duplicate, patchSensor } = useStudio(),
    e = p.circuit?.elements.find((e) => e.id === selected);
  if (!e) return null;
  const patch = (v: Partial<typeof e>) => {
    if (e.kind === "sensing-region" && e.sensorId) {
      const sensor = p.sensors.find((item) => item.id === e.sensorId);
      if (sensor) {
        patchSensor(sensor.id, {
          ...(v.name !== undefined ? { name: v.name.replace(" · Sensing element", "") } : {}),
          ...(v.column !== undefined ? { column: v.column } : {}),
          ...(v.row !== undefined ? { row: v.row } : {}),
          ...(v.width !== undefined ? { width: v.width } : {}),
          ...(v.height !== undefined ? { height: v.height } : {}),
          ...(v.materialId !== undefined ? { materialId: v.materialId } : {}),
          ...(v.textileLayer !== undefined ? { textileLayer: v.textileLayer } : {}),
          ...(v.knitStructureId !== undefined ? { knitStructureId: v.knitStructureId } : {}),
        });
        return;
      }
    }
    commit(updateCircuitElement(p, e.id, v));
  };
  const targets = [
    ...p.sensors,
    ...p.circuit!.elements.filter(
      (n) => n.kind !== "trace" && n.kind !== "insulation" && n.id !== e.id,
    ),
  ];
  return (
    <aside className="properties">
      <div className="panel-title">Circuit properties</div>
      <div className="property-body">
        <div className="eyebrow">{kindLabel[e.kind]}</div>
        <label className="field">
          Object name
          <input
            maxLength={2000}
            value={e.name}
            onChange={(v) => patch({ name: v.target.value })}
          />
        </label>
        <label className="field">
          Circuit material
          <select
            value={e.materialId}
            onChange={(v) => patch({ materialId: v.target.value })}
          >
            <option value="">Unassigned</option>
            {e.materialId &&
              !circuitLibrary.some((m) => m.id === e.materialId) &&
              !p.materials.some((m) => m.id === e.materialId) && (
                <option value={e.materialId}>
                  Unavailable profile: {e.materialId}
                </option>
              )}
            {circuitLibrary.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            {p.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (project yarn)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Circuit channel
          <input
            maxLength={2000}
            value={e.channel}
            placeholder="e.g. CH-01"
            onChange={(v) => patch({ channel: v.target.value })}
          />
        </label>
        <label className="field">
          Textile layer
          <select
            value={e.textileLayer ?? (e.kind === "trace" || e.kind === "insulation" ? "integrated" : "surface")}
            onChange={(v) => patch({ textileLayer: v.target.value as "surface" | "integrated" | "inner" })}
          >
            <option value="surface">Surface</option>
            <option value="integrated">Integrated in fabric</option>
            <option value="inner">Inner face</option>
          </select>
        </label>
        {e.kind === "trace" ? (
          <>
            <NumberField
              label="Trace width"
              value={e.width}
              suffix="stitches"
              onChange={(width) => patch({ width: Math.round(width) })}
            />
            <h3>Trace vertices</h3>
            {e.points.map((q, i) => (
              <div className="field-pair" key={i}>
                <NumberField
                  label={`Vertex ${i + 1} column`}
                  min={-100000}
                  max={100000}
                  value={q.column}
                  onChange={(column) =>
                    patch({
                      points: e.points.map((v, j) =>
                        i === j ? { ...v, column: Math.round(column) } : v,
                      ),
                    })
                  }
                />
                <NumberField
                  label={`Vertex ${i + 1} row`}
                  min={-100000}
                  max={100000}
                  value={q.row}
                  onChange={(row) =>
                    patch({
                      points: e.points.map((v, j) =>
                        i === j ? { ...v, row: Math.round(row) } : v,
                      ),
                    })
                  }
                />
              </div>
            ))}
            {(["fromId", "toId"] as const).map((key, i) => (
              <label className="field" key={key}>
                {i ? "End connection" : "Start connection"}
                <select
                  value={e[key] ?? ""}
                  onChange={(v) =>
                    patch({ [key]: v.target.value || undefined })
                  }
                >
                  <option value="">Unassigned</option>
                  {e[key] && !targets.some((t) => t.id === e[key]) && (
                    <option value={e[key]}>Missing object</option>
                  )}
                  {targets.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {n.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p className="hint">
              Connections are explicit design intentions. Landing on a pad or
              crossing a trace does not establish electrical continuity.
            </p>
          </>
        ) : (
          <>
            <NumberField
              label="Circuit column"
              min={-100000}
              max={100000}
              value={e.column}
              onChange={(column) => patch({ column: Math.round(column) })}
            />
            <NumberField
              label="Circuit row"
              min={-100000}
              max={100000}
              value={e.row}
              onChange={(row) => patch({ row: Math.round(row) })}
            />
            <NumberField
              label="Circuit width"
              value={e.width}
              suffix="stitches"
              onChange={(width) => patch({ width: Math.round(width) })}
            />
            <NumberField
              label="Circuit height"
              value={e.height}
              suffix="courses"
              onChange={(height) => patch({ height: Math.round(height) })}
            />
          </>
        )}
        <label className="field">
          Circuit notes
          <textarea
            maxLength={2000}
            value={e.notes}
            onChange={(v) => patch({ notes: v.target.value })}
          />
        </label>
        <div className="field-pair">
          <button onClick={duplicate}>Duplicate object</button>
          <button onClick={remove}>Delete object</button>
        </div>
      </div>
    </aside>
  );
}
