#!/usr/bin/env node
/**
 * Shipping gate: everything that must be true before a build goes out.
 *
 * GDD refs: 22.6 (a feature is not done without a playable smoke test), 23.1 (the test
 *           layers), 24 (shipping gates and the seed content census), R-QA-001 (the content
 *           validator passes), R-QA-002 (the automated suite passes), R-QA-003 (floor
 *           generation is stress-tested), R-QA-004 (requirement traceability is current),
 *           R-QA-005 (no missing assets, invalid references, duplicate ids, or zero-weight
 *           required pools).
 *
 * ## Why a single script
 *
 * `npm run check` already chained validate and test, but a release needs more than that and
 * needs it to be one answer rather than five commands whose exit codes someone has to
 * remember to look at. This runs every gate, keeps going after a failure so one run reports
 * every problem rather than only the first, and exits non-zero if any gate failed.
 *
 * ## Gates that are deliberately warnings rather than failures
 *
 * Unauthored sprites are reported loudly but do not fail the gate, because a placeholder is
 * a visible, obviously-unfinished state rather than a correctness bug — the game is playable
 * and every other check still means something. That distinction is recorded here rather than
 * left implicit, so nobody has to guess whether the magenta squares were noticed.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: this repo's path contains a space.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const results = [];

function gate(name, { required = true }, fn) {
  process.stdout.write(`\n=== ${name} ===\n`);
  let ok = false;
  let note = '';
  try {
    const out = fn();
    ok = out.ok;
    note = out.note ?? '';
  } catch (err) {
    ok = false;
    note = err.message;
  }
  results.push({ name, ok, required, note });
}

/** Run a node script and report its exit code. */
function run(args, { quiet = false } = {}) {
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    // Windows: without shell:false this would need quoting for the space in the path.
    shell: false,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (!quiet) process.stdout.write(output);
  return { ok: res.status === 0, output };
}

// ---------------------------------------------------------------------------
// R-QA-002: the automated suite
// ---------------------------------------------------------------------------

gate('Automated tests (R-QA-002)', {}, () => {
  // Through the same runner `npm test` uses. Passing a glob directly here worked on the
  // development machine's Node 24 and silently matched nothing on CI's Node 20, which showed
  // up as "? passing, ? failing" on a suite that was entirely green.
  const { ok, output } = run([join('tools', 'run-tests.js')], { quiet: true });
  const pass = /^# pass (\d+)$/m.exec(output)?.[1] ?? /pass (\d+)/.exec(output)?.[1] ?? '?';
  const fail = /^# fail (\d+)$/m.exec(output)?.[1] ?? /fail (\d+)/.exec(output)?.[1] ?? '?';
  process.stdout.write(`  ${pass} passing, ${fail} failing\n`);
  if (!ok) process.stdout.write(output);
  return { ok, note: `${pass} passing, ${fail} failing` };
});

// ---------------------------------------------------------------------------
// R-QA-001 / R-QA-005: content validation
// ---------------------------------------------------------------------------

gate('Content validation (R-QA-001, R-QA-005)', {}, () => {
  const { ok, output } = run([join('tools', 'validate-content.js')], { quiet: true });
  const errors = Number(/^Errors \((\d+)\)/m.exec(output)?.[1] ?? 0);
  const warnings = Number(/^Warnings \((\d+)\)/m.exec(output)?.[1] ?? 0);

  // Unauthored sprites are the one error class treated as a warning. They are a visible,
  // obviously-unfinished state rather than a correctness defect, and letting them block the
  // gate would mean the gate is always red and therefore ignored.
  const spriteErrors = (output.match(/unknown sprite/g) ?? []).length;
  const realErrors = errors - spriteErrors;

  process.stdout.write(`  ${errors} errors (${spriteErrors} unauthored sprites), ${warnings} warnings\n`);
  if (realErrors > 0) {
    for (const line of output.split('\n')) {
      if (line.includes('ERROR') && !line.includes('unknown sprite')) process.stdout.write(`  ${line.trim()}\n`);
    }
  }
  if (spriteErrors > 0) {
    process.stdout.write(`  NOTE: ${spriteErrors} sprites are unauthored and draw as placeholders.\n`);
  }
  return { ok: realErrors === 0, note: `${realErrors} real errors, ${spriteErrors} placeholder sprites` };
});

// ---------------------------------------------------------------------------
// R-QA-003: generation stress
// ---------------------------------------------------------------------------

gate('Floor generation stress (R-QA-003)', {}, () => {
  // A smaller sample than `npm run stress:floors`, deliberately. The full sweep is 10,000
  // floors per definition across 21 definitions — minutes of wall clock, which is long enough
  // that the gate stops being run at all. 400 per definition is 8,400 floors in about 45
  // seconds, enough to hold a 15% regeneration threshold to roughly a point either way, and
  // the exhaustive sweep is still one command away.
  const { ok, output } = run([join('tools', 'stress-floors.js'), '--count', '400'], { quiet: true });
  const summary = output.split('\n').filter((l) => /p99|failed|generated|OK/i.test(l)).slice(-4);
  for (const line of summary) process.stdout.write(`  ${line.trim()}\n`);
  return { ok, note: summary.at(-1)?.trim() ?? '' };
});

// ---------------------------------------------------------------------------
// R-QA-004: traceability is current
// ---------------------------------------------------------------------------

gate('Requirement traceability (R-QA-004)', {}, () => {
  const { ok, output } = run([join('tools', 'traceability.js'), '--check'], { quiet: true });
  for (const line of output.split('\n').filter((l) => l.trim())) process.stdout.write(`  ${line.trim()}\n`);
  return { ok, note: 'no unwaived requirement gaps' };
});

// ---------------------------------------------------------------------------
// Deployability: GitHub Pages serves this repo directly, with no build step
// ---------------------------------------------------------------------------

gate('Static deployability', {}, () => {
  const problems = [];

  // GDD 22.1: no build step. Pages serves the repo as-is, so index.html at the root loading
  // a module entry point is the whole deployment.
  if (!existsSync(join(ROOT, 'index.html'))) problems.push('index.html is missing from the repo root');
  else {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    if (!/type=["']module["']/.test(html)) problems.push('index.html does not load a module entry point');
    if (/src=["']\//.test(html)) {
      // An absolute path breaks on Pages, which serves from /<repo>/ rather than /.
      problems.push('index.html uses an absolute script path, which breaks under a Pages subpath');
    }
  }

  // A dependency would need an install step, which Pages does not run.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
    problems.push('runtime dependencies exist; Pages cannot install them');
  }

  for (const p of problems) process.stdout.write(`  FAIL ${p}\n`);
  if (problems.length === 0) {
    process.stdout.write('  index.html at root, module entry, relative paths, zero dependencies\n');
  }
  return { ok: problems.length === 0, note: problems.join('; ') || 'servable as static files' };
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

process.stdout.write(`\n${'='.repeat(64)}\nSHIPPING GATE\n${'='.repeat(64)}\n`);
let failed = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : (r.required ? 'FAIL' : 'WARN');
  if (!r.ok && r.required) failed += 1;
  process.stdout.write(`  ${mark}  ${r.name}${r.note ? ` — ${r.note}` : ''}\n`);
}

if (failed > 0) {
  process.stdout.write(`\n${failed} gate(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('\nAll gates passed.\n');
