import {
  FAMILY,
  FENDA,
  MISSIONS,
  type EntrySide,
  type Family,
  type Mission,
  type Motion,
} from '../game/arcade/content.ts';
import { buildMissionStageEvents } from '../game/arcade/ArcadeStageDirector.ts';
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
  return buildMissionStageEvents(mission, missionIndex).map((def) => ({
    id: def.id,
    stageId: def.stageId,
    missionIndex: def.missionIndex,
    name: def.name,
    triggerKind: def.triggerKind,
    atSeconds: def.atSeconds,
    preJumpSeconds: def.preJumpSeconds,
    conditionLabel: def.conditionLabel,
    dependencies: def.dependencies,
    entities: def.entities,
    repeatPolicy: def.repeatPolicy,
    kind: def.category,
    description: def.description,
    trigger(scene, opts) {
      return scene.devRunStageEvent(missionIndex, def.id, opts).message;
    },
  }));
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
