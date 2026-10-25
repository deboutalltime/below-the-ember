import { Random, Cell, astar, walk } from './ai';
export interface Room {
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
}
export interface Dungeon {
    generation: { solverSucceeded: boolean; fallbackUsed: boolean; traceTruncated: boolean; candidateAttempts: number; backtracks: number; searchBudget: number; traceLimit: number };
    grid: number[][];
    rooms: Room[];
    spawns: {
        x: number;
        y: number;
        kind: number;
        room: number;
    }[];
    attempts: {
        room: Room;
        accepted: boolean;
        reason: string;
        stack: Room[];
        event: 'candidate' | 'backtrack';
    }[];
    connections: Cell[][];
    seed: string;
}
export const center = (r: Room) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });
export class GenerationInputError extends RangeError {
    constructor(public field: 'floor' | 'size' | 'count' | 'separation', message: string) { super(message); this.name = 'GenerationInputError'; }
}
export function generate(seed: string, floor = 1, size = 64, count = 8, separation = 2): Dungeon {
    for (const [field, value, min, max, label] of [
        ['floor', floor, 1, 5, 'Floor'], ['size', size, 48, 80, 'Map size'],
        ['count', count, 4, 12, 'Rooms'], ['separation', separation, 1, 4, 'Minimum separation'],
    ] as const) if (!Number.isInteger(value) || value < min || value > max)
        throw new GenerationInputError(field, `${label} must be a whole number from ${min} to ${max}.`);
    const rng = new Random(`${seed}:${floor}:${size}:${count}:${separation}`), rooms: Room[] = [], attempts: Dungeon['attempts'] = [];
    const generation = { solverSucceeded: false, fallbackUsed: false, traceTruncated: false, candidateAttempts: 0, backtracks: 0, searchBudget: 6000, traceLimit: 1500 };
    let budget = generation.searchBudget;
    const record = (entry: Dungeon['attempts'][number]) => {
        if (attempts.length < generation.traceLimit) attempts.push(entry);
        else generation.traceTruncated = true;
    };
    const fits = (r: Room) => rooms.every(o => r.x + r.w + separation <= o.x || o.x + o.w + separation <= r.x || r.y + r.h + separation <= o.y || o.y + o.h + separation <= r.y);
    function solve(i: number): boolean { if (i === count)
        return true; for (let tries = 0; tries < 60 && budget > 0; tries++) {
        budget--; generation.candidateAttempts++;
        const w = rng.int(6, 10), h = rng.int(6, 9), r = { x: rng.int(2, size - w - 2), y: rng.int(2, size - h - 2), w, h, type: i === 0 ? 'spawn' : i === count - 1 ? 'exit' : i === 2 ? 'healing' : i === 3 ? 'treasure' : 'combat' }, accepted = fits(r);
        record({ room: r, accepted, reason: accepted ? 'All geometric constraints satisfied' : 'Overlap / minimum separation', stack: rooms.map(room => ({ ...room })), event: 'candidate' });
        if (!accepted)
            continue;
        rooms.push(r);
        if (solve(i + 1))
            return true;
        rooms.pop();
        generation.backtracks++;
        record({ room: r, accepted: false, reason: 'Domain exhausted deeper in search: undo this assignment', stack: rooms.map(room => ({ ...room })), event: 'backtrack' });
    } return false; }
    generation.solverSucceeded = solve(0);
    generation.fallbackUsed = !generation.solverSucceeded;
    if (generation.fallbackUsed) {
        rooms.length = 0;
        const cols = Math.ceil(Math.sqrt(count)), spacing = Math.floor((size - 4) / cols);
        for (let i = 0; i < count; i++)
            rooms.push({ x: 2 + i % cols * spacing, y: 2 + Math.floor(i / cols) * spacing, w: Math.max(3, Math.min(7, spacing - 2)), h: Math.max(3, Math.min(7, spacing - 2)), type: i === 0 ? 'spawn' : i === count - 1 ? 'exit' : 'combat' });
    }
    const grid = Array.from({ length: size }, () => Array<number>(size).fill(0)), connections: Cell[][] = [];
    for (const r of rooms)
        for (let y = r.y; y < r.y + r.h; y++)
            for (let x = r.x; x < r.x + r.w; x++)
                grid[y][x] = 1;
    // A spanning chain provides the global reachability constraint after room assignment.
    for (let i = 1; i < rooms.length; i++) {
        let a = center(rooms[i - 1]), b = center(rooms[i]), path: Cell[] = [];
        const horizontal = rng.next() < .5;
        const carve = (axis: 'x' | 'y') => { while (a[axis] !== b[axis]) {
            grid[a.y][a.x] = 1;
            path.push({ ...a });
            a[axis] += Math.sign(b[axis] - a[axis]);
        } };
        carve(horizontal ? 'x' : 'y');
        carve(horizontal ? 'y' : 'x');
        grid[a.y][a.x] = 1;
        connections.push(path);
    }
    const spawns: Dungeon['spawns'] = [];
    rooms.forEach((r, i) => { if (r.type === 'combat' || floor === 5 && r.type === 'exit') {
        const n = r.type === 'exit' ? 1 : 2 + Math.floor(floor / 2);
        for (let j = 0; j < n; j++)
            spawns.push({ x: rng.int(r.x + 1, r.x + r.w - 2) + .5, y: rng.int(r.y + 1, r.y + r.h - 2) + .5, kind: r.type === 'exit' ? 4 : rng.int(0, Math.min(3, floor)), room: i });
    } });
    return { grid, rooms, spawns, attempts, connections, seed, generation };
}
export function validate(d: Dungeon) { const start = center(d.rooms[0]); const reachable = new Set<string>(), todo = [start]; while (todo.length) {
    const p = todo.pop()!, k = `${p.x},${p.y}`;
    if (reachable.has(k) || !walk(d.grid, p))
        continue;
    reachable.add(k);
    todo.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
} return d.rooms.every(r => reachable.has(`${center(r).x},${center(r).y}`)) && astar(d.grid, start, center(d.rooms.at(-1)!)).path.length > 0; }
