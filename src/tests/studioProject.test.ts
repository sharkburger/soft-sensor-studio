import { afterEach, describe, expect, it } from 'vitest';
import { sampleProject, type Project } from '../models/project';
import { createCircuitElement } from '../services/circuit';
import { emptyCircuit } from '../models/circuit';
import { createDefaultProject, prepareStudioProject } from '../services/studioProject';
import { parseProject, serialize } from '../services/projectIO';
import { useStudio } from '../stores/studio';

function expectConnected(p: Project) {
  const c = p.circuit!;
  expect(c).toBeDefined();
  for (const sensor of p.sensors) {
    const members = c.elements.filter(e => e.sensorId === sensor.id);
    expect(members.filter(e => e.kind === 'electrode')).toHaveLength(2);
    expect(members.filter(e => e.kind === 'terminal')).toHaveLength(2);
    const traces = members.filter(e => e.kind === 'trace');
    expect(traces).toHaveLength(4);
    for (const trace of traces) {
      const from = c.pins.find(pin => pin.id === trace.fromPinId)!;
      const to = c.pins.find(pin => pin.id === trace.toPinId)!;
      expect(from).toBeDefined(); expect(to).toBeDefined();
      expect(from.elementId).toBe(trace.fromId);
      expect(to.elementId).toBe(trace.toId);
      expect(from.point).toEqual(trace.points[0]);
      expect(to.point).toEqual(trace.points.at(-1));
      expect(from.netId).toBe(trace.netId);
      expect(to.netId).toBe(trace.netId);
      expect(c.nets.some(net => net.id === trace.netId)).toBe(true);
    }
  }
  expect(parseProject(serialize(p))).toEqual(p);
}

describe('default sensor connections', () => {
  const previous = useStudio.getState();
  afterEach(() => useStudio.setState(previous));

  it('opens both default sensors with contact and readout routes before rendering', () => {
    const p = createDefaultProject();
    expect(p.sensors.map(s => s.id)).toEqual(sampleProject().sensors.map(s => s.id));
    expectConnected(p);
    expect(p.sensors.map(s => s.textileLayer)).toEqual(['surface', 'inner']);
    expect(prepareStudioProject(p)).toBe(p);
  });

  it('upgrades saved plain defaults without changing their positions or duplicating routes', () => {
    const old = sampleProject();
    const saved = serialize(old);
    const p = prepareStudioProject(parseProject(saved));
    expectConnected(p);
    expect(p.sensors.map(({textileLayer, ...s}) => s)).toEqual(old.sensors);
    expect(serialize(old)).toBe(saved);
    expect(prepareStudioProject(p)).toBe(p);
  });

  it('repairs bare legacy regions while retaining IDs and unrelated circuit objects', () => {
    const old = sampleProject();
    const region = createCircuitElement('sensing-region', {column: old.sensors[0].column, row: old.sensors[0].row}, 'conductive');
    region.sensorId = old.sensors[0].id;
    region.notes = 'Keep my region notes';
    const battery = createCircuitElement('battery', {column: 20, row: 20}, 'battery-pack');
    old.circuit = {...emptyCircuit(), elements: [region, battery]};
    const p = prepareStudioProject(old);
    expectConnected(p);
    expect(p.circuit!.elements.find(e => e.id === region.id)).toMatchObject({
      sensorId: old.sensors[0].id, notes: 'Keep my region notes',
    });
    expect(p.circuit!.elements.find(e => e.id === battery.id)).toEqual(battery);
  });

  it('prepares imported projects and supports undo without deleting the existing design', () => {
    const before = createDefaultProject();
    useStudio.setState({project: before, past: [], future: [], selected: null});
    const old = sampleProject();
    old.name = 'Imported design';
    useStudio.getState().load(parseProject(serialize(old)));
    expectConnected(useStudio.getState().project);
    useStudio.getState().undo();
    expect(useStudio.getState().project).toEqual(before);
    useStudio.getState().redo();
    expectConnected(useStudio.getState().project);
  });

  it('keeps edited routes intact and does not rebuild an existing assembly', () => {
    const p = createDefaultProject();
    const route = p.circuit!.elements.find(e => e.kind === 'trace')!;
    route.points.splice(1, 0, {column: 50, row: 30});
    expect(prepareStudioProject(p)).toBe(p);
    expect(p.circuit!.elements.find(e => e.id === route.id)!.points).toHaveLength(3);
  });

  it('preserves a legacy region when there is no space for its routes', () => {
    const p = sampleProject();
    p.sensors = [{...p.sensors[0], column: 0}];
    const region = createCircuitElement('sensing-region', {column: p.sensors[0].column, row: p.sensors[0].row}, 'conductive');
    region.sensorId = p.sensors[0].id;
    p.circuit = {...emptyCircuit(), elements: [region]};
    expect(prepareStudioProject(p)).toBe(p);
    expect(p.circuit.elements).toEqual([region]);
  });
});
