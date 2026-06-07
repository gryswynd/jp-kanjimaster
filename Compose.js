window.ComposeModule = {
  start: function(container, sharedConfig, exitCallback) {

    // --- NAMESPACE ---
    window.ComposeApp = {};

    // --- FONTS ---
    if (!document.getElementById('compose-fonts')) {
        const link = document.createElement('link');
        link.id = 'compose-fonts';
        link.rel = 'stylesheet';
        link.href = 'app/shared/fonts.css';
        document.head.appendChild(link);
    }

    // --- CSS ---
    if (!document.getElementById('jp-compose-style')) {
        const style = document.createElement('style');
        style.id = 'jp-compose-style';
        style.textContent = `
            #compose-app-root {
                --c-primary: oklch(0.58 0.09 140); --c-primary-dark: oklch(0.50 0.09 140);
                --c-primary-light: #E7EEE3;
                --washi: oklch(0.97 0.008 80); --washi-2: oklch(0.94 0.012 75); --washi-3: oklch(0.90 0.015 75);
                --ink: oklch(0.22 0.012 60); --ink-2: oklch(0.38 0.012 60); --ink-3: oklch(0.55 0.012 60);
                --hairline: oklch(0.22 0.012 60 / 0.12); --hairline-2: oklch(0.22 0.012 60 / 0.06);
                --vermilion: oklch(0.60 0.18 30); --moss: oklch(0.58 0.09 140); --indigo: oklch(0.42 0.08 250);
                --font-jp-display: "Noto Serif JP","Shippori Mincho",serif;
                --c-text-main: oklch(0.22 0.012 60); --c-text-sub: oklch(0.55 0.012 60);
                --c-success: oklch(0.58 0.09 140); --c-error: oklch(0.60 0.18 30);
                --c-gold: oklch(0.72 0.11 70);

                font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
                background:
                  radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
                  radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
                  var(--washi);
                color: var(--c-text-main);
                display: flex; flex-direction: column;
                width: 100%; min-height: 100vh; min-height: 100dvh; position: relative;
            }
            #compose-app-root * { box-sizing: border-box; }

            #compose-app-root header {
                background: var(--ink); color: var(--washi); padding: max(28px,env(safe-area-inset-top)) 18px 14px;
                text-align: center; font-weight: 600; letter-spacing: 0.02em; font-size: 17px;
                font-family: var(--font-jp-display);
                cursor: pointer; user-select: none; z-index: 10;
                border-bottom: 1px solid oklch(1 0 0 / 0.1);
                display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0;
            }
            .c-exit-btn { background: transparent; border: 1px solid oklch(1 0 0 / 0.25); color: var(--washi); padding: 6px 14px; border-radius: 999px; cursor: pointer; font-weight: 600; font-size: 0.8rem; }

            #c-app-container { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; align-items: center; width: 100%; position: relative; z-index: 1; }
            .c-card { background: var(--washi); border-radius: var(--r-lg,22px); box-shadow: 0 10px 25px rgba(0,0,0,0.05); padding: 1.5rem; width: 100%; text-align: center; margin-bottom: 1rem; border: 1px solid var(--hairline); }
            .c-btn { background: var(--ink); color: var(--washi); border: none; padding: 14px; border-radius: 999px; font-size: 15px; font-weight: 600; width: 100%; margin: 6px 0; cursor: pointer; transition: all 0.2s; }
            .c-btn:active { transform: scale(0.98); }
            .c-btn-sec { background: white; color: var(--c-text-sub); border: 2px solid #DCD5C7; box-shadow: none; }
            .c-btn-sm { padding: 8px 14px; font-size: 0.85rem; width: auto; margin: 4px; display: inline-block; }
            .c-hidden { display: none !important; }
            .c-lbl { font-size: 0.8rem; text-transform: uppercase; color: #a4b0be; font-weight: 700; letter-spacing: 0.1em; margin-top: 8px; margin-bottom: 8px; }

            /* MENU — LESSON CARDS */
            .c-menu-card { background: white; border-radius: 14px; padding: 1.2rem; margin-bottom: 12px; border: 2px solid #E7EEE3; text-align: left; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 14px; position: relative; }
            .c-menu-stamp { position: absolute; top: 8px; right: 8px; width: 52px; height: 52px; border-radius: 50%; border: 3px solid #C7902F; background: white; padding: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transform: rotate(8deg); pointer-events: none; }
            .c-menu-stamp img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
            @media (hover: hover) { .c-menu-card:hover { border-color: var(--c-primary); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); } }
            .c-menu-emoji { font-size: 2rem; flex-shrink: 0; }
            .c-menu-info { flex: 1; min-width: 0; }
            .c-menu-title { font-weight: 800; font-size: 1rem; color: var(--c-primary-dark); }
            .c-menu-lesson { font-size: 0.78rem; font-weight: 700; color: var(--c-primary); background: var(--c-primary-light); padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 4px; }
            .c-menu-theme { font-size: 0.82rem; color: var(--c-text-sub); line-height: 1.4; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .c-menu-meta { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
            .c-menu-tag { font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 700; }
            .c-menu-tag-count { background: #F1E7D6; color: #9A5A12; }
            .c-menu-tag-done { background: #E7EFE3; color: #3A5A3C; }
            .c-menu-tag-draft { background: #E4E7F0; color: #3F4E8C; }
            .c-menu-tag-score { background: #F5EEDA; color: #8A6A1E; }

            /* LEVEL PICKER */
            .c-level-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; }
            .c-level-card {
                background: white; padding: 28px 24px; border-radius: 20px; cursor: pointer;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
                border: 2px solid #E7EEE3; text-align: center;
            }
            @media (hover: hover) { .c-level-card:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0,137,123,0.15); border-color: var(--c-primary); } }
            .c-level-name { font-weight: 900; font-size: 1.4rem; color: var(--c-primary); margin-bottom: 6px; }
            .c-level-count { font-size: 0.85rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .c-level-back-btn { background: transparent; border: none; color: var(--c-primary); font-weight: 700; cursor: pointer; padding: 0 0 12px 0; font-size: 0.9rem; display: block; font-family: inherit; }
            @media (hover: hover) { .c-level-back-btn:hover { text-decoration: underline; } }
            .c-menu-empty { padding: 20px; text-align: center; color: #a4b0be; font-weight: 600; font-size: 0.9rem; }

            /* COMPOSE HEADER */
            .c-compose-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px 16px; background: white; border-radius: 14px; border: 2px solid #E7EEE3; }
            .c-compose-header-emoji { font-size: 2.2rem; flex-shrink: 0; }
            .c-compose-header-info { flex: 1; min-width: 0; }
            .c-compose-header-title { font-weight: 900; font-size: 1.15rem; color: var(--c-primary-dark); }
            .c-compose-header-theme { font-size: 0.82rem; color: var(--c-text-sub); line-height: 1.4; margin-top: 2px; }

            /* PROMPT TIMELINE */
            .c-timeline { width: 100%; margin-bottom: 12px; }
            .c-timeline-step { display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; border-radius: 10px; margin-bottom: 4px; transition: all 0.3s; position: relative; }
            .c-timeline-step.active { background: var(--c-primary-light); border: 2px solid var(--c-primary); }
            .c-timeline-step.done { opacity: 0.7; }
            .c-timeline-step.locked { opacity: 0.4; }
            .c-timeline-step.challenge { border-left: 4px solid var(--c-gold); }
            .c-timeline-badge { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; transition: all 0.3s; }
            .c-timeline-step.done .c-timeline-badge { background: var(--c-success); color: white; }
            .c-timeline-step.active .c-timeline-badge { background: var(--c-primary); color: white; }
            .c-timeline-step.locked .c-timeline-badge { background: #e0e0e0; color: #bdbdbd; }
            .c-timeline-prompt { font-size: 0.88rem; color: var(--c-text-main); font-weight: 600; line-height: 1.4; flex: 1; }
            .c-timeline-step.done .c-timeline-prompt { text-decoration: line-through; color: var(--c-text-sub); }
            .c-timeline-step.locked .c-timeline-prompt { color: #bdbdbd; }
            .c-timeline-challenge-tag { font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: #F1E7D6; color: #9A5A12; font-weight: 800; margin-left: 4px; }

            /* ACTIVE PROMPT BANNER */
            .c-prompt-banner { background: linear-gradient(135deg, #E7EEE3, #D7E4CF); border-radius: 14px; padding: 1rem 1.2rem; margin-bottom: 12px; text-align: left; border-left: 5px solid var(--c-primary); }
            .c-prompt-banner-title { font-weight: 800; font-size: 1rem; color: var(--c-primary-dark); margin-bottom: 4px; }
            .c-prompt-banner-text { font-size: 0.92rem; color: #37474F; line-height: 1.5; font-weight: 600; }

            /* MODEL SENTENCE */
            .c-model-toggle { font-size: 0.8rem; color: var(--c-primary); cursor: pointer; font-weight: 700; margin-top: 8px; user-select: none; display: inline-block; }
            @media (hover: hover) { .c-model-toggle:hover { text-decoration: underline; } }
            .c-model-sentence { font-family: 'Noto Sans JP', sans-serif; font-size: 0.95rem; color: #6b6356; background: rgba(255,255,255,0.6); padding: 8px 12px; border-radius: 8px; margin-top: 6px; line-height: 1.6; display: none; }
            .c-model-sentence.visible { display: block; }

            /* PROGRESS BAR */
            .c-progress-wrap { width: 100%; margin-bottom: 12px; }
            .c-progress-bar-outer { width: 100%; height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden; }
            .c-progress-bar-inner { height: 100%; background: var(--moss); border-radius: 5px; transition: width 0.4s ease; }
            .c-progress-text { display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--c-text-sub); margin-top: 4px; }

            /* TEXTAREA */
            .c-textarea { width: 100%; min-height: 120px; max-height: 200px; border: 2px solid #DCD5C7; border-radius: 12px; padding: 12px; font-size: 1.1rem; font-family: 'Noto Sans JP', 'Schibsted Grotesk','Work Sans',system-ui,sans-serif; line-height: 1.8; resize: vertical; outline: none; transition: border-color 0.2s; color: var(--c-text-main); }
            .c-textarea:focus { border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
            .c-textarea::placeholder { color: #b0bec5; font-size: 0.95rem; }
            .c-char-count { text-align: right; font-size: 0.75rem; color: #a4b0be; font-weight: 600; margin-top: 4px; }

            /* WORD TARGETS */
            .c-target-list { text-align: left; margin-bottom: 8px; }
            .c-target-item { display: flex; align-items: center; padding: 8px 10px; border-radius: 8px; margin-bottom: 4px; transition: all 0.3s; border: 1px solid #EBE5D8; }
            .c-target-item.done { background: #E7EFE3; border-color: #c8e6c9; }
            .c-target-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #DCD5C7; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 0.8rem; flex-shrink: 0; transition: all 0.3s; }
            .c-target-item.done .c-target-check { background: var(--c-success); border-color: var(--c-success); color: white; }
            .c-target-surface { font-family: 'Noto Sans JP', sans-serif; font-size: 1.1rem; font-weight: 700; margin-right: 6px; cursor: pointer; }
            @media (hover: hover) { .c-target-surface:hover { color: var(--c-primary); } }
            .c-target-reading { font-size: 0.85rem; color: #78909C; margin-right: 8px; }
            .c-target-meaning { font-size: 0.82rem; color: var(--c-text-sub); flex: 1; }
            .c-target-count { font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 10px; background: #f5f5f5; color: #78909C; min-width: 36px; text-align: center; }
            .c-target-item.done .c-target-count { background: var(--c-success); color: white; }

            /* ACCORDION SECTIONS */
            .c-section { margin-bottom: 8px; border-radius: 10px; overflow: hidden; border: 1px solid #e0e0e0; }
            .c-section-hdr { padding: 10px 14px; background: #fafafa; cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none; }
            @media (hover: hover) { .c-section-hdr:hover { background: #f5f5f5; } }
            .c-section-title { font-weight: 700; font-size: 0.88rem; color: var(--c-text-main); }
            .c-section-arrow { font-size: 0.75rem; color: #a4b0be; transition: transform 0.3s; }
            .c-section-hdr.open .c-section-arrow { transform: rotate(180deg); }
            .c-section-body { display: none; padding: 10px 12px; background: white; }
            .c-section-body.open { display: block; }

            /* WORD CHIPS */
            .c-chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
            .c-chip { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; border: 1px solid #e0e0e0; background: white; user-select: none; }
            @media (hover: hover) { .c-chip:hover { background: var(--c-primary-light); border-color: var(--c-primary); } }
            .c-chip:active { transform: scale(0.95); }
            .c-chip-jp { font-family: 'Noto Sans JP', sans-serif; font-weight: 700; font-size: 0.9rem; }
            .c-chip-reading { color: #78909C; font-size: 0.75rem; font-family: 'Noto Sans JP', sans-serif; }
            .c-chip-en { color: var(--c-text-sub); font-size: 0.75rem; }

            /* PARTICLE & CONJUGATION REFERENCE */
            .c-ref-list { text-align: left; padding: 4px 0; }
            .c-ref-item { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; background: #f5f5f5; padding: 4px 10px; border-radius: 6px; margin: 3px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
            @media (hover: hover) { .c-ref-item:hover { background: var(--c-primary-light); } }
            .c-ref-item .c-ref-jp { font-family: 'Noto Sans JP', sans-serif; font-weight: 700; font-size: 0.88rem; }
            .c-ref-item .c-ref-role { color: #78909C; font-size: 0.75rem; }
            .c-conj-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #EBE5D8; font-size: 0.85rem; }
            .c-conj-item:last-child { border-bottom: none; }
            .c-conj-label { font-weight: 700; color: var(--c-text-main); }
            .c-conj-desc { color: var(--c-text-sub); font-size: 0.78rem; }
            .c-conj-entry { padding: 10px 12px; border-bottom: 1px solid #EBE5D8; }
            .c-conj-entry:last-child { border-bottom: none; }
            .c-conj-pattern { font-weight: 800; font-size: 0.9rem; color: var(--c-primary-dark); }
            .c-conj-meaning { font-size: 0.78rem; color: var(--c-text-sub); margin-top: 2px; }
            .c-conj-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
            .c-conj-example { font-family: 'Noto Sans JP', sans-serif; font-size: 0.88rem; font-weight: 600; background: #f5f5f5; padding: 3px 10px; border-radius: 6px; color: var(--c-text-main); cursor: pointer; transition: background 0.15s; }
            @media (hover: hover) { .c-conj-example:hover { background: var(--c-primary-light); } }

            /* NEXT PROMPT BUTTON */
            .c-next-prompt-btn { background: var(--moss); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-size: 1rem; font-weight: 800; width: 100%; margin: 10px 0; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.12); animation: c-celebrate 0.4s ease; }
            @media (hover: hover) { .c-next-prompt-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(46, 213, 115, 0.4); } }
            .c-next-prompt-btn:active { transform: scale(0.98); }

            /* COMPLETE BANNER */
            .c-complete-banner { background: var(--moss); color: white; border-radius: 14px; padding: 1.2rem; text-align: center; margin-bottom: 12px; animation: c-celebrate 0.5s ease; }
            .c-complete-banner h3 { margin: 0 0 4px 0; font-size: 1.3rem; }
            .c-complete-banner p { margin: 0; font-size: 0.9rem; opacity: 0.9; }
            @keyframes c-celebrate { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }

            /* ACTION BAR */
            .c-action-bar { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }

            /* SCORE BUTTON */
            .c-btn-score { background: oklch(0.72 0.11 70); box-shadow: 0 4px 6px rgba(0,0,0,0.12); }

            /* SCORE OVERLAY */
            .c-score-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 40; display: flex; align-items: center; justify-content: center; animation: c-fade-in 0.2s ease; }
            @keyframes c-fade-in { from { opacity: 0; } to { opacity: 1; } }
            .c-score-card { background: white; border-radius: 20px; padding: 1.8rem 1.5rem; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); animation: c-score-pop 0.35s ease; }
            @keyframes c-score-pop { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }
            .c-score-total { font-size: 3rem; font-weight: 900; color: var(--c-primary-dark); margin: 8px 0; }
            .c-score-label { font-size: 0.85rem; color: var(--c-text-sub); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
            .c-score-grade { font-size: 1.4rem; font-weight: 800; margin: 4px 0 12px 0; }
            .c-score-breakdown { text-align: left; margin: 12px 0; }
            .c-score-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #EBE5D8; }
            .c-score-row:last-child { border-bottom: none; }
            .c-score-row-label { font-size: 0.85rem; font-weight: 600; color: var(--c-text-main); }
            .c-score-row-detail { font-size: 0.75rem; color: var(--c-text-sub); }
            .c-score-row-pts { font-size: 0.95rem; font-weight: 800; color: var(--c-primary); }
            .c-score-bar { height: 6px; background: #e0e0e0; border-radius: 3px; margin-top: 4px; overflow: hidden; }
            .c-score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        `;
        document.head.appendChild(style);
    }

    // --- APP CONTAINER ---
    container.innerHTML = '';
    const appRoot = document.createElement('div');
    appRoot.id = 'compose-app-root';
    container.appendChild(appRoot);

    appRoot.innerHTML = `
        <div id="c-loader" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.98);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:3rem;margin-bottom:15px;">✏️</div>
            <div style="font-weight:800;color:#5E8C5F;font-size:1.2rem">Loading Compositions...</div>
            <div id="c-error-box" class="c-hidden" style="color:#C2410C;margin-top:10px;padding:10px;max-width:80%;font-size:0.9rem"></div>
        </div>
        <header>
            <span onclick="ComposeApp.showMenu()">Compose 作文</span>
            <div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="c-exit-btn">Exit</button></div>
        </header>
        <div id="c-app-container">
            <div id="c-view-menu" style="width:100%"></div>
            <div id="c-view-compose" class="c-hidden" style="width:100%"></div>
        </div>
    `;

    appRoot.querySelector('.c-exit-btn').onclick = exitCallback;

    // --- DATA ---
    const REPO_CONFIG = sharedConfig;
    if (window.JPShared.stampSettings) {
        window.JPShared.stampSettings.setConfig(REPO_CONFIG);
        // Warm the character cache so the 100% stamp resolves to the user's
        // chosen portrait instead of the default fallback.
        if (window.JPShared.stampSettings.loadCharacters) {
            window.JPShared.stampSettings.loadCharacters();
        }
    }

    let COMPOSE_FILES = [];    // array of loaded compose file data
    let vocabById = new Map(); // all glossary+grammar entries by id
    let particlesById = new Map(); // all particles by id
    let conjugationRules = {}; // all conjugation rules
    let lessonMeta = new Map(); // lesson id -> { title }
    let manifestData = null;    // parsed manifest.json (for known-kanji projection)

    // --- STATE ---
    let currentCompose = null;   // the active compose file data
    let currentKnownKanji = null; // Set<string> of kanji known at the active compose's lesson
    let activePromptIndex = 0;   // which prompt is currently active (manually controlled)
    let allPromptsComplete = false;
    let currentPromptTargetsMet = false; // whether the active prompt's targets are all met

    // --- HELPER FUNCTIONS ---
    function countOccurrences(text, matches) {
        let total = 0;
        for (const m of matches) {
            let idx = 0;
            while ((idx = text.indexOf(m, idx)) !== -1) {
                total++;
                idx += m.length;
            }
        }
        return total;
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // Render Japanese surface through the shared reading-aids pipeline. Pass
    // an object with {surface, reading, tokens} when available. Falls back to
    // escHtml when the jp-text module isn't loaded or when called with a raw
    // string that has no token data.
    function jpRender(input) {
        const rk = window.JPShared && window.JPShared.jpText;
        if (rk) return rk.render(input);
        if (typeof input === 'string') return escHtml(input);
        if (input && typeof input === 'object') return escHtml(input.surface || input.k || input.jp || '');
        return '';
    }

    // For verb and i-adjective targets, return the invariant kanji root (surface minus
    // trailing hiragana). e.g. 走る → 走, 食べる → 食べ, 赤い → 赤, 茶色い → 茶色.
    // This root appears in all conjugated forms so students get credit whether they
    // write 走る/走ります/走った, 赤い/赤かった/赤くない, etc.
    // Returns null if the stripped root would be too short or entry is not verb/i-adj.
    function getKanjiRoot(entry) {
        if (!entry) return null;
        const isVerb = entry.gtype === 'verb';
        const isIAdj = entry.gtype === 'adjective' && entry.verb_class === 'i_adj';
        if (!isVerb && !isIAdj) return null;
        const surface = entry.surface || '';
        let end = surface.length;
        while (end > 0 && surface.charCodeAt(end - 1) >= 0x3040 && surface.charCodeAt(end - 1) <= 0x309F) {
            end--;
        }
        const root = surface.slice(0, end);
        // Must have stripped at least one hiragana and the root must be non-empty
        return (root.length >= 1 && root.length < surface.length) ? root : null;
    }

    // Pick the right surface to show given the kanji set known at the active
    // compose's lesson — e.g. render 友達 as 友だち until 達 is taught. Tokens
    // are stripped when the picked form differs from the canonical surface,
    // since the tokens were generated against the canonical form.
    function pickDisplay(entry) {
        const canonical = (entry && (entry.surface || entry.particle)) || '';
        const vd = window.JPShared && window.JPShared.vocabDisplay;
        if (!entry || !vd || !currentKnownKanji) {
            return { surface: canonical, tokens: (entry && entry.tokens) || null };
        }
        const picked = vd.pick(entry, currentKnownKanji);
        return {
            surface: picked || canonical,
            tokens: (picked === canonical) ? (entry.tokens || null) : null
        };
    }

    function resolveTargets(targets) {
        return (targets || []).map(t => {
            const entry = t.id ? vocabById.get(t.id) : null;
            const baseMatches = entry ? [entry.surface || entry.particle, entry.reading].filter(Boolean) : [];
            // Include the glossary's authored alternate forms (e.g. "友だち" for
            // v_tomodachi) so hybrid spellings count as credit toward the target.
            if (entry && Array.isArray(entry.matches)) {
                entry.matches.forEach(m => {
                    if (m && !baseMatches.includes(m)) baseMatches.push(m);
                });
            }
            const root = getKanjiRoot(entry);
            if (root && !baseMatches.includes(root)) baseMatches.push(root);
            const display = pickDisplay(entry);
            return {
                id: t.id,
                surface: display.surface,
                reading: (entry && entry.reading) || '',
                meaning: (entry && (entry.meaning || entry.role)) || '',
                tokens: display.tokens,
                count: t.count || 1,
                matches: t.matches || baseMatches
            };
        });
    }

    function resolveVocabPool(poolIds) {
        return (poolIds || []).map(id => vocabById.get(id) || particlesById.get(id)).filter(Boolean).map(e => {
            const display = pickDisplay(e);
            return {
                id: e.id,
                surface: display.surface || e.particle || '',
                reading: e.reading || '',
                meaning: e.meaning || e.role || '',
                tokens: display.tokens
            };
        });
    }

    // Determine which prompt index should be active based on current text
    function computeActiveIndex(compose, text) {
        const allPrompts = compose.prompts || [];
        for (let i = 0; i < allPrompts.length; i++) {
            const targets = resolveTargets(allPrompts[i].targets);
            const allMet = targets.every(t => countOccurrences(text, t.matches) >= t.count);
            if (!allMet) return i;
        }
        // All regular prompts complete — check challenge prompts
        const challenges = compose.challengePrompts || [];
        for (let i = 0; i < challenges.length; i++) {
            const targets = resolveTargets(challenges[i].targets);
            const allMet = targets.every(t => countOccurrences(text, t.matches) >= t.count);
            if (!allMet) return allPrompts.length + i;
        }
        return allPrompts.length + challenges.length; // all done
    }

    function getAllPrompts(compose) {
        return [...(compose.prompts || []), ...(compose.challengePrompts || [])];
    }

    // Build the kanji set known at the given compose's lesson. Mirrors how
    // Lesson.js renders vocab — uses unlock.getKnownKanjiSet so the picker
    // sees the same kanji the student has been taught.
    function computeKnownKanjiForCompose(compose) {
        const unlock = window.JPShared && window.JPShared.unlock;
        if (!compose || !unlock || !unlock.getKnownKanjiSet || !manifestData) return null;
        let lessonMetaKanji = [];
        const lessonId = compose.lesson;
        const levels = (manifestData.data) || {};
        for (const lvl in levels) {
            const lessons = (levels[lvl] && levels[lvl].lessons) || [];
            const hit = lessons.find(l => l.id === lessonId);
            if (hit && Array.isArray(hit.kanji)) { lessonMetaKanji = hit.kanji; break; }
        }
        return unlock.getKnownKanjiSet(lessonId, manifestData, lessonMetaKanji);
    }

    // --- MENU VIEW ---
    ComposeApp.showMenu = function() {
        if (window.JPApp) window.JPApp.showTabBar();
        currentCompose = null;
        currentKnownKanji = null;
        activePromptIndex = 0;
        allPromptsComplete = false;

        const menuEl = document.getElementById('c-view-menu');
        const compEl = document.getElementById('c-view-compose');
        if (compEl) compEl.classList.add('c-hidden');
        if (!menuEl) return;
        menuEl.classList.remove('c-hidden');

        if (COMPOSE_FILES.length === 0) {
            menuEl.innerHTML = `<div class="c-card" style="padding:1rem;"><div class="c-menu-empty">No compositions available yet.</div></div>`;
            return;
        }

        // Filter to only unlocked compose files
        const unlockApi = window.JPShared && window.JPShared.unlock;
        const visibleFiles = COMPOSE_FILES.filter(cf =>
            !unlockApi || unlockApi.isFree() || unlockApi.isComposeUnlocked(cf)
        );

        // Group compose files by level
        const byLevel = {};
        visibleFiles.forEach(cf => {
            const lvl = cf.level || 'Other';
            if (!byLevel[lvl]) byLevel[lvl] = [];
            byLevel[lvl].push(cf);
        });
        ComposeApp._byLevel = byLevel;

        const levels = ['N5', 'N4'].filter(l => {
            if (!byLevel[l] || !byLevel[l].length) return false;
            if (l === 'N4' && unlockApi && !unlockApi.isFree() && !unlockApi.isN4Unlocked()) return false;
            return true;
        });

        let html = '';
        levels.forEach(level => {
            const count = byLevel[level].length;
            html += `
                <div class="c-level-card" data-level="${level}">
                    <div class="c-level-name">JLPT ${level}</div>
                    <div class="c-level-count">${count} composition${count !== 1 ? 's' : ''}</div>
                </div>
            `;
        });

        menuEl.innerHTML = `
            <div class="c-card" style="padding:1rem;">
                <div class="c-lbl" style="color:var(--c-primary);margin-top:0;">Choose a Level</div>
                <div class="c-level-grid">${html}</div>
            </div>
        `;

        menuEl.querySelectorAll('.c-level-card').forEach(card => {
            card.onclick = () => ComposeApp._showLevel(card.dataset.level);
        });

        // Rikizo: welcome on the level picker (first visit only).
        try {
            const rk = window.JPShared && window.JPShared.rikizoCompanion;
            if (rk && rk.runComposeTutorialStep) {
                setTimeout(() => rk.runComposeTutorialStep('levelPicker'), 300);
            }
        } catch (e) {}
    };

    // --- LEVEL VIEW ---
    ComposeApp._showLevel = function(level) {
        if (window.JPApp) window.JPApp.showTabBar();
        const byLevel = ComposeApp._byLevel || {};
        const files = byLevel[level] || [];
        const menuEl = document.getElementById('c-view-menu');
        if (!menuEl) return;

        const allLevels = ['N5', 'N4'].filter(l => byLevel[l] && byLevel[l].length);
        let html = '';
        if (allLevels.length > 1) {
            html += `<button class="c-level-back-btn" id="c-back-to-levels">← Levels</button>`;
        }

        const progress = window.JPShared && window.JPShared.progress;
        files.forEach(cf => {
            const totalPrompts = (cf.prompts || []).length + (cf.challengePrompts || []).length;
            const draftState = loadDraftState(cf);
            const bestScore = progress && progress.getBestComposeScore ? progress.getBestComposeScore(cf.id) : 0;

            let statusTag = '';
            if (bestScore >= 75) {
                statusTag = '<span class="c-menu-tag c-menu-tag-done">Complete</span>';
            } else if (draftState.text) {
                statusTag = '<span class="c-menu-tag c-menu-tag-draft">Draft saved</span>';
            }
            const scoreTag = bestScore > 0
                ? `<span class="c-menu-tag c-menu-tag-score">${bestScore}%</span>`
                : '';
            let stampHtml = '';
            if (bestScore >= 100) {
                const stampApi = window.JPShared && window.JPShared.stampSettings;
                const stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
                if (stampUrl) {
                    stampHtml = `<div class="c-menu-stamp" title="Perfect score"><img src="${escHtml(stampUrl)}" alt="Perfect"></div>`;
                }
            }

            html += `
                <div class="c-menu-card" onclick="ComposeApp.startCompose('${escHtml(cf.id)}')">
                    ${stampHtml}
                    <div class="c-menu-emoji">${cf.emoji || '✏️'}</div>
                    <div class="c-menu-info">
                        <div class="c-menu-title">${escHtml(cf.title)}</div>
                        <span class="c-menu-lesson">${escHtml(cf.lesson)}</span>
                        <div class="c-menu-theme">${escHtml(cf.theme || '')}</div>
                        <div class="c-menu-meta">
                            <span class="c-menu-tag c-menu-tag-count">${totalPrompts} prompt${totalPrompts !== 1 ? 's' : ''}</span>
                            ${statusTag}
                            ${scoreTag}
                        </div>
                    </div>
                </div>`;
        });

        menuEl.innerHTML = `
            <div class="c-card" style="padding:1rem;">
                <div class="c-lbl" style="color:var(--c-primary);margin-top:0;">JLPT ${level} Compositions</div>
                ${html}
            </div>
        `;

        const backBtn = document.getElementById('c-back-to-levels');
        if (backBtn) backBtn.onclick = () => ComposeApp.showMenu();

        // Rikizo: 3-bubble intro on the lesson menu (first visit only).
        try {
            const rk = window.JPShared && window.JPShared.rikizoCompanion;
            if (rk && rk.runComposeTutorialStep) {
                setTimeout(() => rk.runComposeTutorialStep('lessonMenu'), 300);
            }
        } catch (e) {}
    };

    // --- COMPOSE VIEW ---
    ComposeApp.startCompose = function(composeId) {
        const compose = COMPOSE_FILES.find(cf => cf.id === composeId);
        if (!compose) return;
        currentCompose = compose;
        currentKnownKanji = computeKnownKanjiForCompose(compose);

        const menuEl = document.getElementById('c-view-menu');
        const compEl = document.getElementById('c-view-compose');
        if (menuEl) menuEl.classList.add('c-hidden');
        if (!compEl) return;
        compEl.classList.remove('c-hidden');

        // Load draft and saved prompt index
        const draftState = loadDraftState(compose);
        const draft = draftState.text;
        activePromptIndex = draftState.promptIndex;
        currentPromptTargetsMet = false;
        const allP = getAllPrompts(compose);
        // Clamp to valid range
        if (activePromptIndex >= allP.length) activePromptIndex = Math.max(0, allP.length - 1);
        allPromptsComplete = false;

        ComposeApp.renderComposeView(draft);
    };

    ComposeApp.renderComposeView = function(draftText) {
        if (window.JPApp) window.JPApp.hideTabBar();
        const compose = currentCompose;
        if (!compose) return;

        const compEl = document.getElementById('c-view-compose');
        if (!compEl) return;

        const allP = getAllPrompts(compose);
        const regularCount = (compose.prompts || []).length;
        const totalPrompts = allP.length;

        // Tell Ask-Rikizo which compose set + prompt is on screen; the server
        // resolves the visible Japanese from the file (no client-side extraction).
        try {
            const tc = window.JPShared && window.JPShared.tutorContext;
            if (tc) tc.patch({
                view: 'compose',
                lessonId: compose.lesson || compose.id || null,
                page: activePromptIndex,
                sectionType: activePromptIndex >= regularCount ? 'challenge' : 'prompt'
            });
        } catch (e) {}

        // Build active prompt banner and targets
        let promptBannerHtml = '';
        let targetHtml = '';
        if (activePromptIndex < totalPrompts) {
            const activeP = allP[activePromptIndex];
            const isChallenge = activePromptIndex >= regularCount;
            const resolvedTargets = resolveTargets(activeP.targets);

            promptBannerHtml = `
                <div class="c-prompt-banner" data-tour-compose="prompt">
                    <div class="c-prompt-banner-title">
                        ${isChallenge ? '<span class="c-timeline-challenge-tag">Challenge</span> ' : ''}
                        Prompt ${activePromptIndex + 1}
                    </div>
                    <div class="c-prompt-banner-text">${escHtml(activeP.prompt)}</div>
                    ${activeP.model ? `
                        <div class="c-model-toggle" onclick="ComposeApp.toggleModel()">Show example</div>
                        <div class="c-model-sentence" id="c-model-sentence">${escHtml(activeP.model)}</div>
                    ` : ''}
                </div>`;

            resolvedTargets.forEach((t, i) => {
                targetHtml += `<div class="c-target-item" id="c-tgt-${i}">
                    <div class="c-target-check" id="c-tgt-chk-${i}"></div>
                    <span class="c-target-surface" onclick="ComposeApp.insertWord('${escHtml(t.surface)}')" title="Click to insert">${jpRender(t)}</span>
                    <span class="c-target-reading">${escHtml(t.reading)}</span>
                    <span class="c-target-meaning">${escHtml(t.meaning)}</span>
                    <span class="c-target-count" id="c-tgt-cnt-${i}">0/${t.count}</span>
                </div>`;
            });
        }

        // Build vocab pool for active prompt
        let vocabPoolHtml = '';
        if (activePromptIndex < totalPrompts) {
            const activeP = allP[activePromptIndex];
            const pool = resolveVocabPool(activeP.vocabPool);
            pool.forEach(v => {
                const readingHtml = v.reading ? `<span class="c-chip-reading">${escHtml(v.reading)}</span>` : '';
                const meaning = (v.meaning || '').substring(0, 30);
                vocabPoolHtml += `<div class="c-chip" onclick="ComposeApp.insertWord('${escHtml(v.surface)}')" title="${escHtml(v.meaning)}">
                    <span class="c-chip-jp">${jpRender(v)}</span>
                    ${readingHtml}
                    <span class="c-chip-en">${escHtml(meaning)}</span>
                </div>`;
            });
        }

        // Build particle reference (gated)
        let particleRefHtml = '';
        (compose.particles || []).forEach(pid => {
            const p = particlesById.get(pid) || vocabById.get(pid);
            if (!p) return;
            const surface = p.particle || p.surface || '';
            const role = p.role || p.meaning || '';
            // Particles use `particle` as their surface field — adapt to the
            // shape jpRender expects via {surface, tokens}.
            const refShape = { surface: surface, reading: p.reading || '', tokens: p.tokens || null };
            particleRefHtml += `<span class="c-ref-item" onclick="ComposeApp.insertWord('${escHtml(surface)}')">
                <span class="c-ref-jp">${jpRender(refShape)}</span>
                <span class="c-ref-role">${escHtml(role)}</span>
            </span>`;
        });

        // Build conjugation reference (rich pattern display)
        let conjRefHtml = '';
        (compose.conjugations || []).forEach(entry => {
            // Support both old string keys (legacy) and new rich objects
            if (typeof entry === 'string') {
                const rule = conjugationRules[entry];
                if (!rule) return;
                conjRefHtml += `<div class="c-conj-item">
                    <div>
                        <div class="c-conj-label">${escHtml(rule.label)}</div>
                        <div class="c-conj-desc">${escHtml(rule.description)}</div>
                    </div>
                </div>`;
                return;
            }
            const examples = (entry.examples || []).map(ex =>
                `<span class="c-conj-example" onclick="ComposeApp.insertWord('${escHtml(ex)}')">${jpRender(ex)}</span>`
            ).join('');
            conjRefHtml += `<div class="c-conj-entry">
                <div class="c-conj-pattern">${jpRender(entry.pattern)}</div>
                <div class="c-conj-meaning">${escHtml(entry.meaning)}</div>
                <div class="c-conj-examples">${examples}</div>
            </div>`;
        });

        // Progress info
        const progressTotal = allP.reduce((sum, p) => sum + (p.targets || []).length, 0);

        // Build complete view
        compEl.innerHTML = `
            <div class="c-compose-header">
                <span class="c-compose-header-emoji">${compose.emoji || ''}</span>
                <div class="c-compose-header-info">
                    <div class="c-compose-header-title">${escHtml(compose.title)}</div>
                    <div class="c-compose-header-theme">${escHtml(compose.theme || '')}</div>
                </div>
            </div>

            ${promptBannerHtml}

            <div id="c-complete-box" class="c-hidden"></div>

            <div class="c-progress-wrap">
                <div class="c-progress-bar-outer">
                    <div class="c-progress-bar-inner" id="c-progress-fill" style="width:0%"></div>
                </div>
                <div class="c-progress-text">
                    <span id="c-progress-lbl">0 / ${progressTotal} target words used</span>
                    <span id="c-progress-pct">0%</span>
                </div>
            </div>

            <textarea class="c-textarea" id="c-compose-input" placeholder="ここに日本語を書いてください... (Write Japanese here)">${escHtml(draftText || '')}</textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div class="c-char-count" id="c-char-count" data-tour-compose="charCount" data-length-budget="${Math.max(1, totalPrompts) * 20}">${(draftText || '').length} / ${Math.max(1, totalPrompts) * 20} characters</div>
                <div class="c-action-bar">
                    <button class="c-btn c-btn-sm c-btn-score" data-tour-compose="score" onclick="ComposeApp.showScore()" title="Score your composition">Score</button>
                    <!-- Listen removed: composition is free text with no pre-baked Chirp clip.
                         Returns with the network-backed tutor (runtime synthesis). -->
                    <button class="c-btn c-btn-sm c-btn-sec" data-tour-compose="clear" onclick="ComposeApp.clearDraft()" title="Clear composition">Clear</button>
                </div>
            </div>

            <button id="c-next-prompt-btn" class="c-next-prompt-btn c-hidden" data-tour-compose="nextPrompt" onclick="ComposeApp.nextPrompt()">Next Prompt &#x2192;</button>

            ${targetHtml ? `
            <div class="c-section" style="margin-top:8px;" data-tour-compose="targetWords">
                <div class="c-section-hdr open" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Target Words</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body open">
                    <div class="c-target-list" id="c-target-list">${targetHtml}</div>
                </div>
            </div>` : ''}

            ${vocabPoolHtml ? `
            <div class="c-section" data-tour-compose="wordBank">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Word Bank</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    <div class="c-chip-wrap" id="c-vocab-pool">${vocabPoolHtml}</div>
                </div>
            </div>` : ''}

            ${particleRefHtml ? `
            <div class="c-section" data-tour-compose="particles">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Particles & Copula</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    <div class="c-ref-list">${particleRefHtml}</div>
                </div>
            </div>` : ''}

            ${conjRefHtml ? `
            <div class="c-section" data-tour-compose="conjugation">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Conjugation Patterns</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    ${conjRefHtml}
                </div>
            </div>` : ''}

            <button class="c-btn c-btn-sec" onclick="ComposeApp.showMenu()" style="margin-top:10px;border:none;color:#a4b0be;font-size:0.9rem">Back to Menu</button>
        `;

        // Setup input listener
        const input = document.getElementById('c-compose-input');
        if (input) {
            input.addEventListener('input', function() {
                ComposeApp.updateTracking();
                saveDraftState();
                const cc = document.getElementById('c-char-count');
                if (cc) {
                    const budget = parseInt(cc.dataset.lengthBudget, 10) || (Math.max(1, getAllPrompts(currentCompose).length) * 20);
                    cc.textContent = input.value.length + ' / ' + budget + ' characters';
                }
            });
            // Initial tracking if there's a draft
            if (draftText) {
                setTimeout(() => ComposeApp.updateTracking(), 100);
            }
        }

        // Rikizo: in-composition tutorial chain (first visit only).
        try {
            const rk = window.JPShared && window.JPShared.rikizoCompanion;
            if (rk && rk.runComposeTutorialStep) {
                setTimeout(() => ComposeApp._runComposeTutorialChain(rk), 400);
            }
        } catch (e) {}
    };

    // Sequence the 9 in-composition steps. Each call no-ops after first time,
    // so re-entering the composition won't replay seen steps. Steps run
    // sequentially via Promise chaining so spotlights don't stack.
    ComposeApp._runComposeTutorialChain = function(rk) {
        const sel = (key) => `#compose-app-root [data-tour-compose="${key}"]`;
        const scope = '#compose-app-root';
        const step = (seenKey, target) =>
            rk.runComposeTutorialStep(seenKey, { target: target ? sel(target) : null, scope });

        let chain = Promise.resolve();
        chain = chain.then(() => step('prompt',       'prompt'));
        chain = chain.then(() => step('targetWords',  'targetWords'));
        chain = chain.then(() => step('wordBank',     'wordBank'));
        chain = chain.then(() => step('particles',    'particles'));
        chain = chain.then(() => step('conjugation',  'conjugation'));
        // typeDemo: type 父母 into the textarea first, then spotlight Next Prompt.
        chain = chain.then(() => rk.runComposeTutorialStep('typeDemo', {
            target: sel('nextPrompt'),
            scope,
            before: () => new Promise((resolve) => {
                const ta = document.getElementById('c-compose-input');
                if (ta) {
                    ta.value = '父母';
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
                // Brief pause so the user sees the text land before the bubble pops.
                setTimeout(resolve, 600);
            })
        }));
        // Wipe the 父母 demo so the user starts with a clean textarea.
        chain = chain.then(() => {
            const ta = document.getElementById('c-compose-input');
            if (ta && ta.value === '父母') {
                ta.value = '';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        chain = chain.then(() => step('charCount', 'charCount'));
        chain = chain.then(() => step('score',  'score'));
        chain = chain.then(() => step('listen', 'listen'));
        chain = chain.then(() => step('clear',  'clear'));
        chain = chain.then(() => step('wrapUp', null));
        return chain.catch(() => {});
    };

    ComposeApp.buildTimeline = function(text) {
        const compose = currentCompose;
        if (!compose) return '';
        const allP = getAllPrompts(compose);
        const regularCount = (compose.prompts || []).length;
        let html = '';

        allP.forEach((p, i) => {
            const isChallenge = i >= regularCount;
            const isActive = i === activePromptIndex;
            const isPast = i < activePromptIndex; // already advanced past
            const isLocked = i > activePromptIndex;

            // For the active prompt, check targets against text
            let isCurrentMet = false;
            if (isActive) {
                const targets = resolveTargets(p.targets);
                isCurrentMet = targets.every(t => countOccurrences(text, t.matches) >= t.count);
            }

            let cls = 'c-timeline-step';
            if (isPast) cls += ' done';
            else if (isActive && isCurrentMet) cls += ' active done';
            else if (isActive) cls += ' active';
            else if (isLocked) cls += ' locked';
            if (isChallenge) cls += ' challenge';

            const badge = isPast ? '✓' : (isActive && isCurrentMet ? '✓' : (i + 1));
            const promptText = (p.prompt || '').substring(0, 60) + ((p.prompt || '').length > 60 ? '...' : '');
            const challengeTag = isChallenge ? '<span class="c-timeline-challenge-tag">Challenge</span>' : '';

            html += `<div class="${cls}">
                <div class="c-timeline-badge">${badge}</div>
                <div class="c-timeline-prompt">${escHtml(promptText)} ${challengeTag}</div>
            </div>`;
        });

        return html;
    };

    ComposeApp.updateTracking = function() {
        if (!currentCompose) return;
        const input = document.getElementById('c-compose-input');
        if (!input) return;
        const text = input.value;

        const compose = currentCompose;
        const allP = getAllPrompts(compose);

        allPromptsComplete = activePromptIndex >= allP.length;

        // Update current prompt's targets
        if (activePromptIndex < allP.length) {
            const activeP = allP[activePromptIndex];
            const resolvedTargets = resolveTargets(activeP.targets);

            let allMet = true;
            resolvedTargets.forEach((t, i) => {
                const count = countOccurrences(text, t.matches);
                const met = count >= t.count;
                if (!met) allMet = false;
                const item = document.getElementById('c-tgt-' + i);
                const chk = document.getElementById('c-tgt-chk-' + i);
                const cnt = document.getElementById('c-tgt-cnt-' + i);
                if (item) { if (met) item.classList.add('done'); else item.classList.remove('done'); }
                if (chk) chk.textContent = met ? '✓' : '';
                if (cnt) cnt.textContent = `${Math.min(count, t.count)}/${t.count}`;
            });

            currentPromptTargetsMet = allMet;

            // Show/hide Next Prompt button
            const nextBtn = document.getElementById('c-next-prompt-btn');
            if (nextBtn) {
                if (allMet && activePromptIndex < allP.length - 1) {
                    nextBtn.classList.remove('c-hidden');
                } else if (allMet && activePromptIndex === allP.length - 1) {
                    // Last prompt done — hide next button, completion will show
                    nextBtn.classList.add('c-hidden');
                    allPromptsComplete = true;
                } else {
                    nextBtn.classList.add('c-hidden');
                }
            }
        }

        // Update timeline
        const timelineEl = document.getElementById('c-timeline');
        if (timelineEl) timelineEl.innerHTML = ComposeApp.buildTimeline(text);

        // Update overall progress bar
        let totalMet = 0;
        let totalTargets = 0;
        allP.forEach((p, i) => {
            const targets = resolveTargets(p.targets);
            totalTargets += targets.length;
            if (i < activePromptIndex) {
                // Already completed prompts — all targets count as met
                totalMet += targets.length;
            } else if (i === activePromptIndex) {
                targets.forEach(t => {
                    if (countOccurrences(text, t.matches) >= t.count) totalMet++;
                });
            }
        });
        const pct = totalTargets > 0 ? Math.round((totalMet / totalTargets) * 100) : 0;
        const fill = document.getElementById('c-progress-fill');
        const lbl = document.getElementById('c-progress-lbl');
        const pctEl = document.getElementById('c-progress-pct');
        if (fill) fill.style.width = pct + '%';
        if (lbl) lbl.textContent = `${totalMet} / ${totalTargets} target words used`;
        if (pctEl) pctEl.textContent = pct + '%';

        // Complete banner
        const box = document.getElementById('c-complete-box');
        if (box) {
            if (allPromptsComplete && text.length > 0) {
                box.className = 'c-complete-banner';
                box.innerHTML = '<h3>All prompts complete!</h3><p>Great work! Your composition covers all the guided prompts.</p>';
            } else {
                box.className = 'c-hidden';
                box.innerHTML = '';
            }
        }
    };

    ComposeApp.nextPrompt = function() {
        if (!currentCompose) return;
        const allP = getAllPrompts(currentCompose);
        if (activePromptIndex >= allP.length - 1) return;
        activePromptIndex++;
        currentPromptTargetsMet = false;
        // Save prompt index
        saveDraftState();
        const input = document.getElementById('c-compose-input');
        const text = input ? input.value : '';
        ComposeApp.renderComposeView(text);
        // Re-focus textarea
        const newInput = document.getElementById('c-compose-input');
        if (newInput) {
            newInput.focus();
            newInput.selectionStart = newInput.selectionEnd = text.length;
        }
    };

    function saveDraftState() {
        if (!currentCompose) return;
        const input = document.getElementById('c-compose-input');
        if (!input) return;
        // Save text and prompt index together
        window.JPShared.progress.saveDraft(currentCompose.id, input.value);
        window.JPShared.progress.saveDraft(currentCompose.id + '__promptIdx', String(activePromptIndex));
    }

    function loadDraftState(compose) {
        const text = window.JPShared.progress.getDraft(compose.id) || '';
        const savedIdx = window.JPShared.progress.getDraft(compose.id + '__promptIdx');
        const idx = savedIdx !== null && savedIdx !== '' ? parseInt(savedIdx, 10) : 0;
        return { text, promptIndex: isNaN(idx) ? 0 : idx };
    }

    ComposeApp.toggleSection = function(hdr) {
        hdr.classList.toggle('open');
        const body = hdr.nextElementSibling;
        if (body) body.classList.toggle('open');
    };

    ComposeApp.toggleModel = function() {
        const el = document.getElementById('c-model-sentence');
        const toggle = document.querySelector('.c-model-toggle');
        if (!el || !toggle) return;
        el.classList.toggle('visible');
        toggle.textContent = el.classList.contains('visible') ? 'Hide example' : 'Show example';
    };

    ComposeApp.insertWord = function(word) {
        const input = document.getElementById('c-compose-input');
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + word + text.substring(end);
        input.selectionStart = input.selectionEnd = start + word.length;
        input.focus();
        input.dispatchEvent(new Event('input'));
    };

    ComposeApp.speakComposition = function() {
        const input = document.getElementById('c-compose-input');
        if (!input || !input.value.trim()) return;
        window.JPShared.tts.speak(input.value.trim());
    };

    ComposeApp.clearDraft = function() {
        if (!currentCompose) return;
        const input = document.getElementById('c-compose-input');
        if (!input) return;
        if (!confirm('Clear your composition? This cannot be undone.')) return;
        input.value = '';
        window.JPShared.progress.clearDraft(currentCompose.id);
        window.JPShared.progress.clearDraft(currentCompose.id + '__promptIdx');
        activePromptIndex = 0;
        currentPromptTargetsMet = false;
        allPromptsComplete = false;
        ComposeApp.renderComposeView('');
    };

    // --- SCORING ---
    ComposeApp.showScore = function() {
        if (!currentCompose) return;
        const input = document.getElementById('c-compose-input');
        if (!input || !input.value.trim()) return;
        const text = input.value;
        const compose = currentCompose;
        const allP = getAllPrompts(compose);

        // 1. Vocab Score (0-40)
        let totalTargets = 0;
        let targetsMet = 0;
        allP.forEach(p => {
            const targets = resolveTargets(p.targets);
            totalTargets += targets.length;
            targets.forEach(t => {
                if (countOccurrences(text, t.matches) >= t.count) targetsMet++;
            });
        });

        let vocabScore = 0;
        if (totalTargets > 0) {
            vocabScore = Math.round((targetsMet / totalTargets) * 40);
        }

        // 2. Length Score (0-30) — budget scales with prompts, so early compose
        // files (1-2 prompts) max out on shorter compositions and longer files
        // require more text. ~20 chars per prompt.
        const charCount = text.length;
        const promptCount = Math.max(1, allP.length);
        const lengthBudget = promptCount * 20;
        const lengthScore = Math.min(30, Math.round((charCount / lengthBudget) * 30));

        // 3. Grammar Score (0-30)
        const politePatterns = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう', 'です', 'でした'];
        const plainPatterns = ['だった', 'ない', 'なかった'];
        let politeCount = 0;
        let plainCount = 0;
        politePatterns.forEach(p => {
            let idx = 0;
            while ((idx = text.indexOf(p, idx)) !== -1) { politeCount++; idx += p.length; }
        });
        plainPatterns.forEach(p => {
            let idx = 0;
            while ((idx = text.indexOf(p, idx)) !== -1) { plainCount++; idx += p.length; }
        });
        const totalVerbs = politeCount + plainCount;
        let tenseComponent = 0;
        let tenseDetail = '';
        if (totalVerbs === 0) {
            tenseComponent = 13;
            tenseDetail = 'No verb forms detected';
        } else {
            const dominant = Math.max(politeCount, plainCount);
            tenseComponent = Math.round((dominant / totalVerbs) * 25);
            tenseDetail = politeCount >= plainCount
                ? `Polite: ${politeCount}/${totalVerbs}`
                : `Plain: ${plainCount}/${totalVerbs}`;
        }

        const trimmedText = text.trim();
        const sentenceFinals = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう', 'です', 'でした', 'だ', 'ね', 'よ', 'か'];
        const sentenceComplete = sentenceFinals.some(p =>
            trimmedText.endsWith(p) || trimmedText.endsWith(p + '。') ||
            trimmedText.endsWith(p + '！') || trimmedText.endsWith(p + '？')
        );
        const completionScore = sentenceComplete ? 5 : 0;

        const grammarScore = tenseComponent + completionScore;
        let grammarLabel = tenseDetail;
        if (completionScore > 0) grammarLabel += ' · Complete';

        const total = vocabScore + lengthScore + grammarScore;
        // Persist best score so the compose menu and home-page resume card can
        // reflect completion (≥75%) and the 100% sticker.
        try {
            if (window.JPShared && window.JPShared.progress && window.JPShared.progress.saveBestComposeScore) {
                window.JPShared.progress.saveBestComposeScore(compose.id, total);
            }
        } catch (e) {}
        let grade = ''; let gradeColor = '';
        if (total >= 85) { grade = 'S  Excellent!'; gradeColor = '#C7902F'; }
        else if (total >= 68) { grade = 'A  Great Work!'; gradeColor = '#5E8C5F'; }
        else if (total >= 50) { grade = 'B  Good Job!'; gradeColor = '#5E8C5F'; }
        else if (total >= 30) { grade = 'C  Keep Going!'; gradeColor = '#3498db'; }
        else { grade = 'D  Keep Practicing!'; gradeColor = '#78909C'; }

        const overlay = document.createElement('div');
        overlay.className = 'c-score-overlay';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
            <div class="c-score-card">
                <div class="c-score-label">YOUR SCORE</div>
                <div class="c-score-total">${total}<span style="font-size:1rem;color:#a4b0be">/100</span></div>
                <div class="c-score-grade" style="color:${gradeColor}">${grade}</div>
                <div class="c-score-breakdown">
                    <div class="c-score-row">
                        <div>
                            <div class="c-score-row-label">Vocabulary</div>
                            <div class="c-score-row-detail">${targetsMet}/${totalTargets} target words</div>
                            <div class="c-score-bar"><div class="c-score-bar-fill" style="width:${Math.round(vocabScore/40*100)}%;background:var(--c-primary)"></div></div>
                        </div>
                        <div class="c-score-row-pts">${vocabScore}/40</div>
                    </div>
                    <div class="c-score-row">
                        <div>
                            <div class="c-score-row-label">Length</div>
                            <div class="c-score-row-detail">${charCount} characters (1pt per 3)</div>
                            <div class="c-score-bar"><div class="c-score-bar-fill" style="width:${Math.round(lengthScore/30*100)}%;background:var(--c-success)"></div></div>
                        </div>
                        <div class="c-score-row-pts">${lengthScore}/30</div>
                    </div>
                    <div class="c-score-row">
                        <div>
                            <div class="c-score-row-label">Grammar</div>
                            <div class="c-score-row-detail">${grammarLabel}</div>
                            <div class="c-score-bar"><div class="c-score-bar-fill" style="width:${Math.round(grammarScore/30*100)}%;background:var(--c-gold)"></div></div>
                        </div>
                        <div class="c-score-row-pts">${grammarScore}/30</div>
                    </div>
                </div>
                <button class="c-btn" onclick="this.closest('.c-score-overlay').remove()" style="margin-top:8px;">Close</button>
            </div>
        `;
        document.getElementById('compose-app-root').appendChild(overlay);

        // Record streak activity on compose completion
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
    };

    // --- INIT & DATA FETCH ---
    (async function() {
        try {
            await new Promise(r => setTimeout(r, 50));
            const cacheBust = '?t=' + Date.now();

            // Load manifest
            const manifest = await window.getManifest(REPO_CONFIG);
            manifestData = manifest;
            const n5 = manifest.data.N5;
            const n4 = manifest.data.N4;

            // Build lesson metadata
            lessonMeta = new Map();
            [...n5.lessons, ...n4.lessons].forEach(l => lessonMeta.set(l.id, { title: l.title }));

            // Collect compose file paths and metadata from both levels
            const composePaths = [];
            const composeEntryMeta = [];
            [n5, n4].forEach((levelData, idx) => {
                const levelName = ['N5', 'N4'][idx];
                if (Array.isArray(levelData.compose)) {
                    levelData.compose.forEach(entry => {
                        const file = typeof entry === 'string' ? entry : entry.file;
                        composePaths.push(file);
                        composeEntryMeta.push({ unlocksAfter: entry.unlocksAfter, level: levelName });
                    });
                }
            });

            // Fetch glossaries, particles, conjugation rules, and all compose files in parallel
            const [n5Glossary, n4Glossary, particleData, conjData, ...composeResults] = await Promise.all([
                fetch(window.getAssetUrl(REPO_CONFIG, n5.glossary) + cacheBust).then(r => r.json()),
                fetch(window.getAssetUrl(REPO_CONFIG, n4.glossary) + cacheBust).then(r => r.json()),
                fetch(window.getAssetUrl(REPO_CONFIG, manifest.shared.particles) + cacheBust).then(r => r.json()),
                fetch(window.getAssetUrl(REPO_CONFIG, manifest.globalFiles.conjugationRules) + cacheBust).then(r => r.json()),
                ...composePaths.map(p => fetch(window.getAssetUrl(REPO_CONFIG, p) + cacheBust).then(r => r.json()))
            ]);

            // Build vocab lookup
            vocabById = new Map();
            [...n5Glossary.entries, ...n4Glossary.entries].forEach(e => vocabById.set(e.id, e));

            // Build particle lookup
            particlesById = new Map();
            (particleData.particles || []).forEach(p => particlesById.set(p.id, p));

            // Store conjugation rules (strip contentVersion key)
            conjugationRules = {};
            Object.keys(conjData).forEach(k => {
                if (k !== 'contentVersion') conjugationRules[k] = conjData[k];
            });

            // Store compose files, merging unlocksAfter and level from manifest metadata
            COMPOSE_FILES = composeResults.map((cf, i) => ({
                ...cf,
                unlocksAfter: cf.unlocksAfter || composeEntryMeta[i].unlocksAfter,
                level: cf.level || composeEntryMeta[i].level
            }));

            const loader = document.getElementById('c-loader');
            if (loader) loader.classList.add('c-hidden');

            ComposeApp.showMenu();
        } catch(e) {
            console.error(e);
            const errBox = document.getElementById('c-error-box');
            if (errBox) {
                errBox.innerText = 'Error: ' + (e.message || 'Unknown error');
                errBox.classList.remove('c-hidden');
            }
        }
    })();
  }
};
