import {describe,it,expect,beforeEach} from 'vitest';
import {knitStructures,findStructure} from '../data/knitStructures';
import {stitchAt} from '../services/knitPatternGenerator';
import {parseProject,serialize} from '../services/projectIO';
import {sampleProject} from '../models/project';
import {useStudio} from '../stores/studio';
describe('knit library and persistence',()=>{
 beforeEach(()=>useStudio.setState({project:sampleProject(),past:[],future:[],selected:null}));
 it('covers all 26 catalog positions without inventing obscured identities',()=>{expect(knitStructures).toHaveLength(26);expect(knitStructures.map(s=>s.catalogSlot)).toEqual(Array.from({length:26},(_,i)=>String(i+1).padStart(2,'0')));expect(new Set(knitStructures.map(s=>s.id)).size).toBe(26);for(const s of knitStructures){expect(s.measurements).toEqual([]);expect(s.properties.thickness.level).toBe('unknown');if(s.verificationStatus==='verified'){expect(s.referenceNumber).toBe(s.catalogSlot);expect(s.classificationSource).toContain('cdn.shopify.com');}else expect(s.referenceNumber).toBeUndefined();if(s.visualizationStatus==='notAvailable'){expect(s.pattern).toBeUndefined();expect(s.cadSupported).toBe(false);}}expect(knitStructures.filter(s=>s.visualizationStatus==='notAvailable').map(s=>s.catalogSlot)).toEqual([]);});
 it('identifies Double Piqué 21 from official bundle imagery without authenticating unresolved slots',()=>{const s=findStructure('double-pique')!;expect(s.catalogSlot).toBe('21');expect(s.referenceNumber).toBe('21');expect(s.verificationStatus).toBe('verified');expect(s.classificationSource).toContain('knit_industry.webp');expect(s.visualizationStatus).toBe('schematic');expect(knitStructures.filter(s=>['16','20'].includes(s.catalogSlot)).every(s=>s.verificationStatus==='pending'&&s.cadSupported)).toBe(true);});
 it('adds source-backed generic Links and Single Piqué without verifying Fashionary numbering',()=>{
 const links=findStructure('links')!,pique=findStructure('plain-pique')!;
 expect(links.repeat).toEqual({columns:1,rows:2});expect(links.pattern).toEqual(['K','P']);expect(links.reversible).toBe(true);
 expect(pique.repeat).toEqual({columns:2,rows:4});expect(pique.pattern).toEqual(['KK','KT','KK','TK']);
 for(const s of [links,pique]){expect(s.verificationStatus).toBe('pending');expect(s.referenceNumber).toBeUndefined();expect(s.visualizationStatus).toBe('schematic');expect(s.cadSupported).toBe(true);expect(s.technicalReferences?.length).toBeGreaterThan(0);expect(s.measurements).toEqual([]);expect(s.properties.thickness.level).toBe('unknown');expect(s.properties.recovery.level).toBe('unknown');}
 expect(links.properties.lengthwiseStretch).toMatchObject({level:'qualitative',source:links.technicalReferences![0].url});expect(pique.properties.stability.level).toBe('qualitative');
 expect(findStructure('unresolved-16')?.id).toBe('links');expect(findStructure('unresolved-20')?.id).toBe('plain-pique');
 });
 it('distinguishes Links course alternation from rib wale alternation and staggers Piqué tucks',()=>{
 expect([0,1,2,3].map(r=>stitchAt('links',0,r))).toEqual(['K','P','K','P']);
 expect([0,1,2,3].map(r=>stitchAt('rib-1x1',0,r))).toEqual(['K','K','K','K']);
 expect(Array.from({length:4},(_,r)=>[stitchAt('plain-pique',0,r),stitchAt('plain-pique',1,r)])).toEqual([['K','K'],['K','T'],['K','K'],['T','K']]);
 expect(stitchAt('unresolved-16',0,1)).toBe('P');expect(stitchAt('unresolved-20',1,1)).toBe('T');
 });
 it('keeps library content and aliases in English',()=>{expect(JSON.stringify(knitStructures)).not.toMatch(/[\u3400-\u9fff]/);});
 it('preserves garment selection, sensor assignments, undo, redo and JSON reload',()=>{const store=useStudio.getState(),original=sampleProject();store.commit({...original,knitStructureId:'rib-1x1',structure:'1×1 Rib'});const saved=serialize(useStudio.getState().project);expect(parseProject(saved).knitStructureId).toBe('rib-1x1');expect(parseProject(saved).sensors).toEqual(original.sensors);store.undo();expect(useStudio.getState().project.knitStructureId).toBeUndefined();store.redo();expect(useStudio.getState().project.knitStructureId).toBe('rib-1x1');store.load(parseProject(saved));expect(useStudio.getState().project.knitStructureId).toBe('rib-1x1');});
 it('opens legacy projects unchanged and preserves future unknown references',()=>{const legacy=sampleProject();expect(parseProject(serialize(legacy))).toEqual(legacy);const future={...legacy,knitStructureId:'future-structure'};expect(parseProject(serialize(future))).toEqual(future);expect(findStructure('future-structure')).toBeUndefined();});
 it('rejects malformed optional references',()=>{expect(()=>parseProject(JSON.stringify({...sampleProject(),knitStructureId:42}))).toThrow('knit structure');});
 it('generates periodic diagrams and separates the original five studies',()=>{const signatures=new Set<string>();for(const s of knitStructures.filter(s=>s.visualizationStatus==='schematic')){const signature=Array.from({length:6},(_,r)=>Array.from({length:4},(_,c)=>stitchAt(s.id,c,r)).join('')).join('');if(['jersey','rib-1x1','full-milano','interlock','tubular'].includes(s.id))signatures.add(signature);for(let r=0;r<12;r++)for(let c=0;c<16;c++)expect(stitchAt(s.id,c,r)).toBe(stitchAt(s.id,c+s.repeat.columns,r+s.repeat.rows));}expect(signatures.size).toBe(5);});
 it('retains every supported expanded structure through JSON serialization',()=>{for(const s of knitStructures.filter(s=>s.cadSupported)){const project={...sampleProject(),knitStructureId:s.id,structure:s.name};expect(findStructure(parseProject(serialize(project)).knitStructureId)?.id).toBe(s.id);}});
 it('exposes tuck, float, pile and displacement concepts distinctly',()=>{expect(stitchAt('half-cardigan',1,0)).toBe('T');expect(stitchAt('skip-stitch',1,0)).toBe('M');expect(stitchAt('plush',1,0)).toBe('L');expect(stitchAt('racked-stitch',0,0)).toBe('C');});
 it('distinguishes knit/purl faces and bed concepts',()=>{expect(stitchAt('jersey',0,0)).toBe('K');expect(stitchAt('jersey',0,0,true)).toBe('P');expect(stitchAt('rib-1x1',1,0)).toBe('P');expect([0,1,2].map(r=>stitchAt('full-milano',0,r))).toEqual(['K','F','B']);});
});
