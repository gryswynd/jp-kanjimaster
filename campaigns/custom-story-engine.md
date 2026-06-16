# Custom Story Engine — Post-Mortem & Production Status

**Owner:** content/eng · **Last updated:** 2026-06-15 · **Branch:** `claude/custom-story-5`

The custom-story engine (scaffold → tokenize → audit → validate → render) is how
paid/custom Rikizo stories are authored in jp-kanjimaster. This doc is the
post-mortem from the Story 5 build plus the path to a production-grade engine.

---

## Post-mortem — Story 5 (村の夏まつり) build

**Outcome:** Story 5 shipped clean, but only after manual firefighting that the
engine should have prevented. Five gaps, with root causes:

1. **Vacuous vocab gate.** `audit-story-vocab.mjs` only scanned
   `manifest.data.N4.stories`, and `STORY_RANK` was `-1` for `custom` — so custom
   stories were never really audited (reported "0 stories scanned"). Out-of-scope
   vocab passed unchecked. → **FIXED** (scans custom; ranks custom as N4; `--strict`).
2. **`--en` footgun.** `tokenize-story-paragraph.mjs` parsed flags by `=` only, so
   `--en "text"` set `en=true` (boolean) and dropped the English as a stray
   positional. 8 paragraphs lost their translations mid-build. → **FIXED**
   (parser accepts `--key value`).
3. **No kanji-scope / unglossaried gate.** The deterministic tokenizer silently
   strips furigana off untaught bare kanji and lumps unglossaried kana with the
   next particle → broken "chips" (はじめ→は[わ]+じめ, おまつりの, 広→no furigana,
   etc.). Nothing flagged it. → **BACKLOG** (see below).
4. **Custom content was lesson-gated.** `unlocksAfter` was set per the campaign
   brief, but the product rule is **custom = paid = always available**, never
   lesson-gated. → **FIXED** (all custom `unlocksAfter: null`).
5. **QA process miss.** Inline QA checked only `g`-tagged tokens, missing
   unglossaried/N3 **surfaces** — exactly the chip-breakers. QA must audit token
   surfaces against N5/N4/N3 glossaries + particles + characters.

## Engine fixes applied this session

- `scripts/audit-story-vocab.mjs` — scans `--level=custom`; correct `STORY_RANK`
  for custom (N4); `--strict` exits non-zero on any finding (CI gate).
- `scripts/tokenize-story-paragraph.mjs` — flag parser accepts both `--k=v` and
  `--k v`; value-flags (`en`/`english`/`insert`/`replace`/`kind`) consume the next token.
- `index.html` — reverted a review-only `mode:'free'` flip back to `gated`
  (free mode must never ship; it unlocks all gated content).
- Glossary (with explicit user consent): added **まつり / おまつり** (kana surfaces,
  `lesson_ids: N4.27`, alongside 七夕). All other out-of-scope words were reworded
  in-scope (かざり→紙, だいたい dropped, stone-steps→道, くつ→洋服, etc.).

## Hardening backlog (to reach "production")

- [ ] **Kanji-scope gate (highest value).** A check that flags any kanji in a
  story `jp` not in the taught set (from `manifest` lesson `kanji[]`, N5 + level)
  and any bare-furigana token. Would have caught every Story-5 chip bug up front.
- [ ] **Wire `audit-story-vocab.mjs --level=custom --strict`** into `build:www`
  and/or the pre-commit hook so custom stories gate like curriculum.
- [ ] **Fix the other custom stories** the now-working audit surfaced:
  okujou-no-konsaato uses `なくなる` (N3) ×3 + unglossaried; others have findings
  too (this is the deferred Story-4-era chip backlog).
- [ ] **`new-story.mjs --level=custom`** — scaffold with the always-available
  convention documented (no lesson gate).
- [ ] **Module reachability.** Custom stories sit behind the Stories tab's G4
  gate (`unlock.js isModuleVisible('story')`). For paid custom content reachable
  without curriculum progress, add a custom entry point or exempt custom.
- [ ] **Author docs.** jp-kanjimaster has no `skills/`; ~70% of the jp-lessons
  pipeline skills are terms.json-era. Write a concise CUSTOM-STORIES authoring doc.

## Production deployment checklist (iOS + Android)

**Blockers / decisions (need owner):**
- [ ] **`GOOGLE_TTS_API_KEY`** — required by `npm run gen:audio`; `build:www` gates
  on `validate-audio` and Story 5 + まつり/おまつり have no clips. Not set in env.
- [ ] **Branch target** — work is on `claude/custom-story-5` (off `main`); the main
  checkout is on the redesign branch with 154 uncommitted files. Decide merge path.
- [ ] **Ship scope** — confirm shipping: ungating all 5 custom stories + the
  まつり/おまつり glossary additions.

**Steps once unblocked:**
1. Merge `claude/custom-story-5` into the shipping branch.
2. `GOOGLE_TTS_API_KEY=… npm run gen:audio`
3. `npm run vendor:fonts`
4. `npm run build:www`  (gates: manifest, stories, audiostories, audio, fonts, particles)
5. `npx cap sync ios && npx cap sync android`
6. **iOS:** `npm run ios` → Xcode archive/upload. **Android:** `npm run dist:android`
   (gradlew assembleRelease + Firebase beta distribution).
