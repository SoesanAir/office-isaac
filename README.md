# Office Isaac

A top-down action roguelike. You are an employee. The building is a corporate tower that does
not obey the floor plan it advertises, and you are going up it.

Every floor is generated. Every weapon replaces the one you are holding. Every item stacks with
every other item, including the combinations nobody planned for.

**Play it in a browser, on a desktop or a phone: https://soesanair.github.io/office-isaac/**

Nothing to install.

---

## Running it locally

```
npm run serve
```

Then open **http://localhost:8123/**. The command blocks; leave the terminal open.

There is no build step and no dependency to install. The game is vanilla ES modules, so the
repository *is* the deployable artefact — `index.html` at the root loads `src/main.js` and the
browser resolves the rest. That is also why GitHub Pages can serve it directly.

Node 20 or newer is needed for the tests and tools, which run the same modules the browser does.

## On a phone

Open the same URL on a phone. The game always runs in landscape — if you are holding the phone
upright it will be lying on its side, which is your cue to turn it. There is no "please rotate"
screen: it is already playing. One tap on "Tap to play" turns on sound and goes fullscreen at the
same time, because browsers require a gesture for each.

| | |
|---|---|
| Left thumb, anywhere on the left half | move |
| Right thumb, anywhere on the right half | aim and fire |
| `ITEM` / `PKT` | active item, pocket item — dimmed when there is nothing to use |
| `MAP` / `II` | map, pause |
| `DROP` | **hold** to discard your weapon |

Both sticks float: they appear centred wherever your thumb lands rather than in a fixed spot, so
your thumbs never have to find them. Dropping a weapon is a hold rather than a tap because it is
the one irreversible thing on that screen. Button sizes are computed from your screen so they
always clear the 44pt platform minimum, which means they take up proportionally more room on a
small phone — a control you cannot reliably hit is worth less than the pixels it saves.

It can also be added to your home screen, where it launches without browser chrome.

## Controls

| | |
|---|---|
| Move | `W` `A` `S` `D` |
| Fire | arrow keys |
| Active item | `Space` |
| Pocket item | `Q` |
| Interact | `E` |
| Drop weapon | `Left Ctrl` |
| Map | `Tab` |
| Pause | `Escape` |

All of these are remappable — Pause → Controls. Controller is supported and remappable
separately.

## What is in it

| | |
|---|---|
| Weapons | 14 |
| Passive items | 60 |
| Active items | 15 |
| Action Cards | 18 |
| Supplements | 14 |
| Desk Charms | 18 |
| Transformations | 4 |
| Enemies | 58, plus 42 variants |
| Managers (bosses) | 29 |
| Departments | 13 |
| Floor definitions | 21 |
| Room templates | 273 |
| Encounters | 100 |
| Endings | 9 |
| Unlocks | 28 |
| Sounds | 93, all synthesised at runtime |

## How it is built

Worth knowing before reading the source, because three decisions shape everything else:

**No binary assets.** Sprites are palette-indexed character grids in `.js` files
(`content/sprites/`), so art is diffable, reviewable in a pull request, and greppable. Audio is
procedural synthesis recipes (`content/audio/`) rather than sound files. Nothing in the
repository needs decoding, and nothing needs a licence.

**Content is data, and the data is checked.** Enemies, items, rooms, floors, bosses and
encounters are declarative definitions validated against schemas (`src/schemas.js`). A room
template that offers a door it cannot reach, an item that references a hazard that does not
exist, or a boss pool with nothing in it fails a check rather than surprising a player.

**Generation is deterministic and seeded per concern.** Ten named RNG streams
(`src/core/rng.js`) mean the loot you get cannot be changed by how many shots you fired, and a
seed reproduces a run exactly.

Simulation order is fixed (`src/core/events.js`): input → movement intent → AI intent → attack
creation → physics → damage → death → on-hit effects → room clear → rewards → presentation.
Item hooks attach to that pipeline in priority bands, so a guard always runs before a mechanic,
which always runs before an item, which always runs before presentation.

```
content/          the game's data: items, enemies, bosses, rooms, sprites, audio recipes
src/core/         loop, events, RNG, constants, maths
src/systems/      generation, physics, combat, loot, economy, saves, unlocks
src/entities/     player, enemies, projectiles, boss patterns
src/render/       canvas renderer, camera, sprite baking
src/ui/           HUD and menus
tools/            content validation, generation stress, traceability, the shipping gate
docs/             GDD, project plan, ID registry, requirement traceability
```

## Development

```
npm test              # the test suite
npm run validate      # content census and validation
npm run check         # validate + test
npm run stress:floors # generate 10,000 floors per definition and check the thresholds
npm run baseline      # measure the content against GDD 24's release baseline
npm run traceability  # regenerate docs/REQUIREMENT_TRACEABILITY.md
npm run qa            # the full shipping gate — run this before pushing
```

`npm run qa` is the one that matters: it runs the tests, content validation, generation stress,
requirement traceability and a static-deployability check, reports all of them rather than
stopping at the first failure, and exits non-zero if any gate fails. CI runs the same gate on
every push and only deploys to Pages after it passes.

### Requirements are traceable

The design document is normative and its requirements are numbered (`R-FLR-001`, `R-CMB-002`,
and so on). `npm run traceability` scans the source for those ids and reports which have a test,
which are implementation-only, and which are waived with a stated reason. The result is checked
in at `docs/REQUIREMENT_TRACEABILITY.md`, and CI fails if it is stale. A requirement can be
waived, but not silently.

## Known gaps

Recorded here rather than left for a player to find:

- **Content is at the GDD's seed catalogue, not its 1.0 north star.** GDD 24 defines both, and
  says a roadmap may phase the latter. Every family the document defines is fully implemented;
  the 1.0 targets are higher in most of them — 220 passive items against 60, 450 encounters
  against 100. Run `npm run baseline` for the current distance in every family.
- **Sustained frame rate on target hardware is unverified** (R-QA-006, half of it). The
  generation budget is enforced over thousands of floors in CI; frame pacing in a heavy fight on
  a real device needs a device and a human, and has not been measured.
- Balance beyond the automated thresholds has not had a human pass. Generation, population and
  soft-lock guarantees are enforced by tests; whether floor 9 *feels* right is not.
- The touch controls have never been under a real thumb. They are covered by 17 tests, which is
  not the same thing.

## Licence

No licence has been chosen yet, so default copyright applies.
