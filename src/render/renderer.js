/**
 * Canvas renderer.
 *
 * GDD refs: 18.2 (layer order: floor, stains/hazards, low objects, entities,
 *           projectiles, high objects, VFX, HUD; nearest-neighbour integer
 *           scaling with no smoothing), 18.3 (player keeps a persistent outline
 *           and item-layer priority), 18.5 (friendly and hostile outline
 *           families are separate), R-ART-001 (readable at native gameplay
 *           scale), R-ART-003 (effect degradation preserves hostile readability
 *           and mechanical output), R-DPT-005 (departments readable in
 *           grayscale), 4.4 (feedback hierarchy), 17.6 (reduced flash/particles).
 *
 * The layer list is not a suggestion. Hostile projectiles must never be painted
 * under a friendly effect or behind a tall cabinet, because that is precisely how
 * a "powerful build hides the threat" failure (GDD 25 Visual overload) happens. So
 * draw order is a fixed enum and every draw call names its layer.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE } from '../core/constants.js';
import { bakeSprite, getSpriteDef, OUTLINE_FAMILY, toGrayscale, invalidateBakedSprites } from './sprites.js';
import { integerScaleFor } from './camera.js';

/** Fixed draw order (GDD 18.2). Lower numbers paint first. */
export const LAYER_ORDER = Object.freeze({
  FLOOR: 0,
  FLOOR_DECAL: 10,     // stains, hazard decals, blood, scorch
  LOW_OBJECT: 20,      // rugs, cables, paper piles, low cover
  PICKUP: 30,
  ENTITY: 40,          // player, enemies, familiars, npcs
  PROJECTILE: 50,      // all projectiles, friendly and hostile
  HIGH_OBJECT: 60,     // shelves, partitions, anything taller than an entity
  VFX: 70,
  OVERLAY: 80,         // department lighting, darkness
  HUD: 90,
});

/** Geometry characters produced by the room template builder. */
const GEOMETRY = Object.freeze({
  FLOOR: '.',
  WALL: '#',
  PIT: 'x',
  LOW_COVER: '~',
  CARPET: ',',
});

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{camera: import('./camera.js').Camera}} deps
   */
  constructor(canvas, { camera }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = camera;
    this.scale = 1;

    /** Accessibility and performance settings (GDD 17.6, R-ART-003). */
    this.settings = {
      grayscale: false,
      highContrast: false,
      /** 0..1 multiplier on particle counts. Never affects damage (R-TEC-007). */
      particleDensity: 1,
      /** 0..1 multiplier on full-screen flashes. */
      flashIntensity: 1,
      /** Draw collision boxes and spawn zones. */
      debugCollision: false,
      debugGraph: false,
    };

    /** Per-frame draw queue, sorted by layer then insertion (stable). */
    this._queue = [];
    this._seq = 0;
    /** Reusable scratch to avoid per-call allocation in hot paths. */
    this._pt = { x: 0, y: 0 };
    /** Cached room floor render, redrawn only when the room changes. */
    this._roomCache = { key: null, canvas: null, originX: 0, originY: 0 };

    this.resize();
  }

  /** Recompute integer scale and backing store size. */
  resize(windowW = globalThis.innerWidth, windowH = globalThis.innerHeight) {
    this.scale = integerScaleFor(windowW, windowH);
    this.canvas.width = LOGICAL_WIDTH;
    this.canvas.height = LOGICAL_HEIGHT;
    // CSS pixels: integer multiple so no fractional smoothing appears.
    this.canvas.style.width = `${LOGICAL_WIDTH * this.scale}px`;
    this.canvas.style.height = `${LOGICAL_HEIGHT * this.scale}px`;
    this.canvas.style.imageRendering = 'pixelated';
    this.ctx.imageSmoothingEnabled = false;
  }

  setSetting(key, value) {
    this.settings[key] = value;
    if (key === 'grayscale') {
      invalidateBakedSprites();
      this._roomCache.key = null;
    }
  }

  // -------------------------------------------------------------------------
  // Frame lifecycle
  // -------------------------------------------------------------------------

  beginFrame() {
    this._queue.length = 0;
    this._seq = 0;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    // Void colour: deliberately near-black so a camera bug is obvious in review
    // rather than blending into a dark department palette (R-CAM-002).
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * Queue a draw call.
   * @param {number} layer one of LAYER_ORDER
   * @param {(ctx:CanvasRenderingContext2D)=>void} fn
   * @param {number} [sortY] world y used to sort within the entity layer so
   *        entities lower on screen occlude those above them
   */
  push(layer, fn, sortY = 0) {
    this._queue.push({ layer, sortY, seq: this._seq++, fn });
  }

  endFrame() {
    this._queue.sort((a, b) =>
      (a.layer - b.layer) || (a.sortY - b.sortY) || (a.seq - b.seq));
    const ctx = this.ctx;
    for (let i = 0; i < this._queue.length; i += 1) this._queue[i].fn(ctx);
  }

  // -------------------------------------------------------------------------
  // Room geometry
  // -------------------------------------------------------------------------

  /**
   * Draw the room floor, walls, and pits.
   *
   * The result is cached to an offscreen canvas because the geometry never
   * changes while the player is in the room, and re-tiling 43x23 cells every
   * frame is wasted budget that GDD 20.7 would rather spend on projectiles.
   */
  drawRoom(node, template, department, rect) {
    const key = `${node.id}|${template.id}|${department?.id}|${this.settings.grayscale}`;
    if (this._roomCache.key !== key) {
      this._roomCache.canvas = this.#bakeRoom(template, department, rect);
      this._roomCache.key = key;
      this._roomCache.originX = rect.x;
      this._roomCache.originY = rect.y;
    }
    const baked = this._roomCache.canvas;
    const origin = this.camera.worldToScreen(rect.x, rect.y, this._pt);
    const ox = Math.round(origin.x);
    const oy = Math.round(origin.y);
    this.push(LAYER_ORDER.FLOOR, (ctx) => ctx.drawImage(baked, ox, oy));
  }

  #bakeRoom(template, department, rect) {
    const grid = template.geometry;
    const h = grid.length;
    const w = grid[0].length;
    const canvas = createCanvas(w * TILE, h * TILE);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const palette = this.#departmentColors(department);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const ch = grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        switch (ch) {
          case GEOMETRY.WALL:
            this.#paintWall(ctx, px, py, palette, x, y, grid);
            break;
          case GEOMETRY.PIT:
            ctx.fillStyle = palette.pit;
            ctx.fillRect(px, py, TILE, TILE);
            break;
          case GEOMETRY.LOW_COVER:
            this.#paintFloor(ctx, px, py, palette, x, y);
            ctx.fillStyle = palette.lowCover;
            ctx.fillRect(px + 2, py + TILE / 2, TILE - 4, TILE / 2 - 2);
            break;
          default:
            this.#paintFloor(ctx, px, py, palette, x, y);
            break;
        }
      }
    }
    return canvas;
  }

  /**
   * Floor tiles carry the department's material identity. The 2px grid seam and
   * the alternating tone are what make Open Office carpet read differently from
   * IT raised flooring even in grayscale (R-DPT-005, R-ART-004).
   */
  #paintFloor(ctx, px, py, palette, tx, ty) {
    // Checker on a 2-tile pitch: visible enough to give scale, quiet enough not
    // to compete with projectiles for attention.
    const alt = ((tx >> 1) + (ty >> 1)) % 2 === 0;
    ctx.fillStyle = alt ? palette.floorA : palette.floorB;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = palette.floorSeam;
    ctx.fillRect(px, py, TILE, 1);
    ctx.fillRect(px, py, 1, TILE);
  }

  #paintWall(ctx, px, py, palette, tx, ty, grid) {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(px, py, TILE, TILE);
    // Highlight the top face of any wall whose north neighbour is not a wall, so
    // the room silhouette reads as a raised boundary rather than a flat colour.
    const above = ty > 0 ? grid[ty - 1][tx] : GEOMETRY.WALL;
    if (above !== GEOMETRY.WALL) {
      ctx.fillStyle = palette.wallTop;
      ctx.fillRect(px, py, TILE, 6);
    }
    const below = ty < grid.length - 1 ? grid[ty + 1][tx] : GEOMETRY.WALL;
    if (below !== GEOMETRY.WALL) {
      ctx.fillStyle = palette.wallShadow;
      ctx.fillRect(px, py + TILE - 4, TILE, 4);
    }
  }

  #departmentColors(department) {
    const p = department?.presentation?.palette || {};
    const pick = (key, fallback) => {
      const value = p[key] || fallback;
      return this.settings.grayscale ? toGrayscale(value) : value;
    };
    return {
      floorA: pick('floorA', '#3a3a4a'),
      floorB: pick('floorB', '#34343f'),
      floorSeam: pick('floorSeam', '#2b2b36'),
      wall: pick('wall', '#5a5a70'),
      wallTop: pick('wallTop', '#787894'),
      wallShadow: pick('wallShadow', '#33333f'),
      pit: pick('pit', '#0a0a12'),
      lowCover: pick('lowCover', '#6d6d84'),
    };
  }

  /**
   * Draw a door. Doors are drawn on the high-object layer so a closed door reads
   * as solid, and the state is unmistakable: GDD 12.3's door table is a mechanic,
   * so it needs a distinct visual per state, not just a tint.
   */
  drawDoor(door, worldX, worldY, state) {
    const horizontal = door.side === 'NORTH' || door.side === 'SOUTH';
    const w = horizontal ? TILE * 3 : TILE;
    const h = horizontal ? TILE : TILE * 3;
    const p = this.camera.worldToScreen(worldX, worldY, this._pt);
    const sx = Math.round(p.x - w / 2);
    const sy = Math.round(p.y - h / 2);
    const colors = DOOR_STATE_COLORS[state] || DOOR_STATE_COLORS.OPEN;
    this.push(LAYER_ORDER.HIGH_OBJECT, (ctx) => {
      ctx.fillStyle = colors.frame;
      ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = colors.fill;
      ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
      if (colors.bar) {
        // Sealed doors get explicit bars, readable without colour (R-UIX-005).
        ctx.fillStyle = colors.bar;
        if (horizontal) {
          for (let i = 0; i < 3; i += 1) ctx.fillRect(sx + 6 + i * (w / 3), sy + 4, 4, h - 8);
        } else {
          for (let i = 0; i < 3; i += 1) ctx.fillRect(sx + 4, sy + 6 + i * (h / 3), w - 8, 4);
        }
      }
    }, worldY);
  }

  // -------------------------------------------------------------------------
  // Sprites
  // -------------------------------------------------------------------------

  /**
   * Draw a sprite at a world position.
   *
   * @param {string} spriteId
   * @param {number} wx world x
   * @param {number} wy world y
   * @param {object} [opts]
   * @param {number} [opts.layer] defaults to ENTITY
   * @param {number} [opts.frame]
   * @param {string} [opts.outline] key of OUTLINE_FAMILY
   * @param {Record<string,string>} [opts.swap] palette swap for elites/variants
   * @param {number} [opts.scale] integer pixel scale
   * @param {boolean} [opts.flipX]
   * @param {number} [opts.alpha]
   * @param {boolean} [opts.flash] draw a white damage flash over the sprite
   */
  drawSprite(spriteId, wx, wy, opts = {}) {
    const def = getSpriteDef(spriteId);
    if (!def) {
      // A missing sprite is a content bug; make it impossible to miss rather than
      // silently drawing nothing (R-TEC-005).
      this.#drawMissing(wx, wy, opts.layer ?? LAYER_ORDER.ENTITY);
      return;
    }
    let baked;
    try {
      baked = bakeSprite(spriteId, {
        outline: opts.outline ? OUTLINE_FAMILY[opts.outline] : null,
        swap: opts.swap,
        scale: opts.scale,
        grayscale: this.settings.grayscale,
      });
    } catch {
      this.#drawMissing(wx, wy, opts.layer ?? LAYER_ORDER.ENTITY);
      return;
    }
    const p = this.camera.worldToScreen(wx, wy, this._pt);
    const px = p.x;
    const py = p.y;
    const layer = opts.layer ?? LAYER_ORDER.ENTITY;
    const frameIndex = opts.frame ?? 0;
    const alpha = opts.alpha ?? 1;
    const flipX = Boolean(opts.flipX);
    const flash = Boolean(opts.flash);

    this.push(layer, (ctx) => {
      const frames = baked.frames;
      const frame = frames[((frameIndex % frames.length) + frames.length) % frames.length];
      const [ax, ay] = baked.anchor;
      const dx = Math.round(px - baked.width * ax);
      const dy = Math.round(py - baked.height * ay);
      const prevAlpha = ctx.globalAlpha;
      if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
      if (flipX) {
        ctx.save();
        ctx.translate(dx + baked.width, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(frame, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(frame, dx, dy);
      }
      if (flash) {
        // Silhouette-preserving flash: tint the sprite's own pixels only.
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = prevAlpha * 0.85 * this.settings.flashIntensity;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx, dy, baked.width, baked.height);
        ctx.restore();
      }
      if (alpha !== 1) ctx.globalAlpha = prevAlpha;
    }, wy);
  }

  #drawMissing(wx, wy, layer) {
    const p = this.camera.worldToScreen(wx, wy, this._pt);
    const px = Math.round(p.x - TILE / 2);
    const py = Math.round(p.y - TILE / 2);
    this.push(layer, (ctx) => {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#000000';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    }, wy);
  }

  // -------------------------------------------------------------------------
  // Primitives used by VFX and debug views
  // -------------------------------------------------------------------------

  drawCircle(wx, wy, radiusWorld, color, { layer = LAYER_ORDER.VFX, alpha = 1, fill = true, width = 2 } = {}) {
    const p = this.camera.worldToScreen(wx, wy, this._pt);
    const px = p.x;
    const py = p.y;
    const r = radiusWorld * TILE;
    const c = this.settings.grayscale ? toGrayscale(color) : color;
    this.push(layer, (ctx) => {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = c;
        ctx.fill();
      } else {
        ctx.strokeStyle = c;
        ctx.lineWidth = width;
        ctx.stroke();
      }
      ctx.globalAlpha = prev;
    }, wy);
  }

  drawRect(wx, wy, wWorld, hWorld, color, { layer = LAYER_ORDER.VFX, alpha = 1, fill = true, width = 2 } = {}) {
    const p = this.camera.worldToScreen(wx, wy, this._pt);
    const px = Math.round(p.x - (wWorld * TILE) / 2);
    const py = Math.round(p.y - (hWorld * TILE) / 2);
    const w = Math.round(wWorld * TILE);
    const h = Math.round(hWorld * TILE);
    const c = this.settings.grayscale ? toGrayscale(color) : color;
    this.push(layer, (ctx) => {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      if (fill) {
        ctx.fillStyle = c;
        ctx.fillRect(px, py, w, h);
      } else {
        ctx.strokeStyle = c;
        ctx.lineWidth = width;
        ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
      }
      ctx.globalAlpha = prev;
    }, wy);
  }

  drawLine(x0, y0, x1, y1, color, { layer = LAYER_ORDER.VFX, alpha = 1, width = 2, dashed = false } = {}) {
    const a = this.camera.worldToScreen(x0, y0, { x: 0, y: 0 });
    const b = this.camera.worldToScreen(x1, y1, { x: 0, y: 0 });
    const c = this.settings.grayscale ? toGrayscale(color) : color;
    this.push(layer, (ctx) => {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      ctx.strokeStyle = c;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (dashed) ctx.setLineDash([]);
      ctx.globalAlpha = prev;
    }, Math.max(y0, y1));
  }

  /**
   * Full-screen flash, honouring the accessibility intensity setting.
   * R-ART-003: reducing this must not change any mechanical outcome, so callers
   * treat it as pure decoration.
   */
  drawFlash(color, alpha) {
    const scaled = alpha * this.settings.flashIntensity;
    if (scaled <= 0.001) return;
    const c = this.settings.grayscale ? toGrayscale(color) : color;
    this.push(LAYER_ORDER.OVERLAY, (ctx) => {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * Math.min(1, scaled);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.globalAlpha = prev;
    });
  }

  /**
   * Department lighting overlay and vignette.
   * GDD 18.2 is explicit that critical combat elements are never hidden by
   * darkness, so strength is clamped well below opaque.
   */
  drawLighting(department) {
    const light = department?.presentation?.lighting;
    if (!light) return;
    const tint = this.settings.grayscale ? toGrayscale(light.tint) : light.tint;
    const strength = Math.min(light.strength ?? 0, 0.6);
    const vignette = Math.min(light.vignette ?? 0, 0.9);
    this.push(LAYER_ORDER.OVERLAY, (ctx) => {
      if (strength > 0) {
        const prev = ctx.globalAlpha;
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = strength;
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = prev;
      }
      if (vignette > 0) {
        const g = ctx.createRadialGradient(
          LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT * 0.35,
          LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_HEIGHT * 0.85,
        );
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${vignette * 0.7})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      }
    });
  }

  /** Screen-space text. HUD only; world labels use drawWorldLabel. */
  drawText(text, sx, sy, opts = {}) {
    const {
      layer = LAYER_ORDER.HUD, size = 12, color = '#ffffff', align = 'left',
      weight = 'normal', shadow = true, alpha = 1,
    } = opts;
    this.push(layer, (ctx) => {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * alpha;
      ctx.font = `${weight} ${size}px "Courier New", ui-monospace, monospace`;
      ctx.textAlign = align;
      ctx.textBaseline = 'top';
      if (shadow) {
        // A hard 1px shadow keeps text legible over any department palette.
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillText(text, sx + 1, sy + 1);
      }
      ctx.fillStyle = this.settings.grayscale ? toGrayscale(color) : color;
      ctx.fillText(text, sx, sy);
      ctx.globalAlpha = prev;
    });
  }

  /** Label anchored to a world position, e.g. a shop price (GDD 17.2). */
  drawWorldLabel(text, wx, wy, opts = {}) {
    const p = this.camera.worldToScreen(wx, wy, this._pt);
    this.drawText(text, Math.round(p.x), Math.round(p.y), {
      align: 'center', size: 11, ...opts, layer: opts.layer ?? LAYER_ORDER.HUD,
    });
  }

  /** Debug: spawn zones and collision boxes for the readability review. */
  drawDebugZones(template, rect) {
    if (!this.settings.debugCollision) return;
    for (const zone of template.spawnZones || []) {
      const [zx, zy, zw, zh] = zone.rect;
      this.drawRect(
        rect.x + zx + zw / 2, rect.y + zy + zh / 2, zw, zh,
        DEBUG_ZONE_COLORS[zone.zone] || '#ffffff',
        { fill: false, alpha: 0.55, layer: LAYER_ORDER.VFX, width: 1 },
      );
    }
  }
}

const DOOR_STATE_COLORS = Object.freeze({
  OPEN: { frame: '#2b2b36', fill: '#141420' },
  SEALED: { frame: '#8a2a2a', fill: '#3a1414', bar: '#d04a4a' },
  LOCKED_CARD: { frame: '#2a5a8a', fill: '#14243a', bar: '#4a9ad0' },
  LOCKED_DOUBLE: { frame: '#8a6a1a', fill: '#3a2e14', bar: '#e0be4a' },
  BOSS: { frame: '#6a1a2a', fill: '#2a0a14', bar: '#a02a3a' },
  SECRET: { frame: '#2b2b36', fill: '#1a1a26' },
});

const DEBUG_ZONE_COLORS = Object.freeze({
  ENTRY_SAFE: '#54b070',
  GROUND_MELEE: '#e04a54',
  GROUND_RANGED: '#e8c246',
  AIR: '#7fb0ee',
  WALL_EDGE: '#c78af0',
  REWARD: '#ffffff',
  BOSS_ANCHOR: '#ff9a2a',
  OBJECT_ANCHOR: '#3fb0b8',
});

function createCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('Renderer requires a canvas implementation.');
}

export { DOOR_STATE_COLORS, GEOMETRY };
