import {
  FAMILY,
  FENDA,
  MISSIONS,
  SUPPLIES,
  type EntrySide,
  type Family,
  type Mission,
  type Motion,
} from '../game/arcade/content.ts';
import { PELAGIC_RARE_EVENT, PELAGIC_TIMED_EVENTS } from '../game/arcade/PelagicSpecialEvents.ts';
import { SUB_BOSS_NAME, createSubmarineBoss } from '../game/arcade/PelagicSubmarineBoss.ts';
import type {
  DevBossSectionSpec,
  DevBossSpec,
  DevCheckpointSpec,
  DevEventSpec,
  DevStageAdapter,
} from './types.ts';

const ALL_MOTIONS: Motion[] = [
  'straight',
  'diagonal',
  'curve',
  'sine',
  'zigzag',
  'turn',
  'dive',
  'accelerate',
  'retreat',
  'stationary',
  'side-cross',
  'side-curve',
];

const REGION_START_TIMES_UP = [0, 45, 90, 135, 148, 200, 255] as const;
const REGION_START_TIMES_SIDE = [0, 45, 90, 135, 155, 200, 255] as const;

function buildCheckpointsForMission(mission: Mission): DevCheckpointSpec[] {
  const checkpoints: DevCheckpointSpec[] = [];
  const starts = mission.perspective === 'UP' ? REGION_START_TIMES_UP : REGION_START_TIMES_SIDE;
  mission.regions.forEach((regName, idx) => {
    const at = starts[idx] ?? idx * 45;
    const isMini = mission.perspective !== 'UP' && idx === 4;
    checkpoints.push({
      id: `stage-${mission.id}-reg-${idx}`,
      label: idx === 0 ? `Início (${regName})` : isMini ? `Miniboss (${regName})` : regName,
      atSeconds: at,
      regionIndex: idx,
      regionName: regName,
      kind: idx === 0 ? 'start' : isMini ? 'miniboss' : 'region',
    });
  });
  checkpoints.push({
    id: `stage-${mission.id}-boss`,
    label: `Boss Final (${mission.boss})`,
    atSeconds: 300,
    regionIndex: Math.max(0, mission.regions.length - 1),
    regionName: mission.regions[mission.regions.length - 1] ?? mission.name,
    kind: 'boss',
  });
  return checkpoints;
}

function buildSubmarineSections(): DevBossSectionSpec[] {
  let seq = 0;
  const sub = createSubmarineBoss(() => ++seq, 384);
  return sub.sections.map((sec) => ({
    index: sec.index,
    id: `colosso-sec-${sec.index}`,
    name: `Seção ${sec.index + 1}: ${sec.name}`,
    radio: sec.radio,
    hullMaxHp: sec.hullMaxHp,
    partCount: sec.parts.length,
  }));
}

function buildBossesForMission(mission: Mission, missionIndex: number): DevBossSpec[] {
  const mainSections: DevBossSectionSpec[] =
    mission.perspective === 'UP' && mission.boss === SUB_BOSS_NAME
      ? buildSubmarineSections()
      : [{ index: 0, id: `boss-${mission.id}-main`, name: 'Confronto Principal', radio: '', hullMaxHp: 600, partCount: 3 }];

  const bosses: DevBossSpec[] = [];
  if (mission.perspective !== 'UP') {
    const miniName = 'PATRULHA PESADA AÉREA';
    bosses.push({
      id: `stage-${mission.id}-miniboss`,
      stageId: mission.id,
      missionIndex,
      name: miniName,
      mini: true,
      sections: [{ index: 0, id: `mini-${mission.id}`, name: miniName, radio: '', hullMaxHp: 285, partCount: 3 }],
    });
  }
  bosses.push({
    id: `stage-${mission.id}-boss`,
    stageId: mission.id,
    missionIndex,
    name: mission.boss,
    mini: false,
    sections: mainSections,
  });
  return bosses;
}

function buildEventsForMission(mission: Mission, missionIndex: number): DevEventSpec[] {
  const events: DevEventSpec[] = [];

  if (mission.perspective === 'UP') {
    const archSteps = [
      { stage: 'approach', label: 'Arco das Marés — 1. Aproximação', at: 148 },
      { stage: 'descent', label: 'Arco das Marés — 2. Descida Automática', at: 153 },
      { stage: 'low-flight', label: 'Arco das Marés — 3. Voo Baixo & Combate', at: 162 },
      { stage: 'under-arch', label: 'Arco das Marés — 4. Passagem Sob o Arco', at: 173 },
      { stage: 'ascent', label: 'Arco das Marés — 5. Subida Automática', at: 177 },
      { stage: 'checkpoint', label: 'Arco das Marés — 6. Checkpoint Alcançado', at: 181 },
    ] as const;
    for (const st of archSteps) {
      events.push({
        id: `stage-${mission.id}-arch-${st.stage}`,
        stageId: mission.id,
        missionIndex,
        name: st.label,
        atSeconds: st.at,
        kind: 'special-event',
        description: `Inicia etapa real '${st.stage}' do Arco das Marés`,
        trigger(scene) {
          scene.devJumpTideArch(st.stage);
          return `${st.label} ativada em ${mission.name}.`;
        },
      });
    }
    for (const spec of [...PELAGIC_TIMED_EVENTS, PELAGIC_RARE_EVENT]) {
      events.push({
        id: `stage-${mission.id}-special-${spec.id}`,
        stageId: mission.id,
        missionIndex,
        name: `Evento Especial: ${spec.id}`,
        atSeconds: spec.at,
        kind: 'special-event',
        description: spec.radio.replace(/\n/g, ' '),
        trigger(scene) {
          if (!scene.world || scene.getCurrentMissionIndex() !== missionIndex || scene.screen !== 'play') {
            scene.devJumpToCheckpoint(missionIndex, Math.max(5, spec.at - 1), { pauseDirector: true });
          }
          scene.world!.triggerSpecialEvent(spec.id, true);
          return `Evento especial '${spec.id}' acionado em ${mission.name}.`;
        },
      });
    }
  }

  for (const sup of SUPPLIES) {
    events.push({
      id: `stage-${mission.id}-supply-${sup.at}-${sup.kind}`,
      stageId: mission.id,
      missionIndex,
      name: `Suprimento ${sup.kind.toUpperCase()} (${sup.at}s)`,
      atSeconds: sup.at,
      kind: 'supply',
      description: `Cápsula de ${sup.kind} na rota`,
      trigger(scene) {
        if (!scene.world || scene.getCurrentMissionIndex() !== missionIndex || scene.screen !== 'play') {
          scene.devJumpToCheckpoint(missionIndex, sup.at, { pauseDirector: true });
        }
        scene.world!.devSpawnCargoItem(sup.kind);
        return `Suprimento ${sup.kind.toUpperCase()} gerado em ${mission.name}.`;
      },
    });
  }

  mission.encounters.forEach((enc, idx) => {
    events.push({
      id: `stage-${mission.id}-enc-${idx}`,
      stageId: mission.id,
      missionIndex,
      name: `Encontro #${idx + 1}: ${enc.family} (${enc.formation}, ${enc.at}s)`,
      atSeconds: enc.at,
      kind: 'encounter',
      description: `motion=${enc.motion} lane=${enc.lane}${enc.entry ? ` entry=${enc.entry}` : ''}`,
      trigger(scene) {
        scene.devStartEnemyTest(missionIndex, enc, { pauseDirector: true });
        return `Encontro #${idx + 1} (${enc.family} • ${enc.formation}) iniciado.`;
      },
    });
  });

  return events;
}

export function createPlayableStageAdapters(): DevStageAdapter[] {
  return MISSIONS.map((mission, missionIndex) => {
    const allowedFamilies = Object.keys(FAMILY) as Family[];
    const allowedEntries: EntrySide[] = mission.perspective === 'UP' ? ['top', 'left', 'right'] : ['top'];
    const allowedMotions: Motion[] =
      mission.perspective === 'UP'
        ? ALL_MOTIONS
        : ALL_MOTIONS.filter((m) => m !== 'side-cross' && m !== 'side-curve');

    return {
      stageId: mission.id,
      missionIndex,
      name: mission.name,
      perspective: mission.perspective,
      durationSeconds: 300,
      checkpoints: buildCheckpointsForMission(mission),
      bosses: buildBossesForMission(mission, missionIndex),
      events: buildEventsForMission(mission, missionIndex),
      allowedFamilies,
      allowedMotions,
      allowedEntries,
    };
  });
}

export { FENDA };
