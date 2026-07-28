#!/usr/bin/env node
/**
 * Headless floor generation stress harness.
 *
 * GDD refs: 23.2 (Procedural test suite: "Generate at least 10,000 floors per
 *           normal floor definition in headless validation"; assert connectivity,
 *           role counts, dead-end minimums, footprint non-overlap, socket
 *           alignment, critical-path access; validate secret blast points; record
 *           regeneration rate and investigate definitions that fail more than the
 *           accepted threshold), R-QA-001 (no soft locks), R-FLR-001..010,
 *           20.7 (generation under 250ms).
 *
 * Usage:
 *   node tools/stress-floors.js                  # 10,000 floors per definition
 *   node tools/stress-floors.js --count 500      # quick pass
 *   node tools/stress-floors.js --floor FLOOR-OPEN-OFFICE-1
 *   node tools/stress-floors.js --json out.json
 *
 * Exit code is non-zero when any definition breaches a threshold, so this is
 * usable as a release gate.
 */

import { writeFileSync } from 'node:fs';
import { loadContent } from '../content/index.js';
import { RngSource } from '../src/core/rng.js';
import { TemplateIndex } from '../src/systems/template-index.js';
import { FloorGenerator, GenerationError } from '../src/systems/floorgen.js';
import { makeFloorValidator } from '../src/systems/floor-validate.js';
import '../src/register-all.js';

/** Thresholds. A definition breaching any of these needs design attention. */
const THRESHOLDS = {
  /** Share of floors needing more than one attempt. */
  maxRegenerationRate: 0.15,
  /** Any hard failure after all attempts is unacceptable. */
  maxFailureRate: 0.0,
  /** GDD 20.7 budget, measured as a p99 so one slow outlier does not mask health. */
  maxP99Ms: 250,
  /** A floor with no secret room at all should be rare, not routine. */
  minSecretRate: 0.5,
};

function parseArgs(argv) {
  const args = { count: 10000, floor: null, json: null, quiet: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '--floor') args.floor = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--quiet') args.quiet = true;
  }
  return args;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function main() {
  const args = parseArgs(process.argv);
  const registry = loadContent({ strict: false });
  const templates = registry.all('roomTemplate');
  const floors = registry.all('floor').filter((f) => !args.floor || f.id === args.floor);

  if (templates.length === 0) {
    process.stderr.write(
      'No room templates registered yet. Author content/rooms/* first — the harness\n'
      + 'deliberately refuses to run against synthesised geometry (GDD 0.3).\n',
    );
    process.exit(2);
  }
  if (floors.length === 0) {
    process.stderr.write('No floor definitions registered yet (content/departments/floors.js).\n');
    process.exit(2);
  }

  const index = new TemplateIndex(templates);
  const generator = new FloorGenerator({ templateIndex: index });
  const results = [];
  let anyBreach = false;

  for (const floorDef of floors) {
    // The generator reads departmentTag; department definitions carry the tag.
    const department = registry.get('department', floorDef.department);
    const resolved = { ...floorDef, departmentTag: department?.tag ?? floorDef.department };
    const validate = makeFloorValidator({ templateIndex: index, floorDef: resolved });

    const stat = {
      floor: floorDef.id,
      department: resolved.departmentTag,
      depth: floorDef.depth,
      generated: 0,
      failed: 0,
      retried: 0,
      totalAttempts: 0,
      warnings: new Map(),
      errors: new Map(),
      nodeCounts: [],
      deadEnds: [],
      bossDistances: [],
      withSecret: 0,
      times: [],
      templateCoverage: index.coverage(resolved.departmentTag, floorDef.depth),
    };

    for (let i = 0; i < args.count; i += 1) {
      const seed = `OFFICE-ST${String(i).padStart(6, '0')}`;
      const rngSource = new RngSource(seed);
      const started = process.hrtime.bigint();
      try {
        const { floor, attempts, validation } = generator.generate({ floorDef: resolved, rngSource, validate });
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        stat.generated += 1;
        stat.totalAttempts += attempts;
        if (attempts > 1) stat.retried += 1;
        stat.times.push(ms);
        stat.nodeCounts.push(floor.nodes.size);
        stat.deadEnds.push(floor.metrics.deadEnds);
        stat.bossDistances.push(floor.metrics.bossDistance ?? 0);
        if ((floor.metrics.secrets || []).length > 0) stat.withSecret += 1;
        for (const w of validation.warnings || []) {
          const key = w.replace(/TPL-[A-Z0-9_-]+/g, 'TPL-*').replace(/\d+/g, 'N');
          stat.warnings.set(key, (stat.warnings.get(key) || 0) + 1);
        }
      } catch (err) {
        stat.failed += 1;
        const key = err instanceof GenerationError
          ? `${err.stage}: ${String(err.message).split('\n')[0].replace(/\d+/g, 'N')}`
          : String(err.message);
        stat.errors.set(key, (stat.errors.get(key) || 0) + 1);
      }
    }

    const attempted = stat.generated + stat.failed;
    stat.regenerationRate = attempted ? stat.retried / attempted : 0;
    stat.failureRate = attempted ? stat.failed / attempted : 0;
    stat.secretRate = stat.generated ? stat.withSecret / stat.generated : 0;
    const sortedTimes = [...stat.times].sort((a, b) => a - b);
    stat.medianMs = percentile(sortedTimes, 50);
    stat.p99Ms = percentile(sortedTimes, 99);
    stat.meanNodes = mean(stat.nodeCounts);
    stat.meanDeadEnds = mean(stat.deadEnds);
    stat.meanBossDistance = mean(stat.bossDistances);

    stat.breaches = [];
    if (stat.failureRate > THRESHOLDS.maxFailureRate) {
      stat.breaches.push(`failure rate ${pct(stat.failureRate)} exceeds ${pct(THRESHOLDS.maxFailureRate)}`);
    }
    if (stat.regenerationRate > THRESHOLDS.maxRegenerationRate) {
      stat.breaches.push(`regeneration rate ${pct(stat.regenerationRate)} exceeds ${pct(THRESHOLDS.maxRegenerationRate)}`);
    }
    if (stat.p99Ms > THRESHOLDS.maxP99Ms) {
      stat.breaches.push(`p99 ${stat.p99Ms.toFixed(1)}ms exceeds ${THRESHOLDS.maxP99Ms}ms`);
    }
    if (stat.secretRate < THRESHOLDS.minSecretRate) {
      stat.breaches.push(`secret-room rate ${pct(stat.secretRate)} below ${pct(THRESHOLDS.minSecretRate)}`);
    }
    if (stat.breaches.length > 0) anyBreach = true;
    results.push(stat);

    if (!args.quiet) process.stdout.write(formatStat(stat, args.count));
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(results.map(serialisable), null, 2));
    process.stdout.write(`\nWrote ${args.json}\n`);
  }

  process.stdout.write(anyBreach
    ? '\nRESULT: threshold breaches found (see above).\n'
    : '\nRESULT: all floor definitions within thresholds.\n');
  process.exit(anyBreach ? 1 : 0);
}

function mean(list) {
  return list.length === 0 ? 0 : list.reduce((a, b) => a + b, 0) / list.length;
}

function pct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

function serialisable(stat) {
  return {
    ...stat,
    warnings: [...stat.warnings.entries()].map(([k, v]) => ({ warning: k, count: v })),
    errors: [...stat.errors.entries()].map(([k, v]) => ({ error: k, count: v })),
    times: undefined,
    nodeCounts: undefined,
    deadEnds: undefined,
    bossDistances: undefined,
  };
}

function formatStat(stat, count) {
  const lines = [];
  lines.push('');
  lines.push(`${stat.floor}  (${stat.department}, depth ${stat.depth})`);
  lines.push('-'.repeat(64));
  lines.push(`  floors generated     ${stat.generated}/${count}`);
  lines.push(`  hard failures        ${stat.failed} (${pct(stat.failureRate)})`);
  lines.push(`  regeneration rate    ${pct(stat.regenerationRate)}`);
  lines.push(`  gen time med / p99   ${stat.medianMs.toFixed(2)}ms / ${stat.p99Ms.toFixed(2)}ms`);
  lines.push(`  mean nodes           ${stat.meanNodes.toFixed(1)}`);
  lines.push(`  mean dead ends       ${stat.meanDeadEnds.toFixed(1)}`);
  lines.push(`  mean boss distance   ${stat.meanBossDistance.toFixed(1)}`);
  lines.push(`  floors with a secret ${pct(stat.secretRate)}`);
  lines.push(`  template coverage    ${JSON.stringify(stat.templateCoverage)}`);
  if (stat.errors.size > 0) {
    lines.push('  failure reasons:');
    for (const [key, n] of [...stat.errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`    ${String(n).padStart(6)}  ${key}`);
    }
  }
  if (stat.warnings.size > 0) {
    lines.push('  top validation warnings:');
    for (const [key, n] of [...stat.warnings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`    ${String(n).padStart(6)}  ${key}`);
    }
  }
  for (const breach of stat.breaches) lines.push(`  BREACH: ${breach}`);
  return `${lines.join('\n')}\n`;
}

main();
