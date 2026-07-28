# Project Codename: Office Isaac
## Game Design and Engineering Specification

**Version:** 1.0 - North-Star Specification  
**Date:** 28 July 2026  
**Status:** Approved design baseline  
**Shipping title:** Not selected; Office Isaac is an internal codename only.

> The interface remains almost childlike. The systems beneath it may be viciously deep.

# Contents

- 0. Document Control and Decision Ledger
- 1. Executive Summary
- 2. Design Constitution
- 3. Player Experience and Run Structure
- 4. Controls, Camera, and Moment-to-Moment Presentation
- 5. Player Model, Health, and Core Stats
- 6. Combat Framework
- 7. Weapon System
- 8. Item, Build, and Synergy Systems
- 9. Consumables, Pickups, and Economy
- 10. World and Department Structure
- 11. Procedural Floor Generation
- 12. Room Architecture, Encounters, and Special Rooms
- 13. Environmental Objects and Hazards
- 14. Enemy System
- 15. Boss System
- 16. Progression, Unlocks, Endings, and Hidden Expansion
- 17. User Interface, User Experience, and Accessibility
- 18. Art, Animation, and Visual Effects
- 19. Audio Direction
- 20. Technical Architecture and Data Contracts
- 21. Save Data, Seeds, Debugging, and Telemetry
- 22. AI Development Contract
- 23. Quality Assurance and Acceptance Criteria
- 24. Release Content Baseline
- 25. Risk Register and Design Safeguards
- 26. Glossary
- Appendix A. Department Database
- Appendix B. Weapon Database
- Appendix C. Starter Item Database
- Appendix D. Enemy Database
- Appendix E. Boss Database
- Appendix F. Room and Environment Catalog
- Appendix G. Data Schema Examples
- Appendix H. Benchmark References and Originality Guardrails

> **How to use this document:** This GDD is the source of truth for design intent and player-facing behavior. Technical plans may divide work into milestones, but may not change these rules without a documented GDD revision.

# 0. Document Control and Decision Ledger

## 0.1 Authority and normative language

This document defines the intended game, not merely an initial prototype. It is deliberately broader than an MVP. Development plans may select a subset for a vertical slice, but every subset must remain compatible with the complete design.

- SHALL and MUST indicate mandatory behavior.
- SHOULD indicates a strong default that may be changed only with a recorded design reason.
- MAY indicates an optional extension that must not break mandatory behavior.
- Tunable values are implementation defaults stored in data. They may be changed through playtesting without changing the design rule they serve.
- Player-facing copy may be playful; internal definitions must remain precise.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-GOV-001 | The GDD is the design authority. Code comments, task tickets, and generated plans are subordinate. | A conflicting implementation is treated as a defect until the GDD is intentionally revised. |
| R-GOV-002 | All permanent design changes require a revision note with affected requirement IDs. | The document version and change log identify the altered rules. |
| R-GOV-003 | Content must be data-driven unless a mechanic genuinely requires code. | Adding a normal item, enemy, room, or department does not require editing core system logic. |
| R-GOV-004 | The shipping title, engine, and final art production pipeline are separate production decisions. | No code or asset path assumes the internal codename is the public product name. |

## 0.2 Owner decision ledger

The following decisions are locked because they express the core product, not incidental implementation details.

| Decision | Subject | Locked rule |
| --- | --- | --- |
| D-001 | Mechanical reference | Use The Binding of Isaac as a benchmark for proven roguelike structure. Recreate the purpose of a mechanic through original corporate-office content rather than copying names, art, layouts, text, or code. |
| D-002 | Primary fantasy | An ordinary employee fights upward through a giant corporation and gives it to the corporate machine. |
| D-003 | World structure | Departments are chapters. Each normal department contains two sequential floors, with the second escalating the first. |
| D-004 | Room topology | Floors are connected graphs of square or rectangular rooms on a logical grid. Rooms use north, south, east, and west perimeter door sockets. |
| D-005 | Large rooms | A room may occupy multiple grid cells and may expose multiple doors on the same side. It remains one combat room and one graph node. |
| D-006 | Room independence | Room architecture and enemy encounter selection are separate. The same layout may appear empty, with different enemies, rewards, or environmental states. |
| D-007 | Weapons | The player carries exactly one primary weapon. Picking up another weapon replaces it; the previous weapon remains available on the pedestal unless a specific effect says otherwise. |
| D-008 | Items | Passive items stack. Active items occupy a dedicated slot and recharge through room clears. Pocket consumables and mystery consumables are separate systems. |
| D-009 | Item roles | An item has one fixed role. A pen laser pointer is always a modifier; a large presentation laser pointer is always a weapon. The game never asks which mode the player wants. |
| D-010 | Synergies | A modifier may affect different weapons differently, and may have no interaction with some weapons. Handcrafted transformations may exist, but not every pair needs a recipe. |
| D-011 | Randomness | Items are selected from weighted pools. Some items are much rarer. Floor depth influences availability, but a tiny early-floor jackpot chance can produce an endgame-quality item. |
| D-012 | No player tuning | The player cannot configure loot odds, rarity, encounter weights, or balance. Complexity belongs in the game, not in setup menus. |
| D-013 | Hidden math | Player-facing descriptions communicate feel, not exact stat values. Obvious counters such as credits, keys, charges, and health may be numeric. |
| D-014 | Knowledge traps | A small item subset may be undesirable or irritating. The first pickup teaches the player; later recognition lets the player leave it behind. |
| D-015 | Secret scope | The first apparent ending is not the real end. Repeated victories silently reveal additional floors, bosses, routes, and endings. |
| D-016 | Mystery | The game does not announce the total number of endings, departments, bosses, items, or secrets. |
| D-017 | Theme density | Every visual, room, enemy, boss, pickup, and joke should feel native to corporate office culture. |
| D-018 | HR usage | Human Resources is primarily an enemy, event, and special-room theme, not a mandatory main department in the base route. |
| D-019 | Interface | The game is extremely easy to read and operate. Depth emerges through play, not menu management or explanatory pop-ups. |
| D-020 | Community learning | A player-made wiki is desirable. A wiki must not be required to move, fight, finish a normal run, or understand immediate danger. |

## 0.3 Explicit exclusions

- No global reputation system drives the entire game.
- No permanent skill tree grants raw universal stat increases between runs.
- No dedicated dodge roll exists in the baseline move set; dodging is accomplished through movement and positioning. Items may grant exceptional movement abilities.
- No item-mode selection dialog appears on pickup.
- No visible spreadsheet-style stat panel is required for normal play.
- No procedural system may assemble unreadable rooms from arbitrary geometry during combat. Interior room templates are authored; selection and population are procedural.
- No hidden dynamic director secretly suppresses strong synergies because the current run is powerful.
- No content may directly reproduce protected assets, names, text, audio, room layouts, characters, or source code from the inspiration.

# 1. Executive Summary

## 1.1 Elevator pitch

> **Pitch:** A fast, top-down action roguelike in which an ordinary employee climbs a procedurally generated corporate tower, replacing weapons and stacking office-themed items until the run becomes gloriously absurd.

The player begins on an open-plan cubicle floor with a keyboard that fires keys in four cardinal directions. They clear handcrafted rooms populated by randomized encounters, discover supply closets and shops, search for hidden maintenance spaces, defeat a manager, receive a guaranteed reward, and take the elevator upward. Each department occupies two floors and introduces a new visual identity, enemy language, hazard family, and boss pool.

The first campaign appears to end with the CEO. Repeated victories quietly reveal that the CEO is only another layer. The elevator begins traveling beyond the known building, eventually exposing the Board, the parent company, the conglomerate, and the ultimate beneficial owner.

## 1.2 Product promise

- Simple controls that feel correct within seconds.
- Room-to-room combat with immediate, readable threats.
- A build that changes visibly and mechanically during every run.
- Hundreds of authored content pieces recombined by deterministic procedural systems.
- Rare jackpots that can transform a run on the first floor.
- Secrets and endings that expand the perceived size of the game without menu announcements.
- Office satire delivered through mechanics and visuals rather than long dialogue.

## 1.3 Genre, perspective, and platform assumptions

| Dimension | Definition |
| --- | --- |
| Genre | Single-player, room-based, top-down action roguelike with procedural floor layouts and permanent content unlocks. |
| Perspective | Fixed orthographic top-down view. The camera shows one complete room or a bounded large-room viewport at a time. |
| Primary platform | PC-first design with full keyboard and controller support. Platform ports may follow without changing core rules. |
| Session length | Target normal successful run: 35-55 minutes before hidden extensions. Early failed runs may last under 10 minutes. |
| Player count | One local player in the baseline. Cooperative play is outside the release baseline and must not shape core architecture unless separately approved. |
| Business model | Not defined by this GDD. Monetization must never sell power, loot odds, or unlock shortcuts. |

## 1.4 Core loop

```text
START RUN
  -> enter generated floor
  -> explore connected rooms
  -> fight readable enemy combinations
  -> collect resources and build-changing items
  -> find supply closet, shop, secrets, and optional risks
  -> defeat floor boss
  -> receive guaranteed manager reward
  -> take elevator to next floor
  -> reach apparent ending, hidden continuation, or death
  -> unlock content and begin another run
```

## 1.5 Success criteria

| ID | Success condition | Evidence |
| --- | --- | --- |
| R-VIS-001 | A new player understands movement and firing without a tutorial wall. | In onboarding tests, players clear the first hostile room with no external explanation. |
| R-VIS-002 | A veteran can identify most common enemies and their attack intent at a glance. | Silhouette and telegraph recognition tests exceed the agreed target. |
| R-VIS-003 | Runs produce stories worth retelling. | Playtest notes consistently include specific item, room, boss, or secret moments rather than only completion times. |
| R-VIS-004 | Power growth is visible. | Late-run footage looks and feels materially different from the starting build. |
| R-VIS-005 | The game creates the belief that the next run could be exceptional. | Players voluntarily restart after failure and report anticipation around early item rooms. |

# 2. Design Constitution

When two implementations are both technically valid, choose the one that better serves these principles. A clever feature that violates the constitution is still the wrong feature. Games have enough accidental complexity without engineering a new species of it.

## Core principles

### 2.1 Gameplay over realism

The office is a source of mechanics and comedy, not a simulation. A stapler may fire industrial volleys and a printer may become a beast if the result is readable and fun.

### 2.2 Simple input, deep interaction

Movement and attack remain simple. Depth comes from room layouts, enemy combinations, resource decisions, and item interactions.

### 2.3 Recognition before reaction

Threats must be identifiable before the player is expected to respond. Silhouettes, timing, sound, color, and motion all contribute.

### 2.4 Hidden math, visible consequences

The game hides formulas but shows effects through cadence, projectile size, animation, sound, and short qualitative pickup text.

### 2.5 Controlled randomness

Random systems use explicit pools, weights, gates, and validation. Random does not mean arbitrary.

### 2.6 Every run can become the run

Any item pedestal can create anticipation. Early jackpots remain possible, while later floors sustain opportunity rather than making the player feel the run is already decided.

### 2.7 Discovery over instruction

Secrets are found through curiosity, observation, repetition, and community discussion. The game avoids achievement-style announcements for major hidden continuations.

### 2.8 Theme everywhere

The corporate metaphor appears in mechanics, not merely names pasted over generic fantasy content.

### 2.9 Readable chaos

Late runs may become visually outrageous, but hostile projectiles, hazards, and player attacks must remain distinguishable.

### 2.10 Failure teaches

Death should suggest a better dodge, route, resource choice, or item decision. Unavoidable damage is a bug unless a clearly priced sacrifice caused it.

### 2.11 Content recombines

Authored pieces should support many combinations. Layouts, encounters, hazards, rewards, and decorations are layered rather than fused into one-use rooms.

### 2.12 No invisible fun police

The game does not secretly nerf a strong build because it is winning. Performance protections may merge effects visually, but the mechanical benefit remains.

### 2.13 Knowledge is progression

The largest long-term advantage is recognizing enemies, items, room patterns, and secret logic. Meta unlocks expand possibility rather than supplying permanent generic power.

### 2.14 Surprise has structure

Major surprises are backed by rules and unlock conditions. They are not random cutscenes dropped from the ceiling like a desperate office morale initiative.

### 2.15 Respect the player

The game may be difficult, strange, and occasionally annoying. It must not waste time with slow menus, compulsory grinding, or explanations the player already understands.

## 2.16 The reference translation rule

1. Identify the gameplay problem being solved by the reference mechanic.
2. Describe its player-facing purpose without using the reference content or terminology.
3. Design an original corporate-office expression of that purpose.
4. Check the result against this constitution, especially clarity, theme density, and replayability.
5. Record the new mechanic as an independent requirement and data contract.

> **Originality boundary:** The project may borrow genre structures and mechanical ideas. It must not borrow expression: no copied sprites, names, descriptions, audiovisual identity, code, exact room layouts, narrative, or recognizable item catalog.

## 2.17 Feature admission test

A proposed feature should be rejected or redesigned if it cannot answer at least two of the following with a strong yes:

- Does it improve combat, exploration, build variety, discovery, or meaningful decision-making?
- Does it create a new interaction rather than a reskinned number?
- Can the player understand the immediate consequence without reading a manual?
- Does it strengthen the corporate-office identity?
- Can it recombine with existing content?
- Can it be implemented data-first and tested deterministically?

# 3. Player Experience and Run Structure

## 3.1 Core fantasy

The player is not climbing a career ladder. They are physically climbing the building while dismantling the machine that employs them. The emotional fantasy is rebellion through competence: the employee starts ordinary, learns the building, assembles an impossible desk-drawer arsenal, and turns corporate infrastructure against itself.

## 3.2 Intended emotional rhythm

| Phase | Emotion | Design tools |
| --- | --- | --- |
| Entry | Curiosity | Unknown map, new room composition, ambient department storytelling. |
| Combat | Tension | Locked doors, readable enemy patterns, constrained movement. |
| Clear | Relief | Door sound, room reward, brief visual quiet. |
| Pickup | Anticipation | Distinct pedestal, item silhouette, short phrase, immediate effect. |
| Build test | Experimentation | The next room reveals how the item changes the current weapon. |
| Power spike | Delight | Noticeable synergy, transformation, rare jackpot, or boss reward. |
| Optional risk | Greed and doubt | Challenge rooms, restricted areas, trades, secrets, or scarce keys. |
| Boss | Mastery pressure | Recognizable phases, escalating patterns, department climax. |
| Elevator | Suspense | A short reset before the next floor; hidden routes can interrupt expectations. |

## 3.3 Run states

| State | Entry condition | Exit condition |
| --- | --- | --- |
| New Run Setup | Player selects a profile and optional unlocked challenge. | Seed and run state are created. |
| Floor Exploration | Player arrives by elevator. | Boss defeated and exit used, alternate route taken, or player dies. |
| Room Combat | Player enters a hostile encounter. | All required enemies or waves are cleared. |
| Room Resolution | Combat ends or room is non-hostile. | Player leaves, interacts, buys, swaps, or uses a route. |
| Boss Resolution | Boss health reaches zero. | Reward collected or ignored; elevator or hidden exit used. |
| Apparent Ending | Current visible final boss is defeated. | Credits, chest, elevator continuation, or hidden route resolves. |
| Run End | Player dies or completes a terminal ending. | Unlock evaluation, collection updates, and results summary complete. |

## 3.4 Decision cadence

The player should encounter a meaningful decision approximately every 15-30 seconds during exploration and more frequently in shops or special rooms. Not every decision requires a menu. Choosing a door, spending an access card, leaving an item, blowing up a suspicious cabinet, or entering a challenge room all count.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-LOOP-001 | Every normal floor contains exactly one start room, one supply closet, one shop, and one boss room unless an explicit floor modifier overrides the rule. | Generation validation reports all required room roles. |
| R-LOOP-002 | Every defeated floor boss produces one manager reward pedestal. | Boss completion cannot produce zero or multiple default manager rewards. |
| R-LOOP-003 | A player may leave an undesirable pedestal item uncollected. | No standard item pickup is forced by contact with the room entrance or exit path. |
| R-LOOP-004 | Normal room clears may produce a pickup reward from a weighted clear pool. | Reward rolls are deterministic from the run seed and room stream. |
| R-LOOP-005 | The player can continue exploring a cleared floor before entering the elevator. | The floor exit does not force immediate transition. |
| R-LOOP-006 | A failed run updates discovery and unlock progress before returning to the menu. | Collection entries and condition counters persist after death. |

## 3.5 Failure and fairness

- Enemy contact, projectiles, hazards, and sacrifices use consistent damage rules.
- The player receives a brief invulnerability window after damage.
- A room may be difficult because of composition, density, or geometry, but must pass a soft-lock and unavoidable-damage validation pass.
- Bad items may complicate a run, but a standard pedestal may always be declined.
- A weak run remains beatable by skill; a powerful run may become absurd without being ashamed of itself.

## 3.6 First ten minutes

1. The run begins in a quiet start room on Open Office I. Movement and cardinal firing are immediately available.
2. The first hostile rooms use one or two clearly different enemy behaviors and generous telegraphs.
3. The first supply closet is unlocked and demonstrates the item pedestal language.
4. The first boss is selected from the low-complexity Open Office I pool and drops a guaranteed manager reward.
5. Open Office II increases density, introduces an elite or support enemy, and uses locked access for the supply closet.
6. The elevator to IT changes the audiovisual identity strongly enough to feel like a new chapter rather than new carpet pretending to be content.

# 4. Controls, Camera, and Moment-to-Moment Presentation

## 4.1 Baseline controls

| Action | Keyboard default | Controller default | Rule |
| --- | --- | --- | --- |
| Move | W A S D | Left stick / D-pad | Eight-direction movement is allowed; speed is analog on stick and normalized on keyboard. |
| Primary attack | Arrow keys | Right stick / face-button cluster | Baseline aim resolves to the four cardinal directions. |
| Use active item | Space | Left bumper | Uses the equipped active if fully charged or otherwise usable. |
| Use pocket item | Q | Right bumper | Consumes or activates the currently held Action Card or Supplement. |
| Interact / confirm | E or Enter | South face button | Used for shop purchase, machines, elevators, and explicit interactions. |
| Drop / cycle | Left Ctrl | Right trigger | Drops a pocket item or desk charm; cycles only when an item explicitly grants extra slots. |
| Map | Tab | View / Select | Expands the discovered floor map without pausing by default. |
| Pause | Escape | Menu | Opens pause, settings, controls, and collection access. |

> **Baseline dodge rule:** There is no universal dodge-roll button. Dodging is movement, spacing, and pattern reading. An item may grant a dash, blink, or invulnerability effect as an exception.

## 4.2 Aiming rules

- The starting Keyboard fires north, south, east, or west.
- Simultaneous cardinal inputs resolve according to weapon capability. Without a diagonal-enabling modifier, the most recent valid direction wins.
- The Numeric Keypad passive enables eight-direction aim for compatible weapons.
- The Pen Laser Pointer passive adds target-seeking behavior through weapon-specific adapters.
- Weapons may use charge, melee arc, beam, tether, or area targeting while preserving the same four attack inputs.
- The game never opens a mode selector when aim behavior changes.

## 4.3 Camera

Normal rooms fit entirely within the gameplay viewport. Large rooms may use a bounded camera that follows the player while keeping all active threats within a predictable combat canvas. Camera movement must not hide enemy telegraphs or create motion sickness.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-CAM-001 | Entering a normal room centers and locks the camera to that room. | The camera does not drift during normal-room combat. |
| R-CAM-002 | Large-room cameras remain inside authored bounds and use soft follow. | No camera position exposes void space or hides a valid door. |
| R-CAM-003 | Camera shake is event-based, brief, and separately adjustable. | Reduced-shake mode preserves damage feedback through other cues. |
| R-CAM-004 | Room transitions are fast and do not remove control longer than necessary. | Standard transition target is under 0.5 seconds excluding loading. |

## 4.4 Feedback hierarchy

1. Immediate danger: hostile projectile, attack wind-up, hazard activation, player damage.
2. Player action: weapon fire, impact, active use, pickup, purchase, door interaction.
3. Room state: doors lock, wave begins, room clears, reward appears.
4. Meta state: item discovered, unlock condition met, ending recorded.

Higher-priority feedback may temporarily suppress lower-priority decoration, particles, and ambient animation. It may not suppress mechanics.

# 5. Player Model, Health, and Core Stats

## 5.1 Starting profile

The default employee begins as a deliberately plain baseline. Unlockable employee profiles may alter starting stats, weapon, health model, or item, but the default profile defines balance.

| Internal stat | Starting value | Player-facing meaning |
| --- | --- | --- |
| Core health | 6 half-units | Three full Composure icons. |
| Move speed | 5.5 world units/second | Normal walking pace. |
| Damage | 10 base hit units | How hard the current weapon hits before weapon multipliers. |
| Attack interval | 0.45 seconds | Time between Keyboard shots. |
| Projectile speed | 9 world units/second | How quickly keys travel. |
| Range / lifetime | 0.95 seconds | How long a default key remains active. |
| Luck | 0 | Hidden modifier used only by effects that explicitly consult luck. |
| Invulnerability after hit | 0.75 seconds | Brief flashing protection after normal damage. |
| Weapon | Keyboard | Cardinal key projectiles. |
| Active slot | Empty | One active item maximum by default. |
| Pocket slot | Empty | One Action Card or Supplement maximum by default. |
| Desk charm slot | Empty | One subtle passive charm maximum by default. |

## 5.2 Health language

Health uses familiar icon-based chunks because combat readability matters more than inventing a tax return for damage. The office theme changes the presentation and secondary behavior, not the need to know whether another hit will kill the player.

| Health type | Visual | Behavior |
| --- | --- | --- |
| Composure | Red heart-shaped stress-ball icon | Refillable core health. Containers may be added or removed by items and trades. |
| Caffeine | Blue coffee-cup shield icon | Temporary buffer consumed before Composure. Normally cannot be refilled as a container. |
| Spite | Dark red cracked mug icon | Temporary buffer consumed before Composure. When a full icon is depleted, damages all hostile enemies in the room. |
| Golden Cushion | Gold outline around an existing icon | When the protected icon is lost, produces credits or a small reward burst. |
| Empty container | Unfilled stress-ball outline | Maximum Composure capacity that currently lacks health. |

## 5.3 Damage resolution order

1. Reject damage if the player is invulnerable, the source is invalid, or a shield effect blocks it.
2. Apply source-specific modifiers such as hazard immunity or contact resistance.
3. Consume Caffeine and Spite health before Composure unless an effect explicitly bypasses buffer health.
4. Trigger depletion effects, on-hit items, and damage audio/visual feedback.
5. Begin the invulnerability window.
6. If total health is zero, enter the death sequence and freeze further pickup or room-state mutation.

## 5.4 Core stat rules

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-PLY-001 | Internal stats use numeric values; normal UI uses qualitative language. | Pickup banners omit raw stat deltas except counters and costs. |
| R-PLY-002 | Movement remains responsive while firing. | No baseline attack animation locks movement. |
| R-PLY-003 | Stat changes clamp to safe data-defined limits. | Extreme synergies cannot create negative intervals, NaN values, or infinite speed. |
| R-PLY-004 | Damage sources carry tags and a source entity ID. | On-hit effects can distinguish projectile, contact, explosion, hazard, sacrifice, and self-damage. |
| R-PLY-005 | The player can be visually understood when surrounded by effects. | Player outline and hit flash remain visible in stress tests. |
| R-PLY-006 | No global reputation meter is present. | HUD and save schema contain no mandatory reputation progression field. |

## 5.5 Status effects

| Status | Player effect | Enemy effect | Visual rule |
| --- | --- | --- | --- |
| Slow | Reduces movement within clamp. | Reduces movement and dash rate. | Blue-gray trail; never changes projectile allegiance color. |
| Haste | Increases movement and may affect attack cadence if source says so. | Rare; used by support enemies. | Short motion streaks. |
| Burn | Periodic damage; cannot kill the player below one half-unit unless explicitly tagged lethal. | Periodic damage over duration. | Orange edge flame, low particle count. |
| Shock | Brief input disruption only for exceptional hazards; no long stun. | Chains damage or briefly interrupts non-boss actions. | White-blue snap with clear chain line. |
| Marked | Incoming hostile damage may be amplified by source-specific rules. | Takes increased player damage. | Highlighter outline. |
| Confused | Direction inversion is prohibited in baseline; use aim wobble or false telegraphs only in optional content. | Moves unpredictably or attacks allies. | Spinning icon and altered gait. |
| Rooted | Not used on the player in normal combat. | Prevents movement but not attacks. | Binder-clip icon and floor pin. |
| Silenced | Temporarily blocks active item use only in clearly telegraphed special encounters. | Blocks support abilities. | Muted speaker icon. |

# 6. Combat Framework

## 6.1 Combat room lifecycle

```text
ENTER ROOM
  -> select encounter already assigned to room instance
  -> spawn or stage enemies
  -> lock applicable doors
  -> begin telegraph grace window
  -> run combat until clear condition is true
  -> stop hostile spawning and resolve lingering hazards
  -> unlock doors
  -> roll clear reward
  -> charge active items
  -> record room as cleared
```

## 6.2 Baseline combat rules

- The player may move and attack simultaneously.
- Hostile rooms lock their normal exits when combat begins. Special escape effects may override this rule.
- Enemy attacks use authored patterns and data-defined timing. They do not directly read controller input to cheat reactions.
- Predictive attacks may target the player current velocity or estimated future position, but telegraph the chosen vector before committing.
- Player projectiles, enemy projectiles, hazards, explosions, and melee areas use separate visual channels.
- Dead enemies stop dealing contact damage immediately unless their death behavior explicitly creates a hazard or entity.
- A room clear waits for required enemies and waves, not harmless decorative entities or unreachable non-threats.

## 6.3 Projectile model

| Field | Definition |
| --- | --- |
| Owner | Player, enemy, neutral, or environment. |
| Damage | Base damage after weapon and item calculation. |
| Velocity | Direction and speed; may be updated by homing, orbit, gravity, or return behavior. |
| Lifetime | Maximum active time unless destroyed earlier. |
| Collision mask | Entities, obstacles, walls, doors, pickups, and special surfaces. |
| Pierce count | Number of valid impacts before destruction; -1 represents unlimited. |
| Bounce count | Remaining surface or enemy bounces. |
| Status payload | Zero or more tagged effects with chance, duration, and magnitude. |
| On-impact action | Destroy, stick, split, explode, return, spawn, or continue. |
| Visual priority | Used by readability and effect-budget systems, not damage calculation. |

## 6.4 Collision priorities

1. Resolve invulnerability and allegiance before calculating damage.
2. Resolve wall or obstacle interaction according to projectile tags.
3. Apply damage and status to the struck target.
4. Run on-hit and on-damage callbacks in deterministic priority order.
5. Update pierce, bounce, stick, return, split, and destruction state.
6. Spawn secondary effects using the projectile event RNG stream, never the global floor stream.

## 6.5 Active item recharge

Most active items recharge by clearing hostile rooms. A normal room grants one charge unit. A large room with a multi-wave or high-budget encounter may grant two. Empty rooms and rooms already cleared grant none. Direct battery pickups can add charge.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-CMB-001 | Combat door locks and unlocks are deterministic and tied to the encounter state machine. | No door remains locked after a valid clear, and no locked room can be bypassed without an explicit effect. |
| R-CMB-002 | Enemy attacks provide an authored telegraph before their first damaging frame. | Frame data and playtest capture show the warning interval. |
| R-CMB-003 | Large rooms may award two active-charge units only when tagged as high-effort. | Room size alone does not automatically create free charge. |
| R-CMB-004 | Projectile and entity counts are capped through pooling and effect aggregation, not silent mechanical deletion. | Stress builds retain expected damage while maintaining target frame time. |
| R-CMB-005 | All random combat procs use deterministic scoped RNG. | Replaying a seed with identical inputs reproduces proc outcomes in debug mode. |
| R-CMB-006 | The game prevents impossible clears caused by unreachable required enemies. | Watchdog and validation rules release or relocate invalid enemies. |

## 6.6 Difficulty budget

Each encounter has a cost. Each floor and room size supplies a budget. The generator selects a compatible authored encounter or composes from approved groups; it does not pour random enemies into a room until a number is full.

```text
base_budget = 3.5 + (floor_depth * 1.35)
room_multiplier = {tiny: 0.55, normal: 1.0, double: 1.55, large: 2.15}
difficulty_multiplier = {standard: 1.0, hard: 1.18}
encounter_budget = base_budget * room_multiplier * difficulty_multiplier

Constraints:
- use department-eligible enemy tags
- respect room navigation and firing lanes
- respect max simultaneous hostile count
- avoid prohibited support combinations
- preserve at least one safe response path at encounter start
```

# 7. Weapon System

## 7.1 Slot and replacement rules

The weapon defines the geometry and rhythm of the primary attack. The player normally owns one weapon at a time. Weapons are not passive items and do not accumulate in an inventory.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-WPN-001 | The player has exactly one primary weapon slot by default. | Run state contains one equipped weapon definition ID. |
| R-WPN-002 | Collecting a weapon pedestal replaces the equipped weapon and places the previous weapon on that pedestal. | The player can reverse the swap before leaving unless another effect consumes the pedestal. |
| R-WPN-003 | A weapon definition declares attack archetype, cadence model, compatible modifier tags, and explicit overrides. | Schema validation rejects a weapon missing required fields. |
| R-WPN-004 | Weapon behavior never changes between weapon and modifier roles. | The Big Laser Pointer is always WPN-003; the Pen Laser Pointer is always ITM-011. |
| R-WPN-005 | Unsupported passive modifiers may have no weapon interaction without prompting the player. | No mode dialog appears; the passive remains owned and may still affect future weapons. |
| R-WPN-006 | Weapon swaps recalculate the final attack graph from owned passives. | No stale effects remain from the previous weapon unless an item explicitly creates a persistent entity. |

## 7.2 Attack archetypes

| Archetype | Primary data | Typical modifiers |
| --- | --- | --- |
| Projectile | Spawn count, angle, speed, lifetime, size, damage, collision. | Homing, split, bounce, pierce, return, stick, duplicate. |
| Melee arc | Radius, angle, wind-up, active duration, recovery, hit memory. | Aim adapters, reach, repeat, mark, knockback. |
| Beam | Origin, direction, width, tick rate, duration, clipping. | Bend, fork, pulse, range, status. |
| Tether | Outbound entity, cable path, return behavior, wrap count. | Length, curve, shock, pull, return. |
| Cone stream | Angle, reach, tick rate, particle representation. | Widen, status, push, aggregate projectiles. |
| Area slam | Target shape, wind-up, active time, damage falloff. | Diagonal aim, repeat, size, mark. |
| Placed area | Placement rule, orientation, lifetime, one-instance policy. | Angle, duration, reveal, status. |
| Charge wave | Charge tiers, shape, speed, push, release lock. | Paired waves, bend, weight, size. |

## 7.3 Modifier adapter contract

A passive modifier does not rewrite a weapon by guesswork. It declares supported attack tags and references a weapon adapter. The adapter translates the mechanic into the weapon language while preserving the modifier fantasy.

```yaml
ModifierDefinition:
  id: ITM-011
  name: Pen Laser Pointer
  mechanic: HOMING
  supported_attack_tags: [PROJECTILE, MELEE_ARC, BEAM, TETHER, CHARGE_WAVE]
  default_adapter: HomingProjectileAdapter
  weapon_overrides:
    WPN-002: HomingArcAdapter
    WPN-003: TrackingBeamAdapter
    WPN-010: CurvingTetherAdapter
    WPN-012: SteeringWaveAdapter
  unsupported_behavior: NO_EFFECT
```

> **No-effect rule:** A passive doing nothing with the current weapon is allowed when the relationship is genuinely nonsensical. The game must never fake a meaningless stat change just to claim universal compatibility.

## 7.4 Starter weapon roster summary

| ID / weapon | Archetype | Core behavior | Notable adapters |
| --- | --- | --- | --- |
| WPN-001 Keyboard | Projectile / tap fire | Fires individual keycaps in the four cardinal directions. Baseline weapon and balance reference. | Homing keys; eight-direction keys; split, bounce, return, pierce, stick, and duplicate adapters. |
| WPN-002 Mouse | Melee arc / whip | Swings a wired mouse in a short arc. The cable traces the hit area and can strike multiple targets. | Homing rotates the arc toward a nearby target; Numeric Keypad adds diagonal arc centers; range extends cable; Sticky Keys adds a brief tether. |
| WPN-003 Big Laser Pointer | Continuous beam | Projects a sustained presentation beam while the attack input is held. Damage is applied in controlled ticks. | Pen Laser bends the endpoint toward targets; Numeric Keypad enables diagonal beams; USB Hub forks the beam after first contact. |
| WPN-004 Stapler | Heavy projectile / cadence | Fires slow metal staples with high impact and slight armor penetration. Uses a short rhythmic reload after a burst. | Rubber Bands ricochet staples; Binder Clip increases pierce; Heavy Keycaps become Heavy Staples through a weapon override. |
| WPN-005 Hole Punch | Twin short-range projectile | Fires two paper discs with a small gap, strong knockback, and short lifetime. | Split creates four smaller discs; Backspace returns discs; Highlighter marks both targets when either disc hits. |
| WPN-006 Marker | Ink projectile / trail | Fires wet marker strokes that leave a short damaging ink line behind their path. | Correction Fluid changes the trail to slowing whiteout; Pen Laser curves the stroke; Wireless Dongle lets the stroke pass through furniture. |
| WPN-007 Rubber Stamp | Melee slam / area | Slams a rectangular approval stamp in the chosen direction after a short wind-up. | Numeric Keypad supports diagonal stamps; Confidential Stamp increases full-health impact; Macro Pad repeats a weaker echo stamp. |
| WPN-008 Paper Shredder | Close cone / sustained | Sprays paper strips in a noisy short cone. Excellent coverage, weak range, many small hits. | Toner Dust adds a lingering cloud; USB Hub widens the cone; Binder Clip converts some strips into piercing metal clips. |
| WPN-009 Presentation Remote | Bouncing pulse | Fires a slow click pulse that bounces from room boundaries and obstacles before expiring. | Rubber Bands adds bounces; Pen Laser steers after each bounce; Ctrl+C creates occasional second pulses. |
| WPN-010 Desk Phone | Tether / thrown melee | Throws a receiver attached by a cord. It damages outbound and returning paths and can wrap around one target. | Extension Cord lengthens the throw; Pen Laser curves the outbound receiver; Ethernet Cable shocks tethered targets. |
| WPN-011 Label Maker | Charge projectile | Charges and fires a sticky label. The label attaches to an enemy, then pops after a delay. | Sticky Keys increases attachment time and burst; Caps Lock creates a large label; Autocorrect redirects an unclaimed label. |
| WPN-012 Copier | Charge wave | Charges, then launches a broad sheet-shaped wave. The wave is slow, wide, and can push light enemies. | Pen Laser gently rotates the wave toward a target; Dual Monitors launches paired narrow sheets; Paperweight increases force and damage. |
| WPN-013 Desk Fan | Directional stream | Creates a sustained airflow that pushes enemies and redirects light projectiles while dealing low repeated damage. | Highlighter marks enemies held in the stream; Extension Cord increases reach; Wireless Dongle lets airflow pass through furniture slots. |
| WPN-014 Projector | Placed area / cone | Places a projector at the player position that casts a damaging cone in the chosen direction for a limited duration. | Numeric Keypad adds diagonal placement angles; Rechargeable Battery increases uptime through active-like charge; Webcam makes the cone reveal cloaked threats. |

## 7.5 Performance and readability

- Final damage is calculated from the full interaction graph even when visual particles are merged.
- Repeated micro-projectiles may be represented by a stream or batched sprite after a threshold.
- Hostile projectile contrast takes priority over player attack decoration.
- Every weapon has a distinct silhouette, attack sound, and impact language before modifiers are applied.
- A weapon may become absurd. It may not become illegible enough to conceal damage sources.

# 8. Item, Build, and Synergy Systems

## 8.1 Collectible classes

| Class | Default slots | Persistence | Function |
| --- | --- | --- | --- |
| Weapon | 1 | Until replaced or run ends | Defines the primary attack archetype. |
| Passive item | Unlimited | For the run | Adds stats, modifiers, familiars, utility, tradeoffs, or transformations. |
| Active item | 1 | Until replaced or run ends | Player-triggered effect with room-charge, time, resource, or conditional recharge. |
| Action Card | Pocket slot | Until used or dropped | Known one-use tactical effect. |
| Supplement | Pocket slot | Until used or dropped | Identity is hidden by appearance until used during the current run. |
| Desk Charm | 1 | Until dropped or run ends | Small, narrow, or probabilistic passive effect. |
| Pickup resource | Counters or immediate use | For the run | Credits, Access Cards, Toner Charges, batteries, and health. |

## 8.2 Pickup presentation

1. The pedestal sprite and item silhouette are visible before pickup unless the room explicitly conceals them.
2. On pickup, the game briefly displays the item name and a short qualitative phrase.
3. The pickup animation never blocks player control long enough to cause combat damage; normal pedestal rooms are safe by design.
4. Exact values remain internal. The collection log may provide a longer qualitative explanation after discovery.
5. A liability item uses a consistent red frame or unsettling audio cue only after it has been identified at least once. First discovery retains uncertainty.

## 8.3 Item quality and pools

Quality is a hidden internal band from 0 to 4. It is used for generation, reroll rules, and content tuning. It is never displayed as stars or numbers in normal play.

| Quality | Design role | Examples of effect scale |
| --- | --- | --- |
| 0 | Liability, joke, narrow utility, or weak situational item. | Wet Keyboard, highly conditional charm-like effects. |
| 1 | Minor improvement or modest utility. | Small stat increase, simple familiar, map utility. |
| 2 | Reliable build contributor. | Strong stat item, useful modifier, sustain, access economy. |
| 3 | Major build shaper. | Multiplicity, strong defense, powerful active, broad synergy engine. |
| 4 | Run-defining jackpot. | Master Access Badge, exceptional weapon modifier, revival, game-breaking secret item. |

| Pool | Identity |
| --- | --- |
| Supply Closet | Guaranteed item room pool; broadest passive, active, and weapon selection. |
| Manager Reward | Guaranteed boss drop; mostly health, stats, resources, and reliable passives. |
| Office Supply Shop | Utility, economy, active items, health, resources, and selected passives. |
| Secret Maintenance | Strange utility, rule-breaking, reroll, access, and high-variance items. |
| Restricted Records | Risk-reward, liability, forbidden, and sacrifice-oriented items. |
| Innovation Lab | Rare technology, trajectory, multiplicity, and unusual weapon items. |
| Union Breakroom | Defense, sustain, familiars, recovery, and cooperative-themed effects. |
| Executive Deal | Very powerful items purchased with maximum health, future debt, or another explicit sacrifice. |
| Golden Cabinet | Curated premium rewards from locked containers and vaults. |
| Set Drop | Boss-, machine-, event-, or enemy-specific reward outside ordinary pool selection. |

## 8.4 Weighted generation algorithm

```text
roll_item(pool_id, floor_depth, run_state, source):
  1. load items assigned to pool_id
  2. remove locked items and non-repeatable items already collected this run
  3. apply source restrictions and required tags
  4. determine normal maximum quality for floor_depth
  5. on floors 1-2, roll EARLY_JACKPOT_CHANCE = 0.001
       if successful, allow quality 4 candidates from this pool
  6. otherwise remove candidates above the normal quality gate
  7. effective_weight = base_weight
       * floor_weight
       * source_weight
       * seen_decay
       * unlock_weight
  8. select with the source-specific deterministic RNG stream
  9. mark item as generated; mark as seen when its room is entered
 10. if collected, remove from non-repeatable pools for this run
```

| Depth | Normal quality gate | Quality 4 behavior |
| --- | --- | --- |
| Floors 1-2 | 0-3 | Only through 0.10 percent early jackpot or explicit set drop. |
| Floors 3-4 | 0-4 | Extremely low pool weight. |
| Floors 5-6 | 0-4 | Low pool weight; more eligible pools. |
| Floors 7-8 | 0-4 | Moderate relative weight, still rare. |
| Hidden extension | Pool-defined | High quality becomes more available, but danger and opportunity both rise. |

### Seen and duplicate handling

- A non-repeatable item that is collected is removed from all ordinary pools for the current run.
- An item that is seen but left behind remains eligible at 50 percent of its prior effective weight.
- Rerolls use the original room pool and cannot return the exact item currently displayed.
- Repeatable items must explicitly declare stacking behavior.
- The system does not dynamically suppress items because they synergize with the current build.

## 8.5 Synergy model

Synergies arise from three layers. Most depth comes from systemic modifiers. Selected pairs or sets receive handcrafted overrides. Transformations provide rare, readable milestones.

| Layer | Definition | Example |
| --- | --- | --- |
| Systemic | A modifier adapter affects any compatible weapon. | Pen Laser Pointer produces homing keys, a curving Mouse arc, or a tracking beam. |
| Handcrafted override | A specific item and weapon combination gets a deliberate behavior. | Rubber Bands make Stapler shots ricochet with a metal snap and stronger angle retention. |
| Transformation | A named set condition grants an additional effect and visible player change. | Espresso Shot plus Milk Carton activates Latte. |

### Required synergy examples

| Combination | Result |
| --- | --- |
| Keyboard + Pen Laser Pointer | Keys steer toward nearby enemies while preserving cardinal launch input. |
| Mouse + Pen Laser Pointer | The whip arc rotates modestly toward the nearest target inside an acquisition cone. |
| Big Laser Pointer + Pen Laser Pointer | The beam endpoint tracks a target with capped angular speed. |
| Keyboard + Numeric Keypad | Keyboard can launch keys in eight directions. |
| Mouse + Numeric Keypad | Whip centers snap to eight directions, including diagonals. |
| Stapler + Rubber Bands | Staples ricochet from furniture and walls. |
| Sticky Keys + Backspace | Stuck projectiles detach and return, damaging again at reduced strength. |
| Ctrl+C + USB Hub | The whole split pattern may duplicate; duplicates cannot recursively duplicate. |
| Espresso Shot + Milk Carton | Latte transformation: both benefits plus steadier coffee behavior and a small speed bonus. |
| Reply All + any projectile weapon | Player output rises, but hostile projectile patterns also duplicate. The room becomes a regrettable email thread. |

## 8.6 Liability items

Liability items exist to create recognition, stories, and adaptation. They are not mandatory curses disguised as rewards. Standard pedestals remain optional. A liability must be mechanically legible after use and must not create an unavoidable soft lock.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ITM-001 | Passive items stack without a normal inventory cap. | Owned passive IDs persist until run end and all applicable effects recalculate. |
| R-ITM-002 | Every collectible has a unique sprite and fixed class. | Content validation rejects duplicate sprite IDs and class ambiguity. |
| R-ITM-003 | Item odds are data-driven and not player configurable. | Settings contain no rarity or loot sliders. |
| R-ITM-004 | Floor 1 can produce a quality-4 jackpot at a 0.10 percent pedestal roll before other modifiers. | Seeded probability test confirms configured frequency within tolerance. |
| R-ITM-005 | Pickup text hides raw stat deltas. | Automated string scan flags percent signs and numeric deltas in normal pickup phrases. |
| R-ITM-006 | Unsupported weapon interactions are allowed and deterministic. | Adapter resolution returns NO_EFFECT without an error or prompt. |
| R-ITM-007 | Liability items can be declined and cannot create an unwinnable normal run by themselves. | Playtests and rule validation confirm a viable combat action remains. |
| R-ITM-008 | Strong builds are not secretly balanced downward by item selection. | Loot selection has no current-power penalty multiplier. |

## 8.7 Starter passive catalog overview

Appendix C contains the complete starter database. The initial catalog below establishes the breadth expected from the system.

| Primary category | Starter entries |
| --- | --- |
| Access utility | 2 |
| Active support | 1 |
| Aim modifier | 1 |
| Armor modifier | 1 |
| Bounce modifier | 1 |
| Buffer health | 1 |
| Cadence modifier | 1 |
| Collision modifier | 1 |
| Contact offense | 1 |
| Control | 1 |
| Critical | 2 |
| Damage buffer | 1 |
| Defense | 2 |
| Economy | 1 |
| Extra life | 1 |
| Familiar | 3 |
| Floor reward | 1 |
| Force modifier | 1 |
| Hazard modifier | 1 |
| Health | 1 |
| Information | 1 |
| Liability | 4 |
| Map utility | 1 |
| Multiplicity | 1 |
| Multiplicity modifier | 2 |
| Payload | 1 |
| Payload modifier | 1 |
| Pickup modifier | 1 |
| Pierce modifier | 1 |
| Proc | 1 |
| Projectile size | 1 |
| Range | 1 |
| Range modifier | 1 |
| Reroll support | 1 |
| Rhythm modifier | 2 |
| Stat | 7 |
| Status modifier | 2 |
| Sustain | 1 |
| Tradeoff | 2 |
| Trajectory modifier | 3 |

# 9. Consumables, Pickups, and Economy

## 9.1 Pocket slot

The pocket slot holds one Action Card or one Supplement by default. The two classes share the slot but remain mechanically distinct: Action Cards are known one-use tactics; Supplement identities are randomized by appearance for each run until consumed.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-CON-001 | The player carries one pocket item by default. | Picking up another presents a physical swap on the floor, not an inventory menu. |
| R-CON-002 | Action Card identity and effect are visible when discovered. | Pickup name and collection entry identify the card. |
| R-CON-003 | Supplement appearance-to-effect mapping is randomized per run. | The same wrapper can produce different effects across seeds but remains consistent within a run. |
| R-CON-004 | After a Supplement effect is identified, all matching wrappers in that run display the known effect name. | Ground labels and pocket HUD update after first use. |
| R-CON-005 | An item may grant additional pocket capacity, but capacity is not a baseline menu system. | Extra slots are created only by explicit item effects. |

## 9.2 Pickups and counters

| Pickup | Office expression | Use |
| --- | --- | --- |
| Credits | Company credit coins or expense tokens | Purchase shop stock, pay machines, and fund selected active effects. Numeric count is visible. |
| Access Card | Colored security badge | Open standard locked doors and containers. Numeric count is visible. |
| Toner Charge | Pressurized toner cartridge with warning tape | Thrown explosive used to break furniture, damage enemies, and open blast-access secret walls. Numeric count is visible. |
| Battery | AA pack, power brick, or charging cable | Restores active-item charge. |
| Composure pickup | Red stress-ball heart | Refills core health up to current capacity. |
| Caffeine pickup | Blue takeaway coffee | Adds temporary buffer health. |
| Spite pickup | Cracked dark mug | Adds retaliatory buffer health. |
| Golden Cushion | Gold company wellness token | Adds a reward-triggering overlay to one health icon. |
| Chest equivalent | Locked cabinet, courier box, laptop case, or executive safe | Contains weighted pickups or items based on container class. |

## 9.3 Credit economy

Credits are common enough to support shop decisions but scarce enough that a player rarely buys everything. The game shows prices because a purchase without a number is not mysterious; it is merely accounting malpractice.

| Shop offering | Default price band | Notes |
| --- | --- | --- |
| Basic pickup | 3-7 credits | Health, Access Card, Toner Charge, or battery. |
| Desk Charm | 7-12 credits | Narrow passive in the dedicated charm slot. |
| Standard item pedestal | 12-18 credits | Passive, active, or occasional weapon from shop pool. |
| Premium item | 20-30 credits | High-quality or rare stock; not guaranteed. |
| Discount stock | 50-70 percent of normal | Clearly marked by sticker or damaged packaging. |
| Machine use | 1-5 credits per use | Vending, copier, claw, donation, or reroll machine behavior. |

## 9.4 Office Supply Shop

- Exactly one shop is generated on each normal floor unless the floor is an explicit special sequence.
- The shop is a non-hostile room. Its door may require one Access Card after Open Office I.
- Base inventory is three sale slots plus one pickup slot. Persistent shop upgrades may increase stock, but never through paid real-money progression.
- Purchases are immediate and use visible prices. The player can walk away without confirmation dialogs.
- A shop may contain a clerk NPC, automated kiosk, or abandoned self-checkout variant without changing the economy contract.
- Stealing or violence may exist as explicit rare item or event mechanics, not as a universal hidden interaction.

## 9.5 Toner Charges and environmental blasts

Toner Charges fulfill the tactical and exploration role of a limited explosive. They damage entities, destroy eligible office objects, reveal blast-access walls, and interact with special room content. The player places or throws a charge with a short fuse and unmistakable warning radius.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ECO-001 | Credit, Access Card, and Toner Charge counts are visible integers. | HUD and save state agree after every pickup and spend. |
| R-ECO-002 | A standard shop purchase never requires a second confirmation. | Entering the purchase zone with enough credits completes the transaction once. |
| R-ECO-003 | Toner Charges open eligible hidden walls only when placed within the authored tolerance zone. | Blast tests confirm valid and invalid placements. |
| R-ECO-004 | Destroyed environmental objects roll contents from their own scoped loot table. | Object destruction cannot accidentally use the room-clear or item-pedestal pool. |
| R-ECO-005 | Resource starvation protection may guarantee a needed Access Card after enough eligible clears, but must be subtle and data-defined. | The protection does not alter item quality or create menu messages. |

## 9.6 Action Card starter set

| ID / card | One-use effect |
| --- | --- |
| CARD-001 Meeting Canceled | Return to the floor start room immediately. |
| CARD-002 Company-Wide Email | Deal heavy damage to all hostile enemies in the current room. |
| CARD-003 Sick Day | Restore all empty Composure in existing containers and grant brief invulnerability. |
| CARD-004 Approved Overtime | Increase damage and cadence for the current room. |
| CARD-005 Expense Approved | Spawn a weighted burst of credits. |
| CARD-006 Budget Freeze | Slow enemies and hostile projectiles for the current room. |
| CARD-007 Reorganization | Reroll uncollected pickups, shop stock, and pedestal items in the current room from their original pools. |
| CARD-008 Calendar Block | Grant eight seconds of invulnerability without allowing door bypass. |
| CARD-009 Access Granted | Open all standard locked doors connected to the current room. |
| CARD-010 All Hands | Charm normal enemies briefly. Bosses are slowed instead. |
| CARD-011 Performance Review | Reveal the boss room and all mini-boss rooms on the current floor. |
| CARD-012 Remote Day | Grant flight over floor hazards and furniture for the current room. |
| CARD-013 Hard Deadline | Reveal the shortest known route to the boss and increase speed until the player enters it. |
| CARD-014 Return to Sender | Reflect hostile projectiles for three seconds. |
| CARD-015 Escalation | Spawn an optional mini-boss. Victory grants an item or premium pickup; the card cannot be used in boss rooms. |
| CARD-016 Meeting Minutes | Repeat the last Action Card effect used in the current run, excluding Meeting Minutes. |
| CARD-017 Desk Move | Teleport to a random previously cleared normal room on the current floor. |
| CARD-018 Quarter-End | Convert the current normal room into a timed wave challenge with a premium reward. |

## 9.7 Supplement system

Supplements use a set of wrapper or blister-pack appearances. At run start, effects are shuffled onto appearances. The player learns an identity only by consuming it or using a specific identification effect. Positive and negative results share the same presentation rules.

| ID / internal effect | Mechanical result | Pickup message after identification |
| --- | --- | --- |
| SUP-001 Focus Up | Permanently improve attack cadence slightly. | Typing faster |
| SUP-002 Focus Down | Permanently worsen attack cadence slightly. | Slower hands |
| SUP-003 Energy Up | Permanently improve move speed slightly. | More energy |
| SUP-004 Energy Crash | Permanently reduce move speed slightly. | Sudden crash |
| SUP-005 Heavy Dose | Permanently improve damage slightly. | Hits harder |
| SUP-006 Numb Hands | Permanently reduce damage slightly. | Weak grip |
| SUP-007 Clear Eyes | Permanently improve range or reach. | Can see farther |
| SUP-008 Dry Eyes | Permanently reduce range or reach. | Everything feels closer |
| SUP-009 Full Recovery | Restore all Composure in existing containers. | Feeling normal |
| SUP-010 Bad Reaction | Deal one full icon of damage; if this would kill the player, reduce health to one half-unit instead. | Bad reaction |
| SUP-011 Telework | Teleport to a random room, with a tiny chance to enter the 13th Floor error room. | Working elsewhere |
| SUP-012 Adrenaline | Grant strong room-long damage and speed, then brief Slow when it ends. | Too much energy |
| SUP-013 Placebo | Repeat the last identified positive Supplement effect. If none exists, do nothing. | Seems familiar |
| SUP-014 Mystery Snack | Spawn a random pickup and apply one short random status, positive or negative. | Questionable choice |

## 9.8 Desk Charms

Desk Charms are small passive objects with a dedicated single slot. They are usually weaker, narrower, or less reliable than full passive items. A new charm can be swapped with the held charm directly on the floor.

| ID / charm | Effect |
| --- | --- |
| CHR-001 Coffee Sleeve | Caffeine pickups have a small chance to grant one extra half-unit. |
| CHR-002 Bent Keycard | A spent Access Card has a 12 percent chance to be retained. |
| CHR-003 USB Cap | Battery pickups add a small overflow charge that persists until used. |
| CHR-004 Red Pushpin | Player attacks deal slightly more damage to Marked enemies. |
| CHR-005 Tiny Plant | The first health pickup on each floor heals one extra half-unit if possible. |
| CHR-006 Meeting Token | Mini-boss rooms are slightly more likely and give improved pickup rewards. |
| CHR-007 Rubber Foot | Reduce sliding from spills and conveyor hazards. |
| CHR-008 Cracked Screen Protector | The first projectile hit in a boss room deals one half-unit less damage, then the charm goes dormant until next floor. |
| CHR-009 Frayed Cable | Shock chains travel farther but deal slightly less damage. |
| CHR-010 Spare Button | Every 20th attack event produces a small extra shot. |
| CHR-011 Mini Calendar | Challenge-room doors appear on the map after the supply closet is found. |
| CHR-012 Nameplate | Shop prices have a small chance to be discounted when first seen. |
| CHR-013 Transit Pass | Elevator transitions grant a short speed boost in the next floor start room. |
| CHR-014 Employee of the Month Pin | Bosses drop a few extra credits if defeated without player damage. |
| CHR-015 Paper Star | Rare room-clear rewards are slightly more likely. |
| CHR-016 Old Password | Secret Maintenance doors require slightly less precise blast placement to open. |
| CHR-017 Snack Wrapper | Vending machines are more likely to pay out before breaking. |
| CHR-018 Lucky Lanyard | A floor with no Access Card drop guarantees one after enough hostile clears. |

# 10. World and Department Structure

## 10.1 The tower

The game appears to take place inside one enormous corporate skyscraper. Early floors obey recognizable office logic. Later and hidden floors reveal impossible scale, conflicting ownership, service spaces that do not fit inside the building, and corporate structures that are architectural as well as organizational.

The world does not need lengthy exposition. The player learns by seeing departments, bosses, item language, environmental stories, elevator behavior, and the consequences of repeated victories.

## 10.2 Two-floor chapter rule

- Each normal department contains Floor I and Floor II.
- Floor I introduces the department visual grammar, core enemies, and primary hazard.
- Floor II escalates density, variants, support combinations, environmental states, and boss complexity.
- Both floors have their own generated maps, supply closet, shop, boss room, secrets, and manager reward.
- The two floors share an item and enemy identity but use different weight tables.
- The elevator transition between departments is stronger and longer than the transition between Floor I and Floor II.

## 10.3 Base visible route

```text
Open Office I
  -> Open Office II
  -> IT I
  -> IT II
  -> Operations I
  -> Operations II
  -> Executive I
  -> Executive II
  -> CEO
  -> apparent ending
```

Alternate departments and hidden routes expand this structure after unlocks. The first successful run should present a coherent eight-floor arc before the CEO. Post-CEO extensions deliberately break the player expectation that the run is over.

## 10.4 Department design contract

| Field | Mandatory content |
| --- | --- |
| Visual identity | Palette, materials, lighting, floor treatment, wall treatment, furniture language, decorative stories. |
| Gameplay identity | One primary mechanic and up to two secondary mechanics introduced through rooms and enemies. |
| Enemy pool | At least eight department-native enemies at full release, plus limited continuity variants. |
| Boss pool | At least three bosses across the pair, with one or more restricted to Floor II. |
| Hazards | At least three authored environmental hazard families. |
| Room library | Normal, large, hallway, special, shop, supply, boss, secret, and event templates. |
| Item affinity | Department tags that adjust selected item, pickup, machine, and weapon weights. |
| Audio identity | Music family, ambience, machinery, announcements, boss layer, and transition sting. |
| Narrative implication | What this department reveals about the corporation without requiring dialogue. |

## 10.5 Department roadmap

| ID / department | Route role | Identity and mechanics | Bosses / escalation |
| --- | --- | --- | --- |
| DPT-001 Open Office I-II | Core chapter 1 | Cubicles, carpet grids, fluorescent light, meeting rooms, printers, coffee stains. Introduces cardinal shooters, chasers, burst movement, cover objects, basic HR debuffs. | Team Lead, Copy Chief, Scrum Master, The Open Plan. Open Office II increases density, uses more support enemies, and introduces moving cubicle dividers. |
| DPT-002 IT I-II | Core chapter 2 | Server racks, cable trays, helpdesk bays, dark cooling aisles, blinking status lights. Electric hazards, turrets, shields, teleporting malware, wall-following enemies. | Sysadmin, Helpdesk Hydra, Legacy System, Firewall. IT II adds power-state changes, chained shock threats, and corrupted room variants. |
| DPT-003 Operations I-II | Core chapter 3 | Loading bays, mail rooms, inventory cages, carts, conveyor lanes, shift boards. Movement lanes, pushes, charges, object transport, split enemies, time-pressure support units. | The Bottleneck, Shift Manager, Supply Chain, Quarter End. Operations II uses denser lanes, active machinery, and mixed mobile formations. |
| DPT-004 Executive I-II | Core chapter 4 | Thick carpet, glass offices, art, boardrooms, private kitchens, security gates. Elite support networks, shields, cloned assistants, expensive hazards, restrictive zones. | VP of Everything, Chief Operating Officer, The Boardroom, CEO. Executive II is the apparent final floor and culminates in the CEO. |
| DPT-005 Finance I-II | Unlockable alternate chapter 3 | Ledger walls, trading screens, vault cages, receipts, coin counters. Credit theft, interest timers, armor purchased by enemies, greed-risk rooms. | The Auditor, Cash Flow, Budget Committee. May replace Operations after unlock; not required for the first completion path. |
| DPT-006 Marketing I-II | Unlockable alternate chapter 3 | Studio lights, mood boards, campaign walls, brand colors, fake product sets. Decoys, false pickups, mirrored enemies, attention manipulation, temporary clones. | Brand Manager, Focus Group, Viral Campaign. May replace Operations after unlock; visual trickery must remain fair and telegraphed. |
| DPT-007 Legal and Compliance I-II | Unlockable alternate chapter 4 | Document stacks, seal doors, hearing rooms, red tape, archive cages. Binding zones, delayed penalties, contract projectiles, shield phases. | General Counsel, Red Tape, The Clause. May replace Executive I while still leading to Executive II and the CEO. |
| DPT-008 Facilities | Secret branch | Maintenance corridors, boiler rooms, janitorial storage, service elevators. Environmental hazards, object manipulation, darkness, destructible infrastructure. | Head of Facilities, The Leak, Service Elevator. Accessed through hidden maintenance routes and used to bypass or alter normal floors. |
| DPT-009 Research and Development | Secret branch | Prototype labs, impossible office devices, test chambers, whiteboards full of nonsense. Experimental weapons, unstable modifiers, room-rule mutations, high-variance rewards. | Prototype Zero, The Patent, Innovation Theater. Primary home of the Innovation Lab item pool. |
| DPT-010 The Board I-II | Hidden post-CEO chapter | A vast dark boardroom system extending beyond the building footprint. Multi-elite encounters, vote mechanics, synchronized patterns, severe resource pressure. | The Board, Hostile Takeover. The elevator reaches this chapter only after concealed victory conditions are met. |
| DPT-011 Parent Company | Deep hidden chapter | A clean, anonymous complex whose branding contradicts the known company. Recombinations of earlier department rules with stronger variant enemies and false endings. | Parent Company. Reveals that the corporation is one subsidiary among many. |
| DPT-012 The Conglomerate | Ultra hidden chapter | Impossible stacked offices, merged logos, architecture from multiple companies at once. Cross-department hazard combinations, elite bosses as enemies, unstable room topology. | The Conglomerate. A late mastery route, not advertised in completion UI. |
| DPT-013 Ownership | Terminal hidden arena | Minimal, luxurious, almost empty space above every known hierarchy. Pure pattern mastery with selective echoes of the entire run. | The Beneficial Owner. Ultimate secret boss and final concealed ending target. |

## 10.6 World requirements

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-DPT-001 | Normal departments are implemented as two-floor chapter pairs. | Department definitions reference two floor definitions with escalating weight sets. |
| R-DPT-002 | The first visible route contains four departments and eight generated floors before the CEO. | A fresh save reaches the CEO only after completing the defined sequence. |
| R-DPT-003 | HR is not a mandatory base department. | Base route data contains HR enemies and events but no required HR chapter. |
| R-DPT-004 | Hidden departments remain absent from undiscovered maps and completion summaries. | Fresh-save UI contains no labels, blank slots, or counters implying their number. |
| R-DPT-005 | Each department remains visually readable in grayscale through silhouette and material, not color alone. | Art review passes grayscale captures. |
| R-DPT-006 | A new department can be inserted or used as an alternate without modifying the floor generator core. | Route data and department definitions control insertion. |

# 11. Procedural Floor Generation

## 11.1 Generation model

A floor is a connected graph embedded on a logical two-dimensional grid. Each graph node is one room instance. A room instance may occupy one cell, several adjacent cells, an L-shaped footprint, a narrow footprint, or another authored footprint. The room perimeter exposes discrete door sockets. A multi-cell room may therefore have more than four doors and more than one door on the same side.

> **Critical separation:** The generator first creates topology and assigns room architecture. Encounter selection is a later layer. A room is a place, not an enemy list.

## 11.2 Logical entities

| Entity | Definition |
| --- | --- |
| Floor graph | Connected set of room nodes and traversable door edges. |
| Grid cell | Logical occupancy unit used to prevent room overlap and support adjacency. |
| Room footprint | One or more occupied cells plus shape metadata. |
| Door socket | Authored position on a room perimeter with orientation, socket index, door class, and compatibility tags. |
| Door edge | Bidirectional connection between compatible sockets on adjacent room instances. |
| Room role | Start, normal, supply, shop, boss, secret, challenge, route, and other special category. |
| Room template | Handcrafted architecture containing walls, collision, sockets, obstacles, decoration anchors, and spawn zones. |
| Encounter | Independent enemy or wave definition compatible with room tags and budget. |

## 11.3 Target room count

```text
target_normal_nodes = clamp(
    round(6.5 + floor_depth * 1.35 + rng_int(-1, 2)),
    minimum_for_depth,
    maximum_for_depth
)

Special rooms are added after the normal graph and do not all count toward target_normal_nodes.
Initial tuning target including specials:
- Floor 1: 10-13 room nodes
- Floor 2: 11-15 room nodes
- Floors 3-4: 13-17 room nodes
- Floors 5-6: 15-20 room nodes
- Floors 7-8: 17-23 room nodes
- Hidden floors: definition-specific
```

## 11.4 Generation sequence

1. Create deterministic RNG streams from the run seed, route ID, and floor index.
2. Select floor definition, department variant, target node count, required room roles, and room-size distribution.
3. Place the Start Room footprint at grid origin.
4. Grow a connected normal-room graph by attaching compatible footprints and door sockets. Prefer branching while preserving space for large rooms.
5. Ensure the graph contains the minimum required number of dead ends and at least one branch that does not lead directly to the boss.
6. Select the farthest eligible dead end as the Manager Office anchor. Reserve a valid boss template footprint.
7. Place the Forgotten Cubicle candidate near a far dead end, then the Shop and Supply Closet on remaining eligible dead ends or near-dead ends.
8. Place optional special rooms according to probability, access requirements, dead-end rules, and mutual exclusions.
9. Place Maintenance Access by evaluating hidden adjacency positions that border multiple ordinary rooms and have valid blast walls.
10. Select an authored room template for each node matching footprint, socket mask, department, role, and tags.
11. Select encounter definitions independently for hostile-capable rooms using budget and compatibility tags.
12. Populate environmental objects, hazards, decorations, rewards, and machines from separate layers.
13. Run graph, collision, navigation, door, reward, and soft-lock validation. Regenerate from the floor stream if validation fails.
14. Persist the complete generated floor state before the player gains control.

## 11.5 Graph constraints

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-FLR-001 | Every floor graph is connected from Start Room to all non-hidden ordinary rooms. | Breadth-first validation reaches every required node. |
| R-FLR-002 | The Manager Office is placed at or near the greatest traversable graph distance from Start among eligible dead ends. | Distance report meets floor-definition tolerance. |
| R-FLR-003 | Each normal floor has at least five usable dead ends before optional special-room assignment, unless a bespoke floor definition overrides it. | Generation metrics record the required dead-end count. |
| R-FLR-004 | A room footprint may occupy multiple grid cells and expose multiple door sockets on any perimeter side. | Template schema and placement test accept two doors on one side of a large room. |
| R-FLR-005 | Door edges connect compatible sockets with matching world positions and opposite orientations. | Validation rejects misaligned, one-way, or orphaned ordinary doors. |
| R-FLR-006 | Supply Closet, Shop, and Manager Office are generated exactly once on each normal floor. | Role-count validation passes before save. |
| R-FLR-007 | Room architecture does not encode a mandatory enemy encounter ID. | Templates contain tags and spawn zones, not a hard-linked encounter. |
| R-FLR-008 | Generation failure is recoverable and deterministic. | A failed attempt increments an attempt salt and reproduces from the same seed. |
| R-FLR-009 | No generated floor requires an unavailable resource to reach its boss. | Critical path access validation ignores optional locked rooms. |
| R-FLR-010 | Hidden rooms are omitted from the map until discovered by an effect or entered. | Map state contains no undiscovered hidden nodes. |

## 11.6 Door patterns and room examples

| Pattern | Example | Interpretation |
| --- | --- | --- |
| One socket | West only | Dead end. Player enters and normally returns through the same door. |
| Two opposite sockets | West + east | Straight corridor or ordinary through-room. |
| Two adjacent sockets | South + east | Corner branch. |
| Three sockets | North + west + east | Junction. |
| Four sockets | North + south + west + east | Crossroads normal room. |
| Multi-socket side | Two north + one west + one east | Large room occupying several cells with multiple adjacent room connections. |
| Asymmetric large room | L-shaped footprint with five sockets | One combat room whose physical perimeter creates several entrances and exits. |

## 11.7 Secret placement

- Maintenance Access is normally generated once per floor. It prefers empty grid positions adjacent to two to four ordinary rooms whose shared walls contain valid blast locations.
- Forgotten Cubicle is generated with one connection to a non-special room near a distant dead end. Its probability begins below 100 percent and rises with selected items or floor rules.
- Hidden entrances cannot be blocked by indestructible scenery or pits at the blast point.
- Hidden rooms use their own item and pickup pools.
- A discovered hidden room becomes a normal traversable node for the remainder of the floor.
- The game may include ultra-hidden red-route or error-room systems later, but they must use separate placement rules and explicit content tags.

## 11.8 Room-size distribution

| Floor band | Single-cell | Double / hallway | Large / L-shaped | Tiny / closet |
| --- | --- | --- | --- | --- |
| 1-2 | 76% | 17% | 4% | 3% |
| 3-4 | 68% | 21% | 7% | 4% |
| 5-6 | 61% | 24% | 10% | 5% |
| 7-8 | 55% | 25% | 14% | 6% |
| Hidden | Definition-specific | Definition-specific | Definition-specific | Definition-specific |

# 12. Room Architecture, Encounters, and Special Rooms

## 12.1 Layered room instance

```yaml
RoomInstance
  geometry_layer        walls, floor, pits, collision, door sockets
  object_layer          cabinets, printers, coolers, desks, machines
  hazard_layer          spills, electricity, conveyors, scanners
  decoration_layer      story props, stains, papers, signs, screens
  spawn_zone_layer      player entry, enemy groups, pickups, rewards
  encounter_layer       selected independently from compatible encounters
  reward_layer          clear reward, pedestal, shop stock, containers
  state_layer           visited, cleared, doors, destroyed objects, waves
  metadata              department, role, size, tags, weight, rarity
```

## 12.2 Room template rules

- Templates are handcrafted and may be reused with different encounters, object states, hazards, and decoration variants.
- A template declares allowed encounter tags and prohibited enemy behaviors based on available navigation and firing lanes.
- An empty version of a combat-capable room is valid when selected by the encounter layer.
- A room may tell a small environmental story, but decorative props may not obscure collision or enemy telegraphs.
- Cover and hiding spaces are mechanical objects with consistent collision and destruction rules, not merely art.
- The same template can appear in different departments only through an explicit reskin or shared-space tag such as service corridor.

## 12.3 Combat entry and doors

| Room state | Door behavior |
| --- | --- |
| Unvisited non-hostile | Doors remain open unless locked by access cost. |
| Unvisited hostile | Doors close after the player crosses the entry threshold and the grace window begins. |
| Active combat | Normal doors are sealed. Exceptional escape effects use explicit override hooks. |
| Cleared | All ordinary doors open and remain open on revisit. |
| Wave transition | Doors remain sealed until the final required wave is cleared. |
| Boss active | Boss seals remain until victory or an explicit boss-escape effect. |
| Secret undiscovered | No visible door; valid wall reacts only to reveal or Toner Charge blast. |

## 12.4 Room role catalog

| ID / room | Frequency | Purpose |
| --- | --- | --- |
| ROOM-001 Start Room | Guaranteed | Safe arrival room with elevator door, no combat, and room-map origin. |
| ROOM-002 Standard Workroom | Common | Primary combat room; architecture and encounter are selected independently. |
| ROOM-003 Hallway | Common | Narrow connector or bent corridor; may be empty, trapped, decorated, or lightly hostile. |
| ROOM-004 Large Workroom | Uncommon | Double, L-shaped, or multi-cell room with several door sockets and larger encounter budget. |
| ROOM-005 Supply Closet | Guaranteed | Item pedestal from Supply Closet pool. Open Office I version is unlocked; later normal versions cost one Access Card. |
| ROOM-006 Office Supply Shop | Guaranteed | Purchasable stock, pickups, possible shopkeeper or kiosk. |
| ROOM-007 Manager Office | Guaranteed | Floor boss arena and guaranteed Manager Reward pedestal. |
| ROOM-008 Break Room | Optional | Recovery, vending machines, low-risk events, or a quiet environmental story. |
| ROOM-009 Deadline Room | Optional | Locked challenge that begins when a reward is accepted; waves or timer produce premium loot. |
| ROOM-010 Crisis Room | Optional late | Boss challenge or elite wave room with restricted entry requirements. |
| ROOM-011 Unscheduled Review | Optional | Mini-boss room hidden behind an ordinary-looking door until entered. |
| ROOM-012 Maintenance Access | Hidden | Primary secret room, blast-opened, commonly adjacent to multiple normal rooms. |
| ROOM-013 Forgotten Cubicle | Hidden | Secondary secret room, attached to one non-special room near a far dead end. |
| ROOM-014 Restricted Records | Optional risk | Entry costs health, resources, or a harmful room condition; contains risky or forbidden rewards. |
| ROOM-015 Overtime Room | Optional sacrifice | Allows deliberate health or resource sacrifice for escalating rewards. |
| ROOM-016 Archive | Optional locked | Curated text, map, active, and knowledge-themed item pool. |
| ROOM-017 Innovation Lab | Rare locked | Rare technology item room with unusual weapons and modifiers. |
| ROOM-018 Rec Room | Optional | Arcade-like machines, gambling, skill games, and pickup conversion. |
| ROOM-019 Strategy Room | Rare double-lock | Floor-wide reroll, duplication, or rule-changing floor mechanism chosen by room variant. |
| ROOM-020 Wellness Room | Rare | Clean or ruined recovery room; may heal, contain an item, or hide a negative event. |
| ROOM-021 Executive Storage | Rare double-lock | Premium containers and Golden Cabinet pool items. |
| ROOM-022 Shadow Procurement | Hidden sub-room | Expensive black-market shop reached through secret infrastructure. |
| ROOM-023 Executive Deal | Post-boss conditional | Powerful rewards purchased through health, debt, or sacrifice. |
| ROOM-024 Union Breakroom | Post-boss conditional | Defensive and sustain rewards earned through behavior conditions rather than purchase. |
| ROOM-025 Quarter-End Crunch | Timed secret | Boss-rush-style large arena unlocked by reaching a milestone quickly; item choice starts the event. |
| ROOM-026 Service Elevator | Route room | Alternate or secret floor transition with explicit access conditions. |
| ROOM-027 13th Floor | Error room | Rare teleport-only anomaly with unusual rewards and a forced exit route. |
| ROOM-028 NPC Office | Optional | Contains a non-hostile character, trade, quest-like interaction, beggar, or machine. |

## 12.5 Required room rewards

| Room | Default reward rule |
| --- | --- |
| Supply Closet | One pedestal from Supply Closet pool. A weapon pedestal uses the same room and fixed item class. |
| Shop | Data-defined inventory with visible prices. |
| Manager Office | One Manager Reward pedestal plus floor exit. |
| Deadline Room | Premium pickup, chest, charm, or item after challenge completion. |
| Crisis Room | One high-quality pedestal or curated set reward after elite challenge. |
| Maintenance Access | Secret pickup arrangement, machine, credits, or Secret Maintenance pedestal chance. |
| Forgotten Cubicle | One authored surprise layout from its room library. |
| Innovation Lab | One item from Innovation Lab pool, normally behind a rare access condition. |
| Quarter-End Crunch | Initial item choice starts event; completion grants another premium reward. |

## 12.6 Environmental storytelling examples

| Room vignette | Mechanical layer | Non-disruption rule |
| --- | --- | --- |
| Conference room after an endless meeting: cold coffee, notes, one chair overturned. | Tables create cover; coffee stains may be slippery hazard decals in designated variants. | Critical projectile lanes remain open and stains use clear edges. |
| Copier room buried in paper. | Paper piles slow movement or conceal destructible containers in tagged templates. | No enemy or pickup is hidden completely behind decorative paper. |
| Cubicle celebration abandoned mid-party. | Balloons are destructible and may release tiny pickups or noise. | Balloons never resemble hostile projectiles. |
| Server aisle with improvised desk-bed. | Bedroll is decoration or a Wellness interaction anchor. | Collision matches visible footprint. |
| Executive office containing awards with every employee name scratched out. | Awards are destructible premium object variants. | Story remains optional; interaction never blocks the boss route. |

## 12.7 Room requirements

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ROM-001 | Room templates and encounters are separate data assets. | The same template can instantiate with at least three different encounter IDs and an empty state. |
| R-ROM-002 | A room may contain zero enemies, one encounter, or a defined wave sequence. | Room state machine supports all three without special-case bugs. |
| R-ROM-003 | A large room remains one room for clear state, map display, and active charge. | Crossing internal grid-cell boundaries does not trigger room transitions. |
| R-ROM-004 | Environmental stories never conceal mandatory information. | Readability review verifies doors, enemies, projectiles, hazards, and pickups. |
| R-ROM-005 | Revisiting a cleared room restores its persistent destroyed-object and pickup state. | Save/continue and room re-entry produce identical state. |
| R-ROM-006 | Every room template declares valid navigation regions for player and relevant enemy movement classes. | Automated nav validation rejects isolated spawn zones. |

# 13. Environmental Objects and Hazards

## 13.1 The office-rock principle

Filing cabinets, printers, water coolers, desks, bins, shelves, plants, and other office fixtures fill the mechanical role of reusable room obstacles. They create cover, movement constraints, destruction choices, and the possibility of hidden contents. The player should never be completely certain whether blowing one up produces nothing, a resource, a hazard, or a hostile surprise.

> **Exploration rule:** Environmental rewards are interesting enough to tempt experimentation, but not generous enough that optimal play requires destroying every object in every room.

## 13.2 Object classes

| Class | Collision | Damage response | Typical purpose |
| --- | --- | --- | --- |
| Indestructible | Blocks defined entities | No damage or explicit immunity feedback | Permanent navigation and firing geometry. |
| Destructible light | Blocks or slows | Breaks from attacks or blast | Debris, low-value loot, small hazards. |
| Destructible heavy | Blocks movement and attacks | Requires repeated damage or Toner Charge | Rock-equivalent cover and secret speculation. |
| Movable | Dynamic collision | Push, impact, blast, or scripted movement | Improvised cover, crushing, lane changes. |
| Reactive | Varies | Triggers a state or linked device | Electricity, foam, alarms, machine chains. |
| Interactive | Usually blocks | Uses credits, Access Card, active item, or explicit interaction | Vending, rerolling, trading, recovery. |
| Hazard | May not block | Timed, disabled, redirected, or immune | Spills, conveyors, shock, scans, fire, broken glass. |
| Decoration | None or exact visible footprint | No gameplay unless variant is clearly marked | Environmental storytelling and room variation. |

## 13.3 Object catalog

| ID / object | Class | Definition |
| --- | --- | --- |
| ENV-001 Filing Cabinet | Destructible cover | Common rock-equivalent. Blocks movement and most projectiles. May contain credits, Access Cards, Toner Charges, health, nothing, or a disguised enemy. Metal variants require multiple hits or a blast. |
| ENV-002 Water Cooler | Destructible hazard | Breaks into a water spill. Water may become slippery and conducts shock effects. Rarely contains a Caffeine pickup because office logic has already left the building. |
| ENV-003 Printer | Destructible machine | Releases paper, toner dust, a pickup, or a Printer Beast variant when destroyed. Jammed variants periodically fire paper until broken. |
| ENV-004 Recycling Bin | Light destructible | Easy to break, low-value contents, sometimes launches paper debris that can trigger nearby objects. |
| ENV-005 Vending Machine | Interactive machine | Accepts credits for weighted snacks, health, Supplements, or failure. Can jam, break, or very rarely reveal a passage or enemy. |
| ENV-006 Office Plant | Light destructible | Usually empty; may conceal health, a bug swarm, or a decorative story item. Cactus variant deals contact damage. |
| ENV-007 Cubicle Divider | Partial cover | Blocks movement and low projectiles. Fixed, sliding, damaged, and blastable variants support changing lanes. |
| ENV-008 Desk | Heavy cover | Large rectangular obstacle with authored gaps and drawers. Desks may be intact, overturned, electrified, or breakable. |
| ENV-009 Rolling Chair | Movable object | Can be pushed by player, enemies, airflow, or explosions. Moving chairs deal low impact damage and can block shots. |
| ENV-010 Server Rack | Heavy machine | Indestructible or high-health cover. Powered variants emit shock lanes, spawn turrets, or change room state when disabled. |
| ENV-011 Cable Bundle | Floor hazard | Slows or trips eligible entities. Powered variants shock periodically. Cable Snakes may disguise themselves among bundles. |
| ENV-012 Glass Partition | Breakable wall | Blocks movement and projectiles until shattered. Shards create a brief floor hazard. Uses clear crack states. |
| ENV-013 Archive Shelf | Tall cover | Blocks line of sight and movement. May collapse in a cardinal direction when destroyed, changing navigation. |
| ENV-014 Whiteboard | Thin cover / event | May display a clue, reveal an item phrase, or release marker hazards when broken. Never required for normal progression. |
| ENV-015 Coffee Machine | Interactive machine | Trades credits or charge for Caffeine health and coffee-tag effects. Can overheat, spill, or produce an enemy in corrupted variants. |
| ENV-016 Fire Extinguisher | Reactive object | Explodes into a pushing foam cone when struck or blasted. Can extinguish fire and erase selected hazards. |
| ENV-017 Supply Cart | Movable heavy object | Pushable along clear lanes. May contain pickups and can crush light enemies at speed. |
| ENV-018 Locked Cabinet | Resource container | Consumes an Access Card or blast depending on variant. Uses cabinet-specific loot tables. |
| ENV-019 Power Strip | Reactive hazard | Can be turned off, destroyed, or overloaded. Powered strips link electrical devices and water spills. |
| ENV-020 Trophy Case | Premium destructible | Rare executive object with high-value loot chance, glass hazard, and possible alarm response. |
| ENV-021 Coffee Stain | Floor state | Common visual decal. Mechanical variants are explicitly outlined slippery or sticky zones; decorative stains have no collision. |
| ENV-022 Paper Pile | Soft obstacle | Slows movement and may hide a tiny pickup, Toner Charge, or swarm. Burning or airflow can alter it. |
| ENV-023 Security Scanner | Line hazard | Sweeps or pulses a visible line. Crossing may damage, mark, lock doors, or summon security depending on room rules. |
| ENV-024 Conveyor Lane | Movement hazard | Applies directional movement to entities and movable objects. Direction and active state are visually obvious. |

## 13.4 Hidden contents

Each destructible object references an object-specific outcome table. Outcomes may be conditioned by department, floor depth, object variant, luck, and owned items. Pedestal-quality items are extremely rare and limited to tagged premium objects or set events.

| Outcome band | Initial target |
| --- | --- |
| Nothing / debris only | 65-82 percent depending on object. |
| Minor pickup | 12-25 percent. |
| Hazard or hostile surprise | 2-8 percent. |
| Machine-specific event | 0-5 percent. |
| Premium pickup or container | Below 1 percent for ordinary objects. |
| Pedestal item | Normally zero; only explicit rare variants may roll it. |

## 13.5 Environmental requirements

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ENV-001 | Object collision matches visible shape. | Collision overlay review shows no misleading invisible extension. |
| R-ENV-002 | Mechanical and decorative stains are visually distinct. | A player can identify slippery or damaging zones without testing by damage. |
| R-ENV-003 | Destructible object contents use object-scoped RNG and loot tables. | Destroying objects does not alter future item-pedestal sequence. |
| R-ENV-004 | No required door, blast point, pickup, or enemy spawn is permanently blocked by generated objects. | Post-population validation confirms access and line of approach. |
| R-ENV-005 | Objects may tell stories but cannot resemble hostile entities or projectiles at combat scale. | Readability review passes at native resolution. |
| R-ENV-006 | Environmental chain reactions use bounded propagation. | Power, water, blast, and fire simulations terminate within configured limits. |

# 14. Enemy System

## 14.1 Design objective

Enemies are individually readable and collectively dangerous. The player should recognize what a sprite does after learning it. Surprise comes from room geometry, numbers, variants, support relationships, and combinations rather than every enemy behaving like a mystery box with payroll access.

## 14.2 Behavior taxonomy

| Behavior | Definition | Counterplay |
| --- | --- | --- |
| Chaser | Moves directly toward the player. | Kite, use cover, control distance. |
| Stationary shooter | Holds position and fires fixed or rotating patterns. | Read cadence, attack during downtime, use cover. |
| Burst mover | Alternates pause and rapid movement toward a chosen vector. | Move after telegraph commits. |
| Charger | Locks a direction and crosses the room. | Sidestep, exploit collision, punish recovery. |
| Coward | Maintains distance and attacks when cornered. | Control escape lanes. |
| Support | Heals, shields, buffs, summons, or changes room rules. | Prioritize target without ignoring immediate threats. |
| Splitter | Creates smaller threats or hazards on death. | Plan kill timing and space. |
| Teleporter | Relocates between attacks with a visible destination cue. | Track cue, pre-position, avoid camping. |
| Predictive attacker | Targets current velocity or future position before locking. | Change direction after target lock. |
| Zone controller | Creates temporary unsafe or restricted regions. | Rotate around active zones and use remaining lanes. |
| Mimic | Appears as an object or false entity until a trigger. | Learn tells and manage proximity. |
| Linked formation | Several bodies share route, shield, or state. | Break formation strategically. |
| Rule enemy | Applies a simple temporary condition while alive. | Read icon, defeat source, adapt briefly. |

## 14.3 Readability contract

- Each enemy has a unique silhouette at gameplay scale.
- Movement style is visible before the first dangerous action when practical.
- Attack wind-up, active frames, recovery, and cooldown are authored states.
- Support links are drawn visibly between source and beneficiary.
- Elite variants preserve the base silhouette and add one clear marker such as size, color accent, accessory, or aura.
- Enemy projectiles never use the same primary color and outline language as player projectiles.
- Audio cues supplement but never replace visual telegraphs.

## 14.4 Department continuity and originality

A familiar enemy may appear outside its home department for continuity. Reuse is limited so new departments still feel new. The default spawn-weight target is at least 70 percent native enemies, no more than 25 percent prior-department continuity enemies, and no more than 10 percent rare cross-department specialists, with overlaps allowed only through explicit tags.

## 14.5 Encounter composition rules

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ENM-001 | Enemy definitions declare cost, movement class, attack states, tags, and room compatibility. | Schema validation rejects missing combat data. |
| R-ENM-002 | A normal room begins with a readable grace interval before first damage can occur. | Encounter capture shows the configured minimum response window. |
| R-ENM-003 | Support enemies cannot create permanent invulnerability loops. | Compatibility rules prohibit mutually shielding or infinitely healing groups. |
| R-ENM-004 | Later departments prioritize original native enemies over stat-only reuse. | Spawn analytics meet native-content target over a seeded sample. |
| R-ENM-005 | Variants change at least one behavior, pattern, death effect, or support relationship, not only health. | Variant database includes a functional delta field. |
| R-ENM-006 | Enemy quantity is bounded per room and platform profile. | Stress tests remain within entity and performance budgets. |
| R-ENM-007 | Predictive attacks commit to a telegraphed target before movement or damage. | Changing player direction after lock can evade the attack. |
| R-ENM-008 | Required enemies cannot spawn in unreachable navigation regions. | Spawn validation checks movement-class connectivity. |

## 14.6 Starter enemy roster

| ID / enemy | Home | Behavior and attack | Variants |
| --- | --- | --- | --- |
| ENM-001 Office Drone | Open Office | Chaser: Walks directly toward the player at constant speed. No ranged attack. Core movement-reading enemy. | Larger veteran; faster caffeinated; armored executive variant. |
| ENM-002 Desk Shooter | Open Office | Stationary cardinal burst: Anchored behind a desk and fires three straight paper shots with a clear pause between bursts. | Diagonal late variant; rotating four-way elite. |
| ENM-003 Paper Pusher | Open Office | Mobile shooter: Pushes a small copier while moving laterally and throws paper in the player direction. | Jammed version leaves paper piles; large version fires a spread. |
| ENM-004 Coffee Sprinter | Open Office | Burst mover: Stops, shakes, then dashes in a vector toward the player current or lightly predicted position. | Double-dash elite; spills coffee on death. |
| ENM-005 Nervous Intern | Open Office | Coward shooter: Runs away from the player and throws weak office supplies when cornered. | Drops a pickup and flees faster; panicked version throws in a fan. |
| ENM-006 Rolling Chair Rider | Open Office | Charger: Lines up, locks direction, and charges across the room until collision. | Bounces once; armored chair variant breaks cubicle dividers. |
| ENM-007 Team Player | Open Office | Support buffer: Stays near allies and increases their movement or attack cadence. Weak alone. | Senior version buffs two attributes; elite creates a meeting aura. |
| ENM-008 HR Representative | Cross-department | Debuffer: Fires slow policy folders that reduce player move speed or active availability for a brief, clearly shown duration. | Business Partner elite locks one door until defeated. |
| ENM-009 Meeting Cluster | Open Office | Orbiting swarm: Several employees rotate around an empty center point and periodically break formation toward the player. | Larger cluster; cluster with a Team Player center. |
| ENM-010 Burned-Out Drone | Open Office | Tank / splitter: Moves slowly, absorbs damage, then collapses into two aggressive smaller Exhausted Thoughts. | Explosive deadline variant; armored variant. |
| ENM-011 Cubicle Camper | Open Office | Cover peeker: Hides behind a cubicle divider, peeks to fire, and relocates when cover is destroyed. | Two-shot senior; decoy cubicle variant. |
| ENM-012 Reply Guy | Open Office | Reactive copier: Repeats the last simple projectile pattern fired by another nearby enemy after a short delay. | Elite can repeat boss-add patterns but never boss-unique attacks. |
| ENM-013 Cable Snake | IT | Wall follower: Moves along walls and furniture edges, leaving a short electrified trail. | Branching twin; invisible-until-close corrupted version. |
| ENM-014 Printer Beast | IT | Stationary spread: Winds up loudly, then fires a fan of paper and spits a Paper Pile obstacle. | Laser-printer straight beam variant; color-printer status shots. |
| ENM-015 Ticket Bot | IT | Chaser shooter: Pursues at medium speed and fires single ticket projectiles at intervals. | Escalated ticket splits; overdue version accelerates over time. |
| ENM-016 Firewall Node | IT | Shield support: Projects a visible shield line or bubble onto nearby allies. Cannot shield another Firewall Node. | Mobile node; rotating shield arc. |
| ENM-017 Malware Pop-up | IT | Teleporter / duplicate: Appears near room edges, flashes a warning, fires, and relocates. May create one harmless visual decoy. | Elite creates a damaging decoy; adware swarm variant. |
| ENM-018 Server Rack Turret | IT | Four-way turret: Stationary rack fires on cardinal lanes in a repeating clock pattern. | Eight-way late version; shielded powered version. |
| ENM-019 Helpdesk Agent | IT | Healer: Channels a visible repair beam to a damaged ally. Breaks channel when threatened. | Senior agent repairs shields; cannot heal bosses beyond add-specific caps. |
| ENM-020 Cursor | IT | Predictive dash: A large cursor icon traces the player velocity, marks a destination, then snaps there and damages along the path. | Double-click variant performs two snaps. |
| ENM-021 Blue Screen | IT | Death hazard: Moves slowly and emits weak pulses. On death, creates a delayed shock burst and briefly disables nearby machines. | Corrupted version spawns Malware Pop-ups. |
| ENM-022 Remote Worker | IT | Edge teleporter: Fires from one room edge, fades, and appears on a different edge. Teleport target is shown by a status icon. | Two-shot version; laptop familiar remains briefly after death. |
| ENM-023 Patch Tuesday | IT | Periodic room modifier: Slowly patrols and periodically changes a tagged machine or hazard between powered states. | Emergency patch also repairs one ally. |
| ENM-024 Spam Filter | IT | Projectile blocker: Moves between the player and ranged allies, absorbing low-priority player projectiles until overloaded. | Reflecting elite returns one shot after overload. |
| ENM-025 Courier | Operations | Predictive burst: Carries a parcel, pauses, then sprints toward the player predicted position and drops the parcel as an obstacle. | Explosive parcel; multiple-delivery version. |
| ENM-026 Forklift Clerk | Operations | Heavy charger: Slowly lines up, then charges while pushing movable objects and light enemies. | Armored forklift; reversing second charge. |
| ENM-027 Conveyor Gremlin | Operations | Lane skirmisher: Moves quickly along conveyor directions and throws bolts sideways. | Can reverse conveyor; paired version changes lanes together. |
| ENM-028 Inventory Swarm | Operations | Small swarm: Several animated boxes hop toward the player with simple staggered timing. | Fragile large swarm; barcode-marked variant drops credits. |
| ENM-029 Bottleneck | Operations | Path blocker: Deploys temporary barrier pallets that narrow routes, then retreats behind them. | Elite creates two barriers; barriers may contain pickups. |
| ENM-030 Shift Lead | Operations | Summoner / support: Calls one low-cost Operations enemy from a marked entry point and buffs nearby workers. | Night Shift variant summons faster but is frailer. |
| ENM-031 Pallet Mimic | Operations | Object mimic: Appears as a normal pallet until approached or attacked, then unfolds and charges. | Loot mimic drops a container; explosive mimic. |
| ENM-032 Safety Officer | Operations | Zone controller: Projects striped no-go zones that activate after a warning and deal damage or Slow. | Elite moves zones; cannot fully seal all exits. |
| ENM-033 Temp Worker | Operations | Splitter: Runs erratically and breaks into two smaller contract workers when killed. | Explosive contract version; one-life elite does not split but is stronger. |
| ENM-034 Overtime Zombie | Operations | Escalating chaser: Starts slow and becomes faster the longer the room remains uncleared. | Armored clock-in version; speed resets when stunned. |
| ENM-035 Cart Train | Operations | Linked segments: A lead cart follows a route while trailing carts deal contact damage. Destroyed segments change its turning behavior. | Long train; supply cart drops pickups. |
| ENM-036 Labeler | Operations | Delayed mark shooter: Fires labels that stick to the floor or player location and detonate after a readable delay. | Tracking label; multi-label spread. |
| ENM-037 Executive Assistant | Executive | Shield escort: Follows a high-cost ally and intercepts shots with a briefcase shield, then counterattacks. | Two-assistant formation; golden elite. |
| ENM-038 Compliance Officer | Executive / Legal | Invulnerability cycle: Files paperwork behind a shield, then lowers it to fire a strict cardinal pattern. | Red Tape variant links to another officer. |
| ENM-039 Consultant | Executive | Player-pattern mimic: Observes the player primary attack briefly, then fires a simplified hostile version with a clear color and delay. | Senior consultant stores two patterns but uses one at a time. |
| ENM-040 Middle Manager | Cross-department | Buff and retreat: Boosts nearby enemies, retreats from the player, and throws weak buzzword projectiles. | Regional version buffs variants; demoted version becomes a chaser when alone. |
| ENM-041 Security Guard | Executive | Cone scan / charge: Sweeps a visible vision cone. If the player is detected when the sweep ends, charges or fires a stun shot. | Armored guard; rotating scanner variant. |
| ENM-042 Legal Eagle | Executive / Legal | Tether shooter: Fires contract pages that tether the player to a point or enemy until broken by movement or damage. | Double-clause elite creates two shorter tethers. |
| ENM-043 Board Member | Executive / Board | Rotating pattern: Sits stationary and rotates a deliberate projectile pattern around the chair. | Voting pair synchronize patterns; standing elite relocates. |
| ENM-044 Expense Ghost | Executive / Finance | Resource thief: Floats through furniture and steals credits on contact, dropping them when killed. | Interest version grows stronger while holding credits. |
| ENM-045 Golden Drone | Executive | Elite chaser: Fast, armored Office Drone with a guaranteed premium pickup chance. | Rare continuity enemy, never common enough to replace new content. |
| ENM-046 HR Business Partner | Cross-department | Room rule debuffer: Applies one clearly displayed policy to the room, such as slower active recharge or reduced pickup attraction, until defeated. | Only one policy enemy per normal room. |
| ENM-047 Auditor | Finance | Counter / punish: Marks a credit or pickup and fires when the player collects it, with a visible audit line. | Senior auditor marks two resources. |
| ENM-048 Collector | Finance | Debt chaser: Grows faster for each credit the player carries and drops a portion of stolen credits on death. | Armored high-balance version. |
| ENM-049 Brand Double | Marketing | Decoy: Creates a visual duplicate of itself; only the real one casts the correct shadow and damage telegraph. | Campaign version duplicates another enemy silhouette but not behavior. |
| ENM-050 Focus Tester | Marketing | Attention controller: Projects a gaze cone that slows attack cadence if the player remains inside after warning. | Mobile panel of three testers. |
| ENM-051 Red Tape Roll | Legal | Growing obstacle: Rolls a strip across the floor that temporarily becomes a collision wall, then retracts. | Cross pattern; burning tape variant. |
| ENM-052 Clause | Legal | Conditional attacker: Displays a simple icon condition such as moving or firing; violates it and the Clause launches a punishment shot. | Elite cycles two conditions, never simultaneous. |
| ENM-053 Janitor | Facilities | Hazard manipulator: Moves spills, pushes debris, and swings a mop in a short arc. | Corrupted janitor spreads hazardous fluid. |
| ENM-054 The Leak | Facilities | Spawned hazard entity: A moving puddle source that creates water paths and retreats from electricity. | Toxic or burning fluid variant. |
| ENM-055 Prototype | R&D | Unstable behavior: Uses one clearly signposted experimental behavior selected from a curated list per spawn. | Glitched elite combines two compatible experiments. |
| ENM-056 Archive Shade | Secret / Records | Phase ambusher: Moves beneath paper piles, then rises with a radial burst after a warning rustle. | Senior shade steals an item phrase from HUD temporarily, never mechanics. |
| ENM-057 Shareholder Eye | Board / hidden | Tracking turret: Floats above obstacles and follows the player with a thin targeting line before firing. | Multiple eyes vote on one target point. |
| ENM-058 Merger Abomination | Conglomerate | Composite elite: Combines two approved enemy behavior modules and a fused corporate silhouette. | Generated only from curated compatibility pairs, not arbitrary AI assembly. |

# 15. Boss System

## 15.1 Boss purpose

A floor boss is a department climax and a build check. It should be memorable because of one strong idea, not because it has twelve unrelated phases and a LinkedIn profile. Bosses reward learning, movement, target priority, and using the current build creatively.

## 15.2 Boss selection

- Each floor definition references a boss pool and weight table.
- Floor I pools emphasize one mechanic and generous telegraphs.
- Floor II pools add multi-phase, large-room, support, or environment mechanics.
- Executive II selects the CEO on the base route unless a hidden route explicitly replaces the encounter.
- Bosses already defeated in the current run receive a repeat weight penalty unless a double-boss or rematch room requires them.
- A boss may have a set drop that replaces the ordinary Manager Reward under explicit conditions.

## 15.3 Boss combat contract

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-BSS-001 | Every normal floor ends in one boss encounter. | Manager Office cannot resolve without a boss definition unless a bespoke story floor says so. |
| R-BSS-002 | Defeating the boss produces exactly one default Manager Reward pedestal. | Reward resolution is idempotent across save/continue. |
| R-BSS-003 | Boss attacks use the same damage and telegraph rules as enemies unless explicitly documented. | No invisible or untagged damage source appears in combat logs. |
| R-BSS-004 | Boss invulnerability phases are short, purposeful, and visually explicit. | No phase exceeds the configured non-interactive duration without an attackable add or objective. |
| R-BSS-005 | Boss arenas are authored for the boss and may use large footprints. | Boss definition lists compatible arena tags and required sockets. |
| R-BSS-006 | Bosses preserve safe response routes during moving-wall and zone phases. | Automated geometry snapshots and playtests confirm at least one valid path. |
| R-BSS-007 | Set drops are declared in data and do not accidentally duplicate non-repeatable collected items. | Reward test covers pool removal and set-drop override. |

## 15.4 Phase design template

```yaml
BossDefinition
  identity_and_silhouette
  department_and_floor_pool
  arena_tags
  maximum_health_and_scaling
  phase_list
    entry_condition
    attack_pattern_weights
    movement_rule
    adds_and_environment
    exit_condition
  telegraph_minimums
  damage_and_contact_rules
  set_drop_rules
  manager_reward_override
  unlock_and_ending_hooks
  accessibility_variants
  test_seeds
```

## 15.5 Boss roster

| ID / boss | Location | Fight identity | Reward / role |
| --- | --- | --- | --- |
| BSS-001 The Team Lead | Open Office I | Buffs Office Drones with visible buzzword rings, fires simple radial notes, and becomes aggressive when alone. | Reliable introductory manager boss. Drops a normal Manager Reward; rare set drop: Team Player Badge. |
| BSS-002 Copy Chief | Open Office I-II | A giant copier rotates between paper fan, straight sheet wave, jammed add spawn, and toner burst. | Arena contains destructible printers. Rare set drop: Printer Ink or Copier weapon. |
| BSS-003 Scrum Master | Open Office II | Creates timed stand-up zones, dashes at the end of each countdown, and summons brief Meeting Clusters. | Teaches timed windows without long invulnerability. |
| BSS-004 The Open Plan | Open Office II | The room itself shifts cubicle dividers while a central manager node fires patterns and exposes weak points. | Large-room boss; moving architecture never seals all safe routes. |
| BSS-005 Sysadmin | IT I | Activates terminal nodes, deploys firewall lines, and uses a predictable command cycle. | Destroying nodes shortens shield phases. Rare set drop: Master Access fragment. |
| BSS-006 Helpdesk Hydra | IT I-II | Multiple phone heads perform distinct calls: tickets, shock lines, summons, and repair. Heads can be disabled independently. | Head count and pattern scale by floor. |
| BSS-007 Legacy System | IT II | Large old server with slow, punishing phases, rotating obsolete patterns, and a final overclock meltdown. | Deliberately predictable once learned; high health but generous tells. |
| BSS-008 Firewall | IT II | Mobile shield walls divide the room while a core fires through approved gaps. | Player can destroy temporary ports to create attack lanes. |
| BSS-009 The Bottleneck | Operations I | Deploys pallets, narrows movement, and launches charges through the remaining lane. | Rewards object management. Set drop: Extension Cord or Supply Cart charm. |
| BSS-010 Shift Manager | Operations I-II | Schedules enemy waves on a visible board and joins combat between calls. | Killing scheduled adds early creates safe downtime. |
| BSS-011 Supply Chain | Operations II | Linked cart-and-worker segments circulate the room. Destroying segments changes route and attack pattern. | Large-room segmented boss with no off-screen damage. |
| BSS-012 Quarter End | Operations II | A clock-driven boss that accelerates selected patterns but exposes a weak point at each deadline. | Not a global run timer; the fight itself owns the clock. |
| BSS-013 VP of Everything | Executive I | Cycles through diluted versions of earlier department mechanics and delegates attacks to assistants. | A recognition exam, not a random pattern soup. |
| BSS-014 Chief Operating Officer | Executive I-II | Controls room zones, security, and moving executive furniture while attacking in measured phases. | Drops a high-quality Manager Reward and may open a post-boss offer room. |
| BSS-015 The Boardroom | Executive II | Several chair-bound members vote to enable synchronized patterns. Defeating members changes the vote balance. | May appear as alternate pre-CEO boss or hidden Board preview. |
| BSS-016 CEO | Executive II final | Three phases: charismatic presentation, hostile restructuring with adds, and exposed machine-like corporate core. | First apparent final boss. Defeat triggers ending logic, not always credits. |
| BSS-017 The Auditor | Finance | Tracks spending, marks pickups, and creates ledger lanes that reconcile after a delay. | Set drop: Corporate Card or Red Pen. |
| BSS-018 Budget Committee | Finance | Three members allocate armor, projectiles, and resource theft through a visible rotating budget. | Defeating one member changes allocation, creating player choice. |
| BSS-019 Brand Manager | Marketing | Creates decoy bosses and false reward silhouettes while the real attacks remain identifiable by shadow and audio. | Fairness depends on consistent tell, never pure guessing. |
| BSS-020 Viral Campaign | Marketing | A central campaign spreads copies through ad nodes. Destroying nodes limits pattern replication. | Escalates visually but uses bounded entity counts. |
| BSS-021 General Counsel | Legal | Uses clauses, binding zones, and delayed rulings with explicit icons and countdowns. | Rewards reading simple conditions under pressure. |
| BSS-022 Red Tape | Legal | A giant living roll creates walls, knots, and temporary seals around the arena. | Cut points open lanes; no phase can fully trap the player. |
| BSS-023 Head of Facilities | Facilities | Manipulates water, power, doors, and movable objects while remaining physically vulnerable. | Environmental boss with multiple valid solutions. |
| BSS-024 Prototype Zero | R&D | Cycles through a curated sequence of experimental weapon and room-rule modules. | Seeded module order supports learning within attempts. |
| BSS-025 The Board | The Board II | A coordinated multi-entity boss whose votes select pattern families and rewrite arena priorities. | First major post-CEO boss; unlocks deeper ownership route conditions. |
| BSS-026 Hostile Takeover | The Board II alternate | Aggressive merger entity absorbs adds and inherits one attack from each. | Player may kill adds before absorption to limit the final kit. |
| BSS-027 Parent Company | Parent Company | Reconstructs sanitized versions of earlier bosses and erases its own branding between phases. | Defeat reveals the subsidiary structure and a false terminal ending. |
| BSS-028 The Conglomerate | The Conglomerate | Massive composite boss using carefully sequenced cross-department mechanics and arena transformations. | Ultra-late mastery boss. No random module mixing during the fight. |
| BSS-029 The Beneficial Owner | Ownership | Minimalist final duel that echoes selected mechanics from the current run, then removes layers until only movement and core weapon skill remain. | Ultimate concealed boss and final ending. Does not invalidate future expansion. |

# 16. Progression, Unlocks, Endings, and Hidden Expansion

## 16.1 Progression philosophy

Permanent progression expands the possibility space. It unlocks items, weapons, enemies, bosses, rooms, departments, employee profiles, challenges, and routes. It does not create a universal permanent damage, health, or luck grind. The player becomes stronger primarily by knowing more and playing better.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-PRG-001 | Meta progression adds content rather than universal raw power. | Save data contains unlock flags and profile data but no account-wide damage level. |
| R-PRG-002 | An unlock enters one or more explicit pools only after its condition is met. | Fresh-save seeded runs cannot roll locked content. |
| R-PRG-003 | Major hidden continuations do not use ordinary unlock banners. | The tenth CEO victory transitions directly into hidden content. |
| R-PRG-004 | The game does not show a denominator for total items, endings, bosses, or secrets. | Collection and ending UI has no undiscovered slot count. |
| R-PRG-005 | Unlock evaluation occurs on relevant events and at run end, and is idempotent. | Reloading the same completed event does not duplicate rewards or corrupt counters. |
| R-PRG-006 | Seeded challenge and daily modes declare whether unlocks are enabled. | Mode definition controls unlock eligibility consistently. |

## 16.2 Fresh-save content

- Employee profile only.
- Base visible route: Open Office, IT, Operations, Executive, CEO.
- A curated starter subset of weapons, items, actives, Action Cards, Supplements, Desk Charms, enemies, bosses, and room variants.
- Supply Closet, Shop, Manager Office, Break Room, Deadline Room, Maintenance Access, Forgotten Cubicle, and basic NPC/machine rooms.
- No UI reference to locked alternate departments or post-CEO hierarchy.

## 16.3 Unlock condition families

| Family | Examples | Typical reward |
| --- | --- | --- |
| Boss defeat | Defeat Copy Chief, CEO, The Board. | Set item, boss, room, route, or profile. |
| Repeated victory | CEO clear counts 1, 3, 5, and 10. | Ending changes, pool expansion, hidden continuation. |
| Run feat | No-damage boss, low-health victory, high credit balance. | Item, charm, Action Card, profile. |
| Discovery | Enter 13th Floor, find Shadow Procurement, open repeated secret rooms. | Secret item pool, profile, route fragment. |
| Combination | Activate a transformation or carry a defined set. | New set item or challenge. |
| Challenge completion | Start with a liability, restricted weapon, or altered route. | A specific item enters normal pools. |
| Employee completion mark | Defeat key endings with a profile. | Profile-specific items and visible marks after discovery. |

## 16.4 Repeated CEO victories

The player is never told that CEO victories are counting toward a larger reveal. Smaller content unlocks provide replay value before the first structural surprise.

| Internal milestone | Hidden result |
| --- | --- |
| CEO clear 1 | Ending END-001; unlock a small set of executive and post-boss offer content. |
| CEO clear 3 | Ending END-002; add harder Executive variants and additional CEO attack selection. |
| CEO clear 5 | Ending condition END-003 becomes available; alternate departments gain higher selection weight. |
| CEO clear 7 | Rare Board imagery and elevator audio foreshadowing may appear without functional route change. |
| CEO clear 10 | END-004 triggers. The apparent end is interrupted and the elevator enters The Board I. |

## 16.5 Deeper hidden route

1. Defeating The Board records END-005 and allows ownership-document fragments to appear in secret and alternate routes.
2. Collecting two distinct fragments in one run after a Board clear opens Parent Company instead of the normal Board ending.
3. Defeating Parent Company records END-007 and unlocks three Ownership Key fragment conditions across Facilities, R&D, and an Executive Deal route.
4. Assembling the three Ownership Key fragments in one run opens The Conglomerate after Parent Company.
5. Defeating The Conglomerate records END-008 and permits the Ownership elevator to appear under a final concealed condition: no Executive Deal debt and at least one discovered secret room in every chapter of that run.
6. Ownership leads to The Beneficial Owner and END-009.

> **Mystery protection:** The normal UI never lists these steps. Internal debug tools and the GDD do. Players encounter clues through documents, elevator behavior, room art, and community discovery.

## 16.6 Employee profiles

Employee profiles change starting conditions and reward mastery without adding control complexity. Each uses the same core input set.

| ID / profile | Unlock | Starting kit | Identity |
| --- | --- | --- | --- |
| PRF-001 Employee | Default | Keyboard, three Composure icons, standard stats. | Baseline balance profile. |
| PRF-002 Intern | Clear Open Office II without collecting a Manager Reward | Keyboard, two Composure icons, higher move speed, Visitor Badge. | Fast, fragile, access-focused. |
| PRF-003 IT Specialist | Defeat every IT boss at least once | Keyboard, Rechargeable Battery, one random technology-tag Desk Charm. | Active-item and technology bias. |
| PRF-004 Contractor | Complete a run while carrying Corporate Card debt | Two Composure icons plus two Caffeine icons, no free first-floor Supply Closet access. | Temporary protection, harsher resource economy. |
| PRF-005 Burned-Out Veteran | Defeat CEO while at one full Composure icon or less | Keyboard, Burnout, four Composure icons before Burnout applies. | High-risk damage scaling. |
| PRF-006 Executive Assistant | Defeat VP of Everything without taking damage | Keyboard, one regenerating briefcase shield, lower base damage. | Defensive positioning and boss knowledge. |
| PRF-007 Remote Worker | Reach the 13th Floor error room | Presentation Remote, one random Action Card, lower contact resistance. | Bouncing attack and teleport-oriented unlock pool. |
| PRF-008 Facilities Tech | Complete the Facilities branch | Mouse, one Toner Charge, Rubber Foot charm. | Close range and environmental control. |

## 16.7 Ending registry

| ID / ending | Condition | Player-facing result |
| --- | --- | --- |
| END-001 Termination | First CEO defeat | The employee appears fired. Credits roll normally. Internal CEO clear counter increments. |
| END-002 Promotion | Third CEO defeat | The employee is promoted into an office that looks suspiciously like a cell. New Executive content enters pools. |
| END-003 Golden Handshake | Fifth CEO defeat with an Executive Deal taken | The company buys the player silence. Unlocks debt and deal items. |
| END-004 The Elevator Keeps Going | Tenth CEO defeat | Credits begin, then stop. The elevator opens to The Board I with no unlock banner. |
| END-005 Quorum | First defeat of The Board | Reveals ownership documents and unlocks deeper route fragments. |
| END-006 Hostile Takeover | Defeat Hostile Takeover | The player becomes the acquiring entity for one frame before being acquired again. |
| END-007 Subsidiary | Defeat Parent Company | Reveals the known company as one disposable subsidiary. Appears terminal but is not. |
| END-008 Consolidated | Defeat The Conglomerate | Multiple corporate identities merge. Unlocks Ownership route conditions. |
| END-009 Beneficial Ownership | Defeat The Beneficial Owner | Ultimate concealed ending. Completion does not display a total ending count. |

## 16.8 Challenges

Challenges are predefined runs with a starting profile, weapon, items, route, and rules. They teach unusual mechanics and unlock specific content. Challenges may remove item rooms, force a liability, limit firing directions, or require a route. They may not rely on hidden arbitrary failure conditions.

# 17. User Interface, User Experience, and Accessibility

## 17.1 Interface principle

> **UI law:** The player sees what they need now: health, resources, held tools, charge, room exits, map, and danger. The game does not ask them to manage a dashboard worthy of the company they are trying to destroy.

## 17.2 HUD layout

| Area | Contents | Visibility rule |
| --- | --- | --- |
| Top left | Composure and buffer health; active item icon and charge. | Always visible in gameplay; compact in cutscenes. |
| Top right | Credits, Access Cards, Toner Charges; pocket item and Desk Charm icons. | Always visible when value is relevant. |
| Upper corner / side | Discovered floor map. | Compact by default; expanded while Map input is held or toggled. |
| Bottom center | Boss health or special encounter progress. | Only during boss or explicit wave objective. |
| Center banner | Item name and qualitative phrase; unlock or ending message when appropriate. | Brief, non-blocking, and never over active danger. |
| World labels | Price, interaction button, known Supplement identity, door cost. | Only near the relevant object. |

## 17.3 Item language

| Internal effect | Acceptable player phrase | Rejected normal pickup copy |
| --- | --- | --- |
| Attack interval x0.88 | Typing faster | -12% fire delay |
| Damage x1.25 | Heavier work | +25% damage |
| Projectile speed x1.20 | Faster keys | +1.8 shot speed |
| Add one Composure container | A little more room to breathe | +2 HP |
| Enable homing adapter | Points to the target | Homing strength 0.12 |
| Open first locked door free | Act like you belong | 1 free key per floor |

## 17.4 Map

- The map displays discovered rooms, door connections, current position, and discovered special-room icons.
- Undiscovered secret rooms do not reserve visible spaces or show blank icons.
- Large rooms occupy their logical footprint on the map but behave as one selectable room.
- Items may reveal categories, routes, or full layout according to their definitions.
- The map does not display encounter contents before entry unless a specific effect grants that information.

## 17.5 Menus

| Menu | Required functions |
| --- | --- |
| Title | Continue, new run, employee profile, challenges, options, collection, quit. |
| Pause | Resume, controls, options, collection reference, restart with hold confirmation, exit to menu. |
| Options | Audio, display, accessibility, controls, language, privacy/telemetry. |
| Collection | Discovered items, weapons, cards, Supplements, charms, enemies, bosses, endings, and employee marks without undiscovered totals. |
| Run results | Ending or death, floors reached, bosses defeated, items carried, seed, newly discovered content. No grade is required. |

## 17.6 Accessibility

- Fully remappable keyboard and controller inputs.
- Controller dead-zone and cardinal-aim snap adjustment.
- High-contrast outlines for player, hostile projectiles, pickups, and hazards.
- Color-vision presets plus icon and shape redundancy; no mechanic depends on color alone.
- Reduced screen shake, flash intensity, particle density, and motion effects.
- Scalable HUD and text with a readable font option.
- Hold/toggle alternatives for sustained firing, map display, and selected interactions.
- Optional game-speed assist presets may reduce simulation speed while preserving loot and unlock rules; assisted runs are clearly labeled only where competitive comparison matters.
- Audio cue captions for critical off-screen or timing events.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-UIX-001 | Normal HUD exposes no detailed numeric stat sheet. | Gameplay and pause captures show qualitative build information only. |
| R-UIX-002 | Obvious resources and costs use visible integers. | Credit, Access Card, Toner Charge, and active charge displays match state. |
| R-UIX-003 | Unknown content totals remain hidden. | Collection UI contains no locked silhouette grid or completion denominator. |
| R-UIX-004 | Accessibility settings do not expose loot-weight or rarity tuning. | Options schema contains no generation probability controls. |
| R-UIX-005 | Every critical color cue has a non-color cue. | Color-blind review validates shape, outline, motion, or icon redundancy. |
| R-UIX-006 | Pickup banners never obscure active combat danger. | Banner queue defers or repositions during hostile states. |

# 18. Art, Animation, and Visual Effects

## 18.1 Visual direction

The baseline art direction is crisp 2D top-down pixel art with chunky silhouettes, readable animation, and a slightly grotesque corporate-cartoon tone. The interface is clean and almost toy-like; the world grows stranger and more oppressive as the player climbs. Placeholder art may be simpler, but production assets must preserve gameplay-scale readability.

## 18.2 Technical art assumptions

| Element | Direction |
| --- | --- |
| Base sprite unit | 32-pixel reference grid for ordinary characters and objects; larger entities use integer multiples. |
| Scaling | Pixel-perfect or nearest-neighbor integer scaling where practical. No smoothing that blurs silhouettes. |
| Viewport | 16:9 primary composition with safe-area support. Normal rooms fit the gameplay canvas. |
| Animation rate | Gameplay animations use authored frame timing independent of simulation frame rate. |
| Layer order | Floor, stains/hazards, low objects, entities, projectiles, high objects, VFX, HUD. |
| Lighting | Stylized department overlays and local effects; critical combat elements are not hidden by darkness. |

## 18.3 Character and enemy readability

- The player has a persistent outline and item-layer priority above most friendly effects.
- Each enemy family has a distinct silhouette before palette differences are considered.
- Attack wind-ups exaggerate the body part, prop, direction, or device responsible for damage.
- Elite variants retain recognition while adding one strong visual marker.
- Bosses are identifiable in a single frame and visually express their core mechanic.
- Decorative employees or portraits cannot be mistaken for combat entities.

## 18.4 Item visuals on the player

Collected passives may add visible accessories, body changes, orbitals, familiars, weapon skins, or attack VFX. Layer priority prevents the player from becoming an unreadable laundry pile.

| Priority | Layer examples |
| --- | --- |
| 1 - gameplay critical | Player outline, current weapon, damage flash, invulnerability state. |
| 2 - mechanic critical | Orbitals, shields, familiars, active status, transformation body state. |
| 3 - identity | Glasses, hoodie, badge, headset, coffee accessory, visible cable. |
| 4 - decorative | Small desk charms, minor stickers, extra particles. |

If too many identity layers overlap, the renderer selects the highest-priority compatible subset. The underlying mechanics remain active. The collection screen may show the complete acquired list.

## 18.5 VFX rules

- Player attacks use a consistent friendly outline family; hostile attacks use a separate hostile outline family.
- Homing, mark, shock, slow, burn, pierce, and bounce each have reusable effect language.
- Large damage events may use shake, flash, and particles, but reduced-effects mode preserves timing and impact through sound and shape.
- Effect aggregation combines repeated particles after configured thresholds without changing damage ticks.
- Secret-wall blast feedback must make a successful discovery unmistakable.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-ART-001 | Sprites are readable at native gameplay scale. | Review uses unzoomed gameplay capture, not concept-art closeups. |
| R-ART-002 | Every collectible has a unique inventory sprite. | Asset validator rejects duplicate canonical sprite references. |
| R-ART-003 | Visual effect degradation preserves hostile readability and mechanical output. | Stress tests compare damage logs with full and reduced particles. |
| R-ART-004 | Departments are identifiable by material and silhouette as well as palette. | Grayscale and low-saturation review passes. |

# 19. Audio Direction

## 19.1 Audio goals

- Make attacks, impacts, enemy wind-ups, door states, pickups, and secrets readable without requiring sight of every event.
- Turn office sounds into rhythm and texture: keyboards, printers, fluorescent hum, phones, elevators, scanners, vents, carts, and awkward announcements.
- Give each department a musical identity while maintaining a coherent corporate score.
- Escalate from mundane office ambience to surreal mechanical and ownership spaces.
- Use humor sparingly. A sound can be funny once and still needs to survive the thousandth run.

## 19.2 Mix priority

1. Player damage and imminent lethal danger.
2. Enemy attack telegraphs and boss phase cues.
3. Player weapon cadence, active use, and impact confirmation.
4. Door lock, room clear, reward, secret discovery, and elevator state.
5. Music and department ambience.
6. Decorative props and nonessential chatter.

## 19.3 Department palette

| Department | Music and ambience |
| --- | --- |
| Open Office | Dry percussion from typing and staplers, fluorescent hum, distant phones, restrained bass. |
| IT | Digital pulses, fan drones, modem-like artifacts, electrical transients, low industrial rhythm. |
| Operations | Conveyor rhythm, cart impacts, scanner beeps, faster mechanical percussion. |
| Executive | Polished minimal music, muted room tone, expensive materials, unsettling silence between cues. |
| Finance | Counting rhythms, printer ticks, coin and receipt textures, tightening metronome. |
| Marketing | Catchy fragments that distort, ad stingers, applause samples, synthetic gloss. |
| Legal | Measured pulses, paper movement, seals, restrained strings, delayed impacts. |
| Hidden hierarchy | Themes recombine, lose branding, and become increasingly sparse or impossible. |

## 19.4 Voice and text

Full dialogue is not required. Bosses and machines may use short processed phrases, buzzwords, announcements, or vocal barks. Speech must not carry information that lacks a visual equivalent. Localization-ready text IDs are mandatory even for jokes.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-AUD-001 | Critical attack cues remain audible above music at default mix. | Mix review and automated loudness snapshots pass. |
| R-AUD-002 | Repeated weapon sounds support high cadence without harsh stacking. | Rapid-fire stress test uses variation, pooling, and concurrency limits. |
| R-AUD-003 | Audio-only cues have captions or visual equivalents. | Accessibility audit maps each critical cue to a non-audio signal. |
| R-AUD-004 | Secret discoveries have a unique confirmation sting. | Players can distinguish hidden-room success from ordinary object destruction. |

# 20. Technical Architecture and Data Contracts

## 20.1 Architecture objective

The design is engine-neutral, but the implementation must be data-driven, deterministic where required, and modular enough that content growth does not turn the codebase into a haunted spreadsheet. An implementation plan may select Godot, Unity, or another suitable engine after evaluating team constraints; the selected engine must honor these contracts.

## 20.2 Core runtime modules

| Module | Responsibility |
| --- | --- |
| Run Manager | Creates seed, route, profile, difficulty, run state, transitions, endings, and run persistence. |
| Floor Generator | Builds validated room graph, assigns templates, roles, secrets, encounters, objects, and rewards. |
| Room State Machine | Handles entry, doors, combat, waves, clear, rewards, revisit, and transition. |
| Entity Runtime | Player, enemy, boss, familiar, projectile, pickup, object, hazard, machine, and NPC lifecycle. |
| Combat Resolver | Damage, collision, status, invulnerability, death, procs, and deterministic event priority. |
| Attack Graph | Combines weapon definition, passive modifiers, transformations, profile effects, and temporary statuses. |
| Loot Service | Pools, weights, quality gates, seen decay, duplicate rules, rerolls, and set drops. |
| Unlock Service | Conditions, counters, hidden routes, collection history, endings, and profile marks. |
| Save Service | Profile save, settings, run continue state, migration, atomic writes, and corruption recovery. |
| Presentation | Animation, VFX, audio, HUD, map, menus, localization, and accessibility transforms. |
| Debug and QA | Seed replay, trace logs, validators, cheats, content browser, performance counters, and test harnesses. |

## 20.3 Entity composition

An entity may use component composition or an equivalent modular pattern. The exact framework is not mandated, but behavior reuse must not depend on deep inheritance chains.

```yaml
Common components:
  Transform
  Movement
  Collision
  Health
  DamageSource
  AttackController
  AIController
  StatusContainer
  AnimationController
  AudioEmitter
  LootDropper
  Interaction
  SaveIdentity
  DepartmentTags

Bosses and enemies compose behavior modules from curated data.
Arbitrary runtime AI generation is prohibited for release combat content.
```

## 20.4 Deterministic RNG streams

Randomness is split into named streams so an object drop does not change the next boss or item. Each stream derives from the run seed and stable context identifiers.

| Stream | Examples |
| --- | --- |
| RUN_ROUTE | Alternate department selection, high-level route events. |
| FLOOR_LAYOUT | Graph growth, room footprints, dead ends. |
| ROOM_TEMPLATE | Architecture variant selection. |
| ENCOUNTER | Encounter selection and wave variants. |
| LOOT_ITEM | Pedestal items, rerolls, quality jackpot. |
| LOOT_PICKUP | Room clear rewards and containers. |
| OBJECT_CONTENT | Cabinet, printer, bin, and machine outcomes. |
| BOSS | Boss pool selection and authored random phase choice. |
| COMBAT_PROC | Crits, duplication, status chance, familiar procs. |
| COSMETIC | Non-mechanical decoration, particles, harmless animation variation. |

## 20.5 Event ordering

```text
Recommended deterministic event priority:
  10 input sampled
  20 movement intent
  30 AI intent
  40 attack creation
  50 physics and collision
  60 damage resolution
  70 death and destruction
  80 on-hit / on-damage / on-death effects
  90 room clear evaluation
 100 reward and unlock events
 110 presentation-only events
```

## 20.6 Content identifiers

- IDs are stable, unique, ASCII strings such as WPN-001, ITM-011, ENM-028, and ROOM-012.
- Display names are localized and may change without changing IDs.
- Save files store IDs and versioned state, never localized names or asset paths as identity.
- Removed content IDs remain reserved and migrate explicitly.
- Tags use a controlled registry rather than arbitrary free text.

## 20.7 Performance targets

| Target | Baseline |
| --- | --- |
| Simulation | 60 updates per second on target PC profile; rendering may be higher. |
| Frame time | 16.67 ms target at 60 FPS, with defined CPU and GPU budgets per system. |
| Active hostile entities | Normal-room cap data-defined; initial target 30 non-boss hostiles including split children. |
| Projectiles | Mechanical cap supports at least 600 simultaneous logical projectiles through pooling and aggregation. |
| Room transition | Under 0.5 seconds after assets are warm; no visible hitch on standard room entry. |
| Floor generation | Under 250 ms on target profile or performed behind elevator transition. |
| Save write | Atomic and non-blocking from player perspective. |

## 20.8 Technical requirements

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-TEC-001 | Normal content is defined outside core logic in versioned data files or engine resources. | A new simple item and enemy can be added without editing system source. |
| R-TEC-002 | RNG streams are scoped and reproducible. | Seed replay produces identical floor, item, boss, and proc sequence given identical inputs. |
| R-TEC-003 | Save identity uses stable IDs and schema versions. | Renaming display text does not break existing saves. |
| R-TEC-004 | Entity and projectile pooling prevents allocation spikes in high-output builds. | Profiler shows bounded allocations during stress rooms. |
| R-TEC-005 | Content data is validated at build and load time. | Invalid references, weights, sockets, tags, and missing assets fail loudly in development. |
| R-TEC-006 | No core system checks item display names to implement behavior. | Static analysis and code review find ID/tag/interface usage only. |
| R-TEC-007 | Presentation reduction cannot alter combat results. | Deterministic combat logs match across particle settings. |
| R-TEC-008 | Generated floors are persisted as instances, not regenerated on ordinary revisit. | Save/continue restores identical layout and object state. |

# 21. Save Data, Seeds, Debugging, and Telemetry

## 21.1 Save domains

| Domain | Stored data |
| --- | --- |
| Profile | Unlock flags, hidden counters, endings, employee marks, collection discoveries, challenges, settings references, version. |
| Run continue | Seed, route, profile, floor instance, room states, player build, resources, active entities needed for safe resume, RNG stream states. |
| Settings | Controls, audio, display, accessibility, language, privacy choices. |
| Statistics | Optional local totals such as runs, deaths, bosses, items seen, and play time. Hidden totals are not surfaced unless designed. |
| Debug export | Seed, content versions, validation report, event trace, performance snapshot, and non-personal reproduction data. |

## 21.2 Autosave policy

- Autosave after entering a new room and after resolving a pickup, purchase, boss victory, floor transition, or unlock-critical event.
- Writes are atomic: write temporary file, validate, then replace previous save while retaining one backup.
- Run continue resumes at a safe room boundary or serialized stable state, not in an ambiguous half-resolved collision frame.
- Restarting a run uses hold confirmation and intentionally discards the current run state.
- The game does not punish ordinary application closure by deleting a valid run.

## 21.3 Seeds

Every run has a human-shareable seed. A seed reproduces high-level generation when content version, profile, route rules, difficulty, and mode match. Input-dependent combat procs may diverge when player actions diverge, as expected.

| Seed mode | Unlocks | Notes |
| --- | --- | --- |
| Normal random run | Enabled | Standard progression. |
| Entered seed | Disabled by default | Reproduction and sharing; may enable collection discovery but not unlock conditions. |
| Challenge | Mode-defined | Usually enables its designated completion unlock only. |
| Daily | Disabled or daily-specific | Requires online service decision outside this GDD. |
| Debug | Disabled | Exposes streams, room graph, pools, and force-spawn tools. |

## 21.4 Telemetry and privacy

Remote telemetry is optional and must be opt-in where required by law or platform policy. The game remains fully playable without it. Useful aggregate events include floor reached, death source, item pickup/skip, room generation failure, performance, boss damage taken, and crashes. Raw personal data, chat, or unrelated machine information is out of scope.

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-SAV-001 | Profile and run saves are versioned and migratable. | Automated migration tests load each supported prior fixture. |
| R-SAV-002 | A corrupted primary save falls back to a validated backup. | Fault-injection test recovers without losing both copies. |
| R-SAV-003 | Entered-seed runs cannot unlock normal progression by default. | Unlock service rejects ineligible mode events. |
| R-SAV-004 | Debug exports contain enough state to reproduce generation defects. | A reported seed and export recreate the same floor graph and content versions. |
| R-SAV-005 | Telemetry is not required for save, progression, or balance. | Offline mode passes full normal run and unlock tests. |

# 22. AI Development Contract

## 22.1 Purpose

This section tells an AI coding agent how to use the GDD. The agent is expected to plan and implement in small verified slices while preserving the north-star architecture. It may not replace a difficult requirement with a vague approximation and call that innovation.

## 22.2 Mandatory workflow

1. Read the complete relevant GDD sections and extract requirement IDs into a traceability checklist before coding.
2. Inspect the existing repository, engine version, conventions, tests, data formats, and architecture before proposing changes.
3. Write an implementation plan that maps tasks, files, tests, and acceptance criteria to requirement IDs.
4. Prefer the smallest vertical slice that establishes reusable architecture and produces playable behavior.
5. Implement content through data definitions and reusable systems rather than one-off hardcoding.
6. Add automated tests, seed fixtures, schema validation, and debug tooling with each system.
7. Run tests and a playable smoke test. Record results and known limitations honestly.
8. Update documentation and traceability. Do not silently modify the GDD to match accidental code behavior.

## 22.3 Ambiguity resolution

When the GDD leaves a genuine implementation detail open, the agent must choose the simplest solution consistent with all locked decisions. For a design ambiguity, use the reference translation rule: identify the gameplay purpose of the comparable genre mechanic, translate it into original office-themed content, and record the assumption in a design-deviation log for owner review.

> **Prohibited shortcut:** Do not copy code, assets, names, descriptions, or exact content from The Binding of Isaac or any other game. Mechanical benchmarking is not a license to photocopy the product.

## 22.4 Repository expectations

```text
Recommended project documents:
  /docs/GDD.md                         canonical machine-readable GDD
  /docs/REQUIREMENT_TRACEABILITY.md   requirement -> code -> tests
  /docs/DESIGN_DEVIATIONS.md          unresolved or approved differences
  /docs/CONTENT_SCHEMAS.md             data contracts and examples
  /docs/SEED_FIXTURES.md               deterministic reproduction cases
  /tests/                              unit, integration, property, seed tests
  /content/                            weapons, items, enemies, rooms, bosses
  /tools/                              validators, content browser, debug export
```

## 22.5 Coding rules

- Do not implement mechanics by checking display-name strings.
- Do not place normal item, enemy, or room data directly in switch statements.
- Do not introduce a global singleton for every system; use clear ownership and interfaces.
- Do not use unseeded randomness in gameplay code.
- Do not mix cosmetic RNG with loot or generation RNG.
- Do not let placeholder art determine collision; use authored gameplay bounds.
- Do not mark a requirement complete without a test or explicit manual acceptance evidence.
- Do not optimize by removing mechanical effects. Aggregate presentation instead.
- Do not add settings that let players tune item odds or procedural weights.
- Do not expose hidden endings or undiscovered content through debug labels in release builds.

## 22.6 Definition of done for a feature

| Gate | Required evidence |
| --- | --- |
| Design | Mapped requirement IDs and no unresolved contradiction. |
| Architecture | Uses approved interfaces, data contracts, and scoped RNG. |
| Function | Player-facing behavior matches acceptance criteria. |
| Tests | Unit/integration/property tests and deterministic seed fixture where relevant. |
| Content | Validated data, assets or placeholders, localization IDs, and debug visibility. |
| Performance | No material regression against target budget. |
| Accessibility | Critical cues and settings behavior reviewed. |
| Documentation | Traceability and deviations updated. |

| ID | Rule | Acceptance test |
| --- | --- | --- |
| R-AI-001 | Every implementation plan maps work to GDD requirement IDs. | Plan contains traceable IDs and acceptance criteria. |
| R-AI-002 | AI agents may decompose scope but may not silently rewrite design. | Any deviation is recorded and approved or reverted. |
| R-AI-003 | Generated code includes tests for deterministic and data-driven behavior. | CI exercises seed fixtures and schema validation. |
| R-AI-004 | Placeholder implementations are clearly labeled and cannot masquerade as completed mechanics. | Traceability status distinguishes scaffold, partial, and accepted. |
| R-AI-005 | The agent verifies existing code before editing. | Plan references inspected modules and conventions. |

# 23. Quality Assurance and Acceptance Criteria

## 23.1 Test layers

| Layer | Scope |
| --- | --- |
| Unit | Damage formulas, weight calculations, status timing, adapters, save migration, unlock conditions. |
| Schema | Required fields, unique IDs, references, tags, weights, assets, sockets, room compatibility. |
| Property | Generated floors connected; required rooms unique; no orphan doors; no invalid item candidates. |
| Seed fixture | Known seeds reproduce layouts, item rolls, bosses, secrets, and specific edge cases. |
| Integration | Room lifecycle, weapon/passive graph, boss reward, save/continue, hidden route transitions. |
| Performance | Projectile stress, large rooms, enemy density, effect aggregation, generation time. |
| Visual/readability | Native-scale capture, grayscale, reduced effects, color-vision presets, crowded builds. |
| Playtest | Fairness, learning, pacing, item excitement, run variety, boss comprehension, secret discovery. |

## 23.2 Procedural test suite

1. Generate at least 10,000 floors per normal floor definition in headless validation.
2. Assert connectivity, role counts, dead-end minimums, footprint non-overlap, socket alignment, and critical-path access.
3. Pathfind from each door entry to required room regions for the player movement class.
4. Validate each encounter against room tags, spawn zones, navigation, maximum hostile count, and support-loop exclusions.
5. Validate secret-room blast points and ensure no scenery blocks every eligible entrance.
6. Record regeneration rate and investigate definitions that fail more than the accepted threshold.

## 23.3 Combat test matrix

| Axis | Coverage |
| --- | --- |
| Weapons | Every weapon with no modifiers, core modifiers, incompatible modifiers, and extreme cadence/damage values. |
| Synergies | Required combinations, transformations, modifier ordering, duplicate prevention, performance aggregation. |
| Enemies | Solo behavior, mixed encounter, variant, support relationships, object interaction, death behavior. |
| Bosses | Every phase, low/high damage builds, melee/range weapons, reduced effects, save/continue boundary. |
| Health | All health types, exact lethal hits, buffer depletion, revival, sacrifice, invulnerability. |
| Rooms | Normal, large, narrow, moving geometry, hazards, doors, waves, escape effects. |

## 23.4 Playtest questions

- Could the player explain why they took damage?
- Could they recognize the enemy the next time it appeared?
- Did the item change how the build felt within one or two rooms?
- Did they voluntarily explore after finding the boss?
- Did the shop create a real spending decision?
- Did the floor feel different from prior seeds without feeling arbitrary?
- Did a secret feel discoverable in hindsight?
- Did the player want another run after death?
- Did any office joke become irritating through repetition?

## 23.5 Release gates

| ID | Gate | Pass condition |
| --- | --- | --- |
| R-QA-001 | No soft locks | Automated floor suite and targeted playtests find no unrecoverable normal progression state. |
| R-QA-002 | Determinism | Identical seed, content version, mode, and inputs reproduce required streams. |
| R-QA-003 | Readability | Critical threats remain identifiable under stress and accessibility presets. |
| R-QA-004 | Save integrity | Atomic save, backup recovery, migration, and continue tests pass. |
| R-QA-005 | Content validity | No missing assets, invalid references, duplicate IDs, or zero-weight required pools. |
| R-QA-006 | Performance | Target hardware sustains agreed frame and transition budgets in representative worst cases. |
| R-QA-007 | Hidden content protection | Fresh-save UI and release logs do not reveal undiscovered routes or totals. |

# 24. Release Content Baseline

This is the north-star content target for a complete 1.0, not the order in which development should occur. A production roadmap may reduce or phase content, but architecture must support these counts without redesign.

| Content family | North-star 1.0 target | Defined in this GDD seed catalog |
| --- | --- | --- |
| Core departments | 4 pairs / 8 floors | 4 pairs defined |
| Alternate department pairs | 3 pairs / 6 floors | Finance, Marketing, Legal defined |
| Secret and postgame areas | At least 5 route areas | Facilities, R&D, Board, Parent Company, Conglomerate, Ownership defined |
| Room templates | 350+ architecture templates across sizes and roles | 28 room roles plus object and generation contracts |
| Encounter definitions | 450+ authored or curated compositions | Behavior and composition system defined |
| Weapons | 24+ | 14 defined |
| Passive items | 220+ | 60 defined |
| Active items | 30+ | 15 defined |
| Action Cards | 36+ | 18 defined |
| Supplement effects | 20+ | 14 defined |
| Desk Charms | 50+ | 18 defined |
| Transformations | 12+ | 4 defined |
| Standard enemies | 70+ | 58 defined |
| Bosses and ultra bosses | 30+ | 29 defined |
| Employee profiles | 8+ | 8 defined |
| Challenges | 20+ | System defined; individual challenge database follows production planning |
| Endings | 9+ concealed outcomes | 9 defined |

## 24.1 Content quality threshold

- A new item needs a visible or strategic effect, not merely a microscopic stat delta.
- A new enemy needs a distinct recognition and counterplay reason to exist.
- A new room template needs meaningful geometry, story, object arrangement, or special purpose.
- A new department needs mechanical identity, not a palette swap.
- A new boss needs one memorable core idea and an arena that supports it.
- A new secret needs a clue, rule, or discovery path that feels fair in hindsight.

## 24.2 Content production order

1. Build the complete room, combat, weapon, item, and data architecture with placeholder content.
2. Create one Open Office vertical slice containing several rooms, three enemies, one boss, Keyboard, Mouse, five passives, one active, pickups, shop, supply closet, secret room, and save/seed support.
3. Expand Open Office I-II until the first chapter has production-quality variety.
4. Add IT as the first proof that a new department can be created through data and reusable modules.
5. Complete the base eight-floor route and CEO before deep hidden content.
6. Add alternate departments, profiles, challenge content, and post-CEO hierarchy after the base route is stable.
7. Scale item, room, encounter, and secret catalogs continuously, with automated validation from the beginning.

# 25. Risk Register and Design Safeguards

| Risk | Severity | Failure mode | Safeguard |
| --- | --- | --- | --- |
| Clone perception | Critical | The game is dismissed as an office skin of Isaac. | Create original weapon replacement, department mechanics, corporate content, visual identity, bosses, narrative hierarchy, and room libraries. Never copy expression. |
| Scope explosion | Critical | Hundreds of content pieces and hidden routes overwhelm production. | Use vertical slices, data schemas, content validators, target counts, and phased production. Architecture first, content factory second. |
| Synergy combinatorics | High | Modifiers create bugs, contradictions, and performance failures. | Use attack tags, explicit adapters, overrides, deterministic order, caps, and automated pairwise tests. |
| Procedural soft locks | High | Generated geometry, enemies, or objects block progression. | Run large headless generation suites, navigation validation, watchdogs, and deterministic regeneration. |
| Visual overload | High | Powerful builds hide hostile threats. | Friendly/hostile channels, effect aggregation, priority layers, reduced particles, native-scale review. |
| Early reset farming | Medium | Players restart repeatedly for the 0.10 percent jackpot. | Keep jackpot possible as desired, but sustain meaningful jackpot chances across later item sources and make early rooms fast, not tedious. |
| Liability frustration | Medium | Bad items feel like run-ending traps. | Keep pedestals optional, use a small pool, guarantee recognition after discovery, prohibit soft locks, and include occasional tradeoff value. |
| Content repetition | High | Room and enemy reuse becomes obvious. | Separate architecture and encounters, expand native department pools, use variants sparingly, and monitor seeded repetition. |
| AI implementation drift | High | Generated code invents systems or hardcodes content. | Requirement traceability, data contracts, tests, deviation log, and code review against this GDD. |
| Secret datamining | Medium | Hidden content is discovered in files before play. | Accept that determined players may inspect data; avoid relying on secrecy alone. Use meaningful discovery and consider obfuscated release data only if maintainable. |
| Office joke fatigue | Medium | Theme becomes repetitive or painfully obvious. | Prioritize mechanics, visual storytelling, and specific observations over endless buzzword puns. |
| Balance opacity | Medium | Hidden numbers make tuning and player learning confusing. | Keep internal debug stats excellent, player feedback immediate, and collection descriptions qualitative but accurate. |

## 25.1 Ruthless scope rule

When time is constrained, cut content quantity before cutting systemic integrity. A smaller game with correct room generation, item interactions, save safety, and readable combat can grow. A pile of bespoke rooms and hardcoded items cannot. That pile is not a prototype; it is future archaeology.

# 26. Glossary

| Term | Definition |
| --- | --- |
| Action Card | Known one-use pocket item with a deterministic effect. |
| Active item | Reusable player-triggered collectible with a recharge rule. |
| Adapter | Code or data behavior translating a generic modifier into a weapon archetype. |
| Attack graph | Resolved combination of weapon, passives, transformations, temporary effects, and profile rules. |
| Composure | Refillable core health. |
| Caffeine | Temporary buffer health consumed before Composure. |
| Content definition | Versioned data asset describing an item, weapon, enemy, room, boss, or other content entry. |
| Dead end | Room node with one ordinary graph connection before hidden connections. |
| Department | Chapter/biome identity normally expressed across two floors. |
| Desk Charm | One-slot subtle passive collectible. |
| Door socket | Authored connection point on a room perimeter. |
| Early jackpot | 0.10 percent Floor 1-2 pedestal chance to permit a quality-4 item from the source pool. |
| Encounter | Enemy or wave definition selected independently from room architecture. |
| Floor depth | Ordered progression index used for budgets, gates, and scaling. |
| Footprint | Set of grid cells occupied by one room instance. |
| Hidden math | Internal numeric values communicated to players through qualitative effects and feedback. |
| Liability item | Optional collectible with negative or disruptive behavior, sometimes paired with an upside. |
| Manager Reward | Guaranteed item pedestal created after a floor boss is defeated. |
| Maintenance Access | Primary blast-open secret room. |
| Modifier | Passive item that changes attack behavior through tags and adapters. |
| Pocket slot | Slot holding one Action Card or Supplement by default. |
| Quality | Hidden internal item band from 0 to 4 used for generation and reroll logic. |
| Room architecture | Handcrafted geometry, sockets, collision, objects, and spawn zones independent of encounter. |
| Scoped RNG | Named deterministic random stream isolated from unrelated systems. |
| Set drop | Specific reward generated by a boss, event, machine, or enemy outside ordinary pool selection. |
| Spite | Temporary health that damages hostile enemies when depleted. |
| Supplement | Pocket consumable whose appearance-to-effect mapping is randomized each run until identified. |
| Toner Charge | Limited explosive resource used for combat, objects, and hidden walls. |
| Transformation | Additional named effect and visual state unlocked by collecting a defined set during one run. |
| Weapon | Single-slot collectible defining the primary attack archetype. |

# Appendix A. Department Database

These definitions are route-ready content contracts. Production planning may create additional variants, but it must preserve each identity and escalation rule.

## DPT-001 - Open Office I-II

| Field | Definition |
| --- | --- |
| Route role | Core chapter 1 |
| Visual identity | Cubicles, carpet grids, fluorescent light, meeting rooms, printers, coffee stains. |
| Gameplay identity | Introduces cardinal shooters, chasers, burst movement, cover objects, basic HR debuffs. |
| Boss pool | Team Lead, Copy Chief, Scrum Master, The Open Plan. |
| Escalation | Open Office II increases density, uses more support enemies, and introduces moving cubicle dividers. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-002 - IT I-II

| Field | Definition |
| --- | --- |
| Route role | Core chapter 2 |
| Visual identity | Server racks, cable trays, helpdesk bays, dark cooling aisles, blinking status lights. |
| Gameplay identity | Electric hazards, turrets, shields, teleporting malware, wall-following enemies. |
| Boss pool | Sysadmin, Helpdesk Hydra, Legacy System, Firewall. |
| Escalation | IT II adds power-state changes, chained shock threats, and corrupted room variants. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-003 - Operations I-II

| Field | Definition |
| --- | --- |
| Route role | Core chapter 3 |
| Visual identity | Loading bays, mail rooms, inventory cages, carts, conveyor lanes, shift boards. |
| Gameplay identity | Movement lanes, pushes, charges, object transport, split enemies, time-pressure support units. |
| Boss pool | The Bottleneck, Shift Manager, Supply Chain, Quarter End. |
| Escalation | Operations II uses denser lanes, active machinery, and mixed mobile formations. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-004 - Executive I-II

| Field | Definition |
| --- | --- |
| Route role | Core chapter 4 |
| Visual identity | Thick carpet, glass offices, art, boardrooms, private kitchens, security gates. |
| Gameplay identity | Elite support networks, shields, cloned assistants, expensive hazards, restrictive zones. |
| Boss pool | VP of Everything, Chief Operating Officer, The Boardroom, CEO. |
| Escalation | Executive II is the apparent final floor and culminates in the CEO. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-005 - Finance I-II

| Field | Definition |
| --- | --- |
| Route role | Unlockable alternate chapter 3 |
| Visual identity | Ledger walls, trading screens, vault cages, receipts, coin counters. |
| Gameplay identity | Credit theft, interest timers, armor purchased by enemies, greed-risk rooms. |
| Boss pool | The Auditor, Cash Flow, Budget Committee. |
| Escalation | May replace Operations after unlock; not required for the first completion path. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-006 - Marketing I-II

| Field | Definition |
| --- | --- |
| Route role | Unlockable alternate chapter 3 |
| Visual identity | Studio lights, mood boards, campaign walls, brand colors, fake product sets. |
| Gameplay identity | Decoys, false pickups, mirrored enemies, attention manipulation, temporary clones. |
| Boss pool | Brand Manager, Focus Group, Viral Campaign. |
| Escalation | May replace Operations after unlock; visual trickery must remain fair and telegraphed. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-007 - Legal and Compliance I-II

| Field | Definition |
| --- | --- |
| Route role | Unlockable alternate chapter 4 |
| Visual identity | Document stacks, seal doors, hearing rooms, red tape, archive cages. |
| Gameplay identity | Binding zones, delayed penalties, contract projectiles, shield phases. |
| Boss pool | General Counsel, Red Tape, The Clause. |
| Escalation | May replace Executive I while still leading to Executive II and the CEO. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-008 - Facilities

| Field | Definition |
| --- | --- |
| Route role | Secret branch |
| Visual identity | Maintenance corridors, boiler rooms, janitorial storage, service elevators. |
| Gameplay identity | Environmental hazards, object manipulation, darkness, destructible infrastructure. |
| Boss pool | Head of Facilities, The Leak, Service Elevator. |
| Escalation | Accessed through hidden maintenance routes and used to bypass or alter normal floors. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-009 - Research and Development

| Field | Definition |
| --- | --- |
| Route role | Secret branch |
| Visual identity | Prototype labs, impossible office devices, test chambers, whiteboards full of nonsense. |
| Gameplay identity | Experimental weapons, unstable modifiers, room-rule mutations, high-variance rewards. |
| Boss pool | Prototype Zero, The Patent, Innovation Theater. |
| Escalation | Primary home of the Innovation Lab item pool. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-010 - The Board I-II

| Field | Definition |
| --- | --- |
| Route role | Hidden post-CEO chapter |
| Visual identity | A vast dark boardroom system extending beyond the building footprint. |
| Gameplay identity | Multi-elite encounters, vote mechanics, synchronized patterns, severe resource pressure. |
| Boss pool | The Board, Hostile Takeover. |
| Escalation | The elevator reaches this chapter only after concealed victory conditions are met. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-011 - Parent Company

| Field | Definition |
| --- | --- |
| Route role | Deep hidden chapter |
| Visual identity | A clean, anonymous complex whose branding contradicts the known company. |
| Gameplay identity | Recombinations of earlier department rules with stronger variant enemies and false endings. |
| Boss pool | Parent Company. |
| Escalation | Reveals that the corporation is one subsidiary among many. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-012 - The Conglomerate

| Field | Definition |
| --- | --- |
| Route role | Ultra hidden chapter |
| Visual identity | Impossible stacked offices, merged logos, architecture from multiple companies at once. |
| Gameplay identity | Cross-department hazard combinations, elite bosses as enemies, unstable room topology. |
| Boss pool | The Conglomerate. |
| Escalation | A late mastery route, not advertised in completion UI. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

## DPT-013 - Ownership

| Field | Definition |
| --- | --- |
| Route role | Terminal hidden arena |
| Visual identity | Minimal, luxurious, almost empty space above every known hierarchy. |
| Gameplay identity | Pure pattern mastery with selective echoes of the entire run. |
| Boss pool | The Beneficial Owner. |
| Escalation | Ultimate secret boss and final concealed ending target. |
| Required asset families | Floor and wall set; doors; at least three obstacle families; hazards; normal and large rooms; supply, shop, boss, secret, and event rooms; ambience; music; transition sting. |
| Data dependencies | DepartmentDefinition, two FloorDefinitions where applicable, room and encounter weight sets, boss pool, object variants, item affinities, audio and palette references. |

# Appendix B. Weapon Database

## B.1 Generation registry

| ID | Weapon | Q | Weight | Min floor | Pools |
| --- | --- | --- | --- | --- | --- |
| WPN-001 | Keyboard | 1 | 1.00 | 1 | Supply Closet |
| WPN-002 | Mouse | 2 | 0.85 | 1 | Supply Closet |
| WPN-003 | Big Laser Pointer | 4 | 0.12 | 3 | Supply Closet, Innovation Lab |
| WPN-004 | Stapler | 2 | 0.85 | 1 | Supply Closet, Office Supply Shop |
| WPN-005 | Hole Punch | 2 | 0.85 | 1 | Supply Closet, Office Supply Shop |
| WPN-006 | Marker | 2 | 0.85 | 1 | Supply Closet, Office Supply Shop |
| WPN-007 | Rubber Stamp | 2 | 0.85 | 1 | Supply Closet |
| WPN-008 | Paper Shredder | 3 | 0.45 | 1 | Supply Closet |
| WPN-009 | Presentation Remote | 2 | 0.85 | 1 | Supply Closet, Innovation Lab |
| WPN-010 | Desk Phone | 3 | 0.45 | 1 | Supply Closet, Innovation Lab |
| WPN-011 | Label Maker | 2 | 0.85 | 1 | Supply Closet, Office Supply Shop |
| WPN-012 | Copier | 3 | 0.45 | 1 | Supply Closet |
| WPN-013 | Desk Fan | 3 | 0.45 | 1 | Supply Closet |
| WPN-014 | Projector | 4 | 0.12 | 3 | Supply Closet, Innovation Lab |

## B.2 Behavior definitions

### WPN-001 - Keyboard

| Field | Definition |
| --- | --- |
| Archetype | Projectile / tap fire |
| Core behavior | Fires individual keycaps in the four cardinal directions. Baseline weapon and balance reference. |
| Modifier adapters | Homing keys; eight-direction keys; split, bounce, return, pierce, stick, and duplicate adapters. |
| Rarity / role | Common; starting weapon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-002 - Mouse

| Field | Definition |
| --- | --- |
| Archetype | Melee arc / whip |
| Core behavior | Swings a wired mouse in a short arc. The cable traces the hit area and can strike multiple targets. |
| Modifier adapters | Homing rotates the arc toward a nearby target; Numeric Keypad adds diagonal arc centers; range extends cable; Sticky Keys adds a brief tether. |
| Rarity / role | Uncommon; high control, short reach. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-003 - Big Laser Pointer

| Field | Definition |
| --- | --- |
| Archetype | Continuous beam |
| Core behavior | Projects a sustained presentation beam while the attack input is held. Damage is applied in controlled ticks. |
| Modifier adapters | Pen Laser bends the endpoint toward targets; Numeric Keypad enables diagonal beams; USB Hub forks the beam after first contact. |
| Rarity / role | Rare; visually distinct from the pen-sized modifier. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-004 - Stapler

| Field | Definition |
| --- | --- |
| Archetype | Heavy projectile / cadence |
| Core behavior | Fires slow metal staples with high impact and slight armor penetration. Uses a short rhythmic reload after a burst. |
| Modifier adapters | Rubber Bands ricochet staples; Binder Clip increases pierce; Heavy Keycaps become Heavy Staples through a weapon override. |
| Rarity / role | Common. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-005 - Hole Punch

| Field | Definition |
| --- | --- |
| Archetype | Twin short-range projectile |
| Core behavior | Fires two paper discs with a small gap, strong knockback, and short lifetime. |
| Modifier adapters | Split creates four smaller discs; Backspace returns discs; Highlighter marks both targets when either disc hits. |
| Rarity / role | Common. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-006 - Marker

| Field | Definition |
| --- | --- |
| Archetype | Ink projectile / trail |
| Core behavior | Fires wet marker strokes that leave a short damaging ink line behind their path. |
| Modifier adapters | Correction Fluid changes the trail to slowing whiteout; Pen Laser curves the stroke; Wireless Dongle lets the stroke pass through furniture. |
| Rarity / role | Uncommon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-007 - Rubber Stamp

| Field | Definition |
| --- | --- |
| Archetype | Melee slam / area |
| Core behavior | Slams a rectangular approval stamp in the chosen direction after a short wind-up. |
| Modifier adapters | Numeric Keypad supports diagonal stamps; Confidential Stamp increases full-health impact; Macro Pad repeats a weaker echo stamp. |
| Rarity / role | Uncommon; ignores projectile-only modifiers. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-008 - Paper Shredder

| Field | Definition |
| --- | --- |
| Archetype | Close cone / sustained |
| Core behavior | Sprays paper strips in a noisy short cone. Excellent coverage, weak range, many small hits. |
| Modifier adapters | Toner Dust adds a lingering cloud; USB Hub widens the cone; Binder Clip converts some strips into piercing metal clips. |
| Rarity / role | Rare; effect-budget stress weapon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-009 - Presentation Remote

| Field | Definition |
| --- | --- |
| Archetype | Bouncing pulse |
| Core behavior | Fires a slow click pulse that bounces from room boundaries and obstacles before expiring. |
| Modifier adapters | Rubber Bands adds bounces; Pen Laser steers after each bounce; Ctrl+C creates occasional second pulses. |
| Rarity / role | Uncommon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-010 - Desk Phone

| Field | Definition |
| --- | --- |
| Archetype | Tether / thrown melee |
| Core behavior | Throws a receiver attached by a cord. It damages outbound and returning paths and can wrap around one target. |
| Modifier adapters | Extension Cord lengthens the throw; Pen Laser curves the outbound receiver; Ethernet Cable shocks tethered targets. |
| Rarity / role | Rare. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-011 - Label Maker

| Field | Definition |
| --- | --- |
| Archetype | Charge projectile |
| Core behavior | Charges and fires a sticky label. The label attaches to an enemy, then pops after a delay. |
| Modifier adapters | Sticky Keys increases attachment time and burst; Caps Lock creates a large label; Autocorrect redirects an unclaimed label. |
| Rarity / role | Uncommon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-012 - Copier

| Field | Definition |
| --- | --- |
| Archetype | Charge wave |
| Core behavior | Charges, then launches a broad sheet-shaped wave. The wave is slow, wide, and can push light enemies. |
| Modifier adapters | Pen Laser gently rotates the wave toward a target; Dual Monitors launches paired narrow sheets; Paperweight increases force and damage. |
| Rarity / role | Rare. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-013 - Desk Fan

| Field | Definition |
| --- | --- |
| Archetype | Directional stream |
| Core behavior | Creates a sustained airflow that pushes enemies and redirects light projectiles while dealing low repeated damage. |
| Modifier adapters | Highlighter marks enemies held in the stream; Extension Cord increases reach; Wireless Dongle lets airflow pass through furniture slots. |
| Rarity / role | Rare; defensive control weapon. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

### WPN-014 - Projector

| Field | Definition |
| --- | --- |
| Archetype | Placed area / cone |
| Core behavior | Places a projector at the player position that casts a damaging cone in the chosen direction for a limited duration. |
| Modifier adapters | Numeric Keypad adds diagonal placement angles; Rechargeable Battery increases uptime through active-like charge; Webcam makes the cone reveal cloaked threats. |
| Rarity / role | Very rare; one projector at a time. |
| Required data | Attack timing, damage multiplier, geometry, collision tags, adapter map, animation, audio, VFX, pool membership, quality, weight, min floor, unlock ID. |
| Acceptance | Works unmodified, with Pen Laser Pointer, Numeric Keypad, one multiplicity modifier, one unsupported modifier, save/continue, and extreme cadence stress. |

# Appendix C. Starter Item Database

## C.1 Passive generation registry

| ID | Item | Q | Weight | Min floor | Pools |
| --- | --- | --- | --- | --- | --- |
| ITM-001 | Espresso Shot | 2 | 1.00 | 1 | Supply Closet |
| ITM-002 | Milk Carton | 2 | 1.00 | 1 | Supply Closet, Union Breakroom |
| ITM-003 | Sugar Packets | 2 | 1.00 | 1 | Supply Closet |
| ITM-004 | Mechanical Switches | 2 | 1.00 | 1 | Supply Closet |
| ITM-005 | Heavy Keycaps | 2 | 1.00 | 1 | Supply Closet |
| ITM-006 | Ergonomic Chair | 2 | 1.00 | 1 | Supply Closet |
| ITM-007 | Standing Desk | 2 | 1.00 | 1 | Supply Closet |
| ITM-008 | Blue Light Glasses | 2 | 1.00 | 1 | Supply Closet |
| ITM-009 | Wrist Rest | 2 | 1.00 | 1 | Supply Closet |
| ITM-010 | Dual Monitors | 3 | 0.65 | 1 | Supply Closet, Innovation Lab |
| ITM-011 | Pen Laser Pointer | 3 | 0.65 | 1 | Supply Closet, Innovation Lab |
| ITM-012 | Numeric Keypad | 2 | 1.00 | 1 | Supply Closet, Innovation Lab |
| ITM-013 | USB Hub | 3 | 0.65 | 1 | Supply Closet, Innovation Lab |
| ITM-014 | Wireless Dongle | 2 | 1.00 | 1 | Supply Closet, Innovation Lab |
| ITM-015 | Macro Pad | 3 | 0.65 | 1 | Supply Closet |
| ITM-016 | Sticky Keys | 2 | 1.00 | 1 | Supply Closet |
| ITM-017 | Autocorrect | 2 | 1.00 | 1 | Supply Closet, Innovation Lab |
| ITM-018 | Caps Lock | 2 | 1.00 | 1 | Supply Closet |
| ITM-019 | Shift Key | 2 | 1.00 | 1 | Supply Closet |
| ITM-020 | Space Bar | 2 | 1.00 | 1 | Supply Closet |
| ITM-021 | Backspace | 3 | 0.65 | 1 | Supply Closet, Innovation Lab |
| ITM-022 | Ctrl+C | 3 | 0.65 | 1 | Supply Closet |
| ITM-023 | Rubber Bands | 2 | 1.00 | 1 | Supply Closet |
| ITM-024 | Binder Clip | 2 | 1.00 | 1 | Supply Closet |
| ITM-025 | Ethernet Cable | 2 | 1.00 | 1 | Supply Closet |
| ITM-026 | Extension Cord | 2 | 1.00 | 1 | Supply Closet |
| ITM-027 | Rechargeable Battery | 2 | 1.00 | 1 | Supply Closet, Office Supply Shop |
| ITM-028 | Red Staple Remover | 2 | 1.00 | 1 | Supply Closet |
| ITM-029 | Lucky Paperclip | 2 | 1.00 | 1 | Supply Closet |
| ITM-030 | Whiteboard Eraser | 2 | 1.00 | 1 | Supply Closet, Union Breakroom |
| ITM-031 | Correction Fluid | 2 | 1.00 | 1 | Supply Closet |
| ITM-032 | Highlighter | 2 | 1.00 | 1 | Supply Closet |
| ITM-033 | Paperweight | 2 | 1.00 | 1 | Supply Closet |
| ITM-034 | Printer Ink | 2 | 1.00 | 1 | Supply Closet |
| ITM-035 | Toner Dust | 2 | 1.00 | 1 | Supply Closet |
| ITM-036 | Noise-Canceling Headphones | 2 | 1.00 | 1 | Supply Closet, Union Breakroom |
| ITM-037 | Mini Fridge | 2 | 1.00 | 1 | Supply Closet |
| ITM-038 | Lunchbox | 2 | 1.00 | 1 | Supply Closet |
| ITM-039 | Company Hoodie | 2 | 1.00 | 1 | Supply Closet, Union Breakroom |
| ITM-040 | Visitor Badge | 2 | 1.00 | 1 | Supply Closet, Office Supply Shop |
| ITM-041 | Master Access Badge | 4 | 0.15 | 3 | Supply Closet, Office Supply Shop, Secret Maintenance, Executive Deal |
| ITM-042 | Office Plant | 2 | 1.00 | 1 | Supply Closet, Union Breakroom |
| ITM-043 | Desk Cactus | 2 | 1.00 | 1 | Supply Closet |
| ITM-044 | Stress Ball | 3 | 0.65 | 1 | Supply Closet, Union Breakroom |
| ITM-045 | Company Laptop | 3 | 0.65 | 1 | Supply Closet |
| ITM-046 | Webcam | 2 | 1.00 | 1 | Supply Closet |
| ITM-047 | Confidential Stamp | 2 | 1.00 | 1 | Supply Closet, Secret Maintenance |
| ITM-048 | Calendar Reminder | 2 | 1.00 | 1 | Supply Closet |
| ITM-049 | Reply All | 3 | 0.65 | 1 | Supply Closet, Restricted Records, Executive Deal |
| ITM-050 | Open Calendar | 0 | 0.75 | 1 | Supply Closet, Restricted Records |
| ITM-051 | Wet Keyboard | 0 | 0.75 | 1 | Supply Closet, Restricted Records |
| ITM-052 | Cheap Chair | 1 | 1.00 | 1 | Supply Closet, Restricted Records |
| ITM-053 | Burnout | 1 | 1.00 | 1 | Supply Closet, Restricted Records |
| ITM-054 | Mandatory Training | 0 | 0.75 | 1 | Supply Closet, Restricted Records |
| ITM-055 | Three-Hole Punch | 3 | 0.65 | 1 | Supply Closet, Innovation Lab |
| ITM-056 | Sticky Notes | 2 | 1.00 | 1 | Supply Closet |
| ITM-057 | Red Pen | 2 | 1.00 | 1 | Supply Closet |
| ITM-058 | Spare Keyboard | 4 | 0.15 | 3 | Supply Closet, Secret Maintenance, Executive Deal |
| ITM-059 | Corporate Card | 3 | 0.65 | 1 | Supply Closet, Office Supply Shop |
| ITM-060 | Suggestion Box | 3 | 0.65 | 1 | Supply Closet, Secret Maintenance |

## C.2 Passive behavior registry

| ID / item | Class and pickup phrase | Internal effect | Interaction notes |
| --- | --- | --- | --- |
| ITM-001 Espresso Shot | Stat / cadence; "Typing faster" | Multiply attack interval by 0.88. Play a sharper firing sound and add a tiny hand tremor animation only. | With Milk Carton, activates Latte. |
| ITM-002 Milk Carton | Health; "A little more room to breathe" | Add one full Composure container and heal one full icon. | With Espresso Shot, activates Latte. |
| ITM-003 Sugar Packets | Stat / projectile speed; "Faster keys" | Multiply compatible projectile speed by 1.20 without changing attack interval. | For melee weapons, slightly shortens wind-up instead. |
| ITM-004 Mechanical Switches | Stat / cadence; "Crisper input" | Multiply attack interval by 0.90. Clamp after all interval modifiers. | Keyboard uses a distinct click sample. |
| ITM-005 Heavy Keycaps | Stat / damage; "Heavier work" | Multiply damage by 1.25 and compatible projectile speed by 0.85. | Stapler override changes visuals to heavy staples. |
| ITM-006 Ergonomic Chair | Stat / movement; "Roll with it" | Add 0.45 movement speed and reduce turn friction. | Rolling hazards impart less knockback. |
| ITM-007 Standing Desk | Stat / movement; "Stay on your feet" | Add 0.25 movement speed and reduce stationary enemy targeting accuracy. | Does not stack the targeting benefit. |
| ITM-008 Blue Light Glasses | Range / readability; "See the whole screen" | Multiply range or lifetime by 1.25. Player attacks become slightly transparent where they overlap hostile projectiles. | Beam and melee weapons gain reach. |
| ITM-009 Wrist Rest | Control; "Steadier hands" | Reduce weapon spread by 35 percent and incoming knockback by 30 percent. | Removes Espresso cosmetic tremor but not its benefit. |
| ITM-010 Dual Monitors | Multiplicity; "Two things at once" | Compatible attacks produce a paired pattern. Each copy deals 0.72 base damage. | Beam weapons create two narrow beams; melee weapons create offset arcs. |
| ITM-011 Pen Laser Pointer | Trajectory modifier; "Points to the target" | Adds weapon-specific target seeking through the modifier adapter system. | Keyboard fires homing keys; Mouse arc bends; Big Laser endpoint tracks. Some area weapons receive no effect. |
| ITM-012 Numeric Keypad | Aim modifier; "Corners are fair game" | Enables eight-direction aim for compatible weapons. Input resolves to nearest 45-degree direction. | Keyboard, Mouse, beams, stamps, and placement angles each use explicit adapters. |
| ITM-013 USB Hub | Multiplicity modifier; "More ports" | Compatible attacks split once according to weapon adapter. Secondary attacks deal 55 percent damage. | Cone weapons widen rather than recursively splitting every particle. |
| ITM-014 Wireless Dongle | Collision modifier; "No cables, no walls" | Compatible player attacks ignore the first furniture-class obstacle. Boundary walls and secret walls remain solid. | Does not reveal or open hidden rooms. |
| ITM-015 Macro Pad | Cadence modifier; "Do it again" | Every fifth valid attack repeats after 0.08 seconds at 65 percent damage. | Charge weapons repeat a partial charge; sustained weapons pulse instead. |
| ITM-016 Sticky Keys | Payload modifier; "Make it stick" | Compatible attacks attach briefly, then deal a small delayed pop. Existing sticky weapons gain duration and burst size. | Does not attach to invulnerable scenery. |
| ITM-017 Autocorrect | Trajectory modifier; "Close enough" | A compatible attack that passes near an enemy without hitting may redirect once toward that enemy. | Stacks with Pen Laser by increasing acquisition radius, not steering strength. |
| ITM-018 Caps Lock | Rhythm modifier; "MAKE IT COUNT" | Every eighth attack is larger and deals double damage. Counter persists across rooms but resets on floor transition. | Sustained weapons emit a periodic power tick. |
| ITM-019 Shift Key | Rhythm modifier; "Alternate function" | Attacks alternate between normal and empowered. Empowered attacks deal 35 percent more damage and have a stronger effect color. | Dual attacks share one alternation state. |
| ITM-020 Space Bar | Force modifier; "Give them space" | Increase player attack knockback. Melee and area weapons gain stronger displacement. | Boss displacement remains capped. |
| ITM-021 Backspace | Trajectory modifier; "Take it back" | Compatible attacks return toward the player after reaching their range limit. Returning attacks can hit again at 60 percent damage. | Mouse and Desk Phone instead return faster and gain a second-path bonus. |
| ITM-022 Ctrl+C | Proc / multiplicity; "Copy that" | Each attack event has an 18 percent chance to duplicate after all normal pattern creation. | Copy uses scoped RNG. Copies do not recursively copy themselves. |
| ITM-023 Rubber Bands | Bounce modifier; "Rebound" | Compatible projectiles gain two wall or obstacle bounces. | Staples ricochet with a sharper angle; Presentation Remote gains three instead of two. |
| ITM-024 Binder Clip | Pierce modifier; "Hold it together" | Compatible attacks gain one pierce and lose 10 percent speed. | Paper Shredder converts a controlled subset of strips to piercing clips. |
| ITM-025 Ethernet Cable | Payload / shock; "Stay connected" | Hits chain a 45 percent damage shock to one nearby enemy. Cooldown prevents repeated chains from the same attack tick. | Desk Phone shocks tethered targets continuously at a limited rate. |
| ITM-026 Extension Cord | Range modifier; "Reach farther" | Increase range, tether length, cone reach, or melee reach by 30 percent through weapon adapter. | Does not increase room-boundary beam clipping. |
| ITM-027 Rechargeable Battery | Active support; "Keeps going" | Increase active charge capacity by one and improve battery pickup weight modestly. | Actives with time cooldowns gain 12 percent faster recharge instead. |
| ITM-028 Red Staple Remover | Armor modifier; "Find the weak point" | Player damage ignores 25 percent of tagged armor and shield reduction. | Does not bypass invulnerability phases. |
| ITM-029 Lucky Paperclip | Familiar / defense; "A little luck" | Creates one orbiting paperclip that blocks one hostile projectile, then reforms after four cleared rooms. | Additional copies add orbitals up to three. |
| ITM-030 Whiteboard Eraser | Defense / proc; "Clear the board" | Near-miss hostile projectiles have a luck-scaled chance to be erased when crossing a short radius around the player. | Never erases boss-critical scripted objects. |
| ITM-031 Correction Fluid | Status modifier; "Slow the process" | Compatible damage has a 15 percent chance to apply Slow for 2.5 seconds. | Marker trails become white slowing trails with lower direct damage. |
| ITM-032 Highlighter | Status modifier; "Mark the important parts" | The first hit marks an enemy for four seconds. Marked enemies take 15 percent more player damage. | Refreshing does not stack magnitude. |
| ITM-033 Paperweight | Stat / force; "Heavy argument" | Multiply damage by 1.30, multiply attack interval by 1.12, and increase knockback. | Copier sheets become denser and slower. |
| ITM-034 Printer Ink | Projectile size; "Bolder print" | Increase compatible attack size by 25 percent and damage by 10 percent; reduce range by 8 percent. | Marker trails become wider. |
| ITM-035 Toner Dust | Hazard modifier; "Leave a mess" | Destroyed player projectiles have a 20 percent chance to leave a brief damaging dust patch. | Paper Shredder creates fewer, larger patches to protect performance. |
| ITM-036 Noise-Canceling Headphones | Defense; "Block out the noise" | Reduce explosion damage by 25 percent and prevent aim-wobble effects. | Audio remains readable; the item does not literally mute danger cues. |
| ITM-037 Mini Fridge | Pickup modifier; "Keep something for later" | Increase health pickup weight after combat and preserve one excess half-heal as a small floor-start heal. | Cannot store more than one half-unit. |
| ITM-038 Lunchbox | Floor reward; "Packed and ready" | Spawn one weighted pickup in the start room of each new floor. | Can spawn credits, Access Cards, Toner Charges, or health; never a pedestal item. |
| ITM-039 Company Hoodie | Buffer health; "Comfortably protected" | Grant one full Caffeine icon. | Additional copies grant another icon up to the buffer cap. |
| ITM-040 Visitor Badge | Access utility; "Act like you belong" | The first standard Access Card door opened on each floor costs zero cards. | Does not open double-card, executive, or secret locks. |
| ITM-041 Master Access Badge | Access utility / quality 4; "Every door knows you" | Standard single-card doors cost zero for the rest of the run. | Does not open manager seals, hidden walls, or story locks. |
| ITM-042 Office Plant | Sustain; "Still alive somehow" | After a hostile room clear, 5 percent chance to heal one half Composure if damaged. | Chance increases slightly with luck; capped. |
| ITM-043 Desk Cactus | Contact offense; "Do not touch" | Deal contact damage to enemies and reduce contact damage received by 15 percent. | Does not protect against projectiles. |
| ITM-044 Stress Ball | Damage buffer; "Squeeze through it" | The first normal hit on each floor is reduced by one half-unit, minimum zero. | Sacrifice and self-damage ignore the reduction. |
| ITM-045 Company Laptop | Familiar; "Work follows you home" | A small laptop familiar follows and fires weak keys in the player attack direction at a slower cadence. | Inherits trajectory modifiers but not multiplicity by default. |
| ITM-046 Webcam | Information / familiar; "Keep an eye on things" | Reveal adjacent normal and special room categories after entering a room. Does not reveal secret rooms. | Projector weapon reveals cloaked enemies in its cone. |
| ITM-047 Confidential Stamp | Critical / secret; "For authorized eyes only" | Deal 25 percent more damage to enemies at full health. Slightly improves rare Secret Maintenance item weights. | Rubber Stamp weapon gains a special red impact visual. |
| ITM-048 Calendar Reminder | Map utility; "Do not miss the meeting" | Reveal the boss-room icon and elevator direction on each floor. | Does not reveal the path between rooms. |
| ITM-049 Reply All | Liability / chaos; "Everyone is included" | Duplicate every player projectile at 45 percent damage and every enemy projectile at full damage. Melee and beam weapons gain a weaker echo while enemy patterns still duplicate. | Powerful but dangerous; red liability frame. |
| ITM-050 Open Calendar | Liability / reward; "No free time" | Enemy attack cooldowns are 15 percent shorter. Hostile room clear reward chance is 15 percentage points higher. | Boss phase timers are not shortened unless explicitly tagged. |
| ITM-051 Wet Keyboard | Liability; "This cannot be good" | Multiply attack interval by 1.25. Player shock effects deal 30 percent more damage. | A rare drying event or replacement weapon can reduce the pain, but the passive remains in the collection. |
| ITM-052 Cheap Chair | Tradeoff; "Stable, technically" | Reduce move speed by 0.35, grant knockback immunity, and reduce contact damage by 25 percent. | Visual wobble sells the joke without affecting input. |
| ITM-053 Burnout | Tradeoff; "Nothing left to lose" | Remove one full Composure container. Damage scales from +15 to +55 percent as total health decreases. | Cannot reduce maximum Composure below one full icon. |
| ITM-054 Mandatory Training | Liability / delayed reward; "Attendance required" | Disable active-item use for the first three hostile clears of each floor. After the third clear, grant a floor-long 12 percent damage increase. | Charge still accumulates while disabled. |
| ITM-055 Three-Hole Punch | Multiplicity modifier; "Make room for three" | Compatible single attacks become a three-shot narrow spread at 62 percent damage each. | Overrides Dual Monitors pattern; the stronger pattern is not multiplied again. |
| ITM-056 Sticky Notes | Familiar / offense; "Do not forget" | Three notes orbit loosely and launch at nearby enemies one at a time, reforming after room clear. | Trajectory modifiers apply after launch. |
| ITM-057 Red Pen | Critical; "Needs revision" | Hits have a 10 percent chance to deal double damage. Chance increases modestly against Marked enemies. | Critical text is never shown as a number in normal HUD. |
| ITM-058 Spare Keyboard | Extra life; "Always keep a backup" | On fatal damage, revive once at one full Composure icon, replace current weapon with Keyboard, and destroy this item. | Revival occurs before run-end persistence. |
| ITM-059 Corporate Card | Economy; "Put it on expenses" | Shop items may be purchased with a temporary debt balance up to 15 credits. Future credit pickups pay debt first. | Debt does not persist between runs. |
| ITM-060 Suggestion Box | Reroll support; "Someone might listen" | The first uncollected pedestal item left on each floor is rerolled once when the player exits and re-enters its room. | Uses the same item pool and cannot reroll into the same item. |

## C.3 Active items

| ID / active | Recharge | Pickup phrase | Effect |
| --- | --- | --- | --- |
| ACT-001 Task Manager | 6 rooms | End the process | Instantly defeats non-boss enemies below 25 percent health. Deals a fixed burst to bosses and elites. |
| ACT-002 Print Screen | 6 rooms | Freeze the frame | Freezes enemies and hostile projectiles for 3 seconds. Player attacks remain active. |
| ACT-003 Ctrl+Z | 12 rooms | Undo the mistake | Rewinds player health, position, enemies, and projectiles to room-entry state. Collected pickups, purchases, and item swaps are not restored or duplicated. |
| ACT-004 Out of Office | 6 rooms | Not available | Grants 5 seconds of invulnerability and lets the player pass through normal enemies. Boss contact still blocks movement. |
| ACT-005 Emergency Coffee Pot | 4 rooms | Fresh batch | Grants a strong temporary cadence and move-speed increase for the current room. |
| ACT-006 Meeting Invite | 4 rooms | Everyone to the center | Pulls movable enemies toward the room center, interrupts light actions, and briefly roots them. |
| ACT-007 Power Cycle | 8 rooms | Turn it off and on | Resets enemy non-boss AI states, removes their temporary buffs, and disables machine hazards for 5 seconds. |
| ACT-008 Shredder Bin | No room charge; fed items | Nothing goes to waste | Consumes one floor pickup or pedestal offered directly to it and grants a data-defined temporary or permanent benefit based on category. |
| ACT-009 Fire Extinguisher | 3 rooms | Clear a path | Fires a forceful cone that extinguishes hazards, pushes enemies, and erases light hostile projectiles. |
| ACT-010 Red Phone | 8 rooms | Escalate immediately | Calls a heavy strike on the nearest boss or elite; in normal rooms it targets the highest-cost enemy. |
| ACT-011 Expense Report | Variable credits | Convert the budget | Spend up to 10 credits to gain a room-long damage increase proportional to the amount spent. |
| ACT-012 Copier Jam | 5 rooms | Make a barrier | Spawns temporary copier-cover objects in a valid pattern. They block projectiles and break after taking damage. |
| ACT-013 Floor Plan | 6 rooms | Know the layout | Reveals the current floor map, non-secret special-room categories, and unexplored reachable branches. |
| ACT-014 Performance Improvement Plan | 8 rooms | Under review | Marks all enemies. Marked enemies become faster but drop a guaranteed clear reward when the room is completed. |
| ACT-015 Desk Bell | 2 rooms | Next | Taunts enemies toward the player and grants a brief damage bonus against enemies moving toward the player. |

## C.4 Action Cards

| ID / card | Effect |
| --- | --- |
| CARD-001 Meeting Canceled | Return to the floor start room immediately. |
| CARD-002 Company-Wide Email | Deal heavy damage to all hostile enemies in the current room. |
| CARD-003 Sick Day | Restore all empty Composure in existing containers and grant brief invulnerability. |
| CARD-004 Approved Overtime | Increase damage and cadence for the current room. |
| CARD-005 Expense Approved | Spawn a weighted burst of credits. |
| CARD-006 Budget Freeze | Slow enemies and hostile projectiles for the current room. |
| CARD-007 Reorganization | Reroll uncollected pickups, shop stock, and pedestal items in the current room from their original pools. |
| CARD-008 Calendar Block | Grant eight seconds of invulnerability without allowing door bypass. |
| CARD-009 Access Granted | Open all standard locked doors connected to the current room. |
| CARD-010 All Hands | Charm normal enemies briefly. Bosses are slowed instead. |
| CARD-011 Performance Review | Reveal the boss room and all mini-boss rooms on the current floor. |
| CARD-012 Remote Day | Grant flight over floor hazards and furniture for the current room. |
| CARD-013 Hard Deadline | Reveal the shortest known route to the boss and increase speed until the player enters it. |
| CARD-014 Return to Sender | Reflect hostile projectiles for three seconds. |
| CARD-015 Escalation | Spawn an optional mini-boss. Victory grants an item or premium pickup; the card cannot be used in boss rooms. |
| CARD-016 Meeting Minutes | Repeat the last Action Card effect used in the current run, excluding Meeting Minutes. |
| CARD-017 Desk Move | Teleport to a random previously cleared normal room on the current floor. |
| CARD-018 Quarter-End | Convert the current normal room into a timed wave challenge with a premium reward. |

## C.5 Supplements

| ID / effect | Internal result | Identified message |
| --- | --- | --- |
| SUP-001 Focus Up | Permanently improve attack cadence slightly. | Typing faster |
| SUP-002 Focus Down | Permanently worsen attack cadence slightly. | Slower hands |
| SUP-003 Energy Up | Permanently improve move speed slightly. | More energy |
| SUP-004 Energy Crash | Permanently reduce move speed slightly. | Sudden crash |
| SUP-005 Heavy Dose | Permanently improve damage slightly. | Hits harder |
| SUP-006 Numb Hands | Permanently reduce damage slightly. | Weak grip |
| SUP-007 Clear Eyes | Permanently improve range or reach. | Can see farther |
| SUP-008 Dry Eyes | Permanently reduce range or reach. | Everything feels closer |
| SUP-009 Full Recovery | Restore all Composure in existing containers. | Feeling normal |
| SUP-010 Bad Reaction | Deal one full icon of damage; if this would kill the player, reduce health to one half-unit instead. | Bad reaction |
| SUP-011 Telework | Teleport to a random room, with a tiny chance to enter the 13th Floor error room. | Working elsewhere |
| SUP-012 Adrenaline | Grant strong room-long damage and speed, then brief Slow when it ends. | Too much energy |
| SUP-013 Placebo | Repeat the last identified positive Supplement effect. If none exists, do nothing. | Seems familiar |
| SUP-014 Mystery Snack | Spawn a random pickup and apply one short random status, positive or negative. | Questionable choice |

## C.6 Desk Charms

| ID / charm | Effect |
| --- | --- |
| CHR-001 Coffee Sleeve | Caffeine pickups have a small chance to grant one extra half-unit. |
| CHR-002 Bent Keycard | A spent Access Card has a 12 percent chance to be retained. |
| CHR-003 USB Cap | Battery pickups add a small overflow charge that persists until used. |
| CHR-004 Red Pushpin | Player attacks deal slightly more damage to Marked enemies. |
| CHR-005 Tiny Plant | The first health pickup on each floor heals one extra half-unit if possible. |
| CHR-006 Meeting Token | Mini-boss rooms are slightly more likely and give improved pickup rewards. |
| CHR-007 Rubber Foot | Reduce sliding from spills and conveyor hazards. |
| CHR-008 Cracked Screen Protector | The first projectile hit in a boss room deals one half-unit less damage, then the charm goes dormant until next floor. |
| CHR-009 Frayed Cable | Shock chains travel farther but deal slightly less damage. |
| CHR-010 Spare Button | Every 20th attack event produces a small extra shot. |
| CHR-011 Mini Calendar | Challenge-room doors appear on the map after the supply closet is found. |
| CHR-012 Nameplate | Shop prices have a small chance to be discounted when first seen. |
| CHR-013 Transit Pass | Elevator transitions grant a short speed boost in the next floor start room. |
| CHR-014 Employee of the Month Pin | Bosses drop a few extra credits if defeated without player damage. |
| CHR-015 Paper Star | Rare room-clear rewards are slightly more likely. |
| CHR-016 Old Password | Secret Maintenance doors require slightly less precise blast placement to open. |
| CHR-017 Snack Wrapper | Vending machines are more likely to pay out before breaking. |
| CHR-018 Lucky Lanyard | A floor with no Access Card drop guarantees one after enough hostile clears. |

## C.7 Transformations

| ID / transformation | Condition | Additional effect |
| --- | --- | --- |
| TRN-001 Latte | Espresso Shot + Milk Carton | Retains both base effects, removes cadence-related accuracy penalties from future coffee items, and grants a small move-speed increase. The player gains a visible foam-topped cup accessory. |
| TRN-002 Power User | Any three of Mechanical Switches, Macro Pad, Numeric Keypad, USB Hub, Wireless Dongle, Rechargeable Battery | Compatible modifiers gain slightly stronger adapter values and the player gains a subtle keyboard shortcut aura. |
| TRN-003 Paper Trail | Any three of Sticky Notes, Binder Clip, Lucky Paperclip, Paperweight, Printer Ink, Toner Dust | Destroyed player attacks create a short paper trail that lightly damages enemies. Effect count is aggregated for performance. |
| TRN-004 Middle Management | Any three management-tag items or manager set drops | A tiny assistant familiar collects nearby pickups and grants a temporary damage bonus after boss kills. Visual joke, not a reputation system. |

# Appendix D. Enemy Database

Cost values below are initial encounter-budget estimates, not player-facing stats. Production tuning may change them without changing behavior identity.

## D.1 Encounter registry

| ID | Enemy | Home | Cost | Behavior tags |
| --- | --- | --- | --- | --- |
| ENM-001 | Office Drone | Open Office | 1.0 | Chaser |
| ENM-002 | Desk Shooter | Open Office | 1.0 | Stationary cardinal burst |
| ENM-003 | Paper Pusher | Open Office | 1.0 | Mobile shooter |
| ENM-004 | Coffee Sprinter | Open Office | 1.0 | Burst mover |
| ENM-005 | Nervous Intern | Open Office | 1.0 | Coward shooter |
| ENM-006 | Rolling Chair Rider | Open Office | 1.7 | Charger |
| ENM-007 | Team Player | Open Office | 2.6 | Support buffer |
| ENM-008 | HR Representative | Cross-department | 1.0 | Debuffer |
| ENM-009 | Meeting Cluster | Open Office | 1.0 | Orbiting swarm |
| ENM-010 | Burned-Out Drone | Open Office | 2.9 | Tank / splitter |
| ENM-011 | Cubicle Camper | Open Office | 1.0 | Cover peeker |
| ENM-012 | Reply Guy | Open Office | 1.0 | Reactive copier |
| ENM-013 | Cable Snake | IT | 1.0 | Wall follower |
| ENM-014 | Printer Beast | IT | 1.0 | Stationary spread |
| ENM-015 | Ticket Bot | IT | 1.0 | Chaser shooter |
| ENM-016 | Firewall Node | IT | 4.2 | Shield support |
| ENM-017 | Malware Pop-up | IT | 2.2 | Teleporter / duplicate |
| ENM-018 | Server Rack Turret | IT | 1.0 | Four-way turret |
| ENM-019 | Helpdesk Agent | IT | 2.6 | Healer |
| ENM-020 | Cursor | IT | 2.2 | Predictive dash |
| ENM-021 | Blue Screen | IT | 1.6 | Death hazard |
| ENM-022 | Remote Worker | IT | 2.2 | Edge teleporter |
| ENM-023 | Patch Tuesday | IT | 1.0 | Periodic room modifier |
| ENM-024 | Spam Filter | IT | 2.0 | Projectile blocker |
| ENM-025 | Courier | Operations | 2.2 | Predictive burst |
| ENM-026 | Forklift Clerk | Operations | 1.7 | Heavy charger |
| ENM-027 | Conveyor Gremlin | Operations | 1.0 | Lane skirmisher |
| ENM-028 | Inventory Swarm | Operations | 1.0 | Small swarm |
| ENM-029 | Bottleneck | Operations | 1.0 | Path blocker |
| ENM-030 | Shift Lead | Operations | 4.4 | Summoner / support |
| ENM-031 | Pallet Mimic | Operations | 1.8 | Object mimic |
| ENM-032 | Safety Officer | Operations | 2.2 | Zone controller |
| ENM-033 | Temp Worker | Operations | 1.8 | Splitter |
| ENM-034 | Overtime Zombie | Operations | 1.0 | Escalating chaser |
| ENM-035 | Cart Train | Operations | 2.2 | Linked segments |
| ENM-036 | Labeler | Operations | 1.0 | Delayed mark shooter |
| ENM-037 | Executive Assistant | Executive | 3.6 | Shield escort |
| ENM-038 | Compliance Officer | Executive / Legal | 1.0 | Invulnerability cycle |
| ENM-039 | Consultant | Executive | 2.8 | Player-pattern mimic |
| ENM-040 | Middle Manager | Cross-department | 1.0 | Buff and retreat |
| ENM-041 | Security Guard | Executive | 2.0 | Cone scan / charge |
| ENM-042 | Legal Eagle | Executive / Legal | 1.0 | Tether shooter |
| ENM-043 | Board Member | Executive / Board | 1.0 | Rotating pattern |
| ENM-044 | Expense Ghost | Executive / Finance | 1.0 | Resource thief |
| ENM-045 | Golden Drone | Executive | 2.0 | Elite chaser |
| ENM-046 | HR Business Partner | Cross-department | 2.4 | Room rule debuffer |
| ENM-047 | Auditor | Finance | 1.0 | Counter / punish |
| ENM-048 | Collector | Finance | 1.0 | Debt chaser |
| ENM-049 | Brand Double | Marketing | 1.0 | Decoy |
| ENM-050 | Focus Tester | Marketing | 1.0 | Attention controller |
| ENM-051 | Red Tape Roll | Legal | 1.0 | Growing obstacle |
| ENM-052 | Clause | Legal | 1.0 | Conditional attacker |
| ENM-053 | Janitor | Facilities | 1.0 | Hazard manipulator |
| ENM-054 | The Leak | Facilities | 1.0 | Spawned hazard entity |
| ENM-055 | Prototype | R&D | 1.0 | Unstable behavior |
| ENM-056 | Archive Shade | Secret / Records | 1.0 | Phase ambusher |
| ENM-057 | Shareholder Eye | Board / hidden | 2.0 | Tracking turret |
| ENM-058 | Merger Abomination | Conglomerate | 2.0 | Composite elite |

## D.2 Behavior definitions

### ENM-001 - Office Drone

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Chaser |
| Attack and movement | Walks directly toward the player at constant speed. No ranged attack. Core movement-reading enemy. |
| Approved variants | Larger veteran; faster caffeinated; armored executive variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-002 - Desk Shooter

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Stationary cardinal burst |
| Attack and movement | Anchored behind a desk and fires three straight paper shots with a clear pause between bursts. |
| Approved variants | Diagonal late variant; rotating four-way elite. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-003 - Paper Pusher

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Mobile shooter |
| Attack and movement | Pushes a small copier while moving laterally and throws paper in the player direction. |
| Approved variants | Jammed version leaves paper piles; large version fires a spread. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-004 - Coffee Sprinter

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Burst mover |
| Attack and movement | Stops, shakes, then dashes in a vector toward the player current or lightly predicted position. |
| Approved variants | Double-dash elite; spills coffee on death. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-005 - Nervous Intern

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Coward shooter |
| Attack and movement | Runs away from the player and throws weak office supplies when cornered. |
| Approved variants | Drops a pickup and flees faster; panicked version throws in a fan. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-006 - Rolling Chair Rider

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Charger |
| Attack and movement | Lines up, locks direction, and charges across the room until collision. |
| Approved variants | Bounces once; armored chair variant breaks cubicle dividers. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-007 - Team Player

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Support buffer |
| Attack and movement | Stays near allies and increases their movement or attack cadence. Weak alone. |
| Approved variants | Senior version buffs two attributes; elite creates a meeting aura. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-008 - HR Representative

| Field | Definition |
| --- | --- |
| Home / continuity | Cross-department |
| Behavior archetype | Debuffer |
| Attack and movement | Fires slow policy folders that reduce player move speed or active availability for a brief, clearly shown duration. |
| Approved variants | Business Partner elite locks one door until defeated. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-009 - Meeting Cluster

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Orbiting swarm |
| Attack and movement | Several employees rotate around an empty center point and periodically break formation toward the player. |
| Approved variants | Larger cluster; cluster with a Team Player center. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-010 - Burned-Out Drone

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Tank / splitter |
| Attack and movement | Moves slowly, absorbs damage, then collapses into two aggressive smaller Exhausted Thoughts. |
| Approved variants | Explosive deadline variant; armored variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-011 - Cubicle Camper

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Cover peeker |
| Attack and movement | Hides behind a cubicle divider, peeks to fire, and relocates when cover is destroyed. |
| Approved variants | Two-shot senior; decoy cubicle variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-012 - Reply Guy

| Field | Definition |
| --- | --- |
| Home / continuity | Open Office |
| Behavior archetype | Reactive copier |
| Attack and movement | Repeats the last simple projectile pattern fired by another nearby enemy after a short delay. |
| Approved variants | Elite can repeat boss-add patterns but never boss-unique attacks. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-013 - Cable Snake

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Wall follower |
| Attack and movement | Moves along walls and furniture edges, leaving a short electrified trail. |
| Approved variants | Branching twin; invisible-until-close corrupted version. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-014 - Printer Beast

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Stationary spread |
| Attack and movement | Winds up loudly, then fires a fan of paper and spits a Paper Pile obstacle. |
| Approved variants | Laser-printer straight beam variant; color-printer status shots. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-015 - Ticket Bot

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Chaser shooter |
| Attack and movement | Pursues at medium speed and fires single ticket projectiles at intervals. |
| Approved variants | Escalated ticket splits; overdue version accelerates over time. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-016 - Firewall Node

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Shield support |
| Attack and movement | Projects a visible shield line or bubble onto nearby allies. Cannot shield another Firewall Node. |
| Approved variants | Mobile node; rotating shield arc. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-017 - Malware Pop-up

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Teleporter / duplicate |
| Attack and movement | Appears near room edges, flashes a warning, fires, and relocates. May create one harmless visual decoy. |
| Approved variants | Elite creates a damaging decoy; adware swarm variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-018 - Server Rack Turret

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Four-way turret |
| Attack and movement | Stationary rack fires on cardinal lanes in a repeating clock pattern. |
| Approved variants | Eight-way late version; shielded powered version. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-019 - Helpdesk Agent

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Healer |
| Attack and movement | Channels a visible repair beam to a damaged ally. Breaks channel when threatened. |
| Approved variants | Senior agent repairs shields; cannot heal bosses beyond add-specific caps. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-020 - Cursor

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Predictive dash |
| Attack and movement | A large cursor icon traces the player velocity, marks a destination, then snaps there and damages along the path. |
| Approved variants | Double-click variant performs two snaps. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-021 - Blue Screen

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Death hazard |
| Attack and movement | Moves slowly and emits weak pulses. On death, creates a delayed shock burst and briefly disables nearby machines. |
| Approved variants | Corrupted version spawns Malware Pop-ups. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-022 - Remote Worker

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Edge teleporter |
| Attack and movement | Fires from one room edge, fades, and appears on a different edge. Teleport target is shown by a status icon. |
| Approved variants | Two-shot version; laptop familiar remains briefly after death. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-023 - Patch Tuesday

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Periodic room modifier |
| Attack and movement | Slowly patrols and periodically changes a tagged machine or hazard between powered states. |
| Approved variants | Emergency patch also repairs one ally. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-024 - Spam Filter

| Field | Definition |
| --- | --- |
| Home / continuity | IT |
| Behavior archetype | Projectile blocker |
| Attack and movement | Moves between the player and ranged allies, absorbing low-priority player projectiles until overloaded. |
| Approved variants | Reflecting elite returns one shot after overload. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-025 - Courier

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Predictive burst |
| Attack and movement | Carries a parcel, pauses, then sprints toward the player predicted position and drops the parcel as an obstacle. |
| Approved variants | Explosive parcel; multiple-delivery version. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-026 - Forklift Clerk

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Heavy charger |
| Attack and movement | Slowly lines up, then charges while pushing movable objects and light enemies. |
| Approved variants | Armored forklift; reversing second charge. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-027 - Conveyor Gremlin

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Lane skirmisher |
| Attack and movement | Moves quickly along conveyor directions and throws bolts sideways. |
| Approved variants | Can reverse conveyor; paired version changes lanes together. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-028 - Inventory Swarm

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Small swarm |
| Attack and movement | Several animated boxes hop toward the player with simple staggered timing. |
| Approved variants | Fragile large swarm; barcode-marked variant drops credits. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-029 - Bottleneck

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Path blocker |
| Attack and movement | Deploys temporary barrier pallets that narrow routes, then retreats behind them. |
| Approved variants | Elite creates two barriers; barriers may contain pickups. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-030 - Shift Lead

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Summoner / support |
| Attack and movement | Calls one low-cost Operations enemy from a marked entry point and buffs nearby workers. |
| Approved variants | Night Shift variant summons faster but is frailer. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-031 - Pallet Mimic

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Object mimic |
| Attack and movement | Appears as a normal pallet until approached or attacked, then unfolds and charges. |
| Approved variants | Loot mimic drops a container; explosive mimic. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-032 - Safety Officer

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Zone controller |
| Attack and movement | Projects striped no-go zones that activate after a warning and deal damage or Slow. |
| Approved variants | Elite moves zones; cannot fully seal all exits. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-033 - Temp Worker

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Splitter |
| Attack and movement | Runs erratically and breaks into two smaller contract workers when killed. |
| Approved variants | Explosive contract version; one-life elite does not split but is stronger. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-034 - Overtime Zombie

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Escalating chaser |
| Attack and movement | Starts slow and becomes faster the longer the room remains uncleared. |
| Approved variants | Armored clock-in version; speed resets when stunned. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-035 - Cart Train

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Linked segments |
| Attack and movement | A lead cart follows a route while trailing carts deal contact damage. Destroyed segments change its turning behavior. |
| Approved variants | Long train; supply cart drops pickups. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-036 - Labeler

| Field | Definition |
| --- | --- |
| Home / continuity | Operations |
| Behavior archetype | Delayed mark shooter |
| Attack and movement | Fires labels that stick to the floor or player location and detonate after a readable delay. |
| Approved variants | Tracking label; multi-label spread. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-037 - Executive Assistant

| Field | Definition |
| --- | --- |
| Home / continuity | Executive |
| Behavior archetype | Shield escort |
| Attack and movement | Follows a high-cost ally and intercepts shots with a briefcase shield, then counterattacks. |
| Approved variants | Two-assistant formation; golden elite. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-038 - Compliance Officer

| Field | Definition |
| --- | --- |
| Home / continuity | Executive / Legal |
| Behavior archetype | Invulnerability cycle |
| Attack and movement | Files paperwork behind a shield, then lowers it to fire a strict cardinal pattern. |
| Approved variants | Red Tape variant links to another officer. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-039 - Consultant

| Field | Definition |
| --- | --- |
| Home / continuity | Executive |
| Behavior archetype | Player-pattern mimic |
| Attack and movement | Observes the player primary attack briefly, then fires a simplified hostile version with a clear color and delay. |
| Approved variants | Senior consultant stores two patterns but uses one at a time. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-040 - Middle Manager

| Field | Definition |
| --- | --- |
| Home / continuity | Cross-department |
| Behavior archetype | Buff and retreat |
| Attack and movement | Boosts nearby enemies, retreats from the player, and throws weak buzzword projectiles. |
| Approved variants | Regional version buffs variants; demoted version becomes a chaser when alone. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-041 - Security Guard

| Field | Definition |
| --- | --- |
| Home / continuity | Executive |
| Behavior archetype | Cone scan / charge |
| Attack and movement | Sweeps a visible vision cone. If the player is detected when the sweep ends, charges or fires a stun shot. |
| Approved variants | Armored guard; rotating scanner variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-042 - Legal Eagle

| Field | Definition |
| --- | --- |
| Home / continuity | Executive / Legal |
| Behavior archetype | Tether shooter |
| Attack and movement | Fires contract pages that tether the player to a point or enemy until broken by movement or damage. |
| Approved variants | Double-clause elite creates two shorter tethers. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-043 - Board Member

| Field | Definition |
| --- | --- |
| Home / continuity | Executive / Board |
| Behavior archetype | Rotating pattern |
| Attack and movement | Sits stationary and rotates a deliberate projectile pattern around the chair. |
| Approved variants | Voting pair synchronize patterns; standing elite relocates. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-044 - Expense Ghost

| Field | Definition |
| --- | --- |
| Home / continuity | Executive / Finance |
| Behavior archetype | Resource thief |
| Attack and movement | Floats through furniture and steals credits on contact, dropping them when killed. |
| Approved variants | Interest version grows stronger while holding credits. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-045 - Golden Drone

| Field | Definition |
| --- | --- |
| Home / continuity | Executive |
| Behavior archetype | Elite chaser |
| Attack and movement | Fast, armored Office Drone with a guaranteed premium pickup chance. |
| Approved variants | Rare continuity enemy, never common enough to replace new content. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-046 - HR Business Partner

| Field | Definition |
| --- | --- |
| Home / continuity | Cross-department |
| Behavior archetype | Room rule debuffer |
| Attack and movement | Applies one clearly displayed policy to the room, such as slower active recharge or reduced pickup attraction, until defeated. |
| Approved variants | Only one policy enemy per normal room. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-047 - Auditor

| Field | Definition |
| --- | --- |
| Home / continuity | Finance |
| Behavior archetype | Counter / punish |
| Attack and movement | Marks a credit or pickup and fires when the player collects it, with a visible audit line. |
| Approved variants | Senior auditor marks two resources. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-048 - Collector

| Field | Definition |
| --- | --- |
| Home / continuity | Finance |
| Behavior archetype | Debt chaser |
| Attack and movement | Grows faster for each credit the player carries and drops a portion of stolen credits on death. |
| Approved variants | Armored high-balance version. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-049 - Brand Double

| Field | Definition |
| --- | --- |
| Home / continuity | Marketing |
| Behavior archetype | Decoy |
| Attack and movement | Creates a visual duplicate of itself; only the real one casts the correct shadow and damage telegraph. |
| Approved variants | Campaign version duplicates another enemy silhouette but not behavior. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-050 - Focus Tester

| Field | Definition |
| --- | --- |
| Home / continuity | Marketing |
| Behavior archetype | Attention controller |
| Attack and movement | Projects a gaze cone that slows attack cadence if the player remains inside after warning. |
| Approved variants | Mobile panel of three testers. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-051 - Red Tape Roll

| Field | Definition |
| --- | --- |
| Home / continuity | Legal |
| Behavior archetype | Growing obstacle |
| Attack and movement | Rolls a strip across the floor that temporarily becomes a collision wall, then retracts. |
| Approved variants | Cross pattern; burning tape variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-052 - Clause

| Field | Definition |
| --- | --- |
| Home / continuity | Legal |
| Behavior archetype | Conditional attacker |
| Attack and movement | Displays a simple icon condition such as moving or firing; violates it and the Clause launches a punishment shot. |
| Approved variants | Elite cycles two conditions, never simultaneous. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-053 - Janitor

| Field | Definition |
| --- | --- |
| Home / continuity | Facilities |
| Behavior archetype | Hazard manipulator |
| Attack and movement | Moves spills, pushes debris, and swings a mop in a short arc. |
| Approved variants | Corrupted janitor spreads hazardous fluid. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-054 - The Leak

| Field | Definition |
| --- | --- |
| Home / continuity | Facilities |
| Behavior archetype | Spawned hazard entity |
| Attack and movement | A moving puddle source that creates water paths and retreats from electricity. |
| Approved variants | Toxic or burning fluid variant. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-055 - Prototype

| Field | Definition |
| --- | --- |
| Home / continuity | R&D |
| Behavior archetype | Unstable behavior |
| Attack and movement | Uses one clearly signposted experimental behavior selected from a curated list per spawn. |
| Approved variants | Glitched elite combines two compatible experiments. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-056 - Archive Shade

| Field | Definition |
| --- | --- |
| Home / continuity | Secret / Records |
| Behavior archetype | Phase ambusher |
| Attack and movement | Moves beneath paper piles, then rises with a radial burst after a warning rustle. |
| Approved variants | Senior shade steals an item phrase from HUD temporarily, never mechanics. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-057 - Shareholder Eye

| Field | Definition |
| --- | --- |
| Home / continuity | Board / hidden |
| Behavior archetype | Tracking turret |
| Attack and movement | Floats above obstacles and follows the player with a thin targeting line before firing. |
| Approved variants | Multiple eyes vote on one target point. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

### ENM-058 - Merger Abomination

| Field | Definition |
| --- | --- |
| Home / continuity | Conglomerate |
| Behavior archetype | Composite elite |
| Attack and movement | Combines two approved enemy behavior modules and a fused corporate silhouette. |
| Approved variants | Generated only from curated compatibility pairs, not arbitrary AI assembly. |
| Required data | Cost, health, speed, state timings, damage, movement class, attack modules, room tags, drop table, animation, audio, elite markers. |
| Acceptance | Solo behavior readable; mixed encounter valid; variant changes behavior; no unreachable spawn; death state stops contact damage. |

# Appendix E. Boss Database

## BSS-001 - The Team Lead

| Field | Definition |
| --- | --- |
| Location / pool | Open Office I |
| Core fight | Buffs Office Drones with visible buzzword rings, fires simple radial notes, and becomes aggressive when alone. |
| Reward and progression role | Reliable introductory manager boss. Drops a normal Manager Reward; rare set drop: Team Player Badge. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-002 - Copy Chief

| Field | Definition |
| --- | --- |
| Location / pool | Open Office I-II |
| Core fight | A giant copier rotates between paper fan, straight sheet wave, jammed add spawn, and toner burst. |
| Reward and progression role | Arena contains destructible printers. Rare set drop: Printer Ink or Copier weapon. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-003 - Scrum Master

| Field | Definition |
| --- | --- |
| Location / pool | Open Office II |
| Core fight | Creates timed stand-up zones, dashes at the end of each countdown, and summons brief Meeting Clusters. |
| Reward and progression role | Teaches timed windows without long invulnerability. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-004 - The Open Plan

| Field | Definition |
| --- | --- |
| Location / pool | Open Office II |
| Core fight | The room itself shifts cubicle dividers while a central manager node fires patterns and exposes weak points. |
| Reward and progression role | Large-room boss; moving architecture never seals all safe routes. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-005 - Sysadmin

| Field | Definition |
| --- | --- |
| Location / pool | IT I |
| Core fight | Activates terminal nodes, deploys firewall lines, and uses a predictable command cycle. |
| Reward and progression role | Destroying nodes shortens shield phases. Rare set drop: Master Access fragment. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-006 - Helpdesk Hydra

| Field | Definition |
| --- | --- |
| Location / pool | IT I-II |
| Core fight | Multiple phone heads perform distinct calls: tickets, shock lines, summons, and repair. Heads can be disabled independently. |
| Reward and progression role | Head count and pattern scale by floor. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-007 - Legacy System

| Field | Definition |
| --- | --- |
| Location / pool | IT II |
| Core fight | Large old server with slow, punishing phases, rotating obsolete patterns, and a final overclock meltdown. |
| Reward and progression role | Deliberately predictable once learned; high health but generous tells. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-008 - Firewall

| Field | Definition |
| --- | --- |
| Location / pool | IT II |
| Core fight | Mobile shield walls divide the room while a core fires through approved gaps. |
| Reward and progression role | Player can destroy temporary ports to create attack lanes. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-009 - The Bottleneck

| Field | Definition |
| --- | --- |
| Location / pool | Operations I |
| Core fight | Deploys pallets, narrows movement, and launches charges through the remaining lane. |
| Reward and progression role | Rewards object management. Set drop: Extension Cord or Supply Cart charm. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-010 - Shift Manager

| Field | Definition |
| --- | --- |
| Location / pool | Operations I-II |
| Core fight | Schedules enemy waves on a visible board and joins combat between calls. |
| Reward and progression role | Killing scheduled adds early creates safe downtime. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-011 - Supply Chain

| Field | Definition |
| --- | --- |
| Location / pool | Operations II |
| Core fight | Linked cart-and-worker segments circulate the room. Destroying segments changes route and attack pattern. |
| Reward and progression role | Large-room segmented boss with no off-screen damage. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-012 - Quarter End

| Field | Definition |
| --- | --- |
| Location / pool | Operations II |
| Core fight | A clock-driven boss that accelerates selected patterns but exposes a weak point at each deadline. |
| Reward and progression role | Not a global run timer; the fight itself owns the clock. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-013 - VP of Everything

| Field | Definition |
| --- | --- |
| Location / pool | Executive I |
| Core fight | Cycles through diluted versions of earlier department mechanics and delegates attacks to assistants. |
| Reward and progression role | A recognition exam, not a random pattern soup. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-014 - Chief Operating Officer

| Field | Definition |
| --- | --- |
| Location / pool | Executive I-II |
| Core fight | Controls room zones, security, and moving executive furniture while attacking in measured phases. |
| Reward and progression role | Drops a high-quality Manager Reward and may open a post-boss offer room. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-015 - The Boardroom

| Field | Definition |
| --- | --- |
| Location / pool | Executive II |
| Core fight | Several chair-bound members vote to enable synchronized patterns. Defeating members changes the vote balance. |
| Reward and progression role | May appear as alternate pre-CEO boss or hidden Board preview. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-016 - CEO

| Field | Definition |
| --- | --- |
| Location / pool | Executive II final |
| Core fight | Three phases: charismatic presentation, hostile restructuring with adds, and exposed machine-like corporate core. |
| Reward and progression role | First apparent final boss. Defeat triggers ending logic, not always credits. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-017 - The Auditor

| Field | Definition |
| --- | --- |
| Location / pool | Finance |
| Core fight | Tracks spending, marks pickups, and creates ledger lanes that reconcile after a delay. |
| Reward and progression role | Set drop: Corporate Card or Red Pen. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-018 - Budget Committee

| Field | Definition |
| --- | --- |
| Location / pool | Finance |
| Core fight | Three members allocate armor, projectiles, and resource theft through a visible rotating budget. |
| Reward and progression role | Defeating one member changes allocation, creating player choice. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-019 - Brand Manager

| Field | Definition |
| --- | --- |
| Location / pool | Marketing |
| Core fight | Creates decoy bosses and false reward silhouettes while the real attacks remain identifiable by shadow and audio. |
| Reward and progression role | Fairness depends on consistent tell, never pure guessing. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-020 - Viral Campaign

| Field | Definition |
| --- | --- |
| Location / pool | Marketing |
| Core fight | A central campaign spreads copies through ad nodes. Destroying nodes limits pattern replication. |
| Reward and progression role | Escalates visually but uses bounded entity counts. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-021 - General Counsel

| Field | Definition |
| --- | --- |
| Location / pool | Legal |
| Core fight | Uses clauses, binding zones, and delayed rulings with explicit icons and countdowns. |
| Reward and progression role | Rewards reading simple conditions under pressure. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-022 - Red Tape

| Field | Definition |
| --- | --- |
| Location / pool | Legal |
| Core fight | A giant living roll creates walls, knots, and temporary seals around the arena. |
| Reward and progression role | Cut points open lanes; no phase can fully trap the player. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-023 - Head of Facilities

| Field | Definition |
| --- | --- |
| Location / pool | Facilities |
| Core fight | Manipulates water, power, doors, and movable objects while remaining physically vulnerable. |
| Reward and progression role | Environmental boss with multiple valid solutions. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-024 - Prototype Zero

| Field | Definition |
| --- | --- |
| Location / pool | R&D |
| Core fight | Cycles through a curated sequence of experimental weapon and room-rule modules. |
| Reward and progression role | Seeded module order supports learning within attempts. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-025 - The Board

| Field | Definition |
| --- | --- |
| Location / pool | The Board II |
| Core fight | A coordinated multi-entity boss whose votes select pattern families and rewrite arena priorities. |
| Reward and progression role | First major post-CEO boss; unlocks deeper ownership route conditions. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-026 - Hostile Takeover

| Field | Definition |
| --- | --- |
| Location / pool | The Board II alternate |
| Core fight | Aggressive merger entity absorbs adds and inherits one attack from each. |
| Reward and progression role | Player may kill adds before absorption to limit the final kit. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-027 - Parent Company

| Field | Definition |
| --- | --- |
| Location / pool | Parent Company |
| Core fight | Reconstructs sanitized versions of earlier bosses and erases its own branding between phases. |
| Reward and progression role | Defeat reveals the subsidiary structure and a false terminal ending. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-028 - The Conglomerate

| Field | Definition |
| --- | --- |
| Location / pool | The Conglomerate |
| Core fight | Massive composite boss using carefully sequenced cross-department mechanics and arena transformations. |
| Reward and progression role | Ultra-late mastery boss. No random module mixing during the fight. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

## BSS-029 - The Beneficial Owner

| Field | Definition |
| --- | --- |
| Location / pool | Ownership |
| Core fight | Minimalist final duel that echoes selected mechanics from the current run, then removes layers until only movement and core weapon skill remain. |
| Reward and progression role | Ultimate concealed boss and final ending. Does not invalidate future expansion. |
| Mandatory design pass | Arena compatibility; phase timing; telegraph minimum; contact rule; add compatibility; set drop; reward idempotency; low/high damage test; reduced-effects test. |
| Failure conditions | Unavoidable spawn damage, full arena seal, excessive invulnerability, unreadable phase transition, reward duplication, off-screen attack without cue. |

# Appendix F. Room and Environment Catalog

## F.1 Room roles

| ID / room | Frequency | Definition |
| --- | --- | --- |
| ROOM-001 Start Room | Guaranteed | Safe arrival room with elevator door, no combat, and room-map origin. |
| ROOM-002 Standard Workroom | Common | Primary combat room; architecture and encounter are selected independently. |
| ROOM-003 Hallway | Common | Narrow connector or bent corridor; may be empty, trapped, decorated, or lightly hostile. |
| ROOM-004 Large Workroom | Uncommon | Double, L-shaped, or multi-cell room with several door sockets and larger encounter budget. |
| ROOM-005 Supply Closet | Guaranteed | Item pedestal from Supply Closet pool. Open Office I version is unlocked; later normal versions cost one Access Card. |
| ROOM-006 Office Supply Shop | Guaranteed | Purchasable stock, pickups, possible shopkeeper or kiosk. |
| ROOM-007 Manager Office | Guaranteed | Floor boss arena and guaranteed Manager Reward pedestal. |
| ROOM-008 Break Room | Optional | Recovery, vending machines, low-risk events, or a quiet environmental story. |
| ROOM-009 Deadline Room | Optional | Locked challenge that begins when a reward is accepted; waves or timer produce premium loot. |
| ROOM-010 Crisis Room | Optional late | Boss challenge or elite wave room with restricted entry requirements. |
| ROOM-011 Unscheduled Review | Optional | Mini-boss room hidden behind an ordinary-looking door until entered. |
| ROOM-012 Maintenance Access | Hidden | Primary secret room, blast-opened, commonly adjacent to multiple normal rooms. |
| ROOM-013 Forgotten Cubicle | Hidden | Secondary secret room, attached to one non-special room near a far dead end. |
| ROOM-014 Restricted Records | Optional risk | Entry costs health, resources, or a harmful room condition; contains risky or forbidden rewards. |
| ROOM-015 Overtime Room | Optional sacrifice | Allows deliberate health or resource sacrifice for escalating rewards. |
| ROOM-016 Archive | Optional locked | Curated text, map, active, and knowledge-themed item pool. |
| ROOM-017 Innovation Lab | Rare locked | Rare technology item room with unusual weapons and modifiers. |
| ROOM-018 Rec Room | Optional | Arcade-like machines, gambling, skill games, and pickup conversion. |
| ROOM-019 Strategy Room | Rare double-lock | Floor-wide reroll, duplication, or rule-changing floor mechanism chosen by room variant. |
| ROOM-020 Wellness Room | Rare | Clean or ruined recovery room; may heal, contain an item, or hide a negative event. |
| ROOM-021 Executive Storage | Rare double-lock | Premium containers and Golden Cabinet pool items. |
| ROOM-022 Shadow Procurement | Hidden sub-room | Expensive black-market shop reached through secret infrastructure. |
| ROOM-023 Executive Deal | Post-boss conditional | Powerful rewards purchased through health, debt, or sacrifice. |
| ROOM-024 Union Breakroom | Post-boss conditional | Defensive and sustain rewards earned through behavior conditions rather than purchase. |
| ROOM-025 Quarter-End Crunch | Timed secret | Boss-rush-style large arena unlocked by reaching a milestone quickly; item choice starts the event. |
| ROOM-026 Service Elevator | Route room | Alternate or secret floor transition with explicit access conditions. |
| ROOM-027 13th Floor | Error room | Rare teleport-only anomaly with unusual rewards and a forced exit route. |
| ROOM-028 NPC Office | Optional | Contains a non-hostile character, trade, quest-like interaction, beggar, or machine. |

## F.2 Environmental objects

| ID / object | Class | Definition |
| --- | --- | --- |
| ENV-001 Filing Cabinet | Destructible cover | Common rock-equivalent. Blocks movement and most projectiles. May contain credits, Access Cards, Toner Charges, health, nothing, or a disguised enemy. Metal variants require multiple hits or a blast. |
| ENV-002 Water Cooler | Destructible hazard | Breaks into a water spill. Water may become slippery and conducts shock effects. Rarely contains a Caffeine pickup because office logic has already left the building. |
| ENV-003 Printer | Destructible machine | Releases paper, toner dust, a pickup, or a Printer Beast variant when destroyed. Jammed variants periodically fire paper until broken. |
| ENV-004 Recycling Bin | Light destructible | Easy to break, low-value contents, sometimes launches paper debris that can trigger nearby objects. |
| ENV-005 Vending Machine | Interactive machine | Accepts credits for weighted snacks, health, Supplements, or failure. Can jam, break, or very rarely reveal a passage or enemy. |
| ENV-006 Office Plant | Light destructible | Usually empty; may conceal health, a bug swarm, or a decorative story item. Cactus variant deals contact damage. |
| ENV-007 Cubicle Divider | Partial cover | Blocks movement and low projectiles. Fixed, sliding, damaged, and blastable variants support changing lanes. |
| ENV-008 Desk | Heavy cover | Large rectangular obstacle with authored gaps and drawers. Desks may be intact, overturned, electrified, or breakable. |
| ENV-009 Rolling Chair | Movable object | Can be pushed by player, enemies, airflow, or explosions. Moving chairs deal low impact damage and can block shots. |
| ENV-010 Server Rack | Heavy machine | Indestructible or high-health cover. Powered variants emit shock lanes, spawn turrets, or change room state when disabled. |
| ENV-011 Cable Bundle | Floor hazard | Slows or trips eligible entities. Powered variants shock periodically. Cable Snakes may disguise themselves among bundles. |
| ENV-012 Glass Partition | Breakable wall | Blocks movement and projectiles until shattered. Shards create a brief floor hazard. Uses clear crack states. |
| ENV-013 Archive Shelf | Tall cover | Blocks line of sight and movement. May collapse in a cardinal direction when destroyed, changing navigation. |
| ENV-014 Whiteboard | Thin cover / event | May display a clue, reveal an item phrase, or release marker hazards when broken. Never required for normal progression. |
| ENV-015 Coffee Machine | Interactive machine | Trades credits or charge for Caffeine health and coffee-tag effects. Can overheat, spill, or produce an enemy in corrupted variants. |
| ENV-016 Fire Extinguisher | Reactive object | Explodes into a pushing foam cone when struck or blasted. Can extinguish fire and erase selected hazards. |
| ENV-017 Supply Cart | Movable heavy object | Pushable along clear lanes. May contain pickups and can crush light enemies at speed. |
| ENV-018 Locked Cabinet | Resource container | Consumes an Access Card or blast depending on variant. Uses cabinet-specific loot tables. |
| ENV-019 Power Strip | Reactive hazard | Can be turned off, destroyed, or overloaded. Powered strips link electrical devices and water spills. |
| ENV-020 Trophy Case | Premium destructible | Rare executive object with high-value loot chance, glass hazard, and possible alarm response. |
| ENV-021 Coffee Stain | Floor state | Common visual decal. Mechanical variants are explicitly outlined slippery or sticky zones; decorative stains have no collision. |
| ENV-022 Paper Pile | Soft obstacle | Slows movement and may hide a tiny pickup, Toner Charge, or swarm. Burning or airflow can alter it. |
| ENV-023 Security Scanner | Line hazard | Sweeps or pulses a visible line. Crossing may damage, mark, lock doors, or summon security depending on room rules. |
| ENV-024 Conveyor Lane | Movement hazard | Applies directional movement to entities and movable objects. Direction and active state are visually obvious. |

## F.3 Minimum template packs

| Pack | Minimum authored templates per department pair |
| --- | --- |
| Normal single-cell combat | 24 |
| Normal empty / story | 8 |
| Hallways and tiny rooms | 12 |
| Double rooms | 10 |
| Large and L-shaped rooms | 8 |
| Supply Closet | 4 |
| Shop | 4 |
| Boss arenas | One compatible arena per boss, plus shared validated arenas where appropriate |
| Maintenance Access | 8 |
| Forgotten Cubicle | 6 |
| Challenge / Crisis | 8 |
| Other special and NPC rooms | 12 |

# Appendix G. Data Schema Examples

These examples describe required concepts, not a mandatory serialization syntax. The chosen engine may use JSON, YAML, engine resources, or another versioned format with equivalent validation.

## G.1 Weapon definition

```yaml
id: WPN-001
schema_version: 1
name_loc: weapon.keyboard.name
description_loc: weapon.keyboard.description
sprite_id: weapon_keyboard
quality: 1
base_weight: 1.0
min_floor: 1
pools: [SUPPLY_CLOSET]
attack:
  archetype: PROJECTILE
  input_mode: CARDINAL_TAP
  base_damage_multiplier: 1.0
  interval_seconds: 0.45
  projectile_id: PRJ_KEYCAP
  projectile_speed: 9.0
  projectile_lifetime: 0.95
modifier_tags: [PROJECTILE, DIRECTED, REPEATABLE]
adapters:
  HOMING: HomingProjectileAdapter
  EIGHT_DIRECTION: EightDirectionAdapter
  SPLIT: SplitProjectileAdapter
  RETURN: ReturnProjectileAdapter
assets:
  pickup_sprite: weapon_keyboard_pickup
  held_sprite: weapon_keyboard_held
  fire_audio: sfx_keyboard_fire
```

## G.2 Passive item definition

```yaml
id: ITM-011
schema_version: 1
name_loc: item.pen_laser.name
pickup_phrase_loc: item.pen_laser.phrase
class: PASSIVE
quality: 3
base_weight: 0.65
min_floor: 1
pools: [SUPPLY_CLOSET, INNOVATION_LAB]
sprite_id: item_pen_laser
modifier:
  mechanic: HOMING
  supported_attack_tags: [PROJECTILE, MELEE_ARC, BEAM, TETHER, CHARGE_WAVE]
  default_adapter: HomingProjectileAdapter
  weapon_overrides:
    WPN-002: HomingArcAdapter
    WPN-003: TrackingBeamAdapter
    WPN-010: CurvingTetherAdapter
  unsupported_behavior: NO_EFFECT
unlock_id: null
repeatable: false
```

## G.3 Room template

```yaml
id: ROOMTPL_OPEN_01_2X1_A
schema_version: 1
department_tags: [OPEN_OFFICE]
role_tags: [NORMAL, COMBAT_CAPABLE]
footprint_cells: [[0,0], [1,0]]
door_sockets:
  - {id: N0, side: NORTH, cell: [0,0], offset: 0.50, classes: [NORMAL]}
  - {id: N1, side: NORTH, cell: [1,0], offset: 0.50, classes: [NORMAL]}
  - {id: W0, side: WEST,  cell: [0,0], offset: 0.50, classes: [NORMAL, BLAST_SECRET]}
  - {id: E0, side: EAST,  cell: [1,0], offset: 0.50, classes: [NORMAL]}
geometry_asset: open_office_2x1_a
collision_asset: open_office_2x1_a_collision
spawn_zones: [ENTRY_SAFE, GROUND_MELEE, GROUND_RANGED, AIR, REWARD]
allowed_encounter_tags: [OPEN_OFFICE, LARGE_ROOM]
prohibited_enemy_tags: [TIGHT_CORRIDOR_ONLY]
object_anchor_set: OPEN_OFFICE_LARGE_A
decoration_sets: [MEETING_AFTERMATH, PAPER_OVERFLOW, GENERIC]
weight: 1.0
```

## G.4 Encounter definition

```yaml
id: ENC_OPEN_SUPPORT_04
schema_version: 1
department_tags: [OPEN_OFFICE]
room_tags_required: [COMBAT_CAPABLE]
room_tags_any: [NORMAL, LARGE_ROOM]
budget_range: [6.0, 9.5]
spawn_groups:
  - zone: GROUND_MELEE
    entries:
      - {enemy: ENM-001, count: [2,3]}
      - {enemy: ENM-007, count: [1,1]}
  - zone: GROUND_RANGED
    entries:
      - {enemy: ENM-002, count: [1,2]}
constraints:
  max_support: 1
  min_entry_grace_seconds: 0.8
  require_player_path_between_entries: true
clear_rule: ALL_REQUIRED_ENEMIES
reward_profile: NORMAL_CLEAR
weight: 0.8
```

## G.5 Enemy definition

```yaml
id: ENM-004
schema_version: 1
name_loc: enemy.coffee_sprinter.name
home_departments: [OPEN_OFFICE]
tags: [GROUND, BURST_MOVER, PREDICTIVE]
cost: 1.9
health: 24
movement:
  controller: BurstDashController
  base_speed: 1.8
  dash_speed: 8.5
ai:
  states: [IDLE, TELEGRAPH, DASH, RECOVER]
  telegraph_seconds: 0.55
  prediction_seconds: 0.25
attack:
  contact_damage: 1
  locks_vector_after_telegraph: true
drops: ENEMY_COMMON
variants: [ENMVAR_CAFFEINATED, ENMVAR_SPILL_ON_DEATH]
room_requirements: [DASH_LANE]
assets:
  sprite: enemy_coffee_sprinter
  audio_cue: sfx_coffee_sprinter_charge
```

## G.6 Department definition

```yaml
id: DPT-002
schema_version: 1
name_loc: department.it.name
floors: [FLOOR_IT_1, FLOOR_IT_2]
room_template_pools: [IT_NORMAL, IT_SPECIAL, SERVICE_SHARED]
encounter_pools: [IT_1_ENCOUNTERS, IT_2_ENCOUNTERS]
boss_pools: [IT_1_BOSSES, IT_2_BOSSES]
object_sets: [IT_FURNITURE, IT_POWERED, SHARED_OFFICE]
hazard_sets: [ELECTRICITY, CABLES, MACHINE_STATES]
item_affinities:
  INNOVATION_LAB: 1.35
  TECHNOLOGY_TAG: 1.15
presentation:
  palette: palette_it
  tileset: tileset_it
  music: music_it
  ambience: ambience_it
route_tags: [CORE_CHAPTER_2]
```

## G.7 Loot pool entry

```yaml
pool: SUPPLY_CLOSET
entries:
  - content_id: ITM-011
    base_weight: 0.65
    min_floor: 1
    max_floor: null
    quality: 3
    required_unlock: null
    source_tags_any: [PEDESTAL]
    seen_decay: 0.5
  - content_id: WPN-003
    base_weight: 0.12
    min_floor: 3
    quality: 4
    early_jackpot_eligible: true
```

## G.8 Unlock definition

```yaml
id: UNLOCK_BOARD_ROUTE
schema_version: 1
hidden: true
trigger:
  event: BOSS_DEFEATED
  boss_id: BSS-016
condition:
  counter: CEO_CLEAR_COUNT
  comparison: GREATER_OR_EQUAL
  value: 10
actions:
  - set_flag: BOARD_ROUTE_ENABLED
  - record_ending: END-004
  - transition_route: ROUTE_BOARD_1
announcement: NONE
idempotent: true
```

## G.9 Run save

```yaml
schema_version: 1
content_version: 1.0.0
run_id: uuid
seed: OFFICE-4F7K-2P9M
mode: NORMAL
profile_id: PRF-001
route_id: ROUTE_BASE
floor_index: 4
floor_instance_id: generated-uuid
rng_stream_states: {...}
player:
  health: {...}
  weapon_id: WPN-002
  passive_ids: [ITM-001, ITM-011, ITM-024]
  active_id: ACT-002
  active_charge: 4
  pocket: {class: ACTION_CARD, id: CARD-014}
  charm_id: CHR-002
  resources: {credits: 17, access_cards: 2, toner_charges: 1}
floor_state:
  graph: {...}
  rooms: {...}
  discovered_map: [...]
  hidden_rooms_discovered: [...]
unlock_event_buffer: [...]
```

# Appendix H. Benchmark References and Originality Guardrails

## H.1 Benchmark purpose

Public documentation for The Binding of Isaac: Rebirth was reviewed to confirm high-level genre structures such as rooms of varied sizes, special-room categories, hidden-room placement principles, weighted item pools, boss rewards, room-based active recharge, and a one-slot trinket-like system. This GDD defines original corporate content and its own values, algorithms, names, layouts, narrative, and presentation.

- **Rooms:** https://bindingofisaacrebirth.wiki.gg/wiki/Rooms - Room categories, varied room sizes, hostile-room clearing, and room-based active charge as a benchmark.

- **Level Generation:** https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation - Connected floor generation, dead ends, and special-room placement order as a benchmark.

- **Secret Room:** https://bindingofisaacrebirth.wiki.gg/wiki/Secret_Room - Adjacency-based hidden room concepts as a benchmark.

- **Item Pool:** https://bindingofisaacrebirth.wiki.gg/wiki/Item_Pool - Weighted pools, item weights, and pool-specific content as a benchmark.

- **Item Quality:** https://bindingofisaacrebirth.wiki.gg/wiki/Item_Quality - Hidden internal quality bands as a benchmark.

- **Boss Room:** https://bindingofisaacrebirth.wiki.gg/wiki/Boss_Room - Guaranteed boss reward and post-boss route concepts as a benchmark.

- **Trinkets:** https://bindingofisaacrebirth.wiki.gg/wiki/Trinkets - A dedicated one-slot subtle passive class as a benchmark.

## H.2 Originality guardrails

- Do not use The Binding of Isaac character names, item names, enemy names, boss names, room layouts, dialogue, lore, sprites, animations, sounds, music, UI, code, or data.
- Do not recreate a recognizable item one-for-one merely by renaming it with an office noun. Translate the gameplay purpose and add original behavior, interaction, or presentation.
- Do not market the shipping game using the internal codename Office Isaac.
- Maintain an originality review for every major content batch, especially iconic weapons, endings, bosses, and room types.
- Genre mechanics and system patterns may inspire design; creative expression must remain independently authored.

## H.3 Revision record

| Version | Date | Summary |
| --- | --- | --- |
| 1.0 | 28 July 2026 | First complete north-star GDD assembled from approved design decisions. Includes system requirements, procedural algorithms, technical contracts, progression, hidden endings, and starter content databases. |
