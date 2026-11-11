/** Registered anatomical targets in the painted 512px atlas, never the surrounding hull. */
export interface AnatomicalRegion { x:number; y:number; width:number; height:number; }
export function talassarcaRegions(inner:boolean):Array<AnatomicalRegion&{id:string;name:string;kind:'organic'|'weapon'}> {
  const points=inner?[[203,134],[308,134],[257,339],[198,253],[314,253],[257,186]]:[[183,142],[328,142],[256,337],[182,246],[330,246],[256,187]];
  const ids=['left','right','vent','battery-left','battery-right','battery-core'];
  const names=['Órgão esquerdo','Órgão direito','Ventre dorsal','Bateria esquerda','Bateria direita','Artilharia central'];
  return points.map(([x,y],i)=>({id:ids[i],name:names[i],kind:i<3?'organic':'weapon',x,y,width:i<2?42:i===2?38:38,height:i<2?42:i===2?46:50}));
}
