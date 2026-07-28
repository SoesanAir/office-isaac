# Agent Brief — Office Isaac

**Read this before writing any code or content.** It is the shared contract for
every contributor, human or agent. The GDD (`docs/GDD.md`) is the design
authority (R-GOV-001); this document says how that authority is expressed in
this repository.

## 0. Non-negotiables

1. **The GDD wins.** If your implementation and the GDD disagree, the code is a
   defect. Do not "improve" a rule. If a rule is genuinely ambiguous, pick the
   simplest option consistent with the locked decisions in GDD §0.2 and record it
   in `docs/DESIGN_DEVIATIONS.md` (R-AI-002, GDD §22.3).
2. **Originality.** Never copy names, sprites, text, layouts, audio, or code from
   The Binding of Isaac or any other game. Translate the *purpose* of a mechanic
   into original corporate-office content (GDD §2.16, Appendix H.2). Every content
   definition carries an `originalityNote` field; fill it honestly.
3. **Data-driven or it does not ship.** Adding a normal item, enemy, room, or
   department must not require editing core system logic (R-GOV-003, R-TEC-001).
   No `switch (item.id)`. No behaviour keyed off display names (R-TEC-006).
4. **Seeded randomness only.** Every gameplay roll comes from a named stream via
   `RngSource.stream(...)`. Never `Math.random()` in gameplay code. Never mix
   cosmetic RNG with loot or generation RNG (GDD §20.4, §22.5, R-TEC-002).
5. **No placeholder masquerading as done.** If something is a scaffold, label it
   and say so in the traceability table (R-AI-004).

## 1. Stack and layout

Vanilla ES modules. **No build step, no runtime dependencies.** `index.html` at
the repo root is the playable entry point, so GitHub Pages serves the repository
directly. Node (>=20) runs the same modules for tests and tools.

```
index.html            playable entry point
style.css             page shell only; all game rendering is canvas
src/core/             kernel: rng, events, constants, math, pool, loop, schema, registry
src/systems/          run manager, floorgen, room state, combat, attack graph, loot,
                      unlock, save, effects (hook registry), adapters
src/entities/         player, enemy controllers, boss controllers, projectiles,
                      pickups, objects, hazards, familiars, npcs
src/render/           renderer, sprites (pixel DSL), vfx, camera
src/ui/               hud, map, menus, collection, banners, accessibility
src/audio/            procedural WebAudio synth, sfx and music playback
content/              ALL content definitions (see §3)
tools/                validators, stress harnesses, dev server, debug export
tests/                node --test suites
docs/                 GDD + traceability + deviations + schemas + seed fixtures
```

Commands:

```
npm run serve        # dev server at http://localhost:8123
npm test             # node --test tests/
npm run validate     # content schema + reference + hook/adapter validation
npm run stress:floors  # headless floor generation suite
npm run check        # validate + test
```

## 2. Kernel API you must use

### Randomness — `src/core/rng.js`

```js
import { RNG_STREAMS } from '../core/rng.js';
const rng = run.rng.stream(RNG_STREAMS.LOOT_ITEM, poolId, floorDepth, roomId);
rng.int(0, 5); rng.chance(0.18); rng.pick(list); rng.pickWeighted(entries, e => e.effectiveWeight);
```

Streams: `RUN_ROUTE, FLOOR_LAYOUT, ROOM_TEMPLATE, ENCOUNTER, LOOT_ITEM,
LOOT_PICKUP, OBJECT_CONTENT, BOSS, COMBAT_PROC, COSMETIC`. Pick the stream that
owns the decision. Destroying a filing cabinet must not shift the next pedestal
item, so cabinet rolls use `OBJECT_CONTENT` (R-ENV-003).

### Events — `src/core/events.js`

`EVENTS.*` constants only, never raw strings. Listener priority bands:
`GUARD < MECHANIC < ITEM < PROGRESSION < PRESENTATION`. Presentation listeners
must never mutate gameplay state (R-TEC-007).

Simulation work registers against `PHASE.*` in GDD §20.5 order.

### Units — `src/core/constants.js`

- 1 world unit = `TILE` (32) logical pixels. Player move speed 5.5 wu/s.
- Logical canvas `960x540`. Single room cell interior `CELL_W=21 x CELL_H=11` wu.
- N-cell span interior = `interiorWidth(n)` / `interiorHeight(n)`.
- **Health is counted in half-units.** 6 half-units = 3 Composure icons.
- Use `CLAMPS` and `clampStat()` for every stat write (R-PLY-003).

### Pooling — `src/core/pool.js`

Projectiles, enemies, pickups, particles all come from pools. `acquire()`
returning `null` means the mechanical cap is reached: aggregate presentation, or
call `recycleOldest()` for entities whose damage has already been delivered.
Never silently drop a damage event (R-CMB-004).

### Sprites — `src/render/sprites.js`

Art is authored as palette-indexed character grids in `content/sprites/`. Use
`PALETTE` characters; add per-sprite overrides only when a department needs a
bespoke tone. Every collectible needs a **unique** sprite id (R-ITM-002,
R-ART-002). Every enemy family needs a **distinct silhouette** — the readability
test asserts `silhouetteSignature()` uniqueness (GDD §18.3).

## 3. Content authoring

Every content file is an ES module that default-exports an array of definitions:

```js
// content/items/passives-coffee.js
export default [
  { id: 'ITM-001', schemaVersion: 1, /* ... */ },
];
```

`content/index.js` imports and registers everything. Schemas live in
`src/schemas.js` and are **normative** — read the schema for your kind before
authoring. `npm run validate` must pass with zero errors.

### ID format — read this before inventing any id

Ids are `PREFIX-BODY` with **exactly one hyphen**. The body uses `A-Z`, `0-9`, and
**underscores** — never further hyphens. GDD §20.6 wants stable ASCII ids; the
single-hyphen rule keeps `id.split('-')` unambiguous everywhere.

```
FLOOR-OPEN_OFFICE_1     correct
FLOOR-OPEN-OFFICE-1     rejected by the schema
MUS-PARENT_COMPANY      correct
SFX-AMB_OPEN_OFFICE     correct
UNLOCK-ALTERNATE_FINANCE correct
```

Numbered kinds keep the GDD's own zero-padded form: `WPN-001`, `ITM-060`,
`ENM-058`, `BSS-029`, `ROOM-012`, `ENV-024`, `END-009`, `PRF-008`.

The exact pattern per kind is `ID` in `src/schemas.js` — check it before authoring,
not after.

### Hard content rules

| Rule | Requirement |
|---|---|
| R-ITM-005 | Pickup phrases carry **no numbers, no percent signs**. "Typing faster", not "-12% fire delay". |
| R-ITM-002 | Unique sprite id, one fixed class per collectible. |
| R-ENM-005 | An enemy variant must change behaviour/pattern/death/support — `functionalDelta` is mandatory and health-only variants are rejected. |
| R-CMB-002 | Every damaging attack declares `telegraphSeconds >= 0.12`. |
| R-BSS-004 | Invulnerable boss phases are `<= 6s` or expose an attackable add/objective. |
| R-BSS-006 | `guaranteesSafePath: true`. No phase seals every route. |
| R-FLR-007 | Room templates never name an encounter. Architecture and encounters are separate layers (D-006). |
| R-ENV-002 | Mechanical hazards look different from decorative decals. |
| R-UIX-003 | No completion denominators, no locked silhouette grids. |
| GDD 13.4 | `PEDESTAL_ITEM` outcome stays under 1% of any object loot table. |

### Behaviour goes in hooks, not in content

Items declare `effects: [{ hook: 'HOOK_NAME', params: {...} }]`. Register the
hook once in `src/systems/effects.js` (or a module that calls `defineHook`).
Weapon modifiers declare a `modifier` block and use adapters registered through
`defineAdapter` in `src/systems/adapters.js`. `resolveAdapter()` implements the
GDD §7.3 precedence: weapon override → weapon-declared → default → NO_EFFECT.

**NO_EFFECT is a valid, intended outcome** (R-WPN-005, R-ITM-006). Never invent a
token stat change so an item can claim universal compatibility.

## 4. Definition of done (GDD §22.6)

A change is done when all of these hold:

- Mapped requirement IDs recorded in `docs/REQUIREMENT_TRACEABILITY.md`.
- Uses approved interfaces, data contracts, and scoped RNG.
- Behaviour matches the GDD acceptance criteria.
- Tests exist: unit for formulas, property for generation, seed fixture where
  determinism matters (R-AI-003).
- Content validates; localization keys exist; sprites registered.
- No performance regression against GDD §20.7 budgets.
- Accessibility cues reviewed: every colour cue has a non-colour cue (R-UIX-005);
  every audio-only cue has a caption or visual equivalent (R-AUD-003).

## 5. Style

- Match the surrounding code: ES modules, named exports, JSDoc on public
  functions, a header comment naming the GDD sections a module implements.
- Comment the *why*, especially where a GDD rule drove an unobvious choice.
  Do not narrate the obvious.
- No `console.log` in gameplay paths. Diagnostics go through the debug module.
- Keep functions small enough to test. Prefer pure functions for anything a test
  should assert.
