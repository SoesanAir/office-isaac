#!/usr/bin/env node
/**
 * Run the test suite.
 *
 * GDD refs: 22.6 (a feature is not done without a test), 23.1 (the test layers), R-QA-002.
 *
 * ## Why this exists rather than `node --test tests/*.test.js`
 *
 * That command is not portable, and the way it failed was expensive to diagnose.
 *
 * Glob expansion inside `--test` arguments is a Node 22+ feature. On the development machine
 * (Node 24) the pattern expanded and 262 tests ran; in CI on Node 20 the pattern was passed
 * through literally, no file matched, and the runner exited non-zero with no test output at all.
 * The shipping gate then reported "? passing, ? failing" — a red gate that looked like a broken
 * regex rather than a broken command, on a suite that was in fact entirely green.
 *
 * Passing the shell the job instead does not fix it either: npm scripts run under `sh` on Linux
 * and `cmd` on Windows, and only one of those expands globs.
 *
 * So the file list is built here, with `readdirSync`, and handed to the runner explicitly. That
 * works identically on every supported Node and both operating systems, which is the whole
 * requirement. package.json declares `>=20`; this is what makes that claim true rather than
 * aspirational.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: this repo's path contains a space, which .pathname
// percent-encodes and every subsequent fs call then fails to find.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_DIR = join(ROOT, 'tests');

const files = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith('.test.js'))
  // Stable order, so two runs of the suite are comparable line by line.
  .sort()
  .map((name) => join(TEST_DIR, name));

if (files.length === 0) {
  process.stdout.write('No test files found in tests/.\n');
  process.exit(1);
}

// Any extra arguments are forwarded, so `npm test -- --test-name-pattern=touch` still works.
const passthrough = process.argv.slice(2);

const res = spawnSync(process.execPath, ['--test', ...passthrough, ...files], {
  cwd: ROOT,
  stdio: 'inherit',
  // shell:false so the space in the repo path needs no quoting.
  shell: false,
});

process.exit(res.status ?? 1);
