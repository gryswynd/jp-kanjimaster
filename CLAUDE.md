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

### Comprehension questions (optional, deferred — NOT in the pipeline)

`story.json.comprehension.questions[]` exists in the schema, but authoring MCQs
is a **deliberate, per-story pedagogical decision** — it is **not** a routine
step and is **never auto-authored**. Default is an empty `questions: []`. Only
add MCQs to a specific story when explicitly asked to. When authoring, each is
`{ q, options: [...], correct: <index>, explanation }`, ~3–5 per story.

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
- ❌ Don't edit files in `www/` or `ios/App/App/public/` directly — they're
  generated.
- ❌ Don't bypass `validate-stories.mjs` with `--no-verify` on commits unless
  you're explicitly fixing the validator itself.
- ❌ Don't add a new `marked.js` (or any Markdown parser) dependency to ship
  with the app. The MD story path is being removed; do not bring it back.

---

## Useful one-liners

```bash
# Validate everything
npm run validate:stories

# Re-migrate one story (after glossary changes)
node scripts/migrate-stories-to-json.mjs --only=<slug> --force

# Build + sync to iOS
npm run sync:ios

# Activate pre-commit hook (one-time per clone)
npm run init:hooks
```
