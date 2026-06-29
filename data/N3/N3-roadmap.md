# JLPT N3 — Full Unlock Roadmap

Canonical build roadmap for everything we want to ship for N3 **minus the Godot
game**. Sibling to `N3-kanji-lesson-plan.md` (the spine) — this doc maps every
*unlock* that hangs off that spine: composes, stories, audio dojos, reviews, the
dojo game tracks (Connections / Scramble / Keigo), grammar, and the two capstones.

> **Status of this doc:** a planning artifact. Nothing here is wired into
> `manifest.json` yet — `manifest.json` still lists only `["N5","N4"]`, and
> `data/N3/` currently contains only `grammar/` (18 empty stubs). This is the
> "see everything" map we build against.

> **Build approach (agreed 2026-06-27):** build **linearly down the unlock path**,
> not track-by-track. The repeating beat (per lesson-pair `2k-1`, `2k`):
> `Lesson N3.(2k-1)` → `Compose (2k-1)` → `Lesson N3.(2k)` → `Compose (2k)` →
> `Story #k` → `Audio #k` → `Scramble #k` → `Connections #k` →
> `Grammar (if gated here)` → `Review #k`, then repeat (Keigo from N3.34).
> Grammar authored at **N4 depth (~10–13 sections)**. A **grammar-vocab audit gate**
> (mirroring `audit-story-vocab.mjs`) gets built before the first grammar point (G32).
> **Glossary status: COMPLETE & synced** (1753 entries, all 86 lessons; compounds
> tagged via `lesson_ids`). Lessons are hand-authored to the N4 lesson anatomy
> (warmup · kanjiGrid · vocabList · conversations · readings · drills). **N3.1 is
> the pilot** that sets the lesson template.

---

## 1. Overview

- **Span:** full **86 lessons** (N3.1–N3.86), kanji locked in `N3-kanji-lesson-plan.md`.
- **Entry gate:** `N3.1.unlocksAfter = "N4.Final.Review"` (mirrors how
  `N5.Final.Review` gates N4.1).
- **Exit gate:** `N3.Final.Review` (the level-closing assessment).
- **Cadence:** composes every lesson; stories / audio dojos / reviews / Connections /
  Scramble every 2 lessons; Keigo every 2 lessons **from N3.34 on**; grammar at its
  fixed gates.

### Grand totals to build

| Track | Cadence | Count |
|---|---|---|
| Compose | every lesson | **86** |
| Story | every 2 | **43** |
| Audio dojo (audiostory) | every 2 | **43** |
| Review | every 2 | **43** |
| Connections (new style) | every 2 | **43** |
| Scramble (new mode) | every 2 | **43** |
| Keigo drill (new) | every 2 from N3.34 | **27** |
| Grammar (fill stubs) | fixed gates | **18** |
| **Final Rikizo Story** (capstone) | end of level | **1** |
| **N3.Final.Review** (capstone) | end of level | **1** |
| _Lessons (spine — not yet authored as JSON)_ | — | _86_ |

**Total new content artifacts (excl. lessons): 348.**

---

## 2. Cadence & gating model

### The 2-lesson beat

Every "every-2" track fires on the **even-lesson gate** `N3.(2k)`; composes fire
every lesson:

- **Every lesson** `N3.n` → `compose`
- **Every 2nd lesson** `N3.(2k)` → `story` + `audio dojo` + `review` + `Connections` + `Scramble`
- **From N3.34** the even gate *also* adds `Keigo drill` (敬語 isn't taught until
  **G40 @ N3.34**, so the module stays locked until then, then rides the same
  every-2 cadence to N3.86)
- **Grammar** fires at its own fixed gate (§3), independent of the beat
- **Capstones** close the level: **Final Rikizo Story** (narrative send-off) →
  **N3.Final.Review** (the exit gate)

> **Load note (tunable):** the even gate carries 5 unlocks (6 from N3.34). If that
> reads heavy on the path, Connections + Scramble can be **offset to the odd-lesson
> gate** — still every 2, just one lesson apart from story/audio/review — to
> alternate a "play" beat with a "consume/assess" beat. Not assumed here; see §6.

### Shared-parent chaining (same rule as N4)

Gating chains through `unlocksAfter`, verified against the N4 section of
`manifest.json`:

- **grammar gates the next lesson** (a lesson whose `unlocksAfter` is a `G#` needs
  that grammar *completed*),
- **lessons gate the next review** (a review needs the lesson it follows *passed* ≥60%),
- **reviews gate the next lesson batch**,

so a learner can't skip past a grammar point or a review. Per-track unlock
semantics (from `app/shared/unlock.js`): lessons/reviews/stories/composes/audio
require a **pass (≥60%)** of their prereq; grammar prereqs use **completion**.

---

## 3. The spine (reference)

### 3a. Grammar — 18 points, fixed gates

| G | Title | unlocksAfter | | G | Title | unlocksAfter |
|---|---|---|---|---|---|---|
| G32 | Relative Clauses & Noun Modification | N3.2 | | G41 | Time Clauses (間 / うちに / 以来 / とたん) | N3.38 |
| G33 | Nominalizers: の and こと | N3.4 | | G42 | Perspective & Relation Particles | N3.42 |
| G34 | Volitional Form & Intentions | N3.6 | | G43 | Causative-Passive & Advanced Voice | N3.46 |
| G35 | Inference & Comparison (ようだ / みたいだ / らしい) | N3.10 | | G44 | Suffixes & Word Formation (っぽい / がち / 気味 / ～やか) | N3.50 |
| G36 | Expectation & Reasoning (はずだ / わけだ) | N3.14 | | G45 | Advanced Conditionals & Wishes | N3.54 |
| G37 | Aspect & Temporal States (ところだ / たばかり) | N3.18 | | G46 | Quoting & Indirect Speech | N3.58 |
| G38 | Sentence-Ending Particles & Register | N3.22 | | G47 | Compound Expressions & Set Patterns | N3.64 |
| G39 | Adverbs of Degree | N3.26 | | G48 | Advanced Connectors | N3.72 |
| G40 | Honorific & Humble Speech (敬語) | N3.34 | | G49 | N3 Grammar Capstone Review | N3.84 |

All 18 files exist at `data/N3/grammar/G32.json … G49.json` with metadata + the
gates above, but every `sections` array is **empty** — content authoring is
outstanding (Tier 0).

### 3b. Lessons — 86, kanji locked

Themes/kanji are authoritative in `N3-kanji-lesson-plan.md` (Phase A N3.1–13
locked, Phase B N3.14–26 high-frequency front-load, Phases C–F N3.27–86). The
theme column in §4 is pulled from that plan.

---

## 4. Full merged unlock schedule

One row per lesson. `#k` = the k-th item in that track. `Tier` = build-readiness
(§5). Grammar column shows the point that opens at that gate.

| Lesson | Theme | Compose | Story | Audio | Connect | Scramble | Keigo | Grammar | Tier |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **N3.1** | Memory & Regret | ✓ | — | — | — | — | — | — | 1 |
| **N3.2** | Connections & Differences | ✓ | #1 | #1 | #1 | #1 | — | **G32** | 1 |
| **N3.3** | Past & Sequence | ✓ | — | — | — | — | — | — | 1 |
| **N3.4** | Habits & Routine | ✓ | #2 | #2 | #2 | #2 | — | **G33** | 1 |
| **N3.5** | Promises & Time | ✓ | — | — | — | — | — | — | 1 |
| **N3.6** | People & Generations | ✓ | #3 | #3 | #3 | #3 | — | **G34** | 1 |
| **N3.7** | Whole & Parts | ✓ | — | — | — | — | — | — | 1 |
| **N3.8** | Necessity & Limits | ✓ | #4 | #4 | #4 | #4 | — | — | 1 |
| **N3.9** | Life & Danger | ✓ | — | — | — | — | — | — | 1 |
| **N3.10** | Law & Elections | ✓ | #5 | #5 | #5 | #5 | — | **G35** | 1 |
| **N3.11** | Law & Crime | ✓ | — | — | — | — | — | — | 1 |
| **N3.12** | Success & Achievement | ✓ | #6 | #6 | #6 | #6 | — | — | 1 |
| **N3.13** | Failure & Harm | ✓ | — | — | — | — | — | — | 1 |
| **N3.14** | Origins & Beverages | ✓ | #7 | #7 | #7 | #7 | — | **G36** | 1 |
| **N3.15** | Quality & Objects | ✓ | — | — | — | — | — | — | 1 |
| **N3.16** | Time & Extremes | ✓ | #8 | #8 | #8 | #8 | — | — | 1 |
| **N3.17** | Support & Completion | ✓ | — | — | — | — | — | — | 1 |
| **N3.18** | Reality & Existence | ✓ | #9 | #9 | #9 | #9 | — | **G37** | 1 |
| **N3.19** | Cases & Causes | ✓ | — | — | — | — | — | — | 1 |
| **N3.20** | Arranging & Fixing | ✓ | #10 | #10 | #10 | #10 | — | — | 1 |
| **N3.21** | Requests & Wishes | ✓ | — | — | — | — | — | — | 1 |
| **N3.22** | Teachers & Excellence | ✓ | #11 | #11 | #11 | #11 | — | **G38** | 1 |
| **N3.23** | Growth & Expression | ✓ | — | — | — | — | — | — | 1 |
| **N3.24** | Others & Similarity | ✓ | #12 | #12 | #12 | #12 | — | — | 1 |
| **N3.25** | Purpose & Demands | ✓ | — | — | — | — | — | — | 1 |
| **N3.26** | Both & Arrival | ✓ | #13 | #13 | #13 | #13 | — | **G39** | 1 |
| **N3.27** | Chase & Retreat | ✓ | — | — | — | — | — | — | 2 |
| **N3.28** | Form & Containers | ✓ | #14 | #14 | #14 | #14 | — | — | 2 |
| **N3.29** | Decisions & Plans | ✓ | — | — | — | — | — | — | 2 |
| **N3.30** | Anger, Sadness & Fear | ✓ | #15 | #15 | #15 | #15 | — | — | 2 |
| **N3.31** | Joy, Love & Dreams | ✓ | — | — | — | — | — | — | 2 |
| **N3.32** | Feelings & Shame | ✓ | #16 | #16 | #16 | #16 | — | — | 2 |
| **N3.33** | Desire & Rest | ✓ | — | — | — | — | — | — | 2 |
| **N3.34** | Difficulty & Doubt | ✓ | #17 | #17 | #17 | #17 | **#1** | **G40** | 2 |
| **N3.35** | Change & Manifestation | ✓ | — | — | — | — | — | — | 2 |
| **N3.36** | Health & Daily Life | ✓ | #18 | #18 | #18 | #18 | #2 | — | 2 |
| **N3.37** | Speed & Flow | ✓ | — | — | — | — | — | — | 2 |
| **N3.38** | Ascending & Descending | ✓ | #19 | #19 | #19 | #19 | #3 | **G41** | 2 |
| **N3.39** | Leisure & Paths | ✓ | — | — | — | — | — | — | 2 |
| **N3.40** | Heat & Cold | ✓ | #20 | #20 | #20 | #20 | #4 | — | 2 |
| **N3.41** | Profit & Collection | ✓ | — | — | — | — | — | — | 2 |
| **N3.42** | Age & Beauty | ✓ | #21 | #21 | #21 | #21 | #5 | **G42** | 2 |
| **N3.43** | Faith & Authority | ✓ | — | — | — | — | — | — | 2 |
| **N3.44** | Animals & Sky | ✓ | #22 | #22 | #22 | #22 | #6 | — | 2 |
| **N3.45** | Conflict & Rules | ✓ | — | — | — | — | — | — | 2 |
| **N3.46** | Impact & Force | ✓ | #23 | #23 | #23 | #23 | #7 | **G43** | 2 |
| **N3.47** | Throwing & Catching | ✓ | — | — | — | — | — | — | 2 |
| **N3.48** | Pointing & Releasing | ✓ | #24 | #24 | #24 | #24 | #8 | — | 2 |
| **N3.49** | Breath & Closing | ✓ | — | — | — | — | — | — | 2 |
| **N3.50** | Verifying & Indicating | ✓ | #25 | #25 | #25 | #25 | #9 | **G44** | 2 |
| **N3.51** | Recording & Analysis | ✓ | — | — | — | — | — | — | 2 |
| **N3.52** | Sharing Information | ✓ | #26 | #26 | #26 | #26 | #10 | — | 2 |
| **N3.53** | Discussion & Knowledge | ✓ | — | — | — | — | — | — | 2 |
| **N3.54** | Greetings & Hospitality | ✓ | #27 | #27 | #27 | #27 | #11 | **G45** | 2 |
| **N3.55** | Justice & Order | ✓ | — | — | — | — | — | — | 2 |
| **N3.56** | Government & Authority | ✓ | #28 | #28 | #28 | #28 | #12 | — | 3 |
| **N3.57** | Opposition & Denial | ✓ | — | — | — | — | — | — | 3 |
| **N3.58** | Applications & Identity | ✓ | #29 | #29 | #29 | #29 | #13 | **G46** | 3 |
| **N3.59** | Direction & Shape | ✓ | — | — | — | — | — | — | 3 |
| **N3.60** | Style & Character | ✓ | #30 | #30 | #30 | #30 | #14 | — | 3 |
| **N3.61** | Structure & Process | ✓ | — | — | — | — | — | — | 3 |
| **N3.62** | Peace & Harmony | ✓ | #31 | #31 | #31 | #31 | #15 | — | 3 |
| **N3.63** | Marriage & Partnership | ✓ | — | — | — | — | — | — | 3 |
| **N3.64** | Body Parts | ✓ | #32 | #32 | #32 | #32 | #16 | **G47** | 3 |
| **N3.65** | Home & Lodging | ✓ | — | — | — | — | — | — | 3 |
| **N3.66** | Spaces & Seating | ✓ | #33 | #33 | #33 | #33 | #17 | — | 3 |
| **N3.67** | Plants & Materials | ✓ | — | — | — | — | — | — | 3 |
| **N3.68** | Weather & Scenery | ✓ | #34 | #34 | #34 | #34 | #18 | — | 3 |
| **N3.69** | Water & Depth | ✓ | — | — | — | — | — | — | 3 |
| **N3.70** | Ports & Completion | ✓ | #35 | #35 | #35 | #35 | #19 | — | 3 |
| **N3.71** | Life & Performance | ✓ | — | — | — | — | — | — | 3 |
| **N3.72** | Art & Science | ✓ | #36 | #36 | #36 | #36 | #20 | **G48** | 3 |
| **N3.73** | Organization & Supply | ✓ | — | — | — | — | — | — | 3 |
| **N3.74** | Interaction & Relations | ✓ | #37 | #37 | #37 | #37 | #21 | — | 3 |
| **N3.75** | Giving & Receiving | ✓ | — | — | — | — | — | — | 3 |
| **N3.76** | Roles & Formality | ✓ | #38 | #38 | #38 | #38 | #22 | — | 3 |
| **N3.77** | Work & Employment | ✓ | — | — | — | — | — | — | 3 |
| **N3.78** | Commerce & Customers | ✓ | #39 | #39 | #39 | #39 | #23 | — | 3 |
| **N3.79** | Finances & Wealth | ✓ | — | — | — | — | — | — | 3 |
| **N3.80** | Numbers & Portions | ✓ | #40 | #40 | #40 | #40 | #24 | — | 3 |
| **N3.81** | Degree & Rank | ✓ | — | — | — | — | — | — | 3 |
| **N3.82** | Complexity | ✓ | #41 | #41 | #41 | #41 | #25 | — | 3 |
| **N3.83** | Points & Distribution | ✓ | — | — | — | — | — | — | 3 |
| **N3.84** | Cause, Nature & Suitability | ✓ | #42 | #42 | #42 | #42 | #26 | **G49** | 3 |
| **N3.85** | Reciprocity & Places | ✓ | — | — | — | — | — | — | 3 |
| **N3.86** | Governance & Institutions | ✓ | #43 | #43 | #43 | #43 | #27 | — | 3 |
| **— capstone —** | Final Rikizo Story | — | ★ | — | — | — | — | — | 3 |
| **— capstone —** | N3.Final.Review (exit gate) | — | — | — | — | — | — | — | 3 |

**Column tallies:** 86 composes · 43 stories (+1 ★ Final Rikizo) · 43 audio ·
43 reviews (+1 Final) · 43 connections · 43 scrambles · 27 keigo · 18 grammar.

---

## 5. Dojo game tracks

N3 ships **three gated dojo tracks**, each unlocking on the every-2 cadence and
**launching straight into its N3 game style** (no engine picker). The new
Connections/Scramble styles **replace** the legacy N5/N4 play styles for N3 — N3
does *not* reuse the `connections4.js` / `scramble.js` styles.

> Each of the three is **new engine work**. Specced as stubs here; build is a
> separate effort after the roadmap is agreed.

### 5a. Connections — new "Hanabi-grade" style — 43 puzzles
- Harder than the N5/N4 connections game: difficulty closer to the standalone
  Hanabi daily puzzle (heavier decoy overlap / hidden links / larger grid).
- **NOTE:** Hanabi is a **separate repo** (`~/developer/jp-hanabi`) — this is
  *inspired by* its difficulty, **no shared code**.
- Corpus: `data/N3/connections/connections.N3.json` (one puzzle per even gate,
  with a `requires` lesson list so each opens at the right point).
- **Open:** grid size + difficulty-knob spec.

### 5b. Scramble — new mode — 43 puzzles
- New sentence-building mode (not the legacy tile-drag scramble).
- Corpus: `data/N3/scramble/scramble.N3.json`.
- **Open:** which mechanic — sentence/paragraph reorder · particle-insertion ·
  timed gauntlet.

### 5c. Keigo / Honorific Drill — new — 27 puzzles, **gated to N3.34**
- Drills 敬語 transforms — 尊敬語 (respectful), 謙譲語 (humble), 丁寧語 (polite).
- **Locked until N3.34** (the gate that teaches 敬語 via G40), then every 2 to N3.86.
- Corpus: `data/N3/keigo/keigo.N3.json` (new dir).
- **Open:** input mode (type-in vs multiple-choice) + coverage mix across the
  three keigo registers.

### Supplementary (existing engines — always-available, not gated tracks)
- **Loanword Gairaigo** (`app/games/loanword-dojo.js`) — optionally extend
  `shared/loanwords.json` with N3-tier katakana.
- **Conjugation Station** — auto-aggregates from glossary verb/adj entries.

---

## 6. Build order / content-readiness

Unlocks can't be *authored* until their inputs exist. The `Tier` column in §4
encodes this.

### Tier 0 — spine content (blocks everything downstream)
- **Glossary — COMPLETE, needs syncing in.** The canonical N3 glossary lives in
  **jp-lessons (`origin/main`)** — 1753 entries covering **all 86 lessons, no
  gaps** (verified 2026-06-26). This repo's `data/N3/glossary.N3.json` is **stale**
  (1201 entries, only N3.1–55). Action = sync the jp-lessons copy in + re-run
  `derive-glossary-tokens.mjs`. **Not an authoring task** — a file sync.
- **18 grammar stubs empty** (`sections: []`) — reviews and the keigo drill depend
  on taught grammar.
- **Lesson JSON not authored** — `data/N3/lessons/` doesn't exist yet (N4 has 36
  built). The spine itself.

### Tier 1 — N3.1–N3.26 (front-loaded) — author unlocks first
### Tier 2 — N3.27–N3.55 — needs grammar fills
### Tier 3 — N3.56–N3.86 + both capstones

(Tiers are a **phasing order**, not a glossary-readiness gradient — vocab is
complete across all 86 once the glossary is synced. Front-loading 1–26 first
still makes sense for the high-frequency lessons.)

**Suggested phasing:** ship Tier 1 unlocks (N3.1–26 → 13 stories / 13 audio /
13 reviews / 26 composes / 13 connections / 13 scrambles, no keigo yet) as the
first N3 slice, then Tier 2, then Tier 3 + capstones.

### Per-artifact gates (when each unlock is actually built)
- Stories/audio: `audit-story-vocab.mjs` (0 out-of-level) → `validate-stories.mjs`
  → `qa-story.mjs` (paid/custom).
- All content: `npm run gen:audio` + `npm run vendor:fonts`, then `npm run build:www`
  (gates stories/audio/fonts before build).

---

## 7. Open decisions (carry forward — not blocking this roadmap)

1. **Connections / Scramble placement** — keep on the even gate (alongside
   story/audio/review, 5–6 unlocks/gate) or **offset to the odd gate** to alternate
   a play beat with a consume/assess beat? (§2 load note.)
2. **New Scramble mechanic** — reorder / particle-insertion / timed gauntlet (§5b).
3. **Hanabi-grade Connections** — grid size + difficulty spec (§5a).
4. **Keigo drill** — input mode + register coverage (§5c).
5. **Capstone order** — Final Rikizo Story before or after N3.Final.Review (default:
   story first as the send-off, review as the exit gate).

---

## 8. Wiring (deferred — next step after this roadmap)

When we move from roadmap → live, the work is:
- **Sync the complete N3 glossary in first** — copy `data/N3/glossary.N3.json`
  from **jp-lessons `origin/main`** (1753 entries, all 86 lessons) over this repo's
  stale copy, then `node scripts/derive-glossary-tokens.mjs`. Everything else
  depends on this.
- Add `"N3"` to `manifest.json` `levels` + a `data.N3` block
  (`lessons[] / grammar[] / reviews[] / compose[] / stories[]`), each entry with
  its `unlocksAfter` per §4.
- Register audio dojos in `data/audiostories.index.json` (level `"N3"`, `order`,
  `unlocksAfter`).
- Extend `app/shared/unlock.js` for the N3 dojo gates (the three new tracks +
  the N3.34 keigo lock) the way `SCRAMBLE_UNLOCK_AFTER` / `LINKUP_UNLOCK_AFTER` /
  `AUDIO_DOJO_UNLOCK_AFTER` are defined today.
- Build the three new dojo engines (§5).
