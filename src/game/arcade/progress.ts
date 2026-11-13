import {stageFlightSnapshot,type CampaignFlight} from '../systems/campaignFlight.ts';
import {createPlayerWeapons} from '../systems/weaponSystem.ts';

export interface ArcadeProgress {cleared:number[];flights:Record<number,CampaignFlight>;}
/** Parse only supported stage boundaries; older single-flight saves remain readable. */
export function readArcadeProgress(raw:string|null):ArcadeProgress {
 const result:ArcadeProgress={cleared:[],flights:{}};
 try {
  const value=JSON.parse(raw??'{}');
  if(!value||typeof value!=='object')return result;
  result.cleared=Array.isArray(value.cleared)?[...new Set<number>(value.cleared.filter((n:unknown)=>n===1||n===2))]:[];
  for(const flight of Object.values(value.flights??(value.flight?{legacy:value.flight}:{})) as CampaignFlight[]){
   if(!flight||!result.cleared.includes(flight.clearedStage)||flight.pilotId!=='nolan'||flight.weapons?.pilotId!=='nolan')continue;
   const {weaponLevel,powerMeter,specialCharges}=flight.weapons;
   if(![weaponLevel,powerMeter,specialCharges,flight.lives,flight.score].every(Number.isFinite)||weaponLevel<1||weaponLevel>5||powerMeter<0||powerMeter>2||specialCharges<0||specialCharges>5||flight.lives<1||flight.lives>5||flight.score<0)continue;
   result.flights[flight.clearedStage]=stageFlightSnapshot(flight.clearedStage,{...createPlayerWeapons('nolan'),weaponLevel,powerMeter,specialCharges},flight.lives,flight.score);
  }
 }catch{/* Invalid storage must not prevent starting a fresh run. */}
 return result;
}
export function recordArcadeClear(progress:ArcadeProgress,flight:CampaignFlight):ArcadeProgress {
 return {cleared:[...new Set([...progress.cleared,flight.clearedStage])],flights:{...progress.flights,[flight.clearedStage]:stageFlightSnapshot(flight.clearedStage,flight.weapons,flight.lives,flight.score)}};
}
