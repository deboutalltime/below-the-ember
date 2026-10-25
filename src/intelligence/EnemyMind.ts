import { Cell, los, walk } from '../ai';
import { BeliefMap } from './belief';
import { chooseUtility, UtilityChoice } from './utility';
import { planGOAP, PlanResult, tacticalActions } from './planner';
import type { Enemy } from '../simulation';
import type { Noise } from '../game/environment';
export interface MindWorld { grid: number[][]; player: Cell; noises: Noise[]; shrine?: Cell; ally?: Enemy; ward?: Cell; time: number; visionScale?: number; }
export class EnemyMind {
    belief: BeliefMap;
    sample = 0;
    decisionTimer = 0;
    heardUntil = -1;
    heardIds = new Set<number>();
    choice: UtilityChoice = { action: 'PATROL', scores: [] };
    plan: PlanResult = { actions: [], cost: 0, explored: 0, reachable: true };
    target: Cell;
    aimed = false;
    constructor(grid: number[][], home: Cell) { this.belief = new BeliefMap(grid); this.target = { ...home }; }
    update(enemy: Enemy, world: MindWorld, dt: number) {
        const pos = { x: enemy.x / 24, y: enemy.y / 24 };
        this.sample -= dt; this.decisionTimer -= dt;
        for (const noise of world.noises) if (!this.heardIds.has(noise.id) && Math.hypot(pos.x - noise.x / 24, pos.y - noise.y / 24) <= noise.radius * (los(world.grid, pos, { x: noise.x / 24, y: noise.y / 24 }) ? 1 : .55)) {
            this.heardIds.add(noise.id); this.heardUntil = world.time + 2.5;
            this.belief.hear({ x: Math.floor(noise.x / 24), y: Math.floor(noise.y / 24) }, 1.7);
            if (enemy.ai.state === 'PATROL') { enemy.ai.state = 'ALERT'; enemy.ai.reaction = .25; }
            if (!enemy.ai.visible) enemy.ai.last = this.belief.likely();
            this.decisionTimer = 0;
        }
        if (this.sample <= 0) {
            this.sample = .7; this.belief.predict();
            if (enemy.ai.visible) this.belief.see({ x: Math.floor(world.player.x), y: Math.floor(world.player.y) });
            else this.belief.excludeVisible(cell => {
                const dx = cell.x + .5 - pos.x, dy = cell.y + .5 - pos.y;
                if (Math.hypot(dx, dy) > enemy.ai.vision * (world.visionScale ?? 1)) return false;
                const angle = Math.atan2(dy, dx) - enemy.ai.facing;
                return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < enemy.ai.fov / 2 && los(world.grid, pos, { x: cell.x + .5, y: cell.y + .5 });
            });
        }
        if (this.decisionTimer > 0) return this.choice;
        this.decisionTimer = .3;
        this.choice = chooseUtility({ health: enemy.hp / enemy.max, visible: enemy.ai.visible, distance: enemy.ai.distance, range: enemy.ai.range, cooldown: enemy.ai.cooldown, heard: this.heardUntil > world.time, lost: enemy.ai.state === 'PATROL' && this.heardUntil <= world.time ? 999 : enemy.ai.lost, allyInjured: Boolean(world.ally), hasShrine: Boolean(world.shrine) && Math.hypot(pos.x - world.shrine!.x, pos.y - world.shrine!.y) < 13, ranged: enemy.kind === 1 || enemy.kind === 5, healer: enemy.kind === 5, ward: Boolean(world.ward) });
        const action = this.choice.action;
        this.target = action === 'PATROL' ? enemy.patrol : enemy.ai.visible ? { ...world.player } : enemy.ai.state === 'SEARCH' || this.heardUntil > world.time ? this.belief.likely() : enemy.ai.last;
        if (action === 'RETREAT') this.target = this.cover(world.grid, pos, enemy.ai.visible ? world.player : enemy.ai.last);
        if (action === 'HEAL' && world.shrine) this.target = world.shrine;
        if (action === 'ASSIST' && world.ally) this.target = { x: world.ally.x / 24, y: world.ally.y / 24 };
        if (action === 'RAID WARD' && world.ward) this.target = world.ward;
        // Ranged agents use the guardian's position as a defensive screen.
        if (action === 'PURSUE' && enemy.kind === 1 && world.ally?.kind === 2 && enemy.ai.visible) {
            const guardian = { x: world.ally.x / 24, y: world.ally.y / 24 }, dx = guardian.x - world.player.x, dy = guardian.y - world.player.y, d = Math.hypot(dx, dy) || 1;
            const screen = { x: Math.floor(guardian.x + dx / d * 1.8), y: Math.floor(guardian.y + dy / d * 1.8) };
            if (walk(world.grid, screen)) this.target = screen;
        }
        const at = Math.hypot(pos.x - this.target.x, pos.y - this.target.y) < 1;
        if (!enemy.ai.visible || action === 'RETREAT') this.aimed = false;
        const facts = { covered: action !== 'RETREAT' || at, aimed: this.aimed, attacked: false, shrine: Boolean(world.shrine), atShrine: action === 'HEAL' && at, healed: false, injuredAlly: Boolean(world.ally), atAlly: action === 'ASSIST' && at, assisted: false };
        const goal: Record<string, boolean> = action === 'HEAL' ? { healed: true } : action === 'ASSIST' ? { assisted: true } : { attacked: true };
        this.plan = planGOAP(facts, goal, tacticalActions);
        // Execute the first planned action. Impossible plans cannot silently heal or fire.
        const first = this.plan.actions[0]?.name;
        if (first === 'Reach shrine' && world.shrine) this.target = world.shrine;
        if (first === 'Reach ally' && world.ally) this.target = { x: world.ally.x / 24, y: world.ally.y / 24 };
        if (first === 'Restore health' || first === 'Bless ally' || first === 'Take aim') {
            if (action === 'HEAL' || action === 'ASSIST') this.target = { ...pos };
        }
        if (!this.plan.reachable && (action === 'HEAL' || action === 'ASSIST')) { this.choice.action = 'RETREAT'; this.target = this.cover(world.grid, pos, enemy.ai.last); }
        return this.choice;
    }
    private cover(grid: number[][], pos: Cell, threat: Cell) {
        let best = { x: Math.floor(pos.x), y: Math.floor(pos.y) }, score = -Infinity;
        for (let y = Math.floor(pos.y) - 4; y <= pos.y + 4; y++) for (let x = Math.floor(pos.x) - 4; x <= pos.x + 4; x++) if (walk(grid, { x, y })) {
            const from = Math.hypot(x + .5 - pos.x, y + .5 - pos.y), distance = Math.hypot(x + .5 - threat.x, y + .5 - threat.y);
            const value = distance * 1.4 - from * .6 + (los(grid, { x: x + .5, y: y + .5 }, threat) ? 0 : 4);
            if (value > score) { score = value; best = { x, y }; }
        }
        return best;
    }
}
