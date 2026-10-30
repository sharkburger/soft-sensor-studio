import * as THREE from 'three';
import type {KnitStructure} from '../models/knitStructure';
import {stitchAt,type Operation} from './knitPatternGenerator';

// Representative geometry only: capped independently of imported project dimensions.
export function yarnPreviewPlan(columns:number,rows:number,repeat:KnitStructure['repeat']){
 const fit=(count:number,period:number,cap:number)=>Math.max(1,Math.min(count,Math.max(period,Math.floor(cap/period)*period)));
 // Keep the representative 3D preview light enough for laptops and browsers
 // that are already running several CAD tabs.
 const c=fit(columns,repeat.columns,48),r=fit(rows,repeat.rows,36);
 return {columns:c,rows:r,reduced:c!==columns||r!==rows};
}
export function yarnLoopGeometry(op:Operation,width:number,height:number){
 const p=(x:number,y:number,z:number)=>new THREE.Vector3(x*width,y*height,z*Math.min(width,height));
 // Local +Z is outward, +X is the course direction, +Y is the wale direction.
 let points=[p(-.47,-.43,0),p(-.25,-.22,.08),p(.18,.23,.2),p(.2,.42,.06),p(0,.49,-.04),p(-.2,.42,.06),p(-.18,.23,.2),p(.25,-.22,.08),p(.47,-.43,0)];
 if(op==='P')points=[p(-.47,-.1,.04),p(-.3,.1,.14),p(0,.18,.23),p(.3,.1,.14),p(.47,-.1,.04)];
 if(op==='T')points=[p(-.45,-.45,0),p(-.25,-.2,.12),p(-.2,.48,.25),p(0,.65,.12),p(.2,.48,.25),p(.25,-.2,.12),p(.45,-.45,0)];
 if(op==='M')points=[p(-.49,0,.05),p(0,-.08,.12),p(.49,0,.05)];
 if(op==='C')points=[p(-.45,-.45,0),p(-.18,-.1,.2),p(.2,.15,.3),p(.45,.45,0)];
 if(op==='L')points=[p(-.4,-.4,0),p(-.35,.1,.6),p(0,.5,.85),p(.35,.1,.6),p(.4,-.4,0)];
 if(op==='B')points=points.map(v=>new THREE.Vector3(v.x,v.y,-v.z));
 return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,Math.min(width,height)*.085,5,false);
}
export function yarnInstances(s:KnitStructure,columns:number,rows:number,radius:number,height:number){
 const plan=yarnPreviewPlan(columns,rows,s.repeat),width=2*Math.PI*radius/plan.columns,courseHeight=height/plan.rows;
 const groups=new Map<Operation,THREE.Matrix4[]>();
 for(let r=0;r<plan.rows;r++)for(let c=0;c<plan.columns;c++){
  const op=stitchAt(s.id,c,r),theta=2*Math.PI*(c+.5)/plan.columns;
  // Rib relief follows the representative repeat, never a mechanical deformation model.
  const rib=s.category==='Rib'?(op==='P'?-.08:.16)*width:0;
  // Keep the yarn tube visibly above the garment shell.
  const radial=radius+1+rib;
  const matrix=new THREE.Matrix4().makeRotationY(theta);
  matrix.setPosition(radial*Math.sin(theta),(r+.5)*courseHeight-height/2,radial*Math.cos(theta));
  if(!groups.has(op))groups.set(op,[]);groups.get(op)!.push(matrix);
 }
 return {plan,width,courseHeight,groups,sensorOffset:Math.max(width,courseHeight)*1.15+1};
}
