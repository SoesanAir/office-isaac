# Project Plan — Office Isaac

Eleven phases from empty directory to a GitHub-Pages-playable build that satisfies
every requirement ID in the GDD. Phase order follows GDD §24.2 ("Content
production order"): architecture first, content factory second.

Status legend: **DONE** · **IN PROGRESS** · **BLOCKED** · **TODO**

---

## Phase 0 — Foundation: kernel, data contracts, docs — **DONE**

The architecture GDD §22 demands before content work starts.

| Deliverable | File | Requirements |
|---|---|---|
| Deterministic scoped RNG, 10 named streams, serialisable | `src/core/rng.js` | R-TEC-002, R-CMB-005, R-ENV-003 |
| Phase scheduler in GDD 20.5 order; priority-banded event bus | `src/core/events.js` | R-TEC-007 |
| World units, viewport, budgets, all GDD enums | `src/core/constants.js` | 18.2, 20.7 |
| Declarative schema validator with paths | `src/core/schema.js` | R-TEC-005 |
| Content registry: link pass, sprite uniqueness, reserved ids | `src/core/registry.js` | R-GOV-003, R-TEC-001, R-ITM-002, 20.6 |
| Pooling that reports exhaustion instead of dropping damage | `src/core/pool.js` | R-TEC-004, R-CMB-004 |
| Fixed 60Hz sim decoupled from render; accessibility time-scale | `src/core/loop.js` | 20.7, 17.6 |
| Normative schemas for all 27 content kinds | `src/schemas.js` | Appendix G, R-WPN-003, R-ENM-001/005, R-BSS-004/006 |
| Effect-hook registry (content is data, not switch statements) | `src/systems/effects.js` | R-GOV-003, 22.5, R-TEC-006 |
| Modifier adapter resolution with GDD 7.3 precedence | `src/systems/adapters.js` | R-WPN-005, R-ITM-006, D-010 |
| Pixel-art DSL: art as reviewable text, silhouette signatures | `src/render/sprites.js` | 18.1-18.5, R-ART-001/002/004 |
| Content validator, dev server | `tools/` | R-TEC-005, R-QA-005 |
| Agent brief, ID registry, canonical GDD | `docs/` | 22.4, 20.6 |

**Key architecture decisions**

- **Vanilla ES modules, no build step, zero runtime dependencies.** `index.html`
  at the repo root means GitHub Pages serves the repository directly, and Node
  runs the same modules headlessly for tests and tools.
- **Art is authored as palette-indexed character grids**, not binary files. Sprites
  diff meaningfully in review, palette swaps give free department reskins and elite
  markers, and CI can validate them where no canvas exists.
- **Audio is synthesised from declarative recipes**, so the repo stays text-only.
- **1 world unit = 32px** (the GDD's sprite reference grid), so GDD stat values
  like "5.5 world units/second" are used literally with no conversion.
- **Health is counted in half-units everywhere.** 6 half-units = 3 Composure icons.

---

## Phase 1 — Player, combat framework, room lifecycle — **IN PROGRESS**

| Deliverable | File | Status |
|---|---|---|
| Half-unit health: Composure/Caffeine/Spite/Golden Cushion | `src/entities/health.js` | DONE |
| GDD 5.5 statuses incl. player-side restrictions | `src/entities/status.js` | DONE |
| Damage resolver: GDD 5.3 order step by step, scoped procs | `src/systems/combat.js` | DONE |
| Player: GDD 5.1 baseline as the single balance reference | `src/entities/player.js` | DONE |
| GDD 6.3 projectile model, aggregation over deletion | `src/entities/projectile.js` | DONE |
| GDD 6.1 room lifecycle + 12.3 door table + watchdog | `src/systems/room-state.js` | DONE |
| Input, remapping, cardinal aim resolution | `src/systems/input.js` | TODO |
| Camera: room lock, bounded large-room follow | `src/render/camera.js` | TODO |
| Physics/collision pass in GDD 6.4 priority order | `src/systems/physics.js` | TODO |
| Difficulty budget calculator (GDD 6.6) | `src/systems/encounter-budget.js` | TODO |
| Run manager: seed, route, transitions, run states | `src/systems/run.js` | TODO |
| Unit + seed-fixture tests | `tests/combat.test.js` | TODO |

Requirements: R-PLY-001..006, R-CMB-001..006, R-CAM-001..004, R-ROM-002/003/005,
R-LOOP-004/005, R-ENM-002.

---

## Phase 2 — Procedural floor generation + validation suite — **BLOCKED (agent lost to session limit)**

| Deliverable | File |
|---|---|
| GDD 11.4's fourteen-step generator, multi-cell/L-shaped footprints, socket graph | `src/systems/floorgen.js` |
| Validation pass: connectivity, role counts, dead ends, nav, blast points | `src/systems/floor-validate.js` |
| Headless 10,000-floors-per-definition harness | `tools/stress-floors.js` |
| Determinism + property + seed-fixture tests | `tests/floorgen.test.js` |

Requirements: R-FLR-001..010, R-ROM-001/006, R-ENV-004, R-QA-001, GDD 23.2.

**Critical separation to preserve:** the generator builds topology and assigns
architecture. Encounter selection is a *later layer* (D-006, R-FLR-007) — a room
is a place, not an enemy list.

---

## Phase 3 — Weapons, attack graph, modifier adapters — **TODO**

14 weapons across 8 archetypes; the attack graph that combines weapon + passives +
transformations + statuses; every adapter in `docs/ID_REGISTRY.md`; all required
synergies from GDD 8.5. NO_EFFECT stays a valid, intended outcome.

Requirements: R-WPN-001..006, R-ITM-006, 7.2-7.5, 8.5.

## Phase 4 — Items, loot service, economy, consumables — **TODO**

60 passives, 15 actives, 18 Action Cards, 14 Supplements, 18 Desk Charms,
4 Transformations. Loot service: 10 pools, GDD 8.4's weighted algorithm, quality
gates, the 0.10% early jackpot, seen decay, rerolls, set drops. Shop, containers,
Toner Charges, resource-starvation protection.

Requirements: R-ITM-001..008, R-CON-001..005, R-ECO-001..005, 8.3-8.7, 9.

## Phase 5 — Enemies: 58 definitions, variants, encounters — **TODO**

13 behaviour archetypes, readability contract, variants with real functional
deltas, encounter definitions with budget ranges and spawn zones, continuity
weighting (≥70% native per department).

Requirements: R-ENM-001..008, 14.

## Phase 6 — Bosses: 29 definitions, phases, arenas — **TODO**

Phase lists with entry/exit conditions, telegraph minimums, bounded
invulnerability, guaranteed safe paths, set drops, unlock and ending hooks.

Requirements: R-BSS-001..007, 15.

## Phase 7 — Departments, room templates, objects, hazards — **TODO**

13 departments; the F.3 template pack minimums per department pair; 24
environmental objects with loot tables and bounded chain reactions; hazard
families.

Requirements: R-DPT-001..006, R-ROM-001..006, R-ENV-001..006.

## Phase 8 — Progression, unlocks, endings, profiles, save — **TODO**

Hidden counters, the CEO-clear milestone ladder (16.4), the deep hidden route
chain (16.5), 9 endings, 8 employee profiles, challenges, a collection screen with
**no denominators**. Save service: five domains, atomic writes with backup
recovery, migration, seed modes.

Requirements: R-PRG-001..006, R-SAV-001..005, R-UIX-003, R-QA-007.

## Phase 9 — UI/UX, accessibility, art, VFX, audio — **TODO**

HUD, qualitative item language, map, five menus, the full accessibility set.
Sprites for every entity and collectible. Procedural WebAudio with GDD 19.2 mix
priority and a unique secret-discovery sting.

Requirements: R-UIX-001..006, R-ART-001..004, R-AUD-001..004.

## Phase 10 — QA gates, balance, traceability, release — **TODO**

All eight test layers (23.1), the procedural suite (23.2), the combat matrix
(23.3), release gates R-QA-001..007. Complete `REQUIREMENT_TRACEABILITY.md` for
every requirement ID. Playable smoke test. GitHub Pages deployment.

---

## Execution notes

**Parallelisation.** Content is data, so most content phases fan out cleanly once
the schemas exist. Runtime behaviour serialises behind the combat core. Cross-agent
drift is prevented by `docs/ID_REGISTRY.md` (closed id, mechanic, adapter, and hook
vocabularies) plus `npm run validate`, which fails on any unresolved reference.

**Sprite and localization ownership is partitioned by file**, with an id-prefix
table in `content/sprites/index.js`, so parallel authors cannot collide.

**Known risk realised on the first fan-out:** six parallel agents each reading the
288KB GDD exhausted the session token budget before writing output. Mitigation for
subsequent waves: give agents targeted GDD line ranges instead of whole sections,
cap concurrency at two or three, and have each agent write its files incrementally
rather than composing everything before the first write.
