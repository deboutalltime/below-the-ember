export interface Observations { health: number; visible: boolean; distance: number; range: number; cooldown: number; heard: boolean; lost: number; allyInjured: boolean; hasShrine: boolean; ranged: boolean; healer: boolean; ward: boolean; }
export type Intention = 'ATTACK' | 'PURSUE' | 'RETREAT' | 'HEAL' | 'ASSIST' | 'INVESTIGATE' | 'PATROL' | 'RAID WARD';
export interface UtilityChoice { action: Intention; scores: { action: Intention; score: number; reason: string }[]; }
/** Transparent normalized considerations, not a random choice or a scripted label. */
export function chooseUtility(o: Observations): UtilityChoice {
    const scores: UtilityChoice['scores'] = [
        { action: 'ATTACK', score: o.visible && o.distance <= o.range ? .58 + (o.cooldown <= 0 ? .35 : .05) : 0, reason: 'visibility × range × readiness' },
        { action: 'PURSUE', score: o.visible && o.distance > o.range ? .7 : 0, reason: 'visible target outside attack range' },
        { action: 'RETREAT', score: o.visible ? (o.ranged && o.distance < 3 ? .96 : 0) + (o.health < .25 ? .45 : 0) : 0, reason: 'personal space and low health' },
        { action: 'HEAL', score: o.hasShrine && o.health < .4 ? 1.2 - o.health : 0, reason: 'missing health × reachable shrine' },
        { action: 'ASSIST', score: o.healer && o.allyInjured ? .98 : 0, reason: 'nearby injured ally' },
        { action: 'INVESTIGATE', score: !o.visible && (o.heard || o.lost < 5) ? .62 : 0, reason: 'recent sound or sight observation' },
        { action: 'RAID WARD', score: o.ward && !o.visible ? .56 : 0, reason: 'unprotected defense objective' },
        { action: 'PATROL', score: .15, reason: 'fallback territorial behavior' },
    ];
    scores.forEach(s => s.score = Math.min(1.4, Math.max(0, s.score)));
    return { action: scores.reduce((a, b) => b.score > a.score ? b : a).action, scores };
}
