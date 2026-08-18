"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Canvas, { type CanvasHandle } from "./Canvas";
import Search from "./Search";
import Tools from "./Tools";
import Viewer from "./Viewer";
import { buildPlane, type Deck } from "./lib/plane";

const COL_W = 300;
const GAP = 14;

type Raw = {
  counts: Deck["counts"];
  boards: { a: string; n: string; t: string; x: string; u: string; d: string; l: number; b: number; i: number[] }[];
  items: [string, number, number, number, 0 | 1 | 2][];
};

export default function Mood() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ item: number; rect: DOMRect } | null>(null);
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<Set<number> | null>(null);
  const [hint, setHint] = useState(true);

  const canvas = useRef<CanvasHandle>(null);

  useEffect(() => {
    let alive = true;
    fetch("data/mood.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw: Raw) => alive && setDeck(decode(raw)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const plane = useMemo(
    () => (deck ? buildPlane(deck.items, COL_W, GAP) : null),
    [deck]
  );

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setMatch(null);
  }, []);

  const dismissHint = useCallback(() => setHint(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (view) return;

      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === "Escape" && searching) {
        e.preventDefault();
        closeSearch();
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      } else if (e.key === "0" || e.key === "h") {
        canvas.current?.home();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, searching, closeSearch]);

  const onOpen = useCallback((item: number, rect: DOMRect) => {
    setView({ item, rect });
    setHint(false);
  }, []);

  const step = useCallback(
    (d: number) =>
      setView((v) => {
        if (!v || !deck) return v;
        const n = deck.items.length;
        return { ...v, item: (v.item + d + n) % n };
      }),
    [deck]
  );

  const pick = useCallback((item: number) => setView((v) => (v ? { ...v, item } : v)), []);

  const flyTo = useCallback((item: number) => canvas.current?.flyTo(item), []);

  if (failed) {
    return (
      <main style={centred}>
        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
          The board data did not load. Run <code className="mono">npm run data</code> and reload.
        </p>
      </main>
    );
  }

  if (!deck || !plane) return <main style={centred} aria-busy="true" />;

  return (
    <main>
      <Canvas
        ref={canvas}
        deck={deck}
        plane={plane}
        match={match}
        onOpen={onOpen}
        onFirstInput={dismissHint}
      />

      {searching && (
        <Search deck={deck} onMatch={setMatch} onGo={flyTo} onClose={closeSearch} />
      )}

      {view && (
        <Viewer
          deck={deck}
          item={view.item}
          from={{
            left: view.rect.left,
            top: view.rect.top,
            width: view.rect.width,
            height: view.rect.height,
          }}
          onClose={() => setView(null)}
          onStep={step}
          onPick={pick}
        />
      )}

      <Tools />

      <Hint show={hint && !view && !searching} counts={deck.counts} />
    </main>
  );
}

function Hint({ show, counts }: { show: boolean; counts: Deck["counts"] }) {
  return (
    <div
      aria-hidden={!show}
      className="mono"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 22,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: show ? 1 : 0,
        transition: "opacity 700ms var(--ease-standard)",
      }}
    >
      <p
        style={{
          margin: 0,
          padding: "7px 14px",
          borderRadius: 999,
          fontSize: 10.5,
          letterSpacing: "0.02em",
          color: "rgb(255 255 255 / 0.7)",
          background: "rgb(0 0 0 / 0.5)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <span className="tnum">{counts.items.toLocaleString()}</span> images ·{" "}
        <span className="tnum">{counts.videos}</span> videos · drag to move · pinch or ⌘scroll to
        zoom · <kbd>/</kbd> to search
      </p>
    </div>
  );
}

function toggleTheme() {
  const root = document.documentElement;
  const now = root.dataset.theme;
  const dark = now ? now === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem("mood.theme", next);
  } catch {
  }
}

function decode(raw: Raw): Deck {
  return {
    counts: raw.counts,
    items: raw.items.map(([id, w, h, board, kind]) => ({ id, w, h, board, kind })),
    boards: raw.boards.map((b) => ({
      author: b.a,
      authorName: b.n,
      topic: b.t,
      text: b.x,
      url: b.u,
      postedAt: b.d,
      likes: b.l,
      bookmarks: b.b,
      items: b.i,
    })),
  };
}

const centred: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  textAlign: "center",
};
