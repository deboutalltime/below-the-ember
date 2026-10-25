import { Cell, Random } from '../ai';
import { Dungeon, center } from '../dungeon';
import { searchGrid } from '../intelligence/search';
export type ObjectKind = 'oil' | 'fire' | 'trap' | 'pot' | 'pillar' | 'rubble' | 'altar' | 'secret' | 'ward' | 'choice' | 'tactics' | 'gate';
export interface WorldObject { id: number; kind: ObjectKind; x: number; y: number; room: number; hp: number; active: number; cooldown: number; used: boolean; solid?: boolean; }
export interface Encounter { room: number; type: 'combat' | 'defense' | 'collapse' | 'trial'; started: boolean; time: number; complete: boolean; reinforced: boolean; trialAccepted: boolean; escapeHint?: boolean; }
export interface Noise { id: number; x: number; y: number; radius: number; life: number; }
export const roomRoles = ['spawn', 'combat', 'healing', 'treasure', 'defense', 'collapse', 'trial', 'altar', 'secret', 'choice', 'tactics', 'exit'];
/** Seeded, walkable room contents; no global Math.random enters game generation. */
export function populateEnvironment(dungeon: Dungeon, seed: string, floor: number) {
    const random = new Random(`${seed}:objects:${floor}`), objects: WorldObject[] = [], encounters = new Map<number, Encounter>();
    let id = 0;
    dungeon.rooms.forEach((room, i) => {
        room.type = roomRoles[i] ?? 'combat';
        const c = center(room), add = (kind: ObjectKind, x: number, y: number, hp = 1) => objects.push({ id: id++, kind, x: x * 24, y: y * 24, room: i, hp, active: 0, cooldown: 0, used: false });
        if (['combat', 'defense', 'collapse', 'trial'].includes(room.type)) encounters.set(i, { room: i, type: room.type as Encounter['type'], started: false, time: 0, complete: false, reinforced: false, trialAccepted: false });
        if (room.type !== 'spawn') {
            add('pot', room.x + 1.5, room.y + room.h - 1.5, 1);
            if (['combat', 'defense', 'collapse', 'trial'].includes(room.type)) {
                add('oil', room.x + room.w - 2.5, room.y + room.h - 2.5);
                add('trap', room.x + 2.5, room.y + 2.5);
                if (random.next() < .8) add('pillar', room.x + room.w - 2.5, room.y + 1.5, 35);
            }
        }
        if (room.type === 'defense') add('ward', c.x + .5, c.y + .5, 120);
        if (room.type === 'altar') add('altar', c.x + .5, c.y + .5);
        if (room.type === 'secret') add('secret', c.x + .5, c.y + .5, 25);
        if (room.type === 'choice') add('choice', c.x + .5, c.y + .5);
        if (room.type === 'tactics') add('tactics', c.x + .5, c.y + .5);
    });
    return { objects, encounters };
}
export function hazardCosts(grid: number[][], objects: WorldObject[], encounters: Map<number, Encounter>, dungeon: Dungeon) {
    const costs = grid.map(row => row.map(() => 1));
    for (const object of objects) if (object.kind === 'trap' || object.kind === 'fire' && object.active > 0 || object.kind === 'oil' && object.active > 0) {
        const x = Math.floor(object.x / 24), y = Math.floor(object.y / 24); if (costs[y]?.[x] !== undefined) costs[y][x] = object.kind === 'trap' ? 5 : 9;
    }
    for (const e of encounters.values()) if (e.type === 'collapse' && e.started && e.time > 7 && !e.complete) {
        const r = dungeon.rooms[e.room], inset = Math.min(3, Math.floor((e.time - 7) / 5) + 1);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x < r.x + inset || x >= r.x + r.w - inset || y < r.y + inset || y >= r.y + r.h - inset) costs[y][x] = 10;
    }
    return costs;
}
export function canBlockCell(d: Dungeon, cell: Cell, player: Cell) {
    if (d.grid[cell.y]?.[cell.x] !== 1 || cell.x === Math.floor(player.x) && cell.y === Math.floor(player.y)) return false;
    d.grid[cell.y][cell.x] = 0;
    const start = { x: Math.floor(player.x), y: Math.floor(player.y) };
    const safe = d.rooms.every(r => searchGrid(d.grid, start, center(r), 'BFS').path.length > 0);
    d.grid[cell.y][cell.x] = 1; return safe;
}
