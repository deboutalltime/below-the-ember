# Verification results

Version 2.3.2, 25 October 2026.

## Automated checks

- 50 tests passed, zero failed and zero skipped. See docs/results/tests.txt.
- TypeScript checking and the Vite production build pass. The Phaser chunk size warning remains.
- Seeded generation tests cover 100 basic and 50 expanded map configurations, room separation, repeatability, reachability and environment changes.
- New regression tests reject fractional, non-finite and out-of-range generation inputs, exercise valid boundaries, and distinguish successful CSP from fallback and truncated traces.
- Algorithm experiments are reproducible with `pnpm metrics`. A*: 30 moves and 165 closed nodes on the standard laboratory map. Weighted search: BFS cost 65, Dijkstra and A* cost 13. Minimax: 34,202 versus 549,945 nodes. Q-learning reaches the goal after 1000 episodes with 98% success in the last 50 training episodes on its fixed map.

## Campaign experiment

`pnpm verify:campaign` reaches victory on five floors using seed qairu-final-2026. The driver defeated 98 enemies, completed 20 mandatory objectives and reached the real exit after defeating the boss. Simulated time was 391.8 seconds. It used normal attacks, movement, healing, upgrades and camp actions. No enemy removal, objective override, teleportation or player-stat boost is used.

The driver can inspect the whole game state and runs without the browser renderer. This demonstrates one complete simulation path, not human playability, balance or a manual browser victory.

## Browser checks

The desktop interface was checked at 1280x720 and the normal app viewport. The prologue's Next, scene selection, return and Skip buttons now work with the mouse; computed pointer-events is auto. Full animation and English default copy are visible. A fractional room count produces a message and keeps the previous map. A dense request labels FALLBACK LAYOUT and TRACE TRUNCATED, with total candidates and backtracks.

The recorded browser session includes a normal seeded run, movement, dash, weapon changes and a real defeat, followed by CSP, A*, Agents and Q-learning. The agent detects the player, attacks, loses sight and returns to patrol. A* displays its route and counters. Q-learning starts empty and reaches the goal after training. No warning/error entries were captured in the checked game tab.

The demo uses actual browser frames captured at approximately 5 fps and encoded at 25 fps. Its English captions explain the visible actions. Original game music is mixed separately. It does not claim to show a five-floor victory.

## Clean installation and production

A fresh local source copy installed successfully with the frozen pnpm lockfile. Its complete 50-test suite, production build and normal-action five-floor driver passed again. See docs/results/clean-install.txt and docs/results/clean-checks.txt. No pre-existing node_modules folder was copied into that source copy.

The compiled production application was served separately on port 5181. Mouse navigation in the English prologue and rejection of 6.5 rooms were checked again there. Its warning/error log was empty. Development visual-fixture controls are absent from the production application.

## Verification limits

No full human five-floor victory, broad cross-browser certification, mobile playtest, long-term balance study or physical-speaker assessment is claimed. The source and report describe floor checkpoints accurately. Earlier Russian working notes are preserved privately under docs/history and excluded from the submission repository.
