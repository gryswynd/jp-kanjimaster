window.ComposeModule = {
  start: function(container, sharedConfig, exitCallback) {

    // --- NAMESPACE ---
    window.ComposeApp = {};

    // --- FONTS ---
    if (!document.getElementById('compose-fonts')) {
        const link = document.createElement('link');
        link.id = 'compose-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Poppins:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
    }

    // --- CSS ---
    if (!document.getElementById('jp-compose-style')) {
        const style = document.createElement('style');
        style.id = 'jp-compose-style';
        style.textContent = `
            #compose-app-root {
                --c-primary: #00897B; --c-primary-dark: #00695C;
                --c-primary-light: #e0f2f1;
                --c-bg-grad: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
                --c-text-main: #2f3542; --c-text-sub: #747d8c;
                --c-success: #2ed573; --c-error: #ff4757;
                --c-gold: #f39c12;

                font-family: 'Poppins', 'Noto Sans JP', sans-serif;
                background: var(--c-bg-grad); color: var(--c-text-main);
                display: flex; flex-direction: column;
                width: 100%; max-width: 600px; margin: 0 auto;
                height: 800px; border-radius: 20px;
                border: 1px solid rgba(0,0,0,0.05); overflow: hidden; position: relative;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            #compose-app-root * { box-sizing: border-box; }

            #compose-app-root header {
                background: rgba(0, 137, 123, 0.95); color: white; padding: 1.2rem;
                text-align: center; font-weight: 900; letter-spacing: 0.05em; font-size: 1.2rem;
                cursor: pointer; user-select: none; z-index: 10;
                box-shadow: 0 4px 15px rgba(0, 137, 123, 0.3); backdrop-filter: blur(5px);
                display: flex; justify-content: space-between; align-items: center;
            }
            .c-exit-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }

            #c-app-container { flex: 1; overflow-y: auto; padding: 1.2rem; display: flex; flex-direction: column; align-items: center; width: 100%; position: relative; z-index: 1; }
            .c-card { background: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); padding: 1.5rem; width: 100%; text-align: center; margin-bottom: 1rem; border: 1px solid rgba(0,0,0,0.02); }
            .c-btn { background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-dark) 100%); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; width: 100%; margin: 6px 0; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px rgba(0, 137, 123, 0.2); }
            .c-btn:active { transform: scale(0.98); }
            .c-btn-sec { background: white; color: var(--c-text-sub); border: 2px solid #dfe4ea; box-shadow: none; }
            .c-btn-sm { padding: 8px 14px; font-size: 0.85rem; width: auto; margin: 4px; display: inline-block; }
            .c-hidden { display: none !important; }
            .c-lbl { font-size: 0.8rem; text-transform: uppercase; color: #a4b0be; font-weight: 700; letter-spacing: 0.1em; margin-top: 8px; margin-bottom: 8px; }

            /* MENU — LESSON CARDS */
            .c-menu-card { background: white; border-radius: 14px; padding: 1.2rem; margin-bottom: 12px; border: 2px solid #e0f2f1; text-align: left; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 14px; }
            @media (hover: hover) { .c-menu-card:hover { border-color: var(--c-primary); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 137, 123, 0.1); } }
            .c-menu-emoji { font-size: 2rem; flex-shrink: 0; }
            .c-menu-info { flex: 1; min-width: 0; }
            .c-menu-title { font-weight: 800; font-size: 1rem; color: var(--c-primary-dark); }
            .c-menu-lesson { font-size: 0.78rem; font-weight: 700; color: var(--c-primary); background: var(--c-primary-light); padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 4px; }
            .c-menu-theme { font-size: 0.82rem; color: var(--c-text-sub); line-height: 1.4; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .c-menu-meta { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
            .c-menu-tag { font-size: 0.72rem; padding: 3px 8px; border-radius: 6px; font-weight: 700; }
            .c-menu-tag-count { background: #fff3e0; color: #e65100; }
            .c-menu-tag-done { background: #e8f5e9; color: #2e7d32; }
            .c-menu-tag-draft { background: #e3f2fd; color: #1565c0; }

            /* LEVEL PICKER */
            .c-level-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; }
            .c-level-card {
                background: white; padding: 28px 24px; border-radius: 20px; cursor: pointer;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
                border: 2px solid #e0f2f1; text-align: center;
            }
            @media (hover: hover) { .c-level-card:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0,137,123,0.15); border-color: var(--c-primary); } }
            .c-level-name { font-weight: 900; font-size: 1.4rem; color: var(--c-primary); margin-bottom: 6px; }
            .c-level-count { font-size: 0.85rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .c-level-back-btn { background: transparent; border: none; color: var(--c-primary); font-weight: 700; cursor: pointer; padding: 0 0 12px 0; font-size: 0.9rem; display: block; font-family: inherit; }
            @media (hover: hover) { .c-level-back-btn:hover { text-decoration: underline; } }
            .c-menu-empty { padding: 20px; text-align: center; color: #a4b0be; font-weight: 600; font-size: 0.9rem; }

            /* COMPOSE HEADER */
            .c-compose-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px 16px; background: white; border-radius: 14px; border: 2px solid #e0f2f1; }
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
            .c-timeline-challenge-tag { font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: #fff3e0; color: #e65100; font-weight: 800; margin-left: 4px; }

            /* ACTIVE PROMPT BANNER */
            .c-prompt-banner { background: linear-gradient(135deg, #e0f2f1, #b2dfdb); border-radius: 14px; padding: 1rem 1.2rem; margin-bottom: 12px; text-align: left; border-left: 5px solid var(--c-primary); }
            .c-prompt-banner-title { font-weight: 800; font-size: 1rem; color: var(--c-primary-dark); margin-bottom: 4px; }
            .c-prompt-banner-text { font-size: 0.92rem; color: #37474F; line-height: 1.5; font-weight: 600; }

            /* MODEL SENTENCE */
            .c-model-toggle { font-size: 0.8rem; color: var(--c-primary); cursor: pointer; font-weight: 700; margin-top: 8px; user-select: none; display: inline-block; }
            @media (hover: hover) { .c-model-toggle:hover { text-decoration: underline; } }
            .c-model-sentence { font-family: 'Noto Sans JP', sans-serif; font-size: 0.95rem; color: #546E7A; background: rgba(255,255,255,0.6); padding: 8px 12px; border-radius: 8px; margin-top: 6px; line-height: 1.6; display: none; }
            .c-model-sentence.visible { display: block; }

            /* PROGRESS BAR */
            .c-progress-wrap { width: 100%; margin-bottom: 12px; }
            .c-progress-bar-outer { width: 100%; height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden; }
            .c-progress-bar-inner { height: 100%; background: linear-gradient(90deg, var(--c-primary), var(--c-success)); border-radius: 5px; transition: width 0.4s ease; }
            .c-progress-text { display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--c-text-sub); margin-top: 4px; }

            /* TEXTAREA */
            .c-textarea { width: 100%; min-height: 120px; max-height: 200px; border: 2px solid #dfe4ea; border-radius: 12px; padding: 12px; font-size: 1.1rem; font-family: 'Noto Sans JP', 'Poppins', sans-serif; line-height: 1.8; resize: vertical; outline: none; transition: border-color 0.2s; color: var(--c-text-main); }
            .c-textarea:focus { border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(0, 137, 123, 0.1); }
            .c-textarea::placeholder { color: #b0bec5; font-size: 0.95rem; }
            .c-char-count { text-align: right; font-size: 0.75rem; color: #a4b0be; font-weight: 600; margin-top: 4px; }

            /* WORD TARGETS */
            .c-target-list { text-align: left; margin-bottom: 8px; }
            .c-target-item { display: flex; align-items: center; padding: 8px 10px; border-radius: 8px; margin-bottom: 4px; transition: all 0.3s; border: 1px solid #f1f2f6; }
            .c-target-item.done { background: #e8f5e9; border-color: #c8e6c9; }
            .c-target-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #dfe4ea; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 0.8rem; flex-shrink: 0; transition: all 0.3s; }
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
            .c-conj-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #f1f2f6; font-size: 0.85rem; }
            .c-conj-item:last-child { border-bottom: none; }
            .c-conj-label { font-weight: 700; color: var(--c-text-main); }
            .c-conj-desc { color: var(--c-text-sub); font-size: 0.78rem; }
            .c-conj-entry { padding: 10px 12px; border-bottom: 1px solid #f1f2f6; }
            .c-conj-entry:last-child { border-bottom: none; }
            .c-conj-pattern { font-weight: 800; font-size: 0.9rem; color: var(--c-primary-dark); }
            .c-conj-meaning { font-size: 0.78rem; color: var(--c-text-sub); margin-top: 2px; }
            .c-conj-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
            .c-conj-example { font-family: 'Noto Sans JP', sans-serif; font-size: 0.88rem; font-weight: 600; background: #f5f5f5; padding: 3px 10px; border-radius: 6px; color: var(--c-text-main); cursor: pointer; transition: background 0.15s; }
            @media (hover: hover) { .c-conj-example:hover { background: var(--c-primary-light); } }

            /* NEXT PROMPT BUTTON */
            .c-next-prompt-btn { background: linear-gradient(135deg, var(--c-success), #20bf6b); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-size: 1rem; font-weight: 800; width: 100%; margin: 10px 0; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(46, 213, 115, 0.3); animation: c-celebrate 0.4s ease; }
            @media (hover: hover) { .c-next-prompt-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(46, 213, 115, 0.4); } }
            .c-next-prompt-btn:active { transform: scale(0.98); }

            /* COMPLETE BANNER */
            .c-complete-banner { background: linear-gradient(135deg, #2ed573, #26de81); color: white; border-radius: 14px; padding: 1.2rem; text-align: center; margin-bottom: 12px; animation: c-celebrate 0.5s ease; }
            .c-complete-banner h3 { margin: 0 0 4px 0; font-size: 1.3rem; }
            .c-complete-banner p { margin: 0; font-size: 0.9rem; opacity: 0.9; }
            @keyframes c-celebrate { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }

            /* COVERAGE INDICATOR */
            .c-coverage { background: white; border-radius: 14px; padding: 1rem 1.2rem; margin-bottom: 12px; border: 2px solid #e0f2f1; text-align: center; }
            .c-coverage-title { font-weight: 800; font-size: 0.9rem; color: var(--c-primary-dark); margin-bottom: 8px; }
            .c-coverage-pct { font-size: 2.4rem; font-weight: 900; color: var(--c-primary); }
            .c-coverage-label { font-size: 0.78rem; color: var(--c-text-sub); font-weight: 600; }
            .c-coverage-bar { width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
            .c-coverage-fill { height: 100%; background: linear-gradient(90deg, var(--c-primary), var(--c-success)); border-radius: 4px; transition: width 0.6s ease; }

            /* ACTION BAR */
            .c-action-bar { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }

            /* SCORE BUTTON */
            .c-btn-score { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); box-shadow: 0 4px 6px rgba(243, 156, 18, 0.25); }

            /* SCORE OVERLAY */
            .c-score-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 40; display: flex; align-items: center; justify-content: center; animation: c-fade-in 0.2s ease; }
            @keyframes c-fade-in { from { opacity: 0; } to { opacity: 1; } }
            .c-score-card { background: white; border-radius: 20px; padding: 1.8rem 1.5rem; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2); animation: c-score-pop 0.35s ease; }
            @keyframes c-score-pop { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.03); } 100% { transform: scale(1); opacity: 1; } }
            .c-score-total { font-size: 3rem; font-weight: 900; color: var(--c-primary-dark); margin: 8px 0; }
            .c-score-label { font-size: 0.85rem; color: var(--c-text-sub); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
            .c-score-grade { font-size: 1.4rem; font-weight: 800; margin: 4px 0 12px 0; }
            .c-score-breakdown { text-align: left; margin: 12px 0; }
            .c-score-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #f1f2f6; }
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
            <div style="font-weight:800;color:#00897B;font-size:1.2rem">Loading Compositions...</div>
            <div id="c-error-box" class="c-hidden" style="color:#ff4757;margin-top:10px;padding:10px;max-width:80%;font-size:0.9rem"></div>
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
    if (window.JPShared.stampSettings) window.JPShared.stampSettings.setConfig(REPO_CONFIG);

    let COMPOSE_FILES = [];    // array of loaded compose file data
    let vocabById = new Map(); // all glossary+grammar entries by id
    let particlesById = new Map(); // all particles by id
    let conjugationRules = {}; // all conjugation rules
    let lessonMeta = new Map(); // lesson id -> { title }
    let allVocab = [];         // all vocab entries from glossaries

    // --- STATE ---
    let currentCompose = null;   // the active compose file data
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

    function resolveTargets(targets) {
        return (targets || []).map(t => {
            const entry = t.id ? vocabById.get(t.id) : null;
            const baseMatches = entry ? [entry.surface || entry.particle, entry.reading].filter(Boolean) : [];
            const root = getKanjiRoot(entry);
            if (root && !baseMatches.includes(root)) baseMatches.push(root);
            return {
                id: t.id,
                surface: (entry && (entry.surface || entry.particle)) || '',
                reading: (entry && entry.reading) || '',
                meaning: (entry && (entry.meaning || entry.role)) || '',
                count: t.count || 1,
                matches: t.matches || baseMatches
            };
        });
    }

    function resolveVocabPool(poolIds) {
        return (poolIds || []).map(id => vocabById.get(id) || particlesById.get(id)).filter(Boolean).map(e => ({
            id: e.id,
            surface: e.surface || e.particle || '',
            reading: e.reading || '',
            meaning: e.meaning || e.role || ''
        }));
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

    // Check if a string contains at least one kanji character (CJK Unified Ideographs)
    function containsKanji(str) {
        return /[\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
    }

    // Compute vocab coverage: what % of kanji-containing lesson vocab the student used
    function computeCoverage(compose, text) {
        const lessonId = compose.lesson;
        const lessonVocab = allVocab.filter(v => {
            const lessons = (v.lesson_ids || v.lesson || '').split(',').map(s => s.trim());
            return lessons.includes(lessonId);
        });
        // Only count vocab with kanji in the surface form, deduplicated
        const seen = new Set();
        const unique = lessonVocab.filter(v => {
            if (v.id && v.id.includes('__')) return false;
            const s = v.surface || '';
            if (!s || seen.has(s)) return false;
            if (!containsKanji(s)) return false;
            seen.add(s);
            return true;
        });
        let used = 0;
        const usedWords = [];
        unique.forEach(v => {
            const surface = v.surface || '';
            if (surface && text.includes(surface)) {
                used++;
                usedWords.push(surface);
            }
        });
        return { total: unique.length, used, pct: unique.length > 0 ? Math.round((used / unique.length) * 100) : 0, usedWords };
    }

    // --- MENU VIEW ---
    ComposeApp.showMenu = function() {
        currentCompose = null;
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
    };

    // --- LEVEL VIEW ---
    ComposeApp._showLevel = function(level) {
        const byLevel = ComposeApp._byLevel || {};
        const files = byLevel[level] || [];
        const menuEl = document.getElementById('c-view-menu');
        if (!menuEl) return;

        const allLevels = ['N5', 'N4'].filter(l => byLevel[l] && byLevel[l].length);
        let html = '';
        if (allLevels.length > 1) {
            html += `<button class="c-level-back-btn" id="c-back-to-levels">← Levels</button>`;
        }

        files.forEach(cf => {
            const totalPrompts = (cf.prompts || []).length + (cf.challengePrompts || []).length;
            const draftState = loadDraftState(cf);

            let statusTag = '';
            if (draftState.text) {
                const total = getAllPrompts(cf).length;
                if (draftState.promptIndex >= total) {
                    statusTag = '<span class="c-menu-tag c-menu-tag-done">Complete</span>';
                } else {
                    statusTag = '<span class="c-menu-tag c-menu-tag-draft">Draft saved</span>';
                }
            }

            html += `
                <div class="c-menu-card" onclick="ComposeApp.startCompose('${escHtml(cf.id)}')">
                    <div class="c-menu-emoji">${cf.emoji || '✏️'}</div>
                    <div class="c-menu-info">
                        <div class="c-menu-title">${escHtml(cf.title)}</div>
                        <span class="c-menu-lesson">${escHtml(cf.lesson)}</span>
                        <div class="c-menu-theme">${escHtml(cf.theme || '')}</div>
                        <div class="c-menu-meta">
                            <span class="c-menu-tag c-menu-tag-count">${totalPrompts} prompt${totalPrompts !== 1 ? 's' : ''}</span>
                            ${statusTag}
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
    };

    // --- COMPOSE VIEW ---
    ComposeApp.startCompose = function(composeId) {
        const compose = COMPOSE_FILES.find(cf => cf.id === composeId);
        if (!compose) return;
        currentCompose = compose;

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
        const compose = currentCompose;
        if (!compose) return;

        const compEl = document.getElementById('c-view-compose');
        if (!compEl) return;

        const allP = getAllPrompts(compose);
        const regularCount = (compose.prompts || []).length;
        const totalPrompts = allP.length;

        // Build active prompt banner and targets
        let promptBannerHtml = '';
        let targetHtml = '';
        if (activePromptIndex < totalPrompts) {
            const activeP = allP[activePromptIndex];
            const isChallenge = activePromptIndex >= regularCount;
            const resolvedTargets = resolveTargets(activeP.targets);

            promptBannerHtml = `
                <div class="c-prompt-banner">
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
                    <span class="c-target-surface" onclick="ComposeApp.insertWord('${escHtml(t.surface)}')" title="Click to insert">${escHtml(t.surface)}</span>
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
                    <span class="c-chip-jp">${escHtml(v.surface)}</span>
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
            particleRefHtml += `<span class="c-ref-item" onclick="ComposeApp.insertWord('${escHtml(surface)}')">
                <span class="c-ref-jp">${escHtml(surface)}</span>
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
                `<span class="c-conj-example" onclick="ComposeApp.insertWord('${escHtml(ex)}')">${escHtml(ex)}</span>`
            ).join('');
            conjRefHtml += `<div class="c-conj-entry">
                <div class="c-conj-pattern">${escHtml(entry.pattern)}</div>
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
                <div class="c-char-count" id="c-char-count">${(draftText || '').length} characters</div>
                <div class="c-action-bar">
                    <button class="c-btn c-btn-sm c-btn-score" onclick="ComposeApp.showScore()" title="Score your composition">Score</button>
                    <button class="c-btn c-btn-sm c-btn-sec" onclick="ComposeApp.speakComposition()" title="Listen to your composition">Listen</button>
                    <button class="c-btn c-btn-sm c-btn-sec" onclick="ComposeApp.clearDraft()" title="Clear composition">Clear</button>
                </div>
            </div>

            <button id="c-next-prompt-btn" class="c-next-prompt-btn c-hidden" onclick="ComposeApp.nextPrompt()">Next Prompt &#x2192;</button>

            ${targetHtml ? `
            <div class="c-section" style="margin-top:8px;">
                <div class="c-section-hdr open" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Target Words</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body open">
                    <div class="c-target-list" id="c-target-list">${targetHtml}</div>
                </div>
            </div>` : ''}

            ${vocabPoolHtml ? `
            <div class="c-section">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Word Bank</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    <div class="c-chip-wrap" id="c-vocab-pool">${vocabPoolHtml}</div>
                </div>
            </div>` : ''}

            ${particleRefHtml ? `
            <div class="c-section">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Particles & Copula</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    <div class="c-ref-list">${particleRefHtml}</div>
                </div>
            </div>` : ''}

            ${conjRefHtml ? `
            <div class="c-section">
                <div class="c-section-hdr" onclick="ComposeApp.toggleSection(this)">
                    <span class="c-section-title">Conjugation Patterns</span>
                    <span class="c-section-arrow">▼</span>
                </div>
                <div class="c-section-body">
                    ${conjRefHtml}
                </div>
            </div>` : ''}

            <div id="c-coverage-box" class="c-hidden"></div>

            <button class="c-btn c-btn-sec" onclick="ComposeApp.showMenu()" style="margin-top:10px;border:none;color:#a4b0be;font-size:0.9rem">Back to Menu</button>
        `;

        // Setup input listener
        const input = document.getElementById('c-compose-input');
        if (input) {
            input.addEventListener('input', function() {
                ComposeApp.updateTracking();
                saveDraftState();
                const cc = document.getElementById('c-char-count');
                if (cc) cc.textContent = input.value.length + ' characters';
            });
            // Initial tracking if there's a draft
            if (draftText) {
                setTimeout(() => ComposeApp.updateTracking(), 100);
            }
        }
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

        // Vocab coverage (shown when all prompts are complete)
        const coverageBox = document.getElementById('c-coverage-box');
        if (coverageBox) {
            if (allPromptsComplete && text.length > 0) {
                const cov = computeCoverage(compose, text);
                coverageBox.className = 'c-coverage';
                coverageBox.innerHTML = `
                    <div class="c-coverage-title">Kanji Vocabulary Coverage</div>
                    <div class="c-coverage-pct">${cov.pct}%</div>
                    <div class="c-coverage-label">${cov.used} of ${cov.total} kanji words used</div>
                    <div class="c-coverage-bar"><div class="c-coverage-fill" style="width:${cov.pct}%"></div></div>`;
            } else {
                coverageBox.className = 'c-hidden';
                coverageBox.innerHTML = '';
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
        const targetSurfaces = new Set();
        allP.forEach(p => {
            const targets = resolveTargets(p.targets);
            totalTargets += targets.length;
            targets.forEach(t => {
                if (countOccurrences(text, t.matches) >= t.count) targetsMet++;
                if (t.surface) targetSurfaces.add(t.surface);
            });
        });

        // Additional lesson vocab
        const cov = computeCoverage(compose, text);
        const additionalVocabUsed = Math.max(0, cov.used - targetSurfaces.size);

        let vocabScore = 0;
        if (totalTargets > 0) {
            vocabScore = Math.round((targetsMet / totalTargets) * 40);
        }

        // 2. Length Score (0-30)
        const charCount = text.length;
        const lengthScore = Math.min(30, Math.floor(charCount / 3));

        // 3. Grammar Score (0-30)
        const politePatterns = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう', 'ですか', 'でした'];
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
            tenseComponent = 8;
            tenseDetail = 'No verb forms detected';
        } else {
            const dominant = Math.max(politeCount, plainCount);
            tenseComponent = Math.round((dominant / totalVerbs) * 15);
            tenseDetail = politeCount >= plainCount
                ? `Polite: ${politeCount}/${totalVerbs}`
                : `Plain: ${plainCount}/${totalVerbs}`;
        }

        const coreParticles = ['は', 'が', 'を', 'に'];
        const particlesFound = coreParticles.filter(p => text.includes(p));
        const particleScore = Math.round((particlesFound.length / coreParticles.length) * 10);

        const trimmedText = text.trim();
        const sentenceFinals = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう', 'です', 'でした', 'だ', 'ね', 'よ', 'か'];
        const sentenceComplete = sentenceFinals.some(p =>
            trimmedText.endsWith(p) || trimmedText.endsWith(p + '。') ||
            trimmedText.endsWith(p + '！') || trimmedText.endsWith(p + '？')
        );
        const completionScore = sentenceComplete ? 5 : 0;

        const grammarScore = tenseComponent + particleScore + completionScore;
        let grammarLabel = tenseDetail + ` · ${particlesFound.length}/4 particles`;
        if (completionScore > 0) grammarLabel += ' · Complete';

        const total = vocabScore + lengthScore + grammarScore;
        let grade = ''; let gradeColor = '';
        if (total >= 85) { grade = 'S  Excellent!'; gradeColor = '#f39c12'; }
        else if (total >= 68) { grade = 'A  Great Work!'; gradeColor = '#2ed573'; }
        else if (total >= 50) { grade = 'B  Good Job!'; gradeColor = '#00897B'; }
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
                            <div class="c-score-row-detail">${targetsMet}/${totalTargets} targets · ${cov.used}/${cov.total} kanji words (${cov.pct}%)</div>
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
            allVocab = [
                ...n5Glossary.entries.filter(i => i.type === 'vocab' || i.type === 'grammar' || i.type === 'phrase'),
                ...n4Glossary.entries.filter(i => i.type === 'vocab' || i.type === 'grammar' || i.type === 'phrase')
            ];
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
