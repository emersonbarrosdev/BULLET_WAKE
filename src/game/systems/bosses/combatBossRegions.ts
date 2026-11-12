import { talassarcaRegions } from './talassarcaRig.ts';
import type { StageBoss } from './types.ts';

export function captainRegions(){
  return [
    {id:'port',name:'Canhão esquerdo',kind:'weapon' as const,x:89,y:198,width:48,height:60},
    {id:'starboard',name:'Canhão direito',kind:'weapon' as const,x:167,y:198,width:48,height:60},
    {id:'core',name:'Núcleo assimilado',kind:'organic' as const,x:128,y:163,width:42,height:65},
  ];
}
export function combatBossRegions(boss:StageBoss){
  return boss.name==='TALASSARCA'?talassarcaRegions(boss.layer==='inner'):boss.name==='RAIA-DENTE'?captainRegions():[];
}
export function bossDamageable(boss:StageBoss):boolean{return ['shell','inner','active'].includes(boss.phase);}
