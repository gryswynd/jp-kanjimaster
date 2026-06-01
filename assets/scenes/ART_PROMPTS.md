# Themed-menu scene art — generation prompts

Drop the generated PNGs into this folder (`assets/scenes/`) using the **exact
filenames** below. The menus auto-detect each file: when present it replaces the
code-drawn fallback; when absent the menu still looks fine on the fallback.

## Hard requirements (read first)

- **Transparent background (true alpha PNG)** for every *sprite* — NOT a magenta
  chroma-key. These render as DOM `<img>`, not on the game canvas, so they need
  real transparency.
- **No text in the art.** All labels, IDs, scores, and stamps are drawn by the app
  on top. A blank folder / blank paper / bare lantern is what's wanted.
- Use the **exact pixel sizes** listed (source res; the app scales down for crisp
  retina). Center the subject with a little padding; even, soft lighting.
- The two lanterns (`lantern-lit`, `lantern-unlit`) must be the **same lantern in
  the same position/size** — only the glow differs — so they swap cleanly.
- `garden-tile.png` must be **seamlessly tileable top-to-bottom** (it repeats down
  a long scroll). No hard seam at the top or bottom edge.

## Shared style preamble (prepend to every prompt)

> Traditional Japanese washi-paper & sumi-ink illustration, soft hand-painted
> watercolor shading, calm and refined. Palette: warm cream paper #F5F3F0, sumi
> ink #323029, vermilion #E63946, moss green #52A065, indigo #3B3B9F, gold
> #D4AF37. No text, no lettering. Transparent background. Centered, even lighting,
> subtle soft shadow.

---

## Lessons — teacher's desk

**`desk-teacher.png`** — 1280×860, transparent
> …a sturdy wooden teacher's desk seen from a slight front-3/4 angle, warm honey
> wood with visible grain, a couple of drawers with simple brass pulls, a clear
> empty top surface. Just the desk, isolated on transparency.

**`file-lesson.png`** — 1000×280, transparent — *landscape, front cover facing up*
> …a Japanese blue "clear book" binder (クリアブック / clear-file folder) lying flat
> with its front cover facing up, landscape orientation: glossy royal-blue plastic
> cover, a clean **white rectangular label panel filling the left ~58%** (leave it
> blank — the app prints the lesson title there), a few translucent clear-pocket
> page edges peeking along the top edge, subtle sheen and soft shadow. No text.
> Isolated on transparency.
>
> *Layout note:* keep the white label on the LEFT and the glossy-blue area on the
> RIGHT — the app overlays the title on the white panel and the score/stamp on the
> blue. A matching `file-lesson-current.png` (optional) can show it slightly open
> or with a gold edge for the active lesson.

*(optional)* **`lessons-room-bg.png`** — 1536×1024, opaque OK
> …a quiet Japanese study/classroom wall and floor, warm cream washi tones, soft
> daylight, empty (the desk and files are layered on top separately).

## Reviews — student desk

**`desk-student.png`** — 1280×860, transparent
> …a smaller, lighter wooden student desk, front-3/4 angle, simple and a little
> plainer than a teacher's desk, clear empty top. Isolated on transparency.

**`paper-test.png`** — 1000×320, transparent — *stapled test booklet, landscape*
> …a small stapled test/exam booklet (a packet of a few stapled sheets) lying flat,
> landscape: a plain off-white cover with faint rule lines, a metal staple in the
> top-left corner, the edges of 2–3 inner pages peeking along the right and bottom
> so it reads as a multi-page packet, soft paper shadow. Blank — no writing or
> grade (the app overlays the red circle score + stamp). Isolated on transparency.

*(optional)* **`reviews-room-bg.png`** — 1536×1024, opaque OK
> …a calm classroom desk-side wall and floor in warm washi tones, soft daylight,
> empty.

## Grammar — garden

**`lantern-unlit.png`** — 640×900, transparent
> …a traditional Japanese stone garden lantern (tōrō): stacked stone base, post,
> fire box, pagoda roof, finial; weathered grey granite with faint moss, the fire
> box dark and unlit. Front view, isolated on transparency.

**`lantern-lit.png`** — 640×900, transparent — *same lantern, same size/position*
> …the same stone garden lantern, now lit: a warm gold glow #D4AF37 spilling from
> the fire box opening, soft light bloom around it, dusk mood. Front view,
> isolated on transparency.

**`stone-step.png`** — 320×160, transparent
> …a single flat stepping stone (tobi-ishi) seen from a slight top angle, grey
> river rock with faint moss at the edges, soft ground shadow. Isolated.

**`garden-koi.png`** — 640×640, transparent
> …a small round koi pond with two orange-and-white koi and a lily pad, calm
> water. Isolated on transparency.

**`garden-bonsai.png`** — 640×640, transparent
> …a small bonsai pine in a shallow brown ceramic pot, moss-green foliage.
> Isolated on transparency.

**`garden-torii.png`** — 640×640, transparent
> …a small vermilion #E63946 torii gate, two posts and two top beams. Isolated on
> transparency.

**`garden-bamboo.png`** — 640×640, transparent
> …a small cluster of green bamboo stalks with a few leaves, and a simple bamboo
> water spout (shishi-odoshi). Isolated on transparency.

**`garden-maple.png`** — 640×640, transparent
> …a small Japanese maple (momiji) with deep red autumn foliage and a thin trunk.
> Isolated on transparency.

**`garden-tile.png`** — 1024×1024, opaque, **seamlessly vertically tileable**
> …a soft top-down garden ground texture: raked sand/gravel and patches of moss in
> warm cream and moss-green washi tones, very subtle, no focal point. Must tile
> seamlessly top-to-bottom with no visible seam.

*(optional)* **`garden-sign.png`** — 560×360, transparent
> …a small wooden hanging garden signboard (kifuda): a plain rectangular cedar
> plank with a short crossbar/hanger at top, warm wood grain, empty face. No
> text. Isolated on transparency.
