/**
 * Floor generation tests.
 *
 * GDD refs: 23.1 (Property and Seed fixture test layers), 23.2 (procedural test
 *           suite), R-FLR-001..010, R-TEC-002 (determinism), R-QA-001 (no soft
 *           locks), R-QA-002 (identical seed reproduces required streams).
 *
 * Templates here are fixtures built with the real authoring helper, so the tests
 * exercise the same geometry and socket derivation the shipped content uses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RngSource } from '../src/core/rng.js';
import { ROOM_ROLE, ROOM_SIZE, DOOR_CLASS } from '../src/core/constants.js';
import { TemplateIndex } from '../src/systems/template-index.js';
import { FloorGenerator, GenerationError } from '../src/systems/floorgen.js';
import { makeFloorValidator } from '../src/systems/floor-validate.js';
import {
  makeTemplate, quadrantCover, cubicleRows, centreIsland,
} from '../content/rooms/_builder.js';

const DEPT = 'OPEN_OFFICE';

/** A representative template set: every shape and role the generator asks for. */
function fixtureTemplates() {
  const combatRoles = ['ROOM-002', 'COMBAT_CAPABLE', 'NORMAL'];
  const templates = [
    makeTemplate({
      id: 'TPL-FIX-START', departments: [DEPT], roles: [ROOM_ROLE.START, 'SAFE'],
      encounterTags: [], weight: 1,
    }),
    makeTemplate({
      id: 'TPL-FIX-NORMAL-A', departments: [DEPT], roles: combatRoles,
      interior: quadrantCover(4, 2), encounterTags: ['OPEN_OFFICE', 'NORMAL'], weight: 2,
    }),
    makeTemplate({
      id: 'TPL-FIX-NORMAL-B', departments: [DEPT], roles: combatRoles,
      interior: cubicleRows(), encounterTags: ['OPEN_OFFICE', 'NORMAL'], weight: 2,
    }),
    makeTemplate({
      id: 'TPL-FIX-NORMAL-C', departments: [DEPT], roles: combatRoles,
      interior: centreIsland(), encounterTags: ['OPEN_OFFICE', 'NORMAL'], weight: 1,
      socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    }),
    makeTemplate({
      id: 'TPL-FIX-TINY', departments: [DEPT], roles: ['ROOM-003', 'COMBAT_CAPABLE', 'HALLWAY', 'TINY'],
      tiny: true, encounterTags: ['OPEN_OFFICE'], weight: 1,
      socketOpts: { secretSides: ['NORTH', 'SOUTH', 'EAST', 'WEST'] },
    }),
    makeTemplate({
      id: 'TPL-FIX-DOUBLE-H', departments: [DEPT], roles: ['ROOM-002', 'COMBAT_CAPABLE', 'NORMAL', 'LARGE_ROOM'],
      cells: [[0, 0], [1, 0]], interior: quadrantCover(5, 2), encounterTags: ['OPEN_OFFICE', 'LARGE_ROOM'],
      weight: 1,
    }),
    makeTemplate({
      id: 'TPL-FIX-DOUBLE-V', departments: [DEPT], roles: ['ROOM-002', 'COMBAT_CAPABLE', 'NORMAL', 'LARGE_ROOM'],
      cells: [[0, 0], [0, 1]], interior: quadrantCover(4, 2), encounterTags: ['OPEN_OFFICE', 'LARGE_ROOM'],
      weight: 1,
    }),
    makeTemplate({
      id: 'TPL-FIX-LARGE-SQ', departments: [DEPT], roles: ['ROOM-004', 'COMBAT_CAPABLE', 'LARGE_ROOM'],
      cells: [[0, 0], [1, 0], [0, 1], [1, 1]], interior: quadrantCover(6, 3),
      encounterTags: ['OPEN_OFFICE', 'LARGE_ROOM'], weight: 1,
    }),
    makeTemplate({
      id: 'TPL-FIX-LARGE-L', departments: [DEPT], roles: ['ROOM-004', 'COMBAT_CAPABLE', 'LARGE_ROOM'],
      cells: [[0, 0], [1, 0], [0, 1]], interior: quadrantCover(5, 2),
      encounterTags: ['OPEN_OFFICE', 'LARGE_ROOM'], weight: 1,
    }),
    // Special rooms. Every socket accepts every gated class so the generator can
    // place them behind whatever cost the floor definition asks for.
    ...[
      [ROOM_ROLE.SUPPLY_CLOSET, 'SUPPLY'], [ROOM_ROLE.SHOP, 'SHOP'],
      [ROOM_ROLE.BREAK_ROOM, 'BREAK'], [ROOM_ROLE.DEADLINE, 'DEADLINE'],
      [ROOM_ROLE.RESTRICTED_RECORDS, 'RECORDS'], [ROOM_ROLE.ARCHIVE, 'ARCHIVE'],
      [ROOM_ROLE.WELLNESS, 'WELLNESS'], [ROOM_ROLE.NPC_OFFICE, 'NPC'],
      [ROOM_ROLE.INNOVATION_LAB, 'LAB'], [ROOM_ROLE.REC_ROOM, 'REC'],
      [ROOM_ROLE.OVERTIME, 'OVERTIME'], [ROOM_ROLE.STRATEGY, 'STRATEGY'],
      [ROOM_ROLE.EXECUTIVE_STORAGE, 'STORAGE'], [ROOM_ROLE.CRISIS, 'CRISIS'],
      [ROOM_ROLE.UNSCHEDULED_REVIEW, 'REVIEW'],
    ].map(([role, tag]) => makeTemplate({
      id: `TPL-FIX-${tag}`, departments: [DEPT], roles: [role, 'SPECIAL'],
      socketOpts: {
        classes: [
          DOOR_CLASS.NORMAL, DOOR_CLASS.LOCKED_CARD, DOOR_CLASS.LOCKED_DOUBLE,
          DOOR_CLASS.SHOP, DOOR_CLASS.RESTRICTED, DOOR_CLASS.ROUTE,
        ],
      },
      weight: 1,
    })),
    // Hidden rooms only ever open via a blast.
    ...[
      [ROOM_ROLE.MAINTENANCE_ACCESS, 'MAINT'], [ROOM_ROLE.FORGOTTEN_CUBICLE, 'CUBICLE'],
    ].map(([role, tag]) => makeTemplate({
      id: `TPL-FIX-${tag}`, departments: [DEPT], roles: [role, 'SECRET'],
      tiny: role === ROOM_ROLE.FORGOTTEN_CUBICLE,
      socketOpts: { classes: [DOOR_CLASS.BLAST_SECRET] }, weight: 1,
    })),
    // Boss arenas at three footprints so placement rarely fails for want of space.
    makeTemplate({
      id: 'TPL-FIX-BOSS-L', departments: [DEPT], roles: [ROOM_ROLE.MANAGER_OFFICE, 'BOSS_ARENA', 'OPEN_CENTRE'],
      cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
      socketOpts: { classes: [DOOR_CLASS.BOSS] }, weight: 2,
    }),
    makeTemplate({
      id: 'TPL-FIX-BOSS-D', departments: [DEPT], roles: [ROOM_ROLE.MANAGER_OFFICE, 'BOSS_ARENA', 'OPEN_CENTRE'],
      cells: [[0, 0], [1, 0]], socketOpts: { classes: [DOOR_CLASS.BOSS] }, weight: 1,
    }),
    makeTemplate({
      id: 'TPL-FIX-BOSS-N', departments: [DEPT], roles: [ROOM_ROLE.MANAGER_OFFICE, 'BOSS_ARENA', 'OPEN_CENTRE'],
      socketOpts: { classes: [DOOR_CLASS.BOSS] }, weight: 1,
    }),
  ];
  return templates;
}

/** Floor definition fixture matching GDD 11.3 / 11.8 values for depth 1. */
function fixtureFloorDef(overrides = {}) {
  return {
    id: 'FLOOR-FIX-1',
    schemaVersion: 1,
    departmentTag: DEPT,
    tier: 1,
    depth: 1,
    targetNodes: [10, 13],
    roomSizeDistribution: { single: 0.76, double: 0.17, large: 0.04, tiny: 0.03 },
    requiredRoles: [ROOM_ROLE.START, ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.MANAGER_OFFICE],
    optionalRooms: [
      { role: ROOM_ROLE.BREAK_ROOM, chance: 0.6, requiresDeadEnd: true, accessCost: 'NONE' },
      { role: ROOM_ROLE.DEADLINE, chance: 0.4, requiresDeadEnd: true, accessCost: 'NONE' },
      { role: ROOM_ROLE.NPC_OFFICE, chance: 0.3, requiresDeadEnd: true, accessCost: 'NONE' },
      { role: ROOM_ROLE.RESTRICTED_RECORDS, chance: 0.25, requiresDeadEnd: true, accessCost: 'HEALTH' },
      { role: ROOM_ROLE.ARCHIVE, chance: 0.2, requiresDeadEnd: true, accessCost: 'ONE_CARD' },
    ],
    minDeadEnds: 5,
    encounterPools: ['OPEN_OFFICE_1_ENCOUNTERS'],
    bossPool: 'OPEN_OFFICE_1_BOSSES',
    difficulty: 'standard',
    supplyClosetCost: 'NONE',
    shopDoorCost: 'NONE',
    secretRooms: { maintenanceAccess: 1.0, forgottenCubicle: 0.5 },
    hidden: false,
    ...overrides,
  };
}

function makeHarness(overrides) {
  const index = new TemplateIndex(fixtureTemplates());
  const floorDef = fixtureFloorDef(overrides);
  const generator = new FloorGenerator({ templateIndex: index });
  const validate = makeFloorValidator({ templateIndex: index, floorDef });
  return { index, floorDef, generator, validate };
}

function generateFor(seed, overrides) {
  const { generator, floorDef, validate } = makeHarness(overrides);
  const rngSource = new RngSource(seed);
  return generator.generate({ floorDef, rngSource, validate });
}

test('generates a valid floor and reports no validation errors', () => {
  const { floor, validation } = generateFor('OFFICE-AAAA-0001');
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.ok(floor.nodes.size >= 10, `expected >=10 nodes, got ${floor.nodes.size}`);
});

test('R-TEC-002: the same seed reproduces an identical floor', () => {
  const a = generateFor('OFFICE-BBBB-0002').floor;
  const b = generateFor('OFFICE-BBBB-0002').floor;
  assert.deepEqual(a.save(), b.save());
});

test('different seeds produce different layouts', () => {
  const a = JSON.stringify(generateFor('OFFICE-CCCC-0003').floor.save());
  const b = JSON.stringify(generateFor('OFFICE-DDDD-0004').floor.save());
  assert.notEqual(a, b);
});

test('R-FLR-006: guaranteed roles appear exactly once across many seeds', () => {
  for (let i = 0; i < 60; i += 1) {
    const { floor } = generateFor(`OFFICE-ROLE-${String(i).padStart(4, '0')}`);
    const counts = floor.roleCounts();
    for (const role of [ROOM_ROLE.START, ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP, ROOM_ROLE.MANAGER_OFFICE]) {
      assert.equal(counts[role], 1, `seed ${i}: ${role} count ${counts[role]}`);
    }
  }
});

test('R-FLR-001: every non-hidden room is reachable from Start', () => {
  for (let i = 0; i < 40; i += 1) {
    const { floor } = generateFor(`OFFICE-CONN-${String(i).padStart(4, '0')}`);
    const reached = floor.distances(floor.startNodeId);
    for (const node of floor.nodes.values()) {
      if (node.hidden) continue;
      assert.ok(reached.has(node.id), `seed ${i}: ${node.id} (${node.role}) unreachable`);
    }
  }
});

test('R-FLR-009: the boss is reachable without spending gated resources', () => {
  for (let i = 0; i < 40; i += 1) {
    const { floor } = generateFor(`OFFICE-PATH-${String(i).padStart(4, '0')}`);
    const free = floor.distances(floor.startNodeId, {
      blockedDoorClasses: new Set([
        DOOR_CLASS.LOCKED_CARD, DOOR_CLASS.LOCKED_DOUBLE,
        DOOR_CLASS.BLAST_SECRET, DOOR_CLASS.RESTRICTED,
      ]),
    });
    assert.ok(free.has(floor.bossNodeId), `seed ${i}: boss behind a gated door`);
  }
});

test('R-FLR-010: hidden rooms start undiscovered and use only blast doors', () => {
  let hiddenSeen = 0;
  for (let i = 0; i < 40; i += 1) {
    const { floor } = generateFor(`OFFICE-HIDE-${String(i).padStart(4, '0')}`);
    for (const node of floor.nodes.values()) {
      if (!node.hidden) continue;
      hiddenSeen += 1;
      assert.equal(node.visited, false);
      for (const edgeId of node.edgeIds) {
        const edge = floor.edges.get(edgeId);
        assert.equal(edge.discovered, false, `${node.id} door pre-discovered`);
        assert.equal(edge.doorClass, DOOR_CLASS.BLAST_SECRET);
      }
    }
  }
  assert.ok(hiddenSeen > 0, 'no hidden rooms were generated at all');
});

test('R-FLR-002: the boss sits at or near the deepest point of the graph', () => {
  for (let i = 0; i < 40; i += 1) {
    const { floor } = generateFor(`OFFICE-DEEP-${String(i).padStart(4, '0')}`);
    const dist = floor.distances(floor.startNodeId);
    let max = 0;
    for (const [, d] of dist) if (d > max) max = d;
    const bossDist = dist.get(floor.bossNodeId);
    assert.ok(bossDist >= 3, `seed ${i}: boss only ${bossDist} from start`);
    assert.ok(bossDist >= max - 2, `seed ${i}: boss ${bossDist} vs max ${max}`);
  }
});

test('R-FLR-005: no footprint overlap and every door is two-way and aligned', () => {
  for (let i = 0; i < 40; i += 1) {
    const { floor } = generateFor(`OFFICE-DOOR-${String(i).padStart(4, '0')}`);
    const owner = new Map();
    for (const node of floor.nodes.values()) {
      for (const [x, y] of node.cells) {
        const key = `${x},${y}`;
        assert.ok(!owner.has(key), `seed ${i}: cell ${key} claimed twice`);
        owner.set(key, node.id);
      }
    }
    for (const edge of floor.edges.values()) {
      const a = floor.nodes.get(edge.a.nodeId);
      const b = floor.nodes.get(edge.b.nodeId);
      assert.ok(a.edgeIds.includes(edge.id) && b.edgeIds.includes(edge.id));
      assert.ok(edge.a.socketId, 'socket A unbound');
      assert.ok(edge.b.socketId, 'socket B unbound');
    }
  }
});

test('R-FLR-007: layout never binds an encounter', () => {
  const { floor } = generateFor('OFFICE-ENCX-0001');
  for (const node of floor.nodes.values()) {
    assert.equal(node.encounterId, null, `${node.id} bound an encounter during layout`);
  }
});

test('R-FLR-004: multi-cell rooms occur and can expose several doors', () => {
  let multiCell = 0;
  let multiDoorLarge = 0;
  for (let i = 0; i < 80; i += 1) {
    const { floor } = generateFor(`OFFICE-SIZE-${String(i).padStart(4, '0')}`);
    for (const node of floor.nodes.values()) {
      if (node.cells.length > 1) {
        multiCell += 1;
        if (node.doorCount > 2) multiDoorLarge += 1;
      }
    }
  }
  assert.ok(multiCell > 0, 'no multi-cell rooms were ever generated');
  assert.ok(multiDoorLarge > 0, 'no multi-cell room ever exposed more than two doors');
});

test('GDD 11.3: node counts stay inside the floor definition band', () => {
  for (let i = 0; i < 60; i += 1) {
    const { floor } = generateFor(`OFFICE-CNT-${String(i).padStart(4, '0')}`);
    // targetNodes bounds the *normal* graph; specials are added afterwards and
    // GDD 11.3 says they "do not all count toward target_normal_nodes".
    const normal = floor.metrics.normalNodes;
    assert.ok(normal >= 4, `seed ${i}: only ${normal} normal nodes`);
    assert.ok(
      floor.metrics.targetNormalNodes >= 10 && floor.metrics.targetNormalNodes <= 13,
      `seed ${i}: target ${floor.metrics.targetNormalNodes} outside [10,13]`,
    );
  }
});

test('GDD 20.7: generation stays well inside the 250ms budget', () => {
  const { generator, floorDef, validate } = makeHarness();
  const started = Date.now();
  const runs = 40;
  for (let i = 0; i < runs; i += 1) {
    generator.generate({ floorDef, rngSource: new RngSource(`OFFICE-PERF-${i}`), validate });
  }
  const perFloor = (Date.now() - started) / runs;
  assert.ok(perFloor < 250, `average generation ${perFloor.toFixed(1)}ms exceeds the 250ms budget`);
});

test('R-FLR-008: an impossible floor definition fails loudly, not silently', () => {
  const index = new TemplateIndex(fixtureTemplates().filter((t) => !t.roleTags?.includes?.(ROOM_ROLE.SHOP)
    && !t.roleTags.includes(ROOM_ROLE.SHOP)));
  const generator = new FloorGenerator({ templateIndex: index });
  const floorDef = fixtureFloorDef();
  assert.throws(
    () => generator.generate({ floorDef, rngSource: new RngSource('OFFICE-FAIL-0001'), maxAttempts: 3 }),
    GenerationError,
  );
});

test('deeper floors get larger rooms, per the 11.8 distribution', () => {
  const deepDef = {
    id: 'FLOOR-FIX-7', depth: 7, tier: 1, targetNodes: [17, 23],
    roomSizeDistribution: { single: 0.55, double: 0.25, large: 0.14, tiny: 0.06 },
  };
  let shallowLarge = 0;
  let deepLarge = 0;
  for (let i = 0; i < 30; i += 1) {
    const seed = `OFFICE-DIST-${String(i).padStart(4, '0')}`;
    for (const node of generateFor(seed).floor.nodes.values()) {
      if (node.sizeClass === ROOM_SIZE.LARGE || node.sizeClass === ROOM_SIZE.DOUBLE) shallowLarge += 1;
    }
    for (const node of generateFor(seed, deepDef).floor.nodes.values()) {
      if (node.sizeClass === ROOM_SIZE.LARGE || node.sizeClass === ROOM_SIZE.DOUBLE) deepLarge += 1;
    }
  }
  assert.ok(deepLarge > shallowLarge, `deep ${deepLarge} should exceed shallow ${shallowLarge}`);
});
