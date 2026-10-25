export type MusicTheme = 'silence' | 'menu' | 'explore' | 'combat' | 'boss' | 'camp' | 'story' | 'victory' | 'defeat';
export type Instrument = 'pad' | 'bell' | 'bass' | 'pulse' | 'drum';
export interface ScoreNote { instrument: Instrument; midi: number; beats: number; gain: number; pan: number }
export interface MusicState { theme: MusicTheme; floor: number; phase: number }
export const musicTitles: Record<MusicTheme, string> = {
    silence: 'Silence', menu: 'The Last Ember', explore: 'Stone Remembers', combat: 'Through the Ash',
    boss: 'The Warden Wakes', camp: 'A Place to Breathe', story: 'Before the Descent', victory: 'Light Returns', defeat: 'Names in the Cinders',
};
export const tempo: Record<MusicTheme, number> = { silence: 66, menu: 66, explore: 72, combat: 92, boss: 108, camp: 70, story: 62, victory: 78, defeat: 58 };
const chords = [{ root: 50, third: 3 }, { root: 46, third: 4 }, { root: 53, third: 4 }, { root: 48, third: 4 }];
const melody = [0, 7, 3, 2, 0, -2, -5, -2, 0, 3, 7, 10, 7, 3, 2, 0];

/** Original 16-bar composition. Musical variation never consumes the dungeon RNG. */
export function scoreStep(theme: MusicTheme, step: number, floor = 1, phase = 1): ScoreNote[] {
    if (theme === 'silence') return [];
    const bar = Math.floor(step / 8) % 16, beat = step % 8, chord = chords[Math.floor(bar / 2) % 4];
    const transpose = [0, -2, -5, -1, -7][Math.max(0, Math.min(4, Math.floor(floor) - 1))];
    const root = chord.root + transpose, notes: ScoreNote[] = [], battle = theme === 'combat' || theme === 'boss';
    const add = (instrument: Instrument, midi: number, beats: number, gain: number, pan = 0) => notes.push({ instrument, midi, beats, gain, pan });
    if (beat === 0) {
        for (const [n, interval] of [0, chord.third, 7].entries()) add('pad', root + interval, 3.95, theme === 'defeat' ? .16 : .13, (n - 1) * .35);
    }
    if (beat === 0 || (battle && beat === 4)) add('bass', root - 12, battle ? 1.4 : 2.9, battle ? .32 : .23);
    if (theme === 'menu' || theme === 'story' || theme === 'explore' || theme === 'camp' || theme === 'victory') {
        const positions = theme === 'camp' || theme === 'victory' ? [0, 2, 5, 7] : theme === 'story' ? [2, 6] : [0, 3, 6];
        if (positions.includes(beat)) {
            const index = (bar * 3 + positions.indexOf(beat)) % melody.length;
            const pitch = 62 + transpose + melody[index] + (theme === 'victory' && bar % 4 > 1 ? 12 : 0);
            add('bell', pitch, theme === 'story' ? 1.9 : 1.5, theme === 'explore' ? .29 : .34, beat === 3 || beat === 5 ? .3 : -.25);
        }
    }
    if (battle) {
        if (beat % 2 === 0 || (theme === 'boss' && phase > 1)) {
            const intervals = [0, 7, 12, chord.third + 12];
            add('pulse', root + intervals[(beat + bar) % 4], .34, theme === 'boss' ? .22 : .16, beat < 4 ? -.2 : .2);
        }
        if ([0, 4].includes(beat) || (theme === 'boss' && [3, 7].includes(beat))) add('drum', 36, .45, beat === 0 ? .32 : .22);
        if (beat === 2 || (bar % 2 === 1 && beat === 6)) add('bell', root + [19, 24, 22, 19][bar % 4], 1.3, .22, .25);
    }
    if (theme === 'defeat' && beat === 2 && bar % 2 === 0) add('bell', 62 + transpose + [0, -2, -5, -7][Math.floor(bar / 4)], 2.6, .22, -.2);
    return notes;
}

/** Finite original instruments, shared by live playback and offline audio verification. */
export function renderMusicNote(instrument: Instrument, midi: number, duration: number, sampleRate = 44100): Float32Array {
    const seconds = Math.max(.08, Math.min(6, duration)), pcm = new Float32Array(Math.ceil(seconds * sampleRate));
    const frequency = 440 * 2 ** ((midi - 69) / 12), tau = Math.PI * 2;
    let random = 246813579, drumPhase = 0;
    for (let i = 0; i < pcm.length; i++) {
        const t = i / sampleRate, p = t / seconds, phase = t * frequency * tau;
        const attack = Math.min(1, t / (instrument === 'pad' ? .4 : instrument === 'bass' ? .045 : .008));
        const release = Math.min(1, (seconds - t) / (instrument === 'pad' ? .6 : .065));
        let wave = 0, envelope = attack * release;
        if (instrument === 'pad') { wave = Math.sin(phase) * .64 + Math.sin(phase * 2.001) * .15 + Math.sin(phase * 3) * .06; envelope *= (.88 + .12 * Math.sin(t * 2.4)) * (.75 + .25 * Math.sin(Math.PI * p)); }
        if (instrument === 'bell') { wave = Math.sin(phase) * .6 + Math.sin(phase * 2.003) * .19 + Math.sin(phase * 3.998) * .07; envelope *= Math.exp(-t * 2.2); }
        if (instrument === 'bass') { wave = Math.sin(phase) * .7 + Math.sin(phase * 2) * .17; envelope *= Math.exp(-p * 2.2); }
        if (instrument === 'pulse') { wave = Math.sin(phase) * .64 + Math.sin(phase * 2) * .18 + Math.sin(phase * 3) * .09; envelope *= Math.exp(-p * 3.4); }
        if (instrument === 'drum') {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            drumPhase += tau * (44 + 65 * Math.exp(-t * 30)) / sampleRate;
            wave = Math.sin(drumPhase) * .7 + (random / 0x80000000 - 1) * .09 * Math.exp(-t * 70); envelope *= Math.exp(-t * 14);
        }
        pcm[i] = wave * envelope * .7;
    }
    pcm[pcm.length - 1] = 0; return pcm;
}

export interface ScheduledScoreNote extends ScoreNote { at: number; seconds: number }
/** Short audio-clock lookahead. A stalled frame drops missed beats instead of firing a backlog. */
export class ScoreClock {
    state: MusicState = { theme: 'silence', floor: 1, phase: 1 };
    step = 0;
    private next = 0;
    select(state: MusicState, now: number) {
        if (state.theme === this.state.theme && state.floor === this.state.floor && state.phase === this.state.phase) return false;
        this.state = { ...state }; this.step = 0; this.next = now + .04; return true;
    }
    restart(now: number) { this.next = now + .04; }
    drain(now: number): ScheduledScoreNote[] {
        if (!Number.isFinite(now) || this.state.theme === 'silence') return [];
        const beat = 60 / tempo[this.state.theme], interval = beat / 2;
        if (now - this.next > .2) { const skipped = Math.ceil((now - this.next + .025) / interval); this.step += skipped; this.next += skipped * interval; }
        const result: ScheduledScoreNote[] = [];
        while (this.next < now + .18) {
            for (const note of scoreStep(this.state.theme, this.step, this.state.floor, this.state.phase)) result.push({ ...note, at: this.next, seconds: note.beats * beat });
            this.step++; this.next += interval;
        }
        return result;
    }
}
