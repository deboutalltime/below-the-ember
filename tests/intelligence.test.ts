import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchGrid } from '../src/intelligence/search';
import { chooseUtility } from '../src/intelligence/utility';
import { planGOAP, tacticalActions } from '../src/intelligence/planner';
import { decideBoss } from '../src/intelligence/behavior';
import { BeliefMap } from '../src/intelligence/belief';
import { minimaxMove } from '../src/intelligence/minimax';
import { QLearner } from '../src/intelligence/learning';
import { evolveEncounter, encounterFitness } from '../src/intelligence/evolution';

test('weighted A* and Dijkstra find a cheaper detour than BFS', () => {
    const grid = Array.from({ length: 9 }, () => Array(14).fill(1)), costs = grid.map(row => row.map(() => 1));
    for (let x = 4; x < 10; x++) costs[4][x] = 10;
    const start = { x: 1, y: 4 }, goal = { x: 12, y: 4 }, bfs = searchGrid(grid, start, goal, 'BFS', costs), dijkstra = searchGrid(grid, start, goal, 'Dijkstra', costs), astar = searchGrid(grid, start, goal, 'A*', costs);
    assert.equal(astar.cost, dijkstra.cost); assert.ok(astar.cost < bfs.cost); assert.ok(astar.path.length > bfs.path.length);
    for (const r of [bfs, dijkstra, astar]) for (let i = 1; i < r.path.length; i++) assert.equal(Math.abs(r.path[i].x - r.path[i - 1].x) + Math.abs(r.path[i].y - r.path[i - 1].y), 1);
});
test('Utility AI selects context-appropriate tactical intentions', () => {
    const o = { health: 1, visible: true, distance: 1, range: 6, cooldown: 0, heard: false, lost: 8, allyInjured: false, hasShrine: false, ranged: false, healer: false, ward: false };
    assert.equal(chooseUtility(o).action, 'ATTACK'); assert.equal(chooseUtility({ ...o, ranged: true }).action, 'RETREAT');
    assert.equal(chooseUtility({ ...o, visible: false, health: .1, hasShrine: true }).action, 'HEAL');
    assert.equal(chooseUtility({ ...o, visible: false, healer: true, allyInjured: true }).action, 'ASSIST');
    assert.equal(chooseUtility({ ...o, visible: false, heard: true }).action, 'INVESTIGATE');
});
test('GOAP finds a valid least-cost sequence and rejects impossible goals', () => {
    const start = { covered: false, aimed: false, attacked: false };
    const result = planGOAP(start, { attacked: true }, tacticalActions);
    assert.deepEqual(result.actions.map(a => a.name), ['Reach cover', 'Take aim', 'Fire from cover']); assert.equal(result.cost, 4);
    const state: Record<string, boolean> = { ...start };
    for (const action of result.actions) { for (const [key, value] of Object.entries(action.requires)) assert.equal(Boolean(state[key]), value); Object.assign(state, action.effects); }
    assert.equal(state.attacked, true); assert.equal(planGOAP({ shrine: false }, { healed: true }, tacticalActions).reachable, false);
});
test('boss behavior tree resolves warning before selecting another attack', () => {
    let result = decideBoss({ visible: true, windup: 0, cooldown: 0, dt: .1, phase: 1, command: 'WAIT' });
    assert.equal(result.context.command, 'WARN'); assert.equal(result.context.windup, .9);
    result = decideBoss({ ...result.context, dt: .3 }); assert.equal(result.context.command, 'WAIT'); assert.ok(result.trace.some(n => n.status === 'RUNNING'));
    result = decideBoss({ ...result.context, dt: .7 }); assert.equal(result.context.command, 'RELEASE');
    assert.equal(decideBoss({ visible: false, windup: 0, cooldown: 1, dt: .1, phase: 2, command: 'WAIT' }).context.command, 'SEARCH');
});
test('Bayesian sight, sound, prediction and exclusion conserve probability', () => {
    const grid = Array.from({ length: 8 }, () => Array(8).fill(1)); grid[3][3] = 0;
    const b = new BeliefMap(grid), entropy = b.entropy(); b.hear({ x: 5, y: 4 }, 1.2);
    assert.ok(b.probability[4 * 8 + 5] > b.probability[0]); b.see({ x: 5, y: 4 }); assert.ok(b.entropy() < entropy); b.predict();
    assert.ok(b.probability[4 * 8 + 4] > 0); b.excludeVisible(p => p.x === 5 && p.y === 4);
    assert.ok(Math.abs(b.probability.reduce((a, v) => a + v, 0) - 1) < 1e-10); assert.equal(b.probability[3 * 8 + 3], 0);
});
test('minimax wins, blocks and alpha–beta preserves the answer with fewer nodes', () => {
    assert.equal(minimaxMove([-1, -1, 0, 1, 1, 0, 0, 0, 0]).move, 2);
    assert.equal(minimaxMove([1, 1, 0, 0, -1, 0, 0, 0, 0]).move, 2);
    const board = [1, 0, 0, 0, -1, 0, 0, 0, 0], a = minimaxMove(board, true), b = minimaxMove(board, false);
    assert.equal(a.value, b.value); assert.equal(a.move, b.move); assert.ok(a.nodes < b.nodes); assert.ok(a.cutoffs > 0);
});
test('Q-learning actually learns a safe policy, reproducibly from an empty table', () => {
    const a = new QLearner('test'), b = new QLearner('test'); assert.ok(a.q.every(row => row.every(v => v === 0)));
    a.train(1000); b.train(1000); assert.deepEqual(a.q, b.q); assert.ok(a.q.some(row => row.some(v => v !== 0)));
    const policy = a.policy(); assert.equal(policy.success, true, policy.reason); assert.ok(policy.path.every(n => !a.walls.has(n) && !a.traps.has(n)));
    assert.equal(a.episodes, 1000); assert.ok(a.successes.slice(-50).reduce((x, y) => x + y, 0) > 40);
});
test('genetic encounters are deterministic, constrained and preserve elite fitness', () => {
    for (let floor = 1; floor <= 5; floor++) {
        const a = evolveEncounter('exam', floor), b = evolveEncounter('exam', floor); assert.deepEqual(a, b);
        assert.ok(a.kinds.length >= 2 && a.kinds.length <= 7); assert.ok(!a.kinds.includes(4));
        if (floor === 1) assert.ok(a.kinds.every(k => k <= 1));
        assert.ok(encounterFitness(a.genome, a.budget, floor) > -100);
        a.history.forEach((g, i) => { if (i) assert.ok(g.best >= a.history[i - 1].best); });
    }
});
