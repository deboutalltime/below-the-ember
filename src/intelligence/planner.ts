export type Facts = Record<string, boolean>;
export interface PlanningAction { name: string; cost: number; requires: Facts; effects: Facts; }
export interface PlanResult { actions: PlanningAction[]; cost: number; explored: number; reachable: boolean; }
const matches = (state: Facts, test: Facts) => Object.entries(test).every(([k, v]) => Boolean(state[k]) === v);
const stateKey = (state: Facts) => Object.keys(state).sort().map(k => `${k}:${Number(state[k])}`).join('|');
/** Uniform-cost graph search over symbolic states with explicit preconditions/effects. */
export function planGOAP(start: Facts, goal: Facts, actions: PlanningAction[], limit = 512): PlanResult {
    const queue = [{ state: { ...start }, path: [] as PlanningAction[], cost: 0 }], best = new Map<string, number>();
    let explored = 0;
    while (queue.length && explored < limit) {
        queue.sort((a, b) => a.cost - b.cost); const node = queue.shift()!, k = stateKey(node.state);
        if ((best.get(k) ?? Infinity) <= node.cost) continue;
        best.set(k, node.cost); explored++;
        if (matches(node.state, goal)) return { actions: node.path, cost: node.cost, explored, reachable: true };
        for (const action of actions) {
            if (!matches(node.state, action.requires)) continue;
            const state = { ...node.state, ...action.effects };
            if (stateKey(state) === k) continue;
            queue.push({ state, path: [...node.path, action], cost: node.cost + Math.max(.01, action.cost) });
        }
    }
    return { actions: [], cost: Infinity, explored, reachable: false };
}
export const tacticalActions: PlanningAction[] = [
    { name: 'Reach cover', cost: 2, requires: { covered: false }, effects: { covered: true, aimed: false } },
    { name: 'Take aim', cost: 1, requires: { covered: true }, effects: { aimed: true } },
    { name: 'Fire from cover', cost: 1, requires: { aimed: true }, effects: { attacked: true } },
    { name: 'Reach shrine', cost: 3, requires: { shrine: true }, effects: { atShrine: true } },
    { name: 'Restore health', cost: 1, requires: { atShrine: true }, effects: { healed: true } },
    { name: 'Reach ally', cost: 2, requires: { injuredAlly: true }, effects: { atAlly: true } },
    { name: 'Bless ally', cost: 1, requires: { atAlly: true }, effects: { assisted: true } },
];
