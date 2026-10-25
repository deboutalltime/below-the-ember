import { Agent, Cell, Random, los, walk } from './ai';
import { generate, center, Dungeon } from './dungeon';
import { upgrades, weapons, upgradeRarity, floorLore } from './game/content';
import { populateEnvironment, hazardCosts, canBlockCell, WorldObject, Encounter, Noise } from './game/environment';
import { evolveEncounter, Generation } from './intelligence/evolution';
import { EnemyMind } from './intelligence/EnemyMind';
import { decideBoss, BehaviorTrace } from './intelligence/behavior';
import { boardWinner, minimaxMove } from './intelligence/minimax';
import { FeedbackStream } from './game/feedback';
export { upgrades, weapons };
export const TILE = 24;
export const themes = ['Forgotten Entrance', 'Ashen Corridors', 'Hollow Depths', 'Burning Catacombs', 'Heart of the Ember'];
export interface Enemy { id: number; x: number; y: number; hp: number; max: number; kind: number; room: number; ai: Agent; burn: number; phase: number; telegraph: number; patrol: Cell; buff?: number; healCooldown?: number; }
export interface Bullet { x: number; y: number; vx: number; vy: number; life: number; damage: number; hostile: boolean; bounces?: number; pierce?: number; hits?: number[]; burn?: boolean; }
export interface Effect { x: number; y: number; text: string; color: number; life: number; kind?: 'arc' | 'blast'; radius?: number; angle?: number; x2?: number; y2?: number; }
export interface GameInput { x: number; y: number; shoot: boolean; angle: number; dash: boolean; alternate?: boolean; sneak?: boolean; }
export interface EventOption { id: string; title: string; detail: string; enabled?: boolean; }
export interface GameEvent { kind: string; title: string; description: string; options: EventOption[]; room: number; }
export interface Contract { kind: 'hunt' | 'restraint'; floor: number; target: number; reward: number; completed: boolean; }
type Status = 'playing' | 'upgrade' | 'dead' | 'victory' | 'event' | 'camp' | 'duel';
export class Run {
    seed: string; floor = 1; hp = 100; maxHP = 100; speed = 180; damage = 15; rate = 2; armor = 1; split = 1; range = 1; dashCD = 3; burning = false;
    potions = 2; score = 0; kills = 0; elapsed = 0; x = 0; y = 0; invuln = 0; shot = 0; dash = 0; burst = 0; dx = 1; dy = 0;
    heat = 65; coins = 20; weapon = 0; charge = 0; alternateCD = 0; forge = 0; ricochet = 0; piercing = 0; floorKills = 0; floorHeals = 0; revived = false;
    sneaking = false; mapRevision = 0; deathReason = ''; upgradeReturn: 'playing' | 'camp' = 'playing';
    curses: string[] = []; quest?: Contract; event?: GameEvent; board = Array<number>(9).fill(0); duelResult: number | null = null; duelStats = { nodes: 0, cutoffs: 0 }; duelPaid = false;
    d!: Dungeon; enemies: Enemy[] = []; bullets: Bullet[] = []; effects: Effect[] = []; objects: WorldObject[] = []; noises: Noise[] = []; encounters = new Map<number, Encounter>();
    minds = new Map<number, EnemyMind>(); bossTrace: BehaviorTrace[] = []; evolution: Generation[] = []; costs: number[][] = []; cleared: number[] = []; visited: number[] = []; revealed: string[] = []; picks: number[] = []; owned: string[] = []; room = 0; status: Status = 'playing';
    rng: Random; private enemySerial = 0; private objectSerial = 0; private noiseSerial = 0; private costTimer = 0; private trailTimer = 0; private stepTimer = 0;
    readonly feedback = new FeedbackStream();
    private footDistance = 0;
    constructor(seed: string) { this.seed = seed; this.rng = new Random(seed + 'rewards'); this.loadFloor(); }
    loadFloor() {
        this.feedback.clear(); this.footDistance = 0;
        this.burst = this.dash = this.shot = this.alternateCD = this.stepTimer = this.trailTimer = 0; this.sneaking = false;
        this.d = generate(this.seed, this.floor, 64, 12); const p = center(this.d.rooms[0]); this.x = (p.x + .5) * TILE; this.y = (p.y + .5) * TILE;
        const contents = populateEnvironment(this.d, this.seed, this.floor); this.objects = contents.objects; this.encounters = contents.encounters;
        this.objectSerial = this.objects.length; this.enemySerial = 0; this.enemies = []; this.bullets = []; this.effects = []; this.noises = []; this.minds.clear(); this.bossTrace = []; this.cleared = []; this.visited = []; this.revealed = [];
        this.event = undefined; this.status = 'playing'; this.floorKills = 0; this.floorHeals = 0; this.revived = false; this.charge = 0; this.invuln = 0; this.costTimer = 0; this.d.spawns = [];
        // Room compositions come from the same evolutionary optimizer exposed in the archive.
        for (const encounter of this.encounters.values()) this.spawnWave(encounter.room, false);
        if (this.floor === 5) this.spawnEnemy(4, this.d.rooms.length - 1, new Random(this.seed + ':warden'));
        for (const object of this.objects) if (object.kind === 'pillar') {
            const cell = { x: Math.floor(object.x / TILE), y: Math.floor(object.y / TILE) };
            if (canBlockCell(this.d, cell, { x: this.x / TILE, y: this.y / TILE })) { this.d.grid[cell.y][cell.x] = 0; object.solid = true; }
        }
        this.costs = hazardCosts(this.d.grid, this.objects, this.encounters, this.d); this.mapRevision++;
    }
    private spawnEnemy(kind: number, roomIndex: number, rng: Random) {
        const room = this.d.rooms[roomIndex], c = center(room); let x = c.x + .5, y = c.y + .5;
        for (let n = 0; n < 40; n++) { const px = rng.int(room.x + 1, room.x + room.w - 2) + .5, py = rng.int(room.y + 1, room.y + room.h - 2) + .5; if (this.d.grid[Math.floor(py)]?.[Math.floor(px)] === 1 && !this.objects.some(o => Math.hypot(o.x / TILE - px, o.y / TILE - py) < .8)) { x = px; y = py; break; } }
        const max = kind === 4 ? 650 : [38, 30, 95, 28, 650, 44][kind] * (1 + (this.floor - 1) * .16);
        const enemy: Enemy = { id: this.enemySerial++, x: x * TILE, y: y * TILE, hp: max, max, kind, room: roomIndex, ai: new Agent({ x, y }, kind === 1 || kind === 5 ? 6 : 1.35, kind === 3 ? 11 : 9), burn: 0, phase: 0, telegraph: 0, patrol: { x, y }, buff: 0, healCooldown: 0 };
        if (kind === 4) { enemy.ai.fov = Math.PI * 2; enemy.ai.vision = 14; }
        this.enemies.push(enemy); this.d.spawns.push({ x, y, kind, room: roomIndex });
    }
    private spawnWave(room: number, reinforcement: boolean) {
        const result = evolveEncounter(`${this.seed}:wave:${this.floor}:${room}:${reinforcement}`, this.floor, reinforcement ? 2.5 : 2.5 + this.floor * 1.25 + (room % 3 - 1) * .5);
        this.evolution = result.history;
        const rng = new Random(`${this.seed}:spawn:${this.floor}:${room}:${reinforcement}`);
        for (const kind of reinforcement ? result.kinds.slice(0, 2) : result.kinds) this.spawnEnemy(kind, room, rng);
    }
    get heatPower() { return this.heat >= 70 ? 1.25 : this.heat < 25 ? .85 : 1; }
    get visionScale() { return (this.heat >= 70 ? 1.25 : this.heat < 25 ? .65 : 1) * (this.sneaking ? .8 : 1); }
    get healScale() { return this.curses.includes('hunger') ? .5 : 1; }
    get exitReady() { return this.enemies.length === 0 && Array.from(this.encounters.values()).every(e => e.complete); }
    free(x: number, y: number, r = 7) { return [-r, r].every(a => [-r, r].every(b => walk(this.d.grid, { x: Math.floor((x + a) / TILE), y: Math.floor((y + b) / TILE) }))); }
    move(object: { x: number; y: number }, dx: number, dy: number, radius = 7) { if (this.free(object.x + dx, object.y, radius)) object.x += dx; if (this.free(object.x, object.y + dy, radius)) object.y += dy; }
    heal() {
        if (this.encounters.get(this.room)?.trialAccepted) { this.fx(this.x, this.y, 'Trial: no flasks', 0x9974d8); return; }
        if (this.potions && this.hp < this.maxHP) { this.potions--; this.floorHeals++; const amount = Math.round(30 * this.healScale); this.hp = Math.min(this.maxHP, this.hp + amount); this.heat = Math.min(100, this.heat + 8); this.fx(this.x, this.y, `+${amount}`, 0x81e3bd); this.feedback.emit('heal', this.x, this.y); }
    }
    fx(x: number, y: number, text: string, color = 0xffc875) { this.effects.push({ x, y, text, color, life: .7 }); }
    noise(x: number, y: number, radius: number) { this.noises.push({ id: this.noiseSerial++, x, y, radius, life: 1.3 }); }
    hurt(amount: number) {
        if (this.invuln > 0 || this.status !== 'playing') return;
        this.hp -= amount * this.armor; this.invuln = .65; this.fx(this.x, this.y, `−${Math.ceil(amount * this.armor)}`, 0xff6666); this.feedback.emit('hurt', this.x, this.y);
        if (this.hp <= 0) {
            if (this.owned.includes('Last Ember') && this.heat >= 40 && !this.revived) { this.revived = true; this.heat -= 40; this.hp = 25; this.invuln = 2; this.fx(this.x, this.y, 'THE LAST EMBER', 0xffc16a); this.feedback.emit('revive', this.x, this.y); }
            else { this.hp = 0; this.status = 'dead'; this.deathReason ||= 'The keeper fell in battle.'; }
        }
    }
    hit(enemy: Enemy, damage: number, ignite = this.burning) { enemy.hp -= damage * ((enemy.buff ?? 0) > 0 ? .8 : 1); this.fx(enemy.x, enemy.y, `${Math.round(damage)}`); this.feedback.emit('impact', enemy.x, enemy.y); if (ignite) enemy.burn = 3; }
    fire(x: number, y: number, angle: number, hostile = false, damage = this.damage, options: Partial<Bullet> = {}) {
        this.bullets.push({ x, y, vx: Math.cos(angle) * (hostile ? 160 : 350), vy: Math.sin(angle) * (hostile ? 160 : 350), life: hostile ? 4 : 1.2 * this.range, damage, hostile, bounces: hostile ? 0 : this.ricochet, pierce: hostile ? 0 : this.piercing, hits: [], burn: !hostile && this.burning, ...options });
    }
    selectWeapon(index: number) { if (index >= 0 && index < weapons.length && this.status === 'playing' && index !== this.weapon) { this.weapon = index; this.charge = 0; this.feedback.emit('charge-stop', this.x, this.y); this.feedback.emit('switch', this.x, this.y); } }
    cancelCharge() { if (this.charge > 0) { this.charge = 0; this.feedback.emit('charge-stop', this.x, this.y); } }
    private attack(angle: number, alternate: boolean, charge = 0) {
        const w = weapons[this.weapon];
        if (alternate) { if (this.alternateCD > 0 || this.heat < w.heat) return; this.heat -= w.heat; this.alternateCD = 1.1; }
        else { if (this.shot > 0) return; this.heat = Math.max(0, this.heat - .8); }
        this.shot = 1 / (this.rate * w.rate);
        this.feedback.emit('charge-stop', this.x, this.y);
        this.feedback.emit('attack', this.x, this.y, { weapon: this.weapon, special: alternate });
        this.charge = 0;
        const damage = this.damage * w.damage * this.heatPower;
        this.noise(this.x, this.y, (this.owned.includes('Quiet Wick') ? 5.2 : 8) * (this.curses.includes('thunder') ? 2 : 1));
        if (this.weapon === 3) {
            const targets = this.enemies.filter(e => Math.hypot(e.x - this.x, e.y - this.y) <= TILE * (alternate ? 6 : 4) && los(this.d.grid, { x: this.x / TILE, y: this.y / TILE }, { x: e.x / TILE, y: e.y / TILE }));
            let px = this.x, py = this.y;
            for (const enemy of targets.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y)).slice(0, alternate ? 5 : 8)) {
                const delta = Math.atan2(Math.sin(Math.atan2(enemy.y - this.y, enemy.x - this.x) - angle), Math.cos(Math.atan2(enemy.y - this.y, enemy.x - this.x) - angle));
                if (!alternate && Math.abs(delta) > .8) continue;
                if (!los(this.d.grid, { x: px / TILE, y: py / TILE }, { x: enemy.x / TILE, y: enemy.y / TILE })) continue;
                this.hit(enemy, damage * (alternate ? 1.5 : 1)); this.effects.push({ x: px, y: py, x2: enemy.x, y2: enemy.y, kind: 'arc', color: alternate ? 0x54d6da : 0xffad61, life: .2, text: '' }); px = enemy.x; py = enemy.y;
            }
            this.effects.push({ x: this.x, y: this.y, angle, radius: TILE * 4, kind: 'arc', color: 0xffad61, life: .2, text: '' }); return;
        }
        const count = this.weapon === 1 ? (alternate ? 10 : 5 + this.split - 1) : this.weapon === 0 ? (alternate ? 7 : this.split) : this.split;
        for (let i = 0; i < count; i++) {
            const spread = this.weapon === 1 ? alternate ? (i / count) * Math.PI * 2 : (i - (count - 1) / 2) * .13 : (i - (count - 1) / 2) * (alternate ? .14 : .1);
            const lance = this.weapon === 2, focused = this.owned.includes('Searing Focus') ? 1.35 : 1;
            this.fire(this.x, this.y, angle + spread, false, damage * (lance ? (.6 + Math.min(1.2, charge)) * focused * (alternate ? 1.5 : 1) : alternate ? 1.1 : 1), { life: 1.2 * this.range * w.range, pierce: this.piercing + (lance ? alternate ? 8 : 2 : 0), vx: Math.cos(angle + spread) * (lance ? 460 : 350), vy: Math.sin(angle + spread) * (lance ? 460 : 350) });
        }
    }
    private rebuildStats() {
        const n = (i: number) => this.owned.filter(name => name === upgrades[i][1]).length;
        this.maxHP = Math.round((100 + n(0) * 20) * (this.curses.includes('frailty') ? .65 : 1)); this.hp = Math.min(this.hp, this.maxHP);
        this.speed = Math.min(285, 180 * 1.15 ** n(1)); this.damage = 15 * 1.2 ** n(2) * (1 + this.forge * .15) * (this.curses.includes('hunger') ? 2 : 1) * (this.curses.includes('frailty') ? 1.7 : 1);
        this.rate = Math.min(7, 2 * 1.15 ** n(3)); this.armor = Math.max(.4, .9 ** n(4)); this.split = Math.min(5, 1 + n(5)); this.range = Math.min(3, 1.2 ** n(7)); this.dashCD = Math.max(.6, 3 * .8 ** n(8) * (this.curses.includes('thunder') ? .5 : 1));
        this.burning = n(9) > 0; this.ricochet = Math.min(3, n(10)); this.piercing = Math.min(5, n(13));
    }
    rollUpgrades(epic = false) {
        const pool = upgrades.map((_, i) => i).filter(i => ![9, 11, 12, 14, 15, 16, 17].includes(i) || !this.owned.includes(upgrades[i][1])); this.picks = [];
        while (this.picks.length < 3 && pool.length) {
            const weights = pool.map(i => ({ Common: 1, Rare: .7, Epic: epic ? .8 : .35, Legendary: epic ? .5 : .15 }[upgradeRarity[i]] ?? 1)), total = weights.reduce((a, b) => a + b, 0);
            let roll = this.rng.next() * total, chosen = 0; for (; chosen < weights.length - 1; chosen++) { roll -= weights[chosen]; if (roll <= 0) break; }
            this.picks.push(pool.splice(chosen, 1)[0]);
        }
        this.status = 'upgrade';
    }
    choose(index: number) {
        if (this.status !== 'upgrade' || !this.picks.includes(index)) return;
        this.owned.push(upgrades[index][1]); this.rebuildStats();
        if (index === 0 || index === 6) this.hp = Math.min(this.maxHP, this.hp + Math.round((index === 0 ? 20 : 30) * this.healScale));
        if (index === 0 || index === 6) this.feedback.emit('heal', this.x, this.y);
        this.status = this.upgradeReturn; this.upgradeReturn = 'playing'; this.picks = [];
    }
    interact() {
        if (this.status !== 'playing') return;
        const object = this.objects.filter(o => !o.used && ['altar', 'choice', 'tactics', 'pillar', 'gate'].includes(o.kind)).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
        if (object && Math.hypot(object.x - this.x, object.y - this.y) < TILE * 1.7) {
            if (object.kind === 'pillar') { this.hitObject(object, 20); return; }
            if (object.kind === 'gate') { if (object.active < 2) { this.fx(this.x, this.y, 'Defeat the ambush first'); return; } const exit = center(this.d.rooms.at(-1)!); this.x = (exit.x + .5) * TILE; this.y = (exit.y + .5) * TILE; this.invuln = 1; return; }
            if (object.kind === 'tactics') { object.used = true; this.board = Array(9).fill(0); this.duelResult = null; this.duelPaid = false; this.duelStats = { nodes: 0, cutoffs: 0 }; this.status = 'duel'; return; }
            this.event = object.kind === 'altar' ? { kind: 'altar', room: object.room, title: 'A covenant in the ash', description: 'An ancient flame offers power with a permanent price. Choose one bargain, or leave.', options: [
                { id: 'hunger', title: 'Hungry Flame', detail: 'Double damage. All healing is halved.', enabled: !this.curses.includes('hunger') }, { id: 'thunder', title: 'Thunderstep', detail: 'Dash cooldown is halved. Your actions make twice the noise.', enabled: !this.curses.includes('thunder') }, { id: 'frailty', title: 'Glass Covenant', detail: '+70% damage. Maximum HP reduced by 35%.', enabled: !this.curses.includes('frailty') }, { id: 'kindle', title: 'Kindle the altar', detail: 'Spend 20 heat for an improved blessing selection.', enabled: this.heat >= 20 }, { id: 'leave', title: 'Leave the flame', detail: 'Keep your current strength.' },
            ] } : { kind: 'choice', room: object.room, title: 'Three paths through the dark', description: 'Choose what this chamber will become. Each gift can be taken only once.', options: [
                { id: 'rest', title: 'A quiet spring', detail: 'Restore 35 HP and receive one flask.' }, { id: 'cache', title: 'A buried cache', detail: 'Take 55 coins and 20 heat.' }, { id: 'shortcut', title: 'A dangerous shortcut', detail: 'Defeat an extra ambush to activate a gate to the floor exit.' },
            ] }; this.status = 'event'; return;
        }
        const exit = center(this.d.rooms.at(-1)!);
        if (Math.hypot(this.x / TILE - exit.x - .5, this.y / TILE - exit.y - .5) >= 2) return;
        if (!this.exitReady) { this.fx(this.x, this.y, 'Clear the required encounters'); return; }
        this.finishContract();
        if (this.floor === 5) this.status = 'victory'; else this.status = 'camp';
    }
    selectEvent(id: string) {
        if (this.status !== 'event' || !this.event) return;
        const event = this.event, option = event.options.find(o => o.id === id); if (!option || option.enabled === false) return;
        const object = this.objects.find(o => o.room === event.room && (o.kind === 'altar' || o.kind === 'choice')); if (object) object.used = true;
        if (event.kind === 'altar' && id === 'kindle') { this.heat -= 20; this.event = undefined; this.upgradeReturn = 'playing'; this.rollUpgrades(true); return; }
        if (event.kind === 'altar' && id !== 'leave') { this.curses.push(id); this.rebuildStats(); this.heat = Math.min(100, this.heat + 20); }
        if (event.kind === 'trial') { const e = this.encounters.get(event.room); if (e) e.trialAccepted = id === 'accept'; }
        if (event.kind === 'choice') {
            if (id === 'rest') { this.hp = Math.min(this.maxHP, this.hp + 35 * this.healScale); this.potions++; }
            if (id === 'cache') { this.coins += 55; this.heat = Math.min(100, this.heat + 20); }
            if (id === 'shortcut' && object) { object.kind = 'gate'; object.used = false; object.active = 1; this.encounters.set(event.room, { room: event.room, type: 'combat', started: true, time: 0, complete: false, reinforced: true, trialAccepted: false }); this.spawnWave(event.room, false); }
        }
        this.event = undefined; this.status = 'playing';
    }
    campAction(action: string) {
        if (this.status !== 'camp') return false;
        if (action === 'forge' && this.coins >= 30 + this.forge * 15 && this.forge < 5) { this.coins -= 30 + this.forge * 15; this.forge++; this.rebuildStats(); return true; }
        if (action === 'potion' && this.coins >= 18 && this.potions < 8) { this.coins -= 18; this.potions++; return true; }
        if (action === 'trade' && this.coins >= 20 && this.owned.length) { this.coins -= 20; this.owned.pop(); this.rebuildStats(); this.upgradeReturn = 'camp'; this.rollUpgrades(true); return true; }
        if ((action === 'hunt' || action === 'restraint') && !this.quest) { this.quest = { kind: action, floor: this.floor + 1, target: action === 'hunt' ? 8 : 0, reward: action === 'hunt' ? 50 : 70, completed: false }; return true; }
        if (action === 'descend') { this.floor++; this.potions++; this.hp = Math.min(this.maxHP, this.hp + 20 * this.healScale); this.heat = Math.min(100, this.heat + 15); this.loadFloor(); return true; }
        return false;
    }
    get campLore() { return floorLore[this.floor - 1]; }
    private finishContract() { if (!this.quest || this.quest.floor !== this.floor) return; const success = this.quest.kind === 'hunt' ? this.floorKills >= this.quest.target : this.floorHeals === 0; if (success) { this.coins += this.quest.reward; this.score += this.quest.reward * 2; } this.quest = undefined; }
    duelMove(index: number) {
        if (this.status !== 'duel' || this.duelResult !== null || index < 0 || index > 8 || this.board[index]) return;
        this.board[index] = 1; this.duelResult = boardWinner(this.board);
        if (this.duelResult === null) { const choice = minimaxMove(this.board); this.duelStats = { nodes: choice.nodes, cutoffs: choice.cutoffs }; this.board[choice.move] = -1; this.duelResult = boardWinner(this.board); }
        if (this.duelResult !== null && !this.duelPaid) { this.duelPaid = true; if (this.duelResult === 0 || this.duelResult === 1) { this.coins += this.duelResult === 1 ? 60 : 25; this.heat = Math.min(100, this.heat + 15); this.score += 100; } else this.heat = Math.max(0, this.heat - 10); }
    }
    closeDuel() { if (this.status === 'duel') this.status = 'playing'; }
    hitObject(object: WorldObject, damage: number) {
        if (object.used && object.kind !== 'gate') return;
        if (object.kind === 'oil') { if (object.active <= 0) this.feedback.emit('ignite', object.x, object.y); object.active = 7; this.costTimer = 0; return; }
        if (object.kind === 'trap') { if (object.cooldown <= 0) { object.active = 1.1; object.cooldown = 4; this.feedback.emit('trap-arm', object.x, object.y); } return; }
        if (!['pot', 'pillar', 'secret'].includes(object.kind)) return;
        object.hp -= damage; if (object.hp > 0) return; object.used = true;
        this.feedback.emit(object.kind === 'pot' ? 'pot-break' : object.kind === 'pillar' ? 'pillar-break' : 'secret', object.x, object.y);
        this.fx(object.x, object.y, object.kind === 'secret' ? 'SECRET UNCOVERED' : '✦'); this.noise(object.x, object.y, 6);
        if (object.kind === 'pot') { this.coins += this.rng.int(3, 9); if (this.rng.next() < .2 && this.potions < 8) { this.potions++; this.fx(object.x, object.y, '+1 FLASK', 0x54d6da); } }
        if (object.kind === 'secret') { this.coins += 65; this.heat = Math.min(100, this.heat + 25); this.upgradeReturn = 'playing'; this.rollUpgrades(true); }
        if (object.kind === 'pillar') {
            const x = Math.floor(object.x / TILE), y = Math.floor(object.y / TILE); if (object.solid) this.d.grid[y][x] = 1;
            const candidates = [{ x: x - 1, y }, { x, y: y + 1 }], fall = candidates.find(p => !this.enemies.some(e => Math.floor(e.x / TILE) === p.x && Math.floor(e.y / TILE) === p.y) && canBlockCell(this.d, p, { x: this.x / TILE, y: this.y / TILE }));
            if (fall) { this.d.grid[fall.y][fall.x] = 0; object.x = (fall.x + .5) * TILE; object.y = (fall.y + .5) * TILE; }
            object.kind = 'rubble'; object.solid = Boolean(fall); this.mapRevision++; this.costTimer = 0;
        }
    }
    private visitRoom() {
        const pos = { x: this.x / TILE, y: this.y / TILE };
        this.room = this.d.rooms.findIndex(r => pos.x >= r.x && pos.x < r.x + r.w && pos.y >= r.y && pos.y < r.y + r.h);
        if (this.room < 0) return;
        const fresh = !this.visited.includes(this.room); if (fresh) this.visited.push(this.room);
        const room = this.d.rooms[this.room], encounter = this.encounters.get(this.room);
        if (fresh && room.type === 'healing') { this.potions++; this.heat = Math.min(100, this.heat + 20); this.fx(this.x, this.y, 'SHRINE · +1 FLASK', 0x54d6da); }
        if (fresh && room.type === 'treasure') { this.score += 100; this.coins += 30; this.hp = Math.min(this.maxHP, this.hp + 15 * this.healScale); this.fx(this.x, this.y, 'CACHE · +30 COINS'); }
        if (encounter && !encounter.started) {
            encounter.started = true;
            if (encounter.type === 'trial') { this.status = 'event'; this.event = { kind: 'trial', room: this.room, title: 'The chamber of restraint', description: 'An optional oath changes this encounter. Defeat its foes while refusing healing flasks.', options: [{ id: 'accept', title: 'Accept the oath', detail: 'No flasks in this room. Gain 40 coins and a better blessing selection.' }, { id: 'decline', title: 'Fight without the oath', detail: 'A normal encounter and normal reward.' }] }; }
        }
    }
    update(dt: number, input: GameInput) {
        if (this.status !== 'playing') return;
        const previousBurst = this.burst;
        this.elapsed += dt; this.invuln = Math.max(0, this.invuln - dt); this.shot -= dt; this.dash -= dt; this.burst -= dt; this.alternateCD -= dt; this.costTimer -= dt; this.trailTimer -= dt; this.stepTimer -= dt;
        if (previousBurst > 0 && this.burst <= 0) this.feedback.emit('dash-end', this.x, this.y, { dx: this.dx, dy: this.dy });
        this.sneaking = Boolean(input.sneak); const len = Math.hypot(input.x, input.y);
        if (len && this.burst <= 0) { this.dx = input.x / len; this.dy = input.y / len; }
        if (input.dash && this.dash <= 0) { this.dash = this.dashCD; this.burst = .16; this.invuln = .2; this.noise(this.x, this.y, this.curses.includes('thunder') ? 9 : 4); this.feedback.emit('dash-start', this.x, this.y, { dx: this.dx, dy: this.dy }); }
        const speed = this.speed * (this.burst > 0 ? 3 : this.sneaking ? .6 : 1);
        const beforeMove = { x: this.x, y: this.y };
        this.move(this, (this.burst > 0 ? this.dx : input.x / (len || 1)) * speed * dt, (this.burst > 0 ? this.dy : input.y / (len || 1)) * speed * dt);
        if (this.burst <= 0) { this.footDistance += Math.hypot(this.x - beforeMove.x, this.y - beforeMove.y); if (this.footDistance >= 38) { this.footDistance %= 38; this.feedback.emit('step', this.x, this.y, { special: this.sneaking }); } }
        if (len && !this.sneaking && this.stepTimer <= 0) { this.stepTimer = .4; this.noise(this.x, this.y, 1.6); }
        if (this.burst > 0 && this.owned.includes('Cinderwake') && this.trailTimer <= 0) { this.trailTimer = .06; this.objects.push({ id: this.objectSerial++, kind: 'fire', x: this.x, y: this.y, room: this.room, hp: 1, active: 2, cooldown: 0, used: false }); this.costTimer = 0; }
        if (input.alternate) this.attack(input.angle, true, 1.2);
        else if (this.weapon === 2) {
            if (input.shoot && this.shot <= 0) {
                if (this.charge === 0) this.feedback.emit('charge-start', this.x, this.y);
                const previousCharge = this.charge; this.charge += dt;
                if (previousCharge < .9 && this.charge >= .9) this.feedback.emit('charge-ready', this.x, this.y);
                if (this.charge >= 1.2) { this.attack(input.angle, false, this.charge); this.charge = 0; }
            } else if (!input.shoot && this.charge > .12) { this.attack(input.angle, false, this.charge); this.charge = 0; }
            else if (!input.shoot && this.charge > 0) { this.charge = 0; this.feedback.emit('charge-stop', this.x, this.y); }
        }
        else if (input.shoot && this.shot <= 0) this.attack(input.angle, false);
        if (!input.shoot && !input.alternate) this.heat = this.heat > 45 ? Math.max(45, this.heat - dt * .35) : Math.min(45, this.heat + dt * .5);
        for (let y = Math.floor(this.y / TILE) - 5; y <= this.y / TILE + 5; y++) for (let x = Math.floor(this.x / TILE) - 5; x <= this.x / TILE + 5; x++) { const k = `${x},${y}`; if (walk(this.d.grid, { x, y }) && !this.revealed.includes(k)) this.revealed.push(k); }
        this.visitRoom(); if (this.status !== 'playing') return;
        this.environmentTick(dt);
        if (this.status !== 'playing') return;
        if (this.costTimer <= 0) { this.costTimer = .6; this.costs = hazardCosts(this.d.grid, this.objects, this.encounters, this.d); }
        for (const enemy of this.enemies) this.enemyTick(enemy, dt);
        this.projectileTick(dt); this.resolveDefeats();
        this.bullets = this.bullets.filter(b => b.life > 0); this.effects.forEach(e => { e.life -= dt; if (!e.kind) e.y -= dt * 20; }); this.effects = this.effects.filter(e => e.life > 0);
        this.noises.forEach(n => n.life -= dt); this.noises = this.noises.filter(n => n.life > 0);
        this.objects = this.objects.filter(o => o.kind !== 'fire' || o.active > 0);
        this.checkRewards();
    }
    private environmentTick(dt: number) {
        for (const encounter of this.encounters.values()) if (encounter.started && !encounter.complete) {
            encounter.time += dt;
            if (encounter.type === 'defense' && encounter.time > 6 && !encounter.reinforced) { encounter.reinforced = true; this.spawnWave(encounter.room, true); this.fx(this.x, this.y, 'REINFORCEMENTS'); }
            if (encounter.type === 'collapse' && encounter.time > 7 && this.room === encounter.room) {
                const r = this.d.rooms[encounter.room], inset = Math.min(3, Math.floor((encounter.time - 7) / 5) + 1), x = this.x / TILE, y = this.y / TILE;
                if (x < r.x + inset || x >= r.x + r.w - inset || y < r.y + inset || y >= r.y + r.h - inset) this.hurt(8);
            }
        }
        for (const o of this.objects) {
            o.cooldown = Math.max(0, o.cooldown - dt);
            if (o.kind === 'trap' && o.cooldown <= 0 && (Math.hypot(this.x - o.x, this.y - o.y) < 13 || this.enemies.some(e => Math.hypot(e.x - o.x, e.y - o.y) < 13))) this.hitObject(o, 0);
            if (o.active > 0 && ['fire', 'oil', 'trap'].includes(o.kind)) {
                const wasActive = o.active;
                o.active -= dt;
                if (o.kind === 'trap' && wasActive > .5 && o.active <= .5) this.feedback.emit('trap-fire', o.x, o.y);
                if (o.kind === 'trap' && o.active > .5) continue;
                const radius = o.kind === 'trap' ? 20 : o.kind === 'oil' ? 28 : 13;
                if (o.kind !== 'fire' && Math.hypot(this.x - o.x, this.y - o.y) < radius) this.hurt(o.kind === 'trap' ? 15 : 7);
                for (const e of this.enemies) if (Math.hypot(e.x - o.x, e.y - o.y) < radius) { e.hp -= (o.kind === 'trap' ? 34 : 15) * dt; e.burn = Math.max(e.burn, .5); }
                if (o.kind === 'oil') for (const other of this.objects) if (other.kind === 'oil' && other.active <= 0 && Math.hypot(other.x - o.x, other.y - o.y) < 45) this.hitObject(other, 0);
            }
        }
    }
    private enemyTick(e: Enemy, dt: number) {
        if (e.hp <= 0) return;
        if (e.burn > 0) { e.burn -= dt; e.hp -= 9 * dt; }
        e.buff = Math.max(0, (e.buff ?? 0) - dt); e.healCooldown = Math.max(0, (e.healCooldown ?? 0) - dt);
        const pos = { x: e.x / TILE, y: e.y / TILE }, player = { x: this.x / TILE, y: this.y / TILE };
        e.ai.observe(this.d.grid, pos, player, dt, this.visionScale);
        let mind = this.minds.get(e.id); if (!mind || mind.belief.grid !== this.d.grid) { mind = new EnemyMind(this.d.grid, pos); this.minds.set(e.id, mind); }
        const injured = this.enemies.filter(a => a.id !== e.id && Math.hypot(a.x - e.x, a.y - e.y) < 8 * TILE && (a.hp < a.max * .7 || e.kind === 1 && a.kind === 2)).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        const shrineRoom = this.d.rooms.find(r => r.type === 'healing'), shrine = shrineRoom ? center(shrineRoom) : undefined;
        const ward = this.objects.find(o => o.kind === 'ward' && o.room === e.room && this.encounters.get(o.room)?.started && !this.encounters.get(o.room)?.complete);
        const choice = mind.update(e, { grid: this.d.grid, player, noises: this.noises, shrine: e.healCooldown <= 0 ? shrine : undefined, ally: injured, ward: ward ? { x: ward.x / TILE, y: ward.y / TILE } : undefined, time: this.elapsed, visionScale: this.visionScale }, dt);
        if (e.kind === 4) {
            e.phase = e.hp < e.max * .5 ? 2 : 1;
            const decision = decideBoss({ visible: e.ai.visible, windup: e.telegraph, cooldown: e.ai.cooldown, dt, phase: e.phase, command: 'WAIT' });
            this.bossTrace = decision.trace; e.telegraph = decision.context.windup; e.ai.cooldown = decision.context.cooldown;
            if (decision.context.command === 'WARN') this.feedback.emit('boss-warn', e.x, e.y);
            if (decision.context.command === 'WARN' || decision.context.command === 'WAIT') return;
            if (decision.context.command === 'RELEASE') { this.feedback.emit('boss-release', e.x, e.y); for (let a = 0; a < Math.PI * 2; a += Math.PI / (e.phase === 2 ? 8 : 5)) this.fire(e.x, e.y, a, true, 14 + this.floor); if (e.ai.distance < 3) this.hurt(25); return; }
        }
        const plannedAction = mind.plan.actions[0]?.name;
        if (choice.action === 'HEAL' && plannedAction === 'Restore health' && shrine && Math.hypot(pos.x - shrine.x, pos.y - shrine.y) < 1.3 && e.healCooldown <= 0) { e.hp = Math.min(e.max, e.hp + e.max * .35); e.healCooldown = 12; mind.decisionTimer = 0; this.fx(e.x, e.y, '+', 0x54d6da); }
        if (choice.action === 'ASSIST' && plannedAction === 'Bless ally' && injured && Math.hypot(injured.x - e.x, injured.y - e.y) < 3 * TILE && e.ai.cooldown <= 0) { injured.hp = Math.min(injured.max, injured.hp + 12); injured.buff = 5; e.ai.cooldown = 2.5; mind.decisionTimer = 0; this.effects.push({ x: e.x, y: e.y, x2: injured.x, y2: injured.y, kind: 'arc', color: 0x54d6da, life: .3, text: '' }); }
        if (choice.action === 'RAID WARD' && ward && Math.hypot(ward.x - e.x, ward.y - e.y) < 1.5 * TILE && e.ai.cooldown <= 0) { ward.hp -= 8 + this.floor; e.ai.cooldown = 1.3; this.fx(ward.x, ward.y, 'WARD', 0xd94b53); if (ward.hp <= 0) { this.deathReason = 'The ember ward was shattered.'; this.hp = 0; this.status = 'dead'; } }
        if (e.ai.state === 'ATTACK' && plannedAction === 'Take aim' && e.ai.cooldown <= 0) { mind.aimed = true; mind.decisionTimer = 0; e.ai.cooldown = .18; }
        if (e.ai.state === 'ATTACK' && plannedAction === 'Fire from cover' && choice.action !== 'RETREAT' && choice.action !== 'HEAL' && choice.action !== 'ASSIST' && e.ai.cooldown <= 0) {
            e.ai.cooldown = e.kind === 2 ? 1.7 : 1.1;
            mind.aimed = false; mind.decisionTimer = 0;
            if (e.kind === 1 || e.kind === 5) this.fire(e.x, e.y, Math.atan2(this.y - e.y, this.x - e.x), true, 8 + this.floor * 2);
            else this.hurt((e.kind === 2 ? 20 : 9) + this.floor * 2);
        }
        if (e.ai.state === 'PATROL' && Math.hypot(pos.x - e.patrol.x, pos.y - e.patrol.y) < .7) { const r = this.d.rooms[e.room]; e.patrol = { x: r.x + 1 + ((e.id + Math.floor(this.elapsed / 4)) % (r.w - 2)), y: r.y + 1 + ((e.id * 3 + Math.floor(this.elapsed / 3)) % (r.h - 2)) }; mind.decisionTimer = 0; }
        if (e.ai.state !== 'ALERT' && (e.ai.state !== 'ATTACK' || ['RETREAT', 'HEAL', 'ASSIST'].includes(choice.action))) {
            const target = choice.action === 'PATROL' ? e.patrol : mind.target, path = e.ai.route(this.d.grid, pos, target, this.costs), p = path[0];
            if (p) { const dx = (p.x + .5) * TILE - e.x, dy = (p.y + .5) * TILE - e.y, d = Math.hypot(dx, dy), speed = [60, 48, 36, 100, 40, 50][e.kind] * (1 + this.floor * .035) * (e.buff > 0 ? 1.15 : 1); if (d < 3) path.shift(); else { e.ai.facing = Math.atan2(dy, dx); this.move(e, dx / d * Math.min(d, speed * dt), dy / d * Math.min(d, speed * dt)); } }
        }
        const distance = Math.hypot(e.x - this.x, e.y - this.y); if (distance > 0 && distance < 15 && this.burst <= 0) this.move(this, (this.x - e.x) / distance * 45 * dt, (this.y - e.y) / distance * 45 * dt);
    }
    private projectileTick(dt: number) {
        for (const bullet of this.bullets) {
            const steps = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 4));
            for (let i = 0; i < steps && bullet.life > 0; i++) {
                const px = bullet.x, py = bullet.y; bullet.x += bullet.vx * dt / steps; bullet.y += bullet.vy * dt / steps;
                if (!bullet.hostile) {
                    const object = this.objects.find(o => !o.used && ['pot', 'pillar', 'oil', 'trap', 'secret'].includes(o.kind) && Math.hypot(bullet.x - o.x, bullet.y - o.y) < (o.kind === 'oil' ? 23 : 11));
                    if (object) { this.hitObject(object, bullet.damage); if (['pot', 'pillar', 'secret', 'rubble'].includes(object.kind)) { bullet.life = 0; break; } }
                }
                if (!this.free(bullet.x, bullet.y, 1)) {
                    if (!bullet.hostile && (bullet.bounces ?? 0) > 0) { const hitX = !this.free(bullet.x, py, 1), hitY = !this.free(px, bullet.y, 1); if (hitX) bullet.vx *= -1; if (hitY || !hitX) bullet.vy *= -1; bullet.x = px; bullet.y = py; bullet.bounces!--; this.feedback.emit('ricochet', px, py); } else bullet.life = 0;
                    continue;
                }
                if (bullet.hostile) { if (Math.hypot(bullet.x - this.x, bullet.y - this.y) < 10) { this.hurt(bullet.damage); bullet.life = 0; } }
                else {
                    const enemy = this.enemies.find(e => e.hp > 0 && !(bullet.hits ?? []).includes(e.id) && Math.hypot(bullet.x - e.x, bullet.y - e.y) < (e.kind === 4 ? 17 : 11));
                    if (enemy) { this.hit(enemy, bullet.damage, Boolean(bullet.burn)); (bullet.hits ??= []).push(enemy.id); if ((bullet.pierce ?? 0) > 0) bullet.pierce!--; else bullet.life = 0; }
                }
            }
            bullet.life -= dt;
        }
    }
    private resolveDefeats() {
        const processed = new Set<number>();
        for (let chain = 0; chain < 12; chain++) {
            const dead = this.enemies.filter(e => e.hp <= 0 && !processed.has(e.id)); if (!dead.length) break;
            for (const enemy of dead) { processed.add(enemy.id); this.feedback.emit('defeat', enemy.x, enemy.y); this.score += enemy.kind === 4 ? 1000 : 50; this.kills++; this.floorKills++; this.coins += enemy.kind === 4 ? 100 : 7; this.heat = Math.min(100, this.heat + (this.owned.includes('Warmth Siphon') ? 13 : 8)); if (this.owned.includes('Warmth Siphon')) this.hp = Math.min(this.maxHP, this.hp + 2 * this.healScale); this.fx(enemy.x, enemy.y, '✦', 0xff9b38);
                if (enemy.burn > 0 && this.owned.includes('Ash Cascade')) { this.effects.push({ x: enemy.x, y: enemy.y, radius: 65, kind: 'blast', text: '', color: 0xff8b43, life: .4 }); for (const other of this.enemies) if (other.id !== enemy.id && other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 65 && los(this.d.grid, { x: enemy.x / TILE, y: enemy.y / TILE }, { x: other.x / TILE, y: other.y / TILE })) this.hit(other, this.damage * 1.5, true); }
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }
    private checkRewards() {
        if (this.status !== 'playing') return;
        for (const room of this.visited) {
            const encounter = this.encounters.get(room), required = this.d.spawns.some(s => s.room === room);
            if (!required || this.cleared.includes(room) || this.enemies.some(e => e.room === room)) continue;
            if (encounter?.type === 'defense' && encounter.time < 15) continue;
            if (encounter?.type === 'collapse' && this.room === room) { if (!encounter.escapeHint) { this.fx(this.x, this.y, 'ESCAPE THE COLLAPSE'); encounter.escapeHint = true; } continue; }
            this.cleared.push(room); if (encounter) { encounter.complete = true; if (encounter.trialAccepted) this.coins += 40; }
            const gate = this.objects.find(o => o.room === room && o.kind === 'gate'); if (gate) gate.active = 2;
            this.upgradeReturn = 'playing'; this.rollUpgrades(Boolean(encounter?.trialAccepted)); break;
        }
    }
    save() {
        const keys = ['seed', 'floor', 'hp', 'maxHP', 'speed', 'damage', 'rate', 'armor', 'split', 'range', 'dashCD', 'burning', 'potions', 'score', 'kills', 'elapsed', 'owned', 'heat', 'coins', 'weapon', 'forge', 'ricochet', 'piercing', 'curses', 'quest'] as const;
        return JSON.stringify(Object.fromEntries(keys.map(k => [k, this[k]])));
    }
    static restore(serialized: string) {
        const data = JSON.parse(serialized), run = new Run(String(data.seed));
        for (const key of [...Object.keys(JSON.parse(run.save())), 'quest']) if (data[key] !== undefined) (run as unknown as Record<string, unknown>)[key] = data[key];
        run.floor = Math.max(1, Math.min(5, Math.floor(Number(run.floor) || 1))); run.weapon = Math.max(0, Math.min(3, Number(run.weapon) || 0)); run.heat = Math.max(0, Math.min(100, run.heat)); run.loadFloor(); return run;
    }
}
