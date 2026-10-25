import Phaser from 'phaser';
import { floorThemes, hash, hex } from './theme';

type Painter = (ctx: CanvasRenderingContext2D) => void;
export function createPixelAssets(scene: Phaser.Scene) {
    function texture(key: string, w: number, h: number, paint: Painter) {
        if (scene.textures.exists(key)) return;
        const t = scene.textures.createCanvas(key, w, h)!;
        const ctx = t.context;
        ctx.imageSmoothingEnabled = false;
        paint(ctx);
        t.refresh();
    }
    floorThemes.forEach((theme, f) => {
        for (let v = 0; v < 8; v++) {
            texture(`floor-${f}-${v}`, 16, 16, c => {
                c.fillStyle = hex(theme.mortar); c.fillRect(0, 0, 16, 16);
                c.fillStyle = hex(theme.floor[v % 4]); c.fillRect(1, 1, 14, 14);
                c.fillStyle = hex(theme.edge); c.globalAlpha = .22; c.fillRect(1, 1, 14, 1); c.fillRect(1, 2, 1, 10); c.globalAlpha = 1;
                c.fillStyle = '#00000018'; c.fillRect(2, 14, 13, 1); c.fillRect(14, 2, 1, 12);
                for (let i = 0; i < 7; i++) { const n = hash(i, v, f + 1); c.fillStyle = i % 2 ? hex(theme.dust) : hex(theme.mortar); c.globalAlpha = .2; c.fillRect(2 + n % 11, 2 + (n >>> 5) % 11, i % 3 === 0 ? 2 : 1, 1); }
                c.globalAlpha = 1;
                if (v === 2 || v === 5) { c.fillStyle = hex(theme.mortar); [[8, 1], [8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [9, 7], [10, 8]].forEach(([x, y]) => c.fillRect(x, y, 1, 1)); }
                if (v === 6 && f === 0) { c.fillStyle = '#475047'; c.fillRect(1, 11, 4, 3); c.fillRect(2, 9, 2, 2); c.fillRect(5, 13, 2, 2); }
                if (v === 7) { c.fillStyle = hex(theme.symbol); c.globalAlpha = .55; c.fillRect(5, 4, 6, 1); c.fillRect(5, 4, 1, 7); c.fillRect(10, 4, 1, 7); c.fillRect(7, 7, 2, 5); c.fillRect(5, 11, 6, 1); c.globalAlpha = 1; }
                if (f >= 3 && v === 5) { c.fillStyle = f === 4 ? '#ffbc6a' : '#db683c'; c.fillRect(8, 1, 1, 2); c.fillRect(7, 3, 1, 2); c.fillRect(8, 5, 1, 1); }
            });
            texture(`wall-${f}-${v}`, 16, 24, c => {
                c.fillStyle = '#090d15'; c.fillRect(0, 0, 16, 24);
                c.fillStyle = hex(theme.wall); c.fillRect(0, 1, 16, 9);
                c.fillStyle = hex(theme.edge); c.fillRect(0, 1, 16, 2);
                c.fillStyle = hex(theme.mortar); c.fillRect(0, 10, 16, 12);
                c.fillStyle = hex(theme.floor[1]); c.fillRect(1, 12, 6, 7); c.fillRect(9, 12, 6, 7);
                c.fillStyle = '#ffffff10'; c.fillRect(1, 12, 6, 1); c.fillRect(9, 12, 6, 1);
                c.fillStyle = '#00000038'; c.fillRect(0, 20, 16, 4);
                c.fillStyle = hex(theme.mortar); c.fillRect(v % 2 ? 5 : 10, 3, 1, 7);
                if (v === 3) { c.fillRect(4, 3, 2, 2); c.fillRect(3, 5, 1, 3); c.fillRect(2, 8, 2, 2); }
            });
        }
    });
    for (let type = -1; type <= 5; type++) for (let frame = 0; frame < 4; frame++) {
        const boss = type === 4;
        texture(`actor-${type}-${frame}`, boss ? 48 : 24, boss ? 52 : 32, c => {
            const p = (color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
            const step = [0, 1, 0, -1][frame];
            if (type === -1) {
                p('#10131f', 5, 8, 14, 20); p('#273443', 6, 9, 12, 17);
                p('#344957', 7, 13, 10, 11); p('#192330', 7, 10, 3, 15);
                p('#1c2533', 4, 17, 4, 10 + step); p('#1c2533', 16, 16, 4, 11 - step);
                p('#4e6870', 8, 15, 8, 3); p('#232d3c', 8, 18, 7, 4);
                p('#101724', 6, 5, 12, 9); p('#354955', 8, 3, 8, 2); p('#344955', 6, 5, 12, 3);
                p('#6e7774', 5, 8, 2, 7); p('#1b202d', 8, 8, 8, 6);
                p('#d4bca1', 9, 10, 6, 4); p('#30343e', 9, 10, 6, 2); p('#f8d895', 10, 11, 1, 1); p('#f8d895', 14, 11, 1, 1);
                p('#ff7733', 11, 16, 3, 3); p('#ffdc91', 12, 16, 1, 2);
                p('#101521', 7, 26, 4, 4 + step); p('#101521', 14, 26, 4, 4 - step);
                p('#8a7860', 7, 28 + step, 4, 2); p('#8a7860', 14, 28 - step, 4, 2);
            } else if (type === 0) {
                p('#26212c', 6, 11, 11, 15); p('#77716b', 8, 10, 8, 12); p('#413e45', 8, 16, 8, 8);
                p('#b4a392', 8, 3, 8, 9); p('#696368', 7, 6, 2, 7); p('#262330', 9, 7, 7, 4);
                p('#ff9244', 9, 8, 2, 1); p('#ff9244', 14, 8, 2, 1);
                p('#66616a', 4, 14 + step, 3, 10); p('#a49581', 3, 22 + step, 3, 3); p('#66616a', 17, 12 - step, 3, 11);
                p('#272430', 7, 24, 4, 6 + step); p('#514f55', 14, 24, 3, 6 - step); p('#918571', 2, 24 + step, 3, 4);
            } else if (type === 1) {
                p('#382b32', 7, 9, 10, 18); p('#635349', 8, 13, 8, 12); p('#c5b296', 9, 2, 7, 8); p('#282735', 10, 5, 5, 3);
                p('#ffb55a', 10, 6, 1, 1); p('#ffb55a', 14, 6, 1, 1);
                p('#bfab8c', 7, 12, 2, 10); p('#bfab8c', 16, 13, 2, 8); p('#cfbaa1', 10, 13, 5, 1); p('#cfbaa1', 10, 16, 5, 1); p('#cfbaa1', 10, 19, 5, 1);
                p('#665d58', 8, 25, 3, 5 + step); p('#665d58', 14, 25, 3, 5 - step);
                p('#aa7046', 20, 11, 2, 15); p('#e5a65a', 19, 9, 2, 4); p('#e5a65a', 19, 24, 2, 4); p('#f5cf8a', 18, 11, 1, 15); p('#ff7733', 20, 16, 2, 4);
            } else if (type === 2) {
                p('#161e2b', 1, 8, 22, 18); p('#687482', 2, 9, 7, 9); p('#687482', 16, 9, 7, 9); p('#8b9397', 3, 8, 6, 3); p('#8b9397', 16, 8, 6, 3);
                p('#4e606e', 7, 10, 11, 15); p('#869196', 8, 12, 9, 3); p('#343f50', 8, 17, 9, 7);
                p('#96a09f', 8, 2, 9, 9); p('#3d495a', 9, 5, 7, 5); p('#ffc16a', 10, 6, 5, 1);
                p('#ff9657', 11, 14, 2, 9); p('#ffba6d', 13, 18, 3, 1);
                p('#435060', 3, 18, 5, 7); p('#435060', 18, 18, 5, 7); p('#85908f', 2, 22, 5, 3);
                p('#343c4b', 5, 25, 6, 5 + step); p('#343c4b', 14, 25, 6, 5 - step);
            } else if (type === 3) {
                p('#171523', 3, 16, 19, 12); p('#3a2c4f', 6, 12, 12, 12); p('#665079', 6, 16, 5, 5);
                p('#322340', 8, 5, 11, 12); p('#58426b', 10, 7, 9, 7); p('#151321', 11, 11, 8, 6);
                p('#c9a3fa', 13, 12, 2, 1); p('#c9a3fa', 18, 12, 2, 1); p('#9974d8', 8, 4, 3, 4); p('#9974d8', 18, 2, 2, 5);
                p('#352943', 1, 23 + step, 6, 5); p('#ac98c1', 0, 27 + step, 4, 2); p('#352943', 17, 22 - step, 6, 6); p('#ac98c1', 19, 27 - step, 5, 2);
            } else if (type === 5) {
                p('#142633', 5, 10, 14, 20); p('#354c65', 7, 12, 10, 15); p('#182b40', 5, 5, 14, 11); p('#526681', 8, 3, 8, 4); p('#071521', 8, 9, 8, 6); p('#54d6da', 10, 11, 2, 1); p('#54d6da', 14, 11, 2, 1); p('#a5c0b8', 10, 18, 4, 3); p('#273849', 7, 26, 4, 4 + step); p('#273849', 14, 26, 4, 4 - step); p('#9b8668', 21, 8, 1, 23); p('#54d6da', 19, 4, 5, 5); p('#d5fff0', 20, 5, 2, 2);
            } else {
                p('#17151e', 5, 16, 38, 30); p('#493c48', 7, 17, 34, 25); p('#6b5360', 3, 15, 13, 14); p('#6b5360', 32, 15, 13, 14);
                p('#a17a67', 5, 15, 10, 4); p('#a17a67', 33, 15, 10, 4); p('#292631', 12, 21, 25, 23);
                p('#965b43', 19, 20, 11, 17); p('#ff7733', 22, 23, 5, 13); p('#ffdda0', 23, 25, 2, 8);
                p('#6b5960', 16, 6, 16, 15); p('#302431', 18, 11, 12, 9); p('#ffb864', 19, 13, 4, 2); p('#ffb864', 27, 13, 4, 2);
                p('#d0a36e', 15, 3, 3, 8); p('#d0a36e', 23, 0, 3, 8); p('#d0a36e', 31, 3, 3, 8); p('#ffbd66', 17, 5, 15, 3);
                p('#54454f', 4, 30, 9, 13); p('#54454f', 36, 30, 9, 13); p('#9d7461', 3, 39, 10, 5);
                p('#302933', 12, 42, 10, 8 + step); p('#302933', 28, 42, 10, 8 - step);
            }
        });
    }
    texture('chest', 24, 24, c => { c.fillStyle = '#111823'; c.fillRect(3, 7, 19, 15); c.fillStyle = '#78563a'; c.fillRect(4, 9, 17, 11); c.fillStyle = '#ba8b53'; c.fillRect(4, 7, 17, 6); c.fillStyle = '#d8b273'; c.fillRect(5, 8, 2, 12); c.fillRect(18, 8, 2, 12); c.fillRect(4, 13, 17, 1); c.fillStyle = '#ffc16a'; c.fillRect(11, 12, 4, 5); c.fillStyle = '#453127'; c.fillRect(12, 14, 2, 2); });
    texture('chest-open', 24, 24, c => { c.fillStyle = '#46382e'; c.fillRect(4, 4, 17, 6); c.fillStyle = '#aa814d'; c.fillRect(4, 5, 17, 2); c.fillRect(4, 13, 17, 8); c.fillStyle = '#181c23'; c.fillRect(6, 13, 13, 5); c.fillStyle = '#d8b273'; c.fillRect(5, 13, 2, 8); c.fillRect(18, 13, 2, 8); });
    texture('shrine', 24, 32, c => { c.fillStyle = '#26333e'; c.fillRect(2, 26, 21, 5); c.fillStyle = '#526370'; c.fillRect(4, 23, 17, 5); c.fillRect(7, 16, 11, 8); c.fillStyle = '#879292'; c.fillRect(6, 15, 13, 3); c.fillStyle = '#254c57'; c.fillRect(9, 4, 7, 11); c.fillStyle = '#54d6da'; c.fillRect(11, 2, 3, 15); c.fillRect(9, 5, 7, 8); c.fillStyle = '#baefdf'; c.fillRect(11, 3, 2, 10); });
    texture('pillar', 24, 40, c => { c.fillStyle = '#101722'; c.fillRect(3, 5, 19, 34); c.fillStyle = '#424c58'; c.fillRect(6, 5, 13, 29); c.fillStyle = '#62707a'; c.fillRect(7, 6, 3, 27); c.fillStyle = '#2e3946'; c.fillRect(15, 6, 4, 27); c.fillStyle = '#68717a'; c.fillRect(3, 2, 19, 5); c.fillStyle = '#46515d'; c.fillRect(2, 34, 21, 4); c.fillStyle = '#777a7a'; c.fillRect(2, 33, 21, 2); c.fillStyle = '#1c2633'; c.fillRect(12, 6, 1, 9); c.fillRect(11, 14, 2, 3); });
    texture('pot', 12, 16, c => { c.fillStyle = '#26212b'; c.fillRect(2, 4, 8, 11); c.fillStyle = '#86624e'; c.fillRect(1, 7, 10, 6); c.fillStyle = '#b0926c'; c.fillRect(3, 3, 6, 2); c.fillStyle = '#4c3b39'; c.fillRect(4, 4, 5, 2); c.fillStyle = '#a77d59'; c.fillRect(2, 8, 2, 4); c.fillStyle = '#3d3031'; c.fillRect(8, 7, 2, 6); });
    texture('crystal', 16, 24, c => { c.fillStyle = '#243c51'; c.fillRect(2, 12, 5, 9); c.fillRect(10, 10, 4, 12); c.fillStyle = '#339aaf'; c.fillRect(6, 3, 5, 18); c.fillRect(4, 7, 9, 9); c.fillStyle = '#54d6da'; c.fillRect(6, 5, 3, 13); c.fillStyle = '#a9e8dc'; c.fillRect(7, 5, 1, 10); });
}
