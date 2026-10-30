import {findStructure} from '../data/knitStructures';
export type Operation='K'|'P'|'F'|'B'|'T'|'M'|'C'|'L';
export function resolveBaseStructureId(id:string|undefined,legacyName:string){
 return id??(legacyName==='Single jersey'?'jersey':legacyName==='Rib'?'rib-1x1':undefined);
}
// Common face coordinates: column 0 at seam, course 0 at bottom.
export function stitchAt(id:string,column:number,row:number,back=false):Operation {
 let op:Operation='K';
 if(id==='rib-1x1') op=column%2?'P':'K';
 if(id==='full-milano') op=row%3===0?(column%2?'P':'K'):row%3===1?'F':'B';
 if(id==='interlock') op=(column+row)%2?'B':'F';
 if(id==='tubular') op=row%2?'B':'F';
 const pattern=findStructure(id)?.pattern;
 if(pattern)op=pattern[row%pattern.length][column%pattern[0].length] as Operation;
 return back?({K:'P',P:'K',F:'B',B:'F',T:'T',M:'M',C:'C',L:'L'} as const)[op]:op;
}
export const loopPath='M 2 18 C 2 13 15 7 12 3 C 9 -2 3 2 6 7 C 9 12 16 14 16 18';
export function operationPath(op:Operation){return op==='P'?'M 2 9 Q 9 18 16 9':op==='M'?'M 1 12 L 18 12':op==='T'?'M 2 18 Q 9 -7 16 18 M 5 18 L 13 18':op==='C'?'M 2 18 L 16 2 M 2 2 L 16 18':op==='L'?'M 4 18 C -5 -9 24 -9 14 18':loopPath;}
export function drawKnit(ctx:CanvasRenderingContext2D,id:string,columns:number,rows:number,cell:number,appearance:{color?:string;texture?:'smooth'|'heathered'|'metallic'|'fuzzy'}={}){
 const yarnColor=appearance.color??'#6c8065', yarnTexture=appearance.texture??'smooth';
 ctx.strokeStyle=yarnColor;ctx.lineWidth=Math.max(.4,cell*.09);
 // Bound work on extreme imported grids without changing the represented repeat.
 if(columns*rows>80000)return;
 for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
  const op=stitchAt(id,c,r);const x=c*cell,y=(rows-r-1)*cell;
  ctx.save();ctx.translate(x,y);ctx.scale(cell/20,cell/22);const scaleBoost=Math.max(1,5.6/cell);ctx.lineWidth=(yarnTexture==='fuzzy'?2.25:1.6)*scaleBoost;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=yarnColor;const path=new Path2D(operationPath(op));
  if(op==='B')ctx.setLineDash([3,3]);
  if(yarnTexture==='fuzzy'){ctx.globalAlpha=.22;ctx.stroke(path);ctx.globalAlpha=1;}
  if(yarnTexture==='metallic'){ctx.shadowColor='#ffffff';ctx.shadowBlur=1.4;}
  ctx.stroke(path);ctx.shadowBlur=0;
  if(yarnTexture==='heathered'){ctx.beginPath();ctx.moveTo(4,10+(c%3));ctx.lineTo(8,9+(c%3));ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=.75*scaleBoost;ctx.stroke();}
  if(yarnTexture==='metallic'){ctx.beginPath();ctx.moveTo(5,10);ctx.lineTo(9,8);ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=.7*scaleBoost;ctx.stroke();}
  ctx.restore();

 }
}
