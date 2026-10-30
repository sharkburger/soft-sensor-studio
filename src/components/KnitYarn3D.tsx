import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import type {KnitStructure} from '../models/knitStructure';
import {yarnInstances,yarnLoopGeometry} from '../services/knitGeometry3D';
import type {Operation} from '../services/knitPatternGenerator';
import type {YarnTexture} from '../models/project';
function YarnBatch({op,matrices,width,height,transparent,color,texture}:{op:Operation;matrices:THREE.Matrix4[];width:number;height:number;transparent:boolean;color:string;texture:YarnTexture}){
 const ref=useRef<THREE.InstancedMesh>(null);
 const geometry=useMemo(()=>yarnLoopGeometry(op,width,height),[op,width,height]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>{const mesh=ref.current;if(!mesh)return;matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();},[matrices]);
 const yarnColor=new THREE.Color(color);if(op==='P'||op==='B')yarnColor.lerp(new THREE.Color('#ffffff'),texture==='metallic'?.12:.18);
 return <instancedMesh ref={ref} args={[geometry,undefined,matrices.length]} raycast={()=>{}}><meshStandardMaterial color={yarnColor} roughness={texture==='metallic'?.42:texture==='heathered'?.84:texture==='fuzzy'?.98:.94} metalness={texture==='metallic'?.42:0} transparent={transparent} opacity={transparent?.3:1}/></instancedMesh>;
}
export function KnitYarn3D({structure,columns,rows,radius,height,transparent,color,texture}:{structure:KnitStructure;columns:number;rows:number;radius:number;height:number;transparent:boolean;color:string;texture:YarnTexture}){
 const data=useMemo(()=>yarnInstances(structure,columns,rows,radius,height),[structure,columns,rows,radius,height]);
 return <group>{[...data.groups].map(([op,matrices])=><YarnBatch key={op} op={op} matrices={matrices} width={data.width} height={data.courseHeight} transparent={transparent} color={color} texture={texture}/>)}</group>;
}
