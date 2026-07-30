/**
 * Heads-up display.
 *
 * GDD refs: 17.1 (UI law: the player sees what they need now), 17.2 (HUD layout
 *           table), 17.3 (item language: qualitative, never raw deltas),
 *           17.4 (map), R-UIX-001 (no detailed numeric stat sheet in normal HUD),
 *           R-UIX-002 (obvious resources and costs use visible integers),
 *           R-UIX-005 (every critical colour cue has a non-colour cue),
 *           R-UIX-006 (pickup banners never obscure active combat danger),
 *           4.4 (feedback hierarchy), 5.2 (health language).
 *
 * The rule that shapes this file is R-UIX-006. A banner is not allowed to sit over
 * live danger, so the banner queue defers while the room is hostile and only
 * drains during a lull. That is why banners are a queue with state rather than a
 * fire-and-forget draw call.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT, HEALTH } from '../core/constants.js';
import { LAYER_ORDER } from '../render/renderer.js';
import { HALVES_PER_ICON } from '../entities/health.js';

const PAD = 8;
const ICON = 14;
const ICON_GAP = 3;

/** Health icon colours. Shape carries the meaning too (R-UIX-005). */
const HEALTH_STYLE = Object.freeze({
  [HEALTH.COMPOSURE]: { full: '#e04a54', half: '#b02a3a', empty: '#3a2430', glyph: 'heart' },
  [HEALTH.CAFFEINE]: { full: '#7fb0ee', half: '#4a7fd4', empty: '#243040', glyph: 'cup' },
  [HEALTH.SPITE]: { full: '#8a2a3a', half: '#5a1a26', empty: '#2a1420', glyph: 'mug' },
});

export class Hud {
  /**
   * @param {{renderer: import('../render/renderer.js').Renderer, registry: object, loc: (key:string)=>string}} deps
   */
  constructor({ renderer, registry, loc }) {
    this.renderer = renderer;
    this.registry = registry;
    this.loc = loc || ((key) => key);

    /** The current audio caption, if any (R-AUD-003). */
    this.caption = null;
    this.captionTimer = 0;
    /** Pending centre banners (GDD 17.2 "Center banner"). */
    this.bannerQueue = [];
    this.activeBanner = null;
    this.bannerTimer = 0;
    /** Scale for HUD and text (GDD 17.6 scalable HUD). */
    this.uiScale = 1;
    // On by default. GDD 17.4 wants the map available; there is no reason to make the
    // player hold a key to answer "where have I been", and the compact panel is small
    // enough not to compete with combat.
    this.showMap = true;
    this.mapExpanded = false;
  }

  /**
   * Show a caption for an audio cue (R-AUD-003).
   *
   * Deliberately NOT the centre banner. A caption is a running commentary on sound — several
   * a second in a busy fight — so it sits low, small, and replaces itself rather than
   * queueing. Routing it through the banner queue would bury the banners that matter and
   * violate R-UIX-006 by parking text over live danger.
   */
  queueCaption(caption) {
    if (!caption?.text) return;
    // A higher-priority cue (a lower mix band) wins while the current one is still up, so a
    // boss telegraph caption is never displaced by a footstep.
    const incoming = caption.priority ?? 6;
    if (this.caption && this.captionTimer > 0 && (this.caption.priority ?? 6) < incoming) return;
    this.caption = { ...caption, priority: incoming };
    this.captionTimer = 1.1;
  }

  /**
   * Queue a banner. `priority` lets an unlock or ending outrank an item pickup.
   * @param {{title: string, subtitle?: string, seconds?: number, priority?: number}} banner
   */
  queueBanner(banner) {
    this.bannerQueue.push({
      seconds: 2.2, priority: 0, ...banner,
    });
    this.bannerQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Advance banner state.
   * @param {number} dt
   * @param {boolean} hostileActive true while the current room has live threats
   */
  update(dt, hostileActive) {
    if (this.activeBanner) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.activeBanner = null;
      return;
    }
    // R-UIX-006: defer rather than draw over live danger. An urgent banner
    // (an ending, say) may still show, but ordinary pickups wait for the lull.
    if (this.bannerQueue.length === 0) return;
    const next = this.bannerQueue[0];
    if (hostileActive && next.priority < 100) return;
    this.activeBanner = this.bannerQueue.shift();
    this.bannerTimer = this.activeBanner.seconds;
  }

  /**
   * Draw the whole HUD.
   *
   * @param {object} ctx
   * @param {import('../entities/player.js').Player} ctx.player
   * @param {object} ctx.run
   * @param {object} [ctx.boss] `{nameLoc, health, maxHealth, phase}`
   * @param {object} [ctx.waveObjective] `{label, current, total}`
   */
  draw({ player, run, boss, waveObjective }) {
    this.#drawHealth(player);
    this.#drawActive(player);
    this.#drawResources(player);
    this.#drawStatuses(player);
    this.#drawPocketAndCharm(player);
    if (boss) this.#drawBossBar(boss);
    else if (waveObjective) this.#drawWaveBar(waveObjective);
    this.#drawBanner();
    if (this.showMap && run?.floor) this.#drawMap(run);
    if (this.caption) this.#drawCaption();
  }

  // -------------------------------------------------------------------------
  // Top left: health, active item and charge (GDD 17.2)
  // -------------------------------------------------------------------------

  #drawHealth(player) {
    const icons = player.health.describeIcons();
    let x = PAD;
    const y = PAD;
    // Composure first, then buffers, so the player reads core health leftmost
    // exactly as GDD 5.2 orders it.
    for (const icon of icons) {
      this.#drawHealthIcon(x, y, icon);
      x += ICON + ICON_GAP;
      // Wrap after ten icons so a huge health pool cannot run off screen.
      if (x > PAD + (ICON + ICON_GAP) * 10) {
        x = PAD;
      }
    }
  }

  #drawHealthIcon(x, y, icon) {
    const style = HEALTH_STYLE[icon.kind] || HEALTH_STYLE[HEALTH.COMPOSURE];
    const r = this.renderer;
    r.push(LAYER_ORDER.HUD, (c) => {
      // Empty container outline is always drawn so max capacity stays visible
      // (GDD 5.2 "Empty container": capacity that currently lacks health).
      c.fillStyle = style.empty;
      drawGlyph(c, style.glyph, x, y, ICON);
      if (icon.state !== 'EMPTY') {
        const full = icon.state === 'FULL';
        c.fillStyle = full ? style.full : style.half;
        // A half unit fills the left half only: a shape cue rather than a colour
        // cue, so it survives every colour-vision preset (R-UIX-005).
        c.save();
        c.beginPath();
        c.rect(x, y, full ? ICON : ICON / 2, ICON);
        c.clip();
        drawGlyph(c, style.glyph, x, y, ICON);
        c.restore();
      }
      if (icon.golden) {
        // Golden Cushion: a gold outline around an existing icon (GDD 5.2).
        c.strokeStyle = '#e0be4a';
        c.lineWidth = 1.5;
        c.strokeRect(x - 1.5, y - 1.5, ICON + 3, ICON + 3);
      }
    });
  }

  #drawActive(player) {
    if (!player.activeId) return;
    const def = this.registry.get('active', player.activeId);
    const y = PAD + ICON + 8;
    const size = 20;
    const r = this.renderer;
    const capacity = player.activeChargeCapacity(def);
    const charge = player.activeCharge;
    const ready = capacity > 0 && charge >= capacity;

    r.push(LAYER_ORDER.HUD, (c) => {
      c.fillStyle = '#141420';
      c.fillRect(PAD, y, size, size);
      c.strokeStyle = ready ? '#e8c246' : '#4a4a5e';
      c.lineWidth = ready ? 2 : 1;
      c.strokeRect(PAD + 0.5, y + 0.5, size - 1, size - 1);
      // Charge is a fill from the bottom: readable at a glance, and the numeric
      // count sits beside it because charge is an "obvious counter" (D-013).
      if (capacity > 0) {
        const frac = Math.min(1, charge / capacity);
        c.fillStyle = ready ? '#e8c246' : '#4a7fd4';
        c.fillRect(PAD + 2, y + size - 2 - (size - 4) * frac, size - 4, (size - 4) * frac);
      }
    });
    if (capacity > 1) {
      this.renderer.drawText(`${Math.floor(charge)}/${capacity}`, PAD + size + 4, y + 6, { size: 9 });
    }
    if (ready) {
      this.renderer.drawText('READY', PAD + size + 4, y + (capacity > 1 ? -3 : 6), {
        size: 8, color: '#e8c246',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Top right: resources, pocket item, desk charm (GDD 17.2)
  // -------------------------------------------------------------------------

  /**
   * Active status effects (GDD 5.5, 18.4).
   *
   * GDD 18.4 ranks active status as tier 2, "mechanic critical" — above identity accessories and
   * decoration, below only the player outline and damage state. It was nonetheless invisible:
   * `StatusContainer.describe()` has always returned a HUD-ready list with an icon id per effect,
   * and nothing ever called it. A player being burned had no way to know why their health was
   * dropping, which is exactly the tier-2 information this table promises.
   *
   * Placed under the active item in the top-left, keeping it in the same column as the other
   * gameplay-critical readouts rather than opening a new screen region. GDD 17.2 assigns the
   * top-left to health and the active item and does not mention status, so this extends that
   * column rather than contradicting the table.
   *
   * Each icon carries a depletion arc rather than a number: the exact remaining seconds are not
   * actionable, but "nearly over" is, and an arc reads at 16px where digits would not.
   */
  #drawStatuses(player) {
    const active = player.status?.describe?.() ?? [];
    if (active.length === 0) return;

    // Below health and the active item. Derived from the same constants those use, so a change
    // to either does not silently overlap this row.
    const y = PAD + ICON + 8 + 20 + 6;
    const pitch = 18;

    active.forEach((entry, i) => {
      const x = PAD + i * pitch;
      this.renderer.drawSprite(entry.iconId, 0, 0, {
        layer: LAYER_ORDER.HUD,
        // Screen-space, not world-space: the HUD is drawn in logical pixels, so the sprite is
        // placed by the raw draw below rather than through the camera.
        screen: [x, y],
      });
      // The depletion arc, drawn under the icon so it never obscures the silhouette that
      // carries the meaning (R-UIX-005).
      this.renderer.push(LAYER_ORDER.HUD, (c) => {
        const frac = Math.max(0, Math.min(1, entry.progress ?? 0));
        c.fillStyle = '#26263a';
        c.fillRect(x, y + 16, 16, 2);
        c.fillStyle = '#c8c8d6';
        c.fillRect(x, y + 16, Math.round(16 * frac), 2);
      });
    });
  }

  #drawResources(player) {
    const res = { credits: player.credits, accessCards: player.accessCards, tonerCharges: player.tonerCharges };
    // R-UIX-002: these are visible integers. A purchase without a number is not
    // mysterious, it is accounting malpractice (GDD 9.3).
    const rows = [
      { glyph: 'coin', color: '#e0be4a', value: res.credits },
      { glyph: 'card', color: '#4a9ad0', value: res.accessCards },
      { glyph: 'toner', color: '#c78af0', value: res.tonerCharges },
    ];
    let y = PAD;
    for (const row of rows) {
      const x = LOGICAL_WIDTH - PAD - 46;
      this.renderer.push(LAYER_ORDER.HUD, (c) => {
        c.fillStyle = row.color;
        drawGlyph(c, row.glyph, x, y, ICON);
      });
      this.renderer.drawText(String(row.value), x + ICON + 4, y + 2, { size: 11 });
      y += ICON + ICON_GAP;
    }
    if (player.creditDebt > 0) {
      // Corporate Card debt is a real obligation, so it is shown, not hidden.
      this.renderer.drawText(`debt ${player.creditDebt}`, LOGICAL_WIDTH - PAD, y + 2, {
        size: 9, align: 'right', color: '#e04a54',
      });
    }
  }

  #drawPocketAndCharm(player) {
    const y = PAD + (ICON + ICON_GAP) * 3 + 6;
    const size = 18;
    const slots = [
      { label: 'Q', entry: player.pocket, x: LOGICAL_WIDTH - PAD - size * 2 - 6 },
      { label: '', entry: player.charmId ? { id: player.charmId } : null, x: LOGICAL_WIDTH - PAD - size },
    ];
    for (const slot of slots) {
      this.renderer.push(LAYER_ORDER.HUD, (c) => {
        c.fillStyle = '#141420';
        c.fillRect(slot.x, y, size, size);
        c.strokeStyle = slot.entry ? '#9a9aae' : '#33333f';
        c.lineWidth = 1;
        c.strokeRect(slot.x + 0.5, y + 0.5, size - 1, size - 1);
      });
      if (slot.entry && slot.label) {
        this.renderer.drawText(slot.label, slot.x + 2, y - 9, { size: 8, color: '#9a9aae' });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bottom centre: boss health or wave objective (GDD 17.2)
  // -------------------------------------------------------------------------

  #drawBossBar(boss) {
    const w = 320;
    const h = 10;
    const x = (LOGICAL_WIDTH - w) / 2;
    const y = LOGICAL_HEIGHT - 30;
    const frac = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
    this.renderer.push(LAYER_ORDER.HUD, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(x - 2, y - 2, w + 4, h + 4);
      c.fillStyle = '#2a1420';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#e04a54';
      c.fillRect(x, y, w * frac, h);
      // Phase ticks: the player can see how many phases remain without a number.
      if (boss.phaseCount > 1) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        for (let i = 1; i < boss.phaseCount; i += 1) {
          c.fillRect(x + (w * i) / boss.phaseCount, y, 1, h);
        }
      }
    });
    this.renderer.drawText(this.loc(boss.nameLoc), LOGICAL_WIDTH / 2, y - 13, {
      size: 11, align: 'center',
    });
  }

  #drawWaveBar(objective) {
    const y = LOGICAL_HEIGHT - 26;
    this.renderer.drawText(
      `${objective.label}  ${objective.current}/${objective.total}`,
      LOGICAL_WIDTH / 2, y, { size: 11, align: 'center', color: '#e8c246' },
    );
  }

  // -------------------------------------------------------------------------
  // Centre banner (GDD 17.2, 17.3)
  // -------------------------------------------------------------------------

  #drawBanner() {
    const b = this.activeBanner;
    if (!b) return;
    // Fade in and out so the banner never pops, and sits high enough to leave the
    // combat field clear (R-UIX-006).
    const life = b.seconds;
    const t = this.bannerTimer / life;
    const alpha = Math.min(1, Math.min(t * 4, (1 - t) * 6 + 0.35));
    const y = LOGICAL_HEIGHT * 0.24;
    this.renderer.drawText(b.title, LOGICAL_WIDTH / 2, y, {
      size: 16, align: 'center', color: '#ffffff', alpha, weight: 'bold',
    });
    if (b.subtitle) {
      // GDD 17.3: a short qualitative phrase. Never a stat delta (R-ITM-005).
      this.renderer.drawText(b.subtitle, LOGICAL_WIDTH / 2, y + 20, {
        size: 12, align: 'center', color: '#c8c8d6', alpha,
      });
    }
  }

  /** Audio caption, low and unobtrusive (R-AUD-003, GDD 17.2). */
  #drawCaption() {
    const text = this.caption.text;
    const alpha = Math.min(1, this.captionTimer / 0.25);
    this.renderer.push(LAYER_ORDER.HUD, (c) => {
      const prev = c.globalAlpha;
      c.globalAlpha = prev * alpha;
      c.font = '11px "Courier New", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      const width = Math.max(60, text.length * 6.6);
      const y = LOGICAL_HEIGHT - PAD - 4;
      c.fillStyle = 'rgba(8,8,14,0.7)';
      c.fillRect((LOGICAL_WIDTH - width) / 2, y - 14, width, 16);
      c.fillStyle = '#c8c8d6';
      c.fillText(text, LOGICAL_WIDTH / 2, y);
      c.globalAlpha = prev;
    });
  }

  // -------------------------------------------------------------------------
  // Map (GDD 17.4)
  // -------------------------------------------------------------------------

  #drawMap(run) {
    const floor = run.floor;
    const compact = !this.mapExpanded;
    // Larger than it was. The map is on by default now, so it has to be readable at a
    // glance rather than only when deliberately opened.
    const cell = compact ? 13 : 26;
    const gap = compact ? 3 : 5;

    // Only discovered rooms appear. R-FLR-010 / 17.4: undiscovered secret rooms
    // do not reserve visible spaces or show blank icons, so they are simply absent.
    const visible = [...floor.nodes.values()].filter(
      (n) => n.visited || (!n.hidden && this.#isAdjacentToVisited(floor, n)),
    );
    if (visible.length === 0) return;

    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of visible) {
      for (const [cx, cy] of node.cells) {
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
      }
    }
    const spanX = (maxX - minX + 1) * (cell + gap);
    const spanY = (maxY - minY + 1) * (cell + gap);
    const originX = compact ? LOGICAL_WIDTH - PAD - spanX : (LOGICAL_WIDTH - spanX) / 2;
    const originY = compact ? PAD + 28 : (LOGICAL_HEIGHT - spanY) / 2;

    const currentId = run.roomNode?.id;
    const at = (cx, cy) => ({
      x: originX + (cx - minX) * (cell + gap),
      y: originY + (cy - minY) * (cell + gap),
    });

    this.renderer.push(LAYER_ORDER.HUD, (c) => {
      if (!compact) {
        c.fillStyle = 'rgba(5,5,10,0.86)';
        c.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      } else {
        // A panel behind the compact map. Without it, dark room fills vanish against a
        // dark floor and the map is only legible in bright rooms.
        c.fillStyle = 'rgba(8,8,14,0.72)';
        c.fillRect(originX - 6, originY - 6, spanX + 12 - gap, spanY + 12 - gap);
        c.strokeStyle = 'rgba(120,120,148,0.5)';
        c.lineWidth = 1;
        c.strokeRect(originX - 5.5, originY - 5.5, spanX + 11 - gap, spanY + 11 - gap);
      }

      // ---- door connectors ------------------------------------------------
      // The cells are drawn with a gap between them, so without these the map reads as
      // a scatter of disconnected squares and gives no route information at all.
      c.strokeStyle = 'rgba(160,160,190,0.75)';
      c.lineWidth = compact ? 2 : 3;
      const seen = new Set();
      for (const node of visible) {
        for (const door of node.doors || []) {
          if (!door.discovered) continue;
          const other = floor.nodes.get(door.toNodeId);
          if (!other || !visible.includes(other)) continue;
          const key = [node.id, other.id].sort().join('>');
          if (seen.has(key)) continue;
          seen.add(key);
          // Join the closest pair of cells, which for orthogonally adjacent rooms is the
          // pair either side of the wall they share.
          let best = null;
          let bestD = Infinity;
          for (const [ax, ay] of node.cells) {
            for (const [bx, by] of other.cells) {
              const d = Math.abs(ax - bx) + Math.abs(ay - by);
              if (d < bestD) { bestD = d; best = [ax, ay, bx, by]; }
            }
          }
          if (!best) continue;
          const a = at(best[0], best[1]);
          const b = at(best[2], best[3]);
          c.beginPath();
          c.moveTo(a.x + cell / 2, a.y + cell / 2);
          c.lineTo(b.x + cell / 2, b.y + cell / 2);
          c.stroke();
        }
      }

      // ---- rooms ----------------------------------------------------------
      for (const node of visible) {
        const style = MAP_STYLE[node.role] || MAP_STYLE.DEFAULT;
        const isCurrent = node.id === currentId;
        for (const [cx, cy] of node.cells) {
          const { x, y } = at(cx, cy);
          c.fillStyle = node.visited ? style.fill : '#1a1a26';
          c.fillRect(x, y, cell, cell);
          // An unvisited-but-adjacent room is drawn hollow, so "somewhere to go" and
          // "somewhere I have been" never look alike.
          c.strokeStyle = isCurrent ? '#ffffff' : style.stroke;
          c.lineWidth = isCurrent ? 2.5 : 1;
          c.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }

        const head = at(node.cells[0][0], node.cells[0][1]);

        // Role marker: a glyph, so the map does not rely on colour (R-UIX-005).
        if (style.mark && node.visited) {
          c.fillStyle = '#ffffff';
          c.font = `${compact ? 10 : 18}px "Courier New", monospace`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(style.mark, head.x + cell / 2, head.y + cell / 2 + 0.5);
        }

        // The player's own room gets a filled pip, so it is findable without hunting for
        // the white outline on a busy map.
        if (isCurrent) {
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.arc(head.x + cell / 2, head.y + cell / 2, compact ? 2.5 : 4.5, 0, Math.PI * 2);
          c.fill();
        }

        // ---- uncollected loot ---------------------------------------------
        // One marker per room however much is lying there: the useful information is
        // "something is still in that room", and a count would just be noise on a
        // 13-pixel square.
        if (this.#hasUncollectedLoot(node)) {
          const size = compact ? 3.4 : 6;
          const mx = head.x + cell - size - 1.5;
          const my = head.y + size + 1.5;
          // A diamond rather than a letter: it has to stay distinct from the role glyphs,
          // which are all ASCII characters drawn in the centre.
          c.fillStyle = '#f7e07a';
          c.strokeStyle = '#14141c';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(mx, my - size);
          c.lineTo(mx + size, my);
          c.lineTo(mx, my + size);
          c.lineTo(mx - size, my);
          c.closePath();
          c.fill();
          c.stroke();
        }
      }
    });
  }

  /**
   * Does this room still hold something worth walking back for?
   *
   * Reads the built room instance rather than the graph node, because loot lives in the
   * instance layer (GDD 12.1). An unbuilt room has nothing placed yet, and an unvisited
   * one must not leak its contents (17.4), so both correctly answer no.
   */
  #hasUncollectedLoot(node) {
    if (!node.visited) return false;
    const room = node._instance;
    if (!room) return false;
    if (room.pedestal && !room.pedestal.taken) return true;
    for (const pickup of room.pickups || []) {
      if (!pickup.collected) return true;
    }
    return false;
  }

  /** A room becomes map-visible once a neighbour has been entered. */
  #isAdjacentToVisited(floor, node) {
    for (const edgeId of node.edgeIds) {
      const edge = floor.edges.get(edgeId);
      if (!edge || !edge.discovered) continue;
      const otherId = edge.a.nodeId === node.id ? edge.b.nodeId : edge.a.nodeId;
      if (floor.nodes.get(otherId)?.visited) return true;
    }
    return false;
  }
}

/**
 * Map styling per role. Marks are ASCII so they read at 7px and need no font
 * assets; GDD 17.4 wants discovered special-room icons, not a legend to memorise.
 */
const MAP_STYLE = Object.freeze({
  DEFAULT: { fill: '#4a4a5e', stroke: '#787894', mark: null },
  'ROOM-001': { fill: '#2f5aa8', stroke: '#7fb0ee', mark: null },
  'ROOM-005': { fill: '#3a5a3a', stroke: '#54b070', mark: '+' },
  'ROOM-006': { fill: '#5a4a1a', stroke: '#e0be4a', mark: '$' },
  'ROOM-007': { fill: '#5a1a2a', stroke: '#e04a54', mark: '!' },
  'ROOM-008': { fill: '#3a4a5a', stroke: '#7fb0ee', mark: 'c' },
  'ROOM-009': { fill: '#5a3a1a', stroke: '#e09a4a', mark: 'd' },
  'ROOM-012': { fill: '#2a3a3a', stroke: '#3fb0b8', mark: '?' },
  'ROOM-013': { fill: '#2a3a3a', stroke: '#3fb0b8', mark: '?' },
  'ROOM-014': { fill: '#4a1a2a', stroke: '#b02a3a', mark: 'x' },
  'ROOM-017': { fill: '#3a2a5a', stroke: '#9a6ad4', mark: 'L' },
  'ROOM-028': { fill: '#3a3a4a', stroke: '#c8c8d6', mark: 'n' },
});

/**
 * Draw an icon glyph. These are drawn as paths rather than sprites so the HUD
 * scales cleanly with the accessibility text-size setting (GDD 17.6).
 */
function drawGlyph(c, kind, x, y, size) {
  const s = size;
  switch (kind) {
    case 'heart': {
      // Stress-ball heart (GDD 5.2).
      c.beginPath();
      c.moveTo(x + s * 0.5, y + s * 0.9);
      c.bezierCurveTo(x - s * 0.1, y + s * 0.5, x + s * 0.1, y, x + s * 0.5, y + s * 0.28);
      c.bezierCurveTo(x + s * 0.9, y, x + s * 1.1, y + s * 0.5, x + s * 0.5, y + s * 0.9);
      c.fill();
      break;
    }
    case 'cup': {
      // Coffee cup: tapered body plus handle.
      c.beginPath();
      c.moveTo(x + s * 0.18, y + s * 0.2);
      c.lineTo(x + s * 0.82, y + s * 0.2);
      c.lineTo(x + s * 0.68, y + s * 0.9);
      c.lineTo(x + s * 0.32, y + s * 0.9);
      c.closePath();
      c.fill();
      c.fillRect(x + s * 0.82, y + s * 0.35, s * 0.14, s * 0.28);
      break;
    }
    case 'mug': {
      // Cracked mug: squarer than the cup, with a visible notch.
      c.fillRect(x + s * 0.2, y + s * 0.22, s * 0.6, s * 0.66);
      c.fillRect(x + s * 0.8, y + s * 0.38, s * 0.14, s * 0.26);
      break;
    }
    case 'coin':
      c.beginPath();
      c.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2);
      c.fill();
      break;
    case 'card':
      c.fillRect(x + s * 0.1, y + s * 0.25, s * 0.8, s * 0.5);
      break;
    case 'toner':
      c.fillRect(x + s * 0.18, y + s * 0.2, s * 0.64, s * 0.6);
      c.fillRect(x + s * 0.32, y + s * 0.08, s * 0.36, s * 0.14);
      break;
    default:
      c.fillRect(x, y, s, s);
  }
}

export { HALVES_PER_ICON, MAP_STYLE };
