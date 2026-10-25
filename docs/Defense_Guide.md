# Defense guide

Presenter: Bekzat Zhailkhan. Language: English B2.

## Two-minute introduction

Below the Ember is a browser game that also teaches AI. The player explores five dungeon floors, protects the last ember, and fights the Ember Warden. I chose a game because AI methods can create visible behavior. The project implements three main course topics: intelligent agents, A* search and constraint satisfaction. These topics come from three different course weeks.

The game uses TypeScript, Phaser 3 and Vite. Its rules are separate from the renderer, so automated tests can execute combat and algorithms without a browser. An AI Laboratory lets users change inputs, inspect results and watch the algorithms step by step. Additional experiments include Minimax, Q-learning and probabilistic memory. I used substantial AI assistance during development, as described in the declaration.

## Three-to-five-minute live demonstration

1. Start the application before the defense. Open AI Laboratory. Use CSP with seed ember-2026, size 64, eight rooms and separation two. Show the connected map and step through the trace.
2. Enter 6.5 rooms and generate. Explain the validation message and unchanged map. If time permits, use dense-trace, size 48, twelve rooms and separation four to show the labeled fallback and truncated trace.
3. Open A*. Take one step, then run the search. Show 30 moves and 165 closed nodes. Explain g, h and f. Change one wall to show that the result depends on the input.
4. Open Agents. Move the cyan player near the agent. Show detection, chase and attack. Move away or behind a wall and explain search and memory.
5. Return to the game. Show the mouse-controlled prologue, skip it, move and dash in a normal run. Pause before speaking about code. Use the recorded video if live controls or the projector fail.

## Two-minute algorithm explanation

Week 1: An agent receives observations and selects actions. Our enemy has limited sight, wall occlusion and memory. An FSM gives it patrol, alert, chase, attack and search states. This is a rule-based agent, not a trained neural network.

Week 2: A* uses f = g + h. The project uses four-direction movement and Manhattan distance. Walls change the available neighbors. The weighted version adds hazard costs. BFS and A* are two search methods from the same course week.

Week 3: CSP assigns room positions and checks bounds, overlap and separation. Backtracking undoes a choice when a branch fails. The bounded solver can use a regular fallback. Corridors connect the final rooms in a later stage. The interface now makes these limits visible.

## Questions to rehearse

- Why is Manhattan suitable? Four cardinal moves and minimum entry cost one make it a lower bound on route cost.
- Is the whole map one CSP? No. Room placement uses bounded CSP search; corridor carving and connectivity follow separately.
- Does Q-learning control the campaign? No. It is a fixed educational arena with a real learned Q-table.
- What does 98% mean? Success in the last 50 training episodes on that map, not unseen-map accuracy.
- Did a human finish all five floors? That is not claimed. A normal-action automated simulation driver reached victory on one seed.
- What did AI help with? Significant coding, tests, debugging and document preparation. Review the AI declaration and explain the submitted code personally.
- What are the limits? Balance, manual full completion, mobile/gamepad controls and exact mid-battle saves.

Allow up to three minutes for questions. Every answer should refer to the actual code or recorded result. Do not claim that tests prove all possible seeds or player strategies.
