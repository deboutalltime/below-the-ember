import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, validate } from '../src/dungeon';

test('educational CSP trace contains valid partial assignments and real rollback events', () => {
    const d = generate('dense-trace', 1, 48, 12, 4);
    assert.ok(validate(d));
    assert.ok(d.attempts.length <= 1500);
    assert.ok(d.attempts.some(a => a.event === 'backtrack'), 'Dense domains exercise actual recursive rollback');
    for (const attempt of d.attempts) {
        const stack = attempt.accepted ? [...attempt.stack, attempt.room] : attempt.stack;
        for (const room of stack) {
            assert.ok(room.x >= 0 && room.y >= 0 && room.x + room.w < 48 && room.y + room.h < 48);
        }
        for (let i = 0; i < stack.length; i++) for (let j = i + 1; j < stack.length; j++) {
            const a = stack[i], b = stack[j];
            assert.ok(a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + a.h + 4 <= b.y || b.y + b.h + 4 <= a.y);
        }
    }
});
