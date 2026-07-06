# Agent rules for jp-kanjimaster

This file is the canonical reference for AI agents working in this repo.
Read before editing.

---

## Architecture (just the shape)

- Vanilla JS + Capacitor iOS shell. No bundler.
- **Three-copy build**: edits at the repo root must be propagated via
  `npm run build:www && npx cap sync ios` to reach `www/` and
  `ios/App/App/public/`. Never edit those copies directly.
- Shared modules in `app/shared/*.js` self-register on `window.JPShared`.
- State lives in `localStorage` with `k-*` keys (e.g. `k-rikizo-onboarded`,
  `k-furigana-on`).
- Module entry points loaded lazily from `index.html` via `JPApp.launch(...)`.

---

## Device testing & QA resets (protects PRODUCTION data)

Full protocol: `docs/device-testing.md`. Incident that created these rules:
`docs/postmortem-2026-07-06-progress-poisoning.md`. The short version:

- **Never QA signed in to a real account.** Progress sync is merge-max
  (monotonic): fabricated completions that reach the server are permanent.
- The fabricating reset scopes (`?reset=all-content` / `n52` / `grammar`)
  refuse to run signed-in (`k-auth-real` mirror) and stamp `k-qa-fabricated`,
  which disables sync push until a full `?reset=all`.
- ❌ **Never remove or bypass the `k-qa-fabricated` sync guard** (in
  `app/shared/sync.js`) — not even to make a test pass. Any new QA tool that
  fabricates progress MUST set the same marker before writing.
- Server keeps `users/{uid}/history/{ts}` revisions on every save — that is
  the recovery path if data is ever damaged (see the protocol doc).
- After `pm install`, a cold boot briefly renders home as if progress were
  wiped — it isn't; wait for manifest + sync to settle.

---

## Reading aids (furigana + romaji)

- Renderer: `app/shared/jp-text.js` (consumed via `window.JPShared.jpText`).
- Toggles: `k-furigana-on`, `k-romaji-on` in localStorage.
- **Tokens format** (used everywhere — lessons, stories, compose, glossary):
  ```json
  {
    "k": "<surface>",
    "r": "<optional reading for kanji-bearing surfaces>",
    "g": "<optional group id — adjacent same-g tokens render as one clickable unit>"
  }
  ```
- **Standard Japanese typography rule**: furigana goes ONLY over kanji. Kana
  surfaces never get `r` for furigana display — but `r` IS used to drive
  romaji-mode disambiguation (particle は has `r: "わ"` so romaji shows "wa").

---

## Stories — authoring rules

> 🛠️ **Guided skill: `/author-story`** runs this whole pipeline (agents 1→4 + QA
> 3.5) with the gates enforced as hard stops. Prefer it when authoring/editing a
> bundled story. It's Opus hand-authoring premium content — NOT the `story-gen/`
> Sonnet service.

**Story data lives in `data/<level>/stories/<slug>/story.json`** at schema
version `2.0.0`. The MD source files (`story.md`, `terms.json`) are
**reference-only** during transition — do not edit them, do not re-introduce
the markdown render path.

### The story pipeline — "agents 1–4"

Every story change runs through these four steps. Steps 3 and 4 are **pass/fail
gates** — if a gate fails, go back and fix before proceeding.

1. **Scaffold** a new story — `new-story.mjs`
2. **Add / edit paragraphs** (tokenize) — `tokenize-story-paragraph.mjs`
3. **Pedagogy / vocab-level gate** — `audit-story-vocab.mjs` (must report **0 out-of-level**)
4. **Validation gate** — `validate-stories.mjs`

Comprehension MCQs are **NOT** part of the pipeline and are **never
auto-authored** — see "Comprehension questions (optional, deferred)" below.

### Agent 1 — Creating a new story (the ONLY sanctioned path)

```bash
node scripts/new-story.mjs <slug> --level=N5|N4|N3|custom --title="…" --english="…"
```

This scaffolds the directory + skeleton JSON + manifest stub. **Never
hand-write `story.json` from scratch.** The scaffolder guarantees the
required fields (schemaVersion, id, title, englishTitle, paragraphs[],
comprehension) and registers the story with the manifest.

### Agent 2 — Adding / editing paragraphs (the ONLY sanctioned path)

```bash
node scripts/tokenize-story-paragraph.mjs <slug> "<japanese>" --en "<english>"
# revise an existing paragraph in place (re-tokenizes through the shared tokenizer):
node scripts/tokenize-story-paragraph.mjs <slug> "<japanese>" --en "<english>" --replace=<index>
```

This runs the shared tokenizer (`scripts/lib/tokenize.mjs`) and appends the
result. **Authors NEVER write `tokens` by hand.** The tokenizer is the
source of truth for token shape.

For per-occurrence disambiguation (a paragraph where the reading differs
from the glossary default), you may edit `tokens[]` directly *after*
running the script — but validate after every such edit:
```bash
node scripts/validate-stories.mjs --only=<slug>
```

### Agent 3 — Pedagogy / vocab-level gate

**Every story must stay within its level.** Run the vocab audit; it must report
**`OUT-OF-LEVEL surfaces: 0`** before the change is accepted.

```bash
node scripts/audit-story-vocab.mjs --only=<slug>
node scripts/audit-story-vocab.mjs --level=N4      # sweep a whole level
```

**Approval rule** — a token is approved when it is one of:
- a glossary entry at the story's level **or below** (an N4 story may use N4/N5
  vocab, but **not** N3);
- a particle (`shared/particles.json`) or character (`shared/characters.json`);
- a taught grammar form (the G-points + conjugations).

Findings come in two buckets:
- **OUT-OF-LEVEL** — resolves to a glossary entry *above* the story's level
  (e.g. an N3 word in an N4 story). **This must be 0.** Fix by rewording to
  approved vocab, or — only if the word is genuinely mis-filed — relevel the
  glossary entry (check its `lesson` tag first; most are correctly leveled).
- **UNGLOSSARIED** — content words the glossary simply lacks (basic adverbs,
  tokenizer split artifacts, character-name suffixes). Triage separately
  (promote-to-glossary vs leave); not a hard gate.

### Agent 4 — Validation gate

- `npm run validate:stories` runs the validator across every story.
- `npm run build:www` runs the validator BEFORE building — broken story
  data never reaches `www/` or iOS.
- Optional pre-commit hook: `npm run init:hooks` enables `.githooks/pre-commit`
  which runs the validator on any staged story JSON or manifest change.

### What the validator checks

- `schemaVersion === "2.0.0"`
- Required fields: `id`, `title`, `englishTitle`, `paragraphs`
- Every `paragraphs[i].tokens` reconstructs to `paragraphs[i].jp` (token
  drift is the easiest authoring mistake)
- `vocabUsed[]` / `grammarUsed[]` ids resolve against the glossary
- `comprehension.questions[].correct` is a valid index into `options[]`

### Agent 3.5 — Content QA gate (`qa-story.mjs`) — REQUIRED for paid content

```bash
node scripts/qa-story.mjs <slug>          # one story
node scripts/qa-story.mjs --level=custom  # all custom (paid) stories
```

Catches the *content* slips the audit/validator miss — the ones that erode trust in
**paid** stories. Must report **0 violations** for a custom story before it ships:

- **OUT-OF-SCOPE KANJI** — a kanji not taught by the story's ceiling. Custom stories
  rank at **N4-end** (N5 + all N4; N3 is out). The taught set is the manifest
  `lesson.kanji` lists — it is authoritative. Common offenders: 次 (kanji is N3 →
  use **つぎ**, which chips via `v_tsugi`), 変 (→ **かわる**, `v_kawaru`), and in
  comprehension 当/最/段/落/選 (本当・最後・段落・選ぶ → reword, don't kana-ify into an
  untagged run).
- **SPLIT KANA CHIPS** — a kana grammatical unit that renders as raw particle chips:
  とき→と+き and もの→も+の (use the taught kanji **時 / 物**), counter+**とも**
  ("both") → と+も (reword: …も…も / は).
- **ORTHOGRAPHY** — the same standalone word written both kanji and kana in one story
  (次/つぎ, 時/とき). Pick one. (Nominalizers こと/ところ stay kana; compounds 仕事/台所
  stay kanji — these are NOT inconsistencies.)
- **OUT-OF-SCOPE VOCAB / UNTAGGED / FORM** — N3 vocab in an N4 story, or content words
  that don't chip. Reword or glossary them.

**Orthography rule of thumb:** use a kanji **only when it's taught** (in `lesson.kanji`
at/below the ceiling); use it **consistently**; comprehension `q`/`answer`/`explanation`
text is **in scope** for the same gate as narration.

### Comprehension questions (optional, deferred — NOT in the pipeline)

`story.json.comprehension.questions[]` exists in the schema, but authoring MCQs
is a **deliberate, per-story pedagogical decision** — it is **not** a routine
step and is **never auto-authored**. Default is an empty `questions: []`. Only
add MCQs to a specific story when explicitly asked to. When authoring, each is
`{ q, options: [...], correct: <index>, explanation }`, ~3–5 per story.

---

## Audio Dojo — listening exercises (audiostories)

> 🛠️ **Guided skill: `/author-audiostory`** runs this pipeline including the two
> steps the automated gates can't cover — the manual N3 grammar (G32–G49) check
> and the TTS-misread override loop. Prefer it when authoring/editing an exercise.

**Data lives in `data/<level>/audiostories/<slug>/audiostory.json`** (schema
`1.0.0`); registry = `data/audiostories.index.json` (NOT manifest.json). One
exercise per **2 lessons**, `unlocksAfter` = the 2nd lesson of the pair, length
grows across the curriculum (2 seg early N5 → 6 seg N4 capstone). N5+N4 are
complete (27 exercises); N3 (~86 lessons → ~43 exercises) is the next campaign.

### The pipeline (the ONLY sanctioned path — same shape as stories)

```bash
node scripts/new-audiostory.mjs <slug> --level=N3 --title="…" --english="…" --order=<10K> --unlocks-after=N3.<2K>
node scripts/tokenize-story-paragraph.mjs <slug> "<日本語(漢字)>" --en "<english>" --kind=audiostory   # × N segments
#   …revise a segment in place: add --replace=<index>
# hand-author comprehension.questions[] (NEVER auto-author MCQs — see stories rules)
node scripts/qa-story.mjs <slug> --audiostories      # GATE: iterate to 0 violations BEFORE any TTS
npm run gen:audio && npm run vendor:fonts && npm run build:www   # then sync + device
```

Author paragraphs in **kanji** (correct Chirp prosody + matches the gate's kanji
surfaces). Never hand-write `tokens`. Get `qa-story` to **0 violations first** so
TTS is only ever spent on verified content.

### The gate (`qa-story.mjs --audiostories`) — what it does and does NOT cover

For each exercise's `unlocksAfter` ceiling it checks prose **and** question text
use only: vocab `lesson_ids` ≤ ceiling, particles `introducedIn` ≤ ceiling,
conjugation FORMS `introducedIn` ≤ ceiling, kanji in the cumulative taught set.
**Acceptance: 0 violations.** It is authoritative for **vocab + kanji**.

> ⚠️ **N3 grammar is NOT auto-gated.** All 89 conjugation forms are tagged and top
> out at **N4.33** (causative-passive, keigo-relevant forms, etc. are all ≤N4) — so
> in any N3 exercise *every conjugation is already unlocked* and the FORM bucket
> will never flag. N3 grammar (G32–G49) is **pattern grammar** (relative clauses,
> はず/わけ, time clauses, quoting) that the conjugation gate structurally can't
> see. **You MUST manually verify each N3 exercise's grammar against this map**
> (feature one new point naturally, 1–2× per exercise, never drilled):

| G | Point | ≤ | G | Point | ≤ |
|--|--|--|--|--|--|
| G32 | Relative clauses / noun modification | N3.2 | G41 | Time clauses (間/うちに/以来/とたん) | N3.38 |
| G33 | Nominalizers の・こと | N3.4 | G42 | Perspective & relation particles | N3.42 |
| G34 | Volitional & intentions | N3.6 | G43 | Causative-passive & advanced voice | N3.46 |
| G35 | Inference (ようだ/みたいだ/らしい) | N3.10 | G44 | Suffixes (っぽい/がち/気味/～やか) | N3.50 |
| G36 | はずだ / わけだ | N3.14 | G45 | Advanced conditionals & wishes | N3.54 |
| G37 | ところだ / たばかり | N3.18 | G46 | Quoting & indirect speech | N3.58 |
| G38 | Sentence-ending particles & register | N3.22 | G47 | Compound / set patterns | N3.64 |
| G39 | Adverbs of degree | N3.26 | G48 | Advanced connectors | N3.72 |
| G40 | Honorific & humble 敬語 | N3.34 | G49 | N3 grammar capstone | N3.84 |

### Authoring rules (the quality bar — learned the hard way in N4)

- **Author for the ear, not just the gate.** Don't tack a topic は where natural
  speech drops it (`台風の時は` → `台風の時`). Avoid contrived scenes (no "running
  in a shop"). Real, idiomatic sentences only.
- **TTS misread kanji → fix in `app/shared/tts-normalize.js`.** Chirp synthesizes
  raw kanji with *no* reading hints, so any kanji it misreads needs a
  `staticOverrides` entry (this is how 町→まち was fixed; check no real
  ちょう-compound exists first). **N3 has far more on/kun-ambiguous kanji — listen
  to EVERY passage on device and add overrides as found.**
- **Write-kanji trap.** A vocab word being in-scope does NOT mean its kanji is —
  the gate flags kanji taught *later* than the exercise's lesson (and N2/N1 words
  that "feel" N3). Use kana or a taught synonym; never assume — gate to 0.
- **Kanji-only glossary entries don't tag as vocab** (e.g. 服 is a `type:kanji`
  entry, no `lesson_ids`) — use the real vocab word (洋服).
- **Orthography + question text are in scope:** pick kanji-or-kana per word and
  keep it consistent across segments AND questions; split-kana chips (とき→時,
  もの→物) must use the taught kanji.
- **MCQs:** 3–5 per exercise (grows with length), hand-authored, options shuffled
  at render, plausible in-scope distractors, avoid yes/no. Never auto-authored.

---

## Glossary additions

**The glossary is the source of truth for tagging + furigana.** When a word
in a story doesn't tag correctly or shows the wrong furigana, the canonical
fix is to add (or correct) the glossary entry — NOT to hand-edit the story.

- N5 vocab → `data/N5/glossary.N5.json`
- N4 vocab → `data/N4/glossary.N4.json`
- N3 vocab → `data/N3/glossary.N3.json`
- Particles → `shared/particles.json`
- Characters (Rikizo, Yamakawa, etc.) → `shared/characters.json`

After adding entries, re-derive tokens:
```bash
node scripts/derive-glossary-tokens.mjs
node scripts/migrate-stories-to-json.mjs --force   # if you need to re-tokenize stories
```

### When to add a glossary entry vs. per-token override

- **Recurring** (compound used in multiple stories, e.g. 金よう日): add to glossary.
- **One-off** (a specific paragraph needs a non-standard reading of a kanji):
  edit `tokens[]` for just that paragraph; document why in the en-translation
  or a comment.
- **One-off in GRAMMAR files**: `derive-content-tokens.mjs` re-bakes `tokens`
  on every run, so hand edits there don't survive. Author a `tokensOverride`
  array on the part instead — it must reconstruct to `part.text` and is copied
  to `tokens` at bake time.

### Kanji "cards" vs vocab (the k_/v_ two-tier rule)

- `type:"kanji"` entries (ids `k_*`) are taught-kanji metadata: `on`/`kun`
  feed the lesson New-Kanji grid and kanji pages. They are **NOT** sentence
  words: the tokenizer ignores them entirely and they carry no `tokens`.
- Sentence readings come from `v_*` vocab entries (後=あと via v_ato), the
  conjugation/counter engines, and a small curated suffix table in
  `scripts/lib/tokenize.mjs` (`SUFFIX_READINGS`: 三時間後=ご, 世界中=じゅう).
  If a single kanji shows the wrong reading in prose, fix it at one of those
  three layers — never by re-indexing kanji cards.

---

## After ANY content change — regenerate audio + fonts (REQUIRED)

Whenever you **add new** Japanese content **or edit existing** content — stories,
lessons, grammar, glossaries, `shared/particles.json`, `shared/characters.json`,
or anything whose Japanese text the app **displays or speaks** — you MUST
regenerate two derived artifacts. Both are **build gates** (`npm run build:www`
runs them and FAILS if you forgot):

### 1. Audio (TTS voice clips)

```bash
npm run gen:audio          # build-audio-manifest + generate-audio (Chirp 3 HD)
# npm run gen:audio -- --force   # regenerate ALL clips (rarely needed)
```

- Incremental: clips are content-addressed (`sha1` of the normalized key), so
  **new text → new clip**, **edited text → a new clip** (the old one is orphaned
  but harmless — committed clips keep the app offline).
- Needs `GOOGLE_TTS_API_KEY` + `ffmpeg`/`ffprobe` on the build machine.
- **Gate:** `validate-audio.mjs` re-derives the key set and fails the build if any
  content line lacks a clip.

### 2. Fonts (Japanese glyph coverage)

```bash
npm run vendor:fonts       # re-subsets Noto Sans/Serif JP to the current content
```

- The bundled Noto fonts are **subset to exactly the characters in the content**
  (see `scripts/lib/jp-chars.mjs`). New/edited content can introduce a kanji that
  isn't in the subset — re-run this so it's included (otherwise that glyph falls
  back to the system font and faux-bolds on device).
- Needs `python3` + `pip install fonttools brotli`. Writes `fonts/jp-coverage.json`.
- **Gate:** `validate-fonts.mjs` fails the build if any content character is
  outside the bundled subset.

> Rule of thumb: **content edited → `npm run gen:audio` + `npm run vendor:fonts`,
> then `npm run build:www`.** If the build fails on `validate-audio` or
> `validate-fonts`, you skipped one of these.

---

## Things to never do

- ❌ Don't re-introduce kuromoji.js or any runtime morphological tokenizer.
  The renderer reads pre-baked tokens; tokens are baked at build time only
  via the deterministic glossary-greedy tokenizer.
- ❌ Don't hand-author tokens. Run the script.
- ❌ Don't auto-author comprehension MCQs. They're a deliberate per-story
  decision — only add them when explicitly asked.
- ❌ Don't let a story ship with out-of-level vocab. Agent 3
  (`audit-story-vocab.mjs`) must report 0 out-of-level.
- ❌ Don't use **やる** (casual する) in content below **N3.22** — it isn't taught
  until then (introduced N3.22 casual register; giving-sense reinforced N3.75). Use
  する. Kanji 遣る is N1 → やる is always kana. The glossary entry `v_yaru` (N3.22)
  gates it, and the generator forbids it explicitly below ceiling.
- ❌ Don't edit files in `www/` or `ios/App/App/public/` directly — they're
  generated.
- ❌ Don't bypass `validate-stories.mjs` with `--no-verify` on commits unless
  you're explicitly fixing the validator itself.
- ❌ Don't add a new `marked.js` (or any Markdown parser) dependency to ship
  with the app. The MD story path is being removed; do not bring it back.
- ❌ Don't ship new/edited content without re-running `npm run gen:audio` AND
  `npm run vendor:fonts`. `build:www` gates both (validate-audio / validate-fonts)
  — a missing clip or uncovered glyph fails the build.

---

## Useful one-liners

```bash
# Validate everything
npm run validate:stories

# Re-migrate one story (after glossary changes)
node scripts/migrate-stories-to-json.mjs --only=<slug> --force

# After ANY content add/edit — regenerate the derived artifacts
npm run gen:audio        # TTS voice clips (new/changed lines)
npm run vendor:fonts     # re-subset Noto JP to the content's characters

# Build + sync to iOS (gates: stories, audio, fonts)
npm run sync:ios

# Activate pre-commit hook (one-time per clone)
npm run init:hooks
```
