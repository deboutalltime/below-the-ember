/** Presentation only: gait follows distance actually travelled, and pause freezes the entire pose. */
export class ActorMotion {
    private x = 0;
    private y = 0;
    private distance = 0;
    private clock = 0;
    frame = 0;
    angle = 0;
    scaleX = 1;
    scaleY = 1;
    get time() { return this.clock * 1000; }
    reset(x: number, y: number) { this.x = x; this.y = y; this.distance = 0; this.clock = 0; this.frame = 0; this.angle = 0; this.scaleX = this.scaleY = 1; }
    update(x: number, y: number, dt: number, active: boolean, dashing: boolean, directionX: number, reduced: boolean) {
        const distance = Math.hypot(x - this.x, y - this.y); this.x = x; this.y = y;
        if (reduced) { this.angle = 0; this.scaleX = this.scaleY = 1; }
        if (!active) return;
        const delta = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
        this.clock += delta;
        if (!dashing && distance < 40) this.distance += distance;
        this.frame = dashing ? 2 : distance > .01 ? Math.floor(this.distance / 13) % 4 : 0;
        const ease = 1 - Math.exp(-25 * delta);
        this.angle += ((dashing && !reduced ? directionX * 13 : 0) - this.angle) * ease;
        this.scaleX += ((dashing && !reduced ? 1.09 : 1) - this.scaleX) * ease;
        this.scaleY += ((dashing && !reduced ? .85 : 1) - this.scaleY) * ease;
        if (reduced) { this.angle = 0; this.scaleX = this.scaleY = 1; }
    }
}
