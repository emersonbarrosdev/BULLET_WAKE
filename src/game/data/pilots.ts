/**
 * T06 — pilotos aprovados. Valores iniciais para balanceamento de gameplay.
 * Visual da nave e especiais serão implementados nas etapas de arte e T07.
 */
export type PilotId = 'nolan' | 'cora' | 'harlan' | 'lyra' | 'bento';

export interface PilotDefinition {
  id: PilotId;
  name: string;
  callsign: string;
  shipName: string;
  role: string;
  specialName: string;
  specialDescription: string;
  bio: string;
  portraitKey: string;
  speed: number;
  shotsPerSecond: number;
  damage: number;
  hullColor: number;
  accentColor: number;
  projectileColor: number;
}

export const PILOTS: readonly PilotDefinition[] = [
  {
    id: 'nolan',
    name: 'Terry',
    callsign: 'CORRIDOR VANGUARD',
    shipName: 'Rivet',
    role: 'DISPERSÃO AZUL',
    specialName: 'TEMPESTADE PRISMATICA',
    specialDescription: 'Três salvas de bombardeio prismático: varredura da arena, impactos e proteção temporária.',
    bio: 'Desonrado por abandonar uma ordem e salvar civis, procura o irmão que o comando declarou perdido.',
    portraitKey: 'portrait-nolan',
    speed: 190,
    shotsPerSecond: 8,
    damage: 1,
    hullColor: 0x263447,
    accentColor: 0x61d7da,
    projectileColor: 0x61d7da,
  },
  {
    id: 'cora',
    name: 'Tita',
    callsign: 'WAKE WEAVER',
    shipName: 'Moth',
    role: 'ONDAS ESPIRAIS',
    specialName: 'SALTO FANTASMA',
    specialDescription: 'Deslocamento de fase invulnerável com pós-imagens e dano por contato.',
    bio: 'Ouve a voz da mãe desaparecida nos sinais da invasão. Quer encontrá-la sem entregar o planeta em troca.',
    portraitKey: 'portrait-cora',
    speed: 215,
    shotsPerSecond: 6,
    damage: 1.33,
    hullColor: 0x35536a,
    accentColor: 0x82e0da,
    projectileColor: 0x9bf5e6,
  },
  {
    id: 'harlan',
    name: 'Osvald',
    callsign: 'IRON BULWARK',
    shipName: 'Knuckle',
    role: 'FLUXO RUBRO',
    specialName: 'RUPTURA NOVA',
    specialDescription: 'Detonação cinética radial que anula balas hostis e causa dano maciço.',
    bio: 'Pai e antigo mecânico de salvamento. Busca a filha levada pelos invasores e teme o que precisará destruir para resgatá-la.',
    portraitKey: 'portrait-harlan',
    speed: 175,
    shotsPerSecond: 5,
    damage: 1.6,
    hullColor: 0x35404a,
    accentColor: 0xf6be75,
    projectileColor: 0xffb56e,
  },
  {
    id:'lyra',name:'Luma',callsign:'JADE SENTINEL',shipName:'Kestrel',role:'PRECISÃO TÁTICA',
    specialName:'COROA ORBITAL',specialDescription:'Lanças orbitais convergem sobre alvos prioritários e abrem um corredor de passagem.',
    bio:'Pilota por dinheiro para salvar a clínica da família. Procura o pai e descobre que fama não substitui quem volta para casa.',
    portraitKey:'portrait-lyra',speed:200,shotsPerSecond:6.4,damage:1.25,
    hullColor:0xd8dfd5,accentColor:0x66e5aa,projectileColor:0x66e5aa,
  },
  {
    id:'bento',name:'Bento',callsign:'ÚLTIMO CORREIO',shipName:'Peregrine',role:'RAJADA ALTERNADA',
    specialName:'CHUVA DE COMETAS',specialDescription:'Uma esquadrilha remota cruza a arena em diagonais, suprimindo projéteis e bombardeando alvos.',
    bio:'Ex-contrabandista e carteiro de emergência. Procura a esposa desaparecida levando cartas de famílias que se recusa a declarar perdidas.',
    portraitKey:'portrait-bento',speed:195,shotsPerSecond:7,damage:8/7,
    hullColor:0xe4deba,accentColor:0x68baff,projectileColor:0x86caff,
  },
];

export function getPilot(id: string | undefined): PilotDefinition {
  return PILOTS.find(pilot => pilot.id === id) ?? PILOTS[0];
}

export function shotIntervalMs(pilot: PilotDefinition): number {
  return 1000 / pilot.shotsPerSecond;
}
