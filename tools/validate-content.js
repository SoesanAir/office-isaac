#!/usr/bin/env node
/**
 * Content validator.
 *
 * GDD refs: R-TEC-005 (content validated at build and load time; invalid
 *           references, weights, sockets, tags and missing assets fail loudly),
 *           R-QA-005 (no missing assets, invalid references, duplicate ids, or
 *           zero-weight required pools), 23.1 "Schema" test layer.
 *
 * Runs the schema pass, the cross-reference link pass, then a set of global
 * checks that no single-definition schema can express: hook and adapter
 * coverage, localization coverage, pickup-phrase numerals, pool reachability,
 * silhouette collisions, and content census against the GDD §24 baseline.
 */

import { loadContent } from '../content/index.js';
import { findMissingHooks } from '../src/systems/effects.js';
import { findMissingAdapters } from '../src/systems/adapters.js';
import { findMissingBehaviours } from '../src/entities/enemy-controllers.js';
import { findMissingBossPatterns } from '../src/entities/boss-patterns.js';
import { allSpriteDefs, silhouetteSignature } from '../src/render/sprites.js';
import '../src/register-all.js';

const errors = [];
const warnings = [];

function err(where, message) { errors.push(`${where}: ${message}`); }
function warn(where, message) { warnings.push(`${where}: ${message}`); }

const registry = loadContent({ strict: false });

// -- schema + link results ---------------------------------------------------
for (const e of registry.issues.errors) err(e.path, e.message);
for (const w of registry.issues.warnings) warn(w.path, w.message);

// -- hook and adapter coverage ----------------------------------------------
for (const miss of findMissingHooks(registry)) {
  err(`${miss.kind}:${miss.id}`, `effect hook "${miss.hook}" is not registered`);
}
for (const miss of findMissingAdapters(registry)) {
  err(`passive/weapon:${miss.id}`, `adapter "${miss.adapter}" missing at ${miss.where}`);
}
// Enemy controllers, attack modules, and variant behaviour modules. GDD 20.3
// forbids runtime AI generation, so every behaviour an enemy names must already
// exist as a curated module — a missing one is a hard content error, not a
// fallback-to-idle situation.
for (const miss of findMissingBehaviours(registry)) {
  err(`${miss.id}`, `${miss.kind} "${miss.name}" is not registered`);
}
// Boss patterns and movement rules, same rule for the same reason (GDD 15.4).
for (const miss of findMissingBossPatterns(registry)) {
  err(`boss:${miss.id}.${miss.phase}`, `${miss.kind} "${miss.name}" is not registered`);
}

// -- sprite references ------------------------------------------------------
const spriteIds = new Set(registry.ids('sprite'));
const spriteBearing = [
  ['weapon', 'spriteId'], ['weapon', 'heldSpriteId'], ['passive', 'spriteId'],
  ['active', 'spriteId'], ['card', 'spriteId'], ['supplement', 'spriteId'],
  ['charm', 'spriteId'], ['transformation', 'spriteId'], ['enemy', 'spriteId'],
  ['boss', 'spriteId'], ['envObject', 'spriteId'], ['hazard', 'spriteId'],
  ['profile', 'spriteId'],
];
for (const [kind, field] of spriteBearing) {
  for (const def of registry.all(kind)) {
    const id = def[field];
    if (id && !spriteIds.has(id)) {
      err(`${kind}:${def.id}.${field}`, `references unknown sprite "${id}" (R-QA-005)`);
    }
  }
}

// -- localization coverage (R-TEC-005 "missing assets fail loudly") ---------
const locTables = registry.all('localization');
const english = locTables.find((t) => t.language === 'en') || locTables[0];
if (!english) {
  err('localization', 'no localization table registered');
} else {
  const keys = new Set(Object.keys(english.strings));
  const locFields = [
    ['weapon', 'nameLoc'], ['weapon', 'descriptionLoc'],
    ['passive', 'nameLoc'], ['passive', 'pickupPhraseLoc'], ['passive', 'collectionLoc'],
    ['active', 'nameLoc'], ['active', 'pickupPhraseLoc'],
    ['card', 'nameLoc'], ['card', 'descriptionLoc'],
    ['supplement', 'nameLoc'], ['supplement', 'identifiedPhraseLoc'],
    ['charm', 'nameLoc'], ['charm', 'descriptionLoc'],
    ['transformation', 'nameLoc'], ['transformation', 'descriptionLoc'],
    ['enemy', 'nameLoc'], ['boss', 'nameLoc'],
    ['envObject', 'nameLoc'], ['hazard', 'nameLoc'],
    ['department', 'nameLoc'], ['floor', 'nameLoc'], ['route', 'nameLoc'],
    ['ending', 'nameLoc'], ['ending', 'conditionLoc'],
    ['profile', 'nameLoc'], ['profile', 'identityLoc'],
    ['challenge', 'nameLoc'], ['challenge', 'descriptionLoc'],
    ['unlock', 'descriptionLoc'], ['music', 'nameLoc'],
  ];
  for (const [kind, field] of locFields) {
    for (const def of registry.all(kind)) {
      const key = def[field];
      if (key && !keys.has(key)) {
        err(`${kind}:${def.id}.${field}`, `missing localization key "${key}"`);
      }
    }
  }

  // R-ITM-005: automated string scan for percent signs and numeric deltas in
  // normal pickup phrases. This is the exact acceptance test the GDD names.
  const phraseKeys = new Set();
  for (const kind of ['passive', 'active', 'supplement']) {
    for (const def of registry.all(kind)) {
      if (def.pickupPhraseLoc) phraseKeys.add(def.pickupPhraseLoc);
      if (def.identifiedPhraseLoc) phraseKeys.add(def.identifiedPhraseLoc);
    }
  }
  for (const key of phraseKeys) {
    const text = english.strings[key];
    if (!text) continue;
    if (/[%]|[+-]\s*\d|\d+\s*(percent|pct)|x\s*\d*\.\d/i.test(text)) {
      err(`localization.${key}`, `pickup phrase "${text}" exposes raw numbers (R-ITM-005)`);
    }
  }
}

// -- pool reachability ------------------------------------------------------
for (const pool of registry.all('lootPool')) {
  for (const entry of pool.entries) {
    if (!registry.has(entry.contentKind, entry.contentId)) {
      err(`${pool.id}.entries`, `unknown ${entry.contentKind} "${entry.contentId}"`);
    }
  }
}
// Every collectible that declares a pool must actually appear in that pool.
for (const kind of ['weapon', 'passive', 'active', 'charm']) {
  for (const def of registry.all(kind)) {
    for (const poolName of def.pools || []) {
      const pool = registry.all('lootPool').find((p) => p.pool === poolName);
      if (!pool) {
        err(`${kind}:${def.id}.pools`, `pool "${poolName}" has no lootPool definition`);
        continue;
      }
      if (!pool.entries.some((e) => e.contentId === def.id)) {
        err(`${kind}:${def.id}.pools`, `claims pool ${poolName} but is absent from ${pool.id}`);
      }
    }
  }
}

// -- silhouette uniqueness across enemy families (GDD 18.3) ----------------
const seenSilhouettes = new Map();
for (const def of allSpriteDefs()) {
  if (!/^(enemy|boss)_/.test(def.id)) continue;
  let sig;
  try { sig = silhouetteSignature(def.id); } catch { continue; }
  if (seenSilhouettes.has(sig)) {
    err(`sprite:${def.id}`, `identical silhouette to "${seenSilhouettes.get(sig)}" (GDD 18.3)`);
  } else {
    seenSilhouettes.set(sig, def.id);
  }
}

// -- content census vs GDD §24 baseline -----------------------------------
const BASELINE = {
  weapon: 14, passive: 60, active: 15, card: 18, supplement: 14, charm: 18,
  transformation: 4, enemy: 58, boss: 29, department: 13, ending: 9, profile: 8,
  envObject: 24,
};
const census = registry.census();
for (const [kind, target] of Object.entries(BASELINE)) {
  if (census[kind] < target) {
    warn('census', `${kind}: ${census[kind]}/${target} defined (GDD §24 seed catalog)`);
  }
}

// -- report ---------------------------------------------------------------
const out = [];
out.push('Office Isaac — content validation');
out.push('='.repeat(60));
out.push('Census:');
for (const [kind, count] of Object.entries(census)) {
  if (count > 0) out.push(`  ${kind.padEnd(18)} ${count}`);
}
out.push('');
if (warnings.length) {
  out.push(`Warnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 200)) out.push(`  WARN  ${w}`);
  if (warnings.length > 200) out.push(`  ... ${warnings.length - 200} more`);
  out.push('');
}
if (errors.length) {
  out.push(`Errors (${errors.length}):`);
  for (const e of errors.slice(0, 300)) out.push(`  ERROR ${e}`);
  if (errors.length > 300) out.push(`  ... ${errors.length - 300} more`);
} else {
  out.push('No errors.');
}
process.stdout.write(`${out.join('\n')}\n`);
process.exit(errors.length > 0 ? 1 : 0);
