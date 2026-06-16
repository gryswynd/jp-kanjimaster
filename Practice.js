window.PracticeModule = {
  start: function(container, sharedConfig, exitCallback) {
    // --- 1. SETUP & STYLES ---

    window.KanjiApp = {};

    // Inject Fonts
    if (!document.getElementById('kanji-fonts')) {
        const link = document.createElement('link');
        link.id = 'kanji-fonts';
        link.rel = 'stylesheet';
        link.href = 'app/shared/fonts.css';
        document.head.appendChild(link);
    }

    // Inject CSS
    if (!document.getElementById('jp-practice-style')) {
        const style = document.createElement("style");
        style.id = 'jp-practice-style';
        style.textContent = `
            #kanji-app-root {
                --primary: oklch(0.60 0.18 30); --primary-dark: oklch(0.52 0.18 30);
                --washi: oklch(0.97 0.008 80); --washi-2: oklch(0.94 0.012 75); --washi-3: oklch(0.90 0.015 75);
                --ink: oklch(0.22 0.012 60); --ink-2: oklch(0.38 0.012 60); --ink-3: oklch(0.55 0.012 60);
                --hairline: oklch(0.22 0.012 60 / 0.12); --hairline-2: oklch(0.22 0.012 60 / 0.06);
                --vermilion: oklch(0.60 0.18 30); --moss: oklch(0.58 0.09 140);
                --indigo: oklch(0.42 0.08 250); --gold: oklch(0.78 0.10 85);
                --font-ui: "Schibsted Grotesk","Work Sans",system-ui,sans-serif;
                --font-jp: "Noto Sans JP",system-ui,sans-serif;
                --font-jp-display: "Noto Serif JP","Shippori Mincho",serif;
                --font-mono: "JetBrains Mono",ui-monospace,Menlo,monospace;
                --r-sm:8px; --r-md:14px; --r-lg:22px; --r-xl:28px;
                --text-main: var(--ink); --text-sub: var(--ink-3);
                --success: var(--moss); --error: var(--vermilion);

                font-family: var(--font-ui);
                background:
                  radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
                  radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
                  var(--washi);
                color: var(--ink);
                display: flex; flex-direction: column;
                width: 100%; min-height: 100vh; min-height: 100dvh; position: relative;
            }
            #kanji-app-root * { box-sizing: border-box; }

            #kanji-app-root header {
                background: var(--ink); color: var(--washi);
                padding: max(28px,env(safe-area-inset-top)) 18px 14px;
                z-index: 10;
                border-bottom: 1px solid oklch(1 0 0 / 0.1);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0;
                user-select: none;
            }
            #kanji-app-root .k-head-title {
                display: flex; flex-direction: column; align-items: flex-start;
                cursor: pointer; gap: 1px; min-width: 0; flex: 1; padding: 2px 0;
            }
            #kanji-app-root .k-head-code {
                font-family: var(--font-mono); font-size: 10px;
                color: oklch(0.78 0.10 85); letter-spacing: 0.22em; font-weight: 600;
            }
            #kanji-app-root .k-head-name {
                font-family: var(--font-jp-display); font-weight: 600; font-size: 17px;
                letter-spacing: -0.01em; color: var(--washi);
            }
            #kanji-app-root .k-head-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
            .k-exit-btn {
                background: transparent;
                border: 1px solid oklch(1 0 0 / 0.25);
                color: var(--washi);
                padding: 6px 14px; border-radius: 999px;
                cursor: pointer; font-weight: 600; font-size: 12px;
                font-family: var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase;
                transition: background 0.2s, transform 0.12s;
            }
            .k-exit-btn:active { transform: scale(0.96); }
            #kanji-app-root .jp-settings-gear {
                background: transparent; border: 1px solid oklch(1 0 0 / 0.25); color: var(--washi);
                width: 32px; height: 32px; border-radius: 999px; cursor: pointer; font-size: 14px;
                display: inline-flex; align-items: center; justify-content: center;
                transition: background 0.2s, transform 0.12s;
            }
            #kanji-app-root .jp-settings-gear:active { transform: scale(0.94); }

            #k-app-container {
                flex: 1; overflow-y: auto;
                padding: 22px 18px calc(22px + env(safe-area-inset-bottom));
                display: flex; flex-direction: column; align-items: center;
                width: 100%; position: relative; z-index: 1;
                -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
            }
            .k-card {
                background: var(--washi);
                border: 1px solid var(--hairline);
                border-radius: var(--r-lg);
                box-shadow: none;
                padding: 1.5rem;
                width: 100%; text-align: center; margin-bottom: 1.25rem;
                transition: box-shadow 0.4s ease, border-color 0.4s ease;
            }
            .k-btn {
                background: var(--ink); color: var(--washi);
                border: none; padding: 14px 22px; border-radius: 999px;
                font-size: 15px; font-weight: 600; font-family: inherit;
                width: 100%; margin: 6px 0; cursor: pointer;
                transition: transform 0.12s ease, background 0.2s, box-shadow 0.2s;
                letter-spacing: -0.01em;
            }
            .k-btn:active { transform: scale(0.98); }
            .k-btn-sec {
                background: transparent; color: var(--ink-2);
                border: 1px solid var(--hairline);
                font-size: 13px; font-weight: 600;
                padding: 12px 18px;
                box-shadow: none;
            }
            .k-btn-sec:active { transform: scale(0.98); }
            .k-btn--moss   { background: var(--moss); color: var(--washi); }
            .k-btn--indigo { background: var(--indigo); color: var(--washi); }
            .k-btn--gold   { background: var(--gold); color: var(--ink); }
            .k-btn--pink   { background: oklch(0.62 0.13 350); color: var(--washi); }
            .k-grid-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 8px 0; }
            .k-grid-btns .k-btn { font-size: 13px; padding: 11px 8px; margin: 0; }
            .k-hidden { display: none !important; }

            /* Progress bar (shared with redesign system) */
            .jp-progress-track {
                height: 4px; background: var(--hairline);
                border-radius: 2px; position: relative;
                width: 100%; margin: 0 0 14px;
                overflow: hidden;
            }
            .jp-progress-fill {
                height: 100%; background: var(--vermilion);
                width: 0%; transition: width 0.3s ease;
            }

            /* Mono pill badges (BEST / STREAK) */
            .k-pill {
                font-family: var(--font-mono); font-size: 10.5px;
                color: var(--ink-3); letter-spacing: 0.12em; text-transform: uppercase;
                padding: 5px 10px; border: 1px solid var(--hairline);
                border-radius: 999px; background: transparent;
                display: inline-flex; align-items: center; gap: 6px;
                flex-shrink: 0;
            }
            .k-pill b { color: var(--ink); font-weight: 700; font-size: 12px; letter-spacing: 0; }
            .k-pill.streak { color: var(--vermilion); border-color: oklch(0.60 0.18 30 / 0.25); }
            .k-pill.streak b { color: var(--vermilion); }

            .k-stat-row {
                display: flex; justify-content: space-between; align-items: center;
                width: 100%; margin-bottom: 12px; gap: 8px; flex-wrap: wrap;
            }
            .k-stat-progress {
                font-family: var(--font-mono); font-size: 10.5px;
                color: var(--ink-3); letter-spacing: 0.14em; text-transform: uppercase;
                font-weight: 500;
            }

            .k-big { font-family: var(--font-jp-display); font-size: 4.5rem; margin: 0.2rem 0; color: var(--ink); font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; }
            .k-sub { font-size: 1.15rem; color: var(--ink-2); font-weight: 500; margin-bottom: 0.5rem; }
            .k-lbl {
                font-family: var(--font-mono);
                font-size: 10.5px; text-transform: uppercase;
                color: var(--ink-3); font-weight: 500;
                letter-spacing: 0.14em; margin: 14px 0 6px;
            }

            /* FLIP CARD */
            .k-scene { width: 100%; height: 400px; perspective: 1000px; margin-bottom: 20px; cursor: pointer; touch-action: pan-y; }
            .k-card-obj { width: 100%; height: 100%; position: relative; transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; border-radius: var(--r-lg); }
            .k-card-obj.is-flipped { transform: rotateY(180deg); }
            .k-face {
                position: absolute; width: 100%; height: 100%;
                backface-visibility: hidden; -webkit-backface-visibility: hidden;
                border-radius: var(--r-lg);
                background: var(--washi);
                border: 1px solid var(--hairline);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                padding: 2rem; overflow-y: auto; overflow-x: hidden;
            }
            .k-face-front { z-index: 2; transform: rotateY(0deg); }
            .k-face-back {
                transform: rotateY(180deg);
                background: var(--washi-2);
                border: 1px solid oklch(0.60 0.18 30 / 0.30);
                justify-content: flex-start;
                padding-top: 2.5rem;
            }
            .k-tap-hint {
                position: absolute; bottom: 14px; width: 100%; text-align: center;
                font-family: var(--font-mono); font-size: 10px;
                color: var(--ink-3); font-weight: 500;
                text-transform: uppercase; letter-spacing: 0.18em;
                pointer-events: none;
            }

            .k-tbl { width: 100%; text-align: left; font-size: 0.95rem; margin-top: 1rem; border-collapse: collapse; }
            .k-tbl td { padding: 8px; border-bottom: 1px solid var(--hairline); vertical-align: top; color: var(--ink); }
            .k-tbl th {
                padding: 8px; color: var(--ink-3); font-weight: 500;
                font-family: var(--font-mono); font-size: 10px;
                width: 30%; border-bottom: 1px solid var(--hairline);
                text-transform: uppercase; letter-spacing: 0.14em;
            }

            .k-opt {
                background: var(--washi); border: 1px solid var(--hairline);
                padding: 15px 18px; border-radius: var(--r-md);
                text-align: center; margin-bottom: 10px; cursor: pointer;
                font-weight: 600; font-size: 1.05rem;
                color: var(--ink);
                transition: transform 0.12s, background 0.15s, border-color 0.15s;
            }
            .k-opt:active { transform: scale(0.99); }
            @media (hover: hover) { .k-opt:hover { border-color: var(--vermilion); color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.05); } }
            .k-opt.correct { background: var(--moss); border-color: var(--moss); color: var(--washi); }
            .k-opt.wrong { background: var(--vermilion); border-color: var(--vermilion); color: var(--washi); }

            /* Quiz feedback message */
            #k-q-msg {
                font-family: var(--font-mono); font-size: 12px;
                letter-spacing: 0.04em; font-weight: 600;
                padding: 12px 16px; border-radius: var(--r-md);
                margin: 10px 0; text-align: center;
            }
            #k-q-msg.is-correct { background: oklch(0.58 0.09 140 / 0.10); color: var(--moss); border: 1px solid oklch(0.58 0.09 140 / 0.25); }
            #k-q-msg.is-wrong   { background: oklch(0.60 0.18 30 / 0.08); color: var(--vermilion); border: 1px solid oklch(0.60 0.18 30 / 0.25); }

            /* Launcher section heading + tile rows */
            .k-section { margin-top: 18px; width: 100%; }
            .k-section-head {
                display: flex; align-items: baseline; gap: 10px;
                margin: 6px 0 8px;
            }
            .k-section-head .k-section-id {
                font-family: var(--font-mono); font-size: 10.5px;
                letter-spacing: 0.18em; font-weight: 600;
                text-transform: uppercase;
            }
            .k-section-head .k-section-name {
                font-family: var(--font-jp-display); font-size: 15px;
                color: var(--ink); font-weight: 600;
            }
            .k-tile {
                width: 100%; background: var(--washi);
                border: 1px solid var(--hairline);
                border-radius: var(--r-md);
                padding: 14px 16px; margin: 0 0 8px;
                display: flex; align-items: center; gap: 14px;
                cursor: pointer; text-align: left;
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
                font-family: inherit; color: var(--ink);
            }
            .k-tile:active { transform: scale(0.99); }
            @media (hover: hover) { .k-tile:hover { border-color: oklch(0.22 0.012 60 / 0.25); } }
            .k-tile-icon { font-size: 1.4rem; line-height: 1; flex-shrink: 0; width: 28px; text-align: center; }
            .k-tile-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
            .k-tile-id {
                font-family: var(--font-mono); font-size: 10px;
                letter-spacing: 0.16em; font-weight: 600;
                text-transform: uppercase; color: var(--vermilion);
            }
            .k-tile-name {
                font-size: 14px; font-weight: 600; color: var(--ink);
                letter-spacing: -0.005em;
            }
            .k-tile-info {
                font-size: 11.5px; color: var(--ink-3); font-weight: 500;
                margin-top: 2px;
            }
            .k-tile--moss .k-tile-id { color: var(--moss); }
            .k-tile--indigo .k-tile-id { color: var(--indigo); }
            .k-tile--gold .k-tile-id { color: var(--gold); }
            .k-tile--pink .k-tile-id { color: oklch(0.62 0.13 350); }

            .k-tile-grid {
                display: grid; grid-template-columns: 1fr 1fr 1fr;
                gap: 8px; margin-bottom: 8px;
            }
            .k-tile-grid .k-mini {
                background: var(--washi); border: 1px solid var(--hairline);
                border-radius: var(--r-md); padding: 12px 8px;
                cursor: pointer; text-align: center;
                font-family: inherit; color: var(--ink);
                display: flex; flex-direction: column; align-items: center; gap: 4px;
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
            }
            .k-tile-grid .k-mini:active { transform: scale(0.97); }
            @media (hover: hover) { .k-tile-grid .k-mini:hover { border-color: var(--vermilion); } }
            .k-mini-id {
                font-family: var(--font-mono); font-size: 9.5px;
                letter-spacing: 0.16em; font-weight: 600;
                text-transform: uppercase; color: var(--vermilion);
            }
            .k-mini-name {
                font-size: 12px; font-weight: 600; color: var(--ink);
            }

            /* Stats row at top of menu */
            .k-stats {
                display: flex; align-items: center; gap: 14px;
                padding: 14px 12px; margin: 0 0 18px;
                width: 100%; cursor: pointer;
                border: 1px solid var(--hairline); border-radius: var(--r-lg);
                background: var(--washi);
                transition: border-color 0.15s, transform 0.12s;
            }
            .k-stats:active { transform: scale(0.995); }
            @media (hover: hover) { .k-stats:hover { border-color: oklch(0.22 0.012 60 / 0.22); } }
            .k-stats-icon { font-size: 1.8rem; line-height: 1; }
            .k-stats-grid {
                flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
            }
            .k-stat { text-align: center; }
            .k-stat-num {
                font-family: var(--font-jp-display);
                font-weight: 700; font-size: 18px; color: var(--ink);
                line-height: 1;
            }
            .k-stat-num.vermilion { color: var(--vermilion); }
            .k-stat-num.moss { color: var(--moss); }
            .k-stat-num.indigo { color: var(--indigo); }
            .k-stat-num.gold { color: var(--gold); }
            .k-stat-lbl {
                font-family: var(--font-mono); font-size: 9px;
                letter-spacing: 0.14em; text-transform: uppercase;
                color: var(--ink-3); margin-top: 4px; font-weight: 500;
            }

            /* LESSON SELECTOR STYLES */
            .k-lvl-group { margin-bottom: 10px; background: var(--washi); border-radius: var(--r-md); border: 1px solid var(--hairline); overflow: hidden; }
            .k-lvl-header { padding: 12px 15px; background: var(--washi-2); display: flex; align-items: center; cursor: pointer; transition: background 0.15s; }
            @media (hover: hover) { .k-lvl-header:hover { background: oklch(0.92 0.014 75); } }
            .k-lvl-title { flex: 1; font-weight: 600; color: var(--ink); font-size: 1rem; margin-left: 10px; font-family: var(--font-jp-display); }
            .k-lvl-arrow { transition: transform 0.3s; color: var(--ink-3); font-size: 0.8rem; }
            .k-lvl-header.open .k-lvl-arrow { transform: rotate(180deg); }
            .k-lvl-list { display: none; padding: 5px 0; max-height: 250px; overflow-y: auto; }
            .k-lvl-list.open { display: block; }
            .k-chk { width: 18px; height: 18px; margin-right: 12px; accent-color: var(--vermilion); }
            .k-lesson-row { display: flex; padding: 10px 15px; border-bottom: 1px solid var(--hairline); font-size: 0.9rem; }
            .k-lesson-row:last-child { border-bottom: none; }
            .k-l-info { flex: 1; cursor: pointer; }
            .k-l-topic { font-weight: 600; color: var(--ink); font-size: 0.95rem; }
            .k-l-kanji { font-family: var(--font-jp); color: var(--ink-2); font-size: 0.85rem; margin-top: 2px; }

            /* STREAK CELEBRATION - HANABI */
            .k-hanabi-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; overflow: hidden; }
            .k-hanabi-particle { position: absolute; border-radius: 50%; }
            .k-hanabi-msg { position: absolute; top: 35%; left: 50%; transform: translate(-50%, -50%) scale(0); text-align: center; font-family: var(--font-jp-display); animation: k-hanabi-pop 1.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; white-space: nowrap; }
            .k-hanabi-jp { font-size: 3rem; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.15); }
            .k-hanabi-en { font-size: 1rem; color: var(--ink-3); font-weight: 600; margin-top: 5px; }
            @keyframes k-hanabi-pop {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                20% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
                40% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
            }
            #k-view-quiz .k-card { transition: box-shadow 0.5s ease, border-color 0.5s ease; }
            #k-fc-card-obj { transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1), box-shadow 0.5s ease; }

            .k-flag-stamp {
                position: absolute; top: 14px; right: 14px;
                color: var(--vermilion);
                border: 1.5px solid var(--vermilion);
                padding: 3px 10px; border-radius: 4px;
                font-family: var(--font-mono); font-weight: 700;
                text-transform: uppercase; transform: rotate(8deg);
                font-size: 0.7rem; letter-spacing: 0.16em;
                opacity: 0.85; z-index: 5;
                background: oklch(0.97 0.008 80 / 0.6);
            }

            /* Under Construction Sticker */
            .k-construction-wrap { position: relative; width: 100%; }
            .k-construction-wrap .k-btn { pointer-events: none; opacity: 0.45; filter: grayscale(0.3); }
            .k-construction-sticker {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-8deg);
                background: repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #1a1a1a 10px, #1a1a1a 20px);
                color: white; font-weight: 900; font-size: 0.7rem; letter-spacing: 0.15em;
                text-transform: uppercase; padding: 6px 18px; border-radius: 6px; z-index: 10;
                white-space: nowrap; pointer-events: none;
                text-shadow: 0 1px 2px rgba(0,0,0,0.6);
                box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            }
            .k-construction-sticker span {
                background: #1a1a1a; padding: 3px 10px; border-radius: 4px; display: inline-block;
            }

            /* CONNECTIONS (Link Up) */
            .k-conn-bank { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 20px; }
            .k-conn-word {
                padding: 10px 16px; border-radius: var(--r-md);
                border: 1px solid var(--hairline);
                background: var(--washi); cursor: pointer;
                font-size: 1.05rem; font-weight: 600;
                font-family: var(--font-jp); color: var(--ink);
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
                user-select: none;
            }
            .k-conn-word:active { transform: scale(0.97); }
            @media (hover: hover) { .k-conn-word:hover { border-color: var(--vermilion); } }
            .k-conn-word.selected { border-color: var(--vermilion); border-width: 2px; background: oklch(0.60 0.18 30 / 0.06); padding: 9px 15px; }
            .k-conn-word.placed { opacity: 0.3; pointer-events: none; }
            .k-conn-slots { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }
            .k-conn-group {
                background: var(--washi); border-radius: var(--r-md);
                border: 1px solid var(--hairline);
                padding: 12px; text-align: center; min-height: 120px;
                cursor: pointer; transition: border-color 0.2s, background 0.2s;
            }
            @media (hover: hover) { .k-conn-group:hover { border-color: oklch(0.22 0.012 60 / 0.25); } }
            .k-conn-group-title {
                font-family: var(--font-mono); font-weight: 600;
                font-size: 10.5px; letter-spacing: 0.16em;
                text-transform: uppercase; color: var(--ink-3);
                margin-bottom: 10px; padding-bottom: 8px;
                border-bottom: 1px solid var(--hairline);
            }
            .k-conn-group.correct { border-color: var(--moss); background: oklch(0.58 0.09 140 / 0.08); }
            .k-conn-group.wrong { border-color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.06); }
            .k-conn-placed-word {
                display: inline-block; padding: 4px 10px; border-radius: 6px;
                background: var(--washi-2);
                margin: 3px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
                font-family: var(--font-jp); color: var(--ink);
                border: 1px solid var(--hairline); transition: all 0.15s;
            }
            @media (hover: hover) { .k-conn-placed-word:hover { background: oklch(0.60 0.18 30 / 0.10); border-color: var(--vermilion); color: var(--vermilion); } }
            .k-conn-info {
                text-align: center; font-family: var(--font-mono); font-weight: 500;
                font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
                color: var(--ink-3); margin-bottom: 14px;
            }
            @media (max-width: 500px) { .k-conn-slots { grid-template-columns: 1fr; } }

            /* CONNECTIONS N4 (Link Up: Hidden) — NYT-style */
            .k-conn4-grid {
                display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
                margin-bottom: 16px; max-width: 480px; margin-left: auto; margin-right: auto;
            }
            .k-conn4-tile {
                aspect-ratio: 1; border-radius: var(--r-md);
                border: 1px solid var(--hairline);
                background: var(--washi); cursor: pointer;
                font-size: 1.1rem; font-weight: 600;
                font-family: var(--font-jp); color: var(--ink);
                transition: transform 0.18s, border-color 0.15s, background 0.15s;
                user-select: none;
                display: flex; align-items: center; justify-content: center;
                text-align: center; padding: 6px;
            }
            @media (hover: hover) { .k-conn4-tile:hover:not(.solved) { border-color: var(--vermilion); transform: scale(1.03); } }
            .k-conn4-tile.selected { border-color: var(--vermilion); border-width: 2px; background: oklch(0.60 0.18 30 / 0.06); padding: 5px; }
            .k-conn4-tile.solved { pointer-events: none; border-color: transparent; color: var(--washi); font-size: 0.95rem; font-weight: 700; }
            .k-conn4-tile.shake { animation: conn4shake 0.4s ease; }
            @keyframes conn4shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-6px); }
                40% { transform: translateX(6px); }
                60% { transform: translateX(-4px); }
                80% { transform: translateX(4px); }
            }
            .k-conn4-solved-row {
                border-radius: var(--r-md); padding: 12px;
                margin-bottom: 8px; text-align: center;
                color: var(--washi); font-weight: 700;
                max-width: 480px; margin-left: auto; margin-right: auto;
            }
            .k-conn4-solved-row .label {
                font-family: var(--font-mono); font-size: 10px;
                text-transform: uppercase; letter-spacing: 0.18em;
                margin-bottom: 4px; font-weight: 600; opacity: 0.85;
            }
            .k-conn4-solved-row .words { font-size: 1.05rem; font-family: var(--font-jp); font-weight: 600; }
            .k-conn4-lives { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
            .k-conn4-life { width: 12px; height: 12px; border-radius: 50%; background: var(--vermilion); transition: all 0.3s; }
            .k-conn4-life.lost { background: var(--hairline); transform: scale(0.7); }
            .k-conn4-actions { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
            .k-conn4-actions .k-btn { max-width: 160px; }
            @media (max-width: 400px) {
                .k-conn4-grid { gap: 6px; }
                .k-conn4-tile { font-size: 1rem; }
            }

            /* Link Up sub-menu */
            .k-linkup-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; margin-bottom: 4px; }
            .k-linkup-btn {
                padding: 12px 16px; border-radius: var(--r-md);
                border: 1px solid var(--hairline);
                background: var(--washi); cursor: pointer;
                font-weight: 600; font-size: 14px; color: var(--ink);
                text-align: left;
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
                display: flex; align-items: center; gap: 12px;
                font-family: inherit;
            }
            .k-linkup-btn:active { transform: scale(0.99); }
            @media (hover: hover) { .k-linkup-btn:hover { border-color: var(--vermilion); } }
            .k-linkup-btn .icon { font-size: 1.3rem; flex-shrink: 0; }
            .k-linkup-btn .info {
                color: var(--ink-3); font-size: 11.5px; font-weight: 500;
                margin-top: 2px; letter-spacing: 0;
            }

            /* Scramble */
            .k-scr-prompt { font-family: var(--font-jp-display); font-size: 1.1rem; font-weight: 600; color: var(--ink); margin-bottom: 16px; text-align: center; line-height: 1.4; letter-spacing: -0.01em; }
            .k-scr-answer {
                min-height: 56px; border: 1.5px dashed var(--hairline);
                border-radius: var(--r-md); padding: 10px;
                display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
                align-items: center; justify-content: center;
                transition: border-color 0.2s, background 0.2s;
                background: var(--washi-2);
            }
            .k-scr-answer.has-chips { border-color: var(--vermilion); border-style: solid; background: var(--washi); }
            .k-scr-answer.correct { border-color: var(--moss); background: oklch(0.58 0.09 140 / 0.08); border-style: solid; }
            .k-scr-answer.wrong { border-color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.06); border-style: solid; }
            .k-scr-pool { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 16px; }
            .k-scr-chip {
                font-family: var(--font-jp); font-size: 1.05rem; font-weight: 600;
                padding: 10px 14px; border-radius: var(--r-md);
                border: 1px solid var(--hairline);
                background: var(--washi); color: var(--ink); cursor: pointer;
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
                user-select: none;
            }
            .k-scr-chip:active { transform: scale(0.97); }
            @media (hover: hover) { .k-scr-chip:hover { border-color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.05); } }
            .k-scr-chip.placed { opacity: 0.25; pointer-events: none; }
            .k-scr-chip.in-answer { border-color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.06); }
            .k-scr-chip.correct-chip { border-color: var(--moss); background: oklch(0.58 0.09 140 / 0.12); color: var(--moss); }
            .k-scr-chip.wrong-chip { border-color: var(--vermilion); background: oklch(0.60 0.18 30 / 0.10); color: var(--vermilion); }
            .k-scr-explain {
                margin-top: 14px; padding: 12px 14px; border-radius: var(--r-md);
                background: var(--washi-2);
                border: 1px solid var(--hairline);
                font-size: 0.9rem; color: var(--ink-2);
                line-height: 1.55; display: none;
            }
            .k-scr-explain.show { display: block; }
            .k-scr-hint { color: var(--ink-3); font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; text-align: center; margin-bottom: 10px; font-weight: 500; }
            .k-scr-correct-line { margin-top: 8px; font-family: var(--font-jp); font-size: 1.05rem; font-weight: 600; color: var(--moss); text-align: center; }

            /* Result stamps */
            .k-result-stamp { display: flex; align-items: center; justify-content: center; margin-top: 10px; }
            .k-result-stamp img { width: 48px; height: 48px; object-fit: contain; animation: kStampPop 0.35s ease; }
            @keyframes kStampPop { 0% { transform: scale(2.5) rotate(-15deg); opacity: 0; } 50% { transform: scale(0.85) rotate(5deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }

            /* Conn4 puzzle stamp overlay */
            .k-conn4-stamp-overlay { display: flex; align-items: center; justify-content: center; margin-top: 12px; gap: 8px; }
            .k-conn4-stamp-overlay img { width: 56px; height: 56px; object-fit: contain; animation: kStampPop 0.35s ease; }
            .k-conn4-stamp-label { font-weight: 800; font-size: 0.9rem; }

            /* Lesson Picker Overlay */
            .k-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; transition: opacity 0.25s ease; }
            .k-overlay.k-hidden { opacity: 0; pointer-events: none; }
            .k-overlay-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: oklch(0.22 0.012 60 / 0.45); }
            .k-overlay-panel {
                position: absolute; top: 0; right: 0;
                width: min(380px, 85vw); height: 100%;
                background: var(--washi);
                box-shadow: -4px 0 24px oklch(0.22 0.012 60 / 0.18);
                display: flex; flex-direction: column;
                transform: translateX(0); transition: transform 0.25s ease;
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
            }
            .k-overlay.k-hidden .k-overlay-panel { transform: translateX(100%); }
            .k-overlay-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--hairline);
                font-family: var(--font-jp-display);
                font-weight: 600; font-size: 1.05rem; letter-spacing: -0.01em;
                color: var(--ink);
            }
            .k-overlay-close {
                background: transparent;
                border: 1px solid var(--hairline);
                width: 32px; height: 32px; border-radius: 999px;
                cursor: pointer; font-size: 14px;
                color: var(--ink-2);
                display: inline-flex; align-items: center; justify-content: center;
                transition: background 0.15s, color 0.15s, transform 0.12s;
                padding: 0;
            }
            .k-overlay-close:hover { color: var(--ink); background: var(--washi-2); }
            .k-overlay-close:active { transform: scale(0.94); }
            .k-overlay-stats {
                display: flex; justify-content: space-around; padding: 12px 16px;
                border-bottom: 1px solid var(--hairline); text-align: center;
            }
            .k-overlay-stats .k-big { font-family: var(--font-jp-display); font-size: 1.4rem; font-weight: 700; }
            .k-overlay-stats .k-lbl { font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; color: var(--ink-3); font-weight: 500; letter-spacing: 0.14em; margin-top: 4px; }
            .k-overlay-body {
                flex: 1; overflow-y: auto;
                padding: 14px 16px;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain;
            }
            .k-filter-btn {
                background: transparent; border: 1px solid var(--hairline);
                border-radius: var(--r-sm);
                padding: 4px 10px; font-family: var(--font-mono); font-size: 11px;
                cursor: pointer; color: var(--ink-2); transition: background 0.15s, color 0.15s;
                letter-spacing: 0.08em;
            }
            .k-filter-btn:hover { background: var(--washi-2); color: var(--ink); }

            /* DOJO HOME — roof + tile grid */
            .k-roof {
                width: 100%;
                margin: -4px 0 18px;
                display: flex; justify-content: center;
                pointer-events: none;
                user-select: none;
            }
            .k-roof svg { width: 100%; max-width: 460px; height: auto; display: block; }
            .k-roof .roof-tile { fill: var(--ink); }
            .k-roof .roof-tile-2 { fill: oklch(0.28 0.012 60); }
            .k-roof .roof-ridge { fill: var(--vermilion); }
            .k-roof .roof-glyph {
                fill: var(--washi);
                font-family: var(--font-jp-display);
                font-weight: 600;
            }
            .k-roof .roof-pillar { fill: oklch(0.30 0.020 60); }

            .k-dojo-grid {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 10px; width: 100%; margin: 8px 0 14px;
            }
            .k-dojo-tile {
                position: relative;
                text-align: left;
                padding: 14px 14px 12px;
                background: var(--washi);
                border: 1px solid var(--hairline);
                border-top: 3px solid var(--ink);
                border-radius: var(--r-md);
                min-height: 100px;
                display: flex; flex-direction: column;
                justify-content: space-between;
                cursor: pointer;
                font-family: inherit; color: var(--ink);
                transition: transform 0.12s, border-color 0.15s, background 0.15s;
            }
            .k-dojo-tile:active { transform: scale(0.985); }
            @media (hover: hover) { .k-dojo-tile:hover { border-color: oklch(0.22 0.012 60 / 0.25); } }
            .k-dojo-tile--vermilion { border-top-color: var(--vermilion); }
            .k-dojo-tile--moss      { border-top-color: var(--moss); }
            .k-dojo-tile--indigo    { border-top-color: var(--indigo); }
            .k-dojo-tile--gold      { border-top-color: var(--gold); }
            .k-dojo-tile--pink      { border-top-color: oklch(0.62 0.13 350); }
            .k-dojo-tile-top {
                display: flex; justify-content: space-between; align-items: flex-start;
            }
            .k-dojo-tile-label {
                font-size: 14px; font-weight: 600; color: var(--ink);
                margin-bottom: 2px;
            }
            .k-dojo-tile-jp {
                font-family: var(--font-jp-display);
                font-size: 11px; color: var(--ink-3);
            }
            .k-dojo-tile-kanji {
                font-family: var(--font-jp-display);
                font-size: 26px; font-weight: 500; color: var(--ink);
                line-height: 1;
            }
            .k-dojo-tile--vermilion .k-dojo-tile-kanji { color: var(--vermilion); }
            .k-dojo-tile--moss      .k-dojo-tile-kanji { color: var(--moss); }
            .k-dojo-tile--indigo    .k-dojo-tile-kanji { color: var(--indigo); }
            .k-dojo-tile--gold      .k-dojo-tile-kanji { color: var(--gold); }
            .k-dojo-tile--pink      .k-dojo-tile-kanji { color: oklch(0.62 0.13 350); }
            .k-dojo-tile-foot {
                font-family: var(--font-mono);
                font-size: 10px; color: var(--ink-3);
                letter-spacing: 0.12em; text-transform: uppercase;
                margin-top: 10px;
            }
            .k-dojo-tile--locked {
                background: var(--washi-2);
                border-top-color: var(--ink-3) !important;
                opacity: 0.6;
                cursor: default;
            }
            .k-dojo-tile--locked .k-dojo-tile-kanji { color: var(--ink-3) !important; }
            .k-dojo-tile--locked .k-dojo-tile-label { color: var(--ink-2); }
            .k-dojo-tile--locked:active { transform: none; }
            .k-dojo-tile--flags {
                grid-column: 1 / -1;
                width: calc(50% - 5px);
                justify-self: center;
            }

            /* HUB sub-screens */
            .k-hub-back {
                background: transparent; border: 1px solid var(--hairline);
                color: var(--ink-2); padding: 7px 14px 7px 12px;
                border-radius: 999px; cursor: pointer;
                font-family: var(--font-mono); font-size: 11px;
                font-weight: 600; letter-spacing: 0.10em;
                text-transform: uppercase;
                display: inline-flex; align-items: center; gap: 6px;
                transition: background 0.15s, color 0.15s, transform 0.12s;
                margin-bottom: 14px;
            }
            .k-hub-back:hover { color: var(--ink); background: var(--washi-2); }
            .k-hub-back:active { transform: scale(0.97); }
            .k-hub-title {
                font-family: var(--font-jp-display);
                font-size: 22px; font-weight: 600;
                color: var(--ink); letter-spacing: -0.01em;
                margin: 0 0 4px;
            }
            .k-hub-sub {
                font-size: 12.5px; color: var(--ink-3);
                margin: 0 0 16px;
            }
            .k-hub-coming-soon {
                width: 100%;
                background: var(--washi);
                border: 1px solid var(--hairline);
                border-radius: var(--r-lg);
                padding: 36px 18px;
                text-align: center;
                display: flex; flex-direction: column; align-items: center; gap: 10px;
            }
            .k-hub-coming-soon .glyph {
                font-family: var(--font-jp-display);
                font-size: 56px; color: var(--ink-3); line-height: 1;
            }
            .k-hub-coming-soon .label {
                font-family: var(--font-mono); font-size: 11px;
                letter-spacing: 0.16em; text-transform: uppercase;
                color: var(--ink-3); margin-top: 4px;
            }
            .k-hub-coming-soon .copy {
                font-size: 13px; color: var(--ink-2); max-width: 320px;
                line-height: 1.5;
            }

            /* Flagged grammar list */
            .k-flag-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
            .k-flag-row {
                display: flex; align-items: center; gap: 14px;
                background: var(--washi); border: 1px solid var(--hairline);
                border-left: 3px solid var(--gold);
                border-radius: var(--r-md);
                padding: 12px 14px;
            }
            .k-flag-surface {
                font-family: var(--font-jp-display);
                font-size: 22px; font-weight: 600; color: var(--ink);
                line-height: 1.1; min-width: 64px;
            }
            .k-flag-body { flex: 1; min-width: 0; }
            .k-flag-meaning {
                font-size: 13px; font-weight: 600; color: var(--ink);
                margin-bottom: 2px;
            }
            .k-flag-meta {
                font-family: var(--font-mono); font-size: 10px;
                color: var(--ink-3); letter-spacing: 0.12em;
                text-transform: uppercase;
            }
            .k-flag-clear {
                background: transparent; border: 1px solid var(--hairline);
                color: var(--ink-2); padding: 6px 12px;
                border-radius: 999px; cursor: pointer;
                font-family: var(--font-mono); font-size: 11px;
                font-weight: 600; letter-spacing: 0.08em;
                text-transform: uppercase;
                transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.12s;
            }
            .k-flag-clear:hover { background: var(--vermilion); color: var(--washi); border-color: var(--vermilion); }
            .k-flag-clear:active { transform: scale(0.96); }
            .k-flag-empty {
                text-align: center; padding: 36px 18px;
                color: var(--ink-3); font-size: 13px;
                background: var(--washi);
                border: 1px dashed var(--hairline);
                border-radius: var(--r-lg);
            }
            .k-flag-empty .glyph {
                font-family: var(--font-jp-display);
                font-size: 40px; color: var(--moss); margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // Create App Container
    container.innerHTML = '';
    const appRoot = document.createElement('div');
    appRoot.id = "kanji-app-root";
    container.appendChild(appRoot);

    // HTML Structure
    appRoot.innerHTML = `
        <div id="k-loader" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="font-size: 3rem; margin-bottom: 15px;">🇯🇵</div>
            <div style="font-weight:800; color:var(--ink); font-size:1.2rem">Loading Library...</div>
            <div id="k-error-box" class="k-hidden" style="color:#C2410C; margin-top:10px; padding:10px; max-width:80%; font-size:0.9rem"></div>
        </div>

        <header>
           <div class="k-head-title" onclick="KanjiApp.showMenu()">
             <span class="k-head-code">DOJO</span>
             <span class="k-head-name">Kanji Master 先生</span>
           </div>
           <div class="k-head-actions">
             <button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button>
             <button class="k-exit-btn">Exit</button>
           </div>
        </header>

        <div id="k-lesson-overlay" class="k-overlay k-hidden">
            <div class="k-overlay-backdrop" onclick="KanjiApp.toggleLessonOverlay()"></div>
            <div class="k-overlay-panel">
                <div class="k-overlay-header">
                    <span>Select Lessons</span>
                    <button class="k-overlay-close" onclick="KanjiApp.toggleLessonOverlay()">\u2715</button>
                </div>
                <div class="k-overlay-body">
                    <div class="k-filters" id="k-lesson-container"></div>
                </div>
            </div>
        </div>

        <div id="k-app-container">
            <div id="k-view-menu" style="width:100%">

                <div class="k-roof" aria-hidden="true">
                    <svg viewBox="0 0 460 130" preserveAspectRatio="xMidYMid meet">
                        <polygon class="roof-tile" points="20,118 440,118 380,52 80,52"/>
                        <polygon class="roof-tile-2" points="80,52 380,52 350,28 110,28"/>
                        <rect class="roof-ridge" x="50" y="114" width="360" height="8" rx="2"/>
                        <rect class="roof-pillar" x="40"  y="118" width="14" height="10"/>
                        <rect class="roof-pillar" x="406" y="118" width="14" height="10"/>
                        <line x1="80"  y1="52"  x2="20"  y2="118" stroke="oklch(0.97 0.008 80 / 0.18)" stroke-width="1"/>
                        <line x1="160" y1="52"  x2="120" y2="118" stroke="oklch(0.97 0.008 80 / 0.12)" stroke-width="1"/>
                        <line x1="230" y1="52"  x2="230" y2="118" stroke="oklch(0.97 0.008 80 / 0.12)" stroke-width="1"/>
                        <line x1="300" y1="52"  x2="340" y2="118" stroke="oklch(0.97 0.008 80 / 0.12)" stroke-width="1"/>
                        <line x1="380" y1="52"  x2="440" y2="118" stroke="oklch(0.97 0.008 80 / 0.18)" stroke-width="1"/>
                        <text class="roof-glyph" x="230" y="92" text-anchor="middle" font-size="40">道場</text>
                    </svg>
                </div>

                <div class="k-stats" data-tour-dojo="stats" onclick="KanjiApp.toggleLessonOverlay()" title="Select Lessons">
                    <span class="k-stats-icon">🎯</span>
                    <div class="k-stats-grid">
                        <div class="k-stat"><div class="k-stat-num vermilion" id="k-cnt-k">0</div><div class="k-stat-lbl">Kanji</div></div>
                        <div class="k-stat"><div class="k-stat-num moss" id="k-cnt-vocab">0</div><div class="k-stat-lbl">Vocab</div></div>
                        <div class="k-stat"><div class="k-stat-num indigo" id="k-cnt-v">0</div><div class="k-stat-lbl">Verbs</div></div>
                        <div class="k-stat"><div class="k-stat-num gold" id="k-cnt-flags">0</div><div class="k-stat-lbl">Flags</div></div>
                    </div>
                </div>

                <div class="k-dojo-grid">
                    <button class="k-dojo-tile k-dojo-tile--vermilion" data-tour-dojo="kanjiPractice" onclick="KanjiApp.showHub('k-view-hub-kanji')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Kanji Practice</div>
                                <div class="k-dojo-tile-jp">かんじ</div>
                            </div>
                            <div class="k-dojo-tile-kanji">漢</div>
                        </div>
                        <div class="k-dojo-tile-foot">Open</div>
                    </button>

                    <button class="k-dojo-tile k-dojo-tile--moss" data-tour-dojo="vocabPractice" onclick="KanjiApp.showHub('k-view-hub-vocab')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Vocab Practice</div>
                                <div class="k-dojo-tile-jp">ごい</div>
                            </div>
                            <div class="k-dojo-tile-kanji">語</div>
                        </div>
                        <div class="k-dojo-tile-foot">Open</div>
                    </button>

                    <button class="k-dojo-tile k-dojo-tile--gold" data-tour-dojo="writingPractice" onclick="KanjiApp.showHub('k-view-hub-writing')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Writing Practice</div>
                                <div class="k-dojo-tile-jp">しょどう</div>
                            </div>
                            <div class="k-dojo-tile-kanji">書</div>
                        </div>
                        <div class="k-dojo-tile-foot">Open</div>
                    </button>

                    <button class="k-dojo-tile k-dojo-tile--indigo" id="k-dojo-tile-audio" data-tour-dojo="audioPractice" onclick="KanjiApp.showHub('k-view-hub-audio')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Audio Practice</div>
                                <div class="k-dojo-tile-jp">ちょうかい</div>
                            </div>
                            <div class="k-dojo-tile-kanji">聴</div>
                        </div>
                        <div class="k-dojo-tile-foot" id="k-dojo-tile-audio-foot">Open</div>
                    </button>

                    <button class="k-dojo-tile k-dojo-tile--pink" id="k-dojo-tile-games" data-tour-dojo="games" onclick="KanjiApp.showHub('k-view-hub-games')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Games</div>
                                <div class="k-dojo-tile-jp">あそび</div>
                            </div>
                            <div class="k-dojo-tile-kanji">遊</div>
                        </div>
                        <div class="k-dojo-tile-foot" id="k-dojo-tile-games-foot">Open</div>
                    </button>

                    <div class="k-dojo-tile k-dojo-tile--locked">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Daily</div>
                                <div class="k-dojo-tile-jp">まいにち</div>
                            </div>
                            <div class="k-dojo-tile-kanji">日</div>
                        </div>
                        <div class="k-dojo-tile-foot">🔒 Coming soon</div>
                    </div>

                    <button class="k-dojo-tile k-dojo-tile--gold k-dojo-tile--flags" data-tour-dojo="flagged" onclick="KanjiApp.showHub('k-view-hub-flags')">
                        <div class="k-dojo-tile-top">
                            <div>
                                <div class="k-dojo-tile-label">Flags</div>
                                <div class="k-dojo-tile-jp">フラグ</div>
                            </div>
                            <div class="k-dojo-tile-kanji">旗</div>
                        </div>
                        <div class="k-dojo-tile-foot">Open</div>
                    </button>
                </div>
            </div>

            <div id="k-view-hub-kanji" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Kanji Practice</h2>
                <div class="k-hub-sub">Flashcards and quizzes for the kanji in your selected lessons.</div>

                <div class="k-lbl">FLASHCARDS</div>
                <button class="k-btn" onclick="KanjiApp.start('kanji', 'flash')">🎴 Kanji Flashcards</button>

                <div class="k-lbl">MEANING QUIZ</div>
                <div class="k-grid-btns">
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-meaning', 'normal')">Kanji ➔ Eng</button>
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-meaning', 'reverse')">Eng ➔ Kanji</button>
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-meaning', 'mix')">🔄 Mix</button>
                </div>

                <div class="k-lbl">READING QUIZ</div>
                <div class="k-grid-btns">
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-reading', 'normal')">Kanji ➔ Read</button>
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-reading', 'reverse')">Read ➔ Kanji</button>
                    <button class="k-btn" onclick="KanjiApp.start('kanji', 'quiz-reading', 'mix')">🔄 Mix</button>
                </div>
            </div>

            <div id="k-view-hub-vocab" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Vocab Practice</h2>
                <div class="k-hub-sub">Vocab cards, quizzes, and verb conjugation drill.</div>

                <div class="k-lbl">FLASHCARDS</div>
                <button class="k-btn k-btn--moss" onclick="KanjiApp.start('vocab', 'flash')">🗂️ Vocab Flashcards</button>

                <div class="k-lbl">QUIZ</div>
                <button class="k-btn k-btn--moss" onclick="KanjiApp.start('vocab', 'quiz-vocab')">📝 Vocab Quiz</button>

                <div class="k-lbl">VERB PRACTICE</div>
                <button class="k-btn k-btn--indigo" data-gate="conjugation" onclick="KanjiApp.start('dojo','dojo')">⚡ Conjugation Station</button>
            </div>

            <div id="k-view-hub-writing" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Writing Practice</h2>
                <div class="k-hub-sub">Practice drawing kanji stroke-by-stroke. Paint on parchment with gold ink — perfect a kanji to unlock its meaning.</div>

                <div class="k-lbl">KANJI</div>
                <button class="k-btn k-btn--gold" onclick="window.JPApp.launch('writing-kanji')">✍️ Kanji Writing</button>

                <div id="k-writing-kana-slot"></div>
            </div>

            <div id="k-view-hub-audio" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Audio Practice</h2>
                <div class="k-hub-sub">Listen to a passage, then answer — scrub the waveform to find the details.</div>

                <div class="k-lbl">LISTENING</div>
                <button class="k-btn k-btn--indigo" data-gate="audiodojo" onclick="window.JPApp.launch('audiodojo')">🎧 Audio Dojo</button>
            </div>

            <div id="k-view-hub-games" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Games</h2>
                <div class="k-hub-sub">Sentence and vocabulary games to keep the streak alive.</div>

                <div class="k-lbl">SCRAMBLE</div>
                <button class="k-btn k-btn--pink" data-gate="scramble" onclick="KanjiApp.toggleScrMenu()">🌸 Scramble</button>
                <div id="k-scr-submenu" data-gate="scramble" class="k-linkup-menu k-hidden">
                    <div class="k-linkup-btn" onclick="KanjiApp.start('scramble','scramble')">
                        <span class="icon">🌸</span>
                        <span><div>Practice</div><div class="info">N5 sentences — shuffled order</div></span>
                    </div>
                    <div class="k-linkup-btn" data-gate="n4" onclick="KanjiApp.start('marathon','marathon')">
                        <span class="icon">🏔️</span>
                        <span><div>Marathon</div><div class="info">N4 progressive — warm-up → challenge</div></span>
                    </div>
                </div>

                <div class="k-lbl">LINK UP</div>
                <button class="k-btn k-btn--pink" data-gate="linkup" onclick="KanjiApp.toggleLinkUpMenu()">🔗 Link Up</button>
                <div id="k-linkup-submenu" data-gate="linkup" class="k-linkup-menu k-hidden">
                    <div class="k-linkup-btn" onclick="KanjiApp.start('connections','connections')">
                        <span class="icon">🔗</span>
                        <span><div>Sorted</div><div class="info">Categories shown — sort the words</div></span>
                    </div>
                    <div class="k-linkup-btn" data-gate="n4" onclick="KanjiApp.start('connections4','connections4')">
                        <span class="icon">🧩</span>
                        <span><div>Hidden</div><div class="info">Guess the groups, 4 lives</div></span>
                    </div>
                </div>
            </div>

            <div id="k-view-hub-daily" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Daily</h2>
                <div class="k-hub-sub">A fresh challenge every day to keep your training sharp.</div>

                <div class="k-hub-coming-soon">
                    <div class="glyph">日</div>
                    <div class="copy">Daily challenges and streak-building drills are in development.</div>
                    <div class="label">Coming soon</div>
                </div>
            </div>

            <div id="k-view-hub-flags" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showMenu()">← Dojo</button>
                <h2 class="k-hub-title">Flags</h2>
                <div class="k-hub-sub">Items you've flagged for review.</div>

                <div class="k-lbl">VOCAB &amp; KANJI</div>
                <button class="k-btn k-btn--gold" onclick="KanjiApp.start('mixed', 'flag-review')">🚩 Flagged Vocab</button>

                <div class="k-lbl">GRAMMAR &amp; PARTICLES</div>
                <button class="k-btn k-btn--gold" onclick="KanjiApp.showHub('k-view-hub-flags-grammar')">📝 Flagged Grammar</button>
            </div>

            <div id="k-view-hub-flags-grammar" class="k-hidden" style="width:100%">
                <button class="k-hub-back" onclick="KanjiApp.showHub('k-view-hub-flags')">← Flags</button>
                <h2 class="k-hub-title">Flagged Grammar</h2>
                <div class="k-hub-sub">Grammar and particle items you've flagged. Tap Clear to remove from your list.</div>

                <div id="k-flag-grammar-stage">
                    <div class="k-flag-empty">
                        <div class="glyph">…</div>
                        <div>Loading flagged items…</div>
                    </div>
                </div>
            </div>

            <div id="k-view-flash" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-fc-progress">Card 1 / 100</span>
                    <span class="k-pill">🏆 <b id="k-fc-best">0</b></span>
                    <span class="k-pill streak">🔥 <b id="k-fc-streak">0</b></span>
                </div>
                <div id="k-fc-stage"></div>
                <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()" style="margin-top:10px;">Return to Menu</button>
            </div>

            <div id="k-view-conn" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-conn-progress">0 / 0</span>
                </div>
                <div class="k-card" id="k-conn-stage" style="padding:1.5rem;"></div>
                <div style="display:flex; gap:8px; width:100%; margin-top:10px;">
                    <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()">Exit</button>
                </div>
            </div>

            <div id="k-view-conn4" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-conn4-progress">0 / 0</span>
                </div>
                <div class="k-card" id="k-conn4-stage" style="padding:1.5rem;"></div>
                <div style="display:flex; gap:8px; width:100%; margin-top:10px;">
                    <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()">Exit</button>
                </div>
            </div>

            <div id="k-view-scr" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-scr-progress">0 / 0</span>
                </div>
                <div id="k-scr-stage"></div>
                <div style="display:flex; gap:8px; width:100%; margin-top:10px;">
                    <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()">Exit</button>
                </div>
            </div>

            <div id="k-view-mara" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-mara-progress">0 / 0</span>
                </div>
                <div id="k-mara-stage"></div>
                <div style="display:flex; gap:8px; width:100%; margin-top:10px;">
                    <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()">Exit</button>
                </div>
            </div>

            <div id="k-view-dojo" class="k-hidden" style="width:100%">
                <div class="k-stat-row">
                    <span class="k-stat-progress" id="k-dojo-progress">0 / 0</span>
                    <span class="k-pill">🏆 <b id="k-dojo-best">0</b></span>
                    <span class="k-pill streak">🔥 <b id="k-dojo-streak">0</b></span>
                </div>
                <div id="k-dojo-stage"></div>
                <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()" style="margin-top:10px">Exit Station</button>
            </div>

            <div id="k-view-quiz" class="k-hidden" style="width:100%; display:flex; flex-direction:column; height:100%">
                <div class="k-stat-row">
                    <span class="k-pill">🏆 <b id="k-best">0</b></span>
                    <span class="k-pill streak">🔥 <b id="k-streak">0</b></span>
                </div>
                <div class="k-card">
                    <div class="k-lbl" id="k-q-lbl">QUESTION</div>
                    <div class="k-big" id="k-q-main"></div>
                    <div id="k-q-read-reveal" class="k-hidden" style="color:var(--indigo); font-weight:600; font-size:1.35rem; margin-top:6px; font-family:var(--font-jp);"></div>
                    <div class="k-sub" id="k-q-ask" style="margin-top:10px; color:var(--vermilion); font-family:var(--font-jp-display);"></div>
                </div>
                <div id="k-q-opts"></div>
                <div id="k-q-msg" class="k-hidden"></div>
                <div style="margin-top:auto; width:100%">
                    <button class="k-btn k-hidden" id="k-q-next" onclick="KanjiApp.nextQ()">Next Question ➜</button>
                    <button class="k-btn k-btn-sec" onclick="KanjiApp.showMenu()">Exit Quiz</button>
                </div>
            </div>
        </div>
    `;

    // Exit Button Logic
    appRoot.querySelector('.k-exit-btn').onclick = exitCallback;

    // Native polish: light haptic on tap for interactive surfaces.
    // Delegated to one pointerdown listener so we don't wire every button.
    // Skips already-resolved states (correct/wrong/placed/solved) and the
    // 3D flashcard scene (which gets its own `light()` on flip).
    (function attachTapHaptics() {
        var TAP = /(?:^|\s)(k-btn|k-opt|k-conn-word|k-conn4-tile|k-scr-chip|k-linkup-btn|k-stats|jp-settings-gear|k-exit-btn|k-overlay-close|k-filter-btn|k-lvl-header)(?:\s|$)/;
        var RESOLVED = /(?:^|\s)(correct|wrong|placed|solved|k-hidden)(?:\s|$)/;
        appRoot.addEventListener('pointerdown', function(e) {
            var H = window.JPShared && window.JPShared.haptics;
            if (!H) return;
            var t = e.target && e.target.closest ? e.target.closest('button,[role="button"],.k-btn,.k-opt,.k-conn-word,.k-conn4-tile,.k-scr-chip,.k-linkup-btn,.k-stats,.k-lvl-header') : null;
            if (!t) return;
            var cls = ' ' + (t.className || '') + ' ';
            if (!TAP.test(cls) && !t.matches('button')) return;
            if (RESOLVED.test(cls)) return;
            H.select();
        }, { passive: true });
    })();

    // --- 2. LOGIC ---
    const REPO_CONFIG = sharedConfig;

    // Set repo config for stamp settings
    if (window.JPShared.stampSettings) {
      window.JPShared.stampSettings.setConfig(REPO_CONFIG);
    }

    const ALL_VIEWS = ['k-view-menu','k-view-hub-kanji','k-view-hub-vocab','k-view-hub-writing','k-view-hub-audio','k-view-hub-games','k-view-hub-daily','k-view-hub-flags','k-view-hub-flags-grammar','k-view-flash','k-view-quiz','k-view-conn','k-view-conn4','k-view-scr','k-view-mara','k-view-dojo'];
    const DB = { kanji: [], verb: [], lessons: [], vocabMap: new Map(), grammarMap: new Map() };
    const activeLessons = new Set();
    let curSet=[], curIdx=0, curStreak=0, curBest=0, curMode='', curAns='', curType='', curSubMode='normal', curQItem=null, curCategory='';
    let quizPhase = 1;

    let flagCounts = window.JPShared.progress.getAllFlags();
    let activeFlags = window.JPShared.progress.getAllActiveFlags();

    const bestScores = {
        meaning: window.JPShared.progress.getBestScore('meaning'),
        reading: window.JPShared.progress.getBestScore('reading'),
        vocab: window.JPShared.progress.getBestScore('vocab'),
        verb: window.JPShared.progress.getBestScore('verb'),
        flash: window.JPShared.progress.getBestScore('flash'),
        connections: window.JPShared.progress.getBestScore('connections'),
        scramble: window.JPShared.progress.getBestScore('scramble'),
        marathon: window.JPShared.progress.getBestScore('marathon'),
        dojo: window.JPShared.progress.getBestScore('dojo')
    };

    // --- 3. HELPER FUNCTIONS ---
    function setTxt(id, txt) {
        const el = document.getElementById(id);
        if(el) el.innerText = txt;
    }

    // --- STREAK CELEBRATION (HANABI) ---
    const STREAK_TIERS = [
        { at: 5,  msg: 'いいね！',     sub: 'Nice!',       colors: ['#FFD700','#FFA500','#FFE066'], particles: 15 },
        { at: 10, msg: 'すごい！',     sub: 'Amazing!',     colors: ['#FF6B35','#FF4500','#FF8C00'], particles: 24 },
        { at: 15, msg: 'さすが！',     sub: 'Impressive!',  colors: ['#FF1493','#FF69B4','#FF85C8'], particles: 35 },
        { at: 20, msg: 'すばらしい！', sub: 'Wonderful!',   colors: ['#00E5FF','#00BCD4','#4DD0E1'], particles: 45 },
        { at: 25, msg: '天才！',       sub: 'Genius!',      colors: ['#8B5CF6','#A78BFA','#7C3AED'], particles: 55 },
        { at: 30, msg: '神！',         sub: 'Godlike!',     colors: ['#FF1493','#FFD700','#00E5FF','#8B5CF6','#2ED573','#FF6B35'], particles: 70 }
    ];

    const STREAK_GLOW = [
        { min: 1,  color: 'rgba(255,215,0,0.15)',  spread: 8 },
        { min: 5,  color: 'rgba(255,215,0,0.3)',   spread: 15 },
        { min: 10, color: 'rgba(255,107,53,0.35)',  spread: 20 },
        { min: 15, color: 'rgba(255,20,147,0.35)',  spread: 25 },
        { min: 20, color: 'rgba(0,229,255,0.4)',    spread: 30 },
        { min: 25, color: 'rgba(139,92,246,0.45)',  spread: 35 },
        { min: 30, color: 'rgba(255,20,147,0.5)',   spread: 40 }
    ];

    function updateStreakVisuals(streak) {
        var isFlash = (curMode === 'flash');
        var card = isFlash ? document.getElementById('k-fc-card-obj') : document.querySelector('#k-view-quiz .k-card');
        if (card) {
            if (streak === 0) {
                card.style.boxShadow = '';
                card.style.borderColor = '';
            } else {
                var glow = STREAK_GLOW[0];
                for (var i = STREAK_GLOW.length - 1; i >= 0; i--) {
                    if (streak >= STREAK_GLOW[i].min) { glow = STREAK_GLOW[i]; break; }
                }
                var baseShadow = isFlash ? '0 15px 35px rgba(0,0,0,0.1)' : '0 10px 25px rgba(0,0,0,0.05)';
                card.style.boxShadow = '0 0 ' + glow.spread + 'px ' + glow.color + ', ' + baseShadow;
                card.style.borderColor = glow.color;
            }
        }
        setTxt('k-fc-streak', streak);
        setTxt('k-fc-best', curBest);
        if (streak >= 5 && streak % 5 === 0) launchHanabi(streak);
    }

    function launchHanabi(streak) {
        var tier = STREAK_TIERS[0];
        for (var i = STREAK_TIERS.length - 1; i >= 0; i--) {
            if (streak >= STREAK_TIERS[i].at) { tier = STREAK_TIERS[i]; break; }
        }
        var H = window.JPShared && window.JPShared.haptics;
        if (H) { (streak >= 20 ? H.heavy : H.medium)(); }

        var targetView = document.getElementById(curMode === 'flash' ? 'k-view-flash' : curMode === 'connections' ? 'k-view-conn' : curMode === 'connections4' ? 'k-view-conn4' : curMode === 'scramble' ? 'k-view-scr' : curMode === 'marathon' ? 'k-view-mara' : curMode === 'dojo' ? 'k-view-dojo' : 'k-view-quiz');
        if (!targetView) return;
        targetView.style.position = 'relative';

        var container = document.createElement('div');
        container.className = 'k-hanabi-container';
        targetView.appendChild(container);

        var rect = targetView.getBoundingClientRect();
        var burstPoints = streak >= 25 ? [
            { x: rect.width * 0.3, y: rect.height * 0.25 },
            { x: rect.width * 0.7, y: rect.height * 0.3 },
            { x: rect.width * 0.5, y: rect.height * 0.15 }
        ] : streak >= 15 ? [
            { x: rect.width * 0.35, y: rect.height * 0.25 },
            { x: rect.width * 0.65, y: rect.height * 0.25 }
        ] : [
            { x: rect.width / 2, y: rect.height * 0.25 }
        ];

        let perBurst = Math.ceil(tier.particles / burstPoints.length);
        burstPoints.forEach(function(bp, bIdx) {
            for (let i = 0; i < perBurst; i++) {
                let p = document.createElement('div');
                p.className = 'k-hanabi-particle';
                let angle = (Math.PI * 2 * i / perBurst) + (Math.random() * 0.4 - 0.2);
                let dist = 50 + Math.random() * 100;
                let color = tier.colors[Math.floor(Math.random() * tier.colors.length)];
                let size = 3 + Math.random() * 5;
                let delay = bIdx * 150 + Math.random() * 100;
                let dx = Math.cos(angle) * dist;
                let dy = Math.sin(angle) * dist + 40;

                p.style.cssText = 'left:' + bp.x + 'px;top:' + bp.y + 'px;width:' + size + 'px;height:' + size + 'px;background:' + color + ';box-shadow:0 0 ' + size + 'px ' + color + ';transition:transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.9s ease-out;transition-delay:' + delay + 'ms;';
                container.appendChild(p);

                requestAnimationFrame(function() { requestAnimationFrame(function() {
                    p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                    p.style.opacity = '0';
                }); });
            }
        });

        var msgEl = document.createElement('div');
        msgEl.className = 'k-hanabi-msg';
        msgEl.innerHTML = '<div class="k-hanabi-jp" style="color:' + tier.colors[0] + '">' + tier.msg + '</div><div class="k-hanabi-en">' + tier.sub + '</div>';
        container.appendChild(msgEl);

        setTimeout(function() { container.remove(); }, 2500);
    }

    function resetStreakVisuals() {
        var quizCard = document.querySelector('#k-view-quiz .k-card');
        if (quizCard) { quizCard.style.boxShadow = ''; quizCard.style.borderColor = ''; }
        var flashCard = document.getElementById('k-fc-card-obj');
        if (flashCard) { flashCard.style.boxShadow = ''; flashCard.style.borderColor = ''; }
        document.querySelectorAll('.k-hanabi-container').forEach(function(c) { c.remove(); });
        setTxt('k-fc-streak', 0);
    }

    // --- 4. EXPOSED FUNCTIONS ---
    KanjiApp.toggleLessonOverlay = function() {
        const overlay = document.getElementById('k-lesson-overlay');
        if (overlay) overlay.classList.toggle('k-hidden');
    };

    function escHTML(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Build the Flagged Grammar list from active flags intersected with the
    // grammar/particle surface index (DB.grammarMap, populated during init).
    function renderFlaggedGrammar() {
        const stage = document.getElementById('k-flag-grammar-stage');
        if (!stage) return;

        const active = window.JPShared.progress.getAllActiveFlags() || {};
        const rows = [];
        Object.keys(active).forEach(function(key) {
            if (!active[key]) return;
            const entry = DB.grammarMap.get(key);
            if (entry) rows.push(entry);
        });

        if (rows.length === 0) {
            stage.innerHTML = '<div class="k-flag-empty">' +
                '<div class="glyph">○</div>' +
                '<div>No flagged grammar — nice work.</div>' +
            '</div>';
            return;
        }

        stage.innerHTML = '<div class="k-flag-list">' + rows.map(function(e) {
            const lesson = e.lesson_ids || e.lesson || '';
            const reading = (e.reading && e.reading !== e.surface) ? escHTML(e.reading) : '';
            const meta = [lesson, e.type === 'particle' ? 'Particle' : 'Grammar'].filter(Boolean).join(' · ');
            return '<div class="k-flag-row" data-surface="' + escHTML(e.surface) + '">' +
                '<div class="k-flag-surface">' + escHTML(e.surface) + '</div>' +
                '<div class="k-flag-body">' +
                    '<div class="k-flag-meaning">' + escHTML(e.meaning || '') + '</div>' +
                    '<div class="k-flag-meta">' + escHTML(meta) + (reading ? ' · ' + reading : '') + '</div>' +
                '</div>' +
                '<button class="k-flag-clear" onclick="KanjiApp.clearGrammarFlag(\'' + encodeURIComponent(e.surface) + '\')">Clear</button>' +
            '</div>';
        }).join('') + '</div>';
    }

    KanjiApp.clearGrammarFlag = function(encodedSurface) {
        const surface = decodeURIComponent(encodedSurface);
        if (window.JPShared.progress) {
            window.JPShared.progress.clearFlag(surface);
        }
        // Refresh the shared cache + stats and re-render the list.
        activeFlags = window.JPShared.progress.getAllActiveFlags();
        kUpdateStats();
        renderFlaggedGrammar();
    };

    // Apply current unlock state to the Dojo menu — hide locked entries, mark
    // the Conjugation Station as locked (greyed + 🔒) until G1 is completed.
    // Re-runs every time the menu is shown so unlocks land immediately.
    function applyMenuGating() {
        const unlock = window.JPShared && window.JPShared.unlock;
        if (!unlock) return;

        const showN4     = !!unlock.isN4Unlocked();
        const scrambleOk = !!unlock.isScrambleUnlocked();
        const linkupOk   = !!unlock.isLinkUpUnlocked();
        const g1Done     = !!unlock.isCompleted('G1');

        // N4-only items inside submenus.
        document.querySelectorAll('[data-gate="n4"]').forEach(el => { el.style.display = showN4 ? '' : 'none'; });

        // "Lesson N5.x" label for a locked-state button.
        const lessonLabel = function (lessonId) {
            const m = /^N5\.(\d+)$/.exec(lessonId || '');
            return m ? ('Lesson ' + m[1]) : (lessonId || 'next lesson');
        };

        // Apply a locked / unlocked style to a parent button. When locked the
        // button stays visible (greyed) so the user sees what's coming.
        function setBtnState(btn, ok, lockedText, unlockedText) {
            if (!btn) return;
            btn.style.opacity = ok ? '' : '0.45';
            btn.style.cursor  = ok ? '' : 'not-allowed';
            btn.textContent   = ok ? unlockedText : lockedText;
        }

        document.querySelectorAll('button[data-gate="scramble"]').forEach(btn => {
            setBtnState(btn, scrambleOk,
                '🔒 Scramble — finish ' + lessonLabel(unlock.SCRAMBLE_UNLOCK_AFTER),
                '🌸 Scramble');
        });

        document.querySelectorAll('button[data-gate="linkup"]').forEach(btn => {
            setBtnState(btn, linkupOk,
                '🔒 Link Up — finish ' + lessonLabel(unlock.LINKUP_UNLOCK_AFTER),
                '🔗 Link Up');
        });

        const audioOk = !!unlock.isModuleVisible('audiodojo');
        document.querySelectorAll('button[data-gate="audiodojo"]').forEach(btn => {
            setBtnState(btn, audioOk,
                '🔒 Audio Dojo — finish ' + lessonLabel(unlock.AUDIO_DOJO_UNLOCK_AFTER),
                '🎧 Audio Dojo');
        });

        // Force-collapse submenus when their parent is locked. Once unlocked,
        // user controls open/close via the toggle.
        const scrambleSub = document.getElementById('k-scr-submenu');
        if (scrambleSub && !scrambleOk) scrambleSub.classList.add('k-hidden');
        const linkupSub = document.getElementById('k-linkup-submenu');
        if (linkupSub && !linkupOk) linkupSub.classList.add('k-hidden');

        // Conjugation Station — locked until G1 is done.
        document.querySelectorAll('[data-gate="conjugation"]').forEach(btn => {
            setBtnState(btn, g1Done,
                '🔒 Conjugation Station — finish G1',
                '⚡ Conjugation Station');
        });

        // Audio Practice dojo-home tile — locked until Audio Dojo unlocks (N5.3).
        const audioTile = document.getElementById('k-dojo-tile-audio');
        const audioFoot = document.getElementById('k-dojo-tile-audio-foot');
        if (audioTile) {
            audioTile.classList.toggle('k-dojo-tile--locked', !audioOk);
            audioTile.style.cursor = audioOk ? '' : 'default';
            if (audioFoot) audioFoot.textContent = audioOk ? 'Open' : '🔒 Finish ' + lessonLabel(unlock.AUDIO_DOJO_UNLOCK_AFTER);
        }

        // Games dojo-home tile — locked until either Scramble or Link Up unlocks.
        const gamesTile = document.getElementById('k-dojo-tile-games');
        const gamesFoot = document.getElementById('k-dojo-tile-games-foot');
        if (gamesTile) {
            const gamesOk = scrambleOk || linkupOk;
            gamesTile.classList.toggle('k-dojo-tile--locked', !gamesOk);
            gamesTile.style.cursor = gamesOk ? '' : 'default';
            if (gamesFoot) gamesFoot.textContent = gamesOk ? 'Open' : '🔒 Locked';
        }
    }

    KanjiApp.showMenu = function() {
        if (window.JPApp) window.JPApp.showTabBar();
        kUpdateStats();
        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const menu = document.getElementById('k-view-menu');
        if(menu) menu.classList.remove('k-hidden');
        applyMenuGating();
    };

    // Kana Writing helper button — conditionally rendered into the Writing hub
    // depending on the Settings → Practice Helpers toggle. Re-renders live when
    // the user flips the toggle without leaving the Dojo.
    function renderWritingKanaSlot() {
        const slot = document.getElementById('k-writing-kana-slot');
        if (!slot) return;
        const ph = window.JPShared && window.JPShared.practiceHelpers;
        const on = ph ? ph.getKanaWriting() : false;
        if (on) {
            slot.innerHTML =
                '<div class="k-lbl">KANA (HELPER)</div>' +
                '<button class="k-btn k-btn--indigo" onclick="window.JPApp.launch(\'writing-kana\')">あ Hiragana &amp; Katakana</button>';
        } else {
            slot.innerHTML = '';
        }
    }

    // Subscribe once so a Settings-modal toggle change repaints immediately.
    (function () {
        const ph = window.JPShared && window.JPShared.practiceHelpers;
        if (ph && ph.onChange) ph.onChange(function () { renderWritingKanaSlot(); });
    })();

    KanjiApp.showHub = function(hubId) {
        const toast = function (msg) {
            if (window.JPApp && window.JPApp._toast) window.JPApp._toast(msg);
        };

        // Games tile is locked until at least one of its sub-games is unlocked.
        if (hubId === 'k-view-hub-games') {
            const u = window.JPShared && window.JPShared.unlock;
            if (u && !u.isScrambleUnlocked() && !u.isLinkUpUnlocked()) {
                toast('Complete more lessons to unlock Games.');
                return;
            }
        }

        kUpdateStats();
        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const hub = document.getElementById(hubId);
        if (hub) hub.classList.remove('k-hidden');
        applyMenuGating();

        if (hubId === 'k-view-hub-flags-grammar') {
            renderFlaggedGrammar();
        }
        if (hubId === 'k-view-hub-writing') {
            renderWritingKanaSlot();
        }
    };

    KanjiApp.start = function(type, mode, subMode='normal') {
        if (window.JPApp) window.JPApp.hideTabBar();
        // Activity gates — final defense even if the menu wasn't refreshed.
        const u = window.JPShared && window.JPShared.unlock;
        const toast = function (msg) {
            if (window.JPApp && window.JPApp._toast) window.JPApp._toast(msg);
            else alert(msg);
        };
        if (u) {
            if (type === 'dojo' && !u.isCompleted('G1')) {
                toast('Finish Grammar 1 to unlock the Conjugation Station.'); return;
            }
            if (type === 'scramble' && !u.isScrambleUnlocked()) {
                toast('Complete a few more lessons to unlock Scramble.'); return;
            }
            if ((type === 'connections' || type === 'connections4') && !u.isLinkUpUnlocked()) {
                toast('Complete a few more lessons to unlock Link Up.'); return;
            }
            if ((type === 'marathon' || type === 'connections4') && !u.isN4Unlocked()) {
                toast('Reach N4 to unlock this activity.'); return;
            }
        }
        // Record streak activity on practice session start (flash/quiz have no end screen)
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
        curType = type; curMode = mode; curSubMode = subMode; curIdx = 0; curStreak = 0; quizPhase = 1; resetStreakVisuals();
        setTxt('k-streak', 0); setTxt('k-fc-streak', 0);

        if (mode === 'quiz-meaning') curCategory = 'meaning';
        else if (mode === 'quiz-reading') curCategory = 'reading';
        else if (mode === 'quiz-vocab') curCategory = 'vocab';
        else if (mode === 'quiz-conj') curCategory = 'verb';
        else if (mode === 'flash') curCategory = 'flash';
        else curCategory = '';

        curBest = bestScores[curCategory] || 0;
        setTxt('k-best', curBest);
        setTxt('k-fc-best', curBest);

        if (mode === 'flash' || mode === 'flag-review') {
            flashcardsStart(type, mode);
            return;
        } else if (type === 'connections') {
            connStart();
            return;
        } else if (type === 'connections4') {
            conn4Start();
            return;
        } else if (type === 'scramble') {
            scrStart();
            return;
        } else if (type === 'marathon') {
            marathonStart();
            return;
        } else if (type === 'dojo') {
            dojoStart();
            return;
        }

        if(type==='kanji') curSet = DB.kanji.filter(k => activeLessons.has(k.lesson));
        else if(type==='verb') curSet = [...DB.verb];
        else if(type==='vocab') {
            // Iterate DB.allVocab directly (bypasses the 5-compound cap on
            // DB.kanji[i].compounds, which would otherwise silently hide
            // authored hybrids like 名まえ if 名 already has 5 cheaper
            // compounds queued). evaluate() picks the right display form and
            // decides eligibility: include a vocab if the picked form contains
            // any active kanji (covers authored hybrids: 名まえ on N5.1,
            // 月よう日 on N5.2), or if its lesson_ids is in active lessons.
            // Non-authored compounds like 人見知り stay excluded because their
            // matches[] has no hybrid form, so pick falls back to the reading.
            const tempMap = new Map();
            const activeKanjiSet = new Set(
                DB.kanji.filter(k => activeLessons.has(k.lesson)).map(k => k.kanji)
            );
            const vocabDisplay = window.JPShared && window.JPShared.vocabDisplay;
            (DB.allVocab || []).forEach(v => {
                if (!v || !v.surface || tempMap.has(v.surface)) return;
                const res = vocabDisplay
                    ? vocabDisplay.evaluate(v, activeKanjiSet, activeLessons)
                    : { eligible: false, display: v.surface };
                if (!res.eligible) return;
                tempMap.set(v.surface, {
                    word: res.display, surface: v.surface,
                    reading: v.reading, meaning: v.meaning,
                    lesson: v.lesson_ids || '', gtype: v.gtype, notes: v.notes
                });
            });
            curSet = Array.from(tempMap.values());
        }

        if(curSet.length === 0) return alert("Please select at least one lesson.");
        curSet.sort(() => Math.random() - 0.5);

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });

        KanjiApp.nextQ();
        const qv = document.getElementById('k-view-quiz');
        if(qv) qv.classList.remove('k-hidden');
    };

    // --- CONNECTIONS (LINK UP: SORTED) — plugin module ---
    let connScriptLoaded = false;

    async function connLoadScript() {
        if (connScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/connections.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            connScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load connections.js:', e);
            alert('Could not load Link Up.');
            return false;
        }
    }

    async function connStart() {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
        if (!await connLoadScript()) return;

        curMode = 'connections'; curCategory = 'connections';

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const cv = document.getElementById('k-view-conn');
        if(cv) cv.classList.remove('k-hidden');

        window.JPShared.connectionsGame.init(document.getElementById('k-conn-stage'), {
            level: 'N5',
            activeLessons: activeLessons,
            config: REPO_CONFIG,
            onComplete: function() {
                const saved = curMode; curMode = 'connections';
                launchHanabi(1);
                curMode = saved;
            },
            onExit: function() { KanjiApp.showMenu(); },
            onProgress: function(done, total) {
                setTxt('k-conn-progress', done + ' / ' + total);
            }
        });
    }

    KanjiApp.toggleLinkUpMenu = function() {
        const u = window.JPShared && window.JPShared.unlock;
        if (u && !u.isLinkUpUnlocked()) {
            const after = (u.LINKUP_UNLOCK_AFTER || 'N5.8');
            const lesson = (after.match(/^N5\.(\d+)$/) || [,'N5'])[1];
            const msg = 'Complete Lesson ' + lesson + ' to unlock Link Up.';
            if (window.JPApp && window.JPApp._toast) window.JPApp._toast(msg); else alert(msg);
            return;
        }
        const sub = document.getElementById('k-linkup-submenu');
        if (sub) sub.classList.toggle('k-hidden');
    };

    // --- CONNECTIONS N4 (LINK UP: HIDDEN) — plugin module ---
    let conn4ScriptLoaded = false;

    async function conn4LoadScript() {
        if (conn4ScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/connections4.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            conn4ScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load connections4.js:', e);
            alert('Could not load Link Up: Hidden.');
            return false;
        }
    }

    async function conn4Start() {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
        curMode = 'connections4'; curCategory = 'connections4';

        if (!await conn4LoadScript()) return;

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const cv = document.getElementById('k-view-conn4');
        if(cv) cv.classList.remove('k-hidden');

        window.JPShared.connections4Game.init(document.getElementById('k-conn4-stage'), {
            level: 'N4',
            activeLessons: activeLessons,
            config: REPO_CONFIG,
            onComplete: function() {
                const saved = curMode; curMode = 'connections4';
                launchHanabi(1);
                curMode = saved;
            },
            onExit: function() { KanjiApp.showMenu(); },
            onProgress: function(done, total) {
                setTxt('k-conn4-progress', done + ' / ' + total);
            }
        });
    }

    // --- SCRAMBLE (module loader) ---
    let scrScriptLoaded = false;

    async function scrLoadScript() {
        if (scrScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/scramble.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            scrScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load scramble.js:', e);
            alert('Could not load Sentence Builder.');
            return false;
        }
    }

    async function scrStart() {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
        curMode = 'scramble'; curCategory = 'scramble';

        if (!await scrLoadScript()) return;

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const sv = document.getElementById('k-view-scr');
        if(sv) sv.classList.remove('k-hidden');

        window.JPShared.scramble.init(document.getElementById('k-scr-stage'), {
            level: 'N5',
            activeLessons: activeLessons,
            config: REPO_CONFIG,
            onComplete: function() {
                const saved = curMode; curMode = 'scramble';
                launchHanabi(1);
                curMode = saved;
            },
            onExit: function() { KanjiApp.showMenu(); },
            onProgress: function(done, total) {
                setTxt('k-scr-progress', done + ' / ' + total);
            }
        });
    }

    KanjiApp.toggleScrMenu = function() {
        const u = window.JPShared && window.JPShared.unlock;
        if (u && !u.isScrambleUnlocked()) {
            const after = (u.SCRAMBLE_UNLOCK_AFTER || 'N5.2');
            const lesson = (after.match(/^N5\.(\d+)$/) || [,'N5'])[1];
            const msg = 'Complete Lesson ' + lesson + ' to unlock Scramble.';
            if (window.JPApp && window.JPApp._toast) window.JPApp._toast(msg); else alert(msg);
            return;
        }
        const sub = document.getElementById('k-scr-submenu');
        if (sub) sub.classList.toggle('k-hidden');
    };

    // --- MARATHON (module loader) ---
    let maraScriptLoaded = false;

    async function maraLoadScript() {
        if (maraScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/marathon.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            maraScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load marathon.js:', e);
            alert('Could not load Sentence Challenge.');
            return false;
        }
    }

    async function marathonStart() {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
        curMode = 'marathon'; curCategory = 'marathon';

        if (!await maraLoadScript()) return;

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const mv = document.getElementById('k-view-mara');
        if(mv) mv.classList.remove('k-hidden');

        window.JPShared.marathon.init(document.getElementById('k-mara-stage'), {
            level: 'N4',
            activeLessons: activeLessons,
            config: REPO_CONFIG,
            onComplete: function() {
                const saved = curMode; curMode = 'marathon';
                launchHanabi(1);
                curMode = saved;
            },
            onExit: function() { KanjiApp.showMenu(); },
            onProgress: function(done, total) {
                setTxt('k-mara-progress', done + ' / ' + total);
            }
        });
    }

    // ---- Conjugation Station ----
    let dojoConjRules = null;
    let dojoScriptLoaded = false;

    async function dojoLoadScript() {
        if (dojoScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/conjugation-dojo.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            dojoScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load conjugation-dojo.js:', e);
            alert('Could not load Conjugation Station.');
            return false;
        }
    }

    async function dojoStart() {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();

        // Load the dojo game module script
        if (!await dojoLoadScript()) return;

        // Load conjugation_rules.json once
        if (!dojoConjRules) {
            try {
                const url = window.getAssetUrl(REPO_CONFIG, 'conjugation_rules.json') + '?t=' + Date.now();
                dojoConjRules = await (await fetch(url)).json();
            } catch(e) {
                alert('Could not load conjugation rules.');
                return;
            }
        }

        // Switch views
        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const dv = document.getElementById('k-view-dojo');
        if(dv) dv.classList.remove('k-hidden');

        let dojoStreak = 0;
        let dojoBest = bestScores.dojo || 0;
        setTxt('k-dojo-streak', 0);
        setTxt('k-dojo-best', dojoBest);

        window.JPShared.conjugationDojo.init(document.getElementById('k-dojo-stage'), {
            activeLessons: activeLessons,
            vocabMap: DB.vocabMap,
            conjugationRules: dojoConjRules,
            textProcessor: window.JPShared.textProcessor,
            unlock: window.JPShared.unlock || null,
            onCorrect: function() {
                var H = window.JPShared && window.JPShared.haptics;
                if (H) H.success();
                dojoStreak++;
                if (dojoStreak > dojoBest) {
                    var prevBest = dojoBest;
                    dojoBest = dojoStreak;
                    bestScores.dojo = dojoBest;
                    window.JPShared.progress.setBestScore('dojo', dojoBest);
                    // A new personal best ≥10 queues a Rikizo celebration that
                    // fires on the next home render. We update the same pending
                    // key on each new best within the run so the user sees the
                    // highest streak they achieved, not an earlier milestone.
                    if (dojoStreak >= 10) {
                        try {
                            localStorage.setItem('k-rikizo-pending-celebration', JSON.stringify({
                                source: 'dojo',
                                best: dojoStreak,
                                prevBest: prevBest
                            }));
                        } catch (e) { /* private mode */ }
                    }
                }
                setTxt('k-dojo-streak', dojoStreak);
                setTxt('k-dojo-best', dojoBest);
                if (dojoStreak >= 5 && dojoStreak % 5 === 0) {
                    var saved = curMode; curMode = 'dojo';
                    launchHanabi(dojoStreak);
                    curMode = saved;
                }
            },
            onWrong: function() {
                var H = window.JPShared && window.JPShared.haptics;
                if (H) H.warning();
                dojoStreak = 0;
                setTxt('k-dojo-streak', 0);
            },
            onExit: function() { KanjiApp.showMenu(); },
            onProgress: function(current, total) {
                setTxt('k-dojo-progress', current + ' / ' + total);
            },
            getStreakInfo: function() { return { streak: dojoStreak, best: dojoBest }; }
        });
    }

    // ---- Flashcards (plugin module) ----
    let flashcardsScriptLoaded = false;

    async function flashcardsLoadScript() {
        if (flashcardsScriptLoaded) return true;
        try {
            const url = window.getAssetUrl(REPO_CONFIG, 'app/games/flashcards.js') + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const code = await res.text();
            const script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            flashcardsScriptLoaded = true;
            return true;
        } catch(e) {
            console.error('[Practice] Failed to load flashcards.js:', e);
            alert('Could not load Flashcards.');
            return false;
        }
    }

    async function flashcardsStart(type, mode) {
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();

        if (!await flashcardsLoadScript()) return;

        ALL_VIEWS.forEach(i => {
            const el = document.getElementById(i);
            if(el) el.classList.add('k-hidden');
        });
        const fv = document.getElementById('k-view-flash');
        if(fv) fv.classList.remove('k-hidden');

        let flashStreak = 0;
        let flashBest = bestScores.flash || 0;
        setTxt('k-fc-streak', 0);
        setTxt('k-fc-best', flashBest);

        window.JPShared.flashcards.init(document.getElementById('k-fc-stage'), {
            type: type,
            mode: mode,
            activeLessons: activeLessons,
            DB: DB,
            onCorrect: function() {
                var H = window.JPShared && window.JPShared.haptics;
                if (H) H.success();
                flashStreak++;
                if (flashStreak > flashBest) {
                    flashBest = flashStreak;
                    bestScores.flash = flashBest;
                    window.JPShared.progress.setBestScore('flash', flashBest);
                }
                setTxt('k-fc-streak', flashStreak);
                setTxt('k-fc-best', flashBest);
                var card = document.getElementById('k-fc-card-obj');
                if (card) {
                    var glow = STREAK_GLOW[0];
                    for (var i = STREAK_GLOW.length - 1; i >= 0; i--) {
                        if (flashStreak >= STREAK_GLOW[i].min) { glow = STREAK_GLOW[i]; break; }
                    }
                    card.style.boxShadow = '0 0 ' + glow.spread + 'px ' + glow.color + ', 0 15px 35px rgba(0,0,0,0.1)';
                    card.style.borderColor = glow.color;
                }
                if (flashStreak >= 5 && flashStreak % 5 === 0) {
                    var saved = curMode; curMode = 'flash';
                    launchHanabi(flashStreak);
                    curMode = saved;
                }
            },
            onWrong: function() {
                var H = window.JPShared && window.JPShared.haptics;
                if (H) H.warning();
                flashStreak = 0;
                setTxt('k-fc-streak', 0);
                var card = document.getElementById('k-fc-card-obj');
                if (card) { card.style.boxShadow = ''; card.style.borderColor = ''; }
                document.querySelectorAll('.k-hanabi-container').forEach(function(c) { c.remove(); });
            },
            onExit: function() { KanjiApp.showMenu(); }
        });

        // Native polish: swipe-left/right on the flashcard stage.
        // Tap-to-flip is wired inside app/games/flashcards.js — we only add
        // horizontal swipe for advance/back by clicking the existing prev/next
        // buttons (so flashcards' internal `move(n)` keeps streak/state sync).
        // Vertical scroll inside the stage is preserved via the 1.5x dominance
        // check, and listeners are passive so scroll is never blocked.
        var stage = document.getElementById('k-fc-stage');
        if (stage && !stage.dataset.swipeBound) {
            stage.dataset.swipeBound = '1';
            var x0 = 0, y0 = 0, t0 = 0, active = false;
            stage.addEventListener('pointerdown', function(e) {
                active = true; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
            }, { passive: true });
            stage.addEventListener('pointerup', function(e) {
                if (!active) return; active = false;
                var dx = e.clientX - x0, dy = e.clientY - y0, dt = Date.now() - t0;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
                    var btn = document.getElementById(dx < 0 ? 'k-fc-btn-next' : 'k-fc-btn-prev');
                    if (btn && !btn.disabled) {
                        btn.click();
                        var H = window.JPShared && window.JPShared.haptics;
                        if (H) H.light();
                    }
                }
            }, { passive: true });
            stage.addEventListener('pointercancel', function() { active = false; }, { passive: true });
        }
    }

    KanjiApp.toggleAccordion = function(h) { h.classList.toggle('open'); h.nextElementSibling.classList.toggle('open'); };
    KanjiApp.toggleAll = function(cls, p) {
        document.querySelectorAll(`.k-chk-${cls}`).forEach(b => {
            b.checked = p.checked;
            if(p.checked) activeLessons.add(b.value); else activeLessons.delete(b.value);
        });
        kUpdateStats();
    };
    KanjiApp.updateLesson = function(id, cls) {
        if(activeLessons.has(id)) activeLessons.delete(id); else activeLessons.add(id);
        const all = document.querySelectorAll(`.k-chk-${cls}`);
        const checked = document.querySelectorAll(`.k-chk-${cls}:checked`);
        const p = all[0].closest('.k-lvl-group').querySelector('.k-lvl-header input');
        p.checked = (all.length === checked.length);
        p.indeterminate = (checked.length > 0 && checked.length < all.length);
        kUpdateStats();
    };

    KanjiApp.nextQ = function() {
        const msg = document.getElementById('k-q-msg'); if(msg) msg.classList.add('k-hidden');
        const nxt = document.getElementById('k-q-next'); if(nxt) nxt.classList.add('k-hidden');
        const opts = document.getElementById('k-q-opts'); if(opts) opts.innerHTML = '';
        const rev = document.getElementById('k-q-read-reveal'); if(rev) rev.classList.add('k-hidden');
        quizPhase = 1;

        let q='', a='', m='', dists=[];
        curQItem = curSet[Math.floor(Math.random()*curSet.length)];
        let effectiveSubMode = curSubMode === 'mix' ? (Math.random() < 0.5 ? 'normal' : 'reverse') : curSubMode;
        curQItem.activeMode = effectiveSubMode;

        if(curMode==='quiz-meaning') {
            if(effectiveSubMode === 'normal') { q='What does this mean?'; m=curQItem.kanji; a=curQItem.meaning; dists = kRand(curSet, 'meaning', a); }
            else { q='Which Kanji means...'; m=curQItem.meaning; a=curQItem.kanji; dists = kRand(curSet, 'kanji', a); }
        } else if(curMode==='quiz-reading') {
            if(effectiveSubMode === 'normal') {
                q='Select readings'; m=curQItem.kanji; a=[curQItem.on,curQItem.kun].filter(x=>x).join(' / ');
                let safe=0; while(dists.length<3 && safe++<50) { let r=curSet[Math.floor(Math.random()*curSet.length)]; let x=[r.on,r.kun].filter(y=>y).join(' / '); if(x!==a && !dists.includes(x)) dists.push(x); }
            } else {
                q='Which Kanji reads...'; m=[curQItem.on,curQItem.kun].filter(x=>x).join(' / '); a=curQItem.kanji; dists = kRand(curSet, 'kanji', a);
            }
        } else if(curMode==='quiz-vocab') {
            q = 'What is the meaning?'; m = curQItem.word; a = curQItem.meaning;
            let safe=0; while(dists.length<3 && safe++<50) { let r=curSet[Math.floor(Math.random()*curSet.length)]; if(r.meaning && r.meaning!==a && !dists.includes(r.meaning)) dists.push(r.meaning); }
        } else if(curMode==='quiz-conj') {
            const forms=['masu','te','nai','ta','potential']; const f=forms[Math.floor(Math.random()*forms.length)];
            const lbls={'masu':'Polite','te':'Te-Form','nai':'Negative','ta':'Past','potential':'Potential'};
            q=`What is the ${lbls[f]} form?`; m=`${curQItem.meaning} (${curQItem.dict})`; a=curQItem[f];
            let safe=0; while(dists.length<3 && safe++<50) { let r=curSet[Math.floor(Math.random()*curSet.length)]; if(r[f]!==a && !dists.includes(r[f])) dists.push(r[f]); }
        }

        curAns = a;
        setTxt('k-q-ask', q);
        setTxt('k-q-main', m);
        const isBig = (curMode.includes('quiz-meaning') && effectiveSubMode==='normal') || (curMode.includes('quiz-reading') && effectiveSubMode==='normal') || curMode==='quiz-vocab';
        const mainEl = document.getElementById('k-q-main');
        if(mainEl) mainEl.style.fontSize = isBig ? '5rem' : '2.5rem';
        kRenderOpts(a, dists);

        // The Dojo draws a random card, so there's no lesson page to resolve —
        // tell Ask-Rikizo the exact item on the card instead.
        try {
            const tc = window.JPShared && window.JPShared.tutorContext;
            if (tc && curQItem) tc.patch({
                view: 'practice',
                lessonId: null,
                page: null,
                item: curQItem.kanji || curQItem.word || curQItem.dict || null,
                sectionType: curMode
            });
        } catch (e) {}
    };

    // A vocab word is "readable" (worth the bonus reading quiz) only if its
    // DISPLAYED form contains a kanji. vocab-display.js shows kanji only once
    // taught, so a pure-kana display — an all-kana word, OR a kanji word whose
    // kanji isn't taught yet (友だち hybrid, いたい→痛い) — has nothing to read.
    // CJK range mirrors app/shared/vocab-display.js so this agrees with pick().
    function wordHasKanji(s) { return /[㐀-鿿]/.test(String(s || '')); }

    KanjiApp.check = function(sel, btn) {
        const nextBtn = document.getElementById('k-q-next');
        if(nextBtn && !nextBtn.classList.contains('k-hidden')) return;

        const msg = document.getElementById('k-q-msg');
        const haptics = window.JPShared && window.JPShared.haptics;
        const sfx = window.JPShared && window.JPShared.sfx;
        const setMsg = function(text, kind) {
            if (!msg) return;
            msg.textContent = text;
            msg.classList.remove('is-correct','is-wrong');
            if (kind) msg.classList.add(kind);
            msg.style.color = ''; msg.style.background = '';
            msg.classList.remove('k-hidden');
        };
        if(sel===curAns) {
            btn.classList.add('correct'); curStreak++; updateStreakVisuals(curStreak);
            if (haptics) haptics.success();
            if (sfx) sfx.success();
            const readEl = document.getElementById('k-q-read-reveal');
            if(readEl) {
                if(curMode === 'quiz-meaning') {
                    // Reveal the reading (kana) through jpText so romaji mode
                    // reaches it. Prompt (k-q-main) stays bare via innerText.
                    var revealRead = [curQItem.on, curQItem.kun].filter(x => x).join(' / ');
                    var jt = window.JPShared && window.JPShared.jpText;
                    readEl.innerHTML = jt ? jt.render(revealRead) : escHTML(revealRead);
                    readEl.classList.remove('k-hidden');
                }
                else if (curMode === 'quiz-reading') { readEl.innerText = curQItem.meaning; readEl.classList.remove('k-hidden'); }
            }

            if(curMode === 'quiz-vocab' && quizPhase === 1 && wordHasKanji(curQItem.word || curQItem.surface)) {
                setMsg('Correct! Bonus: select the reading.', 'is-correct');
                setTimeout(() => {
                    quizPhase = 2;
                    setTxt('k-q-ask', "What is the reading?");
                    let dists = []; let safe=0;
                    while(dists.length<3 && safe++<50) { let r=curSet[Math.floor(Math.random()*curSet.length)]; if(r.reading && r.reading!==curQItem.reading && !dists.includes(r.reading)) dists.push(r.reading); }
                    curAns = curQItem.reading;
                    if(msg) msg.classList.add('k-hidden');
                    kRenderOpts(curAns, dists);
                }, 800);
                return;
            }
            if(curStreak > curBest) { curBest = curStreak; if(curCategory) { bestScores[curCategory] = curBest; window.JPShared.progress.setBestScore(curCategory, curBest); } }
            setMsg('Correct! Streak: ' + curStreak + ' 🔥', 'is-correct');
        } else {
            btn.classList.add('wrong'); curStreak = 0; resetStreakVisuals();
            if (haptics) haptics.warning();
            if (sfx) sfx.error();
            setMsg('Wrong! It was: ' + curAns, 'is-wrong');
            document.querySelectorAll('.k-opt').forEach(b=>{if(b.innerText===curAns)b.classList.add('correct')});
        }
        setTxt('k-streak', curStreak);
        setTxt('k-best', curBest);
        if(nextBtn) nextBtn.classList.remove('k-hidden');
    };

    function kRand(set, key, exc) {
        let res=[]; let s=0;
        while(res.length<3 && s++<100) { let r=set[Math.floor(Math.random()*set.length)][key]; if(r!==exc && !res.includes(r)) res.push(r); }
        return res;
    }

    function kRenderOpts(ans, dists) {
        let opts = [ans, ...dists].sort(()=>Math.random()-0.5);
        const c = document.getElementById('k-q-opts');
        if(!c) return;
        c.innerHTML = '';
        opts.forEach(o => {
            let b = document.createElement('div'); b.className='k-opt'; b.innerText=o;
            b.onclick = ()=>KanjiApp.check(o, b);
            c.appendChild(b);
        });
    }

    function kUpdateStats() {
        setTxt('k-cnt-k', DB.kanji.filter(k => activeLessons.has(k.lesson)).length);
        // Verbs count = only those introduced in lessons the user has actually
        // completed (i.e. "verbs you've learned," not the full DB).
        const completedLessons = (function () {
            try { return new Set(Object.keys(JSON.parse(localStorage.getItem('k-lesson-completed') || '{}'))); }
            catch (e) { return new Set(); }
        })();
        setTxt('k-cnt-v', DB.verb.filter(v => v.lesson && completedLessons.has(v.lesson)).length);
        setTxt('k-hs-meaning', bestScores.meaning);
        setTxt('k-hs-reading', bestScores.reading);
        setTxt('k-hs-vocab', bestScores.vocab);
        const freshActiveFlags = (window.JPShared.progress && window.JPShared.progress.getAllActiveFlags()) || activeFlags;
        setTxt('k-cnt-flags', Object.keys(freshActiveFlags).length);

        // Mirror the vocab pool gate exactly so the stat matches what the
        // user will see in Vocab Flashcards / Quiz.
        const activeKanjiSet = new Set(
            DB.kanji.filter(k => activeLessons.has(k.lesson)).map(k => k.kanji)
        );
        const vocabDisplay = window.JPShared && window.JPShared.vocabDisplay;
        const uniqueVocab = new Set();
        (DB.allVocab || []).forEach(v => {
            if (!v || !v.surface) return;
            const res = vocabDisplay
                ? vocabDisplay.evaluate(v, activeKanjiSet, activeLessons)
                : { eligible: false };
            if (res.eligible) uniqueVocab.add(v.surface);
        });
        setTxt('k-cnt-vocab', uniqueVocab.size);
    }

    // --- 5. INIT & DATA FETCH ---
    (async function() {
        try {
            await new Promise(r => setTimeout(r, 50));
            const manifest = await window.getManifest(REPO_CONFIG);

            // Build a lookup: lessonId → manifest entry (carries unlocksAfter)
            const manifestLessonMap = {};
            (manifest.levels || ['N5','N4']).forEach(lvl => {
                ((manifest.data[lvl] || {}).lessons || []).forEach(entry => {
                    manifestLessonMap[entry.id] = entry;
                });
            });

            const particlesUrl = (manifest.shared && manifest.shared.particles)
                ? window.getAssetUrl(REPO_CONFIG, manifest.shared.particles) + "?t=" + Date.now()
                : null;
            const fetchedParts = await Promise.all([
                ...manifest.levels.map(lvl => fetch(window.getAssetUrl(REPO_CONFIG, manifest.data[lvl].glossary) + "?t=" + Date.now()).then(r => r.json())),
                particlesUrl ? fetch(particlesUrl).then(r => r.json()).catch(() => null) : Promise.resolve(null)
            ]);
            const glossParts = fetchedParts.slice(0, manifest.levels.length);
            const particleData = fetchedParts[manifest.levels.length];
            const raw = glossParts.flatMap(g => g.entries);

            // Index grammar (gtype-tagged) entries and particles by surface so the
            // Flagged Grammar screen can resolve flag keys without re-fetching.
            raw.forEach(e => {
                if (!e || !e.surface) return;
                if (e.type === 'grammar' || e.gtype === 'grammar' || e.type === 'particle') {
                    if (!DB.grammarMap.has(e.surface)) DB.grammarMap.set(e.surface, e);
                }
            });
            if (particleData && Array.isArray(particleData.particles)) {
                particleData.particles.forEach(p => {
                    if (!p || !p.particle) return;
                    if (!DB.grammarMap.has(p.particle)) {
                        DB.grammarMap.set(p.particle, {
                            id: p.id, surface: p.particle, reading: p.reading,
                            meaning: p.role, notes: p.explanation,
                            type: 'particle',
                            lesson_ids: p.introducedIn || p.lesson_ids || ''
                        });
                    }
                });
            }

            DB.allVocab = raw.filter(i => i.type === 'vocab');
            const allVocab = DB.allVocab;
            allVocab.forEach(v => {
                DB.vocabMap.set(v.surface, v);
            });

            DB.kanji = raw.filter(i => i.type === 'kanji').map(k => {
                const compounds=[], comp_readings=[], comp_meanings=[];
                allVocab.forEach(v => {
                    if (v.surface.includes(k.surface) && compounds.length < 5) {
                        compounds.push(v.surface); comp_readings.push(v.reading); comp_meanings.push(v.meaning);
                    }
                });
                return {
                    class: k.lesson||"General", lesson: k.lesson||"Other", kanji: k.surface,
                    on: k.on||"", kun: k.kun||"", meaning: k.meaning,
                    compounds: compounds.join(';'), comp_readings: comp_readings.join(';'), comp_meanings: comp_meanings.join(';')
                };
            });

            const baseVerbs = raw.filter(i => i.type === 'vocab' && i.gtype === 'verb' && !i.id.includes('__'));
            DB.verb = baseVerbs.map(base => {
                const getForm = (suffix) => { const f = raw.find(i => i.id === base.id + suffix); return f ? f.surface : '-'; };
                return {
                    kanji: base.surface, dict: base.surface, reading: base.reading, meaning: base.meaning,
                    lesson: base.lesson, // preserved so kUpdateStats can count only learned verbs
                    masu: getForm('__polite'), te: getForm('__te'), nai: getForm('__negative'), ta: getForm('__past'), potential: getForm('__potential')
                };
            });

            const lessonMap = {};
            DB.kanji.forEach(k => {
                if(!k.lesson) return;
                if(!lessonMap[k.lesson]) lessonMap[k.lesson] = { id: k.lesson, topic: `Lesson ${k.lesson}`, kanji: [] };
                lessonMap[k.lesson].kanji.push(k.kanji);
            });
            DB.lessons = Object.values(lessonMap).map(l => ({ id: l.id, topic: l.topic, kanji_list: l.kanji.join(', ') }));
            DB.lessons.sort((a,b) => {
                const pa = a.id.replace('N','').split('.').map(Number); const pb = b.id.replace('N','').split('.').map(Number);
                if(pa[0]!==pb[0]) return pa[0]-pb[0]; return (pa[1]||0) - (pb[1]||0);
            });

            const container = document.getElementById('k-lesson-container');
            if(container) {
                container.innerHTML = '';
                const groups = {};
                const unlock = window.JPShared && window.JPShared.unlock;
                DB.lessons.forEach(l => {
                    // Skip lessons that are locked in gated mode
                    if (unlock && !unlock.isFree()) {
                        const entry = manifestLessonMap[l.id] || { id: l.id };
                        if (!unlock.isLessonUnlocked(entry)) return;
                    }
                    const cls = l.id.split('.')[0] || "Other";
                    if(!groups[cls]) groups[cls] = [];
                    groups[cls].push(l);
                    activeLessons.add(l.id);
                });

                Object.keys(groups).sort().forEach(cls => {
                    const div = document.createElement('div'); div.className = 'k-lvl-group';
                    div.innerHTML = `
                        <div class="k-lvl-header" onclick="KanjiApp.toggleAccordion(this)">
                            <input type="checkbox" class="k-chk" checked onclick="event.stopPropagation(); KanjiApp.toggleAll('${cls}', this)">
                            <div class="k-lvl-title">${cls}</div><div class="k-lvl-arrow">▼</div>
                        </div>
                        <div class="k-lvl-list">${groups[cls].map(l => `<div class="k-lesson-row"><input type="checkbox" class="k-chk k-chk-${cls}" value="${l.id}" checked onchange="KanjiApp.updateLesson('${l.id}', '${cls}')"><div class="k-l-info" onclick="this.previousElementSibling.click()"><div class="k-l-topic">${l.topic}</div><div class="k-l-kanji">${l.kanji_list}</div></div></div>`).join('')}</div>`;
                    container.appendChild(div);
                });
            }

            kUpdateStats();
            applyMenuGating();
            const loader = document.getElementById('k-loader');
            if(loader) loader.classList.add('k-hidden');

            // First-time Dojo tutorial — Rikizo walks the user through each
            // section. Per-section memory persisted; safe to call again if
            // they exit and come back, only unseen steps will fire.
            if (window.JPShared.rikizoCompanion && window.JPShared.rikizoCompanion.runDojoTutorial) {
                setTimeout(function () { window.JPShared.rikizoCompanion.runDojoTutorial(); }, 350);
            }

        } catch(e) {
            console.error(e);
            const errBox = document.getElementById('k-error-box');
            if(errBox) {
                errBox.innerText = "Error: " + (e.message || "Unknown error");
                errBox.classList.remove('k-hidden');
            }
        }
    })();
  }
};
