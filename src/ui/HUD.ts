import { Run, themes, TILE, weapons, upgrades } from '../simulation';
import { icon, upgradeIcons } from './icons';
import { escapeHTML, timeLabel } from './utils';
export class HUD {
    constructor(private root: HTMLElement, private selectWeapon: (index: number) => void = () => {}) {}
    mount() {
        this.root.innerHTML = `<div class="vitals hud-surface"><div class="health-caption"><span>${icon('heart')} VITALITY</span><b id="hp-value"></b></div><div class="health-track"><i id="hp-fill"></i></div><div class="vitals-foot"><span>${icon('potion')} <b id="potions"></b> <kbd>Q</kbd></span><span id="hud-blessings"></span></div><div class="heat-caption"><span>${icon('ember')} LIVING EMBER</span><b id="heat-value"></b></div><div class="heat-track"><i id="heat-fill"></i></div><div class="heat-state" id="heat-state"></div></div><div class="floor-heading"><span id="floor-index"></span><h2 id="floor-name"></h2><span id="room-status"></span></div><div class="map-cluster"><div class="map-frame"><canvas id="minimap" width="128" height="128" aria-label="Explored dungeon map"></canvas><span class="map-compass">N</span></div><div class="map-count" id="enemy-count"></div><details class="seed-details"><summary>SEED <span>+</span></summary><code id="seed-value"></code></details></div><div class="weaponbar">${weapons.map((w, i) => `<button data-weapon="${i}" title="${w.description}"><kbd>${w.key}</kbd><span>${w.name}</span></button>`).join('')}<div class="weapon-special" id="weapon-special"></div></div><div class="abilities"><div class="ability" id="dash-ability"><div class="ability-icon">${icon('dash')}<i id="dash-mask"></i></div><div><kbd>SPACE</kbd><span id="dash-text"></span></div></div><div class="ability"><div><kbd>SHIFT</kbd><span>SNEAK</span></div><div><kbd>LMB / RMB</kbd><span>FIRE / SPECIAL</span></div></div><div class="inventory"><details><summary id="inventory-summary" aria-label="View active blessings">${icon('crown')}<span id="inventory-count"></span></summary><div id="inventory-list"></div></details></div></div><div class="temporary-status" id="temporary-status" role="status"></div><div class="run-caption"><span id="run-time"></span><i></i><span id="run-score"></span><span id="debug-status" class="debug-chip" hidden>F3 · AI DEBUG</span><span class="pause-hint"><kbd>ESC</kbd> PAUSE</span></div><div id="boss-hud" class="boss-hud" hidden><span>THE EMBER WARDEN</span><div><i id="boss-fill"></i></div><small id="boss-phase"></small></div><div id="ai-inspector" class="ai-inspector" hidden></div>`;
        this.root.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button => button.onclick = () => this.selectWeapon(Number(button.dataset.weapon)));
    }
    clear() { this.root.innerHTML = ''; }
    update(run: Run, debug: boolean) {
        if (!this.root.querySelector('#hp-value')) this.mount();
        const put = (id: string, text: string) => { this.root.querySelector<HTMLElement>('#' + id)!.textContent = text; };
        put('hp-value', `${Math.ceil(run.hp)} / ${run.maxHP}`); this.root.querySelector<HTMLElement>('#hp-fill')!.style.width = `${run.hp / run.maxHP * 100}%`;
        this.root.querySelector('.vitals')!.classList.toggle('low-health', run.hp < run.maxHP * .3);
        put('potions', `${run.potions} FLASK${run.potions === 1 ? '' : 'S'}`); put('hud-blessings', `${run.owned.length} BLESSINGS`);
        put('heat-value', `${Math.round(run.heat)} / 100`); this.root.querySelector<HTMLElement>('#heat-fill')!.style.width = `${run.heat}%`;
        put('heat-state', run.heat >= 70 ? 'BLAZING · +25% DAMAGE / MORE VISIBLE' : run.heat < 25 ? 'SMOULDERING · LESS VISIBLE / WEAKER' : 'STEADY · FEED THE FLAME');
        put('floor-index', `DESCENT ${String(run.floor).padStart(2, '0')} / 05`); put('floor-name', themes[run.floor - 1]);
        const count = run.enemies.filter(e => e.room === run.room).length, encounter = run.encounters.get(run.room);
        let roomStatus = run.exitReady ? 'THE WAY BELOW IS OPEN' : count ? `${count} HOSTILE${count === 1 ? '' : 'S'} IN THIS CHAMBER` : 'EXPLORE THE RUINS';
        if (encounter?.started && !encounter.complete) roomStatus = encounter.type === 'defense' ? `PROTECT THE WARD · ${Math.max(0, Math.ceil(15 - encounter.time))}s · ${count} FOES` : encounter.type === 'collapse' ? encounter.time > 7 ? 'COLLAPSE · CLEAR FOES AND LEAVE' : `UNSTABLE STONE · ${Math.ceil(7 - encounter.time)}s` : encounter.trialAccepted ? `OATH ACTIVE · NO FLASKS · ${count} FOES` : roomStatus;
        put('room-status', roomStatus); put('enemy-count', run.exitReady ? 'EXIT UNSEALED' : `${run.enemies.length} HOSTILES / ${Array.from(run.encounters.values()).filter(e => !e.complete).length} TRIALS`); put('seed-value', run.seed);
        put('dash-text', run.dash > 0 ? `${run.dash.toFixed(1)}s` : 'DASH READY'); this.root.querySelector<HTMLElement>('#dash-mask')!.style.height = `${Math.max(0, run.dash / run.dashCD * 100)}%`; this.root.querySelector('#dash-ability')!.classList.toggle('ready', run.dash <= 0);
        const weapon = weapons[run.weapon]; this.root.querySelectorAll<HTMLElement>('[data-weapon]').forEach(button => button.classList.toggle('active', Number(button.dataset.weapon) === run.weapon));
        put('weapon-special', `${weapon.special.toUpperCase()} · RMB · ${weapon.heat} HEAT ${run.alternateCD > 0 ? '· ' + run.alternateCD.toFixed(1) + 's' : ''}${run.weapon === 2 ? ' · HOLD LMB TO CHARGE' : ''}`);
        put('inventory-count', String(run.owned.length));
        const names = upgrades.map(u => u[1]);
        this.root.querySelector('#inventory-list')!.innerHTML = (run.owned.length ? [...new Set(run.owned)].map(name => `<div>${icon(upgradeIcons[names.indexOf(name)] ?? 'ember')}<span>${escapeHTML(name)}</span><b>×${run.owned.filter(n => n === name).length}</b></div>`).join('') : '<p>Clear a combat encounter to receive a blessing.</p>') + run.curses.map(name => `<div class="curse-line">${icon('skull')}<span>CURSE · ${escapeHTML(name)}</span></div>`).join('');
        put('temporary-status', run.burst > 0 ? 'DASH · INVULNERABLE' : run.sneaking ? 'MOVING QUIETLY' : run.invuln > 0 ? 'BRIEF DAMAGE IMMUNITY' : run.quest ? `CONTRACT · ${run.quest.kind === 'hunt' ? run.floorKills + ' / 8 FOES' : run.floorHeals + ' FLASKS USED'}` : run.burning ? 'BURNING ROUNDS ACTIVE' : '');
        put('run-time', timeLabel(run.elapsed)); put('run-score', `${run.score.toLocaleString()} SCORE · ${run.coins} COINS`); this.root.querySelector<HTMLElement>('#debug-status')!.hidden = !debug;
        const boss = run.enemies.find(e => e.kind === 4 && (e.ai.state !== 'PATROL' || e.room === run.room)); this.root.querySelector<HTMLElement>('#boss-hud')!.hidden = !boss;
        if (boss) { this.root.querySelector<HTMLElement>('#boss-fill')!.style.width = `${boss.hp / boss.max * 100}%`; put('boss-phase', boss.phase === 2 ? 'II · THE UNBOUND FLAME' : 'I · THE LAST GUARDIAN'); }
        const inspector = this.root.querySelector<HTMLElement>('#ai-inspector')!; inspector.hidden = !debug;
        if (debug) {
            const enemy = [...run.enemies].sort((a, b) => Math.hypot(a.x - run.x, a.y - run.y) - Math.hypot(b.x - run.x, b.y - run.y))[0], mind = enemy ? run.minds.get(enemy.id) : undefined;
            inspector.textContent = enemy && mind ? `AGENT ${enemy.id} · FSM ${enemy.ai.state}\nUTILITY: ${mind.choice.action}\n${mind.choice.scores.map(s => s.action + ' ' + s.score.toFixed(2)).join(' / ')}\nGOAP: ${mind.plan.actions.map(a => a.name).join(' → ')}\nBAYES: entropy ${mind.belief.entropy().toFixed(2)} bits\n${enemy.kind === 4 ? run.bossTrace.map(n => ' '.repeat(n.depth) + n.name + ': ' + n.status).join('\n') : 'Weighted A* · hazards cost 5–10'}` : 'Explore to observe an intelligent agent.';
        }
        const canvas = this.root.querySelector<HTMLCanvasElement>('#minimap')!, c = canvas.getContext('2d')!; c.clearRect(0, 0, 128, 128); c.fillStyle = '#525461';
        for (const k of run.revealed) { const [x, y] = k.split(',').map(Number); c.fillRect(x * 2, y * 2, 2, 2); }
        for (const [i, room] of run.d.rooms.entries()) if (run.visited.includes(i)) { c.fillStyle = room.type === 'exit' ? '#ffc16a' : room.type === 'healing' ? '#54d6da' : '#8e806b'; c.fillRect(Math.floor(room.x + room.w / 2) * 2, Math.floor(room.y + room.h / 2) * 2, 3, 3); }
        c.fillStyle = '#ffe0a4'; c.fillRect(Math.floor(run.x / TILE * 2) - 1, Math.floor(run.y / TILE * 2) - 1, 3, 3);
    }
}
