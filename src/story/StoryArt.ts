import { hash } from '../visuals/theme';
type C = CanvasRenderingContext2D;
type Point = readonly [number, number];
const polygon = (c: C, color: string, points: readonly Point[]) => {
    c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
};
function glow(c: C, x: number, y: number, radius: number, color: string, alpha = 1) {
    const light = c.createRadialGradient(x, y, 1, x, y, radius);
    light.addColorStop(0, color); light.addColorStop(1, 'transparent');
    c.save(); c.globalAlpha *= alpha; c.fillStyle = light; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}
function masonry(c: C, x: number, y: number, w: number, h: number, salt: number, lit = false) {
    c.fillStyle = '#141d29'; c.fillRect(x, y, w, h);
    for (let row = 0; row < h; row += 9) for (let col = 0; col < w; col += 12) {
        const n = hash(col, row, salt), px = x + col + (row % 18 ? 4 : 0);
        c.fillStyle = ['#263342', '#2b3746', '#202c39'][n % 3]; c.fillRect(px, y + row + 1, Math.min(10, x + w - px), 7);
        if (lit && n % 7 === 0) { c.fillStyle = '#b17c44'; c.fillRect(px + 3, y + row + 2, 2, 4); }
    }
    c.fillStyle = '#4a5160'; c.fillRect(x - 2, y - 3, w + 4, 3);
}
function arch(c: C, x: number, foot: number, w: number, h: number, lit = false) {
    const top = foot - h;
    polygon(c, '#3d4857', [[x - w / 2, foot], [x - w / 2, top + 20], [x - w / 2 + 10, top + 20], [x - w / 2 + 10, top + 9], [x - 10, top], [x + 10, top], [x + w / 2 - 10, top + 9], [x + w / 2 - 10, top + 20], [x + w / 2, top + 20], [x + w / 2, foot]]);
    polygon(c, '#090f1a', [[x - w / 2 + 7, foot], [x - w / 2 + 7, top + 25], [x - w / 2 + 18, top + 25], [x - w / 2 + 18, top + 15], [x, top + 7], [x + w / 2 - 18, top + 15], [x + w / 2 - 18, top + 25], [x + w / 2 - 7, top + 25], [x + w / 2 - 7, foot]]);
    c.fillStyle = lit ? '#805d3d' : '#566071'; c.fillRect(x - w / 2, top + 22, 3, h - 22); c.fillRect(x - 10, top, 20, 2);
    for (let i = 0; i < 4; i++) { c.fillStyle = lit ? '#d49b58' : '#394a59'; c.fillRect(x - w / 2 + 1, top + 31 + i * 16, 4, 3); }
}
function keeper(c: C, x: number, foot: number, scale = 1, front = false) {
    c.save(); c.translate(x, foot); c.scale(scale, scale);
    polygon(c, '#080d17', [[-13, 0], [-11, -24], [-7, -29], [-6, -39], [6, -39], [9, -30], [13, -23], [16, 0]]);
    polygon(c, '#263a4a', [[-10, -2], [-8, -26], [0, -32], [8, -26], [11, -2]]);
    polygon(c, '#3d5361', [[-8, -28], [-5, -37], [5, -37], [9, -28], [4, -24], [-4, -24]]);
    c.fillStyle = '#101c2a'; c.fillRect(-5, -32, 11, 9); c.fillRect(-10, -22, 5, 20);
    if (front) { c.fillStyle = '#d7b58a'; c.fillRect(-3, -29, 7, 3); c.fillStyle = '#ffe0a0'; c.fillRect(-2, -29, 1, 1); c.fillRect(2, -29, 1, 1); }
    c.fillStyle = '#b39369'; c.fillRect(-9, -2, 6, 3); c.fillRect(5, -2, 6, 3);
    c.fillStyle = '#ed9b50'; c.fillRect(7, -20, 5, 4); c.restore();
}

/** Five original layered pixel tableaux. Only disposable art and clocks live here. */
export class StoryArt {
    private layers = new Map<number, HTMLCanvasElement[]>();
    private index = 0;
    private previous = -1;
    private blend = 1;
    private time = 0;
    private context: C;
    constructor(private canvas: HTMLCanvasElement) {
        canvas.width = 480; canvas.height = 270; this.context = canvas.getContext('2d')!;
        this.context.imageSmoothingEnabled = false;
    }
    show(index: number, motion: boolean) { this.previous = this.index === index ? -1 : this.index; this.index = index; this.blend = motion && this.previous >= 0 ? 0 : 1; }
    draw(dt: number, progress: number, motion: boolean) {
        if (motion) this.time += dt;
        this.blend = motion ? Math.min(1, this.blend + dt / .65) : 1;
        const c = this.context; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = '#070c14'; c.fillRect(0, 0, 480, 270);
        if (this.previous >= 0 && this.blend < 1) this.scene(this.previous, 1, progress, motion);
        this.scene(this.index, this.blend, progress, motion);
        const shade = c.createLinearGradient(0, 0, 320, 0); shade.addColorStop(0, '#060b15dc'); shade.addColorStop(.68, '#080d1720'); shade.addColorStop(1, 'transparent');
        c.globalAlpha = 1; c.fillStyle = shade; c.fillRect(0, 0, 480, 270);
        const bottom = c.createLinearGradient(0, 165, 0, 270); bottom.addColorStop(0, 'transparent'); bottom.addColorStop(1, '#050913f2'); c.fillStyle = bottom; c.fillRect(0, 165, 480, 105);
    }
    destroy() { this.layers.forEach(layers => layers.forEach(layer => { layer.width = 0; layer.height = 0; })); this.layers.clear(); }
    private scene(index: number, alpha: number, progress: number, motion: boolean) {
        let layers = this.layers.get(index);
        if (!layers) {
            layers = [0, 1, 2].map(depth => {
                const layer = document.createElement('canvas'); layer.width = 480; layer.height = 270;
                const context = layer.getContext('2d')!; context.imageSmoothingEnabled = false; this.paint(context, index, depth); return layer;
            }); this.layers.set(index, layers);
        }
        const c = this.context; c.save(); c.globalAlpha = alpha;
        layers.forEach((layer, depth) => {
            const drift = motion ? Math.round((Math.sin(this.time / 11) * 2 + progress * 2) * depth) : 0;
            c.drawImage(layer, drift - (motion ? depth : 0), 0);
        });
        this.livingLight(c, index, motion); c.restore();
    }
    private paint(c: C, index: number, depth: number) {
        if (depth === 0) {
            const sky = c.createLinearGradient(0, 0, 0, 270); sky.addColorStop(0, index === 0 ? '#101f31' : '#090f1d'); sky.addColorStop(.6, index === 0 ? '#554039' : index === 1 ? '#35232c' : '#162b3a'); sky.addColorStop(1, '#080e19'); c.fillStyle = sky; c.fillRect(0, 0, 480, 270);
            for (let i = 0; i < 85; i++) { const n = hash(i, index, 71), x = n % 480, y = (n >>> 10) % 180; c.fillStyle = i % 5 ? '#a6b0b83d' : '#e0c49965'; c.fillRect(x, y, 1, 1); }
            if (index === 0) {
                glow(c, 318, 83, 88, '#d28b4b60'); c.fillStyle = '#ad875c'; c.fillRect(304, 58, 29, 32); c.fillStyle = '#d9b480'; c.fillRect(308, 60, 20, 26);
                for (let i = 0; i < 3; i++) polygon(c, ['#182635', '#1c2b3a', '#233341'][i], [[0, 120 + i * 12], [60, 68 + i * 20], [103, 97], [159, 53 + i * 14], [214, 106], [265, 71], [355, 109], [431, 58 + i * 9], [480, 92], [480, 220], [0, 220]]);
            } else {
                for (let i = 0; i < 7; i++) {
                    c.strokeStyle = ['#253343', '#1c293b', '#1e3241'][i % 3]; c.lineWidth = 2;
                    c.beginPath(); c.arc(294, 137, 90 + i * 22, Math.PI, Math.PI * 2); c.stroke();
                }
            }
            return;
        }
        if (index === 0) this.city(c, depth);
        if (index === 1) this.heart(c, depth);
        if (index === 2) this.seals(c, depth);
        if (index === 3) this.lastKeeper(c, depth);
        if (index === 4) this.descent(c, depth);
    }
    private city(c: C, depth: number) {
        if (depth === 1) {
            for (let i = 0; i < 19; i++) {
                const n = hash(i, 16, 5), x = 8 + i * 26, h = 30 + n % 63, foot = 172 + (n >>> 9) % 32;
                masonry(c, x, foot - h, 18 + n % 8, h, i, true);
                if (i % 3 === 0) polygon(c, '#334352', [[x - 4, foot - h - 3], [x + 10, foot - h - 23], [x + 25, foot - h - 3]]);
            }
            masonry(c, 300, 93, 40, 108, 31, true); arch(c, 320, 202, 29, 68, true);
            c.strokeStyle = '#74807c'; c.lineWidth = 2; c.beginPath(); c.moveTo(282, 94); c.lineTo(320, 60); c.lineTo(356, 94); c.stroke();
            c.fillStyle = '#b69a6c'; c.fillRect(318, 34, 4, 28); c.fillRect(306, 55, 28, 3);
            for (let x = 140; x < 428; x += 27) { c.fillStyle = '#25313f'; c.fillRect(x, 198, 21, 30); c.fillStyle = '#080f1b'; c.fillRect(x + 4, 205, 12, 24); }
            c.fillStyle = '#6a6b68'; c.fillRect(132, 191, 300, 5);
        } else {
            polygon(c, '#080e19', [[0, 228], [72, 211], [131, 235], [204, 221], [279, 240], [356, 221], [415, 227], [480, 207], [480, 270], [0, 270]]);
            keeper(c, 381, 243, .7); c.fillStyle = '#a97748'; c.fillRect(395, 221, 2, 7);
        }
    }
    private heart(c: C, depth: number) {
        if (depth === 1) {
            masonry(c, 73, 40, 34, 194, 4); masonry(c, 420, 23, 35, 211, 8);
            arch(c, 295, 237, 300, 215, true);
            for (const [x, from] of [[213, 44], [368, 27], [305, 16]]) for (let y = from; y < 150; y += 9) {
                const px = x + Math.round((y - from) * (x < 290 ? .3 : -.22));
                c.strokeStyle = '#8e795e'; c.lineWidth = 1; c.strokeRect(px, y, 4, 7);
            }
            for (let i = 0; i < 11; i++) {
                const a = i * Math.PI * 2 / 11; c.fillStyle = '#a97946'; c.fillRect(Math.round(295 + Math.cos(a) * 65), Math.round(151 + Math.sin(a) * 55), 2, 6);
            }
            polygon(c, '#493941', [[246, 214], [267, 197], [318, 197], [347, 214], [335, 225], [259, 225]]);
            c.fillStyle = '#8b6750'; c.fillRect(267, 207, 57, 3);
            for (let i = 0; i < 9; i++) {
                const x = 175 + i * 30; c.strokeStyle = i % 2 ? '#b66c3e' : '#69433a'; c.lineWidth = 1;
                c.beginPath(); c.moveTo(294, 210); c.lineTo(x, 234); c.lineTo(x - 6, 247); c.stroke();
            }
        } else {
            polygon(c, '#070d17', [[0, 250], [62, 232], [103, 243], [127, 238], [150, 264], [480, 253], [480, 270], [0, 270]]);
            keeper(c, 214, 239, .56); keeper(c, 388, 238, .6); keeper(c, 287, 264, .8);
        }
    }
    private seals(c: C, depth: number) {
        if (depth === 1) {
            const doors = [[169, 188, 40, 64], [227, 197, 48, 82], [296, 211, 67, 131], [363, 197, 48, 82], [422, 188, 40, 64]];
            for (const [x, foot, w, h] of doors) {
                arch(c, x, foot, w, h); c.fillStyle = '#29283c'; c.fillRect(x - w / 2 + 9, foot - h + 30, w - 18, h - 31);
                c.strokeStyle = '#bd9562'; c.lineWidth = 1; c.beginPath(); c.arc(x, foot - h / 2, 8, 0, Math.PI * 2); c.stroke();
                c.fillStyle = '#d1ab73'; c.fillRect(x - 1, foot - h / 2 - 4, 2, 9);
            }
            for (let i = 0; i < 9; i++) {
                const y = 211 + i * i * .7, width = 43 + i * 18; c.fillStyle = i % 2 ? '#35424e' : '#222e3b'; c.fillRect(296 - width / 2, y, width, 3);
            }
            keeper(c, 296, 210, 1.85, true);
            c.fillStyle = '#9b805c'; for (let i = 0; i < 5; i++) c.fillRect(278 + i * 8, 128 - (i % 2) * 6, 4, 10);
            c.fillStyle = '#e8a85f'; c.fillRect(288, 158, 18, 2);
        } else {
            polygon(c, '#080e19', [[0, 240], [57, 209], [99, 227], [131, 202], [161, 270], [0, 270]]);
            polygon(c, '#0d1520', [[398, 270], [424, 210], [444, 225], [460, 191], [480, 206], [480, 270]]);
            keeper(c, 391, 259, .8);
        }
    }
    private lastKeeper(c: C, depth: number) {
        if (depth === 1) {
            arch(c, 350, 236, 130, 188, true);
            masonry(c, 200, 94, 28, 145, 28); masonry(c, 447, 94, 25, 145, 22);
            for (let i = 0; i < 7; i++) { c.fillStyle = '#2a3542'; c.fillRect(265 - i * 8, 230 + i * 5, 162 + i * 14, 3); }
            c.fillStyle = '#a87d50'; c.fillRect(348, 101, 3, 105);
            for (let i = 0; i < 3; i++) { c.strokeStyle = '#91724b'; c.lineWidth = 1; c.beginPath(); c.arc(350, 142, 20 + i * 5, 0, Math.PI * 2); c.stroke(); }
        } else {
            polygon(c, '#0b111c', [[239, 270], [252, 205], [274, 199], [306, 218], [323, 270]]);
            keeper(c, 299, 244, 2.4, true);
            polygon(c, '#3d4c57', [[321, 198], [335, 181], [351, 185], [343, 195], [329, 211]]);
            c.fillStyle = '#a78b63'; c.fillRect(341, 182, 10, 5);
            c.fillStyle = '#101c29'; c.fillRect(346, 165, 13, 17); c.fillStyle = '#cf9a54'; c.fillRect(348, 166, 9, 2); c.fillRect(348, 180, 9, 2);
            c.strokeStyle = '#cb9e61'; c.lineWidth = 1; c.strokeRect(349, 158, 7, 8);
        }
    }
    private descent(c: C, depth: number) {
        if (depth === 1) {
            for (let i = 0; i < 5; i++) {
                const w = 276 - i * 46, h = 246 - i * 38, x = 300, foot = 268 - i * 23;
                arch(c, x, foot, w, h, i === 4);
                c.fillStyle = ['#1d2c3b', '#243543', '#2b3b47', '#3b4146', '#6a4a35'][i]; c.fillRect(x - w / 2 + 11, foot - 4, w - 22, 3);
                c.strokeStyle = '#af8957'; c.lineWidth = 1; c.strokeRect(x - 2, foot - h + 17, 4, 6);
            }
            for (let i = 0; i < 11; i++) { c.fillStyle = i % 2 ? '#5a4a43' : '#263747'; c.fillRect(178 + i * 9, 251 - i * 8, 92 - i * 7, 3); }
        } else {
            polygon(c, '#090f19', [[0, 240], [92, 223], [147, 240], [172, 270], [0, 270]]);
            keeper(c, 283, 251, .95);
            c.fillStyle = '#ad7b4b'; c.fillRect(296, 224, 2, 8);
        }
    }
    private livingLight(c: C, index: number, motion: boolean) {
        const time = motion ? this.time : 0;
        const focus = [[320, 88], [295, 154], [296, 164], [352, 174], [300, 135]][index];
        const [x, y] = focus, strength = motion ? .9 + Math.sin(time * 2.3) * .08 : 1;
        glow(c, x, y, index === 1 ? 93 : index === 3 ? 64 : 54, index === 2 ? '#9c586d35' : '#e8923d55', strength);
        if (index === 1) {
            const pulse = motion ? Math.sin(time * 1.8) * 2 : 0;
            polygon(c, '#9d4f32', [[x - 25, y + 4], [x - 12, y - 31 - pulse], [x + 11, y - 39], [x + 27, y - 7], [x + 17, y + 28], [x - 7, y + 39]]);
            polygon(c, '#ef9c4e', [[x - 15, y - 1], [x - 6, y - 24 - pulse], [x + 9, y - 29], [x + 17, y - 4], [x + 6, y + 25], [x - 9, y + 19]]);
            polygon(c, '#ffe0a0', [[x - 5, y - 10], [x + 3, y - 23], [x + 7, y + 7], [x, y + 17], [x - 5, y + 5]]);
        } else if (index === 3 || index === 4 || index === 0) {
            const h = index === 3 ? 10 : index === 4 ? 18 : 13, flicker = motion ? Math.floor(Math.sin(time * 9) * 2) : 0;
            polygon(c, '#d5773b', [[x - 5, y + 4], [x - 6, y - 3], [x - 2, y - h - flicker], [x + 1, y - 5], [x + 4, y - h + 3], [x + 6, y + 1], [x + 2, y + 6]]);
            c.fillStyle = '#ffe0a0'; c.fillRect(x - 1, y - 4, 3, 9);
        }
        const particleCount = motion ? 35 : 8;
        for (let i = 0; i < particleCount; i++) {
            const n = hash(i, index, 49), speed = 3 + n % 7;
            const px = (n % 480 + (motion ? Math.sin(time / 3 + i) * 5 : 0)) % 480;
            const py = (((n >>> 9) % 270 - time * speed) % 270 + 270) % 270;
            c.fillStyle = i % 4 ? '#c2b9a24a' : '#e8a15d9c'; c.fillRect(Math.round(px), Math.round(py), i % 9 ? 1 : 2, 1);
        }
        if (index === 2) for (let i = 0; i < 5; i++) { const px = [169, 227, 296, 363, 422][i]; glow(c, px, [156, 156, 145, 156, 156][i], 16, '#e2b57525', strength); }
    }
}
