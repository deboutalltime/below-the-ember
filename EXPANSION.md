# Gameplay and AI expansion

Version 2.3.2 includes four weapons, 18 upgrades, heat, oil, traps, pots, pillars, secret seals, optional covenants, room choices and a rune duel. Four mandatory encounter types support combat, defense, collapse escape and an optional no-flask oath. Shelters provide forging, flasks, relic exchange and contracts between floors.

Utility AI selects intentions, GOAP plans short action sequences, a behavior tree controls boss timing, a Bayesian filter tracks possible player locations, Minimax handles the duel, and a genetic optimizer selects encounter compositions. The laboratory exposes these methods and search comparisons. Q-learning remains an educational arena, not a campaign learning system.

The secret is a breakable seal, collapse hazards grow along room edges, and GOAP uses a small fixed action set. Continue is a floor entrance checkpoint with reset encounters. See README.md and docs/Technical_Report.md for tested results and limits.
