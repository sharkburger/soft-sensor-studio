import { sampleProject, type Project } from '../models/project';
import { applySensorCircuitTemplate, syncSensorCircuit } from './circuit';

/** Prepare new, restored and imported projects before the editor renders them. */
export function prepareStudioProject(project: Project): Project {
  let next = project;
  for (const [index, original] of project.sensors.entries()) {
    const elements = next.circuit?.elements.filter(e => e.sensorId === original.id) ?? [];
    // Older defaults can contain just the fabric region and isolation layer.
    // Their presence alone does not mean the sensor has contacts or lead routes.
    const bare = elements.every(e => e.kind === 'sensing-region' || e.kind === 'insulation');
    const outdated = elements.some(e => e.sensorTemplateVersion !== 3);
    const channel = Number(original.channel.match(/\d+/)?.[0] ?? index + 1);
    const sensor = original.textileLayer ? original : {
      ...original,
      textileLayer: project.layerMode === 'double' && channel % 2 === 0
        ? 'inner' as const : 'surface' as const,
    };
    if (bare) {
      const oldIds = new Set(elements.map(e => e.id));
      const candidate = next.circuit ? { ...next, circuit: {
        ...next.circuit,
        elements: next.circuit.elements.filter(e => !oldIds.has(e.id)),
        pins: next.circuit.pins.filter(pin => !oldIds.has(pin.elementId)),
      } } : next;
      const linked = applySensorCircuitTemplate(candidate, sensor);
      // Do not remove existing data if this garment cannot fit the template.
      if (linked === candidate) continue;
      // Reuse legacy region IDs so external connections and selections survive.
      const replacements = new Map(linked.circuit!.elements
        .filter(e => e.sensorId === sensor.id)
        .flatMap(e => {
          const old = elements.find(item => item.kind === e.kind);
          return old ? [[e.id, old] as const] : [];
        }));
      const id = (value: string | undefined) => value ? replacements.get(value)?.id ?? value : value;
      next = { ...linked, circuit: {
        ...linked.circuit!,
        elements: linked.circuit!.elements.map(e => ({ ...e,
          id: id(e.id)!, fromId: id(e.fromId), toId: id(e.toId),
          notes: replacements.get(e.id)?.notes ?? e.notes,
        })),
        pins: linked.circuit!.pins.map(pin => ({ ...pin, elementId: id(pin.elementId)! })),
      } };
    } else if (outdated || elements.some(e => e.textileLayer !==
      (e.kind === 'insulation' ? 'integrated' : sensor.textileLayer))) {
      next = syncSensorCircuit(next, original, sensor);
    }
    if (next !== project || sensor !== original) {
      next = { ...next, sensors: next.sensors.map(s => s.id === sensor.id ? sensor : s) };
    }
  }
  return next;
}

export const createDefaultProject = () => prepareStudioProject(sampleProject());
