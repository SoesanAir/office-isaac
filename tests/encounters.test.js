/**
 * Encounter selection and composition tests.
 *
 * GDD refs: 6.6 (budget formula and constraints), 11.4 step 11 (encounters selected
 *           independently of architecture), 12.1 / D-006 / R-FLR-007 (a room is a
 *           place, not an enemy list), 14.5 (composition rules), R-ENM-003 (no
 *           mutually shielding or infinitely healing groups), R-ENM-006 (bounded
 *           quantity), R-ROM-001 (a template supports several encounters plus empty),
 *           R-ROM-002 (zero enemies, one encounter, or a wave sequence all work),
 *           23.2 (procedural suite).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus } from '../src/core/events.js';
import { Run } from '../src/systems/run.js';
import { buildRoom, NON_HOSTILE_ROLES } from '../src/systems/room-build.js';
import {
  selectEncounter, encounterBudget, encounterCost, maxSimultaneous, isCompatible,
} from '../src/systems/encounter-select.js';
import { BUDGETS, ROOM_SIZE_MULTIPLIER } from '../src/core/constants.js';

const registry = loadContent({ strict: false });

function makeRun(seed) {
  const run = new Run({ registry, events: new EventBus() });
  run.start({ seed });
  return run;
}

test('GDD 6.6: the budget formula matches the document exactly', () => {
  // base = 3.5 + depth * 1.35, times the room multiplier, times difficulty.
  assert.equal(encounterBudget({ depth: 1, sizeClass: 'normal' }).toFixed(2), '4.85');
  assert.equal(encounterBudget({ depth: 2, sizeClass: 'normal' }).toFixed(2), '6.20');
  assert.equal(encounterBudget({ depth: 1, sizeClass: 'tiny' }).toFixed(2), '2.67');
  assert.equal(
    encounterBudget({ depth: 1, sizeClass: 'large' }).toFixed(2),
    (4.85 * ROOM_SIZE_MULTIPLIER.large).toFixed(2),
  );
  // Hard difficulty is a 1.18 multiplier, not a separate curve.
  assert.equal(
    encounterBudget({ depth: 1, sizeClass: 'normal', difficulty: 'hard' }).toFixed(2),
    (4.85 * 1.18).toFixed(2),
  );
});

test('every authored encounter costs roughly what it claims to', () => {
  for (const encounter of registry.all('encounter')) {
    const cost = encounterCost(encounter, registry);
    const [lo, hi] = encounter.budgetRange;
    // Generous tolerance: budgetRange is the band of ROOMS an encounter suits, not a
    // precise cost. But an encounter costing triple its own ceiling is a data bug.
    assert.ok(cost >= lo * 0.5, `${encounter.id} costs ${cost.toFixed(2)}, far below ${lo}`);
    assert.ok(cost <= hi * 1.5, `${encounter.id} costs ${cost.toFixed(2)}, far above ${hi}`);
  }
});

test('R-ENM-006: no encounter exceeds the simultaneous hostile cap', () => {
  for (const encounter of registry.all('encounter')) {
    const simultaneous = maxSimultaneous(encounter);
    assert.ok(
      simultaneous <= BUDGETS.maxHostilesPerRoom,
      `${encounter.id} can field ${simultaneous}, over the ${BUDGETS.maxHostilesPerRoom} cap`,
    );
    const declared = encounter.constraints.maxSimultaneousHostiles;
    if (declared) {
      assert.ok(simultaneous <= declared, `${encounter.id} exceeds its own declared cap`);
    }
  }
});

test('R-ENM-003: no encounter fields two healers or a mutually shielding pair', () => {
  for (const encounter of registry.all('encounter')) {
    const healers = [];
    const shielders = [];
    for (const group of encounter.spawnGroups) {
      for (const entry of group.entries) {
        const def = registry.get('enemy', entry.enemy);
        if (!def) continue;
        if (def.tags.includes('HEALER')) healers.push(def.id);
        if (def.tags.includes('SHIELDER')) shielders.push(def.id);
      }
    }
    assert.ok(healers.length <= 1, `${encounter.id} fields ${healers.length} healers`);
    const sameShielder = shielders.length > 1 && new Set(shielders).size === 1;
    assert.equal(sameShielder, false, `${encounter.id} fields a mutually shielding pair`);
  }
});

test('R-ENM-008: every encounter only asks for zones its rooms can provide', () => {
  // A zone the template does not declare was never checked by the navigation
  // validator, so an enemy placed there could be unreachable.
  const templates = registry.all('roomTemplate');
  for (const encounter of registry.all('encounter')) {
    const needed = new Set(encounter.spawnGroups.map((g) => g.zone));
    const anyTemplateSatisfies = templates.some((tpl) => {
      const declared = new Set((tpl.spawnZones || []).map((z) => z.zone));
      return [...needed].every((z) => declared.has(z));
    });
    assert.ok(anyTemplateSatisfies, `${encounter.id} needs zones no template declares`);
  }
});

test('R-FLR-007: selection never mutates the room template', () => {
  const run = makeRun('OFFICE-ENCT-0001');
  const floorDef = { ...run.floorDef, departmentTag: 'OPEN_OFFICE' };
  for (const node of run.floor.nodes.values()) {
    const room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
    const before = JSON.stringify(room.template);
    selectEncounter({ node, template: room.template, floorDef, registry, rngSource: run.rng });
    assert.equal(JSON.stringify(room.template), before, `${node.id} template was mutated`);
  }
});

test('R-TEC-002: the same seed selects the same encounters', () => {
  const pick = (seed) => {
    const run = makeRun(seed);
    const floorDef = { ...run.floorDef, departmentTag: 'OPEN_OFFICE' };
    const out = [];
    for (const node of run.floor.nodes.values()) {
      const room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
      const sel = selectEncounter({ node, template: room.template, floorDef, registry, rngSource: run.rng });
      out.push(`${node.id}:${sel.encounter?.id ?? 'none'}`);
    }
    return out.join('|');
  };
  assert.equal(pick('OFFICE-ENCD-0007'), pick('OFFICE-ENCD-0007'));
});

test('combat rooms are populated, with a deliberate minority left empty', () => {
  let combat = 0;
  let populated = 0;
  let authoredEmpty = 0;
  let noFit = 0;
  const used = new Set();

  for (let s = 0; s < 10; s += 1) {
    const run = makeRun(`OFFICE-POPT${String(s).padStart(4, '0')}`);
    const floorDef = { ...run.floorDef, departmentTag: 'OPEN_OFFICE' };
    for (const node of run.floor.nodes.values()) {
      if (NON_HOSTILE_ROLES.has(node.role)) continue;
      // The Manager Office waits on boss content, and story templates declare no
      // encounter tags precisely because they are authored as quiet rooms (GDD 12.2).
      if (node.role === 'ROOM-007') continue;
      const room = buildRoom({ floor: run.floor, node, registry, rngSource: run.rng });
      if ((room.template.allowedEncounterTags || []).length === 0) continue;
      combat += 1;
      const sel = selectEncounter({ node, template: room.template, floorDef, registry, rngSource: run.rng });
      if (sel.encounter) { populated += 1; used.add(sel.encounter.id); }
      else if (sel.reason === 'authored empty') authoredEmpty += 1;
      else noFit += 1;
    }
  }

  assert.ok(combat > 100, `only sampled ${combat} combat rooms`);
  // The bulk of combat rooms must actually contain a fight.
  assert.ok(populated / combat > 0.7, `only ${(100 * populated / combat).toFixed(0)}% populated`);
  // R-ROM-001 / GDD 12.2: an empty combat-capable room is a valid, intended state,
  // and GDD 3.2 wants those quiet beats — but they must stay a minority.
  assert.ok(authoredEmpty / combat < 0.3, `${(100 * authoredEmpty / combat).toFixed(0)}% empty`);
  // A no-fit means no authored encounter suits a room the generator built. A few are
  // tolerable; many would mean the encounter catalogue has a hole.
  assert.ok(noFit / combat < 0.08, `${(100 * noFit / combat).toFixed(0)}% of rooms had no fitting encounter`);
  // R-ROM-001 wants variety, not one encounter everywhere.
  assert.ok(used.size >= 8, `only ${used.size} distinct encounters appeared`);
});

test('R-ROM-001: one template can host several different encounters', () => {
  // The same architecture must be reusable, which is the whole reason encounters are
  // a separate layer (D-006).
  const templates = registry.all('roomTemplate')
    .filter((t) => (t.allowedEncounterTags || []).length > 0);
  const target = templates.find((t) => t.roleTags.includes('ROOM-002'));
  assert.ok(target, 'no combat template to test');

  const floorDef = {
    id: 'FLOOR-OPEN_OFFICE_1', depth: 1, difficulty: 'standard', departmentTag: 'OPEN_OFFICE',
  };
  const matches = registry.all('encounter').filter((e) => isCompatible(e, {
    room: { sizeClass: 'normal' }, template: target, depth: 1, department: 'OPEN_OFFICE', registry,
  }).ok);
  assert.ok(matches.length >= 3, `${target.id} only supports ${matches.length} encounters`);
  assert.ok(floorDef.depth === 1);
});

test('GDD 3.6: depth-1 encounters avoid predictive and shielding behaviours', () => {
  // The first ten minutes use "one or two clearly different enemy behaviours and
  // generous telegraphs", so nothing that shields or heals may appear on floor one.
  for (const encounter of registry.all('encounter')) {
    if (encounter.minFloor > 1) continue;
    for (const group of encounter.spawnGroups) {
      for (const entry of group.entries) {
        const def = registry.get('enemy', entry.enemy);
        if (!def) continue;
        assert.ok(
          !def.tags.includes('SHIELDER') && !def.tags.includes('HEALER'),
          `${encounter.id} puts ${def.id} (${def.tags.join(',')}) on floor 1`,
        );
      }
    }
    assert.ok(
      encounter.constraints.minEntryGraceSeconds >= 0.8,
      `${encounter.id} grants only ${encounter.constraints.minEntryGraceSeconds}s grace on floor 1`,
    );
  }
});
