/** The new campaign is authored in seconds, not padded by spawn timers. */
export type Perspective = 'UP' | 'SIDE';
export type StageKind = 'main' | 'extra' | 'secret' | 'remix';
export type Motion = 'straight'|'diagonal'|'curve'|'sine'|'zigzag'|'turn'|'dive'|'accelerate'|'retreat'|'stationary';
export type Formation = 'solo'|'pair'|'trio'|'quartet'|'v'|'stagger'|'horde'|'escort'|'pincer'|'successive';
export type Family = 'fighter'|'interceptor'|'acrobat'|'bomber'|'boat'|'ship'|'tank'|'tower'|'airship'|'alien';
export interface Encounter {at:number; family:Family; formation:Formation; motion:Motion; lane:number; speed?:number;}
export interface Mission {id:number; name:string; perspective:Perspective; kind:StageKind; allowedPilots:string[]; boss:string; regions:string[]; encounters:Encounter[];}
const wave=(at:number,family:Family,formation:Formation,motion:Motion,lane:number,speed?:number):Encounter=>({at,family,formation,motion,lane,speed});
export const FENDA:Mission={id:1,name:'FENDA PELÁGICA',perspective:'UP',kind:'main',allowedPilots:['nolan'],boss:'ENCOURAÇADO PULA-ONDA',regions:['CÉU ABERTO','COSTA CORAL','ARQUIPÉLAGO','CORRENTE EXPRESSA','PATRULHA NAVAL','MAR DAS TURBINAS','FENDA PELÁGICA'],encounters:[
 wave(4,'fighter','trio','straight',.3),wave(12,'acrobat','pair','curve',.7),wave(22,'fighter','v','sine',.5),wave(33,'interceptor','pair','diagonal',.2),
 wave(46,'boat','pair','stationary',.25),wave(52,'fighter','stagger','straight',.7),wave(63,'tower','solo','stationary',.85),wave(69,'acrobat','trio','turn',.4),wave(79,'ship','solo','stationary',.3),
 wave(91,'fighter','v','sine',.5),wave(101,'interceptor','pincer','diagonal',.5),wave(111,'bomber','escort','straight',.65),wave(123,'acrobat','quartet','curve',.3),
 wave(155,'ship','solo','stationary',.5),
 wave(202,'tank','pair','stationary',.2),wave(207,'fighter','horde','sine',.6),wave(217,'interceptor','pair','dive',.3),wave(226,'boat','pair','stationary',.75),wave(233,'acrobat','successive','turn',.5),wave(244,'bomber','escort','retreat',.35),
 wave(256,'fighter','v','accelerate',.5),wave(264,'interceptor','pincer','diagonal',.5),wave(271,'acrobat','quartet','zigzag',.45),wave(279,'bomber','pair','straight',.65),
]};
export const SOLAR:Mission={id:2,name:'CIDADE SOLAR',perspective:'SIDE',kind:'main',allowedPilots:['nolan'],boss:'MEGA DIRIGÍVEL GIRO',regions:['HORIZONTE SOLAR','AVENIDA AÉREA','PONTES DO AMANHÃ','VIA EXPRESSA','ESCOLTA GIRO','DISTRITO DAS CORES','ALTOS DA CIDADE'],encounters:[
 wave(4,'fighter','pair','sine',.35),wave(14,'acrobat','trio','curve',.65),wave(26,'interceptor','pair','diagonal',.3),wave(36,'fighter','stagger','straight',.55),
 wave(47,'tank','pair','stationary',.9),wave(54,'bomber','escort','straight',.25),wave(65,'tower','solo','stationary',.9),wave(73,'acrobat','quartet','turn',.45),wave(83,'interceptor','pair','dive',.2),
 wave(94,'fighter','trio','straight',.35),wave(107,'acrobat','pair','sine',.55),wave(120,'fighter','stagger','curve',.4),
 wave(155,'ship','solo','stationary',.45),
 wave(202,'tower','pair','stationary',.9),wave(209,'interceptor','pincer','diagonal',.5),wave(220,'bomber','escort','retreat',.35),wave(231,'acrobat','successive','zigzag',.5),wave(244,'tank','pair','stationary',.9),
 wave(256,'fighter','horde','sine',.5),wave(265,'interceptor','quartet','accelerate',.4),wave(273,'bomber','pair','straight',.7),wave(280,'acrobat','trio','turn',.3),
]};
export const MISSIONS=[FENDA,SOLAR];
// Authored connecting formations keep the route active without stacking every threat at once.
FENDA.encounters.push(wave(18,'fighter','pair','diagonal',.6),wave(39,'acrobat','pair','sine',.3),wave(58,'interceptor','pair','straight',.5),wave(85,'fighter','trio','curve',.65),wave(107,'fighter','pair','straight',.75),wave(137,'fighter','pair','accelerate',.3),wave(146,'acrobat','pair','curve',.7),wave(174,'boat','pair','stationary',.3),wave(184,'fighter','quartet','sine',.5),wave(195,'interceptor','pair','diagonal',.65),wave(213,'acrobat','pair','turn',.7),wave(239,'fighter','trio','curve',.6),wave(289,'fighter','v','straight',.5),wave(296,'interceptor','pair','diagonal',.5));
FENDA.encounters.push(wave(74,'alien','pair','sine',.55),wave(229,'alien','pair','retreat',.4));
FENDA.encounters.sort((a,b)=>a.at-b.at);
SOLAR.encounters.push(wave(20,'fighter','pair','turn',.7),wave(42,'acrobat','pair','curve',.25),wave(59,'boat','pair','sine',.65),wave(87,'fighter','pair','straight',.5),wave(116,'interceptor','pair','diagonal',.5),wave(138,'fighter','trio','accelerate',.4),wave(147,'acrobat','pair','curve',.65),wave(175,'boat','pair','sine',.35),wave(185,'fighter','v','straight',.65),wave(196,'interceptor','pair','dive',.3),wave(215,'fighter','pair','turn',.65),wave(237,'ship','solo','retreat',.25),wave(250,'acrobat','trio','curve',.55),wave(289,'interceptor','quartet','straight',.3),wave(297,'fighter','pair','sine',.7));
for(const e of SOLAR.encounters)if(e.family==='boat'||e.family==='ship'&&e.at!==155)e.family='airship';
SOLAR.encounters.push(wave(77,'alien','pair','sine',.45),wave(227,'alien','pair','retreat',.3));
SOLAR.encounters.sort((a,b)=>a.at-b.at);
/** Reserved data is deliberately not a playable/unlocked mission. */
export const FUTURE_ROUTES=[{id:'secret-side',kind:'secret',perspective:'SIDE',duration:120,unlock:null},{id:'secret-up-a',kind:'secret',perspective:'UP',duration:180,unlock:null},{id:'secret-up-b',kind:'secret',perspective:'UP',duration:180,unlock:null},{id:'sixth-campaign',kind:'extra',perspective:'SIDE',unlock:'campaign-complete'},{id:'remix',kind:'remix',perspective:null,unlock:null}] as const;
export const SUPPLIES=[{at:18,kind:'power'},{at:42,kind:'power'},{at:68,kind:'power'},{at:94,kind:'power'},{at:118,kind:'power'},{at:145,kind:'special'},{at:201,kind:'power'},{at:219,kind:'power'},{at:239,kind:'life'},{at:253,kind:'power'},{at:275,kind:'power'}] as const;
export const FAMILY={fighter:{hp:2,size:29,score:160,fire:2.4},interceptor:{hp:3,size:31,score:220,fire:1.8},acrobat:{hp:3,size:30,score:200,fire:2.8},bomber:{hp:16,size:49,score:700,fire:2.1},boat:{hp:11,size:41,score:600,fire:2.5},ship:{hp:25,size:63,score:1200,fire:2.3},tank:{hp:12,size:34,score:500,fire:2.6},tower:{hp:14,size:36,score:550,fire:2.2},airship:{hp:18,size:57,score:950,fire:2.6},alien:{hp:5,size:32,score:350,fire:2.9}} satisfies Record<Family,{hp:number;size:number;score:number;fire:number}>;
export function regionAt(time:number):number{return time<45?0:time<90?1:time<135?2:time<155?3:time<200?4:time<255?5:6;}
export function formationOffsets(f:Formation):[number,number][]{
 switch(f){case'solo':return[[0,0]];case'pair':return[[-.12,0],[.12,0]];case'trio':return[[-.17,0],[0,.1],[.17,0]];case'quartet':return[[-.21,0],[-.07,.08],[.07,.08],[.21,0]];case'v':return[[-.28,-.16],[-.14,-.08],[0,0],[.14,-.08],[.28,-.16]];case'stagger':return[[-.18,0],[-.06,-.12],[.06,-.24],[.18,-.36]];case'horde':return Array.from({length:8},(_,i)=>[(i%4-1.5)*.13,-Math.floor(i/4)*.18]);case'escort':return[[0,0],[-.17,-.1],[.17,-.1]];case'pincer':return[[-.35,0],[.35,0]];case'successive':return[[0,0],[.12,-.22],[-.12,-.44],[0,-.66]];}
}
