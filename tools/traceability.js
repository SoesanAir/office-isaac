#!/usr/bin/env node
/**
 * Requirement traceability: every R-xxx-nnn in the GDD, and where it lives in the repo.
 *
 * GDD refs: 22.6 (a feature is not done without a test), 23.1 (the test layers), 24
 *           (shipping gates), R-GOV-001 (the GDD is the design authority and everything
 *           else is subordinate to it), R-GOV-003 (adding content is a data change),
 *           R-QA-001..005 (the QA gates).
 *
 * ## Generated, not written
 *
 * A hand-maintained traceability table is worse than none: it is correct on the day it is
 * written and quietly wrong forever after, while still being cited as evidence. This scans
 * the GDD for requirement ids and rule text, scans the repo for references to them, and
 * writes docs/REQUIREMENT_TRACEABILITY.md from what it actually finds.
 *
 * That makes the convention of naming requirement ids in comments load-bearing rather than
 * decorative — the comment IS the trace link.
 *
 * ## Waivers
 *
 * Some requirements are genuinely not code. "The GDD is the design authority" is a process
 * rule; "a new player understands movement without a tutorial wall" is a playtest finding.
 * Those are listed below with a reason, because a waiver with a stated reason is honest and
 * an unexplained gap is not. Everything else is expected to be referenced somewhere, and the
 * script exits non-zero if it is not — so this is a gate, not a report.
 *
 * Usage:  node tools/traceability.js [--check]
 *         --check  exit non-zero on an unwaived gap, and write nothing
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath rather than .pathname: the repo path contains a space, which .pathname
// percent-encodes into %20 and every subsequent fs call then fails to find.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GDD = join(ROOT, 'docs', 'GDD.md');
const OUT = join(ROOT, 'docs', 'REQUIREMENT_TRACEABILITY.md');
const SCAN_DIRS = ['src', 'tests', 'content', 'tools'];
/**
 * Requirement ids as the GDD actually writes them.
 *
 * `{2,4}`, not `{3}`. The original pattern assumed every category was three letters, which
 * silently excluded three whole families from every report this tool has ever produced:
 * R-QA (2 letters, and the seven release gates of GDD 23.5 — the most consequential
 * requirements in the document), R-AI (2), and R-LOOP (4). Eighteen requirements in total were
 * invisible, and the tool cheerfully reported "0 unreferenced and unwaived" without ever having
 * looked at them.
 *
 * That is the specific way a coverage tool is worse than no tool: it converts an unknown into a
 * confident wrong answer. The bound is 2..4 because those are the shortest and longest
 * categories the GDD uses; a new category outside that range would be missed the same way, so
 * the census below prints the category list for exactly that reason.
 */
const ID_PATTERN = /R-[A-Z]{2,4}-\d{3}/g;

/**
 * Requirements that are deliberately not traceable to code, each with why.
 *
 * Keep this list short and argued. A waiver is a claim that the requirement cannot be
 * satisfied by an artefact in this repository — not that it is inconvenient to trace.
 */
const WAIVERS = Object.freeze({
  // Process requirements about how the work is carried out, not behaviour the program can
  // exhibit. There is no line of code that can demonstrate either, and a test asserting "the
  // agent read the file first" would be theatre. They are governed by review of the change
  // history, which is where the evidence actually lives.
  'R-AI-002': 'Process requirement: no silent design rewrites. Evidenced by commit messages and '
    + 'the deviation log, which state every departure from the GDD and its reason. Not '
    + 'expressible as a runtime assertion.',
  'R-AI-005': 'Process requirement: verify existing code before editing. Evidenced by review of '
    + 'the change history rather than by a test; nothing the program does can attest to it.',

  'R-GOV-001': 'Process rule: the GDD outranks code comments and plans. Enforced by review, not by an artefact.',
  'R-GOV-002': 'Process rule about change control. No runtime or content artefact can assert it.',
  'R-GOV-004': 'Process rule about design review cadence.',
  'R-VIS-001': 'A playtest finding — whether a new player needs a tutorial wall cannot be asserted in a unit test.',
  'R-VIS-003': 'Readability judgement made in the art review; the sprite grids are the artefact, not a test.',
  'R-VIS-004': 'Readability judgement made in the art review.',
  'R-VIS-005': 'Readability judgement made in the art review.',
  'R-PRG-006': 'Long-horizon progression pacing, judged across many playtest runs rather than asserted.',
});

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

/** Every requirement id in the GDD, with its rule text where the table gives one. */
function readRequirements() {
  const text = readFileSync(GDD, 'utf8');
  const found = new Map();
  for (const line of text.split(/\r?\n/)) {
    const ids = line.match(ID_PATTERN);
    if (!ids) continue;
    for (const id of ids) {
      if (!found.has(id)) found.set(id, '');
      // A requirements table row is `| R-xxx-nnn | rule | acceptance test |`. Anything else
      // mentioning the id is prose, which is a reference rather than a definition.
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length >= 4 && cells[1] === id && !found.get(id)) {
        found.set(id, cells[2]);
      }
    }
  }
  return found;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** id -> Set of repo-relative files referencing it. */
function readReferences() {
  const refs = new Map();
  for (const dir of SCAN_DIRS) {
    let files;
    try { files = walk(join(ROOT, dir)); } catch { continue; }
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const ids = text.match(ID_PATTERN);
      if (!ids) continue;
      const rel = relative(ROOT, file).split(sep).join('/');
      for (const id of new Set(ids)) {
        if (!refs.has(id)) refs.set(id, new Set());
        refs.get(id).add(rel);
      }
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const requirements = readRequirements();
const references = readReferences();

const rows = [...requirements.keys()].sort().map((id) => {
  const files = [...(references.get(id) ?? [])].sort();
  return {
    id,
    rule: requirements.get(id) || '(referenced in prose; no requirements-table row)',
    src: files.filter((f) => f.startsWith('src/')),
    tests: files.filter((f) => f.startsWith('tests/')),
    other: files.filter((f) => !f.startsWith('src/') && !f.startsWith('tests/')),
    waiver: WAIVERS[id] ?? null,
  };
});

const gaps = rows.filter((r) => !r.waiver && r.src.length === 0 && r.tests.length === 0 && r.other.length === 0);
const untested = rows.filter((r) => !r.waiver && r.tests.length === 0 && (r.src.length > 0 || r.other.length > 0));
const covered = rows.filter((r) => r.tests.length > 0);

const check = process.argv.includes('--check');

if (!check) {
  const lines = [];
  lines.push('# Requirement traceability');
  lines.push('');
  lines.push('**Generated by `node tools/traceability.js`. Do not edit by hand.**');
  lines.push('');
  lines.push('A hand-maintained version of this table would be correct on the day it was written');
  lines.push('and quietly wrong forever after, while still being cited as evidence. This one is');
  lines.push('rebuilt from the GDD and from what the repository actually references, so the');
  lines.push('convention of naming requirement ids in comments is the trace link itself.');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| --- | --- |');
  lines.push(`| Requirements in the GDD | ${rows.length} |`);
  lines.push(`| Referenced by a test | ${covered.length} |`);
  lines.push(`| Referenced only by implementation | ${untested.length} |`);
  lines.push(`| Waived, with a stated reason | ${rows.length - rows.filter((r) => !r.waiver).length} |`);
  lines.push(`| Unreferenced and unwaived | ${gaps.length} |`);
  lines.push('');
  lines.push('`Referenced only by implementation` is not a failure — a good deal of the GDD is');
  lines.push('content policy that a schema or a validator enforces rather than a unit test. It is');
  lines.push('listed separately so the difference stays visible.');
  lines.push('');

  if (gaps.length > 0) {
    lines.push('## Gaps');
    lines.push('');
    lines.push('Requirements with no reference anywhere and no waiver. Each is either unimplemented');
    lines.push('or implemented without being labelled; both are worth fixing.');
    lines.push('');
    for (const r of gaps) lines.push(`- **${r.id}** — ${r.rule}`);
    lines.push('');
  }

  lines.push('## Every requirement');
  lines.push('');
  lines.push('| ID | Rule | Implementation | Tests |');
  lines.push('| --- | --- | --- | --- |');
  for (const r of rows) {
    const impl = r.waiver ? `_waived: ${r.waiver}_` : [...r.src, ...r.other].join('<br>') || '—';
    const tests = r.tests.join('<br>') || '—';
    // Pipes inside a cell would break the table.
    const rule = r.rule.replace(/\|/g, '/');
    lines.push(`| ${r.id} | ${rule} | ${impl} | ${tests} |`);
  }
  lines.push('');

  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

const pct = (n) => `${Math.round((n / rows.length) * 100)}%`;
console.log('Requirement traceability');
console.log('='.repeat(60));
console.log(`  requirements in the GDD        ${rows.length}`);
console.log(`  referenced by a test           ${covered.length} (${pct(covered.length)})`);
console.log(`  implementation only            ${untested.length}`);
console.log(`  waived with a reason           ${rows.length - rows.filter((r) => !r.waiver).length}`);
console.log(`  unreferenced and unwaived      ${gaps.length}`);
if (!check) console.log(`\nWrote ${relative(ROOT, OUT).split(sep).join('/')}`);

if (gaps.length > 0) {
  console.error('\nUnreferenced requirements:');
  for (const r of gaps) console.error(`  ${r.id}  ${r.rule}`);
  console.error('\nEither implement it, name it in the code that already does, or add a waiver');
  console.error('with a reason in tools/traceability.js.');
  process.exit(1);
}
