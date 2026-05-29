/**
 * app/shared/tts-settings.js
 * Main Settings modal.
 *
 * Despite the filename (kept for backwards compatibility with every gear-button
 * callsite — `window.JPShared.ttsSettings.open()` is wired across the app),
 * this module renders the *entire* settings surface, organized into sections:
 *
 *   1. Profile    — first name (drives the home greeting), surname, email
 *   2. Companion  — Rikizo presence + My Stamp
 *   3. Voice      — Japanese voice + speed + test sample
 *   4. Upgrades   — teaser cards (AI Tutor subscription, Custom Lessons one-off)
 *
 * Design system matches the Review / FinalReview / Stories retheme:
 *   - washi background, ink-on-washi headers, vermilion accent
 *   - white rounded cards with subtle shadow + hairline border
 *   - Schibsted Grotesk via the shared --font-ui token
 *
 * Depends on: tts.js, stamp-settings.js, user-profile.js, rikizo-companion.js
 * (each is optional — sections that lack their dependency are simply skipped).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var overlay = null;
  var isOpen = false;

  // --- Inject styles once ---
  var styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var css = `
      /* ====== Settings modal — redesign system ====== */
      .jp-set-overlay {
        position: fixed; inset: 0;
        background: oklch(0.22 0.012 60 / 0.55);
        z-index: 9999;
        display: flex; align-items: stretch; justify-content: center;
        animation: jpSetFadeIn 0.18s ease;
        -webkit-overflow-scrolling: touch;
      }
      @keyframes jpSetFadeIn { from { opacity: 0; } to { opacity: 1; } }

      .jp-set-modal {
        background: var(--washi, #f5f1e8);
        width: 100%;
        max-width: 480px;
        margin: auto;
        max-height: 100vh;
        display: flex; flex-direction: column;
        box-shadow: 0 24px 60px rgba(0,0,0,0.28);
        font-family: var(--font-ui, "Schibsted Grotesk", "Work Sans", system-ui, sans-serif);
        color: var(--ink, #1a1816);
        overflow: hidden;
      }
      @media (min-width: 520px) {
        .jp-set-modal { max-height: 90vh; border-radius: 22px; margin: auto; }
      }

      .jp-set-header {
        background: var(--ink, #1a1816);
        color: var(--washi, #f5f1e8);
        padding: max(20px, env(safe-area-inset-top)) 20px 16px;
        display: flex; align-items: center; justify-content: space-between;
        position: sticky; top: 0; z-index: 2;
        border-bottom: 1px solid oklch(1 0 0 / 0.08);
      }
      .jp-set-header h3 {
        margin: 0; font-size: 1.05rem; font-weight: 700;
        letter-spacing: -0.01em;
        display: flex; align-items: center; gap: 8px;
      }
      .jp-set-close {
        background: oklch(1 0 0 / 0.10);
        border: 1px solid oklch(1 0 0 / 0.18);
        color: var(--washi, #f5f1e8);
        width: 32px; height: 32px;
        border-radius: 999px;
        font-size: 0.95rem; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
        padding: 0;
      }
      @media (hover: hover) { .jp-set-close:hover { background: oklch(1 0 0 / 0.20); } }
      .jp-set-close:active { transform: scale(0.94); }

      .jp-set-body {
        flex: 1;
        overflow-y: auto;
        padding: 18px 16px max(28px, env(safe-area-inset-bottom));
        -webkit-overflow-scrolling: touch;
      }

      /* Section label between cards (small uppercase, ink-3) */
      .jp-set-section-label {
        font-family: var(--font-mono, "JetBrains Mono", ui-monospace, Menlo, monospace);
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin: 18px 6px 8px;
        font-weight: 600;
      }
      .jp-set-section-label:first-child { margin-top: 6px; }

      /* Card container */
      .jp-set-card {
        background: #fff;
        border-radius: 18px;
        padding: 18px;
        border: 1px solid var(--hairline-2, oklch(0.22 0.012 60 / 0.06));
        box-shadow: 0 4px 14px rgba(0,0,0,0.04);
        margin-bottom: 4px;
      }
      .jp-set-card + .jp-set-card { margin-top: 10px; }

      /* Field row */
      .jp-set-field { margin-bottom: 14px; }
      .jp-set-field:last-child { margin-bottom: 0; }
      .jp-set-field-label {
        display: flex; align-items: center; gap: 6px;
        font-weight: 600; font-size: 0.78rem;
        color: var(--ink-2, oklch(0.32 0.012 60));
        margin-bottom: 7px;
        text-transform: uppercase; letter-spacing: 0.06em;
      }
      .jp-set-required {
        color: var(--vermilion, #c2410c);
        font-weight: 700;
      }

      /* Inputs */
      .jp-set-input,
      .jp-set-select {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid var(--hairline, oklch(0.22 0.012 60 / 0.12));
        border-radius: 12px;
        font-size: 0.98rem;
        background: var(--washi-2, #efebe2);
        color: var(--ink, #1a1816);
        font-family: inherit;
        transition: border-color 0.15s, background 0.15s;
        box-sizing: border-box;
      }
      .jp-set-input { background: #fff; }
      .jp-set-input::placeholder { color: var(--ink-3, oklch(0.55 0.012 60)); }
      .jp-set-input:focus,
      .jp-set-select:focus {
        outline: none;
        border-color: var(--vermilion, #c2410c);
        background: #fff;
      }
      .jp-set-select { cursor: pointer; appearance: auto; }

      .jp-set-help {
        font-size: 0.78rem;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin-top: 8px;
        line-height: 1.45;
        font-style: italic;
      }
      .jp-set-help strong { font-style: normal; color: var(--ink, #1a1816); }

      /* Speed slider */
      .jp-set-speed-row {
        display: flex; align-items: center; gap: 12px;
      }
      .jp-set-speed-row input[type="range"] {
        flex: 1;
        accent-color: var(--vermilion, #c2410c);
        height: 6px;
      }
      .jp-set-speed-val {
        font-weight: 700; font-size: 0.92rem;
        color: var(--vermilion, #c2410c);
        min-width: 48px; text-align: center;
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
      }
      .jp-set-speed-ticks {
        display: flex; justify-content: space-between;
        font-size: 0.7rem; color: var(--ink-3, oklch(0.55 0.012 60)); margin-top: 4px;
      }

      /* Primary action button */
      .jp-set-btn {
        width: 100%;
        padding: 13px 16px;
        background: var(--ink, #1a1816);
        color: var(--washi, #f5f1e8);
        border: none;
        border-radius: 12px;
        font-weight: 600; font-size: 0.95rem;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
        font-family: inherit;
        letter-spacing: -0.01em;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      }
      @media (hover: hover) { .jp-set-btn:hover { opacity: 0.9; } }
      .jp-set-btn:active { transform: scale(0.98); }

      .jp-set-no-voices {
        background: oklch(0.78 0.10 85 / 0.18);
        border: 1px solid oklch(0.78 0.10 85 / 0.35);
        border-radius: 12px;
        padding: 11px 14px;
        font-size: 0.85rem;
        color: var(--ink, #1a1816);
        line-height: 1.5;
        margin-top: 8px;
      }
      .jp-set-no-voices strong { color: var(--vermilion-ink, #9a330a); }

      /* Stamp picker */
      .jp-stamp-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        margin-top: 4px;
      }
      .jp-stamp-option {
        position: relative;
        aspect-ratio: 1;
        border: 2px solid var(--hairline, oklch(0.22 0.012 60 / 0.12));
        border-radius: 12px;
        cursor: pointer;
        overflow: hidden;
        background: var(--washi-2, #efebe2);
        transition: border-color 0.15s, transform 0.12s;
        display: flex; align-items: center; justify-content: center;
      }
      .jp-stamp-option img {
        width: 86%; height: 86%; object-fit: contain; pointer-events: none;
      }
      .jp-stamp-option.selected {
        border-color: var(--vermilion, #c2410c);
        box-shadow: 0 0 0 3px oklch(0.60 0.18 30 / 0.18);
        background: #fff;
      }
      @media (hover: hover) {
        .jp-stamp-option:hover { border-color: var(--vermilion, #c2410c); transform: scale(1.04); }
      }
      .jp-stamp-option:active { transform: scale(0.95); }
      .jp-stamp-name {
        position: absolute; bottom: 0; left: 0; right: 0;
        background: oklch(0.22 0.012 60 / 0.62);
        color: var(--washi, #f5f1e8);
        font-size: 0.54rem; font-weight: 600;
        text-align: center; padding: 2px 0; line-height: 1.2;
        letter-spacing: 0.04em;
      }
      .jp-stamp-preview {
        display: flex; align-items: center; gap: 10px;
        margin-top: 12px;
        padding: 10px 14px;
        background: var(--washi-2, #efebe2);
        border-radius: 12px;
        border: 1px solid var(--hairline-2, oklch(0.22 0.012 60 / 0.06));
      }
      .jp-stamp-preview img { width: 40px; height: 40px; object-fit: contain; }
      .jp-stamp-preview-text {
        font-size: 0.88rem; font-weight: 600; color: var(--ink, #1a1816);
      }

      /* Upgrade card */
      .jp-set-upgrade {
        background: #fff;
        border: 1px solid var(--hairline-2, oklch(0.22 0.012 60 / 0.06));
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.04);
        position: relative;
        overflow: hidden;
      }
      .jp-set-upgrade + .jp-set-upgrade { margin-top: 10px; }
      .jp-set-upgrade-head {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 8px;
      }
      .jp-set-upgrade-icon {
        width: 36px; height: 36px;
        border-radius: 10px;
        background: oklch(0.60 0.18 30 / 0.12);
        color: var(--vermilion, #c2410c);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.05rem;
        flex-shrink: 0;
      }
      .jp-set-upgrade-title {
        font-size: 1rem; font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--ink, #1a1816);
      }
      .jp-set-upgrade-kind {
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
        font-size: 0.62rem;
        text-transform: uppercase; letter-spacing: 0.16em;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin-top: 1px;
      }
      .jp-set-upgrade-body {
        font-size: 0.88rem; line-height: 1.5;
        color: var(--ink-2, oklch(0.32 0.012 60));
        margin-bottom: 12px;
      }
      .jp-set-upgrade-cta {
        width: 100%;
        padding: 10px 14px;
        background: var(--washi-2, #efebe2);
        color: var(--ink-2, oklch(0.32 0.012 60));
        border: 1px dashed var(--hairline, oklch(0.22 0.012 60 / 0.2));
        border-radius: 999px;
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
        font-size: 0.7rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.18em;
        cursor: not-allowed;
      }

      /* ====== Shared globals — kept stable; used outside the modal ====== */
      .jp-settings-gear {
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.34);
        color: #fff;
        width: 34px; height: 34px;
        border-radius: 8px;
        cursor: pointer; font-size: 1.05rem;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.18s;
        padding: 0; flex-shrink: 0;
      }
      @media (hover: hover) { .jp-settings-gear:hover { background: rgba(255,255,255,0.32); } }

      .jp-settings-gear-menu {
        background: oklch(0.22 0.012 60 / 0.06);
        border: 1px solid oklch(0.22 0.012 60 / 0.10);
        color: var(--ink-2, oklch(0.32 0.012 60));
        width: 38px; height: 38px;
        border-radius: 50%;
        cursor: pointer; font-size: 1.25rem;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.18s, color 0.18s;
        padding: 0;
        position: absolute; top: 15px; right: 15px;
      }
      @media (hover: hover) {
        .jp-settings-gear-menu:hover {
          background: oklch(0.22 0.012 60 / 0.12);
          color: var(--vermilion, #c2410c);
        }
      }

      .jp-speak-sentence {
        background: none; border: none; cursor: pointer;
        font-size: 0.85rem; opacity: 0.45;
        padding: 2px 4px; margin-left: 4px;
        transition: opacity 0.18s;
        vertical-align: middle; flex-shrink: 0;
      }
      @media (hover: hover) { .jp-speak-sentence:hover { opacity: 0.85; } }
      .jp-speak-sentence:active { transform: scale(0.9); }

      .jp-speak-all-btn {
        background: oklch(0.60 0.18 30 / 0.08);
        border: 1px solid oklch(0.60 0.18 30 / 0.22);
        color: var(--vermilion-ink, #9a330a);
        padding: 6px 14px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.8rem; font-weight: 600;
        transition: all 0.18s;
        display: inline-flex; align-items: center; gap: 5px;
        margin-bottom: 10px;
      }
      @media (hover: hover) {
        .jp-speak-all-btn:hover {
          background: oklch(0.60 0.18 30 / 0.14);
          border-color: oklch(0.60 0.18 30 / 0.40);
        }
      }
      .jp-speak-all-btn:active { transform: scale(0.97); }
      .jp-speak-all-btn.jp-speak-all-active {
        background: oklch(0.55 0.18 30 / 0.14);
        border-color: oklch(0.55 0.18 30 / 0.36);
        color: var(--vermilion-ink, #9a330a);
      }

      /* Toggle row (Reading Aids and any future on/off settings) */
      .jp-set-toggle-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
      }
      .jp-set-toggle-row + .jp-set-toggle-row {
        border-top: 1px solid var(--hairline-2, oklch(0.22 0.012 60 / 0.06));
      }
      .jp-set-toggle-label {
        flex: 1;
        font-size: 0.92rem; font-weight: 600;
        color: var(--ink, #1a1816);
      }
      .jp-set-toggle-sub {
        display: block;
        font-size: 0.78rem; font-weight: 500;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin-top: 2px;
        font-style: italic;
      }
      .jp-set-switch {
        position: relative;
        flex-shrink: 0;
        width: 50px; height: 30px;
        cursor: pointer;
      }
      .jp-set-switch input { opacity: 0; width: 0; height: 0; }
      .jp-set-switch-slider {
        position: absolute; inset: 0;
        background: var(--hairline, oklch(0.22 0.012 60 / 0.20));
        border-radius: 999px;
        transition: background 0.18s;
      }
      .jp-set-switch-slider::before {
        content: '';
        position: absolute;
        height: 24px; width: 24px;
        left: 3px; top: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.18s;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }
      .jp-set-switch input:checked + .jp-set-switch-slider {
        background: var(--vermilion, #c2410c);
      }
      .jp-set-switch input:checked + .jp-set-switch-slider::before {
        transform: translateX(20px);
      }
    `;
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ---- Section builders ----

  function buildProfileSection() {
    var up = window.JPShared.userProfile;
    var p = up ? up.get() : { first: '', last: '', email: '' };
    var esc = function (s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
    return (
      '<div class="jp-set-section-label">Profile</div>' +
      '<div class="jp-set-card">' +
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">First name <span class="jp-set-required">*</span></div>' +
          '<input type="text" class="jp-set-input" id="jp-set-first" autocomplete="given-name" ' +
            'placeholder="Your first name" value="' + esc(p.first) + '" maxlength="40">' +
        '</div>' +
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">Surname</div>' +
          '<input type="text" class="jp-set-input" id="jp-set-last" autocomplete="family-name" ' +
            'placeholder="Optional" value="' + esc(p.last) + '" maxlength="60">' +
        '</div>' +
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">Email</div>' +
          '<input type="email" class="jp-set-input" id="jp-set-email" autocomplete="email" ' +
            'inputmode="email" placeholder="Optional" value="' + esc(p.email) + '" maxlength="120">' +
        '</div>' +
        '<div class="jp-set-help" id="jp-set-name-help">' +
          (p.first
            ? 'Home will greet you as <strong>' + esc(p.first) + '-san</strong>.'
            : 'Set a first name to be greeted by it on the home screen instead of <strong>Rikizo-san</strong>.') +
        '</div>' +
      '</div>'
    );
  }

  function buildCompanionSection() {
    var rc = window.JPShared.rikizoCompanion;
    var stampApi = window.JPShared.stampSettings;
    if (!rc && !stampApi) return '';

    var presenceHtml = '';
    if (rc) {
      var current = rc.getPresence();
      var opts = [
        { v: 'contextual', label: 'Just when needed', desc: 'Greetings & guidance only' },
        { v: 'home',       label: 'On the home screen', desc: 'Idles on Home, follows into lessons' },
        { v: 'always',     label: 'Always with me', desc: 'Walks along on every screen' }
      ];
      var options = opts.map(function (o) {
        var sel = o.v === current ? ' selected' : '';
        return '<option value="' + o.v + '"' + sel + '>' + o.label + ' — ' + o.desc + '</option>';
      }).join('');
      presenceHtml =
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">🦝 Rikizo presence</div>' +
          '<select class="jp-set-select" id="jp-rikizo-presence">' + options + '</select>' +
        '</div>';
    }

    var stampHtml = '';
    if (stampApi) {
      var characters = stampApi.getCharactersCache();
      if (characters && characters.length > 0) {
        var selectedId = stampApi.getSelected();
        var resolveUrl = stampApi.resolveUrl || function (p) { return p; };
        var grid = characters.filter(function (c) { return c.portrait; }).map(function (c) {
          var sel = c.id === selectedId ? ' selected' : '';
          return '<div class="jp-stamp-option' + sel + '" data-char-id="' + c.id + '" title="' + c.meaning + '">' +
            '<img src="' + resolveUrl(c.portrait) + '" alt="' + c.meaning + '">' +
            '<div class="jp-stamp-name">' + c.meaning + '</div>' +
          '</div>';
        }).join('');
        var selectedChar = characters.find(function (c) { return c.id === selectedId; });
        var previewName = selectedChar ? selectedChar.meaning : 'Rikizo';
        var previewSrc = resolveUrl(selectedChar && selectedChar.portrait
          ? selectedChar.portrait
          : 'assets/characters/rikizo/rikizo_head.png');
        stampHtml =
          '<div class="jp-set-field">' +
            '<div class="jp-set-field-label">My stamp</div>' +
            '<div class="jp-stamp-grid" id="jp-stamp-grid">' + grid + '</div>' +
            '<div class="jp-stamp-preview" id="jp-stamp-preview">' +
              '<img src="' + previewSrc + '" id="jp-stamp-preview-img">' +
              '<span class="jp-stamp-preview-text" id="jp-stamp-preview-text">' + previewName + ' is your stamp!</span>' +
            '</div>' +
          '</div>';
      }
    }

    if (!presenceHtml && !stampHtml) return '';

    return (
      '<div class="jp-set-section-label">Companion</div>' +
      '<div class="jp-set-card">' + presenceHtml + stampHtml + '</div>'
    );
  }

  // Tutorials — a single master switch. When on, the first-launch onboarding
  // tour and every contextual Rikizo tutorial step are suppressed.
  function buildTutorialsSection() {
    var rc = window.JPShared && window.JPShared.rikizoCompanion;
    if (!rc || !rc.setTutorialsSkipped) return '';
    var skip = rc.tutorialsSkipped();
    function row(id, label, sub, checked) {
      return (
        '<label class="jp-set-toggle-row" for="' + id + '">' +
          '<div>' +
            '<span class="jp-set-toggle-label">' + label + '</span>' +
            '<span class="jp-set-toggle-sub">' + sub + '</span>' +
          '</div>' +
          '<span class="jp-set-switch">' +
            '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
            '<span class="jp-set-switch-slider"></span>' +
          '</span>' +
        '</label>'
      );
    }
    return (
      '<div class="jp-set-section-label">Tutorials</div>' +
      '<div class="jp-set-card">' +
        row('jp-set-skip-tutorials', 'Skip tutorials',
            'Turn off Rikizo&rsquo;s onboarding tour and in-app walkthroughs.', skip) +
      '</div>'
    );
  }

  function buildVoiceSection() {
    var tts = window.JPShared.tts;
    if (!tts) return '';
    // Curated Chirp 3 HD voices (a fixed list from tts.js) — not device voices.
    var voices = tts.getVoices();
    var current = tts.getSelectedVoice();
    var currentURI = current ? current.uri : '';
    var rate = tts.getRate();

    var voiceOptions = voices.map(function (v) {
      var sel = (v.uri === currentURI) ? ' selected' : '';
      var label = v.label || v.name || v.uri;
      if (v.gender) label += ' · ' + v.gender;
      return '<option value="' + String(v.uri).replace(/"/g, '&quot;') + '"' + sel + '>' +
             label.replace(/</g, '&lt;') + '</option>';
    }).join('');

    return (
      '<div class="jp-set-section-label">Voice</div>' +
      '<div class="jp-set-card">' +
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">Japanese voice</div>' +
          '<select class="jp-set-select" id="jp-tts-voice-select">' + voiceOptions + '</select>' +
        '</div>' +
        '<div class="jp-set-field">' +
          '<div class="jp-set-field-label">Speed</div>' +
          '<div class="jp-set-speed-row">' +
            '<input type="range" id="jp-tts-speed" min="0.5" max="1.5" step="0.05" value="' + rate + '">' +
            '<span class="jp-set-speed-val" id="jp-tts-speed-val">' + rate.toFixed(2) + 'x</span>' +
          '</div>' +
          '<div class="jp-set-speed-ticks"><span>Slow</span><span>Normal</span><span>Fast</span></div>' +
        '</div>' +
        '<div class="jp-set-field">' +
          '<button class="jp-set-btn" id="jp-tts-test">' +
            '🔊 Test voice — 「こんにちは、元気ですか。」' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  // Reading Aids — furigana + romaji toggles. State lives in localStorage via
  // window.JPShared.jpText; this section is skipped if the module isn't loaded.
  function buildReadingAidsSection() {
    var rk = window.JPShared && window.JPShared.jpText;
    if (!rk) return '';
    var furiOn = rk.isFuriganaOn();
    var romaOn = rk.isRomajiOn();
    function row(id, label, sub, checked) {
      return (
        '<label class="jp-set-toggle-row" for="' + id + '">' +
          '<div>' +
            '<span class="jp-set-toggle-label">' + label + '</span>' +
            '<span class="jp-set-toggle-sub">' + sub + '</span>' +
          '</div>' +
          '<span class="jp-set-switch">' +
            '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
            '<span class="jp-set-switch-slider"></span>' +
          '</span>' +
        '</label>'
      );
    }
    return (
      '<div class="jp-set-section-label">Reading Aids</div>' +
      '<div class="jp-set-card">' +
        row('jp-set-furigana', 'Furigana',
            'Small hiragana above every kanji.', furiOn) +
        row('jp-set-romaji', 'Romaji',
            'Latin spelling underneath kanji and kana.', romaOn) +
      '</div>'
    );
  }

  // Practice Helpers — opt-in companion modules. The section is structured to
  // host more toggles over time; future helpers should add a row here, persist
  // via window.JPShared.practiceHelpers, and rely on its onChange pubsub so the
  // surfaces that conditionally render them re-evaluate without a remount.
  function buildPracticeHelpersSection() {
    var ph = window.JPShared && window.JPShared.practiceHelpers;
    if (!ph) return '';
    var kanaOn = ph.getKanaWriting();
    function row(id, label, sub, checked) {
      return (
        '<label class="jp-set-toggle-row" for="' + id + '">' +
          '<div>' +
            '<span class="jp-set-toggle-label">' + label + '</span>' +
            '<span class="jp-set-toggle-sub">' + sub + '</span>' +
          '</div>' +
          '<span class="jp-set-switch">' +
            '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
            '<span class="jp-set-switch-slider"></span>' +
          '</span>' +
        '</label>'
      );
    }
    return (
      '<div class="jp-set-section-label">Practice Helpers</div>' +
      '<div class="jp-set-card">' +
        row('jp-set-kana-writing', 'Kana Writing Practice',
            'Practice writing hiragana &amp; katakana, stroke by stroke.', kanaOn) +
        // Future helpers: add more row(...) calls here.
      '</div>'
    );
  }

  // Tiny credits line at the bottom of the modal body. Currently only carries
  // the KanjiVG attribution required by CC-BY-SA 4.0.
  function buildCreditsSection() {
    return (
      '<div style="margin: 24px 6px 6px; font-size: 0.68rem; line-height: 1.5; ' +
        'color: var(--ink-3, oklch(0.55 0.012 60)); text-align: center; opacity: 0.8;">' +
        'Kanji stroke data derived from ' +
        '<strong style="font-weight:600;">KanjiVG</strong> ' +
        '(<a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener" ' +
          'style="color: var(--ink-2, oklch(0.32 0.012 60)); text-decoration: underline;">' +
          'kanjivg.tagaini.net</a>) · CC-BY-SA 4.0.' +
      '</div>'
    );
  }

  function buildUpgradesSection() {
    // Teaser cards only — no purchase flow yet. CTAs are visually disabled.
    return (
      '<div class="jp-set-section-label">Upgrades</div>' +
      '<div class="jp-set-upgrade">' +
        '<div class="jp-set-upgrade-head">' +
          '<div class="jp-set-upgrade-icon">🎓</div>' +
          '<div>' +
            '<div class="jp-set-upgrade-title">AI Tutor</div>' +
            '<div class="jp-set-upgrade-kind">Monthly subscription</div>' +
          '</div>' +
        '</div>' +
        '<div class="jp-set-upgrade-body">' +
          'Real-time conversation practice with an AI tutor tuned to your level. ' +
          'Get corrections, explanations, and roleplay scenarios on demand.' +
        '</div>' +
        '<button class="jp-set-upgrade-cta" disabled>Coming soon</button>' +
      '</div>' +
      '<div class="jp-set-upgrade">' +
        '<div class="jp-set-upgrade-head">' +
          '<div class="jp-set-upgrade-icon">✨</div>' +
          '<div>' +
            '<div class="jp-set-upgrade-title">Custom Lessons</div>' +
            '<div class="jp-set-upgrade-kind">One-time purchase</div>' +
          '</div>' +
        '</div>' +
        '<div class="jp-set-upgrade-body">' +
          'Bespoke lessons built around your life — your name, your job, your hobbies, ' +
          'the places you actually visit. Yours forever once made.' +
        '</div>' +
        '<button class="jp-set-upgrade-cta" disabled>Coming soon</button>' +
      '</div>'
    );
  }

  function buildModal() {
    var html =
      '<div class="jp-set-modal" role="dialog" aria-label="Settings">' +
        '<div class="jp-set-header">' +
          '<h3>⚙️ Settings</h3>' +
          '<button class="jp-set-close" id="jp-set-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="jp-set-body">' +
          buildProfileSection() +
          buildCompanionSection() +
          buildTutorialsSection() +
          buildVoiceSection() +
          buildReadingAidsSection() +
          buildPracticeHelpersSection() +
          buildUpgradesSection() +
          buildCreditsSection() +
        '</div>' +
      '</div>';
    return html;
  }

  // ---- Wire interactions ----

  function wireProfile() {
    var up = window.JPShared.userProfile;
    if (!up) return;
    var first = document.getElementById('jp-set-first');
    var last  = document.getElementById('jp-set-last');
    var email = document.getElementById('jp-set-email');
    var help  = document.getElementById('jp-set-name-help');
    var esc   = function (s) { return String(s || '').replace(/</g, '&lt;'); };

    function commit() {
      up.set({
        first: first ? first.value : undefined,
        last:  last  ? last.value  : undefined,
        email: email ? email.value : undefined
      });
      if (help) {
        var f = (first && first.value || '').trim();
        help.innerHTML = f
          ? 'Home will greet you as <strong>' + esc(f) + '-san</strong>.'
          : 'Set a first name to be greeted by it on the home screen instead of <strong>Rikizo-san</strong>.';
      }
    }

    [first, last, email].forEach(function (el) {
      if (!el) return;
      // Persist on blur (avoids re-firing on every keystroke), and live-update the help line.
      el.addEventListener('blur', commit);
      if (el === first) {
        el.addEventListener('input', function () {
          if (!help) return;
          var f = (first.value || '').trim();
          help.innerHTML = f
            ? 'Home will greet you as <strong>' + esc(f) + '-san</strong>.'
            : 'Set a first name to be greeted by it on the home screen instead of <strong>Rikizo-san</strong>.';
        });
      }
    });
  }

  function wireCompanion() {
    var stampGrid = document.getElementById('jp-stamp-grid');
    var stampApi = window.JPShared.stampSettings;
    if (stampGrid && stampApi) {
      stampGrid.addEventListener('click', function (e) {
        var option = e.target.closest('.jp-stamp-option');
        if (!option) return;
        var charId = option.dataset.charId;
        stampApi.setSelected(charId);
        stampGrid.querySelectorAll('.jp-stamp-option').forEach(function (o) {
          o.classList.toggle('selected', o.dataset.charId === charId);
        });
        var characters = stampApi.getCharactersCache() || [];
        var ch = characters.find(function (c) { return c.id === charId; });
        var previewImg = document.getElementById('jp-stamp-preview-img');
        var previewText = document.getElementById('jp-stamp-preview-text');
        var resolveFn = stampApi.resolveUrl || function (p) { return p; };
        if (ch && previewImg) previewImg.src = resolveFn(ch.portrait);
        if (ch && previewText) previewText.textContent = ch.meaning + ' is your stamp!';
      });
    }

    var presenceSelect = document.getElementById('jp-rikizo-presence');
    if (presenceSelect && window.JPShared.rikizoCompanion) {
      presenceSelect.addEventListener('change', function () {
        window.JPShared.rikizoCompanion.setPresence(this.value);
      });
    }
  }

  function wireVoice() {
    var tts = window.JPShared.tts;
    if (!tts) return;

    var voiceSelect = document.getElementById('jp-tts-voice-select');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', function () { tts.setVoice(this.value); });
    }

    var speedSlider = document.getElementById('jp-tts-speed');
    var speedVal = document.getElementById('jp-tts-speed-val');
    if (speedSlider && speedVal) {
      speedSlider.addEventListener('input', function () {
        var r = parseFloat(this.value);
        speedVal.textContent = r.toFixed(2) + 'x';
        tts.setRate(r);
      });
    }

    var testBtn = document.getElementById('jp-tts-test');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        tts.speak('こんにちは、元気ですか。今日はいい天気ですね。');
      });
    }
  }

  // ---- Open / close ----

  async function open() {
    if (isOpen) return;
    injectStyles();
    isOpen = true;

    // Preload characters for the stamp picker.
    var stampApi = window.JPShared.stampSettings;
    if (stampApi && typeof stampApi.loadCharacters === 'function') {
      try { await stampApi.loadCharacters(); } catch (e) { /* picker just hides */ }
    }

    overlay = document.createElement('div');
    overlay.className = 'jp-set-overlay';
    overlay.innerHTML = buildModal();
    document.body.appendChild(overlay);

    // Backdrop click closes.
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    // X button closes.
    var closeBtn = document.getElementById('jp-set-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    wireProfile();
    wireCompanion();
    wireVoice();
    wireReadingAids();
    wirePracticeHelpers();
    wireTutorials();
  }

  function wireTutorials() {
    var rc = window.JPShared && window.JPShared.rikizoCompanion;
    if (!rc || !rc.setTutorialsSkipped) return;
    var skip = document.getElementById('jp-set-skip-tutorials');
    if (skip) skip.addEventListener('change', function () { rc.setTutorialsSkipped(skip.checked); });
  }

  function wirePracticeHelpers() {
    var ph = window.JPShared && window.JPShared.practiceHelpers;
    if (!ph) return;
    var kana = document.getElementById('jp-set-kana-writing');
    if (kana) {
      kana.addEventListener('change', function () {
        ph.setKanaWriting(kana.checked);
      });
    }
  }

  function wireReadingAids() {
    var rk = window.JPShared && window.JPShared.jpText;
    if (!rk) return;
    var furi = document.getElementById('jp-set-furigana');
    var roma = document.getElementById('jp-set-romaji');
    if (furi) furi.addEventListener('change', function () { rk.setFurigana(furi.checked); });
    if (roma) roma.addEventListener('change', function () { rk.setRomaji(roma.checked); });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    // Ensure any unsaved input is committed (blur often fires automatically on
    // remove, but being explicit avoids losing a typed name on backdrop tap).
    var up = window.JPShared.userProfile;
    if (up) {
      var f = document.getElementById('jp-set-first');
      var l = document.getElementById('jp-set-last');
      var e = document.getElementById('jp-set-email');
      up.set({
        first: f ? f.value : undefined,
        last:  l ? l.value : undefined,
        email: e ? e.value : undefined
      });
    }

    if (window.JPShared.tts) window.JPShared.tts.cancel();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  // Inject styles immediately so external gear/speaker buttons render correctly
  // even before the modal is ever opened.
  injectStyles();

  // ---- Public API ----
  // Name kept as `ttsSettings` for backwards-compat with every gear-button
  // callsite; `settings` is the forward-looking alias.
  var api = {
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };
  window.JPShared.ttsSettings = api;
  window.JPShared.settings = api;

})();
