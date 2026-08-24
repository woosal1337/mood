export type Item = {
  id: string;
  w: number;
  h: number;
  board: number;

  kind: 0 | 1 | 2;
};

export type Board = {
  author: string;
  authorName: string;
  topic: string;
  text: string;
  url: string;
  postedAt: string;
  likes: number;
  bookmarks: number;
  items: number[];
};

export type Deck = {
  items: Item[];
  boards: Board[];
  counts: { items: number; boards: number; authors: number; videos: number };
};

type Placed = {
  item: number;

  y: number;
  h: number;
};

type Column = {
  placed: Placed[];

  height: number;

  phase: number;

  bottoms: number[];
};

export type Plane = {
  columns: Column[];
  colW: number;
  gap: number;

  pitch: number;

  width: number;

  place: { col: number; y: number; h: number }[];
};

export type Camera = {
  x: number;
  y: number;

  z: number;
};

export type Tile = {
  key: string;
  item: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const MIN_ZOOM = 0.34;
export const MAX_ZOOM = 4;

export const OVERSCAN = 300;

/** Tiles have a constant size in world units, so the overscan must be capped in
 *  world units too. Left as pure screen pixels it divides by the zoom, and at
 *  the minimum zoom that margin grows to 880 world units around a 5,714-wide
 *  viewport — most of the mounted set off screen. */
const MAX_PAD = 560;

const MAX_TILES = 760;

export function buildPlane(items: Item[], colW: number, gap: number): Plane {
  const pitch = colW + gap;
  const heights = items.map((it) => Math.max(40, Math.round((colW * it.h) / it.w)));

  let total = 0;
  for (const h of heights) total += h + gap;

  const ideal = Math.round(Math.sqrt((16 * total) / (9 * pitch)));

  const n = Math.max(3, Math.min(ideal, Math.floor(items.length / 4) || 1));

  const rnd = mulberry32(0x9e3779b9);

  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const columns: Column[] = Array.from({ length: n }, () => ({
    placed: [],
    height: 0,
    phase: 0,
    bottoms: [],
  }));

  const place: Plane["place"] = new Array(items.length);

  for (const i of order) {
    let best = 0;
    for (let c = 1; c < n; c++) if (columns[c].height < columns[best].height) best = c;
    const col = columns[best];
    const h = heights[i];
    col.placed.push({ item: i, y: col.height, h });
    col.bottoms.push(col.height + h);
    place[i] = { col: best, y: col.height, h };
    col.height += h + gap;
  }

  for (const col of columns) col.phase = rnd() * col.height;

  return { columns, colW, gap, pitch, width: n * pitch, place };
}

export function visible(plane: Plane, cam: Camera, vw: number, vh: number): Tile[] {
  const { columns, pitch, colW } = plane;
  const n = columns.length;
  const pad = Math.min(OVERSCAN / cam.z, MAX_PAD);

  const x0 = cam.x - pad;
  const x1 = cam.x + vw / cam.z + pad;
  const y0 = cam.y - pad;
  const y1 = cam.y + vh / cam.z + pad;

  const out: Tile[] = [];

  const s0 = Math.floor(x0 / pitch);
  const s1 = Math.floor(x1 / pitch);

  for (let s = s0; s <= s1 && out.length < MAX_TILES; s++) {
    const c = ((s % n) + n) % n;
    const col = columns[c];
    if (col.height <= 0) continue;

    const x = s * pitch;
    const m0 = Math.floor((y0 - col.phase) / col.height);
    const m1 = Math.floor((y1 - col.phase) / col.height);

    for (let m = m0; m <= m1 && out.length < MAX_TILES; m++) {
      const base = col.phase + m * col.height;
      const ly0 = y0 - base;
      const ly1 = y1 - base;

      let k = lowerBound(col.bottoms, ly0);
      for (; k < col.placed.length; k++) {
        const p = col.placed[k];
        if (p.y >= ly1) break;
        out.push({
          key: `${s}.${m}.${p.item}`,
          item: p.item,
          x,
          y: base + p.y,
          w: colW,
          h: p.h,
        });
        if (out.length >= MAX_TILES) break;
      }
    }
  }

  return out;
}

export function frameItem(
  plane: Plane,
  cam: Camera,
  item: number,
  vw: number,
  vh: number,
  z = cam.z
): Camera {
  const p = plane.place[item];
  if (!p) return cam;
  const col = plane.columns[p.col];
  const n = plane.columns.length;

  const cx = cam.x + vw / cam.z / 2;
  const cy = cam.y + vh / cam.z / 2;

  const s = p.col + n * Math.round((cx / plane.pitch - p.col) / n);
  const m = Math.round((cy - p.y - col.phase) / col.height);

  const wx = s * plane.pitch + plane.colW / 2;
  const wy = col.phase + m * col.height + p.y + p.h / 2;

  return { x: wx - vw / z / 2, y: wy - vh / z / 2, z };
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > v) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "");

export const tinyOf = (id: string) => `${BASE}/media/${id}-tiny.webp`; 
export const thumbOf = (id: string) => `${BASE}/media/${id}-thumb.webp`; 
export const fullOf = (id: string) => `${BASE}/media/${id}-full.webp`; 
export const videoOf = (id: string) => `${BASE}/media/video/${id}.mp4`;

export function tierFor(devicePx: number, now: 0 | 1 | 2): 0 | 1 | 2 {
  const up1 = 250, down1 = 200;
  const up2 = 760, down2 = 620;
  if (now === 0) return devicePx > up1 ? (devicePx > up2 ? 2 : 1) : 0;
  if (now === 1) return devicePx > up2 ? 2 : devicePx < down1 ? 0 : 1;
  return devicePx < down1 ? 0 : devicePx < down2 ? 1 : 2;
}
