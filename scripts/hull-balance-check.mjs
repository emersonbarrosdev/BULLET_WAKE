import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import { HULL_REPAIR_OPPORTUNITY } from '../src/game/arcade/HullIntegrity.ts';
import { PILOT_IDS } from '../src/game/arcade/ArcadeContracts.ts';
import { steer } from './arcade-route.mjs';

const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const pilots = option('pilots', 'nolan').split(',');
const capacities = option('hulls', '3,4,5').split(',').map(Number);
const difficulties = option('difficulties', 'easy,normal,hard').split(',');
const hz = Number(option('hz', '120'));
if (!pilots.every(pilot => PILOT_IDS.includes(pilot)) || !capacities.every(value => [3, 4, 5].includes(value)) ||
    !difficulties.every(value => ['easy', 'normal', 'hard'].includes(value)) || ![30, 60, 120].includes(hz)) {
  throw new Error('Use known --pilots, --hulls=3,4,5, --difficulties=easy,normal,hard and --hz=30|60|120');
}
const round = value => Math.round(value * 1000) / 1000;
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const results = [];
for (const pilotId of pilots) for (const maximum of capacities) for (const difficulty of difficulties) for (const mission of MISSIONS.slice(0, 2)) {
  const w = new ArcadeWorld(mission, undefined, { pilotId, maxHull: maximum, survivalRule: 'hull-v1', difficulty, upLayout: 'pc', seed: 1337 });
  let controls = { x: 0, y: 0, fire: false, special: false };
  let simulatedSeconds = 0, bossSeconds = 0;
  const dt = 1 / hz, steeringEvery = Math.max(1, Math.round(hz / 30));
  const repairDeliveries = new Set();
  const transitions = [];
  let previousHull = w.hull, previousLevel = w.weapons.weaponLevel;
  for (let frame = 0; frame < 600 * hz && w.state !== 'victory' && w.state !== 'defeat'; frame++) {
    if (frame % steeringEvery === 0) controls = steer(w);
    if (w.boss && !w.boss.mini && w.state === 'play') bossSeconds += dt;
    w.step(dt, controls);
    simulatedSeconds += dt;
    for (const cargo of w.cargo) if (cargo.kind === 'repair' && cargo.drone) repairDeliveries.add(cargo.id);
    if (w.hull !== previousHull || w.weapons.weaponLevel !== previousLevel) {
      transitions.push({ seconds: round(w.elapsed), hull: w.hull, power: w.weapons.weaponLevel });
      previousHull = w.hull; previousLevel = w.weapons.weaponLevel;
    }
    w.events.length = 0;
  }
  const recovery = w.powerRecoverySeconds.map(round);
  const result = {
    missionId: mission.id, perspective: mission.perspective, pilotId, difficulty, maxHull: maximum,
    survivalRule: w.survivalRule, seed: w.seed, hz, steeringHz: 30, state: w.state, win: w.state === 'victory',
    timedOut: w.state !== 'victory' && w.state !== 'defeat', simulatedSeconds: round(simulatedSeconds), elapsedSeconds: round(w.elapsed),
    routeSeconds: round(w.route), progress: round(w.progressRatio), score: w.score, hullRemaining: w.hull,
    deaths: w.deaths, hits: w.hitsReceived, repairsCollected: w.repairsCollected, repairDeliveriesSeen: repairDeliveries.size,
    criticalSeconds: round(w.criticalSeconds), meanPower: w.elapsed > 0 ? round(w.powerLevelSeconds / w.elapsed) : 1,
    finalPower: w.weapons.weaponLevel, bossSeconds: round(bossSeconds), recoverySeconds: recovery,
    meanRecoverySeconds: average(recovery) === null ? null : round(average(recovery)), transitions,
  };
  results.push(result);
  console.log(JSON.stringify({ pilotId, missionId: mission.id, difficulty, maxHull: maximum, state: result.state,
    seconds: result.elapsedSeconds, hits: result.hits, repairs: result.repairsCollected, meanPower: result.meanPower }));
}
const byCapacity = capacities.map(maxHull => {
  const runs = results.filter(run => run.maxHull === maxHull);
  return { maxHull, runs: runs.length, wins: runs.filter(run => run.win).length, timeouts: runs.filter(run => run.timedOut).length,
    meanHits: round(average(runs.map(run => run.hits))), meanRepairs: round(average(runs.map(run => run.repairsCollected))),
    meanProgress: round(average(runs.map(run => run.progress))), meanPower: round(average(runs.map(run => run.meanPower))) };
});
const report = {
  generatedAt: new Date().toISOString(), method: 'Deterministic arcade-route steer bot; no invulnerability, continues, checkpoint jumps or forced pickups.',
  humanLimitations: [
    'These are automated simulations, not human playtests or evidence that a difficulty is fair for humans.',
    'Steering inspects current simulation entities and predicts projectile positions; people cannot access this exact information.',
    'The existing steering policy was designed for classic survival and may miss repair drones or choose unsafe collection paths.',
    'One fixed seed per combination cannot establish population win rates, accessibility or pilot learning curves.',
    'The default run uses Nolan only; --pilots=nolan,cora,lyra,harlan,bento expands the matrix. Unit tests separately cover all five pilots.',
    'No rendering, audio, device latency or visual readability is evaluated.',
  ],
  configuration: { pilots, capacities, difficulties, missions: [1, 2], hz, steeringHz: 30, timeLimitSeconds: 600,
    extraRepairOpportunitySeconds: HULL_REPAIR_OPPORTUNITY, recommendedCapacity: null },
  byCapacity, results,
};
const destination = resolve('docs/screenshots/hull/balance-report.json');
mkdirSync(resolve('docs/screenshots/hull'), { recursive: true });
writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: destination, byCapacity }));
