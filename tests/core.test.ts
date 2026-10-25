import { test } from 'node:test';
import assert from 'node:assert/strict';
import { astar, Agent, los } from '../src/ai';
import { generate, validate } from '../src/dungeon';
import { Run } from '../src/simulation';
test('same seed and floor reproduce rooms, corridors and contents', () => { for (let floor = 1; floor <= 5; floor++)
    assert.deepEqual(generate('university', floor), generate('university', floor)); assert.notDeepEqual(generate('a').rooms, generate('b').rooms); });
test('100 seeded floors are connected and have separated rooms', () => { for (let n = 0; n < 20; n++)
    for (let floor = 1; floor <= 5; floor++) {
        const d = generate(String(n), floor);
        assert.ok(validate(d));
        for (let i = 0; i < d.rooms.length; i++)
            for (let j = i + 1; j < d.rooms.length; j++) {
                const a = d.rooms[i], b = d.rooms[j];
                assert.ok(a.x + a.w + 2 <= b.x || b.x + b.w + 2 <= a.x || a.y + a.h + 2 <= b.y || b.y + b.h + 2 <= a.y);
            }
    } });
test('A* finds shortest path around walls, cardinal valid steps and unreachable handling', () => { const g = Array.from({ length: 8 }, () => Array(8).fill(1)); for (let y = 0; y < 7; y++)
    g[y][3] = 0; const r = astar(g, { x: 1, y: 1 }, { x: 6, y: 1 }, true); assert.equal(r.path.length - 1, 17); r.path.forEach((p, i) => { assert.equal(g[p.y][p.x], 1); if (i)
    assert.equal(Math.abs(p.x - r.path[i - 1].x) + Math.abs(p.y - r.path[i - 1].y), 1); }); g[7][3] = 0; assert.equal(astar(g, { x: 1, y: 1 }, { x: 6, y: 1 }).path.length, 0); });
test('walls block perception and FSM alerts, chases, attacks, searches, returns to patrol', () => { const g = Array.from({ length: 12 }, () => Array(12).fill(1)), a = new Agent({ x: 2.5, y: 2.5 }); const pos = { x: 2.5, y: 2.5 }, p = { x: 5.5, y: 2.5 }; assert.equal(a.observe(g, pos, p, .1), 'ALERT'); assert.equal(a.observe(g, pos, p, .4), 'CHASE'); assert.equal(a.observe(g, pos, { x: 3, y: 2.5 }, .1), 'ATTACK'); g[2][4] = 0; assert.equal(los(g, pos, p), false); assert.equal(a.observe(g, pos, p, .1), 'SEARCH'); assert.equal(a.observe(g, pos, p, 6), 'PATROL'); });
test('potions, capped upgrades, damage invulnerability and death', () => { const r = new Run('test'); r.hp = 90; r.heal(); assert.equal(r.hp, 100); assert.equal(r.potions, 1); r.hurt(10); r.hurt(10); assert.equal(r.hp, 90); r.invuln = 0; r.hurt(500); assert.equal(r.status, 'dead'); const s = new Run('upgrade'); for (let n = 0; n < 10; n++) {
    s.status = 'upgrade';
    s.picks = [5];
    s.choose(5);
} assert.equal(s.split, 5); });
test('campaign has exactly five floors, required objectives, shelters and terminal victory', () => {
    const r = new Run('campaign');
    for (let f = 1; f <= 5; f++) {
        assert.equal(r.floor, f);
        const room = r.d.rooms.at(-1)!;
        r.x = (Math.floor(room.x + room.w / 2) + .5) * 24;
        r.y = (Math.floor(room.y + room.h / 2) + .5) * 24;
        r.interact(); assert.equal(r.status, 'playing');
        if (f === 5) assert.ok(r.enemies.some(e => e.kind === 4));
        r.enemies = [];
        for (const encounter of r.encounters.values()) encounter.complete = true;
        r.interact();
        if (f < 5) { assert.equal(r.status, 'camp'); r.campAction('descend'); }
    }
    assert.equal(r.floor, 5); assert.equal(r.status, 'victory');
});
test('save restores statistics and deterministic floor checkpoint', () => { const r = new Run('save'); r.floor = 3; r.loadFloor(); r.damage = 43; r.hp = 67; const restored = Run.restore(r.save()); assert.equal(restored.damage, 43); assert.equal(restored.hp, 67); assert.deepEqual(restored.d, r.d); });
