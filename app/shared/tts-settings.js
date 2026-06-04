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

      /* Account / sign-in field (replaces the old email input) */
      .jp-set-account-btn {
        width: 100%;
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 12px 14px;
        border: 1.5px solid var(--hairline, oklch(0.22 0.012 60 / 0.12));
        border-radius: 12px;
        background: #fff;
        color: var(--ink, #1a1816);
        font-family: inherit; font-size: 0.95rem;
        cursor: pointer; text-align: left;
        transition: border-color 0.15s, background 0.15s;
      }
      @media (hover: hover) {
        .jp-set-account-btn:not([disabled]):hover { border-color: var(--vermilion, #c2410c); }
      }
      .jp-set-account-btn[disabled] {
        cursor: default; opacity: 0.6; background: var(--washi-2, #efebe2);
      }
      .jp-set-account-state {
        display: inline-flex; align-items: center; gap: 7px;
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--ink-2, oklch(0.32 0.012 60));
      }
      .jp-set-account-state strong {
        font-weight: 600; color: var(--ink, #1a1816);
      }
      .jp-set-account-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--moss, #5f8a4e); flex-shrink: 0;
      }
      .jp-set-account-action {
        flex-shrink: 0;
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
        font-size: 0.66rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: var(--ink-3, oklch(0.55 0.012 60));
      }
      .jp-set-account-action-cta { color: var(--vermilion, #c2410c); }

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

      /* AI Tutor drill-down row (a card that behaves like a button) */
      button.jp-set-drilldown {
        display: block; width: 100%; text-align: left;
        font: inherit; cursor: pointer;
        -webkit-appearance: none; appearance: none;
        transition: box-shadow 0.18s, transform 0.06s;
      }
      button.jp-set-drilldown:active { transform: scale(0.995); }
      @media (hover: hover) {
        button.jp-set-drilldown:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
      }
      .jp-set-drilldown .jp-set-upgrade-head { align-items: center; }
      .jp-set-drill-chevron {
        margin-left: auto;
        font-size: 1.5rem; line-height: 1;
        color: var(--ink-3, oklch(0.55 0.012 60));
        flex-shrink: 0;
      }

      /* Drill-down sub-panel header (Back) */
      .jp-set-subhead {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 4px;
      }
      .jp-set-back {
        background: none; border: none; padding: 4px 2px;
        cursor: pointer;
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
        font-size: 0.78rem; font-weight: 700;
        color: var(--vermilion, #c2410c);
        letter-spacing: 0.02em;
      }
      .jp-set-subtitle {
        font-size: 1.02rem; font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--ink, #1a1816);
      }
      .jp-set-tier-intro {
        font-size: 0.82rem; line-height: 1.45;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin: 2px 0 14px;
      }

      /* Tier cards */
      .jp-set-tier {
        background: #fff;
        border: 1px solid var(--hairline-2, oklch(0.22 0.012 60 / 0.06));
        border-radius: 18px;
        padding: 16px 18px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.04);
      }
      .jp-set-tier + .jp-set-tier { margin-top: 10px; }
      .jp-set-tier-active {
        border-color: var(--moss, #5f8a4e);
        box-shadow: 0 0 0 1px var(--moss, #5f8a4e), 0 4px 14px rgba(0,0,0,0.04);
      }
      .jp-set-tier-top {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 10px;
      }
      .jp-set-tier-name {
        font-size: 1.05rem; font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--ink, #1a1816);
      }
      .jp-set-tier-badge {
        font-family: var(--font-mono, ui-monospace, Menlo, monospace);
        font-size: 0.56rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.14em;
        color: #fff; background: var(--moss, #5f8a4e);
        padding: 2px 6px; border-radius: 999px;
        vertical-align: middle; margin-left: 4px;
      }
      .jp-set-tier-price {
        font-size: 1.15rem; font-weight: 700;
        color: var(--ink, #1a1816);
        white-space: nowrap;
      }
      .jp-set-tier-cadence {
        font-size: 0.72rem; font-weight: 600;
        color: var(--ink-3, oklch(0.55 0.012 60));
        margin-left: 1px;
      }
      .jp-set-tier-tagline {
        font-size: 0.84rem; font-style: italic;
        color: var(--ink-2, oklch(0.32 0.012 60));
        margin: 3px 0 10px;
      }
      .jp-set-tier-perks {
        list-style: none; margin: 0 0 14px; padding: 0;
      }
      .jp-set-tier-perks li {
        position: relative;
        padding: 3px 0 3px 22px;
        font-size: 0.88rem; line-height: 1.45;
        color: var(--ink-2, oklch(0.32 0.012 60));
      }
      .jp-set-tier-perks li::before {
        content: '✓';
        position: absolute; left: 2px; top: 3px;
        color: var(--moss, #5f8a4e);
        font-weight: 700; font-size: 0.82rem;
      }
      .jp-set-tier-cta {
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
      .jp-set-tier-cta-on {
        background: var(--moss, #5f8a4e);
        color: #fff;
        border: 1px solid var(--moss, #5f8a4e);
        cursor: pointer;
      }
      @media (hover: hover) {
        .jp-set-tier-cta-on:hover { filter: brightness(1.06); }
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
      '<div class="jp-set-card" data-tour-set="profile">' +
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
        buildAccountField() +
        '<div class="jp-set-help" id="jp-set-name-help">' +
          (p.first
            ? 'Home will greet you as <strong>' + esc(p.first) + '-san</strong>.'
            : 'Set a first name to be greeted by it on the home screen instead of <strong>Rikizo-san</strong>.') +
        '</div>' +
      '</div>' +
      buildUnlockCodeCard() +
      buildImportCard()
    );
  }

  // ---- TEMP: one-time progress importer ----
  // Migrates a student's progress out of the OLD Webflow app and into this one.
  // The student exports a code there (Export button / console snippet), pastes it
  // here, and we OVERWRITE this app's progress keys with it. Remove this card once
  // the handful of existing students are migrated. Tracked by REMOVE-AFTER-MIGRATION.
  function buildImportCard() {
    return (
      '<div class="jp-set-section-label">Import old progress</div>' +
      '<div class="jp-set-card">' +
        '<div class="jp-set-help" style="margin-top:0;">' +
          'Moving from the old web app? Paste the progress code you exported there. ' +
          'This <strong>merges</strong> with your progress here — it never lowers ' +
          'a score or removes an unlock.' +
        '</div>' +
        '<div class="jp-set-field" style="margin-top:10px;">' +
          '<textarea class="jp-set-input" id="jp-set-import-code" rows="3" ' +
            'placeholder="Paste your progress code here" ' +
            'style="resize:vertical;font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:0.8rem;"></textarea>' +
        '</div>' +
        '<button class="jp-set-account-btn" id="jp-set-import-btn" type="button" ' +
            'style="justify-content:center;font-weight:700;">Import progress</button>' +
        '<div class="jp-set-help" id="jp-set-import-status" style="min-height:1.2em;"></div>' +
      '</div>'
    );
  }

  // Unlock-code entry. A teacher/beta code (e.g. a founding-student code) seeds
  // the right unlock state. Codes merge with progress (never lower it) and are
  // re-applied after an import, so order never matters. See unlock-codes.js.
  function buildUnlockCodeCard() {
    return (
      '<div class="jp-set-section-label">Unlock code</div>' +
      '<div class="jp-set-card">' +
        '<div class="jp-set-help" style="margin-top:0;">' +
          'Have a code? Enter it to unlock content for your level.' +
        '</div>' +
        '<div class="jp-set-field" style="margin-top:10px;">' +
          '<input class="jp-set-input" id="jp-set-unlock-code" type="text" ' +
            'autocapitalize="off" autocomplete="off" spellcheck="false" ' +
            'placeholder="Enter code" ' +
            'style="font-family:var(--font-mono,ui-monospace,Menlo,monospace);">' +
        '</div>' +
        '<button class="jp-set-account-btn" id="jp-set-unlock-btn" type="button" ' +
            'style="justify-content:center;font-weight:700;">Apply code</button>' +
        '<div class="jp-set-help" id="jp-set-unlock-status" style="min-height:1.2em;"></div>' +
      '</div>'
    );
  }

  // Account / sign-in field — sits where the email field used to. Replaces the
  // standalone email capture with the real Firebase account flow (auth.js).
  // When auth is unconfigured (inert build) it shows a disabled "unavailable"
  // state so the row still reads sensibly.
  function buildAccountField() {
    var auth = window.JPShared && window.JPShared.auth;
    var esc = function (s) { return String(s || '').replace(/</g, '&lt;'); };

    if (!auth || !auth.isEnabled()) {
      return (
        '<div class="jp-set-field" id="jp-set-account-field">' +
          '<div class="jp-set-field-label">Account</div>' +
          '<button class="jp-set-account-btn" id="jp-set-account-btn" type="button" disabled>' +
            '<span class="jp-set-account-state">Sign-in unavailable</span>' +
          '</button>' +
        '</div>'
      );
    }

    var u = auth.currentUser && auth.currentUser();
    var signedIn = !!(u && !u.isAnonymous && u.email);

    var inner;
    if (signedIn) {
      inner =
        '<span class="jp-set-account-state">' +
          '<span class="jp-set-account-dot"></span>' +
          'Signed in · <strong>' + esc(u.email) + '</strong>' +
        '</span>' +
        '<span class="jp-set-account-action">Manage</span>';
    } else {
      inner =
        '<span class="jp-set-account-state">Not signed in</span>' +
        '<span class="jp-set-account-action jp-set-account-action-cta">Sign in</span>';
    }

    return (
      '<div class="jp-set-field" id="jp-set-account-field">' +
        '<div class="jp-set-field-label">Account</div>' +
        '<button class="jp-set-account-btn" id="jp-set-account-btn" type="button">' +
          inner +
        '</button>' +
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
      '<div class="jp-set-card" data-tour-set="companion">' + presenceHtml + stampHtml + '</div>'
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
      '<div class="jp-set-card" data-tour-set="tutorials">' +
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
      '<div class="jp-set-card" data-tour-set="voice">' +
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
  function buildSoundSection() {
    var sfx = window.JPShared && window.JPShared.sfx;
    var hap = window.JPShared && window.JPShared.haptics;
    if (!sfx && !hap) return '';
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
    var rows = '';
    if (sfx) rows += row('jp-set-sfx', 'Sound effects', 'Taps, page turns, and answer chimes.', sfx.enabled());
    if (hap) rows += row('jp-set-haptics', 'Haptics', 'Vibration feedback on supported devices.', hap.isEnabled());
    return (
      '<div class="jp-set-section-label">Sound &amp; Haptics</div>' +
      '<div class="jp-set-card" data-tour-set="sound">' + rows + '</div>'
    );
  }

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
      '<div class="jp-set-card" data-tour-set="aids">' +
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
      '<div class="jp-set-card" data-tour-set="helpers">' +
        row('jp-set-kana-writing', 'Kana Writing Practice',
            'Practice writing hiragana &amp; katakana, stroke by stroke.', kanaOn) +
        // Future helpers: add more row(...) calls here.
      '</div>'
    );
  }

  // Tiny credits line at the bottom of the modal body. Currently only carries
  // the KanjiVG attribution required by CC-BY-SA 4.0.
  // Beta: report-a-bug + app version. (The "Check for updates" action is wired in
  // Phase 3 once Firebase Hosting is live; for now it shows the bundled build.)
  function buildAboutSection() {
    var ver = window.JPShared && window.JPShared.diagnostics && window.JPShared.diagnostics.version();
    var verLabel = ver && ver.buildNumber != null
      ? ('v' + (ver.appVersion || '?') + ' · Build ' + ver.buildNumber)
      : '';
    return (
      '<div class="jp-set-section-label">App</div>' +
      '<div class="jp-set-card" data-tour-set="about">' +
        '<button class="jp-set-account-btn" id="jp-set-bug-btn" type="button" ' +
            'style="justify-content:space-between;">' +
          '<span class="jp-set-account-state">🐞 Report a bug</span>' +
          '<span class="jp-set-account-action jp-set-account-action-cta">Report</span>' +
        '</button>' +
        (verLabel
          ? '<div class="jp-set-help" style="text-align:center;margin-top:10px;">' + verLabel + '</div>'
          : '') +
      '</div>'
    );
  }

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
      '<div data-tour-set="upgrades">' +
      // AI Tutor → drills down into the tier menu (buildTutorPlansPanel).
      '<button class="jp-set-upgrade jp-set-drilldown" id="jp-set-tutor-drill" type="button">' +
        '<div class="jp-set-upgrade-head">' +
          '<div class="jp-set-upgrade-icon">🎓</div>' +
          '<div>' +
            '<div class="jp-set-upgrade-title">AI Tutor</div>' +
            '<div class="jp-set-upgrade-kind">' + tutorDrillKind() + '</div>' +
          '</div>' +
          '<div class="jp-set-drill-chevron">›</div>' +
        '</div>' +
        '<div class="jp-set-upgrade-body">' +
          'Tap Rikizo anywhere in the app to ask about whatever you\'re studying. ' +
          'See plans &amp; turn on the free beta.' +
        '</div>' +
      '</button>' +
      // Custom Content → drills down into the custom-content menu.
      '<button class="jp-set-upgrade jp-set-drilldown" id="jp-set-custom-drill" type="button">' +
        '<div class="jp-set-upgrade-head">' +
          '<div class="jp-set-upgrade-icon">✨</div>' +
          '<div>' +
            '<div class="jp-set-upgrade-title">Custom Content</div>' +
            '<div class="jp-set-upgrade-kind">' + customDrillKind() + '</div>' +
          '</div>' +
          '<div class="jp-set-drill-chevron">›</div>' +
        '</div>' +
        '<div class="jp-set-upgrade-body">' +
          'Content that targets what you struggle with — built from your flagged ' +
          'items, questions, and test scores. See what\'s coming &amp; turn on the demo.' +
        '</div>' +
      '</button>' +
      '</div>'
    );
  }

  // Subtitle on the AI Tutor drill-down row — reflects current beta state.
  function tutorDrillKind() {
    var to = window.JPShared && window.JPShared.tutorOverlay;
    return (to && to.isEnabled()) ? 'Free beta · ON' : 'Subscription plans';
  }

  // Subtitle on the Custom Content drill-down row.
  function customDrillKind() {
    return customEnabled() ? 'Demo module · ON' : 'Personalized content';
  }

  // ---- AI Tutor plans drill-down ----
  // Demo-only tier menu. The free tier's button actually enables/disables the
  // ambient overlay (reuses tutorOverlay.enable/disable). The three paid tiers
  // are disabled teasers that explain what each unlocks.
  var TUTOR_TIERS = [
    {
      id: 'free', name: 'Free', price: '$0', cadence: '',
      tagline: 'The beta, on the house.',
      perks: [
        '5 questions a day',
        'Ask about any vocab, grammar or kanji you\'re studying',
        'Type or talk — Rikizo answers right where you are',
        'Answers cite the exact lesson it was taught'
      ],
      free: true
    },
    {
      id: 'lite', name: 'Lite', price: '$9.99', cadence: '/mo',
      tagline: 'Room to lean on Rikizo every day.',
      perks: [
        '10 questions a day',
        'Everything in Free',
        'Priority answers'
      ]
    },
    {
      id: 'standard', name: 'Standard', price: '$24.99', cadence: '/mo',
      tagline: 'Talk it through, out loud.',
      perks: [
        '50 questions a day',
        '2 live tutor sessions a week',
        'Back-and-forth voice conversation with Rikizo',
        'Everything in Lite'
      ]
    },
    {
      id: 'premium', name: 'Premium', price: '$49.99', cadence: '/mo',
      tagline: 'Rikizo on call.',
      perks: [
        'Unlimited questions',
        'A live tutor session every day',
        'First access to new tutor features',
        'Everything in Standard'
      ]
    }
  ];

  function tutorTierEnabled() {
    var to = window.JPShared && window.JPShared.tutorOverlay;
    return !!(to && to.isEnabled());
  }

  function buildTutorPlansPanel() {
    var on = tutorTierEnabled();
    var cards = TUTOR_TIERS.map(function (t) {
      var btn;
      if (t.free) {
        btn = '<button class="jp-set-tier-cta jp-set-tier-cta-on" id="jp-set-tier-free">' +
          (on ? 'Turn off' : 'Enable') + '</button>';
      } else {
        btn = '<button class="jp-set-tier-cta" disabled>Coming soon</button>';
      }
      var perks = t.perks.map(function (p) {
        return '<li>' + p + '</li>';
      }).join('');
      return (
        '<div class="jp-set-tier' + (t.free && on ? ' jp-set-tier-active' : '') + '">' +
          '<div class="jp-set-tier-top">' +
            '<div class="jp-set-tier-name">' + t.name +
              (t.free && on ? ' <span class="jp-set-tier-badge">ACTIVE</span>' : '') +
            '</div>' +
            '<div class="jp-set-tier-price">' + t.price +
              (t.cadence ? '<span class="jp-set-tier-cadence">' + t.cadence + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="jp-set-tier-tagline">' + t.tagline + '</div>' +
          '<ul class="jp-set-tier-perks">' + perks + '</ul>' +
          btn +
        '</div>'
      );
    }).join('');

    return (
      '<div class="jp-set-subhead">' +
        '<button class="jp-set-back" id="jp-set-tutor-back" aria-label="Back">‹ Back</button>' +
        '<div class="jp-set-subtitle">AI Tutor plans</div>' +
      '</div>' +
      '<div class="jp-set-tier-intro">Choose a plan. The free beta is live now — paid tiers are a preview.</div>' +
      cards
    );
  }

  function openTutorPlans() {
    var body = overlay && overlay.querySelector('.jp-set-body');
    if (!body) return;
    body.innerHTML = buildTutorPlansPanel();
    body.scrollTop = 0;
    wireTutorPlans();
  }

  function closeTutorPlans() {
    var body = overlay && overlay.querySelector('.jp-set-body');
    if (!body) return;
    body.innerHTML = buildModalBody();
    body.scrollTop = 0;
    rewireBody();
  }

  function wireTutorPlans() {
    var back = document.getElementById('jp-set-tutor-back');
    if (back) back.addEventListener('click', closeTutorPlans);

    var freeBtn = document.getElementById('jp-set-tier-free');
    var to = window.JPShared && window.JPShared.tutorOverlay;
    if (freeBtn && to) {
      freeBtn.addEventListener('click', function () {
        if (to.isEnabled()) {
          to.disable();
          openTutorPlans(); // re-render to flip the button + ACTIVE badge
        } else {
          to.enable();
          // Close settings so the student can see Rikizo's face appear.
          close();
        }
      });
    }
  }

  // ---- Custom Content drill-down ----
  // Demo-only. "Enable" sets k-custom-enabled, which surfaces a Custom tile on
  // the home module grid (see index.html _moduleGrid). The three sub-features
  // are disabled teasers describing what custom content will offer.
  var CUSTOM_KEY = 'k-custom-enabled';

  function customEnabled() {
    try { return localStorage.getItem(CUSTOM_KEY) === '1'; } catch (e) { return false; }
  }
  function setCustomEnabled(on) {
    try { localStorage.setItem(CUSTOM_KEY, on ? '1' : '0'); } catch (e) {}
  }

  var CUSTOM_FEATURES = [
    {
      icon: '📖', name: 'Custom Stories',
      body: 'Stories that weave in the vocab and grammar you\'ve struggled with — ' +
            'and star you, your town, and the people in your life along the way.'
    },
    {
      icon: '🎓', name: 'Custom Lessons',
      body: 'Targeted lessons built from your flagged items, the questions you asked ' +
            'Rikizo, and your weakest test scores — so you drill exactly what trips you up.'
    },
    {
      icon: '📝', name: 'Custom Test',
      body: 'A quiz focused on your problem areas, then re-tuned each time from your ' +
            'latest results to keep closing the gaps.'
    }
  ];

  function buildCustomPanel() {
    var on = customEnabled();
    var enableCard =
      '<div class="jp-set-tier' + (on ? ' jp-set-tier-active' : '') + '">' +
        '<div class="jp-set-tier-top">' +
          '<div class="jp-set-tier-name">Custom module' +
            (on ? ' <span class="jp-set-tier-badge">ON</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="jp-set-tier-tagline">' +
          (on ? 'Live on your home screen.' : 'Turn on the demo tile on your home screen.') +
        '</div>' +
        '<button class="jp-set-tier-cta jp-set-tier-cta-on" id="jp-set-custom-enable">' +
          (on ? 'Disable' : 'Enable') +
        '</button>' +
      '</div>';

    var featureCards = CUSTOM_FEATURES.map(function (f) {
      return (
        '<div class="jp-set-tier">' +
          '<div class="jp-set-tier-top">' +
            '<div class="jp-set-tier-name">' + f.icon + ' ' + f.name + '</div>' +
          '</div>' +
          '<div class="jp-set-tier-tagline">' + f.body + '</div>' +
          '<button class="jp-set-tier-cta" disabled>Coming soon</button>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="jp-set-subhead">' +
        '<button class="jp-set-back" id="jp-set-custom-back" aria-label="Back">‹ Back</button>' +
        '<div class="jp-set-subtitle">Custom Content</div>' +
      '</div>' +
      '<div class="jp-set-tier-intro">Content that targets your weak spots — built from ' +
        'your flagged items, the questions you\'ve asked, and your test scores. Enable the ' +
        'demo module now; the pieces below are a preview.</div>' +
      enableCard +
      featureCards
    );
  }

  function openCustomPanel() {
    var body = overlay && overlay.querySelector('.jp-set-body');
    if (!body) return;
    body.innerHTML = buildCustomPanel();
    body.scrollTop = 0;
    wireCustomPanel();
  }

  function closeCustomPanel() {
    var body = overlay && overlay.querySelector('.jp-set-body');
    if (!body) return;
    body.innerHTML = buildModalBody();
    body.scrollTop = 0;
    rewireBody();
  }

  function wireCustomPanel() {
    var back = document.getElementById('jp-set-custom-back');
    if (back) back.addEventListener('click', closeCustomPanel);

    var enableBtn = document.getElementById('jp-set-custom-enable');
    if (enableBtn) {
      enableBtn.addEventListener('click', function () {
        setCustomEnabled(!customEnabled());
        if (customEnabled()) {
          // Close settings so the student sees the new home tile appear.
          close();
          if (window.JPApp && window.JPApp._view === 'home' &&
              typeof window.JPApp.renderMenu === 'function') {
            window.JPApp.renderMenu();
          }
        } else {
          openCustomPanel(); // re-render to flip the button + badge
        }
      });
    }
  }

  function buildModalBody() {
    return (
      buildProfileSection() +
      buildCompanionSection() +
      buildTutorialsSection() +
      buildVoiceSection() +
      buildSoundSection() +
      buildReadingAidsSection() +
      buildPracticeHelpersSection() +
      buildUpgradesSection() +
      buildAboutSection() +
      buildCreditsSection()
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
          buildModalBody() +
        '</div>' +
      '</div>';
    return html;
  }

  // Re-attach every body-level interaction. Called on first open and after
  // returning from the AI Tutor drill-down (which replaces the body HTML).
  function rewireBody() {
    wireProfile();
    wireCompanion();
    wireVoice();
    wireSound();
    wireReadingAids();
    wirePracticeHelpers();
    wireTutorials();
    wireUpgrades();
    wireAbout();
  }

  function wireSound() {
    var sfx = window.JPShared && window.JPShared.sfx;
    var hap = window.JPShared && window.JPShared.haptics;
    var s = document.getElementById('jp-set-sfx');
    if (s && sfx) s.addEventListener('change', function () {
      sfx.setEnabled(s.checked);
      if (s.checked) sfx.tap(); // confirmation blip when turning on
    });
    var h = document.getElementById('jp-set-haptics');
    if (h && hap) h.addEventListener('change', function () {
      hap.setEnabled(h.checked);
      if (h.checked) hap.light();
    });
  }

  function wireAbout() {
    var bug = document.getElementById('jp-set-bug-btn');
    var br = window.JPShared && window.JPShared.bugReport;
    if (bug && br && br.open) {
      bug.addEventListener('click', function () { br.open(); });
    }
  }

  // ---- Wire interactions ----

  function wireProfile() {
    var up = window.JPShared.userProfile;
    if (!up) return;
    var first = document.getElementById('jp-set-first');
    var last  = document.getElementById('jp-set-last');
    var help  = document.getElementById('jp-set-name-help');
    var esc   = function (s) { return String(s || '').replace(/</g, '&lt;'); };

    function commit() {
      up.set({
        first: first ? first.value : undefined,
        last:  last  ? last.value  : undefined
      });
      if (help) {
        var f = (first && first.value || '').trim();
        help.innerHTML = f
          ? 'Home will greet you as <strong>' + esc(f) + '-san</strong>.'
          : 'Set a first name to be greeted by it on the home screen instead of <strong>Rikizo-san</strong>.';
      }
    }

    [first, last].forEach(function (el) {
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

    wireAccount();
    wireImport();
    wireUnlockCode();
  }

  // Wire the unlock-code field → window.JPShared.unlockCodes.apply().
  function wireUnlockCode() {
    var btn = document.getElementById('jp-set-unlock-btn');
    var input = document.getElementById('jp-set-unlock-code');
    var status = document.getElementById('jp-set-unlock-status');
    if (!btn || !input) return;

    function say(msg, ok) {
      if (!status) return;
      status.textContent = msg;
      status.style.color = ok === false ? 'var(--vermilion, #c2410c)'
        : ok === true ? 'var(--moss, #5f8a4e)' : '';
      status.style.fontStyle = 'normal';
    }

    function applyNow() {
      var codes = window.JPShared && window.JPShared.unlockCodes;
      if (!codes) { say('Unlock system not ready — reopen Settings.', false); return; }
      var raw = (input.value || '').trim();
      if (!raw) { say('Enter a code first.', false); return; }
      var res = codes.apply(raw);
      if (!res.ok) {
        say(res.reason === 'unknown' ? 'That code isn’t recognized.'
          : res.reason === 'no_manifest' ? 'Couldn’t load the curriculum — try again.'
          : 'Enter a valid code.', false);
        return;
      }
      var c = res.counts || {};
      var n = (c.lessons || 0) + (c.grammar || 0) + (c.reviews || 0) + (c.stories || 0);
      say('✓ ' + (res.def && res.def.blurb ? res.def.blurb : 'Code applied') +
          ' (' + n + ' items unlocked).', true);
      input.value = '';
    }

    btn.addEventListener('click', applyNow);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyNow(); }
    });
  }

  // ---- TEMP: import wiring (REMOVE-AFTER-MIGRATION) ----
  // Synced progress keys we accept from the old app. Mirrors sync.js EXACT/PREFIXES
  // so an import flows straight up to the cloud on next push.
  var IMPORT_EXACT = [
    'k-lesson-scores', 'k-lesson-completed', 'k-review-scores',
    'k-flags', 'k-active-flags', 'k-n4-unlocked',
    'k-streak-current', 'k-streak-best', 'k-streak-last-active',
    'k-streak-history', 'k-streak-freezes',
    'k-user-first', 'k-user-last',
  ];
  var IMPORT_PREFIXES = ['k-best-', 'compose-draft-'];

  function importKeyAllowed(k) {
    if (!k) return false;
    if (IMPORT_EXACT.indexOf(k) >= 0) return true;
    for (var i = 0; i < IMPORT_PREFIXES.length; i++) {
      if (k.indexOf(IMPORT_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function wireImport() {
    var btn = document.getElementById('jp-set-import-btn');
    var ta = document.getElementById('jp-set-import-code');
    var status = document.getElementById('jp-set-import-status');
    if (!btn || !ta) return;

    function say(msg, ok) {
      if (!status) return;
      status.innerHTML = msg;
      status.style.color = ok === false ? 'var(--vermilion, #c2410c)'
        : ok === true ? 'var(--moss, #5f8a4e)'
        : '';
      status.style.fontStyle = 'normal';
    }

    btn.addEventListener('click', function () {
      var raw = (ta.value || '').trim();
      if (!raw) { say('Paste your progress code first.', false); return; }

      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        say('That code isn’t valid — copy it again from the old app.', false);
        return;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        say('That code doesn’t look like exported progress.', false);
        return;
      }

      // Keep only recognized k-*/compose-draft- keys; ignore anything else.
      var keys = Object.keys(data).filter(importKeyAllowed);
      if (!keys.length) {
        say('No progress found in that code.', false);
        return;
      }

      // MERGE-MAX (not overwrite): combine imported progress with what's already
      // here, keeping the HIGHER value per key. This makes import coexist safely
      // with unlock codes in ANY order — neither can wipe the other. Mirrors the
      // cloud-sync merge semantics (max score / OR completion / union arrays).
      try {
        keys.forEach(function (k) {
          mergeImportedKey(k, data[k]);
        });
        // Re-apply any unlock codes so an import can never drop their floor.
        if (window.JPShared.unlockCodes && window.JPShared.unlockCodes.reapplyAll) {
          window.JPShared.unlockCodes.reapplyAll();
        }
      } catch (e) {
        say('Import failed: ' + (e && e.message ? e.message : 'unknown error') + '.', false);
        return;
      }

      // Count what landed, for a confident confirmation.
      var lessons = countObj(data['k-lesson-completed']) || countObj(data['k-lesson-scores']);
      var flags = countObj(data['k-flags']) || countObj(data['k-active-flags']);
      say('✓ Imported — ' + lessons + ' lessons, ' + flags + ' flags merged. ' +
          (isSignedInForSync() ? 'Backing up to your account…' : 'Sign in to back it up.'), true);

      // Push to the cloud if signed in; refresh Home so unlocks/greeting reflect it.
      try { if (window.JPShared.sync && window.JPShared.sync.push) window.JPShared.sync.push(); } catch (e) {}
      try {
        if (window.JPApp && window.JPApp._view === 'home' && window.JPApp.renderMenu) {
          window.JPApp.renderMenu();
        }
      } catch (e) {}
    });
  }

  // Merge one imported key into localStorage, keeping the higher/combined value.
  // Object maps of numbers → per-key max (scores). Object maps of bools → OR
  // (completion/active-flags). Arrays → union. 'true'/'false' flags → OR-true.
  // Plain numbers → max. Anything else (e.g. compose-draft strings) → keep the
  // imported value only if there's nothing local (don't clobber a newer draft).
  function mergeImportedKey(k, incoming) {
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }
    var rawLocal = lsGet(k);

    // Boolean-ish flag (e.g. k-n4-unlocked).
    if (incoming === true || incoming === false || incoming === 'true' || incoming === 'false') {
      var on = (incoming === true || incoming === 'true') || rawLocal === 'true';
      lsSet(k, on ? 'true' : 'false');
      return;
    }

    // Object map: decide number-max vs bool-OR by sampling values.
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      var localObj = {};
      try { localObj = JSON.parse(rawLocal || '{}') || {}; } catch (e) { localObj = {}; }
      var merged = {};
      var key2;
      for (key2 in localObj) if (Object.prototype.hasOwnProperty.call(localObj, key2)) merged[key2] = localObj[key2];
      for (key2 in incoming) {
        if (!Object.prototype.hasOwnProperty.call(incoming, key2)) continue;
        var iv = incoming[key2], lv = merged[key2];
        if (typeof iv === 'number' || typeof lv === 'number') {
          merged[key2] = Math.max(+iv || 0, +lv || 0);            // scores
        } else if (typeof iv === 'boolean' || typeof lv === 'boolean') {
          merged[key2] = !!iv || !!lv;                            // completion flags
        } else {
          merged[key2] = (lv !== undefined ? lv : iv);            // keep existing
        }
      }
      lsSet(k, JSON.stringify(merged));
      return;
    }

    // Array (e.g. streak history) → union.
    if (Array.isArray(incoming)) {
      var localArr = [];
      try { localArr = JSON.parse(rawLocal || '[]') || []; } catch (e) { localArr = []; }
      var set = {};
      localArr.concat(incoming).forEach(function (x) { set[x] = 1; });
      lsSet(k, JSON.stringify(Object.keys(set)));
      return;
    }

    // Plain number (e.g. streak-current/best) → max.
    if (typeof incoming === 'number') {
      var ln = parseFloat(rawLocal); if (!isFinite(ln)) ln = 0;
      lsSet(k, String(Math.max(incoming, ln)));
      return;
    }

    // String / other: only write if there's no local value (don't clobber).
    if (rawLocal == null) lsSet(k, typeof incoming === 'string' ? incoming : JSON.stringify(incoming));
  }

  function countObj(o) {
    if (!o || typeof o !== 'object') return 0;
    return Object.keys(o).length;
  }
  function isSignedInForSync() {
    var a = window.JPShared && window.JPShared.auth;
    var u = a && a.currentUser && a.currentUser();
    return !!(u && !u.isAnonymous);
  }

  // Wire the Account field: tapping it opens the existing auth.js account modal,
  // and an auth-state listener refreshes the field in place when the user signs
  // in/out without leaving Settings.
  function wireAccount() {
    var auth = window.JPShared && window.JPShared.auth;
    if (!auth || !auth.isEnabled()) return;

    var btn = document.getElementById('jp-set-account-btn');
    if (btn && auth.openAccountUI) {
      btn.addEventListener('click', function () { auth.openAccountUI(); });
    }

    // Refresh the field on sign-in/out. Registered once per modal open; the node
    // is replaced on close so a stale listener simply finds nothing to update.
    if (!accountListenerBound && auth.onChange) {
      accountListenerBound = true;
      auth.onChange(function () { refreshAccountField(); });
    }
  }

  var accountListenerBound = false;

  function refreshAccountField() {
    if (!isOpen) return;
    var field = document.getElementById('jp-set-account-field');
    if (!field || !field.parentNode) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = buildAccountField();
    var fresh = wrap.firstChild;
    field.parentNode.replaceChild(fresh, field);
    // Re-attach the click handler to the new button.
    var auth = window.JPShared && window.JPShared.auth;
    var btn = document.getElementById('jp-set-account-btn');
    if (btn && auth && auth.openAccountUI && auth.isEnabled()) {
      btn.addEventListener('click', function () { auth.openAccountUI(); });
    }
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

    rewireBody();

    // First time Settings is opened, Rikizo walks through the (now sizeable)
    // panel. No-ops on later opens (seen-key) or when tutorials are skipped.
    var rc = window.JPShared && window.JPShared.rikizoCompanion;
    if (rc && rc.runSettingsTutorial) {
      setTimeout(function () { rc.runSettingsTutorial(); }, 350);
    }
  }

  function wireUpgrades() {
    // AI Tutor card drills down into the tier menu (buildTutorPlansPanel).
    var drill = document.getElementById('jp-set-tutor-drill');
    if (drill) drill.addEventListener('click', openTutorPlans);
    // Custom Content card drills down into the custom-content menu.
    var customDrill = document.getElementById('jp-set-custom-drill');
    if (customDrill) customDrill.addEventListener('click', openCustomPanel);
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
      up.set({
        first: f ? f.value : undefined,
        last:  l ? l.value : undefined
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
