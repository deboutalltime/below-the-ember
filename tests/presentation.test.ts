import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayfieldInput } from '../src/game/PlayfieldInput';
import { ActorMotion } from '../src/visuals/ActorMotion';
import { musicFor } from '../src/audio/musicState';
import { MusicTheme, ScoreClock, renderMusicNote, scoreStep, tempo } from '../src/audio/score';

test('a HUD press cannot shoot, even when dragged back into the world', () => {
    const input = new PlayfieldInput();
    input.press(0, false); input.move(true); assert.equal(input.shoot, false);
    input.press(0, true); assert.equal(input.shoot, true);
    input.move(false); assert.equal(input.shoot, false); assert.equal(input.interrupted, true);
    input.move(true); assert.equal(input.shoot, false, 'dragging back must require a fresh press');
    input.release(0); input.press(2, true); assert.equal(input.alternate, true); assert.equal(input.shoot, false);
    input.reset(); assert.equal(input.alternate, false); assert.equal(input.overWorld, false);
    input.press(0, true); assert.equal(input.interrupted, false); assert.equal(input.shoot, true);
});
test('actor gait follows actual distance, blocked movement stays idle, and pause freezes every pose value', () => {
    const motion = new ActorMotion(); motion.reset(100, 100);
    for (let i = 0; i < 10; i++) motion.update(100, 100, .04, true, false, 1, false);
    assert.equal(motion.frame, 0);
    motion.update(113, 100, .04, true, false, 1, false); assert.equal(motion.frame, 1);
    motion.update(126, 100, .04, true, true, 1, false); assert.equal(motion.frame, 2); assert.ok(motion.angle > 0); assert.ok(motion.scaleY < 1);
    const pose = [motion.frame, motion.angle, motion.scaleX, motion.scaleY, motion.time];
    for (let i = 0; i < 200; i++) motion.update(126, 100, .04, false, true, -1, false);
    assert.deepEqual([motion.frame, motion.angle, motion.scaleX, motion.scaleY, motion.time], pose);
    motion.update(126, 100, .04, false, true, 1, true);
    assert.equal(motion.angle, 0); assert.equal(motion.scaleX, 1); assert.equal(motion.scaleY, 1);
    for (let i = 0; i < 40; i++) motion.update(126, 100, .04, true, false, 1, false);
    assert.ok(Math.abs(motion.angle) < .001); assert.ok(Math.abs(motion.scaleY - 1) < .001);
    motion.update(140, 100, .04, true, true, 1, true);
    assert.equal(motion.angle, 0); assert.equal(motion.scaleX, 1); assert.equal(motion.scaleY, 1);
});
test('adaptive music respects screen state, encounters, pause and hidden tabs', () => {
    const base = { screen: 'game', paused: false, hidden: false, hasRun: true, status: 'playing' };
    assert.equal(musicFor(base), 'explore');
    assert.equal(musicFor({ ...base, threatened: true }), 'combat');
    assert.equal(musicFor({ ...base, threatened: true, boss: true }), 'boss');
    assert.equal(musicFor({ ...base, paused: true }), 'silence');
    assert.equal(musicFor({ ...base, screen: 'pause' }), 'silence');
    assert.equal(musicFor({ ...base, hidden: true, boss: true }), 'silence');
    assert.equal(musicFor({ ...base, screen: 'camp', status: 'camp' }), 'camp');
    assert.equal(musicFor({ ...base, screen: 'end', status: 'victory' }), 'victory');
    assert.equal(musicFor({ ...base, screen: 'end', status: 'dead' }), 'defeat');
    assert.equal(musicFor({ ...base, screen: 'menu', hasRun: false }), 'menu');
    assert.equal(musicFor({ ...base, screen: 'prologue', hasRun: false }), 'story');
});
test('the score is deterministic, has audible instruments and differs across arrangements, floors and boss phases', () => {
    const themes: MusicTheme[] = ['menu', 'explore', 'combat', 'boss', 'camp', 'story', 'victory', 'defeat'];
    const arrangements = new Set<string>();
    for (const theme of themes) {
        const notes = Array.from({ length: 128 }, (_, step) => scoreStep(theme, step));
        assert.deepEqual(notes, Array.from({ length: 128 }, (_, step) => scoreStep(theme, step)));
        assert.ok(notes.flat().length > 40);
        arrangements.add(JSON.stringify(notes));
        for (const note of notes.flat()) {
            assert.ok(note.midi >= 20 && note.midi <= 96);
            assert.ok(note.beats > 0 && note.gain > 0 && note.gain <= .4);
        }
        assert.ok(tempo[theme] >= 58 && tempo[theme] <= 108);
    }
    assert.equal(arrangements.size, themes.length);
    assert.notDeepEqual(scoreStep('explore', 0, 1), scoreStep('explore', 0, 5));
    assert.notDeepEqual(scoreStep('boss', 1, 5, 1), scoreStep('boss', 1, 5, 2));
    assert.deepEqual(scoreStep('silence', 0), []);
    for (const instrument of ['pad', 'bell', 'bass', 'pulse', 'drum'] as const) {
        const pcm = renderMusicNote(instrument, 50, instrument === 'pad' ? 3.5 : 1.2, 22050);
        let peak = 0, energy = 0;
        for (const sample of pcm) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
        assert.ok(energy > 1); assert.ok(peak < .8); assert.equal(pcm[0], 0); assert.equal(pcm.at(-1), 0);
    }
});
test('the music clock schedules each note once and skips a stalled frame without a burst of old beats', () => {
    const clock = new ScoreClock();
    assert.equal(clock.select({ theme: 'menu', floor: 1, phase: 1 }, 100), true);
    const notes = clock.drain(100); assert.ok(notes.length > 0); assert.ok(notes.every(note => note.at >= 100 && note.at < 100.18));
    assert.equal(clock.drain(100).length, 0);
    assert.equal(clock.select({ theme: 'menu', floor: 1, phase: 1 }, 101), false);
    const later = clock.drain(160); assert.ok(later.length <= 8); assert.ok(later.every(note => note.at >= 160));
    const step = clock.step; clock.restart(300);
    assert.equal(clock.step, step); const resumed = clock.drain(300); assert.ok(resumed.every(note => note.at > 300));
    clock.select({ theme: 'silence', floor: 1, phase: 1 }, 301); assert.deepEqual(clock.drain(400), []);
});
