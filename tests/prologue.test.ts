import test from 'node:test';
import assert from 'node:assert/strict';
import { PrologueTimeline, storySlides } from '../src/story/prologue';

test('prologue has five complete bilingual chapters with time to read', () => {
    assert.equal(storySlides.length, 5);
    assert.equal(new Set(storySlides.map(slide => slide.id)).size, 5);
    for (const slide of storySlides) {
        assert.ok(slide.seconds >= 9);
        for (const language of ['ru', 'en'] as const) {
            assert.ok(slide.title[language].length > 10);
            assert.ok(slide.chapter[language].length > 10);
            assert.ok(slide.text[language].length > 100);
        }
    }
});
test('prologue navigation has bounds and resets the reading clock only on a scene change', () => {
    const clock = new PrologueTimeline(false);
    clock.tick(.1);
    for (const index of [-1, 5, .5, NaN, 0]) assert.equal(clock.go(index), false);
    assert.equal(clock.elapsed, .1);
    assert.equal(clock.previous(), false);
    assert.equal(clock.go(3), true); assert.equal(clock.elapsed, 0);
    clock.tick(.1); assert.equal(clock.previous(), true);
    assert.equal(clock.index, 2); assert.equal(clock.elapsed, 0);
    assert.equal(clock.next(), true); assert.equal(clock.index, 3);
});
test('paused and hidden prologue freezes; frame stalls do not consume the story', () => {
    const clock = new PrologueTimeline();
    clock.tick(60); assert.equal(clock.elapsed, .1);
    clock.tick(.1, false); assert.equal(clock.elapsed, .1);
    clock.paused = true; clock.tick(.1); assert.equal(clock.elapsed, .1);
    clock.paused = false;
    for (const delta of [-1, NaN, Infinity]) clock.tick(delta);
    assert.equal(clock.elapsed, .1);
    clock.tick(.05); assert.ok(Math.abs(clock.elapsed - .15) < 1e-9);
});
test('automatic playback reaches the final scene and waits for an explicit departure', () => {
    const clock = new PrologueTimeline();
    for (let frame = 0; frame < 1000; frame++) clock.tick(.1);
    assert.equal(clock.index, 4); assert.equal(clock.progress, 1); assert.equal(clock.finished, false);
    assert.equal(clock.finish(), true); assert.equal(clock.finish(), false);
    assert.equal(clock.previous(), false); assert.equal(clock.go(0), false); assert.equal(clock.next(), false);
    clock.tick(.1); assert.equal(clock.index, 4);
});
test('manual presentation never auto advances; the final next completes once', () => {
    const clock = new PrologueTimeline(false);
    for (let frame = 0; frame < 200; frame++) clock.tick(.1);
    assert.equal(clock.index, 0); assert.equal(clock.progress, 1);
    clock.autoplay = true; assert.equal(clock.tick(.1), true); assert.equal(clock.index, 1);
    clock.go(4); assert.equal(clock.next(), false); assert.equal(clock.finished, true);
    assert.equal(clock.finish(), false);
});
