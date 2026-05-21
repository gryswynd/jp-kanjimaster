window.GrammarModule = {
  start: function (container, sharedConfig, exitCallback) {

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
    let grammarId = null;
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
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Poppins:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }

    // --- Styles ---
    if (!document.getElementById('jp-grammar-style')) {
      const style = document.createElement('style');
      style.id = 'jp-grammar-style';
      style.textContent = `
        #jp-grammar-app-root {
          --gr-primary: #16A34A;
          --gr-primary-dark: #15803D;
          --gr-bg: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
          --text-main: #2f3542; --text-sub: #747d8c;
          font-family: 'Poppins', 'Noto Sans JP', sans-serif;
          background: var(--gr-bg); color: var(--text-main);
          display: flex; flex-direction: column;
          width: 100%; max-width: 600px; margin: 0 auto;
          height: 800px; border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.05); overflow: hidden; position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        #jp-grammar-app-root * { box-sizing: border-box; }

        .gr-header {
          background: linear-gradient(135deg, #16A34A, #15803D);
          padding: 1.2rem; color: white; border-bottom: none;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 4px 15px rgba(22,163,74,0.35); z-index: 10;
        }
        .gr-title { font-weight: 900; font-size: 1.1rem; color: white; }
        .gr-progress-container { height: 6px; width: 100%; background: rgba(0,0,0,0.1); }
        .gr-progress-bar { height: 100%; background: #2ed573; width: 0%; transition: width 0.3s ease; }
        .gr-body { padding: 1.5rem; flex: 1; overflow-y: auto; background: transparent; display: flex; flex-direction: column; }
        .gr-footer {
          padding: 15px 20px; background: white; border-top: 1px solid rgba(0,0,0,0.05);
          display: flex; gap: 10px; justify-content: space-between;
          box-shadow: 0 -5px 15px rgba(0,0,0,0.03); z-index: 10;
        }
        .gr-nav-btn {
          padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; cursor: pointer;
          font-size: 0.95rem; transition: transform 0.1s;
        }
        .gr-nav-btn:active { transform: scale(0.96); }
        .gr-nav-btn.prev { background: #f1f2f6; color: #747d8c; }
        .gr-nav-btn.next { background: linear-gradient(135deg, #16A34A, #15803D); color: #fff; box-shadow: 0 4px 10px rgba(22,163,74,0.3); }
        .gr-nav-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .gr-exit-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }
        .gr-back-btn { background: transparent; color: rgba(255,255,255,0.8); border: none; cursor: pointer; font-weight: bold; font-size: 0.9rem; margin-right: 10px; }
        @media (hover: hover) { .gr-back-btn:hover { color: white; } }

        .gr-card { background: #F0FDF4; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(22,163,74,0.08); }
        .gr-card-white { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.02); }

        /* Menu */
        .gr-menu-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .gr-menu-item {
          background: #fff; padding: 18px 20px; border-radius: 16px; cursor: pointer;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
          border: 1px solid rgba(0,0,0,0.02); text-align: left;
          display: flex; justify-content: space-between; align-items: center;
        }
        @media (hover: hover) { .gr-menu-item:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(22,163,74,0.15); border-color: var(--gr-primary); } }
        .gr-menu-item.locked { opacity: 0.55; cursor: default; }
        @media (hover: hover) { .gr-menu-item.locked:hover { transform: none; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-color: transparent; } }
        .gr-menu-icon { font-size: 1.5rem; margin-right: 12px; }
        .gr-menu-id { font-weight: 900; color: #16A34A; font-size: 1rem; }
        .gr-menu-name { font-size: 0.8rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .gr-menu-badge { font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
        .gr-menu-badge.lock { background: #f1f2f6; color: #999; }
        .gr-menu-level-header { font-size: 1.1rem; font-weight: 900; color: #16A34A; padding: 8px 0 4px; letter-spacing: 1px; }
        .gr-menu-stamp { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .gr-menu-stamp img { width: 100%; height: 100%; object-fit: contain; opacity: 0.85; }
        @keyframes grStampPop { 0% { transform: scale(2) rotate(0deg); opacity: 0; } 60% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 0.85; } }
        .gr-menu-stamp img { animation: grStampPop 0.3s ease; }
        .gr-menu-right { display: flex; align-items: center; gap: 8px; }
        .gr-menu-score { font-size: 0.75rem; font-weight: 700; color: #16A34A; }

        /* Intro section */
        .gr-intro-card { text-align: center; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; }
        .gr-intro-icon { font-size: 3.5rem; margin-bottom: 10px; }
        .gr-intro-title { font-size: 1.4rem; font-weight: 900; color: #2f3542; margin-bottom: 12px; }
        .gr-intro-summary { font-size: 1rem; color: #555; margin-bottom: 16px; line-height: 1.6; }
        .gr-why-box { background: #DCFCE7; border-left: 4px solid #16A34A; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; text-align: left; width: 100%; font-size: 0.9rem; color: #555; }
        .gr-learn-list { text-align: left; width: 100%; }
        .gr-learn-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.9rem; color: #444; }
        .gr-learn-check { color: #16A34A; font-size: 0.9rem; flex-shrink: 0; margin-top: 1px; }

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
        .gr-notes-list li::before { content: "•"; position: absolute; left: 0; color: #16A34A; }

        /* Examples */
        .gr-example-card { background: white; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.06); }
        .gr-example-sentence { font-size: 1.1rem; font-family: 'Noto Sans JP', sans-serif; line-height: 1.8; margin-bottom: 6px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px; }
        .gr-example-en { font-size: 0.85rem; color: #747d8c; margin-bottom: 6px; }
        .gr-breakdown-toggle { font-size: 0.75rem; color: #aaa; cursor: pointer; border: none; background: none; padding: 0; text-decoration: underline; }
        .gr-breakdown-text { font-size: 0.8rem; color: #888; margin-top: 4px; font-style: italic; }
        .gr-tts-btn { font-size: 0.8rem; background: none; border: 1px solid #ddd; border-radius: 6px; padding: 3px 8px; cursor: pointer; color: #888; margin-top: 4px; }
        @media (hover: hover) { .gr-tts-btn:hover { background: #f8f9fa; } }

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
        .gr-table th { background: #DCFCE7; color: #16A34A; font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 2px solid #16A34A; white-space: nowrap; }
        .gr-table td { padding: 9px 12px; border-bottom: 1px solid #f1f2f6; vertical-align: top; font-family: 'Noto Sans JP', sans-serif; }
        .gr-table tr:last-child td { border-bottom: none; }
        @media (hover: hover) { .gr-table tr:hover td { background: #F0FDF4; } }
        .gr-table-label { font-family: 'Poppins', sans-serif; font-weight: 600; color: #555; white-space: nowrap; }
        .gr-table-meaning { font-family: 'Poppins', sans-serif; color: #888; font-style: italic; }
        .gr-cell-stem { background: rgba(0,184,148,0.2); border-radius: 2px; }
        .gr-cell-ending { background: rgba(214,48,49,0.2); border-radius: 2px; }
        .gr-notes-box { background: #f8f9fa; border-radius: 8px; padding: 12px 14px; margin-top: 10px; font-size: 0.82rem; color: #666; }
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
        .gr-ae-context { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; background: #DCFCE7; color: #16A34A; margin-bottom: 8px; }
        .gr-ae-note { font-size: 0.8rem; color: #888; margin-top: 6px; font-style: italic; }

        /* Drills (shared with lesson style) */
        .gr-drill-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.02); }
        .gr-drill-q { font-size: 1.05rem; line-height: 1.6; font-family: 'Noto Sans JP', sans-serif; font-weight: bold; margin-bottom: 15px; color: #2f3542; }
        .gr-mcq-opt { display: block; width: 100%; text-align: left; padding: 12px 15px; margin-bottom: 8px; background: #fff; border: 2px solid #eee; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 0.95rem; color: #2f3542; transition: 0.2s; }
        @media (hover: hover) { .gr-mcq-opt:hover { border-color: #16A34A; background: #F0FDF4; } }
        .gr-mcq-opt.correct { background: #d4edda; border-color: #c3e6cb; color: #155724; }
        .gr-mcq-opt.wrong { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .gr-explanation { font-size: 0.82rem; color: #666; margin-top: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 8px; display: none; }
        .gr-explanation.visible { display: block; }

        /* Interactive drills */
        .gr-score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .gr-score-text { font-size: 0.85rem; font-weight: 700; color: #555; white-space: nowrap; }
        .gr-score-bar-wrap { flex: 1; height: 8px; background: #f1f2f6; border-radius: 4px; overflow: hidden; }
        .gr-score-bar-fill { height: 100%; background: linear-gradient(90deg, #16A34A, #15803D); border-radius: 4px; transition: width 0.4s ease; }

        .gr-drill-item { text-align: center; }
        .gr-verb-display { font-size: 2rem; font-weight: 900; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; margin-bottom: 6px; }
        .gr-verb-reading { font-size: 0.9rem; color: #888; margin-bottom: 10px; }
        .gr-verb-type-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 10px; }
        .gr-type-ru { background: #d1ecf1; color: #0c5460; }
        .gr-type-u { background: #d4edda; color: #155724; }
        .gr-type-irr { background: #fff3cd; color: #856404; }
        .gr-type-iadj { background: #fce4ec; color: #880e4f; }
        .gr-type-naadj { background: #e8eaf6; color: #283593; }
        .gr-type-copula { background: #f3e5f5; color: #6a1b9a; }
        .gr-transform-arrow { font-size: 1.5rem; color: #16A34A; margin: 10px 0; }
        .gr-target-label { font-size: 0.85rem; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 16px; }
        .gr-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .gr-choice-chip {
          padding: 12px 10px; border-radius: 12px; border: 2px solid #eee; background: white;
          cursor: pointer; font-family: 'Noto Sans JP', sans-serif; font-size: 1rem; font-weight: 600;
          text-align: center; transition: 0.18s; color: #2f3542;
        }
        @media (hover: hover) { .gr-choice-chip:hover { border-color: #16A34A; background: #F0FDF4; } }
        .gr-choice-chip.correct { background: #d4edda; border-color: #c3e6cb; color: #155724; }
        .gr-choice-chip.wrong { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .gr-hint-text { font-size: 0.82rem; color: #666; margin-top: 10px; padding: 8px 12px; background: #f8f9fa; border-radius: 8px; }
        .gr-next-btn { display: block; margin: 14px auto 0; padding: 10px 28px; border-radius: 20px; border: none; background: #16A34A; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; transition: 0.18s; }
        @media (hover: hover) { .gr-next-btn:hover { background: #15803d; } }

        /* Fill slot */
        .gr-slot-sentence { font-size: 1.2rem; font-family: 'Noto Sans JP', sans-serif; line-height: 2; text-align: center; margin: 16px 0; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; }
        .gr-slot-blank { display: inline-block; min-width: 50px; height: 36px; border: 2px solid #FDCB6E; border-radius: 8px; padding: 4px 12px; text-align: center; background: #FFFDE7; font-size: 1.1rem; font-weight: 700; color: #333; transition: 0.2s; vertical-align: middle; line-height: 26px; }
        .gr-slot-blank.filled-correct { border-color: #00B894; background: #d4edda; color: #155724; }
        .gr-slot-blank.filled-wrong { border-color: #D63031; background: #f8d7da; color: #721c24; }
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
        .gr-pm-btn.correct-choice { background: #d4edda; border-color: #00B894; color: #155724; }
        .gr-pm-btn.wrong-choice { background: #f8d7da; border-color: #D63031; color: #721c24; }
        .gr-pm-explanation { font-size: 0.8rem; color: #666; margin-top: 8px; padding: 6px 10px; background: #f8f9fa; border-radius: 6px; }

        /* Sentence transform */
        .gr-st-from { background: white; border-radius: 10px; padding: 14px; border: 2px solid #eee; margin-bottom: 10px; }
        .gr-st-to { background: #F0FDF4; border-radius: 10px; padding: 14px; border: 2px dashed #16A34A; min-height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .gr-st-label { font-size: 0.72rem; font-weight: 700; color: #16A34A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .gr-st-sentence { font-size: 1.05rem; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; }
        .gr-st-arrow { text-align: center; font-size: 1.5rem; color: #16A34A; margin: 6px 0; }

        /* Conversation (grammar context) */
        .gr-conv-toggle { font-size: 0.75rem; font-weight: 700; color: #747d8c; background: #fff; border: 2px solid #f1f2f6; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-bottom: 20px; width: 100%; }
        .gr-conv-row { display: flex; gap: 12px; margin-bottom: 20px; align-items: flex-start; }
        .gr-speaker-bubble { background: #DCFCE7; color: #16A34A; font-weight: 900; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-family: 'Noto Sans JP', sans-serif; font-size: 0.75rem; }
        .gr-jp { font-size: 1.15rem; line-height: 1.6; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; }
        .gr-en { font-size: 0.9rem; color: #747d8c; margin-top: 6px; }
        .gr-term { color: #16A34A; font-weight: 700; cursor: pointer; margin-right: 1px; border-bottom: 2px solid rgba(22,163,74,0.2); transition: 0.2s; }
        @media (hover: hover) { .gr-term:hover { background: rgba(22,163,74,0.06); border-bottom-color: #16A34A; } }

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
        .gr-rule-explanation strong { color: #16A34A; }
        .gr-rule-explanation del { color: #D63031; text-decoration: line-through; opacity: 0.8; }
        .gr-md-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.82rem; }
        .gr-md-table th { background: #DCFCE7; color: #15803D; font-weight: 700; padding: 6px 10px; border: 1px solid #BBF7D0; text-align: left; }
        .gr-md-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
        .gr-md-table tr:nth-child(even) td { background: #F0FDF4; }

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
        html += '>' + esc(part.text) + '</span>';
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
          itemDiv.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:1.4rem;font-weight:900;color:#16A34A;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Conjugation complete!</div></div>';
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

    function renderPatternMatch(sec) {
      const div = el('div', '');
      // Title and instructions display
      const patternBox = el('div', 'gr-card');
      patternBox.innerHTML = '<div style="font-size:1rem;font-weight:700;color:#333;margin-bottom:8px;">' + esc(sec.title) + '</div><div style="font-size:0.9rem;color:#555;">' + esc(sec.instructions) + '</div>';
      div.appendChild(patternBox);

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

        const makeBtn = (label, isCorrectChoice) => {
          const btn = el('button', 'gr-pm-btn', label);
          btn.onclick = () => {
            if (answered) return;
            answered = true; total++;
            expEl.style.display = 'block';
            if (isCorrectChoice === item.answer) {
              correct++;
              btn.classList.add('correct-choice');
              card.classList.add('answered-correct');
            } else {
              btn.classList.add('wrong-choice');
              card.classList.add('answered-wrong');
              btns.querySelectorAll('.gr-pm-btn').forEach(b => {
                if ((b.textContent === '✓') === item.answer) b.classList.add('correct-choice');
              });
            }
            scoreText.textContent = total + ' / ' + (sec.items || []).length;
            barFill.style.width = (total / (sec.items || []).length * 100) + '%';
          };
          return btn;
        };
        btns.appendChild(makeBtn('✓', true));
        btns.appendChild(makeBtn('✗', false));

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
          itemDiv.innerHTML = '<div style="text-align:center;padding:16px;"><div style="font-size:1.4rem;font-weight:900;color:#16A34A;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Transform practice complete!</div></div>';
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

        const choices = el('div', 'gr-choices');
        const shuffled = [...(item.choices || [])].sort(() => Math.random() - 0.5);
        let solved = false;
        shuffled.forEach(ch => {
          const btn = el('button', 'gr-choice-chip', esc(ch));
          btn.onclick = () => {
            if (solved) return;
            if (ch === item.answer) {
              btn.classList.add('correct');
              if (!solved) { correct++; answered++; solved = true; }
              toBox.innerHTML = '<div style="text-align:center;"><div class="gr-st-label" style="color:#00B894;">' + esc(item.targetLabel) + '</div><div class="gr-st-sentence" style="color:#155724;">' + esc(item.answer) + '</div></div>';
              const tts2 = el('button', 'gr-tts-btn', '🔊'); tts2.onclick = () => speakText(item.answer); toBox.appendChild(tts2);
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
          itemDiv.innerHTML = '<div style="text-align:center;padding:16px;"><div style="font-size:1.4rem;font-weight:900;color:#16A34A;">' + pct + '%</div><div style="color:#888;margin-top:8px;">Fill-slot practice complete!</div></div>';
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
        (item.choices || []).forEach(ch => {
          const chip = el('button', 'gr-slot-chip', esc(ch));
          chip.onclick = () => {
            if (solved) return;
            solved = true;
            blank.textContent = ch;
            const fullSentence = (item.before || '') + ch + (item.after || '');
            var isCorrect = ch === item.answer || (item.also_accept && item.also_accept.includes(ch));
            if (isCorrect) {
              correct++; answered++;
              blank.classList.add('filled-correct');
            } else {
              answered++;
              blank.classList.add('filled-wrong');
              chipsRow.querySelectorAll('.gr-slot-chip').forEach(c => {
                if (c.textContent === item.answer) { c.style.borderColor = '#00B894'; c.style.background = '#d4edda'; }
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

    function renderConversation(sec) {
      const div = el('div', '');
      const toggle = el('button', 'gr-conv-toggle', showEN ? 'Hide English Translation' : 'Show English Translation');
      toggle.onclick = () => { showEN = !showEN; renderCurrentStep(); };
      div.appendChild(toggle);
      (sec.lines || []).forEach(line => {
        const row = el('div', 'gr-conv-row');
        const bubble = el('div', 'gr-speaker-bubble', esc(line.spk));
        const content = el('div', '');
        content.style.flex = '1';
        const jp = el('div', 'gr-jp');
        jp.innerHTML = window.JPShared.textProcessor.processText(line.jp, line.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES);
        // Apply grammar color highlights to focus particles/forms (DOM-based — never mutate innerHTML after processText)
        const particles = (grammarData.meta && grammarData.meta.particles) || [];
        if (particles.length) {
          const hlStyle = 'background:' + GRAMMAR_COLORS.particle + '40;border-bottom:2px solid ' + GRAMMAR_COLORS.particle + ';border-radius:2px;padding:0 2px;';
          // Style existing .jp-term spans that match a focus particle
          jp.querySelectorAll('.jp-term').forEach(span => {
            if (particles.some(p => span.textContent === p)) {
              span.setAttribute('style', (span.getAttribute('style') || '') + ';' + hlStyle);
            }
          });
          // Highlight any remaining bare text occurrences (untagged particles) via TreeWalker
          const walker = document.createTreeWalker(jp, NodeFilter.SHOW_TEXT, null, false);
          const textNodes = [];
          let tn;
          while ((tn = walker.nextNode())) textNodes.push(tn);
          textNodes.forEach(textNode => {
            if (!textNode.parentNode) return;
            particles.forEach(p => {
              if (!textNode.parentNode) return; // re-check: prior particle may have detached this node
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
        content.appendChild(jp);
        const enDiv = el('div', 'gr-en', esc(line.en));
        enDiv.style.display = showEN ? 'block' : 'none';
        content.appendChild(enDiv);
        const tts = el('button', 'gr-tts-btn', '🔊'); tts.onclick = () => speakText(line.jp);
        content.appendChild(tts);
        row.appendChild(bubble);
        row.appendChild(content);
        div.appendChild(row);
      });
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
      const body = root.querySelector('.gr-body');
      const title = root.querySelector('.gr-title');
      const bar = root.querySelector('.gr-progress-bar');
      const nextBtn = root.querySelector('.gr-nav-btn.next');
      const prevBtn = root.querySelector('.gr-nav-btn.prev');

      body.innerHTML = '';
      bar.style.width = (((currentStep + 1) / totalSteps) * 100) + '%';

      if (currentStep >= grammarData.sections.length) {
        title.innerText = 'Complete!';

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
              const barColor = ePct >= 80 ? '#16A34A' : ePct >= 50 ? '#F59E0B' : '#EF4444';
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
              ${newItems.map(item => `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:6px 12px;font-size:0.85rem;font-weight:700;color:#15803d;">${item.icon} ${item.label}</div>`).join('')}
            </div>
          </div>` : '';

        body.innerHTML = `
          <div class="gr-card" style="text-align:center; position:relative; padding:30px 20px;">
            <h2 style="margin-bottom:15px;">🌿 Grammar Lesson Complete!</h2>
            ${combinedTotal > 0 ? `
            <div style="font-size:0.8rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Drill Score</div>
            <div style="font-size:3rem;font-weight:900;color:${rank.colors[0]};line-height:1.1;">${rank.msg}</div>
            <div style="font-size:1rem;color:#747d8c;font-weight:600;margin:6px 0 14px;">${rank.sub}</div>
            <div style="font-size:2.2rem;font-weight:900;color:#16A34A;">${pct}%</div>
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
        else if (sec.type === 'patternMatch')        content = renderPatternMatch(sec);
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
    }

    // ──────────────────────────────────────────────
    // LOAD & NAVIGATION
    // ──────────────────────────────────────────────

    async function loadGrammarLesson(file, id) {
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
        const url = getCdnUrl(file);
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

    function renderMenu() {
      root.innerHTML = `
        <div class="gr-header">
          <div class="gr-title">🌿 Grammar Garden</div>
          <div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="gr-exit-btn">Exit</button></div>
        </div>
        <div class="gr-body">
          <div style="font-size:0.8rem;color:#888;margin-bottom:16px;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Grammar Lessons</div>
          <div class="gr-menu-grid" id="gr-menu-container"></div>
        </div>`;
      root.querySelector('.gr-exit-btn').onclick = exitCallback;
      const menuEl = document.getElementById('gr-menu-container');

      const unlockApi = window.JPShared && window.JPShared.unlock;
      const visibleGrammars = currentGrammars.filter(g =>
        !unlockApi || unlockApi.isFree() || unlockApi.isGrammarUnlocked(g)
      );

      const stampApi = window.JPShared && window.JPShared.stampSettings;
      const stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
      const pooUrl = stampApi && stampApi.getPooUrl ? stampApi.getPooUrl() : '';

      let lastLevel = null;
      visibleGrammars.forEach(g => {
        if (g.level !== lastLevel) {
          lastLevel = g.level;
          menuEl.appendChild(el('div', 'gr-menu-level-header', g.level));
        }

        const done = isGrammarComplete(g.id);
        const item = el('div', 'gr-menu-item' + (false ? ' locked' : ''));
        const left = el('div', '', '');
        left.style.display = 'flex'; left.style.alignItems = 'center';
        left.appendChild(el('span', 'gr-menu-icon', g.icon || '📐'));
        const info = el('div', '');
        info.appendChild(el('div', 'gr-menu-id', g.id));
        info.appendChild(el('div', 'gr-menu-name', g.title));
        left.appendChild(info);
        item.appendChild(left);

        const score = done ? progressGet('grammar_' + g.id + '_drill_score') : null;
        const hasScore = score !== undefined && score !== null;

        if (done && hasScore && (stampUrl || pooUrl)) {
          const passing = score >= 60;
          const rightWrap = el('div', 'gr-menu-right', '');
          const scoreEl = el('span', 'gr-menu-score', score + '%');
          if (!passing) scoreEl.style.color = '#999';
          rightWrap.appendChild(scoreEl);
          const tilt = Math.floor(Math.random() * 41) - 20;
          const stampDiv = el('div', 'gr-menu-stamp', '');
          const img = document.createElement('img');
          img.src = passing ? stampUrl : (pooUrl || stampUrl);
          img.alt = passing ? '✓' : '✗';
          img.style.transform = 'rotate(' + tilt + 'deg)';
          stampDiv.appendChild(img);
          rightWrap.appendChild(stampDiv);
          item.appendChild(rightWrap);
        } else {
          item.appendChild(el('span', 'gr-menu-badge lock', '→'));
        }

        item.onclick = () => loadGrammarLesson(g.file, g.id);
        menuEl.appendChild(item);
      });

      if (visibleGrammars.length === 0) {
        menuEl.innerHTML = '<div style="text-align:center;color:#aaa;padding:40px;">No grammar lessons available yet.</div>';
      }
    }

    // --- Modal ---
    window.JPShared.termModal.inject();

    // --- Initialize ---
    fetchGrammarList();
  }
};
