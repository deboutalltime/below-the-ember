import Phaser from 'phaser';
import { Run, TILE, Enemy } from '../simulation';
import { center } from '../dungeon';
import { createPixelAssets } from './assets';
import { VIEW, floorThemes, hash, hex } from './theme';
import { DashVFX } from './DashVFX';
import { ActorMotion } from './ActorMotion';
import { FeedbackReader } from '../game/feedback';
import type { SoundName } from '../audio/synthesis';
import type { AudioCueOptions } from '../ui/audio';

export interface VisualOptions { effects: number; reducedMotion: boolean; shake: boolean }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number };
type Prop = { image: Phaser.GameObjects.Image; room: number; type: string; id: number; broken?: boolean };
const S = VIEW.worldScale;

/** Disposable view state. This class never writes to the simulation. */
export class WorldRenderer {
    private map: Phaser.GameObjects.RenderTexture;
    private backdrop: Phaser.GameObjects.Graphics;
    private light: Phaser.GameObjects.Graphics;
    private shadow: Phaser.GameObjects.Graphics;
    private fx: Phaser.GameObjects.Graphics;
    private player: Phaser.GameObjects.Image;
    private enemies = new Map<number, Phaser.GameObjects.Image>();
    private previous = new Map<number, { x: number; y: number; hp: number; state: string }>();
    private flashes = new Map<number, number>();
    private props: Prop[] = [];
    private textPool: Phaser.GameObjects.Text[] = [];
    private sparks: Spark[] = [];
    private seenBullets = new WeakSet<object>();
    private seenEffects = new WeakSet<object>();
    private floor = 0;
    private currentRun?: Run;
    private playerMotion = new ActorMotion();
    private enemyMotion = new Map<number, ActorMotion>();
    private revision = -1;
    private objectSprites = new Map<number, Phaser.GameObjects.Image>();
    private seed = '';
    private wasHP = 100;
    private healPulse = 0;
    private dashVFX: DashVFX;
    private feedback = new FeedbackReader();
    private attackPulse = 0;
    private impacts: { x: number; y: number; life: number }[] = [];
    private endState = '';
    private menuMode = false;
    private aim = 0;
    private textIndex = 0;
    constructor(private scene: Phaser.Scene, private options: () => VisualOptions, private cue: (type: SoundName | 'stop-charge', options?: AudioCueOptions) => void) {
        createPixelAssets(scene);
        this.dashVFX = new DashVFX(scene);
        this.map = scene.add.renderTexture(0, 0, 1024, 1024).setOrigin(0).setDepth(0);
        this.backdrop = scene.add.graphics().setDepth(0).setVisible(false);
        this.light = scene.add.graphics().setDepth(1);
        this.shadow = scene.add.graphics().setDepth(2);
        this.fx = scene.add.graphics().setDepth(2500);
        this.player = scene.add.image(0, 0, 'actor--1-0').setOrigin(.5, .9);
        for (let i = 0; i < 28; i++) this.textPool.push(scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '7px', color: '#eae3d5', stroke: '#0b0d12', strokeThickness: 2 }).setDepth(3000).setVisible(false));
    }
    build(run: Run) {
        const newWorld = this.currentRun !== run || this.floor !== run.floor || this.menuMode;
        this.currentRun = run;
        this.menuMode = false; this.floor = run.floor; this.seed = run.seed; this.revision = run.mapRevision;
        this.objectSprites.forEach(image => image.destroy()); this.objectSprites.clear();
        this.map.setVisible(true).clear(); this.backdrop.setVisible(false);
        this.props.forEach(p => p.image.destroy()); this.props = [];
        this.enemies.forEach(e => e.destroy()); this.enemies.clear(); this.previous.clear(); this.flashes.clear();
        if (newWorld) {
            this.seenBullets = new WeakSet(); this.seenEffects = new WeakSet(); this.sparks = [];
            this.dashVFX.reset(); this.attackPulse = 0; this.healPulse = 0; this.impacts = [];
            this.playerMotion.reset(run.x * S, run.y * S); this.enemyMotion.clear();
        }
        this.wasHP = run.hp; this.endState = ''; this.player.setVisible(true);
        const grid = run.d.grid, theme = floorThemes[run.floor - 1], f = run.floor - 1, t = VIEW.tile;
        for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid.length; x++) {
            if (grid[y][x]) { const n = hash(x, y); this.map.drawFrame(`floor-${f}-${n % 40 === 0 ? 7 : n % 7}`, undefined, x * t, y * t); }
        }
        const carving = this.scene.add.graphics();
        for (const [i, room] of run.d.rooms.entries()) {
            const c = center(room), cx = (c.x + .5) * t, cy = (c.y + .5) * t;
            carving.lineStyle(1, theme.symbol, .38);
            if (['combat', 'defense', 'collapse', 'trial', 'exit'].includes(room.type)) {
                const r = room.type === 'exit' && run.floor === 5 ? 37 : 21;
                carving.strokeCircle(cx, cy, r); carving.strokeCircle(cx, cy, r - 4);
                for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; carving.lineBetween(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); }
            }
            // Solid wall columns, never additional invisible collision geometry.
            for (const x of [room.x - 1, room.x + room.w]) if (!grid[room.y]?.[x]) {
                this.map.drawFrame('pillar', undefined, x * t - 4, room.y * t - 18);
            }
            // Low, walkable debris and masonry fragments.
            for (let j = 0; j < 5; j++) {
                const h = hash(i, j, run.floor), px = (room.x + 1 + h % (room.w - 2)) * t, py = (room.y + 1 + (h >>> 4) % (room.h - 2)) * t;
                carving.fillStyle(theme.edge, .3); carving.fillRect(px + 2, py + 4, 3, 2); carving.fillStyle(0x101722, .5); carving.fillRect(px + 1, py + 6, 5, 1);
            }
            if (run.floor === 4) { carving.fillStyle(0x5a4146, .6); carving.fillRect((room.x + 1) * t + 1, (room.y + 2) * t, 9, 18); carving.lineStyle(1, 0x8e6561, .5); carving.strokeRect((room.x + 1) * t + 2, (room.y + 2) * t + 2, 7, 13); }
            if (room.type === 'treasure' || room.type === 'healing') {
                const type = room.type === 'treasure' ? 'chest' : 'shrine';
                this.props.push({ image: this.scene.add.image(cx, cy + 4, type).setOrigin(.5, .85).setDepth(100 + cy), room: i, type, id: i });
            }
            if (run.floor === 3) this.props.push({ image: this.scene.add.image((room.x + room.w - 1) * t, (room.y + 2) * t, 'crystal').setOrigin(.5, 1).setDepth(100 + (room.y + 2) * t), room: i, type: 'crystal', id: i });
        }
        this.map.draw(carving); carving.destroy();
        for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid.length; x++) {
            if (!grid[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => grid[y + b]?.[x + a])) this.map.drawFrame(`wall-${f}-${hash(x, y) % 8}`, undefined, x * t, y * t - 8);
        }
        // Columns are painted after masonry so their carved caps stay visible.
        for (const room of run.d.rooms) for (const px of [room.x - 1, room.x + room.w]) {
            if (!grid[room.y]?.[px]) this.map.drawFrame('pillar', undefined, px * t - 4, room.y * t - 18);
            if (run.floor === 5 && !grid[room.y + room.h - 1]?.[px]) this.map.drawFrame('pillar', undefined, px * t - 4, (room.y + room.h - 1) * t - 18);
        }
        this.scene.cameras.main.setBounds(0, 0, grid.length * t, grid.length * t);
    }
    setAim(angle: number) { this.aim = angle; }
    private glow(x: number, y: number, radius: number, color: number, strength = 1) {
        if (this.options().effects <= 0) return;
        strength *= this.options().effects;
        this.light.fillStyle(color, .035 * strength); this.light.fillCircle(x, y, radius);
        this.light.fillStyle(color, .05 * strength); this.light.fillCircle(x, y, radius * .58);
        this.light.fillStyle(color, .07 * strength); this.light.fillCircle(x, y, radius * .27);
    }
    private burst(x: number, y: number, color: number, count = 9, speed = 28) {
        const amount = Math.ceil((this.options().reducedMotion ? Math.min(2, count) : count) * this.options().effects);
        for (let i = 0; i < amount; i++) { const a = i * 2.4 + x; const life = .2 + (i % 5) * .09; this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 10, life, max: life, color, size: i % 4 === 0 ? 2 : 1 }); }
        if (this.sparks.length > 180) this.sparks.splice(0, this.sparks.length - 180);
    }
    private label(x: number, y: number, text: string, color = '#ffc16a', alpha = 1) {
        const t = this.textPool[this.textIndex++]; if (!t) return;
        t.setPosition(Math.round(x), Math.round(y)).setText(text).setColor(color).setAlpha(alpha).setVisible(true);
    }
    render(run: Run, time: number, dt: number, _moving: boolean, debug: boolean, active = true) {
        if (this.floor !== run.floor || this.seed !== run.seed || this.menuMode || this.revision !== run.mapRevision) this.build(run);
        dt = active ? Math.min(.1, Math.max(0, dt)) : 0;
        this.playerMotion.update(run.x * S, run.y * S, dt, active, run.burst > 0, run.dx, this.options().reducedMotion);
        time = this.options().reducedMotion ? 0 : this.playerMotion.time;
        this.light.clear(); this.shadow.clear(); this.fx.clear(); this.textIndex = 0; this.textPool.forEach(t => t.setVisible(false));
        const theme = floorThemes[run.floor - 1], x = run.x * S, y = run.y * S;
        this.consumeFeedback(run);
        this.dashVFX.update(x, y, run.burst > 0, active ? dt : 0, this.options());
        this.attackPulse = Math.max(0, this.attackPulse - (active ? dt : 0));
        this.healPulse = Math.max(0, this.healPulse - (active ? dt : 0));
        if (run.hp > this.wasHP) { this.healPulse = .7; this.burst(x, y - 9, 0x54d6da, 12, 20); }
        this.wasHP = run.hp;
        for (const room of run.d.rooms) {
            const c = center(room), tx = (room.x + 1) * VIEW.tile, ty = (room.y + 1) * VIEW.tile;
            const flicker = this.options().reducedMotion ? 1 : .9 + Math.sin(time / 130 + room.x) * .1;
            this.glow(tx, ty, 40, theme.glow, flicker);
            this.fx.fillStyle(0x28212a); this.fx.fillRect(tx - 2, ty + 1, 4, 7);
            this.fx.fillStyle(0x8c6750); this.fx.fillRect(tx - 3, ty + 1, 6, 2);
            this.fx.fillStyle(theme.accent); this.fx.fillRect(tx - 2, ty - 4, 4, 5); this.fx.fillRect(tx - 1, ty - 7 - (Math.floor(time / 160) % 2), 2, 5);
            this.fx.fillStyle(0xffe3a6); this.fx.fillRect(tx - 1, ty - 2, 2, 3);
            if (room.type === 'exit') {
                const ex = (c.x + .5) * VIEW.tile, ey = (c.y + .5) * VIEW.tile, locked = !run.exitReady;
                this.glow(ex, ey, 40, locked ? 0x9974d8 : 0xffac50, locked ? .5 : 1.5);
                this.fx.lineStyle(1, locked ? 0x78677e : 0xffc16a); this.fx.strokeCircle(ex, ey, 13); this.fx.strokeCircle(ex, ey, 17);
                for (let j = 0; j < 4; j++) { this.fx.fillStyle(locked ? 0x69616f : 0xbe9865); this.fx.fillRect(ex - 8 + j, ey - 7 + j * 4, 16 - j * 2, 2); }
                if (locked) { this.fx.fillStyle(0xb49bc9); this.fx.fillRect(ex - 2, ey - 2, 5, 5); this.fx.lineStyle(1, 0xb49bc9); this.fx.strokeRect(ex - 1, ey - 5, 3, 4); }
                if (Math.hypot(x - ex, y - ey) < 32) this.label(ex - 33, ey + 25, locked ? 'SEALED / CLEAR FLOOR' : '[E] DESCEND', locked ? '#b8a5c8' : '#ffc16a');
            }
        }
        for (const prop of this.props) {
            if (prop.type === 'chest') prop.image.setTexture(run.visited.includes(prop.room) ? 'chest-open' : 'chest');
            if (prop.type === 'shrine') { prop.image.setTint(run.visited.includes(prop.room) ? 0x809b9c : 0xffffff); this.glow(prop.image.x, prop.image.y - 13, 28, 0x54d6da, .7); }
            if (prop.type === 'crystal') this.glow(prop.image.x, prop.image.y - 8, 23, 0x54d6da, .5);
            if (prop.type === 'pot' && !prop.broken && run.bullets.some(b => !b.hostile && Math.hypot(b.x * S - prop.image.x, b.y * S - prop.image.y + 5) < 6)) { prop.broken = true; prop.image.setVisible(false); this.burst(prop.image.x, prop.image.y - 4, 0xb38c64, 10, 25); this.cue('stone'); }
        }
        this.environment(run, time);
        const alive = new Set(run.enemies.map(e => e.id));
        for (const [id, sprite] of this.enemies) if (!alive.has(id)) {
            const old = this.previous.get(id); this.burst(sprite.x, sprite.y - 10, old?.hp && old.hp > 100 ? 0xffc16a : 0xb59b8c, 20, 36); sprite.destroy(); this.enemies.delete(id); this.previous.delete(id); this.enemyMotion.delete(id);
        }
        for (const enemy of run.enemies) this.enemy(enemy, time, dt, debug, run, active);
        const dashPose = run.burst > 0 && !this.options().reducedMotion;
        this.player.setPosition(Math.round(x), Math.round(y)).setTexture(`actor--1-${this.playerMotion.frame}`).setDepth(100 + y).setFlipX(dashPose ? run.dx < 0 : Math.cos(this.aim) < 0).setAlpha(run.status === 'dead' ? .6 : 1).setAngle(run.status === 'dead' ? 85 : this.playerMotion.angle).setScale(this.playerMotion.scaleX, this.playerMotion.scaleY);
        this.player.setTint(run.burst > 0 ? 0xffe4ad : run.invuln > .35 ? 0xffa6a0 : 0xffffff);
        if (run.status === 'dead') this.player.setPosition(x, y + 2);
        this.shadow.fillStyle(0x000000, .4); this.shadow.fillEllipse(x, y + 1, 17, 6);
        this.glow(x, y - 11, 10 + run.heat * .23, 0xff7733, .2 + run.heat / 140);
        if (run.charge > 0) {
            const charge = Math.min(1, run.charge / 1.2), radius = 11 + charge * 7;
            this.fx.lineStyle(1, 0x54d6da, .65); this.fx.strokeCircle(x, y - 9, radius);
            this.fx.lineStyle(2, 0xffd895, .9); this.fx.beginPath(); this.fx.arc(x, y - 9, radius + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge, false); this.fx.strokePath();
            if (!this.options().reducedMotion && this.options().effects > 0) for (let i = 0; i < 4; i++) {
                const angle = time / 170 + i * Math.PI / 2, r = radius + 6 - charge * 4;
                this.fx.fillStyle(i % 2 ? 0xffc16a : 0x8fe7e3, .85); this.fx.fillRect(Math.round(x + Math.cos(angle) * r) - 1, Math.round(y - 9 + Math.sin(angle) * r) - 1, 2, 2);
            }
            this.glow(x, y - 10, 20 + charge * 10, 0x54d6da, charge); this.label(x - 14, y - 36, `${Math.round(charge * 100)}%`);
        }
        if (run.invuln > 0) { this.fx.lineStyle(1, run.burst > 0 || run.dash > run.dashCD - .3 ? 0xffc16a : 0xd94b53, .7); this.fx.strokeCircle(x, y - 8, 12); }
        if (this.healPulse > 0) {
            const phase = 1 - this.healPulse / .7, radius = this.options().reducedMotion ? 14 : 11 + phase * 12;
            this.fx.lineStyle(1, 0x54d6da, this.healPulse); this.fx.strokeEllipse(x, y - 3, radius * 2, radius);
            if (!this.options().reducedMotion && this.options().effects > 0) for (let i = 0; i < 5; i++) {
                const angle = i * Math.PI * 2 / 5 + phase * 2, px = x + Math.cos(angle) * radius, py = y - 9 + Math.sin(angle) * radius * .6 - phase * 11;
                this.fx.lineStyle(1, 0xa6efda, this.healPulse); this.fx.lineBetween(px - 2, py, px + 2, py); this.fx.lineBetween(px, py - 2, px, py + 2);
            }
            this.label(x - 9, y - 36, 'HEAL', '#83e6d4');
        }
        if (run.status !== 'dead') {
            const recoil = run.shot > 1 / run.rate - .09 ? 2 : 0, ax = x + Math.cos(this.aim) * (12 - recoil), ay = y - 10 + Math.sin(this.aim) * (12 - recoil);
            this.fx.lineStyle(3, 0x161c27); this.fx.lineBetween(x, y - 10, ax, ay);
            this.fx.lineStyle(1, 0xa6a29a); this.fx.lineBetween(x + Math.cos(this.aim) * 6, y - 10 + Math.sin(this.aim) * 6, ax, ay);
            this.fx.fillStyle(0xffb161); this.fx.fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 2, 2);
            if (run.weapon === 1) { this.fx.lineStyle(2, 0xd9b17d); this.fx.lineBetween(ax - Math.sin(this.aim) * 2, ay + Math.cos(this.aim) * 2, ax + Math.cos(this.aim) * 5 - Math.sin(this.aim) * 2, ay + Math.sin(this.aim) * 5 + Math.cos(this.aim) * 2); }
            if (run.weapon === 2) { this.fx.lineStyle(2, 0x84cfd0); this.fx.lineBetween(ax, ay, ax + Math.cos(this.aim) * 10, ay + Math.sin(this.aim) * 10); }
            if (run.weapon === 3) { this.fx.lineStyle(1, 0xffa65d); this.fx.strokeCircle(ax, ay, 4); }
            if (this.attackPulse > 0 && this.options().effects > 0) {
                const length = (run.weapon === 1 ? 13 : run.weapon === 2 ? 20 : 11) * this.attackPulse / .12;
                const dx = Math.cos(this.aim), dy = Math.sin(this.aim), color = run.weapon === 2 ? 0x8fe7e3 : 0xffd698;
                this.fx.fillStyle(color, .8); this.fx.fillTriangle(ax - dy * 3, ay + dx * 3, ax + dx * length, ay + dy * length, ax + dy * 3, ay - dx * 3);
                this.glow(ax, ay, 20, color, .8);
            }
        }
        for (const b of run.bullets) {
            const bx = b.x * S, by = b.y * S - (b.hostile ? 0 : 7);
            if (!this.seenBullets.has(b)) { this.seenBullets.add(b); this.burst(bx, by, b.hostile ? 0xd97ba9 : 0xffb266, 3, 14); }
            this.fx.lineStyle(b.hostile ? 1 : 2, b.hostile ? 0xe88bb1 : 0xff8e43, .6); this.fx.lineBetween(bx - b.vx * S * .025, by - b.vy * S * .025, bx, by);
            this.fx.fillStyle(b.hostile ? 0xffb2d1 : 0xffe1a1);
            if (b.hostile) this.fx.fillTriangle(bx, by - 3, bx - 2, by + 2, bx + 2, by + 2); else this.fx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 2);
        }
        for (const effect of run.effects) {
            if (!this.seenEffects.has(effect)) { this.seenEffects.add(effect); this.burst(effect.x * S, effect.y * S - 8, effect.color, 6, 23); }
            if (effect.kind === 'arc') { this.fx.lineStyle(2, effect.color, .8); if (effect.x2 !== undefined && effect.y2 !== undefined) { this.fx.lineBetween(effect.x * S, effect.y * S - 10, effect.x2 * S, effect.y2 * S - 10); } else { const a = effect.angle ?? 0, r = (effect.radius ?? 60) * S; this.fx.beginPath(); this.fx.arc(effect.x * S, effect.y * S - 9, r, a - .8, a + .8, false); this.fx.strokePath(); } }
            if (effect.kind === 'blast') { this.fx.lineStyle(2, effect.color, effect.life * 2); this.fx.strokeCircle(effect.x * S, effect.y * S, (effect.radius ?? 60) * S * (1 - effect.life / .5)); }
            if (effect.text) this.label(effect.x * S - 4, effect.y * S - 24, effect.text, hex(effect.color), Math.min(1, effect.life * 2));
        }
        if (run.status !== this.endState) {
            if (run.status === 'victory') { this.burst(x, y - 8, 0xffc16a, 70, 70); this.cue('victory'); }
            if (run.status === 'dead') { this.burst(x, y - 8, 0xa09490, 24, 30); this.cue('death'); }
            this.endState = run.status;
        }
        this.particles(dt);
        this.impacts.forEach(impact => {
            impact.life -= active ? dt : 0;
            if (this.options().effects <= 0) return;
            const phase = Math.max(0, impact.life / .18), size = 3 + (1 - phase) * 6;
            this.fx.lineStyle(1, 0xffe5b5, phase);
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; this.fx.lineBetween(impact.x + Math.cos(a) * size * .45, impact.y + Math.sin(a) * size * .45, impact.x + Math.cos(a) * size, impact.y + Math.sin(a) * size); }
        });
        this.impacts = this.impacts.filter(impact => impact.life > 0).slice(-20);
        this.ambient(time, run.floor, this.scene.cameras.main.scrollX, this.scene.cameras.main.scrollY);
    }
    private consumeFeedback(run: Run) {
        const weapons: SoundName[] = ['spark', 'scatter', 'lance', 'chain'];
        const specials: SoundName[] = ['spark-special', 'scatter-special', 'lance-special', 'chain-special'];
        const sounds = { 'dash-start': 'dash', 'dash-end': 'dash-land', 'charge-start': 'charge', 'charge-ready': 'charge-ready', impact: 'impact', hurt: 'hurt', heal: 'heal', defeat: 'defeat', ricochet: 'ricochet', 'pot-break': 'pot', 'pillar-break': 'stone', ignite: 'ignite', 'trap-arm': 'trap-arm', 'trap-fire': 'trap', secret: 'secret', 'boss-warn': 'boss-warn', 'boss-release': 'boss-release', revive: 'revive', switch: 'switch', step: 'step' } as const;
        for (const event of this.feedback.read(run.feedback)) {
            if (event.kind === 'charge-stop') { this.cue('stop-charge'); continue; }
            const x = event.x * S, y = event.y * S;
            if (event.kind === 'dash-start') { this.dashVFX.start(x, y, event.dx ?? 1, event.dy ?? 0); this.burst(x, y - 8, 0xffd88d, 12, 40); }
            if (event.kind === 'dash-end') { this.dashVFX.land(x, y); this.burst(x, y - 5, 0xffb66a, 8, 25); }
            if (event.kind === 'attack') this.attackPulse = .12;
            if (event.kind === 'impact' || event.kind === 'ricochet') this.impacts.push({ x, y: y - 10, life: .18 });
            if (event.kind === 'pot-break' || event.kind === 'pillar-break') this.burst(x, y - 7, 0xbaa38b, event.kind === 'pot-break' ? 12 : 26, 42);
            if (event.kind === 'secret' || event.kind === 'revive') this.burst(x, y - 12, event.kind === 'secret' ? 0xffc16a : 0x8fe7e3, 25, 42);
            const distance = Math.hypot(event.x - run.x, event.y - run.y);
            if (distance > 330) continue;
            const sound = event.kind === 'attack' ? (event.special ? specials : weapons)[event.weapon ?? 0] : sounds[event.kind];
            this.cue(sound, { pan: (event.x - run.x) / 290, gain: Math.max(.1, 1 - distance / 380) * (event.kind === 'step' && event.special ? .25 : 1) });
        }
    }
    private enemy(e: Enemy, time: number, dt: number, debug: boolean, run: Run, active: boolean) {
        let sprite = this.enemies.get(e.id); if (!sprite) { sprite = this.scene.add.image(0, 0, `actor-${e.kind}-0`).setOrigin(.5, .9); this.enemies.set(e.id, sprite); }
        const old = this.previous.get(e.id), x = e.x * S, y = e.y * S;
        let motion = this.enemyMotion.get(e.id);
        if (!motion) { motion = new ActorMotion(); motion.reset(x, y); this.enemyMotion.set(e.id, motion); }
        motion.update(x, y, dt, active, false, 0, this.options().reducedMotion);
        if (old && e.hp < old.hp) this.flashes.set(e.id, .1);
        if (old && e.ai.state !== old.state && e.ai.state === 'ALERT') { this.burst(x, y - 18, 0xffc16a, 5, 15); this.cue('alert'); }
        const flash = Math.max(0, (this.flashes.get(e.id) ?? 0) - dt); this.flashes.set(e.id, flash);
        sprite.setPosition(Math.round(x), Math.round(y)).setDepth(100 + y).setTexture(`actor-${e.kind}-${motion.frame}`).setFlipX(Math.cos(e.ai.facing) < 0).setTint(flash > 0 ? 0xffffff : e.burn > 0 ? 0xffbd77 : 0xffffff).setAlpha(flash > 0 ? .55 : 1);
        if (flash > 0) sprite.setTintFill(0xffead2).setAlpha(1);
        this.shadow.fillStyle(0x000000, .4); this.shadow.fillEllipse(x, y + 1, e.kind === 4 ? 33 : 17, e.kind === 4 ? 9 : 5);
        if (e.hp < e.max) { const w = e.kind === 4 ? 36 : 16; this.fx.fillStyle(0x0b0d12); this.fx.fillRect(x - w / 2 - 1, y - (e.kind === 4 ? 49 : 31), w + 2, 3); this.fx.fillStyle(e.kind === 4 ? 0xffa75c : 0xd37b78); this.fx.fillRect(x - w / 2, y - (e.kind === 4 ? 48 : 30), Math.max(0, w * e.hp / e.max), 1); }
        if (e.ai.state === 'ALERT') this.label(x - 2, y - 39, '!', '#ffc16a');
        if (e.ai.state === 'SEARCH') this.label(x - 2, y - 35, '?', '#a6b0c0');
        if (e.ai.state === 'CHASE') { this.fx.fillStyle(e.kind === 3 ? 0x9974d8 : 0xff7733, .6); this.fx.fillTriangle(x - 2, y - 32, x + 2, y - 32, x, y - 29); }
        if (e.ai.state === 'ATTACK' && e.ai.cooldown < .3 && e.kind !== 4) { this.fx.lineStyle(1, e.kind === 1 ? 0xe88bb1 : 0xd94b53, .65); this.fx.strokeEllipse(x, y, e.kind === 1 ? 16 : 22, 7); }
        if (e.burn > 0) { this.fx.fillStyle(0xffaa4d); this.fx.fillRect(x - 4, y - 17 - Math.floor(time / 100) % 3, 2, 4); }
        if (e.telegraph > 0) {
            // Critical warning remains fully visible even with all optional VFX off.
            const radius = 3 * TILE * S; this.fx.fillStyle(0xd94b53, .13); this.fx.fillCircle(x, y, radius);
            this.fx.lineStyle(1, 0xff8264); this.fx.strokeCircle(x, y, radius); this.fx.strokeCircle(x, y, radius * Math.max(.05, 1 - e.telegraph / .9));
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) this.fx.lineBetween(x + Math.cos(a) * (radius - 3), y + Math.sin(a) * (radius - 3), x + Math.cos(a) * (radius + 2), y + Math.sin(a) * (radius + 2));
            this.label(x - 13, y - 56, 'MOVE!', '#ffd8ac');
        }
        if (debug) {
            this.fx.lineStyle(1, 0x54d6da, .5); this.fx.beginPath(); this.fx.moveTo(x, y); e.ai.path.forEach(p => this.fx.lineTo((p.x + .5) * VIEW.tile, (p.y + .5) * VIEW.tile)); this.fx.strokePath();
            this.fx.lineStyle(1, e.ai.visible ? 0xffa566 : 0x54d6da, .16); this.fx.strokeCircle(x, y, e.ai.vision * VIEW.tile);
            this.label(x - 16, y - 45, run.minds.get(e.id)?.choice.action ?? e.ai.state, '#7bdee1');
        }
        this.previous.set(e.id, { x: e.x, y: e.y, hp: e.hp, state: e.ai.state });
    }
    private particles(dt: number) {
        const options = this.options(); let drawn = 0;
        for (const p of this.sparks) {
            p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 25 * dt;
            if (options.effects <= 0 || (options.reducedMotion && drawn >= 8)) continue;
            drawn++; this.fx.fillStyle(p.color, Math.max(0, p.life / p.max) * options.effects); this.fx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        this.sparks = this.sparks.filter(p => p.life > 0);
    }
    private environment(run: Run, time: number) {
        const g = this.fx;
        for (const o of run.objects) {
            const x = o.x * S, y = o.y * S;
            if (['pot', 'pillar', 'secret'].includes(o.kind)) {
                let image = this.objectSprites.get(o.id);
                if (!image) { image = this.scene.add.image(x, y, o.kind === 'pot' ? 'pot' : o.kind === 'pillar' ? 'pillar' : `wall-${run.floor - 1}-3`).setOrigin(.5, 1); this.objectSprites.set(o.id, image); }
                image.setVisible(!o.used).setPosition(x, y + 5).setDepth(100 + y);
                if (o.kind === 'secret' && !o.used) { g.fillStyle(0xffc16a, .7); g.fillRect(x - 1, y - 12, 1, 4); g.fillRect(x + 1, y - 9, 1, 3); }
            } else this.objectSprites.get(o.id)?.setVisible(false);
            if (o.kind === 'rubble') { g.fillStyle(0x536171); g.fillRect(x - 7, y - 5, 14, 8); g.fillStyle(0x849294); g.fillRect(x - 5, y - 7, 6, 3); }
            if (o.kind === 'oil') { g.fillStyle(0x090c16, .8); g.fillEllipse(x, y, 30, 19); g.lineStyle(1, 0x6b4937, .6); g.strokeEllipse(x, y, 26, 15); }
            if ((o.kind === 'oil' || o.kind === 'fire') && o.active > 0) { const radius = o.kind === 'oil' ? 18 : 8; g.fillStyle(0xf27637, .23); g.fillCircle(x, y, radius); for (let i = -2; i <= 2; i++) { g.fillStyle(i % 2 ? 0xffc16a : 0xff7733); g.fillRect(x + i * 4, y - 4 - Math.floor(time / 90 + i) % 4, 2, 6); } }
            if (o.kind === 'trap') { g.lineStyle(1, o.active > .5 ? 0xffc16a : o.active > 0 ? 0xff7755 : 0x8f8382); g.strokeRect(x - 6, y - 6, 12, 12); g.lineBetween(x - 4, y - 4, x + 4, y + 4); g.lineBetween(x + 4, y - 4, x - 4, y + 4); if (o.active > 0) { g.strokeCircle(x, y, 20 * S); g.fillStyle(o.active > .5 ? 0xffc16a : 0xd94b53, .2); g.fillCircle(x, y, 20 * S); } }
            if (['altar', 'ward', 'choice', 'tactics', 'gate'].includes(o.kind)) {
                const color = o.used ? 0x65646a : o.kind === 'ward' ? 0x54d6da : o.kind === 'gate' ? 0x9974d8 : 0xffc16a;
                g.fillStyle(0x333d4c); g.fillRect(x - 10, y - 2, 20, 5); g.fillRect(x - 6, y - 11, 12, 9);
                g.lineStyle(1, color, .8); g.strokeCircle(x, y - 16, o.kind === 'gate' ? 12 : 7);
                if (o.kind === 'tactics') { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.fillStyle((i + j) % 2 ? color : 0x273245); g.fillRect(x - 5 + i * 4, y - 22 + j * 4, 3, 3); } }
                else { g.fillStyle(color); g.fillTriangle(x - 3, y - 13, x + 3, y - 13, x, y - 24); }
                this.glow(x, y - 14, 23, color, .4);
                if (o.kind === 'ward') { g.fillStyle(0x0b111a); g.fillRect(x - 16, y - 31, 32, 3); g.fillStyle(0x54d6da); g.fillRect(x - 15, y - 30, 30 * Math.max(0, o.hp) / 120, 1); }
            }
            if (!o.used && Math.hypot(o.x - run.x, o.y - run.y) < TILE * 1.7 && ['altar', 'choice', 'tactics', 'pillar', 'secret', 'gate'].includes(o.kind)) this.label(x - 25, y + 16, o.kind === 'secret' ? 'FIRE / CRACKED SEAL' : `[E] ${o.kind === 'tactics' ? 'RUNE DUEL' : o.kind.toUpperCase()}`, '#dfc598');
        }
        for (const encounter of run.encounters.values()) if (encounter.type === 'collapse' && encounter.started && encounter.time > 7 && !encounter.complete) {
            const r = run.d.rooms[encounter.room], inset = Math.min(3, Math.floor((encounter.time - 7) / 5) + 1); g.fillStyle(0xd94b53, .22);
            for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x < r.x + inset || x >= r.x + r.w - inset || y < r.y + inset || y >= r.y + r.h - inset) g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
        }
    }
    private ambient(time: number, floor: number, sx: number, sy: number) {
        if (this.options().reducedMotion || this.options().effects <= 0) return;
        const count = Math.floor((floor >= 4 ? 25 : 12) * this.options().effects);
        for (let i = 0; i < count; i++) { const x = sx + (i * 73 + Math.sin(time / 2100 + i) * 4) % 480, y = sy + ((i * 47 - time * (floor >= 4 ? .014 : .004)) % 270 + 270) % 270; this.fx.fillStyle(i % 5 === 0 ? 0xffb565 : 0xa09c9a, i % 5 === 0 ? .5 : .16); this.fx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
    menu(time: number, dt: number) {
        if (this.options().reducedMotion) time = 0;
        if (!this.menuMode) {
            this.dashVFX.reset(); this.attackPulse = this.healPulse = 0; this.sparks = []; this.impacts = [];
            this.menuMode = true; this.map.setVisible(false); this.player.setVisible(false); this.props.forEach(p => p.image.setVisible(false)); this.enemies.forEach(e => e.setVisible(false)); this.textPool.forEach(t => t.setVisible(false));
            this.scene.cameras.main.setBounds(0, 0, 480, 270).setScroll(0, 0);
            this.objectSprites.forEach(image => image.setVisible(false));
            this.backdrop.setVisible(true).clear(); this.drawGate();
        }
        this.light.clear(); this.fx.clear(); this.shadow.clear();
        const a = this.options().reducedMotion ? 1 : .94 + Math.sin(time / 340) * .06;
        this.glow(339, 172, 95, 0xff7733, a * 1.4); this.glow(235, 125, 46, 0xff8f44, a); this.glow(443, 125, 42, 0xff8f44, a);
        for (const [x, y] of [[235, 125], [443, 125], [339, 174]]) { this.fx.fillStyle(0xff7733); this.fx.fillRect(x - 2, y - 7, 4, 8); this.fx.fillRect(x - 1, y - 11 - Math.floor(time / 160) % 2, 2, 6); this.fx.fillStyle(0xffd58b); this.fx.fillRect(x - 1, y - 4, 2, 4); }
        // The little keeper before the sealed gate is part of the original pixel composition.
        const g = this.fx; g.fillStyle(0x080b12, .7); g.fillEllipse(339, 226, 23, 5); g.fillStyle(0x111724); g.fillRect(333, 208, 12, 17); g.fillStyle(0x2c3d4b); g.fillRect(334, 207, 10, 14); g.fillStyle(0x48585e); g.fillRect(335, 204, 8, 5); g.fillStyle(0x192432); g.fillRect(333, 209, 3, 15); g.fillRect(342, 209, 4, 15); g.fillStyle(0xb48b61); g.fillRect(334, 224, 4, 2); g.fillRect(341, 224, 4, 2); g.fillStyle(0xffbf68); g.fillRect(348, 215, 2, 3);
        this.ambient(time, 4, 0, 0); this.particles(dt);
    }
    private drawGate() {
        const g = this.backdrop;
        g.fillStyle(0x0b0d12); g.fillRect(0, 0, 480, 270);
        g.fillStyle(0x171c27); g.fillRect(168, 20, 312, 250);
        for (let y = 26; y < 181; y += 14) for (let x = 166; x < 480; x += 30) { const n = hash(x, y); g.fillStyle([0x202631, 0x242a36, 0x1d2430][n % 3]); g.fillRect(x + (y % 28 ? 15 : 0), y, 28, 12); g.fillStyle(0x343b45); g.fillRect(x + (y % 28 ? 15 : 0), y, 27, 1); }
        g.fillStyle(0x212734); g.fillRect(160, 180, 320, 90);
        for (let y = 181; y < 270; y += 13) for (let x = 164; x < 480; x += 28) { const n = hash(x, y); g.fillStyle([0x292e3a, 0x2b303a, 0x242b36, 0x30323c][n % 4]); g.fillRect(x + (y % 2 ? 0 : 14), y, 26, 11); if (n % 5 === 0) { g.fillStyle(0x171c29); g.fillRect(x + 9, y + 1, 1, 4); g.fillRect(x + 10, y + 5, 2, 1); } }
        // Monumental stepped arch, recessed door, weathered gold inscriptions.
        const x = 275, y = 37;
        g.fillStyle(0x10141e); g.fillRect(x - 9, y + 25, 146, 137); g.fillRect(x + 5, y + 6, 118, 156); g.fillRect(x + 22, y - 5, 84, 167);
        g.fillStyle(0x454650); g.fillRect(x, y + 28, 128, 125); g.fillRect(x + 9, y + 9, 110, 145); g.fillRect(x + 26, y, 76, 156);
        g.fillStyle(0x65616a); g.fillRect(x, y + 28, 7, 123); g.fillRect(x + 9, y + 9, 8, 19); g.fillRect(x + 26, y, 76, 5); g.fillRect(x + 17, y + 9, 8, 5);
        g.fillStyle(0x2d303e); g.fillRect(x + 13, y + 36, 102, 119); g.fillRect(x + 23, y + 22, 82, 133); g.fillRect(x + 37, y + 13, 54, 141);
        g.fillStyle(0x121722); g.fillRect(x + 22, y + 39, 85, 116); g.fillRect(x + 31, y + 29, 67, 125); g.fillRect(x + 43, y + 23, 43, 132);
        g.fillStyle(0x2b2932); g.fillRect(x + 27, y + 47, 76, 106); g.fillRect(x + 36, y + 34, 58, 118);
        for (let i = 0; i < 6; i++) { g.fillStyle(i % 2 ? 0x3d3942 : 0x34323d); g.fillRect(x + 29 + i * 12, y + 48, 10, 102); g.fillStyle(0x685445); g.fillRect(x + 29 + i * 12, y + 55 + i % 2 * 8, 2, 8); }
        g.fillStyle(0x080b13); g.fillRect(x + 62, y + 39, 3, 114);
        g.fillStyle(0x885238); g.fillRect(x + 63, y + 67, 1, 86); g.fillStyle(0xffa454); g.fillRect(x + 63, y + 112, 1, 38);
        for (let i = 0; i < 8; i++) { g.fillStyle(0x252632); g.fillRect(x, y + 31 + i * 15, 12, 2); g.fillRect(x + 116, y + 31 + i * 15, 12, 2); g.fillStyle(0x97806a); g.fillRect(x + 4, y + 36 + i * 14, 2, 4); g.fillRect(x + 121, y + 36 + i * 14, 2, 3); }
        g.lineStyle(1, 0x9a7751, .8); g.strokeCircle(x + 64, y + 80, 14); g.strokeCircle(x + 64, y + 80, 11); g.lineBetween(x + 64, y + 63, x + 64, y + 96); g.lineBetween(x + 47, y + 80, x + 81, y + 80);
        for (let i = 0; i < 4; i++) { g.fillStyle([0x4d4650, 0x423c46, 0x393641, 0x31313b][i]); g.fillRect(x - 8 - i * 5, 190 + i * 5, 144 + i * 10, 5); g.fillStyle(0x6a5b58); g.fillRect(x - 8 - i * 5, 190 + i * 5, 144 + i * 10, 1); }
        for (const px of [218, 433]) {
            g.fillStyle(0x0f141f); g.fillRect(px - 6, 40, 27, 151); g.fillStyle(0x3a424f); g.fillRect(px, 39, 17, 145); g.fillStyle(0x59616c); g.fillRect(px + 2, 42, 4, 138); g.fillStyle(0x28313f); g.fillRect(px + 12, 42, 5, 138); g.fillStyle(0x515965); g.fillRect(px - 5, 37, 27, 7); g.fillRect(px - 5, 179, 27, 10); g.fillStyle(0x6b6d73); g.fillRect(px - 5, 178, 27, 2);
        }
        g.fillStyle(0x111724, .76); g.fillRect(0, 0, 170, 270); g.fillStyle(0x0b0d12, .35); g.fillRect(170, 0, 40, 270);
        // Fallen masonry; the foreground frames the composition.
        for (let i = 0; i < 18; i++) { const px = 182 + hash(i, 1) % 292, py = 231 + hash(i, 2) % 35; g.fillStyle(0x171d29); g.fillRect(px, py, 3 + i % 5, 2 + i % 3); g.fillStyle(0x43424b); g.fillRect(px, py, 2 + i % 4, 1); }
        g.fillStyle(0x080b11); g.fillRect(0, 260, 480, 10); g.fillRect(472, 0, 8, 270);
    }
}
