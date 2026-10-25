import { Random } from '../ai';
export interface Generation { generation: number; best: number; mean: number; genome: number[]; }
export const encounterKinds = [0, 1, 2, 3, 5];
export const threat = [1, 1.25, 2.4, 1.5, 1.8];
export function encounterFitness(genome: number[], budget: number, floor: number) {
    const count = genome.reduce((a, b) => a + b, 0), power = genome.reduce((sum, n, i) => sum + n * threat[i], 0), diversity = genome.filter(n => n > 0).length;
    const invalid = count < 2 || count > 7 || floor < 2 && (genome[2] + genome[3] + genome[4] > 0) || floor < 3 && genome[3] > 0;
    return (invalid ? -100 : 0) - Math.abs(power - budget) * 5 + diversity * .7 - Math.max(0, genome[2] - 2) * 5 - Math.max(0, genome[4] - 1) * 4;
}
/** Elitism + tournament selection + uniform crossover + bounded mutation. */
export function evolveEncounter(seed: string, floor: number, budget = 2.5 + floor * 1.25, generations = 18, populationSize = 24) {
    const rng = new Random(seed), history: Generation[] = [];
    const make = () => Array.from({ length: 5 }, (_, i) => floor < 2 && i >= 2 || floor < 3 && i === 3 ? 0 : rng.int(0, i === 2 || i === 4 ? 1 : 3));
    let population = Array.from({ length: populationSize }, make);
    population[0] = [2, 1, 0, 0, 0];
    const score = (g: number[]) => encounterFitness(g, budget, floor);
    for (let generation = 0; generation <= generations; generation++) {
        population.sort((a, b) => score(b) - score(a));
        history.push({ generation, best: score(population[0]), mean: population.reduce((sum, g) => sum + score(g), 0) / population.length, genome: [...population[0]] });
        if (generation === generations) break;
        const next = population.slice(0, 2).map(g => [...g]);
        const tournament = () => { const a = population[rng.int(0, population.length - 1)], b = population[rng.int(0, population.length - 1)]; return score(a) >= score(b) ? a : b; };
        while (next.length < populationSize) { const a = tournament(), b = tournament(); const child = a.map((v, i) => rng.next() < .5 ? v : b[i]); for (let i = 0; i < child.length; i++) if (rng.next() < .24) child[i] = Math.max(0, Math.min(i === 4 ? 1 : 3, child[i] + (rng.next() < .5 ? -1 : 1))); if (floor < 2) child[2] = child[3] = child[4] = 0; if (floor < 3) child[3] = 0; next.push(child); }
        population = next;
    }
    const genome = history.at(-1)!.genome;
    const kinds = genome.flatMap((n, i) => Array<number>(n).fill(encounterKinds[i]));
    return { genome, kinds, history, budget, power: genome.reduce((sum, n, i) => sum + n * threat[i], 0) };
}
