import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Run, TILE } from '../src/simulation';
import { Agent } from '../src/ai';
const idle = { x: 0, y: 0, shoot: false, angle: 0, dash: false };
function arena() { const r = new Run('arena'); r.d.grid = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => x > 0 && y > 0 && x < 63 && y < 63 ? 1 : 0)); r.x = 5.5 * TILE; r.y = 5.5 * TILE; r.enemies = []; return r; }
test('real projectiles hit and kill, then exactly one room-clear reward pauses simulation', () => { const r = arena(); const room = r.d.rooms.findIndex(q => q.type === 'combat'); const q = r.d.rooms[room]; r.x = (q.x + 2.5) * TILE; r.y = (q.y + 2.5) * TILE; r.visited = [room]; r.enemies = [{ id: 0, x: r.x + 45, y: r.y, hp: 10, max: 10, kind: 0, room, ai: new Agent({ x: r.x / TILE + 2, y: r.y / TILE }), burn: 0, phase: 0, telegraph: 0, patrol: { x: r.x / TILE + 2, y: r.y / TILE } }]; r.fire(r.x, r.y, 0); for (let i = 0; i < 30 && r.status === 'playing'; i++)
    r.update(1 / 60, idle); assert.equal(r.enemies.length, 0); assert.equal(r.kills, 1); assert.equal(r.status, 'upgrade'); assert.equal(new Set(r.picks).size, 3); const t = r.elapsed; r.update(1, idle); assert.equal(r.elapsed, t); r.choose(r.picks[0]); r.update(1 / 60, idle); assert.equal(r.status, 'playing'); assert.deepEqual(r.cleared, [room]); });
test('solid wall blocks projectiles and movement', () => { const r = arena(); r.d.grid[5][6] = 0; r.fire(r.x, r.y, 0); for (let i = 0; i < 60; i++)
    r.update(1 / 60, { ...idle, x: 1 }); assert.ok(r.x < 6 * TILE - 6); assert.equal(r.bullets.length, 0); });
test('enemy shots damage once and invulnerability blocks repeated hits', () => { const r = arena(); r.fire(r.x - 15, r.y, 0, true, 12); r.fire(r.x - 16, r.y, 0, true, 12); r.update(.04, idle); assert.equal(r.hp, 88); assert.ok(r.invuln > 0); });
test('boss telegraphs before firing and phase two increases ring density', () => { const r = arena(); const e = { id: 9, x: r.x + 60, y: r.y, hp: 650, max: 650, kind: 4, room: 1, ai: new Agent({ x: r.x / TILE + 2.5, y: r.y / TILE }, 1.35, 14, Math.PI * 2), burn: 0, phase: 0, telegraph: 0, patrol: { x: 8, y: 5 } }; e.ai.facing = Math.PI; r.enemies = [e]; r.update(.04, idle); assert.ok(e.telegraph > 0); assert.equal(r.bullets.length, 0); for (let i = 0; i < 24; i++)
    r.update(.04, idle); assert.ok(r.bullets.length >= 10); r.bullets = []; e.hp = 250; e.ai.cooldown = 0; r.update(.04, idle); assert.equal(e.phase, 2); for (let i = 0; i < 24; i++)
    r.update(.04, idle); assert.ok(r.bullets.length >= 15); });
