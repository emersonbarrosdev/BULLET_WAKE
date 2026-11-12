/** Registered anatomical targets in the painted 512px atlas, never the surrounding hull. */
export interface AnatomicalRegion { x:number; y:number; width:number; height:number; }
export function talassarcaRegions(inner:boolean):Array<AnatomicalRegion&{id:string;name:string;kind:'organic'|'weapon'}> {
  const points=inner?[[187,137],[327,137],[256,322],[191,239],[321,239],[256,188]]:[[190,164],[320,164],[255,344],[190,274],[322,274],[256,222]];
  const ids=['left','right','vent','battery-left','battery-right','battery-core'];
  const names=['Órgão esquerdo','Órgão direito','Ventre dorsal','Bateria esquerda','Bateria direita','Artilharia central'];
  return points.map(([x,y],i)=>({id:ids[i],name:names[i],kind:i<3?'organic':'weapon',x,y,width:i<2?42:i===2?38:38,height:i<2?42:i===2?46:50}));
}
