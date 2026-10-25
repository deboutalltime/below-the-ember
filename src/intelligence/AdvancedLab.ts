import { Cell, los, Random } from '../ai';
import { chooseUtility } from './utility';
import { Facts, planGOAP, tacticalActions } from './planner';
import { bossTree, BossContext, decideBoss, BehaviorNode } from './behavior';
import { BeliefMap } from './belief';
import { boardWinner, minimaxMove } from './minimax';
import { QLearner } from './learning';
import { evolveEncounter, encounterFitness } from './evolution';
import { searchGrid, SearchMethod, RouteResult } from './search';
import { escapeHTML } from '../ui/utils';

const topics = ['Utility AI', 'GOAP', 'Behavior Tree', 'Bayesian Belief', 'Minimax', 'Q-learning', 'Genetic Encounters', 'Search Comparison'];
/** Interactive views over exported campaign algorithms; training and game-tree search are real. */
export function advancedLaboratory(originalArchive: () => void, menu: () => void, reducedMotion: () => boolean) {
    const overlay = document.querySelector<HTMLElement>('#overlay')!;
    let selected = 0, stopped = false, frame = 0, update: ((dt: number, now: number) => void) | undefined;
    let canvas: HTMLCanvasElement, c: CanvasRenderingContext2D;
    const leave = (target: () => void) => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener('keydown', keyboard); target(); };
    const keyboard = (e: KeyboardEvent) => { if (e.key === 'Escape') leave(menu); };
    window.addEventListener('keydown', keyboard);
    const bind = (id: string, fn: () => void) => { document.getElementById(id)!.onclick = fn; };
    const control = (id: string) => document.getElementById(id) as HTMLInputElement;
    const val = (id: string) => Number(control(id).value);
    const checked = (id: string) => control(id).checked;
    const output = (text: string) => { document.getElementById('advanced-readout')!.textContent = text; };
    const clear = () => { c.fillStyle = '#0b111a'; c.fillRect(0, 0, 600, 400); };
    const text = (s: string, x: number, y: number, color = '#bac7ce', size = 11) => { c.fillStyle = color; c.font = `${size}px monospace`; c.fillText(s, x, y); };
    const slider = (id: string, title: string, min: number, max: number, value: number, step = .05) => `<div class="setting"><label for="${id}">${title}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
    const toggle = (id: string, title: string, value = false) => `<label class="toggle"><input id="${id}" type="checkbox" ${value ? 'checked' : ''}>${title}</label>`;
    function controls(html: string, note: string) { document.getElementById('advanced-controls')!.innerHTML = `${html}<div class="readout" id="advanced-readout"></div><p class="advanced-note">${note}</p>`; }
    function line(values: number[], color: string, x = 35, y = 250, width = 520, height = 110) {
        if (!values.length) return;
        const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
        c.strokeStyle = '#344855'; c.strokeRect(x, y, width, height); c.strokeStyle = color; c.beginPath();
        values.forEach((value, i) => { const px = x + i / Math.max(1, values.length - 1) * width, py = y + height - (value - min) / range * height; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
        text(max.toFixed(1), x + 4, y + 13, '#7d929d', 8); text(min.toFixed(1), x + 4, y + height - 4, '#7d929d', 8);
    }
    function setup() {
        update = undefined;
        overlay.innerHTML = `<section class="lab dialog advanced-lab"><header class="archive-header"><div><small>THE ARCANE ARCHIVE / AIF EXPANSION</small><h2>Decisions, knowledge, learning.</h2><p>Inspect the algorithms that shape the living dungeon.</p></div><div><button id="original">CSP / A* / FSM</button><button id="exit-lab">MAIN MENU</button></div></header><nav class="advanced-nav" aria-label="AI Fundamentals topics">${topics.map((name, i) => `<button data-topic="${i}" class="${selected === i ? 'active' : ''}">${String(i + 4).padStart(2, '0')} · ${name}</button>`).join('')}</nav><div class="lab-layout"><div class="lab-stage"><div class="stage-toolbar"><span>${topics[selected].toUpperCase()}</span><b>REAL ALGORITHM</b></div><canvas class="advanced-canvas" id="advanced-canvas" width="600" height="400" aria-label="${topics[selected]} interactive visualization"></canvas><div class="advanced-status" id="advanced-status"></div></div><aside class="advanced-controls" id="advanced-controls"></aside></div></section>`;
        canvas = document.getElementById('advanced-canvas') as HTMLCanvasElement; c = canvas.getContext('2d')!; c.imageSmoothingEnabled = false;
        bind('original', () => leave(originalArchive)); bind('exit-lab', () => leave(menu));
        overlay.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach(button => button.onclick = () => { selected = Number(button.dataset.topic); setup(); });
        [utilityView, planningView, treeView, bayesView, minimaxView, learningView, evolutionView, comparisonView][selected]();
    }
    function utilityView() {
        controls(`<h3>Choose, then commit.</h3>${slider('uhealth', 'Health fraction', 0, 1, .65)}${slider('udistance', 'Distance / tiles', .5, 14, 5, .5)}${slider('ucooldown', 'Attack cooldown', 0, 2, 0, .1)}${toggle('uvisible', 'Player visible', true)}${toggle('uranged', 'Ranged agent', true)}${toggle('ushrine', 'Shrine within reach')}${toggle('ually', 'Injured ally nearby')}${toggle('uhealer', 'Agent is a shaman')}${toggle('uheard', 'Recent suspicious sound')}`, 'The campaign evaluates the same normalized considerations. Utility selects an intention; perception, FSM and GOAP constrain what the enemy can actually do.');
        const draw = () => {
            const choice = chooseUtility({ health: val('uhealth'), distance: val('udistance'), cooldown: val('ucooldown'), visible: checked('uvisible'), ranged: checked('uranged'), hasShrine: checked('ushrine'), allyInjured: checked('ually'), healer: checked('uhealer'), heard: checked('uheard'), lost: checked('uheard') ? 0 : 9, range: checked('uranged') ? 6 : 1.35, ward: false });
            clear(); text('ACTION UTILITY / higher wins', 25, 28, '#d9bc91', 12);
            choice.scores.forEach((s, i) => { const y = 57 + i * 39, active = s.action === choice.action; text(s.action, 25, y + 10, active ? '#ffd28c' : '#8297a2', 10); c.fillStyle = '#243442'; c.fillRect(142, y, 350, 14); c.fillStyle = active ? '#ffc16a' : '#438c96'; c.fillRect(142, y, 350 * s.score / 1.4, 14); text(s.score.toFixed(2), 510, y + 11, active ? '#ffc16a' : '#b3c7cd', 11); });
            output(`INTENTION: ${choice.action}\nHP ${(val('uhealth') * 100).toFixed(0)}% · distance ${val('udistance')}\n${choice.scores.find(s => s.action === choice.action)!.reason}`);
        };
        document.getElementById('advanced-controls')!.oninput = draw; draw();
    }
    function planningView() {
        controls(`<h3>A goal needs a plan.</h3><label for="pgoal">Goal</label><select id="pgoal"><option value="attacked">Attack from cover</option><option value="healed">Restore health</option><option value="assisted">Bless an ally</option></select>${toggle('pcover', 'Already in cover')}${toggle('pshrine', 'Shrine exists', true)}${toggle('pally', 'An ally is injured', true)}<div class="actions"><button id="plan" class="primary">FIND PLAN</button><button id="pstep">EXECUTE STEP</button></div>`, 'Uniform-cost search explores symbolic states. An action is available only if all preconditions match; its effects create a new state. The campaign executes movement and healing rather than merely displaying this plan.');
        let state: Facts, plan = planGOAP({}, {}, []), step = 0;
        const draw = () => {
            clear(); text(`GOAL: ${control('pgoal').value.toUpperCase()}`, 25, 32, '#e1bd8b', 13);
            const names = ['CURRENT WORLD', ...plan.actions.map(a => a.name), plan.reachable ? 'GOAL SATISFIED' : 'NO VALID PLAN'];
            names.forEach((name, i) => { const x = 45 + (i % 3) * 180, y = 75 + Math.floor(i / 3) * 120; c.fillStyle = i <= step ? '#264a50' : '#1c2a38'; c.fillRect(x, y, 150, 60); c.strokeStyle = i <= step ? '#54d6da' : '#596b75'; c.strokeRect(x, y, 150, 60); text(name.slice(0, 21), x + 8, y + 25, '#d4d8d6', 10); if (i > 0 && i <= plan.actions.length) text(`cost ${plan.actions[i - 1].cost}`, x + 8, y + 43, '#ad977b', 9); if (i < names.length - 1 && i % 3 !== 2) text('→', x + 157, y + 33, '#ffc16a', 18); });
            text('TRUE FACTS', 30, 345, '#86bfc4', 10); text(Object.keys(state).filter(k => state[k]).join(' / ').slice(0, 76) || '(none)', 30, 368, '#adbcc5', 10);
            output(`${plan.reachable ? 'PLAN FOUND' : 'GOAL UNREACHABLE'}\nCost: ${plan.cost}\nStates expanded: ${plan.explored}\nExecuted: ${step}/${plan.actions.length}\n${plan.actions.map(a => a.name).join(' → ')}`);
        };
        const solve = () => { state = { covered: checked('pcover'), shrine: checked('pshrine'), injuredAlly: checked('pally'), aimed: false, attacked: false, healed: false, atShrine: false, atAlly: false, assisted: false }; plan = planGOAP(state, { [control('pgoal').value]: true }, tacticalActions); step = 0; draw(); };
        bind('plan', solve); bind('pstep', () => { if (step < plan.actions.length) { Object.assign(state, plan.actions[step].effects); step++; draw(); } });
        solve();
    }
    function treeView() {
        controls(`<h3>The Warden's intent.</h3>${toggle('tvisible', 'Player visible', true)}${toggle('tphase', 'Second phase')}${toggle('tplay', 'Run continuously', !reducedMotion())}<div class="actions"><button id="tick" class="primary">TICK 0.2s</button><button id="treset">RESET</button></div><div class="formula">Selector: first non-failure\nSequence: first non-success\nRUNNING keeps an action alive</div>`, 'This is the exact behavior tree controlling the campaign boss. The warning branch runs before attack selection; an announced attack resolves before the next one is prepared.');
        let context: BossContext = { visible: true, windup: 0, cooldown: 0, dt: .2, phase: 1, command: 'WAIT' }, trace = decideBoss({ ...context }).trace;
        const draw = () => {
            clear(); const nodes: { node: BehaviorNode<BossContext>; x: number; y: number; parent?: number }[] = [];
            nodes.push({ node: bossTree, x: 300, y: 35 });
            bossTree.children!.forEach((branch, i) => { const index = nodes.length, bx = 100 + i * 200; nodes.push({ node: branch, x: bx, y: 120, parent: 0 }); branch.children?.forEach((child, j) => nodes.push({ node: child, x: bx, y: 190 + j * 64, parent: index })); });
            nodes.forEach(n => { if (n.parent !== undefined) { const p = nodes[n.parent]; c.strokeStyle = '#405766'; c.beginPath(); c.moveTo(p.x, p.y + 21); c.lineTo(n.x, n.y - 21); c.stroke(); } });
            nodes.forEach(n => { const state = trace.find(t => t.name === n.node.name)?.status; c.fillStyle = state === 'RUNNING' ? '#5c492c' : state === 'SUCCESS' ? '#204b4d' : '#1d2937'; c.fillRect(n.x - 82, n.y - 21, 164, 42); c.strokeStyle = state === 'RUNNING' ? '#ffc16a' : state === 'SUCCESS' ? '#54d6da' : '#4c6270'; c.strokeRect(n.x - 82, n.y - 21, 164, 42); text(n.node.name.slice(0, 25), n.x - 74, n.y - 3, '#d6d3c9', 9); text(state ?? n.node.type.toUpperCase(), n.x - 74, n.y + 13, '#899fab', 8); });
            text(`COMMAND: ${context.command}`, 30, 390, '#ffc16a', 12); output(`COMMAND: ${context.command}\nWindup: ${Math.max(0, context.windup).toFixed(2)}s\nCooldown: ${context.cooldown.toFixed(2)}s\nPhase: ${context.phase}\nNodes ticked: ${trace.length}`);
        };
        const tick = (dt: number) => { context.visible = checked('tvisible'); context.phase = checked('tphase') ? 2 : 1; context.cooldown = Math.max(0, context.cooldown - dt); context.dt = dt; context.command = 'WAIT'; const result = decideBoss(context); trace = result.trace; draw(); };
        bind('tick', () => tick(.2)); bind('treset', () => { context.windup = 0; context.cooldown = 0; tick(0); });
        update = dt => { if (checked('tplay')) tick(dt); }; tick(0);
    }
    function bayesView() {
        const width = 20, height = 14, grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => !x || !y || x === width - 1 || y === height - 1 || x === 9 && y > 2 && y < 12 && y !== 7 ? 0 : 1));
        const belief = new BeliefMap(grid), sensor = { x: 4.5, y: 7.5 }; let chosen = { x: 14, y: 7 };
        controls(`<h3>Uncertainty has a shape.</h3><p>Click a cell to place an observation. Sight is precise; sound is uncertain. Prediction spreads probability to neighboring cells.</p><div class="actions"><button id="bsee">SEE CELL</button><button id="bhear">HEAR SOUND</button></div><div class="actions"><button id="bnegative">NO PLAYER IN SIGHT</button><button id="bpredict">PREDICT STEP</button><button id="breset">RESET</button></div><div class="formula">posterior ∝ likelihood × prior\nΣ P(player at cell) = 1</div>`, 'Campaign enemies use this same discrete Bayes filter. Only actual sight supplies an exact player cell; sound and negative observations change belief without revealing a hidden player.');
        const draw = () => {
            clear(); const max = Math.max(...belief.probability), tile = 25, ox = 50, oy = 25;
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { c.fillStyle = grid[y][x] ? '#202d3b' : '#080d15'; c.fillRect(ox + x * tile, oy + y * tile, 24, 24); const p = belief.probability[y * width + x]; if (p > 0) { c.globalAlpha = .08 + p / (max || 1) * .85; c.fillStyle = '#ec9e4d'; c.fillRect(ox + x * tile + 2, oy + y * tile + 2, 20, 20); c.globalAlpha = 1; } }
            c.strokeStyle = '#54d6da'; c.strokeRect(ox + chosen.x * tile, oy + chosen.y * tile, 24, 24); text('S', ox + sensor.x * tile - 4, oy + sensor.y * tile + 4, '#54d6da');
            const likely = belief.likely(); output(`SELECTED: ${chosen.x},${chosen.y}\nP(cell): ${belief.probability[chosen.y * width + chosen.x].toFixed(6)}\nMost likely: ${likely.x},${likely.y}\nEntropy: ${belief.entropy().toFixed(3)} bits\nTotal mass: ${belief.probability.reduce((a, b) => a + b, 0).toFixed(6)}`);
        };
        bind('bsee', () => { belief.see(chosen); draw(); }); bind('bhear', () => { belief.hear(chosen, 2); draw(); }); bind('bpredict', () => { belief.predict(); draw(); }); bind('breset', () => { belief.reset(); draw(); }); bind('bnegative', () => { belief.excludeVisible(p => Math.hypot(p.x - sensor.x, p.y - sensor.y) < 8 && los(grid, sensor, { x: p.x + .5, y: p.y + .5 })); draw(); });
        canvas.onclick = e => { const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width * 600 - 50) / 25), y = Math.floor(((e.clientY - r.top) / r.height * 400 - 25) / 25); if (grid[y]?.[x] === 1) { chosen = { x, y }; draw(); } }; draw();
    }
    function minimaxView() {
        controls(`<h3>A guardian that looks ahead.</h3><p>Click an empty rune. You are ✦, the guardian is ◈. The campaign altar uses the same minimax evaluator.</p>${toggle('mprune', 'Enable alpha–beta pruning', true)}<div class="actions"><button id="mreset">RESET DUEL</button><button id="manalyze">ANALYZE POSITION</button></div>`, 'Terminal utility rewards a guardian win, penalizes a loss and values a draw at zero. Alpha–beta skips branches that cannot change the decision. Switch it off and compare the node count.');
        let board = Array<number>(9).fill(0), analysis = { move: -1, value: 0, nodes: 0, cutoffs: 0, rootScores: [] as { move: number; value: number }[] };
        const draw = () => {
            clear(); const ox = 172, oy = 30, size = 85;
            for (let i = 0; i < 9; i++) { const x = ox + i % 3 * size, y = oy + Math.floor(i / 3) * size; c.fillStyle = '#1d3040'; c.fillRect(x, y, 78, 78); c.strokeStyle = analysis.move === i ? '#ffc16a' : '#4a6774'; c.strokeRect(x, y, 78, 78); text(board[i] === 1 ? '✦' : board[i] === -1 ? '◈' : String(i + 1), x + 27, y + 48, board[i] === 1 ? '#54d6da' : board[i] === -1 ? '#ffc16a' : '#667d89', board[i] ? 31 : 11); }
            text('ROOT MOVE VALUES', 35, 325, '#7fb9bf', 10); text(analysis.rootScores.map(s => `${s.move + 1}:${s.value}`).join('   ').slice(0, 90), 35, 349, '#b9c9cd', 10);
            const winner = boardWinner(board); output(`${winner === null ? 'YOUR TURN' : winner === 0 ? 'DRAW' : winner === 1 ? 'KEEPER WINS' : 'GUARDIAN WINS'}\nNodes: ${analysis.nodes.toLocaleString()}\nAlpha–beta cutoffs: ${analysis.cutoffs}\nBest AI move: ${analysis.move < 0 ? '—' : analysis.move + 1}\nValue: ${analysis.value}`);
        };
        bind('mreset', () => { board = Array(9).fill(0); analysis = { move: -1, value: 0, nodes: 0, cutoffs: 0, rootScores: [] }; draw(); }); bind('manalyze', () => { analysis = minimaxMove(board, checked('mprune')); draw(); });
        canvas.onclick = e => { const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width * 600 - 172) / 85), y = Math.floor(((e.clientY - r.top) / r.height * 400 - 30) / 85), i = y * 3 + x; if (x < 0 || y < 0 || x > 2 || y > 2 || board[i] || boardWinner(board) !== null) return; board[i] = 1; if (boardWinner(board) === null) { analysis = minimaxMove(board, checked('mprune')); board[analysis.move] = -1; } draw(); }; draw();
    }
    function learningView() {
        controls(`<h3>Learn by consequences.</h3><p>A small agent learns to reach G while avoiding walls and lethal traps. It starts with an empty Q-table.</p><label for="episodes">Training episodes</label><input id="episodes" type="number" value="250" min="1" max="5000">${slider('alpha', 'Learning rate α', .05, .8, .22)}${slider('gamma', 'Future reward γ', .5, .99, .95, .01)}<div class="actions"><button id="train" class="primary">TRAIN</button><button id="policy">RUN POLICY</button><button id="qreset">RESET LEARNING</button></div><div class="formula">Q(s,a) ← Q(s,a) + α [r + γ max Q(s′,a′) − Q(s,a)]</div>`, 'Training uses epsilon-greedy exploration and real reward updates. The gold route is the current greedy policy, not an A* solution. A looping or unsafe policy is reported honestly.');
        let learner = new QLearner(), pending = 0, cell = learner.start, path: number[] = [], pathIndex = 0, pathTimer = 0, report = 'UNTRAINED';
        const draw = () => {
            clear(); const ox = 90, oy = 15, tile = 39;
            for (let i = 0; i < 42; i++) { const x = ox + i % 7 * tile, y = oy + Math.floor(i / 7) * tile; c.fillStyle = learner.walls.has(i) ? '#080c13' : learner.traps.has(i) ? '#5f3039' : '#243c4a'; c.fillRect(x, y, 36, 36); if (learner.walls.has(i)) continue; const a = learner.greedy(i); text(i === learner.goal ? 'G' : i === learner.start ? 'S' : learner.traps.has(i) ? '×' : ['↑', '→', '↓', '←'][a], x + 12, y + 23, i === learner.goal ? '#ffc16a' : learner.episodes ? '#93c0c3' : '#536d7b', 15); }
            if (path.length) { c.strokeStyle = '#ffc16a'; c.beginPath(); path.slice(0, pathIndex + 1).forEach((n, i) => { const x = ox + n % 7 * tile + 18, y = oy + Math.floor(n / 7) * tile + 18; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
            c.strokeStyle = '#54d6da'; c.strokeRect(ox + cell % 7 * tile, oy + Math.floor(cell / 7) * tile, 36, 36);
            const rolling = learner.rewards.filter((_, i) => i % 10 === 0).map((_, i) => learner.rewards.slice(i * 10, i * 10 + 10).reduce((a, b) => a + b, 0) / Math.min(10, learner.rewards.length - i * 10)); line(rolling, '#54d6da', 40, 290, 520, 80); text('EPISODE REWARD / 10-episode average', 40, 279, '#99b7bf', 9);
            const recent = learner.successes.slice(-50), success = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length * 100 : 0;
            output(`${report}\nEpisodes: ${learner.episodes}${pending ? ' · training +' + pending : ''}\nExploration ε: ${learner.epsilon.toFixed(3)}\nRecent success: ${success.toFixed(0)}%\nCell: ${cell}\nQ ↑ → ↓ ←\n${learner.q[cell].map(v => v.toFixed(3)).join(' / ')}`);
        };
        bind('train', () => { pending += Math.max(1, Math.min(5000, Math.floor(val('episodes')) || 1)); report = 'TRAINING'; });
        bind('policy', () => { const result = learner.policy(); path = result.path; pathIndex = 0; pathTimer = 0; report = result.reason; cell = path[0]; draw(); });
        bind('qreset', () => { learner = new QLearner(); pending = 0; path = []; cell = learner.start; report = 'UNTRAINED'; draw(); });
        canvas.onclick = e => { const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width * 600 - 90) / 39), y = Math.floor(((e.clientY - r.top) / r.height * 400 - 15) / 39); if (x >= 0 && x < 7 && y >= 0 && y < 6) { cell = y * 7 + x; draw(); } };
        update = dt => { if (pending > 0) { const batch = Math.min(12, pending); learner.train(batch, val('alpha'), val('gamma')); pending -= batch; if (!pending) report = 'TRAINING COMPLETE'; draw(); } if (path.length && pathIndex < path.length - 1) { pathTimer += dt; if (pathTimer > (reducedMotion() ? .01 : .18)) { pathTimer = 0; cell = path[++pathIndex]; draw(); } } }; draw();
    }
    function evolutionView() {
        controls(`<h3>Evolve an encounter.</h3><label for="gseed">Seed</label><input id="gseed" value="ember-wave"><label for="gfloor">Floor</label><select id="gfloor">${[1, 2, 3, 4, 5].map(n => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select>${slider('gbudget', 'Target threat budget', 2, 12, 6.5, .25)}<label for="generations">Generations</label><input id="generations" type="number" min="1" max="60" value="25"><div class="actions"><button id="evolve" class="primary">EVOLVE</button><button id="gstep">NEXT GENERATION</button></div><div class="formula">Fitness = budget accuracy + diversity\n− overcrowding − invalid composition\nElitism · tournament · crossover · mutation</div>`, 'Campaign room populations are selected by this exact seeded genetic algorithm. The fitness function estimates encounter threat; it does not claim to measure a human player’s skill.');
        let result = evolveEncounter('ember-wave', 3, 6.5, 25), cursor = result.history.length - 1;
        const draw = () => {
            clear(); const current = result.history[cursor], names = ['WANDERER', 'ARCHER', 'GUARDIAN', 'STALKER', 'SHAMAN'];
            text(`GENERATION ${cursor} / ${result.history.length - 1}`, 30, 28, '#e3bf8f', 12);
            current.genome.forEach((count, i) => { const x = 48 + i * 106; c.fillStyle = '#213542'; c.fillRect(x, 60, 62, 120); c.fillStyle = ['#c4ac91', '#e5ac60', '#8399a7', '#9974d8', '#54d6da'][i]; c.fillRect(x, 180 - count * 32, 62, count * 32); text(String(count), x + 26, 200, '#e4d6be', 14); text(names[i], x - 1, 219, '#93a6b0', 8); });
            line(result.history.slice(0, cursor + 1).map(h => h.best), '#ffc16a', 40, 265, 520, 100); text('BEST FITNESS / elitism keeps the best', 40, 253, '#94b9c2', 9);
            const power = current.genome.reduce((sum, count, i) => sum + count * [1, 1.25, 2.4, 1.5, 1.8][i], 0);
            output(`Generation: ${cursor}\nBest fitness: ${current.best.toFixed(3)}\nMean fitness: ${current.mean.toFixed(3)}\nThreat: ${power.toFixed(2)} / ${result.budget.toFixed(2)}\nGenome: [${current.genome.join(', ')}]\nPopulation: 24`);
        };
        bind('evolve', () => { result = evolveEncounter(control('gseed').value, val('gfloor'), val('gbudget'), Math.max(1, Math.min(60, Math.floor(val('generations')) || 1))); cursor = result.history.length - 1; draw(); });
        bind('gstep', () => { if (cursor === result.history.length - 1) cursor = 0; else cursor++; draw(); }); draw();
    }
    function comparisonView() {
        const width = 20, height = 14; let start = { x: 2, y: 7 }, goal = { x: 17, y: 7 }, method: SearchMethod = 'A*';
        const grid: number[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => !x || !y || x === 19 || y === 13 ? 0 : 1)), costs = grid.map(row => row.map(() => 1));
        for (let x = 6; x <= 13; x++) for (let y = 5; y <= 9; y++) costs[y][x] = 8;
        controls(`<h3>Short is not always safe.</h3><p>Gray tiles cost 1, hot tiles cost 8. BFS minimizes steps. Dijkstra and A* minimize total travel cost.</p><label for="cmode">Click action</label><select id="cmode"><option value="heat">Toggle hazard</option><option value="wall">Toggle wall</option><option value="start">Set start S</option><option value="goal">Set goal G</option></select><div class="actions"><button id="compare" class="primary">COMPARE ALL THREE</button></div><div class="mini-options">${(['BFS', 'Dijkstra', 'A*'] as const).map(m => `<button data-method="${m}">${m}</button>`).join('')}</div><table class="aif-compare"><thead><tr><th>Search</th><th>Moves</th><th>Cost</th><th>Nodes</th></tr></thead><tbody id="compare-table"></tbody></table>`, 'The same weighted A* routes campaign enemies around fire, traps and collapsing edges. Manhattan distance is admissible because every step costs at least 1.');
        let results: Record<SearchMethod, RouteResult>;
        const solve = () => { results = { BFS: searchGrid(grid, start, goal, 'BFS', costs), Dijkstra: searchGrid(grid, start, goal, 'Dijkstra', costs), 'A*': searchGrid(grid, start, goal, 'A*', costs) }; draw(); };
        const draw = () => {
            clear(); const tile = 25, ox = 50, oy = 25;
            grid.forEach((row, y) => row.forEach((cell, x) => { c.fillStyle = !cell ? '#070b12' : costs[y][x] > 1 ? '#6c4030' : '#253c49'; c.fillRect(ox + x * tile + 1, oy + y * tile + 1, 23, 23); if (cell && costs[y][x] > 1) text(String(costs[y][x]), ox + x * tile + 9, oy + y * tile + 16, '#bba287', 8); }));
            const result = results[method]; c.strokeStyle = '#ffc16a'; c.lineWidth = 2; c.beginPath(); result.path.forEach((p, i) => i ? c.lineTo(ox + (p.x + .5) * tile, oy + (p.y + .5) * tile) : c.moveTo(ox + (p.x + .5) * tile, oy + (p.y + .5) * tile)); c.stroke(); c.lineWidth = 1;
            for (const [p, label, color] of [[start, 'S', '#54d6da'], [goal, 'G', '#ffc16a']] as const) text(label, ox + p.x * tile + 8, oy + p.y * tile + 17, color, 15);
            document.getElementById('compare-table')!.innerHTML = (['BFS', 'Dijkstra', 'A*'] as const).map(m => `<tr class="${m === method ? 'active' : ''}"><td>${m}</td><td>${results[m].path.length ? results[m].path.length - 1 : '—'}</td><td>${results[m].cost}</td><td>${results[m].visited.length}</td></tr>`).join('');
            output(`${method}\nPath cost: ${result.cost}\nMoves: ${Math.max(0, result.path.length - 1)}\nExpanded: ${result.visited.length}\n${result.path.length ? 'Reachable' : 'No path exists'}`);
        };
        bind('compare', solve); overlay.querySelectorAll<HTMLButtonElement>('[data-method]').forEach(button => button.onclick = () => { method = button.dataset.method as SearchMethod; draw(); });
        canvas.onclick = e => { const r = canvas.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width * 600 - 50) / 25), y = Math.floor(((e.clientY - r.top) / r.height * 400 - 25) / 25); if (x < 0 || y < 0 || x >= width || y >= height) return; const mode = control('cmode').value; if (mode === 'start') { start = { x, y }; grid[y][x] = 1; } else if (mode === 'goal') { goal = { x, y }; grid[y][x] = 1; } else if (x !== start.x || y !== start.y) { if (x === goal.x && y === goal.y) return; if (mode === 'wall') grid[y][x] = 1 - grid[y][x]; else costs[y][x] = costs[y][x] > 1 ? 1 : 8; } solve(); }; solve();
    }
    let last = performance.now();
    function loop(now: number) { if (stopped) return; const dt = Math.min(.05, (now - last) / 1000); last = now; update?.(dt, now); frame = requestAnimationFrame(loop); }
    setup(); frame = requestAnimationFrame(loop);
}
