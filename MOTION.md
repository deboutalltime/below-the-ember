# Animation and feedback

Simulation events drive weapon, dash, impact, healing and object sound cues. Dash uses a fixed accepted direction, a brief burst, residual silhouettes and smooth recovery. Coal Lance shows charge and release feedback. Actor gait follows actual movement, so pushing against a wall stays idle.

Pause freezes animation state. Full animation can be toggled in Settings; reduced animation keeps calm indicators and critical warnings. The prologue has independent pause and motion controls. Browser screenshots are still images and do not reproduce movement.

Tests cover event deduplication, dash direction, cooldowns, floor-transition resets, actor pose freezing and finite bounded audio synthesis. The technical report links the latest results.
