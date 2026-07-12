---
name: author-audiostory
description: >-
  Author or edit an Audio Dojo listening exercise (audiostory) end-to-end,
  INCLUDING the two steps the automated gates cannot cover: the manual N3 grammar
  (G32–G49) verification, and the TTS-misread → tts-normalize.js override loop.
  Use when adding or revising exercises under data/<level>/audiostories/<slug>/ —
  e.g. the N3 Audio Dojo campaign. Audiostories are registered in
  data/audiostories.index.json (NOT manifest.json).
---

# Author an Audio Dojo exercise

Listening exercises, schema `1.0.0`, one exercise per **2 lessons**
(`unlocksAfter` = the 2nd lesson of the pair). Length grows across the curriculum
(2 seg early N5 → 6 seg N4 capstone). N5+N4 are complete (27 exercises); **N3
(~86 lessons → ~43 exercises) is the active campaign.** Data lives at
`data/<level>/audiostories/<slug>/audiostory.json`; registry =
`data/audiostories.index.json`.

## The pipeline (same shape as stories). Get to 0 gate violations BEFORE spending any TTS.

### 1 — Scaffold
```bash
node scripts/new-audiostory.mjs <slug> --level=N3 --title="…" --english="…" --order=<10K> --unlocks-after=N3.<2nd-lesson>
```

### 2 — Add segments — author in KANJI
```bash
node scripts/tokenize-story-paragraph.mjs <slug> "<日本語(漢字)>" --en="<english>" --kind=audiostory
# revise a segment in place: add --replace=<index>
```
Author in **kanji** — correct Chirp prosody + it matches the gate's kanji
surfaces. **Never hand-write `tokens`.** ⚠️ Use `--en="..."` WITH the equals sign
(the space form can drop the English on this path).

### 3 — Vocab + kanji gate — MUST be 0 violations (authoritative for vocab + kanji)
```bash
node scripts/qa-story.mjs <slug> --audiostories
node scripts/audit-story-vocab.mjs --only=<slug> --audiostories   # cross-check
```
For each exercise's `unlocksAfter` ceiling the gate checks prose AND question text:
vocab `lesson_ids` ≤ ceiling, particles `introducedIn` ≤ ceiling, conjugation
FORMS `introducedIn` ≤ ceiling, kanji in the cumulative taught set. **Acceptance: 0.**

### 3-MANUAL — N3 grammar check (THE gate cannot see this — you MUST do it by hand)
All 89 conjugation FORMS top out at **N4.33**, so in any N3 exercise every
conjugation is already unlocked and the FORM bucket will NEVER flag. N3 grammar
(G32–G49) is **pattern grammar** the conjugation gate structurally can't see.
**Manually verify each N3 exercise against this map** — feature ONE new point
naturally, 1–2× per exercise, never drilled:

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

Confirm: no pattern above the exercise's `unlocksAfter` appears; the featured
point is used naturally (not drilled).

### 4 — Comprehension (hand-author, NEVER auto-author)
3–5 MCQs, grows with length. Options shuffled at render, plausible in-scope
distractors, avoid yes/no. Question text is in scope for the gate in step 3.

### 5 — Validate
```bash
node scripts/validate-audiostories.mjs
```

## 6 — TTS + fonts + build (only after gates are 0)
```bash
npm run gen:audio && npm run vendor:fonts && npm run build:www
```
Audiostory passages are **always the narrator** (Fenrir) — a passage is narration,
not a conversation, so it has no `spk` and gets no per-character voices. (Those are
for `type:"conversation"` blocks in lessons/grammar/reviews; see CLAUDE.md.)

### 6-MANUAL — the TTS-misread override loop (device-verified)
Chirp synthesizes raw kanji with NO reading hints, so on/kun-ambiguous kanji get
misread — **N3 has far more of these than N4.** After `gen:audio`, **listen to
EVERY passage on device.** For each misread kanji, add a `staticOverrides` entry
in `app/shared/tts-normalize.js` (this is how 町→まち was fixed). Before adding an
override, confirm no real reading-compound depends on the other pronunciation.
Re-run `gen:audio` and re-listen until every segment reads correctly.

## Authoring quality bar (learned the hard way in N4)
- **Write for the ear, not just the gate.** Don't tack a topic は where natural
  speech drops it (`台風の時は` → `台風の時`). No contrived scenes. Idiomatic only.
- **Write-kanji trap:** a vocab word being in-scope does NOT mean its kanji is —
  the gate flags kanji taught later. Use kana or a taught synonym; gate to 0.
- **Kanji-only glossary entries don't tag as vocab** (服 is `type:kanji`, no
  `lesson_ids`) — use the real vocab word (洋服).
- **Orthography + question text are in scope:** pick kanji-or-kana per word,
  consistent across segments AND questions; split-kana chips (とき→時, もの→物)
  must use the taught kanji.
- **No やる below N3.22** (casual する) — use する; kanji 遣る is N1.

## Done when
`qa-story --audiostories` = 0 · N3 grammar map manually verified · MCQs
hand-authored · `validate-audiostories` passes · every segment listened-to on
device with TTS overrides added · `gen:audio` + `vendor:fonts` re-run · `build:www`
green. Report each result plainly; the grammar + TTS checks are manual — say you
actually did them.
