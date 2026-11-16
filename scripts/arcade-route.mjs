import {ArcadeWorld} from '../src/game/arcade/ArcadeWorld.ts';
import {MISSIONS} from '../src/game/arcade/content.ts';
import {computeArchOpening} from '../src/game/arcade/PelagicTideArch.ts';
import {stageFlightSnapshot} from '../src/game/systems/campaignFlight.ts';
import {writeFileSync,mkdirSync} from 'node:fs';

/** Deterministic practice pilot. Results are simulations, never claimed as human playtests. */
export function steer(w,{collect=true,evade=true,special=true}={}){
 const archOpening=w.up&&w.tideArch?.isActive?computeArchOpening(w.arena.left,w.arena.right):null;
 const minSafeX=archOpening?archOpening.left+28:w.arena.left+14;
 const maxSafeX=archOpening?archOpening.right-28:w.arena.right-14;
 let tx=w.up?w.arenaCenterX:100,ty=w.up?355:218;
 const p=w.player,b=w.boss;
 const parts=b?.phase==='fight'?b.parts.filter(p=>p.hp>0):[];
 if(parts.length){const part=[...parts].sort((a,b)=>Math.abs((w.up?a.x:a.y)-(w.up?p.x:p.y))-Math.abs((w.up?b.x:b.y)-(w.up?p.x:p.y)))[0];tx=w.up?part.x:Math.min(470,part.x-155);ty=w.up?(b?.sub?372:Math.min(385,part.y+125)):part.y;}
 else if(b?.sub?.phase==='fight'&&b.sub.sections[b.sub.activeSection].hullHp>0){tx=b.x;ty=372;}
 else {const target=w.enemies.filter(e=>w.up?e.y<p.y-20:e.x>p.x+20).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(target){tx=w.up?Math.max(minSafeX,Math.min(maxSafeX,target.x)):100;ty=w.up?355:target.y;}}
 if(collect&&!b){const cargo=w.cargo.filter(c=>c.age<22&&c.x>w.arena.left&&c.x<w.arena.right&&c.y>w.arena.top+20&&c.y<w.arena.bottom).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(cargo){tx=w.up?Math.max(minSafeX,Math.min(maxSafeX,cargo.x)):cargo.crate?Math.max(50,cargo.x-100):cargo.x;ty=w.up?(cargo.crate?Math.min(390,cargo.y+90):cargo.y):cargo.y;}}
 const obstacles=w.obstacles.filter(o=>o.x>p.x-30&&o.x<p.x+130);for(const o of obstacles)if(Math.abs(ty-o.y)<o.height/2+35)ty=o.y<210?o.y+o.height/2+55:o.y-o.height/2-55;
 let best={x:0,y:0},score=Infinity;
 const clx=(v)=>Math.max(w.arena.left+14,Math.min(w.arena.right-14,v)),cly=(v)=>Math.max(w.arena.top+16,Math.min(w.arena.bottom-15,v));
 const candidates=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]];
 for(const[x,y]of candidates){const cx=clx(p.x+x*174*.22),cy=cly(p.y+y*174*.22);let cost=Math.hypot(cx-tx,cy-ty)*(b?.sub?.phase==='fight'?.45:.8);
  if(evade){for(const bullet of w.bullets){if(!bullet.active||!bullet.enemy)continue;for(const t of[.02,.06,.14,.24,.36]){const d=Math.hypot(bullet.x+bullet.vx*t-clx(p.x+x*174*t),bullet.y+bullet.vy*t-cly(p.y+y*174*t));if(d<bullet.radius+16)cost+=850/(d+1);}}
   for(const e of w.enemies)if(!e.ground){for(const t of[.04,.12,.22]){const ey=e.y+(w.up?e.speed*.65:0)*t;const d=Math.hypot(e.x-clx(p.x+x*174*t),ey-cly(p.y+y*174*t));if(d<e.size/2+18)cost+=600/(d+1);}}
   for(const o of w.obstacles)if(Math.abs(cx-o.x)<o.width/2+12&&Math.abs(cy-o.y)<o.height/2+15)cost+=3000;
  }
  if(archOpening&&(cx<archOpening.left+16||cx>archOpening.right-16))cost+=3000;
  if(cost<score){score=cost;best={x,y};}
 }
 const danger=w.bullets.filter(b=>b.active&&b.enemy&&Math.hypot(b.x-p.x,b.y-p.y)<48).length;
 const manualTap=Math.floor(w.elapsed*1000)%290<45;
 return{...best,fire:manualTap,special:special&&w.specialTime<=0&&w.weapons.specialCharges>0&&(danger>4||!b?.sub&&!!parts.length&&(w.up?Math.abs(tx-p.x):Math.abs(ty-p.y))<15)};
}
export function runRoute(index,options={},carry){const w=new ArcadeWorld(MISSIONS[index],carry);w.hard=!!options.hard;let maxBullets=0,maxActors=0,bossStart=0,miniStart=0,miniEnd=0,lastMini=false;const levels=[],events={};
 for(let i=0;i<120*560;i++){
  const input=steer(w,options);if(options.invincible)w.player.invulnerable=1;
  w.step(1/120,input);
  for(const e of w.events){events[e.type]=(events[e.type]??0)+1;if(e.type==='boss')bossStart=w.elapsed;if(e.type==='mini')miniStart=w.elapsed;}w.events=[];
  if(lastMini&&!w.boss?.mini)miniEnd=w.elapsed;lastMini=!!w.boss?.mini;
  if(!levels.length||levels.at(-1).level!==w.weapons.weaponLevel)levels.push({at:Math.round(w.elapsed*10)/10,level:w.weapons.weaponLevel});
  maxBullets=Math.max(maxBullets,w.bullets.filter(b=>b.active).length);maxActors=Math.max(maxActors,w.enemies.length);
  if(w.state==='victory'||w.state==='defeat')break;
 }
 return{world:w,result:{mission:index+1,state:w.state,seconds:w.elapsed,lives:w.lives,deaths:w.deaths,score:w.score,collected:w.collected,level:w.weapons.weaponLevel,power:w.weapons.powerMeter,specials:w.weapons.specialCharges,bossStart,miniSeconds:miniEnd-miniStart,maxBullets,maxActors,levels,events,options}};
}
if(process.argv[1]?.endsWith('arcade-route.mjs')){
 const reports=[];let carry;
 for(const index of(process.argv.includes('--phase1')?[0]:[0,1])){const {world,result}=runRoute(index,{},carry);reports.push(result);if(world.state==='victory')carry=stageFlightSnapshot(index+1,world.weapons,world.lives,world.score);}
 mkdirSync('tmp/arcade',{recursive:true});writeFileSync('tmp/arcade/routes.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
}
