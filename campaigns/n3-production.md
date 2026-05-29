# N3 Campaign: Vocabulary Roadmap & Content Production

> **Status:** Planning
> **Started:** —
> **Last updated:** 2026-03-20

---

## Goal

Build the N3 level from the ground up: finalize the vocabulary roadmap, create all content lessons, grammar lessons, reviews, compose files, and stories.

## Current State

| Content type | Exists | Notes |
|---|---|---|
| Vocabulary roadmap | Partial | `N3-kanji-lesson-plan.md` and `N3-regroup-working.md` exist — need finalization |
| Glossary | Started | `glossary.N3.json` exists (size TBD) |
| Grammar (G32–G49) | 18/18 **JSON files exist** | Built but **not QA'd** — need validation |
| Content lessons | 0 | No N3.X lesson files |
| Reviews | 0 | No review files |
| Compose | 0 | No compose files |
| Stories | 0 | No story files |
| Game days | 0 | No game structure |
| Manifest entries | TBD | N3 lessons not yet in manifest |

## Vocab Debt from N4 Stories (introduce early in N3)

The following words were used as untagged story-context in `furima-no-hi` (N4.21+N4.22) because they had no glossary entries at time of writing. They are common, natural words that came up organically and should be taught **early in N3** (Phase 1 or early Phase 3):

| Word | Reading | Meaning | Notes |
|---|---|---|---|
| ならべる | ならべる | to arrange; to line up | Intransitive: ならぶ. Both forms useful. |
| 見つける | みつける | to find; to discover | Very common narrative verb. |
| つける | つける | to attach; to put on | Also means "to turn on" (light, etc.) — multiple senses. |
| しばらく | しばらく | for a while; a little while | Common time expression. |
| やっぱり | やっぱり | as expected; after all; still | Casual register; formal is やはり. |

Also flag for early N3 vocabulary:
- `はこ` (box) — used as untagged kana in furima-no-hi because not in N5/N4 glossary; tokenizes incorrectly as `は`+`こ` particle split. Add to N3 early.
- `として` (as; in the capacity of) — compound particle used in furima-no-hi, no p_* ID exists in particles.json. Add as particle or grammar point.

---

## Phase 1: Vocabulary Roadmap (BLOCKING — everything depends on this)

The N3 vocabulary roadmap determines which kanji and words go in which lesson, which determines the taught-kanji set for every piece of content.

### Tasks
- [ ] Read `N3-kanji-lesson-plan.md` — assess current state
- [ ] Read `N3-regroup-working.md` — assess regrouping decisions
- [ ] Finalize lesson count (how many N3 lessons? N5=18, N4=36, N3=?)
- [ ] Finalize kanji allocation per lesson
- [ ] Finalize vocabulary allocation per lesson
- [ ] Update `glossary.N3.json` with all entries, correct `lesson_ids`
- [ ] Add N3 lesson entries to `manifest.json` with kanji arrays

### Key decisions needed
- [ ] How many N3 lessons? (N3 covers ~370 kanji — at ~10 kanji/lesson that's ~37 lessons)
- [ ] Lesson themes and groupings
- [ ] Which N3 grammar points pair with which content lessons?
- [ ] unlocksAfter chain for G32–G49

## Phase 2: Grammar QA (G32–G49)

18 grammar lesson JSON files already exist in `data/N3/grammar/`:

| ID | Topic | File exists | QA'd |
|---|---|---|---|
| G32 | Relative Clauses & Noun Modification | Yes | No |
| G33 | Nominalizers: の and こと | Yes | No |
| G34 | Volitional Form & Intentions | Yes | No |
| G35 | Conjecture & Inference (ようだ / みたいだ / らしい) | Yes | No |
| G36 | Expectation & Reasoning (はずだ / わけだ) | Yes | No |
| G37 | Aspect & Temporal States (ところだ / たばかり) | Yes | No |
| G38 | Sentence-Ending Particles & Register | Yes | No |
| G39 | Adverbs of Degree | Yes | No |
| G40 | Honorific & Humble Speech (敬語 Introduction) | Yes | No |
| G41 | Time Clauses (間 / うちに / 以来 / とたん) | Yes | No |
| G42 | Perspective & Relation Particles | Yes | No |
| G43 | Causative-Passive & Advanced Voice | Yes | No |
| G44 | Suffixes & Word Formation (っぽい / がち / 気味 / ～やか) | Yes | No |
| G45 | Advanced Conditionals & Wishes | Yes | No |
| G46 | Quoting & Indirect Speech | Yes | No |
| G47 | Compound Expressions & Set Patterns | Yes | No |
| G48 | Advanced Connectors | Yes | No |
| G49 | N3 Grammar Capstone Review | Yes | No |

### QA tasks
- [ ] Run all 18 files through validate-grammar-schema hook
- [ ] Verify section field names (annotatedExample→examples[], etc.)
- [ ] Verify meta.particles uses strings not IDs
- [ ] Verify conversation sections have full terms[] tagging
- [ ] Verify sentenceTransform items have choices[]
- [ ] Set correct unlocksAfter values based on vocab roadmap
- [ ] Add G32–G49 to manifest.json

## Phase 3: Content Lessons

Once the vocabulary roadmap is finalized:

- [ ] Build N3.1 through N3.? (lesson count TBD)
- [ ] Each lesson goes through the full 4-agent pipeline
- [ ] Hooks enforce kanji scope, term IDs, grammar gating automatically
- [ ] New conjugation forms for N3 grammar need conjugation_rules.json entries

### N3 grammar forms that may need adding to conjugation_rules.json
- Relative clause forms (plain form + noun)
- の/こと nominalizer patterns
- Volitional + とする / と思う
- Conjecture forms (ようだ, みたいだ, らしい)
- はずだ, わけだ patterns
- ところだ, たばかり aspectual forms
- 敬語 forms (いらっしゃる, おっしゃる, etc.)
- Causative-passive compound forms
- Advanced conditional forms

## Phase 4: Supporting Content

Built after content lessons are stable:

- [ ] Reviews — plan review ranges and build
- [ ] Compose files — one per lesson, 10+ prompts each (late-level range)
- [ ] Stories — plan themes, build with proper terms.json
- [ ] Add all content to manifest.json

## Phase 5: Game Day Planning

- [ ] Decide if N3 gets game days (or if the Godot migration means building game content natively)
- [ ] If yes: create N3_GAME_ROADMAP.md
- [ ] Narrative arc for N3 (continuation of Rikizo's story?)

## Dependencies

- **Blocks on N4 completion:** Students must finish N4 before N3. N3 content assumes all N4 kanji, vocab, and grammar are mastered.
- **Blocks on vocab roadmap:** Every other phase depends on knowing which kanji/vocab go in which lesson.
- **Grammar QA can start immediately** — G32–G49 files exist and can be validated against GRAMMAR_CONTENT.md spec without waiting for the vocab roadmap.

## Priority Order

1. **Grammar QA (G32–G49)** — can start now, no blockers
2. **Vocabulary roadmap finalization** — blocks everything else
3. **Glossary + manifest setup** — enables content lesson production
4. **Content lessons** — the main production phase
5. **Compose, reviews, stories** — after lessons are stable
6. **Game planning** — last, may merge with Godot migration
