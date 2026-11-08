/**
 * T06 — pilotos aprovados. Valores iniciais para balanceamento de gameplay.
 * Visual da nave e especiais serão implementados nas etapas de arte e T07.
 */
export type PilotId = 'nolan' | 'cora' | 'harlan';

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
    name: 'Nolan Fitch',
    callsign: 'CORRIDOR VANGUARD',
    shipName: 'Rivet',
    role: 'FOGO SUSTENTADO',
    specialName: 'TEMPESTADE PRISMATICA',
    specialDescription: 'Rajada de 3 feixes prismáticos contínuos de alta perfuração.',
    bio: 'Especialista militar em fogo de contenção e defesa de comboios de evacuação.',
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
    name: 'Cora Wren',
    callsign: 'WAKE WEAVER',
    shipName: 'Moth',
    role: 'ALTA AGILIDADE',
    specialName: 'SALTO FANTASMA',
    specialDescription: 'Dash ultrassônico invulnerável com pós-imagens e dano por contato.',
    bio: 'Navegadora de vanguarda com leitura precisa de fendas e anomalias do Wake.',
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
    name: 'Harlan Greer',
    callsign: 'IRON BULWARK',
    shipName: 'Knuckle',
    role: 'IMPACTO PESADO',
    specialName: 'RUPTURA NOVA',
    specialDescription: 'Detonação cinética radial que anula balas hostis e causa dano maciço.',
    bio: 'Veterano calmo com décadas de experiência em blindagens pesadas e hardware industrial.',
    portraitKey: 'portrait-harlan',
    speed: 175,
    shotsPerSecond: 5,
    damage: 1.6,
    hullColor: 0x35404a,
    accentColor: 0xf6be75,
    projectileColor: 0xffb56e,
  },
];

export function getPilot(id: string | undefined): PilotDefinition {
  return PILOTS.find(pilot => pilot.id === id) ?? PILOTS[0];
}

export function shotIntervalMs(pilot: PilotDefinition): number {
  return 1000 / pilot.shotsPerSecond;
}
