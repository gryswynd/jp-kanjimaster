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
    let showEN = false;
    let showAnswers = false;
    let drillCorrect = 0;
    let drillTotal = 0;
    const drillAnswered = new Set();
    let CONJUGATION_RULES = null;
    let COUNTER_RULES = null;
    let allLevelsData = null;
    let currentLevelId = null;
    let currentLevelLessons = null;
    let manifestData = null;
    let kanjiSel = 0; // selected kanji index in the kanji panel

    // --- Setup UI Container ---
    container.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'jp-lesson-app-root';
    container.appendChild(root);

    // --- Styles (washi / ink / vermilion design system) ---
    if (!document.getElementById('jp-lesson-style')) {
        const style = document.createElement("style");
        style.id = 'jp-lesson-style';
        style.textContent = `
          #jp-lesson-app-root {
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
            font-family: var(--font-ui); color: var(--ink);
            background:
              radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
              radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
              var(--washi);
            display: flex; flex-direction: column;
            width: 100%; min-height: 100vh; min-height: 100dvh; position: relative;
          }
          #jp-lesson-app-root * { box-sizing: border-box; }
          #jp-lesson-app-root .jp-mono { font-family: var(--font-mono); }
          #jp-lesson-app-root .jp-serif { font-family: var(--font-jp-display); }
          #jp-lesson-app-root .jp-sans { font-family: var(--font-jp); }

          /* Header */
          .lh-header { padding: max(28px,env(safe-area-inset-top)) 18px 14px; background: var(--washi); border-bottom: 1px solid var(--hairline); position: sticky; top: 0; z-index: 10; }
          .lh-row { display: flex; align-items: center; gap: 12px; }
          .lh-x { width: 32px; height: 32px; border-radius: 999px; border: 1px solid var(--hairline); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--ink-2); flex-shrink: 0; }
          .lh-code { font-family: var(--font-mono); font-size: 10px; color: var(--vermilion); letter-spacing: 0.18em; font-weight: 600; }
          .lh-title { font-family: var(--font-jp-display); font-weight: 600; font-size: 17px; letter-spacing: -0.01em; margin-top: 1px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lh-count { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.08em; padding: 4px 8px; border: 1px solid var(--hairline); border-radius: 4px; flex-shrink: 0; }
          .lh-gear { background: transparent; border: 1px solid var(--hairline); color: var(--ink-2); width: 32px; height: 32px; border-radius: 999px; cursor: pointer; font-size: 15px; flex-shrink: 0; }
          .lh-rail { display: flex; gap: 4px; margin-top: 14px; }
          .lh-seg { flex: 1; height: 3px; background: transparent; border: none; padding: 0; cursor: pointer; }
          .lh-seg > div { height: 3px; border-radius: 2px; transition: background 0.2s; }

          /* Body + footer */
          .lh-body { flex: 1; overflow-y: auto; overflow-x: hidden; animation: lhFade 0.3s ease; }
          @keyframes lhFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .lh-footer { padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); background: var(--washi); border-top: 1px solid var(--hairline); display: flex; gap: 10px; align-items: center; position: sticky; bottom: 0; z-index: 10; }
          .lh-btn-back { height: 46px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hairline); background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
          .lh-btn-next { flex: 1; height: 46px; border-radius: 999px; border: none; background: var(--ink); color: var(--washi); font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; letter-spacing: -0.01em; }
          .lh-btn-next.finish { background: var(--moss); }
          .lh-btn-next:disabled { opacity: 0.5; cursor: not-allowed; }
          .lh-next-sub { opacity: 0.55; font-weight: 400; }

          /* Atoms */
          .lh-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 500; }
          .lh-h2 { font-family: var(--font-jp-display); font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 6px 0; color: var(--ink); }
          .lh-lead { color: var(--ink-2); font-size: 13.5px; line-height: 1.5; }
          .lh-card { background: var(--washi); border: 1px solid var(--hairline); border-radius: var(--r-lg); }

          /* Term spans (from processText) restyled */
          #jp-lesson-app-root .jp-term { color: var(--vermilion); font-weight: 600; cursor: pointer; border-bottom: 1.5px solid oklch(0.60 0.18 30 / 0.25); }
          @media (hover:hover){ #jp-lesson-app-root .jp-term:hover { border-bottom-color: var(--vermilion); } }
          #jp-lesson-app-root .jp-highlight { background: oklch(0.78 0.10 85 / 0.35); border-radius: 4px; padding: 0 4px; font-weight: 700; }

          /* Speaker / TTS buttons */
          .lh-speak { background: var(--washi-2); border: 1px solid var(--hairline); color: var(--ink-2); width: 30px; height: 30px; border-radius: 999px; cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
          .lh-playall { width: 100%; margin: 0 0 16px; padding: 10px 14px; border-radius: 999px; border: 1px solid var(--hairline); background: var(--washi); color: var(--ink-2); font-size: 12px; font-weight: 600; font-family: var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
          .lh-playall.on { background: var(--vermilion); color: var(--washi); border-color: var(--vermilion); }

          /* Menu / level cards */
          .lh-list { padding: 18px 18px 28px; display: flex; flex-direction: column; gap: 10px; }
          .lh-item { background: var(--washi); border: 1px solid var(--hairline); border-radius: var(--r-md); padding: 16px 18px; cursor: pointer; display: flex; align-items: center; gap: 14px; text-align: left; transition: transform 0.12s; }
          .lh-item:active { transform: scale(0.99); }
          .lh-item-id { font-family: var(--font-mono); font-weight: 600; color: var(--vermilion); font-size: 12px; letter-spacing: 0.08em; min-width: 54px; flex-shrink: 0; }
          .lh-item-name { font-size: 15px; font-weight: 600; color: var(--ink); flex: 1; }
          .lh-item--locked { opacity: 0.5; cursor: default; background: var(--washi-2); }
          .lh-level { background: var(--ink); color: var(--washi); border-radius: var(--r-lg); padding: 24px 22px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
          .lh-level-name { font-family: var(--font-jp-display); font-weight: 600; font-size: 22px; }
          .lh-level-count { font-family: var(--font-mono); font-size: 11px; color: oklch(1 0 0 / 0.6); letter-spacing: 0.1em; text-transform: uppercase; }
          .lh-stamp { width: 34px; height: 34px; }
          .lh-stamp img { width: 100%; height: 100%; object-fit: contain; }

          /* Hanko */
          .lh-hanko { font-family: var(--font-jp-display); font-weight: 700; color: #fff; background: var(--vermilion); display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; line-height: 1; box-shadow: 0 2px 0 oklch(0.45 0.18 30 / 0.4); position: relative; }
          .lh-hanko::before { content:""; position:absolute; inset:2px; border:1px solid oklch(1 0 0 / 0.35); border-radius:4px; }

          /* Hanabi */
          .jp-hanabi-container { position: absolute; inset: 0; pointer-events: none; z-index: 100; overflow: hidden; }
          .jp-hanabi-particle { position: absolute; border-radius: 50%; }
          .jp-hanabi-msg { position: absolute; top: 30%; left: 50%; transform: translate(-50%,-50%) scale(0); text-align: center; font-family: var(--font-jp-display); animation: jp-hanabi-pop 2s cubic-bezier(0.175,0.885,0.32,1.275) forwards; white-space: nowrap; }
          .jp-hanabi-jp { font-size: 3rem; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,0.15); }
          .jp-hanabi-en { font-size: 1rem; color: var(--ink-3); font-weight: 600; margin-top: 5px; }
          @keyframes jp-hanabi-pop { 0%{transform:translate(-50%,-50%) scale(0);opacity:0;} 20%{transform:translate(-50%,-50%) scale(1.3);opacity:1;} 40%{transform:translate(-50%,-50%) scale(1);opacity:1;} 80%{transform:translate(-50%,-50%) scale(1);opacity:1;} 100%{transform:translate(-50%,-50%) scale(1.1);opacity:0;} }

          /* Unlock reveal */
          .jp-unlock-card { display: flex; align-items: center; gap: 10px; background: var(--washi); border: 1px solid var(--hairline); border-left: 3px solid var(--moss); border-radius: var(--r-md); padding: 10px 16px; margin-bottom: 8px; opacity: 0; transform: translateY(16px); transition: opacity 0.4s ease, transform 0.4s ease; }
          .jp-unlock-card--animate { opacity: 1; transform: translateY(0); }
          .jp-unlock-card--module { border-left-color: var(--vermilion); }
          .jp-unlock-card-icon { font-size: 1.3rem; flex-shrink: 0; }
          .jp-unlock-card-label { font-size: 0.9rem; font-weight: 700; color: var(--ink); }
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
    function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function getCdnUrl(filepath) { return window.getAssetUrl(REPO_CONFIG, filepath); }
    function proc(text, terms) {
        return window.JPShared.textProcessor.processText(text, terms, termMapData, CONJUGATION_RULES, COUNTER_RULES);
    }

    const SVG_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>';
    const SVG_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
    const SVG_NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    const SVG_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
    const SVG_PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    const SECTION_LABELS = {
        intro: 'Intro', warmup: 'Warmup', kanjiGrid: 'Kanji', vocabList: 'Vocab',
        conversation: 'Conversation', reading: 'Reading', drills: 'Drill'
    };

    async function loadResources() {
        const manifest = await window.getManifest(REPO_CONFIG);
        const conjUrl = getCdnUrl(manifest.globalFiles.conjugationRules);
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

    // ===================================================================
    //  SECTION RENDERERS
    // ===================================================================

    function renderIntro(data) {
        const meta = data.meta || {};
        const kanji = meta.kanji || [];
        const n = (data.id || '').split('.')[1] || '';
        const div = el("div", "");
        div.style.cssText = "padding:28px 22px 40px;position:relative;";
        const ghost = kanji[0] || (data.title || '本')[0];
        let html = '';
        html += '<div class="jp-serif" style="font-size:150px;line-height:0.9;font-weight:500;color:var(--washi-3);position:absolute;right:-10px;top:0;letter-spacing:-0.05em;pointer-events:none;">' + esc(ghost) + '</div>';
        html += '<div class="lh-meta" style="position:relative;">N5 · Lesson ' + esc(n) + '</div>';
        html += '<div class="jp-serif" style="font-size:34px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;margin:8px 0 6px;color:var(--ink);position:relative;">' + esc(data.title) + '</div>';
        if (meta.focus) html += '<div class="lh-lead" style="position:relative;">' + esc(meta.focus) + '</div>';
        if (kanji.length) {
            html += '<div style="height:30px;"></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
            kanji.forEach((k, i) => {
                const filled = i === 0;
                html += '<div class="jp-serif" data-kidx="' + i + '" style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:' + (filled ? 'var(--ink)' : 'var(--washi-2)') + ';color:' + (filled ? 'var(--washi)' : 'var(--ink)') + ';border-radius:10px;border:1px solid var(--hairline);font-size:32px;font-weight:500;">' + esc(k) + '</div>';
            });
            html += '</div>';
        }
        html += '<div style="height:24px;"></div>';
        html += '<div style="padding:18px 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline);display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;">' +
            statCell('New kanji', kanji.length) +
            statCell('Sections', (data.sections ? data.sections.length - 1 : 0)) +
            statCell('Level', 'N5', 'var(--vermilion)') +
        '</div>';
        div.innerHTML = html;
        // make intro kanji tappable to open term modal
        if (kanji.length) {
            div.querySelectorAll('[data-kidx]').forEach(node => {
                const idx = parseInt(node.getAttribute('data-kidx'), 10);
                const ch = kanji[idx];
                let termId = null;
                for (const [key, val] of Object.entries(termMapData)) { if (val.surface === ch && val.type === 'kanji') { termId = key; break; } }
                if (termId) { node.style.cursor = 'pointer'; node.onclick = () => window.JP_OPEN_TERM(termId, false); }
            });
        }
        return div;
    }

    function statCell(label, value, color) {
        return '<div style="text-align:center;padding:2px 4px;">' +
            '<div class="jp-serif" style="font-size:28px;font-weight:600;letter-spacing:-0.02em;color:' + (color || 'var(--ink)') + ';line-height:1;">' + value + '</div>' +
            '<div class="lh-meta" style="font-size:9.5px;margin-top:6px;">' + label + '</div>' +
        '</div>';
    }

    function sectionIntroBlock(meta, title, lead) {
        return '<div style="padding:0 22px;">' +
            '<div class="lh-meta">' + esc(meta) + '</div>' +
            '<h2 class="lh-h2">' + esc(title) + '</h2>' +
            (lead ? '<div class="lh-lead">' + esc(lead) + '</div>' : '') +
        '</div>';
    }

    function makePlayAll(label, lines) {
        const btn = el("button", "lh-playall", '🔊 ' + label);
        function setPlaying(on) { btn.textContent = on ? '⏹ Stop' : '🔊 ' + label; btn.classList.toggle('on', on); }
        btn.onclick = () => {
            if (window.JPShared.tts.isSpeaking()) { window.JPShared.tts.cancel(); setPlaying(false); }
            else { setPlaying(true); window.JPShared.tts.speakLines(lines, { termMap: termMapData, onFinish: () => setPlaying(false) }); }
        };
        return btn;
    }

    function renderWarmup(sec) {
        const div = el("div", "");
        div.style.cssText = "padding:24px 0 32px;";
        div.innerHTML = sectionIntroBlock('Warmup', 'What do you remember?', 'Try to read each sentence aloud, then tap to reveal the meaning.');
        const wrap = el("div", "");
        wrap.style.cssText = "padding:20px 22px 0;display:flex;flex-direction:column;gap:12px;";
        (sec.items || []).forEach((item, idx) => {
            const card = el("div", "");
            card.style.cssText = "padding:16px 18px;border-radius:var(--r-md);background:var(--washi);border:1px solid var(--hairline);position:relative;";
            const revealed = !!item._rev;
            card.innerHTML =
                '<div style="display:flex;align-items:flex-start;gap:10px;">' +
                  '<div class="jp-serif" style="flex:1;font-size:19px;font-weight:500;color:var(--ink);line-height:1.5;">' + proc(item.jp, item.terms) + '</div>' +
                  '<button class="lh-speak" title="Listen">🔊</button>' +
                '</div>' +
                (revealed
                  ? '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--hairline);font-size:13px;color:var(--ink-2);line-height:1.5;">' + esc(item.en) + '</div>'
                  : '<button class="lh-reveal jp-mono" style="margin-top:10px;background:none;border:none;padding:0;font-size:11px;color:var(--vermilion);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;">Tap to reveal →</button>');
            card.querySelector('.lh-speak').onclick = (e) => { e.stopPropagation(); window.JPShared.tts.speak(item.jp, { terms: item.terms, termMap: termMapData }); };
            const rev = card.querySelector('.lh-reveal');
            if (rev) rev.onclick = () => { item._rev = true; renderCurrentStep(); };
            wrap.appendChild(card);
        });
        div.appendChild(wrap);
        return div;
    }

    function renderKanjiFlip(sec) {
        const items = sec.items || [];
        if (kanjiSel >= items.length) kanjiSel = 0;
        const div = el("div", "");
        div.style.cssText = "padding:24px 0 32px;";
        div.innerHTML = sectionIntroBlock('New Kanji · ' + items.length + ' characters', 'あたらしい かんじ', '');

        // strip
        const strip = el("div", "");
        strip.style.cssText = "display:flex;gap:8px;padding:18px 22px 0;overflow-x:auto;";
        strip.className = "noscroll";
        items.forEach((k, i) => {
            const kanjiId = k.termId || (k.terms || []).find(id => termMapData[id] && termMapData[id].type === "kanji");
            const t = kanjiId ? termMapData[kanjiId] : null;
            const ch = (t && t.surface) || k.kanji || '';
            const on = i === kanjiSel;
            const b = el("button", "jp-serif", ch);
            b.style.cssText = "flex-shrink:0;width:66px;height:66px;padding:0;border-radius:10px;background:" + (on ? 'var(--ink)' : 'var(--washi)') + ";color:" + (on ? 'var(--washi)' : 'var(--ink)') + ";border:1px solid " + (on ? 'var(--ink)' : 'var(--hairline)') + ";font-size:36px;font-weight:500;cursor:pointer;transition:all 0.15s;";
            b.onclick = () => { kanjiSel = i; renderCurrentStep(); };
            strip.appendChild(b);
        });
        div.appendChild(strip);

        // focus card
        const sk = items[kanjiSel] || {};
        const kanjiId = sk.termId || (sk.terms || []).find(id => termMapData[id] && termMapData[id].type === "kanji");
        const t = kanjiId ? termMapData[kanjiId] : null;
        const ch = (t && t.surface) || sk.kanji || '';
        const card = el("div", "");
        card.style.cssText = "margin:22px 22px 0;padding:24px 22px;background:var(--washi);border:1px solid var(--hairline);border-radius:var(--r-lg);position:relative;overflow:hidden;";
        let exampleHtml = '';
        if (t && (t.example || t.exampleJp)) {
            exampleHtml = '<div style="margin-top:16px;position:relative;"><div class="lh-meta">Example</div>' +
                '<div class="jp-serif" style="font-size:20px;font-weight:500;margin-top:6px;color:var(--ink);">' + esc(t.exampleJp || t.example) + '</div>' +
                (t.exampleEn ? '<div style="font-size:12.5px;color:var(--ink-3);margin-top:3px;">' + esc(t.exampleEn) + '</div>' : '') +
            '</div>';
        }
        card.innerHTML =
            '<div class="jp-serif" style="position:absolute;right:-20px;top:-30px;font-size:220px;line-height:1;color:var(--washi-3);font-weight:500;pointer-events:none;user-select:none;">' + esc(ch) + '</div>' +
            '<div class="jp-mono" style="font-size:10px;color:var(--vermilion);letter-spacing:0.18em;font-weight:600;position:relative;">' + String(kanjiSel + 1).padStart(2, "0") + ' / ' + String(items.length).padStart(2, "0") + '</div>' +
            '<div class="jp-serif lh-kbig" style="font-size:76px;line-height:1;margin:6px 0 10px;color:var(--ink);font-weight:500;position:relative;cursor:' + (kanjiId ? 'pointer' : 'default') + ';">' + esc(ch) + '</div>' +
            '<div style="font-size:16px;color:var(--ink);font-weight:600;letter-spacing:-0.01em;position:relative;">' + esc((t && t.meaning) || '') + '</div>' +
            '<div style="height:16px;"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--hairline);border-radius:6px;overflow:hidden;position:relative;">' +
              readingCell("On'yomi", (t && t.on) || '—') +
              readingCell("Kun'yomi", (t && t.kun) || '—') +
            '</div>' +
            exampleHtml;
        if (kanjiId) { const big = card.querySelector('.lh-kbig'); big.onclick = () => window.JP_OPEN_TERM(kanjiId, false); }
        div.appendChild(card);
        const hint = el("div", "lh-meta");
        hint.style.cssText = "text-align:center;margin-top:20px;";
        hint.textContent = "Tap a character above";
        div.appendChild(hint);
        return div;
    }

    function readingCell(label, reading) {
        return '<div style="background:var(--washi);padding:10px 12px;">' +
            '<div class="lh-meta" style="font-size:9.5px;">' + label + '</div>' +
            '<div class="jp-sans" style="font-size:16px;color:var(--ink);margin-top:3px;font-weight:500;">' + esc(reading) + '</div>' +
        '</div>';
    }

    function renderVocab(sec) {
        const div = el("div", "");
        div.style.cssText = "padding:24px 0 32px;";
        const total = (sec.groups || []).reduce((a, g) => a + (g.items || []).length, 0);
        div.innerHTML = sectionIntroBlock('Vocabulary · ' + total + ' words', 'ことば', 'Tap a word to hear it.');
        const holder = el("div", "");
        holder.style.cssText = "margin-top:22px;";
        (sec.groups || []).forEach((g, gi) => {
            const grp = el("div", "");
            grp.style.cssText = "margin-bottom:18px;";
            grp.innerHTML = '<div style="padding:0 22px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">' +
                '<div class="lh-meta" style="font-size:10px;">' + String(gi + 1).padStart(2, "0") + '</div>' +
                '<div class="jp-serif" style="font-size:14px;font-weight:600;color:var(--ink);">' + esc(g.label || '') + '</div>' +
                '<div style="flex:1;height:1px;background:var(--hairline);"></div></div>';
            (g.items || []).forEach((ref, vi) => {
                const t = (typeof ref === 'string') ? termMapData[ref] : null;
                if (!t) return;
                const row = el("button", "");
                row.style.cssText = "width:100%;padding:12px 22px;border:none;border-bottom:1px solid var(--hairline-2);background:transparent;display:flex;align-items:center;gap:14px;cursor:pointer;text-align:left;";
                row.innerHTML =
                    '<span class="lh-speak">' + SVG_PLAY + '</span>' +
                    '<span style="flex:1;min-width:0;">' +
                      '<span style="display:flex;align-items:baseline;gap:8px;">' +
                        '<span class="jp-serif lh-vword" style="font-size:20px;font-weight:500;color:var(--ink);">' + esc(t.surface) + '</span>' +
                        '<span class="jp-sans" style="font-size:11.5px;color:var(--ink-3);">' + esc(t.reading || '') + '</span>' +
                      '</span>' +
                      '<span style="display:block;font-size:12.5px;color:var(--ink-2);margin-top:2px;">' + esc(t.meaning || '') + '</span>' +
                    '</span>' +
                    '<span class="jp-mono" style="font-size:10px;color:var(--ink-3);">' + String(vi + 1).padStart(2, "0") + '</span>';
                row.onclick = () => window.JPShared.tts.speak(t.surface, { termMap: termMapData });
                row.querySelector('.lh-vword').onclick = (e) => { e.stopPropagation(); window.JP_OPEN_TERM(t.id, false); };
                grp.appendChild(row);
            });
            holder.appendChild(grp);
        });
        div.appendChild(holder);
        return div;
    }

    function renderConversation(sec) {
        const div = el("div", "");
        div.style.cssText = "padding:24px 0 32px;";
        const head = el("div", "");
        head.style.cssText = "padding:0 22px;";
        head.innerHTML =
            '<div class="lh-meta">Conversation</div>' +
            (sec.title ? '<h2 class="lh-h2" style="font-size:24px;">' + esc(sec.title) + '</h2>' : '') +
            (sec.context ? '<div style="display:flex;gap:10px;padding:10px 12px;margin-top:4px;border-left:2px solid var(--vermilion);background:var(--washi);"><div style="font-size:12.5px;color:var(--ink-2);line-height:1.5;font-style:italic;">' + esc(sec.context) + '</div></div>' : '');
        const enToggle = el("button", "jp-mono");
        enToggle.style.cssText = "margin-top:14px;padding:6px 12px;background:transparent;border:1px solid var(--hairline);border-radius:999px;color:var(--ink-2);font-size:11.5px;letter-spacing:0.06em;cursor:pointer;text-transform:uppercase;font-weight:500;";
        enToggle.textContent = (showEN ? 'Hide' : 'Show') + ' English';
        enToggle.onclick = () => { showEN = !showEN; renderCurrentStep(); };
        head.appendChild(enToggle);
        div.appendChild(head);

        const allLines = [];
        const msgWrap = el("div", "");
        msgWrap.style.cssText = "padding:20px 14px 0;display:flex;flex-direction:column;gap:12px;";
        (sec.lines || []).forEach(line => {
            allLines.push({ jp: line.jp, terms: line.terms });
            const spk = String(line.spk || '');
            const isRikizo = /りき|リキ|rikizo|力/i.test(spk);
            const wrap = el("div", "");
            wrap.style.cssText = "display:flex;gap:8px;align-items:flex-end;flex-direction:" + (isRikizo ? 'row-reverse' : 'row') + ";";
            const bubbleBg = isRikizo ? 'var(--ink)' : 'var(--washi)';
            const bubbleColor = isRikizo ? 'var(--washi)' : 'var(--ink)';
            const radius = isRikizo ? '16px 16px 3px 16px' : '16px 16px 16px 3px';
            const labelColor = isRikizo ? 'oklch(0.97 0.008 80 / 0.6)' : 'var(--ink-3)';
            const enColor = isRikizo ? 'oklch(0.97 0.008 80 / 0.7)' : 'var(--ink-3)';
            wrap.innerHTML =
                '<div style="width:32px;height:32px;border-radius:999px;background:var(--washi-2);border:1px solid var(--hairline);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font-jp);font-size:13px;color:var(--ink-2);">' + esc(spk.slice(0, 1)) + '</div>' +
                '<div style="max-width:78%;padding:10px 14px;background:' + bubbleBg + ';color:' + bubbleColor + ';border:' + (isRikizo ? 'none' : '1px solid var(--hairline)') + ';border-radius:' + radius + ';position:relative;">' +
                  '<div class="jp-mono" style="font-size:9px;letter-spacing:0.1em;color:' + labelColor + ';text-transform:uppercase;font-weight:500;margin-bottom:3px;display:flex;justify-content:space-between;gap:8px;align-items:center;"><span>' + esc(spk) + '</span><button class="lh-speak-line" style="background:none;border:none;color:inherit;cursor:pointer;font-size:12px;padding:0;opacity:0.8;">🔊</button></div>' +
                  '<div class="jp-serif" style="font-size:15px;line-height:1.5;font-weight:500;">' + proc(line.jp, line.terms) + '</div>' +
                  (showEN ? '<div style="font-size:11.5px;margin-top:4px;line-height:1.45;color:' + enColor + ';font-style:italic;">' + esc(line.en) + '</div>' : '') +
                '</div>';
            wrap.querySelector('.lh-speak-line').onclick = () => window.JPShared.tts.speak(line.jp, { terms: line.terms, termMap: termMapData });
            msgWrap.appendChild(wrap);
        });
        // play-all sits above messages
        const playAll = makePlayAll('Play conversation', allLines);
        const paWrap = el("div", ""); paWrap.style.cssText = "padding:16px 22px 0;"; paWrap.appendChild(playAll);
        div.appendChild(paWrap);
        div.appendChild(msgWrap);
        return div;
    }

    function renderReading(sec) {
        const passage = sec.passage || [];
        const div = el("div", "");
        div.style.cssText = "padding:24px 0 32px;";
        const head = el("div", ""); head.style.cssText = "padding:0 22px;";
        head.innerHTML =
            '<div class="lh-meta">Reading</div>' +
            (sec.title ? '<h2 class="lh-h2" style="font-size:24px;">' + esc(sec.title) + '</h2>' : '') +
            '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;" class="lh-meta"><span>Tap a line to translate</span><div style="flex:1;height:1px;background:var(--hairline);"></div></div>';
        const revealAll = el("button", "jp-mono");
        revealAll.style.cssText = "margin-top:8px;padding:4px 10px;border-radius:999px;background:transparent;border:1px solid var(--hairline);color:var(--vermilion);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;cursor:pointer;";
        revealAll.textContent = 'Reveal all';
        revealAll.onclick = () => { passage.forEach(p => { p._rev = true; }); renderCurrentStep(); };
        head.appendChild(revealAll);
        div.appendChild(head);

        const playAll = makePlayAll('Play passage', passage.map(p => ({ jp: p.jp, terms: p.terms })));
        const paWrap = el("div", ""); paWrap.style.cssText = "padding:16px 22px 0;"; paWrap.appendChild(playAll);
        div.appendChild(paWrap);

        const sheetWrap = el("div", ""); sheetWrap.style.cssText = "padding:0 22px;";
        const sheet = el("div", "");
        sheet.style.cssText = "position:relative;background:var(--washi);border:1px solid var(--hairline);border-radius:var(--r-lg);padding:22px 22px 20px;overflow:hidden;";
        let lines = '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--vermilion);"></div>' +
            '<div style="position:absolute;right:14px;top:14px;"><span class="lh-hanko jp-serif" style="width:40px;height:40px;font-size:19px;transform:rotate(-8deg);">読</span></div>' +
            '<div class="lh-meta" style="font-size:9.5px;margin-bottom:12px;padding-left:6px;">Passage</div>' +
            '<div style="display:flex;flex-direction:column;gap:2px;padding-left:6px;">';
        passage.forEach((p, i) => {
            const on = !!p._rev;
            lines += '<button class="lh-pline" data-i="' + i + '" style="text-align:left;padding:10px 6px;background:transparent;border:none;border-bottom:' + (i < passage.length - 1 ? '1px dashed var(--hairline-2)' : 'none') + ';cursor:pointer;display:flex;gap:10px;align-items:flex-start;">' +
                '<span class="jp-mono" style="font-size:10px;color:' + (on ? 'var(--vermilion)' : 'var(--ink-3)') + ';letter-spacing:0.1em;font-weight:600;width:18px;flex-shrink:0;padding-top:6px;">' + String(i + 1).padStart(2, "0") + '</span>' +
                '<span style="flex:1;min-width:0;"><span class="jp-serif" style="display:block;font-size:18px;line-height:1.55;font-weight:500;color:var(--ink);">' + proc(p.jp, p.terms) + '</span>' +
                (on ? '<span style="display:block;font-size:12.5px;line-height:1.5;color:var(--ink-2);margin-top:4px;font-style:italic;">' + esc(p.en) + '</span>' : '') +
                '</span></button>';
        });
        lines += '</div>';
        sheet.innerHTML = lines;
        sheet.querySelectorAll('.lh-pline').forEach(btn => {
            const i = parseInt(btn.getAttribute('data-i'), 10);
            // term taps inside should not toggle; only toggle when tapping non-term area
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.jp-term')) return;
                passage[i]._rev = !passage[i]._rev; renderCurrentStep();
            });
        });
        sheetWrap.appendChild(sheet);
        div.appendChild(sheetWrap);

        if (sec.questions && sec.questions.length) {
            const qWrap = el("div", ""); qWrap.style.cssText = "padding:26px 22px 0;";
            qWrap.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div class="lh-meta">Comprehension</div><div style="flex:1;height:1px;background:var(--hairline);"></div><div class="lh-meta" style="font-size:10px;">' + sec.questions.length + ' 問</div></div>';
            const qList = el("div", ""); qList.style.cssText = "display:flex;flex-direction:column;gap:10px;";
            sec.questions.forEach((q, i) => {
                const card = el("div", "");
                card.style.cssText = "border:1px solid var(--hairline);border-radius:var(--r-md);background:var(--washi);overflow:hidden;";
                const shown = !!q._ans;
                const aHtml = q.a_terms ? proc(q.a, q.a_terms) : esc(q.a);
                card.innerHTML =
                    '<div style="padding:12px 14px 10px;">' +
                      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
                        '<div class="jp-mono" style="font-size:10px;color:var(--vermilion);letter-spacing:0.1em;font-weight:700;width:20px;flex-shrink:0;padding-top:4px;">Q' + (i + 1) + '</div>' +
                        '<div style="flex:1;"><div class="jp-serif" style="font-size:15.5px;line-height:1.5;font-weight:500;color:var(--ink);">' + proc(q.q, q.terms) + '</div>' +
                          (q.q_en ? '<div style="font-size:11.5px;color:var(--ink-3);margin-top:2px;font-style:italic;">' + esc(q.q_en) + '</div>' : '') + '</div>' +
                      '</div>' +
                      (shown ? '' : '<button class="lh-showans jp-mono" style="margin-top:10px;margin-left:30px;padding:6px 12px;border-radius:999px;background:transparent;border:1px solid var(--hairline);color:var(--ink-2);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;cursor:pointer;">Show answer</button>') +
                    '</div>' +
                    (shown ? '<div style="padding:10px 14px 12px 44px;border-top:1px dashed var(--hairline-2);background:var(--washi-2);">' +
                        '<div class="jp-mono" style="font-size:9.5px;color:var(--moss);letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:3px;">答え · Answer</div>' +
                        '<div class="jp-serif" style="font-size:15px;line-height:1.5;font-weight:500;color:var(--ink);">' + aHtml + '</div>' +
                        (q.a_en ? '<div style="font-size:11.5px;color:var(--ink-3);margin-top:2px;font-style:italic;">' + esc(q.a_en) + '</div>' : '') +
                    '</div>' : '');
                const showBtn = card.querySelector('.lh-showans');
                if (showBtn) showBtn.onclick = () => { q._ans = true; renderCurrentStep(); };
                qList.appendChild(card);
            });
            qWrap.appendChild(qList);
            div.appendChild(qWrap);
        }
        return div;
    }

    function renderDrills(sec) {
        const div = el("div", "");
        div.style.cssText = "padding:24px 22px 32px;";
        const mcqs = (sec.items || []).filter(it => it.kind === 'mcq');
        div.innerHTML = '<div class="lh-meta">Drill · ' + mcqs.length + ' question' + (mcqs.length !== 1 ? 's' : '') + '</div>' +
            '<h2 class="lh-h2">Fill the slot</h2>' +
            '<div class="lh-lead">Pick the choice that completes each sentence.</div><div style="height:24px;"></div>';
        const list = el("div", ""); list.style.cssText = "display:flex;flex-direction:column;gap:24px;";
        mcqs.forEach((item, itemIdx) => {
            const block = el("div", "");
            const itemKey = 'drill__' + itemIdx + '__' + item.q;
            let solved = drillAnswered.has(itemKey);

            // Build prompt with a blank slot from the bracketed answer
            const hasBracket = /\[(.*?)\]/.test(item.q);
            let promptHtml;
            if (hasBracket) {
                const m = item.q.match(/\[(.*?)\]/);
                const before = item.q.slice(0, m.index);
                const after = item.q.slice(m.index + m[0].length);
                promptHtml = esc(before) +
                    '<span class="lh-slot" style="display:inline-block;min-width:64px;padding:4px 14px;margin:0 6px;border-radius:8px;vertical-align:middle;background:var(--washi-3);border:2px dashed var(--ink-3);color:transparent;font-weight:600;">_</span>' +
                    esc(after);
            } else {
                promptHtml = proc(item.q, item.terms);
            }

            const card = el("div", "lh-card");
            card.style.cssText = "padding:24px 22px;position:relative;";
            card.innerHTML = '<div class="jp-serif" style="font-size:22px;line-height:1.6;font-weight:500;color:var(--ink);text-align:center;">' + promptHtml + '</div>';
            block.appendChild(card);

            const grid = el("div", "");
            grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;";
            const choices = [...item.choices].sort(() => Math.random() - 0.5);
            const expHolder = el("div", "");

            choices.forEach(choice => {
                const b = el("button", "jp-serif");
                b.style.cssText = "padding:20px 16px;border-radius:var(--r-md);background:var(--washi);color:var(--ink);border:1px solid var(--hairline);font-size:22px;font-weight:500;cursor:pointer;transition:all 0.15s;";
                b.textContent = choice;
                b.onclick = () => {
                    if (solved) return; solved = true;
                    const correct = choice === item.answer;
                    // fill slot
                    const slot = card.querySelector('.lh-slot');
                    if (slot) { slot.style.color = 'var(--ink)'; slot.style.border = 'none'; slot.style.background = correct ? 'oklch(0.88 0.08 140)' : 'oklch(0.88 0.08 30)'; slot.textContent = choice; }
                    Array.from(grid.children).forEach(cn => {
                        if (cn.textContent === item.answer) { cn.style.background = 'var(--moss)'; cn.style.color = 'var(--washi)'; cn.style.border = 'none'; }
                        else if (cn === b && !correct) { cn.style.background = 'var(--vermilion)'; cn.style.color = 'var(--washi)'; cn.style.border = 'none'; }
                    });
                    if (!drillAnswered.has(itemKey)) {
                        drillAnswered.add(itemKey);
                        if (correct) drillCorrect++;
                    }
                    if (!correct && item.terms && item.terms.length) {
                        item.terms.forEach(termId => {
                            const rootTerm = window.JPShared.textProcessor.getRootTerm(termId, termMapData);
                            if (rootTerm) window.JPShared.progress.flagTerm(rootTerm.surface);
                        });
                    }
                    const explainText = item.explain || item.explanation;
                    expHolder.innerHTML = '<div style="margin-top:18px;padding:14px 16px;border-radius:var(--r-md);background:' + (correct ? 'oklch(0.94 0.04 140)' : 'oklch(0.94 0.04 30)') + ';border:1px solid ' + (correct ? 'oklch(0.75 0.08 140)' : 'oklch(0.75 0.08 30)') + ';">' +
                        '<div class="jp-mono" style="font-size:10px;letter-spacing:0.14em;font-weight:600;color:' + (correct ? 'oklch(0.4 0.1 140)' : 'oklch(0.45 0.14 30)') + ';text-transform:uppercase;margin-bottom:4px;">' + (correct ? '正解 · Correct' : 'もう一度 · Not quite') + '</div>' +
                        (explainText ? '<div style="font-size:13px;color:var(--ink);line-height:1.5;">' + esc(explainText) + '</div>' : '<div style="font-size:13px;color:var(--ink);line-height:1.5;">Answer: <strong>' + esc(item.answer) + '</strong></div>') +
                    '</div>';
                };
                grid.appendChild(b);
            });
            block.appendChild(grid);
            block.appendChild(expHolder);
            list.appendChild(block);
        });
        div.appendChild(list);
        return div;
    }

    // --- Summary helpers ---
    function buildUnlockReveal(items) {
        const wrap = el('div', '');
        wrap.style.cssText = "margin-top:20px;";
        const heading = el('div', 'lh-meta');
        heading.style.cssText = "text-align:center;margin-bottom:12px;color:var(--vermilion);font-size:11px;";
        heading.textContent = '🎁 Unlocked';
        wrap.appendChild(heading);
        items.forEach(function(item, i) {
            const card = el('div', 'jp-unlock-card');
            if (item.type === 'module') card.classList.add('jp-unlock-card--module');
            card.innerHTML = '<span class="jp-unlock-card-icon">' + item.icon + '</span><span class="jp-unlock-card-label">' + esc(item.label) + '</span>';
            wrap.appendChild(card);
            setTimeout(function() { requestAnimationFrame(function() { card.classList.add('jp-unlock-card--animate'); }); }, i * 150);
        });
        return wrap;
    }

    function buildEncouragement(pending) {
        const wrap = el('div', '');
        wrap.style.cssText = "margin-top:18px;";
        let html = '<div style="text-align:center;padding:16px;background:oklch(0.96 0.04 85);border:1px solid var(--hairline);border-radius:var(--r-md);margin-bottom:12px;">' +
                   '<div style="font-size:1.4rem;">💪</div>' +
                   '<div style="font-size:1rem;font-weight:700;color:var(--ink);margin:4px 0;">Keep going!</div>' +
                   '<div style="font-size:0.85rem;color:var(--ink-2);">Score <strong>60% or higher</strong> to unlock:</div>';
        if (pending.length > 0) {
            html += '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">';
            pending.forEach(function(item) {
                html += '<div style="background:var(--washi);border:1px solid var(--hairline);border-radius:8px;padding:6px 12px;font-size:0.8rem;font-weight:600;color:var(--ink);">' + item.icon + ' ' + esc(item.label) + '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        wrap.innerHTML = html;
        return wrap;
    }

    function renderSummary(body, footer) {
        const pct = drillTotal > 0 ? Math.round(drillCorrect / drillTotal * 100) : 100;
        const rank = [...SCORE_RANKS].reverse().find(r => pct >= r.min) || SCORE_RANKS[0];
        const kanji = (lessonData.meta && lessonData.meta.kanji) || [];

        const card = el("div", "");
        card.style.cssText = "padding:32px 22px 8px;text-align:center;position:relative;";
        let kanjiTiles = kanji.map(k => '<div class="jp-serif" style="width:38px;height:38px;background:var(--ink);color:var(--washi);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:500;">' + esc(k) + '</div>').join('');
        card.innerHTML =
            '<div class="jp-serif" style="font-size:52px;line-height:1;margin-bottom:14px;font-weight:500;color:var(--ink);">おつかれさま</div>' +
            '<div class="lh-meta">You finished ' + esc(lessonData.title || '') + '</div>' +
            '<div style="height:24px;"></div>' +
            '<div class="lh-summary-seal" style="display:flex;justify-content:center;margin-bottom:22px;"><span class="lh-hanko jp-serif" style="width:72px;height:72px;font-size:34px;transform:rotate(-6deg);">合</span></div>' +
            '<div class="lh-card" style="padding:20px 18px;">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;">' +
                statCell('Score', pct + '%', 'var(--vermilion)') +
                statCell('Correct', drillTotal > 0 ? (drillCorrect + '/' + drillTotal) : '—') +
                statCell('Kanji', kanji.length) +
              '</div>' +
              (kanji.length ? '<div style="height:16px;"></div><div style="height:1px;background:var(--hairline);"></div><div style="height:14px;"></div>' +
                '<div style="text-align:left;"><div class="lh-meta">You learned</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' + kanjiTiles + '</div></div>' : '') +
            '</div>';

        const holder = el("div", ""); holder.style.cssText = "padding:0 22px 24px;";
        holder.appendChild(card);
        body.appendChild(holder);

        if (drillTotal > 0) {
            const seal = card.querySelector('.lh-summary-seal');
            launchHanabi(rank, seal);
        }

        // Record streak activity on lesson completion
        if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();

        const unlock = window.JPShared && window.JPShared.unlock;
        let result = null;
        if (unlock && manifestData && lessonData && lessonData.id) {
            result = unlock.computeUnlocks(lessonData.id, pct, manifestData);
        }

        // Footer buttons
        footer.innerHTML = '';
        const backBtn = el("button", "lh-btn-back", SVG_BACK + ' Menu');
        const nextBtn = el("button", "lh-btn-next finish", 'Finish ' + SVG_CHECK);

        if (!unlock || unlock.isFree() || !result) {
            nextBtn.onclick = () => renderMenu(currentLevelId, currentLevelLessons);
            footer.appendChild(nextBtn);
            return;
        }

        if (result.passed) {
            nextBtn.innerHTML = 'Continue ' + SVG_NEXT;
            nextBtn.classList.remove('finish');
            nextBtn.onclick = () => renderMenu(currentLevelId, currentLevelLessons);
            if (result.newItems && result.newItems.length > 0) holder.appendChild(buildUnlockReveal(result.newItems));
            footer.appendChild(nextBtn);
        } else {
            const pending = unlock.getPendingUnlocks(lessonData.id, manifestData);
            holder.appendChild(buildEncouragement(pending));
            backBtn.onclick = () => renderMenu(currentLevelId, currentLevelLessons);
            nextBtn.classList.remove('finish');
            nextBtn.innerHTML = 'Try again';
            nextBtn.onclick = () => {
                const entry = currentLevelLessons && currentLevelLessons.find(l => l.id === lessonData.id);
                if (entry) loadLesson(entry.file);
            };
            footer.appendChild(backBtn);
            footer.appendChild(nextBtn);
        }
    }

    // ===================================================================
    //  SHELL: header + footer + navigation
    // ===================================================================

    function headerHtml(opts) {
        // opts: { back: 'levels'|'list'|null, title, code, count, rail }
        const left = opts.backLabel
            ? '<button class="lh-x lh-back-btn" title="' + esc(opts.backLabel) + '">' + SVG_BACK + '</button>'
            : '<button class="lh-x lh-exit-btn" title="Exit">' + SVG_X + '</button>';
        return '<div class="lh-row">' + left +
            '<div style="flex:1;min-width:0;">' +
              (opts.code ? '<div class="lh-code">' + esc(opts.code) + '</div>' : '') +
              '<div class="lh-title">' + esc(opts.title) + '</div>' +
            '</div>' +
            (opts.count ? '<div class="lh-count">' + esc(opts.count) + '</div>' : '') +
            '<button class="lh-gear" title="Voice Settings">⚙</button>' +
        '</div>' + (opts.rail || '');
    }

    function railHtml() {
        let segs = '';
        const idx = Math.min(currentStep, totalSteps - 1);
        for (let i = 0; i < totalSteps; i++) {
            const bg = i < idx ? 'var(--ink)' : (i === idx ? 'var(--vermilion)' : 'var(--hairline)');
            segs += '<button class="lh-seg" data-i="' + i + '"><div style="background:' + bg + ';"></div></button>';
        }
        return '<div class="lh-rail">' + segs + '</div>';
    }

    // --- Logic ---
    async function fetchLessonList() {
        root.innerHTML = '<div class="lh-header">' + headerHtml({ title: 'Library' }) + '</div>' +
            '<div class="lh-body"><div class="lh-list" style="color:var(--ink-3);text-align:center;padding-top:40px;">Loading…</div></div>';
        wireHeader({});
        try {
          const manifest = await window.getManifest(REPO_CONFIG);
          manifestData = manifest;
          const levelsData = [];
          (manifest.levels || []).forEach(level => {
            const levelData = manifest.data && manifest.data[level];
            if (!levelData || !levelData.lessons) return;
            const lessons = levelData.lessons.map(l => ({ id: l.id, title: l.title, file: l.file, unlocksAfter: l.unlocksAfter }));
            lessons.sort((a, b) => {
              const partsA = a.id.replace('N','').split('.').map(Number);
              const partsB = b.id.replace('N','').split('.').map(Number);
              return partsB[1] - partsA[1];
            });
            levelsData.push({ level, levelNum: parseInt(level.replace('N','')), lessons });
          });
          levelsData.sort((a, b) => a.levelNum - b.levelNum);
          allLevelsData = levelsData;
          renderLevelPicker();
        } catch (err) {
          root.innerHTML = '<div class="lh-body"><div class="lh-list" style="color:var(--vermilion);text-align:center;padding-top:40px;"><h3>Error</h3><p>' + esc(err.message) + '</p></div></div>';
        }
    }

    function renderLevelPicker() {
        root.innerHTML = '<div class="lh-header">' + headerHtml({ title: 'Library' }) + '</div>' +
            '<div class="lh-body"><div class="lh-list" id="jp-level-container"></div></div>';
        wireHeader({});
        const cont = document.getElementById('jp-level-container');
        const unlockApi = window.JPShared && window.JPShared.unlock;
        allLevelsData.forEach(({ level, levelNum, lessons }) => {
          if (level === 'N4' && unlockApi && !unlockApi.isFree() && !unlockApi.isN4Unlocked()) return;
          const visibleCount = lessons.filter(l => !unlockApi || unlockApi.isFree() || unlockApi.isLessonUnlocked(l)).length;
          const card = el('div', 'lh-level');
          card.innerHTML = '<div><div class="lh-level-name">JLPT N' + levelNum + '</div><div class="lh-level-count" style="margin-top:4px;">' + visibleCount + ' lesson' + (visibleCount !== 1 ? 's' : '') + '</div></div>' +
            '<svg width="10" height="16" viewBox="0 0 10 14" fill="none" style="color:oklch(1 0 0 / 0.5)"><path d="M1 1l7 6-7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          card.onclick = () => renderMenu(level, lessons);
          cont.appendChild(card);
        });
    }

    function renderMenu(level, lessons) {
        currentLevelId = level;
        currentLevelLessons = lessons;
        const levelNum = level.replace('N', '');
        root.innerHTML = '<div class="lh-header">' + headerHtml({ title: 'JLPT N' + levelNum, backLabel: 'Levels' }) + '</div>' +
            '<div class="lh-body"><div class="lh-list" id="jp-menu-container"></div></div>';
        wireHeader({ back: () => renderLevelPicker() });
        const menuEl = document.getElementById('jp-menu-container');
        const unlockApi = window.JPShared && window.JPShared.unlock;
        const visibleLessons = lessons.filter(l => !unlockApi || unlockApi.isFree() || unlockApi.isLessonUnlocked(l));
        const stampApi = window.JPShared && window.JPShared.stampSettings;
        const stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
        const pooUrl = stampApi && stampApi.getPooUrl ? stampApi.getPooUrl() : '';

        visibleLessons.forEach(lesson => {
          const btn = el("div", "lh-item");
          let right = '<span class="jp-mono" style="font-size:11px;color:var(--ink-3);">→</span>';
          const score = unlockApi ? unlockApi.getLessonScore(lesson.id) : 0;
          const completed = unlockApi && unlockApi.isCompleted(lesson.id);
          if (completed && score > 0 && (stampUrl || pooUrl)) {
            const passing = score >= 60;
            const tilt = Math.floor(Math.random() * 41) - 20;
            right = '<span class="jp-mono" style="font-size:11px;font-weight:700;color:' + (passing ? 'var(--moss)' : 'var(--ink-3)') + ';">' + score + '%</span>' +
                    '<span class="lh-stamp"><img src="' + (passing ? stampUrl : (pooUrl || stampUrl)) + '" style="transform:rotate(' + tilt + 'deg);" alt=""></span>';
          }
          btn.innerHTML = '<div class="lh-item-id">' + esc(lesson.id) + '</div>' +
            '<div class="lh-item-name">' + esc(lesson.title || 'Start') + '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' + right + '</div>';
          btn.onclick = () => loadLesson(lesson.file);
          menuEl.appendChild(btn);
        });
    }

    async function loadLesson(filePath) {
        root.innerHTML = '<div class="lh-header">' + headerHtml({ title: 'Loading…', backLabel: 'List' }) + '</div>' +
            '<div class="lh-body"><div class="lh-list" style="color:var(--ink-3);text-align:center;padding-top:40px;">Loading…</div></div>' +
            '<div class="lh-footer"></div>';
        wireHeader({ back: () => renderMenu(currentLevelId, currentLevelLessons) });
        try {
          const lessonUrl = getCdnUrl(filePath);
          const [lRes, resources] = await Promise.all([fetch(lessonUrl), loadResources()]);
          lessonData = await lRes.json();
          drillCorrect = 0; drillTotal = 0; drillAnswered.clear(); kanjiSel = 0;
          lessonData.sections.forEach(sec => {
              if (sec.type === 'drills') (sec.items || []).forEach(item => { if (item.kind === 'mcq') drillTotal++; });
          });
          termMapData = resources.map;
          CONJUGATION_RULES = resources.conj;
          COUNTER_RULES = resources.counter;
          window.JPShared.termModal.setTermMap(termMapData);

          lessonData.sections.unshift({ type: 'intro', title: lessonData.title });
          currentStep = 0; totalSteps = lessonData.sections.length; showEN = false; showAnswers = false;
          renderCurrentStep();
        } catch (err) {
           console.error(err);
           root.querySelector('.lh-body').innerHTML = '<div class="lh-list" style="color:var(--vermilion);text-align:center;padding-top:40px;">Error loading lesson.</div>';
        }
    }

    function go(step) {
        const clamped = Math.max(0, Math.min(totalSteps, step));
        if (clamped === currentStep) return;
        currentStep = clamped;
        showEN = false; showAnswers = false;
        renderCurrentStep();
    }

    function wireHeader(opts) {
        const exit = root.querySelector('.lh-exit-btn');
        if (exit) exit.onclick = exitCallback;
        const back = root.querySelector('.lh-back-btn');
        if (back) back.onclick = opts.back || exitCallback;
        const gear = root.querySelector('.lh-gear');
        if (gear) gear.onclick = () => window.JPShared.ttsSettings && window.JPShared.ttsSettings.open();
        root.querySelectorAll('.lh-seg').forEach(seg => {
            seg.onclick = () => go(parseInt(seg.getAttribute('data-i'), 10));
        });
    }

    function renderCurrentStep() {
        const isSummary = currentStep >= lessonData.sections.length;
        const idx = Math.min(currentStep, totalSteps - 1);
        const sec = isSummary ? null : lessonData.sections[currentStep];
        const title = isSummary ? 'Summary' : (sec.type === 'intro' ? lessonData.title : (sec.title || SECTION_LABELS[sec.type] || ''));
        const lessonNum = (lessonData.id || '').split('.')[1] || '';

        root.innerHTML = '<div class="lh-header">' + headerHtml({
            title: title,
            code: 'N5 · LESSON ' + lessonNum,
            count: (idx + 1) + '/' + totalSteps,
            backLabel: null,
            rail: railHtml()
        }) + '</div>' +
        '<div class="lh-body"></div>' +
        '<div class="lh-footer"></div>';

        // header: use × that goes back to menu (not full exit) for in-lesson
        const xBtn = root.querySelector('.lh-exit-btn');
        if (xBtn) xBtn.onclick = () => renderMenu(currentLevelId, currentLevelLessons);
        const gear = root.querySelector('.lh-gear');
        if (gear) gear.onclick = () => window.JPShared.ttsSettings && window.JPShared.ttsSettings.open();
        root.querySelectorAll('.lh-seg').forEach(seg => { seg.onclick = () => go(parseInt(seg.getAttribute('data-i'), 10)); });

        const body = root.querySelector('.lh-body');
        const footer = root.querySelector('.lh-footer');

        if (isSummary) { renderSummary(body, footer); return; }

        let content = null;
        if (sec.type === "intro") content = renderIntro(lessonData);
        else if (sec.type === "kanjiGrid") content = renderKanjiFlip(sec);
        else if (sec.type === "conversation") content = renderConversation(sec);
        else if (sec.type === "vocabList") content = renderVocab(sec);
        else if (sec.type === "drills") content = renderDrills(sec);
        else if (sec.type === "warmup") content = renderWarmup(sec);
        else if (sec.type === "reading") content = renderReading(sec);
        if (content) body.appendChild(content);

        // Footer
        const isLast = currentStep === totalSteps - 1;
        const nextLabel = isLast ? '' : (SECTION_LABELS[lessonData.sections[currentStep + 1].type] || '');
        if (currentStep > 0) {
            const backBtn = el("button", "lh-btn-back", SVG_BACK + ' Back');
            backBtn.onclick = () => go(currentStep - 1);
            footer.appendChild(backBtn);
        }
        const nextBtn = el("button", "lh-btn-next" + (isLast ? ' finish' : ''));
        nextBtn.innerHTML = isLast
            ? 'Finish lesson ' + SVG_CHECK
            : 'Next' + (nextLabel ? ' <span class="lh-next-sub">· ' + esc(nextLabel) + '</span>' : '') + ' ' + SVG_NEXT;
        nextBtn.onclick = () => go(currentStep + 1);
        footer.appendChild(nextBtn);
    }

    // Initialize
    fetchLessonList();
  }
};
