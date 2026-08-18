# AGENTS.md — mood

Read `DESIGN.md` before you change anything the user sees. It records the
refusals, and most of them cost a bug to learn.

## The shape of the thing

A static Next.js export. No server, no database, no API. `data/boards.json` is
the source of truth. `scripts/build-data.mjs` flattens it into
`public/data/mood.json`, which the client fetches at runtime.

Media paths are never stored. Every file is named after its image id, so the
client derives all four paths from the id:

```
/media/{id}-tiny.webp     192px
/media/{id}-thumb.webp    480px
/media/{id}-full.webp    1440px
/media/video/{id}.mp4
```

If you break that rule, `build-data.mjs` stops and tells you which file is
missing. Keep it that way.

## Comments

There are none, by choice. The reasoning lives in `DESIGN.md`, which is where to
put it — a decision worth explaining is worth explaining once, somewhere a
reader finds it before they open the file. Only functional directives survive in
code: `eslint-disable`, `@ts-`, `@type`.

## Rules

1. `app/lib/plane.ts` stays pure. No React, no DOM, no `window`. The layout and
   the wrap are the hard part, and they are testable only while they are
   isolated.
2. Never write to the DOM from an input handler. The camera is a ref, the frame
   loop owns the transform. See `DESIGN.md` section 3.
3. Do not add a control that is always on the screen. If a feature needs one,
   put it behind a key.
4. Run `npm run data` after any change to `data/boards.json`. The payload is
   generated and is not edited by hand.
5. `media/original/` is not served and must stay out of `public/`.
6. Media paths are derived from the id and never stored. That is what made
   moving 401 MB off the deployment one environment variable.

## After a change

```bash
npx tsc --noEmit
npm run build
```

Stop `npm run dev` first. Both write `.next`, so a production build run beside
a dev server leaves the dev server serving HTML that points at chunks the build
has already replaced. The page then loads to a blank body with four 404s and
nothing in the log to explain it. Kill dev, build, start dev again.

There is no test suite. Check the plane in a browser: pan a long way in both
axes, zoom to both limits, open a tile, open a video tile, and search.

## Adding sites

`npm run tool <url>` puts a site on the tools rail. `scripts/add-site.mjs` puts
a company's own imagery on the plane — it takes a `group<TAB>source` list, so
the selection stays a judgement call rather than a crawl.

## Adding media

`npm run ingest` reads `media/incoming/`, makes the tiers, transcodes video, and
files the original. Then run `npm run data`. It needs `cwebp` and `ffmpeg`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
