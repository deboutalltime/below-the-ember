import type { MusicTheme } from './score';
export interface MusicSituation {
    screen: string; paused: boolean; hidden: boolean; hasRun: boolean;
    status?: string; threatened?: boolean; boss?: boolean;
}
export function musicFor(s: MusicSituation): MusicTheme {
    if (s.hidden || s.screen === 'pause' || s.screen === 'exit') return 'silence';
    if (s.screen === 'prologue') return 'story';
    if (s.status === 'victory') return 'victory';
    if (s.status === 'dead') return 'defeat';
    if (['camp', 'upgrade', 'event', 'duel'].includes(s.screen)) return 'camp';
    if (s.hasRun && s.paused) return 'silence';
    if (!s.hasRun || s.screen !== 'game') return 'menu';
    return s.boss ? 'boss' : s.threatened ? 'combat' : 'explore';
}
