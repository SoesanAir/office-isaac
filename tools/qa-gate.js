#!/usr/bin/env node
/**
 * Shipping gate: everything that must be true before a build goes out.
 *
 * GDD refs: 22.6 (a feature is not done without a playable smoke test), 23.1 (the test
 *           layers), 23.5 (the release gates, quoted below), 24 (the release content baseline).
 *
 * ## The release gate ids, corrected
 *
 * An earlier version of this file invented its own meanings for R-QA-001 to R-QA-004 —
 * "the content validator passes", "the automated suite passes", and so on. GDD 23.5 already
 * assigns those ids, and it assigns them to different things:
 *
 *   R-QA-001  No soft locks                  R-QA-005  Content validity
 *   R-QA-002  Determinism                    R-QA-006  Performance
 *   R-QA-003  Readability                    R-QA-007  Hidden content protection
 *   R-QA-004  Save integrity
 *
 * Only R-QA-005 happened to line up. The rest pointed the traceability report at the wrong
 * behaviour, which is worse than leaving them unlabelled: the report claimed coverage of
 * determinism and save integrity from a script that checks neither. The ids below are the
 * GDD's, and each gate now names the requirement it actually enforces.
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
// The automated suite, which is where R-QA-001 (no soft locks), R-QA-002 (determinism),
// R-QA-003 (readability), R-QA-004 (save integrity) and R-QA-007 (hidden content protection)
// are actually enforced — each by its own tests, named at those tests.
// ---------------------------------------------------------------------------

gate('Automated tests', {}, () => {
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
// R-QA-005: content validity — no missing assets, invalid references, duplicate ids, or
// zero-weight required pools.
// ---------------------------------------------------------------------------

gate('Content validity (R-QA-005)', {}, () => {
  const { ok, output } = run([join('tools', 'validate-content.js')], { quiet: true });
  const errors = Number(/^Errors \((\d+)\)/m.exec(output)?.[1] ?? 0);
  const warnings = Number(/^Warnings \((\d+)\)/m.exec(output)?.[1] ?? 0);

  // R-AI-004: a placeholder must be clearly labelled and must not masquerade as a completed
  // mechanic. Unauthored sprites are the one error class treated as a warning — they are a
  // visible, obviously-unfinished state rather than a correctness defect, and blocking the gate
  // on them would make it permanently red and therefore ignored. But they are COUNTED and
  // printed on every run, which is the "clearly labelled" half of the requirement.
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
// R-QA-006: performance.
//
// Partial, and worth being precise about which part. This enforces the generation budget —
// GDD 20.7's p99 — over thousands of floors, which is the half of R-QA-006 that can be
// measured in CI on hardware nobody chose. Sustained frame rate on target hardware in
// "representative worst cases" is the other half, and it is NOT verified here; that needs a
// device and a human. Recorded in the README's known gaps rather than implied to be covered.
// ---------------------------------------------------------------------------

gate('Generation performance (R-QA-006, partial)', {}, () => {
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
// R-AI-001: every implementation plan maps work to GDD requirement ids. This gate is what makes
// that checkable rather than aspirational, so the id lives here.
//
// Deliberately NOT R-QA-004 (that is Save integrity in GDD 23.5) and not R-GOV-003 (that is
// "content must be data-driven"). Both were considered and both are about something else; a
// convenient-looking id is exactly how a traceability report starts lying.
// ---------------------------------------------------------------------------

gate('Requirement traceability (R-AI-001)', {}, () => {
  const { ok, output } = run([join('tools', 'traceability.js'), '--check'], { quiet: true });
  for (const line of output.split('\n').filter((l) => l.trim())) process.stdout.write(`  ${line.trim()}\n`);
  return { ok, note: 'no unwaived requirement gaps' };
});

// ---------------------------------------------------------------------------
// GDD 24: the release content baseline.
//
// Keys on the seed catalogue — the content the GDD itself defines — and not on the north-star
// 1.0 targets, which GDD 24 explicitly permits a roadmap to phase. A gate that failed on the
// north star would be red from the first day of production to the last, and therefore ignored.
// ---------------------------------------------------------------------------

gate('Content baseline (GDD 24)', {}, () => {
  const { ok, output } = run([join('tools', 'content-baseline.js')], { quiet: true });
  const shortfall = output.includes('SEED CATALOGUE SHORTFALL');
  const lines = output.split('\n');
  const summary = lines.find((l) => l.includes('Seed catalogue:'))
    ?? lines.find((l) => l.includes('SHORTFALL'));
  process.stdout.write(`  ${(summary ?? '').trim()}\n`);
  // The distance still to travel, printed even when the gate passes: it is the honest measure of
  // how much content a 1.0 still wants, and hiding it behind a green tick would be the kind of
  // reassuring silence this whole script exists to avoid.
  const at = lines.findIndex((l) => l.includes('Remaining to the 1.0 north star'));
  if (at >= 0) {
    for (const line of lines.slice(at, at + 6)) process.stdout.write(`  ${line.trim()}\n`);
  }
  return { ok: ok && !shortfall, note: shortfall ? 'seed catalogue incomplete' : 'seed catalogue complete' };
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
