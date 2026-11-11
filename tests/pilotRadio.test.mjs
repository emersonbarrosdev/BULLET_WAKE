import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_RADIO} from '../src/game/data/pilotRadio.ts';
import {PilotRadio} from '../src/game/systems/pilotRadioSystem.ts';
import {initialPlayerHealth,collectLife} from '../src/game/systems/combat.ts';
import {createPlayerWeapons,collectSpecialCharge} from '../src/game/systems/weaponSystem.ts';
import {destructionPlan} from '../src/game/systems/destructionSystem.ts';
import {MUSIC_SCORES} from '../src/game/audio/musicScore.ts';
test('five pilot voices each have 55 original lines, five per context, with a bounded HUD length',()=>{
 const all=[];for(const events of Object.values(PILOT_RADIO)){const lines=Object.values(events).flat();assert.equal(lines.length,55);assert.ok(Object.values(events).every(pool=>pool.length===5));assert.ok(lines.every(t=>t.length<115));all.push(...lines);}assert.equal(new Set(all).size,275);
});
test('radio handles successive deaths, comeback, anti-repeat bags and long quiet intervals',()=>{
 const r=new PilotRadio('nolan',()=>.31);r.death();const first=r.message;r.death();assert.notEqual(r.message,first);for(let i=0;i<8;i++)r.kill();assert.ok(PILOT_RADIO.nolan.comeback.includes(r.message));
 assert.equal(r.offer('crowd'),false);r.update(7000,{enemies:1,bullets:0,lives:2,specials:2});assert.equal(r.remaining,0);
 const seen=new Set();for(let i=0;i<5;i++){r.offer('miniboss',true);seen.add(r.message);}assert.equal(seen.size,5);
});
test('life and special stock cap at five; excess life scores instead of adding a sixth',()=>{
 let health=initialPlayerHealth();for(let i=0;i<10;i++)health=collectLife(health).state;assert.equal(health.lives,5);assert.equal(collectLife(health).bonusPoints,5000);
 let w=createPlayerWeapons();for(let i=0;i<10;i++)w=collectSpecialCharge(w);assert.equal(w.specialCharges,5);
});
test('large destruction staggers many local bursts and ends at the actual impact',()=>{
 const p=destructionPlan(384,200,120,350,230,true);assert.equal(p.length,20);assert.equal(p.filter(b=>b.major).length,2);assert.ok(p.some(b=>b.x!==350));assert.equal(p.at(-1).x,350);assert.equal(p.at(-1).y,230);assert.ok(p.at(-1).delay>=900);
});
test('three original music arrangements have distinct melodies and escalating tempo',()=>{
 const scores=Object.values(MUSIC_SCORES);assert.equal(new Set(scores.map(s=>JSON.stringify(s.lead))).size,3);assert.ok(scores.every(s=>s.lead.length===8&&s.lead.every(bar=>bar.length===8)));assert.ok(MUSIC_SCORES.menu.bpm<MUSIC_SCORES.stage1.bpm&&MUSIC_SCORES.stage1.bpm<MUSIC_SCORES.boss.bpm);
});
