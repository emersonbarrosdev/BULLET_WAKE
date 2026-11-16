import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import { PELAGIC_COMMS_MAX_QUEUE, PelagicComms } from '../src/game/arcade/PelagicComms.ts';

test('PelagicComms stays silent at rest and never emits placeholder waiting text', () => {
    const comms = new PelagicComms();
    assert.equal(comms.current(), null);
    comms.step(5);
    assert.equal(comms.current(), null);

    comms.trigger({ category: 'start' });
    const first = comms.current();
    assert.ok(first);
    assert.ok(!first.text.includes('CANAL ABERTO'));
    assert.ok(!first.text.includes('Aguardando contato'));

    comms.step(first.duration + 0.1);
    assert.equal(comms.current(), null);
});

test('PelagicComms handles all Stage 1 contexts, priorities, preemption, and queue bounds', () => {
    const comms = new PelagicComms();
    assert.equal(comms.trigger({ category: 'start' }), true);
    assert.equal(comms.current()?.category, 'start');

    // High-priority submarine/damage preempts low-priority start chatter
    assert.equal(comms.trigger({ category: 'submarine' }), true);
    assert.equal(comms.current()?.category, 'submarine');
    assert.equal(comms.current()?.expression, 3);

    // Queue caps at PELAGIC_COMMS_MAX_QUEUE and orders by priority
    assert.equal(comms.trigger({ category: 'pickup', detail: 'life' }), true);
    assert.equal(comms.trigger({ category: 'damage', detail: 'low-lives' }), true);
    assert.equal(comms.trigger({ category: 'threat', detail: 'bomber' }), false); // dropped: equal priority, queue full of >=2
    assert.equal(comms.pendingCount(), PELAGIC_COMMS_MAX_QUEUE);

    // Higher-priority damage was promoted ahead of pickup in pending queue
    comms.step(comms.current().duration + 0.05);
    assert.equal(comms.current()?.category, 'damage');
    assert.equal(comms.current()?.expression, 2);

    // Critical boss event preempts non-critical active line immediately
    assert.equal(comms.trigger({ category: 'boss', detail: 'collapse' }), true);
    assert.equal(comms.current()?.category, 'boss');
    assert.equal(comms.current()?.priority, 4);

    // Miniboss, special-event, recovery pickup, full power, and victory lines resolve cleanly
    comms.reset();
    for (const req of [
        { category: 'threat', detail: 'ship' },
        { category: 'pickup', detail: 'special' },
        { category: 'pickup', detail: 'full' },
        { category: 'pickup', detail: 'recovery' },
        { category: 'miniboss' },
        { category: 'miniboss', detail: 'clear' },
        { category: 'special-event', text: 'COMBOIO NAVAL À VISTA!\nQUEBREM A ESCOLTA!' },
        { category: 'victory' },
    ]) {
        comms.reset();
        assert.equal(comms.trigger(req), true);
        assert.ok((comms.current()?.text ?? '').length > 4);
    }
});

test('PelagicComms deduplicates repetitions and pauses cleanly without expiring dialogue', () => {
    const comms = new PelagicComms();
    assert.equal(comms.trigger({ category: 'damage' }), true);
    assert.equal(comms.trigger({ category: 'damage' }), false); // cooldown anti-spam

    const rem0 = comms.current().remaining;
    comms.step(1.0);
    const remPaused = comms.current().remaining;
    assert.ok(remPaused < rem0);

    // Simulating paused menu (step(dt) is NOT called while paused) -> timer freezes intact
    comms.step(0);
    assert.equal(comms.current()?.remaining, remPaused);

    // Advance past cooldown and repeat -> rotates variant without crashing
    comms.step(11);
    assert.equal(comms.current(), null);
    assert.equal(comms.trigger({ category: 'damage' }), true);
    assert.ok(comms.current());
});

test('ArcadeWorld emits structured comms events only in Fenda Pelágica and never spams common P pickups', () => {
    const w = new ArcadeWorld(MISSIONS[0]);
    w.step(0.05);
    w.introTime = 0.01;
    w.step(0.02);
    assert.ok(w.events.some(e => e.type === 'comms' && e.text === 'start'));
    w.events.length = 0;

    // Ordinary +1 P at level 1->1 must NOT trigger Bayek comms spam
    w.cargo.push({ id: 1001, x: w.player.x, y: w.player.y, vx: 0, vy: 0, kind: 'power', crate: false, hp: 1, age: 0 });
    w.step(1 / 120);
    assert.ok(w.events.some(e => e.type === 'pickup' && e.text === 'power'));
    assert.equal(w.events.some(e => e.type === 'comms' && e.text?.startsWith('pickup:')), false);
    w.events.length = 0;

    // Reaching FULL level 5, collecting life, and collecting special DO trigger important comms
    w.weapons.weaponLevel = 4;
    w.weapons.powerMeter = 2;
    w.cargo.push({ id: 1002, x: w.player.x, y: w.player.y, vx: 0, vy: 0, kind: 'power', crate: false, hp: 1, age: 0 });
    w.cargo.push({ id: 1003, x: w.player.x, y: w.player.y, vx: 0, vy: 0, kind: 'life', crate: false, hp: 1, age: 0 });
    w.cargo.push({ id: 1004, x: w.player.x, y: w.player.y, vx: 0, vy: 0, kind: 'special', crate: false, hp: 1, age: 0 });
    w.step(1 / 120);
    assert.ok(w.events.some(e => e.type === 'comms' && e.text === 'pickup:full'));
    assert.ok(w.events.some(e => e.type === 'comms' && e.text === 'pickup:life'));
    assert.ok(w.events.some(e => e.type === 'comms' && e.text === 'pickup:special'));

    // Stage 2 (Cidade Solar) never emits Stage 1 pelagic comms events
    const solar = new ArcadeWorld(MISSIONS[1]);
    solar.introTime = 0.01;
    solar.step(0.02);
    assert.equal(solar.events.some(e => e.type === 'comms'), false);
    assert.ok(solar.events.some(e => e.type === 'radio' && e.text === 'Cidade Solar, a RIVET chegou!'));
});
