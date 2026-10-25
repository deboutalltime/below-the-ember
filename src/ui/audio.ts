import { SoundName, synthesizeSound } from '../audio/synthesis';
import { MusicDirector } from '../audio/MusicDirector';
import { MusicState, MusicTheme } from '../audio/score';
export interface AudioSettings { sound: number; music: number }
export interface AudioCueOptions { pan?: number; gain?: number }
interface Voice { source: AudioBufferSourceNode; gain: GainNode; panner: StereoPannerNode; name: SoundName }
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Cached original PCM clips, separate live volume buses, a bounded voice pool and output compression. */
export class EmberAudio {
    private ctx?: AudioContext;
    private effects?: GainNode;
    private music?: GainNode;
    private buffers = new Map<SoundName, AudioBuffer>();
    private voices = new Set<Voice>();
    private last = new Map<SoundName, number>();
    private score?: MusicDirector;
    private musicState: MusicState = { theme: 'menu', floor: 1, phase: 1 };
    private preview?: { state: MusicState; until: number };
    private analyser?: AnalyserNode;
    private meter = new Float32Array(256);
    private peak = 0;
    private count = 0;
    private latest = 'none';
    constructor(private settings: () => AudioSettings) {}
    unlock() {
        try {
            if (!this.ctx) {
                const context = this.ctx = new AudioContext();
                const compressor = context.createDynamicsCompressor();
                compressor.threshold.value = -12; compressor.knee.value = 16;
                compressor.ratio.value = 8; compressor.attack.value = .003; compressor.release.value = .16;
                this.effects = context.createGain(); this.music = context.createGain();
                this.analyser = context.createAnalyser(); this.analyser.fftSize = 256;
                this.effects.connect(compressor); this.music.connect(compressor); compressor.connect(this.analyser); this.analyser.connect(context.destination);
                this.score = new MusicDirector(context, this.music);
            }
            if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
            this.sync();
        } catch { /* Browsers may disable audio; gameplay remains available. */ }
    }
    sync() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime, settings = this.settings();
        this.effects!.gain.setTargetAtTime(unit(settings.sound), now, .015);
        this.music!.gain.setTargetAtTime(unit(settings.music), now, .04);
        if (this.preview && now >= this.preview.until) this.preview = undefined;
        this.score!.select(this.preview?.state ?? this.musicState);
        this.score!.tick(!document.hidden && unit(settings.music) > 0);
        if (this.analyser) { this.analyser.getFloatTimeDomainData(this.meter); let peak = 0; for (const value of this.meter) peak = Math.max(peak, Math.abs(value)); this.peak = Math.max(peak, this.peak * .96); }
    }
    diagnostics() { return `${this.ctx?.state ?? 'locked'} · ${this.latest} · ${this.count} cues · ${this.voices.size} voices · peak ${this.peak.toFixed(3)} · SCORE ${this.score?.diagnostics() ?? 'waiting for interaction'}`; }
    setMusic(theme: MusicTheme, floor = 1, phase = 1) { this.musicState = { theme, floor, phase }; }
    previewMusic(theme: MusicTheme) {
        this.unlock();
        if (this.ctx) this.preview = { state: { theme, floor: 1, phase: theme === 'boss' ? 2 : 1 }, until: this.ctx.currentTime + 12 };
    }
    stopMusicPreview() { this.preview = undefined; }
    play(name: SoundName | 'shoot' | 'hit', options: AudioCueOptions = {}) {
        if (!this.ctx || unit(this.settings().sound) === 0) return;
        const sound: SoundName = name === 'shoot' ? 'spark' : name === 'hit' ? 'impact' : name;
        const now = this.ctx.currentTime;
        const gap = sound === 'alert' ? .4 : sound === 'step' ? .16 : sound === 'impact' ? .065 : sound === 'ignite' ? .2 : .035;
        if (now - (this.last.get(sound) ?? -100) < gap) return;
        this.last.set(sound, now);
        if (sound === 'charge') this.stop('charge');
        if (this.voices.size >= 28) this.release(this.voices.values().next().value!);
        let buffer = this.buffers.get(sound);
        if (!buffer) {
            const samples = synthesizeSound(sound, this.ctx.sampleRate);
            buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
            buffer.getChannelData(0).set(samples); this.buffers.set(sound, buffer);
        }
        const source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), panner = this.ctx.createStereoPanner();
        source.buffer = buffer; gain.gain.value = .6 * unit(options.gain ?? 1);
        panner.pan.value = Math.max(-.85, Math.min(.85, options.pan ?? 0));
        source.connect(gain); gain.connect(panner); panner.connect(this.effects!);
        const voice = { source, gain, panner, name: sound }; this.voices.add(voice);
        source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); panner.disconnect(); };
        source.start(now);
        this.count++; this.latest = sound;
    }
    stop(name: SoundName) { for (const voice of this.voices) if (voice.name === name) this.release(voice); }
    private release(voice: Voice) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, .008);
        try { voice.source.stop(now + .035); } catch { /* A previously released source has ended. */ }
        this.voices.delete(voice);
    }
    silenceAction() { this.stop('charge'); }
    pauseEffects() { for (const voice of this.voices) this.release(voice); }
    /** The prologue owns its soundtrack while its own pause/mute controls are visible. */
    storyAtmosphere(index: number, cue = true) {
        this.stopStory();
        if (!this.ctx || !Number.isInteger(index) || index < 0 || index > 4) return;
        const cues = ['prologue-city', 'prologue-heart', 'prologue-seals', 'prologue-keeper', 'prologue-descent'] as const;
        if (cue) this.play(cues[index]);
        this.setMusic('story', index + 1);
    }
    stopStory() {
        for (const voice of this.voices) if (voice.name.startsWith('prologue-')) this.release(voice);
        this.setMusic('silence');
    }
}
