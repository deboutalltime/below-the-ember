import Phaser from 'phaser';

interface Ghost { image: Phaser.GameObjects.Image; life: number; dx: number }
interface TrailPoint { x: number; y: number; life: number }
interface Flare { x: number; y: number; dx: number; dy: number; life: number; max: number; landing: boolean }
interface DashOptions { effects: number; reducedMotion: boolean }
/** A bounded, disposable visual trail. Every position comes from actual collision-resolved movement. */
export class DashVFX {
    private graphics: Phaser.GameObjects.Graphics;
    private ghosts: Ghost[] = [];
    private points: TrailPoint[] = [];
    private flares: Flare[] = [];
    private anchor?: { x: number; y: number };
    private dx = 1;
    private dy = 0;
    constructor(private scene: Phaser.Scene) { this.graphics = scene.add.graphics().setDepth(80); }
    reset() {
        this.ghosts.forEach(ghost => { ghost.life = 0; ghost.image.setVisible(false); });
        this.points = []; this.flares = []; this.anchor = undefined; this.graphics.clear();
    }
    start(x: number, y: number, dx: number, dy: number) {
        this.anchor = { x, y }; this.dx = dx; this.dy = dy;
        this.flares.push({ x, y, dx, dy, life: .23, max: .23, landing: false });
        this.points.push({ x, y: y - 10, life: .36 });
    }
    land(x: number, y: number) {
        this.flares.push({ x, y, dx: this.dx, dy: this.dy, life: .24, max: .24, landing: true });
        this.anchor = undefined;
    }
    private ghost(x: number, y: number, intensity: number) {
        let ghost = this.ghosts.find(item => item.life <= 0);
        if (!ghost && this.ghosts.length < 14) {
            ghost = { image: this.scene.add.image(0, 0, 'actor--1-2').setOrigin(.5, .9).setBlendMode(Phaser.BlendModes.ADD), life: 0, dx: 1 };
            this.ghosts.push(ghost);
        }
        if (!ghost) ghost = this.ghosts.reduce((a, b) => a.life < b.life ? a : b);
        ghost.life = .38; ghost.dx = this.dx;
        ghost.image.setPosition(Math.round(x), Math.round(y)).setFlipX(this.dx < 0).setScale(1.08, .86)
            .setAngle(this.dx * 13).setDepth(99 + y).setVisible(true).setAlpha(.27 * intensity);
    }
    update(x: number, y: number, dashing: boolean, dt: number, options: DashOptions) {
        const g = this.graphics.clear(), intensity = Math.max(0, Math.min(1, options.effects));
        for (const ghost of this.ghosts) {
            ghost.life = Math.max(0, ghost.life - dt);
            const phase = ghost.life / .38;
            ghost.image.setVisible(phase > 0 && intensity > 0 && !options.reducedMotion)
                .setAlpha(.27 * phase ** 1.5 * intensity).setTintFill(phase > .65 ? 0xffd295 : phase > .3 ? 0xff8a47 : 0xa85d80);
        }
        this.points.forEach(point => point.life -= dt); this.points = this.points.filter(point => point.life > 0);
        this.flares.forEach(flare => flare.life -= dt); this.flares = this.flares.filter(flare => flare.life > 0).slice(-4);
        if (intensity === 0) { this.points = []; this.flares = []; this.anchor = dashing ? { x, y } : undefined; return; }
        if (options.reducedMotion) {
            this.points = [];
            if (dashing) { g.lineStyle(1, 0xffd895, .7); g.strokeEllipse(x, y - 8, 21, 24); }
            this.anchor = dashing ? { x, y } : undefined;
            return;
        }
        if (dashing && this.anchor) {
            const distance = Math.hypot(x - this.anchor.x, y - this.anchor.y), samples = Math.min(10, Math.floor(distance / 10));
            if (samples) {
                for (let i = 1; i <= samples; i++) {
                    const px = Phaser.Math.Linear(this.anchor.x, x, i / samples), py = Phaser.Math.Linear(this.anchor.y, y, i / samples);
                    this.ghost(px, py, intensity); this.points.push({ x: px, y: py - 10, life: .36 });
                }
                this.anchor = { x, y };
            }
        }
        if (!dashing) this.anchor = undefined;
        this.points = this.points.slice(-24);
        for (let i = 1; i < this.points.length; i++) {
            const a = this.points[i - 1], b = this.points[i], alpha = Math.min(a.life, b.life) / .36 * intensity;
            if (Math.hypot(b.x - a.x, b.y - a.y) > 35) continue;
            g.lineStyle(6, 0xff6f32, alpha * .13); g.lineBetween(a.x, a.y, b.x, b.y);
            g.lineStyle(2, 0xffb55a, alpha * .65); g.lineBetween(a.x, a.y, b.x, b.y);
            g.lineStyle(1, 0xffeec3, alpha * .8); g.lineBetween(a.x, a.y, b.x, b.y);
            g.lineStyle(1, 0xff8b49, alpha * .35);
            g.lineBetween(a.x - this.dy * 6, a.y + this.dx * 6, b.x - this.dy * 6, b.y + this.dx * 6);
            const drift = (1 - b.life / .36) * 11;
            g.fillStyle(i % 3 ? 0xffb25c : 0xffe1a0, alpha * .8);
            g.fillRect(Math.round(b.x - this.dx * drift + Math.sin(i * 2.4) * 4), Math.round(b.y - drift * .5 + Math.cos(i * 2.4) * 6), 1, 2);
        }
        for (const flare of this.flares) {
            const t = 1 - flare.life / flare.max, alpha = (1 - t) ** 1.3 * intensity;
            const cx = flare.x, cy = flare.y - 8, radius = (flare.landing ? 6 : 9) + t * (flare.landing ? 13 : 17);
            g.lineStyle(1, flare.landing ? 0xffbd78 : 0xffe4ac, alpha * .75);
            g.strokeEllipse(cx, cy + 6, radius * 2, radius * .7);
            for (let j = 0; j < 8; j++) {
                const angle = j * Math.PI / 4 + (flare.landing ? .15 : 0), length = 3 + (1 - t) * 5;
                const dx = Math.cos(angle), dy = Math.sin(angle) * .75;
                g.lineStyle(1, j % 2 ? 0xff8e46 : 0xffde91, alpha);
                g.lineBetween(cx + dx * radius, cy + dy * radius, cx + dx * (radius + length), cy + dy * (radius + length));
            }
            if (!flare.landing && t < .5) {
                const size = (1 - t * 2) * 10;
                g.fillStyle(0xffefc5, alpha * .8);
                g.fillTriangle(cx - flare.dy * size, cy + flare.dx * size, cx + flare.dx * size * 2, cy + flare.dy * size * 2, cx + flare.dy * size, cy - flare.dx * size);
            }
        }
    }
}
