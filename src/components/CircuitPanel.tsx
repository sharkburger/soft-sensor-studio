import { useState } from "react";
import { useStudio } from "../stores/studio";
import { useCircuitUI } from "../stores/circuitUI";
import {
  circuitKinds,
  kindLabel,
  emptyCircuit,
  circuitColors,
  type TextileLayer,
} from "../models/circuit";
import { circuitLibrary } from "../data/softCircuitLibrary";
import {
  applySensorCircuitTemplate,
  finishTrace,
  designSummary,
} from "../services/circuit";
import { KnitGraphPreview } from "./KnitGraphPreview";
export function CircuitPanel() {
  const { project: p, commit, select, selected } = useStudio(),
    ui = useCircuitUI(),
    c = p.circuit ?? emptyCircuit(p.garment.joint);
  const selectedSensor = p.sensors.find((sensor) => sensor.id === selected);
  const sensorHasCircuit = selectedSensor && c.elements.some((element) => element.sensorId === selectedSensor.id);
  const [category, setCategory] = useState("All"),
    [summary, setSummary] = useState(false);
  const update = (patch: Partial<typeof c>) =>
    commit({ ...p, circuit: { ...c, ...patch } });
  const selectedElement = c.elements.find((element) => element.id === selected);
  const activeLayers: TextileLayer[] = p.layerMode === "double"
    ? ["surface", "inner", "integrated"]
    : ["surface", "integrated"];
  const useProfile = (profile: (typeof circuitLibrary)[number]) => {
    if (selectedElement && selectedElement.kind === profile.kind) {
      commit({
        ...p,
        circuit: {
          ...c,
          elements: c.elements.map((element) =>
            element.id === selectedElement.id
              ? { ...element, materialId: profile.id }
              : element,
          ),
        },
      });
      ui.set({ enabled: true, tool: "select", materialId: profile.id, draft: [] });
      return;
    }
    ui.set({
      enabled: true,
      tool: profile.kind ?? "select",
      materialId: profile.id,
      draft: [],
    });
  };
  const download = () => {
    const url = URL.createObjectURL(
        new Blob([designSummary(p)], { type: "text/plain" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "soft-sensor-design-brief.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <details className="circuit-group" open>
      <summary>Board setup <small>{p.layerMode === "double" ? "Double layer" : "Single layer"}</small></summary>
      <section className="board-setup">
        <h3>Textile stack</h3>
        <div className="joint-select">
          {(["single", "double"] as const).map((mode) => (
            <button
              key={mode}
              className={(p.layerMode ?? "single") === mode ? "active" : ""}
              onClick={() => {
                commit({ ...p, layerMode: mode });
                if (mode === "single") ui.set({ activeLayer: "surface" });
              }}
            >
              {mode === "single" ? "Single layer" : "Double layer"}
            </button>
          ))}
        </div>
        <p className="hint">Choose the garment stack, then select the board layer for placement and routing.</p>
        <h3>Board layers</h3>
        <div className="layer-tabs" role="group" aria-label="Active textile layer">
          {activeLayers.map((layer) => (
            <button
              key={layer}
              className={ui.activeLayer === layer ? "active" : ""}
              onClick={() => ui.set({ activeLayer: layer })}
            >
              {layer === "surface" ? "Surface" : layer === "inner" ? "Inner face" : "Integrated"}
            </button>
          ))}
        </div>
      </section>
      </details>
      <details className="circuit-group">
      <summary>Sensing intent</summary>
      <section>
        <p className="hint">
          Co-design a concept, then review it with fabrication and electronics
          specialists.
        </p>
        <label className="field">
          Body location
          <select
            value={c.intent.bodyLocation}
            onChange={(e) =>
              update({ intent: { ...c.intent, bodyLocation: e.target.value } })
            }
          >
            {["Knee", "Elbow", "Wrist", "Other"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Desired measurement
          <select
            value={c.intent.measurement}
            onChange={(e) =>
              update({ intent: { ...c.intent, measurement: e.target.value } })
            }
          >
            {["Joint movement", "Pressure", "Touch", "Other"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Clinical / research goal
          <textarea
            maxLength={2000}
            value={c.intent.goal}
            placeholder="Describe the movement, contact or task to explore"
            onChange={(e) =>
              update({ intent: { ...c.intent, goal: e.target.value } })
            }
          />
        </label>
        <p className="hint">
          Intent labels do not change garment dimensions or predict
          measurements. Use Design to set sleeve dimensions.
        </p>
        <button
          disabled={!selectedSensor || !!sensorHasCircuit || c.elements.length > 190}
          onClick={() => {
            if (!selectedSensor) return;
            const next = applySensorCircuitTemplate(p, selectedSensor);
            commit(next);
            select(next.circuit?.elements.at(-1)?.id ?? null);
            ui.set({ enabled: true, tool: "select", draft: [] });
          }}
        >
          Add pins and traces to selected sensor
        </button>
        <p className="hint">
          Creates two contact pins, two readout terminals and assigned lead
          traces for the selected sensor. External readout electronics and
          electrical behavior are not modeled.
        </p>
      </section>
      </details>
      <details className="circuit-group" open>
      <summary>Circuit tools <small>{ui.tool === "select" ? "Select / move" : kindLabel[ui.tool]}</small></summary>
      <section>
        <label>
          <input
            type="checkbox"
            checked={ui.enabled}
            onChange={(e) =>
              ui.set({ enabled: e.target.checked, draft: [], tool: "select" })
            }
          />{" "}
          Circuit editing mode
        </label>
        <div className="circuit-tools">
          {(["select", ...circuitKinds] as const).map((k) => (
            <button
              key={k}
              className={ui.tool === k ? "active" : ""}
              onClick={() =>
                ui.set({
                  enabled: true,
                  tool: k,
                  draft: [],
                  materialId: {
                    trace: "c-yarn",
                    battery: "battery-pack",
                    electrode: "c-fabric",
                    terminal: "connector",
                    insulation: "dielectric",
                    "sensing-region": "resistive",
                    select: ui.materialId,
                  }[k],
                })
              }
            >
              {k === "select" ? "Select / move" : kindLabel[k]}
            </button>
          ))}
        </div>
        <p className="hint">
          Click the grid to place an object. For traces, click successive
          vertices, then Finish trace. Select to move an object; edit vertices
          in Properties. Drag a Sensor's sensing region to move its complete
          block with pins, readout terminals and assigned leads. Route endpoints
          near a pad or terminal snap to it and receive an explicit link when
          they share a textile layer. Escape cancels drawing.
        </p>
        {ui.tool === "trace" && (
          <div className="circuit-tools">
            <button
              disabled={ui.draft.length < 2}
              onClick={() => {
                const next = finishTrace(p, ui.draft, ui.materialId, ui.activeLayer);
                commit(next);
                select(next.circuit?.elements.at(-1)?.id ?? null);
                ui.set({ draft: [], tool: "select" });
              }}
            >
              Finish trace ({ui.draft.length})
            </button>
            <button onClick={() => ui.set({ draft: [] })}>Cancel trace</button>
          </div>
        )}
        <label className="field">
          Drawing material
          <select
            value={ui.materialId}
            onChange={(e) => ui.set({ materialId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {circuitLibrary.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      </details>
      <details className="circuit-group">
      <summary>Logical nets <small>{(c.nets ?? []).length}</small></summary>
      <section>
        <p className="hint">Connections are now stored as named design intent, separately from the drawn geometry.</p>
        {(c.nets ?? []).length === 0 ? <p className="hint">No explicit nets yet. Add or recreate a sensor template to create its A/B nets.</p> : (c.nets ?? []).map((net) => {
          const pins = (c.pins ?? []).filter((pin) => pin.netId === net.id);
          return <div className="measurement" key={net.id}><span>{net.name}</span><strong>{pins.length} pins · {pins.map((pin) => `${c.elements.find((element) => element.id === pin.elementId)?.name ?? "?"} (${pin.name})`).join(" · ")}</strong></div>;
        })}
      </section>
      </details>
      <KnitGraphPreview project={p} />
      <details className="circuit-group">
      <summary>Visual layers</summary>
      <section>
        {Object.entries(ui.layers).map(([key, on]) => (
          <label className="circuit-layer" key={key}>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) =>
                ui.set({ layers: { ...ui.layers, [key]: e.target.checked } })
              }
            />
            {
              (
                {
                  textile: "Textile structure",
                  sensing: "Sensing areas",
                  routing: "Conductive routing",
                  contacts: "Connection points",
                  insulation: "Insulation regions",
                } as Record<string, string>
              )[key]
            }
          </label>
        ))}
        <p className="hint">
          Visibility affects 2D and 3D views, not connection checks.
        </p>
      </section>
      </details>
      <details className="circuit-group">
      <summary>Soft Circuit Library</summary>
      <section>
        <p className="hint">
          Select a matching circuit object to link a profile directly. With no
          matching object selected, it becomes the default for your next draw.
          Profiles are generic and unmeasured, with no vendor, medical or
          fabrication certification.
        </p>
        <label className="field">
          Library category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["All", ...new Set(circuitLibrary.map((m) => m.category))].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
        {circuitLibrary
          .filter((m) => category === "All" || m.category === category)
          .map((m) => (
            <article className="circuit-profile" key={m.id}>
              <strong>{m.name}</strong>
              <p>{m.description}</p>
              <p className="hint">{m.consideration}</p>
              <button
                className={
                  selectedElement && selectedElement.kind === m.kind &&
                  selectedElement.materialId === m.id
                    ? "active"
                    : ""
                }
                aria-pressed={
                  selectedElement && selectedElement.kind === m.kind
                    ? selectedElement.materialId === m.id
                    : ui.materialId === m.id
                }
                onClick={() => useProfile(m)}
              >
                {selectedElement && selectedElement.kind === m.kind
                  ? selectedElement.materialId === m.id
                    ? "Linked to selected object"
                    : "Link to selected object"
                  : ui.materialId === m.id
                    ? "Selected for next draw"
                    : "Use for next draw"}
              </button>
            </article>
          ))}
      </section>
      </details>
      <details className="circuit-group">
      <summary>Circuit objects <small>{c.elements.length}</small></summary>
      <section>
        <p className="hint">
          Legacy sensing areas remain in Design and are available as connection
          targets.
        </p>
        {c.elements.map((e) => (
          <button
            className={"circuit-object " + (selected === e.id ? "active" : "")}
            key={e.id}
            onClick={() => {
              select(e.id);
              ui.set({ enabled: true, tool: "select", draft: [] });
            }}
          >
            <span style={{ color: circuitColors[e.kind] }}>●</span>
            {e.name}
            <small>{kindLabel[e.kind]}</small>
          </button>
        ))}
        {!c.elements.length && (
          <p className="hint">
            No circuit objects yet. Add a concept layout or choose a drawing
            tool.
          </p>
        )}
      </section>
      </details>
      <details className="circuit-group">
      <summary>Design brief</summary>
      <section>
        <label className="field">
          Fabrication assumptions
          <textarea
            maxLength={10000}
            value={c.assumptions}
            onChange={(e) => update({ assumptions: e.target.value })}
          />
        </label>
        <label className="field">
          Unresolved validation
          <textarea
            maxLength={10000}
            value={c.validationNotes}
            onChange={(e) => update({ validationNotes: e.target.value })}
          />
        </label>
        <button onClick={() => setSummary(!summary)}>
          {summary ? "Hide" : "Show"} design summary
        </button>
        <button onClick={download}>Download design brief</button>
        {summary && <pre className="circuit-summary">{designSummary(p)}</pre>}
        <p className="hint">
          Schematic geometry only. No electrical, physical or clinical
          simulation. No Kniterate / fabrication export.
        </p>
      </section>
      </details>
    </>
  );
}
