import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Run, Enemy } from '../src/simulation';
import { Agent } from '../src/ai';
import { FeedbackReader } from '../src/game/feedback';
import { soundRecipes, SoundName, synthesizeSound } from '../src/audio/synthesis';
const idle = { x: 0, y: 0, shoot: false, angle: 0, dash: false };
function arena() {
    const run = new Run('sound-test');
    run.d.grid = Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => x > 0 && y > 0 && x < 31 && y < 31 ? 1 : 0));
    run.d.rooms = [{ x: 2, y: 2, w: 20, h: 20, type: 'spawn' }]; run.d.spawns = [];
    run.enemies = []; run.objects = []; run.encounters.clear(); run.feedback.clear();
    run.costs = run.d.grid.map(row => row.map(() => 1)); run.x = run.y = 5.5 * 24;
    return run;
}

test('one accepted weapon attack emits one cue regardless of pellet count or a same-frame hit', () => {
    const run = arena(); run.selectWeapon(1); run.feedback.clear(); run.update(.04, { ...idle, shoot: true });
    assert.equal(run.bullets.length, 5); assert.equal(run.feedback.events.filter(event => event.kind === 'attack').length, 1);
    run.update(.04, { ...idle, shoot: true }); assert.equal(run.feedback.events.filter(event => event.kind === 'attack').length, 1);
    run.heat = 0; run.update(.04, { ...idle, alternate: true }); assert.equal(run.feedback.events.filter(event => event.kind === 'attack').length, 1);
    const hit = arena(); const enemy: Enemy = { id: 1, x: hit.x + 15, y: hit.y, hp: 1, max: 1, kind: 0, room: 0, ai: new Agent({ x: 6, y: 5.5 }), burn: 0, phase: 0, telegraph: 0, patrol: { x: 6, y: 5.5 } };
    hit.enemies = [enemy]; hit.update(.04, { ...idle, shoot: true });
    assert.equal(hit.bullets.length, 0); assert.equal(hit.kills, 1);
    assert.ok(hit.feedback.events.some(event => event.kind === 'attack')); assert.ok(hit.feedback.events.some(event => event.kind === 'impact')); assert.ok(hit.feedback.events.some(event => event.kind === 'defeat'));
});

test('dash start and landing match real movement and do not repeat during cooldown or redraw', () => {
    const run = arena(), reader = new FeedbackReader(), start = run.x;
    run.update(.04, { ...idle, x: 1, dash: true }); assert.ok(run.x > start); assert.ok(run.burst > 0);
    assert.equal(reader.read(run.feedback).filter(event => event.kind === 'dash-start').length, 1);
    assert.equal(reader.read(run.feedback).length, 0);
    for (let frame = 0; frame < 6; frame++) run.update(.04, { ...idle, dash: true });
    const next = reader.read(run.feedback); assert.equal(next.filter(event => event.kind === 'dash-start').length, 0); assert.equal(next.filter(event => event.kind === 'dash-end').length, 1);
    assert.equal(reader.read(run.feedback).length, 0);
    const restored = Run.restore(run.save()); assert.equal(restored.feedback.events.length, 0);
});

test('lance charge starts once, stops on weapon switch, and marks readiness before release', () => {
    const run = arena(); run.selectWeapon(2); run.feedback.clear();
    for (let frame = 0; frame < 25; frame++) run.update(.04, { ...idle, shoot: true });
    assert.equal(run.feedback.events.filter(event => event.kind === 'charge-start').length, 1);
    assert.equal(run.feedback.events.filter(event => event.kind === 'charge-ready').length, 1);
    run.update(.02, idle); assert.equal(run.feedback.events.filter(event => event.kind === 'attack').length, 1);
    assert.ok(run.feedback.events.some(event => event.kind === 'charge-stop'));
    run.shot = 0; run.update(.04, { ...idle, shoot: true }); run.selectWeapon(0);
    assert.equal(run.charge, 0); assert.equal(run.feedback.events.at(-2)?.kind, 'charge-stop');
    run.selectWeapon(2); run.shot = 0; run.update(.2, { ...idle, shoot: true });
    const attacks = run.feedback.events.filter(event => event.kind === 'attack').length;
    run.cancelCharge(); run.update(.02, idle); assert.equal(run.charge, 0);
    assert.equal(run.feedback.events.filter(event => event.kind === 'attack').length, attacks, 'a paused charge must not fire on resume');
});

test('dash keeps its accepted direction and floor transitions clear transient movement', () => {
    const run = arena(), y = run.y;
    run.update(.04, { ...idle, x: 1, dash: true }); const first = run.x;
    run.update(.04, { ...idle, y: -1 });
    assert.ok(run.x > first); assert.equal(run.y, y); assert.equal(run.dx, 1); assert.equal(run.dy, 0);
    assert.ok(run.burst > 0);
    const hp = run.hp, coins = run.coins; run.floor = 2; run.loadFloor();
    assert.equal(run.burst, 0); assert.equal(run.dash, 0); assert.equal(run.charge, 0); assert.equal(run.alternateCD, 0);
    assert.equal(run.hp, hp); assert.equal(run.coins, coins);
});

test('damage immunity and empty healing do not create false sound events', () => {
    const run = arena(); run.heal(); assert.equal(run.feedback.events.length, 0);
    run.hurt(10); run.hurt(10); assert.equal(run.feedback.events.filter(event => event.kind === 'hurt').length, 1);
    run.heal(); assert.equal(run.feedback.events.filter(event => event.kind === 'heal').length, 1);
});

test('trap warning and strike are distinct events; a broken pot cannot repeat its sound', () => {
    const run = arena(); const trap = { id: 1, kind: 'trap' as const, x: 240, y: 240, room: 0, hp: 1, active: 0, cooldown: 0, used: false };
    run.objects = [trap]; run.hitObject(trap, 10); run.hitObject(trap, 10);
    for (let frame = 0; frame < 25; frame++) run.update(.04, idle);
    assert.equal(run.feedback.events.filter(event => event.kind === 'trap-arm').length, 1);
    assert.equal(run.feedback.events.filter(event => event.kind === 'trap-fire').length, 1);
    const pot = { ...trap, id: 2, kind: 'pot' as const, active: 0, cooldown: 0 }; run.hitObject(pot, 10); run.hitObject(pot, 10);
    assert.equal(run.feedback.events.filter(event => event.kind === 'pot-break').length, 1);
});

test('every sound renders finite, non-silent PCM with bounded peaks and clean clip boundaries', () => {
    for (const name of Object.keys(soundRecipes) as SoundName[]) {
        const pcm = synthesizeSound(name, 22050); let energy = 0, peak = 0;
        for (const sample of pcm) { assert.ok(Number.isFinite(sample), name); energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
        assert.ok(energy > .1, `${name} must contain audible signal`); assert.ok(peak <= .821, `${name} clips`);
        assert.equal(pcm[0], 0); assert.equal(pcm.at(-1), 0);
    }
    assert.notDeepEqual(synthesizeSound('dash', 22050), synthesizeSound('dash-land', 22050));
    assert.notDeepEqual(synthesizeSound('scatter', 22050), synthesizeSound('spark', 22050));
});
