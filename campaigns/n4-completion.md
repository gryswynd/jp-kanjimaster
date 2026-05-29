# N4 Campaign: Full Refresh & Completion

> **Status:** Ready to start
> **Started:** —
> **Last updated:** 2026-03-25

---

## Goal

Complete the entire N4 level: refresh the back half of lessons (N4.21–N4.36), build missing reviews, complete all stories, finish all grammar lessons, build compose files, and QA everything.

## Current State

| Content type | Exists | Needed | Gap |
|---|---|---|---|
| Lessons (N4.1–N4.36) | 36/36 | All | N4.21–N4.36 need **full refresh** to current standards |
| Grammar (G13–G31) | 9 (G13–G20, G23) | 19 | **G21–G22, G24–G31 missing** (11 lessons) |
| Reviews | 18 numbered + 2 half + 1 final | — | N4.Review.11–18 need QA; **Finale may need refresh** |
| Compose | 21 files | 36 | **compose.N4.21–N4.36 missing** (16 files) |
| Stories | 13 | — | Need stories covering N4.21+ vocabulary |
| Game days | 0 | TBD | Game day planning needed |

## Phase 1: Lesson Refresh (N4.21–N4.36)

These lessons exist but predate current quality standards (term tagging, grammar reinforcement, register requirements, etc.). Each needs a full refresh through the 4-agent pipeline.

**Batch 1: N4.21–N4.27** (Permissions, Conditionals, ように patterns)
- [ ] N4.21 — permissions/prohibitions (てもいい, てはいけない)
- [ ] N4.22
- [ ] N4.23
- [ ] N4.24
- [ ] N4.25 — conditionals (たら, ば, なら, と) — major grammar milestone
- [ ] N4.26
- [ ] N4.27

**Batch 2: N4.28–N4.32** (Passive, Causative, Thoughts & Experience)
- [ ] N4.28
- [x] N4.29 — Typhoons, Clocks, and Knowing ✓ (lesson + compose.N4.29, 2026-03-25)
- [x] N4.30 — Thinking, Gathering & Answering ✓ (lesson + compose.N4.30, 2026-03-26)
- [ ] N4.31 — passive/causative forms introduced — major grammar milestone
- [ ] N4.32

**Batch 3: N4.33–N4.36** (Advanced patterns, Adjective change, Capstone)
- [ ] N4.33
- [ ] N4.34 — すぎる, てみる, ておく, てしまう — major grammar milestone
- [ ] N4.35
- [ ] N4.36 — final N4 lesson

## Phase 2: Grammar Lessons (G21–G31, minus G23)

11 grammar lessons need to be built from GRAMMAR_CONTENT.md spec (G23 already exists):

| ID | Topic | unlocksAfter | Status |
|---|---|---|---|
| G21 | Conversation Mechanics (相槌, hesitation) | N4.16 | **Not built** |
| G22 | そうだ: Appearance & Hearsay | N4.18 | **Not built** |
| G23 | Permissions & Prohibitions (てもいい, てはいけない, なくてもいい) | N4.21 | **Built** (was G21) |
| G24 | Directional て-Form (てくる/ていく/てある) | N4.23 | **Not built** |
| G25 | Obligations & Conditionals (なければ, ば, たら, なら, と) | N4.25 | **Not built** |
| G26 | ように Patterns (ようにする / ようになる) | N4.27 | **Not built** |
| G27 | Expressing Thoughts & Experience (と思う / たことがある) | N4.30 | **Not built** |
| G28 | Passive Form | N4.31 | **Not built** |
| G29 | Causative Form | N4.31 | **Not built** |
| G30 | Advanced Verb Usages (てみる, ておく, てしまう, すぎる, とする) | N4.34 | **Not built** |
| G31 | Advanced Adjective Patterns (くなる/になる, くする/にする) | N4.34 | **Not built** |

**Recommended build order** (by unlocksAfter, earliest first):
1. G21, G22 (unlock after N4.16/N4.18 — earliest)
2. G24 (unlock after N4.23)
3. G25, G26 (unlock after N4.25/N4.27)
4. G27 (unlock after N4.30)
5. G28, G29 (unlock after N4.31)
6. G30, G31 (unlock after N4.34)

## Phase 3: Reviews

### Existing reviews to QA
- [ ] N4.Review.11 through N4.Review.18 — run through hooks, fix issues
- [ ] N4 Half Review 2 — verify coverage
- [ ] N4.Final.Review — may need refresh for consistency

### Potential new reviews needed
- Reviews typically cover 2-lesson ranges. With N4.21–N4.36 refreshed, verify coverage is complete.

## Phase 4: Compose Files (compose.N4.21–N4.36)

16 compose files to build — one per lesson:

- [ ] compose.N4.21 through compose.N4.36

Each follows the compose schema with 9-10 prompts per file (late N4 range).

## Phase 5: Stories

Current N4 stories (13 total):
- factory-owner, field-trip-day, hashiru-asa, hirugohan-monogatari, jitensha-de-kyouto-e, kazoku-no-kisetsu, library-book, machi-no-eigakan, new-city, rikizo-journey, tabisaki-no-shashin, uta-to-shigoto, watashi-no-iro

### Stories needed
- [ ] Assess which stories cover N4.1–N4.20 vocabulary vs N4.21–N4.36
- [ ] Plan 4–6 new stories for the N4.21–N4.36 range
- [ ] Build new stories with proper terms.json and particle tagging

## Phase 6: QA All Grammar Lessons (G13–G31)

Once all grammar lessons exist, run the full set through validation:
- [ ] G13–G20, G23 (existing) — run through validate-grammar-schema and fix issues
- [ ] G21–G22, G24–G31 (newly built) — should pass hooks from creation, but verify

## Phase 7: Game Day Planning

No N4 game days exist yet. Planning needed:
- [ ] Define N4 game day structure — does the "Golden Week" narrative continue, or is N4 a new arc?
- [ ] Decide scope: 36 game days (one per lesson) or condensed format?
- [ ] Create N4_GAME_ROADMAP.md if proceeding

## Priority Order

1. **G21, G22** → earliest unlock (N4.16/N4.18), most students will hit these first
2. **N4.21–N4.27 refresh** → unlocks G24, G25, G26
3. **G24, G25, G26** → build after lessons they depend on are refreshed
4. **N4.28–N4.36 refresh** → unlocks remaining grammar
5. **G27–G31** → build after their lesson prerequisites are refreshed
6. **compose.N4.21–N4.36** → can be built in parallel with lesson refreshes
7. **Stories** → after lessons are stable
8. **Reviews QA** → after all content is stable
9. **Game day planning** → last priority for N4
