import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDashState,
  triggerDash,
  advanceDash,
  isDashActive,
  isDashInvulnerable,
  formatDashDots,
  MAX_STAGE_DASHES,
} from '../src/game/systems/dashSystem.ts';
import {
  createPlayerWeapons,
  upgradeWeapon,
  collectPowerItem,
  collectFullPowerItem,
  switchWeaponFamily,
  getPrimaryProjectiles,
  getChargedProjectiles,
  recordPrimaryShot,
  updateWeaponCharge,
  releaseWeaponCharge,
  MAX_WEAPON_LEVEL,
  POWER_ITEMS_PER_LEVEL,
} from '../src/game/systems/weaponSystem.ts';
import {
  LASER_RUBRO_SPECS,
  LASER_DAMAGE_TICK_MS,
  createInitialCrimsonLaserState,
  computeLaserBeams,
  stepCrimsonLaser,
} from '../src/game/systems/crimsonLaserSystem.ts';
import { processInputFrame } from '../src/game/systems/inputSystem.ts';
import { PickupSystem, determineEnemyDrop } from '../src/game/systems/pickupSystem.ts';
import { MinibossRaiaDente } from '../src/game/systems/bosses/minibossRaiaDente.ts';
import { BossTalassarca } from '../src/game/systems/bosses/bossTalassarca.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH, PLAYFIELD_RIGHT } from '../src/game/constants.ts';

// ============================================================================
// 1. REQUISITO V2: DASH DE EMERGÊNCIA (EXATAMENTE 3 POR FASE, SEM REGENERAÇÃO)
// ============================================================================
test('V2 Dash: Exatamente 3 cargas por fase, sem regeneração passiva ou por tempo', () => {
  let dash = createInitialDashState();
  assert.equal(dash.remainingDashes, 3, 'Inicia estritamente com 3 cargas');
  assert.equal(formatDashDots(dash.remainingDashes), '◆ ◆ ◆');

  // Primeiro dash
  let res1 = triggerDash(dash);
  assert.equal(res1.triggered, true);
  dash = res1.state;
  assert.equal(dash.remainingDashes, 2);
  assert.equal(isDashActive(dash), true);
  assert.equal(isDashInvulnerable(dash), true);
  assert.equal(formatDashDots(dash.remainingDashes), '◆ ◆ ◇');

  // Avança o tempo após o dash terminar (600ms)
  dash = advanceDash(dash, 600);
  assert.equal(isDashActive(dash), false);
  assert.equal(isDashInvulnerable(dash), false);
  assert.equal(dash.remainingDashes, 2, 'Cargas NÃO se regeneram com o tempo');

  // Segundo dash
  let res2 = triggerDash(dash);
  assert.equal(res2.triggered, true);
  dash = res2.state;
  assert.equal(dash.remainingDashes, 1);
  assert.equal(formatDashDots(dash.remainingDashes), '◆ ◇ ◇');
  dash = advanceDash(dash, 600);

  // Terceiro dash
  let res3 = triggerDash(dash);
  assert.equal(res3.triggered, true);
  dash = res3.state;
  assert.equal(dash.remainingDashes, 0);
  assert.equal(formatDashDots(dash.remainingDashes), '◇ ◇ ◇');
  dash = advanceDash(dash, 600);

  // Quarta tentativa sem cargas: deve falhar
  let res4 = triggerDash(dash);
  assert.equal(res4.triggered, false, 'Sem cargas restantes, o dash deve ser recusado');
  dash = res4.state;
  assert.equal(dash.remainingDashes, 0);

  // Simulação de 10 segundos adicionais: nunca recupera
  dash = advanceDash(dash, 10000);
  assert.equal(dash.remainingDashes, 0, 'Zero regeneração por tempo');
});

// ============================================================================
// 2. REQUISITO V2: SISTEMA DE ARMAS FIRE SHARK (3 FAMÍLIAS DISTINTAS + 3 ITENS P)
// ============================================================================
test('V2 Armas: Três famílias distintas (Raio Esmeralda, Dispersão Azul, Laser Rubro) LV1–LV4', () => {
  // 1. Arma Verde: RAIO ESMERALDA (feixes ondulantes/sinusoidais concentrados)
  const g1 = getPrimaryProjectiles('green', 1, 384, 350);
  const g2 = getPrimaryProjectiles('green', 2, 384, 350);
  const g3 = getPrimaryProjectiles('green', 3, 384, 350);
  const g4 = getPrimaryProjectiles('green', 4, 384, 350);

  assert.equal(g1.length, 2, 'Raio Esmeralda LV1: 2 ondas entrelaçadas');
  assert.equal(g2.length, 4);
  assert.equal(g3.length, 6);
  assert.equal(g4.length, 8);
  assert.ok((g1[0].waveAmplitude ?? 0) > 0, 'Raio Esmeralda possui modulação ondulante');

  for (const shot of [...g1, ...g2, ...g3, ...g4]) {
    assert.ok(shot.velocityY < 0, 'Projéteis sobem para o topo da tela (-Y)');
  }

  // 2. Arma Azul: DISPERSÃO AZUL (leque amplo em mais direções por nível)
  const i1 = getPrimaryProjectiles('ion', 1, 384, 350);
  const i2 = getPrimaryProjectiles('ion', 2, 384, 350);
  const i3 = getPrimaryProjectiles('ion', 3, 384, 350);
  const i4 = getPrimaryProjectiles('ion', 4, 384, 350);
  assert.equal(i1.length, 3, 'Dispersão Azul LV1: 3 direções em leque');
  assert.equal(i2.length, 5, 'Dispersão Azul LV2: 5 direções em leque');
  assert.equal(i3.length, 9, 'Dispersão Azul LV3: 9 direções em leque');
  assert.equal(i4.length, 16, 'Dispersão Azul LV4: 16 direções em leque amplo');

  // 3. Arma Vermelha: LASER RUBRO (multifeixes contínuos: 1, 2, 4, 4 feixes)
  const r1 = getPrimaryProjectiles('red', 1, 384, 350);
  const r2 = getPrimaryProjectiles('red', 2, 384, 350);
  const r3 = getPrimaryProjectiles('red', 3, 384, 350);
  const r4 = getPrimaryProjectiles('red', 4, 384, 350);
  assert.equal(r1.length, 1, 'Laser Rubro LV1: 1 feixe frontal contínuo');
  assert.equal(r2.length, 2, 'Laser Rubro LV2: 2 feixes paralelos contínuos');
  assert.equal(r3.length, 4, 'Laser Rubro LV3: 4 feixes com varredura lateral');
  assert.equal(r4.length, 4, 'Laser Rubro LV4: 4 feixes contínuos em potência máxima');
  assert.equal(r1[0].isContinuousBeam, true, 'Laser Rubro é estritamente feixe contínuo');
});

test('V2 Medidor P (3 itens P por nível) & Bloqueio de salto de cor antes do máximo', () => {
  assert.equal(POWER_ITEMS_PER_LEVEL, 3, 'Três itens P aumentam 1 nível');
  let weapons = createPlayerWeapons('nolan');
  assert.equal(weapons.weaponLevel, 1);
  assert.equal(weapons.powerMeter, 0);
  assert.equal(weapons.weaponFamily, 'ion');

  // Coleta 1º e 2º item P -> permanece LV1, medidor P sobe para 1 e 2
  let p1 = collectPowerItem(weapons);
  assert.equal(p1.levelIncreased, false);
  assert.equal(p1.state.weaponLevel, 1);
  assert.equal(p1.state.powerMeter, 1);

  let p2 = collectPowerItem(p1.state);
  assert.equal(p2.levelIncreased, false);
  assert.equal(p2.state.weaponLevel, 1);
  assert.equal(p2.state.powerMeter, 2);

  // Coleta 3º item P -> sobe para LV2 e zera medidor P para o próximo nível!
  let p3 = collectPowerItem(p2.state);
  assert.equal(p3.levelIncreased, true);
  assert.equal(p3.state.weaponLevel, 2);
  assert.equal(p3.state.powerMeter, 0);

  // Troca para Cápsula Vermelha (Laser Rubro) no meio da progressão -> preserva LV2 e powerMeter
  weapons = switchWeaponFamily(p3.state, 'red');
  assert.equal(weapons.weaponFamily, 'ion');
  assert.equal(weapons.weaponLevel, 2);

  // Mais 3 itens P -> LV3
  weapons = collectPowerItem(weapons).state;
  weapons = collectPowerItem(weapons).state;
  const toLv3 = collectPowerItem(weapons);
  assert.equal(toLv3.levelIncreased, true);
  assert.equal(toLv3.state.weaponLevel, 3);

  // Mais 3 itens P -> LV4 (Máximo)
  weapons = collectPowerItem(toLv3.state).state;
  weapons = collectPowerItem(weapons).state;
  const toLv4 = collectPowerItem(weapons);
  assert.equal(toLv4.levelIncreased, true);
  assert.equal(toLv4.state.weaponLevel, 4);
  assert.equal(toLv4.state.powerMeter, 0);
});

test('V2 Laser Rubro: Emissão contínua, varredura lateral (LV3/LV4) e ticks de dano independentes de FPS', () => {
  // Verifica especificações canônicas dos 4 níveis
  assert.equal(LASER_RUBRO_SPECS[1].beamCount, 1);
  assert.equal(LASER_RUBRO_SPECS[1].hasLateralSweep, false);
  assert.equal(LASER_RUBRO_SPECS[2].beamCount, 2);
  assert.equal(LASER_RUBRO_SPECS[2].hasLateralSweep, false);
  assert.equal(LASER_RUBRO_SPECS[3].beamCount, 4);
  assert.equal(LASER_RUBRO_SPECS[3].hasLateralSweep, true);
  assert.equal(LASER_RUBRO_SPECS[3].hasRearCoverage, false);
  assert.equal(LASER_RUBRO_SPECS[4].beamCount, 4);
  assert.equal(LASER_RUBRO_SPECS[4].hasLateralSweep, true);
  assert.equal(LASER_RUBRO_SPECS[4].hasRearCoverage, true);
  assert.equal(LASER_RUBRO_SPECS[4].title, 'ASAS DE ENERGIA');

  // Verifica que os feixes laterais do LV3 e LV4 se movem lateralmente ao longo do tempo (phaseMs)
  const beamsT0 = computeLaserBeams(384, 340, 4, 0, 1.0);
  const beamsT1 = computeLaserBeams(384, 340, 4, 220, 1.0);
  assert.equal(beamsT0.length, 4);
  assert.equal(beamsT1.length, 4);
  // O feixe lateral externo (índice 2) deve mudar sua coordenada X no topo devido à abertura/fechamento de asas
  const topXT0 = beamsT0[1].points[beamsT0[1].points.length - 1].x;
  const topXT1 = beamsT1[1].points[beamsT1[1].points.length - 1].x;
  assert.notEqual(topXT0, topXT1, 'Feixes laterais do Laser Rubro realizam varredura oscilante real');

  // Verifica transformação geométrica do Nível 4: 2 fluxos posteriores/flanco (rear-wing) que protegem a retaguarda
  const returningWings = computeLaserBeams(384,340,4,1200).filter(b=>b.role==='lateral-sweep');
  assert.equal(returningWings.length,2);
  assert.ok(returningWings.every(b=>b.points.at(-1).y>340));

  // Item P vermelho raro (collectFullPowerItem) eleva diretamente para LV4 sem trocar a família da arma
  const greenLv1 = createPlayerWeapons('nolan', 'green');
  const fullP = collectFullPowerItem(greenLv1);
  assert.equal(fullP.upgradedToMax, true);
  assert.equal(fullP.state.weaponLevel, 4);
  assert.equal(fullP.state.weaponFamily, 'green');

  // Verifica independência de FPS nos ticks de dano (600ms a 60ms/frame vs 600ms a 10ms/frame)
  const target = [{ id: 101, kind: 'enemy', x: 384, y: 180, radius: 24, stopsBeam: false }];

  let stateLowFps = createInitialCrimsonLaserState(2);
  let totalDmgLowFps = 0;
  for (let i = 0; i < 10; i++) {
    const res = stepCrimsonLaser(stateLowFps, {
      deltaMs: 60,
      isHoldingFire: true,
      isRubyEquipped: true,
      level: 2,
      shipX: 384,
      shipY: 340,
      targets: target,
    });
    stateLowFps = res.state;
    for (const ev of res.damageEvents) totalDmgLowFps += ev.damage;
  }

  let stateHighFps = createInitialCrimsonLaserState(2);
  let totalDmgHighFps = 0;
  for (let i = 0; i < 60; i++) {
    const res = stepCrimsonLaser(stateHighFps, {
      deltaMs: 10,
      isHoldingFire: true,
      isRubyEquipped: true,
      level: 2,
      shipX: 384,
      shipY: 340,
      targets: target,
    });
    stateHighFps = res.state;
    for (const ev of res.damageEvents) totalDmgHighFps += ev.damage;
  }

  assert.ok(totalDmgLowFps > 0, 'Laser Rubro aplica dano contínuo por tick ao alvo no feixe');
  assert.ok(
    Math.abs(totalDmgLowFps - totalDmgHighFps) < 1e-6,
    `Dano por tick deve ser 100% independente de FPS (${totalDmgLowFps} vs ${totalDmgHighFps})`,
  );

  // Ao soltar SPACE, o feixe encerra com fade-out curto
  const releaseRes = stepCrimsonLaser(stateHighFps, {
    deltaMs: 120,
    isHoldingFire: false,
    isRubyEquipped: true,
    level: 2,
    shipX: 384,
    shipY: 340,
    targets: target,
  });
  assert.equal(releaseRes.state.isEmitting, false);
  assert.equal(releaseRes.state.intensity, 0);
  assert.equal(releaseRes.state.beams.length, 0);
});

// ============================================================================
// 3. REQUISITO V2: CONTROLES PC (MOUSE NÃO ATIRA E NÃO MOVE, ESPAÇO DISPARA)
// ============================================================================
test('V2 Controles: Regra Fundamental do Mouse e Comandos Oficiais', () => {
  // Teste 1: Clique do mouse no PC tem efeito ZERO
  const frameMouse = {
    keyW: false, keyA: false, keyS: false, keyD: false,
    arrowUp: false, arrowDown: false, arrowLeft: false, arrowRight: false,
    keySpace: false, keySpaceJustDown: false,
    keyShift: false, keyShiftJustDown: false,
    keyC: false, keyCJustDown: false, keyCJustUp: false,
    keyX: false, keyXJustDown: false,
    keyV: false, keyVJustDown: false,
    keyM: false, keyMJustDown: false,
    keyB: false, keyBJustDown: false,
    keyR: false, keyRJustDown: false,
    keyEsc: false, keyEscJustDown: false,
    isTouch: false, touchPointerDown: true, touchX: 500, touchY: 200,
    shipX: 384, shipY: 350,
  };
  const cmdMouse = processInputFrame(frameMouse);
  assert.equal(cmdMouse.firePrimary, false, 'Mouse no PC NÃO pode disparar');
  assert.equal(cmdMouse.moveX, 0, 'Mouse no PC NÃO pode mover a nave');
  assert.equal(cmdMouse.moveY, 0, 'Mouse no PC NÃO pode mover a nave');

  // Teste 2: Tecla Espaço dispara com precisão
  const frameSpace = { ...frameMouse, touchPointerDown: false, keySpace: true, keySpaceJustDown: true };
  const cmdSpace = processInputFrame(frameSpace);
  assert.equal(cmdSpace.firePrimary, true);
  assert.equal(cmdSpace.firePrimaryTap, true);

  // Teste 3: Left Shift aciona dashTrigger
  const frameShift = { ...frameMouse, touchPointerDown: false, keyShift: true, keyShiftJustDown: true };
  const cmdShift = processInputFrame(frameShift);
  assert.equal(cmdShift.dashTrigger, true);

  // Teste 4: Normalização diagonal WASD
  const frameDiagonal = { ...frameMouse, touchPointerDown: false, keyW: true, keyD: true };
  const cmdDiag = processInputFrame(frameDiagonal);
  assert.ok(Math.abs(cmdDiag.moveX - Math.SQRT1_2) < 1e-4);
  assert.ok(Math.abs(cmdDiag.moveY - (-Math.SQRT1_2)) < 1e-4);
});

// ============================================================================
// 4. REQUISITO V2: COLETÁVEIS FÍSICOS (NENHUM ITEM RESTAURA DASH)
// ============================================================================
test('V2 Coletáveis: Itens físicos caem verticalmente e jamais concedem dash', () => {
  const pickups = new PickupSystem();
  pickups.spawn('power', 384, 100);
  pickups.spawn('weapon_green', 384, 120);
  pickups.spawn('weapon_ion', 384, 140);
  pickups.spawn('weapon_red', 384, 160);
  pickups.spawn('health', 384, 180);
  pickups.spawn('bomb', 384, 200);

  assert.equal(pickups.pickups.length, 6);

  // Pickups caem verticalmente (+Y)
  pickups.update(100, 384, 350);
  for (const p of pickups.pickups) {
    assert.ok(p.y > 100, 'Pickups derivam para o Sul');
    assert.ok(p.type !== 'dash', 'NUNCA existe pickup de dash no jogo');
  }

  // Coleta física na posição da nave
  const collected = pickups.checkCollection(384, pickups.pickups[0].y, 30);
  assert.equal(collected.length >= 1, true);
});

// ============================================================================
// 5. REQUISITO V2: CHEFES DA FENDA PELÁGICA (MINIBOSS RAIA-DENTE & TALASSARCA)
// ============================================================================
test('phase one bosses: Raia-Dente remains distinct; Talassarca has two complete layers', () => {
  const mini=new MinibossRaiaDente();mini.update(1500,384,350);
  assert.equal(mini.hp,140);assert.equal(mini.phase,'active');
  const boss=new BossTalassarca();boss.update(1800,384,350);
  assert.equal(boss.hp,600);assert.equal(boss.phase,'shell');
  for(let i=0;i<4;i++)assert.equal(boss.damage(120).killed,false);
  assert.equal(boss.hp,120);
  const crack=boss.damage(120);
  assert.equal(crack.killed,false);assert.equal(boss.phase,'metamorphosis');
  assert.equal(boss.damage(9999).bossDamage,0);
  boss.update(2399,384,350);assert.equal(boss.phase,'metamorphosis');
  boss.update(1,384,350);assert.equal(boss.phase,'inner');assert.equal(boss.hp,360);
  assert.equal(boss.damage(120).killed,false);assert.equal(boss.damage(120).killed,false);
  assert.equal(boss.damage(120).killed,true);assert.equal(boss.phase,'defeated');
});