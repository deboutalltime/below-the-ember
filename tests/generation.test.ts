import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, validate, GenerationInputError } from '../src/dungeon';

test('generation rejects fractional, empty-equivalent, out-of-range and non-finite parameters', () => {
    for (const count of [6.5, 0, 100, NaN, Infinity, -1])
        assert.throws(() => generate('validation', 1, 64, count, 2), (error: unknown) => error instanceof GenerationInputError && error.field === 'count');
    for (const separation of [0, 2.5, 5, NaN]) assert.throws(() => generate('validation', 1, 64, 8, separation), GenerationInputError);
    for (const size of [0, 47, 48.5, 81, Infinity]) assert.throws(() => generate('validation', 1, size), GenerationInputError);
    for (const floor of [0, 1.5, 6]) assert.throws(() => generate('validation', floor), GenerationInputError);
});

test('generation accepts the parameter boundaries with connected separated rooms', () => {
    for (const [size, count, separation] of [[48, 4, 1], [48, 12, 4], [80, 12, 4]]) {
        const d = generate('boundaries', 5, size, count, separation);
        assert.equal(d.rooms.length, count); assert.ok(validate(d));
        for (const room of d.rooms) { assert.ok(room.x >= 0 && room.y >= 0); assert.ok(room.x + room.w < size && room.y + room.h < size); }
        for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
            const a = d.rooms[i], b = d.rooms[j];
            assert.ok(a.x + a.w + separation <= b.x || b.x + b.w + separation <= a.x || a.y + a.h + separation <= b.y || b.y + b.h + separation <= a.y);
        }
    }
});

test('CSP success and fallback have honest reproducible solver and trace metadata', () => {
    const normal = generate('ember-2026');
    assert.equal(normal.generation.solverSucceeded, true); assert.equal(normal.generation.fallbackUsed, false); assert.equal(normal.generation.traceTruncated, false);
    assert.equal(normal.generation.candidateAttempts, normal.attempts.filter(a => a.event === 'candidate').length);
    const dense = generate('dense-trace', 1, 48, 12, 4);
    assert.equal(dense.generation.solverSucceeded, false); assert.equal(dense.generation.fallbackUsed, true); assert.equal(dense.generation.traceTruncated, true);
    assert.equal(dense.generation.candidateAttempts, dense.generation.searchBudget); assert.equal(dense.attempts.length, dense.generation.traceLimit);
    assert.ok(dense.generation.backtracks >= dense.attempts.filter(a => a.event === 'backtrack').length);
    assert.ok(validate(dense)); assert.deepEqual(dense, generate('dense-trace', 1, 48, 12, 4));
});
