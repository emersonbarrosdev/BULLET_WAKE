import type {Family} from './content.ts';
import {clamp} from './geometry.ts';

export const PELAGIC_RIVET_SHEET='pelagic-rivet-up';
export const PELAGIC_ENEMY_AIR_SHEET='pelagic-enemy-air';
export const PELAGIC_UFO_SHEET='pelagic-ufo-anim';
export const PELAGIC_VFX_SHEET='pelagic-vfx';

const AIR_ROW_BASE:Partial<Record<Family,number>>={fighter:0,interceptor:4,acrobat:8,bomber:12};
const HELI_ROW:Partial<Record<Family,number>>={heli_scout:0,heli_utility:1,heli_phantom:2,heli_warhawk:3};

export function isHelicopterFamily(family:Family):boolean{
 return HELI_ROW[family]!==undefined;
}

export function heliSheetRow(family:Family):number{
 return HELI_ROW[family]??0;
}

export function heliBankColumn(localBank:number,attackPose=false):number{
 if(attackPose)return 5;
 const b=clamp(localBank,-1,1);
 return clamp(2+Math.sign(b)*Math.round(Math.abs(b)*2),0,4);
}

export function heliSheetFrame(family:Family,localBank:number,attackPose=false):number{
 return heliSheetRow(family)*6+heliBankColumn(localBank,attackPose);
}

export function rotorSheetFrame(family:Family,time:number,seed=0,tail=false):number{
 const row=tail?4:heliSheetRow(family);
 const rpm=tail?34:family==='heli_scout'?28:family==='heli_phantom'?26:family==='heli_utility'?22:20;
 return row*8+(Math.floor(time*rpm+seed*1.7)%8);
}

export function rivetBankColumn(bank:number):number{
 const b=clamp(bank,-1,1);
 return clamp(3+Math.sign(b)*Math.round(Math.abs(b)*3),0,6);
}

export function rivetSheetFrame(bank:number,time:number,boost=false):number{
 const col=rivetBankColumn(bank);
 const row=Math.floor(time*(boost?20:14))%4;
 return row*7+col;
}

export function enemyAirFrame(family:Family,localBank:number,time:number,seed=0):number{
 const base=AIR_ROW_BASE[family];
 if(base===undefined)return 0;
 const speed=family==='interceptor'?22:family==='acrobat'?20:family==='fighter'?18:15;
 const row=base+(Math.floor(time*speed+seed*.7)%4);
 const b=clamp(localBank,-1,1);
 const col=family==='acrobat'
  ?clamp(3+Math.sign(b)*Math.round(Math.abs(b)*3),0,6)
  :clamp(2+Math.sign(b)*Math.round(Math.abs(b)*2),0,4);
 return row*7+col;
}

export function ufoAnimFrame(time:number,seed=0):number{
 return Math.floor(time*10+seed*.5)%6;
}
