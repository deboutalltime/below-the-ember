import { Random } from '../ai';
export class QLearner {
    q: number[][];
    episodes = 0;
    epsilon = 1;
    rewards: number[] = [];
    successes: number[] = [];
    rng: Random;
    readonly width = 7;
    readonly height = 6;
    readonly start = 35;
    readonly goal = 6;
    readonly walls = new Set([9, 16, 23, 30, 18, 19]);
    readonly traps = new Set([11, 27, 32]);
    constructor(seed = 'ember-learning') { this.q = Array.from({ length: 42 }, () => [0, 0, 0, 0]); this.rng = new Random(seed); }
    transition(state: number, action: number) {
        const x = state % this.width, y = Math.floor(state / this.width), d = [[0, -1], [1, 0], [0, 1], [-1, 0]][action];
        const nx = x + d[0], ny = y + d[1], index = ny * this.width + nx;
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height || this.walls.has(index)) return { next: state, reward: -.2, done: false };
        return { next: index, reward: index === this.goal ? 3 : this.traps.has(index) ? -2 : -.035, done: index === this.goal || this.traps.has(index) };
    }
    greedy(state: number) { const values = this.q[state]; return values.indexOf(Math.max(...values)); }
    train(count: number, alpha = .22, gamma = .95) {
        for (let e = 0; e < count; e++) {
            let state = this.start, reward = 0, success = 0;
            for (let step = 0; step < 100; step++) {
                const action = this.rng.next() < this.epsilon ? this.rng.int(0, 3) : this.greedy(state), t = this.transition(state, action);
                const target = t.reward + (t.done ? 0 : gamma * Math.max(...this.q[t.next]));
                this.q[state][action] += alpha * (target - this.q[state][action]);
                reward += t.reward; state = t.next;
                if (t.done) { success = state === this.goal ? 1 : 0; break; }
            }
            this.rewards.push(reward); this.successes.push(success); this.episodes++; this.epsilon = Math.max(.04, this.epsilon * .992);
        }
    }
    policy() { const path = [this.start], seen = new Set(path); let state = this.start; for (let i = 0; i < 100; i++) { const t = this.transition(state, this.greedy(state)); path.push(t.next); if (t.done) return { path, success: t.next === this.goal, reason: t.next === this.goal ? 'Goal reached' : 'Policy enters a trap' }; if (seen.has(t.next)) return { path, success: false, reason: 'Policy loops — more training needed' }; state = t.next; seen.add(state); } return { path, success: false, reason: 'Step limit' }; }
}
