import { searchGrid } from './intelligence/search';
export type Cell = {
    x: number;
    y: number;
};
export class Random {
    n: number;
    constructor(seed: string) { this.n = 2166136261; for (const c of seed)
        this.n = Math.imul(this.n ^ c.charCodeAt(0), 16777619) >>> 0; }
    next() { let t = this.n += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    int(a: number, b: number) { return a + Math.floor(this.next() * (b - a + 1)); }
}
export const key = (p: Cell) => `${p.x},${p.y}`;
export const walk = (grid: number[][], p: Cell) => grid[p.y]?.[p.x] === 1;
export interface Search {
    path: Cell[];
    closed: Cell[];
    open: Cell[];
    scores: Record<string, {
        g: number;
        h: number;
        f: number;
    }>;
    steps: {
        open: Cell[];
        closed: Cell[];
    }[];
}
class Heap {
    a: {
        p: Cell;
        f: number;
    }[] = [];
    push(v: {
        p: Cell;
        f: number;
    }) { this.a.push(v); let i = this.a.length - 1; while (i > 0) {
        let j = (i - 1) >> 1;
        if (this.a[j].f <= v.f)
            break;
        this.a[i] = this.a[j];
        i = j;
    } this.a[i] = v; }
    pop() { const v = this.a[0], last = this.a.pop()!; if (this.a.length) {
        let i = 0;
        while (i * 2 + 1 < this.a.length) {
            let j = i * 2 + 1;
            if (j + 1 < this.a.length && this.a[j + 1].f < this.a[j].f)
                j++;
            if (this.a[j].f >= last.f)
                break;
            this.a[i] = this.a[j];
            i = j;
        }
        this.a[i] = last;
    } return v; }
}
export function astar(grid: number[][], start: Cell, goal: Cell, trace = false): Search { const result: Search = { path: [], closed: [], open: [], scores: {}, steps: [] }; if (!walk(grid, start) || !walk(grid, goal))
    return result; const heap = new Heap(), closed = new Set<string>(), parents = new Map<string, Cell>(); const h = (p: Cell) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y); result.scores[key(start)] = { g: 0, h: h(start), f: h(start) }; heap.push({ p: start, f: h(start) }); while (heap.a.length) {
    const { p } = heap.pop(), k = key(p);
    if (closed.has(k))
        continue;
    closed.add(k);
    result.closed.push(p);
    if (k === key(goal)) {
        let c = p;
        result.path = [c];
        while (parents.has(key(c))) {
            c = parents.get(key(c))!;
            result.path.unshift(c);
        }
        break;
    }
    for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const n = { x: p.x + d.x, y: p.y + d.y }, nk = key(n), g = result.scores[k].g + 1;
        if (!walk(grid, n) || closed.has(nk) || g >= (result.scores[nk]?.g ?? Infinity))
            continue;
        parents.set(nk, p);
        result.scores[nk] = { g, h: h(n), f: g + h(n) };
        heap.push({ p: n, f: g + h(n) });
    }
    if (trace)
        result.steps.push({ closed: [...result.closed], open: heap.a.filter(v => !closed.has(key(v.p))).map(v => v.p) });
} result.open = heap.a.filter(v => !closed.has(key(v.p))).map(v => v.p); return result; }
export function los(grid: number[][], a: Cell, b: Cell) { const d = Math.hypot(b.x - a.x, b.y - a.y); for (let t = 0; t <= d; t += .2) {
    const f = d ? t / d : 0;
    if (!walk(grid, { x: Math.floor(a.x + (b.x - a.x) * f), y: Math.floor(a.y + (b.y - a.y) * f) }))
        return false;
} return true; }
export type State = 'PATROL' | 'ALERT' | 'CHASE' | 'ATTACK' | 'SEARCH';
export class Agent {
    state: State = 'PATROL';
    last: Cell;
    lost = 0;
    reaction = 0;
    cooldown = 0;
    facing = 0;
    visible = false;
    distance = 0;
    path: Cell[] = [];
    targetKey = '';
    repath = 0;
    constructor(public home: Cell, public range = 1.3, public vision = 9, public fov = Math.PI * 1.5) { this.last = { ...home }; }
    observe(grid: number[][], pos: Cell, player: Cell, dt: number, visionMultiplier = 1) { this.distance = Math.hypot(pos.x - player.x, pos.y - player.y); const angle = Math.atan2(player.y - pos.y, player.x - pos.x); const delta = Math.atan2(Math.sin(angle - this.facing), Math.cos(angle - this.facing)); this.visible = this.distance < this.vision * visionMultiplier && Math.abs(delta) < this.fov / 2 && los(grid, pos, player); this.cooldown = Math.max(0, this.cooldown - dt); this.repath -= dt; if (this.visible) {
        this.last = { ...player };
        this.lost = 0;
    }
    else
        this.lost += dt; switch (this.state) {
        case 'PATROL':
            if (this.visible) {
                this.state = 'ALERT';
                this.reaction = .3;
            }
            break;
        case 'ALERT':
            this.reaction -= dt;
            if (this.reaction <= 0)
                this.state = this.visible ? 'CHASE' : 'SEARCH';
            break;
        case 'CHASE':
            if (!this.visible)
                this.state = 'SEARCH';
            else if (this.distance <= this.range)
                this.state = 'ATTACK';
            break;
        case 'ATTACK':
            if (!this.visible)
                this.state = 'SEARCH';
            else if (this.distance > this.range)
                this.state = 'CHASE';
            break;
        case 'SEARCH':
            if (this.visible)
                this.state = 'CHASE';
            else if (this.lost > 5)
                this.state = 'PATROL';
            break;
    } return this.state; }
    route(grid: number[][], pos: Cell, target: Cell, costs?: number[][]) { const t = { x: Math.floor(target.x), y: Math.floor(target.y) }; if (this.targetKey !== key(t) || this.repath <= 0) {
        this.path = (costs ? searchGrid(grid, { x: Math.floor(pos.x), y: Math.floor(pos.y) }, t, 'A*', costs).path : astar(grid, { x: Math.floor(pos.x), y: Math.floor(pos.y) }, t).path).slice(1);
        this.targetKey = key(t);
        this.repath = .6;
    } return this.path; }
}
