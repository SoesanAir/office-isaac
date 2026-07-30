#!/usr/bin/env node
/**
 * Measure the build against GDD 24, the Release Content Baseline.
 *
 * GDD refs: 24 (the release content baseline table, transcribed below), 24.1 (content quality
 *           threshold), 23.5 (release gates), R-GOV-001 (the GDD is the design authority).
 *
 * ## Why two targets per row and not one
 *
 * GDD 24 states its own terms plainly: "This is the north-star content target for a complete
 * 1.0, not the order in which development should occur. A production roadmap may reduce or
 * phase content, but architecture must support these counts without redesign."
 *
 * So the table carries two columns, and conflating them would produce a misleading answer in
 * either direction. The *seed catalogue* column is what the GDD itself defines and is therefore
 * the real, checkable obligation for this build — falling short of it means the game does not
 * implement its own design document. The *north-star* column is a 1.0 content goal that the same
 * section explicitly permits a roadmap to phase.
 *
 * Reporting only the north-star would say the game is a third finished when it implements every
 * item the GDD describes. Reporting only the seed would imply there is nothing left to author.
 * Both are printed, and the exit status keys on the seed catalogue alone, because that is the
 * column that represents a broken promise rather than an unfinished one.
 *
 * ## What this deliberately does not check
 *
 * GDD 24.1's quality thresholds — "a new enemy needs a distinct recognition and counterplay
 * reason to exist", "a new department needs mechanical identity, not a palette swap". Those are
 * judgements, not counts, and a script claiming to verify them would be the most dishonest thing
 * in the repository. They are review criteria for a human, and they are quoted at the bottom of
 * the report so a reviewer is looking at them while reading the numbers.
 */

import { loadContent } from '../content/index.js';
import '../src/register-all.js';

/**
 * GDD 24, transcribed. `seed` is the "Defined in this GDD seed catalog" column; `north` is the
 * "North-star 1.0 target" column. A null seed means the GDD defines a system rather than a
 * count, so there is no number to fall short of.
 */
const BASELINE = Object.freeze([
  // Counted in FLOORS, because that is the unit GDD 24 uses ("4 pairs / 8 floors"), and counted
  // off `routeRole` because that is the field the department definitions actually carry — there
  // is no `tier`. Getting this wrong reported 0 of 8 for content that was entirely present,
  // which is the failure mode a baseline report can least afford.
  { family: 'Core departments', kind: 'department', seed: 8, north: 8, note: '4 pairs / 8 floors',
    count: (all) => all.filter((d) => /^Core chapter/.test(d.routeRole))
      .reduce((n, d) => n + (d.floors?.length ?? 0), 0) },
  { family: 'Alternate department pairs', kind: 'department', seed: 6, north: 6,
    note: '3 pairs / 6 floors',
    count: (all) => all.filter((d) => /alternate chapter/i.test(d.routeRole))
      .reduce((n, d) => n + (d.floors?.length ?? 0), 0) },
  { family: 'Secret / postgame areas', kind: 'department', seed: 6, north: 5,
    count: (all) => all.filter((d) => /secret|hidden/i.test(d.routeRole)).length },
  { family: 'Room templates', kind: 'roomTemplate', seed: null, north: 350 },
  { family: 'Encounter definitions', kind: 'encounter', seed: null, north: 450 },
  { family: 'Weapons', kind: 'weapon', seed: 14, north: 24 },
  { family: 'Passive items', kind: 'passive', seed: 60, north: 220 },
  { family: 'Active items', kind: 'active', seed: 15, north: 30 },
  { family: 'Action Cards', kind: 'card', seed: 18, north: 36 },
  { family: 'Supplement effects', kind: 'supplement', seed: 14, north: 20 },
  { family: 'Desk Charms', kind: 'charm', seed: 18, north: 50 },
  { family: 'Transformations', kind: 'transformation', seed: 4, north: 12 },
  { family: 'Standard enemies', kind: 'enemy', seed: 58, north: 70 },
  { family: 'Bosses and ultra bosses', kind: 'boss', seed: 29, north: 30 },
  { family: 'Employee profiles', kind: 'profile', seed: 8, north: 8 },
  { family: 'Challenges', kind: 'challenge', seed: null, north: 20 },
  { family: 'Endings', kind: 'ending', seed: 9, north: 9 },
]);

/** GDD 24.1, quoted verbatim. Judgement, not arithmetic — printed for the human reading this. */
const QUALITY_THRESHOLD = Object.freeze([
  'A new item needs a visible or strategic effect, not merely a microscopic stat delta.',
  'A new enemy needs a distinct recognition and counterplay reason to exist.',
  'A new room template needs meaningful geometry, story, object arrangement, or special purpose.',
  'A new department needs mechanical identity, not a palette swap.',
  'A new boss needs one memorable core idea and an arena that supports it.',
  'A new secret needs a clue, rule, or discovery path that feels fair in hindsight.',
]);

const registry = loadContent({ strict: false });
const args = process.argv.slice(2);

const rows = BASELINE.map((row) => {
  const all = registry.all(row.kind) ?? [];
  const have = row.count ? row.count(all) : all.length;
  return {
    ...row,
    have,
    seedMet: row.seed === null ? null : have >= row.seed,
    northMet: have >= row.north,
    northPct: Math.round((have / row.north) * 100),
  };
});

const seedShortfall = rows.filter((r) => r.seedMet === false);
const northRemaining = rows.filter((r) => !r.northMet);

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

let out = '';
out += 'Release content baseline (GDD 24)\n';
out += '='.repeat(74) + '\n';
out += `  ${pad('Family', 26)}${lpad('built', 7)}${lpad('seed', 7)}${lpad('1.0', 7)}${lpad('of 1.0', 9)}\n`;
out += '  ' + '-'.repeat(70) + '\n';
for (const r of rows) {
  const seedCell = r.seed === null ? 'system' : `${r.seed}${r.seedMet ? '' : ' !'}`;
  out += `  ${pad(r.family, 26)}${lpad(r.have, 7)}${lpad(seedCell, 7)}`
    + `${lpad(r.north, 7)}${lpad(`${r.northPct}%`, 9)}${r.northMet ? '  met' : ''}\n`;
}

out += '\n';
if (seedShortfall.length === 0) {
  out += '  Seed catalogue: every family the GDD defines is fully implemented.\n';
} else {
  out += '  SEED CATALOGUE SHORTFALL — the GDD defines content this build does not have:\n';
  for (const r of seedShortfall) {
    out += `    ${r.family}: ${r.have} of ${r.seed}\n`;
  }
}

if (northRemaining.length > 0) {
  out += '\n  Remaining to the 1.0 north star (GDD 24 permits a roadmap to phase these):\n';
  for (const r of northRemaining.sort((a, b) => a.northPct - b.northPct)) {
    out += `    ${pad(r.family, 26)}${lpad(`${r.have} / ${r.north}`, 12)}  (+${r.north - r.have})\n`;
  }
}

out += '\n  Not measured here — GDD 24.1 quality thresholds are judgement, not counts:\n';
for (const line of QUALITY_THRESHOLD) out += `    - ${line}\n`;

process.stdout.write(out);

if (args.includes('--json')) {
  process.stdout.write(`\n${JSON.stringify({ rows, seedShortfall: seedShortfall.map((r) => r.family) }, null, 2)}\n`);
}

// Exit status keys on the seed catalogue only. Falling short there means the build does not
// implement its own design document, which is a defect. Falling short of the north star is a
// roadmap position that GDD 24 explicitly allows, and failing a gate for it would make the gate
// meaningless from the first day of production to the last.
if (seedShortfall.length > 0) {
  process.stdout.write('\nRESULT: seed catalogue incomplete.\n');
  process.exit(1);
}
process.stdout.write('\nRESULT: seed catalogue complete.\n');
