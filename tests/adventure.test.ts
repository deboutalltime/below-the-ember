import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Run, Enemy } from '../src/simulation';
import { Agent, los } from '../src/ai';
import { WorldObject } from '../src/game/environment';
import { validate, center } from '../src/dungeon';
import { EnemyMind } from '../src/intelligence/EnemyMind';
const idle = { x: 0, y: 0, shoot: false, angle: 0, dash: false };
function arena() {
    const r = new Run('mechanics'); r.d.grid = Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => x > 0 && y > 0 && x < 31 && y < 31 ? 1 : 0));
    r.d.rooms = [{ x: 2, y: 2, w: 18, h: 18, type: 'spawn' }, { x: 22, y: 22, w: 6, h: 6, type: 'exit' }]; r.d.spawns = []; r.objects = []; r.encounters.clear(); r.enemies = []; r.costs = r.d.grid.map(row => row.map(() => 1)); r.x = 120; r.y = 120; return r;
}
function foe(r: Run, id: number, x: number, hp = 100): Enemy { return { id, x, y: r.y, hp, max: hp, kind: 0, room: 0, ai: new Agent({ x: x / 24, y: r.y / 24 }), burn: 0, phase: 0, telegraph: 0, patrol: { x: x / 24, y: r.y / 24 } }; }
function object(kind: WorldObject['kind'], x: number, y: number): WorldObject { return { id: 100, kind, x, y, room: 0, hp: kind === 'pillar' ? 30 : 1, active: 0, cooldown: 0, used: false }; }
test('four weapons have real different attacks and specials consume heat', () => {
    const r = arena(); r.update(.016, { ...idle, shoot: true }); assert.equal(r.bullets.length, 1);
    r.bullets = []; r.shot = 0; r.selectWeapon(1); r.update(.016, { ...idle, shoot: true }); assert.equal(r.bullets.length, 5);
    r.bullets = []; r.shot = 0; r.selectWeapon(2); for (let i = 0; i < 20; i++) r.update(.02, { ...idle, shoot: true }); assert.equal(r.bullets.length, 0); r.update(.02, idle); assert.ok(r.bullets.some(b => (b.pierce ?? 0) >= 2));
    r.bullets = []; r.shot = 0; r.selectWeapon(3); const e = foe(r, 0, r.x + 45); r.enemies = [e]; r.update(.02, { ...idle, shoot: true }); assert.ok(e.hp < e.max); assert.ok(r.effects.some(e => e.kind === 'arc'));
    r.selectWeapon(0); r.shot = 0; r.alternateCD = 0; r.heat = 80; r.update(.02, { ...idle, alternate: true }); assert.equal(r.heat, 62);
});
test('ricochet reflects, piercing hits multiple foes, burning triggers a defeat cascade', () => {
    const r = arena(); r.d.grid[5][7] = 0; r.ricochet = 1; r.fire(r.x, r.y, 0); for (let i = 0; i < 10; i++) r.update(.02, idle); assert.ok(r.bullets[0]?.vx < 0);
    const p = arena(); p.piercing = 1; p.enemies = [foe(p, 0, p.x + 40, 10), foe(p, 1, p.x + 75, 10)]; p.fire(p.x, p.y, 0, false, 20); for (let i = 0; i < 30; i++) p.update(.02, idle); assert.equal(p.kills, 2);
    const b = arena(); b.owned = ['Burning Rounds', 'Ash Cascade']; b.burning = true; b.enemies = [foe(b, 0, b.x + 35, 10), foe(b, 1, b.x + 65, 10)]; b.fire(b.x, b.y, 0, false, 20); for (let i = 0; i < 30; i++) b.update(.02, idle); assert.equal(b.kills, 2); assert.ok(b.score >= 100);
});
test('oil, traps, pot loot and secret rewards are simulation objects', () => {
    const r = arena(), oil = object('oil', r.x + 45, r.y), trap = object('trap', r.x + 80, r.y), pot = object('pot', r.x + 20, r.y);
    r.objects = [oil, trap, pot]; const e = foe(r, 0, oil.x); r.enemies = [e]; r.hitObject(oil, 1); r.hitObject(trap, 1); const coins = r.coins; r.hitObject(pot, 20); r.update(.1, idle);
    assert.ok(oil.active > 0); assert.ok(trap.active > 0); assert.ok(e.hp < e.max); assert.ok(r.coins > coins); assert.ok(pot.used);
    const secret = object('secret', 200, 200); r.objects.push(secret); r.hitObject(secret, 25); assert.equal(r.status, 'upgrade'); assert.equal(r.picks.length, 3); const after = r.coins; r.hitObject(secret, 25); assert.equal(r.coins, after);
});
test('defense waits for its timer; collapsing chambers require leaving after the fight', () => {
    const r = arena(); r.visited = [0]; r.d.spawns = [{ x: 5, y: 5, kind: 0, room: 0 }]; r.encounters.set(0, { room: 0, type: 'defense', started: true, time: 1, complete: false, reinforced: true, trialAccepted: false }); r.update(.1, idle); assert.equal(r.status, 'playing'); r.encounters.get(0)!.time = 15; r.update(.1, idle); assert.equal(r.status, 'upgrade'); assert.ok(r.encounters.get(0)!.complete);
    const c = arena(); c.visited = [0]; c.d.spawns = [{ x: 5, y: 5, kind: 0, room: 0 }]; c.encounters.set(0, { room: 0, type: 'collapse', started: true, time: 2, complete: false, reinforced: true, trialAccepted: false }); c.update(.1, idle); assert.equal(c.status, 'playing'); c.x = 21 * 24; c.update(.1, idle); assert.equal(c.status, 'upgrade'); assert.ok(c.encounters.get(0)!.complete);
});
test('covenants, smith, trader, contracts and checkpoint stats have real consequences', () => {
    const r = arena(); r.status = 'event'; r.event = { kind: 'altar', title: '', description: '', room: 0, options: [{ id: 'hunger', title: '', detail: '' }] }; r.selectEvent('hunger'); assert.equal(r.damage, 30); assert.equal(r.healScale, .5);
    r.status = 'camp'; r.coins = 100; const damage = r.damage; assert.ok(r.campAction('forge')); assert.ok(r.damage > damage); assert.equal(r.coins, 70); assert.ok(r.campAction('potion')); assert.equal(r.potions, 3); assert.ok(r.campAction('hunt')); assert.equal(r.quest?.floor, 2); r.weapon = 3; r.heat = 78;
    const loaded = Run.restore(r.save()); assert.equal(loaded.weapon, 3); assert.equal(loaded.heat, 78); assert.equal(loaded.coins, r.coins); assert.deepEqual(loaded.curses, r.curses); assert.equal(loaded.forge, 1); assert.deepEqual(loaded.quest, r.quest);
});
test('enemies cannot see through a wall but can investigate a noisy shot', () => {
    const r = arena(); for (let y = 1; y < 31; y++) r.d.grid[y][7] = 0; r.x = 5.5 * 24; r.y = 5.5 * 24; const e = foe(r, 1, 9.5 * 24); e.ai.facing = Math.PI; r.enemies = [e];
    assert.equal(los(r.d.grid, { x: e.x / 24, y: e.y / 24 }, { x: r.x / 24, y: r.y / 24 }), false); r.noise(r.x, r.y, 10); r.update(.02, idle); assert.equal(e.ai.visible, false); assert.ok(r.minds.get(e.id)!.heardUntil > r.elapsed);
});

test('fifty expanded floors preserve reachability, roles, deterministic waves and safe spawns', () => {
    for (let seed = 0; seed < 10; seed++) for (let floor = 1; floor <= 5; floor++) {
        const r = new Run(`expanded-${seed}`); r.floor = floor; r.loadFloor();
        assert.equal(r.d.rooms.length, 12); assert.equal(r.encounters.size, 4); assert.ok(validate(r.d));
        assert.ok(r.d.rooms.some(room => room.type === 'altar')); assert.ok(r.d.rooms.some(room => room.type === 'tactics'));
        for (const e of r.enemies) assert.equal(r.d.grid[Math.floor(e.y / 24)][Math.floor(e.x / 24)], 1);
        const pillar = r.objects.find(o => o.kind === 'pillar');
        if (pillar) { r.hitObject(pillar, 100); assert.ok(validate(r.d), 'a fallen column must preserve room access'); }
        if (seed === 0) { const copy = new Run(`expanded-${seed}`); copy.floor = floor; copy.loadFloor(); assert.deepEqual(copy.d.spawns, r.d.spawns); }
    }
});

test('GOAP performs healing and shaman assistance in the actual simulation', () => {
    const r = arena(); r.d.rooms[0].type = 'healing'; const c = center(r.d.rooms[0]);
    const e = foe(r, 0, c.x * 24); e.y = c.y * 24; e.hp = 10; r.enemies = [e]; r.update(.02, idle);
    assert.ok(e.hp > 10); assert.equal(e.healCooldown, 12); assert.equal(r.minds.get(0)!.plan.actions[0].name, 'Restore health');
    const s = arena(), healer = foe(s, 0, 200), ally = foe(s, 1, 205); healer.kind = 5; healer.y = ally.y = 200; ally.hp = 30; s.enemies = [healer, ally]; s.update(.02, idle);
    assert.ok(ally.hp > 30); assert.ok((ally.buff ?? 0) > 0); assert.equal(s.minds.get(0)!.choice.action, 'ASSIST');
});

test('oaths block flasks, heat buys blessings, revival works once and contracts pay once', () => {
    const r = arena(); r.room = 0; r.hp = 50; r.encounters.set(0, { room: 0, type: 'trial', started: true, time: 1, complete: false, reinforced: true, trialAccepted: true }); r.heal(); assert.equal(r.hp, 50); assert.equal(r.potions, 2);
    r.status = 'event'; r.event = { kind: 'altar', room: 0, title: '', description: '', options: [{ id: 'kindle', title: '', detail: '' }] }; r.heat = 65; r.selectEvent('kindle'); assert.equal(r.status, 'upgrade'); assert.equal(r.heat, 45); r.choose(r.picks[0]);
    r.owned.push('Last Ember'); r.hurt(500); assert.equal(r.hp, 25); assert.equal(r.heat, 5); assert.equal(r.revived, true); r.invuln = 0; r.heat = 100; r.hurt(500); assert.equal(r.status, 'dead');
    const c = arena(); c.quest = { kind: 'hunt', floor: 1, target: 8, reward: 50, completed: false }; c.floorKills = 8; const exit = center(c.d.rooms.at(-1)!); c.x = (exit.x + .5) * 24; c.y = (exit.y + .5) * 24; const coins = c.coins; c.interact(); assert.equal(c.coins, coins + 50); assert.equal(c.quest, undefined); c.interact(); assert.equal(c.coins, coins + 50);
});

test('negative visual evidence respects the ember-adjusted vision distance', () => {
    const r = arena(), e = foe(r, 0, 6.5 * 24); e.y = 6.5 * 24; e.ai.facing = 0; e.ai.visible = false;
    const mind = new EnemyMind(r.d.grid, { x: 6.5, y: 6.5 }); mind.update(e, { grid: r.d.grid, player: { x: 20, y: 20 }, noises: [], time: 0, visionScale: .5 }, 0);
    const near = mind.belief.probability[6 * 32 + 8], beyondDimVision = mind.belief.probability[6 * 32 + 12];
    assert.ok(near < beyondDimVision * .05); assert.ok(beyondDimVision > 0); assert.ok(Math.abs(beyondDimVision - mind.belief.probability[6 * 32 + 20]) < 1e-10);
});
