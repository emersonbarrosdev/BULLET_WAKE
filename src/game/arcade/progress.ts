import {stageFlightSnapshot,type CampaignFlight} from '../systems/campaignFlight.ts';
import {createPlayerWeapons,maxWeaponLevel} from '../systems/weaponSystem.ts';
import {isValidPilotId} from './ArcadeContracts.ts';

export interface ArcadeProgress {cleared:number[];flights:Record<number,CampaignFlight>;}
/** Parse only supported stage boundaries; older single-flight saves remain readable and support all 5 pilots. */
export function readArcadeProgress(raw:string|null):ArcadeProgress {
 const result:ArcadeProgress={cleared:[],flights:{}};
 try {
  const value=JSON.parse(raw??'{}');
  if(!value||typeof value!=='object')return result;
  result.cleared=Array.isArray(value.cleared)?[...new Set<number>(value.cleared.filter((n:unknown)=>n===1||n===2))]:[];
  for(const flight of Object.values(value.flights??(value.flight?{legacy:value.flight}:{})) as CampaignFlight[]){
   if(!flight||!result.cleared.includes(flight.clearedStage)||!isValidPilotId(flight.pilotId)||flight.weapons?.pilotId!==flight.pilotId)continue;
   const {weaponLevel,powerMeter,specialCharges}=flight.weapons;
   const cap=maxWeaponLevel(flight.pilotId);
   if(![weaponLevel,powerMeter,specialCharges,flight.lives,flight.score].every(Number.isFinite)||weaponLevel<1||weaponLevel>cap||powerMeter<0||powerMeter>3||specialCharges<0||specialCharges>5||flight.lives<1||flight.lives>5||flight.score<0)continue;
   result.flights[flight.clearedStage]=stageFlightSnapshot(flight.clearedStage,{...createPlayerWeapons(flight.pilotId),weaponLevel,powerMeter,specialCharges},flight.lives,flight.score);
  }
 }catch{/* Invalid storage must not prevent starting a fresh run. */}
 return result;
}
export function recordArcadeClear(progress:ArcadeProgress,flight:CampaignFlight):ArcadeProgress {
 return {cleared:[...new Set([...progress.cleared,flight.clearedStage])],flights:{...progress.flights,[flight.clearedStage]:stageFlightSnapshot(flight.clearedStage,flight.weapons,flight.lives,flight.score)}};
}
