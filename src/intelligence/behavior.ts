export type BehaviorStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING';
export interface BehaviorTrace { name: string; status: BehaviorStatus; depth: number; }
export interface BehaviorNode<C> { name: string; type: 'sequence' | 'selector' | 'leaf'; children?: BehaviorNode<C>[]; evaluate?: (context: C) => BehaviorStatus; }
export function tickTree<C>(node: BehaviorNode<C>, context: C, trace: BehaviorTrace[] = [], depth = 0): BehaviorStatus {
    const entry: BehaviorTrace = { name: node.name, status: 'RUNNING', depth }; trace.push(entry);
    let status: BehaviorStatus;
    if (node.type === 'leaf') status = node.evaluate!(context);
    else {
        status = node.type === 'sequence' ? 'SUCCESS' : 'FAILURE';
        for (const child of node.children ?? []) { const s = tickTree(child, context, trace, depth + 1); if (s === 'RUNNING' || node.type === 'sequence' && s === 'FAILURE' || node.type === 'selector' && s === 'SUCCESS') { status = s; break; } }
    }
    entry.status = status; return status;
}
export interface BossContext { visible: boolean; windup: number; cooldown: number; dt: number; phase: number; command: 'WAIT' | 'WARN' | 'RELEASE' | 'CHASE' | 'SEARCH'; }
const leaf = (name: string, evaluate: (c: BossContext) => BehaviorStatus): BehaviorNode<BossContext> => ({ name, type: 'leaf', evaluate });
export const bossTree: BehaviorNode<BossContext> = { name: 'Ember Warden', type: 'selector', children: [
    { name: 'Resolve announced attack', type: 'sequence', children: [leaf('Attack is announced?', c => c.windup > 0 ? 'SUCCESS' : 'FAILURE'), leaf('Wind up → release', c => { c.windup -= c.dt; c.command = c.windup <= 0 ? 'RELEASE' : 'WAIT'; return c.windup <= 0 ? 'SUCCESS' : 'RUNNING'; })] },
    { name: 'Prepare attack', type: 'sequence', children: [leaf('Player visible?', c => c.visible ? 'SUCCESS' : 'FAILURE'), leaf('Weapon ready?', c => c.cooldown <= 0 ? 'SUCCESS' : 'FAILURE'), leaf('Announce danger', c => { c.command = 'WARN'; c.windup = .9; c.cooldown = c.phase === 2 ? 1.8 : 3; return 'SUCCESS'; })] },
    leaf('Pursue observation', c => { c.command = c.visible ? 'CHASE' : 'SEARCH'; return 'RUNNING'; }),
] };
export function decideBoss(context: BossContext) { const trace: BehaviorTrace[] = []; tickTree(bossTree, context, trace); return { context, trace }; }
