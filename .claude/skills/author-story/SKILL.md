---
name: author-story
description: >-
  Author or edit a BUNDLED curriculum story (N5/N4/N3, or a paid custom-level
  story) end-to-end through the sanctioned agents 1→4 pipeline, with the
  pedagogy/QA/validation gates enforced as hard stops. Use when adding or
  revising a story under data/<level>/stories/<slug>/ — e.g. the N3 stories
  campaign. This is Opus authoring premium bundled content by hand; it is NOT the
  server-side custom story generator (story-gen/, which runs Sonnet on Cloud Run).
---

# Author a bundled story

You (Opus) are hand-authoring premium, paid curriculum content. The bar is
hand-author quality, in strict scope, gated to 0 violations before it ships.
Data lives at `data/<level>/stories/<slug>/story.json` (schema `2.0.0`). Never
touch `www/` or `ios/App/App/public/` (generated), and never edit the old
`story.md` / `terms.json` (reference-only, do not revive the markdown path).

## The pipeline — agents 1→4 (+ QA 3.5). Every step is mandatory; steps 3, 3.5, 4 are pass/fail gates.

### 1 — Scaffold (the ONLY way to create a story)
```bash
node scripts/new-story.mjs <slug> --level=N5|N4|N3|custom --title="…" --english="…"
```
Guarantees the required fields + registers the manifest stub. **Never hand-write
`story.json` from scratch.**

### 2 — Add paragraphs (the ONLY way to write tokens)
```bash
node scripts/tokenize-story-paragraph.mjs <slug> "<日本語>" --en="<english>"
# revise a paragraph in place (re-tokenizes): add --replace=<index>
# insert at a position: add --insert=<index>
```
Author the Japanese in natural kanji. The shared tokenizer bakes `tokens[]`.
**Never hand-author tokens.** Per-occurrence reading override (a paragraph whose
reading differs from the glossary default) is the ONE case you may edit
`tokens[]` by hand — and you must re-validate immediately after.

### 3 — Pedagogy / vocab-level gate — MUST report 0 out-of-level
```bash
node scripts/audit-story-vocab.mjs --only=<slug>
```
A token is approved iff it is: a glossary entry at the story's level **or below**;
a particle (`shared/particles.json`) or character (`shared/characters.json`); or
a taught grammar form. Two buckets:
- **OUT-OF-LEVEL** (resolves to an entry above the ceiling) → **HARD GATE, must be 0.**
  Fix by rewording to approved vocab, or relevel the glossary entry ONLY if it is
  genuinely mis-filed (check its `lesson` tag first — most are correct).
- **UNGLOSSARIED** (no entry at all) → triage separately (promote vs leave); not a
  hard gate, but watch it — this is the silent-slip bucket (how やる got through).

### 3.5 — Content QA gate — MUST report 0 violations (required for paid content)
```bash
node scripts/qa-story.mjs <slug>
```
Catches content slips the audit/validator miss. Custom/paid stories rank at
**N4-end** (N5 + all N4; N3 is out); the taught set is the manifest `lesson.kanji`
lists (authoritative). Watch for:
- **OUT-OF-SCOPE KANJI** — a kanji not taught by the ceiling. Common offenders:
  次 (N3 → use **つぎ**), 変 (→ **かわる**), and in comprehension 当/最/段/落/選.
- **SPLIT KANA CHIPS** — a kana unit rendering as raw particle chips: とき→と+き,
  もの→も+の (use the taught kanji **時 / 物**); counter+とも → reword.
- **ORTHOGRAPHY** — the same word written both kanji and kana in one story (次/つぎ,
  時/とき). Pick one, use it consistently. (Nominalizers こと/ところ stay kana;
  compounds 仕事/台所 stay kanji — those are NOT inconsistencies.)
- **OUT-OF-SCOPE VOCAB / UNTAGGED / FORM** — reword or glossary them.

Comprehension `q`/`answer`/`explanation` text is IN scope for the same gate.

### 4 — Validation gate
```bash
node scripts/validate-stories.mjs --only=<slug>
```
Checks schemaVersion `2.0.0`, required fields, token→jp reconstruction (token
drift is the easiest mistake), vocabUsed/grammarUsed resolve, and
comprehension.correct is a valid index.

## After the story passes all gates — regenerate derived artifacts (REQUIRED)
Any new/edited Japanese the app displays or speaks must regenerate two artifacts
(both are `build:www` gates — the build FAILS if you skip them):
```bash
npm run gen:audio        # Chirp 3 HD clips for new/changed lines (needs GOOGLE_TTS_API_KEY + ffmpeg)
npm run vendor:fonts     # re-subset Noto JP to the content's characters (needs python3 + fonttools)
npm run build:www        # gates: validate-stories, validate-audio, validate-fonts
```

## Hard rules — never
- ❌ Hand-write `story.json` or hand-author `tokens[]` — run the scripts.
- ❌ **Auto-author comprehension MCQs.** Default is `questions: []`. MCQs are a
  deliberate per-story decision — only add them when the user explicitly asks.
  (Written short-answer questions follow the schema when requested.)
- ❌ Use **やる** (casual する) below **N3.22** — use **する**. Kanji 遣る is N1, so
  やる is always kana; the glossary entry `v_yaru` (N3.22) gates it.
- ❌ Ship with out-of-level vocab — agent 3 must be 0.
- ❌ Ship without re-running `gen:audio` + `vendor:fonts`.

## Done when
`audit-story-vocab` = 0 out-of-level · `qa-story` = 0 violations · `validate-stories`
passes · `gen:audio` + `vendor:fonts` re-run · `build:www` green. Then report the
gate results plainly (0/0/pass), don't claim done on an unrun gate.
