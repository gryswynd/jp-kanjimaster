window.GrammarModule = {
  start: function (container, sharedConfig, exitCallback, grammarId) {

    // --- CONFIGURATION ---
    const REPO_CONFIG = sharedConfig;
    if (window.JPShared.stampSettings) window.JPShared.stampSettings.setConfig(REPO_CONFIG);

    // --- Grammar Colors ---
    const GRAMMAR_COLORS = {
      topic:       '#6C5CE7',
      subject:     '#0984E3',
      object:      '#00B894',
      verb:        '#D63031',
      particle:    '#FDCB6E',
      destination: '#E17055',
      location:    '#00CEC9',
      modifier:    '#A29BFE',
      time:        '#FAB1A0',
      connector:   '#FD79A8',
      predicate:   '#D63031',
    };

    // --- State ---
    let currentStep = 0;
    let totalSteps = 0;
    let grammarData = null;
    let termMapData = {};
    let showEN = false;
    let drillCorrect = 0;
    let drillTotal = 0;
    const drillAnswered = new Set();
    const sectionScores = {};
    const completedSteps = new Set();
    let CONJUGATION_RULES = null;
    let COUNTER_RULES = null;
    let currentGrammars = [];
    // `grammarId` is declared by the start() parameter above — no redeclaration here.
    let _manifestCache = null; // stored for unlock engine calls

    // --- Setup UI Container ---
    container.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'jp-grammar-app-root';
    container.appendChild(root);

    // --- Fonts ---
    if (!document.getElementById('jp-fonts')) {
      const link = document.createElement('link');
      link.id = 'jp-fonts';
      link.rel = 'stylesheet';
      link.href = 'app/shared/fonts.css';
      document.head.appendChild(link);
    }

    // --- Styles ---
    if (!document.getElementById('jp-grammar-style')) {
      const style = document.createElement('style');
      style.id = 'jp-grammar-style';
      style.textContent = `
        #jp-grammar-app-root {
          --gr-primary: #5E8C5F;
          --gr-primary-dark: #4A7A4C;
          --washi: oklch(0.97 0.008 80); --washi-2: oklch(0.94 0.012 75); --washi-3: oklch(0.90 0.015 75);
          --ink: oklch(0.22 0.012 60); --ink-2: oklch(0.38 0.012 60); --ink-3: oklch(0.55 0.012 60);
          --hairline: oklch(0.22 0.012 60 / 0.12); --hairline-2: oklch(0.22 0.012 60 / 0.06);
          --vermilion: oklch(0.60 0.18 30); --moss: oklch(0.58 0.09 140);
          --indigo: oklch(0.42 0.08 250); --gold: oklch(0.78 0.10 85);
          --font-jp-display: "Noto Serif JP","Shippori Mincho",serif;
          --font-mono: "JetBrains Mono",ui-monospace,Menlo,monospace;
          --text-main: oklch(0.22 0.012 60); --text-sub: oklch(0.55 0.012 60);
          font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
          color: var(--text-main);
          background:
            radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
            radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
            var(--washi);
          display: flex; flex-direction: column;
          width: 100%; min-height: 100vh; min-height: 100dvh; position: relative;
        }
        #jp-grammar-app-root * { box-sizing: border-box; }

        .gr-header {
          background: var(--washi);
          padding: max(28px,env(safe-area-inset-top)) 18px 14px; color: var(--ink);
          border-bottom: 1px solid var(--hairline);
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 10;
        }
        .gr-title { font-weight: 600; font-size: 17px; color: var(--ink); font-family: var(--font-jp-display); }
        .gr-progress-container { height: 4px; width: 100%; background: var(--hairline); }
        .gr-progress-bar { height: 100%; background: var(--vermilion); width: 0%; transition: width 0.3s ease; }
        .gr-body { padding: 22px 18px; flex: 1; overflow-y: auto; background: transparent; display: flex; flex-direction: column; }
        .gr-footer {
          padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); background: var(--washi); border-top: 1px solid var(--hairline);
          display: flex; gap: 10px; justify-content: space-between;
          position: sticky; bottom: 0; z-index: 10;
        }
        .gr-nav-btn {
          padding: 12px 24px; border-radius: 999px; border: none; font-weight: 600; cursor: pointer;
          font-size: 14px; transition: transform 0.1s;
        }
        .gr-nav-btn:active { transform: scale(0.96); }
        .gr-nav-btn.prev { background: transparent; color: var(--ink-2); border: 1px solid var(--hairline); }
        .gr-nav-btn.next { flex: 1; background: var(--ink); color: var(--washi); }
        .gr-nav-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .gr-exit-btn { background: transparent; border: 1px solid var(--hairline); color: var(--ink-2); padding: 6px 14px; border-radius: 999px; cursor: pointer; font-weight: 600; font-size: 0.8rem; }
        .gr-back-btn { background: transparent; color: var(--ink-2); border: 1px solid var(--hairline); border-radius: 999px; padding: 6px 12px; cursor: pointer; font-weight: 600; font-size: 0.85rem; margin-right: 10px; }
        @media (hover: hover) { .gr-back-btn:hover { color: var(--ink); } }
        .jp-settings-gear { background: transparent; border: 1px solid var(--hairline); color: var(--ink-2); width: 32px; height: 32px; border-radius: 999px; cursor: pointer; }

        .gr-card { background: #F3EEE4; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid oklch(0.22 0.012 60 / 0.12); }
        .gr-card-white { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.02); }

        /* Menu */
        .gr-menu-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .gr-menu-item {
          background: #fff; padding: 18px 20px; border-radius: 16px; cursor: pointer;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid rgba(0,0,0,0.02); text-align: left;
          display: flex; justify-content: space-between; align-items: center;
        }
        @media (hover: hover) { .gr-menu-item:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); border-color: var(--gr-primary); } }
        .gr-menu-item.locked { opacity: 0.55; cursor: default; }
        @media (hover: hover) { .gr-menu-item.locked:hover { transform: none; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-color: transparent; } }
        .gr-menu-icon { font-size: 1.5rem; margin-right: 12px; }
        .gr-menu-id { font-weight: 900; color: #5E8C5F; font-size: 1rem; }
        .gr-menu-name { font-size: 0.8rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .gr-menu-badge { font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
        .gr-menu-badge.lock { background: #EDE7DA; color: #999; }
        .gr-menu-level-header { font-size: 1.1rem; font-weight: 900; color: #5E8C5F; padding: 8px 0 4px; letter-spacing: 1px; }
        .gr-menu-stamp { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .gr-menu-stamp img { width: 100%; height: 100%; object-fit: contain; opacity: 0.85; }
        @keyframes grStampPop { 0% { transform: scale(2) rotate(0deg); opacity: 0; } 60% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 0.85; } }
        .gr-menu-stamp img { animation: grStampPop 0.3s ease; }
        .gr-menu-right { display: flex; align-items: center; gap: 8px; }
        .gr-menu-score { font-size: 0.75rem; font-weight: 700; color: #5E8C5F; }

        /* ── Grammar Garden scene (menu) ──────────────────────────────────
           Scene CSS standardizes on the GLOBAL :root tokens (--moss/--gold/
           --vermilion/--ink*). The legacy --gr-primary above stays for the
           grammar-PLAYING screens; do not reference it from these classes. */
        .gr-body-garden { padding: 0; display: block; }
        .gr-garden {
          position: relative; width: 100%; overflow: hidden;
          background-image:
            var(--garden-tile, none),
            radial-gradient(130% 55% at 50% -8%, oklch(0.99 0.012 95 / 0.9), transparent 60%),
            linear-gradient(180deg, var(--washi) 0%, oklch(0.93 0.026 132) 100%);
          background-repeat: repeat-y, no-repeat, no-repeat;
          background-size: 100% auto, 100% 100%, 100% 100%;
          background-position: top center, center, center;
        }
        .gr-garden-empty {
          text-align: center; color: var(--ink-3); padding: 64px 26px;
          font-family: var(--font-jp-display); line-height: 1.85; font-size: 1rem;
        }
        /* PNG art over code-drawn fallback (sceneKit.artLayer) */
        .sk-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
        .has-art > .sk-fallback { display: none; }

        .gr-scenery { width: 84px; height: 84px; pointer-events: none; opacity: 0.9; z-index: 0; position: relative; }
        .gr-scenery .sk-fallback, .gr-scenery svg { width: 100%; height: 100%; display: block; }
        /* Once the PNG loads, hide the geometric SVG fallback. Higher specificity
           than the .gr-scenery .sk-fallback display:block rule above, which was
           overriding the generic has-art rule and bleeding the fallback through
           transparent art (the maple "blob", unrecognizable bonsai, etc.). */
        .gr-scenery.has-art > .sk-fallback { display: none; }
        /* Living pond — bigger + full opacity since koi swim in it (canvas). */
        .gr-scenery--pond { width: 124px; height: 124px; opacity: 1; }
        .gr-scenery--maple { width: 104px; height: 104px; }
        .gr-scenery--bamboo { width: 116px; height: 124px; opacity: 1; } /* shishi-odoshi canvas */
        .gr-pond-canvas, .gr-leaf-canvas, .gr-bfly-canvas, .gr-clacker-canvas { display: block; }
        .gr-bfly-canvas { z-index: 2; } /* butterfly flits above the plant */

        /* Wind sway — pivots at the base. Applied to the ART (not the placed
           .gr-scenery element, which owns its centering transform, nor the
           leaf/koi canvas, which animate themselves). */
        .gr-scenery--sway .gr-scenery-art,
        .gr-scenery--sway > .sk-fallback {
          transform-origin: 50% 92%;
          animation: grSwaySoft 5.2s ease-in-out infinite;
          animation-delay: var(--sway-delay, 0s);
        }
        .gr-scenery--bamboo .gr-scenery-art,
        .gr-scenery--bamboo > .sk-fallback { animation-name: grSway; animation-duration: 3.4s; }
        .gr-scenery--bonsai .gr-scenery-art,
        .gr-scenery--bonsai > .sk-fallback { animation-duration: 6s; }
        @keyframes grSway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes grSwaySoft { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }

        /* Torii — soft sunlight dappling drifts across the gate. */
        .gr-scenery--torii::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(55% 45% at 32% 28%, rgba(255,246,205,0.6), transparent 62%),
            radial-gradient(45% 38% at 72% 62%, rgba(255,243,200,0.4), transparent 62%);
          mix-blend-mode: soft-light;
          animation: grDapple 7.5s ease-in-out infinite;
        }
        @keyframes grDapple {
          0%, 100% { opacity: 0.4; transform: translate(-4%, -3%) scale(1); }
          50% { opacity: 0.8; transform: translate(5%, 4%) scale(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gr-scenery--sway .gr-scenery-art, .gr-scenery--sway > .sk-fallback,
          .gr-scenery--torii::after { animation: none; }
        }

        /* Base stone the lantern rests on + path stepping-stones. Painted
           watercolor PNG (stone-step.png) layers over the grey-ellipse fallback
           so the path matches the garden instead of reading as flat blobs. */
        .gr-stone { position: relative; width: 92px; height: 48px; z-index: 1; margin-top: -7px; }
        .gr-steppingstone { position: relative; width: 52px; height: 30px; z-index: 0; opacity: 0.96; }
        .gr-stone .sk-art, .gr-steppingstone .sk-art { object-fit: contain; }
        .gr-stone .sk-fallback {
          position: absolute; left: 50%; top: 26%; transform: translateX(-50%);
          width: 66px; height: 18px; border-radius: 50%;
          background: radial-gradient(ellipse at 50% 32%, oklch(0.80 0.012 250), oklch(0.62 0.012 250));
          box-shadow: 0 4px 8px oklch(0.22 0.012 60 / 0.18);
        }
        .gr-steppingstone .sk-fallback {
          position: absolute; left: 50%; top: 26%; transform: translateX(-50%);
          width: 34px; height: 12px; border-radius: 50%;
          background: radial-gradient(ellipse at 50% 32%, oklch(0.82 0.01 250), oklch(0.66 0.012 250));
          box-shadow: 0 3px 6px oklch(0.22 0.012 60 / 0.14);
        }

        .gr-lantern {
          width: 156px; display: flex; flex-direction: column; align-items: center;
          cursor: pointer; z-index: 2; -webkit-tap-highlight-color: transparent;
        }
        .gr-lantern-fig { position: relative; width: 60px; height: 92px; }
        .gr-lantern-art { object-fit: contain; }
        .gr-lantern-svg { position: relative; width: 100%; height: 100%; color: oklch(0.60 0.014 250); }
        .gr-lantern-svg svg { width: 100%; height: 100%; display: block;
          -webkit-backface-visibility: hidden; backface-visibility: hidden; }
        .gr-lantern-light { fill: oklch(0.80 0.012 250); transition: fill 0.4s ease; }
        .gr-lantern.lit .gr-lantern-svg { color: oklch(0.56 0.018 255); }
        .gr-lantern.lit .gr-lantern-light { fill: var(--gold); }
        .gr-lantern.lit .gr-lantern-svg svg {
          filter: drop-shadow(0 0 6px oklch(0.82 0.12 85)) drop-shadow(0 0 13px oklch(0.82 0.12 85 / 0.55));
        }
        .gr-lantern--next .gr-lantern-fig::after {
          content: ''; position: absolute; left: 50%; top: 46%; width: 66px; height: 66px;
          transform: translate(-50%, -50%); border-radius: 50%; z-index: -1; pointer-events: none;
          background: radial-gradient(circle, oklch(0.82 0.12 85 / 0.5), transparent 70%);
          animation: grLanternPulse 2.4s ease-in-out infinite;
        }
        @keyframes grLanternPulse {
          0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(0.9); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.12); }
        }
        /* Warm flickering glow around a LIT lantern (PNG or SVG). */
        .gr-lantern.lit .gr-lantern-fig::before {
          content: ''; position: absolute; left: 50%; top: 42%; width: 78px; height: 78px;
          transform: translate(-50%, -50%); border-radius: 50%; z-index: -1; pointer-events: none;
          background: radial-gradient(circle, oklch(0.86 0.13 85 / 0.55), transparent 68%);
          animation: grGlowFlicker 4.2s ease-in-out infinite;
        }
        @keyframes grGlowFlicker {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          28% { opacity: 0.82; transform: translate(-50%, -50%) scale(1.07); }
          46% { opacity: 0.58; transform: translate(-50%, -50%) scale(0.98); }
          68% { opacity: 0.78; transform: translate(-50%, -50%) scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gr-lantern.lit .gr-lantern-fig::before { animation: none; opacity: 0.6; }
        }
        /* readable wooden hanging sign (木札) — replaces the trailing-off label */
        .gr-lantern-sign {
          position: relative; margin-top: 13px; max-width: 160px; text-align: center;
          padding: 7px 13px 8px; border-radius: 5px;
          background: linear-gradient(180deg, oklch(0.67 0.055 72), oklch(0.57 0.065 66));
          border: 1px solid oklch(0.44 0.06 60);
          box-shadow: 0 4px 9px oklch(0.22 0.03 60 / 0.3), inset 0 1px 0 oklch(0.82 0.06 82 / 0.45);
        }
        .gr-lantern-sign::before {
          content: ''; position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 8px; background: oklch(0.40 0.05 55); border-radius: 2px;
        }
        .gr-lantern-id { font-family: var(--font-mono); font-weight: 700; font-size: 11px;
          letter-spacing: 0.06em; color: oklch(0.30 0.06 50); }
        .gr-lantern-title { font-family: var(--font-jp-display); font-size: 13.5px; font-weight: 600;
          color: oklch(0.18 0.03 55); line-height: 1.3; margin-top: 3px; }
        .gr-lantern-stamp { position: absolute; top: -4px; right: 16px; width: 34px; height: 34px; z-index: 3; }
        .gr-lantern-stamp img { width: 100%; height: 100%; object-fit: contain; opacity: 0.9; }

        .gr-level-marker { text-align: center; pointer-events: none; z-index: 1; }
        .gr-level-marker span {
          display: inline-block; font-family: var(--font-jp-display); font-size: 12px;
          letter-spacing: 0.2em; color: var(--ink-3);
          background: oklch(0.97 0.008 80 / 0.72); border: 1px solid var(--hairline);
          border-radius: 999px; padding: 4px 15px; backdrop-filter: blur(2px);
        }
        @media (prefers-reduced-motion: reduce) {
          .gr-lantern--next .gr-lantern-fig::after { animation: none; }
          .gr-lantern-light { transition: none; }
        }

        /* Intro section */
        .gr-intro-card { text-align: center; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; }
        .gr-intro-icon { font-size: 3.5rem; margin-bottom: 10px; }
        .gr-intro-title { font-size: 1.4rem; font-weight: 900; color: #2f3542; margin-bottom: 12px; }
        .gr-intro-summary { font-size: 1rem; color: #555; margin-bottom: 16px; line-height: 1.6; }
        .gr-why-box { background: #ECE7D8; border-left: 4px solid #5E8C5F; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; text-align: left; width: 100%; font-size: 0.9rem; color: #555; }
        .gr-learn-list { text-align: left; width: 100%; }
        .gr-learn-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.9rem; color: #444; }
        .gr-learn-check { color: #5E8C5F; font-size: 0.9rem; flex-shrink: 0; margin-top: 1px; }

        /* Pattern formula */
        .gr-formula { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .gr-chip {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px 14px; border-radius: 10px; min-width: 60px;
          color: white; font-weight: 700;
        }
        .gr-chip-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; margin-bottom: 2px; }
        .gr-chip-text { font-size: 1.1rem; font-family: 'Noto Sans JP', sans-serif; }
        .gr-arrow { color: #aaa; font-size: 1.1rem; align-self: center; }

        /* Grammar rule */
        .gr-rule-meaning { font-size: 1.15rem; font-weight: 700; color: #2f3542; margin-bottom: 10px; }
        .gr-rule-explanation { font-size: 0.9rem; color: #555; line-height: 1.7; margin-bottom: 14px; }
        .gr-notes-toggle { font-size: 0.8rem; color: #888; cursor: pointer; margin-bottom: 8px; border: none; background: none; text-decoration: underline; padding: 0; }
        .gr-notes-list { list-style: none; padding: 0; margin: 0 0 12px; }
        .gr-notes-list li { font-size: 0.82rem; color: #666; padding: 4px 0 4px 16px; position: relative; }
        .gr-notes-list li::before { content: "•"; position: absolute; left: 0; color: #5E8C5F; }

        /* Examples */
        .gr-example-card { background: white; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.06); }
        .gr-example-sentence { font-size: 1.1rem; font-family: 'Noto Sans JP', sans-serif; line-height: 1.8; margin-bottom: 6px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px; }
        .gr-example-en { font-size: 0.85rem; color: #747d8c; margin-bottom: 6px; }
        .gr-breakdown-toggle { font-size: 0.75rem; color: #aaa; cursor: pointer; border: none; background: none; padding: 0; text-decoration: underline; }
        .gr-breakdown-text { font-size: 0.8rem; color: #888; margin-top: 4px; font-style: italic; }
        .gr-tts-btn { font-size: 0.8rem; background: none; border: 1px solid #ddd; border-radius: 6px; padding: 3px 8px; cursor: pointer; color: #888; margin-top: 4px; }
        @media (hover: hover) { .gr-tts-btn:hover { background: #F3EEE4; } }

        /* Part spans */
        .gr-part { border-radius: 3px; padding: 1px 3px; cursor: default; position: relative; font-family: 'Noto Sans JP', sans-serif; }
        @media (hover: hover) {
          .gr-part[data-gloss]:hover::after {
            content: attr(data-gloss);
            position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
            background: #333; color: white; font-size: 0.72rem; padding: 3px 7px; border-radius: 5px;
            white-space: nowrap; pointer-events: none; font-family: 'Poppins', sans-serif; z-index: 100;
          }
        }

        /* Table */
        .gr-table-wrap { overflow-x: auto; margin-bottom: 12px; }
        .gr-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        .gr-table th { background: #ECE7D8; color: #5E8C5F; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #5E8C5F; white-space: nowrap; }
        .gr-table td { padding: 9px 12px; border-bottom: 1px solid #EDE7DA; vertical-align: top; font-family: 'Noto Sans JP', sans-serif; }
        .gr-table tr:last-child td { border-bottom: none; }
        @media (hover: hover) { .gr-table tr:hover td { background: #F3EEE4; } }
        .gr-table-label { font-family: 'Poppins', sans-serif; font-weight: 600; color: #555; white-space: nowrap; }
        .gr-table-meaning { font-family: 'Poppins', sans-serif; color: #888; font-style: italic; }
        .gr-cell-stem { background: rgba(0,184,148,0.2); border-radius: 2px; }
        .gr-cell-ending { background: rgba(214,48,49,0.2); border-radius: 2px; }
        .gr-notes-box { background: #F3EEE4; border-radius: 8px; padding: 12px 14px; margin-top: 10px; font-size: 0.82rem; color: #666; }
        .gr-notes-box li { margin-bottom: 4px; }

        /* Comparison */
        .gr-comparison { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .gr-comp-card { flex: 1; min-width: 200px; background: white; border-radius: 12px; padding: 14px; border-left: 4px solid; }
        .gr-comp-label { font-weight: 700; font-size: 0.9rem; margin-bottom: 8px; color: #333; }
        .gr-comp-points { list-style: none; padding: 0; margin: 0 0 10px; }
        .gr-comp-points li { font-size: 0.82rem; color: #555; padding: 3px 0 3px 12px; position: relative; }
        .gr-comp-points li::before { content: "→"; position: absolute; left: 0; font-size: 0.75rem; color: #888; }
        .gr-tip-box { background: #FFF9C4; border: 1px solid #F9A825; border-radius: 10px; padding: 12px 16px; font-size: 0.88rem; color: #555; margin-top: 8px; }

        /* Annotated examples */
        .gr-ae-card { background: white; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.06); }
        .gr-ae-context { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; background: #ECE7D8; color: #5E8C5F; margin-bottom: 8px; }
        .gr-ae-note { font-size: 0.8rem; color: #888; margin-top: 6px; font-style: italic; }

        /* Drills (shared with lesson style) */
        .gr-drill-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.02); }
        .gr-drill-q { font-size: 1.05rem; line-height: 1.6; font-family: 'Noto Sans JP', sans-serif; font-weight: bold; margin-bottom: 15px; color: #2f3542; }
        .gr-mcq-opt { display: block; width: 100%; text-align: left; padding: 12px 15px; margin-bottom: 8px; background: #fff; border: 2px solid #eee; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 0.95rem; color: #2f3542; transition: 0.2s; }
        @media (hover: hover) { .gr-mcq-opt:hover { border-color: #5E8C5F; background: #F3EEE4; } }
        .gr-mcq-opt.correct { background: #DDE7D6; border-color: #C2D2BD; color: #38513A; }
        .gr-mcq-opt.wrong { background: #F1DCD4; border-color: #E2BCAE; color: #7A3322; }
        .gr-explanation { font-size: 0.82rem; color: #666; margin-top: 8px; padding: 8px 12px; background: #F3EEE4; border-radius: 8px; display: none; }
        .gr-explanation.visible { display: block; }

        /* Interactive drills */
        .gr-score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .gr-score-text { font-size: 0.85rem; font-weight: 700; color: #555; white-space: nowrap; }
        .gr-score-bar-wrap { flex: 1; height: 8px; background: #EDE7DA; border-radius: 4px; overflow: hidden; }
        .gr-score-bar-fill { height: 100%; background: linear-gradient(90deg, #5E8C5F, #4A7A4C); border-radius: 4px; transition: width 0.4s ease; }

        .gr-drill-item { text-align: center; }
        .gr-verb-display { font-size: 2rem; font-weight: 900; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; margin-bottom: 6px; }
        .gr-verb-reading { font-size: 0.9rem; color: #888; margin-bottom: 10px; }
        .gr-verb-type-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 10px; }
        .gr-type-ru { background: #d1ecf1; color: #0c5460; }
        .gr-type-u { background: #DDE7D6; color: #38513A; }
        .gr-type-irr { background: #fff3cd; color: #856404; }
        .gr-type-iadj { background: #fce4ec; color: #880e4f; }
        .gr-type-naadj { background: #e8eaf6; color: #283593; }
        .gr-type-copula { background: #f3e5f5; color: #6a1b9a; }
        .gr-transform-arrow { font-size: 1.5rem; color: #5E8C5F; margin: 10px 0; }
        .gr-target-label { font-size: 0.85rem; font-weight: 700; color: #5E8C5F; background: #ECE7D8; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 16px; }
        .gr-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .gr-choice-chip {
          padding: 12px 10px; border-radius: 12px; border: 2px solid #eee; background: white;
          cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 1rem; font-weight: 600;
          text-align: center; transition: 0.18s; color: #2f3542;
        }
        @media (hover: hover) { .gr-choice-chip:hover { border-color: #5E8C5F; background: #F3EEE4; } }
        .gr-choice-chip.correct { background: #DDE7D6; border-color: #C2D2BD; color: #38513A; }
        .gr-choice-chip.wrong { background: #F1DCD4; border-color: #E2BCAE; color: #7A3322; }
        .gr-hint-text { font-size: 0.82rem; color: #666; margin-top: 10px; padding: 8px 12px; background: #F3EEE4; border-radius: 8px; }
        .gr-next-btn { display: block; margin: 14px auto 0; padding: 10px 28px; border-radius: 20px; border: none; background: #5E8C5F; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; transition: 0.18s; }
        @media (hover: hover) { .gr-next-btn:hover { background: #4A7A4C; } }

        /* Fill slot */
        .gr-slot-sentence { font-size: 1.2rem; font-family: 'Noto Sans JP', sans-serif; line-height: 2; text-align: center; margin: 16px 0; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; }
        .gr-slot-blank { display: inline-block; min-width: 50px; height: 36px; border: 2px solid #FDCB6E; border-radius: 8px; padding: 4px 12px; text-align: center; background: #FFFDE7; font-size: 1.1rem; font-weight: 700; color: #333; transition: 0.2s; vertical-align: middle; line-height: 26px; }
        .gr-slot-blank.filled-correct { border-color: #00B894; background: #DDE7D6; color: #38513A; }
        .gr-slot-blank.filled-wrong { border-color: #D63031; background: #F1DCD4; color: #7A3322; }
        .gr-slot-choices { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
        .gr-slot-chip { padding: 8px 18px; border-radius: 20px; border: 2px solid #eee; background: white; cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 1rem; font-weight: 700; transition: 0.18s; }
        @media (hover: hover) { .gr-slot-chip:hover { border-color: #FDCB6E; background: #FFFDE7; } }
        .gr-slot-next { display: block; margin: 16px auto 0; padding: 10px 28px; border-radius: 20px; border: none; background: #6C5CE7; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; transition: 0.18s; }
        @media (hover: hover) { .gr-slot-next:hover { background: #5a4bd1; } }

        /* Pattern match */
        .gr-pm-card { background: white; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; border: 2px solid #eee; cursor: pointer; transition: 0.2s; }
        .gr-pm-card.answered-correct { border-color: #00B894; }
        .gr-pm-card.answered-wrong { border-color: #D63031; }
        .gr-pm-sentence { font-size: 1.05rem; font-family: 'Noto Sans JP', sans-serif; margin-bottom: 8px; }
        .gr-pm-buttons { display: flex; gap: 8px; }
        .gr-pm-btn { flex: 1; padding: 8px; border-radius: 8px; border: 2px solid #eee; background: white; cursor: pointer; font-weight: 700; font-size: 1rem; }
        .gr-pm-btn.correct-choice { background: #DDE7D6; border-color: #00B894; color: #38513A; }
        .gr-pm-btn.wrong-choice { background: #F1DCD4; border-color: #D63031; color: #7A3322; }
        .gr-pm-explanation { font-size: 0.8rem; color: #666; margin-top: 8px; padding: 6px 10px; background: #F3EEE4; border-radius: 6px; }

        /* Sentence transform */
        .gr-st-from { background: white; border-radius: 10px; padding: 14px; border: 2px solid #eee; margin-bottom: 10px; }
        .gr-st-to { background: #F3EEE4; border-radius: 10px; padding: 14px; border: 2px dashed #5E8C5F; min-height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .gr-st-label { font-size: 0.72rem; font-weight: 700; color: #5E8C5F; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .gr-st-sentence { font-size: 1.05rem; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; }
        .gr-st-arrow { text-align: center; font-size: 1.5rem; color: #5E8C5F; margin: 6px 0; }

        /* Conversation (grammar context) */
        .gr-conv-toggle { font-size: 0.75rem; font-weight: 700; color: #747d8c; background: #fff; border: 2px solid #EDE7DA; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-bottom: 20px; width: 100%; }
        .gr-conv-row { display: flex; gap: 12px; margin-bottom: 20px; align-items: flex-start; }
        .gr-speaker-bubble { background: #ECE7D8; color: #5E8C5F; font-weight: 900; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-family: 'Noto Sans JP', sans-serif; font-size: 0.75rem; }
        /* iMessage-style chat bubbles (matches Lessons): blue "sent" + grey
           "received"; reading aids recoloured light on the blue bubble. */
        .gr-bubble { max-width: 82%; padding: 9px 13px; border-radius: 19px; position: relative; box-shadow: 0 1px 1px rgba(0,0,0,0.05); }
        .gr-bubble-jp { font-family: 'Noto Serif JP', serif; font-size: 15px; line-height: 1.6; font-weight: 500; }
        .gr-bubble--sent { background: #0a84ff; color: #fff; border-bottom-right-radius: 5px; }
        .gr-bubble--recv { background: #e9e9eb; color: #2a2520; border-bottom-left-radius: 5px; }
        .gr-bubble-en { font-size: 11.5px; margin-top: 4px; line-height: 1.45; font-style: italic; }
        .gr-bubble--sent .gr-bubble-en { color: rgba(255,255,255,0.85); }
        .gr-bubble--recv .gr-bubble-en { color: #7a7167; }
        .gr-bubble--sent .jp-term { color: #fff !important; border-bottom-color: rgba(255,255,255,0.5) !important; }
        .gr-bubble--sent .rt-furigana, .gr-bubble--sent .rt-romaji, .gr-bubble--sent .rt-romaji-group { color: rgba(255,255,255,0.85); }
        .gr-jp { font-size: 1.15rem; line-height: 1.6; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; }
        .gr-en { font-size: 0.9rem; color: #747d8c; margin-top: 6px; }
        .gr-term { color: #5E8C5F; font-weight: 700; cursor: pointer; margin-right: 1px; border-bottom: 2px solid oklch(0.22 0.012 60 / 0.18); transition: 0.2s; }
        @media (hover: hover) { .gr-term:hover { background: oklch(0.22 0.012 60 / 0.06); border-bottom-color: #5E8C5F; } }

        /* Clickable term spans generated by processText() */
        .jp-term { color: #4e54c8; font-weight: 700; cursor: pointer; margin-right: 1px; border-bottom: 2px solid rgba(78,84,200,0.1); transition: 0.2s; }
        @media (hover: hover) { .jp-term:hover { background: rgba(78,84,200,0.05); border-bottom-color: #4e54c8; } }
        /* Character name spans (hanabi pink) */
        .jp-term-name { color: #d45d8a; border-bottom: 2px solid #f4a7c0; }
        @media (hover: hover) { .jp-term-name:hover { color: #b8446e; } }

        /* Markdown rendered in explanation fields */
        .gr-rule-explanation p { margin: 0 0 8px; }
        .gr-rule-explanation p:last-child { margin-bottom: 0; }
        .gr-rule-explanation ul, .gr-rule-explanation ol { margin: 4px 0 8px 18px; padding: 0; }
        .gr-rule-explanation li { margin-bottom: 3px; }
        .gr-rule-explanation strong { color: #5E8C5F; }
        .gr-rule-explanation del { color: #D63031; text-decoration: line-through; opacity: 0.8; }
        .gr-md-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.82rem; }
        .gr-md-table th { background: #ECE7D8; color: #4A7A4C; font-weight: 700; padding: 6px 10px; border: 1px solid #DED7C6; text-align: left; }
        .gr-md-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
        .gr-md-table tr:nth-child(even) td { background: #F3EEE4; }

        /* Summary / celebration */
        .jp-hanabi-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; overflow: hidden; }
        .jp-hanabi-particle { position: absolute; border-radius: 50%; }
        .jp-hanabi-msg { position: absolute; top: 35%; left: 50%; transform: translate(-50%, -50%) scale(0); text-align: center; font-family: 'Noto Sans JP', sans-serif; animation: jp-hanabi-pop 2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; white-space: nowrap; }
        .jp-hanabi-jp { font-size: 3rem; font-weight: 900; text-shadow: 0 2px 10px rgba(0,0,0,0.15); }
        .jp-hanabi-en { font-size: 1rem; color: #747d8c; font-weight: 600; margin-top: 5px; }
        @keyframes jp-hanabi-pop {
          0%   { transform: translate(-50%, -50%) scale(0);   opacity: 0; }
          20%  { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          40%  { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          80%  { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // --- Helpers ---
    function el(tag, cls, inner) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (inner !== undefined) {
        if (typeof inner === 'string') e.innerHTML = inner;
        else e.appendChild(inner);
      }
      return e;
    }
    function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // Render Japanese through the reading-aids pipeline. Pass {text, tokens}
    // for grammar parts where tokens may be authored. Falls back to esc()
    // when jp-text isn't loaded or no tokens are present.
    function jpRender(input) {
      const rk = window.JPShared && window.JPShared.jpText;
      if (rk) return rk.render(input);
      if (typeof input === 'string') return esc(input);
      if (input && typeof input === 'object') return esc(input.text || input.surface || input.jp || '');
      return '';
    }

    function mdToHtml(text) {
      if (!text) return '';
      function safeEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      function inline(s) {
        return s
          .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
          .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
      }
      const lines = text.split('\n');
      const html = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        // Markdown table
        if (line.trim().startsWith('|')) {
          const tlines = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) { tlines.push(lines[i]); i++; }
          html.push('<table class="gr-md-table">');
          let isHeader = true;
          tlines.forEach(tl => {
            if (/^\s*\|[\s\-|:]+\|\s*$/.test(tl)) { isHeader = false; return; }
            const cells = tl.split('|').slice(1, -1);
            const tag = isHeader ? 'th' : 'td';
            if (isHeader) isHeader = false;
            html.push('<tr>' + cells.map(c => '<' + tag + '>' + inline(safeEsc(c.trim())) + '</' + tag + '>').join('') + '</tr>');
          });
          html.push('</table>');
          continue;
        }
        // Unordered list
        if (/^[-*] /.test(line)) {
          html.push('<ul>');
          while (i < lines.length && /^[-*] /.test(lines[i])) {
            html.push('<li>' + inline(safeEsc(lines[i].replace(/^[-*] /, ''))) + '</li>'); i++;
          }
          html.push('</ul>');
          continue;
        }
        // Ordered list
        if (/^\d+\. /.test(line)) {
          html.push('<ol>');
          while (i < lines.length && /^\d+\. /.test(lines[i])) {
            html.push('<li>' + inline(safeEsc(lines[i].replace(/^\d+\. /, ''))) + '</li>'); i++;
          }
          html.push('</ol>');
          continue;
        }
        // Paragraph
        const para = [];
        while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('|') && !/^[-*] /.test(lines[i]) && !/^\d+\. /.test(lines[i])) {
          para.push(lines[i]); i++;
        }
        if (para.length) html.push('<p>' + inline(safeEsc(para.join(' '))) + '</p>');
      }
      return html.join('');
    }
    function getCdnUrl(fp) { return window.getAssetUrl(REPO_CONFIG, fp); }

    // --- TTS ---
    function speakText(text) {
      if (window.JPShared && window.JPShared.tts && window.JPShared.tts.speak) {
        window.JPShared.tts.speak(text);
      }
    }
    function speakParts(parts) {
      speakText((parts || []).map(p => p.text).join(''));
    }

    // --- Progress ---
    function progressSet(key, val) {
      if (window.JPShared && window.JPShared.progress) {
        if (typeof window.JPShared.progress.set === 'function') {
          window.JPShared.progress.set(key, val);
        } else {
          try { localStorage.setItem('gr_' + key, JSON.stringify(val)); } catch(e) {}
        }
      }
    }
    function progressGet(key) {
      if (window.JPShared && window.JPShared.progress) {
        if (typeof window.JPShared.progress.get === 'function') {
          return window.JPShared.progress.get(key);
        }
      }
      try { return JSON.parse(localStorage.getItem('gr_' + key)); } catch(e) { return null; }
    }
    function markGrammarComplete(id, score) {
      progressSet('grammar_' + id + '_complete', true);
      if (score !== undefined) progressSet('grammar_' + id + '_drill_score', score);
    }
    function isGrammarComplete(id) {
      return !!progressGet('grammar_' + id + '_complete');
    }

    // --- Celebration ---
    const SCORE_RANKS = [
      { min: 0,   msg: '頑張れ！',     sub: 'Keep Going!',    colors: ['#a4b0be','#747d8c','#57606f'], particles: 8 },
      { min: 60,  msg: 'いいね！',     sub: 'Nice!',          colors: ['#FFD700','#FFA500','#FFE066'], particles: 15 },
      { min: 70,  msg: 'すごい！',     sub: 'Amazing!',       colors: ['#FF6B35','#FF4500','#FF8C00'], particles: 24 },
      { min: 80,  msg: 'さすが！',     sub: 'Impressive!',    colors: ['#FF1493','#FF69B4','#FF85C8'], particles: 35 },
      { min: 90,  msg: 'すばらしい！', sub: 'Wonderful!',     colors: ['#00E5FF','#00BCD4','#4DD0E1'], particles: 45 },
      { min: 95,  msg: '天才！',       sub: 'Genius!',        colors: ['#8B5CF6','#A78BFA','#7C3AED'], particles: 55 },
      { min: 100, msg: '神！',         sub: 'Godlike!',       colors: ['#FF1493','#FFD700','#00E5FF','#8B5CF6','#2ED573','#FF6B35'], particles: 70 },
    ];

    function launchHanabi(rank, targetEl) {
      targetEl.style.position = 'relative';
      const cont = document.createElement('div');
      cont.className = 'jp-hanabi-container';
      targetEl.appendChild(cont);
      const w = targetEl.offsetWidth || 300, h = targetEl.offsetHeight || 200;
      const bpts = rank.particles >= 55 ? [
        {x:w*0.3,y:h*0.25},{x:w*0.7,y:h*0.3},{x:w*0.5,y:h*0.15}
      ] : rank.particles >= 35 ? [
        {x:w*0.35,y:h*0.25},{x:w*0.65,y:h*0.25}
      ] : [{x:w/2,y:h*0.25}];
      const pb = Math.ceil(rank.particles / bpts.length);
      bpts.forEach((bp, bi) => {
        for (let i = 0; i < pb; i++) {
          const p = document.createElement('div');
          p.className = 'jp-hanabi-particle';
          const angle = (Math.PI*2*i/pb)+(Math.random()*0.4-0.2);
          const dist = 50+Math.random()*100;
          const color = rank.colors[Math.floor(Math.random()*rank.colors.length)];
          const size = 3+Math.random()*5;
          const delay = bi*150+Math.random()*100;
          const dx = Math.cos(angle)*dist, dy = Math.sin(angle)*dist+40;
          p.style.cssText = 'left:'+bp.x+'px;top:'+bp.y+'px;width:'+size+'px;height:'+size+'px;background:'+color+';box-shadow:0 0 '+size+'px '+color+';transition:transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.9s ease-out;transition-delay:'+delay+'ms;';
          cont.appendChild(p);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            p.style.transform = 'translate('+dx+'px,'+dy+'px)'; p.style.opacity = '0';
          }));
        }
      });
      const msg = document.createElement('div');
      msg.className = 'jp-hanabi-msg';
      msg.innerHTML = '<div class="jp-hanabi-jp" style="color:'+rank.colors[0]+'">'+rank.msg+'</div><div class="jp-hanabi-en">'+rank.sub+'</div>';
      cont.appendChild(msg);
      setTimeout(() => cont.remove(), 3000);
    }

    // --- Parts renderer ---
    function renderParts(parts) {
      return (parts || []).map(part => {
        const color = GRAMMAR_COLORS[part.role] || '#888';
        const bg = color + '26';
        let html = '<span class="gr-part" style="background:' + bg + ';border-bottom:2px solid ' + color + ';"';
        if (part.gloss) html += ' data-gloss="' + esc(part.gloss) + '" title="' + esc(part.gloss) + '"';
        // Render through jpRender so authored part.tokens drives furigana/romaji.
        // Bare text without tokens falls back to escaped HTML transparently.
        html += '>' + jpRender({ text: part.text, tokens: part.tokens }) + '</span>';
        return html;
      }).join('');
    }

    // --- Resources ---
    async function loadResources() {
      const manifest = await window.getManifest(REPO_CONFIG);
      const conjUrl    = getCdnUrl(manifest.globalFiles.conjugationRules);
      const counterUrl = getCdnUrl(manifest.globalFiles.counterRules);
      const particleUrl = getCdnUrl(manifest.shared.particles);
      const characterUrl = getCdnUrl(manifest.shared.characters);
      const [conj, counter, particleData, characterData, ...glossParts] = await Promise.all([
        fetch(conjUrl).then(r => r.json()),
        fetch(counterUrl).then(r => r.json()),
        fetch(particleUrl).then(r => r.json()),
        fetch(characterUrl).then(r => r.json()),
        ...manifest.levels.map(lvl => fetch(getCdnUrl(manifest.data[lvl].glossary)).then(r => r.json()))
      ]);
      const map = {};
      glossParts.forEach(g => g.entries.forEach(i => { map[i.id] = i; }));
      (particleData.particles || []).forEach(p => {
        map[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', matches: p.matches || [] };
      });
      (characterData.characters || []).forEach(c => {
        map[c.id] = Object.assign({}, c, { portraitUrl: getCdnUrl(c.portrait) });
      });
      // Preload portrait images in the background so they appear instantly on first tap
      if (window.JPShared && window.JPShared.assets && window.JPShared.assets.preloadImages) {
        window.JPShared.assets.preloadImages(
          (characterData.characters || []).map(c => getCdnUrl(c.portrait)).filter(Boolean)
        );
      }
      return { map, conj, counter };
    }

    // ──────────────────────────────────────────────
    // SECTION RENDERERS
    // ──────────────────────────────────────────────

    function renderGrammarIntro(sec) {
      const div = el('div', 'gr-intro-card');
      div.appendChild(el('div', 'gr-intro-icon', sec.icon || '📐'));
      div.appendChild(el('div', 'gr-intro-title', esc(sec.title)));
      div.appendChild(el('div', 'gr-intro-summary', esc(sec.summary)));
      if (sec.whyItMatters) {
        div.appendChild(el('div', 'gr-why-box', '💡 ' + esc(sec.whyItMatters)));
      }
      if (sec.youWillLearn && sec.youWillLearn.length) {
        const list = el('div', 'gr-learn-list');
        sec.youWillLearn.forEach(item => {
          const row = el('div', 'gr-learn-item');
          row.appendChild(el('span', 'gr-learn-check', '☐'));
          row.appendChild(el('span', '', esc(item)));
          list.appendChild(row);
        });
        div.appendChild(list);
      }
      return div;
    }

    function buildFormula(pattern) {
      const row = el('div', 'gr-formula');
      (pattern || []).forEach((chip, i) => {
        const color = GRAMMAR_COLORS[chip.color] || '#888';
        const chipEl = el('div', 'gr-chip');
        chipEl.style.background = color;
        chipEl.innerHTML = '<span class="gr-chip-label">' + esc(chip.label) + '</span><span class="gr-chip-text">' + esc(chip.text) + '</span>';
        row.appendChild(chipEl);
        if (i < pattern.length - 1) row.appendChild(el('span', 'gr-arrow', '→'));
      });
      return row;
    }

    function renderGrammarRule(sec) {
      const div = el('div', 'gr-card');
      div.appendChild(buildFormula(sec.pattern));
      div.appendChild(el('div', 'gr-rule-meaning', esc(sec.meaning)));
      div.appendChild(el('div', 'gr-rule-explanation', mdToHtml(sec.explanation)));

      if (sec.notes && sec.notes.length) {
        const toggle = el('button', 'gr-notes-toggle', '📝 Notes (' + sec.notes.length + ')');
        const notesList = el('ul', 'gr-notes-list');
        notesList.style.display = 'none';
        sec.notes.forEach(n => notesList.appendChild(el('li', '', esc(n))));
        toggle.onclick = () => {
          const hidden = notesList.style.display === 'none';
          notesList.style.display = hidden ? 'block' : 'none';
          toggle.textContent = (hidden ? '📝 Notes ▲' : '📝 Notes ▼');
        };
        div.appendChild(toggle);
        div.appendChild(notesList);
      }

      (sec.examples || []).forEach(ex => {
        const card = el('div', 'gr-example-card');
        const sent = el('div', 'gr-example-sentence');
        sent.innerHTML = renderParts(ex.parts);
        card.appendChild(sent);
        card.appendChild(el('div', 'gr-example-en', esc(ex.en)));
        if (ex.breakdown) {
          const btn = el('button', 'gr-breakdown-toggle', '▼ Breakdown');
          const bd = el('div', 'gr-breakdown-text', esc(ex.breakdown));
          bd.style.display = 'none';
          btn.onclick = () => { const h = bd.style.display === 'none'; bd.style.display = h ? 'block' : 'none'; btn.textContent = h ? '▲ Breakdown' : '▼ Breakdown'; };
          card.appendChild(btn);
          card.appendChild(bd);
        }
        const tts = el('button', 'gr-tts-btn', '🔊');
        tts.onclick = () => speakParts(ex.parts);
        card.appendChild(tts);
        div.appendChild(card);
      });
      return div;
    }

    function renderGrammarTable(sec) {
      const div = el('div', 'gr-card-white');
      div.appendChild(el('div', '', '<strong>' + esc(sec.title) + '</strong>'));
      div.appendChild(el('div', 'gr-rule-explanation', esc(sec.description)));

      const wrap = el('div', 'gr-table-wrap');
      const table = el('table', 'gr-table');
      const thead = el('tr', '');
      (sec.headers || []).forEach(h => thead.appendChild(el('th', '', esc(h))));
      table.appendChild(el('thead', '', thead));
      const tbody = el('tbody', '');
      (sec.rows || []).forEach(row => {
        const tr = el('tr', '');
        tr.appendChild(el('td', 'gr-table-label', esc(row.label)));
        (row.cells || []).forEach(cell => {
          const td = el('td', '');
          // Attempt stem/ending split if highlight provided
          if (sec.highlight && typeof cell === 'string' && cell.length > 1) {
            const stemLen = Math.max(1, cell.length - 2);
            td.innerHTML = '<span class="gr-cell-stem">' + esc(cell.slice(0, stemLen)) + '</span><span class="gr-cell-ending">' + esc(cell.slice(stemLen)) + '</span>';
          } else {
            td.textContent = typeof cell === 'object' ? (cell.stem || '') + (cell.ending || '') : cell;
          }
          tr.appendChild(td);
        });
        if (row.meaning) tr.appendChild(el('td', 'gr-table-meaning', esc(row.meaning)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      div.appendChild(wrap);

      if (sec.notes && sec.notes.length) {
        const nb = el('ul', 'gr-notes-box');
        sec.notes.forEach(n => nb.appendChild(el('li', '', esc(n))));
        div.appendChild(nb);
      }
      return div;
    }

    function renderGrammarComparison(sec) {
      const div = el('div', 'gr-card-white');
      div.appendChild(el('div', '', '<strong>' + esc(sec.title) + '</strong><br><br>'));
      const row = el('div', 'gr-comparison');
      (sec.items || []).forEach(item => {
        const color = GRAMMAR_COLORS[item.color] || '#888';
        const card = el('div', 'gr-comp-card');
        card.style.borderLeftColor = color;
        card.appendChild(el('div', 'gr-comp-label', '<span style="color:' + color + '">●</span> ' + esc(item.label)));
        const pts = el('ul', 'gr-comp-points');
        (item.points || []).forEach(p => pts.appendChild(el('li', '', esc(p))));
        card.appendChild(pts);
        if (item.example) {
          const ex = el('div', 'gr-example-card');
          const sent = el('div', 'gr-example-sentence');
          sent.innerHTML = renderParts(item.example.parts);
          ex.appendChild(sent);
          ex.appendChild(el('div', 'gr-example-en', esc(item.example.en)));
          const tts = el('button', 'gr-tts-btn', '🔊');
          tts.onclick = () => speakParts(item.example.parts);
          ex.appendChild(tts);
          card.appendChild(ex);
        }
        row.appendChild(card);
      });
      div.appendChild(row);
      if (sec.tip) div.appendChild(el('div', 'gr-tip-box', '💡 ' + esc(sec.tip)));
      return div;
    }

    function renderAnnotatedExample(sec) {
      const div = el('div', '');
      div.appendChild(el('div', '', '<strong>' + esc(sec.title) + '</strong><br><br>'));
      (sec.examples || []).forEach(ex => {
        const card = el('div', 'gr-ae-card');
        if (ex.context) card.appendChild(el('span', 'gr-ae-context', esc(ex.context)));
        const sent = el('div', 'gr-example-sentence');
        sent.innerHTML = renderParts(ex.parts);
        card.appendChild(sent);
        card.appendChild(el('div', 'gr-example-en', esc(ex.en)));
        if (ex.note) card.appendChild(el('div', 'gr-ae-note', '💬 ' + esc(ex.note)));
        const tts = el('button', 'gr-tts-btn', '🔊');
        tts.onclick = () => speakParts(ex.parts);
        card.appendChild(tts);
        div.appendChild(card);
      });
      return div;
    }

    // Sound + haptic feedback on a graded answer — matches the N-lesson drills.
    function fxAnswer(ok) {
      try {
        const s = window.JPShared.sfx, h = window.JPShared.haptics;
        if (ok) { if (s) s.success(); if (h) h.success(); }
        else { if (s) s.error(); if (h) h.error(); }
      } catch (e) {}
    }

    function renderConjugationDrill(sec, onComplete, stepIdx) {
      const div = el('div', '');
      const items = sec.items || [];
      let idx = 0, correct = 0, answered = 0;

      const scoreRow = el('div', 'gr-score-row');
      const scoreText = el('div', 'gr-score-text', '0 / ' + items.length);
      const barWrap = el('div', 'gr-score-bar-wrap');
      const barFill = el('div', 'gr-score-bar-fill');
      barFill.style.width = '0%';
      barWrap.appendChild(barFill);
      scoreRow.appendChild(scoreText);
      scoreRow.appendChild(barWrap);
      div.appendChild(scoreRow);

      const itemDiv = el('div', 'gr-card gr-drill-item');
      div.appendChild(itemDiv);

      function renderItem() {
        if (idx >= items.length) {
          const pct = items.length > 0 ? Math.round(correct / items.length * 100) : 100;
          progressSet('grammar_' + grammarId + '_conj_score', pct);
          sectionScores[stepIdx] = { title: sec.title, type: sec.type, correct: correct, total: items.length };
          itemDiv.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:1.4rem;font-weight:900;color:#5E8C5F;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Conjugation complete!</div></div>';
          if (onComplete) onComplete();
          return;
        }
        const item = items[idx];
        itemDiv.innerHTML = '';
        const typeMap = {
          ru: ['gr-type-ru', 'RU-verb'], ichidan: ['gr-type-ru', 'RU-verb'],
          u: ['gr-type-u', 'U-verb'], godan: ['gr-type-u', 'U-verb'],
          i_adj: ['gr-type-iadj', 'i-Adjective'], irr_ii: ['gr-type-iadj', 'Irregular (いい)'],
          na_adj: ['gr-type-naadj', 'na-Adjective'],
          copula: ['gr-type-copula', 'Copula']
        };
        const [typeCls, typeLbl] = typeMap[item.type] || ['gr-type-irr', 'Irregular'];
        itemDiv.innerHTML = '<div style="margin-bottom:4px;font-size:0.8rem;color:#aaa;">' + (idx+1) + ' of ' + items.length + '</div>';
        itemDiv.appendChild(el('div', 'gr-verb-display', esc(item.verb)));
        itemDiv.appendChild(el('div', 'gr-verb-reading', esc(item.reading)));
        itemDiv.appendChild(el('span', 'gr-verb-type-badge ' + typeCls, typeLbl));
        itemDiv.appendChild(el('div', 'gr-transform-arrow', '↓'));
        itemDiv.appendChild(el('div', 'gr-target-label', esc(item.targetForm.replace(/_/g, ' '))));

        const hint = el('div', 'gr-hint-text', esc(item.hint));
        hint.style.display = 'none';

        const choices = el('div', 'gr-choices');
        const shuffled = [...item.choices].sort(() => Math.random() - 0.5);
        let solved = false;
        shuffled.forEach(ch => {
          const btn = el('button', 'gr-choice-chip', esc(ch));
          btn.onclick = () => {
            if (solved) return;
            fxAnswer(ch === item.answer);
            if (ch === item.answer) {
              btn.classList.add('correct');
              if (!solved) { correct++; answered++; solved = true; }
              hint.style.display = 'block';
              scoreText.textContent = answered + ' / ' + items.length;
              barFill.style.width = (answered / items.length * 100) + '%';
              if (sec.manualProgression) {
                const nextBtn = el('button', 'gr-next-btn', idx + 1 < items.length ? 'Next →' : 'Done ✓');
                nextBtn.onclick = () => { idx++; renderItem(); };
                itemDiv.appendChild(nextBtn);
              } else {
                setTimeout(() => { idx++; renderItem(); }, 1400);
              }
            } else {
              btn.classList.add('wrong');
              if (!solved) { answered++; solved = true; }
              hint.style.display = 'block';
              scoreText.textContent = answered + ' / ' + items.length;
              barFill.style.width = (answered / items.length * 100) + '%';
              choices.querySelectorAll('.gr-choice-chip').forEach(b => {
                if (b.textContent === item.answer) b.classList.add('correct');
              });
              if (sec.manualProgression) {
                const nextBtn = el('button', 'gr-next-btn', idx + 1 < items.length ? 'Next →' : 'Done ✓');
                nextBtn.onclick = () => { idx++; renderItem(); };
                itemDiv.appendChild(nextBtn);
              } else {
                setTimeout(() => { idx++; renderItem(); }, 1400);
              }
            }
          };
          choices.appendChild(btn);
        });
        itemDiv.appendChild(choices);
        itemDiv.appendChild(hint);
      }
      renderItem();
      return div;
    }

    function renderPatternMatch(sec, stepIdx) {
      const div = el('div', '');
      // Title and instructions display
      const patternBox = el('div', 'gr-card');
      patternBox.innerHTML = '<div style="font-size:1rem;font-weight:700;color:#333;margin-bottom:8px;">' + esc(sec.title) + '</div><div style="font-size:0.9rem;color:#555;">' + esc(sec.instructions) + '</div>';
      div.appendChild(patternBox);

      // Many patternMatch sections are concept-A vs concept-B (e.g. appearance
      // vs hearsay), not literal true/false — students find bare ✓/✗ confusing.
      // Sections may name the two choices via trueLabel/falseLabel; else ✓/✗.
      const trueLabel = sec.trueLabel || '✓';
      const falseLabel = sec.falseLabel || '✗';

      let correct = 0, total = 0;
      const scoreRow = el('div', 'gr-score-row');
      const scoreText = el('div', 'gr-score-text', '0 / ' + (sec.items || []).length);
      const barWrap = el('div', 'gr-score-bar-wrap');
      const barFill = el('div', 'gr-score-bar-fill');
      barFill.style.width = '0%';
      barWrap.appendChild(barFill);
      scoreRow.appendChild(scoreText);
      scoreRow.appendChild(barWrap);
      div.appendChild(scoreRow);

      (sec.items || []).forEach(item => {
        const card = el('div', 'gr-pm-card');
        card.appendChild(el('div', 'gr-pm-sentence', esc(item.sentence)));
        const btns = el('div', 'gr-pm-buttons');
        const expEl = el('div', 'gr-pm-explanation', esc(item.explanation));
        expEl.style.display = 'none';
        let answered = false;
        const choiceBtns = [];

        const makeBtn = (label, isCorrectChoice) => {
          const btn = el('button', 'gr-pm-btn', label);
          choiceBtns.push({ btn: btn, value: isCorrectChoice });
          btn.onclick = () => {
            if (answered) return;
            answered = true; total++;
            expEl.style.display = 'block';
            fxAnswer(isCorrectChoice === item.answer);
            if (isCorrectChoice === item.answer) {
              correct++;
              btn.classList.add('correct-choice');
              card.classList.add('answered-correct');
            } else {
              btn.classList.add('wrong-choice');
              card.classList.add('answered-wrong');
              choiceBtns.forEach(c => {
                if (c.value === item.answer) c.btn.classList.add('correct-choice');
              });
            }
            scoreText.textContent = total + ' / ' + (sec.items || []).length;
            barFill.style.width = (total / (sec.items || []).length * 100) + '%';
            sectionScores[stepIdx] = { title: sec.title, type: sec.type, correct: correct, total: (sec.items || []).length };
          };
          return btn;
        };
        btns.appendChild(makeBtn(trueLabel, true));
        btns.appendChild(makeBtn(falseLabel, false));

        const tts = el('button', 'gr-tts-btn', '🔊');
        tts.onclick = () => speakText(item.sentence);
        card.appendChild(tts);
        card.appendChild(btns);
        card.appendChild(expEl);
        div.appendChild(card);
      });
      return div;
    }

    function renderSentenceTransform(sec, onComplete, stepIdx) {
      const div = el('div', '');
      const items = sec.items || [];
      let idx = 0, correct = 0, answered = 0;

      const scoreRow = el('div', 'gr-score-row');
      const scoreText = el('div', 'gr-score-text', '0 / ' + items.length);
      const barWrap = el('div', 'gr-score-bar-wrap');
      const barFill = el('div', 'gr-score-bar-fill');
      barFill.style.width = '0%';
      barWrap.appendChild(barFill);
      scoreRow.appendChild(scoreText);
      scoreRow.appendChild(barWrap);
      div.appendChild(scoreRow);

      const itemDiv = el('div', 'gr-card');
      div.appendChild(itemDiv);

      function renderItem() {
        if (idx >= items.length) {
          const pct = items.length > 0 ? Math.round(correct / items.length * 100) : 100;
          sectionScores[stepIdx] = { title: sec.title, type: sec.type, correct: correct, total: items.length };
          itemDiv.innerHTML = '<div style="text-align:center;padding:16px;"><div style="font-size:1.4rem;font-weight:900;color:#5E8C5F;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Transform practice complete!</div></div>';
          if (onComplete) onComplete();
          return;
        }
        const item = items[idx];
        itemDiv.innerHTML = '';
        itemDiv.innerHTML = '<div style="margin-bottom:4px;font-size:0.8rem;color:#aaa;">' + (idx+1) + ' of ' + items.length + '</div>';

        const from = el('div', 'gr-st-from');
        from.innerHTML = '<div class="gr-st-label">' + esc(item.givenLabel) + '</div><div class="gr-st-sentence">' + esc(item.given) + '</div>';
        const tts1 = el('button', 'gr-tts-btn', '🔊'); tts1.onclick = () => speakText(item.given); from.appendChild(tts1);
        itemDiv.appendChild(from);
        itemDiv.appendChild(el('div', 'gr-st-arrow', '↓'));

        const toBox = el('div', 'gr-st-to');
        toBox.innerHTML = '<div style="text-align:center;color:#aaa;"><div class="gr-st-label">' + esc(item.targetLabel) + '</div><div style="color:#ccc;font-size:0.85rem;">Choose the correct form below</div></div>';
        itemDiv.appendChild(toBox);

        const hint = el('div', 'gr-hint-text', item.hint ? esc(item.hint) : '');
        hint.style.display = 'none';

        const choices = el('div', 'gr-choices');
        const shuffled = [...(item.choices || [])].sort(() => Math.random() - 0.5);
        let solved = false;
        shuffled.forEach(ch => {
          const btn = el('button', 'gr-choice-chip', esc(ch));
          btn.onclick = () => {
            if (solved) return;
            fxAnswer(ch === item.answer);
            if (ch === item.answer) {
              btn.classList.add('correct');
              if (!solved) { correct++; answered++; solved = true; }
              toBox.innerHTML = '<div style="text-align:center;"><div class="gr-st-label" style="color:#00B894;">' + esc(item.targetLabel) + '</div><div class="gr-st-sentence" style="color:#38513A;">' + esc(item.answer) + '</div></div>';
              const tts2 = el('button', 'gr-tts-btn', '🔊'); tts2.onclick = () => speakText(item.answer); toBox.appendChild(tts2);
              if (item.hint) hint.style.display = 'block';
              scoreText.textContent = answered + ' / ' + items.length;
              barFill.style.width = (answered / items.length * 100) + '%';
              if (sec.manualProgression) {
                const nextBtn = el('button', 'gr-next-btn', idx + 1 < items.length ? 'Next →' : 'Done ✓');
                nextBtn.onclick = () => { idx++; renderItem(); };
                itemDiv.appendChild(nextBtn);
              } else {
                setTimeout(() => { idx++; renderItem(); }, 1500);
              }
            } else {
              btn.classList.add('wrong');
              if (!solved) { answered++; solved = true; }
              if (item.hint) hint.style.display = 'block';
              scoreText.textContent = answered + ' / ' + items.length;
              barFill.style.width = (answered / items.length * 100) + '%';
              choices.querySelectorAll('.gr-choice-chip').forEach(b => {
                if (b.textContent === item.answer) b.classList.add('correct');
              });
              if (sec.manualProgression) {
                const nextBtn = el('button', 'gr-next-btn', idx + 1 < items.length ? 'Next →' : 'Done ✓');
                nextBtn.onclick = () => { idx++; renderItem(); };
                itemDiv.appendChild(nextBtn);
              } else {
                setTimeout(() => { idx++; renderItem(); }, 1500);
              }
            }
          };
          choices.appendChild(btn);
        });
        itemDiv.appendChild(choices);
        itemDiv.appendChild(hint);
      }
      renderItem();
      return div;
    }

    function renderFillSlot(sec, onComplete, stepIdx) {
      const div = el('div', '');
      const items = sec.items || [];
      let idx = 0, correct = 0, answered = 0;

      const scoreRow = el('div', 'gr-score-row');
      const scoreText = el('div', 'gr-score-text', '0 / ' + items.length);
      const barWrap = el('div', 'gr-score-bar-wrap');
      const barFill = el('div', 'gr-score-bar-fill');
      barFill.style.width = '0%';
      barWrap.appendChild(barFill);
      scoreRow.appendChild(scoreText);
      scoreRow.appendChild(barWrap);
      div.appendChild(scoreRow);

      const itemDiv = el('div', 'gr-card');
      div.appendChild(itemDiv);

      function renderItem() {
        if (idx >= items.length) {
          const pct = items.length > 0 ? Math.round(correct / items.length * 100) : 100;
          sectionScores[stepIdx] = { title: sec.title, type: sec.type, correct: correct, total: items.length };
          itemDiv.innerHTML = '<div style="text-align:center;padding:16px;"><div style="font-size:1.4rem;font-weight:900;color:#5E8C5F;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Fill-slot practice complete!</div></div>';
          if (onComplete) onComplete();
          return;
        }
        const item = items[idx];
        itemDiv.innerHTML = '';
        itemDiv.innerHTML = '<div style="margin-bottom:8px;font-size:0.8rem;color:#aaa;">' + (idx+1) + ' of ' + items.length + '</div>';

        const sent = el('div', 'gr-slot-sentence');
        sent.appendChild(el('span', '', esc(item.before)));
        const blank = el('span', 'gr-slot-blank', '　');
        sent.appendChild(blank);
        if (item.after) sent.appendChild(el('span', '', esc(item.after)));
        itemDiv.appendChild(sent);

        const expEl = el('div', 'gr-hint-text', esc(item.explanation));
        expEl.style.display = 'none';

        const chipsRow = el('div', 'gr-slot-choices');
        const nextBtn = el('button', 'gr-slot-next', idx + 1 < items.length ? 'Next →' : 'Finish');
        nextBtn.style.display = 'none';
        nextBtn.onclick = () => { idx++; renderItem(); };

        let solved = false;
        [...(item.choices || [])].sort(() => Math.random() - 0.5).forEach(ch => {
          const chip = el('button', 'gr-slot-chip', esc(ch));
          chip.onclick = () => {
            if (solved) return;
            solved = true;
            blank.textContent = ch;
            const fullSentence = (item.before || '') + ch + (item.after || '');
            var isCorrect = ch === item.answer || (item.also_accept && item.also_accept.includes(ch));
            fxAnswer(isCorrect);
            if (isCorrect) {
              correct++; answered++;
              blank.classList.add('filled-correct');
            } else {
              answered++;
              blank.classList.add('filled-wrong');
              chipsRow.querySelectorAll('.gr-slot-chip').forEach(c => {
                if (c.textContent === item.answer) { c.style.borderColor = '#00B894'; c.style.background = '#DDE7D6'; }
              });
            }
            expEl.style.display = 'block';
            scoreText.textContent = answered + ' / ' + items.length;
            barFill.style.width = (answered / items.length * 100) + '%';
            if (isCorrect) {
              const ttsBtn = el('button', 'gr-tts-btn', '🔊');
              ttsBtn.onclick = () => speakText(fullSentence);
              expEl.appendChild(ttsBtn);
            }
            nextBtn.style.display = 'block';
          };
          chipsRow.appendChild(chip);
        });
        itemDiv.appendChild(chipsRow);
        itemDiv.appendChild(expEl);
        itemDiv.appendChild(nextBtn);
      }
      renderItem();
      return div;
    }

    // Apply Grammar Garden's focus-particle highlights to JP DOM produced by
    // textProcessor.processText. Pulled out of renderConversation so the chat
    // layout below stays compact.
    function _applyParticleHighlights(jp) {
        const particles = (grammarData.meta && grammarData.meta.particles) || [];
        if (!particles.length) return;
        const hlStyle = 'background:' + GRAMMAR_COLORS.particle + '40;border-bottom:2px solid ' + GRAMMAR_COLORS.particle + ';border-radius:2px;padding:0 2px;';
        jp.querySelectorAll('.jp-term').forEach(span => {
            if (particles.some(p => span.textContent === p)) {
                span.setAttribute('style', (span.getAttribute('style') || '') + ';' + hlStyle);
            }
        });
        const walker = document.createTreeWalker(jp, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let tn;
        while ((tn = walker.nextNode())) textNodes.push(tn);
        textNodes.forEach(textNode => {
            if (!textNode.parentNode) return;
            particles.forEach(p => {
                if (!textNode.parentNode) return;
                if (!textNode.textContent.includes(p)) return;
                const parts = textNode.textContent.split(p);
                const frag = document.createDocumentFragment();
                parts.forEach((part, i) => {
                    if (part) frag.appendChild(document.createTextNode(part));
                    if (i < parts.length - 1) {
                        const hl = document.createElement('span');
                        hl.setAttribute('style', hlStyle);
                        hl.textContent = p;
                        frag.appendChild(hl);
                    }
                });
                textNode.parentNode.replaceChild(frag, textNode);
            });
        });
    }

    function renderConversation(sec) {
        const div = el('div', '');
        div.style.cssText = 'padding:12px 4px 18px;';
        if (sec.context) {
            const ctx = el('div', '');
            ctx.style.cssText = 'display:flex;gap:10px;padding:10px 12px;margin-bottom:14px;border-left:2px solid var(--vermilion,#c2410c);background:var(--washi,#f5f1e8);';
            ctx.innerHTML = '<div style="font-size:12.5px;color:var(--ink-2,#4a4138);line-height:1.5;font-style:italic;">' + esc(sec.context) + '</div>';
            div.appendChild(ctx);
        }
        const toggle = el('button', 'gr-conv-toggle', showEN ? 'Hide English Translation' : 'Show English Translation');
        toggle.onclick = () => { showEN = !showEN; renderCurrentStep(); };
        div.appendChild(toggle);

        const speakers = sec.speakers || {};
        const rightSpk = window.JPShared.characters.rightSpeaker(sec.lines, speakers, termMapData);
        const msgWrap = el('div', '');
        msgWrap.style.cssText = 'padding:6px 8px 0;display:flex;flex-direction:column;gap:6px;';
        (sec.lines || []).forEach((line, idx) => {
            const spk = String(line.spk || '');
            const who = window.JPShared.characters.resolve(spk, speakers, termMapData, getCdnUrl);
            const isRight = spk === rightSpk;
            const prevSpk = idx > 0 ? String(sec.lines[idx - 1].spk || '') : null;
            const sameAsPrev = prevSpk === spk;

            const row = el('div', '');
            row.style.cssText = 'display:flex;flex-direction:column;align-items:' + (isRight ? 'flex-end' : 'flex-start') + ';gap:2px;margin-top:' + (sameAsPrev ? '2px' : '10px') + ';';

            // Header (avatar + display name) above the first bubble in a run.
            if (!sameAsPrev) {
                const header = el('div', '');
                header.innerHTML =
                    '<div style="display:flex;align-items:center;gap:8px;flex-direction:' + (isRight ? 'row-reverse' : 'row') + ';padding:0 4px;margin-bottom:2px;">' +
                      (who.portraitUrl
                        ? '<img src="' + who.portraitUrl + '" alt="' + esc(who.name) + '" style="width:30px;height:30px;border-radius:999px;object-fit:cover;object-position:center top;background:var(--washi-2,#efe9d8);border:1px solid var(--hairline,rgba(40,35,30,0.14));" onerror="this.style.visibility=\'hidden\'">'
                        : '<div style="width:30px;height:30px;border-radius:999px;background:var(--washi-2,#efe9d8);border:1px solid var(--hairline,rgba(40,35,30,0.14));display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-3,#7a7167);font-weight:600;">' + esc(who.initial) + '</div>') +
                      '<div style="font-size:11px;font-weight:600;color:var(--ink-2,#4a4138);letter-spacing:0.01em;">' + esc(who.name) + '</div>' +
                    '</div>';
                row.appendChild(header);
            }

            const bubble = el('div', 'gr-bubble ' + (isRight ? 'gr-bubble--sent' : 'gr-bubble--recv'));

            const jp = el('div', 'gr-bubble-jp');
            jp.innerHTML = window.JPShared.textProcessor.processText(line.jp, line.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES);
            _applyParticleHighlights(jp);
            bubble.appendChild(jp);

            if (showEN) {
                const enDiv = el('div', 'gr-bubble-en');
                enDiv.textContent = line.en || '';
                bubble.appendChild(enDiv);
            }

            const tts = el('button', '');
            tts.innerHTML = '🔊';
            tts.style.cssText = 'background:none;border:none;color:inherit;cursor:pointer;font-size:13px;padding:2px 4px;opacity:0.75;position:absolute;' + (isRight ? 'left:-26px' : 'right:-26px') + ';bottom:4px;';
            tts.onclick = () => speakText(line.jp);
            bubble.appendChild(tts);

            row.appendChild(bubble);
            msgWrap.appendChild(row);
        });
        div.appendChild(msgWrap);
        return div;
    }

    function renderDrills(sec, stepIdx) {
      const div = el('div', '');
      const mcqItems = (sec.items || []).filter(i => i.kind === 'mcq');
      let secCorrect = 0, secAnswered = 0;
      (sec.items || []).forEach((item, itemIdx) => {
        if (item.kind === 'mcq') {
          const card = el('div', 'gr-drill-card');
          const qEl = el('div', 'gr-drill-q');
          qEl.innerHTML = item.terms
            ? window.JPShared.textProcessor.processText(item.q, item.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)
            : esc(item.q);
          card.appendChild(qEl);
          const optsDiv = el('div', '');
          const expEl = el('div', 'gr-explanation', item.explanation ? esc(item.explanation) : '');
          let solved = false;
          const itemKey = 'gr_drill__' + grammarId + '__' + itemIdx;
          const shuffled = [...item.choices].sort(() => Math.random() - 0.5);
          shuffled.forEach(choice => {
            const btn = el('button', 'gr-mcq-opt', esc(choice));
            btn.onclick = () => {
              if (solved) return; solved = true;
              fxAnswer(choice === item.answer);
              if (choice === item.answer) {
                btn.classList.add('correct');
                if (!drillAnswered.has(itemKey)) { drillAnswered.add(itemKey); drillCorrect++; secCorrect++; }
              } else {
                btn.classList.add('wrong');
                if (!drillAnswered.has(itemKey)) drillAnswered.add(itemKey);
                optsDiv.querySelectorAll('.gr-mcq-opt').forEach(c => {
                  if (c.textContent === item.answer) c.classList.add('correct');
                });
                if (item.terms && item.terms.length > 0) {
                  item.terms.forEach(termId => {
                    const rt = window.JPShared.textProcessor.getRootTerm(termId, termMapData);
                    if (rt) window.JPShared.progress.flagTerm(rt.surface);
                  });
                }
              }
              secAnswered++;
              sectionScores[stepIdx] = { title: sec.title, type: sec.type, correct: secCorrect, total: mcqItems.length };
              if (expEl.textContent) expEl.classList.add('visible');
            };
            optsDiv.appendChild(btn);
          });
          card.appendChild(optsDiv);
          card.appendChild(expEl);
          div.appendChild(card);
        }
      });
      return div;
    }

    // ──────────────────────────────────────────────
    // STEP RENDERING
    // ──────────────────────────────────────────────

    function renderCurrentStep() {
      if (window.JPApp) window.JPApp.hideTabBar();
      const body = root.querySelector('.gr-body');
      const title = root.querySelector('.gr-title');
      const bar = root.querySelector('.gr-progress-bar');
      const nextBtn = root.querySelector('.gr-nav-btn.next');
      const prevBtn = root.querySelector('.gr-nav-btn.prev');

      body.innerHTML = '';
      bar.style.width = (((currentStep + 1) / totalSteps) * 100) + '%';

      if (currentStep >= grammarData.sections.length) {
        title.innerText = 'Complete!';

        // First-time G1 in-grammar tutorial: fire the completion-screen line.
        if (grammarId === 'G1'
            && window.JPShared.rikizoCompanion
            && window.JPShared.rikizoCompanion.runGrammarTutorialStep) {
          setTimeout(function () {
            window.JPShared.rikizoCompanion.runGrammarTutorialStep('complete');
          }, 350);
        }

        // Compute combined score from all interactive sections.
        const allScores = Object.values(sectionScores);
        const combinedCorrect = allScores.reduce((s, e) => s + e.correct, 0);
        const combinedTotal = allScores.reduce((s, e) => s + e.total, 0);
        const pct = combinedTotal > 0 ? Math.round(combinedCorrect / combinedTotal * 100) : 100;
        const rank = [...SCORE_RANKS].reverse().find(r => pct >= r.min) || SCORE_RANKS[0];
        markGrammarComplete(grammarId, pct);

        // Build per-section breakdown, sorted worst-first for "needs work" emphasis.
        const breakdownEntries = allScores
          .filter(e => e.total > 0)
          .sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
        const breakdownHtml = breakdownEntries.length > 1 ? `
          <div style="margin-top:18px;border-top:1px solid #f0f0f0;padding-top:14px;text-align:left;">
            <div style="font-size:0.75rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;text-align:center;">Breakdown</div>
            ${breakdownEntries.map(e => {
              const ePct = Math.round(e.correct / e.total * 100);
              const barColor = ePct >= 80 ? '#5E8C5F' : ePct >= 50 ? '#F59E0B' : '#EF4444';
              const label = e.title || e.type;
              return `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                  <span style="font-size:0.85rem;font-weight:600;color:#333;">${esc(label)}</span>
                  <span style="font-size:0.8rem;font-weight:700;color:${barColor};">${e.correct}/${e.total}</span>
                </div>
                <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${ePct}%;background:${barColor};border-radius:3px;transition:width 0.5s;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>` : '';

        // Bridge into the unlock engine so grammar completion gates downstream content.
        const unlockApi = window.JPShared && window.JPShared.unlock;
        const unlockResult = unlockApi && _manifestCache
          ? unlockApi.computeUnlocks(grammarId, 100, _manifestCache)
          : null;
        const newItems = (unlockResult && unlockResult.newItems) || [];

        // Build unlock chips (same style as Lesson.js reveal).
        const unlockHtml = newItems.length > 0 ? `
          <div style="margin-top:18px;border-top:1px solid #f0f0f0;padding-top:14px;">
            <div style="font-size:0.75rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🔓 Unlocked</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
              ${newItems.map(item => `<div style="background:#F3EEE4;border:1px solid #DED7C6;border-radius:10px;padding:6px 12px;font-size:0.85rem;font-weight:700;color:#4A7A4C;">${item.icon} ${item.label}</div>`).join('')}
            </div>
          </div>` : '';

        body.innerHTML = `
          <div class="gr-card" style="text-align:center; position:relative; padding:30px 20px;">
            <h2 style="margin-bottom:15px;">🌿 Grammar Lesson Complete!</h2>
            ${combinedTotal > 0 ? `
            <div style="font-size:0.8rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Drill Score</div>
            <div style="font-size:3rem;font-weight:900;color:${rank.colors[0]};line-height:1.1;">${rank.msg}</div>
            <div style="font-size:1rem;color:#747d8c;font-weight:600;margin:6px 0 14px;">${rank.sub}</div>
            <div style="font-size:2.2rem;font-weight:900;color:#5E8C5F;">${pct}%</div>
            <div style="font-size:0.9rem;color:#888;margin-top:4px;">${combinedCorrect} / ${combinedTotal} correct</div>
            ${breakdownHtml}
            ` : ''}
            ${unlockHtml}
          </div>`;
        nextBtn.innerText = 'Finish';
        if (combinedTotal > 0) launchHanabi(rank, body.querySelector('.gr-card'));
        return;
      }

      const sec = grammarData.sections[currentStep];
      title.innerText = sec.title || grammarData.title;

      // Tell Ask-Rikizo what grammar section is on screen for in-context answers.
      try {
        const tc = window.JPShared && window.JPShared.tutorContext;
        if (tc) tc.patch({
          view: 'grammar',
          lessonId: grammarId,
          title: grammarData.title || sec.title || '',
          page: currentStep,
          sectionType: sec.type,
          sample: tc.sampleFromSection(sec)
        });
      } catch (e) {}

      const wrap = el('div', '');
      let content = null;

      const isInteractive = sec.type === 'fillSlot' || sec.type === 'sentenceTransform' || sec.type === 'conjugationDrill';
      const stepIdx = currentStep;
      if (isInteractive && !completedSteps.has(stepIdx)) nextBtn.disabled = true;
      else if (!isInteractive) nextBtn.disabled = false; // reset if navigating back from an interactive step
      const enableNext = isInteractive ? () => { completedSteps.add(stepIdx); nextBtn.disabled = false; } : null;

      try {
        if      (sec.type === 'grammarIntro')      content = renderGrammarIntro(sec);
        else if (sec.type === 'grammarRule')        content = renderGrammarRule(sec);
        else if (sec.type === 'grammarTable')       content = renderGrammarTable(sec);
        else if (sec.type === 'grammarComparison')  content = renderGrammarComparison(sec);
        else if (sec.type === 'annotatedExample')   content = renderAnnotatedExample(sec);
        else if (sec.type === 'conjugationDrill')   content = renderConjugationDrill(sec, enableNext, stepIdx);
        else if (sec.type === 'patternMatch')        content = renderPatternMatch(sec, stepIdx);
        else if (sec.type === 'sentenceTransform')  content = renderSentenceTransform(sec, enableNext, stepIdx);
        else if (sec.type === 'fillSlot')           content = renderFillSlot(sec, enableNext, stepIdx);
        else if (sec.type === 'conversation')       content = renderConversation(sec);
        else if (sec.type === 'drills')             content = renderDrills(sec, stepIdx);
        else content = el('div', 'gr-card', '<em>Unknown section type: ' + esc(sec.type) + '</em>');
      } catch (renderErr) {
        console.error('renderCurrentStep error at step', currentStep, '(', sec.type, '):', renderErr);
        content = el('div', 'gr-card', '<em style="color:red;">Error rendering section "' + esc(sec.title || sec.type) + '": ' + esc(renderErr.message) + '</em>');
      }

      if (content) wrap.appendChild(content);
      body.appendChild(wrap);

      prevBtn.disabled = (currentStep === 0);
      nextBtn.innerText = (currentStep === totalSteps - 1) ? 'Finish' : 'Next';

      // First-time G1 in-grammar tutorial: fire the per-section explanation
      // after the page is rendered. Each tutorial key fires at most once,
      // persisted across sessions in k-rikizo-grammar-tutorial-seen.
      if (grammarId === 'G1' && sec && sec.type
          && window.JPShared.rikizoCompanion
          && window.JPShared.rikizoCompanion.runGrammarTutorialStep) {
        const tutKey = sec.tutorialKey || sec.type;
        setTimeout(function () {
          window.JPShared.rikizoCompanion.runGrammarTutorialStep(tutKey);
        }, 350);
      }
    }

    // ──────────────────────────────────────────────
    // LOAD & NAVIGATION
    // ──────────────────────────────────────────────

    async function loadGrammarLesson(file, id) {
      // Clean up any leftover companion state (stale bubble, in-flight chain,
      // busy flag stuck from a prior unresolved tap) so this grammar load
      // starts with a clean slate — same pattern as Lesson.js's loadLesson.
      if (window.JPShared.rikizoCompanion && window.JPShared.rikizoCompanion.resetRuntime) {
        window.JPShared.rikizoCompanion.resetRuntime();
      }
      root.innerHTML = `
        <div class="gr-header">
          <button class="gr-back-btn">← List</button>
          <div class="gr-title">Loading...</div>
          <div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="gr-exit-btn">Exit</button></div>
        </div>
        <div class="gr-progress-container"><div class="gr-progress-bar"></div></div>
        <div class="gr-body"></div>
        <div class="gr-footer">
          <button class="gr-nav-btn prev">Prev</button>
          <button class="gr-nav-btn next">Next</button>
        </div>`;
      root.querySelector('.gr-back-btn').onclick = () => renderMenu();
      root.querySelector('.gr-exit-btn').onclick = exitCallback;

      try {
        // Cache-bust the grammar JSON so authored edits land without forcing
        // the user to hard-reload (matches the pattern used elsewhere).
        const url = getCdnUrl(file) + '?t=' + Date.now();
        const [gRes, resources] = await Promise.all([fetch(url), loadResources()]);
        grammarData = await gRes.json();
        grammarId = id;
        drillCorrect = 0; drillAnswered.clear(); completedSteps.clear();
        Object.keys(sectionScores).forEach(k => delete sectionScores[k]);
        drillTotal = (grammarData.sections || []).reduce((sum, sec) => {
          if (sec.type === 'drills') return sum + (sec.items || []).filter(i => i.kind === 'mcq').length;
          if (sec.type === 'conjugationDrill' || sec.type === 'sentenceTransform' || sec.type === 'fillSlot') return sum + (sec.items || []).length;
          return sum;
        }, 0);
        termMapData = resources.map;
        CONJUGATION_RULES = resources.conj;
        COUNTER_RULES = resources.counter;
        window.JPShared.termModal.setTermMap(termMapData);

        currentStep = 0;
        totalSteps = grammarData.sections.length + 1;
        showEN = false;

        root.querySelector('.gr-nav-btn.prev').onclick = () => {
          if (currentStep > 0) { currentStep--; showEN = false; renderCurrentStep(); }
        };
        root.querySelector('.gr-nav-btn.next').onclick = () => {
          if (currentStep < totalSteps) { currentStep++; showEN = false; renderCurrentStep(); }
          else renderMenu();
        };
        renderCurrentStep();
      } catch (err) {
        console.error(err);
        root.querySelector('.gr-body').innerHTML = '<div style="color:red;padding:20px;">Error loading grammar lesson: ' + esc(err.message) + '</div>';
      }
    }

    async function fetchGrammarList() {
      root.innerHTML = `
        <div class="gr-header">
          <div class="gr-title">🌿 Grammar Garden</div>
          <div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="gr-exit-btn">Exit</button></div>
        </div>
        <div class="gr-body" style="justify-content:center;align-items:center;color:#888;">Loading...</div>`;
      root.querySelector('.gr-exit-btn').onclick = exitCallback;

      try {
        const manifest = await window.getManifest(REPO_CONFIG);
        _manifestCache = manifest;
        currentGrammars = [];
        (manifest.levels || []).forEach(level => {
          const levelData = manifest.data && manifest.data[level];
          if (!levelData || !levelData.grammar) return;
          levelData.grammar.forEach(g => {
            currentGrammars.push({ ...g, level });
          });
        });
        renderMenu();
      } catch (err) {
        root.querySelector('.gr-body').innerHTML = '<div style="color:red;padding:20px;">Error: ' + esc(err.message) + '</div>';
      }
    }

    // ── Grammar Garden scene assets (inline SVG, themed via currentColor/vars) ──
    function lanternSVG() {
      return '<svg viewBox="0 0 60 92" aria-hidden="true">' +
        '<ellipse cx="30" cy="88" rx="17" ry="4.5" fill="currentColor" opacity="0.5"/>' +
        '<rect x="25.5" y="62" width="9" height="24" rx="2.5" fill="currentColor"/>' +
        '<path d="M19 62 H41 L37 55 H23 Z" fill="currentColor"/>' +
        '<rect x="19" y="33" width="22" height="22" rx="3.5" fill="currentColor"/>' +
        '<rect class="gr-lantern-light" x="25" y="38" width="10" height="12" rx="2.5"/>' +
        '<path d="M12 33 Q30 13 48 33 Q40 27 30 25 Q20 27 12 33 Z" fill="currentColor"/>' +
        '<circle cx="30" cy="15" r="3.2" fill="currentColor"/>' +
      '</svg>';
    }
    var GARDEN_SCENERY = [
      // koi pond
      '<svg viewBox="0 0 80 80" aria-hidden="true"><ellipse cx="40" cy="48" rx="33" ry="19" fill="oklch(0.72 0.07 220)"/>' +
        '<path d="M28 44 q7 -6 13 0 q-4 4 -13 0z" fill="oklch(0.68 0.16 40)"/>' +
        '<path d="M45 53 q6 -5 11 0 q-3 3 -11 0z" fill="oklch(0.7 0.15 30)"/></svg>',
      // bonsai
      '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="34" r="16" fill="oklch(0.55 0.1 142)"/>' +
        '<circle cx="27" cy="40" r="10" fill="oklch(0.56 0.1 142)"/><circle cx="53" cy="40" r="10" fill="oklch(0.54 0.1 145)"/>' +
        '<rect x="38" y="42" width="4" height="18" fill="oklch(0.4 0.05 60)"/>' +
        '<path d="M26 60 H54 L50 70 H30 Z" fill="oklch(0.45 0.08 40)"/></svg>',
      // torii gate
      '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="18" y="22" width="44" height="7" rx="2" fill="var(--vermilion)"/>' +
        '<rect x="24" y="32" width="32" height="4.5" fill="var(--vermilion)"/>' +
        '<rect x="26" y="22" width="6.5" height="46" fill="var(--vermilion)"/>' +
        '<rect x="47.5" y="22" width="6.5" height="46" fill="var(--vermilion)"/></svg>',
      // bamboo
      '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="31" y="12" width="6" height="58" rx="3" fill="oklch(0.6 0.12 135)"/>' +
        '<rect x="44" y="20" width="5" height="50" rx="2.5" fill="oklch(0.63 0.11 138)"/>' +
        '<path d="M37 26 q12 -4 18 -12" stroke="oklch(0.6 0.13 135)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M31 34 q-12 -3 -18 -10" stroke="oklch(0.6 0.13 135)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
      // maple
      '<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="38" y="42" width="4" height="20" fill="oklch(0.4 0.05 60)"/>' +
        '<circle cx="40" cy="34" r="15" fill="oklch(0.56 0.16 35)"/><circle cx="29" cy="40" r="9" fill="oklch(0.55 0.16 35)"/>' +
        '<circle cx="51" cy="40" r="9" fill="oklch(0.55 0.16 30)"/></svg>'
    ];
    // PNG filenames parallel to GARDEN_SCENERY (koi, bonsai, torii, bamboo, maple).
    var GARDEN_SCENERY_ART = ['garden-koi.png', 'garden-bonsai.png', 'garden-torii.png', 'garden-bamboo.png', 'garden-maple.png'];

    function renderMenu() {
      if (window.JPApp) window.JPApp.showTabBar();
      root.innerHTML = `
        <div class="gr-header">
          <div class="gr-title">🌿 Grammar Garden</div>
          <div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="gr-exit-btn">Exit</button></div>
        </div>
        <div class="gr-body gr-body-garden">
          <div class="gr-garden" id="gr-garden"></div>
        </div>`;
      root.querySelector('.gr-exit-btn').onclick = exitCallback;
      const garden = document.getElementById('gr-garden');

      const sk = window.JPShared && window.JPShared.sceneKit;
      const stage = window.JPShared && window.JPShared.gardenStage;
      if (stage) stage.reset(); // tear down any ponds from a previous render
      const artUrl = name => window.getAssetUrl ? window.getAssetUrl(REPO_CONFIG, 'assets/scenes/' + name) : '';

      // Garden ground tile (repeats down the scroll) over the gradient fallback.
      const tileUrl = artUrl('garden-tile.png');
      if (tileUrl) garden.style.setProperty('--garden-tile', "url('" + tileUrl + "')");

      const unlockApi = window.JPShared && window.JPShared.unlock;
      const visibleGrammars = currentGrammars.filter(g =>
        !unlockApi || unlockApi.isFree() || unlockApi.isGrammarUnlocked(g)
      );

      if (visibleGrammars.length === 0) {
        garden.style.height = 'auto';
        garden.innerHTML = '<div class="gr-garden-empty">この庭はまだ眠っています。<br>Finish your first lessons to plant the garden.</div>';
        return;
      }

      const stampApi = window.JPShared && window.JPShared.stampSettings;
      const stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
      const pooUrl = stampApi && stampApi.getPooUrl ? stampApi.getPooUrl() : '';

      const TOP = 50;       // px above the first lantern
      const STEP = 198;     // vertical px between lanterns (room for the wood sign)
      const AMP = 19;       // horizontal swing (% of width)
      const SVG_H = 92;     // lantern figure height
      const N = visibleGrammars.length;

      const xPctAt = i => 50 + AMP * Math.sin(i * 0.92);
      const lanternTopAt = i => TOP + i * STEP;
      const stoneCenterAt = i => lanternTopAt(i) + SVG_H + 9; // center of the base stone

      garden.style.height = (lanternTopAt(N - 1) + SVG_H + 210) + 'px';

      function place(node, xPct, yPx) {
        node.style.position = 'absolute';
        node.style.left = xPct + '%';
        node.style.top = yPx + 'px';
        node.style.transform = 'translate(-50%, -50%)';
        garden.appendChild(node);
        return node;
      }

      // 1) Background scenery — decorative, every other lantern, opposite side.
      //    PNG (garden-<element>.png) layers over the inline-SVG fallback.
      //    Koi spots (sIdx 0) become LIVING ponds: a canvas with swimming koi
      //    (gardenStage) instead of the static painting — nudged inward + larger
      //    so the koi are actually visible.
      // Each scenery TYPE gets its own idle life: koi swim (pond canvas), maple
      // sheds leaves (canvas) + sways, bamboo/bonsai sway in the wind, torii
      // catches drifting dappled light. Sway/dapple are CSS; canvases are gardenStage.
      // koi pond + bamboo water-clacker (shishi-odoshi) are full canvas scenes;
      // bonsai/torii/maple keep their watercolor PNG and gain life — sway,
      // falling leaves, a flitting butterfly, dappled light.
      const SCENERY_TYPE = ['pond', 'bonsai', 'torii', 'bamboo', 'maple'];
      const SWAYS = { bonsai: 1, maple: 1 };
      const CANVAS_SPOT = { pond: 1, bamboo: 1 }; // no PNG — drawn entirely
      const BUTTERFLY = { bonsai: 1, maple: 1, torii: 1 };
      for (let i = 0; i < N; i += 2) {
        const g = visibleGrammars[i];
        const sIdx = sk ? sk.hashIndex(g.id, GARDEN_SCENERY.length) : (i % GARDEN_SCENERY.length);
        const type = SCENERY_TYPE[sIdx] || 'plant';
        const big = (type === 'pond' || type === 'maple' || type === 'bamboo');
        const right = xPctAt(i) >= 50;
        const side = right ? (big ? 24 : 15) : (big ? 76 : 85);
        const jitter = sk ? (sk.hashIndexSalted(g.id, 'sy', 5) - 2) * 11 : 0;
        let cls = 'gr-scenery gr-scenery--' + type;
        if (SWAYS[type]) cls += ' gr-scenery--sway';
        const scenery = el('div', cls);
        if (SWAYS[type] && sk) scenery.style.setProperty('--sway-delay', '-' + (sk.hashIndexSalted(g.id, 'sd', 40) / 10).toFixed(1) + 's');

        if (type === 'pond' && stage) {
          stage.createPond(scenery);
        } else if (type === 'bamboo' && stage) {
          stage.createClacker(scenery);
        } else {
          if (sk) scenery.appendChild(sk.artLayer(artUrl(GARDEN_SCENERY_ART[sIdx]), 'gr-scenery-art'));
          scenery.appendChild(el('div', 'sk-fallback', GARDEN_SCENERY[sIdx]));
          if (type === 'maple' && stage) stage.createLeaves(scenery);
        }
        // a butterfly visits the plants/gate (not the canvas-only water spots)
        if (BUTTERFLY[type] && stage && !CANVAS_SPOT[type]) stage.createButterfly(scenery);
        place(scenery, side, lanternTopAt(i) + 30 + jitter);
      }

      // 2) Stepping-stone path — connector stones between consecutive lanterns.
      //    Painted stone PNG over the grey-ellipse fallback; alternating flip so
      //    the repeated art doesn't read as identical.
      let stepN = 0;
      for (let i = 0; i < N - 1; i++) {
        for (let t = 1; t <= 2; t++) {
          const f = t / 3;
          const x = xPctAt(i) + (xPctAt(i + 1) - xPctAt(i)) * f;
          const y = stoneCenterAt(i) + (stoneCenterAt(i + 1) - stoneCenterAt(i)) * f;
          const step = el('div', 'gr-steppingstone');
          if (sk) step.appendChild(sk.artLayer(artUrl('stone-step.png'), 'gr-stone-art'));
          step.appendChild(el('div', 'sk-fallback'));
          place(step, x, y);
          if (stepN++ % 2) step.style.transform += ' scaleX(-1)';
        }
      }

      // 3) Level markers + lanterns.
      let lastLevel = null;
      let firstNotDoneSeen = false;
      visibleGrammars.forEach((g, i) => {
        if (g.level !== lastLevel) {
          lastLevel = g.level;
          const marker = el('div', 'gr-level-marker', '<span>' + esc(g.level) + ' · ぶんぽう</span>');
          marker.style.position = 'absolute';
          marker.style.left = '0';
          marker.style.right = '0';
          marker.style.top = (lanternTopAt(i) - STEP / 2 + 14) + 'px';
          garden.appendChild(marker);
        }

        const done = isGrammarComplete(g.id);
        const score = done ? progressGet('grammar_' + g.id + '_drill_score') : null;
        const hasScore = score !== undefined && score !== null;

        const lantern = el('div', 'gr-lantern' + (done ? ' lit' : ''));
        if (!done && !firstNotDoneSeen) { lantern.classList.add('gr-lantern--next'); firstNotDoneSeen = true; }

        // lantern figure: PNG (lit/unlit) over the inline-SVG fallback
        const fig = el('div', 'gr-lantern-fig');
        if (sk) fig.appendChild(sk.artLayer(artUrl(done ? 'lantern-lit.png' : 'lantern-unlit.png'), 'gr-lantern-art'));
        fig.appendChild(el('div', 'gr-lantern-svg sk-fallback', lanternSVG()));
        lantern.appendChild(fig);
        const baseStone = el('div', 'gr-stone');
        if (sk) baseStone.appendChild(sk.artLayer(artUrl('stone-step.png'), 'gr-stone-art'));
        baseStone.appendChild(el('div', 'sk-fallback'));
        if (sk && sk.hashIndexSalted(g.id, 'flip', 2)) baseStone.style.transform = 'scaleX(-1)';
        lantern.appendChild(baseStone);
        const sign = el('div', 'gr-lantern-sign', '');
        sign.appendChild(el('div', 'gr-lantern-id', esc(g.id)));
        sign.appendChild(el('div', 'gr-lantern-title', esc(g.title || '')));
        lantern.appendChild(sign);

        if (done && hasScore && (stampUrl || pooUrl)) {
          const passing = score >= 60;
          const stampDiv = el('div', 'gr-lantern-stamp', '');
          const img = document.createElement('img');
          img.src = passing ? stampUrl : (pooUrl || stampUrl);
          img.alt = passing ? '✓' : '✗';
          const tilt = sk ? (sk.hashIndexSalted(g.id, 'tilt', 31) - 15) : 0;
          img.style.transform = 'rotate(' + tilt + 'deg)';
          stampDiv.appendChild(img);
          lantern.appendChild(stampDiv);
        }

        lantern.style.position = 'absolute';
        lantern.style.left = xPctAt(i) + '%';
        lantern.style.top = lanternTopAt(i) + 'px';
        lantern.style.transform = 'translateX(-50%)';
        lantern.onclick = () => { if (sk) sk.tapFeedback(lantern); loadGrammarLesson(g.file, g.id); };
        garden.appendChild(lantern);
      });
    }

    // --- Modal ---
    window.JPShared.termModal.inject();

    // --- Initialize ---
    // If a specific grammarId was passed in (e.g. from the home screen's
    // "Today" card pointing at G1), look it up in the manifest and jump
    // straight into that grammar lesson, bypassing the picker.
    if (grammarId) {
      (async function () {
        try {
          const manifest = await window.getManifest(REPO_CONFIG);
          _manifestCache = manifest;
          currentGrammars = [];
          (manifest.levels || []).forEach(function (level) {
            const ld = manifest.data && manifest.data[level];
            if (!ld || !ld.grammar) return;
            ld.grammar.forEach(function (g) { currentGrammars.push(Object.assign({}, g, { level: level })); });
          });
          const entry = currentGrammars.find(function (g) { return g.id === grammarId; });
          if (entry && entry.file) { loadGrammarLesson(entry.file, entry.id); return; }
        } catch (e) { /* fall through */ }
        fetchGrammarList();
      })();
    } else {
      fetchGrammarList();
    }
  }
};
