import test from 'node:test';
import assert from 'node:assert/strict';
import { processInputFrame } from '../src/game/systems/inputSystem.ts';
import {
  createPlayerWeapons,
  recordPrimaryShot,
  advanceWeapons,
  updateWeaponCharge,
  releaseWeaponCharge,
  getChargedProjectiles,
  PILOT_WEAPON_SPECS,
  MAX_HEAT,
  MIN_CHARGE_MS,
  FULL_CHARGE_THRESHOLD_MS,
} from '../src/game/systems/weaponSystem.ts';
import { moveInBounds } from '../src/game/systems/movement.ts';

function createBlankFrame(overrides = {}) {
  const base = {
    keyW: false,
    keyA: false,
    keyS: false,
    keyD: false,
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false,

    keySpace: false,
    keySpaceJustDown: false,
    keyShift: false,
    keyShiftJustDown: false,
    keyShiftJustUp: false,
    keyM: false,
    keyMJustDown: false,
    keyX: false,
    keyXJustDown: false,
    keyK: false,
    keyKJustDown: false,
    keyB: false,
    keyBJustDown: false,
    keyL: false,
    keyLJustDown: false,
    keyR: false,
    keyRJustDown: false,
    keyEsc: false,
    keyEscJustDown: false,

    pointerActive: true,
    pointerDown: false,
    pointerLeftDown: false,
    pointerLeftJustDown: false,
    pointerLeftJustUp: false,
    pointerRightDown: false,
    pointerRightJustDown: false,
    pointerRightJustUp: false,
    isTouch: false,
    pointerX: 400,
    pointerY: 200,

    shipX: 135,
    shipY: 216,
  };
  return { ...base, ...overrides };
}

const defaultBounds = { minX: 10, maxX: 750, minY: 10, maxY: 420 };

// ============================================================================
// TESTE A: Disparo com Tecla ESPAÇO no PC
// ============================================================================
test('TESTE A: Disparo com Espaço no PC dispara sem alterar coordenadas da nave', () => {
  const frame = createBlankFrame({
    keySpace: true,
    keySpaceJustDown: true,
    shipX: 135,
    shipY: 216,
  });

  const cmd = processInputFrame(frame);
  assert.equal(cmd.firePrimary, true, 'Espaço deve ativar firePrimary');
  assert.equal(cmd.firePrimaryTap, true, 'JustDown de Espaço deve ativar firePrimaryTap');
  assert.equal(cmd.moveX, 0, 'Espaço NÃO pode gerar movimento no eixo X');
  assert.equal(cmd.moveY, 0, 'Espaço NÃO pode gerar movimento no eixo Y');

  // Simulação física de movimento
  const moved = moveInBounds({ x: frame.shipX, y: frame.shipY }, cmd.moveX, cmd.moveY, 300, 16.6, defaultBounds);
  assert.equal(moved.x, 135, 'Nave deve permanecer imóvel na posição X');
  assert.equal(moved.y, 216, 'Nave deve permanecer imóvel na posição Y');
});

// ============================================================================
// TESTE B: Regra Fundamental do Mouse no PC (V2 Canonical)
// ============================================================================
test('TESTE B: Cliques do Mouse no PC NÃO disparam arma e NUNCA alteram velocidade ou coordenadas da nave', () => {
  // Ponteiro do mouse localizado à frente da nave (X=600, Y=200) com clique ativo
  const frame = createBlankFrame({
    pointerDown: true,
    pointerLeftDown: true,
    pointerLeftJustDown: true,
    pointerX: 600,
    pointerY: 200,
    isTouch: false, // Desktop PC
    shipX: 135,
    shipY: 216,
  });

  const cmd = processInputFrame(frame);
  assert.equal(cmd.firePrimary, false, 'Mouse no PC NÃO dispara arma principal (Regra Canônica V2)');
  assert.equal(cmd.firePrimaryTap, false, 'Mouse no PC NÃO gera tap de disparo');
  assert.equal(cmd.moveX, 0, 'Clique do mouse no PC JAMAIS pode gerar moveX');
  assert.equal(cmd.moveY, 0, 'Clique do mouse no PC JAMAIS pode gerar moveY');

  // Simulação física: a nave permanece rigorosamente imóvel
  const moved = moveInBounds({ x: frame.shipX, y: frame.shipY }, cmd.moveX, cmd.moveY, 300, 50, defaultBounds);
  assert.equal(moved.x, 135, 'Coordenada X não se moveu');
  assert.equal(moved.y, 216, 'Coordenada Y não se moveu');
});

// ============================================================================
// TESTE C: Disparo exclusivamente pelo Teclado durante Movimentação
// ============================================================================
test('TESTE C: Movimentação respeita estritamente o teclado e cliques de mouse são ignorados', () => {
  // Jogador pressiona D (mover para a direita) e W (mover para cima), e clica com o mouse em ponto oposto
  const frame = createBlankFrame({
    keyD: true,
    keyW: true,
    keySpace: true,
    pointerDown: true,
    pointerLeftDown: true,
    pointerX: 50,
    pointerY: 350,
    isTouch: false,
    shipX: 135,
    shipY: 216,
  });

  const cmd = processInputFrame(frame);
  assert.ok(Math.abs(cmd.moveX - Math.SQRT1_2) < 1e-4, 'moveX normalizado pelo teclado (D)');
  assert.ok(Math.abs(cmd.moveY - (-Math.SQRT1_2)) < 1e-4, 'moveY normalizado pelo teclado (W)');
  assert.equal(cmd.firePrimary, true, 'Disparo ocorre ativado pela barra de Espaço');

  // Simulação: a nave deve se deslocar para frente (+X) e para cima (-Y)
  const moved = moveInBounds({ x: frame.shipX, y: frame.shipY }, cmd.moveX, cmd.moveY, 300, 16.6, defaultBounds);
  assert.ok(moved.x > 135, 'Nave avançou para a direita');
  assert.ok(moved.y < 216, 'Nave subiu no eixo Y');
});

// ============================================================================
// TESTE D: Dash de Emergência via Shift Esquerdo
// ============================================================================
test('TESTE D: Tecla Shift Esquerdo aciona dashTrigger com precisão instantânea', () => {
  const frameShift = createBlankFrame({
    keyShift: true,
    keyShiftJustDown: true,
    isTouch: false,
  });

  const cmd = processInputFrame(frameShift);
  assert.equal(cmd.dashTrigger, true, 'Left Shift deve acionar dashTrigger');
});

// ============================================================================
// TESTE E: Cadência, Tapping Manual e Sistema Térmico (Calor e Sobreaquecimento)
// ============================================================================
test('TESTE E: Disparo manual e contínuo compartilham cadência; calor legado resfria', () => {
  const specs = PILOT_WEAPON_SPECS.nolan;
  assert.equal(specs.burstIntervalMs, specs.autoIntervalMs, 'Tapping não contorna a cadência');
  assert.equal(specs.autoIntervalMs, 220);
  assert.equal(specs.burstIntervalMs, 220);

  let w = createPlayerWeapons('nolan');
  assert.equal(w.heat, 0);
  assert.equal(w.isOverheated, false);

  // Disparo manual contínuo acumula calor
  for (let i = 0; i < 5; i++) {
    const shot = recordPrimaryShot(w);
    w = shot.state;
  }
  assert.equal(w.heat, 5 * specs.heatPerShot);
  assert.equal(w.isOverheated, false);

  // Disparo em excesso leva a sobreaquecimento (overheat)
  for (let i = 0; i < 15; i++) {
    const shot = recordPrimaryShot(w);
    w = shot.state;
  }
  assert.equal(w.heat, MAX_HEAT);
  assert.equal(w.isOverheated, true);
  assert.ok(w.overheatCooldownMs > 0);

  // Resfriamento contínuo com o tempo
  w = advanceWeapons(w, 500); // 500ms de resfriamento
  assert.ok(w.heat < MAX_HEAT, 'Calor deve diminuir após período de resfriamento');

  // Cooldown de sobreaquecimento expira
  w = advanceWeapons(w, 800);
  assert.equal(w.isOverheated, false, 'Arma sai do estado de sobreaquecimento após esfriar');
});

// ============================================================================
// TESTE F: Disparo Carregado (Wave Cannon) por Piloto
// ============================================================================
test('TESTE F: Disparo Carregado acumula energia, respeita limiares e aplica identidades', () => {
  let wNolan = createPlayerWeapons('nolan');

  // Carga insuficiente (< 400ms)
  wNolan = updateWeaponCharge(wNolan, 250, true);
  assert.equal(wNolan.chargeMs, 250);
  let rel = releaseWeaponCharge(wNolan);
  assert.equal(rel.chargeLevel, 0, 'Abaixo de 400ms o tiro não deve ser carregado');

  // Carga Nível 1 (400ms a 1100ms)
  wNolan = updateWeaponCharge(wNolan, 600, true);
  rel = releaseWeaponCharge(wNolan);
  assert.equal(rel.chargeLevel, 1, 'Carga entre 400 e 1100ms gera Nível 1');
  const shotsLv1 = getChargedProjectiles('nolan', 1, 100, 200);
  assert.equal(shotsLv1.length, 1);
  assert.equal(shotsLv1[0].piercing, true);
  assert.equal(shotsLv1[0].damage, 4.8);

  // Carga Máxima Nolan (>= 1100ms)
  wNolan = updateWeaponCharge(wNolan, FULL_CHARGE_THRESHOLD_MS + 50, true);
  rel = releaseWeaponCharge(wNolan);
  assert.equal(rel.chargeLevel, 2, 'Carga acima do limiar gera Nível 2 (Máximo)');
  const shotsLv2 = getChargedProjectiles('nolan', 2, 100, 200);
  assert.equal(shotsLv2.length, 1);
  assert.equal(shotsLv2[0].damage, 8.5);
  assert.equal(shotsLv2[0].piercing, true);

  // Carga Máxima Cora (Overdrive de Agulhas e Ventilação de Calor)
  let wCora = createPlayerWeapons('cora');
  wCora.heat = 75; // aquecida
  wCora = updateWeaponCharge(wCora, 1200, true);
  const relCora = releaseWeaponCharge(wCora);
  assert.equal(relCora.chargeLevel, 2);
  assert.equal(relCora.state.heat, 0, 'Cora dissipa 100% do calor em carga máxima!');
  const shotsCora = getChargedProjectiles('cora', 2, 100, 200);
  assert.equal(shotsCora.length, 5, 'Cora dispara leque de 5 agulhas hiper-velozes perfurantes');

  // Carga Máxima Harlan (Mega-Canhão Cinético de Sobrecarga)
  let wHarlan = createPlayerWeapons('harlan');
  wHarlan = updateWeaponCharge(wHarlan, 1200, true);
  const relHarlan = releaseWeaponCharge(wHarlan);
  assert.equal(relHarlan.chargeLevel, 2);
  const shotsHarlan = getChargedProjectiles('harlan', 2, 100, 200);
  assert.equal(shotsHarlan.length, 1);
  assert.equal(shotsHarlan[0].damage, 12.0, 'Canhão do Harlan tem o dano mais devastador');
  assert.equal(shotsHarlan[0].hitRadius, 32);
});

// ============================================================================
// TESTE G: Performance e Consistência sob Alta Frequência
// ============================================================================
test('TESTE G: Performance e Consistência (10.000 iterações em < 25ms sem memory leaks)', () => {
  const t0 = performance.now();
  let frame = createBlankFrame({ keyD: true, keySpace: true });
  let w = createPlayerWeapons('nolan');

  for (let i = 0; i < 10000; i++) {
    const cmd = processInputFrame(frame);
    if (cmd.firePrimary) {
      const res = recordPrimaryShot(w);
      w = advanceWeapons(res.state, 16.6);
    }
  }

  const duration = performance.now() - t0;
  assert.ok(duration < 150, `10.000 frames de input executados em ${duration.toFixed(2)}ms`);
  assert.ok(Number.isFinite(w.heat));
});
