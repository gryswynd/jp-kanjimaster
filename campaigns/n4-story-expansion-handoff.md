# N4 Story Expansion — Session Handoff

> Current as of: N4 story expansion campaign mid-flight. Stories 4-12 have been expanded. **A real QA gap was discovered**: stories 7+ may contain untaught vocab + mistags that the 16-hook sweep + Agent 4 CR didn't catch. Story 8 (and the N4.7 lesson redo) are concrete confirmed cases.

---

## The campaign

**Phase A.2 of the N4 completion campaign**: expand each N4 story (currently undersized) to fit the length curve from ~3500 (story 5) → 7707 (story 19), and close audit-required reinforcement gaps (primary G grammar + N-lesson vocab).

**Per-story pipeline (intended):**
1. **Agent 1 (PM)** — write a Content Brief at `/tmp/storyN-content-brief.md`
2. **Agent 2 (CB)** — chunked rewrite, 3 WIP commits, **canonical length check via `wc -m` after each chunk** (rule baked into `skills/pipeline-content-builder.md`)
3. **Agent 3 (QA)** — **CURRENTLY MISSING — this is the gap to fix**. Should be a dedicated mechanical agent doing term-by-term scan.
4. **Agent 4 (CR)** — soft-gate consistency review
5. **Squash → push**

**Critical finding:** treating the 16-hook sweep as a substitute for Agent 3 (QA) is wrong. The validate-* hooks are lenient on story content (e.g., `validate-form-scope` tolerates story content per CR's own note on story 12's conditional_tara catch). Stories 8 and N4.7 both shipped with untaught vocab that hooks + CR missed.

---

## Story state matrix (this session's work)

| # | Story | Before → After | Primary G | Last commit | QA status |
|---|---|---|---|---|---|
| 1 | my-family (N5.1) | 498 → 693 | — | a6213d6 | hooks-only, light touch |
| 8-N5 | kita-minami-higashi-nishi | 2293 → 1723 | — | 816a75e | hooks-only, trim |
| 4 | kazoku-no-kisetsu | 1592 → 3028 | G17 | b2d2599 | hooks + CR (passed) |
| 5 | machi-no-eigakan | 1867 → 3311 | (taught-in window) | e20ad6e (prior session) | hooks + CR (revised) |
| 6 | tabisaki-no-shashin | 1203 → 3684 | ambient | cc69180 | hooks + CR (trim recovery) |
| 7 | uta-to-shigoto | 1132 → 3579 | G20 (のに/し) | c83dcd0 | hooks + CR (revised) — **SUSPECT** |
| 8 | hashiru-asa | 1156 → 3766 | G21 (12 markers) | d26ed07 | hooks + CR — **CONFIRMED BROKEN** by user (tagging + untaught vocab) |
| 9 | jitensha-de-kyouto-e | 1186 → 3579 | G22 (そうだ) | 4e6c6cd | hooks + CR (POV fix) — **SUSPECT** |
| 10 | library-book | 1083 → 3711 | ambient | 6e585a4 | hooks + CR — **SUSPECT** |
| 11 | furima-no-hi | 2130 → 4135 | G23 (てもいい) | 574e8a3 | hooks + CR — **SUSPECT** |
| 12 | natsuyasumi-no-taiken | 1865 → 3988 | G24 (てある) | 3138a96 | hooks + CR (conditional_tara fix) — **SUSPECT** |

User has also redone lesson N4.7 due to similar hook + Agent-3 gap.

---

## What a real Agent 3 (QA) needs to do

For each story, run a **mechanical term-by-term scan** that the hooks don't fully do:

1. **Untagged tokens** — every CJK token + every kana content word + every particle in JP narration must appear as a key in `terms.json`. Hooks do partial coverage; QA must verify exhaustively.
2. **Term scope** — for every term ID in terms.json, look up its `lesson_ids` in glossary and confirm `lesson_ids ≤ story's window ceiling` (e.g., N4.16 for story 8 hashiru-asa). Hooks let some N4.17+ slip through on stories.
3. **Form scope** — for every `{id, form}` pair, look up the form in `conjugation_rules.json` and confirm `introducedIn ≤ window ceiling`. Validate-form-scope is the leniency culprit per CR.
4. **Kanji scope** — every kanji appearing in JP narration must be in the cumulative taught set per `manifest.json` through the story's window ceiling. Hooks usually catch this but verify.
5. **Surface-match** — for every key in terms.json, confirm the surface actually appears in the JP narration text (no orphans).
6. **Mistag check** — for every (key, value) pair, confirm the term ID matches the meaning of the visible token. E.g., か as p_ka vs p_kana ambiguity; から as p_kara vs p_kara_because vs p_tekara; と as p_to vs p_to_quote vs p_to_conditional.
7. **G-anchor check** — for the story's primary G targetVocab IDs, confirm they appear in JP narration with the correct pattern (e.g., G24 てある = transitive verb te-form + ある, not just てある by itself).

Agent 3 should fail-fast: enumerate every violation in the report, not just sample. Output format: a CONSISTENCY NOTE table similar to Agent 4 but mechanical not subjective.

---

## Immediate next action

**Re-QA story 8 (hashiru-asa) first** since the user has it confirmed broken in front of them. Then sweep stories 7, 9, 10, 11, 12 with the same dedicated Agent 3.

For each broken story:
- Agent 3 QA report → enumerate violations
- Agent 2 CB fix pass → close each violation surgically (no rewrites)
- Hooks + Agent 4 CR re-run
- Squash on top of the prior story commit + force-push

---

## Files / paths the new session needs

**Skill files (load on demand):**
- `skills/pipeline-overview.md` — Agent 1 PM responsibilities
- `skills/pipeline-content-builder.md` — Agent 2 CB (HAS the length-check + one-instance guardrails added this session)
- `skills/pipeline-reviewers.md` — Agent 3 (QA) + Agent 4 (CR) — **note: Agent 3 section may be thin; build it out as you re-QA**
- `skills/grammar-rules-prerequisites.md` — scope rules
- `skills/grammar-rules-reinforcement.md` — story-window rule (recently fixed)
- `skills/quality-gates-criteria.md` + `skills/quality-gates-failures.md`
- `skills/term-tagging-forms.md` + `skills/term-tagging-characters.md`
- `skills/content-schemas-extended.md` — story schema

**Reference data:**
- `manifest.json` — authoritative for lesson IDs + kanji per lesson + story unlocksAfter
- `data/N4/glossary.N4.json` + `data/N5/glossary.N5.json` — vocab with `lesson_ids` and `matches[]`
- `shared/particles.json` — particles with `introducedIn`
- `shared/characters.json` — registered character IDs
- `conjugation_rules.json` — forms with `introducedIn` (per-form gating)
- `audit-grammar-vocab-gaps.md` — generated audit doc (regenerated via `python3 scripts/audit-grammar-vocab-gating.py`)

**Hooks (run for any file edit):**
- `hooks/validate-*.sh` — 16-18 mechanical checks. Useful but NOT sufficient for stories.

**Canonical story length measurements (different files use different delimiters):**
- Two-`---` format (stories 5-10): `awk '/^---$/{c++; next} c==1 && !/^### English/' file | wc -m`
- `### Story Text` / `**おわり**` format (stories 11, 12, 4, others): `sed -n '/### Story Text/,/おわり/p' file | wc -m`

---

## Key process rules the new session must keep

1. **Never skip Agent 3 (QA) or Agent 4 (CR) on stories** — even small fixes. Hooks alone are not enough.
2. **CB must use canonical wc -m measurement after each chunk**, not self-estimated CJK-only counts. (Two CB runs this session bloated 3× from miscounting.)
3. **One instance per target** unless brief explicitly says multiple. (Saturation like 妹 ×9 was a story 4 failure mode.)
4. **Story-window primary G** = first story whose `unlocksAfter ≥ G.unlocksAfter`. Code + doctrine are now correct; just follow the audit doc.
5. **Restructure-not-append** — surgical edits over wholesale rewrites when possible.

---

## Recent metadata fixes worth knowing

- `G17.json` had `unlocksAfter: N4.13` (stale) — corrected to N4.7 (commit `0c95144`)
- `scripts/audit-grammar-vocab-gating.py` story-window logic corrected (commit `95c35ea`)
- `skills/grammar-rules-reinforcement.md` story-reinforcement rule rewritten with worked examples (same commit)
- `skills/pipeline-content-builder.md` length + one-instance guardrails added (commit `986a9d4`)

---

## Glossary gaps tracked (worth knowing for future story work)

- `v_hanashi` 話 noun — NOT in glossary; only 話す verb exists. Stories must use 話す + nominalizer (or restructure) when "talk/story" as noun is needed.
- `v_kimari` / `v_ruru` / `v_menyu` / `v_shirase` / `v_kabe` — all absent; expect to fall back to 大切な事 / いろいろな事 for "rule/sign/menu" beats.
- `p_kamoshirenai` かもしれない — NOT in particles.json.
- v_dame is the G23 audit target word (na-adj at N5.5; verify form when tagging).

---

## Branch state

Working branch: `claude/add-flashcard-examples-QHCsu`
HEAD: `3138a96` (story 12)
All session commits already pushed.
