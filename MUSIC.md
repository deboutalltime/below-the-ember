# Music and sound

The application synthesizes original audio through Web Audio. Five instrument types and a deterministic score support eight arrangements: menu, exploration, combat, boss, camp, story, victory and defeat. Music follows game state and becomes silent on pause or hidden tabs. Boss phase two increases its pulse density.

Settings provides separate effect and music volume controls and music previews. Audio starts after a user gesture. The scheduler skips stale beats after a stalled frame instead of replaying a backlog. Tests check score determinism, scheduling, finite samples and bounded output.

The submitted video mixes rendered original game music separately. It does not present that mix as a capture of the browser's sound output. No recorded narration is included.
