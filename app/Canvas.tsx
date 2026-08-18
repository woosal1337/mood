"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Tile from "./Tile";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  type Camera,
  type Deck,
  type Plane,
  type Tile as TileBox,
  frameItem,
  tierFor,
  visible,
} from "./lib/plane";

const RECALC = 140;

const FRICTION = 0.94;
const STOP = 0.015;

const CLICK_SLOP = 5;

const FLY_MS = 620;

export type CanvasHandle = {
  flyTo: (item: number) => void;
  home: () => void;
};

type Props = {
  deck: Deck;
  plane: Plane;

  match: Set<number> | null;
  onOpen: (item: number, rect: DOMRect) => void;
  onFirstInput: () => void;
};

export default forwardRef<CanvasHandle, Props>(function Canvas(
  { deck, plane, match, onOpen, onFirstInput },
  ref
) {
  const viewRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const cam = useRef<Camera>({ x: 0, y: 0, z: 0.75 });
  const size = useRef({ w: 0, h: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const dirty = useRef(true);
  const lastCalc = useRef<Camera>({ x: NaN, y: NaN, z: NaN });
  const tierRef = useRef<0 | 1 | 2>(1);
  const fly = useRef<{ from: Camera; to: Camera; t0: number } | null>(null);
  const touched = useRef(false);

  const drag = useRef({ active: false, moved: 0, lastX: 0, lastY: 0, captured: false });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const [tiles, setTiles] = useState<TileBox[]>([]);
  const [tier, setTier] = useState<0 | 1 | 2>(1);
  const [live, setLive] = useState(true);

  const markTouched = useCallback(() => {
    if (touched.current) return;
    touched.current = true;
    onFirstInput();
  }, [onFirstInput]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomAt = useCallback((nz: number, px: number, py: number) => {
    const c = cam.current;
    const z = clampZoom(nz);
    if (z === c.z) return;
    const wx = c.x + px / c.z;
    const wy = c.y + py / c.z;
    c.x = wx - px / z;
    c.y = wy - py / z;
    c.z = z;
    dirty.current = true;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(item: number) {
        const { w, h } = size.current;
        const to = frameItem(plane, cam.current, item, w, h, Math.max(cam.current.z, 0.9));
        fly.current = { from: { ...cam.current }, to, t0: performance.now() };
        vel.current.x = 0;
        vel.current.y = 0;
      },
      home() {
        fly.current = {
          from: { ...cam.current },
          to: { x: 0, y: 0, z: 0.75 },
          t0: performance.now(),
        };
        vel.current.x = 0;
        vel.current.y = 0;
      },
    }),
    [plane]
  );

  useEffect(() => {
    let raf = 0;

    const recalc = () => {
      const c = cam.current;
      const { w, h } = size.current;
      if (!w || !h) return;
      setTiles(visible(plane, c, w, h));
      lastCalc.current = { ...c };

      const px = plane.colW * c.z * (window.devicePixelRatio || 1);
      const next = tierFor(px, tierRef.current);
      if (next !== tierRef.current) {
        tierRef.current = next;
        setTier(next);
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = cam.current;
      let moved = dirty.current;
      dirty.current = false;

      if (fly.current) {
        const { from, to, t0 } = fly.current;
        const p = Math.min(1, (performance.now() - t0) / FLY_MS);
        const e = 1 - Math.pow(1 - p, 3);
        c.x = from.x + (to.x - from.x) * e;
        c.y = from.y + (to.y - from.y) * e;
        c.z = from.z + (to.z - from.z) * e;
        if (p >= 1) fly.current = null;
        moved = true;
      } else if (!drag.current.active) {
        const v = vel.current;
        if (Math.abs(v.x) > STOP || Math.abs(v.y) > STOP) {
          c.x += v.x;
          c.y += v.y;
          v.x *= FRICTION;
          v.y *= FRICTION;
          moved = true;
        }
      }

      if (!moved) return;

      const layer = layerRef.current;
      if (layer) {
        layer.style.transform = `translate3d(${-c.x * c.z}px, ${-c.y * c.z}px, 0) scale(${c.z})`;
      }

      const l = lastCalc.current;
      const drifted =
        Math.abs(c.x - l.x) * c.z > RECALC ||
        Math.abs(c.y - l.y) * c.z > RECALC ||
        !(c.z / l.z > 0.97 && c.z / l.z < 1.03);
      if (drifted || Number.isNaN(l.x)) recalc();
    };

    const onResize = () => {
      const el = viewRef.current;
      if (!el) return;
      size.current = { w: el.clientWidth, h: el.clientHeight };
      dirty.current = true;
      recalc();
    };

    onResize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [plane]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      markTouched();
      fly.current = null;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;

      if (e.ctrlKey || e.metaKey) {
        zoomAt(cam.current.z * Math.exp(-e.deltaY * 0.01), px, py);
        return;
      }
      const c = cam.current;
      c.x += e.deltaX / c.z;
      c.y += e.deltaY / c.z;
      vel.current.x = 0;
      vel.current.y = 0;
      dirty.current = true;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, markTouched]);

  const onPointerDown = (e: React.PointerEvent) => {
    markTouched();
    fly.current = null;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      drag.current.active = false;
      return;
    }

    drag.current = { active: true, moved: 0, lastX: e.clientX, lastY: e.clientY, captured: false };
    vel.current.x = 0;
    vel.current.y = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const r = viewRef.current!.getBoundingClientRect();
      const c = cam.current;

      c.x -= (cx - pinch.current.cx) / c.z;
      c.y -= (cy - pinch.current.cy) / c.z;
      dirty.current = true;

      if (pinch.current.dist > 0) {
        zoomAt((c.z * dist) / pinch.current.dist, cx - r.left, cy - r.top);
      }
      pinch.current = { dist, cx, cy };
      return;
    }

    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);

    if (!d.captured && d.moved > CLICK_SLOP) {
      d.captured = true;
      viewRef.current?.setPointerCapture(e.pointerId);
      setLive(false);
    }

    const c = cam.current;
    c.x -= dx / c.z;
    c.y -= dy / c.z;

    vel.current.x = -dx / c.z;
    vel.current.y = -dy / c.z;
    dirty.current = true;
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    if (drag.current.captured) {
      if (viewRef.current?.hasPointerCapture(e.pointerId)) {
        viewRef.current.releasePointerCapture(e.pointerId);
      }
      drag.current.captured = false;
    }
    if (pointers.current.size === 0) {
      drag.current.active = false;
      setLive(true);
    }
  };

  const handleOpen = useCallback(
    (item: number, el: HTMLElement) => {
      if (drag.current.moved > CLICK_SLOP) return;
      onOpen(item, el.getBoundingClientRect());
    },
    [onOpen]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const c = cam.current;
      const step = 220 / c.z;
      const { w, h } = size.current;
      let hit = true;
      switch (e.key) {
        case "ArrowLeft": c.x -= step; break;
        case "ArrowRight": c.x += step; break;
        case "ArrowUp": c.y -= step; break;
        case "ArrowDown": c.y += step; break;
        case "PageUp": c.y -= h / c.z; break;
        case "PageDown": c.y += h / c.z; break;
        case "=":
        case "+": zoomAt(c.z * 1.25, w / 2, h / 2); break;
        case "-":
        case "_": zoomAt(c.z / 1.25, w / 2, h / 2); break;
        default: hit = false;
      }
      if (!hit) return;
      e.preventDefault();
      markTouched();
      fly.current = null;
      dirty.current = true;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt, markTouched]);

  return (
    <div
      ref={viewRef}
      className="fixed inset-0"
      style={{
        touchAction: "none",

        cursor: live ? "grab" : "grabbing",
        userSelect: "none",
        WebkitUserSelect: "none",

        overflow: "hidden",
        contain: "strict",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div ref={layerRef} className="plane">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            index={t.item}
            item={deck.items[t.item]}
            x={t.x}
            y={t.y}
            w={t.w}
            h={t.h}
            tier={tier}
            dim={match !== null && !match.has(t.item)}
            live={live}
            onOpen={handleOpen}
          />
        ))}
      </div>
    </div>
  );
});
