#!/usr/bin/env python3
"""Themed-menu scene-art generator (washi-paper / sumi-ink illustration).

Renders the assets described in assets/scenes/ART_PROMPTS.md. Distinct from the
chibi pixel-art sprite pipeline — this is soft watercolor illustration. It reuses
the proven Gemini client + magenta chroma-key -> true-alpha approach so the
delivered PNGs have REAL transparency (not a magenta-background image), which is
what the spec requires for DOM <img> rendering.

Key flows:
  * transparent assets  -> generated on solid magenta #FF00FF, flood-filled to
                           alpha, magenta halo de-spilled, center-cropped to the
                           target aspect, resized to exact pixels.
  * opaque assets       -> generated normally, cropped + resized.
  * garden-tile         -> opaque + made seamlessly vertically tileable in post.
  * lantern-lit         -> derived from the lantern-unlit raw (same magenta frame
                           passed back as a reference) so the two align cleanly.

The GEMINI_API_KEY is read from this repo's .env if present, else from the
sibling jp-lessons/.env (where the art pipeline + key live).

Usage:
  python3 tools/generate_scene_art.py                 # all REQUIRED assets
  python3 tools/generate_scene_art.py --optional      # required + optional
  python3 tools/generate_scene_art.py lantern-unlit   # named subset
  python3 tools/generate_scene_art.py --list          # list asset names
"""

import argparse
import os
import sys
import time
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent          # jp-kanjimaster
SCENES_DIR = REPO / "assets" / "scenes"


def _load_key() -> str:
    for env_path in (REPO / ".env", REPO.parent / "jp-lessons" / ".env"):
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("#") or "=" not in line:
                    continue
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY not found in jp-kanjimaster/.env or jp-lessons/.env")
    return key


from google import genai          # noqa: E402
from google.genai import types    # noqa: E402

client = genai.Client(api_key=_load_key())
MODEL = "gemini-3-pro-image-preview"

# ---------------------------------------------------------------------------
# Style + system instructions
# ---------------------------------------------------------------------------

PREAMBLE = (
    "Traditional Japanese washi-paper and sumi-ink illustration, soft hand-"
    "painted watercolor shading, calm and refined. Palette: warm cream paper "
    "#F5F3F0, sumi ink #323029, vermilion #E63946, moss green #52A065, indigo "
    "#3B3B9F, gold #D4AF37. Absolutely NO text, NO lettering, NO numbers, NO "
    "kanji, NO labels anywhere in the image. Centered subject, even soft "
    "lighting, a subtle soft shadow directly beneath the subject."
)

SYS_TRANSPARENT = (
    "You are a careful illustration tool. Render exactly the subject described, "
    "in soft Japanese washi-watercolor style. CRITICAL: every pixel that is NOT "
    "part of the subject must be SOLID PURE MAGENTA #FF00FF — a flat, uniform "
    "magenta field with no gradient, no checkerboard, no transparency pattern, "
    "no cream paper behind the subject. The magenta is keyed out to transparency "
    "afterwards, so keep a clean crisp boundary between the painted subject and "
    "the magenta. Do not paint any scenery, floor, wall, or backdrop — only the "
    "single isolated subject floating on flat magenta. CRITICAL: do NOT paint a "
    "cream, off-white, beige, or washi-paper sheet behind the subject — the "
    "cream/washi palette applies ONLY to the subject's own materials, NEVER as a "
    "background. The background is 100% pure magenta #FF00FF and nothing else, "
    "edge to edge."
)

SYS_OPAQUE = (
    "You are a careful illustration tool. Render exactly the subject described, "
    "in soft Japanese washi-watercolor style, as a fully opaque image that fills "
    "the entire frame edge to edge. No transparency."
)


def transparent_prompt(body: str) -> str:
    return (
        f"{PREAMBLE}\n\n"
        f"SUBJECT (the only thing in the image): {body}\n\n"
        "BACKGROUND: solid pure magenta #FF00FF filling every non-subject pixel, "
        "flat and uniform, edge to edge. No scenery, no backdrop, and absolutely "
        "NO cream/off-white/washi paper sheet behind the subject. Keep the subject "
        "crisply separated from the flat magenta so it keys cleanly to transparency."
    )


def opaque_prompt(body: str) -> str:
    return f"{PREAMBLE}\n\nSCENE (fills the whole frame, fully opaque): {body}"


# ---------------------------------------------------------------------------
# Asset catalog (mirrors ART_PROMPTS.md)
# ---------------------------------------------------------------------------
# gen_aspect: one of Gemini's supported ratios closest-and-wider than target;
#             the result is center-cropped to the exact target aspect after.

SCENES = [
    # --- Lessons: teacher's desk ---
    dict(name="desk-teacher", w=1280, h=860, aspect="3:2", mode="transparent",
         body="a sturdy wooden teacher's desk seen from a slight front-3/4 angle, "
              "warm honey wood with visible grain, a couple of drawers with simple "
              "brass pulls, a clear empty top surface. Just the desk, nothing on it."),
    dict(name="file-lesson", w=1000, h=280, aspect="16:9", mode="transparent",
         body="a Japanese blue clear-book binder (clear-file folder) lying flat with "
              "its front cover facing up, wide landscape orientation filling the frame "
              "left to right: glossy royal-blue plastic cover, a clean BLANK white "
              "rectangular label panel filling the left ~58% of the cover (leave it "
              "completely blank — no writing), a few translucent clear-pocket page "
              "edges peeking along the top edge, subtle plastic sheen. Keep the white "
              "label on the LEFT and the glossy-blue area on the RIGHT."),
    dict(name="lessons-room-bg", w=1536, h=1024, aspect="3:2", mode="opaque",
         optional=True,
         body="a quiet Japanese study/classroom wall and floor in warm cream washi "
              "tones, soft daylight, completely empty — no furniture, no objects "
              "(the desk and files are layered on top separately)."),

    # --- Reviews: student desk ---
    dict(name="desk-student", w=1280, h=860, aspect="3:2", mode="transparent",
         body="a smaller, lighter wooden student desk at a slight front-3/4 angle, "
              "simple and a little plainer than a teacher's desk, clear empty top, "
              "pale natural wood. Just the desk, nothing on it."),
    dict(name="paper-test", w=1000, h=320, aspect="16:9", mode="transparent",
         body="a small stapled test/exam booklet (a packet of a few stapled sheets) "
              "lying flat, wide landscape: a plain off-white cover with faint horizontal "
              "rule lines, a single metal staple in the top-left corner, the edges of "
              "2-3 inner pages peeking along the right and bottom so it reads as a "
              "multi-page packet, soft paper shadow. Completely blank — no writing, no "
              "grade, no marks."),
    dict(name="reviews-room-bg", w=1536, h=1024, aspect="3:2", mode="opaque",
         optional=True,
         body="a calm classroom desk-side wall and floor in warm washi tones, soft "
              "daylight, completely empty."),

    # --- Grammar: garden ---
    dict(name="lantern-unlit", w=640, h=900, aspect="3:4", mode="transparent",
         body="a traditional Japanese stone garden lantern (toro): stacked stone "
              "base, central post, fire-box, pagoda roof, and finial; weathered grey "
              "granite with faint moss, the fire-box opening dark and UNLIT. Strict "
              "front view, perfectly upright and centered."),
    dict(name="lantern-lit", w=640, h=900, aspect="3:4", mode="transparent",
         derive_from="lantern-unlit",
         body="the SAME stone garden lantern, now LIT: a warm gold glow #D4AF37 "
              "spilling out of the fire-box opening with a soft light bloom around it, "
              "gentle dusk mood. Reproduce the lantern identically — same shape, size, "
              "position, stone texture and proportions — change ONLY the fire-box: make "
              "it glow warm gold with soft bloom. Everything else stays the same."),
    dict(name="stone-step", w=320, h=160, aspect="16:9", mode="transparent",
         body="a single flat stepping stone (tobi-ishi) seen from a slight top angle, "
              "grey river rock with faint moss at the edges, soft ground shadow."),
    dict(name="garden-koi", w=640, h=640, aspect="1:1", mode="transparent",
         body="a small round koi pond with two orange-and-white koi fish and one green "
              "lily pad, calm blue-green water, viewed from above."),
    dict(name="garden-bonsai", w=640, h=640, aspect="1:1", mode="transparent",
         body="a small bonsai pine tree in a shallow brown ceramic pot, moss-green "
              "needled foliage, gnarled trunk."),
    dict(name="garden-torii", w=640, h=640, aspect="1:1", mode="transparent",
         body="a small vermilion #E63946 torii gate: two upright posts and two "
              "horizontal top beams, classic shape, front view."),
    dict(name="garden-bamboo", w=640, h=640, aspect="1:1", mode="transparent",
         body="a small cluster of green bamboo stalks with a few leaves, beside a "
              "simple bamboo water spout (shishi-odoshi)."),
    dict(name="garden-maple", w=640, h=640, aspect="1:1", mode="transparent",
         body="a small Japanese maple tree (momiji) with deep red autumn foliage and "
              "a thin graceful trunk."),
    dict(name="garden-tile", w=1024, h=1024, aspect="1:1", mode="opaque",
         tileable=True,
         body="a soft top-down garden ground texture: raked sand/gravel and patches of "
              "moss in warm cream and moss-green washi tones, very subtle and even, no "
              "focal point, no objects, no rocks — just gentle ground texture."),
    dict(name="garden-sign", w=560, h=360, aspect="3:2", mode="transparent",
         optional=True,
         body="a small wooden hanging garden signboard (kifuda): a plain rectangular "
              "cedar plank with a short crossbar/hanger at the top, warm wood grain, "
              "completely blank empty face."),
]

SCENE_BY_NAME = {s["name"]: s for s in SCENES}


# ---------------------------------------------------------------------------
# Image post-processing
# ---------------------------------------------------------------------------

def chroma_key_magenta(img: Image.Image) -> Image.Image:
    """Smooth magenta-distance keyer -> clean anti-aliased true alpha.

    Key signal is the 'magenta deficit' = min(R,B) - G. Pure magenta #FF00FF
    scores 255; every palette color we use (cream, gold, indigo, vermilion,
    moss, greys, blues, reds, whites) scores <=~15 because either G is high or
    one of R/B is low. So thresholding on the deficit removes ONLY magenta —
    including the soft anti-aliased halo where the watercolor edge fades into
    magenta — without eroding any subject color. De-spill then pulls the
    leftover pink out of the semi-transparent edge pixels."""
    arr = np.asarray(img.convert("RGBA")).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    deficit = np.minimum(r, b) - g              # high = magenta

    LO, HI = 30.0, 150.0                        # <=LO opaque, >=HI transparent
    alpha = np.clip((HI - deficit) / (HI - LO), 0.0, 1.0)

    # De-spill: remove the magenta cast from partially-keyed edge pixels by
    # pulling R and B down toward G in proportion to the deficit.
    spill = np.clip(deficit, 0.0, None)
    arr[..., 0] = np.maximum(0.0, r - spill)
    arr[..., 2] = np.maximum(0.0, b - spill)
    arr[..., 3] = alpha * 255.0

    out = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def mirror_tile_vertical(half: Image.Image) -> Image.Image:
    """Build a vertically-seamless tile from a half-height image by stacking it
    above its vertical mirror. Adjacent rows at the middle (half[-1] meets its
    mirror = half[-1]) and at the wrap (top row half[0] meets bottom row =
    half[0]) are identical, so the result tiles top-to-bottom with no seam and
    no gap — the standard mirror-tiling trick."""
    half = half.convert("RGB")
    w, h2 = half.size
    out = Image.new("RGB", (w, h2 * 2))
    out.paste(half, (0, 0))
    out.paste(half.transpose(Image.FLIP_TOP_BOTTOM), (0, h2))
    return out


def crop_to_aspect(img: Image.Image, tw: int, th: int) -> Image.Image:
    w, h = img.size
    target = tw / th
    cur = w / h
    if cur > target:                            # too wide -> crop sides
        nw = round(h * target)
        x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h))
    if cur < target:                            # too tall -> crop top/bottom
        nh = round(w / target)
        y = (h - nh) // 2
        return img.crop((0, y, w, y + nh))
    return img


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, system: str, aspect: str, refs=None, retries=3):
    contents = list(refs or []) + [prompt]
    last = None
    for attempt in range(1, retries + 1):
        try:
            r = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    image_config=types.ImageConfig(aspect_ratio=aspect, image_size="2K"),
                    http_options=types.HttpOptions(timeout=300_000),
                    system_instruction=system,
                    temperature=0.55,
                    thinking_config=types.ThinkingConfig(thinking_level="high", include_thoughts=False),
                ),
            )
            cand = r.candidates[0] if r.candidates else None
            if cand and cand.content and cand.content.parts:
                for part in cand.content.parts:
                    if getattr(part, "inline_data", None):
                        return Image.open(BytesIO(part.inline_data.data)).convert("RGBA")
            last = f"no image part (feedback={getattr(r, 'prompt_feedback', None)})"
        except Exception as e:                  # noqa: BLE001 - retry any API error
            last = str(e)
        if attempt < retries:
            wait = 15 * attempt
            print(f"    retry {attempt}/{retries-1} after error: {last[:160]}  (wait {wait}s)")
            time.sleep(wait)
    raise SystemExit(f"FAILED after {retries} attempts: {last}")


# cache of raw magenta frames for derive_from alignment
_raw_cache = {}


def generate(spec: dict) -> Path:
    name = spec["name"]
    transparent = spec["mode"] == "transparent"
    SCENES_DIR.mkdir(parents=True, exist_ok=True)

    refs = None
    if spec.get("derive_from"):
        base = _raw_cache.get(spec["derive_from"])
        if base is None:
            base_path = SCENES_DIR / f"{spec['derive_from']}_raw.png"
            if base_path.exists():
                base = Image.open(base_path).convert("RGBA")
        if base is not None:
            refs = [base]
            print(f"    deriving from {spec['derive_from']} (reference passed for alignment)")

    body = spec["body"]
    if refs:
        body = ("ATTACHED is the exact lantern to reproduce. " + body)

    prompt = transparent_prompt(body) if transparent else opaque_prompt(body)
    system = SYS_TRANSPARENT if transparent else SYS_OPAQUE

    print(f"=== {name}  {spec['w']}x{spec['h']}  (gen {spec['aspect']}, {spec['mode']}) ===")
    t0 = time.time()
    raw = _call_gemini(prompt, system, spec["aspect"], refs=refs)
    print(f"    returned in {time.time()-t0:.1f}s  raw={raw.size}")

    if transparent:
        _raw_cache[name] = raw.copy()
        raw.save(SCENES_DIR / f"{name}_raw.png")           # keep raw for derive/debug
        img = chroma_key_magenta(raw)
    else:
        img = raw.convert("RGB")

    if spec.get("tileable"):
        # Crop to a half-height strip, then mirror-stack into a seamless tile.
        half_h = spec["h"] // 2
        img = crop_to_aspect(img, spec["w"], half_h)
        img = img.resize((spec["w"], half_h), Image.LANCZOS)
        img = mirror_tile_vertical(img)
        img = img.resize((spec["w"], spec["h"]), Image.LANCZOS)
    else:
        img = crop_to_aspect(img, spec["w"], spec["h"])
        img = img.resize((spec["w"], spec["h"]), Image.LANCZOS)

    out = SCENES_DIR / f"{name}.png"
    img.save(out)
    print(f"    final {img.size} {img.mode} -> {out.relative_to(REPO)}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", help="asset names to generate (default: all required)")
    ap.add_argument("--optional", action="store_true", help="include optional assets")
    ap.add_argument("--list", action="store_true", help="list asset names and exit")
    args = ap.parse_args()

    if args.list:
        for s in SCENES:
            opt = "  (optional)" if s.get("optional") else ""
            print(f"  {s['name']:<18} {s['w']}x{s['h']}  {s['mode']}{opt}")
        return

    if args.names:
        bad = [n for n in args.names if n not in SCENE_BY_NAME]
        if bad:
            raise SystemExit(f"Unknown asset names: {bad}\nRun --list to see valid names.")
        # ensure a derive_from dependency is generated first
        chosen = []
        for n in args.names:
            dep = SCENE_BY_NAME[n].get("derive_from")
            if dep and dep not in args.names and dep not in chosen:
                chosen.append(dep)
            chosen.append(n)
        todo = [SCENE_BY_NAME[n] for n in chosen]
    else:
        todo = [s for s in SCENES if args.optional or not s.get("optional")]

    print(f"Generating {len(todo)} asset(s) -> {SCENES_DIR}\n")
    done = []
    for i, spec in enumerate(todo):
        out = generate(spec)
        done.append(out)
        if i < len(todo) - 1:
            time.sleep(6)                       # gentle inter-call pacing
    print(f"\nDone. {len(done)} asset(s) written to {SCENES_DIR.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
