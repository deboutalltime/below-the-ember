import { mkdirSync, writeFileSync } from 'node:fs';
import { MusicTheme, renderMusicNote, scoreStep, tempo } from '../src/audio/score';

// Uses the very same score and instruments as the game, at unity music-bus volume.
const rate = 22050, seconds = 24, folder = 'artifacts/soundtrack';
mkdirSync(folder, { recursive: true });
for (const theme of ['menu', 'combat', 'boss'] as MusicTheme[]) {
    const left = new Float32Array(rate * seconds), right = new Float32Array(rate * seconds), beat = 60 / tempo[theme];
    for (let step = 0; step * beat / 2 < seconds; step++) {
        const start = Math.round(step * beat / 2 * rate);
        for (const note of scoreStep(theme, step, 1, theme === 'boss' ? 2 : 1)) {
            const pcm = renderMusicNote(note.instrument, note.midi, note.beats * beat, rate);
            const l = Math.cos((note.pan + 1) * Math.PI / 4) * note.gain, r = Math.sin((note.pan + 1) * Math.PI / 4) * note.gain;
            for (let i = 0; i < pcm.length && start + i < left.length; i++) { left[start + i] += pcm[i] * l; right[start + i] += pcm[i] * r; }
        }
    }
    let peak = 0, energy = 0;
    const wav = Buffer.alloc(44 + left.length * 4);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(left.length * 4, 40);
    for (let i = 0; i < left.length; i++) {
        const fade = Math.min(1, i / (rate * .15), (left.length - 1 - i) / (rate * 1.2));
        for (let channel = 0; channel < 2; channel++) {
            const sample = (channel ? right[i] : left[i]) * fade;
            if (!Number.isFinite(sample)) throw new Error(`Invalid ${theme} sample`);
            peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
            if (Math.abs(sample) > .95) throw new Error(`${theme} needs more mix headroom`);
            wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 4 + channel * 2);
        }
    }
    writeFileSync(`${folder}/${theme}.wav`, wav);
    console.log(`${theme}: ${seconds}s stereo · peak ${peak.toFixed(3)} · RMS ${Math.sqrt(energy / (left.length * 2)).toFixed(3)}`);
}
