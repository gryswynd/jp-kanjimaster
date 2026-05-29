# Godot Migration Campaign

> **Status:** Planning
> **Started:** 2026-03-20
> **Last updated:** 2026-03-20

---

## Current State

- **Platform:** Web app (HTML/JS), embedded via Webflow
- **Rendering:** DOM-based — Lesson.js, Grammar.js, Game.js, Review.js, FinalReview.js, Compose.js, Story.js, Practice.js
- **Data layer:** JSON files (manifest.json, glossary, conjugation_rules, counter_rules, particles, characters)
- **Text processing:** app/shared/text-processor.js — handles conjugation engine, chip generation, GODAN_MAPS
- **State:** app/shared/progress.js, app/shared/unlock.js
- **Assets:** Sprite sheets, character portraits, backgrounds (managed by RikizoArtPipeline.md)
- **Existing Godot work:** /godot/ directory with project.godot, scenes/, scripts/, setup_assets.sh, SETUP.md

## Target State

- **Platform:** Godot 4.x → export to iOS (App Store) and Android (Play Store)
- **Language:** GDScript (primary), with potential C# for performance-critical paths
- **Data layer:** Same JSON files — no content migration needed
- **Text processing:** Port text-processor.js logic to GDScript (conjugation engine, chip matching, GODAN_MAPS)
- **UI:** Godot's RichTextLabel with BBCode for tappable term chips (replaces HTML spans)

## Key Decisions Made

| Decision | Date | Rationale |
|---|---|---|
| Godot over Flutter/React Native | pre-existing | Game-like interactions (bingo, speed rounds, drag-and-drop) suit a game engine better than a UI framework |
| Keep JSON data layer unchanged | 2026-03-20 | Content pipeline (CLAUDE.md skills) produces JSON; Godot reads the same files — zero content migration |
| Separate content rules from engine rules | 2026-03-20 | Content authoring rules (skills/) don't change with engine migration; engine-specific validation hooks will need Godot equivalents |

## Migration Phases

### Phase 1: Core Text Engine (NOT STARTED)
Port the text-processor.js chip system to GDScript:
- [ ] Conjugation engine (godan, ichidan, irregular rules)
- [ ] GODAN_MAPS (ta_form, tari_form, tara_form euphonic maps)
- [ ] Surface matching / longest-match algorithm
- [ ] Chip generation (vocab chips, particle chips, character name chips)
- [ ] RichTextLabel BBCode output (replaces HTML span generation)
- [ ] Counter engine (counter_rules.json → GDScript)

**Blocked on:** None — can start immediately. Reference: app/shared/text-processor.js

### Phase 2: Data Loading & State (NOT STARTED)
- [ ] JSON loader for manifest.json, glossary files, conjugation_rules, particles, characters
- [ ] Progress/unlock system (port progress.js, unlock.js)
- [ ] Lesson gate logic (which lessons are available based on progress)
- [ ] Story unlock ordering (unlocksAfter field)

**Blocked on:** Phase 1 (need text engine to test content rendering)

### Phase 3: Screen Scenes (NOT STARTED)
Port each JS module to a Godot scene:
- [ ] Lesson scene (warmup, kanjiGrid, vocabList, conversations, readings, drills)
- [ ] Grammar scene (grammarIntro, grammarRule, grammarTable, grammarComparison, annotatedExample, conjugationDrill, patternMatch, sentenceTransform, fillSlot, conversation, drills)
- [ ] Review scene (conversations with comprehension, scramble drills, MCQ drills, readings)
- [ ] Final Review scene (speed_round, conversation, grammar_roulette, scramble_relay, detective_reading, match_pairs, vocab_categories, kanji_bingo)
- [ ] Compose scene (prompt flow, target tracking, vocab pool display, model toggle)
- [ ] Story scene (markdown rendering, term overlay, scroll tracking)
- [ ] Practice scene (SRS queue, card display)
- [ ] Term modal (tap-to-see-definition popup — replaces term-modal.js)

**Blocked on:** Phase 1 + Phase 2

### Phase 4: Game Systems (NOT STARTED)
- [ ] Kanji Bingo generator (port KanjiBingoGenerator.js)
- [ ] TTS integration (Godot audio + platform TTS APIs)
- [ ] Asset loading (sprite sheets, portraits — port asset-loader.js)
- [ ] Animations and transitions

**Blocked on:** Phase 3

### Phase 5: Platform Export (NOT STARTED)
- [ ] iOS export configuration (Xcode, provisioning profiles, App Store Connect)
- [ ] Android export configuration (keystore, Play Console)
- [ ] Platform-specific TTS (AVSpeechSynthesizer on iOS, Android TTS)
- [ ] Touch input optimization
- [ ] Screen size adaptation (iPhone SE → iPad Pro, small Android → tablet)
- [ ] App Store / Play Store submission

**Blocked on:** Phase 4

## Architecture Notes

### What stays the same (content layer)
- All JSON content files (lessons, grammar, reviews, compose, stories)
- manifest.json structure
- glossary files (N5, N4)
- conjugation_rules.json, counter_rules.json
- shared/particles.json, shared/characters.json
- The entire content creation pipeline (skills/) and its 4-agent workflow
- Content validation hooks (these check JSON structure, not rendering)

### What changes (engine layer)
- HTML/CSS/JS rendering → Godot scenes + GDScript
- DOM span-based chips → RichTextLabel BBCode tags
- CSS animations → Godot AnimationPlayer / Tween
- Browser localStorage → Godot FileAccess (user://)
- Web Audio API → Godot AudioStreamPlayer
- Webflow embed → standalone native app

### Risk areas
- **Text-processor.js is the most complex port.** ~1000 lines of regex-heavy JS with subtle edge cases (adjacent single-char kana blocking, compound surface matching, godan euphonic maps). This must be ported with high fidelity — any regression breaks every lesson.
- **RichTextLabel limitations.** Godot's BBCode is less flexible than HTML/CSS for inline styling. May need custom BBCode tags or a TextServer approach for the chip system.
- **Japanese text input.** Compose mode requires IME support for Japanese input on mobile. Godot's LineEdit/TextEdit may need platform-specific handling.

## Open Questions

- [ ] Should we use Godot 4.3+ (latest stable) or wait for 4.4?
- [ ] C# vs pure GDScript for the conjugation engine? (GDScript is simpler; C# is faster for regex)
- [ ] How to handle the compose mode's free-text Japanese input on mobile?
- [ ] Monetization model for App Store / Play Store? (affects architecture if IAP is needed)
- [ ] Do we need offline support? (all JSON is local, but TTS may need network)
