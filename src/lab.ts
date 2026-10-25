import { Agent, astar, Cell, Search, Random, walk } from './ai';
import { generate, validate, Dungeon, Room, center, GenerationInputError } from './dungeon';
import { icon } from './ui/icons';

/** The archive is a view over the same solver, A* and Agent used in the campaign. */
export function laboratory(back: () => void, reducedMotion = () => false, advanced?: () => void) {
    const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
    let tab = 0, frame = 0, stopped = false, auto = false, lastStep = 0;
    let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
    let dungeon: Dungeon, traceStep = 0;
    let grid: number[][], start = { x: 2, y: 2 }, goal = { x: 20, y: 14 }, selected: Cell | undefined;
    let result: Search | undefined, step = 0, mode = 'wall', randomIndex = 0;
    let agent = new Agent({ x: 5.5, y: 5.5 }), enemy = { x: 5.5, y: 5.5 }, player = { x: 16.5, y: 10.5 };
    const keys = new Set<string>();
    const states = ['PATROL', 'ALERT', 'CHASE', 'ATTACK', 'SEARCH'];
    function leave() { stopped = true; cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); back(); }
    function keydown(e: KeyboardEvent) {
        if (e.key === 'Escape') { leave(); return; }
        if ((e.target as HTMLElement).matches('input,select,button')) return;
        keys.add(e.key.toLowerCase());
        if (tab === 2 && e.key.startsWith('Arrow')) e.preventDefault();
    }
    function keyup(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()); }
    function blur() { keys.clear(); }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    const bind = (id: string, fn: () => void) => { document.getElementById(id)!.onclick = fn; };
    const readout = (text: string) => { document.getElementById('readout')!.textContent = text; };
    function baseGrid() { return Array.from({ length: 18 }, (_, y) => Array.from({ length: 24 }, (_, x) => x === 0 || y === 0 || x === 23 || y === 17 || x === 11 && y > 3 && y < 15 && y !== 10 ? 0 : 1)); }
    function shell() {
        auto = false; keys.clear();
        const legends = tab === 0 ? [['#54d6da', 'CANDIDATE'], ['#7fc4a1', 'VALID'], ['#d94b53', 'REJECTED'], ['#ff994b', 'CORRIDOR']] : tab === 1 ? [['#54d6da', 'OPEN'], ['#3c7e91', 'CLOSED'], ['#ffc16a', 'PATH'], ['#7fc4a1', 'START'], ['#d94b53', 'GOAL']] : [['#ffc16a', 'AGENT / FOV'], ['#54d6da', 'YOU'], ['#d94b53', 'LAST SEEN']];
        overlay.innerHTML = `<section class="lab dialog"><header class="archive-header"><div><small>THE ARCANE ARCHIVE / AI LABORATORY</small><h2>Intelligence beneath the ember.</h2><p>Uncover the intelligence beneath the dungeon.</p></div><div class="archive-seal">${icon('eye')}<span>OBSERVE<br>UNDERSTAND<br>DESCEND</span></div></header><nav class="tabs" aria-label="AI algorithms"><button data-tab="0">01 · CSP — Dungeon Generation</button><button data-tab="1">02 · A* — Pathfinding</button><button data-tab="2">03 · Agents — Enemy Intelligence</button>${advanced ? '<button id="advanced-archive">AIF EXPANSION +8</button>' : ''}<button id="back">← MAIN MENU</button></nav><div class="lab-layout"><div class="lab-stage"><div class="stage-toolbar"><span id="stage-mode">${['CONSTRAINT TRACE', 'SEARCH SPACE', 'PERCEPTION CHAMBER'][tab]}</span><b>LIVE ALGORITHM</b></div><canvas id="lab" width="576" height="432" tabindex="0" aria-label="${['Dungeon generation trace', 'Interactive A star grid', 'Interactive agent simulation'][tab]}"></canvas><div class="stage-legend">${legends.map(([c, name]) => `<span><i style="--legend:${c}"></i>${name}</span>`).join('')}</div>${tab === 2 ? `<div class="state-track">${states.map(s => `<span data-state="${s}">${s}</span>`).join('')}</div>` : ''}</div><aside id="controls"></aside></div></section>`;
        canvas = document.getElementById('lab') as HTMLCanvasElement; ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
        document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => { const active = Number(b.dataset.tab) === tab; b.classList.toggle('active', active); b.setAttribute('aria-current', String(active)); b.onclick = () => { tab = Number(b.dataset.tab); shell(); }; });
        bind('back', leave);
        if (advanced) bind('advanced-archive', () => { leave(); advanced(); });
        const controls = document.getElementById('controls')!;
        if (tab === 0) {
            controls.innerHTML = `<h3>Room by room.</h3><p>Assign room variables. Reject overlaps. Undo an assignment when its branch fails.</p><label for="lseed">GENERATION SEED</label><input id="lseed" value="ember-2026"><div class="parameter-row"><div><label for="size">MAP SIZE</label><select id="size"><option>48</option><option selected>64</option><option>80</option></select></div><div><label for="count">ROOMS</label><input id="count" type="number" min="4" max="12" value="8"></div></div><label for="sep">MINIMUM SEPARATION</label><input id="sep" type="number" min="1" max="4" value="2"><div class="actions"><button id="gen" class="primary">GENERATE</button><button id="trace">PLAY TRACE</button><button id="cstep">STEP</button></div><input class="trace-slider" id="trace-position" type="range" min="0" max="1" value="1" aria-label="Generation trace step"><div class="step-reason" id="reason"></div><div class="readout" id="readout"></div><div class="algorithm-note"><p>Domains stay within map bounds. Pairwise constraints prevent overlap and enforce separation. A spanning corridor graph enforces global reachability.</p></div>`;
            const error = document.createElement('p'); error.id = 'generation-error'; error.className = 'lab-notice'; error.hidden = true; error.setAttribute('role', 'alert'); error.tabIndex = -1; controls.prepend(error);
            for (const id of ['count', 'sep']) { const input = document.getElementById(id)!; input.setAttribute('step', '1'); input.setAttribute('aria-describedby', 'generation-error'); }
            bind('gen', generateMap); bind('trace', () => { if (traceStep >= dungeon.attempts.length) traceStep = 0; auto = !auto; document.getElementById('trace')!.textContent = auto ? 'PAUSE TRACE' : 'PLAY TRACE'; drawCSP(); });
            bind('cstep', () => { auto = false; if (traceStep >= dungeon.attempts.length) traceStep = 0; traceStep++; drawCSP(); });
            document.getElementById('trace-position')!.oninput = e => { auto = false; traceStep = Number((e.target as HTMLInputElement).value); drawCSP(); };
            generateMap();
        } else {
            grid = baseGrid(); result = undefined; selected = undefined; step = 0; start = { x: 2, y: 2 }; goal = { x: 20, y: 14 };
            if (tab === 1) {
                mode = 'wall';
                controls.innerHTML = `<h3>The shortest way through.</h3><p>Edit the grid, then watch a binary min-heap choose the smallest f = g + h. Four neighbors. Manhattan heuristic.</p><label for="mode">CLICK A TILE TO</label><select id="mode"><option value="wall">Place / remove obstacle</option><option value="start">Set start S</option><option value="goal">Set goal G</option><option value="inspect">Inspect g / h / f</option></select><div class="actions"><button id="run" class="primary">RUN ALGORITHM</button><button id="step">STEP FORWARD</button></div><div class="actions"><button id="reset">RESET</button><button id="random">RANDOMIZE OBSTACLES</button></div><label for="speed">ANIMATION SPEED</label><input id="speed" type="range" min="1" max="20" value="8"><div class="readout" id="readout"></div><div class="algorithm-note"><p>g: distance travelled. h: estimated distance left. f: their sum. Click Inspect after searching to read a cell's costs.</p></div><div class="lab-notice" id="path-message">Set S and G, then run the same A* used by dungeon enemies.</div>`;
                document.getElementById('mode')!.onchange = e => mode = (e.target as HTMLSelectElement).value;
                bind('run', () => { result = astar(grid, start, goal, true); step = reducedMotion() ? result.steps.length : 0; auto = !reducedMotion(); drawGrid(); });
                bind('step', () => { auto = false; result ??= astar(grid, start, goal, true); step = Math.min(result.steps.length, step + 1); drawGrid(); });
                bind('reset', shell);
                bind('random', () => { const rng = new Random('archive-obstacles-' + randomIndex++); grid = Array.from({ length: 18 }, (_, y) => Array.from({ length: 24 }, (_, x) => x === 0 || x === 23 || y === 0 || y === 17 || rng.next() < .23 ? 0 : 1)); grid[start.y][start.x] = 1; grid[goal.y][goal.x] = 1; result = undefined; step = 0; auto = false; drawGrid(); });
                canvas.onclick = e => {
                    const p = point(e); if (!grid[p.y]) return; selected = p;
                    if (mode === 'start') { start = p; grid[p.y][p.x] = 1; }
                    if (mode === 'goal') { goal = p; grid[p.y][p.x] = 1; }
                    if (mode === 'wall' && (p.x !== start.x || p.y !== start.y) && (p.x !== goal.x || p.y !== goal.y)) grid[p.y][p.x] = 1 - grid[p.y][p.x];
                    if (mode !== 'inspect') { result = undefined; step = 0; auto = false; }
                    drawGrid();
                };
                drawGrid();
            } else {
                agent = new Agent({ x: 5.5, y: 5.5 }); enemy = { x: 5.5, y: 5.5 }; player = { x: 16.5, y: 10.5 };
                controls.innerHTML = `<h3>It sees. It remembers.</h3><p>Click the map, or focus it and use <kbd>WASD</kbd> / arrows to move the cyan keeper. Walls stop direct sight.</p><div class="readout" id="readout"></div><div class="actions"><button id="agent-reset">RESET CHAMBER</button></div><div class="algorithm-note"><p>Observation → finite-state transition → A* route → movement. After losing sight, the enemy searches its last observation for five seconds before returning to patrol.</p></div><div class="lab-notice">The attack state is harmless here. The campaign uses the same agent with real damage and cooldowns.</div>`;
                bind('agent-reset', shell);
                canvas.onclick = e => { const box = canvas.getBoundingClientRect(), p = { x: (e.clientX - box.left) / box.width * 24, y: (e.clientY - box.top) / box.height * 18 }; if (walk(grid, { x: Math.floor(p.x), y: Math.floor(p.y) })) player = p; canvas.focus({ preventScroll: true }); };
            }
        }
    }
    function point(e: MouseEvent) { const box = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(23, Math.floor((e.clientX - box.left) / box.width * 24))), y: Math.max(0, Math.min(17, Math.floor((e.clientY - box.top) / box.height * 18))) }; }
    function generateMap() {
        const value = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
        const error = document.getElementById('generation-error')!; error.hidden = true;
        for (const id of ['count', 'sep', 'size']) document.getElementById(id)!.removeAttribute('aria-invalid');
        try { dungeon = generate((document.getElementById('lseed') as HTMLInputElement).value, 1, value('size'), value('count'), value('sep')); }
        catch (cause) {
            if (!(cause instanceof GenerationInputError)) throw cause;
            auto = false; document.getElementById('trace')!.textContent = 'PLAY TRACE';
            const field = cause.field === 'separation' ? 'sep' : cause.field;
            document.getElementById(field)?.setAttribute('aria-invalid', 'true');
            error.textContent = `${cause.message} The previous map is unchanged.`; error.hidden = false; error.focus(); return;
        }
        traceStep = dungeon.attempts.length; auto = false;
        document.getElementById('trace')!.textContent = 'PLAY TRACE';
        const slider = document.getElementById('trace-position') as HTMLInputElement; slider.max = String(dungeon.attempts.length); slider.value = String(traceStep); drawCSP();
    }
    function drawCSP() {
        ctx.clearRect(0, 0, 576, 432); const scale = 408 / dungeon.grid.length, ox = 84, oy = 12;
        const rect = (r: Room) => [ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale] as const;
        ctx.strokeStyle = '#344a54'; ctx.strokeRect(ox, oy, 408, 408);
        const done = traceStep >= dungeon.attempts.length, attempt = dungeon.attempts[Math.max(0, traceStep - 1)];
        const placed = done ? dungeon.rooms : attempt?.stack ?? [];
        if (done) { ctx.fillStyle = '#253643'; dungeon.grid.forEach((row, y) => row.forEach((cell, x) => { if (cell) ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale); })); ctx.fillStyle = '#ff994b'; dungeon.connections.flat().forEach(p => ctx.fillRect(ox + (p.x + .3) * scale, oy + (p.y + .3) * scale, scale * .4, scale * .4)); }
        if (done) for (const a of dungeon.attempts.filter(a => !a.accepted && a.event === 'candidate').slice(-30)) { ctx.strokeStyle = '#d94b5338'; ctx.strokeRect(...rect(a.room)); }
        for (const [i, r] of placed.entries()) { ctx.fillStyle = '#7fc4a11c'; ctx.fillRect(...rect(r)); ctx.strokeStyle = '#7fc4a1'; ctx.strokeRect(...rect(r)); ctx.fillStyle = '#b2c8bc'; ctx.font = '8px monospace'; const c = center(r); ctx.fillText(`${i} ${r.type.toUpperCase()}`, ox + c.x * scale - r.w * 2, oy + c.y * scale); }
        if (!done && attempt && traceStep > 0) { ctx.strokeStyle = '#54d6da'; ctx.lineWidth = 2; ctx.strokeRect(...rect(attempt.room)); ctx.lineWidth = 1; ctx.fillStyle = attempt.accepted ? '#7fc4a144' : '#d94b5344'; ctx.fillRect(...rect(attempt.room)); ctx.strokeStyle = attempt.accepted ? '#7fc4a1' : '#d94b53'; const [x, y, w, h] = rect(attempt.room); ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); if (!attempt.accepted) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); } }
        const trace = dungeon.attempts.slice(0, traceStep);
        const meta = dungeon.generation;
        readout(`TRACE       ${traceStep} / ${dungeon.attempts.length}${meta.traceTruncated ? ' (TRUNCATED)' : ''}\nACCEPTED    ${trace.filter(a => a.accepted).length}\nREJECTED    ${trace.filter(a => !a.accepted && a.event === 'candidate').length}\nBACKTRACKS  ${trace.filter(a => a.event === 'backtrack').length} shown / ${meta.backtracks} total\nCANDIDATES  ${meta.candidateAttempts} / ${meta.searchBudget}\nGENERATOR   ${meta.fallbackUsed ? 'FALLBACK LAYOUT' : 'CSP SOLUTION'}\nROOMS       ${done ? dungeon.rooms.length : placed.length + (traceStep > 0 && attempt?.accepted ? 1 : 0)} / ${dungeon.rooms.length}\nCONNECTED   ${done ? String(validate(dungeon)) : 'pending corridor graph'}`);
        const outcome = meta.fallbackUsed ? 'FALLBACK LAYOUT · CSP search did not finish within its limits. This regular layout is separate from the search trace.' : 'CSP SOLVED · Every room is reachable.';
        document.getElementById('reason')!.textContent = (done ? outcome : traceStep === 0 ? 'READY · No variables assigned.' : `${attempt?.event === 'backtrack' ? 'UNDO' : attempt?.accepted ? 'VALID' : 'VIOLATION'} · ${attempt?.reason}`) + (meta.traceTruncated ? ` Trace truncated: only the first ${meta.traceLimit} events are recorded.` : '');
        (document.getElementById('trace-position') as HTMLInputElement).value = String(traceStep);
    }
    function drawGrid() {
        ctx.clearRect(0, 0, 576, 432);
        for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) { ctx.fillStyle = grid[y][x] ? '#252e3b' : '#090d15'; ctx.fillRect(x * 24 + 1, y * 24 + 1, 22, 22); if (!grid[y][x]) { ctx.strokeStyle = '#34404c'; ctx.strokeRect(x * 24 + 1.5, y * 24 + 1.5, 21, 21); } }
        if (tab !== 1) return;
        const state = step > 0 ? result?.steps[step - 1] : undefined;
        const fill = (cells: Cell[] | undefined, color: string) => { ctx.fillStyle = color; cells?.forEach(p => ctx.fillRect(p.x * 24 + 3, p.y * 24 + 3, 18, 18)); };
        fill(state?.closed, '#326477'); fill(state?.open, '#54aeb4');
        // Distinct marks accompany color so the sets remain distinguishable without hue.
        ctx.fillStyle = '#142530'; state?.closed.forEach(p => ctx.fillRect(p.x * 24 + 11, p.y * 24 + 11, 2, 2));
        ctx.fillStyle = '#18313b'; state?.open.forEach(p => { ctx.fillRect(p.x * 24 + 9, p.y * 24 + 11, 6, 2); ctx.fillRect(p.x * 24 + 11, p.y * 24 + 9, 2, 6); });
        if (result && step >= result.steps.length) { fill(result.path, '#c69348'); ctx.strokeStyle = '#ffe2a5'; ctx.lineWidth = 2; ctx.beginPath(); result.path.forEach((p, i) => i ? ctx.lineTo(p.x * 24 + 12, p.y * 24 + 12) : ctx.moveTo(p.x * 24 + 12, p.y * 24 + 12)); ctx.stroke(); ctx.lineWidth = 1; }
        fill([start], '#7fc4a1'); fill([goal], '#d94b53'); ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#0b0d12'; ctx.fillText('S', start.x * 24 + 12, start.y * 24 + 16); ctx.fillStyle = '#ffe5d0'; ctx.fillText('G', goal.x * 24 + 12, goal.y * 24 + 16); ctx.textAlign = 'left';
        if (selected) { ctx.strokeStyle = '#eae3d5'; ctx.strokeRect(selected.x * 24 + .5, selected.y * 24 + .5, 23, 23); }
        const score = selected ? result?.scores[`${selected.x},${selected.y}`] : undefined;
        readout(`SEARCH STEP   ${step} / ${result?.steps.length ?? 0}\nNODES CLOSED  ${step >= (result?.steps.length ?? Infinity) ? result?.closed.length ?? 0 : state?.closed.length ?? 0}\nPATH LENGTH   ${result && step >= result.steps.length ? result.path.length ? result.path.length - 1 + ' moves' : 'unreachable' : 'search pending'}\nCELL          ${selected ? selected.x + ', ' + selected.y : 'click Inspect'}\ng / h / f     ${score ? `${score.g} / ${score.h} / ${score.f}` : '— / — / —'}`);
        document.getElementById('path-message')!.textContent = result && step >= result.steps.length ? result.path.length ? 'SHORTEST PATH FOUND · Gold connects S to G.' : 'NO PATH · Remove an obstacle or move the goal.' : auto ? 'SEARCHING · The next lowest-cost node is expanded.' : 'Set S and G, then run the same A* used by dungeon enemies.';
    }
    function simulate(dt: number, now: number) {
        const dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
        const can = (x: number, y: number) => walk(grid, { x: Math.floor(x), y: Math.floor(y) });
        if (can(player.x + dx * dt * 4, player.y)) player.x += dx * dt * 4;
        if (can(player.x, player.y + dy * dt * 4)) player.y += dy * dt * 4;
        agent.observe(grid, enemy, player, dt);
        const target = agent.state === 'PATROL' ? { x: 5.5 + Math.sin(now / 2500) * 3, y: 5.5 } : agent.last;
        if (agent.state !== 'ATTACK' && agent.state !== 'ALERT') {
            const p = agent.route(grid, enemy, target)[0];
            if (p) { const dx = p.x + .5 - enemy.x, dy = p.y + .5 - enemy.y, d = Math.hypot(dx, dy); if (d < .08) agent.path.shift(); else { enemy.x += dx / d * dt * 2; enemy.y += dy / d * dt * 2; agent.facing = Math.atan2(dy, dx); } }
        }
        if (agent.state === 'ATTACK' && agent.cooldown <= 0) agent.cooldown = 1.1;
        drawGrid();
        ctx.strokeStyle = '#ffc16a44'; ctx.beginPath(); ctx.arc(enemy.x * 24, enemy.y * 24, agent.vision * 24, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffc16a16'; ctx.beginPath(); ctx.moveTo(enemy.x * 24, enemy.y * 24); ctx.arc(enemy.x * 24, enemy.y * 24, agent.vision * 24, agent.facing - agent.fov / 2, agent.facing + agent.fov / 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffc16a'; ctx.beginPath(); ctx.moveTo(enemy.x * 24, enemy.y * 24); agent.path.forEach(p => ctx.lineTo((p.x + .5) * 24, (p.y + .5) * 24)); ctx.stroke();
        ctx.strokeStyle = '#d94b53'; ctx.strokeRect(agent.last.x * 24 - 4, agent.last.y * 24 - 4, 8, 8); ctx.fillStyle = '#d94b53'; ctx.font = '8px monospace'; ctx.fillText('LAST SEEN', agent.last.x * 24 + 7, agent.last.y * 24 - 7);
        ctx.strokeStyle = '#a59c90'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(enemy.x * 24, enemy.y * 24); ctx.lineTo(target.x * 24, target.y * 24); ctx.stroke(); ctx.setLineDash([]); ctx.strokeRect(target.x * 24 - 2, target.y * 24 - 2, 4, 4);
        for (const [p, color, label] of [[player, '#54d6da', 'YOU'], [enemy, '#ffc16a', 'AGENT']] as const) { ctx.fillStyle = '#080b12'; ctx.fillRect(p.x * 24 - 7, p.y * 24 - 9, 14, 18); ctx.fillStyle = color; ctx.fillRect(p.x * 24 - 5, p.y * 24 - 7, 10, 14); ctx.fillStyle = '#111722'; ctx.fillRect(p.x * 24 - 3, p.y * 24 - 4, 6, 3); ctx.fillStyle = color; ctx.font = '8px monospace'; ctx.fillText(label, p.x * 24 - 9, p.y * 24 + 21); }
        ctx.strokeStyle = '#ffc16a'; ctx.beginPath(); ctx.moveTo(enemy.x * 24, enemy.y * 24); ctx.lineTo(enemy.x * 24 + Math.cos(agent.facing) * 18, enemy.y * 24 + Math.sin(agent.facing) * 18); ctx.stroke();
        document.querySelectorAll<HTMLElement>('[data-state]').forEach(el => el.classList.toggle('active', el.dataset.state === agent.state));
        readout(`CURRENT STATE   ${agent.state}\nCAN SEE PLAYER  ${agent.visible ? 'TRUE · DETECTED' : 'FALSE · OCCLUDED / OUT OF FOV'}\nDISTANCE        ${agent.distance.toFixed(2)} tiles\nLAST SEEN       ${agent.lost.toFixed(1)}s ago\nATTACK COOLDOWN ${agent.cooldown.toFixed(1)}s\nTARGET          ${target.x.toFixed(1)}, ${target.y.toFixed(1)}`);
    }
    let last = performance.now();
    function loop(now: number) {
        if (stopped) return;
        const dt = Math.min(.04, (now - last) / 1000); last = now;
        if (tab === 2) simulate(dt, now);
        if (auto && now - lastStep > (tab === 0 ? 180 : 1000 / Number((document.getElementById('speed') as HTMLInputElement).value))) {
            lastStep = now;
            if (tab === 0) { traceStep = Math.min(dungeon.attempts.length, traceStep + 1); drawCSP(); if (traceStep === dungeon.attempts.length) { auto = false; document.getElementById('trace')!.textContent = 'PLAY TRACE'; } }
            if (tab === 1 && result) { step = Math.min(result.steps.length, step + 1); drawGrid(); if (step === result.steps.length) auto = false; }
        }
        frame = requestAnimationFrame(loop);
    }
    shell(); frame = requestAnimationFrame(loop);
}
