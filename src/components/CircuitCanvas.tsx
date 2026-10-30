import { Group, Line, Rect, Circle, Text } from "react-konva";
import { useStudio } from "../stores/studio";
import { useCircuitUI, elementLayer } from "../stores/circuitUI";
import { circuitColors } from "../models/circuit";
import { updateCircuitElement, translateElement, translateBatteryAssembly } from "../services/circuit";
export function CircuitCanvas({
  scale,
  rows,
  pan,
}: {
  scale: number;
  rows: number;
  pan: boolean;
}) {
  const { project: p, selected, select, commit, patchSensor } = useStudio(),
    ui = useCircuitUI();
  const editable = ui.enabled && ui.tool === "select" && !pan;
  return (
    <Group>
      {(p.circuit?.elements ?? [])
        .filter((e) => ui.layers[elementLayer(e.kind)])
        .map((e) => {
          const layer = e.textileLayer ?? (e.kind === "trace" || e.kind === "insulation" ? "integrated" : "surface");
          const active = layer === ui.activeLayer;
          const suffix = e.name.split(" · ").at(-1) ?? e.name;
          const label = e.kind === "trace" || e.kind === "insulation"
            ? selected === e.id ? suffix : ""
            : e.kind === "terminal"
              ? suffix.replace("Readout ", "R-")
              : e.kind === "electrode"
                ? suffix.replace("Pin ", "")
                : e.kind === "sensing-region" && e.sensorId
                  ? e.name.split(" · ")[0]
                  : e.name;
          return (
          <Group
            key={e.id}
            listening={!ui.enabled || ui.tool === "select"}
            draggable={editable && active}
            opacity={active ? 1 : 0.28}
            onClick={(v) => {
              v.cancelBubble = true;
              select(e.id);
            }}
            onTap={(v) => {
              v.cancelBubble = true;
              select(e.id);
            }}
            onDragStart={() => select(e.id)}
            onDragEnd={(v) => {
              if (v.target !== v.currentTarget) return;
              const dx = Math.round(v.target.x() / scale),
                dy = -Math.round(v.target.y() / scale);
              v.target.position({ x: 0, y: 0 });
              if (e.kind === "sensing-region" && e.sensorId) {
                const sensor = p.sensors.find((item) => item.id === e.sensorId);
                if (sensor) {
                  patchSensor(sensor.id, {
                    column: sensor.column + dx,
                    row: sensor.row + dy,
                  });
                  return;
                }
              }
              if (e.kind === "battery") {
                commit(translateBatteryAssembly(p, e.id, dx, dy));
                return;
              }
              commit(
                updateCircuitElement(p, e.id, translateElement(e, dx, dy)),
              );
            }}
          >
            {e.kind === "trace" ? (
              <Line
                points={e.points.flatMap((q) => [
                  q.column * scale,
                  (rows - q.row) * scale,
                ])}
                stroke={e.textileLayer === "inner" ? "#6b64a6" : e.textileLayer === "surface" ? "#b58a25" : circuitColors.trace}
                strokeWidth={Math.max(2, e.width * scale)}
                hitStrokeWidth={Math.max(12, e.width * scale)}
                lineCap="round"
                lineJoin="round"
                shadowColor="#263f36"
                shadowBlur={selected === e.id ? 5 : 0}
              />
            ) : (
              <Rect
                x={e.column * scale}
                y={(rows - e.row - e.height) * scale}
                width={e.width * scale}
                height={e.height * scale}
                fill={circuitColors[e.kind]}
                opacity={e.kind === "insulation" ? 0.3 : 0.8}
                stroke={selected === e.id ? "#213d33" : circuitColors[e.kind]}
                strokeWidth={selected === e.id ? 2 : 1}
                dash={e.kind === "insulation" ? [5, 3] : undefined}
                cornerRadius={e.kind === "terminal" ? 2 : 0}
              />
            )}
            {e.kind === "battery" && (
              <>
                <Rect
                  listening={false}
                  x={(e.column + 1) * scale}
                  y={(rows - e.row - e.height + 1) * scale}
                  width={Math.max(1, (e.width - 2) * scale)}
                  height={Math.max(1, (e.height - 2) * scale)}
                  stroke="#e9eee6"
                  strokeWidth={1}
                  cornerRadius={2}
                />
                <Text listening={false} x={(e.column + 3) * scale} y={(rows - e.row - 5) * scale} text="CELL" fontSize={Math.max(7, Math.min(10, 8 * scale))} fill="#f4f4eb" />
              </>
            )}
            <Text
              listening={false}
              x={(e.kind === "trace" ? e.points[0].column : e.column) * scale}
              y={
                (rows -
                  (e.kind === "trace" ? e.points[0].row : e.row + e.height)) *
                  scale -
                13
              }
              text={label}
              fontSize={9}
              fill="#394b3e"
            />
            {selected === e.id &&
              e.kind === "trace" &&
              editable &&
              e.points.map((q, i) => (
                <Circle
                  key={i}
                  x={q.column * scale}
                  y={(rows - q.row) * scale}
                  radius={5}
                  fill="#fff"
                  stroke="#805b13"
                  strokeWidth={2}
                  draggable
                  onMouseDown={(v) => {
                    v.cancelBubble = true;
                  }}
                  onDragStart={(v) => {
                    v.cancelBubble = true;
                  }}
                  onDragEnd={(v) => {
                    v.cancelBubble = true;
                    const point = {
                      column: Math.round(v.target.x() / scale),
                      row: Math.round(rows - v.target.y() / scale),
                    };
                    commit(
                      updateCircuitElement(p, e.id, {
                        points: e.points.map((a, j) => (i === j ? point : a)),
                      }),
                    );
                  }}
                />
              ))}
          </Group>
        );})}
      {ui.enabled && ui.draft.length > 0 && (
        <Group listening={false}>
          <Line
            points={ui.draft.flatMap((q) => [
              q.column * scale,
              (rows - q.row) * scale,
            ])}
            stroke="#c29325"
            strokeWidth={2}
            dash={[5, 3]}
          />
          {ui.draft.map((q, i) => (
            <Circle
              key={i}
              x={q.column * scale}
              y={(rows - q.row) * scale}
              radius={3}
              fill="#b58a25"
            />
          ))}
        </Group>
      )}
    </Group>
  );
}
