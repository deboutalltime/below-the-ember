import type { Cell } from '../ai';
/** Discrete Bayes filter: transition model → observation likelihood → normalization. */
export class BeliefMap {
    probability: Float64Array;
    width: number;
    height: number;
    constructor(public grid: number[][]) { this.height = grid.length; this.width = grid[0].length; this.probability = new Float64Array(this.width * this.height); this.reset(); }
    reset() { for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.probability[y * this.width + x] = this.grid[y][x] === 1 ? 1 : 0; this.normalize(); }
    private normalize() { const sum = this.probability.reduce((a, b) => a + b, 0); if (sum > 1e-200) this.probability.forEach((v, i) => this.probability[i] = v / sum); else { this.probability.fill(0); let n = 0; this.grid.forEach(row => row.forEach(v => n += v === 1 ? 1 : 0)); this.grid.forEach((row, y) => row.forEach((v, x) => { if (v === 1) this.probability[y * this.width + x] = 1 / n; })); } }
    predict() {
        const next = new Float64Array(this.probability.length);
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.grid[y][x] === 1) {
            const neighbors = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => this.grid[b]?.[a] === 1);
            const mass = this.probability[y * this.width + x] / neighbors.length; neighbors.forEach(([a, b]) => next[b * this.width + a] += mass);
        }
        this.probability = next; this.normalize();
    }
    see(cell: Cell) { if (this.grid[cell.y]?.[cell.x] !== 1) return; this.probability.fill(1e-12); this.grid.forEach((row, y) => row.forEach((v, x) => { if (v !== 1) this.probability[y * this.width + x] = 0; })); this.probability[cell.y * this.width + cell.x] = 1; this.normalize(); }
    hear(cell: Cell, sigma = 2) {
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.grid[y][x] === 1) {
            const d2 = (x - cell.x) ** 2 + (y - cell.y) ** 2;
            this.probability[y * this.width + x] *= .005 + Math.exp(-d2 / (2 * sigma ** 2));
        }
        this.normalize();
    }
    excludeVisible(canSee: (cell: Cell) => boolean) { for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.grid[y][x] === 1 && canSee({ x, y })) this.probability[y * this.width + x] *= .04; this.normalize(); }
    likely(): Cell { let i = 0, best = -1; this.probability.forEach((v, index) => { if (v > best) { best = v; i = index; } }); return { x: i % this.width, y: Math.floor(i / this.width) }; }
    entropy() { return -this.probability.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0); }
}
