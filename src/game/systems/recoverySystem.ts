import type { PlayerWeaponsState, WeaponFamily, WeaponLevel } from './weaponSystem.ts';
export interface RecoveryPayload { family: WeaponFamily; level: WeaponLevel; meter: number; }

/** Absolute milestones restore earned power, never duplicate it or unlock a new family. */
export function recoveryPayloads(state: PlayerWeaponsState): RecoveryPayload[] {
  const items: RecoveryPayload[]=[];
  for(let level=2;level<=state.weaponLevel;level++)items.push({family:state.weaponFamily,level:level as WeaponLevel,meter:0});
  if(state.powerMeter>0){
    if(items.length)items[items.length-1].meter=state.powerMeter;
    else items.push({family:state.weaponFamily,level:1,meter:state.powerMeter});
  }
  return items;
}
export function recoverArmament(state: PlayerWeaponsState, item: RecoveryPayload): PlayerWeaponsState {
  if(state.weaponFamily!==item.family)return state;
  const same=state.weaponFamily===item.family;
  return {...state,weaponFamily:item.family,weaponLevel:same?Math.max(state.weaponLevel,item.level) as WeaponLevel:item.level,
    powerMeter:same?Math.max(state.powerMeter,item.meter):item.meter};
}
