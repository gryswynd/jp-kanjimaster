# qa-content triage — baselined findings inventory (2026-07-12)

`scripts/qa-content.mjs` is the untaught-term gate for **lessons / grammar /
reviews** (the counterpart of `qa-story.mjs`). It is wired into `build:www`
and fails the build on any **new** hard finding. Existing findings live in
`scripts/qa-content-baseline.json` (3,321 fingerprints) — this doc is the
map for burning that baseline down.

```bash
npm run qa:content                      # baseline-filtered (what the build runs)
node scripts/qa-content.mjs --strict    # full report, baseline ignored
node scripts/qa-content.mjs --only=G5 --strict
node scripts/qa-content.mjs --update-baseline   # re-accept after a fix batch
```

A finding's fingerprint is `file|bucket|surface|id` — fixing content removes
its fingerprints, so after each fix batch re-run `--update-baseline` and the
baseline shrinks. **Never** add new hard findings to the baseline without
review; the gate exists so the 猫-in-G5 class of bug can't ship again.

## Fixed already (batch 1, this session)

- G5 いる/ある rebuilt on ≤N5.5 vocab (was 猫/本/部屋/時間); G16 rebuilt on
  ≤N4.6 (was 猫/飛/自由/泳/様/走/咲/似/声/passive); N4.16 distractors;
  N4.Final.Review roulette items; N4.35/N4.28 kana orthography; 漢字 titles
  → かんじ in N4.1–21; N5-wide v_watashi → v_watashi_kana; 4 dead chips.
- Relevels: v_namae `N5.1,N5.9`, v_sugiru `N4.5,N3.37` (G15 teaches すぎる),
  v_bakari `N4.7,N3.18` (G17 teaches ばかり).

## Remaining hard findings (baselined) — by category

Strict totals after batch 1: kanji 274 · vocab 1,230 · particle 87 · form 188.

### A. N3-glossary words in shipped N5/N4 content — 240 findings, 72 words
The worst class (N3 doesn't ship, so these words are *never* taught).
Top: 寝る×16 覚える×15 忘れる×14 よい×12 おねがい×11 直す 遅れる 決める
痛い 言葉. Mostly N4 grammar files (G18–G31) using them as example vocab.

**Decision needed (teacher call), per word:**
1. **Relevel** — many are basic words the N3 glossary pre-seeded (寝る, 部屋,
   公園, 窓, 言葉…). If an N4 lesson/G-point genuinely drills it, add the
   earlier id: `"N4.x,N3.y"` (keeps the N3 roadmap intact — earliest id wins
   for scope, both count as teaching points).
2. **Reword** the example to taught vocab (what batch 1 did for G5/G16).
3. **Accept** — leave baselined; the chip glosses it on tap.

### B. N4-glossary words in N5 content — 260 findings, 45 words
うん×36 こと×28 有名×25 練習×20 走る×12 勉強×10 … Mostly kana usage in N5
conversations of words formally taught (with kanji) in N4. Pedagogically
these shipped from day one and chips gloss them. Options: split kana entries
(like v_watashi_kana), multi-id relevel, or accept. **Recommend: accept for
launch; revisit with the N3 campaign's glossary pass.**

### C. Same-level forward references — 726 findings, 95 words
書く×68 話す×42 くれる×30 食べる×29 … A word used a few lessons before its
vocabList (e.g. G10's conjugation tables use 書く/話す, taught N5.13, at
ceiling N5.9 — you can't teach conjugation without verbs). **Recommend:
accept; only fix where a drill *tests* the untaught word.**

### D. Untaught kanji — 274 findings, 193 chars
Two sub-classes:
- **Meta-language**: 言葉/勉強/練習/単語/語彙 in Japanese-language titles and
  instructions. Either kana-ize titles (batch 1 did 漢字→かんじ) or accept.
- **Orthography slips**: a word written in kanji before the kanji is taught
  (寝/難/丈/夫/当…). Fix = write kana (the story pipeline's standard rule).
  Worth a dedicated sweep — mechanical but needs per-word eyes.

### E. Untaught particles (87) and forms (188)
Particles: p_wa_emph×31 p_ndesu×11 p_tte_quote×10 … — mostly in later-N4
files' explanations quoting casual speech. Forms: plain_negative×152 was the
bulk; the one-lesson-edge cases now report as warn (`formEdge`), the rest
are genuine early usage in N5.8-and-earlier conversations. Same triage as A.

### Warn buckets (not build-failing)
- **UNGLOSSARIED (2,649)** — content tokens with no glossary entry (incl.
  76 story-pool surfaces like すし/うそ/えらぶ used in reviews). Promote to
  glossary or reword; the Final Review's えらんで/うそ items are the ones
  most worth a look.
- **CHIP-COVERAGE (609)** — words in `jp` not covered by the `terms` array
  (render untappable). Mechanical authoring fixes; promote this bucket to
  hard once it's near zero.
- **DISTRACTOR (959)** — untaught kana words as MCQ wrong-answers (visible
  but never "used"). Lowest priority.

## Suggested batch order

1. (done) Flagship 猫 batch + dead chips + clear relevels
2. Category A relevel-or-reword pass over G13–G31 example sentences
3. Category D orthography sweep (kana until taught)
4. UNGLOSSARIED review-content pass (すし/うそ/えらぶ etc.)
5. CHIP-COVERAGE burn-down → flip the bucket to hard
