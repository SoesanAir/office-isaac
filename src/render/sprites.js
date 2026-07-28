/**
 * Pixel-art sprite system.
 *
 * GDD refs: 18.1 (crisp 2D top-down pixel art, chunky silhouettes), 18.2
 *           (32px reference grid, nearest-neighbour integer scaling, no
 *           smoothing), 18.3 (distinct silhouette per enemy family; elite
 *           variants keep recognition and add one marker), 18.4 (item layer
 *           priority), 18.5 (friendly vs hostile outline families),
 *           R-ART-001 (readable at native gameplay scale), R-ART-002 (unique
 *           inventory sprite per collectible), R-ART-004 / R-DPT-005 (grayscale
 *           and material readability).
 *
 * Sprites are authored as palette-indexed character grids. That choice is
 * deliberate: art lives in version control as reviewable text, diffs are
 * meaningful, a palette swap gives free department reskins and elite markers,
 * and the same definitions can be validated headlessly in CI where no canvas
 * exists.
 *
 * Baking happens once at boot into offscreen canvases, so per-frame drawing is a
 * single `drawImage` with nearest-neighbour sampling.
 */

/**
 * Shared palette. Keys are single characters used inside sprite grids.
 * Lower-case is the base tone, upper-case the lighter/accent tone of the same
 * hue, which keeps authored grids readable at a glance.
 */
export const PALETTE = Object.freeze({
  ' ': null,   // transparent
  '.': null,   // transparent (readable filler)

  // Neutral structure
  'k': '#14141c', // outline black
  'K': '#26263a', // shadow
  'g': '#4a4a5e', // dark grey
  'G': '#6d6d84', // mid grey
  'h': '#9a9aae', // light grey
  'H': '#c8c8d6', // highlight grey
  'w': '#eef0f6', // white / paper
  'W': '#ffffff', // pure white

  // Skin and hair
  's': '#e0a878', // skin mid
  'S': '#f2c9a0', // skin light
  'd': '#a9714a', // skin dark
  'n': '#3a2a22', // hair dark
  'N': '#6b4a34', // hair mid

  // Corporate blues (Open Office / player)
  'b': '#2f5aa8',
  'B': '#4a7fd4',
  'c': '#7fb0ee', // cyan-blue light
  'C': '#b9dcff',

  // Reds (composure, hostile, liability)
  'r': '#b02a3a',
  'R': '#e04a54',
  'p': '#f2848c', // pink highlight

  // Warm (caffeine, wood, cardboard)
  'o': '#b06a2c',
  'O': '#e09a4a',
  'y': '#e8c246', // yellow
  'Y': '#f7e07a', // pale yellow

  // Greens (plants, approval, money)
  'e': '#2f7a4a',
  'E': '#54b070',

  // Purples / magenta (IT corruption, marketing)
  'm': '#6a3a9a',
  'M': '#c78af0',
  'v': '#9a6ad4',
  'V': '#c8a8f0',

  // Teal (IT status lights)
  't': '#1f6f76',
  'T': '#3fb0b8',

  // Gold (executive, premium)
  'a': '#8a6a1a',
  'A': '#e0be4a',
  'q': '#fff0a8',
});

/**
 * Outline families (GDD 18.5). Player attacks and hostile attacks must never
 * share the same outline colour language, so this table is the single source of
 * truth and every VFX call refers to it by name.
 */
export const OUTLINE_FAMILY = Object.freeze({
  FRIENDLY: '#bfe4ff',
  HOSTILE: '#ff5a4a',
  NEUTRAL: '#ffe9a8',
  ENVIRONMENT: '#c8c8d6',
  PICKUP: '#ffffff',
  HAZARD: '#ff9a2a',
  PLAYER: '#0a0a12',
});

/** In-memory sprite definition store. Pure data; safe in Node. */
const definitions = new Map();

/** Baked canvases, browser only. spriteKey -> { frames: HTMLCanvasElement[], w, h } */
const baked = new Map();

/**
 * Register a sprite definition.
 *
 * @param {object} def
 * @param {string} def.id stable content id, e.g. 'enemy_office_drone'
 * @param {string[][]} def.frames one grid of equal-length strings per frame
 * @param {Record<string,string|null>} [def.palette] extra/override palette entries
 * @param {[number,number]} [def.anchor] normalised origin, default feet-centre
 * @param {number} [def.scale] integer pixel size multiplier baked in, default 1
 * @param {string} [def.silhouette] free-text note used by the readability review
 */
export function defineSprite(def) {
  if (definitions.has(def.id)) {
    throw new Error(`Duplicate sprite id "${def.id}" (R-ART-002).`);
  }
  const frames = def.frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error(`Sprite "${def.id}" has no frames.`);
  }
  const h = frames[0].length;
  const w = frames[0][0].length;
  for (let f = 0; f < frames.length; f += 1) {
    const grid = frames[f];
    if (grid.length !== h) {
      throw new Error(`Sprite "${def.id}" frame ${f} has ${grid.length} rows, expected ${h}.`);
    }
    for (let y = 0; y < grid.length; y += 1) {
      if (grid[y].length !== w) {
        throw new Error(
          `Sprite "${def.id}" frame ${f} row ${y} has width ${grid[y].length}, expected ${w}.`,
        );
      }
    }
  }
  const record = Object.freeze({
    id: def.id,
    frames,
    palette: def.palette ? Object.freeze({ ...def.palette }) : null,
    anchor: def.anchor || [0.5, 0.85],
    scale: def.scale || 1,
    silhouette: def.silhouette || '',
    width: w,
    height: h,
    frameDurations: def.frameDurations || null,
  });
  definitions.set(def.id, record);
  return record;
}

export function getSpriteDef(id) {
  return definitions.get(id);
}

export function allSpriteDefs() {
  return [...definitions.values()];
}

export function spriteCount() {
  return definitions.size;
}

/** Resolve a character to a CSS colour, honouring per-sprite palette overrides. */
function resolveColor(ch, spritePalette, swap) {
  if (swap && swap[ch] !== undefined) return swap[ch];
  if (spritePalette && spritePalette[ch] !== undefined) return spritePalette[ch];
  const base = PALETTE[ch];
  if (base !== undefined) return base;
  // Unknown character: loud magenta so it is impossible to miss in review.
  return '#ff00ff';
}

/**
 * Bake one sprite into canvases.
 * @param {string} id
 * @param {{swap?: Record<string,string|null>, outline?: string|null, scale?: number, grayscale?: boolean}} [opts]
 * @returns {{frames: object[], width: number, height: number, anchor: number[]}}
 */
export function bakeSprite(id, opts = {}) {
  const def = definitions.get(id);
  if (!def) throw new Error(`Unknown sprite "${id}".`);
  const scale = opts.scale || def.scale || 1;
  const outline = opts.outline ?? null;
  const pad = outline ? 1 : 0;
  const key = `${id}|${scale}|${outline || ''}|${opts.grayscale ? 'gs' : ''}|${
    opts.swap ? JSON.stringify(opts.swap) : ''
  }`;
  const cached = baked.get(key);
  if (cached) return cached;

  const w = def.width;
  const h = def.height;
  const outW = (w + pad * 2) * scale;
  const outH = (h + pad * 2) * scale;
  const frames = [];

  for (const grid of def.frames) {
    const canvas = createCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (outline) {
      // 4-neighbour dilation of the occupied mask, drawn under the sprite.
      ctx.fillStyle = outline;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (resolveColor(grid[y][x], def.palette, opts.swap) === null) continue;
          for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + ox;
            const ny = y + oy;
            const insideSprite =
              nx >= 0 && ny >= 0 && nx < w && ny < h &&
              resolveColor(grid[ny][nx], def.palette, opts.swap) !== null;
            if (!insideSprite) {
              ctx.fillRect((nx + pad) * scale, (ny + pad) * scale, scale, scale);
            }
          }
        }
      }
    }

    for (let y = 0; y < h; y += 1) {
      const row = grid[y];
      for (let x = 0; x < w; x += 1) {
        let color = resolveColor(row[x], def.palette, opts.swap);
        if (color === null) continue;
        if (opts.grayscale) color = toGrayscale(color);
        ctx.fillStyle = color;
        ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
      }
    }
    frames.push(canvas);
  }

  const result = Object.freeze({
    id,
    frames,
    width: outW,
    height: outH,
    pad,
    scale,
    anchor: def.anchor,
    frameDurations: def.frameDurations,
  });
  baked.set(key, result);
  return result;
}

/** Rec. 601 luma, used by the grayscale readability review (R-ART-004). */
export function toGrayscale(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const c = l.toString(16).padStart(2, '0');
  return `#${c}${c}${c}`;
}

function createCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('bakeSprite requires a canvas implementation (browser only).');
}

/**
 * Draw a baked sprite. `x, y` are in device pixels of the target context;
 * callers convert from world units first so this stays a pure blit.
 */
export function drawBaked(ctx, bakedSprite, frameIndex, x, y, opts = {}) {
  const frames = bakedSprite.frames;
  const frame = frames[((frameIndex % frames.length) + frames.length) % frames.length];
  const [ax, ay] = opts.anchor || bakedSprite.anchor;
  const w = bakedSprite.width;
  const h = bakedSprite.height;
  const dx = Math.round(x - w * ax);
  const dy = Math.round(y - h * ay);

  const alpha = opts.alpha ?? 1;
  const prevAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;

  if (opts.flipX) {
    ctx.save();
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(frame, dx, dy);
  }

  if (alpha !== 1) ctx.globalAlpha = prevAlpha;
}

/**
 * Compute the silhouette signature of a sprite: the set of occupied cells,
 * hashed. Two enemy families sharing a signature violate GDD 18.3, so the
 * readability test suite asserts uniqueness across families.
 */
export function silhouetteSignature(id, frameIndex = 0) {
  const def = definitions.get(id);
  if (!def) throw new Error(`Unknown sprite "${id}".`);
  const grid = def.frames[frameIndex];
  let bits = '';
  for (let y = 0; y < def.height; y += 1) {
    for (let x = 0; x < def.width; x += 1) {
      bits += resolveColor(grid[y][x], def.palette, null) === null ? '0' : '1';
    }
  }
  return bits;
}

/** Fraction of the bounding box that is opaque. Very low values read as noise. */
export function silhouetteDensity(id, frameIndex = 0) {
  const sig = silhouetteSignature(id, frameIndex);
  let filled = 0;
  for (const ch of sig) if (ch === '1') filled += 1;
  return filled / sig.length;
}

/** Clear baked caches (settings change, e.g. grayscale review toggle). */
export function invalidateBakedSprites() {
  baked.clear();
}

/** Test seam: allows suites to register the same id across separate cases. */
export function resetSpriteDefinitions() {
  definitions.clear();
  baked.clear();
}
