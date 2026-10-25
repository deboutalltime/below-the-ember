export type StoryLanguage = 'ru' | 'en';
export interface StorySlide {
    id: 'city' | 'heart' | 'seals' | 'keeper' | 'descent';
    seconds: number;
    title: Record<StoryLanguage, string>;
    text: Record<StoryLanguage, string>;
    chapter: Record<StoryLanguage, string>;
}
export const storySlides: readonly StorySlide[] = [
    {
        id: 'city', seconds: 9,
        chapter: { ru: 'I · ВЕК ТЕПЛА', en: 'I · THE AGE OF WARMTH' },
        title: { ru: 'Когда камень помнил свет', en: 'When stone remembered light' },
        text: { ru: 'Когда-то города жили теплом великого Сердца. Его огонь горел глубоко под землёй — и ни одна ночь не казалась вечной.', en: 'Once, the cities lived by the warmth of a great Heart. Its fire burned far beneath the earth, and no night seemed endless.' },
    },
    {
        id: 'heart', seconds: 10,
        chapter: { ru: 'II · ЦЕНА ОГНЯ', en: 'II · THE PRICE OF FIRE' },
        title: { ru: 'Не уголь. Память.', en: 'Not coal. Memory.' },
        text: { ru: 'Но Сердце питалось не углём. В его пламени оставались голоса, обещания и имена. Чем ярче оно горело, тем больше мир забывал.', en: 'The Heart did not feed on coal. Voices, promises and names remained inside its flame. The brighter it burned, the more the world forgot.' },
    },
    {
        id: 'seals', seconds: 10,
        chapter: { ru: 'III · ПОСЛЕДНЯЯ КЛЯТВА', en: 'III · THE LAST OATH' },
        title: { ru: 'Пять печатей тишины', en: 'Five seals of silence' },
        text: { ru: 'Хранители заперли Сердце за пятью печатями. Столетия превратили их в пепел и тени. Лишь Страж всё ещё исполняет приказ, смысл которого утрачен.', en: 'The keepers locked the Heart behind five seals. Centuries turned them to ash and shadow. Only the Warden still obeys an order whose meaning has been lost.' },
    },
    {
        id: 'keeper', seconds: 9,
        chapter: { ru: 'IV · ИСКРА, КОТОРАЯ ОСТАЛАСЬ', en: 'IV · THE EMBER THAT REMAINED' },
        title: { ru: 'Один огонь в твоих руках', en: 'One flame in your hands' },
        text: { ru: 'Теперь последний уголёк выбрал тебя. В нём теплится чьё-то забытое имя. Он слабеет на поверхности — и зовёт туда, где началась тьма.', en: 'Now the last ember has chosen you. A forgotten name still glows within it. Its light fades on the surface, calling you to the place where darkness began.' },
    },
    {
        id: 'descent', seconds: 9,
        chapter: { ru: 'V · НИЖЕ ПОСЛЕДНЕГО ОГНЯ', en: 'V · BELOW THE LAST FLAME' },
        title: { ru: 'Сохрани искру. Узнай правду.', en: 'Keep the ember. Find the truth.' },
        text: { ru: 'Пять этажей лежат между тобой и Сердцем. Спустись. Пронеси огонь через пепел. И узнай, что на самом деле охраняет Страж.', en: 'Five floors stand between you and the Heart. Descend. Carry the ember through the ash. Discover what the Warden is truly guarding.' },
    },
];

/** A presentation clock: hidden tabs cannot consume the story; the final scene waits for the player. */
export class PrologueTimeline {
    index = 0;
    elapsed = 0;
    paused = false;
    autoplay: boolean;
    finished = false;
    constructor(autoplay = true) { this.autoplay = autoplay; }
    get slide() { return storySlides[this.index]; }
    get progress() { return Math.min(1, this.elapsed / this.slide.seconds); }
    go(index: number) {
        if (this.finished || !Number.isInteger(index) || index < 0 || index >= storySlides.length || index === this.index) return false;
        this.index = index; this.elapsed = 0; return true;
    }
    next() {
        if (this.finished) return false;
        if (this.index === storySlides.length - 1) { this.finished = true; return false; }
        return this.go(this.index + 1);
    }
    previous() { return this.go(this.index - 1); }
    finish() { if (this.finished) return false; this.finished = true; return true; }
    tick(seconds: number, visible = true) {
        if (this.finished || this.paused || !visible) return false;
        // A stall resumes gently instead of skipping several scenes at once.
        this.elapsed = Math.min(this.slide.seconds, this.elapsed + (Number.isFinite(seconds) ? Math.max(0, Math.min(.1, seconds)) : 0));
        if (this.autoplay && this.progress === 1 && this.index < storySlides.length - 1) return this.next();
        return false;
    }
}
