import { EmberAudio } from '../ui/audio';
import { StoryArt } from './StoryArt';
import { PrologueTimeline, StoryLanguage, storySlides } from './prologue';

interface PrologueOptions {
    language: StoryLanguage;
    reducedMotion: boolean;
    showBeforeRun: boolean;
    replay: boolean;
    audio: EmberAudio;
    onLanguage: (language: StoryLanguage) => void;
    onPreference: (show: boolean) => void;
    onFinish: () => void;
}
const copy = {
    ru: { prologue: 'ПРОЛОГ · ПОСЛЕДНЯЯ ИСКРА', skip: 'Пропустить', leave: 'В меню', back: '← Назад', next: 'Далее →', enter: 'ВОЙТИ В ПОДЗЕМЕЛЬЕ ↘', end: 'ВЕРНУТЬСЯ В МЕНЮ →', pause: 'Пауза', resume: 'Продолжить', auto: 'Автосмена', motion: 'Анимация', sound: 'Звук', show: 'Показывать перед новым забегом', hint: '← → СЦЕНЫ · ПРОБЕЛ ДАЛЕЕ · ESC ПРОПУСТИТЬ', scene: 'Сцена', on: 'вкл.', off: 'выкл.', manual: 'ЧИТАЙ В СВОЁМ ТЕМПЕ', playing: 'ИСТОРИЯ В ПЕПЛЕ', paused: 'ИСТОРИЯ ЖДЁТ', ready: 'ТВОЙ ПУТЬ НАЧИНАЕТСЯ ЗДЕСЬ' },
    en: { prologue: 'PROLOGUE · THE LAST SPARK', skip: 'Skip', leave: 'Main menu', back: '← Back', next: 'Next →', enter: 'ENTER THE DEPTHS ↘', end: 'RETURN TO THE GATE →', pause: 'Pause', resume: 'Resume', auto: 'Auto advance', motion: 'Animation', sound: 'Sound', show: 'Show before a new run', hint: '← → SCENES · SPACE NEXT · ESC SKIP', scene: 'Scene', on: 'on', off: 'off', manual: 'READ AT YOUR OWN PACE', playing: 'A STORY IN ASH', paused: 'THE STORY WAITS', ready: 'YOUR DESCENT BEGINS HERE' },
};

/** A DOM presentation with its own clock and audio, entirely outside the run simulation. */
export class PrologueView {
    private clock: PrologueTimeline;
    private art: StoryArt;
    private root: HTMLElement;
    private frame = 0;
    private last = performance.now();
    private alive = true;
    private completed = false;
    private language: StoryLanguage;
    private motion: boolean;
    private sound = true;
    constructor(host: HTMLElement, private options: PrologueOptions) {
        this.language = options.language; this.motion = !options.reducedMotion;
        this.clock = new PrologueTimeline(!options.reducedMotion);
        host.className = 'shown prologue-overlay';
        host.innerHTML = `<section class="prologue" aria-label="Below the Ember prologue">
            <canvas class="prologue-art" aria-hidden="true"></canvas><div class="story-vignette"></div>
            <header class="prologue-header"><div class="story-brand"><span class="story-sigil">✦</span><div>BELOW THE EMBER<small data-copy="prologue"></small></div></div>
            <div class="story-header-actions"><div class="story-languages" aria-label="Language"><button data-lang="ru">RU</button><button data-lang="en">EN</button></div><button class="story-sound" data-action="sound"></button><button class="story-skip" data-action="skip"></button></div></header>
            <div class="story-copy" aria-live="polite" aria-atomic="true"><div class="story-chapter"></div><h1></h1><p></p><span class="story-copy-rule"></span></div>
            <footer class="prologue-footer"><div class="story-scene-info"><span class="story-status"></span><span class="story-counter"></span></div>
            <nav class="story-timeline" aria-label="Story scenes">${storySlides.map((_, i) => `<button data-scene="${i}"><span>0${i + 1}</span><i><b></b></i></button>`).join('')}</nav>
            <div class="story-controls"><button data-action="back"></button><div class="story-modes"><button data-action="pause"></button><button data-action="auto"></button><button data-action="motion"></button></div><button class="story-next" data-action="next"></button></div>
            <div class="story-preferences"><label><input type="checkbox" ${options.showBeforeRun ? 'checked' : ''}><span data-copy="show"></span></label><span data-copy="hint"></span></div></footer></section>`;
        this.root = host.querySelector('.prologue')!;
        this.art = new StoryArt(this.root.querySelector('canvas')!);
        this.root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach(button => button.onclick = () => {
            this.language = button.dataset.lang as StoryLanguage; options.onLanguage(this.language); this.renderScene(false);
        });
        this.root.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(button => button.onclick = () => this.go(Number(button.dataset.scene)));
        this.button('back').onclick = () => this.go(this.clock.index - 1);
        this.button('next').onclick = () => this.next();
        this.button('skip').onclick = () => this.complete();
        this.button('pause').onclick = () => { this.clock.paused = !this.clock.paused; this.soundtrack(false); this.renderControls(); };
        this.button('auto').onclick = () => { this.clock.autoplay = !this.clock.autoplay; this.renderControls(); };
        this.button('motion').onclick = () => { this.motion = !this.motion; this.renderControls(); };
        this.button('sound').onclick = () => { this.sound = !this.sound; options.audio.unlock(); this.soundtrack(false); this.renderControls(); };
        this.root.querySelector('input')!.onchange = event => options.onPreference((event.target as HTMLInputElement).checked);
        document.addEventListener('keydown', this.key, true);
        document.addEventListener('visibilitychange', this.visibility);
        options.audio.unlock(); this.renderScene(true); this.art.draw(0, 0, this.motion);
        this.button('next').focus({ preventScroll: true });
        this.frame = requestAnimationFrame(this.tick);
    }
    destroy() {
        if (!this.alive) return;
        this.alive = false; cancelAnimationFrame(this.frame);
        document.removeEventListener('keydown', this.key, true);
        document.removeEventListener('visibilitychange', this.visibility);
        this.options.audio.stopStory(); this.art.destroy(); this.root.remove();
    }
    private button(action: string) { return this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!; }
    private complete() {
        if (this.completed || !this.alive) return;
        this.completed = true; this.clock.finish(); this.destroy(); this.options.onFinish();
    }
    private next() { if (this.clock.index === storySlides.length - 1) this.complete(); else this.go(this.clock.index + 1); }
    private go(index: number) { if (this.clock.go(index)) this.renderScene(true); }
    private renderScene(changed: boolean) {
        const slide = this.clock.slide, language = this.language;
        this.root.lang = language;
        this.root.querySelector('.story-chapter')!.textContent = slide.chapter[language];
        this.root.querySelector('h1')!.textContent = slide.title[language];
        this.root.querySelector('.story-copy p')!.textContent = slide.text[language];
        if (changed) {
            this.art.show(this.clock.index, this.motion && !this.clock.paused);
            const text = this.root.querySelector<HTMLElement>('.story-copy')!;
            text.classList.remove('story-reveal'); void text.offsetWidth; text.classList.add('story-reveal');
            this.soundtrack(true);
        }
        this.renderControls();
    }
    private renderControls() {
        const t = copy[this.language], last = this.clock.index === storySlides.length - 1;
        this.root.classList.toggle('story-motion', this.motion);
        this.root.classList.toggle('story-paused', this.clock.paused);
        this.root.querySelectorAll<HTMLElement>('[data-copy]').forEach(element => { element.textContent = t[element.dataset.copy as keyof typeof t]; });
        this.button('back').textContent = t.back; this.button('back').disabled = this.clock.index === 0;
        this.button('skip').textContent = this.options.replay ? t.leave : t.skip;
        this.button('skip').title = `${this.options.replay ? t.leave : t.skip} · Esc`;
        this.button('next').textContent = last ? this.options.replay ? t.end : t.enter : t.next;
        this.button('next').classList.toggle('story-finale', last);
        this.button('pause').textContent = this.clock.paused ? `▷ ${t.resume}` : `Ⅱ ${t.pause}`;
        this.button('pause').setAttribute('aria-pressed', String(this.clock.paused));
        for (const [key, value] of [['auto', this.clock.autoplay], ['motion', this.motion], ['sound', this.sound]] as const) {
            this.button(key).textContent = `${key === 'sound' ? '♫ ' : ''}${t[key]}: ${value ? t.on : t.off}`;
            this.button(key).setAttribute('aria-pressed', String(value));
        }
        this.root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === this.language)));
        this.root.querySelector('.story-counter')!.textContent = `${t.scene} ${this.clock.index + 1} / ${storySlides.length}`;
        this.root.querySelector('.story-status')!.textContent = this.clock.paused ? t.paused : last ? t.ready : this.clock.autoplay ? t.playing : t.manual;
        this.root.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((button, i) => {
            button.setAttribute('aria-label', `${t.scene} ${i + 1}: ${storySlides[i].title[this.language]}`);
            if (i === this.clock.index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
        });
    }
    private soundtrack(cue: boolean) {
        this.options.audio.stopStory();
        if (this.sound && !this.clock.paused && !document.hidden) this.options.audio.storyAtmosphere(this.clock.index, cue);
    }
    private visibility = () => { this.last = performance.now(); this.soundtrack(false); };
    private key = (event: KeyboardEvent) => {
        if (!this.alive || event.altKey || event.ctrlKey || event.metaKey) return;
        const interactive = (event.target as HTMLElement).closest('button, input, select, textarea');
        if (event.key === 'Tab') return;
        // Keep presentation keys out of Phaser, including the key that starts a run.
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); this.complete(); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); if (this.clock.index < storySlides.length - 1) this.go(this.clock.index + 1); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); this.go(this.clock.index - 1); }
        else if ((event.key === ' ' || event.key === 'Enter') && !interactive) { event.preventDefault(); if (!event.repeat) this.next(); }
        else if (event.repeat && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
    };
    private tick = (now: number) => {
        if (!this.alive) return;
        const dt = Math.max(0, Math.min(.1, (now - this.last) / 1000)); this.last = now;
        if (this.clock.tick(dt, !document.hidden)) this.renderScene(true);
        if (!document.hidden) {
            this.art.draw(this.clock.paused ? 0 : dt, this.clock.progress, this.motion);
            this.root.querySelectorAll<HTMLElement>('.story-timeline b').forEach((bar, i) => {
                bar.style.transform = `scaleX(${i < this.clock.index ? 1 : i === this.clock.index ? this.clock.progress : 0})`;
            });
        }
        this.frame = requestAnimationFrame(this.tick);
    };
}
