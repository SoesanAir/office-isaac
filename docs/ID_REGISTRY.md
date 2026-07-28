# ID Registry

Canonical, reserved content ids. **Cross-references are validated**, so an author
who invents an id outside these conventions breaks someone else's module.

GDD refs: 20.6 (stable unique ASCII ids; removed ids stay reserved; tags use a
controlled registry), R-TEC-003 (save identity uses stable ids), R-QA-005.

## Fixed by the GDD (do not renumber)

| Kind | Ids | Source |
|---|---|---|
| weapon | `WPN-001`..`WPN-014` | Appendix B.1 |
| passive | `ITM-001`..`ITM-060` | Appendix C.1 |
| active | `ACT-001`..`ACT-015` | Appendix C.3 |
| card | `CARD-001`..`CARD-018` | Appendix C.4 |
| supplement | `SUP-001`..`SUP-014` | Appendix C.5 |
| charm | `CHR-001`..`CHR-018` | Appendix C.6 |
| transformation | `TRN-001`..`TRN-004` | Appendix C.7 |
| enemy | `ENM-001`..`ENM-058` | Appendix D.1 |
| boss | `BSS-001`..`BSS-029` | Appendix E |
| department | `DPT-001`..`DPT-013` | Appendix A |
| envObject | `ENV-001`..`ENV-024` | Appendix F.2 |
| ending | `END-001`..`END-009` | GDD 16.7 |
| profile | `PRF-001`..`PRF-008` | GDD 16.6 |
| room role | `ROOM-001`..`ROOM-028` | Appendix F.1 — these are **roles**, not templates |

## Derived id conventions (authored here, must match exactly)

### Floors — `FLOOR-<DEPT>_<TIER>`

Depth is the ordered progression index used by budgets and quality gates.

| Floor id | Department | Tier | Depth |
|---|---|---|---|
| `FLOOR-OPEN_OFFICE_1` | DPT-001 | 1 | 1 |
| `FLOOR-OPEN_OFFICE_2` | DPT-001 | 2 | 2 |
| `FLOOR-IT_1` | DPT-002 | 1 | 3 |
| `FLOOR-IT_2` | DPT-002 | 2 | 4 |
| `FLOOR-OPERATIONS_1` | DPT-003 | 1 | 5 |
| `FLOOR-OPERATIONS_2` | DPT-003 | 2 | 6 |
| `FLOOR-EXECUTIVE_1` | DPT-004 | 1 | 7 |
| `FLOOR-EXECUTIVE_2` | DPT-004 | 2 | 8 |
| `FLOOR-FINANCE_1` / `_2` | DPT-005 | 1 / 2 | 5 / 6 (alternate chapter 3) |
| `FLOOR-MARKETING_1` / `_2` | DPT-006 | 1 / 2 | 5 / 6 (alternate chapter 3) |
| `FLOOR-LEGAL_1` / `_2` | DPT-007 | 1 / 2 | 7 / 8 (alternate chapter 4) |
| `FLOOR-FACILITIES_1` | DPT-008 | 1 | 4 (secret branch) |
| `FLOOR-RND_1` | DPT-009 | 1 | 6 (secret branch) |
| `FLOOR-BOARD_1` / `_2` | DPT-010 | 1 / 2 | 9 / 10 |
| `FLOOR-PARENT_1` | DPT-011 | 1 | 11 |
| `FLOOR-CONGLOMERATE_1` | DPT-012 | 1 | 12 |
| `FLOOR-OWNERSHIP_1` | DPT-013 | 1 | 13 |

Legal replaces **Executive I** only (GDD 10.5) — depth 7 — and still leads to
Executive II. Finance and Marketing replace **Operations** — depths 5 and 6.

### Routes — `ROUTE-<NAME>`

`ROUTE-BASE` (visible eight floors + CEO), `ROUTE-BOARD`, `ROUTE-PARENT`,
`ROUTE-CONGLOMERATE`, `ROUTE-OWNERSHIP`, `ROUTE-FACILITIES_BRANCH`,
`ROUTE-RND_BRANCH`.

### Boss pools — plain strings referenced by `floor.bossPool` / `department.bossPools`

`BOSSPOOL-OPEN_OFFICE_1`, `BOSSPOOL-OPEN_OFFICE_2`, `BOSSPOOL-IT_1`,
`BOSSPOOL-IT_2`, `BOSSPOOL-OPERATIONS_1`, `BOSSPOOL-OPERATIONS_2`,
`BOSSPOOL-EXECUTIVE_1`, `BOSSPOOL-EXECUTIVE_2`, `BOSSPOOL-FINANCE_1`,
`BOSSPOOL-FINANCE_2`, `BOSSPOOL-MARKETING_1`, `BOSSPOOL-MARKETING_2`,
`BOSSPOOL-LEGAL_1`, `BOSSPOOL-LEGAL_2`, `BOSSPOOL-FACILITIES`, `BOSSPOOL-RND`,
`BOSSPOOL-BOARD_2`, `BOSSPOOL-PARENT`, `BOSSPOOL-CONGLOMERATE`,
`BOSSPOOL-OWNERSHIP`.

Every boss lists the pools it belongs to in `floorPools`.

### Encounter pools — referenced by `floor.encounterPools`

`ENCPOOL-<DEPT>_<TIER>`, e.g. `ENCPOOL-OPEN_OFFICE_1`.

### Room template pools — referenced by `department.roomTemplatePools`

`TPLPOOL-<DEPT>_NORMAL`, `TPLPOOL-<DEPT>_SPECIAL`, `TPLPOOL-SERVICE_SHARED`.

### Room templates — `TPL-<DEPT>_<ROLE>_<SIZE>_<LETTER>`

Examples: `TPL-OPEN_OFFICE_NORMAL_1X1_A`, `TPL-OPEN_OFFICE_LARGE_2X2_A`,
`TPL-IT_SUPPLY_1X1_A`, `TPL-SHARED_HALLWAY_1X1_A`, `TPL-OPEN_OFFICE_BOSS_2X2_A`.
Size token is the bounding box in grid cells (`1X1`, `2X1`, `1X2`, `2X2`, `3X1`,
`L2X2`).

### Hazards — `HAZ-<FAMILY>_<NAME>`

Examples: `HAZ-SPILLS_WATER`, `HAZ-SPILLS_COFFEE`, `HAZ-ELECTRICITY_ARC`,
`HAZ-CABLES_TRIP`, `HAZ-CONVEYORS_LANE`, `HAZ-SCANNERS_SWEEP`,
`HAZ-MACHINE_STATES_STEAM`, `HAZ-GLASS_SHARDS`, `HAZ-FIRE_SMALL`,
`HAZ-PAPER_PILE`, `HAZ-FOAM_PUSH`, `HAZ-RED_TAPE_WALL`, `HAZ-DARKNESS_ZONE`,
`HAZ-PRESSURE_ZONE`, `HAZ-VOTE_ZONE`.

### Object loot tables — `OLT-<NAME>`

One per destructible/interactive object family plus shared enemy drops:
`OLT-CABINET`, `OLT-COOLER`, `OLT-PRINTER`, `OLT-BIN`, `OLT-VENDING`,
`OLT-PLANT`, `OLT-DIVIDER`, `OLT-DESK`, `OLT-CHAIR`, `OLT-SERVER_RACK`,
`OLT-CABLE_BUNDLE`, `OLT-GLASS`, `OLT-SHELF`, `OLT-WHITEBOARD`,
`OLT-COFFEE_MACHINE`, `OLT-EXTINGUISHER`, `OLT-CART`, `OLT-LOCKED_CABINET`,
`OLT-POWER_STRIP`, `OLT-TROPHY_CASE`, `OLT-PAPER_PILE`, `OLT-SCANNER`,
`OLT-CONVEYOR`, `OLT-STAIN`, `OLT-ENEMY_COMMON`, `OLT-ENEMY_ELITE`,
`OLT-ENEMY_SWARM`, `OLT-ENEMY_NONE`.

### Loot pools — `POOL-<POOL_ENUM>`

`POOL-SUPPLY_CLOSET`, `POOL-MANAGER_REWARD`, `POOL-OFFICE_SUPPLY_SHOP`,
`POOL-SECRET_MAINTENANCE`, `POOL-RESTRICTED_RECORDS`, `POOL-INNOVATION_LAB`,
`POOL-UNION_BREAKROOM`, `POOL-EXECUTIVE_DEAL`, `POOL-GOLDEN_CABINET`,
`POOL-SET_DROP`.

### Sounds — `SFX-<GROUP>_<NAME>`

Groups: `WPN`, `IMPACT`, `ENM`, `BOSS`, `UI`, `ROOM`, `PICKUP`, `HAZ`, `OBJ`,
`AMB`, `STING`, `SECRET`, `PLAYER`.

Per-department ambience and transition stings are fixed:
`SFX-AMB_OPEN_OFFICE`, `SFX-STING_OPEN_OFFICE`, and the same pattern for
`IT`, `OPERATIONS`, `EXECUTIVE`, `FINANCE`, `MARKETING`, `LEGAL`, `FACILITIES`,
`RND`, `BOARD`, `PARENT`, `CONGLOMERATE`, `OWNERSHIP`.

The secret-discovery confirmation is `SFX-SECRET_CONFIRM` (R-AUD-004: unique and
unmistakable).

### Music — `MUS-<NAME>`

`MUS-TITLE`, `MUS-OPEN_OFFICE`, `MUS-IT`, `MUS-OPERATIONS`, `MUS-EXECUTIVE`,
`MUS-FINANCE`, `MUS-MARKETING`, `MUS-LEGAL`, `MUS-FACILITIES`, `MUS-RND`,
`MUS-BOARD`, `MUS-PARENT`, `MUS-CONGLOMERATE`, `MUS-OWNERSHIP`,
`MUS-BOSS_GENERIC`, `MUS-BOSS_CEO`, `MUS-BOSS_FINAL`, `MUS-SHOP`,
`MUS-SECRET`, `MUS-GAME_OVER`.

### Unlocks — `UNLOCK-<NAME>`

Examples: `UNLOCK-CEO_1`, `UNLOCK-CEO_3`, `UNLOCK-CEO_5`, `UNLOCK-CEO_7`,
`UNLOCK-CEO_10`, `UNLOCK-BOARD_ROUTE`, `UNLOCK-PARENT_ROUTE`,
`UNLOCK-CONGLOMERATE_ROUTE`, `UNLOCK-OWNERSHIP_ROUTE`, `UNLOCK-PROFILE_INTERN`,
`UNLOCK-DPT_FINANCE`, `UNLOCK-ITEM_MASTER_BADGE`.

### Challenges — `CHL-001`..

### Localization keys

`snake_case` dotted paths: `weapon.keyboard.name`, `item.pen_laser.phrase`,
`enemy.office_drone.name`, `boss.ceo.name`, `department.it.name`,
`ending.termination.name`, `caption.secret_confirm`, `ui.pause.resume`.

## Modifier mechanics and adapters (GDD 7.3)

A passive modifier declares a `mechanic` name; a weapon may claim that mechanic in
its own `adapters` map; the resolver picks the adapter. Both vocabularies are
closed — invent nothing outside these lists without adding it here first.

### Mechanic names (`passive.modifier.mechanic`, `weapon.adapters` keys)

`HOMING`, `EIGHT_DIRECTION`, `SPLIT`, `RETURN`, `BOUNCE`, `PIERCE`, `STICK`,
`DUPLICATE`, `MULTIPLY_DUAL`, `MULTIPLY_TRIPLE`, `REPEAT_ECHO`, `RHYTHM_CHARGED`,
`RHYTHM_ALTERNATE`, `SIZE`, `RANGE`, `KNOCKBACK`, `WALL_PASS`, `NEAR_MISS_STEER`,
`TRAIL_HAZARD`, `STATUS_SLOW`, `STATUS_MARK`, `STATUS_SHOCK`, `ARMOR_PIERCE`,
`CRIT`, `CADENCE`, `SPREAD_CONTROL`.

### Adapter ids (`defineAdapter` / `defaultAdapter` / `weaponOverrides` values)

The GDD names these explicitly in §7.3 and Appendix G.2, so those spellings are
fixed: `HomingProjectileAdapter`, `HomingArcAdapter`, `TrackingBeamAdapter`,
`CurvingTetherAdapter`, `SteeringWaveAdapter`, `EightDirectionAdapter`,
`SplitProjectileAdapter`, `ReturnProjectileAdapter`.

Remaining adapters follow the same `<Behaviour><Archetype>Adapter` shape:

- Projectile family — `BounceProjectileAdapter`, `PierceProjectileAdapter`,
  `StickProjectileAdapter`, `DuplicateProjectileAdapter`,
  `DualProjectileAdapter`, `TripleProjectileAdapter`, `SizeProjectileAdapter`,
  `RangeProjectileAdapter`, `KnockbackProjectileAdapter`,
  `WallPassProjectileAdapter`, `NearMissSteerAdapter`, `TrailProjectileAdapter`,
  `StatusProjectileAdapter`.
- Melee / area family — `ReachArcAdapter`, `RepeatArcAdapter`,
  `OffsetArcAdapter`, `EightDirectionArcAdapter`, `KnockbackArcAdapter`,
  `EchoSlamAdapter`, `SizeSlamAdapter`, `EightDirectionSlamAdapter`.
- Beam / cone / placed family — `ForkBeamAdapter`, `PulseBeamAdapter`,
  `RangeBeamAdapter`, `StatusBeamAdapter`, `WidenConeAdapter`,
  `StatusConeAdapter`, `AggregateConeAdapter`, `AnglePlacementAdapter`,
  `UptimePlacementAdapter`, `RevealPlacementAdapter`.
- Tether family — `LengthTetherAdapter`, `ShockTetherAdapter`,
  `ReturnTetherAdapter`.
- Charge wave family — `PairedWaveAdapter`, `WeightWaveAdapter`,
  `SizeWaveAdapter`.
- Cadence / rhythm (weapon-agnostic, operate on the attack event) —
  `MacroRepeatAdapter`, `ChargedEighthAdapter`, `AlternatingAdapter`,
  `CritAdapter`, `ArmorPierceAdapter`, `SpreadControlAdapter`.

`NO_EFFECT` is a legitimate resolution, not a gap (R-WPN-005, R-ITM-006).

## Effect hook names (`effects[].hook`, `effectHook`)

Hooks are `UPPER_SNAKE_CASE` and describe *what happens*, not which item owns
them, so several items can share one hook with different `params`. Timing points
are listed in `src/systems/effects.js`.

Shared hooks that content should prefer over bespoke ones:
`STAT_MODIFY`, `PATTERN_MODIFY`, `HEAL_ON_ROOM_CLEAR`, `CHANCE_ON_HIT_STATUS`,
`CHANCE_ON_HIT_DAMAGE`, `SHIELD_FIRST_HIT_PER_FLOOR`, `ORBITAL_FAMILIAR`,
`SHOOTING_FAMILIAR`, `SPAWN_PICKUP_ON_FLOOR_START`, `FREE_DOOR_PER_FLOOR`,
`FREE_DOOR_ALWAYS`, `REVEAL_ROOM_CATEGORY`, `REVEAL_BOSS_ROOM`,
`REROLL_LEFT_PEDESTAL`, `CREDIT_DEBT_LINE`, `REVIVE_ONCE`,
`DAMAGE_SCALE_ON_LOW_HEALTH`, `CONTACT_DAMAGE_AURA`, `ERASE_NEAR_MISS`,
`DUPLICATE_HOSTILE_PROJECTILES`, `SHORTEN_ENEMY_COOLDOWNS`,
`DISABLE_ACTIVE_UNTIL_CLEARS`, `CRIT_CHANCE`, `CRIT_VS_FULL_HEALTH`,
`MARK_ON_FIRST_HIT`, `CHAIN_SHOCK_ON_HIT`, `PICKUP_WEIGHT_BIAS`,
`STORE_EXCESS_HEAL`, `RETAIN_SPENT_CARD`, `EXTRA_SHOT_EVERY_N`.

### Sprite ids

Lower `snake_case` with the domain prefix from
`content/sprites/index.js`. Examples: `player_base`, `enemy_office_drone`,
`boss_ceo`, `item_pen_laser`, `weapon_keyboard`, `obj_filing_cabinet`,
`haz_water_spill`, `tile_open_office_floor`, `prj_keycap`, `ui_composure_full`.
