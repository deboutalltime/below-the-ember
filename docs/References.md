# References and asset provenance

Accessed 25 October 2026. The implementations are local TypeScript code. These primary teaching and framework sources explain the concepts and technology; no external source code listing is reproduced as a claimed student invention.

1. UC Berkeley CS 188. [Agents](https://inst.eecs.berkeley.edu/~cs188/textbook/search/agents.html).
2. UC Berkeley CS 188. [Informed Search](https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html).
3. UC Berkeley CS 188. [Constraint Satisfaction Problems](https://inst.eecs.berkeley.edu/~cs188/textbook/csp/csps.html) and [Solving CSPs](https://inst.eecs.berkeley.edu/~cs188/textbook/csp/solving.html).
4. UC Berkeley CS 188. [Minimax](https://inst.eecs.berkeley.edu/~cs188/textbook/games/minimax.html).
5. UC Berkeley CS 188. [Model-Free Learning](https://inst.eecs.berkeley.edu/~cs188/textbook/rl/mfl.html).
6. Phaser Studio. [What is Phaser](https://docs.phaser.io/phaser/getting-started/what-is-phaser).
7. Vite. [Vite 6 Getting Started](https://v6.vite.dev/guide/). This project pins Vite 6 in the lockfile.
8. Microsoft. [The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).
9. MDN Web Docs. [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).
10. QAIRU. AI Fundamentals Final Project 2026 guideline supplied by the student, sections 1-14 and the 100-point assessment rubric.

## Project media

World tiles, actor textures, effects and story art are generated procedurally by src/visuals/assets.ts, src/visuals/WorldRenderer.ts, src/visuals/DashVFX.ts and src/story/StoryArt.ts. Music and sound are synthesized by src/audio and src/ui/audio.ts. AI assisted in authoring this code. No downloaded sprite pack, stock image, recorded song or voice actor is claimed.

docs/images contains actual game and laboratory captures. The video uses actual browser frames with English captions. Its separately mixed music comes from the game's score and synthesis code. The short gameplay footage includes defeat. The successful five-floor result is a separate simulation experiment documented in docs/results/campaign.json.

## Dependencies

package.json and pnpm-lock.yaml identify the runtime and development dependencies and exact resolved versions. Retain their distributed license notices when redistributing a build. No license to an unrelated commercial game or music work is implied.
