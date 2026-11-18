import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import {
  BurstController,
  BURST_MIN_CADENCE_MS,
  BURST_PULSE_COUNT,
  BURST_PULSE_STEP_MS,
} from '../src/game/arcade/BurstController.ts';
import { TouchInputController, defaultTouchSettings } from '../src/game/arcade/TouchControls.ts';
import { GamepadReader } from '../src/game/systems/gamepadInput.ts';
import { defaultSaveData } from '../src/game/systems/saveSystem.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';

function livePelagic(level = 1) {
  const w = new ArcadeWorld(MISSIONS[0]);
  w.state = 'play';
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 0;
  w.weapons.weaponLevel = level;
  return w;
}

test('Teste A — Toque rápido: libera todos os 3 pulsos (0 / 65 / 130 ms) mesmo após soltar', () => {
  const b = new BurstController();
  const s0 = b.step(8, true);
  assert.equal(s0.burstStarted, true);
  assert.equal(s0.pulses, 1);
  assert.equal(s0.state, 'bursting');

  // Release immediately after first frame (~16ms total)
  const s1 = b.step(8, false);
  assert.equal(s1.justReleased, true);
  assert.equal(s1.pulses, 0);

  let totalPulses = s0.pulses + s1.pulses;
  for (let ms = 16; ms < 250; ms += 5) {
    totalPulses += b.update(5, false);
  }
  assert.equal(totalPulses, BURST_PULSE_COUNT);
  assert.equal(b.getState(), 'bursting' === b.getState() ? 'invalid' : b.getState());
  assert.equal(b.isBurstActive(), false);
  assert.equal(BURST_PULSE_STEP_MS, 42);
  assert.equal(BURST_MIN_CADENCE_MS, 95);
});

test('Teste B — Segurar TIRO por 5 segundos no modo padrão produz exatamente 1 rajada de 3 pulsos', () => {
  const ctrl = new BurstController();
  let burstsStarted = 0;
  let pulses = 0;
  for (let t = 0; t < 5000; t += 10) {
    const res = ctrl.step(10, true, false);
    if (res.burstStarted) burstsStarted++;
    pulses += res.pulses;
  }
  assert.equal(burstsStarted, 1);
  assert.equal(pulses, 3);
  assert.equal(ctrl.getState(), 'holding');

  // Full ArcadeWorld (Fenda Pelágica) verification holding fire continuously for 5s
  const w = livePelagic(1);
  let worldShots = 0;
  for (let i = 0; i < 120 * 5; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    worldShots += w.events.filter((e) => e.type === 'shot').length;
    w.events.length = 0;
  }
  assert.equal(worldShots, 3, 'Segurar TIRO por 5s no modo padrão deve disparar apenas 1 rajada (3 pulsos)');
});

test('Teste C — Pressionamentos repetidos respeitando cadência mínima produzem exatamente 2 rajadas (6 pulsos)', () => {
  const w = livePelagic(1);
  let shots = 0;

  // Press 1 at t=0 (1 frame press then release cleanly)
  w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
  shots += w.events.filter((e) => e.type === 'shot').length;
  w.events.length = 0;

  // Release for 300ms (> 280ms cadence)
  for (let i = 0; i < 36; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
    shots += w.events.filter((e) => e.type === 'shot').length;
    w.events.length = 0;
  }
  assert.equal(shots, 3);

  // Press 2 after 300ms
  w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
  shots += w.events.filter((e) => e.type === 'shot').length;
  w.events.length = 0;

  // Let second burst finish (~200ms)
  for (let i = 0; i < 24; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
    shots += w.events.filter((e) => e.type === 'shot').length;
    w.events.length = 0;
  }
  assert.equal(shots, 6);
});

test('Teste D — Pressionamentos rápidos demais (< 95ms) são ignorados sem fila atrasada, mas toques rápidos reais aceleram rajadas', () => {
  const b = new BurstController();
  assert.equal(b.step(0, true).burstStarted, true);
  assert.equal(b.step(10, false).justReleased, true);

  // Rapid invalid taps at 40ms and 70ms (< 95ms debounce); held invalid tap must never fire delayed burst past 95ms
  for (let t = 15; t < 40; t += 5) b.step(5, false);
  assert.equal(b.step(5, true).burstStarted, false, 'Tap at ~45ms ignored');
  assert.equal(b.step(10, false).justReleased, true);

  for (let t = 55; t < 70; t += 5) b.step(5, false);
  const earlyHeld = b.step(5, true);
  assert.equal(earlyHeld.burstStarted, false, 'Tap at ~75ms ignored');

  let delayedBursts = 0;
  for (let t = 75; t < 500; t += 5) {
    if (b.step(5, true).burstStarted) delayedBursts++;
  }
  assert.equal(delayedBursts, 0);

  // Releasing and pressing cleanly after cooldown starts one valid new burst immediately
  assert.equal(b.step(5, false).justReleased, true);
  assert.equal(b.step(5, true).burstStarted, true);

  // Faster manual tapping (110ms) produces strictly more bursts & pulses than slower tapping (260ms) in 1s
  const measureTapRate = (periodMs) => {
    const ctrl = new BurstController();
    let bursts = 0, pulses = 0;
    for (let t = 0; t < 1000; t += 10) {
      const tap = (t % periodMs) < 20;
      const r = ctrl.step(10, tap, false);
      if (r.burstStarted) bursts++;
      pulses += r.pulses;
    }
    return { bursts, pulses };
  };
  const slow = measureTapRate(260);
  const fast = measureTapRate(110);
  assert.ok(fast.bursts > slow.bursts && fast.pulses > slow.pulses, JSON.stringify({ slow, fast }));
});

test('Teste E — FULL POWER e evolução LV1..FULL preservam contagem exata de projéteis por rajada', () => {
  const expectedPerPulse = [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 6],
    [5, 7],
  ];
  for (const [level, perPulse] of expectedPerPulse) {
    const w = livePelagic(level);
    w.missileTime = 99; // Isolate primary projectiles from missiles for exact count verification
    w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    for (let i = 0; i < 24; i++) w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
    const primaryCount = w.bullets.filter((b) => b.active && !b.enemy && !b.missile).length;
    assert.equal(primaryCount, perPulse * 3, `Level ${level} must spawn ${perPulse * 3} primary shots per burst`);
  }
});

test('Teste F — Mísseis respeitam cooldown e não disparam continuamente apenas segurando TIRO', () => {
  // Holding TIRO for 5s at FULL launches at most 1 missile salvo (from the 1 triggered burst)
  const heldWorld = livePelagic(5);
  let heldMissileEvents = 0;
  for (let i = 0; i < 120 * 5; i++) {
    heldWorld.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    heldMissileEvents += heldWorld.events.filter((e) => e.type === 'missile').length;
    heldWorld.events.length = 0;
  }
  assert.equal(heldMissileEvents, 1, 'Holding TIRO for 5s launches only 1 missile salvo');

  // Repeated manual bursts respect 1.1s cooldown at FULL
  const tapWorld = livePelagic(5);
  let tapMissileEvents = 0;
  for (let i = 0; i < 120 * 4; i++) {
    const tap = Math.floor(tapWorld.elapsed * 1000) % 290 < 40;
    tapWorld.step(1 / 120, { x: 0, y: 0, fire: tap, special: false });
    tapMissileEvents += tapWorld.events.filter((e) => e.type === 'missile').length;
    tapWorld.events.length = 0;
  }
  assert.ok(tapMissileEvents >= 3 && tapMissileEvents <= 4, `Expected 3-4 salvos in 4s tapping, got ${tapMissileEvents}`);
});

test('Teste G — Acessibilidade (DISPARO ACESSÍVEL): desativada por padrão; ativa autofire somente quando ligada', () => {
  assert.equal(defaultSaveData().settings.rapidFire, false, 'rapidFire must default to false for new players');

  const wOff = livePelagic(1);
  assert.equal(wOff.accessibility, false);
  let offShots = 0;
  for (let i = 0; i < 120 * 2; i++) {
    wOff.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    offShots += wOff.events.filter((e) => e.type === 'shot').length;
    wOff.events.length = 0;
  }
  assert.equal(offShots, 3);

  const wOn = livePelagic(1);
  wOn.accessibility = true;
  let onShots = 0;
  for (let i = 0; i < 120 * 2; i++) {
    wOn.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    onShots += wOn.events.filter((e) => e.type === 'shot').length;
    wOn.events.length = 0;
  }
  assert.ok(onShots >= 21, `Expected auto-repeat bursts with accessibility=true, got ${onShots}`);
});

test('Teste H — Morte e reaparecimento cancelam rajada em curso sem disparo fantasma se botão seguir segurado', () => {
  const w = livePelagic(1);
  // Pulse 1 fires at t=0
  w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
  assert.equal(w.events.filter((e) => e.type === 'shot').length, 1);
  w.events.length = 0;

  // Player dies ~16ms later while still holding fire
  w.hurtPlayer();
  assert.equal(w.lives, 2);

  // Keeping fire held after respawn must NOT emit leftover pulses OR a new phantom burst
  let shotsAfterDeath = 0;
  for (let i = 0; i < 60; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    shotsAfterDeath += w.events.filter((e) => e.type === 'shot').length;
    w.events.length = 0;
  }
  assert.equal(shotsAfterDeath, 0);

  // Releasing and pressing after respawn works immediately
  w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
  w.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
  assert.equal(w.events.filter((e) => e.type === 'shot').length, 1);
});

test('Teste I — Pausa durante rajada não duplica pulsos nem dispara ao retomar', () => {
  const b = new BurstController();
  let pulses = 0;
  pulses += b.update(0, true); // pulse 1
  pulses += b.update(25, true); // paused at 25ms... (no steps run while paused)
  // On resume, ArcadeScene suppresses held fire until released (fire = false passed until released)
  for (let ms = 0; ms < 200; ms += 10) {
    pulses += b.update(10, false);
  }
  assert.equal(pulses, 3, 'Paused burst finishes strictly its remaining 2 pulses without duplicating pulse 1');

  // Verify ArcadeScene guards resume from pause against SPACE/Gamepad A confirm bounce & stuck keys
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes('suppressHeldFireUntilRelease'), 'ArcadeScene must suppress held fire across pause resume');
  assert.ok(sceneSrc.includes('resumedFromMenu'), 'ArcadeScene must not run world step on menu confirm resume frame');
  assert.ok(sceneSrc.includes('resetKeys()'), 'ArcadeScene must reset keyboard keys on pause and window blur');
});

test('Teste J — Múltiplos dispositivos (GamepadReader, TouchInputController diagonal/multi-toque, 30/60/120 FPS e Cidade Solar)', () => {
  // 1. Gamepad: held firePrimary never double-fires bursts when connected to BurstController
  const reader = new GamepadReader();
  const pad = {
    id: 'Xbox Standard',
    mapping: 'standard',
    axes: [0.8, -0.8],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 1, value: i === 1 ? 1 : 0 })),
  };
  const burst = new BurstController();
  let padPulses = 0;
  for (let i = 0; i < 60; i++) {
    const gp = reader.sample(pad);
    assert.equal(gp.firePrimary, true);
    assert.equal(gp.firePrimaryTap, i === 0);
    assert.ok(gp.moveX > 0.4 && gp.moveY < -0.4, 'Diagonal movement works concurrently with fire');
    padPulses += burst.update(1000 / 60, gp.firePrimary, false);
  }
  assert.equal(padPulses, 3);

  // 2. Touch: quick <1 frame tap on TIRO latches cleanly without double burst; diagonal joystick + TIRO works
  const touch = new TouchInputController(defaultTouchSettings());
  const layout = touch.getLayout();
  assert.equal(touch.onPointerDown(1, layout.joystick.x, layout.joystick.y), 'move');
  touch.onPointerMove(1, layout.joystick.x + 25, layout.joystick.y - 25);
  assert.equal(touch.onPointerDown(2, layout.fire.x, layout.fire.y), 'fire');
  touch.onPointerUp(2); // Released before frame renders!
  const step1 = touch.consumeStep();
  assert.equal(step1.fire, true, 'Fast single-frame TIRO tap must not be dropped');
  assert.ok(step1.x > 0.5 && step1.y < -0.5);
  assert.equal(touch.consumeStep().fire, false);

  // 3. Consistency across 30 / 60 / 120 FPS simulated deltas
  for (const fps of [30, 60, 120]) {
    const dtMs = 1000 / fps;
    const heldCtrl = new BurstController();
    let heldCount = 0;
    for (let i = 0; i < fps * 2; i++) heldCount += heldCtrl.update(dtMs, true, false);
    assert.equal(heldCount, 3, `Hold must emit strictly 3 pulses at ${fps} FPS`);

    const tapCtrl = new BurstController();
    let tapCount = 0;
    let simMs = 0;
    for (let i = 0; i < fps * 2; i++) {
      const pressedWindow = simMs < 1800 && simMs % 320 < 40;
      tapCount += tapCtrl.update(dtMs, pressedWindow, false);
      simMs += dtMs;
    }
    assert.equal(tapCount, 18, `Consistent 6 rhythmic bursts (18 pulses) in 2s at ${fps} FPS`);
  }

  // 4. Cidade Solar (Stage 2) preserves hold-repeat behavior untouched
  const solar = new ArcadeWorld(MISSIONS[1]);
  solar.state = 'play';
  solar.waveIndex = 999;
  solar.supplyIndex = 999;
  solar.player.invulnerable = 0;
  let solarShots = 0;
  for (let i = 0; i < 120 * 2; i++) {
    solar.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    solarShots += solar.events.filter((e) => e.type === 'shot').length;
    solar.events.length = 0;
  }
  assert.ok(solarShots > 3, `Cidade Solar keeps existing hold-repeat behavior (got ${solarShots} shots)`);
});
