window.StoryModule = (function() {
  'use strict';

  let container = null;
  let config = null;
  let onExit = null;
  let currentStory = null;
  let storyList = [];
  let currentIndex = 0;
  let termMapData = {};
  let autoSurfaceMap = {}; // glossary surface → { id } for automatic matching
  let CONJUGATION_RULES = null;

  function getCdnUrl(filepath) {
    return window.getAssetUrl(config, filepath);
  }

  function start(containerElement, repoConfig, exitCallback) {
    container = containerElement;
    config = repoConfig;
    onExit = exitCallback;

    initializeStoryModule();
  }

  function initializeStoryModule() {
    // --- Fonts ---
    if (!document.getElementById('jp-fonts')) {
      const link = document.createElement('link');
      link.id = 'jp-fonts';
      link.rel = 'stylesheet';
      link.href = 'app/shared/fonts.css';
      document.head.appendChild(link);
    }

    // --- Styles ---
    const styleId = 'jp-story-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .jp-story-container {
          font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
          background:
            radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
            radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
            oklch(0.97 0.008 80);
          overflow: hidden;
          width: 100%;
          margin: 0 auto;
          position: relative;
          min-height: 100vh; min-height: 100dvh;
          color: oklch(0.22 0.012 60);
        }
        .jp-story-header {
          background: oklch(0.22 0.012 60);
          padding: max(28px,env(safe-area-inset-top)) 18px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          position: sticky; top: 0; z-index: 10;
          border-bottom: 1px solid oklch(1 0 0 / 0.1);
        }
        .jp-story-title {
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
        }
        .jp-story-nav {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .jp-story-nav-btn, .jp-story-back-btn {
          background: rgba(255,255,255,0.1);
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
          .jp-story-nav-btn:hover, .jp-story-back-btn:hover {
            background: rgba(255,255,255,0.2);
          }
        }
        .jp-story-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .jp-story-content {
          background: oklch(0.97 0.008 80);
          padding: 24px 18px 40px;
          margin: 0;
          border-radius: 0;
          overflow-y: auto;
        }
        .jp-story-content h1 {
          color: #9A7B1F;
          font-size: 2rem;
          margin-top: 0;
          margin-bottom: 0.5rem;
          font-weight: 700;
        }
        .jp-story-content h2 {
          color: #6E5A18;
          font-size: 1.4rem;
          margin-top: 0;
          margin-bottom: 2rem;
          font-weight: 600;
        }
        .jp-story-content h3 {
          color: #9A7B1F;
          font-size: 1.2rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-weight: 600;
          border-bottom: 2px solid #9A7B1F;
          padding-bottom: 0.5rem;
        }
        .jp-story-content hr {
          border: none;
          border-top: 2px solid oklch(0.22 0.012 60 / 0.12);
          margin: 2rem 0;
        }
        .jp-story-content p {
          font-size: 1.1rem;
          line-height: 2;
          margin-bottom: 1rem;
          color: oklch(0.22 0.012 60);
          font-family: 'Noto Sans JP', sans-serif;
        }
        .jp-story-content ul, .jp-story-content ol {
          line-height: 1.8;
          margin-bottom: 1rem;
          padding-left: 2rem;
        }
        .jp-story-content li {
          margin-bottom: 0.5rem;
          color: oklch(0.22 0.012 60);
        }
        .jp-story-content strong {
          color: #9A7B1F;
          font-weight: 700;
        }
        .jp-story-content em {
          color: #6E5A18;
          font-style: italic;
        }
        .jp-story-content code {
          background: #EFE9DD;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .jp-story-content pre {
          background: #EFE9DD;
          padding: 15px;
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .jp-story-content pre code {
          background: none;
          padding: 0;
        }
        .jp-term {
          color: #C2410C;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid rgba(78,84,200,0.2);
          margin-right: 1px;
          transition: 0.2s;
        }
        @media (hover: hover) {
          .jp-term:hover {
            background: oklch(0.60 0.18 30 / 0.10);
            border-bottom-color: #C2410C;
          }
        }
        .jp-story-loading {
          text-align: center;
          padding: 60px 20px;
          color: oklch(0.55 0.012 60);
        }
        .jp-story-loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 4px solid oklch(0.22 0.012 60 / 0.15);
          border-top-color: oklch(0.60 0.18 30);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .jp-story-error {
          background: oklch(0.97 0.008 80);
          border: 1px solid oklch(0.60 0.18 30 / 0.4);
          color: oklch(0.52 0.18 30);
          padding: 20px;
          margin: 18px;
          border-radius: 14px;
          text-align: center;
        }
        .jp-story-selector {
          background: white;
          padding: 30px;
          margin: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .jp-story-selector h2 {
          color: #9A7B1F;
          font-size: 1.3rem;
          font-weight: 700;
          margin: 0 0 5px 0;
        }
        .jp-story-selector > p {
          color: #888;
          font-size: 0.9rem;
          margin: 0 0 20px 0;
        }
        .jp-story-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }
        .jp-story-level-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .jp-story-level-card {
          background: oklch(0.94 0.012 75);
          border-radius: 12px;
          padding: 28px 16px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 2px solid transparent;
          text-align: center;
        }
        @media (hover: hover) {
          .jp-story-level-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: #9A7B1F;
          }
        }
        .jp-story-level-name {
          font-size: 1.4rem;
          font-weight: 900;
          color: #9A7B1F;
          margin-bottom: 6px;
        }
        .jp-story-level-count {
          font-size: 0.85rem;
          color: #6E5A18;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .jp-story-level-back-btn {
          background: transparent;
          border: none;
          color: #9A7B1F;
          font-weight: 700;
          cursor: pointer;
          padding: 0 0 12px 0;
          font-size: 0.9rem;
          display: block;
          font-family: inherit;
        }
        @media (hover: hover) { .jp-story-level-back-btn:hover { text-decoration: underline; } }
        .jp-story-card {
          background: oklch(0.94 0.012 75);
          border-radius: 12px;
          padding: 24px 16px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border: 2px solid transparent;
          text-align: center;
        }
        @media (hover: hover) {
          .jp-story-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: #9A7B1F;
          }
        }
        .jp-story-level-badge {
          display: inline-block;
          background: #9A7B1F;
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 10px;
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }
        .jp-story-card-jp {
          font-size: 1.3rem;
          font-weight: 700;
          color: oklch(0.22 0.012 60);
          margin-bottom: 6px;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .jp-story-card-en {
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 16px;
        }
        .jp-story-card-read-btn {
          background: #9A7B1F;
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
          .jp-story-card:hover .jp-story-card-read-btn {
            background: #C27205;
          }
        }
        @media (max-width: 600px) {
          .jp-story-content {
            padding: 20px;
            margin: 10px;
          }
          .jp-story-content h1 {
            font-size: 1.5rem;
          }
          .jp-story-content h2 {
            font-size: 1.2rem;
          }
          .jp-story-header {
            flex-direction: column;
            align-items: stretch;
          }
          .jp-story-nav {
            justify-content: center;
          }
          .jp-story-selector {
            padding: 20px;
            margin: 10px;
          }
          .jp-story-selector-grid {
            grid-template-columns: 1fr;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // --- HTML Structure ---
    container.innerHTML = `
      <div class="jp-story-container">
        <div class="jp-story-header">
          <div class="jp-story-title">📖 Stories</div>
          <div class="jp-story-nav">
            <button class="jp-settings-gear" onclick="window.JPShared.ttsSettings.open()" title="Voice Settings" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);">\u2699</button>
            <button class="jp-story-nav-btn" id="jp-story-list" style="display:none;">☰ All Stories</button>
            <button class="jp-story-nav-btn" id="jp-story-prev" style="display:none;">← Previous</button>
            <button class="jp-story-nav-btn" id="jp-story-next" style="display:none;">Next →</button>
            <button class="jp-story-back-btn" id="jp-story-exit">← Back to Menu</button>
          </div>
        </div>
        <div class="jp-story-loading">
          <div class="jp-story-loading-spinner"></div>
          <div>Loading stories...</div>
        </div>
      </div>
    `;

    document.getElementById('jp-story-exit').addEventListener('click', () => {
      if (onExit) onExit();
    });

    document.getElementById('jp-story-prev').addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        loadStory(storyList[currentIndex]);
      }
    });

    document.getElementById('jp-story-next').addEventListener('click', () => {
      if (currentIndex < storyList.length - 1) {
        currentIndex++;
        loadStory(storyList[currentIndex]);
      }
    });

    document.getElementById('jp-story-list').addEventListener('click', () => {
      showStorySelector();
    });

    // Load resources
    Promise.all([
      loadMarkedJS(),
      loadResources()
    ]).then(() => {
      loadStoryList();
    }).catch(err => {
      showError('Failed to load resources: ' + err.message);
    });
  }

  function loadMarkedJS() {
    return new Promise((resolve, reject) => {
      if (window.marked) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = (window.getAssetUrl ? window.getAssetUrl(config, 'vendor/marked.min.js') : 'vendor/marked.min.js');
      script.onload = () => {
        if (window.marked) {
          marked.setOptions({
            gfm: true,
            breaks: true
          });
          resolve();
        } else {
          reject(new Error('marked library not available'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load marked.js'));
      document.head.appendChild(script);
    });
  }

  async function loadResources() {
    try {
      const manifest = await window.getManifest(config);
      const conjUrl     = getCdnUrl(manifest.globalFiles.conjugationRules);
      const particleUrl  = getCdnUrl(manifest.shared.particles);
      const characterUrl = getCdnUrl(manifest.shared.characters);
      console.log('[Story] Conjugation URL:', conjUrl);
      const [conjugationRules, particleData, characterData, ...glossParts] = await Promise.all([
        fetch(conjUrl).then(r => r.json()),
        fetch(particleUrl).then(r => r.json()),
        fetch(characterUrl).then(r => r.json()),
        ...manifest.levels.map(lvl => fetch(getCdnUrl(manifest.data[lvl].glossary)).then(r => r.json()))
      ]);
      const allEntries = glossParts.flatMap(g => g.entries);

      // Build term map (id → term, for modal lookups)
      termMapData = {};
      autoSurfaceMap = {};
      allEntries.forEach(term => {
        termMapData[term.id] = term;
        // Auto-surface map: surface form → id (for automatic highlighting)
        if (term.surface) {
          autoSurfaceMap[term.surface] = { id: term.id, form: null };
        }
      });
      (particleData.particles || []).forEach(p => {
        termMapData[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', matches: p.matches || [] };
      });
      (characterData.characters || []).forEach(c => {
        termMapData[c.id] = Object.assign({}, c, { portraitUrl: getCdnUrl(c.portrait) });
      });
      // Preload portrait images in the background so they appear instantly on first tap
      if (window.JPShared && window.JPShared.assets && window.JPShared.assets.preloadImages) {
        window.JPShared.assets.preloadImages(
          (characterData.characters || []).map(c => getCdnUrl(c.portrait)).filter(Boolean)
        );
      }

      CONJUGATION_RULES = conjugationRules;

      // Setup term modal
      window.JPShared.termModal.setTermMap(termMapData);
      window.JPShared.termModal.inject();
      // Story.js flags by term ID (boolean, flag-once) rather than the
      // default count-based surface flagging used by Lesson/Review.
      // The message auto-hides after 2s and is suppressed if already flagged.
      window.JP_OPEN_TERM = function(id, form, enableFlag) {
        // Support legacy 2-arg calls: JP_OPEN_TERM(id, enableFlag)
        if (typeof form === 'boolean') {
          enableFlag = form;
          form = null;
        }

        var termId = id;

        // If a conjugation form is specified, generate and cache the conjugated term
        if (form && CONJUGATION_RULES) {
          var conjugatedId = id + '_' + form;
          if (!termMapData[conjugatedId]) {
            var rootTerm = termMapData[id];
            if (rootTerm) {
              var conjugated = window.JPShared.textProcessor.conjugate(rootTerm, form, CONJUGATION_RULES);
              if (conjugated) {
                termMapData[conjugated.id] = conjugated;
              }
            }
          }
          // Fall back to root ID if conjugation failed (e.g. noun_suru verbs)
          termId = termMapData[conjugatedId] ? conjugatedId : id;
        }

        window.JPShared.termModal.open(termId, {
          enableFlag: !!enableFlag,
          onFlag: function(flaggedId, msgBox) {
            // Always flag the root term ID, not the conjugated form
            if (!window.JPShared.progress.getFlagCount(id)) {
              window.JPShared.progress.flagTerm(id);
              if (msgBox) {
                msgBox.style.display = 'block';
                setTimeout(function() { msgBox.style.display = 'none'; }, 2000);
              }
            } else if (msgBox) {
              msgBox.style.display = 'none'; // already flagged — suppress
            }
          }
        });
      };
    } catch (err) {
      console.warn('Could not load glossary/conjugation:', err);
    }
  }

  // Build a map of lesson/grammar IDs → curriculum sort key for ordering stories.
  // N5 lessons → 1000–1999, G-lessons → resolved after their unlocksAfter lesson,
  // N4 lessons → 10000+. Stories with no unlocksAfter sort last.
  function buildCurriculumSortKeys(manifest) {
    const keys = {};
    const d = manifest && manifest.data;
    if (!d) return keys;

    // N5 content lessons
    ((d.N5 && d.N5.lessons) || []).forEach((l, i) => { keys[l.id] = 1000 + i * 10; });
    // N5 review milestones (needed to resolve G-lessons that unlock after a review)
    ((d.N5 && d.N5.reviews) || []).forEach((r, i) => { keys[r.id] = 1900 + i * 10; });
    // N4 content lessons
    ((d.N4 && d.N4.lessons) || []).forEach((l, i) => { keys[l.id] = 10000 + i * 10; });
    // N4 review milestones
    ((d.N4 && d.N4.reviews) || []).forEach((r, i) => { keys[r.id] = 11900 + i * 10; });

    // Grammar lessons: resolve iteratively until stable (handles chains like G2→G1→N5.1)
    const gLessons = [
      ...((d.N5 && d.N5.grammar) || []),
      ...((d.N4 && d.N4.grammar) || [])
    ];
    let changed = true;
    while (changed) {
      changed = false;
      gLessons.forEach(g => {
        if (keys[g.id] === undefined && keys[g.unlocksAfter] !== undefined) {
          keys[g.id] = keys[g.unlocksAfter] + 1;
          changed = true;
        }
      });
    }
    return keys;
  }

  async function loadStoryList() {
    try {
      const manifest = await window.getManifest(config);
      const sortKeys = buildCurriculumSortKeys(manifest);

      storyList = [];
      const levels = manifest.levels || [];
      levels.forEach(level => {
        const levelData = manifest.data && manifest.data[level];
        if (!levelData || !levelData.stories) return;
        levelData.stories.forEach(story => {
          storyList.push({
            id: story.id,
            dir: story.dir,
            mdFile: story.dir + '/story.md',
            jsonFile: story.dir + '/terms.json',
            title: story.titleJp || story.title,
            subtitle: story.title,
            level: level,
            unlocksAfter: story.unlocksAfter
          });
        });
      });

      // Sort by curriculum position so the picker lists stories in lesson order
      storyList.sort((a, b) => {
        const ka = (a.unlocksAfter && sortKeys[a.unlocksAfter] !== undefined)
          ? sortKeys[a.unlocksAfter] : 99999;
        const kb = (b.unlocksAfter && sortKeys[b.unlocksAfter] !== undefined)
          ? sortKeys[b.unlocksAfter] : 99999;
        return ka - kb;
      });

      console.log('[Story] Found', storyList.length, 'stories from manifest');
      if (storyList.length > 0) {
        showStorySelector();
      } else {
        showError('No stories available');
      }
    } catch (err) {
      showError('Failed to load story list: ' + err.message);
    }
  }

  function showStorySelector() {
    const storyContainer = container.querySelector('.jp-story-container');
    const contentArea = storyContainer.querySelector('.jp-story-loading') ||
                        storyContainer.querySelector('.jp-story-content') ||
                        storyContainer.querySelector('.jp-story-selector') ||
                        storyContainer.querySelector('.jp-story-error');

    const titleEl = storyContainer.querySelector('.jp-story-title');
    if (titleEl) titleEl.textContent = '📖 Stories';

    const listBtn = document.getElementById('jp-story-list');
    const prevBtn = document.getElementById('jp-story-prev');
    const nextBtn = document.getElementById('jp-story-next');
    if (listBtn) listBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    // Group stories by JLPT level
    const byLevel = {};
    storyList.forEach(story => {
      const lvl = story.level || 'Other';
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl].push(story);
    });
    const unlockApi = window.JPShared && window.JPShared.unlock;
    const levels = ['N5', 'N4'].filter(l => {
      if (!byLevel[l] || !byLevel[l].length) return false;
      if (l === 'N4' && unlockApi && !unlockApi.isFree() && !unlockApi.isN4Unlocked()) return false;
      return true;
    });

    const levelCardsHtml = levels.map(level => {
      const visibleCount = !unlockApi || unlockApi.isFree()
        ? byLevel[level].length
        : byLevel[level].filter(s => unlockApi.isStoryUnlocked(s)).length;
      return `
        <div class="jp-story-level-card" data-level="${level}">
          <div class="jp-story-level-name">JLPT ${level}</div>
          <div class="jp-story-level-count">${visibleCount} stor${visibleCount !== 1 ? 'ies' : 'y'}</div>
        </div>
      `;
    }).join('');

    if (contentArea) {
      contentArea.outerHTML = `
        <div class="jp-story-selector">
          <h2>Choose a Story</h2>
          <p>Select your JLPT level</p>
          <div class="jp-story-level-grid">
            ${levelCardsHtml}
          </div>
        </div>
      `;
    }

    storyContainer.querySelectorAll('.jp-story-level-card').forEach(card => {
      card.addEventListener('click', () => {
        showStoriesForLevel(card.dataset.level, byLevel[card.dataset.level]);
      });
    });
  }

  function showStoriesForLevel(level, stories) {
    const storyContainer = container.querySelector('.jp-story-container');
    const contentArea = storyContainer.querySelector('.jp-story-selector') ||
                        storyContainer.querySelector('.jp-story-loading') ||
                        storyContainer.querySelector('.jp-story-content') ||
                        storyContainer.querySelector('.jp-story-error');

    const unlockApi = window.JPShared && window.JPShared.unlock;
    const visibleStories = stories.filter(s =>
      !unlockApi || unlockApi.isFree() || unlockApi.isStoryUnlocked(s)
    );

    const cardsHtml = visibleStories.map(story => {
      const index = storyList.indexOf(story);
      return `
        <div class="jp-story-card" data-story-index="${index}">
          <div class="jp-story-card-jp">${story.title}</div>
          <div class="jp-story-card-en">${story.subtitle}</div>
          <button class="jp-story-card-read-btn">Read →</button>
        </div>
      `;
    }).join('');

    if (contentArea) {
      contentArea.outerHTML = `
        <div class="jp-story-selector">
          <button class="jp-story-level-back-btn" id="jp-story-back-to-levels">← Levels</button>
          <h2>JLPT ${level} Stories</h2>
          <p>${visibleStories.length} stor${visibleStories.length !== 1 ? 'ies' : 'y'} available</p>
          <div class="jp-story-selector-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    document.getElementById('jp-story-back-to-levels').addEventListener('click', () => {
      showStorySelector();
    });

    storyContainer.querySelectorAll('.jp-story-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.storyIndex, 10);
        currentIndex = index;
        loadStory(storyList[index]);
      });
    });
  }

  async function loadStory(storyInfo) {
    // Record streak activity on story read
    if (window.JPShared && window.JPShared.streak) window.JPShared.streak.recordActivity();
    const storyContainer = container.querySelector('.jp-story-container');

    const contentArea = storyContainer.querySelector('.jp-story-loading') ||
                        storyContainer.querySelector('.jp-story-content') ||
                        storyContainer.querySelector('.jp-story-selector') ||
                        storyContainer.querySelector('.jp-story-error');

    if (contentArea) {
      contentArea.outerHTML = `
        <div class="jp-story-loading">
          <div class="jp-story-loading-spinner"></div>
          <div>Loading ${storyInfo.title}...</div>
        </div>
      `;
    }

    // Update header title and reveal nav buttons (may be hidden when coming from selector)
    const titleEl = storyContainer.querySelector('.jp-story-title');
    if (titleEl) titleEl.textContent = storyInfo.title;

    const listBtn = document.getElementById('jp-story-list');
    const prevBtn = document.getElementById('jp-story-prev');
    const nextBtn = document.getElementById('jp-story-next');
    if (listBtn) listBtn.style.display = '';
    if (prevBtn) prevBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = '';

    updateNavButtons();

    try {
      // Load both markdown and companion JSON
      const mdUrl = getCdnUrl(storyInfo.mdFile);
      const jsonUrl = getCdnUrl(storyInfo.jsonFile);
      console.log('[Story] Markdown URL:', mdUrl);
      console.log('[Story] Terms URL:', jsonUrl);
      const [mdResponse, jsonResponse] = await Promise.all([
        fetch(mdUrl + '?t=' + Date.now()),
        fetch(jsonUrl + '?t=' + Date.now())
      ]);

      if (!mdResponse.ok) {
        throw new Error(`Failed to load story markdown: ${mdResponse.status}`);
      }
      if (!jsonResponse.ok) {
        throw new Error(`Failed to load story data: ${jsonResponse.status}`);
      }

      const markdown = await mdResponse.text();
      const storyData = await jsonResponse.json();

      // Parse markdown to HTML
      let html = marked.parse(markdown);

      // Process HTML with term mappings from JSON
      html = processStoryHTML(html, storyData.terms);

      const loading = storyContainer.querySelector('.jp-story-loading');
      if (loading) {
        loading.outerHTML = `
          <div class="jp-story-content">
            ${html}
          </div>
        `;
      }

      currentStory = storyInfo;

      const contentDiv = storyContainer.querySelector('.jp-story-content');
      if (contentDiv) {
        contentDiv.scrollTop = 0;

        // Add per-paragraph speaker buttons and a Play Story button.
        // Only process Japanese paragraphs — stop at the English Translation section.
        var paragraphs = contentDiv.querySelectorAll('p');
        var storyTexts = [];
        var hitEnglishSection = false;
        paragraphs.forEach(function (p) {
          if (hitEnglishSection) return;
          // Skip empty paragraphs
          var plainText = p.textContent.trim();
          if (!plainText) return;
          // Detect English section boundaries (headers rendered before this <p>)
          // Check if a preceding sibling is an English section header
          var prev = p.previousElementSibling;
          while (prev) {
            var txt = prev.textContent.trim().toLowerCase();
            if (prev.tagName && /^H[1-6]$/.test(prev.tagName) &&
                (txt.indexOf('english') !== -1 || txt.indexOf('vocabulary used') !== -1 || txt.indexOf('grammar points') !== -1)) {
              hitEnglishSection = true;
              return;
            }
            // Stop searching after a couple elements
            if (prev.tagName === 'HR') break;
            prev = prev.previousElementSibling;
          }
          if (hitEnglishSection) return;
          // Skip paragraphs that look like pure English/romaji (no CJK characters)
          if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(plainText)) return;
          storyTexts.push(plainText);
          // Wrap content for flex layout with speaker button
          var wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex;align-items:flex-start;gap:2px;';
          var textDiv = document.createElement('div');
          textDiv.style.flex = '1';
          // Move all children from p into textDiv
          while (p.firstChild) textDiv.appendChild(p.firstChild);
          var btn = document.createElement('button');
          btn.className = 'jp-speak-sentence';
          btn.title = 'Listen';
          btn.textContent = '\uD83D\uDD0A';
          btn.onclick = function () { window.JPShared.tts.speak(plainText); };
          wrapper.appendChild(textDiv);
          wrapper.appendChild(btn);
          p.appendChild(wrapper);
        });
        // Insert Play/Stop Story button at top
        if (storyTexts.length > 0) {
          var playBtn = document.createElement('button');
          playBtn.className = 'jp-speak-all-btn';
          playBtn.innerHTML = '\uD83D\uDD0A Play Story';
          playBtn.style.marginTop = '10px';
          function setPlaying(playing) {
            playBtn.textContent = playing ? '\u23F9 Stop' : '\uD83D\uDD0A Play Story';
            playBtn.classList.toggle('jp-speak-all-active', playing);
          }
          playBtn.onclick = function () {
            if (window.JPShared.tts.isSpeaking()) {
              window.JPShared.tts.cancel();
              setPlaying(false);
            } else {
              setPlaying(true);
              window.JPShared.tts.speakLines(storyTexts, { onFinish: function() { setPlaying(false); } });
            }
          };
          contentDiv.insertBefore(playBtn, contentDiv.firstChild);
        }
      }

    } catch (err) {
      showError(`Failed to load story: ${err.message}`);
    }
  }

  function processStoryHTML(html, termMappings) {
    // termMappings = { "行きました": { id: "v.iku", form: "polite_past" }, ... }
    // Merge once: auto-map from glossary surfaces + explicit overrides (terms.json wins)
    const mergedMappings = Object.assign({}, autoSurfaceMap, termMappings);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToReplace = [];
    let node;

    while (node = walker.nextNode()) {
      // Skip if already inside a term span or code block
      if (node.parentElement.classList.contains('jp-term') ||
          node.parentElement.tagName === 'CODE' ||
          node.parentElement.tagName === 'PRE') {
        continue;
      }

      const text = node.textContent;
      if (!text.trim()) continue;

      const matches = findTermsInText(text, mergedMappings);
      if (matches.length > 0) {
        nodesToReplace.push({ node, matches });
      }
    }

    // Replace text nodes with clickable terms
    nodesToReplace.forEach(({ node, matches }) => {
      const span = document.createElement('span');
      let lastIndex = 0;
      let html = '';

      matches.forEach(match => {
        // Add text before match
        html += escapeHtml(node.textContent.substring(lastIndex, match.index));
        // Add clickable term
        const formStr = match.form ? `'${match.form}'` : 'null';
        const matchedTerm = termMapData[match.termId];
        const termCls = (matchedTerm && matchedTerm.type === 'character') ? 'jp-term jp-term-name' : 'jp-term';
        html += `<span class="${termCls}" onclick="window.JP_OPEN_TERM('${match.termId}', ${formStr}, true)">${escapeHtml(match.text)}</span>`;
        lastIndex = match.index + match.text.length;
      });

      // Add remaining text
      html += escapeHtml(node.textContent.substring(lastIndex));

      span.innerHTML = html;
      node.parentElement.replaceChild(span, node);
    });

    return tempDiv.innerHTML;
  }

  function findTermsInText(text, termMappings) {
    const matches = [];
    const processedPositions = new Set();

    // Get all surface forms from termMappings, sorted by length (longest first)
    const surfaceForms = Object.keys(termMappings).sort((a, b) => b.length - a.length);

    surfaceForms.forEach(surface => {
      const termDef = termMappings[surface]; // { id: "v.iku", form: "polite_past" }

      let index = text.indexOf(surface);
      while (index !== -1) {
        // Check if this position overlaps with existing match
        let overlaps = false;
        for (let i = index; i < index + surface.length; i++) {
          if (processedPositions.has(i)) {
            overlaps = true;
            break;
          }
        }

        if (!overlaps) {
          matches.push({
            index,
            text: surface,
            termId: termDef.id,
            form: termDef.form || null
          });

          // Mark positions as processed
          for (let i = index; i < index + surface.length; i++) {
            processedPositions.add(i);
          }
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
    const prevBtn = document.getElementById('jp-story-prev');
    const nextBtn = document.getElementById('jp-story-next');

    if (prevBtn) {
      prevBtn.disabled = currentIndex === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = currentIndex === storyList.length - 1 || storyList.length === 0;
    }
  }

  function showError(message) {
    const storyContainer = container.querySelector('.jp-story-container');
    const contentArea = storyContainer.querySelector('.jp-story-loading') ||
                        storyContainer.querySelector('.jp-story-content') ||
                        storyContainer.querySelector('.jp-story-selector') ||
                        storyContainer.querySelector('.jp-story-error');

    if (contentArea) {
      contentArea.outerHTML = `
        <div class="jp-story-error">
          <h2>⚠️ Error</h2>
          <p>${message}</p>
        </div>
      `;
    }
  }

  return {
    start: start
  };
})();
