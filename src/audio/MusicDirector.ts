import { MusicState, ScoreClock, ScheduledScoreNote, renderMusicNote, musicTitles } from './score';
interface MusicVoice { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; releasing: boolean }

/** One bounded soundtrack, driven by AudioContext time rather than frame rate or timers. */
export class MusicDirector {
    private clock = new ScoreClock();
    private voices = new Set<MusicVoice>();
    private cache = new Map<string, AudioBuffer>();
    private enabled = false;
    private notes = 0;
    constructor(private ctx: AudioContext, private bus: AudioNode) {}
    select(state: MusicState) { if (this.clock.select(state, this.ctx.currentTime)) this.fade(.35); }
    tick(enabled: boolean) {
        if (enabled !== this.enabled) {
            this.enabled = enabled;
            if (!enabled) this.fade(.055); else this.clock.restart(this.ctx.currentTime);
        }
        if (!enabled || this.ctx.state !== 'running') return;
        for (const note of this.clock.drain(this.ctx.currentTime)) this.note(note);
    }
    diagnostics() { return `${musicTitles[this.clock.state.theme]} · bar ${Math.floor(Math.max(0, this.clock.step - 1) / 8) % 16 + 1} · ${this.notes} notes · ${this.voices.size} music voices`; }
    private note(note: ScheduledScoreNote) {
        if (this.voices.size >= 64) return;
        const key = `${note.instrument}:${note.midi}:${note.seconds.toFixed(4)}`;
        let buffer = this.cache.get(key);
        if (!buffer) {
            const samples = renderMusicNote(note.instrument, note.midi, note.seconds, this.ctx.sampleRate);
            buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate); buffer.getChannelData(0).set(samples);
            if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key, buffer);
        }
        const source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner();
        source.buffer = buffer; gain.gain.value = note.gain; pan.pan.value = note.pan;
        source.connect(gain); gain.connect(pan); pan.connect(this.bus);
        const voice = { source, gain, pan, releasing: false }; this.voices.add(voice);
        source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); pan.disconnect(); };
        source.start(Math.max(this.ctx.currentTime + .003, note.at)); this.notes++;
    }
    private stop(voice: MusicVoice, seconds: number) {
        if (voice.releasing) return;
        voice.releasing = true;
        const now = this.ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(0, now, seconds / 4);
        try { voice.source.stop(now + seconds); } catch { /* Already released. */ }
    }
    private fade(seconds: number) { for (const voice of this.voices) this.stop(voice, seconds); }
}
