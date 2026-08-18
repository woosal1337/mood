"use client";

import { memo, useState } from "react";
import { type Item, fullOf, thumbOf, tinyOf, videoOf } from "./lib/plane";

type Props = {
  index: number;
  item: Item;
  x: number;
  y: number;
  w: number;
  h: number;

  tier: 0 | 1 | 2;

  dim: boolean;

  live: boolean;
  onOpen: (index: number, el: HTMLElement) => void;
};

function TileBase({ index, item, x, y, w, h, tier, dim, live, onOpen }: Props) {
  const [wantThumb, setWantThumb] = useState(tier >= 1);
  const [wantFull, setWantFull] = useState(tier >= 2);
  if (tier >= 1 && !wantThumb) setWantThumb(true);
  if (tier >= 2 && !wantFull) setWantFull(true);

  const [tinyReady, setTinyReady] = useState(false);
  const [thumbReady, setThumbReady] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const [hover, setHover] = useState(false);

  const playing = item.kind === 1 && hover && live;

  return (
    <div
      className="tile"
      data-dim={dim || undefined}
      style={{ left: x, top: y, width: w, height: h }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={(e) => onOpen(index, e.currentTarget)}
      role="button"
      tabIndex={-1}
      aria-label={item.id}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tinyOf(item.id)}
        alt=""
        draggable={false}
        decoding="async"
        data-loaded={tinyReady || undefined}
        onLoad={() => setTinyReady(true)}
      />

      {wantThumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbOf(item.id)}
          alt=""
          draggable={false}
          decoding="async"
          data-loaded={thumbReady || undefined}
          onLoad={() => setThumbReady(true)}
          style={layer}
        />
      )}

      {wantFull && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fullOf(item.id)}
          alt=""
          draggable={false}
          decoding="async"
          data-loaded={fullReady || undefined}
          onLoad={() => setFullReady(true)}
          style={layer}
        />
      )}

      {playing && (
        <video
          src={videoOf(item.id)}
          poster={thumbOf(item.id)}
          muted
          loop
          autoPlay
          playsInline
          data-loaded="true"
          style={layer}
        />
      )}

      {item.kind !== 0 && !playing && <PlayMark />}
    </div>
  );
}

const layer: React.CSSProperties = { position: "absolute", inset: 0 };

function PlayMark() {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: 10,
        bottom: 10,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "rgb(0 0 0 / 0.42)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <svg width="8" height="9" viewBox="0 0 8 9" fill="#fff">
        <path d="M0 0.5 L8 4.5 L0 8.5 Z" />
      </svg>
    </span>
  );
}

export default memo(TileBase);
