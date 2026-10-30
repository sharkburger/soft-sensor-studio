import {describe,it,expect,beforeEach} from 'vitest';
import {sampleProject} from '../models/project';
import {grid,mmToCells,constrain,validate,patternToCylinder,patternToScreen,screenToPattern} from '../services/geometry';
import {parseProject,serialize} from '../services/projectIO';
import {useStudio} from '../stores/studio';
describe('geometry and project model',()=>{it('rounds requested physical sizes to stitches',()=>{expect(mmToCells(101,2)).toBe(51);expect(grid(sampleProject().garment)).toEqual({columns:180,rows:120});});it('snaps and constrains an edit',()=>{const p=sampleProject();expect(constrain({...p.sensors[0],column:999,row:-3,width:20.4},p.garment)).toMatchObject({column:160,row:0,width:20});});it('detects boundary, seam, overlap and missing materials',()=>{const p=sampleProject();p.sensors[0].column=175;p.sensors[1]={...p.sensors[0],id:'other',name:'Other',materialId:'missing'};const warnings=validate(p).join(' ');expect(warnings).toContain('seam');expect(warnings).toContain('overlaps');expect(warnings).toContain('yarn assignment');});it('preserves invalid regions when garment shrinks',()=>{const p=sampleProject();p.garment.lengthMm=20;expect(p.sensors[0].height).toBe(56);expect(validate(p).some(w=>w.includes('length'))).toBe(true);});it('maps canvas and cylinder from the same coordinates',()=>{const g=sampleProject().garment;const q=patternToScreen(45,30,120,3);expect(screenToPattern(q.x,q.y,120,3)).toEqual({column:45,row:30});const point=patternToCylinder(45,30,g);expect(point[0]).toBeCloseTo(360/(2*Math.PI));expect(point[1]).toBe(-60);expect(point[2]).toBeCloseTo(0);expect(patternToCylinder(180,0,g)[2]).toBeCloseTo(patternToCylinder(0,0,g)[2]);});it('round trips all project data including IDs and material assignments',()=>{const p=sampleProject();expect(parseProject(serialize(p))).toEqual(p);});it('rejects malformed schemas and duplicate IDs',()=>{expect(()=>parseProject('{}')).toThrow('schema');const p=sampleProject();p.sensors[1].id=p.sensors[0].id;expect(()=>parseProject(serialize(p))).toThrow('unique');});});
describe('editor history',()=>{beforeEach(()=>useStudio.setState({project:sampleProject(),past:[],future:[],selected:null}));it('adds, moves, resizes, duplicates and deletes',()=>{useStudio.getState().add();let s=useStudio.getState();expect(s.project.sensors).toHaveLength(3);const id=s.selected!;s.patchSensor(id,{column:10,row:12,width:8,height:14});expect(useStudio.getState().project.sensors.at(-1)).toMatchObject({column:16,row:12,width:8,height:14});s.duplicate();expect(useStudio.getState().project.sensors).toHaveLength(4);expect(new Set(useStudio.getState().project.sensors.map(s=>s.id)).size).toBe(4);s.remove();expect(useStudio.getState().project.sensors).toHaveLength(3);});it('keeps linked sensor contacts and routes within the garment when moved to an edge',()=>{
 useStudio.getState().add();
 const id=useStudio.getState().selected!;
 for(const position of [{column:-100,row:-100},{column:999,row:999}]){
  useStudio.getState().patchSensor(id,{...position,width:8,height:14});
  const p=useStudio.getState().project,s=p.sensors.find(s=>s.id===id)!;
  const {columns,rows}=grid(p.garment);
  expect(s.column).toBe(position.column<0?16:columns-s.width-16);
  expect(s.row).toBe(position.row<0?4:rows-s.height-8);
  const members=p.circuit!.elements.filter(e=>e.sensorId===id);
  expect(members.some(e=>e.kind==='trace')).toBe(true);
  for(const e of members)for(const q of e.kind==='trace'?e.points:[e,{column:e.column+e.width,row:e.row+e.height}]){
   expect(q.column).toBeGreaterThanOrEqual(0);expect(q.column).toBeLessThanOrEqual(columns);
   expect(q.row).toBeGreaterThanOrEqual(0);expect(q.row).toBeLessThanOrEqual(rows);
  }
 }
});it('allows legacy sensors without circuit assemblies to move without lead clearance',()=>{
 const id=sampleProject().sensors[0].id;
 useStudio.getState().patchSensor(id,{column:10,row:12,width:8,height:14});
 expect(useStudio.getState().project.sensors[0]).toMatchObject({column:10,row:12,width:8,height:14});
});it('undoes and redoes without losing project data',()=>{const before=serialize(useStudio.getState().project);useStudio.getState().add();const after=serialize(useStudio.getState().project);useStudio.getState().undo();expect(serialize(useStudio.getState().project)).toBe(before);useStudio.getState().redo();expect(serialize(useStudio.getState().project)).toBe(after);});it('invalidates redo after a new edit',()=>{useStudio.getState().add();useStudio.getState().undo();useStudio.getState().add();expect(useStudio.getState().future).toHaveLength(0);});});
