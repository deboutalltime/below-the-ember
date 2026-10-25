type Wave = 'sine' | 'triangle' | 'saw' | 'noise';
interface Layer {
    wave: Wave;
    from: number;
    to: number;
    duration: number;
    gain: number;
    delay?: number;
    attack?: number;
    cutoff?: number;
    highpass?: boolean;
    shimmer?: number;
}
const tone = (from: number, to: number, duration: number, gain: number, wave: Wave = 'sine', delay = 0): Layer => ({ wave, from, to, duration, gain, delay });
const air = (from: number, to: number, duration: number, gain: number, attack = .004): Layer => ({ wave: 'noise', from, to, duration, gain, attack });
/** Original layered sound design. The same PCM synthesis runs in the game and offline previews. */
export const soundRecipes = {
    spark: [tone(760, 210, .13, .25, 'triangle'), air(4200, 750, .09, .27)],
    scatter: [tone(135, 38, .21, .4), air(2300, 180, .23, .5)],
    lance: [tone(1460, 170, .25, .3, 'triangle'), tone(82, 34, .28, .24), air(6000, 800, .17, .3)],
    chain: [{ ...tone(280, 950, .2, .3, 'triangle'), shimmer: 47 }, air(6200, 1600, .13, .22)],
    'spark-special': [tone(920, 200, .27, .3, 'triangle'), air(4800, 430, .24, .33), tone(630, 260, .2, .15, 'sine', .04)],
    'scatter-special': [tone(160, 35, .4, .42), air(3300, 180, .36, .46), tone(480, 110, .3, .15, 'triangle')],
    'lance-special': [tone(1800, 140, .35, .35, 'triangle'), tone(95, 28, .42, .34), air(7400, 450, .25, .37)],
    'chain-special': [{ ...tone(190, 1300, .36, .32, 'triangle'), shimmer: 63 }, air(7500, 700, .29, .35), tone(620, 1550, .3, .14, 'sine', .08)],
    charge: [{ ...tone(130, 1020, 1.24, .19, 'triangle'), attack: .16, shimmer: 18 }, { ...air(250, 2200, 1.24, .1, .28) }],
    'charge-ready': [tone(1240, 1550, .13, .18), tone(1860, 1980, .18, .08, 'sine', .03)],
    dash: [{ ...air(180, 7200, .17, .55, .012), highpass: true }, tone(210, 650, .12, .22, 'triangle'), air(4200, 650, .23, .2, .02)],
    'dash-land': [tone(105, 38, .17, .25), air(1250, 180, .2, .2), tone(660, 440, .18, .08)],
    impact: [air(2800, 600, .075, .3), tone(180, 65, .09, .22)],
    hurt: [tone(130, 40, .19, .35, 'saw'), air(950, 170, .15, .27)],
    heal: [tone(440, 450, .36, .15), tone(554, 568, .4, .14, 'sine', .09), tone(660, 680, .5, .17, 'sine', .18)],
    ricochet: [tone(1760, 530, .16, .2, 'triangle'), tone(2680, 1900, .1, .1), air(5300, 2200, .05, .14)],
    pot: [air(3200, 450, .17, .37), tone(820, 240, .13, .18, 'triangle'), tone(1250, 380, .19, .1, 'sine', .035)],
    stone: [air(1400, 95, .39, .4), tone(90, 28, .42, .37), air(800, 160, .22, .17, .04)],
    ignite: [air(220, 3700, .32, .3, .018), tone(88, 40, .25, .14)],
    'trap-arm': [tone(1600, 700, .055, .2, 'triangle'), tone(1080, 880, .08, .16, 'triangle', .1)],
    trap: [air(4400, 600, .18, .33), tone(710, 160, .18, .23, 'saw')],
    secret: [tone(330, 340, .45, .16), tone(495, 510, .45, .15, 'sine', .1), tone(660, 680, .6, .18, 'sine', .2), air(1300, 3700, .4, .09, .12)],
    'boss-warn': [{ ...tone(82, 160, .82, .3, 'triangle'), attack: .1, shimmer: 7 }, tone(164, 320, .78, .12)],
    'boss-release': [tone(73, 26, .65, .4), air(4000, 110, .6, .42), tone(280, 64, .4, .18, 'saw')],
    revive: [tone(100, 420, .4, .25, 'triangle'), tone(660, 880, .65, .2, 'sine', .14), tone(990, 1320, .65, .15, 'sine', .26)],
    switch: [tone(480, 240, .06, .14, 'triangle'), air(1900, 600, .035, .12)],
    alert: [tone(480, 660, .19, .18, 'triangle')],
    defeat: [tone(150, 36, .25, .23), air(1300, 120, .3, .23)],
    choose: [tone(660, 680, .3, .18), tone(990, 1020, .4, .14, 'sine', .08)],
    clear: [tone(440, 450, .35, .15), tone(550, 565, .4, .15, 'sine', .1), tone(660, 680, .55, .18, 'sine', .2)],
    death: [tone(130, 30, .85, .26, 'triangle'), air(1000, 80, .7, .17, .02)],
    victory: [tone(440, 444, .6, .16), tone(550, 555, .65, .16, 'sine', .16), tone(660, 666, .7, .16, 'sine', .32), tone(880, 888, .8, .17, 'sine', .48)],
    'prologue-city': [{ ...tone(220, 220, 2.3, .21), attack: .08 }, tone(330, 332, 2, .15, 'sine', .18), tone(660, 664, 1.7, .13, 'sine', .4), air(750, 1400, 1.8, .11, .25)],
    'prologue-heart': [{ ...tone(55, 42, 2.5, .3), attack: .12 }, { ...tone(165, 110, 2.3, .16, 'triangle'), attack: .15 }, air(300, 1800, 2, .2, .3), tone(440, 330, 1.8, .1, 'sine', .45)],
    'prologue-seals': [tone(110, 82, 2.6, .27), tone(278, 220, 2.2, .16, 'triangle', .08), tone(523, 392, 1.9, .11, 'sine', .2), air(2100, 100, 1.7, .23, .08)],
    'prologue-keeper': [{ ...tone(330, 332, 2.2, .17), attack: .06 }, tone(495, 498, 2.1, .15, 'sine', .22), tone(660, 664, 1.8, .14, 'sine', .48), air(420, 2700, 1.5, .13, .2)],
    'prologue-descent': [{ ...tone(65.4, 49, 2.8, .24), attack: .12 }, tone(196, 147, 2.5, .14, 'triangle', .1), tone(392, 294, 2.2, .1, 'sine', .3), air(1800, 130, 2.5, .17, .25)],
    step: [air(800, 180, .07, .12), tone(88, 48, .06, .07)],
} satisfies Record<string, Layer[]>;
export type SoundName = keyof typeof soundRecipes;

export function synthesizeSound(name: SoundName, sampleRate = 44100): Float32Array {
    const layers: Layer[] = soundRecipes[name];
    const duration = Math.max(...layers.map(layer => (layer.delay ?? 0) + layer.duration)) + .015;
    const pcm = new Float32Array(Math.ceil(duration * sampleRate));
    let random = 0xbee123;
    for (const layer of layers) {
        const start = Math.floor((layer.delay ?? 0) * sampleRate), count = Math.floor(layer.duration * sampleRate);
        let phase = 0, filtered = 0;
        for (let n = 0; n < count; n++) {
            const time = n / sampleRate, progress = n / count;
            const frequency = layer.from * (layer.to / layer.from) ** progress;
            phase += frequency / sampleRate;
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            const noise = random / 0x80000000 - 1;
            const wave = layer.wave === 'noise' ? noise : layer.wave === 'sine' ? Math.sin(phase * Math.PI * 2)
                : layer.wave === 'triangle' ? 1 - 4 * Math.abs((phase % 1) - .5) : (phase % 1) * 2 - 1;
            let value = wave;
            if (layer.wave === 'noise') {
                const alpha = 1 - Math.exp(-Math.PI * 2 * Math.min(sampleRate * .4, frequency) / sampleRate);
                filtered += alpha * (noise - filtered);
                value = layer.highpass ? noise - filtered : filtered;
            }
            const attack = Math.min(1, time / (layer.attack ?? .003));
            const release = Math.min(1, (layer.duration - time) / .018);
            const decay = name === 'charge' ? .3 + .7 * progress : Math.exp(-4.2 * progress);
            const shimmer = layer.shimmer ? .65 + .35 * Math.sin(time * layer.shimmer * Math.PI * 2) : 1;
            pcm[start + n] += value * attack * release * decay * layer.gain * shimmer;
        }
    }
    let peak = 0;
    for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
    if (peak > .82) for (let i = 0; i < pcm.length; i++) pcm[i] *= .82 / peak;
    return pcm;
}
