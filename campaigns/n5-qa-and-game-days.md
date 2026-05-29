# N5 Campaign: Total QA & Game Days

> **Status:** Ready to start
> **Started:** —
> **Last updated:** 2026-03-26
> **Audit baseline:** 68 files, 147 failures across 12 hooks (run `bash hooks/audit-all.sh N5` to regenerate)
> **Previous baseline:** 154 failures (pre-fix: polite_masu scope + surface-match reading fallback)

---

## Goal

Complete the N5 level: fix all existing content issues, then build the remaining game days so N5 is a polished, playable experience.

## Current State

| Content type | Count | Status |
|---|---|---|
| Lessons | 18/18 | Complete — **all 18 have issues** |
| Grammar (G1–G12) | 12/12 | Complete — **all 12 have issues** |
| Reviews | 10 (9 numbered + Final) | Complete — **all 10 have issues** |
| Compose | 18/18 | Complete — **16 clean, 2 have issues** |
| Stories | 10 | Complete — **clean** (meta.kanji exemption applied to hook) |
| Game days | 1/18 (Day 1 only) | **17 game days needed** |

### Top failure patterns across N5

| Hook | Files failing | Root cause |
|---|---|---|
| `surface-match` | 39 | Early vocab written in kanji before taught (v_kyou → '今日' but jp has きょう), character names, Q&A question text mismatches |
| `particle-context` | 23 | Missing `p_ka` on question sentences, particle disambiguation |
| `structure` | 22 | Grammar Drill 1 has terms (should be terms-free), stories missing meta.kanji |
| `chip-order` | 18 | Kana pair ordering (には, では, よね, だよ, のが) |
| `term-ids` | 18 | k_* IDs used outside kanjiGrid (should be v_*) |
| `form-scope` | 9 | ~~polite_masu before N5.5~~ (FIXED — moved to N5.1), plain_desire_tai before G10, da_past before G9 |
| `grammar-schema` | 4 | Invalid color 'particle' / 'time' in pattern chips |
| `kanji-scope` | 4 | Untaught kanji in jp text |
| `register` | 4 | 0 casual conversations (N5.10+ requires ≥1) |
| `suru-compound` | 3 | v_manabu (noun_suru) used with conjugation form directly |
| `compose` | 2 | Target vocab has no kanji (scoring is kanji-based) |
| `writing-forms` | 1 | いつか should be 五日 (kanji taught) |

### Resolved since initial audit

- **grammar Drill 1 terms** (12 files cleared): Stripped `terms[]` from all Drill 1 items across G1–G12 (FM #6). Drill 1 is free-form production — no chip hints.
- **grammar-schema colors** (4 files cleared): Remapped `particle→connector`, `time→modifier` in pattern chips for G1, G3, G4, G5.
- **stories meta.kanji** (10 files cleared): Exempted story `terms.json` files from FM #12 in `validate-structure.sh` — `meta.kanji` has no functional role in stories.
- **polite_masu scope** (7 files cleared): Moved `introducedIn` for polite_masu/mashita/negative/past_negative from N5.5 → N5.1. Cleared form-scope from N5.1, N5.2, N5.3, G2, G3, G4, N5.Review.2.
- **surface-match reading fallback**: Hook now checks `reading` (hiragana) when `surface` contains untaught kanji. Reduces individual error count within files but most files still have remaining surface issues (character names, Q&A text mismatches).
- **surface-match CJK lookbehind on jp_orig**: Hook now runs the negative-CJK lookbehind against `jp_orig` (spaces intact) rather than `jp_clean`. Prevents false positives where a single-char kanji immediately follows a space-separated word ending in kanji (e.g. `毎日 水が` → `毎日水が` after stripping).
- **surface-match reading as extra match**: Hook always adds `reading` as an extra accepted form, so authors can use hiragana for words whose kanji is technically taught (e.g. もの for 物).

---

## Phase 1: Term QA Sweep (all N5 content)

Run every existing N5 file through the validation hooks and fix what they catch. Each file lists its hook failures from the 2026-03-25 audit. After fixing a file, re-run `bash hooks/audit-all.sh N5` to confirm it's clean.

### 1a. Lessons (N5.1–N5.18) — 639 issues across 18 files

- [x] **N5.1** — CLEAN (was 38 issues — resolved via 3 hook fixes + content edits)
  - ~~`form-scope` (10): FIXED — polite_masu moved to N5.1~~
  - ~~`particle-context` (1): Added p_ka to sections[4].lines[2]~~
  - ~~`surface-match` (15): Hook bugs fixed (kanjiGrid false positives, mid-token kanji, q+a split); genuine v_nani→v_nan in 5 なんですか contexts~~
  - ~~`term-ids` (19): Hook bug fixed (section-type tracking); genuine k_otoko/k_onna/k_ko→v_* in sentence content~~
- [x] **N5.2** — CLEAN (was 27 issues — resolved via hook fix + 1 content edit)
  - ~~`form-scope` (10): FIXED — polite_masu moved to N5.1~~
  - ~~`surface-match` (15): Hook fix — lookbehind now uses jp_orig (spaces intact) to avoid false positives at word boundaries (e.g. 毎日 水が); genuine v_nani→v_nan in なんですか~~
  - ~~`term-ids` (10): Hook fix — kanjiGrid section-type tracking; k_* IDs in kanjiGrid are valid~~
- [ ] **N5.3** — 31 issues [`surface-match`, `term-ids`]
  - ~~`form-scope` (10): FIXED — polite_masu moved to N5.1~~
  - `surface-match` (15): v_tomodachi, v_sensei not matching jp text
  - `term-ids` (14): k_hito_2, k_futa, k_mi + 11 more k_*
- [ ] **N5.4** — 24 issues [`form-scope`, `surface-match`, `term-ids`]
  - ~~`form-scope` (10): polite_masu FIXED~~
  - `form-scope` (2): plain_past_adj before G10
  - `surface-match` (15): v_kyou, v_mainichi not matching jp text
  - `term-ids` (5): k_toki, k_wa, k_toshi + 2 more k_*
- [ ] **N5.5** — 26 issues [`chip-order`, `surface-match`, `term-ids`]
  - `chip-order` (5): にも, では pairs need reordering
  - `surface-match` (15): v_kyou, v_mainichi not matching jp text
  - `term-ids` (5): k_i, k_ku, k_mise + 2 more k_*
- [ ] **N5.6** — 24 issues [`chip-order`, `surface-match`, `term-ids`]
  - `chip-order` (4): では, へも pairs
  - `surface-match` (15): v_kyou, v_yama not matching jp text
  - `term-ids` (4): k_yama, k_kawa, k_michi + 1 more k_*
- [ ] **N5.7** — 20 issues [`surface-match`, `term-ids`]
  - `surface-match` (15): v_kyou, v_en not matching jp text
  - `term-ids` (4): k_oo_2, k_chii, k_shoku + 1 more k_*
- [ ] **N5.8** — 25 issues [`form-scope`, `surface-match`, `term-ids`]
  - `form-scope` (3): plain_desire_tai before G10
  - `surface-match` (15): v_kyou, v_en not matching jp text
  - `term-ids` (5): k_furu, k_atara, k_ka_2 + 2 more k_*
- [ ] **N5.9** — 29 issues [`form-scope`, `surface-match`, `term-ids`]
  - `form-scope` (8): plain_desire_tai before G10
  - `surface-match` (15): v_mise, v_eki not matching jp text
  - `term-ids` (4): k_mae, k_ushiro, k_naka + 1 more k_*
- [ ] **N5.10** — 32 issues [`particle-context`, `register`, `surface-match`, `term-ids`]
  - `particle-context` (10): Missing p_ka on reading questions
  - `register` (1): 0 casual conversations — N5.10+ requires ≥1
  - `surface-match` (15): v_ninki, v_yama not matching jp text
  - `term-ids` (4): k_ama, k_u96fb, k_u6c17 + 1 more k_*
- [ ] **N5.11** — 30 issues [`particle-context`, `surface-match`, `term-ids`]
  - `particle-context` (9): Missing p_ka on reading questions
  - `surface-match` (15): v_hanabi, v_kuuki not matching jp text
  - `term-ids` (4): k_sora, k_ame, k_hana + 1 more k_*
- [ ] **N5.12** — 46 issues [`chip-order`, `particle-context`, `register`, `surface-match`, `suru-compound`, `term-ids`]
  - `chip-order` (1): よね pair
  - `particle-context` (8): Missing p_ka on reading questions
  - `register` (1): 0 casual conversations — N5.10+ requires ≥1
  - `surface-match` (15): v_chuugoku, v_kurasu not matching jp text
  - `suru-compound` (14): v_manabu (noun_suru) used with conjugation forms directly
  - `term-ids` (5): k_moto, k_kata, k_mana + 2 more k_*
- [ ] **N5.13** — 28 issues [`chip-order`, `particle-context`, `surface-match`, `suru-compound`, `term-ids`]
  - `chip-order` (1): よね pair
  - `particle-context` (7): Missing p_ka
  - `surface-match` (12): v_mainichi, v_denwa not matching jp text
  - `suru-compound` (1): v_manabu with te_form
  - `term-ids` (5): k_te, k_i_2, k_yo + 2 more k_*
- [ ] **N5.14** — 33 issues [`chip-order`, `particle-context`, `surface-match`, `term-ids`]
  - `chip-order` (2): だよ pairs
  - `particle-context` (10): Missing p_ka
  - `surface-match` (15): v_kyou, v_jikan not matching jp text
  - `term-ids` (4): k_suko, k_oo, k_shiro + 1 more k_*
- [ ] **N5.15** — 46 issues [`chip-order`, `particle-context`, `surface-match`, `term-ids`]
  - `chip-order` (14): には, にも pairs (heavy — location-heavy lesson)
  - `particle-context` (11): Missing p_ka
  - `surface-match` (15): v_kita, v_mainichi not matching jp text
  - `term-ids` (4): k_kita, k_minami, k_higashi + 1 more k_*
- [ ] **N5.16** — 40 issues [`chip-order`, `particle-context`, `surface-match`, `term-ids`, `writing-forms`]
  - `chip-order` (10): には pairs (location-heavy)
  - `particle-context` (8): Missing p_ka
  - `surface-match` (15): v_hon, v_minami not matching jp text
  - `term-ids` (4): k_migi, k_hidari, k_ue + 1 more k_*
  - `writing-forms` (1): いつか should be 五日 (kanji taught)
- [ ] **N5.17** — 31 issues [`particle-context`, `register`, `surface-match`, `term-ids`]
  - `particle-context` (7): Missing p_ka
  - `register` (1): 0 casual conversations — N5.10+ requires ≥1
  - `surface-match` (15): v_deguchi, v_hidari not matching jp text
  - `term-ids` (6): k_u5348, k_kuchi, k_de + 3 more k_*
- [ ] **N5.18** — 39 issues [`particle-context`, `register`, `surface-match`, `term-ids`]
  - `particle-context` (15): Missing p_ka (heaviest — many question sentences)
  - `register` (1): 0 casual conversations — N5.10+ requires ≥1
  - `surface-match` (15): v_hon, char_yamakawa not matching jp text
  - `term-ids` (6): k_me, k_mi_2, k_mimi + 3 more k_*

### 1b. Grammar (G1–G12) — 296 issues across 12 files

- [x] **G1** — 34 issues [`chip-order`, `form-scope`, `grammar-schema`, `particle-context`, `structure`, `surface-match`]
  - `chip-order` (1): だよ pair
  - `form-scope` (6): p_mo before N5.2, da_past before G9
  - `grammar-schema` (2): Invalid color 'particle' in pattern chips
  - `particle-context` (5): Missing p_ka on drill questions
  - `structure` (5): Drill 1 has terms (must be terms-free)
  - `surface-match` (11): v_sensei not matching jp text
- [x] **G2** — 24 issues [`particle-context`, `structure`, `surface-match`]
  - ~~`form-scope` (1): FIXED — polite_negative moved to N5.1~~
  - `particle-context` (1): Missing p_ka
  - `structure` (4): Drill 1 has terms
  - `surface-match` (15): char_rikizo, v_namae, v_hito not matching jp text
- [x] **G3** — 21 issues [`grammar-schema`, `particle-context`, `structure`, `surface-match`]
  - ~~`form-scope` (1): FIXED — polite_masu moved to N5.1~~
  - `grammar-schema` (5): Invalid color 'particle' in pattern chips
  - `particle-context` (3): Missing p_ka
  - `structure` (6): Drill 1 has terms
  - `surface-match` (4): v_haha, v_dare, v_sensei, v_tomodachi not matching jp text
- [x] **G4** — 20 issues [`grammar-schema`, `particle-context`, `structure`, `surface-match`]
  - ~~`form-scope` (5): FIXED — polite_masu moved to N5.1~~
  - `grammar-schema` (7): Invalid color 'particle' / 'time'
  - `particle-context` (1): Missing p_ka
  - `structure` (5): Drill 1 has terms
  - `surface-match` (12): v_sensei, v_getsuyoubi, v_kinyoubi, v_tomodachi + day-of-week kanji not matching
- [x] **G5** — 14 issues [`chip-order`, `grammar-schema`, `kanji-scope`, `structure`, `surface-match`]
  - `chip-order` (1): では pair
  - `grammar-schema` (3): Invalid color 'particle'
  - `kanji-scope` (2): Untaught kanji in jp text
  - `structure` (4): Drill 1 has terms
  - `surface-match` (2): v_kyou, v_tomodachi not matching
- [x] **G6** — 12 issues [`form-scope`, `kanji-scope`, `particle-context`, `structure`]
  - `form-scope` (3): p_dewa_then used in same lesson it's introduced (self-reference)
  - `kanji-scope` (2): Untaught kanji
  - `particle-context` (2): Missing p_ka
  - `structure` (2): Drill 1 has terms
- [x] **G7** — 20 issues [`chip-order`, `particle-context`, `structure`, `surface-match`]
  - `chip-order` (1): では pair
  - `particle-context` (3): Missing p_ka
  - `structure` (4): Drill 1 has terms
  - `surface-match` (9): v_kyou not matching jp text
- [x] **G8** — 33 issues [`chip-order`, `kanji-scope`, `particle-context`, `structure`, `surface-match`]
  - `chip-order` (1): には pair
  - `kanji-scope` (2): Untaught kanji
  - `particle-context` (8): Missing p_ka
  - `structure` (8): Drill 1 has terms
  - `surface-match` (11): v_kinou, v_eki not matching
- [x] **G9** — 32 issues [`form-scope`, `particle-context`, `structure`, `surface-match`]
  - `form-scope` (6): plain_desire_tai before G10
  - `particle-context` (9): Missing p_ka
  - `structure` (8): Drill 1 has terms
  - `surface-match` (5): v_nani, v_purezento not matching
- [x] **G10** — 29 issues [`form-scope`, `particle-context`, `structure`, `surface-match`]
  - `form-scope` (8): plain_desire_tai / p_ga_but in same lesson's conversations
  - `particle-context` (9): Missing p_ka
  - `structure` (5): Drill 1 has terms
  - `surface-match` (3): v_gaishoku, v_okane not matching
- [x] **G11** — 20 issues [`kanji-scope`, `particle-context`, `structure`, `surface-match`]
  - `kanji-scope` (2): Untaught kanji
  - `particle-context` (5): Missing p_ka
  - `structure` (5): Drill 1 has terms
  - `surface-match` (5): v_yama, v_kibun not matching
- [x] **G12** — 18 issues [`particle-context`, `structure`, `surface-match`]
  - `particle-context` (5): Missing p_ka
  - `structure` (6): Drill 1 has terms
  - `surface-match` (4): v_sora, v_kibun not matching

### 1c. Reviews (N5.Review.1–9, N5.Final.Review) — 176 issues across 10 files

- [ ] **N5.Review.1** — 16 issues [`surface-match`]
  - `surface-match` (15): v_chichi, v_sensei not matching jp text
- [ ] **N5.Review.2** — 11 issues [`surface-match`]
  - ~~`form-scope` (10): FIXED — polite_masu moved to N5.1~~
  - `surface-match` (9): v_kongetsu, v_konshuu not matching
- [ ] **N5.Review.3** — 16 issues [`chip-order`, `surface-match`]
  - `chip-order` (2): では, にも pairs
  - `surface-match` (13): v_kyou, v_mainichi not matching
- [ ] **N5.Review.4** — 9 issues [`chip-order`, `form-scope`, `surface-match`]
  - `chip-order` (1): へも pair
  - `form-scope` (1): plain_desire_tai before G10
  - `surface-match` (5): v_karee, v_purezento not matching
- [ ] **N5.Review.5** — 10 issues [`surface-match`]
  - `surface-match` (9): v_ninki, v_densha not matching
- [ ] **N5.Review.6** — 22 issues [`chip-order`, `particle-context`, `surface-match`, `suru-compound`]
  - `chip-order` (2): よね, だよ pairs
  - `particle-context` (1): Missing p_ka
  - `surface-match` (11): v_hana, v_mainichi not matching
  - `suru-compound` (6): v_manabu with conjugation forms
- [ ] **N5.Review.7** — 18 issues [`chip-order`, `surface-match`]
  - `chip-order` (3): のが, だよ pairs
  - `surface-match` (14): v_mainichi, v_denwa not matching
- [ ] **N5.Review.8** — 26 issues [`chip-order`, `particle-context`, `surface-match`]
  - `chip-order` (14): には pairs (location-heavy review)
  - `particle-context` (1): Missing p_ka
  - `surface-match` (9): v_gakkou, v_heta not matching
- [ ] **N5.Review.9** — 17 issues [`chip-order`, `surface-match`]
  - `chip-order` (1): のが pair
  - `surface-match` (15): v_gogo, v_shachou not matching
- [ ] **N5.Final.Review** — 21 issues [`chip-order`, `form-scope`, `surface-match`]
  - `chip-order` (2): のが pairs
  - `form-scope` (2): p_yori (N4.5), p_demo_but (G19) — out of scope
  - `surface-match` (15): v_kyou, v_nanji not matching

### 1d. Compose (compose.N5.1–compose.N5.18) — 2 issues across 2 files

- [x] compose.N5.1 — clean
- [x] compose.N5.2 — clean
- [x] compose.N5.3 — clean
- [x] compose.N5.4 — clean
- [x] compose.N5.5 — clean
- [x] compose.N5.6 — clean
- [x] compose.N5.7 — clean
- [x] compose.N5.8 — clean
- [x] compose.N5.9 — clean
- [x] compose.N5.10 — clean
- [x] compose.N5.11 — clean
- [ ] **compose.N5.12** — 1 issue [`compose`]
  - `compose`: prompts[3].targets[0] 'v_tesuto' has no kanji — scoring is kanji-based
- [x] compose.N5.13 — clean
- [x] compose.N5.14 — clean
- [x] compose.N5.15 — clean
- [ ] **compose.N5.16** — 1 issue [`compose`]
  - `compose`: prompts[4].targets[0] 'v_naru' has no kanji — scoring is kanji-based
- [x] compose.N5.17 — clean
- [x] compose.N5.18 — clean

### 1e. Stories (10 stories) — RESOLVED

~~All 10 stories had missing `meta.kanji`.~~ Fixed by exempting story `terms.json` files (detected via `storyFile` field) from FM #12 in `validate-structure.sh`. `meta.kanji` serves no functional purpose in stories — kanji scope is not enforced there — so adding it would have been dead data.

- [x] tanjoubi-no-keeki/terms.json
- [x] my-family/terms.json
- [x] kaisha-de-no-arubaito/terms.json
- [x] kyuujitsu-no-rikizo/terms.json
- [x] kita-minami-higashi-nishi/terms.json
- [x] rikizo-to-ookii-sakana/terms.json
- [x] ame-no-hi-no-gakkou/terms.json
- [x] kazoku-ga-kimasu/terms.json
- [x] yonde-kaite/terms.json
- [x] restoran-to-kaimono/terms.json

---

## Phase 1 Priority Order

Within each content type, fix files in this order based on impact:

1. **Batch fixes first** (stories meta.kanji, grammar Drill 1 terms removal, grammar-schema color fixes) — these are mechanical and can be scripted
2. **Lessons N5.1–N5.4** — heaviest form-scope + term-id issues (pre-N5.5 polite forms, k_* IDs)
3. **Lessons N5.10, N5.12, N5.17, N5.18** — register violations (need casual conversations added)
4. **Grammar G1–G4** — grammar-schema + form-scope + structure
5. **Remaining lessons** by issue count descending
6. **Reviews** by issue count descending
7. **Compose** (2 minor issues)

---

## Phase 2: Game Days (Day 2–Day 18)

Build the remaining 17 game days following the N5_GAME_ROADMAP.md spec.

**Key structural rules from the roadmap:**
- One game day per lesson (Day X = N5.X vocabulary/kanji)
- Days 1–4: house interior only (no outside world)
- Day 5: can leave the house (行/来/店/駅 unlocked)
- Day 9: can enter buildings (中/外 unlocked)
- Day 12: school appears (学/校 unlocked)
- Days 1–11: Golden Week vacation
- No combat in N5 — atmospheric horror only

### Game day build order
- [ ] Day 2 — first collectible item (水)
- [ ] Day 3 — money system introduced
- [ ] Day 4 — smartphone from Dad
- [ ] Day 5 — can leave the house (major milestone)
- [ ] Day 6
- [ ] Day 7
- [ ] Day 8
- [ ] Day 9 — can enter buildings (major milestone)
- [ ] Day 10 — 休み unlocks, Golden Week formalized
- [ ] Day 11
- [ ] Day 12 — school appears (major milestone)
- [ ] Day 13
- [ ] Day 14
- [ ] Day 15
- [ ] Day 16
- [ ] Day 17
- [ ] Day 18

## Open Questions

- [ ] Game day JSON schema — does GAME_SYSTEMS.md define the format, or do we need to design it from Day 1's structure?
- [ ] Art assets — which game days need new backgrounds/sprites? (Coordinate with RikizoArtPipeline.md)
- [ ] How much narrative scripting per day vs. free exploration?
- [x] ~~`form-scope`: polite_masu introducedIn~~ — **RESOLVED**: Moved polite_masu/mashita/negative/past_negative from N5.5 → N5.1. Cleared 7 files.
- [x] ~~`surface-match`: systemic kanji-vs-kana mismatches~~ — **RESOLVED**: Hook now falls back to glossary `reading` field when `surface` contains untaught kanji. Remaining surface-match failures are genuine content issues (character names in wrong form, Q&A question text not containing tagged terms).
