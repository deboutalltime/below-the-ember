/** Presentation events are emitted by accepted actions, never inferred from particle counts. */
export type FeedbackKind = 'attack' | 'dash-start' | 'dash-end' | 'charge-start' | 'charge-stop' | 'charge-ready'
    | 'impact' | 'hurt' | 'heal' | 'defeat' | 'ricochet' | 'pot-break' | 'pillar-break' | 'ignite'
    | 'trap-arm' | 'trap-fire' | 'secret' | 'boss-warn' | 'boss-release' | 'revive' | 'switch' | 'step';
export interface FeedbackEvent {
    id: number;
    kind: FeedbackKind;
    x: number;
    y: number;
    dx?: number;
    dy?: number;
    weapon?: number;
    special?: boolean;
}
export class FeedbackStream {
    private serial = 0;
    readonly events: FeedbackEvent[] = [];
    emit(kind: FeedbackKind, x: number, y: number, details: Partial<Omit<FeedbackEvent, 'id' | 'kind' | 'x' | 'y'>> = {}) {
        this.events.push({ id: ++this.serial, kind, x, y, ...details });
        if (this.events.length > 128) this.events.splice(0, this.events.length - 128);
    }
    clear() { this.events.length = 0; }
}
export class FeedbackReader {
    private source?: FeedbackStream;
    private cursor = 0;
    read(stream: FeedbackStream) {
        if (this.source !== stream) { this.source = stream; this.cursor = 0; }
        const pending = stream.events.filter(event => event.id > this.cursor);
        if (pending.length) this.cursor = pending[pending.length - 1].id;
        return pending;
    }
}
