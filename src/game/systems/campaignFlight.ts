import { createPlayerWeapons, type PlayerWeaponsState } from './weaponSystem.ts';
import { initialPlayerHealth, type PlayerHealth } from './combat.ts';

/** A stage boundary is not a death, Continue, replay or new campaign. */
export interface CampaignFlight {
  pilotId: string;
  clearedStage: number;
  weapons: PlayerWeaponsState;
  lives: number;
  score: number;
}

export function stageFlightSnapshot(stage:number,weapons:PlayerWeaponsState,lives:number,score:number):CampaignFlight {
  return {pilotId:weapons.pilotId,clearedStage:stage,weapons:{...weapons},lives,score};
}

export function enterStage(pilotId:PlayerWeaponsState['pilotId'],stage:number,carry?:CampaignFlight):{weapons:PlayerWeaponsState;health:PlayerHealth;score:number} {
  const health=initialPlayerHealth();
  if(!carry||carry.pilotId!==pilotId||carry.weapons.pilotId!==pilotId||carry.clearedStage+1!==stage)
    return {weapons:createPlayerWeapons(pilotId),health,score:0};
  // Preserve earned strength AND weakness. Only transient effects/cooldowns end at the boundary.
  const weapons={...carry.weapons,specialActiveMs:0,fireCooldownMs:0,missileCooldownMs:0,
    chargeMs:0,isCharging:false,heat:0,isOverheated:false,overheatCooldownMs:0,hasShield:false};
  return {weapons,health:{...health,lives:carry.lives},score:carry.score};
}
