# DESIGN.md — mood

> Read this before you change the interface. It says what the product refuses
> and why. If a decision is not here, ask before you invent one.

## 0. The organizing idea

**The plane is the product. Everything else is an interruption.**

A mood is not a catalogue and it is not a feed. It has no order worth
preserving and no first item. You do not read it, you graze it — and the thing
that makes grazing work is that the eye moves before the hand does. So the
images fill the screen edge to edge, and every control that is not the images
either fades out or waits for a key.

`design-index` is the sibling repository, and this one takes its tokens,
its type, and its refusals. It does not take its layout: an index opens on a
catalogue, and this opens on a wall.

**What this design refuses:**

- **No header, no sidebar, no footer.** The plane touches all four edges of the
  viewport. The one thing that is drawn over it leaves after seven seconds.
- **No hairlines on the tiles.** 1,362 bordered tiles read as a grid of empty
  frames rather than a wall of pictures. Separation is the gap and nothing else.
- **No hue.** The images bring all the color there will ever be. Any hue in the
  frame competes with the thing in the frame, so the interface has none.
- **No ambient motion.** Nothing moves unless the user moved it or a search
  answered. A plane that drifts by itself cannot be read.
- **No filter that reflows.** See section 4.

## 1. The infinite plane

It is not infinite. It is one block of columns, addressed with modular
arithmetic, so panning past its edge lands you back inside it. Nothing is
generated and nothing is destroyed. Only the map from world coordinate to tile
wraps around.

**Each column wraps on its own height, and that is the whole trick.** A plane
that wrapped as one rectangle would repeat every tile at the same world `y`, and
the eye reads a row of simultaneous repeats as a seam across the full width of
the screen. Here each column also starts at its own phase offset, so no column's
repeat lines up with its neighbors'. The plane has a period. It has no visible
edge anywhere in it.

**The column count is derived, not chosen.** Total tile area is fixed by the
media, so a count really picks the *shape* of the repeating block: a few tall
columns, or many short ones. A block shaped like the screen takes longest to
repeat in either axis, so the count solves for a 16:9 block —
`n = sqrt(16·T / 9·pitch)`, where `T` is the summed height of every tile at this
column width. With this media that gives 49 columns.

**The order is shuffled, with a fixed seed.** The source groups the four images
of one post together, which on a grid reads as a repeated set of near-identical
tiles. Shuffled, it reads as a mood. The viewer puts each image back beside
its siblings, so the grouping is not lost — only unstacked. The seed is fixed
because a reload must not reshuffle the plane under someone who is navigating
it.

## 2. Three resolutions, one per distance

| Tier | Width | Used when a tile is | Size on disk |
|---|---|---|---|
| tiny | 192px | below 250 device px | 8.7 MB total |
| thumb | 480px | 250 to 760 device px | 44 MB total |
| full | 1440px | above 760 device px | 293 MB total |

The smallest tier is not an optimization, it is a requirement. At the minimum
zoom a tile is about 84 CSS pixels wide and about 520 of them are on screen.
Served from the 480px thumbnail that is eight times the pixels needed, at
roughly a megabyte of decoded bitmap each. The plane held. The tab did not.

**Resolutions stack, they do not swap.** An `<img>` that changes its own `src`
paints nothing while the new file decodes, so a zoom gesture would blank every
tile on the screen at once. The 192px file is always the bottom layer and the
larger ones fade in over it. A tile is never empty and a zoom never flashes.

They are also sticky. Once a tile earns a resolution it keeps it while it stays
mounted, and the tier boundaries have a dead band around them. Both stop a slow
zoom from throwing away decoded images it is about to ask for again.

**The stack unstacks once it is covered.** Three live layers is three decoded
bitmaps and three surfaces to composite, and the top one is opaque and sits at
exactly the tile's aspect ratio. The two under it are paying for a picture
nobody can see. So a layer that paints waits out the length of the fade, and
then everything below it leaves. The zoom still never blanks, because the drop
happens after the cover is on the screen and not before.

**The boundary for the largest tier was wrong, and it cost the frame rate.**
A 1440px file behind a tile 520 device pixels wide is 7.7 times the pixels the
screen can use, and roughly 10 MB of decoded bitmap. The old rule engaged there,
and at that zoom a wide monitor holds over a hundred tiles, so one screen asked
the tab for more than a gigabyte of bitmap. It swapped, and then it crawled at
one frame a second. The tier now waits for 760 device pixels. That leaves the
480px file at most 1.6x out of its depth, which photographs carry, and it keeps
the largest file for a zoom that has a use for it.

**The play badge lost its blur.** It was a 22px circle with `backdrop-filter` on
it, inside the layer that moves. Every video tile on the screen was a separate
blur pass against a backdrop that changed every frame, for an effect nobody can
read at that size. It is a flat disc now.

## 3. One transform per frame

Input handlers change the camera and raise a flag. They never touch the DOM.
One `requestAnimationFrame` loop reads the camera, writes a single `transform`
on the plane, and stops. A trackpad burst of forty wheel events per second
becomes one style write per frame, and a pan never passes through React.

**React owns two divs, and the loop owns every tile.** The mounted set used to
be React state, so each recomputation ran a reconciliation of a few hundred
components inside the frame that also wrote the transform, and each image that
finished loading set state on its own component. A pan at speed turned into a
render storm. The tiles are plain DOM now, held in a pool that is keyed by
wrapped position and diffed by hand: a tile that stays on the screen keeps its
node and its decoded image, a tile that leaves gives its node to the next
arrival, and nothing in the frame loop calls `setState`. React still draws the
viewport, the plane and everything that is not the plane.

**No input handler may measure.** `getBoundingClientRect` inside a wheel or
pointer handler forces the engine to flush style and layout before it can
answer, and at a hundred events a second, over a few hundred tiles, that is the
whole budget. The viewport is `fixed inset-0`, so its origin is the origin, and
`clientX` is already the number the handler wanted.

The mounted set is recomputed after the camera drifts 64 screen pixels, which
the 300-pixel overscan margin covers with room to spare. The margin is smaller
than it was and the recomputation is more frequent, which is the right trade
once a recomputation is a map diff rather than a render: the same tiles cross
the boundary either way, and fewer of them sit mounted off screen in between.

**Speed picks the resolution, and a fling gets none of it.** The plane knows
every tile's aspect ratio from the payload, so the geometry is correct before a
single byte of image arrives. Three bands:

| Screen speed | A new tile gets |
|---|---|
| under 700 px/s | the tier the zoom asks for |
| 700 to 2,600 px/s | the 192px file only |
| over 2,600 px/s | nothing, only its grey box |

The eye cannot resolve detail on content moving at 700 pixels a second, and a
480px decode is roughly ninety times the texture upload of a 192px one. So the
band pays nothing a viewer can see. The tier a tile holds never falls, so a
picture already on the screen stays as sharp as it was. The loop recomputes on
the first frame after the speed falls, and the wall sharpens in about 200 ms.

Below 400 pixels a second the images also fade in. Above it they simply appear,
because an opacity transition promotes a compositing layer, and fifty of those
at once is a worse thing to look at than no fade at all.

**`f` draws a frame meter.** Frame p50, p95 and worst over the last half second,
plus the mounted tiles, the live images and their decoded bitmap. It is off
until the key turns it on, so it obeys section 0.

**The transform lands on a device pixel.** The camera is a float, so the plane
transform is a float, and a composited layer at a fractional offset is resampled
rather than copied. The loop rounds the translation to whole device pixels
before it writes it. The error is a quarter of a CSS pixel at most, which nobody
can see, and the wall stays sharp while it moves.

**World coordinates are rebased, not accumulated.** A tile is positioned at its
world coordinate, and the plane never reaches an edge, so a long session walks
those numbers toward the point where a layout unit stops being exact. Every
32,768 units the loop moves the origin to the camera, rewrites the mounted
tiles against it, and takes the difference out of the plane transform. The
picture does not move. The numbers stay small, and so do the bounds of the one
composited layer.

**The wheel listener cannot be React's.** React binds `wheel` passively, and a
passive listener may not call `preventDefault`. Bound that way the page scrolls
and a horizontal swipe triggers browser back, both on top of the pan. It is
attached by hand with `{ passive: false }`.

A trackpad pinch arrives as a wheel event with `ctrlKey` set. That is the
platform convention rather than a hack, so one handler serves the mouse wheel,
two-finger scroll and pinch.

**Zoom anchors to the pointer.** Anchoring is what separates "zoom" from "zoom,
then hunt for the thing you were looking at".

**Two input rules were learned the hard way**, both from the same cause — a
press is not a drag until it has traveled:

- Pointer capture retargets the *click* to the capture element. Capturing on
  `pointerdown` sent every click to the viewport, and no tile ever opened.
- Clearing the drag flag on `pointerdown` unmounts a hovered tile's `<video>`.
  Chrome fires no click at all when the element the press landed on leaves the
  DOM before the release, so video tiles specifically could not be opened.

Both now wait for five pixels of travel. A still pointer produces an ordinary
click on the tile. A real drag still gets its moves from outside the window, and
still stops the videos.

## 4. Search dims, it does not filter

Removing the misses would reflow every column and move the hit you were looking
at, which on an infinite plane means losing your place completely. So the
geometry freezes and the matches are the parts still lit. `Enter` moves the
camera to the copy of the nearest match, choosing the instance closest to where
the camera already is.

The palette itself is invisible until `/` or `⌘K` calls it. That is what lets
the product keep "nothing else on the screen" and still be usable at 1,362
items.

## 5. The viewer grows out of the tile

An image that appears from nowhere breaks the spatial claim the plane spends all
its effort making. So the frame starts at the tile's own screen rectangle and
moves to its final one.

`object-fit` stays `cover` for the whole move. The target rectangle solves to
the image's own aspect ratio, so at the end of the move `cover` and `contain`
are the same crop. One transition carries a cropped tile all the way to an
uncropped image, with nothing to switch at the end.

**The entrance needs two frames, not one.** Setting the target rectangle in the
same commit that first paints the element gives the browser no start value to
interpolate from, so it snaps rather than moves. The first frame paints the
source rectangle and the second frame moves it.

The thumbnail paints as the frame's background from the first frame. It was on
the plane a moment ago and is already decoded, so the frame is never empty while
the full-resolution file arrives.

After you step to another image, closing fades the frame where it stands. It
does not fly back: that rectangle belongs to a different picture now.

## 5a. The tools rail, and the one permanent control

Section 0 refuses any control that is always on the screen. The rail is the
exception, so it pays for the exception by being small: 38px closed, which is
less than a single tile at the opening zoom.

**It grows into itself.** Width, height and radius animate on one curve, so the
closed square becomes the open panel rather than a panel appearing beside a
button. The icons you were looking at stay the icons you are looking at. Rows
stagger in behind it, capped at 320ms of delay — a rail of thirty sites should
not take a second and a half to arrive.

**Glass, and why it is allowed here.** Section 6 says a floating surface needs
an opaque base, because an alpha wash over photographs leaves both layers
unreadable. Glass is not a wash. `backdrop-filter` blurs what is behind it, so
the wall of images becomes a field of colour with no detail left to compete
with the text. The blur is what buys the transparency, which is why the
`@supports` fallback drops straight back to the opaque surface when there is no
`backdrop-filter` — without it the rule applies again and the panel is a smear.

Saturation goes **up** as the blur goes on. Blurring averages neighbouring
pixels, which pulls colour toward grey; the lift puts back what the averaging
took. That is the whole trick behind the material, and leaving it out is what
makes most copies of it look like fog.

The fill sits at 0.72 light and 0.64 dark. Lower reads as glass over a calm
background and as dirt over this one: the plane is arbitrary high-contrast
imagery, so a panel that is too transparent goes blotchy rather than
transparent.

## 5b. Where the media lives

Media paths are never stored. Every file is named after its image id, so the
client derives all four paths from the id and the payload holds 2,639 strings
instead of four times that.

That decision paid for itself at deploy time. Vercel caps static file uploads at
100 MB on Hobby, the plane carries 414 MB, and the failure mode is a clean build
log followed by "Deploying outputs..." and an error. Moving the media to a
bucket was one environment variable — `NEXT_PUBLIC_MEDIA_BASE` — because there
was no stored path anywhere to migrate.

## 6. Tokens

Taken unchanged from `design-index`, and the reasons come with them.

Zero chroma. `R=G=B` in every value. Light mode separates surfaces by **line**,
dark mode separates them by **fill**, and the dark alphas are about half the
light ones, because `L*` moves roughly twice as fast per unit alpha near black.
Never `#000` or `#fff` — 21:1 blooms on OLED and on cheap IPS panels.

Two exceptions, both because this product paints over photographs:

- **`--scrim`** is near-black in *both* themes. A white scrim over a wall of
  images is a fog, not a background.
- **The viewer's own text is white in both themes**, because it sits on the
  scrim and not on the page.

`color-scheme` tracks the theme in three states, in the same order as the
tokens. `light dark` alone only declares that the page supports both, after
which the browser paints scrollbars and form controls from
`prefers-color-scheme` and never looks at `data-theme`.

## 7. Type

Switzer and JetBrains Mono, self-hosted, weights 400 to 700 only. The hairline
weights are absent from the subset on purpose. This product shows almost no
type, so what it does show must be the same type the sibling repository uses.

Numbers are tabular everywhere they can change: a counter that shifts width as
it counts is a counter you cannot read.
