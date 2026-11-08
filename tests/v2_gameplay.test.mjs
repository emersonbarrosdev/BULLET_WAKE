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
  switchWeaponFamily,
  getPrimaryProjectiles,
  getChargedProjectiles,
  recordPrimaryShot,
  updateWeaponCharge,
  releaseWeaponCharge,
  MAX_WEAPON_LEVEL,
} from '../src/game/systems/weaponSystem.ts';
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
// 2. REQUISITO V2: SISTEMA DE ARMAS FIRE SHARK (3 FAMÍLIAS, NÍVEIS 1 A 4)
// ============================================================================
test('V2 Armas: Três famílias com evolução progressiva de LV1 até LV4', () => {
  // Arma A: Pulso Verde (Green Pulse - leque)
  const g1 = getPrimaryProjectiles('green', 1, 384, 350);
  const g2 = getPrimaryProjectiles('green', 2, 384, 350);
  const g3 = getPrimaryProjectiles('green', 3, 384, 350);
  const g4 = getPrimaryProjectiles('green', 4, 384, 350);

  assert.equal(g1.length, 2, 'Verde LV1: disparos frontais paralelos');
  assert.equal(g2.length, 3, 'Verde LV2: 3 vias');
  assert.equal(g3.length, 5, 'Verde LV3: 5 vias');
  assert.equal(g4.length, 7, 'Verde LV4: 7 vias leque máximo');

  // Todas as balas do jogador voam para o Norte (velocityY < 0)
  for (const shot of [...g1, ...g2, ...g3, ...g4]) {
    assert.ok(shot.velocityY < 0, 'Projéteis sobem para o topo da tela');
  }

  // Arma B: Laser de Íons (Ion Laser - perfurante)
  const i1 = getPrimaryProjectiles('ion', 1, 384, 350);
  const i2 = getPrimaryProjectiles('ion', 2, 384, 350);
  const i3 = getPrimaryProjectiles('ion', 3, 384, 350);
  const i4 = getPrimaryProjectiles('ion', 4, 384, 350);
  assert.equal(i1[0].piercing, true, 'Laser de íons é perfurante');
  assert.equal(i1.length, 1);
  assert.equal(i2.length, 2);
  assert.equal(i3.length, 3);
  assert.equal(i4.length, 5, 'Ion LV4 dispara 5 feixes concentrados de alta penetração');

  // Arma C: Plasma Vermelho (Red Plasma - dano concussivo pesado)
  const r1 = getPrimaryProjectiles('red', 1, 384, 350);
  const r2 = getPrimaryProjectiles('red', 2, 384, 350);
  const r3 = getPrimaryProjectiles('red', 3, 384, 350);
  const r4 = getPrimaryProjectiles('red', 4, 384, 350);
  assert.ok(r1[0].damage > g1[0].damage, 'Plasma vermelho tem maior dano por projétil');
  assert.equal(r1.length, 1);
  assert.equal(r2.length, 2);
  assert.equal(r3.length, 3);
  assert.equal(r4.length, 4);
});

test('V2 Upgrade & Troca de Família: Upgrades até LV4 e preservação de nível na troca', () => {
  let weapons = createPlayerWeapons('nolan');
  assert.equal(weapons.weaponLevel, 1);
  assert.equal(weapons.weaponFamily, 'green');

  // Upgrade para LV2
  weapons = upgradeWeapon(weapons).state;
  assert.equal(weapons.weaponLevel, 2);

  // Upgrade para LV3
  weapons = upgradeWeapon(weapons).state;
  assert.equal(weapons.weaponLevel, 3);

  // Upgrade para LV4
  weapons = upgradeWeapon(weapons).state;
  assert.equal(weapons.weaponLevel, 4);

  // Tentativa além do LV4 é bloqueada
  const uOver = upgradeWeapon(weapons);
  assert.equal(uOver.upgraded, false);
  assert.equal(uOver.state.weaponLevel, 4);

  // Troca para Laser de Íons mantém LV4
  weapons = switchWeaponFamily(weapons, 'ion');
  assert.equal(weapons.weaponFamily, 'ion');
  assert.equal(weapons.weaponLevel, 4);

  // Troca para Plasma Vermelho mantém LV4
  weapons = switchWeaponFamily(weapons, 'red');
  assert.equal(weapons.weaponFamily, 'red');
  assert.equal(weapons.weaponLevel, 4);
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
test('V2 Chefes: Miniboss Raia-Dente (45 HP) e Boss Talassarca (160 HP, 3 fases)', () => {
  // 1. Miniboss Raia-Dente
  const miniboss = new MinibossRaiaDente();
  assert.equal(miniboss.name, 'RAIA-DENTE');
  assert.equal(miniboss.hp, 45);
  assert.equal(miniboss.phase, 'intro');

  // Avança além da introdução
  miniboss.update(1500, 384, 350);
  assert.equal(miniboss.phase, 'active');

  // Disparos do miniboss descem em direção ao jogador (velocityY > 0)
  const tickMini = miniboss.update(1100, 384, 350);
  assert.ok(tickMini.shots.length > 0);
  for (const s of tickMini.shots) {
    assert.ok(s.velocityY > 0, 'Tiros do miniboss descem para o Sul');
  }

  // 2. Chefe Colossal Talassarca
  const boss = new BossTalassarca();
  assert.equal(boss.name, 'TALASSARCA');
  assert.equal(boss.hp, 160);
  assert.equal(boss.phase, 'intro');
  assert.equal(boss.modules.length, 3, 'Asa esquerda, asa direita e núcleo');

  // Avança além da intro para Fase 1 (Asas e Pinças)
  boss.update(2000, 384, 350);
  assert.equal(boss.phase, 'wings');

  // Dano nas asas laterais
  const hitWingL = boss.damage(35, boss.x - 85, boss.y + 10);
  assert.equal(hitWingL.moduleDestroyed, 'Asa Esquerda');
  assert.equal(boss.modules[0].destroyed, true);

  // Destruição da segunda asa
  const hitWingR = boss.damage(35, boss.x + 85, boss.y + 10);
  assert.equal(hitWingR.moduleDestroyed, 'Asa Direita');
  assert.equal(boss.modules[1].destroyed, true);

  // Boss avança para Fase 2 (Tentáculos)
  boss.update(50, 384, 350);
  assert.equal(boss.phase, 'tentacles');

  // Dano reduz HP para <= 55 e expõe o núcleo central na Fase 3
  boss.damage(35, boss.x, boss.y);
  boss.update(50, 384, 350);
  assert.equal(boss.phase, 'core');

  // Dano ao núcleo central exposto recebe bônus de 1.5x de dano crítico
  const coreHit = boss.damage(10, boss.x, boss.y + 15);
  assert.equal(coreHit.bossDamage, 15, 'Dano crítico de 1.5x aplicado ao núcleo exposto');
});
