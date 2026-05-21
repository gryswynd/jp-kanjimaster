/**
 * app/shared/tts-settings.js
 * TTS voice settings modal — lets users pick a Japanese voice, adjust speed,
 * and preview the result. Includes platform-detected "Get Better Voices" guide.
 *
 * Depends on: tts.js (window.JPShared.tts)
 * Load this file after tts.js and before feature modules.
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
      /* TTS Settings overlay */
      .jp-tts-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        animation: jpTtsFadeIn 0.2s ease;
      }
      @keyframes jpTtsFadeIn {
        from { opacity: 0; } to { opacity: 1; }
      }
      .jp-tts-modal {
        background: white;
        border-radius: 16px;
        width: 90%; max-width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        font-family: "Poppins", system-ui, sans-serif;
      }
      .jp-tts-header {
        background: linear-gradient(135deg, #4e54c8, #8f94fb);
        color: white;
        padding: 18px 20px;
        display: flex; align-items: center; justify-content: space-between;
        position: sticky; top: 0; z-index: 1;
        border-radius: 16px 16px 0 0;
      }
      .jp-tts-header h3 {
        margin: 0; font-size: 1.05rem; font-weight: 800;
      }
      .jp-tts-close {
        background: rgba(255,255,255,0.2);
        border: none; color: white;
        width: 32px; height: 32px;
        border-radius: 50%;
        font-size: 1.1rem; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
      }
      @media (hover: hover) { .jp-tts-close:hover { background: rgba(255,255,255,0.35); } }

      .jp-tts-body { padding: 20px; }

      .jp-tts-field { margin-bottom: 20px; }
      .jp-tts-field label {
        display: block;
        font-weight: 700; font-size: 0.85rem;
        color: #555; margin-bottom: 8px;
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      .jp-tts-field select {
        width: 100%; padding: 10px 12px;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        font-size: 0.95rem;
        background: #fafafa;
        color: #333;
        appearance: auto;
        cursor: pointer;
        transition: border-color 0.2s;
      }
      .jp-tts-field select:focus {
        outline: none;
        border-color: #4e54c8;
      }

      /* Speed slider */
      .jp-tts-speed-row {
        display: flex; align-items: center; gap: 12px;
      }
      .jp-tts-speed-row input[type="range"] {
        flex: 1;
        accent-color: #4e54c8;
        height: 6px;
      }
      .jp-tts-speed-val {
        font-weight: 800; font-size: 0.95rem;
        color: #4e54c8;
        min-width: 42px; text-align: center;
      }
      .jp-tts-speed-labels {
        display: flex; justify-content: space-between;
        font-size: 0.72rem; color: #999; margin-top: 4px;
      }

      /* Test button */
      .jp-tts-test-btn {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #4e54c8, #8f94fb);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: 700; font-size: 0.95rem;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      @media (hover: hover) { .jp-tts-test-btn:hover { opacity: 0.9; } }
      .jp-tts-test-btn:active { transform: scale(0.98); }

      /* No voices message */
      .jp-tts-no-voices {
        background: #fff3e0;
        border: 1px solid #ffe0b2;
        border-radius: 10px;
        padding: 12px 16px;
        font-size: 0.85rem;
        color: #e65100;
        line-height: 1.5;
        margin-top: 8px;
      }

      /* Voice quality badges */
      .jp-tts-quality-badge {
        display: inline-block;
        font-size: 0.65rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 5px;
        vertical-align: middle;
        letter-spacing: 0.3px;
      }
      .jp-tts-quality-premium { background: #fff3cd; color: #856404; }
      .jp-tts-quality-enhanced { background: #d1e7dd; color: #155724; }
      .jp-tts-quality-compact  { background: #f0e6ff; color: #6f42c1; }

      /* Get Better Voices section */
      .jp-tts-more-voices {
        background: #f8f9ff;
        border: 1.5px solid #e0e3ff;
        border-radius: 12px;
        padding: 14px 16px;
      }
      .jp-tts-installed-list {
        font-size: 0.82rem;
        color: #444;
        margin-bottom: 10px;
        line-height: 1.7;
      }
      .jp-tts-installed-list strong {
        display: block;
        color: #333;
        margin-bottom: 2px;
      }
      .jp-tts-missing-note {
        font-size: 0.82rem;
        padding: 7px 10px;
        border-radius: 8px;
        margin-bottom: 10px;
        line-height: 1.5;
      }
      .jp-tts-missing-note.has-missing {
        background: #eef0ff;
        color: #4e54c8;
      }
      .jp-tts-missing-note.all-good {
        background: #d1e7dd;
        color: #155724;
      }
      .jp-tts-instructions {
        font-size: 0.82rem;
        color: #444;
        line-height: 1.5;
      }
      .jp-tts-instructions strong {
        display: block;
        margin-bottom: 6px;
        color: #333;
      }
      .jp-tts-instructions ol {
        margin: 0 0 10px 18px;
        padding: 0;
      }
      .jp-tts-instructions li {
        margin-bottom: 4px;
      }
      .jp-tts-open-settings-btn {
        width: 100%;
        padding: 9px 12px;
        background: white;
        color: #4e54c8;
        border: 2px solid #4e54c8;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 4px;
      }
      @media (hover: hover) {
        .jp-tts-open-settings-btn:hover { background: #4e54c8; color: white; }
      }
      .jp-tts-open-settings-btn:active { transform: scale(0.98); }

      /* Divider */
      .jp-tts-divider {
        border: none;
        border-top: 1px solid #eee;
        margin: 0 0 20px;
      }

      /* Stamp picker */
      .jp-stamp-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        margin-top: 8px;
      }
      .jp-stamp-option {
        position: relative;
        aspect-ratio: 1;
        border: 3px solid #e0e0e0;
        border-radius: 12px;
        cursor: pointer;
        overflow: hidden;
        background: #fafafa;
        transition: border-color 0.2s, transform 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .jp-stamp-option img {
        width: 85%;
        height: 85%;
        object-fit: contain;
        pointer-events: none;
      }
      .jp-stamp-option.selected {
        border-color: #4e54c8;
        box-shadow: 0 0 0 2px rgba(78,84,200,0.25);
        background: #f0f0ff;
      }
      @media (hover: hover) {
        .jp-stamp-option:hover { border-color: #8f94fb; transform: scale(1.05); }
      }
      .jp-stamp-option:active { transform: scale(0.95); }
      .jp-stamp-name {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        background: rgba(0,0,0,0.55);
        color: white;
        font-size: 0.55rem;
        font-weight: 700;
        text-align: center;
        padding: 2px 0;
        line-height: 1.2;
      }
      .jp-stamp-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
        padding: 10px 14px;
        background: #f8f9ff;
        border-radius: 10px;
        border: 1.5px solid #e0e3ff;
      }
      .jp-stamp-preview img {
        width: 40px; height: 40px;
        object-fit: contain;
      }
      .jp-stamp-preview-text {
        font-size: 0.85rem;
        font-weight: 600;
        color: #4e54c8;
      }

      /* Gear button styles (shared across modules) */
      .jp-settings-gear {
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.4);
        color: white;
        width: 34px; height: 34px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.1rem;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
        padding: 0;
        flex-shrink: 0;
      }
      @media (hover: hover) { .jp-settings-gear:hover { background: rgba(255,255,255,0.35); } }

      /* Sentence-level speaker button (inline with jp text) */
      .jp-speak-sentence {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.85rem;
        opacity: 0.45;
        padding: 2px 4px;
        margin-left: 4px;
        transition: opacity 0.2s;
        vertical-align: middle;
        flex-shrink: 0;
      }
      @media (hover: hover) { .jp-speak-sentence:hover { opacity: 0.85; } }
      .jp-speak-sentence:active { transform: scale(0.9); }

      /* Play-all button for reading passages and conversations */
      .jp-speak-all-btn {
        background: rgba(78,84,200,0.08);
        border: 1px solid rgba(78,84,200,0.2);
        color: #4e54c8;
        padding: 6px 14px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 10px;
      }
      @media (hover: hover) {
        .jp-speak-all-btn:hover {
          background: rgba(78,84,200,0.15);
          border-color: rgba(78,84,200,0.4);
        }
      }
      .jp-speak-all-btn:active { transform: scale(0.97); }
      .jp-speak-all-btn.jp-speak-all-active {
        background: rgba(220,53,69,0.1);
        border-color: rgba(220,53,69,0.3);
        color: #dc3545;
      }
      @media (hover: hover) {
        .jp-speak-all-btn.jp-speak-all-active:hover {
          background: rgba(220,53,69,0.18);
          border-color: rgba(220,53,69,0.5);
        }
      }

      /* Menu gear — dark version for white background */
      .jp-settings-gear-menu {
        background: rgba(0,0,0,0.06);
        border: 1px solid rgba(0,0,0,0.1);
        color: #666;
        width: 38px; height: 38px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.3rem;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
        padding: 0;
        position: absolute;
        top: 15px; right: 15px;
      }
      @media (hover: hover) { .jp-settings-gear-menu:hover { background: rgba(0,0,0,0.12); color: #4e54c8; } }
    `;
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // --- Platform detection ---
  function detectPlatform() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Macintosh|Mac OS X/.test(ua) && !('ontouchend' in document)) return 'mac';
    if (/Windows/.test(ua)) return 'windows';
    return 'other';
  }

  // --- Voice quality tier from name ---
  function getVoiceQuality(voice) {
    var name = voice.name.toLowerCase();
    if (name.includes('premium')) return 'premium';
    if (name.includes('enhanced')) return 'enhanced';
    if (name.includes('compact')) return 'compact';
    return 'standard';
  }

  // Quality badge HTML (for installed voice list)
  function qualityBadge(q) {
    if (q === 'premium')  return '<span class="jp-tts-quality-badge jp-tts-quality-premium">Premium</span>';
    if (q === 'enhanced') return '<span class="jp-tts-quality-badge jp-tts-quality-enhanced">Enhanced</span>';
    if (q === 'compact')  return '<span class="jp-tts-quality-badge jp-tts-quality-compact">Compact</span>';
    return '';
  }

  // Quality suffix for dropdown option text (badges can't go in <option>)
  function qualitySuffix(q) {
    if (q === 'premium')  return ' [Premium]';
    if (q === 'enhanced') return ' [Enhanced]';
    if (q === 'compact')  return ' [Compact]';
    return '';
  }

  // Known good Japanese voices per platform (names to look for)
  var KNOWN_VOICES = {
    ios:     ['Kyoko', 'Otoya', 'O-ren'],
    mac:     ['Kyoko', 'Otoya', 'O-ren'],
    android: ['Google 日本語'],
    windows: ['Haruka', 'Ayumi', 'Ichiro'],
    other:   []
  };

  // --- Build the "Get Better Voices" section HTML ---
  function buildGetMoreVoices(voices, platform) {
    var known = KNOWN_VOICES[platform] || [];

    // Which known voices are NOT installed
    var missing = known.filter(function (name) {
      return !voices.some(function (v) {
        return v.name.toLowerCase().includes(name.toLowerCase());
      });
    });

    // Installed voices summary
    var installedHtml = '';
    if (voices.length === 0) {
      installedHtml = '<div class="jp-tts-installed-list" style="color:#e65100">No Japanese voices detected.</div>';
    } else {
      var items = voices.map(function (v) {
        var q = getVoiceQuality(v);
        return v.name + qualityBadge(q);
      }).join('<br>');
      installedHtml = '<div class="jp-tts-installed-list"><strong>Installed:</strong>' + items + '</div>';
    }

    // Missing / all-good note
    var noteHtml = '';
    if (missing.length > 0) {
      noteHtml = '<div class="jp-tts-missing-note has-missing">' +
        '⬇️ <strong>Available to download:</strong> ' + missing.join(', ') +
        '</div>';
    } else if (voices.length > 0) {
      var hasHighQuality = voices.some(function (v) {
        var q = getVoiceQuality(v);
        return q === 'enhanced' || q === 'premium';
      });
      if (hasHighQuality) {
        noteHtml = '<div class="jp-tts-missing-note all-good">✓ You have a high-quality voice installed.</div>';
      }
    }

    // Platform-specific step-by-step instructions
    var instructionsHtml = '';
    var deepLinkHtml = '';

    if (platform === 'ios') {
      instructionsHtml =
        '<div class="jp-tts-instructions">' +
        '<strong>To download better voices on iPhone / iPad:</strong>' +
        '<ol>' +
        '<li>Open the <strong>Settings</strong> app</li>' +
        '<li>Tap <strong>Accessibility</strong></li>' +
        '<li>Tap <strong>Spoken Content</strong></li>' +
        '<li>Tap <strong>Voices</strong></li>' +
        '<li>Tap <strong>Japanese</strong></li>' +
        '<li>Tap a voice name to download ⬇️</li>' +
        '</ol>' +
        '<em style="font-size:0.78rem;color:#888">Tip: Kyoko and Otoya Enhanced sound the most natural.</em>' +
        '</div>';
      // iOS deep-link from web Safari is blocked — skip the button

    } else if (platform === 'android') {
      instructionsHtml =
        '<div class="jp-tts-instructions">' +
        '<strong>To download better voices on Android:</strong>' +
        '<ol>' +
        '<li>Open <strong>Settings</strong></li>' +
        '<li>Tap <strong>Accessibility</strong></li>' +
        '<li>Tap <strong>Text-to-Speech Output</strong></li>' +
        '<li>Tap ⚙️ next to <strong>Google Text-to-Speech</strong></li>' +
        '<li>Tap <strong>Install voice data</strong></li>' +
        '<li>Find <strong>Japanese</strong> and download</li>' +
        '</ol>' +
        '</div>';
      // Android deep-link from web is also unreliable — skip the button

    } else if (platform === 'mac') {
      instructionsHtml =
        '<div class="jp-tts-instructions">' +
        '<strong>To download better voices on Mac:</strong>' +
        '<ol>' +
        '<li>Open <strong>System Settings</strong></li>' +
        '<li>Click <strong>Accessibility</strong></li>' +
        '<li>Click <strong>Spoken Content</strong></li>' +
        '<li>Click <strong>Manage Voices…</strong></li>' +
        '<li>Find Japanese voices and click ⬇️</li>' +
        '</ol>' +
        '</div>';
      // Mac deep-link works from Safari
      deepLinkHtml = '<button class="jp-tts-open-settings-btn" id="jp-tts-open-settings">Open System Settings →</button>';

    } else if (platform === 'windows') {
      instructionsHtml =
        '<div class="jp-tts-instructions">' +
        '<strong>To add Japanese voices on Windows:</strong>' +
        '<ol>' +
        '<li>Open <strong>Settings</strong></li>' +
        '<li>Click <strong>Time &amp; Language</strong></li>' +
        '<li>Click <strong>Language &amp; Region</strong></li>' +
        '<li>Add <strong>Japanese</strong> with speech/TTS support</li>' +
        '</ol>' +
        '</div>';
    }

    // If we have nothing useful to show (unknown platform), bail
    if (!instructionsHtml) return '';

    return (
      '<hr class="jp-tts-divider">' +
      '<div class="jp-tts-field">' +
        '<label>🎙️ Get Better Voices</label>' +
        '<div class="jp-tts-more-voices">' +
          installedHtml +
          noteHtml +
          instructionsHtml +
          deepLinkHtml +
        '</div>' +
      '</div>'
    );
  }

  function buildStampPicker() {
    var stampApi = window.JPShared.stampSettings;
    if (!stampApi) return '';
    var characters = stampApi.getCharactersCache();
    if (!characters || characters.length === 0) return '';
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
    var previewSrc = resolveUrl(selectedChar && selectedChar.portrait ? selectedChar.portrait : 'assets/characters/rikizo/rikizo_head.png');

    return (
      '<div class="jp-tts-field">' +
        '<label>My Stamp</label>' +
        '<div class="jp-stamp-grid" id="jp-stamp-grid">' + grid + '</div>' +
        '<div class="jp-stamp-preview" id="jp-stamp-preview">' +
          '<img src="' + previewSrc + '" id="jp-stamp-preview-img">' +
          '<span class="jp-stamp-preview-text" id="jp-stamp-preview-text">' + previewName + ' is your stamp!</span>' +
        '</div>' +
      '</div>' +
      '<hr class="jp-tts-divider">'
    );
  }

  function buildModal() {
    var tts = window.JPShared.tts;
    var voices = tts.getVoices();
    var current = tts.getSelectedVoice();
    var currentURI = current ? current.voiceURI : '';
    var rate = tts.getRate();
    var platform = detectPlatform();

    // Build voice options — include quality suffix since <option> can't use HTML
    var voiceOptions = '';
    if (voices.length === 0) {
      voiceOptions = '<option value="">No Japanese voices found</option>';
    } else {
      voices.forEach(function (v) {
        var q = getVoiceQuality(v);
        var label = v.name + qualitySuffix(q);
        label += v.localService ? ' (local)' : ' (online)';
        var sel = (v.voiceURI === currentURI) ? ' selected' : '';
        voiceOptions += '<option value="' + v.voiceURI.replace(/"/g, '&quot;') + '"' + sel + '>' +
                        label.replace(/</g, '&lt;') + '</option>';
      });
    }

    var noVoicesMsg = voices.length === 0
      ? '<div class="jp-tts-no-voices">No Japanese voices detected on this device. ' +
        'See the <strong>Get Better Voices</strong> section below for instructions.</div>'
      : '';

    var getMoreSection = buildGetMoreVoices(voices, platform);

    var stampSection = buildStampPicker();

    var html =
      '<div class="jp-tts-modal">' +
        '<div class="jp-tts-header">' +
          '<h3>\u2699\uFE0F Settings</h3>' +
          '<button class="jp-tts-close" id="jp-tts-close">\u2715</button>' +
        '</div>' +
        '<div class="jp-tts-body">' +
          stampSection +
          '<div class="jp-tts-field">' +
            '<label>Japanese Voice</label>' +
            '<select id="jp-tts-voice-select">' + voiceOptions + '</select>' +
            noVoicesMsg +
          '</div>' +
          '<div class="jp-tts-field">' +
            '<label>Speed</label>' +
            '<div class="jp-tts-speed-row">' +
              '<input type="range" id="jp-tts-speed" min="0.5" max="1.5" step="0.05" value="' + rate + '">' +
              '<span class="jp-tts-speed-val" id="jp-tts-speed-val">' + rate.toFixed(2) + 'x</span>' +
            '</div>' +
            '<div class="jp-tts-speed-labels"><span>Slow</span><span>Normal</span><span>Fast</span></div>' +
          '</div>' +
          '<div class="jp-tts-field">' +
            '<button class="jp-tts-test-btn" id="jp-tts-test">' +
              '\uD83D\uDD0A Test Voice \u2014 \u300C\u3053\u3093\u306B\u3061\u306F\u3001\u5143\u6C17\u3067\u3059\u304B\u3002\u300D' +
            '</button>' +
          '</div>' +
          getMoreSection +
        '</div>' +
      '</div>';

    return html;
  }

  async function open() {
    if (isOpen) return;
    injectStyles();
    isOpen = true;

    // Preload characters for stamp picker
    var stampApi = window.JPShared.stampSettings;
    if (stampApi && typeof stampApi.loadCharacters === 'function') {
      try { await stampApi.loadCharacters(); } catch(e) {}
    }

    overlay = document.createElement('div');
    overlay.className = 'jp-tts-overlay';
    overlay.innerHTML = buildModal();
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    // Close button
    document.getElementById('jp-tts-close').addEventListener('click', close);

    // Stamp picker
    var stampGrid = document.getElementById('jp-stamp-grid');
    if (stampGrid && stampApi) {
      stampGrid.addEventListener('click', function (e) {
        var option = e.target.closest('.jp-stamp-option');
        if (!option) return;
        var charId = option.dataset.charId;
        stampApi.setSelected(charId);
        // Update selection visual
        stampGrid.querySelectorAll('.jp-stamp-option').forEach(function (o) {
          o.classList.toggle('selected', o.dataset.charId === charId);
        });
        // Update preview
        var characters = stampApi.getCharactersCache() || [];
        var ch = characters.find(function (c) { return c.id === charId; });
        var previewImg = document.getElementById('jp-stamp-preview-img');
        var previewText = document.getElementById('jp-stamp-preview-text');
        var resolveFn = stampApi.resolveUrl || function (p) { return p; };
        if (ch && previewImg) previewImg.src = resolveFn(ch.portrait);
        if (ch && previewText) previewText.textContent = ch.meaning + ' is your stamp!';
      });
    }

    // Voice selection
    var voiceSelect = document.getElementById('jp-tts-voice-select');
    voiceSelect.addEventListener('change', function () {
      window.JPShared.tts.setVoice(this.value);
    });

    // Speed slider
    var speedSlider = document.getElementById('jp-tts-speed');
    var speedVal = document.getElementById('jp-tts-speed-val');
    speedSlider.addEventListener('input', function () {
      var r = parseFloat(this.value);
      speedVal.textContent = r.toFixed(2) + 'x';
      window.JPShared.tts.setRate(r);
    });

    // Test button
    document.getElementById('jp-tts-test').addEventListener('click', function () {
      window.JPShared.tts.speak('\u3053\u3093\u306B\u3061\u306F\u3001\u5143\u6C17\u3067\u3059\u304B\u3002\u4ECA\u65E5\u306F\u3044\u3044\u5929\u6C17\u3067\u3059\u306D\u3002');
    });

    // Mac "Open System Settings" deep-link
    var openSettingsBtn = document.getElementById('jp-tts-open-settings');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', function () {
        // Works in Safari on macOS — opens System Settings > Accessibility
        window.location.href = 'x-apple.systempreferences:com.apple.Accessibility-Settings.extension';
      });
    }

    // Refresh voices if Chrome loads them late
    if (window.speechSynthesis) {
      var refresh = function () {
        var voices = window.JPShared.tts.getVoices();
        if (voices.length > 0 && voiceSelect.options.length <= 1 && voiceSelect.options[0].value === '') {
          // Voices loaded after modal opened — rebuild options
          var current = window.JPShared.tts.getSelectedVoice();
          var currentURI = current ? current.voiceURI : '';
          voiceSelect.innerHTML = '';
          voices.forEach(function (v) {
            var opt = document.createElement('option');
            opt.value = v.voiceURI;
            var q = getVoiceQuality(v);
            opt.textContent = v.name + qualitySuffix(q) + (v.localService ? ' (local)' : ' (online)');
            if (v.voiceURI === currentURI) opt.selected = true;
            voiceSelect.appendChild(opt);
          });
          // Remove no-voices warning if present
          var warn = overlay.querySelector('.jp-tts-no-voices');
          if (warn) warn.remove();
          // Rebuild the Get Better Voices section with actual voice data
          var moreSection = overlay.querySelector('.jp-tts-field:last-child');
          if (moreSection) {
            var newHtml = buildGetMoreVoices(voices, detectPlatform());
            if (newHtml) {
              var tmp = document.createElement('div');
              tmp.innerHTML = newHtml;
              moreSection.parentNode.insertBefore(tmp.firstChild, moreSection.nextSibling);
              // Remove the old empty section if it was the no-voices placeholder
            }
          }
        }
      };
      window.speechSynthesis.onvoiceschanged = refresh;
      // Also check once after a short delay
      setTimeout(refresh, 500);
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    window.JPShared.tts.cancel();
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
  }

  // Inject styles immediately so gear buttons render correctly
  injectStyles();

  // --- Public API ---
  window.JPShared.ttsSettings = {
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };

})();
