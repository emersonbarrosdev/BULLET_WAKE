/**
 * T06 — pilotos aprovados. Valores iniciais para balanceamento de gameplay.
 * Visual da nave e especiais serão implementados nas etapas de arte e T07.
 */
export type PilotId = 'nolan' | 'cora' | 'harlan';

export interface PilotDefinition {
  id: PilotId;
  name: string;
  shipName: string;
  role: string;
  specialName: string;
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
    shipName: 'Rivet',
    role: 'CADENCIA',
    specialName: 'TEMPESTADE PRISMATICA',
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
    shipName: 'Moth',
    role: 'AGILIDADE',
    specialName: 'SALTO FANTASMA',
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
    shipName: 'Knuckle',
    role: 'POTENCIA',
    specialName: 'RUPTURA NOVA',
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
