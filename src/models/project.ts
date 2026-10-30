import type {CircuitDesign,TextileLayer} from './circuit';
import type {Study} from '../showcase/pattern';
export type Joint = 'Knee' | 'Elbow' | 'Wrist';
export interface Garment { joint: Joint; circumferenceMm: number; lengthMm: number; stitchWidthMm: number; rowHeightMm: number }
export type YarnTexture = 'smooth'|'heathered'|'metallic'|'fuzzy';
export interface Material { id: string; name: string; yarnType: string; notes: string; calibrated: boolean; color?: string; texture?: YarnTexture }
export interface Sensor { id: string; name: string; column: number; row: number; width: number; height: number; materialId: string; structure: string; knitStructureId?: string; textileLayer?: TextileLayer; channel: string; color: string }
export interface Project { schemaVersion: 1; circuit?: CircuitDesign; patternStudy?: Study; knitStructureId?: string; layerMode?: 'single'|'double'; name: string; garment: Garment; sensors: Sensor[]; materials: Material[]; baseMaterialId: string; structure: string }
export const presets: Record<Joint, [number,number]> = { Knee:[360,240], Elbow:[260,180], Wrist:[170,100] };
export const colors = ['#bd6746','#497b74','#8b79ad','#c49b42','#587caa'];
export function sampleProject(): Project { return {schemaVersion:1,layerMode:'double',name:'Knee sleeve — exploration 01',garment:{joint:'Knee',circumferenceMm:360,lengthMm:240,stitchWidthMm:2,rowHeightMm:2},baseMaterialId:'base',structure:'Single jersey',materials:[{id:'base',name:'Soft base yarn',yarnType:'Nonconductive',notes:'Illustrative profile; measure gauge on a swatch.',calibrated:false,color:'#a9b39b',texture:'smooth'},{id:'conductive',name:'Conductive yarn',yarnType:'Conductive',notes:'Illustrative profile; no electrical calibration.',calibrated:false,color:'#497b74',texture:'heathered'}],sensors:[{id:'sensor-example-1',name:'Flexion sensor',column:70,row:32,width:24,height:56,materialId:'conductive',structure:'Single jersey',channel:'CH-01',color:colors[0]},{id:'sensor-example-2',name:'Reference sensor',column:112,row:40,width:18,height:40,materialId:'conductive',structure:'Single jersey',channel:'CH-02',color:colors[1]}]}; }
