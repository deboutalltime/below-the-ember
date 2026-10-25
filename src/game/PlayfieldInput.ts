/** A press belongs to the surface where it began. UI clicks must never become attacks. */
export class PlayfieldInput {
    private buttons = new Set<number>();
    overWorld = false;
    interrupted = false;
    press(button: number, world: boolean) {
        this.move(world);
        if (world) { this.buttons.add(button); this.interrupted = false; } else this.reset();
    }
    move(world: boolean) {
        this.overWorld = world;
        if (!world && this.buttons.size) { this.buttons.clear(); this.interrupted = true; }
    }
    release(button: number) { this.buttons.delete(button); }
    reset() { this.buttons.clear(); this.overWorld = false; this.interrupted = true; }
    get shoot() { return this.overWorld && this.buttons.has(0); }
    get alternate() { return this.overWorld && this.buttons.has(2); }
}
