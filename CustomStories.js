window.CustomStoriesModule = (function() {
  'use strict';

  let container = null;
  let config = null;
  let onExit = null;
  let storyList = [];
  let currentIndex = 0;
  let termMapData = {};
  let autoSurfaceMap = {};
  let CONJUGATION_RULES = null;

  const C1 = '#0891B2'; // cyan-600
  const C2 = '#0E7490'; // cyan-700
  const CL1 = '#F0F9FF'; // cyan-50
  const CL2 = '#BAE6FD'; // cyan-200

  function getCdnUrl(filepath) {
    return window.getAssetUrl(config, filepath);
  }

  function start(containerElement, repoConfig, exitCallback) {
    container = containerElement;
    config = repoConfig;
    onExit = exitCallback;
    initializeModule();
  }

  function initializeModule() {
    if (!document.getElementById('jp-fonts')) {
      const link = document.createElement('link');
      link.id = 'jp-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Poppins:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }

    const styleId = 'jp-cc-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .jp-cc-container {
          font-family: 'Poppins', 'Noto Sans JP', sans-serif;
          background: linear-gradient(135deg, ${C1} 0%, ${C2} 100%);
          border-radius: 12px;
          overflow: hidden;
          max-width: 900px;
          margin: 0 auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          position: relative;
          min-height: 600px;
        }
        .jp-cc-header {
          background: rgba(0,0,0,0.4);
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .jp-cc-title {
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
        }
        .jp-cc-nav {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .jp-cc-nav-btn, .jp-cc-back-btn {
          background: rgba(255,255,255,0.15);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
          font-size: 14px;
        }
        @media (hover: hover) {
          .jp-cc-nav-btn:hover, .jp-cc-back-btn:hover { background: rgba(255,255,255,0.25); }
        }
        .jp-cc-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .jp-cc-content {
          background: white;
          padding: 40px;
          margin: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }
        .jp-cc-content h1 { color: ${C1}; font-size: 2rem; margin-top: 0; margin-bottom: 0.5rem; font-weight: 700; }
        .jp-cc-content h2 { color: ${C2}; font-size: 1.4rem; margin-top: 0; margin-bottom: 2rem; font-weight: 600; }
        .jp-cc-content h3 { color: ${C1}; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem; font-weight: 600; border-bottom: 2px solid ${C1}; padding-bottom: 0.5rem; }
        .jp-cc-content hr { border: none; border-top: 2px solid #e0e0e0; margin: 2rem 0; }
        .jp-cc-content p { font-size: 1.1rem; line-height: 2; margin-bottom: 1rem; color: #333; font-family: 'Noto Sans JP', sans-serif; }
        .jp-cc-content ul, .jp-cc-content ol { line-height: 1.8; margin-bottom: 1rem; padding-left: 2rem; }
        .jp-cc-content li { margin-bottom: 0.5rem; color: #333; }
        .jp-cc-content strong { color: ${C1}; font-weight: 700; }
        .jp-cc-content em { color: ${C2}; font-style: italic; }
        .jp-cc-content code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
        .jp-cc-content pre { background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto; margin-bottom: 1rem; }
        .jp-cc-content pre code { background: none; padding: 0; }
        .jp-term {
          color: #4e54c8;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid rgba(78,84,200,0.2);
          margin-right: 1px;
          transition: 0.2s;
        }
        @media (hover: hover) {
          .jp-term:hover { background: rgba(78,84,200,0.08); border-bottom-color: #4e54c8; }
        }
        .jp-cc-loading {
          text-align: center;
          padding: 60px 20px;
          color: white;
        }
        .jp-cc-loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: cc-spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes cc-spin { to { transform: rotate(360deg); } }
        .jp-cc-error {
          background: #ff5252;
          color: white;
          padding: 20px;
          margin: 20px;
          border-radius: 8px;
          text-align: center;
        }
        .jp-cc-selector {
          background: white;
          padding: 30px;
          margin: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .jp-cc-selector h2 { color: ${C1}; font-size: 1.3rem; font-weight: 700; margin: 0 0 5px 0; }
        .jp-cc-selector > p { color: #888; font-size: 0.9rem; margin: 0 0 20px 0; }
        .jp-cc-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }
        .jp-cc-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .jp-cc-type-card {
          background: linear-gradient(135deg, ${CL1} 0%, ${CL2} 100%);
          border-radius: 12px;
          padding: 32px 20px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 2px solid transparent;
          text-align: center;
        }
        @media (hover: hover) {
          .jp-cc-type-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: ${C1};
          }
        }
        .jp-cc-type-icon { font-size: 2.5rem; margin-bottom: 12px; }
        .jp-cc-type-name { font-size: 1.1rem; font-weight: 700; color: ${C2}; margin-bottom: 4px; }
        .jp-cc-type-count { font-size: 0.8rem; color: #666; }
        .jp-cc-back-link {
          background: transparent;
          border: none;
          color: ${C1};
          font-weight: 700;
          cursor: pointer;
          padding: 0 0 12px 0;
          font-size: 0.9rem;
          display: block;
          font-family: inherit;
        }
        @media (hover: hover) { .jp-cc-back-link:hover { text-decoration: underline; } }
        .jp-cc-card {
          background: linear-gradient(135deg, ${CL1} 0%, ${CL2} 100%);
          border-radius: 12px;
          padding: 24px 16px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 2px solid transparent;
          text-align: center;
        }
        @media (hover: hover) {
          .jp-cc-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: ${C1};
          }
        }
        .jp-cc-card-badge {
          display: inline-block;
          background: ${C1};
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 10px;
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }
        .jp-cc-card-jp { font-size: 1.3rem; font-weight: 700; color: #333; margin-bottom: 6px; font-family: 'Noto Sans JP', sans-serif; }
        .jp-cc-card-en { font-size: 0.85rem; color: #666; margin-bottom: 16px; }
        .jp-cc-card-read-btn {
          background: ${C1};
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          pointer-events: none;
          transition: background 0.2s;
        }
        @media (hover: hover) {
          .jp-cc-card:hover .jp-cc-card-read-btn { background: ${C2}; }
        }
        @media (max-width: 600px) {
          .jp-cc-content { padding: 20px; margin: 10px; }
          .jp-cc-content h1 { font-size: 1.5rem; }
          .jp-cc-content h2 { font-size: 1.2rem; }
          .jp-cc-header { flex-direction: column; align-items: stretch; }
          .jp-cc-nav { justify-content: center; }
          .jp-cc-selector { padding: 20px; margin: 10px; }
          .jp-cc-selector-grid, .jp-cc-type-grid { grid-template-columns: 1fr; }
        }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div class="jp-cc-container">
        <div class="jp-cc-header">
          <div class="jp-cc-title">✦ Custom Content</div>
          <div class="jp-cc-nav">
            <button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);">⚙</button>
            <button class="jp-cc-nav-btn" id="jp-cc-list" style="display:none;">☰ All Stories</button>
            <button class="jp-cc-nav-btn" id="jp-cc-prev" style="display:none;">← Previous</button>
            <button class="jp-cc-nav-btn" id="jp-cc-next" style="display:none;">Next →</button>
            <button class="jp-cc-back-btn" id="jp-cc-exit">← Back to Menu</button>
          </div>
        </div>
        <div class="jp-cc-loading">
          <div class="jp-cc-loading-spinner"></div>
          <div>Loading...</div>
        </div>
      </div>
    `;

    document.getElementById('jp-cc-exit').addEventListener('click', () => { if (onExit) onExit(); });
    document.getElementById('jp-cc-prev').addEventListener('click', () => {
      if (currentIndex > 0) { currentIndex--; loadStory(storyList[currentIndex]); }
    });
    document.getElementById('jp-cc-next').addEventListener('click', () => {
      if (currentIndex < storyList.length - 1) { currentIndex++; loadStory(storyList[currentIndex]); }
    });
    document.getElementById('jp-cc-list').addEventListener('click', () => showStorySelector());

    Promise.all([loadMarkedJS(), loadResources()]).then(() => {
      loadStoryList();
    }).catch(err => showError('Failed to load resources: ' + err.message));
  }

  function loadMarkedJS() {
    return new Promise((resolve, reject) => {
      if (window.marked) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js';
      script.onload = () => {
        if (window.marked) { marked.setOptions({ gfm: true, breaks: true }); resolve(); }
        else reject(new Error('marked not available'));
      };
      script.onerror = () => reject(new Error('Failed to load marked.js'));
      document.head.appendChild(script);
    });
  }

  async function loadResources() {
    try {
      const manifest = await window.getManifest(config);
      const [conjugationRules, particleData, characterData, ...glossParts] = await Promise.all([
        fetch(getCdnUrl(manifest.globalFiles.conjugationRules)).then(r => r.json()),
        fetch(getCdnUrl(manifest.shared.particles)).then(r => r.json()),
        fetch(getCdnUrl(manifest.shared.characters)).then(r => r.json()),
        ...manifest.levels.map(lvl => fetch(getCdnUrl(manifest.data[lvl].glossary)).then(r => r.json()))
      ]);
      const allEntries = glossParts.flatMap(g => g.entries);

      termMapData = {};
      autoSurfaceMap = {};
      allEntries.forEach(term => {
        termMapData[term.id] = term;
        if (term.surface) autoSurfaceMap[term.surface] = { id: term.id, form: null };
      });
      (particleData.particles || []).forEach(p => {
        termMapData[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', matches: p.matches || [] };
      });
      (characterData.characters || []).forEach(c => {
        termMapData[c.id] = Object.assign({}, c, { portraitUrl: getCdnUrl(c.portrait) });
      });
      if (window.JPShared && window.JPShared.assets && window.JPShared.assets.preloadImages) {
        window.JPShared.assets.preloadImages((characterData.characters || []).map(c => getCdnUrl(c.portrait)).filter(Boolean));
      }

      CONJUGATION_RULES = conjugationRules;
      window.JPShared.termModal.setTermMap(termMapData);
      window.JPShared.termModal.inject();

      window.JP_OPEN_TERM = function(id, form, enableFlag) {
        if (typeof form === 'boolean') { enableFlag = form; form = null; }
        var termId = id;
        if (form && CONJUGATION_RULES) {
          var conjugatedId = id + '_' + form;
          if (!termMapData[conjugatedId]) {
            var rootTerm = termMapData[id];
            if (rootTerm) {
              var conjugated = window.JPShared.textProcessor.conjugate(rootTerm, form, CONJUGATION_RULES);
              if (conjugated) termMapData[conjugated.id] = conjugated;
            }
          }
          termId = termMapData[conjugatedId] ? conjugatedId : id;
        }
        window.JPShared.termModal.open(termId, {
          enableFlag: !!enableFlag,
          onFlag: function(flaggedId, msgBox) {
            if (!window.JPShared.progress.getFlagCount(id)) {
              window.JPShared.progress.flagTerm(id);
              if (msgBox) { msgBox.style.display = 'block'; setTimeout(function() { msgBox.style.display = 'none'; }, 2000); }
            } else if (msgBox) { msgBox.style.display = 'none'; }
          }
        });
      };
    } catch (err) {
      console.warn('[CustomContent] Could not load glossary/conjugation:', err);
    }
  }

  async function loadStoryList() {
    try {
      const manifest = await window.getManifest(config);
      const customData = manifest.data && manifest.data.custom;
      const stories = (customData && customData.stories) || [];
      storyList = stories.map(story => ({
        id: story.id,
        dir: story.dir,
        mdFile: story.dir + '/story.md',
        jsonFile: story.dir + '/terms.json',
        title: story.titleJp || story.title,
        subtitle: story.title,
        unlocksAfter: story.unlocksAfter
      }));
      showContentMenu();
    } catch (err) {
      showError('Failed to load content list: ' + err.message);
    }
  }

  function showContentMenu() {
    const wrap = container.querySelector('.jp-cc-container');
    const area = _getArea(wrap);

    const titleEl = wrap.querySelector('.jp-cc-title');
    if (titleEl) titleEl.textContent = '✦ Custom Content';

    ['jp-cc-list', 'jp-cc-prev', 'jp-cc-next'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    if (area) {
      area.outerHTML = `
        <div class="jp-cc-selector">
          <h2>Custom Content</h2>
          <p>Personalized content for your learning journey</p>
          <div class="jp-cc-type-grid">
            <div class="jp-cc-type-card" id="jp-cc-type-stories">
              <div class="jp-cc-type-icon">📖</div>
              <div class="jp-cc-type-name">Custom Stories</div>
              <div class="jp-cc-type-count">${storyList.length} stor${storyList.length !== 1 ? 'ies' : 'y'}</div>
            </div>
          </div>
        </div>
      `;
    }

    const card = document.getElementById('jp-cc-type-stories');
    if (card) card.addEventListener('click', showStorySelector);
  }

  function showStorySelector() {
    const wrap = container.querySelector('.jp-cc-container');
    const area = _getArea(wrap);

    const titleEl = wrap.querySelector('.jp-cc-title');
    if (titleEl) titleEl.textContent = '📖 Custom Stories';

    ['jp-cc-list', 'jp-cc-prev', 'jp-cc-next'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const cardsHtml = storyList.map((story, i) => `
      <div class="jp-cc-card" data-story-index="${i}">
        <div class="jp-cc-card-badge">Custom</div>
        <div class="jp-cc-card-jp">${story.title}</div>
        <div class="jp-cc-card-en">${story.subtitle}</div>
        <button class="jp-cc-card-read-btn">Read →</button>
      </div>
    `).join('');

    if (area) {
      area.outerHTML = `
        <div class="jp-cc-selector">
          <button class="jp-cc-back-link" id="jp-cc-back-to-menu">← Custom Content</button>
          <h2>Custom Stories</h2>
          <p>${storyList.length} stor${storyList.length !== 1 ? 'ies' : 'y'} available</p>
          <div class="jp-cc-selector-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    document.getElementById('jp-cc-back-to-menu').addEventListener('click', showContentMenu);
    wrap.querySelectorAll('.jp-cc-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.storyIndex, 10);
        currentIndex = index;
        loadStory(storyList[index]);
      });
    });
  }

  async function loadStory(storyInfo) {
    if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
    const wrap = container.querySelector('.jp-cc-container');
    const area = _getArea(wrap);

    if (area) {
      area.outerHTML = `
        <div class="jp-cc-loading">
          <div class="jp-cc-loading-spinner"></div>
          <div>Loading ${storyInfo.title}...</div>
        </div>
      `;
    }

    const titleEl = wrap.querySelector('.jp-cc-title');
    if (titleEl) titleEl.textContent = storyInfo.title;

    ['jp-cc-list', 'jp-cc-prev', 'jp-cc-next'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    updateNavButtons();

    try {
      const [mdResponse, jsonResponse] = await Promise.all([
        fetch(getCdnUrl(storyInfo.mdFile) + '?t=' + Date.now()),
        fetch(getCdnUrl(storyInfo.jsonFile) + '?t=' + Date.now())
      ]);
      if (!mdResponse.ok) throw new Error('Failed to load story markdown: ' + mdResponse.status);
      if (!jsonResponse.ok) throw new Error('Failed to load story data: ' + jsonResponse.status);

      const markdown  = await mdResponse.text();
      const storyData = await jsonResponse.json();
      let html = marked.parse(markdown);
      html = processStoryHTML(html, storyData.terms);

      const loading = wrap.querySelector('.jp-cc-loading');
      if (loading) loading.outerHTML = `<div class="jp-cc-content">${html}</div>`;

      const contentDiv = wrap.querySelector('.jp-cc-content');
      if (contentDiv) {
        contentDiv.scrollTop = 0;
        addSpeakerButtons(contentDiv);
      }
    } catch (err) {
      showError('Failed to load story: ' + err.message);
    }
  }

  function addSpeakerButtons(contentDiv) {
    var paragraphs = contentDiv.querySelectorAll('p');
    var storyTexts = [];
    var hitEnglishSection = false;
    paragraphs.forEach(function(p) {
      if (hitEnglishSection) return;
      var plainText = p.textContent.trim();
      if (!plainText) return;
      var prev = p.previousElementSibling;
      while (prev) {
        var txt = prev.textContent.trim().toLowerCase();
        if (prev.tagName && /^H[1-6]$/.test(prev.tagName) &&
            (txt.indexOf('english') !== -1 || txt.indexOf('vocabulary used') !== -1 || txt.indexOf('grammar points') !== -1)) {
          hitEnglishSection = true; return;
        }
        if (prev.tagName === 'HR') break;
        prev = prev.previousElementSibling;
      }
      if (hitEnglishSection) return;
      if (!/[぀-ゟ゠-ヿ一-鿿]/.test(plainText)) return;
      storyTexts.push(plainText);
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:flex-start;gap:2px;';
      var textDiv = document.createElement('div');
      textDiv.style.flex = '1';
      while (p.firstChild) textDiv.appendChild(p.firstChild);
      var btn = document.createElement('button');
      btn.className = 'jp-speak-sentence';
      btn.title = 'Listen';
      btn.textContent = '🔊';
      btn.onclick = function() { window.JPShared.tts.speak(plainText); };
      wrapper.appendChild(textDiv);
      wrapper.appendChild(btn);
      p.appendChild(wrapper);
    });
    if (storyTexts.length > 0) {
      var playBtn = document.createElement('button');
      playBtn.className = 'jp-speak-all-btn';
      playBtn.innerHTML = '🔊 Play Story';
      playBtn.style.marginTop = '10px';
      function setPlaying(playing) {
        playBtn.textContent = playing ? '⏹ Stop' : '🔊 Play Story';
        playBtn.classList.toggle('jp-speak-all-active', playing);
      }
      playBtn.onclick = function() {
        if (window.JPShared.tts.isSpeaking()) { window.JPShared.tts.cancel(); setPlaying(false); }
        else { setPlaying(true); window.JPShared.tts.speakLines(storyTexts, { onFinish: function() { setPlaying(false); } }); }
      };
      contentDiv.insertBefore(playBtn, contentDiv.firstChild);
    }
  }

  function processStoryHTML(html, termMappings) {
    const mergedMappings = Object.assign({}, autoSurfaceMap, termMappings);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.parentElement.classList.contains('jp-term') ||
          node.parentElement.tagName === 'CODE' ||
          node.parentElement.tagName === 'PRE') continue;
      const text = node.textContent;
      if (!text.trim()) continue;
      const matches = findTermsInText(text, mergedMappings);
      if (matches.length > 0) nodesToReplace.push({ node, matches });
    }
    nodesToReplace.forEach(({ node, matches }) => {
      const span = document.createElement('span');
      let lastIndex = 0;
      let html = '';
      matches.forEach(match => {
        html += escapeHtml(node.textContent.substring(lastIndex, match.index));
        const formStr = match.form ? `'${match.form}'` : 'null';
        const matchedTerm = termMapData[match.termId];
        const termCls = (matchedTerm && matchedTerm.type === 'character') ? 'jp-term jp-term-name' : 'jp-term';
        html += `<span class="${termCls}" onclick="window.JP_OPEN_TERM('${match.termId}', ${formStr}, true)">${escapeHtml(match.text)}</span>`;
        lastIndex = match.index + match.text.length;
      });
      html += escapeHtml(node.textContent.substring(lastIndex));
      span.innerHTML = html;
      node.parentElement.replaceChild(span, node);
    });
    return tempDiv.innerHTML;
  }

  function findTermsInText(text, termMappings) {
    const matches = [];
    const processedPositions = new Set();
    const surfaceForms = Object.keys(termMappings).sort((a, b) => b.length - a.length);
    surfaceForms.forEach(surface => {
      const termDef = termMappings[surface];
      let index = text.indexOf(surface);
      while (index !== -1) {
        let overlaps = false;
        for (let i = index; i < index + surface.length; i++) {
          if (processedPositions.has(i)) { overlaps = true; break; }
        }
        if (!overlaps) {
          matches.push({ index, text: surface, termId: termDef.id, form: termDef.form || null });
          for (let i = index; i < index + surface.length; i++) processedPositions.add(i);
        }
        index = text.indexOf(surface, index + 1);
      }
    });
    return matches.sort((a, b) => a.index - b.index);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('jp-cc-prev');
    const nextBtn = document.getElementById('jp-cc-next');
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === storyList.length - 1 || storyList.length === 0;
  }

  function _getArea(wrap) {
    return wrap.querySelector('.jp-cc-loading') || wrap.querySelector('.jp-cc-content') ||
           wrap.querySelector('.jp-cc-selector') || wrap.querySelector('.jp-cc-error');
  }

  function showError(message) {
    const wrap = container.querySelector('.jp-cc-container');
    const area = _getArea(wrap);
    if (area) {
      area.outerHTML = `<div class="jp-cc-error"><h2>⚠️ Error</h2><p>${message}</p></div>`;
    }
  }

  return { start: start };
})();
