#!/usr/bin/env node
/**
 * Emits the list of localization keys the registered content actually references.
 *
 * Localization is content, not generated code, so this tool only reports the key
 * set. `content/loc/en.js` is hand-authored from it — that way player-facing copy
 * stays written rather than derived, which matters most for R-ITM-005 pickup
 * phrases where the wording is the whole rule.
 */
import { loadContent } from '../content/index.js';
import '../src/register-all.js';

const reg = loadContent({ strict: false });
const keys = new Set();
const FIELDS = {
  weapon: ['nameLoc', 'descriptionLoc'],
  passive: ['nameLoc', 'pickupPhraseLoc', 'collectionLoc'],
  active: ['nameLoc', 'pickupPhraseLoc'],
  card: ['nameLoc', 'descriptionLoc'],
  supplement: ['nameLoc', 'identifiedPhraseLoc'],
  charm: ['nameLoc', 'descriptionLoc'],
  transformation: ['nameLoc', 'descriptionLoc'],
  enemy: ['nameLoc'], boss: ['nameLoc'], envObject: ['nameLoc'], hazard: ['nameLoc'],
  department: ['nameLoc'], floor: ['nameLoc'], route: ['nameLoc'],
  ending: ['nameLoc', 'conditionLoc'], profile: ['nameLoc', 'identityLoc'],
  challenge: ['nameLoc', 'descriptionLoc'], unlock: ['descriptionLoc'], music: ['nameLoc'],
};
for (const [kind, fields] of Object.entries(FIELDS)) {
  for (const def of reg.all(kind)) for (const f of fields) if (def[f]) keys.add(def[f]);
}
for (const s of reg.all('sound')) if (s.captionLoc) keys.add(s.captionLoc);
for (const m of reg.all('music')) if (m.ambienceLoc) keys.add(m.ambienceLoc);
for (const e of reg.all('ending')) for (const b of e.beats) if (b.textLoc) keys.add(b.textLoc);
process.stdout.write([...keys].sort().join('\n') + '\n');
