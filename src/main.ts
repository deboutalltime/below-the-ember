import Phaser from 'phaser';
import './style.css';
import './adventure.css';
import './story/prologue.css';
import { Run, themes, upgrades, weapons } from './simulation';
import { laboratory } from './lab';
import { advancedLaboratory } from './intelligence/AdvancedLab';
import { WorldRenderer } from './visuals/WorldRenderer';
import { VIEW, floorThemes, rarity } from './visuals/theme';
import { icon, upgradeIcons } from './ui/icons';
import { HUD } from './ui/HUD';
import { EmberAudio } from './ui/audio';
import { read, write, escapeHTML, timeLabel } from './ui/utils';
import { eventHTML, campHTML, duelHTML } from './ui/AdventurePanels';
import { PrologueView } from './story/PrologueView';
import { PlayfieldInput } from './game/PlayfieldInput';
import { musicFor } from './audio/musicState';
import { MusicTheme, musicTitles } from './audio/score';

const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const hud = new HUD(document.querySelector<HTMLDivElement>('#hud')!, index => run?.selectWeapon(index));
// Explicit development-only art fixtures. Never save them as a real campaign.
const artReview = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV && new URLSearchParams(location.search).has('art-review');
let scene: World;
let run: Run | undefined;
let paused = true, debug = false, lastStatus = '', lastSave = 0;
let screen = 'menu', selectionPending = false;
let story: PrologueView | undefined, menuSeed = '';
const playfieldInput = new PlayfieldInput();
let tensionUntil = 0;
const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = {
    sound: Number(read('ember-sound', '.35')), music: Number(read('ember-music', '.15')),
    effects: Number(read('ember-vfx', '.8')), shake: read('ember-shake', 'true') === 'true',
    reducedMotion: read('ember-reduced-motion', String(systemReduced)) === 'true',
};
const audio = new EmberAudio(() => settings);
function applyPreferences() {
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.style.setProperty('--effects', String(settings.effects));
}
applyPreferences();
const bind = (id: string, action: () => void) => { document.getElementById(id)!.onclick = action; };

function panel(content: string, cls = '', focus?: string) {
    overlay.className = 'shown';
    overlay.innerHTML = `<section class="dialog ${cls}">${content}</section>`;
    if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
}
function dismiss() { overlay.innerHTML = ''; overlay.className = ''; screen = 'game'; }
function openLaboratory() { screen = 'lab'; document.body.dataset.screen = 'lab'; overlay.className = 'shown archive-overlay'; hud.clear(); laboratory(menu, () => settings.reducedMotion, openAdvancedLaboratory); }
function openAdvancedLaboratory() { screen = 'lab'; document.body.dataset.screen = 'lab'; overlay.className = 'shown archive-overlay'; hud.clear(); advancedLaboratory(openLaboratory, menu, () => settings.reducedMotion); }
function closeStory() { story?.destroy(); story = undefined; }
function openStory(onFinish: () => void = menu, replay = true) {
    audio.stopMusicPreview();
    closeStory(); audio.silenceAction(); paused = true; run = undefined; screen = 'prologue'; hud.clear(); scene.keysReset();
    document.getElementById('floor-announcement')?.remove(); document.body.dataset.screen = 'prologue';
    story = new PrologueView(overlay, {
        language: read('ember-story-language', 'en') === 'ru' ? 'ru' : 'en',
        reducedMotion: settings.reducedMotion, showBeforeRun: read('ember-show-intro', 'true') !== 'false', replay, audio,
        onLanguage: language => write('ember-story-language', language),
        onPreference: show => write('ember-show-intro', String(show)),
        onFinish: () => { story = undefined; onFinish(); },
    });
}
function menu() {
    closeStory();
    audio.silenceAction(); audio.stopMusicPreview(); playfieldInput.reset();
    paused = true; run = undefined; lastStatus = ''; screen = 'menu'; hud.clear();
    document.body.dataset.screen = 'menu';
    panel(`
      <div class="menu-topline"><span>${icon('ember')} AN ORIGINAL DARK FANTASY ROGUELITE</span><button id="story" class="menu-story">WATCH PROLOGUE ↗</button></div>
      <div class="menu-content"><div class="title-ornament"><i></i><span>THE LAST DESCENT</span><i></i></div><h1>BELOW<br><span>THE EMBER</span></h1><p class="menu-tagline">The last flame waits below.</p>
      <nav class="menu-nav" aria-label="Main menu">
        <button class="menu-option" id="new"><span class="menu-number">01</span>NEW RUN<span class="option-arrow">↗</span></button>
        <button class="menu-option" id="continue" ${read('ember-save') ? '' : 'disabled'}><span class="menu-number">02</span>CONTINUE</button>
        <button class="menu-option" id="lab"><span class="menu-number">03</span>AI LABORATORY<span class="archive-tag">ARCHIVE</span></button>
        <button class="menu-option" id="help"><span class="menu-number">04</span>HOW TO PLAY</button>
        <button class="menu-option" id="settings"><span class="menu-number">05</span>SETTINGS</button>
        <button class="menu-option" id="exit"><span class="menu-number">06</span>EXIT</button>
      </nav><div class="seed-field"><label for="seed">FATE / SEED <span>OPTIONAL</span></label><input id="seed" placeholder="Let the ember decide" maxlength="60" autocomplete="off" value="${escapeHTML(menuSeed)}"></div></div>
      <div class="menu-records"><div><span>DEEPEST DESCENT</span><b>${escapeHTML(read('ember-best-floor', '0'))} <em>/ 5</em></b></div><div><span>HIGHEST SCORE</span><b>${escapeHTML(read('ember-best-score', '0'))}</b></div></div>
      <div class="menu-footer"><span>FIVE FLOORS. ONE FLAME.</span><span><kbd>↑</kbd><kbd>↓</kbd> NAVIGATE <kbd>ENTER</kbd> SELECT</span><span>v2.3.2 · FINAL PROJECT EDITION</span></div>
    `, 'menu-shell', 'new');
    document.querySelector<HTMLInputElement>('#seed')!.oninput = event => { menuSeed = (event.target as HTMLInputElement).value; };
    bind('new', () => start(menuSeed.trim() || String(Date.now()), true));
    bind('story', () => openStory());
    bind('continue', () => { try { run = Run.restore(read('ember-save')); begin(); } catch { write('ember-save', ''); menu(); } });
    bind('lab', openLaboratory);
    bind('help', howToPlay); bind('settings', () => showSettings(menu));
    bind('exit', () => {
        screen = 'exit'; panel(`<div class="sigil">${icon('ember')}</div><small>Until the next descent</small><h2>The gate will wait.</h2><p>You can close this browser tab safely.<br>Your floor checkpoint and settings are kept on this device.</p><button class="primary" id="return">RETURN TO THE GATE</button>`, 'centered', 'return'); bind('return', menu);
    });
}
function howToPlay() {
    screen = 'help'; panel(`<small>THE KEEPER'S FIELD NOTES</small><h2>Carry the last flame.</h2><p>Explore five floors with different encounters. Protect the ward, escape collapsing edges and decide whether to accept the no-flask oath. Clear required objectives to unseal the stairs.</p><div class="field-note">1–4: switch weapon. LMB: fire (hold to charge the lance). RMB: special attack, paid in heat. SHIFT: sneak. High heat boosts damage and enemy vision; low heat favors concealment. Ignite oil, shoot traps and cracked seals, topple columns with E.</div><div class="control-table"><div><span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd></span><b>Move through the ruins</b></div><div><span><kbd>MOUSE</kbd> + <kbd>LMB</kbd></span><b>Aim & fire the ember weapon</b></div><div><span><kbd>SPACE</kbd></span><b>Dash · brief invulnerability</b></div><div><span><kbd>Q</kbd></span><b>Drink a flask · restore 30 HP</b></div><div><span><kbd>E</kbd></span><b>Descend at an unsealed exit</b></div><div><span><kbd>ESC</kbd> / <kbd>F3</kbd></span><b>Pause / reveal AI observations</b></div></div><div class="field-note">${icon('eye')} Walls block enemy vision. Keep moving, use corners, and step outside the Warden's marked attack circle.</div><p class="fineprint">Continue restores your statistics at the entrance of the current floor. Its encounters begin again.</p><button id="back">← MAIN MENU</button>`, 'guide', 'back'); bind('back', menu);
}
function showSettings(back: () => void) {
    screen = 'settings';
    panel(`<small>ATTUNE THE EXPERIENCE</small><h2>Sound & atmosphere</h2><div class="setting"><label for="sound">Sound effects <output id="sound-value">${Math.round(settings.sound * 100)}%</output></label><input id="sound" type="range" min="0" max="1" step=".05" value="${settings.sound}"></div><div class="setting"><label for="music">Music volume <output id="music-value">${Math.round(settings.music * 100)}%</output></label><input id="music" type="range" min="0" max="1" step=".05" value="${settings.music}"></div><div class="setting"><label for="effects">Particles & light intensity <output id="effects-value">${Math.round(settings.effects * 100)}%</output></label><input id="effects" type="range" min="0" max="1" step=".1" value="${settings.effects}"></div><label class="toggle"><input id="shake" type="checkbox" ${settings.shake ? 'checked' : ''}><span>Camera shake</span><small>BRIEF DAMAGE FEEDBACK</small></label><label class="toggle"><input id="reduced" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}><span>Reduced motion</span><small>FEWER PARTICLES, NO TRANSITION MOTION</small></label><p class="fineprint">Critical attack warnings stay visible at every effects level. Audio and artwork are generated locally.</p><button id="back" class="primary">SAVE & RETURN</button>`, 'settings-dialog', 'back');
    for (const name of ['sound', 'music', 'effects'] as const) document.querySelector<HTMLInputElement>('#' + name)!.oninput = e => {
        settings[name] = Number((e.target as HTMLInputElement).value); write(name === 'effects' ? 'ember-vfx' : 'ember-' + name, String(settings[name]));
        document.querySelector('#' + name + '-value')!.textContent = `${Math.round(settings[name] * 100)}%`; applyPreferences();
    };
    document.querySelector<HTMLInputElement>('#shake')!.onchange = e => { settings.shake = (e.target as HTMLInputElement).checked; write('ember-shake', String(settings.shake)); };
    const fullAnimation = document.querySelector<HTMLInputElement>('#reduced')!;
    fullAnimation.id = 'full-animation'; fullAnimation.checked = !settings.reducedMotion;
    const animationLabel = fullAnimation.closest('label')!;
    animationLabel.querySelector('span')!.textContent = 'Full animation';
    animationLabel.querySelector('small')!.textContent = 'DASH TRAIL · LIVING FLAME · PROLOGUE MOTION';
    const animationStatus = document.createElement('p'); animationStatus.className = 'fineprint motion-status'; animationStatus.id = 'animation-status'; animationStatus.setAttribute('aria-live', 'polite');
    const refreshAnimationStatus = () => { animationStatus.textContent = settings.reducedMotion ? 'Reduced animation. Moving dash trails and prologue motion are off.' : 'Full animation is on. Choose WATCH PROLOGUE in the menu, or press Space to dash during a run.'; };
    refreshAnimationStatus(); animationLabel.after(animationStatus);
    fullAnimation.onchange = () => { settings.reducedMotion = !fullAnimation.checked; write('ember-reduced-motion', String(settings.reducedMotion)); applyPreferences(); refreshAnimationStatus(); };
    const preview = document.createElement('button'); preview.id = 'preview-dash'; preview.textContent = 'PREVIEW DASH SOUND';
    preview.style.marginTop = '12px'; document.getElementById('back')!.before(preview);
    let dashTimer = 0, musicTimer = 0, previewing = false;
    preview.onclick = () => { window.clearTimeout(dashTimer); audio.unlock(); audio.play('dash'); dashTimer = window.setTimeout(() => audio.play('dash-land'), 165); };
    const musicPreview = document.createElement('div'); musicPreview.className = 'score-preview';
    const themes: MusicTheme[] = ['menu', 'explore', 'combat', 'boss', 'camp', 'story', 'victory', 'defeat'];
    musicPreview.innerHTML = `<label for="music-theme">LISTEN TO THE SOUNDTRACK</label><div><select id="music-theme">${themes.map(theme => `<option value="${theme}">${musicTitles[theme]}</option>`).join('')}</select><button id="preview-music">PLAY MUSIC</button></div><p id="music-preview-status" aria-live="polite">The score changes with exploration, combat and the Warden.</p>`;
    preview.before(musicPreview);
    const musicButton = musicPreview.querySelector<HTMLButtonElement>('button')!, themeSelect = musicPreview.querySelector<HTMLSelectElement>('select')!;
    const stopPreview = () => { audio.stopMusicPreview(); window.clearTimeout(musicTimer); previewing = false; musicButton.textContent = 'PLAY MUSIC'; };
    musicButton.onclick = () => {
        if (previewing) { stopPreview(); musicPreview.querySelector('p')!.textContent = 'Preview stopped.'; return; }
        audio.previewMusic(themeSelect.value as MusicTheme); previewing = true; musicButton.textContent = 'STOP PREVIEW';
        musicPreview.querySelector('p')!.textContent = settings.music > 0 ? `${musicTitles[themeSelect.value as MusicTheme]} · 12 second preview` : 'Raise Music volume above to hear the score.';
        musicTimer = window.setTimeout(() => { stopPreview(); musicPreview.querySelector('p')!.textContent = 'Preview complete.'; }, 12000);
    };
    themeSelect.onchange = () => stopPreview();
    bind('back', () => { stopPreview(); window.clearTimeout(dashTimer); back(); });
}
function start(seed: string, withStory = false) {
    const launch = () => { audio.unlock(); run = new Run(seed); begin(); audio.play('choose'); };
    if (withStory && read('ember-show-intro', 'true') !== 'false') openStory(launch, false); else launch();
}
function begin() {
    closeStory();
    tensionUntil = 0;
    paused = false; lastStatus = ''; selectionPending = false; dismiss(); document.body.dataset.screen = 'game';
    scene.prepare(run!); scene.cameras.main.setScroll(run!.x * VIEW.worldScale - 240, run!.y * VIEW.worldScale - 135); scene.keysReset();
    hud.mount(); hud.update(run!, debug); save(); floorTitle();
    if (!settings.reducedMotion) scene.cameras.main.fadeIn(240, 11, 13, 18);
}
function save() { if (!artReview && run && run.status !== 'dead' && run.status !== 'victory') write('ember-save', run.save()); }
function floorTitle() {
    if (!run) return;
    document.getElementById('floor-announcement')?.remove();
    const div = document.createElement('div'); div.id = 'floor-announcement'; div.className = 'floor-announcement';
    div.innerHTML = `<small>DESCENT ${String(run.floor).padStart(2, '0')}</small><strong>${themes[run.floor - 1]}</strong><em>${floorThemes[run.floor - 1].epithet}</em>`;
    document.body.append(div); window.setTimeout(() => div.remove(), 2500);
}
function resume() { paused = false; dismiss(); scene.keysReset(); }
function pause() {
    if (!run || run.status !== 'playing') return;
    paused = true; screen = 'pause'; run.cancelCharge(); scene.keysReset(); audio.pauseEffects(); audio.setMusic('silence'); audio.sync(); save();
    panel(`<div class="sigil">${icon('ember')}</div><small>THE FLAME IS STILL</small><h2>A moment in the dark.</h2><p>Descent ${run.floor} · ${themes[run.floor - 1]}</p><div class="pause-stats"><span>${icon('heart')} ${Math.ceil(run.hp)} HP</span><span>${icon('skull')} ${run.kills} DEFEATED</span><span>${timeLabel(run.elapsed)}</span></div><div class="actions"><button id="resume" class="primary">RESUME</button><button id="settings">SETTINGS</button><button id="quit">SAVE & MAIN MENU</button></div><p class="fineprint">Progress is saved at this floor's entrance checkpoint.</p>`, 'centered', 'resume');
    bind('resume', resume); bind('settings', () => showSettings(pause)); bind('quit', menu);
}
function status() {
    if (!run || run.status === lastStatus) return;
    lastStatus = run.status;
    if (run.status === 'playing') return;
    run.cancelCharge();
    audio.silenceAction();
    if (run.status === 'camp') { showCamp(); return; }
    if (run.status === 'event') { showEvent(); return; }
    if (run.status === 'duel') { showDuel(); return; }
    if (run.status === 'upgrade') {
        screen = 'upgrade'; audio.play('clear');
        panel(`<small>CHAMBER CLEARED / A BLESSING AWAKENS</small><h2>THE EMBER GROWS STRONGER</h2><p class="upgrade-subtitle">Choose the power you will carry deeper.</p><div class="cards">${run.picks.map((i, n) => `<button class="upgrade-card" id="pick${i}" style="--rarity:${rarity[i].color}"><span class="card-index">0${n + 1}</span><span class="rarity-label">${rarity[i].name}</span><div class="card-icon">${icon(upgradeIcons[i])}</div><h3>${upgrades[i][1]}</h3><p>${upgrades[i][2]}</p><span class="card-choose"><kbd>${n + 1}</kbd> CHOOSE THIS BLESSING</span></button>`).join('')}</div><div class="choice-rule"><i></i> ONE FLAME · ONE CHOICE <i></i></div>`, 'upgrade-dialog', 'pick' + run.picks[0]);
        for (const i of run.picks) bind('pick' + i, () => {
            if (selectionPending) return; selectionPending = true;
            document.getElementById('pick' + i)!.classList.add('selected'); audio.play('choose');
            window.setTimeout(() => { run!.choose(i); selectionPending = false; if (run!.status === 'camp') { lastStatus = 'camp'; showCamp(); } else { dismiss(); scene.keysReset(); lastStatus = 'playing'; } }, settings.reducedMotion ? 0 : 140);
        });
    } else {
        screen = 'end'; const won = run.status === 'victory';
        if (!artReview) { write('ember-save', ''); write('ember-best-floor', String(Math.max(Number(read('ember-best-floor', '0')), run.floor))); write('ember-best-score', String(Math.max(Number(read('ember-best-score', '0')), run.score))); }
        panel(`<div class="end-symbol ${won ? 'gold' : 'ash'}">${icon('ember')}</div><small>${won ? 'THE LAST LIGHT RETURNS' : 'THE RUINS REMEMBER YOUR NAME'}</small><h2>${won ? 'THE FLAME ENDURES' : 'THE EMBER HAS FADED'}</h2><p class="end-quote">${won ? 'From the deepest darkness, a new light rises.' : 'Even the brightest flame can fall.'}</p><div class="end-stats"><div><span>${won ? 'FLOORS COMPLETED' : 'FLOOR REACHED'}</span><strong>${run.floor}<em> / 5</em></strong></div><div><span>HOSTILES DEFEATED</span><strong>${run.kills}</strong></div><div><span>TIME ${won ? 'OF DESCENT' : 'SURVIVED'}</span><strong>${timeLabel(run.elapsed)}</strong></div><div><span>BLESSINGS CARRIED</span><strong>${run.owned.length}</strong></div></div>${won ? `<div class="final-build"><span>${Math.ceil(run.maxHP)} MAX HP</span><span>${run.damage.toFixed(0)} DAMAGE</span><span>${run.rate.toFixed(1)} SHOTS / SEC</span><span>${run.split} PROJECTILES</span></div>` : ''}<div class="end-score"><small>FINAL SCORE</small><b>${run.score.toLocaleString()}</b></div><div class="end-seed">SEED · ${escapeHTML(run.seed)}</div><div class="actions"><button class="primary" id="again">${won ? 'NEW RUN' : 'TRY AGAIN'}</button><button id="menu">MAIN MENU</button></div>`, `end-dialog centered ${won ? 'victory' : 'defeat'}`, 'again');
        const seed = run.seed; bind('again', () => start(won ? String(Date.now()) : seed, won)); bind('menu', menu);
    }
}

function showEvent() {
    if (!run?.event) return; screen = 'event'; panel(eventHTML(run), 'adventure-dialog');
    overlay.querySelectorAll<HTMLButtonElement>('[data-event]').forEach(button => button.onclick = () => { run!.selectEvent(button.dataset.event!); dismiss(); scene.keysReset(); lastStatus = 'playing'; });
}
function showCamp() {
    if (!run) return; screen = 'camp'; panel(campHTML(run), 'camp-dialog', 'camp-descend');
    overlay.querySelectorAll<HTMLButtonElement>('[data-camp]').forEach(button => button.onclick = () => { run!.campAction(button.dataset.camp!); if (run!.status === 'upgrade') { lastStatus = ''; status(); } else showCamp(); });
    bind('camp-descend', () => { run!.campAction('descend'); paused = false; dismiss(); lastStatus = 'playing'; scene.keysReset(); });
}
function showDuel() {
    if (!run) return; screen = 'duel'; panel(duelHTML(run), 'duel-dialog centered');
    overlay.querySelectorAll<HTMLButtonElement>('[data-rune]').forEach(button => button.onclick = () => { run!.duelMove(Number(button.dataset.rune)); showDuel(); });
    bind('duel-leave', () => { run!.closeDuel(); dismiss(); lastStatus = 'playing'; scene.keysReset(); });
}

window.addEventListener('keydown', e => {
    if (screen === 'prologue') return;
    if (e.key === 'Escape') {
        e.preventDefault();
        if (run?.status === 'playing') { if (paused) resume(); else pause(); }
        else if (screen === 'help' || screen === 'settings' || screen === 'exit') menu();
        return;
    }
    if (e.key === 'F3') { e.preventDefault(); debug = !debug; return; }
    if (screen === 'event' && /^[1-5]$/.test(e.key)) { const option = run?.event?.options[Number(e.key) - 1]; if (option) overlay.querySelector<HTMLButtonElement>(`[data-event="${option.id}"]`)?.click(); return; }
    if (screen === 'duel' && /^[1-9]$/.test(e.key)) { run!.duelMove(Number(e.key) - 1); showDuel(); return; }
    if (screen === 'upgrade' && /^[123]$/.test(e.key)) { const i = run!.picks[Number(e.key) - 1]; document.getElementById('pick' + i)?.click(); return; }
    if (!overlay.innerHTML || screen === 'lab') return;
    if ((e.target as HTMLElement).matches('input, select, textarea')) { if (e.key === 'Enter' && screen === 'menu') document.getElementById('new')?.click(); return; }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); const buttons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement), delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
    }
});
const isPlayfield = (event: Event) => screen === 'game' && !paused && event.target instanceof Element && event.target.matches('#game canvas');
document.addEventListener('pointerdown', event => {
    const world = isPlayfield(event); playfieldInput.press(event.button, world);
    if (world) (event.target as HTMLCanvasElement).focus({ preventScroll: true });
    else if (screen === 'game') run?.cancelCharge();
}, true);
document.addEventListener('pointermove', event => { playfieldInput.move(isPlayfield(event)); if (playfieldInput.interrupted && run?.charge) run.cancelCharge(); }, true);
document.addEventListener('pointerup', event => playfieldInput.release(event.button), true);
document.addEventListener('pointercancel', () => { playfieldInput.reset(); run?.cancelCharge(); }, true);
document.addEventListener('keydown', event => {
    if (screen !== 'game' || event.key === 'Escape' || !(event.target instanceof Element)) return;
    const editable = event.target.closest('input, select, textarea');
    if (editable || ([' ', 'Enter'].includes(event.key) && event.target.closest('button, summary, a'))) event.stopPropagation();
}, true);
window.addEventListener('blur', () => { playfieldInput.reset(); if (run?.status === 'playing' && !paused) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { playfieldInput.reset(); audio.pauseEffects(); if (run?.status === 'playing' && !paused) pause(); } audio.sync(); });
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('keydown', () => audio.unlock(), { once: true });

class World extends Phaser.Scene {
    view!: WorldRenderer;
    keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private floor = 0;
    private oldHP = 100;
    private hudTick = 0;
    constructor() { super('world'); }
    create() {
        scene = this; this.cameras.main.setBackgroundColor('#0b0d12'); this.view = new WorldRenderer(this, () => settings, (type, options) => type === 'stop-charge' ? audio.stop('charge') : audio.play(type, options));
        this.game.canvas.tabIndex = 0; this.game.canvas.setAttribute('aria-label', 'Dungeon playfield');
        this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E,SHIFT,ONE,TWO,THREE,FOUR') as Record<string, Phaser.Input.Keyboard.Key>;
        for (const [i, key] of ['ONE', 'TWO', 'THREE', 'FOUR'].entries()) this.input.keyboard!.on('keydown-' + key, () => { if (screen === 'game') run?.selectWeapon(i); });
        this.input.keyboard!.on('keydown-Q', () => { if (screen === 'game' && run?.status === 'playing') run.heal(); });
        this.input.keyboard!.on('keydown-E', () => { if (screen === 'game' && run?.status === 'playing') run.interact(); });
        this.input.mouse!.disableContextMenu(); menu();
        if (artReview) mountArtReview();
    }
    keysReset() { this.input.keyboard?.resetKeys(); playfieldInput.reset(); }
    prepare(value: Run) { this.floor = value.floor; this.oldHP = value.hp; this.view.build(value); }
    update(time: number, ms: number) {
        if (screen !== 'prologue') {
            const foes = run?.enemies.filter(enemy => ['ALERT', 'CHASE', 'ATTACK'].includes(enemy.ai.state) && Math.hypot(enemy.x - run!.x, enemy.y - run!.y) < 300) ?? [];
            if (foes.length && !paused && screen === 'game') tensionUntil = time + 2500;
            const boss = run?.enemies.find(enemy => enemy.kind === 4 && (enemy.room === run!.room || foes.includes(enemy)));
            audio.setMusic(musicFor({ screen, paused, hidden: document.hidden, hasRun: Boolean(run), status: run?.status, threatened: time < tensionUntil, boss: Boolean(boss) }), run?.floor ?? 1, boss?.phase === 2 ? 2 : 1);
        }
        audio.sync();
        if (artReview) { const meter = document.getElementById('sound-meter'); if (meter) meter.textContent = 'SFX · ' + audio.diagnostics(); }
        const dt = Math.min(ms / 1000, .04);
        const active = !paused && screen === 'game' && run?.status === 'playing';
        this.input.keyboard!.enabled = Boolean(active);
        if (!run) { this.view.menu(time, dt); return; }
        const moving = this.keys.W.isDown || this.keys.S.isDown || this.keys.A.isDown || this.keys.D.isDown || this.keys.UP.isDown || this.keys.DOWN.isDown || this.keys.LEFT.isDown || this.keys.RIGHT.isDown;
        const p = this.input.activePointer, cam = this.cameras.main;
        const angle = Math.atan2((p.y + cam.scrollY) / VIEW.worldScale - run.y, (p.x + cam.scrollX) / VIEW.worldScale - run.x);
        if (active && playfieldInput.overWorld) this.view.setAim(angle);
        if (active) {
            const dash = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
            run.update(dt, { x: Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown), y: Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown), shoot: playfieldInput.shoot && p.isDown && p.leftButtonDown(), alternate: playfieldInput.alternate && p.isDown && p.rightButtonDown(), sneak: this.keys.SHIFT.isDown, angle, dash });
            if (run.hp < this.oldHP) { if (settings.shake && !settings.reducedMotion) cam.shake(90, .003); document.querySelector('#hud')!.classList.remove('hurt'); void (document.querySelector('#hud') as HTMLElement).offsetWidth; document.querySelector('#hud')!.classList.add('hurt'); }
            if (time - lastSave > 30000 && run.status === 'playing') { lastSave = time; save(); }
        }
        this.oldHP = run.hp;
        if (this.floor !== run.floor) { this.floor = run.floor; tensionUntil = 0; this.view.build(run); save(); if (this.floor > 1) { floorTitle(); if (!settings.reducedMotion) cam.fadeIn(230, 11, 13, 18); } }
        const factor = active ? settings.reducedMotion ? 1 : 1 - Math.exp(-12 * dt) : 0;
        cam.scrollX = Phaser.Math.Linear(cam.scrollX, run.x * VIEW.worldScale - VIEW.width / 2, factor); cam.scrollY = Phaser.Math.Linear(cam.scrollY, run.y * VIEW.worldScale - VIEW.height / 2, factor);
        this.view.render(run, time, dt, moving && Boolean(active), debug, Boolean(active));
        status();
        if (time - this.hudTick > 80) { this.hudTick = time; hud.update(run, debug); }
    }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#0b0d12', pixelArt: true, roundPixels: true, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: VIEW.width, height: VIEW.height }, scene: [World], render: { antialias: false, pixelArt: true }, fps: { target: 60 } });

function mountArtReview() {
    const bar = document.createElement('nav'); bar.id = 'art-review'; bar.setAttribute('aria-label', 'Development visual fixtures');
    bar.innerHTML = `<span>DEV · VISUAL FIXTURES · NO SAVES</span>${[1, 2, 3, 4, 5].map(f => `<button data-floor="${f}">FLOOR ${f}</button>`).join('')}${['camp', 'altar', 'trial', 'duel', 'defense', 'collapse', 'choice'].map(name => `<button data-preview="${name}">${name.toUpperCase()}</button>`).join('')}<button data-preview="dash">DASH FRAME</button><button data-preview="charge">CHARGE FRAME</button><button data-preview="heal">HEAL FRAME</button><button data-preview="fx-step">FX STEP 40ms</button><button data-preview="upgrade">BLESSING</button><button data-preview="dead">DEFEAT</button><button data-preview="victory">VICTORY</button><button data-preview="menu">GATE</button><button data-preview="hide">HIDE TOOLS</button><span id="sound-meter"></span>`;
    document.body.append(bar);
    bar.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(button => button.onclick = () => {
        if (screen === 'lab') (document.getElementById('exit-lab') ?? document.getElementById('back'))?.click();
        run = new Run('ember-art-review'); run.floor = Number(button.dataset.floor); run.loadFloor();
        const room = run.d.rooms.find(r => r.type === (run!.floor === 5 ? 'exit' : 'combat'))!;
        run.x = (room.x + 1.5) * 24; run.y = (room.y + room.h - 1.5) * 24;
        run.update(0, { x: 0, y: 0, shoot: false, angle: 0, dash: false });
        begin(); paused = true; document.getElementById('floor-announcement')?.remove();
    });
    bar.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button => button.onclick = () => {
        const name = button.dataset.preview;
        if (name === 'hide') { bar.remove(); return; }
        if (name === 'fx-step') { if (run && screen === 'game') { paused = true; run.update(.04, { x: 0, y: 0, shoot: false, angle: 0, dash: false }); scene.view.render(run, run.elapsed * 1000, .04, run.burst > 0, debug, true); } return; }
        if (screen === 'lab') (document.getElementById('exit-lab') ?? document.getElementById('back'))?.click();
        if (name === 'menu') { menu(); return; }
        if (name === 'dash') {
            run = new Run('ember-dash-review'); const room = run.d.rooms[0];
            run.x = (room.x + 1.5) * 24; run.y = (room.y + Math.floor(room.h / 2) + .5) * 24;
            begin(); paused = true; document.getElementById('floor-announcement')?.remove();
            for (let frame = 0; frame < 4; frame++) { run.update(.02, { x: 1, y: 0, shoot: false, angle: 0, dash: frame === 0 }); scene.view.render(run, frame * 20, .02, true, debug, true); }
            return;
        }
        if (name === 'charge' || name === 'heal') {
            run = new Run('ember-dash-review'); if (name === 'heal') run.hp = 60;
            begin(); paused = true; document.getElementById('floor-announcement')?.remove();
            if (name === 'charge') { run.selectWeapon(2); for (let frame = 0; frame < 20; frame++) { run.update(.04, { x: 0, y: 0, shoot: true, angle: -.4, dash: false }); scene.view.setAim(-.4); scene.view.render(run, frame * 40, .04, false, debug, true); } }
            else { run.heal(); scene.view.render(run, 0, .02, false, debug, true); }
            return;
        }
        if (['camp', 'altar', 'trial', 'duel', 'defense', 'collapse', 'choice'].includes(name ?? '')) {
            run = new Run('ember-art-review');
            if (name === 'camp') { run.coins = 150; run.owned = ['Burning Rounds', 'Rebound']; run.hp = 67; run.status = 'camp'; }
            else {
                const roomType = name === 'duel' ? 'tactics' : name;
                const roomIndex = run.d.rooms.findIndex(r => r.type === roomType), room = run.d.rooms[roomIndex];
                run.x = (room.x + Math.floor(room.w / 2) + .5) * 24; run.y = (room.y + Math.floor(room.h / 2) + .5) * 24;
                run.update(0, { x: 0, y: 0, shoot: false, angle: 0, dash: false });
                if (name === 'altar' || name === 'duel' || name === 'choice') run.interact();
                if (name === 'collapse') run.encounters.get(roomIndex)!.time = 12;
            }
            begin(); paused = true; document.getElementById('floor-announcement')?.remove(); status(); return;
        }
        if (!run) { run = new Run('ember-art-review'); begin(); paused = true; }
        document.getElementById('floor-announcement')?.remove(); lastStatus = ''; paused = true;
        if (name === 'upgrade') { run.status = 'upgrade'; run.picks = [0, 5, 9]; }
        else { run.status = name === 'dead' ? 'dead' : 'victory'; if (name === 'victory') run.floor = 5; }
        status();
    });
}
