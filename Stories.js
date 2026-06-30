/**
 * Stories.js — Consolidated story renderer
 *
 * Replaces Story.js + CustomStories.js. Reads `story.json` files (v2.0.0
 * schema documented in /Users/joel/.claude/plans/we-are-building-the-melodic-reddy.md).
 *
 * Public API:
 *   window.StoriesModule.start(container, config, exit, deepLinkId, opts)
 *     opts.category = 'curriculum' | 'custom' | undefined (undefined = both)
 *
 * Backwards-compatible aliases (one transition release):
 *   window.StoryModule.start(...)         → curriculum
 *   window.CustomStoriesModule.start(...) → custom
 *
 * Per-story features beyond the old MD path:
 *   - Per-paragraph English toggle (tap "EN" chip)
 *   - Global "Show all English" toggle in sticky header
 *   - End-of-story comprehension card (rendered when `questions[]` non-empty)
 *
 * Reuses existing JPShared helpers — no new dependencies:
 *   - JPShared.jpText.render({tokens})  : furigana / romaji renderer
 *   - JPShared.tts.speak / speakLines   : TTS
 *   - JPShared.termModal + window.JP_OPEN_TERM : term modal
 *   - JPShared.unlock.isStoryUnlocked   : story gating
 *   - JPShared.textProcessor (legacy)   : not used; tokens replace it
 */

window.StoriesModule = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let container = null;
  let config = null;
  let onExit = null;
  let storyList = [];           // all known stories (filtered by `opts.category`)
  let currentStory = null;      // currently loaded story.json
  let currentIndex = 0;         // position in storyList
  let pages = [];               // paginated pages of the current story
  let storyDoneMarked = false;  // guard so completion is persisted once per load
  let currentPage = 0;          // position within pages
  let isFlipping = false;       // guards re-entrant page flips
  let categoryOpt = null;       // 'curriculum' | 'custom' | null (both)
  let termMapData = {};         // id → term entry, for modal lookups
  let surfaceIdx = null;        // surface → entry, for runtime fallback
  let CONJUGATION_RULES = null; // loaded with glossaries; used by JP_OPEN_TERM
  let COUNTER_RULES = null;     // loaded with glossaries; resolves count_* chips
  let cameFromQuiz = false;      // true after jumping to a page FROM a question
  let _goToQuestionPage = null;  // reader hook (set in wireStoryEvents) for the quiz jump

  // Content page (1-based, matches the page-foot "i / N") that holds a paragraph.
  function paraIdxToPage(paraIdx) {
    const pp = (pages || []).findIndex(pg =>
      pg.segments && pg.segments.some(s => s.paraIdx === paraIdx));
    return pp >= 0 ? pp + 1 : 1;
  }

  // ── Comprehension-quiz answer persistence ─────────────────────────────────
  // Locked-in answers survive going back into the story (and an app close) so a
  // half-finished quiz resumes instead of being wiped. Device-local scratch —
  // NOT synced/imported (story completion persists separately via
  // unlock.recordStoryResult). One key per story; cleared on a fresh re-read of
  // a FINISHED quiz (see loadStory).
  function quizKey(id) { return 'k-story-quiz-' + id; }
  function loadQuizAnswers(id) {
    if (!id) return {};
    try { return JSON.parse(localStorage.getItem(quizKey(id)) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveQuizAnswer(id, qi, ans) {
    if (!id) return;
    try {
      const all = loadQuizAnswers(id);
      all[qi] = ans;
      localStorage.setItem(quizKey(id), JSON.stringify(all));
    } catch (e) {}
  }
  function clearQuizAnswers(id) {
    if (!id) return;
    try { localStorage.removeItem(quizKey(id)); } catch (e) {}
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function getCdnUrl(filepath) { return window.getAssetUrl(config, filepath); }

  function start(containerElement, repoConfig, exitCallback, deepLinkStoryId, opts) {
    container = containerElement;
    config = repoConfig;
    onExit = exitCallback;
    categoryOpt = (opts && opts.category) || null;
    injectStyles();
    initialize(deepLinkStoryId);
  }

  // ── Styles (lifted from Story.js, story-renderer-relevant subset) ───────
  function injectStyles() {
    if (document.getElementById('jp-stories-styles')) return;
    const style = document.createElement('style');
    style.id = 'jp-stories-styles';
    style.textContent = `
      .jp-story-container {
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
        background:
          radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
          radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
          oklch(0.97 0.008 80);
        overflow: hidden; width: 100%; margin: 0 auto; position: relative;
        min-height: 100vh; min-height: 100dvh;
        color: oklch(0.22 0.012 60);
      }
      .jp-story-header {
        background: oklch(0.22 0.012 60); color: white;
        padding: max(28px,env(safe-area-inset-top)) 18px 14px;
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: 10px;
        position: sticky; top: 0; z-index: 10;
        border-bottom: 1px solid oklch(1 0 0 / 0.1);
      }
      .jp-story-title { color: white; font-weight: 700; font-size: 1.1rem; flex: 1; min-width: 0; }
      .jp-story-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .jp-story-nav-btn, .jp-story-back-btn {
        background: rgba(255,255,255,0.1); color: white; border: none;
        padding: 8px 14px; border-radius: 6px; cursor: pointer;
        font-weight: 600; font-size: 14px; transition: background 0.2s;
      }
      @media (hover: hover) {
        .jp-story-nav-btn:hover, .jp-story-back-btn:hover { background: rgba(255,255,255,0.2); }
      }
      .jp-story-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

      .jp-story-paragraph {
        font-size: 1.15rem; line-height: 2.2;
        color: oklch(0.22 0.012 60);
        font-family: 'Noto Sans JP', sans-serif;
        margin: 0 0 1.4rem; padding: 0;
        position: relative;
      }
      .jp-term {
        color: #C2410C; font-weight: 700; cursor: pointer;
        border-bottom: 2px solid rgba(78,84,200,0.2);
        margin-right: 1px; transition: 0.2s;
      }
      @media (hover: hover) {
        .jp-term:hover { background: oklch(0.60 0.18 30 / 0.10); border-bottom-color: #C2410C; }
      }
      .jp-speak-sentence {
        background: none; border: none; color: oklch(0.45 0.012 60);
        cursor: pointer; padding: 2px 4px; opacity: 0.7; font-size: 0.95em;
        vertical-align: middle; margin-left: 4px;
      }
      @media (hover: hover) { .jp-speak-sentence:hover { opacity: 1; } }

      .jp-speak-all-btn {
        background: oklch(0.60 0.18 30 / 0.08);
        border: 1px solid oklch(0.60 0.18 30 / 0.22);
        color: oklch(0.52 0.18 30);
        padding: 8px 16px; border-radius: 20px; cursor: pointer;
        font-size: 0.85rem; font-weight: 600; transition: all 0.18s;
        display: inline-flex; align-items: center; gap: 6px;
        margin-bottom: 18px;
      }
      .jp-speak-all-btn.jp-speak-all-active {
        background: oklch(0.55 0.18 30 / 0.14); border-color: oklch(0.55 0.18 30 / 0.36);
      }

      .jp-story-end-card {
        margin-top: 28px; padding: 22px 20px;
        background: white;
        border: 1px solid oklch(0.22 0.012 60 / 0.10);
        border-radius: 16px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.05);
      }
      .jp-story-end-card h3 {
        margin: 0 0 16px; font-size: 1.05rem; color: #6E5A18;
        font-weight: 700; letter-spacing: -0.01em;
      }
      .jp-story-q {
        margin-bottom: 18px; padding-bottom: 18px;
        border-bottom: 1px solid oklch(0.22 0.012 60 / 0.08);
      }
      .jp-story-q:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .jp-story-q-text { font-weight: 600; font-size: 0.98rem; margin-bottom: 10px; }
      .jp-story-q-opt {
        display: block; width: 100%; text-align: left;
        background: oklch(0.94 0.012 75); border: 1px solid oklch(0.22 0.012 60 / 0.08);
        padding: 10px 14px; border-radius: 10px; cursor: pointer;
        font: inherit; color: inherit; margin-bottom: 6px;
        transition: background 0.15s, border-color 0.15s;
      }
      @media (hover: hover) { .jp-story-q-opt:hover { background: oklch(0.94 0.012 75 / 0.7); } }
      .jp-story-q-opt.correct { background: oklch(0.58 0.09 140 / 0.14); border-color: #5E8C5F; color: #3A5A3C; }
      .jp-story-q-opt.wrong   { background: oklch(0.60 0.18 30 / 0.10); border-color: #C2410C; color: #9A3412; }
      .jp-story-q-opt:disabled { cursor: default; }
      .jp-story-q-explain {
        margin-top: 8px; font-size: 0.85rem; font-style: italic;
        color: oklch(0.32 0.012 60); padding-left: 4px;
      }
      .jp-story-q-en {
        font-size: 0.8rem; color: oklch(0.5 0.012 60); font-style: italic;
        margin: -4px 0 10px;
      }
      /* "Go to page" link under a question — jumps to the relevant passage. */
      .jp-story-q-goto {
        display: inline-block; margin: 0 0 10px; padding: 5px 12px;
        background: transparent; border: 1px solid oklch(0.22 0.012 60 / 0.18);
        border-radius: 999px; color: #6E5A18; font: inherit; font-size: 0.78rem;
        font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .jp-story-q-goto:active { background: oklch(0.60 0.18 30 / 0.08); }
      /* Floating "← Questions" return button, shown after jumping from a question. */
      .jp-back-to-q {
        position: absolute; left: 50%; transform: translateX(-50%);
        bottom: calc(100% + 8px); white-space: nowrap;
        padding: 9px 18px; border: none; border-radius: 999px;
        background: var(--vermilion, #c2410c); color: #fff;
        font: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.28); z-index: 5;
      }
      .jp-back-to-q[hidden] { display: none; }
      .jp-story-q-input {
        display: block; width: 100%; box-sizing: border-box;
        background: oklch(0.97 0.008 80); border: 1px solid oklch(0.22 0.012 60 / 0.14);
        padding: 10px 12px; border-radius: 10px; font: inherit; color: inherit;
        min-height: 46px; resize: vertical; line-height: 1.6;
      }
      .jp-story-q-input:focus { outline: none; border-color: #6E5A18; }
      .jp-story-q-input.correct { border-color: #5E8C5F; background: oklch(0.58 0.09 140 / 0.10); }
      .jp-story-q-input.wrong   { border-color: #C2410C; background: oklch(0.60 0.18 30 / 0.08); }
      .jp-story-q-input:disabled { cursor: default; opacity: 1; }
      .jp-story-q-check {
        margin-top: 8px; padding: 8px 18px;
        background: oklch(0.22 0.012 60); color: white;
        border: none; border-radius: 999px; font: inherit; font-weight: 700;
        cursor: pointer;
      }
      .jp-story-q-check:disabled { opacity: 0.4; cursor: default; }
      .jp-story-q-model {
        margin-top: 10px; font-size: 0.9rem; padding-left: 4px;
      }
      .jp-story-q-model .jp-story-q-model-label {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; color: #6E5A18; margin-right: 6px;
      }
      .jp-story-end-cta {
        margin-top: 18px; padding: 12px 20px;
        background: oklch(0.22 0.012 60); color: white;
        border: none; border-radius: 999px; font: inherit; font-weight: 700;
        cursor: pointer; width: 100%;
      }

      /* Comprehension quiz overlay — a normal scrollable panel over the reader
         (the quiz is NOT a flip page; see openQuiz()). */
      .jp-quiz-overlay {
        position: absolute; inset: 0; z-index: 40;
        display: flex; flex-direction: column;
        background: oklch(0.97 0.008 80);
        animation: jpReaderIn 0.25s ease;
      }
      .jp-quiz-overlay-bar {
        flex: 0 0 auto; display: flex; align-items: center; gap: 12px;
        padding: max(14px, env(safe-area-inset-top)) 16px 12px;
        background: oklch(0.22 0.012 60); color: white;
        position: sticky; top: 0; z-index: 1;
      }
      .jp-quiz-overlay-title {
        font-weight: 700; font-size: 1rem; color: white;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .jp-quiz-overlay-scroll {
        flex: 1 1 auto; min-height: 0; overflow-y: auto;
        -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
        padding: 18px 18px max(28px, env(safe-area-inset-bottom));
      }
      /* Inside the overlay the end-card is the content, not a floating card. */
      .jp-quiz-overlay-scroll .jp-story-end-card { margin-top: 0; }

      .jp-story-loading { text-align: center; padding: 60px 20px; color: oklch(0.55 0.012 60); }
      .jp-story-loading-spinner {
        display: inline-block; width: 40px; height: 40px;
        border: 4px solid oklch(0.22 0.012 60 / 0.15);
        border-top-color: oklch(0.60 0.18 30);
        border-radius: 50%; animation: jpStoriesSpin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes jpStoriesSpin { to { transform: rotate(360deg); } }
      .jp-story-error {
        background: oklch(0.97 0.008 80); border: 1px solid oklch(0.60 0.18 30 / 0.4);
        color: oklch(0.52 0.18 30); padding: 20px; margin: 18px;
        border-radius: 14px; text-align: center;
      }

      .jp-story-level-back-btn {
        background: transparent; border: none; color: #9A7B1F; font-weight: 700;
        cursor: pointer; padding: 0 0 12px; font-size: 0.9rem; display: block; font-family: inherit;
      }
      @media (hover: hover) { .jp-story-level-back-btn:hover { text-decoration: underline; } }

      @media (max-width: 600px) {
        .jp-story-header { flex-direction: column; align-items: stretch; }
        .jp-story-nav { justify-content: center; }
      }

      /* ── Bookshelves (level selector) ─────────────────────────────────── */
      .jp-shelf-wrap { padding: 18px 16px 40px; }
      .jp-shelf-wrap > h2 { color: #9A7B1F; font-size: 1.3rem; font-weight: 800; margin: 4px 4px 4px; }
      .jp-shelf-wrap > p { color: oklch(0.45 0.012 60); font-size: 0.9rem; margin: 0 4px 22px; }
      .jp-shelf {
        margin: 0 0 26px; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .jp-shelf-label {
        font-size: 0.95rem; font-weight: 800; color: oklch(0.30 0.012 60);
        margin: 0 2px 8px; display: flex; align-items: baseline; gap: 8px;
      }
      .jp-shelf-label .jp-shelf-count {
        font-size: 0.72rem; font-weight: 700; color: oklch(0.55 0.012 60);
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .jp-shelf-books {
        display: flex; align-items: flex-end; gap: 5px;
        min-height: 132px; padding: 0 10px;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
      }
      .jp-spine {
        height: 124px; flex: 0 0 auto; border-radius: 3px 4px 4px 3px;
        box-shadow: inset -6px 0 10px rgba(0,0,0,0.22), inset 2px 0 3px rgba(255,255,255,0.18),
                    0 4px 8px rgba(0,0,0,0.18);
        display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.95); position: relative;
        transition: transform 0.18s ease;
      }
      .jp-spine::before {
        content: ''; position: absolute; left: 3px; top: 6px; bottom: 6px; width: 2px;
        background: rgba(255,255,255,0.20); border-radius: 2px;
      }
      .jp-spine-title {
        writing-mode: vertical-rl; text-orientation: mixed;
        font-family: 'Noto Serif JP','Shippori Mincho',serif;
        font-size: 0.74rem; font-weight: 600; line-height: 1.1;
        max-height: 104px; overflow: hidden; white-space: nowrap;
        letter-spacing: 0.02em; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      @media (hover: hover) { .jp-shelf:hover .jp-spine { transform: translateY(-4px); } }
      .jp-shelf-plank {
        height: 14px; margin-top: -2px; border-radius: 0 0 5px 5px;
        background: linear-gradient(oklch(0.52 0.05 60), oklch(0.40 0.05 55));
        box-shadow: 0 6px 12px rgba(0,0,0,0.22);
      }

      /* ── Book covers (story list within a shelf) ──────────────────────── */
      .jp-covers-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 20px 16px; padding: 6px 2px;
      }
      /* Cover = a leaf (face) over a page; the face swings open on its spine to
         reveal the page beneath, then the reader loads. perspective is on the
         cover (parent of the rotating face) so the open reads as real 3D. */
      .jp-book-cover {
        position: relative; aspect-ratio: 3 / 4; cursor: pointer;
        perspective: 900px; -webkit-perspective: 900px;
        -webkit-tap-highlight-color: transparent;
      }
      .jp-book-cover-page {
        position: absolute; inset: 0; border-radius: 4px 8px 8px 4px;
        background: oklch(0.985 0.01 85);
        box-shadow: inset 6px 0 10px rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.14);
      }
      .jp-book-cover-face {
        position: absolute; inset: 0; border-radius: 4px 8px 8px 4px;
        padding: 16px 14px 16px 20px; color: rgba(255,255,255,0.97);
        display: flex; flex-direction: column; justify-content: flex-start;
        box-shadow: inset 7px 0 12px rgba(0,0,0,0.28), inset -2px 0 4px rgba(255,255,255,0.12),
                    0 6px 14px rgba(0,0,0,0.22);
        transform-origin: left center; transform-style: preserve-3d;
        -webkit-backface-visibility: hidden; backface-visibility: hidden;
        transition: transform 0.5s cubic-bezier(.4,.05,.2,1), box-shadow 0.2s;
      }
      .jp-book-cover-face::before {
        content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 2px;
        background: rgba(255,255,255,0.22); border-radius: 2px;
      }
      @media (hover: hover) { .jp-book-cover:hover .jp-book-cover-face { transform: translateY(-4px); } }
      .jp-book-cover.jp-opening .jp-book-cover-face { transform: rotateY(-158deg); box-shadow: 0 10px 26px rgba(0,0,0,0.3); }
      .jp-book-cover-title {
        font-family: 'Noto Serif JP','Shippori Mincho',serif;
        font-size: 1.05rem; font-weight: 700; line-height: 1.4;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      .jp-book-cover-en {
        margin-top: auto; font-size: 0.78rem; font-weight: 500;
        color: rgba(255,255,255,0.85); line-height: 1.3;
      }
      .jp-book-cover-badge {
        position: absolute; top: 10px; right: 10px;
        background: rgba(0,0,0,0.28); color: white; font-size: 0.6rem; font-weight: 700;
        padding: 2px 7px; border-radius: 8px; letter-spacing: 0.05em;
      }
      /* Completion stamp on a shelf cover (bottom-right, like the Map node stamp). */
      .jp-book-cover-stamp {
        position: absolute; right: 8px; bottom: 8px; width: 30px; height: 30px;
        border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); object-fit: cover;
        background: var(--washi, #f3ece0); box-shadow: 0 1px 4px rgba(0,0,0,0.28);
        transform: rotate(-8deg); z-index: 2;
      }
      .jp-book-cover-stamp.jp-stamp-fallback {
        display: flex; align-items: center; justify-content: center;
        background: var(--moss, #5E8C5F); color: #fff; font-weight: 800; font-size: 15px;
      }

      /* ── Paged book reader ────────────────────────────────────────────── */
      .jp-story-container.jp-reading {
        height: 100dvh; min-height: 100dvh; display: flex; flex-direction: column;
        animation: jpReaderIn 0.3s ease;
      }
      @keyframes jpReaderIn { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
      /* The reader title is long; always stack it ABOVE the controls (own row,
         full-width + readable) with the controls in a row below — at every width
         and orientation. Otherwise a wide nav squeezes the title into a tall
         per-character column that pushes the book off-screen. */
      .jp-reading .jp-story-header { position: static; flex-direction: column; align-items: stretch; gap: 8px; }
      .jp-reading .jp-story-nav { justify-content: flex-start; }
      .jp-book {
        flex: 1 1 auto; min-height: 0; padding: 16px 14px 0;
        display: flex; flex-direction: column;
      }
      /* The FRAME clips + styles the book. It is an ANCESTOR of the perspective
         element, so its overflow:hidden does NOT flatten the page turn — the
         WebKit bug only triggers when perspective + overflow share one element. */
      .jp-book-frame {
        position: relative; flex: 1 1 auto; min-height: 0;
        overflow: hidden; border-radius: 6px 10px 10px 6px;
        background: oklch(0.985 0.01 85);
        box-shadow: inset 9px 0 16px rgba(0,0,0,0.06), 0 8px 22px rgba(0,0,0,0.12);
        border: 1px solid oklch(0.22 0.012 60 / 0.08);
      }
      /* Each page is an absolutely-positioned leaf; the spine-edge transform-origin
         + preserve-3d let it rotate like a real page turn (animation in flipTo()). */
      .jp-page {
        position: absolute; inset: 0; transform-origin: left center;
        transform-style: preserve-3d; -webkit-transform-style: preserve-3d;
      }
      .jp-page--incoming { z-index: 0; }
      .jp-page--current { z-index: 1; }
      .jp-page { transition: opacity 0.18s ease; }
      /* Reader mount fills the book frame and holds the 3D perspective for the
         button-driven CSS leaf-flip. Perspective lives here (NOT on .jp-book-frame,
         which owns overflow) so the WebKit perspective+overflow bug never triggers. */
      .jp-flip-book { width: 100%; height: 100%; position: relative;
        perspective: 1500px; -webkit-perspective: 1500px; }
      .jp-flip-page { width: 100%; height: 100%; background: oklch(0.985 0.01 85);
        display: flex; flex-direction: column; overflow: hidden; -webkit-tap-highlight-color: transparent; }
      /* Scrollable page body. StPageFlip forces display:block inline on the visible
         page, which kills any flex-based height bounding — so the scroll region is
         absolutely positioned to fill the (position:absolute) page, giving it a
         definite height no matter the page's display. Long text now scrolls;
         horizontal swipe still flips (the lib only flips on horizontal drags). */
      .jp-page-scroll {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y;
        padding: 26px 22px 18px; box-sizing: border-box;
        scrollbar-width: thin; scrollbar-color: rgba(80,70,60,0.35) transparent;
      }
      .jp-page-scroll::-webkit-scrollbar { width: 6px; }
      .jp-page-scroll::-webkit-scrollbar-thumb {
        background: rgba(80,70,60,0.32); border-radius: 3px;
      }
      /* The closed book's hard cover (page 0). Color is on .jp-flip-cover-fill
         (an inner element) because StPageFlip overwrites the page's own style. */
      .jp-flip-cover { position: relative; }
      .jp-flip-cover-fill { position: absolute; inset: 0; box-sizing: border-box;
        display: flex; flex-direction: column; justify-content: flex-start;
        padding: 30px 26px 26px 38px; color: rgba(255,255,255,0.97);
        box-shadow: inset 9px 0 16px rgba(0,0,0,0.30), inset -2px 0 4px rgba(255,255,255,0.12); }
      .jp-flip-cover-fill::before { content: ''; position: absolute; left: 9px; top: 14px; bottom: 14px;
        width: 3px; background: rgba(255,255,255,0.22); border-radius: 2px; }
      .jp-flip-cover-badge { position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.28);
        color: #fff; font-size: 0.62rem; font-weight: 700; padding: 3px 9px; border-radius: 8px;
        letter-spacing: 0.05em; font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif; }
      .jp-flip-cover-title { font-family: 'Noto Serif JP','Shippori Mincho',serif; font-size: 1.6rem;
        font-weight: 700; line-height: 1.4; text-shadow: 0 1px 3px rgba(0,0,0,0.32); }
      .jp-flip-cover-sub { margin-top: auto; font-size: 0.85rem; color: rgba(255,255,255,0.85); }
      .jp-flip-cover-score {
        margin-top: 12px; align-self: flex-start; font-size: 0.8rem; font-weight: 700;
        letter-spacing: 0.04em; color: #fff; background: rgba(0,0,0,0.26);
        padding: 4px 12px; border-radius: 999px;
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
      }
      .jp-flip-cover-stamp {
        position: absolute; right: 18px; bottom: 18px; width: 56px; height: 56px;
        border-radius: 50%; border: 3px solid rgba(255,255,255,0.92); object-fit: cover;
        background: var(--washi, #f3ece0); box-shadow: 0 2px 8px rgba(0,0,0,0.30);
        transform: rotate(-8deg);
      }
      .jp-flip-cover-stamp.jp-stamp-fallback {
        display: flex; align-items: center; justify-content: center;
        background: var(--moss, #5E8C5F); color: #fff; font-weight: 800; font-size: 26px;
      }
      .jp-page-face, .jp-page-back {
        position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden;
        -webkit-backface-visibility: hidden; backface-visibility: hidden;
        background: oklch(0.985 0.01 85);
      }
      .jp-page-back {
        transform: rotateY(180deg);
        background: linear-gradient(90deg, rgba(0,0,0,0.10), transparent 22%), oklch(0.975 0.012 85);
      }
      /* Lifting shadow on the turning leaf's front for depth (gone past 90°). */
      .jp-page-face::after {
        content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0;
        background: linear-gradient(90deg, rgba(0,0,0,0.30), rgba(0,0,0,0.06) 32%, transparent 56%);
        transition: opacity 0.22s ease;
      }
      .jp-page.jp-flipping { z-index: 3; will-change: transform;
        transition: transform 520ms cubic-bezier(.32,.04,.22,1); }
      .jp-page.jp-flipping .jp-page-face::after { opacity: 1; }
      .jp-page.jp-flip-fwd-end { transform: rotateY(-180deg); }
      .jp-page.jp-flip-back-start { transform: rotateY(-180deg); }
      /* Content block; height + scrolling are owned by the .jp-page-scroll wrapper
         (padding moved there so it isn't double-applied). */
      .jp-page-inner { min-height: 0; }
      .jp-page-inner .jp-story-paragraph:last-child { margin-bottom: 0; }
      .jp-page-en {
        border-top: 1px dashed oklch(0.22 0.012 60 / 0.18);
        padding: 14px 22px 16px; font-size: 0.95rem; line-height: 1.6;
        color: oklch(0.34 0.012 60);
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
        background: oklch(0.97 0.012 80);
      }
      .jp-page-foot {
        text-align: center; font-size: 0.72rem; color: oklch(0.55 0.012 60);
        padding: 6px 0 4px; font-variant-numeric: tabular-nums;
      }
      .jp-book-controls {
        position: relative; /* anchors the floating "← Questions" button */
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 12px 6px max(12px, env(safe-area-inset-bottom));
      }
      .jp-book-controls-mid { display: flex; align-items: center; gap: 8px; }
      .jp-book-controls .jp-speak-all-btn { margin-bottom: 0; padding: 8px 14px; }
      .jp-page-btn {
        background: oklch(0.22 0.012 60); color: white; border: none;
        padding: 10px 18px; border-radius: 999px; font: inherit; font-weight: 700;
        font-size: 0.9rem; cursor: pointer; transition: opacity 0.15s;
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
      }
      .jp-page-btn:disabled { opacity: 0.32; cursor: not-allowed; }
      .jp-page-en-toggle {
        background: oklch(0.60 0.18 30 / 0.08); border: 1px solid oklch(0.60 0.18 30 / 0.24);
        color: oklch(0.52 0.18 30); padding: 8px 14px; border-radius: 999px;
        font: inherit; font-weight: 700; font-size: 0.8rem; cursor: pointer;
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
      }
      .jp-page-en-toggle.jp-en-on { background: oklch(0.55 0.18 30 / 0.16); }

      @media (prefers-reduced-motion: reduce) {
        .jp-page.jp-flipping { transition: none; }
        .jp-book-cover-face { transition: none; }
        .jp-story-container.jp-reading { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Resource loading ─────────────────────────────────────────────────────
  async function initialize(deepLinkStoryId) {
    container.innerHTML = '<div class="jp-story-container"><div class="jp-story-loading"><div class="jp-story-loading-spinner"></div>Loading stories…</div></div>';
    try {
      const manifest = await window.getManifest(config);
      await loadGlossariesAndCharacters(manifest);
      if (!categoryOpt || categoryOpt === 'custom') await syncServerStories();
      buildStoryList(manifest);
      if (deepLinkStoryId) {
        const idx = storyList.findIndex(s => s.id === deepLinkStoryId);
        if (idx >= 0) { currentIndex = idx; return loadStory(storyList[idx]); }
      }
      renderSelector();
    } catch (err) {
      console.error('[Stories] init error:', err);
      container.innerHTML = `<div class="jp-story-container"><div class="jp-story-error"><strong>Failed to load stories</strong><br>${(err && err.message) || err}</div></div>`;
    }
  }

  async function loadGlossariesAndCharacters(manifest) {
    const bust = '?t=' + Date.now();
    const particleUrl = getCdnUrl(manifest.shared.particles);
    const characterUrl = getCdnUrl(manifest.shared.characters);
    const conjUrl = getCdnUrl(manifest.globalFiles.conjugationRules);
    const counterUrl = manifest.globalFiles.counterRules ? getCdnUrl(manifest.globalFiles.counterRules) : null;
    const levelGlossaryUrls = (manifest.levels || []).map(lvl => getCdnUrl(manifest.data[lvl].glossary));
    const loanwordUrl = manifest.shared.loanwords ? getCdnUrl(manifest.shared.loanwords) : null;
    const originsUrl = manifest.shared.loanwordOrigins ? getCdnUrl(manifest.shared.loanwordOrigins) : null;

    const [conjRules, counterRules, particles, characters, loanwordData, originsData, ...glossaries] = await Promise.all([
      fetch(conjUrl + bust).then(r => r.json()),
      counterUrl ? fetch(counterUrl + bust).then(r => r.json()) : Promise.resolve(null),
      fetch(particleUrl + bust).then(r => r.json()),
      fetch(characterUrl + bust).then(r => r.json()),
      loanwordUrl ? fetch(loanwordUrl + bust).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      originsUrl ? fetch(originsUrl + bust).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      ...levelGlossaryUrls.map(u => fetch(u + bust).then(r => r.json()))
    ]);
    CONJUGATION_RULES = conjRules;
    COUNTER_RULES = counterRules;

    termMapData = {};
    surfaceIdx = new Map();
    for (const g of glossaries) {
      for (const e of (g.entries || [])) {
        if (e.id) termMapData[e.id] = e;
        if (e.surface && !surfaceIdx.has(e.surface)) surfaceIdx.set(e.surface, e);
        // ALSO index by reading so kana-form spellings of kanji words (わたし
        // for 私, かぞく for 家族) get tagged via the renderer.
        if (e.reading && e.reading !== e.surface && !surfaceIdx.has(e.reading)) {
          surfaceIdx.set(e.reading, e);
        }
      }
    }
    for (const p of (particles.particles || [])) {
      termMapData[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', tokens: p.tokens };
      if (p.particle && !surfaceIdx.has(p.particle)) surfaceIdx.set(p.particle, termMapData[p.id]);
    }
    for (const c of (characters.characters || [])) {
      termMapData[c.id] = Object.assign({}, c, { portraitUrl: getCdnUrl(c.portrait) });
      // Index every kana spelling variant so prose mentions get tagged (e.g.
      // char_ken has surface=けん plus matches=['ケン']).
      const variants = new Set();
      if (c.surface) variants.add(c.surface);
      if (c.name) variants.add(c.name);
      if (Array.isArray(c.matches)) for (const m of c.matches) variants.add(m);
      for (const k of variants) {
        if (k && !surfaceIdx.has(k)) surfaceIdx.set(k, termMapData[c.id]);
      }
    }
    // Always-allowed loanword pool — folded into BOTH maps so bare loanword
    // tokens in prose ({k:"コンサート"} with no g) chip via surfaceIdx AND the
    // modal resolves them by id. (Migrated out of the leveled glossaries.)
    for (const w of ((loanwordData && loanwordData.loanwords) || [])) {
      const e = Object.assign({ type: 'loanword' }, w);
      if (e.id) termMapData[e.id] = e;
      if (e.surface && !surfaceIdx.has(e.surface)) surfaceIdx.set(e.surface, e);
      if (e.reading && e.reading !== e.surface && !surfaceIdx.has(e.reading)) surfaceIdx.set(e.reading, e);
    }
    if (window.JPShared && window.JPShared.termModal) {
      window.JPShared.termModal.setTermMap(termMapData);
      if (window.JPShared.termModal.setOriginMap) window.JPShared.termModal.setOriginMap((originsData && originsData.origins) || {});
      window.JPShared.termModal.inject();
      // Custom JP_OPEN_TERM that supports flagging (port of old Story.js).
      window.JP_OPEN_TERM = function (id, form, enableFlag) {
        if (typeof form === 'boolean') { enableFlag = form; form = null; }
        let termId = id;
        // Counter chips (七つ → count_7_tsu, 三本 → count_3_hon) aren't enumerated
        // in the glossary — re-derive the term on demand via the counter engine
        // and cache it, mirroring the conjugation path below.
        const countMatch = /^count_(\d+)_(.+)$/.exec(id);
        if (countMatch && !termMapData[id] && COUNTER_RULES &&
            window.JPShared.counterEngine && window.JPShared.counterEngine.buildCounterTerm) {
          const ct = window.JPShared.counterEngine.buildCounterTerm(countMatch[2], parseInt(countMatch[1], 10), COUNTER_RULES);
          if (ct) termMapData[ct.id] = Object.assign({ type: 'counter' }, ct);
        }
        if (form && CONJUGATION_RULES) {
          const conjugatedId = id + '_' + form;
          if (!termMapData[conjugatedId]) {
            const rootTerm = termMapData[id];
            if (rootTerm && window.JPShared.textProcessor) {
              const conj = window.JPShared.textProcessor.conjugate(rootTerm, form, CONJUGATION_RULES);
              if (conj) termMapData[conj.id] = conj;
            }
          }
          termId = termMapData[conjugatedId] ? conjugatedId : id;
        }
        window.JPShared.termModal.open(termId, {
          enableFlag: !!enableFlag,
          onFlag: function (flaggedId, msgBox) {
            if (window.JPShared.progress && !window.JPShared.progress.getFlagCount(id)) {
              window.JPShared.progress.flagTerm(id);
              if (msgBox) {
                msgBox.style.display = 'block';
                setTimeout(function () { msgBox.style.display = 'none'; }, 2000);
              }
            } else if (msgBox) {
              msgBox.style.display = 'none';
            }
          }
        });
      };
    }
  }

  // Pull the user's server-generated stories into the local cache so they appear
  // in Custom even if the builder's poll didn't cache them (e.g. the user left
  // mid-generation). Best-effort: silent if offline / not signed in.
  function deletedUserStoryIds() {
    try { const a = JSON.parse(localStorage.getItem('k-user-stories-deleted') || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  // Drop a server-generated story from the device: clear its cache + index and
  // remember it as deleted so syncServerStories won't re-add it. (The server copy
  // is left orphaned for now — harmless; a true server delete can come later.)
  function deleteUserStory(id) {
    try {
      const del = deletedUserStoryIds();
      if (del.indexOf(id) < 0) del.push(id);
      localStorage.setItem('k-user-stories-deleted', JSON.stringify(del));
      localStorage.removeItem('k-user-story-' + id);
      let idx = []; try { idx = JSON.parse(localStorage.getItem('k-user-stories') || '[]'); } catch (e) {}
      idx = (Array.isArray(idx) ? idx : []).filter(m => m && m.id !== id);
      localStorage.setItem('k-user-stories', JSON.stringify(idx));
    } catch (e) {}
    storyList = storyList.filter(s => s.id !== id);
  }

  async function syncServerStories() {
    const sg = window.JPShared && window.JPShared.storyGen;
    if (!sg || !sg.isConfigured || !sg.isConfigured() || !sg.isSignedIn || !sg.isSignedIn()) return;
    let list;
    try { list = (await sg.list()).stories || []; } catch (e) { return; }
    let index = [];
    try { index = JSON.parse(localStorage.getItem('k-user-stories') || '[]'); } catch (e) {}
    if (!Array.isArray(index)) index = [];
    const deleted = deletedUserStoryIds();
    const have = {}; index.forEach(m => { if (m && m.id) have[m.id] = true; });
    for (const meta of list) {
      if (!meta || !meta.id) continue;
      if (deleted.indexOf(meta.id) >= 0) continue;     // user deleted it locally
      const bodyKey = 'k-user-story-' + meta.id;
      let cached = null;
      try { cached = localStorage.getItem(bodyKey); } catch (e) {}
      if (!cached) {
        try {
          const r = await sg.getStory(meta.id);
          if (r && r.story) localStorage.setItem(bodyKey, JSON.stringify(r.story));
        } catch (e) { continue; }
      }
      if (!have[meta.id]) {
        index.unshift({ id: meta.id, title: meta.title, englishTitle: meta.englishTitle, createdAt: meta.createdAt || Date.now(), sharedBy: meta.sharedBy || null });
        have[meta.id] = true;
      }
    }
    try { localStorage.setItem('k-user-stories', JSON.stringify(index)); } catch (e) {}
  }

  // Server-generated stories the user owns, cached locally by CustomStoryBuilder
  // (index in k-user-stories, full body in k-user-story-<id>). Rendered in the
  // custom category; loadStory uses the in-memory _body (no fetch).
  function readUserStories() {
    let index = [];
    try { index = JSON.parse(localStorage.getItem('k-user-stories') || '[]'); } catch (e) {}
    const deleted = deletedUserStoryIds();
    const out = [];
    for (const meta of (Array.isArray(index) ? index : [])) {
      if (!meta || !meta.id || deleted.indexOf(meta.id) >= 0) continue;
      let body = null;
      try { body = JSON.parse(localStorage.getItem('k-user-story-' + meta.id) || 'null'); } catch (e) {}
      if (!body || body.schemaVersion !== '2.0.0') continue;
      out.push({
        id: meta.id, dir: null, file: null,
        title: body.title || meta.title || '',
        subtitle: body.englishTitle || meta.englishTitle || '',
        level: null, category: 'custom', unlocksAfter: null,
        _body: body, _userStory: true, _sharedBy: meta.sharedBy || null,
      });
    }
    return out;
  }

  // ── Story list (curriculum + custom, filtered by categoryOpt) ───────────
  function buildStoryList(manifest) {
    const sortKeys = buildCurriculumSortKeys(manifest);
    storyList = [];
    for (const level of Object.keys(manifest.data || {})) {
      const category = level === 'custom' ? 'custom' : 'curriculum';
      if (categoryOpt && categoryOpt !== category) continue;
      for (const s of (manifest.data[level].stories || [])) {
        storyList.push({
          id: s.id, dir: s.dir,
          file: s.file || 'story.json',
          title: s.titleJp || s.title,
          subtitle: s.title,
          level: category === 'custom' ? null : level,
          category,
          unlocksAfter: s.unlocksAfter
        });
      }
    }
    // Server-generated (per-user) custom stories, cached locally by the builder.
    if (!categoryOpt || categoryOpt === 'custom') {
      for (const us of readUserStories()) storyList.push(us);
    }
    storyList.sort((a, b) => {
      // Curriculum first, sorted by unlocksAfter; then custom.
      if (a.category !== b.category) return a.category === 'curriculum' ? -1 : 1;
      const ka = sortKeys[a.unlocksAfter] || 0;
      const kb = sortKeys[b.unlocksAfter] || 0;
      return ka - kb;
    });
  }

  function buildCurriculumSortKeys(manifest) {
    // Mirrors Story.js — give every lesson/review/grammar a numeric position so
    // stories sort in curriculum order via `unlocksAfter`.
    const keys = {};
    const levels = manifest.levels || [];
    levels.forEach((lvl, lvlIdx) => {
      const base = (lvl === 'N5' ? 1000 : 10000) + lvlIdx * 100;
      const lessons = (manifest.data[lvl] && manifest.data[lvl].lessons) || [];
      lessons.forEach((les, i) => { keys[les.id] = base + i * 10; });
      const reviews = (manifest.data[lvl] && manifest.data[lvl].reviews) || [];
      reviews.forEach((rv, i) => { keys[rv.id] = base + 900 + i * 10; });
    });
    // Grammar resolves transitively via dependency chain — repeatedly walk.
    const grams = [];
    for (const lvl of levels) {
      const gs = (manifest.data[lvl] && manifest.data[lvl].grammar) || [];
      for (const g of gs) grams.push(g);
    }
    let changed = true;
    let iters = 0;
    while (changed && iters++ < 50) {
      changed = false;
      for (const g of grams) {
        if (keys[g.id] != null) continue;
        const prereq = g.unlocksAfter;
        if (prereq && keys[prereq] != null) { keys[g.id] = keys[prereq] + 1; changed = true; }
      }
    }
    return keys;
  }

  // ── Selector UI ──────────────────────────────────────────────────────────

  // Show category > level selector, or just stories if only one category/level.
  let selectorView = 'levels';  // 'levels' or 'stories'
  let selectorLevel = null;

  function renderSelector() {
    if (window.JPApp) window.JPApp.showTabBar();
    selectorView = 'levels';
    selectorLevel = null;
    const unlockApi = window.JPShared && window.JPShared.unlock;
    const visibleStories = storyList.filter(s => !unlockApi || unlockApi.isFree() || unlockApi.isStoryUnlocked(s));
    const grouped = {};
    for (const s of visibleStories) {
      const grp = s.category === 'custom' ? 'custom' : s.level;
      if (!grouped[grp]) grouped[grp] = [];
      grouped[grp].push(s);
    }

    const groupKeys = Object.keys(grouped).sort((a, b) => {
      // N5, N4, N3, custom order
      const ord = { N5: 0, N4: 1, N3: 2, custom: 9 };
      return (ord[a] != null ? ord[a] : 5) - (ord[b] != null ? ord[b] : 5);
    });

    let html = '<div class="jp-story-container">' +
      '<div class="jp-story-header"><div class="jp-story-title">📖 Stories</div>' +
      '<div class="jp-story-nav"><button class="jp-story-back-btn" id="jp-stories-exit">← Back</button></div></div>';

    if (groupKeys.length === 0) {
      html += '<div class="jp-story-error">No stories unlocked yet — finish more lessons to unlock them.</div>';
    } else {
      html += '<div class="jp-shelf-wrap">' +
        '<h2>Your Library</h2>' +
        '<p>Pick a shelf, then choose a book to read.</p>';
      for (const k of groupKeys) {
        const name = k === 'custom' ? 'Custom Stories' : `JLPT ${k}`;
        const books = grouped[k];
        const count = books.length;
        const thickness = spineThickness(count);
        let spines = '';
        for (const s of books) {
          const title = s.title || s.subtitle || s.id;
          spines += `<div class="jp-spine" style="width:${thickness}px;background:${colorFromId(s.id)};">` +
            `<span class="jp-spine-title">${escHtml(title)}</span></div>`;
        }
        html += `<div class="jp-shelf" data-group="${escAttr(k)}">` +
          `<div class="jp-shelf-label">${escHtml(name)}` +
            `<span class="jp-shelf-count">${count} book${count === 1 ? '' : 's'}</span></div>` +
          `<div class="jp-shelf-books">${spines}</div>` +
          `<div class="jp-shelf-plank"></div>` +
        `</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('jp-stories-exit').onclick = onExit;
    container.querySelectorAll('.jp-shelf').forEach(shelf => {
      shelf.onclick = () => renderStoriesInGroup(shelf.dataset.group, grouped[shelf.dataset.group]);
    });
  }

  function renderStoriesInGroup(groupKey, stories) {
    if (window.JPApp) window.JPApp.showTabBar();
    selectorView = 'stories';
    selectorLevel = groupKey;
    const groupName = groupKey === 'custom' ? 'Custom Stories' : `JLPT ${groupKey} Stories`;
    let html = '<div class="jp-story-container">' +
      '<div class="jp-story-header"><div class="jp-story-title">📖 ' + escHtml(groupName) + '</div>' +
      '<div class="jp-story-nav"><button class="jp-story-back-btn" id="jp-stories-exit">← Back</button></div></div>' +
      '<div class="jp-shelf-wrap">' +
      '<button class="jp-story-level-back-btn" id="jp-stories-back-to-levels">← Library</button>' +
      '<div class="jp-covers-grid">';
    const unlockApi = window.JPShared && window.JPShared.unlock;
    for (const s of stories) {
      const badge = s.category === 'custom' ? 'CUSTOM' : (s.level || 'STORY');
      const done = !!(unlockApi && unlockApi.isCompleted && unlockApi.isCompleted(s.id));
      const stamp = done ? stampHtml('jp-book-cover-stamp') : '';
      const u = window.JPShared && window.JPShared.unlock;
      const unseenDot = (u && u.isUnseen && u.isUnseen('story:' + s.id))
        ? '<span class="jp-unseen-dot" style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:999px;background:var(--vermilion);box-shadow:0 0 0 2px #fff;z-index:6;pointer-events:none;"></span>'
        : '';
      // TESTING ONLY — delete control on generated stories. Remove before
      // production (along with deleteUserStory / k-user-stories-deleted).
      const delBtn = s._userStory
        ? `<button class="jp-book-del" data-del="${escAttr(s.id)}" aria-label="Delete story" title="Delete (testing)" style="position:absolute;top:4px;left:4px;z-index:7;width:22px;height:22px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:15px;line-height:20px;text-align:center;cursor:pointer;padding:0;">×</button>`
        : '';
      html += `<div class="jp-book-cover" data-id="${escAttr(s.id)}">
        <div class="jp-book-cover-page"></div>
        <div class="jp-book-cover-face" style="background:${colorFromId(s.id)};">
          <div class="jp-book-cover-badge">${escHtml(badge)}</div>
          <div class="jp-book-cover-title">${escHtml(s.title || s.subtitle || s.id)}</div>
          <div class="jp-book-cover-en">${escHtml(s.subtitle || '')}</div>
        </div>
        ${stamp}${unseenDot}${delBtn}
      </div>`;
    }
    html += '</div></div></div>';
    container.innerHTML = html;
    document.getElementById('jp-stories-exit').onclick = onExit;
    document.getElementById('jp-stories-back-to-levels').onclick = renderSelector;
    // TESTING ONLY — delete control (see render above). Remove before production.
    container.querySelectorAll('.jp-book-del').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del');
        if (!window.confirm('Delete this story from your device? (testing)')) return;
        deleteUserStory(id);
        renderSelector();
      };
    });
    const sk = window.JPShared && window.JPShared.sceneKit;
    container.querySelectorAll('.jp-book-cover').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        const idx = storyList.findIndex(s => s.id === id);
        if (idx < 0) return;
        const u = window.JPShared && window.JPShared.unlock;
        if (u && u.markSeen) u.markSeen('story:' + id);
        currentIndex = idx;
        if (sk) sk.tapFeedback(card);
        // The reader opens onto the CLOSED book (matching cover); the user opens
        // it there with a real hard-cover flip, so this is just a hand-off — no
        // separate cover animation here (and a stray tap can ≡ List right back).
        loadStory(storyList[idx]);
      };
    });
  }

  // ── Story load + render ──────────────────────────────────────────────────
  async function loadStory(storyInfo) {
    container.innerHTML = '<div class="jp-story-container"><div class="jp-story-loading"><div class="jp-story-loading-spinner"></div>Loading story…</div></div>';
    try {
      // Server-generated stories carry their body in-memory (cached locally);
      // bundled stories fetch their story.json by path.
      let data;
      if (storyInfo._body) {
        data = storyInfo._body;
      } else {
        const url = getCdnUrl(storyInfo.dir + '/' + (storyInfo.file || 'story.json')) + '?t=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load story: ' + res.status);
        data = await res.json();
      }
      if (!data.schemaVersion || data.schemaVersion !== '2.0.0') {
        throw new Error('Unsupported story schema: ' + data.schemaVersion);
      }
      currentStory = data;
      storyDoneMarked = false;
      // A FINISHED quiz starts over on a fresh load (re-read); an unfinished one
      // is left intact so it resumes (restored in wireComprehensionCard).
      const qList = data.comprehension && data.comprehension.questions;
      if (Array.isArray(qList) && qList.length) {
        const saved = loadQuizAnswers(data.id);
        if (Object.keys(saved).length >= qList.length) clearQuizAnswers(data.id);
      }
      renderStory(data);
    } catch (err) {
      console.error('[Stories] story load error:', err);
      container.innerHTML = '<div class="jp-story-container"><div class="jp-story-error"><strong>Could not load story</strong><br>' + escHtml(err.message || String(err)) + '</div></div>';
    }
  }

  function renderStory(data) {
    if (window.JPApp) window.JPApp.hideTabBar();
    // Clear any lingering 説明 selection from the previous story/page render.
    try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch (e) {}
    pages = paginateStory(data.paragraphs, data.comprehension);
    currentPage = 0;
    isFlipping = false;

    const prevDisabled = currentIndex <= 0 ? 'disabled' : '';
    const nextDisabled = currentIndex >= storyList.length - 1 ? 'disabled' : '';

    const html = '<div class="jp-story-container jp-reading">' +
      '<div class="jp-story-header">' +
        '<div class="jp-story-title">' + escHtml(data.title || '') + '</div>' +
        '<div class="jp-story-nav">' +
          '<button class="jp-story-back-btn" id="jp-stories-settings" title="Voice Settings" onclick="window.JPShared.ttsSettings.open()">⚙</button>' +
          '<button class="jp-story-nav-btn" id="jp-stories-prev" ' + prevDisabled + '>← Prev</button>' +
          '<button class="jp-story-nav-btn" id="jp-stories-next" ' + nextDisabled + '>Next →</button>' +
          '<button class="jp-story-back-btn" id="jp-stories-list">≡ List</button>' +
          '<button class="jp-story-back-btn" id="jp-stories-exit">Exit</button>' +
        '</div>' +
      '</div>' +
      '<div class="jp-book">' +
        '<div class="jp-book-frame">' +
          '<div class="jp-flip-book" id="jp-flip-book"></div>' +
        '</div>' +
        '<div class="jp-book-controls">' +
          '<button class="jp-page-btn" id="jp-page-prev">← Page</button>' +
          '<div class="jp-book-controls-mid">' +
            '<button class="jp-speak-all-btn" id="jp-stories-play-all" data-tts-play-all="story">🔊 Play</button>' +
            '<button class="jp-page-en-toggle" id="jp-page-en-toggle">EN</button>' +
          '</div>' +
          '<button class="jp-page-btn" id="jp-page-next">Page →</button>' +
          '<button class="jp-back-to-q" id="jp-back-to-questions" hidden>← Questions</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    container.innerHTML = html;
    wireStoryEvents(data);
  }

  // Build the inner content for one page (prose or quiz). Same markup as before
  // so furigana/romaji/term spans render identically; consumed by the StPageFlip
  // pages (and the legacy renderPageHtml wrapper).
  function pageContentHtml(page, data) {
    if (!page) return '';
    let body;
    if (page.type === 'quiz') {
      body = '<div class="jp-page-inner">' + renderComprehensionCard(page.comprehension) + '</div>';
    } else {
      let inner = '';
      page.segments.forEach(seg => {
        const para = data.paragraphs[seg.paraIdx] || {};
        const tokens = seg.tokens != null ? seg.tokens : para.tokens;
        const speakJp = seg.jp != null ? seg.jp : para.jp;
        inner += '<p class="jp-story-paragraph" data-para="' + seg.paraIdx + '" ' +
          'data-speak-jp="' + escAttr(speakJp || '') + '">' +
          '<span class="jp-story-jp">' + renderTokens(tokens) + '</span>' +
          '<button class="jp-speak-sentence" data-speak-idx="' + seg.paraIdx + '" aria-label="Speak this paragraph">🔊</button>' +
        '</p>';
      });
      body = '<div class="jp-page-inner">' + inner + '</div>';
      if (page.enText) body += '<div class="jp-page-en" hidden>' + escHtml(page.enText) + '</div>';
    }
    // Wrap the page body in an absolutely-positioned scroll region. StPageFlip forces
    // display:block inline on the visible page, defeating any flex-based height
    // bounding, so the content div would otherwise grow to its full height and get
    // clipped by the page's overflow:hidden (long pages = cut-off text, no scroll).
    // .jp-page-scroll fills the page (definite height) and scrolls — see the CSS.
    return '<div class="jp-page-scroll">' + body + '<div class="jp-page-foot"></div></div>';
  }

  // Wire only the handlers that live INSIDE one page node (per-paragraph TTS,
  // term clicks, comprehension). Header/play-all/page-nav are wired once.
  function wirePage(node, data) {
    if (!node) return;
    // Per-paragraph speak (prefer the sub-segment text for split paragraphs).
    node.querySelectorAll('.jp-speak-sentence').forEach(btn => {
      btn.onclick = function (e) {
        e.stopPropagation();
        const para = this.closest('.jp-story-paragraph');
        const jp = (para && para.dataset.speakJp) ||
          (data.paragraphs[parseInt(this.dataset.speakIdx, 10)] || {}).jp;
        if (jp && window.JPShared && window.JPShared.tts) window.JPShared.tts.speak(jp);
      };
    });
    // Term click handlers (inline tokens that match glossary surfaces).
    // Synthetic conjugation ids ("<root>_<ruleKey>") split back to (rootId, ruleKey)
    // so the modal can generate the inflected entry on-demand.
    node.querySelectorAll('[data-term-id]').forEach(el => {
      // Tap a word to open its glossary entry. 説明 (setsumei) mode now uses native
      // hold-and-drag selection — handled globally by select-explain.js, like the
      // rest of the app — so the reader no longer intercepts taps for picking.
      el.onclick = function (e) {
        e.stopPropagation();
        const id = this.dataset.termId;
        if (!id || !window.JP_OPEN_TERM) return;
        const split = splitConjugatedId(id);
        if (split) window.JP_OPEN_TERM(split.rootId, split.form, true);
        else window.JP_OPEN_TERM(id, null, true);
      };
    });
    // Comprehension wiring (only present on a quiz page).
    if (node.querySelector('#jp-stories-end-card')) wireComprehensionCard();
    // Reflect per-page EN reveal state onto this freshly rendered page's block.
    const en = node.querySelector('.jp-page-en');
    if (en) en.hidden = !enRevealed;
  }

  // ── Per-page English reveal ───────────────────────────────────────────────
  let enRevealed = false;

  function wireStoryEvents(data) {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    enRevealed = false;
    cameFromQuiz = false;

    // ── Header nav (per story) ──
    document.getElementById('jp-stories-exit').onclick = (e) => {
      try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch (err) {}
      if (typeof onExit === 'function') onExit(e);
    };
    document.getElementById('jp-stories-list').onclick = renderSelector;
    document.getElementById('jp-stories-prev').onclick = () => {
      if (currentIndex > 0) { currentIndex--; loadStory(storyList[currentIndex]); }
    };
    document.getElementById('jp-stories-next').onclick = () => {
      if (currentIndex < storyList.length - 1) { currentIndex++; loadStory(storyList[currentIndex]); }
    };

    // ── Build every page as a StPageFlip leaf (real DOM, so furigana / term
    //    taps / TTS all keep working on the turning page). ──
    const mount = document.getElementById('jp-flip-book');
    // Page 0 = the closed book's hard cover (matches the shelf cover: same color
    // + title). Opening it is a real hard-cover flip. The reader lands closed so
    // a stray tap from the shelf can back out via ≡ List without "opening" it.
    const sInfo = storyList[currentIndex] || {};
    const coverBadge = sInfo.category === 'custom' ? 'CUSTOM' : (sInfo.level || 'STORY');
    const cover = document.createElement('div');
    cover.className = 'jp-flip-page jp-page jp-flip-cover';
    cover.setAttribute('data-density', 'hard');
    // The color goes on an INNER fill — StPageFlip overwrites the page element's
    // own inline style on loadFromHTML, but leaves children alone.
    // Completion state for the cover: a stamp once finished, plus the best
    // comprehension score when the story is graded.
    const coverId = sInfo.id || data.id || '';
    const u = window.JPShared && window.JPShared.unlock;
    const coverDone = !!(u && u.isCompleted && u.isCompleted(coverId));
    const coverHasQuiz = !!(data.comprehension && Array.isArray(data.comprehension.questions) &&
      data.comprehension.questions.length > 0);
    const coverBest = (u && u.getLessonScore) ? u.getLessonScore(coverId) : 0;
    const coverScore = (coverDone && coverHasQuiz)
      ? '<div class="jp-flip-cover-score">Best ' + coverBest + '%</div>' : '';
    const coverStamp = coverDone ? stampHtml('jp-flip-cover-stamp') : '';
    cover.innerHTML =
      '<div class="jp-flip-cover-fill" style="background:' + colorFromId(sInfo.id || data.id || '') + ';">' +
        '<div class="jp-flip-cover-badge">' + escHtml(coverBadge) + '</div>' +
        '<div class="jp-flip-cover-title">' + escHtml(data.title || sInfo.title || '') + '</div>' +
        '<div class="jp-flip-cover-sub">' + escHtml(data.englishTitle || sInfo.subtitle || '') + '</div>' +
        coverScore +
        coverStamp +
      '</div>';
    mount.appendChild(cover);

    pages.forEach((pg, i) => {
      const leaf = document.createElement('div');
      leaf.className = 'jp-flip-page jp-page';
      leaf.setAttribute('data-density', 'soft');
      leaf.innerHTML = pageContentHtml(pg, data);
      const foot = leaf.querySelector('.jp-page-foot');
      if (foot) foot.textContent = (i + 1) + ' / ' + pages.length;
      mount.appendChild(leaf);
      wirePage(leaf, data);
    });
    const pageEls = mount.querySelectorAll('.jp-flip-page');
    mount.style.visibility = 'hidden'; // avoid a stacked-pages flash before init

    const enToggle = document.getElementById('jp-page-en-toggle');
    const prevBtn = document.getElementById('jp-page-prev');
    const nextBtn = document.getElementById('jp-page-next');

    function updatePageControls() {
      // currentPage 0 = closed cover; content pages are 1..pages.length.
      const onCover = currentPage <= 0;
      const lastPage = currentPage >= pages.length;
      prevBtn.disabled = onCover;
      if (onCover) {
        nextBtn.textContent = 'Open →';
        nextBtn.disabled = false;
      } else if (lastPage) {
        if (hasComprehensionQs()) {
          // Reading is done; offer the comprehension quiz (opens as a scrollable
          // overlay). Completion + best score are recorded when it's answered.
          nextBtn.textContent = '✍ Questions →';
          nextBtn.disabled = false;
        } else {
          // No quiz → reaching the end finishes the story.
          markStoryDone();
          // Offer the next story only if it exists AND is unlocked.
          const next = storyList[currentIndex + 1];
          const nextUnlocked = !!next && nextStoryUnlocked();
          if (!next) { nextBtn.textContent = 'Page →'; nextBtn.disabled = true; }
          else if (nextUnlocked) { nextBtn.textContent = 'Next story →'; nextBtn.disabled = false; }
          else { nextBtn.textContent = '🔒 Locked'; nextBtn.disabled = true; }
        }
      } else {
        nextBtn.textContent = 'Page →';
        nextBtn.disabled = false;
      }
      // EN toggle reflects the visible page: hidden on the cover / pages w/o EN.
      if (enToggle) {
        const curEl = pageEls[currentPage];
        const hasEn = !onCover && !!(curEl && curEl.querySelector('.jp-page-en'));
        enToggle.style.visibility = hasEn ? 'visible' : 'hidden';
        enToggle.classList.toggle('jp-en-on', enRevealed);
      }
      // Tell Ask-Rikizo which story/page is on screen; the server resolves the
      // paragraph Japanese from the file. `page` is the paragraph index of the
      // first segment on this page so the server samples the right spot.
      try {
        const tc = window.JPShared && window.JPShared.tutorContext;
        const d = currentStory;
        if (tc && d) {
          const segs = (pages[currentPage - 1] && pages[currentPage - 1].segments) || [];
          const paraIdx = segs.length ? segs[0].paraIdx : (currentPage - 1);
          tc.patch({
            view: 'story', lessonId: d.id, title: d.title || d.englishTitle || '',
            page: paraIdx, sectionType: 'story'
          });
        }
      } catch (e) {}
    }

    // EN reveal toggles across all pages; button reflects the visible page.
    if (enToggle) enToggle.onclick = () => {
      enRevealed = !enRevealed;
      pageEls.forEach(el => { const en = el.querySelector('.jp-page-en'); if (en) en.hidden = !enRevealed; });
      updatePageControls();
    };

    // Fallback (no StPageFlip / init failure): instant single-page show. Skips
    // the cover (pageEls[0]) entirely — content pages are pageEls[1..N].
    function showPage(i) {
      currentPage = Math.max(1, Math.min(pages.length, i));
      pageEls.forEach((el, idx) => { el.style.display = idx === currentPage ? '' : 'none'; });
      updatePageControls();
    }

    // Animated, button-only page turn (replaces StPageFlip). Applies the CSS
    // leaf-flip to the outgoing/incoming leaf; native scroll/selection/edge-taps
    // are free because nothing intercepts touch anymore. isFlipping guards
    // re-entrancy; transitionend + timeout make finish idempotent.
    function pageTurnSideEffects() {
      updatePageControls();
      // Clear any lingering 説明 selection so its pill never anchors off-screen.
      try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch (e) {}
      try { if (window.JPShared.sfx) window.JPShared.sfx.pageTurn(); } catch (e) {}
    }
    function flipTo(target, afterSwap) {
      if (isFlipping) return;
      target = Math.max(0, Math.min(pages.length, target));
      const from = currentPage;
      if (target === from) { if (typeof afterSwap === 'function') afterSwap(); return; }
      const forward = target > from;
      const outEl = pageEls[from], inEl = pageEls[target];
      if (!outEl || !inEl) return;

      const finish = () => {
        [outEl, inEl].forEach(el => {
          el.classList.remove('jp-flipping', 'jp-flip-fwd-end', 'jp-flip-back-start');
          el.style.transform = ''; el.style.zIndex = '';
        });
        currentPage = target;
        pageEls.forEach((el, idx) => { el.style.display = idx === target ? '' : 'none'; });
        isFlipping = false;
        pageTurnSideEffects();
        if (typeof afterSwap === 'function') afterSwap();
      };

      if (reduceMotion) { finish(); return; }

      isFlipping = true;
      outEl.style.display = ''; inEl.style.display = '';
      const DUR = 520;
      let done = false;
      if (forward) {
        // Current leaf turns away on its spine (0 → -180°), revealing the next beneath.
        const leaf = outEl;
        inEl.style.zIndex = '1'; leaf.style.zIndex = '3';
        const onEnd = (e) => {
          if (done || (e && e.propertyName && e.propertyName !== 'transform')) return;
          done = true; leaf.removeEventListener('transitionend', onEnd); finish();
        };
        leaf.addEventListener('transitionend', onEnd);
        leaf.classList.add('jp-flipping');
        void leaf.offsetWidth;                 // commit start state before animating
        leaf.classList.add('jp-flip-fwd-end');
        setTimeout(onEnd, DUR + 120);
      } else {
        // Incoming (previous) leaf starts open at -180° and swings shut over current.
        const leaf = inEl;
        leaf.style.zIndex = '3'; outEl.style.zIndex = '1';
        leaf.classList.add('jp-flip-back-start');   // -180°, no transition yet
        void leaf.offsetWidth;
        const onEnd = (e) => {
          if (done || (e && e.propertyName && e.propertyName !== 'transform')) return;
          done = true; leaf.removeEventListener('transitionend', onEnd);
          leaf.classList.remove('jp-flip-back-start'); finish();
        };
        leaf.addEventListener('transitionend', onEnd);
        leaf.classList.add('jp-flipping');
        leaf.classList.remove('jp-flip-back-start');  // transition back to base 0°
        setTimeout(onEnd, DUR + 120);
      }
    }

    // The next story in the list is reachable only when unlocked (or in free mode).
    function nextStoryUnlocked() {
      const next = storyList[currentIndex + 1];
      if (!next) return false;
      const unlockApi = window.JPShared && window.JPShared.unlock;
      return !unlockApi || unlockApi.isFree() || unlockApi.isStoryUnlocked(next);
    }
    function hasComprehensionQs() {
      const c = currentStory && currentStory.comprehension;
      return !!(c && Array.isArray(c.questions) && c.questions.length > 0);
    }
    function nextAction() {
      if (currentPage < pages.length) { flipTo(currentPage + 1); }
      else if (hasComprehensionQs()) { openQuiz(); }
      else if (nextStoryUnlocked()) { currentIndex++; loadStory(storyList[currentIndex]); }
    }

    // Comprehension quiz as a normal scrollable overlay (NOT a flip page) so the
    // textarea inputs focus and the list scrolls natively — neither works inside
    // StPageFlip's animated portrait page DOM.
    function openQuiz() {
      const prev = document.getElementById('jp-quiz-overlay');
      if (prev) prev.remove();
      const ov = document.createElement('div');
      ov.id = 'jp-quiz-overlay';
      ov.className = 'jp-quiz-overlay';
      ov.innerHTML =
        '<div class="jp-quiz-overlay-bar">' +
          '<button class="jp-story-back-btn" id="jp-quiz-back">← Story</button>' +
          '<div class="jp-quiz-overlay-title">' + escHtml(currentStory.title || '') + '</div>' +
        '</div>' +
        '<div class="jp-quiz-overlay-scroll">' + renderComprehensionCard(currentStory.comprehension) + '</div>';
      container.appendChild(ov);
      const back = document.getElementById('jp-quiz-back');
      if (back) back.onclick = () => ov.remove();
      wireComprehensionCard();
    }
    function prevAction() {
      if (currentPage <= 0) return;
      flipTo(currentPage - 1);
    }
    prevBtn.onclick = prevAction;
    nextBtn.onclick = nextAction;

    // Jump from a comprehension question to the passage it's about, then reveal a
    // "← Questions" button to return (answers persist via the quiz store).
    function toggleBackToQuestions(on) {
      const b = document.getElementById('jp-back-to-questions');
      if (b) b.hidden = !on;
    }
    function goToQuestionPage(paraIdx) {
      const target = paraIdxToPage(paraIdx);
      cameFromQuiz = true;
      toggleBackToQuestions(true);
      // Scroll the exact paragraph to the top of its page's scroll container AFTER
      // the flip settles (the turn is async now). flipTo also fires afterSwap when
      // the target is already the current page, so this always runs.
      flipTo(target, () => {
        const el = document.querySelector('.jp-story-paragraph[data-para="' + paraIdx + '"]');
        if (!el) return;
        const sc = el.closest('.jp-page-scroll');
        if (sc) {
          const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
          sc.scrollTop += (r.top - sr.top) - 12;
        } else if (el.scrollIntoView) {
          el.scrollIntoView({ block: 'start' });
        }
      });
    }
    _goToQuestionPage = goToQuestionPage;

    const backToQ = document.getElementById('jp-back-to-questions');
    if (backToQ) backToQ.onclick = () => {
      cameFromQuiz = false;
      toggleBackToQuestions(false);
      openQuiz();
    };

    // Open the reader on the closed cover (page 0); "Open →" flips to page 1.
    // (Replaces StPageFlip — pages now turn via the button-driven flipTo() above.)
    mount.style.visibility = '';
    currentPage = 0;
    pageEls.forEach((el, idx) => { el.style.display = idx === 0 ? '' : 'none'; });
    updatePageControls();

    // ── Play-all (whole story, unchanged behaviour) ──
    const playBtn = document.getElementById('jp-stories-play-all');
    if (playBtn) {
      const lines = data.paragraphs.map(p => p.jp);
      let playing = false;
      function setPlaying(p) {
        playing = p;
        playBtn.textContent = playing ? '⏹ Stop' : '🔊 Play';
        playBtn.classList.toggle('jp-speak-all-active', playing);
      }
      playBtn.onclick = function () {
        if (window.JPShared.tts.isSpeaking && window.JPShared.tts.isSpeaking()) {
          window.JPShared.tts.cancel(); setPlaying(false);
        } else {
          setPlaying(true);
          window.JPShared.tts.speakLines(lines, { onFinish: () => setPlaying(false) });
        }
      };
    }

    updatePageControls();
  }


  // ── Pagination (deterministic greedy grouping — no DOM measurement) ───────
  // Tuned for the .jp-story-paragraph rule (font-size:1.15rem; line-height:2.2)
  // on a ~320px phone content width. Conservative so furigana/romaji vertical
  // inflation never overflows a page. Three named knobs — retune after device test.
  // Pages now SCROLL, so a paragraph is NEVER split across pages — a long one gets
  // its own scrollable page. The budgets only decide how many WHOLE paragraphs may
  // share a page (so short dialogue lines still group). Tunable after device test.
  const PAGE_CHAR_BUDGET = 300; // soft target: stop ADDING whole paragraphs past this
  const PAGE_MAX_PARAS   = 4;   // never pack more than N paragraphs onto one page

  // paginateStory(paragraphs, comprehension) -> Page[]
  //   Page = { type:'prose', segments:[Segment], enText, jpLines }
  //        | { type:'quiz', comprehension }
  //   Segment = { paraIdx, part?, tokens?, jp?, en? }  (tokens/jp present only for
  //              sentence-split sub-segments; otherwise read from paragraphs[paraIdx])
  // Pure: data in -> pages out. `type` leaves room for a future 'checkpoint' page.
  function paginateStory(paragraphs, comprehension) {
    const pages = [];
    let cur = null; // { segments:[], chars:0 }
    function flush() {
      if (cur && cur.segments.length) {
        pages.push({ type: 'prose', segments: cur.segments });
      }
      cur = { segments: [], chars: 0 };
    }
    flush();
    (paragraphs || []).forEach((p, idx) => {
      const len = (p.jp || '').length;
      // Never split a paragraph across pages — a long one keeps its own page and
      // scrolls. Only start a new page when adding this WHOLE paragraph would
      // exceed the budget or the per-page paragraph cap.
      if (cur.segments.length > 0 &&
          (cur.chars + len > PAGE_CHAR_BUDGET || cur.segments.length >= PAGE_MAX_PARAS)) {
        flush();
      }
      cur.segments.push({ paraIdx: idx });
      cur.chars += len;
    });
    flush();
    // Drop the trailing empty page the final flush() may have created.
    const prose = pages.filter(pg => pg.type !== 'prose' || pg.segments.length);
    // Precompute per-page EN + jpLines (for per-page EN toggle / per-page TTS).
    for (const pg of prose) {
      if (pg.type !== 'prose') continue;
      pg.enText = pg.segments
        .map(s => (s.en != null ? s.en : (paragraphs[s.paraIdx] && paragraphs[s.paraIdx].en)))
        .filter(Boolean).join(' ');
      pg.jpLines = pg.segments
        .map(s => (s.jp != null ? s.jp : (paragraphs[s.paraIdx] && paragraphs[s.paraIdx].jp)))
        .filter(Boolean);
    }
    // NOTE: the comprehension quiz is NOT a flip page. A tall, interactive,
    // scrollable form can't live inside StPageFlip's portrait page DOM (the page
    // item is an animated `--soft` element that collapses / can't scroll). It is
    // shown as a normal scrollable overlay from the last page — see openQuiz().
    return prose;
  }

  // Split one long paragraph into sentence-grouped sub-page segments. Splits
  // p.jp on 。 (kept) and walks p.tokens in lockstep via a char cursor (tokens
  // are contiguous; concatenated `k` === p.jp). Greedily re-packs sentences up
  // to `cap` chars. Only the first sub-segment carries `en` (no duplication).
  function splitParagraphAtSentences(p, idx, cap) {
    const jp = p.jp || '';
    const tokens = Array.isArray(p.tokens) ? p.tokens : [];
    // Sentence boundaries: end offsets (exclusive) after each 。 plus the tail.
    const sentences = []; // { start, end }
    let s = 0;
    for (let i = 0; i < jp.length; i++) {
      if (jp[i] === '。') {
        sentences.push({ start: s, end: i + 1 });
        s = i + 1;
      }
    }
    if (s < jp.length) sentences.push({ start: s, end: jp.length });
    if (!sentences.length) sentences.push({ start: 0, end: jp.length });

    // Map a char range -> the contiguous tokens fully inside it.
    function tokensForRange(start, end) {
      const out = [];
      let cursor = 0;
      for (const t of tokens) {
        const tlen = (t.k || '').length;
        const tStart = cursor, tEnd = cursor + tlen;
        cursor = tEnd;
        if (tStart >= start && tEnd <= end) out.push(t);
        else if (tStart < end && tEnd > start) out.push(t); // overlap fallback
      }
      return out;
    }

    // Greedily pack sentences into sub-pages up to `cap`.
    const subPages = []; // arrays of sentence indices
    let bucket = [], bucketLen = 0;
    sentences.forEach((sen, si) => {
      const len = sen.end - sen.start;
      if (bucket.length && bucketLen + len > cap) { subPages.push(bucket); bucket = []; bucketLen = 0; }
      bucket.push(si); bucketLen += len;
    });
    if (bucket.length) subPages.push(bucket);

    return subPages.map((senIdxs, pi) => {
      const start = sentences[senIdxs[0]].start;
      const end = sentences[senIdxs[senIdxs.length - 1]].end;
      return {
        paraIdx: idx,
        part: pi,
        tokens: tokensForRange(start, end),
        jp: jp.slice(start, end),
        en: pi === 0 ? p.en : undefined
      };
    });
  }

  // ── Book-spine appearance ─────────────────────────────────────────────────
  // Curated washi/ink spine palette (deep, saturated enough to read white text).
  const SPINE_PALETTE = [
    'oklch(0.45 0.10 200)', // deep teal
    'oklch(0.45 0.16 25)',  // oxblood
    'oklch(0.62 0.13 85)',  // mustard
    'oklch(0.45 0.10 150)', // forest
    'oklch(0.42 0.10 260)', // navy
    'oklch(0.45 0.12 330)', // plum
    'oklch(0.55 0.14 45)',  // terracotta
    'oklch(0.48 0.04 250)', // slate
    'oklch(0.52 0.09 120)', // olive
    'oklch(0.42 0.14 10)'   // burgundy
  ];
  // Stable hash of an id -> palette colour (same id -> same colour every load).
  function colorFromId(id) {
    let h = 0;
    const str = String(id || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return SPINE_PALETTE[Math.abs(h) % SPINE_PALETTE.length];
  }
  // Inverse thickness: fewer stories on a shelf -> thicker spines (shelf still
  // looks full). Clamped so spines stay tappable and sane.
  function spineThickness(count) {
    return Math.max(26, Math.min(64, 64 - (count - 1) * 6));
  }

  // ── Token + term rendering ───────────────────────────────────────────────

  // Render paragraph tokens. Consecutive tokens with the same `g` (group id)
  // came from a single multi-piece glossary entry (e.g. 友だち → 友[とも]+だち)
  // and render as ONE clickable .jp-term wrapping all the pieces. Tokens
  // without a group are looked up individually via surfaceIdx.
  function renderTokens(tokens) {
    const rk = window.JPShared && window.JPShared.jpText;
    if (!Array.isArray(tokens) || !tokens.length) return '';
    let html = '';
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      // Group run: consecutive tokens sharing the same `g`.
      if (t.g) {
        const g = t.g;
        const groupTokens = [];
        let inner = '';
        let j = i;
        while (j < tokens.length && tokens[j].g === g) {
          groupTokens.push(tokens[j]);
          // Suppress per-token romaji INSIDE a group — emit one combined
          // romaji line under the whole group instead. Prevents the
          // "ki [big gap] masu" effect where each token's romaji centers
          // under its own width.
          inner += rk ? rk.renderToken(tokens[j], { noRomaji: true }) : escHtml(tokens[j].k || '');
          j++;
        }
        // Append a single combined romaji span at the group level. CSS
        // positions it absolutely centered under the whole chip.
        if (rk && rk.tokensToRomaji) {
          inner += '<span class="rt-romaji rt-romaji-group">' + escHtml(rk.tokensToRomaji(groupTokens)) + '</span>';
        }
        const entry = termMapData && termMapData[g];
        const cls = entry && entry.type === 'character' ? 'jp-term jp-term-name' : 'jp-term';
        html += '<span class="jp-token-group ' + cls + '" data-term-id="' + escAttr(g) + '">' + inner + '</span>';
        i = j;
        continue;
      }
      const single = rk ? rk.renderToken(t) : escHtml(t.k || '');
      // Homograph particles (でも = "but" vs "even", …) are untagged in token
      // data and otherwise resolve to a single context-blind sense. Pick the
      // right sense from sentence position / preceding surface before falling
      // back to the default surface lookup.
      let entry = null;
      const ps = window.JPShared && window.JPShared.particleSense;
      if (ps) {
        const prevK = i > 0 ? (tokens[i - 1].k || '') : '';
        const nextK = i + 1 < tokens.length ? (tokens[i + 1].k || '') : '';
        const senseId = ps.resolveParticleSense(t.k, { prevK: prevK, nextK: nextK, atSentenceStart: i === 0 });
        if (senseId && termMapData && termMapData[senseId]) entry = termMapData[senseId];
      }
      if (!entry) entry = surfaceIdx && surfaceIdx.get(t.k);
      if (entry && entry.id) {
        const cls = entry.type === 'character' ? 'jp-term jp-term-name' : 'jp-term';
        html += '<span class="' + cls + '" data-term-id="' + escAttr(entry.id) + '">' + single + '</span>';
      } else {
        html += single;
      }
      i++;
    }
    return html;
  }

  // ── Comprehension card ──────────────────────────────────────────────────
  // The user's chosen completion stamp image (shared with the Map path), or ''.
  function globalStampUrl() {
    try { return (window.JPShared.stampSettings.getStampUrl() || ''); } catch (e) { return ''; }
  }

  // A completion stamp element (the chosen stamp image, or a ✓ fallback seal).
  function stampHtml(cls) {
    const url = globalStampUrl();
    return url
      ? '<img class="' + cls + '" src="' + escAttr(url) + '" alt="completed" loading="lazy"/>'
      : '<div class="' + cls + ' jp-stamp-fallback">✓</div>';
  }

  // Persist that the current story was finished (+ best score when graded), into
  // the shared progress store the path/Map reads. `pct` omitted = completion only
  // (e.g. a story with no comprehension questions, read to the last page).
  function markStoryDone(pct) {
    const id = (currentStory && currentStory.id) || (storyList[currentIndex] || {}).id;
    if (!id) return;
    if (storyDoneMarked && typeof pct !== 'number') return; // completion already recorded
    storyDoneMarked = true;
    try {
      const u = window.JPShared && window.JPShared.unlock;
      if (u && u.recordStoryResult) u.recordStoryResult(id, pct);
    } catch (e) {}
    // Finishing a story counts toward the daily streak (parallels Lesson/Grammar).
    if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
  }

  // A comprehension question is "written" (free-text) when it carries an answer
  // string and no MCQ options; otherwise it's the classic multiple-choice item.
  function isWrittenQ(q) { return q && typeof q.answer === 'string' && q.answer !== '' && !Array.isArray(q.options); }

  // Lenient grading (normalize/match) now lives in the shared module
  // window.JPShared.writtenAnswer so Stories and Lessons grade identically.
  const hasKanji = (s) => /[一-鿿㐀-䶿]/.test(s);

  // Surface→reading pairs for the CURRENT story, harvested from its own tokens
  // (which carry authored readings, e.g. 青→あお, 月光→げっこう). Grouped tokens
  // (shared `g`) combine into one word. Cached on the story; longest surface first.
  function storyReadingPairs() {
    const story = currentStory;
    if (!story) return [];
    if (story.__readingPairs) return story.__readingPairs;
    const pairs = new Map();
    for (const p of (story.paragraphs || [])) {
      const toks = p.tokens || [];
      let i = 0;
      while (i < toks.length) {
        const g = toks[i].g;
        if (g) {
          let j = i, surf = '', read = '';
          while (j < toks.length && toks[j].g === g) {
            surf += (toks[j].k || '');
            read += (toks[j].r != null ? toks[j].r : (toks[j].k || ''));
            // Also index each kanji token on its own (青→あお) so a single-kanji
            // accept core resolves even when it only appears inside a word group.
            const tk = toks[j];
            if (tk.k && tk.r && hasKanji(tk.k) && !pairs.has(tk.k)) pairs.set(tk.k, tk.r);
            j++;
          }
          if (surf && hasKanji(surf) && !pairs.has(surf)) pairs.set(surf, read);
          i = j;
        } else {
          const t = toks[i];
          if (t.k && t.r && hasKanji(t.k) && !pairs.has(t.k)) pairs.set(t.k, t.r);
          i++;
        }
      }
    }
    story.__readingPairs = [...pairs.entries()].sort((a, b) => b[0].length - a[0].length);
    return story.__readingPairs;
  }

  // Grade via the shared module, supplying a reading resolver built from THIS
  // story's tokens (so あおい ⇄ 青 still works against the story's own readings).
  function matchWritten(student, q) {
    const wa = window.JPShared.writtenAnswer;
    // Conjugation-tolerant grading: q.aTerms (baked by derive-answer-terms.mjs)
    // lists the answer's verbs/adjectives by dictionary id, so any valid form is
    // accepted (走る/走った for an answer authored 走ります; plain past for 〜ました).
    const tp = window.JPShared.textProcessor;
    return wa.match(student, q, {
      readingFn: wa.makeReadingFn(storyReadingPairs()),
      conjugate: tp && tp.conjugate,
      getRoot: tp && tp.getRootTerm,
      rules: CONJUGATION_RULES,
      termMap: termMapData
    });
  }

  function renderComprehensionCard(comprehension) {
    let html = '<div class="jp-story-end-card" id="jp-stories-end-card">' +
      '<h3>' + escHtml(comprehension.intro || 'Did you follow the story?') + '</h3>';
    comprehension.questions.forEach((q, qi) => {
      html += '<div class="jp-story-q" data-qi="' + qi + '">' +
        '<div class="jp-story-q-text">' + escHtml(q.q) + '</div>';
      // English is hidden until the question is answered — the student reads the
      // Japanese question to test comprehension; it reveals with the model answer.
      if (q.q_en) html += '<div class="jp-story-q-en" hidden data-en-for="' + qi + '">' + escHtml(q.q_en) + '</div>';
      // Jump straight to the passage this question is about (closes the quiz,
      // turns to that page). paraIdx is authored; map it to the page number.
      if (typeof q.paraIdx === 'number') {
        html += '<button class="jp-story-q-goto" data-paraidx="' + q.paraIdx + '">' +
                '📖 Go to page ' + paraIdxToPage(q.paraIdx) + ' →</button>';
      }
      if (isWrittenQ(q)) {
        html += '<textarea class="jp-story-q-input" data-qi="' + qi + '" rows="1" ' +
                'autocapitalize="off" autocomplete="off" spellcheck="false" ' +
                'placeholder="ここに 答えを 書いて ください"></textarea>' +
          '<button class="jp-story-q-check" data-qi="' + qi + '">Check</button>' +
          '<div class="jp-story-q-model" hidden data-model-for="' + qi + '">' +
            '<span class="jp-story-q-model-label">答え · Answer</span>' + escHtml(q.answer) +
          '</div>';
      } else {
        (q.options || []).forEach((opt, oi) => {
          html += '<button class="jp-story-q-opt" data-qi="' + qi + '" data-oi="' + oi + '">' + escHtml(opt) + '</button>';
        });
      }
      if (q.explanation) {
        html += '<div class="jp-story-q-explain" hidden data-explain-for="' + qi + '">' + escHtml(q.explanation) + '</div>';
      }
      html += '</div>';
    });
    html += '<button class="jp-story-end-cta" id="jp-stories-end-cta" hidden></button>';
    html += '</div>';
    return html;
  }

  function wireComprehensionCard() {
    const card = document.getElementById('jp-stories-end-card');
    if (!card) return;
    const data = currentStory;
    if (!data || !data.comprehension) return;
    const totalQs = data.comprehension.questions.length;
    let answered = 0, correct = 0;

    // Sound + haptic on any graded answer (same pattern as the lesson drills).
    function fxAnswer(ok) {
      try {
        const fx = window.JPShared.sfx, hp = window.JPShared.haptics;
        if (ok) { if (fx) fx.success(); if (hp) hp.success(); }
        else { if (fx) fx.error(); if (hp) hp.error(); }
      } catch (e) {}
    }

    // Shared bookkeeping for both MCQ and written items: record the result,
    // flag missed terms, and fire the CTA when done. (Visuals — disabling,
    // colouring, revealing the explanation/model — live in the apply* helpers so
    // the same code drives a live answer AND a restore-from-storage.)
    function recordAnswer(wrapper, q, isRight) {
      wrapper.dataset.answered = '1';
      answered++;
      if (isRight) correct++;
      fxAnswer(isRight);
      if (!isRight && Array.isArray(q.terms)) {
        try { q.terms.forEach(id => window.JPShared.progress.flagTerm(id)); } catch (e) {}
      }
      if (answered === totalQs) showCta(correct, totalQs);
    }

    // Apply the resolved (answered) visual state to a question card. Shared by
    // the live answer handlers and the restore pass — purely DOM, no bookkeeping.
    function applyMcqResolved(wrapper, q, oi) {
      wrapper.querySelectorAll('.jp-story-q-opt').forEach((b, idx) => {
        b.disabled = true;
        if (idx === q.correct) b.classList.add('correct');
        else if (idx === oi) b.classList.add('wrong');
      });
      const en = wrapper.querySelector('.jp-story-q-en');
      if (en) en.hidden = false;
      const ex = wrapper.querySelector('.jp-story-q-explain');
      if (ex) ex.hidden = false;
    }
    function applyWrittenResolved(wrapper, q, text, isRight) {
      const input = wrapper.querySelector('.jp-story-q-input');
      if (input) { input.value = text || ''; input.disabled = true; input.classList.add(isRight ? 'correct' : 'wrong'); }
      const check = wrapper.querySelector('.jp-story-q-check');
      if (check) check.disabled = true;
      const model = wrapper.querySelector('.jp-story-q-model');
      if (model) model.hidden = false;
      const en = wrapper.querySelector('.jp-story-q-en');
      if (en) en.hidden = false;
      const ex = wrapper.querySelector('.jp-story-q-explain');
      if (ex) ex.hidden = false;
    }

    card.querySelectorAll('.jp-story-q-opt').forEach(btn => {
      btn.onclick = function () {
        const qi = parseInt(this.dataset.qi, 10);
        const oi = parseInt(this.dataset.oi, 10);
        const q = data.comprehension.questions[qi];
        const wrapper = card.querySelector('.jp-story-q[data-qi="' + qi + '"]');
        if (!wrapper || wrapper.dataset.answered) return;
        const isRight = oi === q.correct;
        applyMcqResolved(wrapper, q, oi);
        saveQuizAnswer(data.id, qi, { isRight: isRight, oi: oi });
        recordAnswer(wrapper, q, isRight);
      };
    });

    // Written (free-text) questions: grade the typed answer leniently, lock the
    // input, reveal the model answer, then record like an MCQ.
    card.querySelectorAll('.jp-story-q-check').forEach(btn => {
      btn.onclick = function () {
        const qi = parseInt(this.dataset.qi, 10);
        const q = data.comprehension.questions[qi];
        const wrapper = card.querySelector('.jp-story-q[data-qi="' + qi + '"]');
        if (!wrapper || wrapper.dataset.answered) return;
        const input = wrapper.querySelector('.jp-story-q-input');
        const text = input ? input.value : '';
        const isRight = matchWritten(text, q);
        applyWrittenResolved(wrapper, q, text, isRight);
        saveQuizAnswer(data.id, qi, { isRight: isRight, text: text });
        recordAnswer(wrapper, q, isRight);
      };
    });

    // "Go to page" — close the quiz and jump to the passage this question is
    // about. The reader exposes the jump via _goToQuestionPage (set in
    // wireStoryEvents); answers persist, so reopening via "← Questions" restores.
    card.querySelectorAll('.jp-story-q-goto').forEach(btn => {
      btn.onclick = function () {
        const paraIdx = parseInt(this.dataset.paraidx, 10);
        const ov = document.getElementById('jp-quiz-overlay');
        if (ov) ov.remove();
        if (_goToQuestionPage) _goToQuestionPage(paraIdx);
      };
    });

    // StPageFlip only whitelists <a>/<button> (checkTarget); a <textarea> is
    // otherwise treated as a flip-drag start and its touchstart/mousedown is
    // preventDefault'd — which blocks the field from focusing. The flip's
    // listeners live on distElement in the bubble phase, so stopping the
    // pointer-start events at the input lets it focus and open the keyboard.
    card.querySelectorAll('.jp-story-q-input').forEach(input => {
      ['mousedown', 'touchstart', 'pointerdown'].forEach(ev =>
        input.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    });

    // The comprehension card can be taller than the page (up to ~10 questions).
    // StPageFlip runs with mobileScrollSupport:false and preventDefaults touch
    // gestures, so a scroll-drag on the quiz page is eaten as a page-flip and the
    // learner can't reach the lower questions. Keep the gesture from reaching the
    // flip surface so the page-inner's native overflow scroll works. (Drag-flip
    // on the quiz page is unneeded — Prev / List / the end CTA handle navigation.)
    const scroller = card.closest('.jp-page-scroll');
    if (scroller) {
      scroller.style.touchAction = 'pan-y';
      ['touchstart', 'touchmove', 'pointerdown', 'mousedown'].forEach(ev =>
        scroller.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    }

    function showCta(score, total) {
      const cta = document.getElementById('jp-stories-end-cta');
      if (!cta) return;
      const pct = total ? Math.round(score / total * 100) : 0;
      markStoryDone(pct); // persist completion + best score (shows on cover + path)
      cta.hidden = false;
      if (pct >= 60) {
        const hasNext = currentIndex < storyList.length - 1;
        cta.textContent = hasNext
          ? `${score}/${total} correct — try the next story →`
          : `${score}/${total} correct — nice!`;
        cta.onclick = () => {
          if (hasNext) { currentIndex++; loadStory(storyList[currentIndex]); }
          else renderSelector();
        };
      } else {
        cta.textContent = `${score}/${total} — give it another read`;
        cta.onclick = () => { loadStory(storyList[currentIndex]); };
      }
    }

    // Restore previously locked-in answers so the quiz resumes after going back
    // into the story (or an app close). Visual + tally only — no sound replay or
    // re-flagging of missed terms; a complete set re-shows the CTA.
    const saved = loadQuizAnswers(data.id);
    Object.keys(saved).forEach(qiStr => {
      const qi = parseInt(qiStr, 10);
      const q = data.comprehension.questions[qi];
      const wrapper = card.querySelector('.jp-story-q[data-qi="' + qi + '"]');
      if (!q || !wrapper || wrapper.dataset.answered) return;
      const a = saved[qiStr] || {};
      if (isWrittenQ(q)) applyWrittenResolved(wrapper, q, a.text || '', !!a.isRight);
      else applyMcqResolved(wrapper, q, typeof a.oi === 'number' ? a.oi : -1);
      wrapper.dataset.answered = '1';
      answered++;
      if (a.isRight) correct++;
    });
    if (totalQs && answered === totalQs) showCta(correct, totalQs);
  }

  // ── Split a synthetic conjugated id (e.g. "v_ureshii_plain_past_adj") into
  //    {rootId, form}. Returns null when id doesn't end in a known rule key.
  function splitConjugatedId(id) {
    if (!id || !CONJUGATION_RULES) return null;
    const rules = Object.keys(CONJUGATION_RULES);
    // Try longest rule key first to avoid mis-matching prefixes (e.g.
    // "polite_past_negative" vs "polite_past").
    const sorted = rules.slice().sort((a, b) => b.length - a.length);
    for (const ruleKey of sorted) {
      const suffix = '_' + ruleKey;
      if (id.endsWith(suffix)) {
        const rootId = id.slice(0, -suffix.length);
        if (rootId) return { rootId, form: ruleKey };
      }
    }
    return null;
  }

  // ── HTML escape ──────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) { return escHtml(s); }

  // ── Public API ───────────────────────────────────────────────────────────
  return { start: start };
})();

// Backwards-compat shims: the existing launcher buttons call StoryModule and
// CustomStoriesModule. Route both through the new StoriesModule with the
// right category. Remove these shims after one production release.
window.StoryModule = window.StoryModule || {
  start: function (container, config, exit, deepLinkId) {
    window.StoriesModule.start(container, config, exit, deepLinkId, { category: 'curriculum' });
  }
};
window.CustomStoriesModule = window.CustomStoriesModule || {
  start: function (container, config, exit, deepLinkId) {
    window.StoriesModule.start(container, config, exit, deepLinkId, { category: 'custom' });
  }
};
