export type Point = { x: number; y: number };
export type SearchMethod = 'BFS' | 'Dijkstra' | 'A*';
export interface RouteResult { path: Point[]; visited: Point[]; cost: number; scores: Record<string, { g: number; h: number; f: number }>; }
export const pointKey = (p: Point) => `${p.x},${p.y}`;
const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
class Queue {
    data: { p: Point; priority: number; cost: number }[] = [];
    push(item: { p: Point; priority: number; cost: number }) { let i = this.data.length; this.data.push(item); while (i > 0) { const parent = (i - 1) >> 1; if (this.data[parent].priority <= item.priority) break; this.data[i] = this.data[parent]; i = parent; } this.data[i] = item; }
    pop() { const first = this.data[0], tail = this.data.pop()!; if (this.data.length) { let i = 0; while (i * 2 + 1 < this.data.length) { let child = i * 2 + 1; if (child + 1 < this.data.length && this.data[child + 1].priority < this.data[child].priority) child++; if (this.data[child].priority >= tail.priority) break; this.data[i] = this.data[child]; i = child; } this.data[i] = tail; } return first; }
}
/** BFS optimizes moves; Dijkstra and A* optimize positive tile-entry costs. */
export function searchGrid(grid: number[][], start: Point, goal: Point, method: SearchMethod = 'A*', costs?: number[][]): RouteResult {
    const result: RouteResult = { path: [], visited: [], cost: Infinity, scores: {} };
    if (grid[start.y]?.[start.x] !== 1 || grid[goal.y]?.[goal.x] !== 1) return result;
    const open = new Queue(), closed = new Set<string>(), parents = new Map<string, Point>();
    const heuristic = (p: Point) => method === 'A*' ? Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y) : 0;
    let order = 0;
    result.scores[pointKey(start)] = { g: 0, h: heuristic(start), f: heuristic(start) };
    open.push({ p: start, priority: heuristic(start), cost: 0 });
    while (open.data.length) {
        const { p, cost } = open.pop(), k = pointKey(p);
        if (closed.has(k) || cost !== result.scores[k].g) continue;
        closed.add(k); result.visited.push(p);
        if (k === pointKey(goal)) { let node = p; result.path = [node]; while (parents.has(pointKey(node))) { node = parents.get(pointKey(node))!; result.path.unshift(node); } result.cost = result.path.slice(1).reduce((sum, n) => sum + Math.max(1, costs?.[n.y]?.[n.x] ?? 1), 0); return result; }
        for (const d of directions) {
            const n = { x: p.x + d.x, y: p.y + d.y }, nk = pointKey(n);
            if (grid[n.y]?.[n.x] !== 1 || closed.has(nk)) continue;
            const g = cost + (method === 'BFS' ? 1 : Math.max(1, costs?.[n.y]?.[n.x] ?? 1));
            if (g >= (result.scores[nk]?.g ?? Infinity)) continue;
            const h = heuristic(n); result.scores[nk] = { g, h, f: g + h }; parents.set(nk, p);
            open.push({ p: n, priority: method === 'BFS' ? ++order : g + h, cost: g });
        }
    }
    return result;
}
