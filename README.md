# Handoff: Rikizo Japanese Lessons — Full App Redesign

## Overview

This is a complete visual and interaction redesign of the Rikizo Japanese Lessons web app — a gamified JLPT N5/N4 learning app currently embedded via Webflow. The redesign covers all 8 major screens: Home, Lessons, Grammar, Dojo (Practice), Compose, Stories, Review, and Adventure (placeholder).

The existing app lives in the `jp-lessons` GitHub repo (gryswynd/jp-lessons). It runs as vanilla JS modules loaded from GitHub raw CDN into a Webflow page via `webflow-embed.html`. The goal is to port this design into that environment — **not** to replace the underlying data pipeline, term modal, TTS, streak, unlock, or conjugation engines. Those stay. Only the rendering/UI layer changes.

## About the Design Files

The files in this bundle are **HTML design references** — high-fidelity React/JSX prototypes showing intended look and behavior. They use mock data. The task is to **recreate these designs in the existing `webflow-embed.html` / `Lesson.js` / `Grammar.js` / `Practice.js` / `Compose.js` / `Story.js` / `Review.js` environment**, using vanilla JS DOM rendering (the existing pattern) while preserving all existing data pipelines, `JPShared` modules, and Webflow integration.

## Fidelity

**High-fidelity.** Pixel-precise colors (defined as oklch CSS variables), typography, spacing, interactions, and motion. Recreate exactly.

---

## Design System

### Color Tokens (CSS custom properties — add to `:root`)

```css
:root {
  /* Base surfaces */
  --washi:     oklch(0.97 0.008 80);   /* warm off-white, primary bg */
  --washi-2:   oklch(0.94 0.012 75);   /* slightly darker washi */
  --washi-3:   oklch(0.90 0.015 75);   /* medium washi */

  /* Ink (text + dark UI) */
  --ink:       oklch(0.22 0.012 60);   /* near-black, primary text */
  --ink-2:     oklch(0.38 0.012 60);   /* secondary text */
  --ink-3:     oklch(0.55 0.012 60);   /* tertiary / disabled */

  /* Hairlines */
  --hairline:  oklch(0.22 0.012 60 / 0.12);
  --hairline-2:oklch(0.22 0.012 60 / 0.06);

  /* Accents */
  --vermilion: oklch(0.60 0.18 30);    /* primary action, CTAs, errors */
  --moss:      oklch(0.58 0.09 140);   /* grammar, compose, success */
  --indigo:    oklch(0.42 0.08 250);   /* grammar details, info */
  --gold:      oklch(0.78 0.10 85);    /* stories, review scores */

  /* Border radii */
  --r-sm: 8px;
  --r-md: 14px;
  --r-lg: 22px;
  --r-xl: 28px;
}
```

### Typography

```
UI text:        "Schibsted Grotesk", system-ui — weights 400/500/600/700
Japanese body:  "Noto Serif JP" — weights 400/500/600/700
Japanese UI:    "Noto Sans JP" — weights 400/500/700
Monospace meta: "JetBrains Mono" — weights 400/500
Handwriting:    "Caveat" — weights 500/600/700 (Notebook grammar variant only)
```

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@500;600;700&display=swap
```

### Paper background (used on all washi-base screens)

```css
.paper-bg {
  background:
    radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
    radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
    var(--washi);
}
```

### Hanko (red seal stamp) component

```css
.hanko {
  font-family: "Noto Serif JP", serif;
  font-weight: 700;
  color: #fff;
  background: var(--vermilion);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  box-shadow: 0 2px 0 oklch(0.45 0.18 30 / 0.4);
  position: relative;
}
.hanko::before {
  content: "";
  position: absolute;
  inset: 2px;
  border: 1px solid oklch(1 0 0 / 0.35);
  border-radius: 4px;
}
```

### Key animations

```css
@keyframes glossFadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes hanabiPop {
  0%   { opacity: 0; transform: scale(0.5); }
  20%  { opacity: 1; transform: scale(1.2); }
  80%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.1); }
}
```

---

## Screen 1 — Home Screen

**File:** `sections-top.jsx`, `sections-mid.jsx`, `sections-bottom.jsx`, `app.jsx`, `data.js`

**Replaces:** `renderMenu()` + `_buildStreakBar()` in `webflow-embed.html`

### Layout

Vertically scrollable, `max-width: 390px`, mobile-first. Fixed bottom tab bar (5 tabs). All padding `16–22px` horizontal.

### Sections (top to bottom)

**1. TopBar** — `height: 62px top padding + ~42px` — date meta label left, 3 icon buttons right (search, bell, gear). Each button `28×28px`, `border-radius: 8px`, `1px solid var(--hairline)`.

**2. Masthead** — JP greeting with furigana (`font-jp-display`, 26px, weight 500), vermilion comma, "Rikizo-san." subtitle (22px, ink-2). Hanko seal (44px, rotate −4°, kanji 力) top-right. Chapter subtitle below in italic 13px ink-3.

**3. Streak Card** — `margin: 0 16px`, `padding: 16px 18px`, `border-radius: var(--r-lg)`, `background: var(--ink)`, white text. Left: real belt PNG (`assets/ui/belt-*.png`, 62px wide). Center: streak count (32px bold), stage name (JP serif 13px), 14-day dot history (8×8px squares, `border-radius: 2px`, vermilion active). Right: best score, freeze count. Ghost kanji 続 (180px, opacity 4%) as background watermark.

**4. Section headers** — `padding: 22px 22px 10px`, flex row with JP serif label (13px, ink-2), hairline rule, mono meta right.

**5. Today Card** — `margin: 0 16px`, `border-radius: var(--r-xl)`, white background. Top strip: `background: var(--ink)`, vermilion "● Today's lesson" label, minutes mono right. Body: lesson JP (13px serif, ink-3), title (24px, weight 600), 3 stats (kanji count, terms, chapter), vermilion CTA button. Right: accent kanji square (96×96px, `background: var(--vermilion)`, 68px serif kanji). Dashed bottom section: kanji preview tiles (30px each).

**6. Resume Card** — `padding: 14px 18px`, bordered, flex row. Moss square icon, lesson title + subtitle, 4px InkBar progress, percentage.

**7. Practice Module Grid** — 2-column CSS grid, `gap: 8px`. Each cell: white, bordered, `border-top: 3px solid <accent-color>`. Kanji monogram (22px, accent color) top-right. Label (14px bold), JP sub (11px serif), streak dot + "N-day streak" mono.

**8. Level Progress** — `padding: 14px 18px`, bordered. Two inline progress rows (Lessons, Kanji) each with label, fraction, 4px ink bar.

**9. Cast Row** — horizontal scroll, `gap: 10px`. Each character: 48px circular portrait + JP name (10px serif) below. Rikizo has vermilion ring. Unseen characters at 35% opacity.

**10. Daily Challenge** — `padding: 16px 18px`, washi-2 bg. 58×58px kanji square (washi bg, bordered), label, reading · meaning, prompt text.

**11. Bottom Tab Bar** — `position: absolute; bottom: 34px`, blurred washi bg (`backdrop-filter: blur(14px)`), 5 tabs, SVG icons (22×22px), 10px label, vermilion 2px active indicator.

---

## Screen 2 — Lesson Player

**Files:** `lesson-a.jsx`, `lesson-b.jsx`, `lesson-data.js`

**Replaces:** `Lesson.js`

### Structure

Full-screen within the phone shell. Header (top) + scrollable body + footer (bottom). 8 section types rendered sequentially.

### Header
- `padding: 54px 18px 14px`, washi bg, bottom hairline
- Back (×) button (32px circle), lesson code in vermilion mono (10px), title (17px serif bold)
- Segmented progress rail: N segments, 3px height, ink=done, vermilion=current, hairline=future

### Footer
- `padding: 12px 16px 28px`, white bg, top hairline
- Back button (ghost pill) + Next button (full-width pill, `background: var(--ink)`)
- Next label shows upcoming section name at 55% opacity

### Section Panels

**Intro:** Ghost kanji (150px, washi-3) top-right. Section code mono, 34px serif title. 4-col kanji grid (filled first one black). Stats strip (3-col). Bullet list.

**Warmup:** Tap-to-reveal sentence cards. `border-radius: var(--r-md)`, white bg. JP serif (19px), hiragana reading (11.5px, ink-3). Reveal = dashed top border + 13px English. "Tap to reveal →" in vermilion mono before reveal.

**Kanji panel:** Horizontal tile strip (66×66px each, black=selected). Focus card: ghost kanji (220px) bg, sequential number (vermilion mono), 76px JP display, meaning (16px bold), 2-col on/kun grid, example sentence with reveal.

**Vocab list:** Grouped by category. Each row: play button (32px circle), JP word (20px serif), reading (11.5px sans), meaning (12.5px), counter mono right.

**Conversation:** Chat bubbles. Rikizo=right (ink bg, washi text, `border-radius: 16px 16px 3px 16px`). Others=left (washi bg, `border-radius: 16px 16px 16px 3px`). Character portrait (32px circle) at bubble base. EN toggle shows italic 11.5px below JP.

**Reading:** Tabbed passage switcher. Washi card with 3px vermilion left edge. Sentence-level EN reveal. Comprehension Q&A cards below (Q header + "Show answer" button).

**Drill (Fill-slot):** Prompt card showing before/after with dashed blank. 2×2 choice grid (26px serif kanji). Correct=moss, wrong=vermilion. Explanation card below.

**Close:** おつかれさま (60px serif), hanko (72px, 合), 3-col stats, kanji learned row, "Up next" prompt.

---

## Screen 3 — Grammar (Cards variant — preferred)

**Files:** `grammar-v2.jsx`, `grammar-atoms.jsx`, `grammar-data.js`

**Replaces:** `Grammar.js`

### Deck structure

Horizontally paginated card deck. Each card is full-width, full-height, individually scrollable.

**Deck order:**
1. Intro card
2–6. Rule cards (one per grammar rule)
7. Comparison card (standalone A/B toggle)
8. Reference table card
9–16. MCQ drill cards (one per question)
17. Score screen

### Header (dark ink)
- `padding: 54px 18px 14px`, `background: var(--ink)`
- ← Back, grammar code (vermilion mono), "Teaching/Practice/Results" phase label
- Progress rail below: 4px, vermilion fill, teaching/practice/count labels

### Intro card
Ghost 文 kanji (240px, ink 4%). Grammar code (vermilion mono), title (34px serif), focus text (14px italic). Stats strip (3-col: rules/minutes/XP). Why-it-matters paragraph. Numbered rule list with taglines. Unlock chip.

### Rule card
Ghost kanji (200px). Rule number + tagline (vermilion mono), label (30px serif), meaning (13px italic). Pattern box (washi-2 bg, compact chip chain). Explanation paragraph. Notes as bullet list. Examples with tap-for-gloss chunks.

**Gloss chunks:** Each word wrapped in a colored underline matching its role (verb=vermilion, modifier=indigo, predicate=moss, topic=gold). Tap → popover (dark bg, 11px: role label + gloss text, caret above).

### Comparison card
Two tabs (A/B). Header toggle with role-color bottom border. Active side: numbered points list + example block.

### Reference table card
Title (26px serif), description (13px italic). 3-col grid table: form label (vermilion mono) | 行く column | 食べる column. Alternating washi/washi-2 rows.

### MCQ drill card
Phase label + question counter (mono). Question in washi-2 card (17px serif). 4 choices (A/B/C/D), A–D letter in mono. Pick → lock all + reveal correct (moss bg) / wrong (vermilion bg). Explanation card (matching bg tint). Footer Next button locks until answered.

### Score screen
Dark ink full-bleed. Ghost 合 kanji. Hanko (合, 64px). Score percentage (56px, grade color). Grade letter. Form breakdown table. Patterns covered chips. Pass/fail message. Retry (if <75%) + Home buttons.

---

## Screen 4 — Dojo (Practice)

**Files:** `dojo-hub.jsx`, `dojo-quiz.jsx`, `dojo-vocab.jsx`, `dojo-conj.jsx`, `dojo-data.js`

**Replaces:** `Practice.js`

### Hub menu
Dark ink header. Ghost 道 kanji. Stats strip (Kanji/Vocab/Verbs/Flagged). Lesson selector button (mono, full-width). Category sections with kanji monogram header + divider. Mode rows: 44px icon square (accent color), label (14px bold), sub (11.5px ink-3), chevron.

### Kanji Flashcard
Dark header (streak number top-right). 3px vermilion progress rail. 260px flip card (CSS `transform-style: preserve-3d`, 0.55s cubic-bezier). Front: 110px kanji, "Tap to reveal" mono. Back: 64px kanji, 24px reading, 10px on-yomi, 18px meaning, context sentence. 3-grade buttons: Nope/Almost/Got it (ink bg = primary). Streak glow on card `box-shadow`. Hanabi celebration (CSS animation, `hanabiPop` keyframes) at streak milestones.

### MCQ Quiz
Dark header. Progress rail (indigo). 80px kanji in washi-2 card. 4 A–D choice buttons. Auto-advance 900ms after pick. Score screen: Hanko (完), percentage, retry/back.

### Vocab Flashcard
Same flip mechanic. Front: 58px word + reading + type badge (colored pill). Back: word/reading, 20px meaning, example sentence in washi-2 box.

### Conjugation Dojo

**Setup screen:** Verb class toggles (pill buttons, ink=active). Form list grouped by grammar lesson (G7/G8/G9 headers). Each form: checkbox visual (20px square) + label + G-lesson tag. Session length 10/20/30/All buttons. Start button with count.

**Drill screen:** Indigo progress rail. Prompt card: 68px verb (center), 16px reading, meaning, → form label + G-lesson tag, verb class badge, ⚠ false-ichidan warning where applicable. Text input (`font-family: Noto Sans JP`, 20px, 2px bordered, focus=indigo border). Go button. Correct: flash moss, 正解！, auto-advance 900ms. Wrong: char-level diff (green=ok, red=wrong, yellow=missing in 36×40px tiles), correct answer (28px serif), contextual hint (indigo tinted box), て-form helper toggle, Next button.

**Summary:** Dark ink. Percentage + grade. Per-form breakdown with inline bars. Mistakes list (top 5). Retry mistakes / New session / Back buttons.

---

## Screen 5 — Compose

**Files:** `compose-a.jsx`, `compose-b.jsx`

**Replaces:** `Compose.js`

### Menu
Dark ink header, ghost 作 kanji, moss accent. Stats (total/done/draft). Lesson cards: emoji icon, JP title (17px serif) + EN subtitle (12.5px italic), theme text, prompt/challenge count, status badge.

### Compose View

**Header (dark ink):** ← back, lesson code (moss mono), title (serif), Score button (moss pill).

**Progress rail:** 3px, moss color.

**Prompt strip** (washi-2 or warm-ochre for challenges): Numbered circle (moss or gold), prompt text + EN, example toggle. Right column of progress dots (one per prompt, 6px). Inline target chips (pill shape): unmet=washi/hairline, met=moss bg + white ✓. "Next prompt →" button appears when all met (moss bg, animated in). "完成！" completion banner when all done.

**Textarea:** `font-family: Noto Sans JP`, 18px, 1.8 line-height, `border-radius: var(--r-md)`, focus border=moss. Character count + targets met counter (mono, ink-3).

**Word Bank drawer** (collapsible, bottom): Tab bar (Words/Particles/Patterns). Word chips (washi-2, serif 15px). Particle chips (serif 17px bold). Pattern rows (label + example chips). Tap inserts at cursor.

**Score overlay:** Modal, `border-radius: var(--r-xl)`. Score out of 100, grade letter (gradeColor). 3 breakdown rows (prompts/targets/volume) each with fraction, description, 3px progress bar, points number. Close button.

---

## Screen 6 — Stories

**Files:** `story-a.jsx`, `story-b.jsx`

**Replaces:** `Story.js`

### Menu
Dark ink header, ghost 語 kanji, gold accent. Stats (total/read/unread/locked). Story cards: 44×44px status icon (gold=read ✓, ink=unread book, washi-3=locked 🔒), JP title (17px serif), EN subtitle italic, level badge + duration + lesson tags.

### Reader

**Header (dark ink):** ← back, level+lesson (gold mono), title (serif). EN toggle (gold pill when active). Play all / Stop button (34px circle, vermilion when playing).

**Progress rail:** 3px gold, updates on scroll.

**Story body:** Each paragraph in a `padding: 14px 16px` container. Highlight (washi-gold tint + gold border) when that paragraph's audio is playing. Paragraph number mono (top-right). JP text: 19px serif, 1.9 line-height. Below JP: "Show translation" mono link → reveals 13px italic EN with animation. Play button (26px circle) bottom-right of each paragraph.

**Vocabulary section:** Collapsible. Washi-2 header button with chevron. Table rows: 18px JP serif | 12px reading | 12.5px italic meaning.

**Grammar section:** Same collapsible pattern. Rows: 15px serif pattern (indigo) | 12.5px meaning.

---

## Screen 7 — Review

**Files:** `review-a.jsx`, `review-b.jsx`

**Replaces:** `Review.js`

### Menu
Dark ink header, ghost 習 kanji, vermilion accent. Stats (reviews/passed/avg score). Review cards: 48×48px grade badge (S/A/B/C/D in gradeColor, with % below, or lock icon, or star for new), title (14px bold), lessons + question count (mono). Final Review card has vermilion border.

**Grade colors:** S(≥95)/A(≥90)=moss, B(≥75)=indigo, C(≥60)=gold, D=vermilion.

### Intro screen
Ghost 習 (120px washi-3). Title + focus text. Section breakdown cards (washi-2, label + Q count). Question count + time estimate. Begin button (ink pill).

### Quiz header (dark ink)
← back, section name (vermilion mono), Q counter. Running correct count (moss, top-right). 3px vermilion progress rail.

### MCQ question
Passage/conversation block (washi-2, bordered): each line has speaker label (vermilion mono, 9.5px, 42px wide) + JP serif text (15px). Question: section label (mono), JP (18px serif bold), EN italic (12px). 4 A–D choices, same color logic as Grammar MCQ. Explanation card (tinted bg, correct/incorrect mono label).

### Reading question
Passage: washi-2 bg, 3px vermilion left border. Each line: 15px serif, 1.8 line-height. Question + choices same as MCQ.

### Scramble question
Answer box: `min-height: 60px`, dashed hairline border → solid on check. Chip pool below. Each chip: `padding: 10px 14px`, washi bg. Tap to add (moves to answer box), tap in-box to remove. Check button enables when `order.length === segments.length`. Color reveal: green=correct position, yellow=wrong position, red=distractor. Explanation block below.

### Score screen
Dark ink full-bleed. Hanko (習, 64px). Percentage (56px) + grade letter in gradeColor. Per-section breakdown: section name, `correct/total` (color-coded), 3px progress bar. Pass ≥60%: moss message. Fail: vermilion message. Retry / Back buttons.

---

## Screen 8 — Adventure (Placeholder)

**Files:** N/A — show a "coming soon" teaser screen.

The Adventure module is being built in Godot 4 for iOS/Android. On the web app, show:
- Dark ink header with ghost 険 kanji
- Title: "ぼうけん · Adventure"  
- Subtitle: "Coming to iOS & Android"
- The `assets/backgrounds/map.png` pixel art map at reduced opacity as a background
- A character portrait (rikizo_convo.png) centered
- Mono text: "N5 Game Days — 17 remaining" with progress
- "Notify me" CTA button (vermilion pill) — links to reminder settings

---

## Assets

All assets are in the `assets/` folder of this project:

| File | Used in |
|---|---|
| `assets/ui/belt-white.png` through `belt-black.png` | Home streak card |
| `assets/characters/rikizo_head.png` | Home, conversations |
| `assets/characters/sakura_head.png` | Conversations |
| `assets/characters/suzuki_head.png` | Conversations |
| `assets/characters/ken_head.png` | Conversations |
| `assets/characters/miki_head.png` | Cast row |
| `assets/characters/yuki_head.png` | Cast row |
| `assets/characters/yamamoto_head.png` | Cast row |
| `assets/backgrounds/map.png` | Adventure teaser |

Real app uses CDN URLs via `window.getAssetUrl(config, path)` — continue using that.

---

## Existing App Architecture Notes

- **Do NOT replace** `JPShared.*` — streak, unlock, progress, tts, termModal, textProcessor, stampSettings, reminderSettings all stay
- **Do NOT replace** the manifest/glossary/conjugation/counter data fetching
- Each module (`Lesson.js`, `Grammar.js`, etc.) has a `start(container, config, exitCallback)` pattern — preserve this interface
- `webflow-embed.html` `renderMenu()` and `_buildStreakBar()` are the highest-priority first changes — they're isolated and don't touch any shared module
- The existing purple gradient theme (`--primary: #4e54c8`, `--bg-grad: linear-gradient(135deg, #fdfbfb, #ebedee)`) is what's being replaced with the washi/ink/vermilion system described above

---

## Files in this Package

| File | Contents |
|---|---|
| `Home Screen.html` | Full prototype entry point — open this in browser |
| `styles.css` | Design token CSS (colors, typography, radii, animations) |
| `data.js` | Mock home screen data (streak, modules, cast, etc.) |
| `atoms.jsx` | Shared UI atoms (Hanko, MetaLabel, InkBar, Portrait, BeltBadge, etc.) |
| `sections-top.jsx` | Home: TopBar, Masthead, StreakCard |
| `sections-mid.jsx` | Home: TodayCard, ResumeCard, ModuleGrid |
| `sections-bottom.jsx` | Home: LevelStrip, CastRow, ChallengeCard, TabBar |
| `lesson-a.jsx` | Lesson player: header, footer, intro, warmup, kanji, vocab, convo |
| `lesson-b.jsx` | Lesson player: reading, drill, close panels |
| `lesson-data.js` | Mock lesson data (N5.9 shape) |
| `grammar-v2.jsx` | Grammar Cards variant (preferred) |
| `grammar-atoms.jsx` | Grammar shared: GlossChunk, ExampleBlock, PatternChain, ComparisonCard, FormsTable, MiniQuiz |
| `grammar-data.js` | Mock grammar data (G9 shape) |
| `dojo-hub.jsx` | Dojo hub menu + kanji flashcard + MCQ quiz |
| `dojo-quiz.jsx` | Dojo stubs + lesson picker |
| `dojo-vocab.jsx` | Vocab flashcard flow |
| `dojo-conj.jsx` | Conjugation Dojo (setup, drill, summary) |
| `dojo-data.js` | Mock dojo data |
| `compose-a.jsx` | Compose menu |
| `compose-b.jsx` | Compose view (textarea, word bank, score) |
| `story-a.jsx` | Story menu |
| `story-b.jsx` | Story reader (paragraphs, TTS, vocab/grammar sections) |
| `review-a.jsx` | Review menu |
| `review-b.jsx` | Review quiz (MCQ, scramble, reading, score) |
| `app.jsx` | Screen router + Tweaks panel |
| `ios-frame.jsx` | iOS device frame (prototype shell only — not needed in real app) |

---

## Implementation Priority

1. **Home screen menu + streak bar** — update `renderMenu()` and `_buildStreakBar()` in `webflow-embed.html`. Isolated, high-impact, zero risk to data pipeline.
2. **Lesson player** — port `Lesson.js` rendering to new design system. Keep all data fetching, term processing, unlock logic identical.
3. **Grammar** — port `Grammar.js`. Cards variant only.
4. **Dojo/Practice** — port `Practice.js`. Hub + flashcard + MCQ + conjugation dojo.
5. **Compose** — port `Compose.js`. Menu + compose view + word bank.
6. **Stories** — port `Story.js`. Menu + reader.
7. **Review** — port `Review.js`. Menu + MCQ + scramble + reading + score.
8. **Adventure teaser** — static screen in `webflow-embed.html`.
