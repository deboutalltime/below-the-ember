# Visual and interface design

The game uses a dark stone palette, warm ember highlights and restrained cyan AI information. Procedural pixel art renders through Phaser while readable menus and the HUD use the DOM. The world is the primary surface; controls stay near screen edges.

Animation follows actual displacement and accepted simulation events. Dash has anticipation, a moving afterimage trail and recovery. Pause freezes world poses. Reduced animation removes moving effects while critical attack warnings remain visible. The prologue has its own timeline and mouse controls.

See src/visuals, src/story, MOTION.md and the technical report for implementation details. No physical lighting engine or large hand-painted animation library is claimed.
