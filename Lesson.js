window.LessonModule = {
  start: function (container, sharedConfig, exitCallback) {

    // --- CONFIGURATION ---
    const REPO_CONFIG = sharedConfig;
    if (window.JPShared.stampSettings) window.JPShared.stampSettings.setConfig(REPO_CONFIG);

    // --- State ---
    let currentStep = 0;
    let totalSteps = 0;
    let lessonData = null;
    let termMapData = {};
    let showEN = false; // Default OFF
    let showAnswers = false;
    let drillCorrect = 0;
    let drillTotal = 0;
    const drillAnswered = new Set();
    let CONJUGATION_RULES = null;
    let COUNTER_RULES = null;
    let allLevelsData = null;     // [{ level, levelNum, lessons[] }]
    let currentLevelId = null;    // e.g. "N4"
    let currentLevelLessons = null; // lessons[] for selected level
    let manifestData = null;      // cached manifest for unlock computations

    // --- Setup UI Container (Mobile Look) ---
    container.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'jp-lesson-app-root';
    container.appendChild(root);

    // --- Styles ---
    if (!document.getElementById('jp-fonts')) {
        const link = document.createElement('link');
        link.id = 'jp-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Poppins:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
    }

    if (!document.getElementById('jp-lesson-style')) {
        const style = document.createElement("style");
        style.id = 'jp-lesson-style';
        style.textContent = `
          #jp-lesson-app-root {
            --primary: #4e54c8; --primary-dark: #3f44a5;
            --bg-grad: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
            --text-main: #2f3542; --text-sub: #747d8c;
            font-family: 'Poppins', 'Noto Sans JP', sans-serif;
            background: var(--bg-grad); color: var(--text-main);
            display: flex; flex-direction: column;
            width: 100%; max-width: 600px; margin: 0 auto;
            height: 800px; border-radius: 20px;
            border: 1px solid rgba(0,0,0,0.05); overflow: hidden; position: relative;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          #jp-lesson-app-root * { box-sizing: border-box; }

          /* Header & Footer */
          .jp-header {
            background: rgba(78, 84, 200, 0.95); padding: 1.2rem;
            color: white; border-bottom: none;
            display: flex; align-items: center; justify-content: space-between;
            box-shadow: 0 4px 15px rgba(78, 84, 200, 0.3); backdrop-filter: blur(5px);
            z-index: 10;
          }
          .jp-title { font-weight: 900; font-size: 1.1rem; color: white; }
          .jp-progress-container { height: 6px; width: 100%; background: rgba(0,0,0,0.1); }
          .jp-progress-bar { height: 100%; background: #2ed573; width: 0%; transition: width 0.3s ease; }
          .jp-body { padding: 1.5rem; flex: 1; overflow-y: auto; background: transparent; display: flex; flex-direction: column; }
          .jp-footer {
            padding: 15px 20px; background: white; border-top: 1px solid rgba(0,0,0,0.05);
            display: flex; gap: 10px; justify-content: space-between;
            box-shadow: 0 -5px 15px rgba(0,0,0,0.03); z-index: 10;
          }

          /* Buttons */
          .jp-nav-btn {
            padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; cursor: pointer;
            font-size: 0.95rem; transition: transform 0.1s;
          }
          .jp-nav-btn:active { transform: scale(0.96); }
          .jp-nav-btn.prev { background: #f1f2f6; color: #747d8c; }
          .jp-nav-btn.next { background: var(--primary); color: #fff; box-shadow: 0 4px 10px rgba(78,84,200,0.3); }
          .jp-nav-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

          .jp-exit-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }
          .jp-back-btn { background: transparent; color: rgba(255,255,255,0.8); border: none; cursor: pointer; font-weight: bold; font-size: 0.9rem; margin-right: 10px; }
          @media (hover: hover) { .jp-back-btn:hover { color: white; } }

          /* Menu & Cards */
          .jp-menu-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
          .jp-menu-item {
              background: #fff; padding: 20px; border-radius: 16px; cursor: pointer;
              box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
              border: 1px solid rgba(0,0,0,0.02); text-align: left;
              display: flex; justify-content: space-between; align-items: center;
          }
          @media (hover: hover) { .jp-menu-item:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(78,84,200,0.15); border-color: var(--primary); } }
          .jp-menu-id { font-weight: 900; color: var(--primary); font-size: 1.1rem; min-width: 50px; flex-shrink: 0; }
          .jp-menu-name { font-size: 0.85rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; flex: 1; text-align: center; }
          .jp-menu-stamp { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
          .jp-menu-stamp img { width: 100%; height: 100%; object-fit: contain; opacity: 0.85; }
          @keyframes jpStampPop { 0% { transform: scale(2) rotate(0deg); opacity: 0; } 60% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 0.85; } }
          .jp-menu-stamp img { animation: jpStampPop 0.3s ease; }
          .jp-menu-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
          .jp-menu-score { font-size: 0.75rem; font-weight: 700; color: var(--primary); }
          .jp-menu-badge { font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: #f1f2f6; color: #999; }

          .jp-level-card {
            background: #fff; padding: 28px 24px; border-radius: 20px; cursor: pointer;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid rgba(0,0,0,0.02); text-align: center;
          }
          @media (hover: hover) { .jp-level-card:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(78,84,200,0.15); border-color: var(--primary); } }
          .jp-level-name { font-weight: 900; font-size: 1.4rem; color: var(--primary); margin-bottom: 6px; }
          .jp-level-count { font-size: 0.85rem; color: #a4b0be; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

          .jp-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.02); }
          .jp-intro-card { text-align: center; padding: 40px 20px; justify-content: center; height: 100%; display: flex; flex-direction: column; }
          .jp-intro-title { font-size: 2rem; color: var(--primary); margin-bottom: 20px; line-height: 1.2; }
          .jp-intro-focus { font-size: 1rem; color: #747d8c; margin-bottom: 40px; background: #f8f9fa; padding: 12px 20px; border-radius: 50px; display: inline-block; }
          .jp-intro-kanji-row { font-size: 2.5rem; font-weight: 900; color: #2f3542; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
          .jp-intro-dot { color: var(--primary); opacity: 0.4; }

          /* Content Styles */
          .jp-speaker-bubble { background: #f1f2f6; color: var(--primary-dark); font-weight: 900; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          .jp-row { display: flex; gap: 12px; margin-bottom: 20px; align-items: flex-start; }
          .jp-jp { font-size: 1.15rem; line-height: 1.6; font-family: 'Noto Sans JP', sans-serif; color: #2f3542; }
          .jp-en { font-size: 0.9rem; color: #747d8c; margin-top: 6px; display: none; padding-left: 2px; }
          .jp-term { color: var(--primary); font-weight: 700; cursor: pointer; margin-right: 1px; border-bottom: 2px solid rgba(78,84,200,0.1); transition: 0.2s; }
          @media (hover: hover) { .jp-term:hover { background: rgba(78,84,200,0.05); border-bottom-color: var(--primary); } }

          .jp-toggle-en { font-size: 0.75rem; font-weight: 700; color: #747d8c; background: #fff; border: 2px solid #f1f2f6; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-bottom: 20px; width: 100%; }

          .jp-kanji-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .jp-flip-container { perspective: 1000px; cursor: pointer; height: 180px; }
          .jp-flip-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; border-radius: 16px; box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
          .jp-flip-container.flipped .jp-flip-inner { transform: rotateY(180deg); }
          .jp-flip-front, .jp-flip-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.05); }
          .jp-flip-front { z-index: 2; }
          .jp-flip-back { transform: rotateY(180deg); background: #fdfdfd; padding: 10px; }
          .jp-k-char { font-size: 3rem; font-weight: 900; color: #2f3542; line-height: 1; }
          .jp-k-meaning { font-size: 0.9rem; font-weight: 800; color: var(--primary); margin-top: 5px;}

          .jp-mcq-opt { display: block; width: 100%; text-align: left; padding: 15px; margin-bottom: 10px; background: #fff; border: 2px solid #eee; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 1rem; color: #2f3542; transition: 0.2s; }
          @media (hover: hover) { .jp-mcq-opt:hover { border-color: var(--primary); background: #f8f9fa; } }
          .jp-mcq-opt.correct { background: #d4edda; border-color: #c3e6cb; color: #155724; }
          .jp-mcq-opt.wrong { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }

          /* RANK CELEBRATION - HANABI */
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

          /* UNLOCK REVEAL CARDS */
          .jp-unlock-reveal { padding: 4px 0 8px; }
          .jp-unlock-card {
              display: flex; align-items: center; gap: 10px;
              background: white; border-radius: 12px;
              padding: 10px 16px; margin-bottom: 8px;
              border-left: 4px solid #4e54c8;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
              opacity: 0; transform: translateY(20px);
              transition: opacity 0.4s ease, transform 0.4s ease;
          }
          .jp-unlock-card--animate { opacity: 1; transform: translateY(0); }
          .jp-unlock-card--module { border-left-color: #FF9800; background: linear-gradient(135deg, #fff 80%, #fff8e1); }
          .jp-unlock-card-icon { font-size: 1.4rem; flex-shrink: 0; }
          .jp-unlock-card-label { font-size: 0.9rem; font-weight: 700; color: #2f3542; }

          /* LOCKED LESSON ITEMS */
          .jp-menu-item--locked { opacity: 0.5; cursor: default; }
          @media (hover: hover) { .jp-menu-item--locked:hover { transform: none; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-color: transparent; } }

        `;
        document.head.appendChild(style);
    }

    // --- Helpers ---
    function el(tag, cls, inner) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (inner !== undefined) {
          if(typeof inner === 'string') e.innerHTML = inner;
          else e.appendChild(inner);
        }
        return e;
    }
    function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function getCdnUrl(filepath) {
        return window.getAssetUrl(REPO_CONFIG, filepath);
    }


    async function loadResources() {
        const manifest = await window.getManifest(REPO_CONFIG);
        const conjUrl     = getCdnUrl(manifest.globalFiles.conjugationRules);
        const counterUrl  = getCdnUrl(manifest.globalFiles.counterRules);
        const particleUrl  = getCdnUrl(manifest.shared.particles);
        const characterUrl = getCdnUrl(manifest.shared.characters);
        console.log('[Lesson] Conjugation URL:', conjUrl);
        console.log('[Lesson] Counter URL:', counterUrl);
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

    // --- RANK CELEBRATION ---
    const SCORE_RANKS = [
        { min: 0,   msg: '頑張れ！',     sub: 'Keep Going!',    colors: ['#a4b0be','#747d8c','#57606f'],                              particles: 8  },
        { min: 60,  msg: 'いいね！',     sub: 'Nice!',          colors: ['#FFD700','#FFA500','#FFE066'],                              particles: 15 },
        { min: 70,  msg: 'すごい！',     sub: 'Amazing!',       colors: ['#FF6B35','#FF4500','#FF8C00'],                              particles: 24 },
        { min: 80,  msg: 'さすが！',     sub: 'Impressive!',    colors: ['#FF1493','#FF69B4','#FF85C8'],                              particles: 35 },
        { min: 90,  msg: 'すばらしい！', sub: 'Wonderful!',     colors: ['#00E5FF','#00BCD4','#4DD0E1'],                              particles: 45 },
        { min: 95,  msg: '天才！',       sub: 'Genius!',        colors: ['#8B5CF6','#A78BFA','#7C3AED'],                              particles: 55 },
        { min: 100, msg: '神！',         sub: 'Godlike!',       colors: ['#FF1493','#FFD700','#00E5FF','#8B5CF6','#2ED573','#FF6B35'], particles: 70 },
    ];

    function launchHanabi(rank, targetEl) {
        targetEl.style.position = 'relative';
        const container = document.createElement('div');
        container.className = 'jp-hanabi-container';
        targetEl.appendChild(container);
        const w = targetEl.offsetWidth || 300;
        const h = targetEl.offsetHeight || 200;
        const burstPoints = rank.particles >= 55 ? [
            { x: w * 0.3, y: h * 0.25 }, { x: w * 0.7, y: h * 0.3 }, { x: w * 0.5, y: h * 0.15 }
        ] : rank.particles >= 35 ? [
            { x: w * 0.35, y: h * 0.25 }, { x: w * 0.65, y: h * 0.25 }
        ] : [{ x: w / 2, y: h * 0.25 }];
        const perBurst = Math.ceil(rank.particles / burstPoints.length);
        burstPoints.forEach((bp, bIdx) => {
            for (let i = 0; i < perBurst; i++) {
                const p = document.createElement('div');
                p.className = 'jp-hanabi-particle';
                const angle = (Math.PI * 2 * i / perBurst) + (Math.random() * 0.4 - 0.2);
                const dist = 50 + Math.random() * 100;
                const color = rank.colors[Math.floor(Math.random() * rank.colors.length)];
                const size = 3 + Math.random() * 5;
                const delay = bIdx * 150 + Math.random() * 100;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist + 40;
                p.style.cssText = 'left:' + bp.x + 'px;top:' + bp.y + 'px;width:' + size + 'px;height:' + size + 'px;background:' + color + ';box-shadow:0 0 ' + size + 'px ' + color + ';transition:transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.9s ease-out;transition-delay:' + delay + 'ms;';
                container.appendChild(p);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                    p.style.opacity = '0';
                }));
            }
        });
        const msgEl = document.createElement('div');
        msgEl.className = 'jp-hanabi-msg';
        msgEl.innerHTML = '<div class="jp-hanabi-jp" style="color:' + rank.colors[0] + '">' + rank.msg + '</div><div class="jp-hanabi-en">' + rank.sub + '</div>';
        container.appendChild(msgEl);
        setTimeout(() => container.remove(), 3000);
    }

    // --- Modal ---
    window.JPShared.termModal.inject();

    // --- Renderers ---
    function renderIntro(data) {
        const div = el("div", "jp-intro-card");
        div.appendChild(el("div", "jp-intro-title", data.title));
        if (data.meta && data.meta.focus) div.appendChild(el("div", "jp-intro-focus", `<strong>Focus:</strong> ${data.meta.focus}`));
        if (data.meta && data.meta.kanji) {
            const row = el("div", "jp-intro-kanji-row");
            data.meta.kanji.forEach((char, idx) => {
                let termId = null;
                for (const [key, val] of Object.entries(termMapData)) { if (val.surface === char && val.type === 'kanji') { termId = key; break; } }
                // DISABLED FLAGGING FOR INTRO
                if (termId) { const span = el("span", "jp-term", char); span.onclick = () => window.JP_OPEN_TERM(termId, false); row.appendChild(span); }
                else { row.appendChild(el("span", "", char)); }
                if (idx < data.meta.kanji.length - 1) row.appendChild(el("span", "jp-intro-dot", "•"));
            });
            div.appendChild(row);
        }
        return div;
    }

    function createToggle() {
        const btn = el("button", "jp-toggle-en", showEN ? "Hide English Translation" : "Show English Translation");
        btn.onclick = function() { showEN = !showEN; renderCurrentStep(); };
        return btn;
    }

    function renderConversation(sec) {
        const div = el("div", ""); div.appendChild(createToggle());
        const allLines = [];
        // Play/Stop toggle button
        const playAllBtn = el("button", "jp-speak-all-btn", "\uD83D\uDD0A Play Conversation");
        div.appendChild(playAllBtn);
        (sec.lines || []).forEach(line => {
          allLines.push({ jp: line.jp, terms: line.terms });
          const row = el("div", "jp-row");
          row.innerHTML = `<div class="jp-speaker-bubble" translate="no">${line.spk}</div><div style="flex:1;display:flex;align-items:flex-start;"><div style="flex:1"><div class="jp-jp">${window.JPShared.textProcessor.processText(line.jp, line.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)}</div><div class="jp-en" style="display:${showEN?'block':'none'}">${esc(line.en)}</div></div><button class="jp-speak-sentence" title="Listen">\uD83D\uDD0A</button></div>`;
          const speakBtn = row.querySelector('.jp-speak-sentence');
          speakBtn.onclick = () => window.JPShared.tts.speak(line.jp, { terms: line.terms, termMap: termMapData });
          div.appendChild(row);
        });
        function setPlaying(playing) {
          playAllBtn.textContent = playing ? '\u23F9 Stop' : '\uD83D\uDD0A Play Conversation';
          playAllBtn.classList.toggle('jp-speak-all-active', playing);
        }
        playAllBtn.onclick = () => {
          if (window.JPShared.tts.isSpeaking()) {
            window.JPShared.tts.cancel();
            setPlaying(false);
          } else {
            setPlaying(true);
            window.JPShared.tts.speakLines(allLines, { termMap: termMapData, onFinish: () => setPlaying(false) });
          }
        };
        return div;
    }

    function renderWarmup(sec) {
        const div = el("div", ""); div.appendChild(createToggle());
        (sec.items || []).forEach((item, idx) => {
            const row = el("div", "jp-row");
            row.innerHTML = `<div class="jp-speaker-bubble" translate="no">${idx+1}</div><div style="flex:1;display:flex;align-items:flex-start;"><div style="flex:1"><div class="jp-jp">${window.JPShared.textProcessor.processText(item.jp, item.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)}</div><div class="jp-en" style="display:${showEN?'block':'none'}">${esc(item.en)}</div></div><button class="jp-speak-sentence" title="Listen">\uD83D\uDD0A</button></div>`;
            row.querySelector('.jp-speak-sentence').onclick = () => window.JPShared.tts.speak(item.jp, { terms: item.terms, termMap: termMapData });
            div.appendChild(row);
        });
        return div;
    }

    function renderKanjiFlip(sec) {
        const grid = el("div", "jp-kanji-grid");
        (sec.items || []).forEach(k => {
          const kanjiId = k.termId || (k.terms || []).find(id => termMapData[id]?.type === "kanji");
          const t = kanjiId ? termMapData[kanjiId] : null;
          const kanjiChar = t?.surface || k.kanji;
          const card = el("div", "jp-flip-container");
          card.onclick = function () { this.classList.toggle("flipped"); };
          card.innerHTML = `<div class="jp-flip-inner"><div class="jp-flip-front"><div class="jp-k-char">${kanjiChar}</div><div class="jp-k-sub">Tap</div></div><div class="jp-flip-back"><div class="jp-k-readings">${t?.on||""}<br>${t?.kun||""}</div><div class="jp-k-meaning">${t?.meaning||""}</div></div></div>`;
          grid.appendChild(card);
        });
        return grid;
    }

    function renderVocab(sec) {
        const div = el("div", "");
        (sec.groups || []).forEach(g => {
            const group = el("div", "jp-card");
            group.innerHTML = `<div style="font-weight:700; color:#888; margin-bottom:10px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">${g.label}</div>`;
            const chips = el("div", "",""); chips.style.cssText="display:flex; flex-wrap:wrap; gap:8px;";
            (g.items||[]).forEach(ref => {
                 let t = (typeof ref === 'string') ? termMapData[ref] : null;
                 if(t) {
                     const chip = el("div","",t.surface); chip.style.cssText="background:#f1f2f6; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; color:#4e54c8;";
                     // DISABLED FLAGGING FOR VOCAB LIST
                     chip.onclick = ()=>window.JP_OPEN_TERM(t.id, false);
                     chips.appendChild(chip);
                 }
            });
            group.appendChild(chips);
            div.appendChild(group);
        });
        return div;
    }

    function renderDrills(sec) {
         const div = el("div", "");
         (sec.items || []).forEach((item, itemIdx) => {
           if (item.kind === 'mcq') {
             const card = el("div", "jp-card");
             // Don't make terms tappable in bracketed questions — the bracketed word IS the answer
             const qTerms = /\[/.test(item.q) ? [] : item.terms;
             card.innerHTML = `<div class="jp-jp" style="margin-bottom:15px; font-weight:bold;">${window.JPShared.textProcessor.processText(item.q, qTerms, termMapData, CONJUGATION_RULES, COUNTER_RULES).replace(/\[(.*?)\]/g, '<span class="jp-highlight">$1</span>')}</div>`;
             const optsDiv = el("div");
             let solved = false;
             const itemKey = 'drill__' + itemIdx + '__' + item.q;

             // Randomize choices
             const choices = [...item.choices].sort(() => Math.random() - 0.5);

             choices.forEach(choice => {
               const btn = el("button", "jp-mcq-opt", choice);
               btn.onclick = () => {
                 if(solved) return; solved = true;
                 if(choice === item.answer) {
                   btn.classList.add("correct");
                   if (!drillAnswered.has(itemKey)) { drillAnswered.add(itemKey); drillCorrect++; }
                 } else {
                     btn.classList.add("wrong");
                     if (!drillAnswered.has(itemKey)) drillAnswered.add(itemKey);
                     // Auto highlight correct answer
                     Array.from(optsDiv.children).forEach(c => { if(c.innerText === item.answer) c.classList.add("correct"); });

                     // Auto-flag terms for review when answer is wrong
                     if(item.terms && item.terms.length > 0) {
                       item.terms.forEach(termId => {
                         const rootTerm = window.JPShared.textProcessor.getRootTerm(termId, termMapData);
                         if(rootTerm) {
                           window.JPShared.progress.flagTerm(rootTerm.surface);
                         }
                       });
                     }
                 }
               };
               optsDiv.appendChild(btn);
             });
             card.appendChild(optsDiv);
             div.appendChild(card);
           }
         });
         return div;
    }

    function renderReading(sec) {
        const div = el("div", ""); div.appendChild(createToggle());
        const allPassageLines = (sec.passage || []).map(p => ({ jp: p.jp, terms: p.terms }));
        // Play/Stop toggle button
        const playAllBtn = el("button", "jp-speak-all-btn", "\uD83D\uDD0A Play Passage");
        function setPlaying(playing) {
          playAllBtn.textContent = playing ? '\u23F9 Stop' : '\uD83D\uDD0A Play Passage';
          playAllBtn.classList.toggle('jp-speak-all-active', playing);
        }
        playAllBtn.onclick = () => {
          if (window.JPShared.tts.isSpeaking()) {
            window.JPShared.tts.cancel();
            setPlaying(false);
          } else {
            setPlaying(true);
            window.JPShared.tts.speakLines(allPassageLines, { termMap: termMapData, onFinish: () => setPlaying(false) });
          }
        };
        div.appendChild(playAllBtn);
        const pCard = el("div", "jp-card");
        (sec.passage || []).forEach(p => {
            const pDiv = el("div", "");
            pDiv.innerHTML = `<div style="display:flex;align-items:flex-start;"><div style="flex:1"><div class="jp-jp" style="margin-bottom:8px;">${window.JPShared.textProcessor.processText(p.jp, p.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)}</div><div class="jp-en" style="display:${showEN?'block':'none'}">${esc(p.en)}</div></div><button class="jp-speak-sentence" title="Listen">\uD83D\uDD0A</button></div>`;
            pDiv.querySelector('.jp-speak-sentence').onclick = () => window.JPShared.tts.speak(p.jp, { terms: p.terms, termMap: termMapData });
            pCard.appendChild(pDiv);
        });
        div.appendChild(pCard);

        if (sec.questions) {
          const revealBtn = el("button", "jp-toggle-en", showAnswers ? "Hide Answers" : "Reveal Answers");
          revealBtn.onclick = function() { showAnswers = !showAnswers; renderCurrentStep(); };
          div.appendChild(revealBtn);

          const qCard = el("div", "jp-card");
          qCard.innerHTML = `<div style="font-weight:700; color:#888; margin-bottom:15px;">COMPREHENSION CHECK</div>`;
          sec.questions.forEach((q, i) => {
             const row = el("div", "jp-row");
             const ansHtml = q.a_terms
               ? `<div class="jp-jp" style="display:${showAnswers?'block':'none'};margin-top:6px;">${window.JPShared.textProcessor.processText(q.a, q.a_terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)}</div>`
               : `<div class="jp-jp" style="display:${showAnswers?'block':'none'};margin-top:6px;">${esc(q.a)}</div>`;
             const qEnHtml = q.q_en ? `<div class="jp-en" style="display:${showEN?'block':'none'}">${esc(q.q_en)}</div>` : '';
             const aEnHtml = q.a_en ? `<div class="jp-en" style="display:${showEN?'block':'none'};margin-top:2px;">${esc(q.a_en)}</div>` : '';
             row.innerHTML = `<div class="jp-speaker-bubble" translate="no">Q${i+1}</div><div style="flex:1"><div class="jp-jp" style="font-weight:700;">${window.JPShared.textProcessor.processText(q.q, q.terms, termMapData, CONJUGATION_RULES, COUNTER_RULES)}</div>${qEnHtml}${ansHtml}${aEnHtml}</div>`;
             qCard.appendChild(row);
          });
          div.appendChild(qCard);
        }
        return div;
    }

    // --- Summary helpers ---

    function buildUnlockReveal(items) {
        const wrap = el('div', 'jp-unlock-reveal');
        const heading = document.createElement('div');
        heading.style.cssText = 'font-size:1rem;font-weight:700;color:#4e54c8;text-transform:uppercase;letter-spacing:1px;margin:20px 0 12px;text-align:center;';
        heading.textContent = '🎁 Unlocked!';
        wrap.appendChild(heading);
        items.forEach(function(item, i) {
            const card = el('div', 'jp-unlock-card');
            if (item.type === 'module') card.classList.add('jp-unlock-card--module');
            card.innerHTML = '<span class="jp-unlock-card-icon">' + item.icon + '</span>' +
                             '<span class="jp-unlock-card-label">' + item.label + '</span>';
            wrap.appendChild(card);
            setTimeout(function() {
                requestAnimationFrame(function() { card.classList.add('jp-unlock-card--animate'); });
            }, i * 150);
        });
        return wrap;
    }

    function buildEncouragement(pending) {
        const wrap = el('div', '');
        let html = '<div style="text-align:center;padding:16px;background:#fff8e1;border-radius:12px;margin-bottom:12px;">' +
                   '<div style="font-size:1.5rem;">💪</div>' +
                   '<div style="font-size:1rem;font-weight:700;color:#F59E0B;margin:4px 0;">Keep going!</div>' +
                   '<div style="font-size:0.85rem;color:#747d8c;">Score <strong>75% or higher</strong> to unlock:</div>';
        if (pending.length > 0) {
            html += '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
            pending.forEach(function(item) {
                html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;font-size:0.8rem;font-weight:600;color:#4e54c8;">' +
                        item.icon + ' ' + item.label + '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        html += '<div style="text-align:center;padding:12px;background:#e8f5e9;border-radius:12px;">' +
                '<div style="font-size:0.85rem;color:#16A34A;font-weight:600;">✅ Already unlocked for you:</div>' +
                '<div style="font-size:0.8rem;color:#4CAF50;margin-top:4px;">🥋 Dojo &amp; 🌿 Grammar Garden are available to help you practice!</div>' +
                '</div>';
        wrap.innerHTML = html;
        return wrap;
    }

    function renderSummary(body, nextBtn, prevBtn, pct) {
        const rank = [...SCORE_RANKS].reverse().find(r => pct >= r.min) || SCORE_RANKS[0];
        body.innerHTML = `
            <div class="jp-card jp-summary-score-card" style="text-align:center; position:relative; padding:30px 20px; margin-bottom:0;">
                <h2 style="margin-bottom:15px;">🎉 Lesson Complete!</h2>
                ${drillTotal > 0 ? `
                <div style="font-size:0.8rem; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Drill Score</div>
                <div style="font-size:3rem; font-weight:900; color:${rank.colors[0]}; line-height:1.1;">${rank.msg}</div>
                <div style="font-size:1rem; color:#747d8c; font-weight:600; margin:6px 0 14px;">${rank.sub}</div>
                <div style="font-size:2.2rem; font-weight:900; color:var(--primary);">${pct}%</div>
                <div style="font-size:0.9rem; color:#888; margin-top:4px;">${drillCorrect} / ${drillTotal} correct</div>
                ` : ''}
            </div>`;

        if (drillTotal > 0) launchHanabi(rank, body.querySelector('.jp-summary-score-card'));

        // Record streak activity on lesson completion
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();

        const unlock = window.JPShared && window.JPShared.unlock;

        // Always persist score + completion so stamps appear on the menu.
        if (unlock && manifestData && lessonData && lessonData.id) {
            unlock.computeUnlocks(lessonData.id, pct, manifestData);
        }

        if (!unlock || unlock.isFree() || !manifestData || !lessonData || !lessonData.id) {
            nextBtn.innerText = "Finish";
            prevBtn.style.visibility = 'hidden';
            return;
        }

        if (result.passed) {
            nextBtn.innerText = "Continue \u2192";
            prevBtn.style.visibility = 'hidden';
            if (result.newItems.length > 0) body.appendChild(buildUnlockReveal(result.newItems));
        } else {
            const pending = unlock.getPendingUnlocks(lessonData.id, manifestData);
            body.appendChild(buildEncouragement(pending));
            prevBtn.style.visibility = 'visible';
            prevBtn.disabled = false;
            prevBtn.innerText = "\u2190 Menu";
            prevBtn.onclick = function() { renderMenu(currentLevelId, currentLevelLessons); };
            nextBtn.innerText = "Try Again";
            nextBtn.onclick = function() {
                var entry = currentLevelLessons && currentLevelLessons.find(function(l) { return l.id === lessonData.id; });
                if (entry) loadLesson(entry.file);
            };
        }
    }

    // --- Logic ---
    async function fetchLessonList() {
        root.innerHTML = `<div class="jp-header"><div class="jp-title">Library</div><div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="jp-exit-btn">Exit</button></div></div><div class="jp-body" style="text-align:center; justify-content:center; color:#888;">Loading...</div>`;
        root.querySelector('.jp-exit-btn').onclick = exitCallback;

        try {
          const manifest = await window.getManifest(REPO_CONFIG);
          manifestData = manifest; // cache for unlock computations
          const levelsData = [];
          (manifest.levels || []).forEach(level => {
            const levelData = manifest.data && manifest.data[level];
            if (!levelData || !levelData.lessons) return;
            const lessons = levelData.lessons.map(l => ({ id: l.id, title: l.title, file: l.file, unlocksAfter: l.unlocksAfter }));
            // Sort lessons within level: highest lesson number first
            lessons.sort((a, b) => {
              const partsA = a.id.replace('N','').split('.').map(Number);
              const partsB = b.id.replace('N','').split('.').map(Number);
              return partsB[1] - partsA[1];
            });
            levelsData.push({ level, levelNum: parseInt(level.replace('N','')), lessons });
          });
          // Sort levels: N4 first (lower JLPT number = more advanced = top of list)
          levelsData.sort((a, b) => a.levelNum - b.levelNum);

          console.log('[Lesson] Found levels:', levelsData.map(l => l.level));
          allLevelsData = levelsData;
          renderLevelPicker();
        } catch (err) {
          root.innerHTML = `<div class="jp-body" style="color:#ff4757; text-align:center; padding:20px; justify-content:center;"><h3>Error</h3><p>${err.message}</p><button class="jp-nav-btn next" onclick="exitCallback()">Back to Main Menu</button></div>`;
        }
    }

    function renderLevelPicker() {
        root.innerHTML = `<div class="jp-header"><div class="jp-title">Library</div><div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="jp-exit-btn">Exit</button></div></div><div class="jp-body"><div class="jp-menu-grid" id="jp-level-container"></div></div>`;
        root.querySelector('.jp-exit-btn').onclick = exitCallback;
        const container = document.getElementById('jp-level-container');
        const unlockApi = window.JPShared && window.JPShared.unlock;
        allLevelsData.forEach(({ level, levelNum, lessons }) => {
          // N4 is a paid gateway — hide it entirely until explicitly unlocked.
          if (level === 'N4' && unlockApi && !unlockApi.isFree() && !unlockApi.isN4Unlocked()) return;
          const visibleCount = lessons.filter(l => !unlockApi || unlockApi.isFree() || unlockApi.isLessonUnlocked(l)).length;
          const card = el('div', 'jp-level-card');
          card.innerHTML = `<div class="jp-level-name">JLPT Level N${levelNum}</div><div class="jp-level-count">${visibleCount} lesson${visibleCount !== 1 ? 's' : ''}</div>`;
          card.onclick = () => renderMenu(level, lessons);
          container.appendChild(card);
        });
    }

    function renderMenu(level, lessons) {
        currentLevelId = level;
        currentLevelLessons = lessons;
        const levelNum = level.replace('N', '');
        root.innerHTML = `<div class="jp-header"><button class="jp-back-btn">← Levels</button><div class="jp-title">JLPT Level N${levelNum}</div><div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="jp-exit-btn">Exit</button></div></div><div class="jp-body"><div class="jp-menu-grid" id="jp-menu-container"></div></div>`;
        root.querySelector('.jp-back-btn').onclick = () => renderLevelPicker();
        root.querySelector('.jp-exit-btn').onclick = exitCallback;
        const menuEl = document.getElementById('jp-menu-container');
        const unlockApi = window.JPShared && window.JPShared.unlock;
        // Only show unlocked lessons. List is sorted highest-first so the most
        // recently unlocked lesson appears at the top.
        const visibleLessons = lessons.filter(l =>
          !unlockApi || unlockApi.isFree() || unlockApi.isLessonUnlocked(l)
        );
        const stampApi = window.JPShared && window.JPShared.stampSettings;
        const stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
        const pooUrl = stampApi && stampApi.getPooUrl ? stampApi.getPooUrl() : '';

        visibleLessons.forEach(lesson => {
          const btn = el("div", "jp-menu-item");
          const idEl = el('div', 'jp-menu-id', lesson.id);
          const nameEl = el('div', 'jp-menu-name', lesson.title || 'Start');
          btn.appendChild(idEl);
          btn.appendChild(nameEl);

          const score = unlockApi ? unlockApi.getLessonScore(lesson.id) : 0;
          const completed = unlockApi && unlockApi.isCompleted(lesson.id);

          if (completed && score > 0 && (stampUrl || pooUrl)) {
            const passing = score >= 60;
            const rightWrap = el('div', 'jp-menu-right', '');
            const scoreEl = el('span', 'jp-menu-score', score + '%');
            if (!passing) scoreEl.style.color = '#999';
            rightWrap.appendChild(scoreEl);
            const tilt = Math.floor(Math.random() * 41) - 20;
            const stampDiv = el('div', 'jp-menu-stamp', '');
            const img = document.createElement('img');
            img.src = passing ? stampUrl : (pooUrl || stampUrl);
            img.alt = passing ? '✓' : '✗';
            img.style.transform = 'rotate(' + tilt + 'deg)';
            stampDiv.appendChild(img);
            rightWrap.appendChild(stampDiv);
            btn.appendChild(rightWrap);
          } else {
            btn.appendChild(el('span', 'jp-menu-badge', '→'));
          }

          btn.onclick = () => loadLesson(lesson.file);
          menuEl.appendChild(btn);
        });
    }

    async function loadLesson(filePath) {
        root.innerHTML = `<div class="jp-header"><button class="jp-back-btn">← List</button><div class="jp-title">Loading...</div><div style="display:flex;gap:8px;align-items:center;"><button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings">\u2699</button><button class="jp-exit-btn">Exit</button></div></div><div class="jp-progress-container"><div class="jp-progress-bar"></div></div><div class="jp-body"></div><div class="jp-footer"><button class="jp-nav-btn prev">Prev</button><button class="jp-nav-btn next">Next</button></div>`;
        root.querySelector('.jp-back-btn').onclick = () => renderMenu(currentLevelId, currentLevelLessons);
        root.querySelector('.jp-exit-btn').onclick = exitCallback;

        try {
          const lessonUrl = getCdnUrl(filePath);
          console.log('[Lesson] Loading lesson:', lessonUrl);
          const [lRes, resources] = await Promise.all([
             fetch(lessonUrl),
             loadResources()
          ]);
          lessonData = await lRes.json();
          drillCorrect = 0; drillTotal = 0; drillAnswered.clear();
          lessonData.sections.forEach(sec => {
              if (sec.type === 'drills') {
                  (sec.items || []).forEach(item => { if (item.kind === 'mcq') drillTotal++; });
              }
          });
          termMapData = resources.map;
          CONJUGATION_RULES = resources.conj;
          COUNTER_RULES     = resources.counter;
          window.JPShared.termModal.setTermMap(termMapData);

          lessonData.sections.unshift({ type: 'intro', title: lessonData.title });
          currentStep = 0; totalSteps = lessonData.sections.length; showEN = false; showAnswers = false;

          // NAVIGATION EVENTS
          root.querySelector('.jp-nav-btn.prev').onclick = () => {
              if (currentStep > 0) {
                  currentStep--;
                  showEN = false; showAnswers = false; // Reset on navigation
                  renderCurrentStep();
              }
          };
          root.querySelector('.jp-nav-btn.next').onclick = () => {
             if (currentStep < totalSteps) {
                 currentStep++;
                 showEN = false; showAnswers = false; // Reset on navigation
                 renderCurrentStep();
             }
             else { renderMenu(currentLevelId, currentLevelLessons); }
          };
          renderCurrentStep();
        } catch (err) {
           console.error(err);
           root.querySelector('.jp-body').innerHTML = "Error loading lesson.";
        }
    }

    function renderCurrentStep() {
        const body = root.querySelector('.jp-body');
        const title = root.querySelector('.jp-title');
        const bar = root.querySelector('.jp-progress-bar');
        const nextBtn = root.querySelector('.jp-nav-btn.next');
        const prevBtn = root.querySelector('.jp-nav-btn.prev');

        body.innerHTML = "";
        bar.style.width = (((currentStep + 1) / totalSteps) * 100) + "%";

        if (currentStep >= lessonData.sections.length) {
            title.innerText = "Summary";
            const pct = drillTotal > 0 ? Math.round(drillCorrect / drillTotal * 100) : 100;
            renderSummary(body, nextBtn, prevBtn, pct);
            return;
        }

        const sec = lessonData.sections[currentStep];
        title.innerText = (sec.type === 'intro') ? lessonData.title : sec.title;

        const wrap = el("div");
        let content = null;
        if (sec.type === "intro") content = renderIntro(lessonData);
        else if (sec.type === "kanjiGrid") content = renderKanjiFlip(sec);
        else if (sec.type === "conversation") content = renderConversation(sec);
        else if (sec.type === "vocabList") content = renderVocab(sec);
        else if (sec.type === "drills") content = renderDrills(sec);
        else if (sec.type === "warmup") content = renderWarmup(sec);
        else if (sec.type === "reading") content = renderReading(sec);

        if(content) wrap.appendChild(content);
        body.appendChild(wrap);

        prevBtn.disabled = (currentStep === 0);
        nextBtn.innerText = (currentStep === totalSteps - 1) ? "Finish" : "Next";
    }

    // Initialize
    fetchLessonList();
  }
};
