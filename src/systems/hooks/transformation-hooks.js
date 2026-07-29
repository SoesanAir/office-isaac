/**
 * Transformation effects. The two hooks TRN-003 and TRN-004 need that nothing else
 * in the game already does.
 *
 * GDD refs: Appendix C.7 (both entries, including the explicit "effect count is
 *           aggregated for performance" instruction on Paper Trail), 8.5
 *           (transformations are rare readable milestones), 18.5 (effect
 *           aggregation), R-TEC-003 (a bounded per-room effect budget).
 *
 * TRN-001 Latte and TRN-002 Power User reuse STAT_MODIFY and PATTERN_MODIFY, so they
 * are not here. That is the intended outcome: a transformation should mostly be a
 * bigger dial on machinery that already exists, and only reach for new code when the
 * effect genuinely is new.
 */

import { defineHook, HOOK_TIMING } from '../effects.js';
import { distance } from '../../core/math.js';

defineHook('TRAIL_ON_ATTACK_DESTROYED', {
  timing: HOOK_TIMING.TICK,
  note: 'TRN-003 Paper Trail: destroyed player attacks leave a light damaging scrap.',
  fn: (ctx, params) => {
    const room = ctx.room;
    const pending = ctx.destroyedPlayerAttacks;
    if (!room || !pending?.length) return;

    room.paperTrails = room.paperTrails || [];
    const mergeRadius = params?.mergeRadius ?? 0.6;
    const max = params?.maxConcurrent ?? 12;

    for (const spot of pending) {
      // C.7 asks for aggregation explicitly. A wide multiplied pattern destroys a dozen
      // projectiles on the same wall in the same frame, and a dozen overlapping decals
      // is both unreadable (18.5) and the exact thing R-TEC-003 caps.
      const near = room.paperTrails.find(
        (t) => !t.expired && distance(t.x, t.y, spot.x, spot.y) <= mergeRadius,
      );
      if (near) {
        near.seconds = Math.max(near.seconds, params?.seconds ?? 1.4);
        continue;
      }
      // Once at the ceiling, refresh the oldest instead of growing the list. Dropping
      // the new one silently would make the transformation feel broken in exactly the
      // busy moments it is meant to shine in.
      if (room.paperTrails.length >= max) {
        const oldest = room.paperTrails.reduce((a, b) => (b.seconds < a.seconds ? b : a));
        oldest.x = spot.x;
        oldest.y = spot.y;
        oldest.seconds = params?.seconds ?? 1.4;
        continue;
      }
      room.paperTrails.push({
        x: spot.x,
        y: spot.y,
        seconds: params?.seconds ?? 1.4,
        damage: params?.damage ?? 2,
      });
    }
    pending.length = 0;
  },
});

defineHook('ASSISTANT_FAMILIAR', {
  timing: HOOK_TIMING.ON_ROOM_ENTER,
  note: 'TRN-004 Middle Management: an assistant that fetches pickups.',
  fn: (ctx, params) => {
    const player = ctx.player;
    if (!player) return;
    player.familiars = player.familiars ?? [];
    if (player.familiars.some((f) => f.id === 'TRN-004')) return;
    player.familiars.push({
      id: 'TRN-004',
      // COLLECTOR, not SHOOTER. C.7 calls this "a visual joke, not a reputation
      // system", so the assistant must not become a second damage source.
      kind: 'COLLECTOR',
      collectRadius: params?.collectRadius ?? 3.5,
      bossKillBonus: params?.bossKillBonus ?? 0.25,
      bonusSeconds: params?.bonusSeconds ?? 20,
      timer: 0,
    });
  },
});
