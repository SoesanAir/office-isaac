/**
 * Department identity and floor-generation coverage.
 *
 * GDD refs: 10.x (the department ladder), 11.4 step 10 (a node is matched to an authored
 *           template by footprint, socket mask, department, role, and tags), 12.2 (room
 *           roles and the shared service pool), R-DPT-001 (each department has a distinct
 *           primary mechanic), R-DPT-005 (a department is identifiable from one
 *           screenshot), R-FLR-001..010 (floor validity), §0.3 (the generator never
 *           synthesises geometry — a topology with no matching template is a retry).
 *
 * This file exists because the department dimension of template selection was dead code
 * for most of the project. Templates carry `departmentTags`, floors carry a department
 * *id*, and `candidates()` silently fell back to "every template in the game" whenever the
 * department was absent. So every floor drew Open Office rooms and nothing failed.
 *
 * The silent fallback is the part worth guarding. A test that only checks "floors generate"
 * would have passed throughout — the whole point of these tests is to assert that a floor's
 * rooms come from that floor's own department.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadContent } from '../content/index.js';
import '../src/register-all.js';
import { EventBus } from '../src/core/events.js';
import { Run } from '../src/systems/run.js';
import { TemplateIndex } from '../src/systems/template-index.js';
import { ROOM_ROLE } from '../src/core/constants.js';

const registry = loadContent({ strict: false });
const templates = registry.all('roomTemplate');
const departments = registry.all('department');
const index = new TemplateIndex(templates);

/** The roles whose architecture is department-specific and must never be shared. */
const IDENTITY_ROLES = [
  ROOM_ROLE.START, ROOM_ROLE.WORKROOM, ROOM_ROLE.HALLWAY, ROOM_ROLE.MANAGER_OFFICE,
];

test('every department has templates of its own', () => {
  for (const dept of departments) {
    const own = (index.byDepartment.get(dept.tag) || []);
    assert.ok(own.length > 0, `${dept.tag} has no room templates`);
  }
});

test('R-DPT-005: every department authors its own identity rooms', () => {
  // Start, normal, hallway and boss are where a department looks like itself. If any of
  // these fell back to the shared pool, two departments would be visually identical.
  for (const dept of departments) {
    const own = index.byDepartment.get(dept.tag) || [];
    for (const role of IDENTITY_ROLES) {
      const has = own.some((t) => t.roleTags.has(role));
      assert.ok(has, `${dept.tag} has no ${role} template of its own`);
    }
  }
});

test('GDD 12.2: the shared service pool covers the roles departments do not author', () => {
  // A supply closet is a supply closet everywhere, which is why each department declares a
  // TPL_SHARED_SERVICE pool. These roles must be reachable from every department without
  // thirteen copies existing.
  const shared = index.byDepartment.get('SERVICE_SHARED') || [];
  assert.ok(shared.length > 0, 'nothing carries the SERVICE_SHARED tag');
  for (const role of [ROOM_ROLE.SUPPLY_CLOSET, ROOM_ROLE.SHOP]) {
    assert.ok(shared.some((t) => t.roleTags.has(role)), `no shared template for ${role}`);
  }
  // And a department query must actually see them.
  for (const dept of departments) {
    const pool = index.forDepartment(dept.tag);
    assert.ok(
      pool.some((t) => t.roleTags.has(ROOM_ROLE.SUPPLY_CLOSET)),
      `${dept.tag} cannot draw a supply closet`,
    );
  }
});

test('identity rooms are never tagged SERVICE_SHARED', () => {
  // The inverse guard. Sharing a cubicle farm would put Open Office architecture on the
  // Board floor, which is exactly what R-DPT-005 forbids.
  for (const tpl of templates) {
    if (!tpl.departmentTags.includes('SERVICE_SHARED')) continue;
    const roles = new Set(tpl.roleTags);
    for (const role of [ROOM_ROLE.START, ROOM_ROLE.MANAGER_OFFICE]) {
      assert.equal(roles.has(role), false, `${tpl.id} shares a ${role} across departments`);
    }
  }
});

test('a department query never silently widens to the whole catalogue', () => {
  // The original defect: `candidates({ department: undefined })` returns everything, so a
  // caller that forgot to resolve its department got Open Office rooms on every floor and
  // no error. Asking for a real department must return strictly less than everything.
  for (const dept of departments) {
    const pool = index.forDepartment(dept.tag);
    assert.ok(
      pool.length < templates.length,
      `${dept.tag} draws from all ${templates.length} templates, so the filter is not applied`,
    );
  }
  // A department nobody authored returns only the shared set — not everything.
  const bogus = index.forDepartment('NOT_A_DEPARTMENT');
  const shared = index.byDepartment.get('SERVICE_SHARED') || [];
  assert.equal(bogus.length, shared.length);
});

// ---------------------------------------------------------------------------
// Generation coverage
// ---------------------------------------------------------------------------

const ALL_UNLOCKS = registry.all('unlock').map((u) => u.id);

/**
 * Walk a route to its end, collecting the floors visited.
 *
 * `Run.start({ floorId })` does NOT honour floorId — it always begins at route step zero.
 * Walking the route is the only way to reach a later department, and not knowing that is
 * how "all 21 floors generate" was measured while actually generating Open Office 21
 * times.
 */
function walkRoute(routeId, seed) {
  const run = new Run({ registry, events: new EventBus() });
  run.start({ seed, routeId, unlockFlags: ALL_UNLOCKS });
  const visited = [];
  let step = 0;
  while (step < 20) {
    visited.push({ floorId: run.floorDef.id, floor: run.floor, dept: run.department?.tag });
    if (!run.enterFloor(step + 1)) break;
    step += 1;
  }
  return visited;
}

test('R-FLR-001: every floor of every route generates', () => {
  const routes = registry.all('route').map((r) => r.id);
  let floors = 0;
  for (const routeId of routes) {
    for (const seed of ['OFFICE-DEPTGEN-0001', 'OFFICE-DEPTGEN-0002', 'OFFICE-DEPTGEN-0003']) {
      for (const stop of walkRoute(routeId, seed)) {
        assert.ok(stop.floor.nodes.size > 0, `${stop.floorId} generated an empty floor`);
        floors += 1;
      }
    }
  }
  assert.ok(floors > 40, `only generated ${floors} floors`);
});

test('R-DPT-005: a floor is built from its own department, plus shared service rooms', () => {
  // The assertion the silent fallback was hiding. Every room on an IT floor must come from
  // either the IT set or the shared service set — never from Open Office's identity rooms.
  const byId = new Map(templates.map((t) => [t.id, t]));
  for (const routeId of registry.all('route').map((r) => r.id)) {
    for (const stop of walkRoute(routeId, 'OFFICE-DEPTOWN-0001')) {
      for (const node of stop.floor.nodes.values()) {
        const tpl = byId.get(node.templateId);
        assert.ok(tpl, `${stop.floorId} used unknown template ${node.templateId}`);
        const tags = tpl.departmentTags;
        assert.ok(
          tags.includes(stop.dept) || tags.includes('SERVICE_SHARED'),
          `${stop.floorId} (${stop.dept}) used ${tpl.id}, tagged ${tags.join('/')}`,
        );
      }
    }
  }
});

test('every floor in the catalogue is declared by some route', () => {
  // Checked against the route GRAPH rather than by generating seeds. A seed sweep answers
  // "did we happen to roll it", which is luck: fourteen seeds of one family reached all
  // twenty-one floors while fourteen of another missed four. The invariant that actually
  // matters is that a floor is *declared* somewhere — a floor no route names is dead
  // content that still costs authoring and still appears in the collection.
  const declared = new Set();
  for (const route of registry.all('route')) {
    for (const step of route.steps || []) {
      if (step.floor) declared.add(step.floor);
      for (const alt of step.alternates || []) {
        declared.add(typeof alt === 'string' ? alt : alt.floor);
      }
    }
  }
  const missing = registry.all('floor').map((f) => f.id).filter((id) => !declared.has(id));
  assert.deepEqual(missing, [], `floors no route declares: ${missing.join(', ')}`);
});

test('every route continuation names a route that exists', () => {
  const ids = new Set(registry.all('route').map((r) => r.id));
  for (const route of registry.all('route')) {
    for (const cont of route.continuations || []) {
      assert.ok(ids.has(cont.route), `${route.id} continues into unknown ${cont.route}`);
    }
  }
});

test('every hazard a department declares exists, and every hazard an anchor names exists', () => {
  // Hazard ids live in effect params and template anchors as plain strings, so nothing
  // schema-checked them. Three invalid ids shipped this way — HAZ-ELECTRICITY_SHOCK_LANE
  // and HAZ-RED_TAPE_COMPLIANCE_BAND against the real HAZ-ELEC_SHOCK_LANE and
  // HAZ-REDTAPE_COMPLIANCE_BAND — and the only symptom was a hazard that never appeared.
  const families = new Set(registry.all('hazard').map((h) => h.family));
  for (const dept of departments) {
    for (const family of dept.hazardSets || []) {
      assert.ok(families.has(family), `${dept.tag} declares unknown hazard family ${family}`);
    }
  }
  for (const tpl of templates) {
    for (const anchor of tpl.hazardAnchors || []) {
      assert.ok(
        registry.get('hazard', anchor.hazard),
        `${tpl.id} anchors unknown hazard ${anchor.hazard}`,
      );
    }
  }
});

test('every object anchor names an env object that exists', () => {
  for (const tpl of templates) {
    for (const anchor of tpl.objectAnchors || []) {
      for (const id of anchor.allow) {
        assert.ok(registry.get('envObject', id), `${tpl.id} anchors unknown object ${id}`);
      }
    }
  }
});
