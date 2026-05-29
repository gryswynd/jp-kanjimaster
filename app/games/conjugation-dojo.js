/**
 * app/games/conjugation-dojo.js
 * Conjugation Station — typing-based verb/adjective conjugation drill.
 * First game module under the Practice.js plugin architecture.
 *
 * Shell contract (hybrid):
 *   Practice.js owns chrome (streak counter, hanabi, session tracking).
 *   This module owns everything inside its container div.
 *   Shell passes: container, activeLessons, vocabMap, conjugationRules,
 *                 textProcessor, unlock, onCorrect, onWrong, onExit, getStreakInfo.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ---- CSS (injected once) ----
  function injectStyles() {
    if (document.getElementById('jp-dojo-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-dojo-style';
    s.textContent =
      '.dojo-wrap { font-family: "Poppins","Noto Sans JP",sans-serif; }' +

      // Form picker
      '.dojo-section-hdr { font-weight:800; font-size:0.85rem; text-transform:uppercase; color:#8e44ad; margin:16px 0 8px; display:flex; align-items:center; gap:6px; cursor:pointer; }' +
      '.dojo-section-hdr .arrow { transition:transform 0.2s; font-size:0.7rem; }' +
      '.dojo-section-hdr.open .arrow { transform:rotate(90deg); }' +
      '.dojo-form-list { display:none; flex-direction:column; gap:4px; margin-bottom:8px; }' +
      '.dojo-section-hdr.open + .dojo-form-list { display:flex; }' +
      '.dojo-form-row { display:flex; align-items:center; gap:8px; padding:4px 8px; border-radius:8px; }' +
      '.dojo-form-row:hover { background:rgba(142,68,173,0.06); }' +
      '.dojo-form-row input[type=checkbox] { accent-color:#8e44ad; width:16px; height:16px; }' +
      '.dojo-form-label { font-size:0.9rem; flex:1; cursor:pointer; }' +
      '.dojo-form-tag { font-size:0.65rem; color:#999; background:#f0f0f0; padding:1px 6px; border-radius:4px; }' +
      '.dojo-vc-filter { display:flex; gap:10px; margin:12px 0; flex-wrap:wrap; }' +
      '.dojo-vc-filter label { font-size:0.85rem; display:flex; align-items:center; gap:4px; cursor:pointer; }' +
      '.dojo-start-btn { width:100%; padding:14px; border:none; border-radius:12px; font-weight:700; font-size:1rem; color:#fff; background:linear-gradient(135deg,#8e44ad 0%,#6c3483 100%); cursor:pointer; margin-top:16px; transition:opacity 0.15s; }' +
      '.dojo-start-btn:disabled { opacity:0.4; cursor:default; }' +
      '.dojo-queue-info { text-align:center; font-size:0.85rem; color:#999; margin-top:8px; }' +

      // Drill
      '.dojo-prompt { text-align:center; padding:24px 16px; }' +
      '.dojo-dict { font-size:2.4rem; font-weight:900; line-height:1.2; }' +
      '.dojo-reading { font-size:1.1rem; color:#8e44ad; font-weight:600; margin-top:2px; }' +
      '.dojo-meaning { font-size:0.9rem; color:#747d8c; margin-top:4px; }' +
      '.dojo-target { font-size:1rem; font-weight:700; color:#DC2626; margin-top:12px; }' +
      '.dojo-badge { display:inline-block; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:20px; background:#f0e6f6; color:#8e44ad; margin-top:6px; }' +
      '.dojo-input-wrap { display:flex; gap:8px; margin-top:16px; }' +
      '.dojo-input { flex:1; font-size:1.3rem; font-family:"Noto Sans JP",sans-serif; padding:12px 16px; border:2px solid #ddd; border-radius:12px; outline:none; transition:border-color 0.15s; }' +
      '.dojo-input:focus { border-color:#8e44ad; }' +
      '.dojo-submit { padding:12px 20px; border:none; border-radius:12px; font-weight:700; font-size:1rem; color:#fff; background:#8e44ad; cursor:pointer; }' +

      // Feedback
      '.dojo-feedback { margin-top:16px; text-align:center; min-height:60px; }' +
      '.dojo-correct-msg { font-size:1.3rem; font-weight:800; color:#2ed573; }' +
      '.dojo-wrong-msg { font-size:1rem; font-weight:700; color:#ff4757; margin-bottom:8px; }' +
      '.dojo-diff { display:flex; justify-content:center; gap:2px; flex-wrap:wrap; margin:8px 0; }' +
      '.dojo-char { display:inline-flex; align-items:center; justify-content:center; width:32px; height:36px; font-size:1.2rem; font-family:"Noto Sans JP",sans-serif; border-radius:6px; font-weight:600; }' +
      '.dojo-char-ok { background:#d4edda; color:#155724; }' +
      '.dojo-char-wrong { background:#f8d7da; color:#721c24; text-decoration:line-through; }' +
      '.dojo-char-missing { background:#fff3cd; color:#856404; border-bottom:2px dashed #856404; }' +
      '.dojo-char-extra { background:#e2e3e5; color:#383d41; text-decoration:line-through; }' +
      '.dojo-answer-reveal { font-size:1.1rem; font-weight:700; color:#2f3542; margin:8px 0; }' +
      '.dojo-hint { font-size:0.85rem; color:#8e44ad; background:#f9f0ff; padding:8px 12px; border-radius:8px; border-left:3px solid #8e44ad; margin:8px auto; max-width:320px; text-align:left; }' +
      '.dojo-next-btn { padding:10px 28px; border:none; border-radius:10px; font-weight:700; color:#fff; background:#8e44ad; cursor:pointer; margin-top:10px; font-size:0.95rem; }' +

      // Helper panel
      '.dojo-helper-toggle { font-size:0.85rem; color:#8e44ad; background:none; border:1px solid #8e44ad; border-radius:8px; padding:4px 12px; cursor:pointer; margin-top:12px; }' +
      '.dojo-helper { display:none; margin-top:10px; padding:12px; background:#fdf8ff; border:1px solid #e8d5f5; border-radius:10px; font-size:0.85rem; font-family:"Noto Sans JP",monospace; }' +
      '.dojo-helper.open { display:block; }' +
      '.dojo-helper table { width:100%; border-collapse:collapse; }' +
      '.dojo-helper td { padding:3px 8px; }' +
      '.dojo-helper .hl { color:#8e44ad; font-weight:700; }' +

      // Summary
      '.dojo-summary { text-align:center; padding:20px 0; }' +
      '.dojo-score { font-size:2rem; font-weight:900; }' +
      '.dojo-score-pct { font-size:1.1rem; color:#747d8c; }' +
      '.dojo-breakdown { margin:16px 0; text-align:left; font-size:0.85rem; }' +
      '.dojo-breakdown-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f0f0f0; }' +
      '.dojo-summary-btns { display:flex; flex-direction:column; gap:8px; margin-top:16px; }' +
      '.dojo-summary-btns button { padding:12px; border:none; border-radius:10px; font-weight:700; font-size:0.95rem; cursor:pointer; }' +
      '.dojo-btn-primary { color:#fff; background:linear-gradient(135deg,#8e44ad 0%,#6c3483 100%); }' +
      '.dojo-btn-secondary { color:#8e44ad; background:#f0e6f6; }' +

      // Animation
      '@keyframes dojoCorrectFlash { 0%{background:#d4edda} 100%{background:transparent} }' +
      '@keyframes dojoWrongShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }' +
      '.dojo-flash-correct { animation:dojoCorrectFlash 0.6s ease; }' +
      '.dojo-flash-wrong { animation:dojoWrongShake 0.4s ease; }' +

      // False ichidan warning
      '.dojo-warn { display:inline-block; font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:20px; background:#fff3cd; color:#856404; border:1px solid #ffc107; margin-top:6px; }' +
      '.dojo-warn-hint { font-size:0.82rem; color:#856404; background:#fff9e6; padding:8px 12px; border-radius:8px; border-left:3px solid #ffc107; margin:8px auto; max-width:320px; text-align:left; }';
    document.head.appendChild(s);
  }

  // ---- False ichidan registry ----
  // Godan verbs whose reading ends in いる/える pattern, breaking the ichidan rule.
  var FALSE_ICHIDAN = {
    'v_hairu':     { surface: '\u5165\u308B', pair: null,              note: '\u306F\u3044\u308B looks ichidan but conjugates godan: \u5165\u3063\u3066 not \u5165\u3066' },
    'v_kiru_2':    { surface: '\u5207\u308B', pair: '\u7740\u308B (ichidan, to wear)', note: '\u304D\u308B has a minimal pair: \u5207\u308B (godan, to cut) vs \u7740\u308B (ichidan, to wear)' },
    'v_kaeru':     { surface: '\u5E30\u308B', pair: null,              note: '\u304B\u3048\u308B looks ichidan but conjugates godan: \u5E30\u3063\u3066 not \u5E30\u3066' },
    'v_hashiru':   { surface: '\u8D70\u308B', pair: null,              note: '\u306F\u3057\u308B looks ichidan but conjugates godan: \u8D70\u3063\u3066 not \u8D70\u3066' },
    'v_shiru':     { surface: '\u77E5\u308B', pair: null,              note: '\u3057\u308B looks ichidan but conjugates godan: \u77E5\u3063\u3066 not \u77E5\u3066' },
    'v_mochikaeru':{ surface: '\u6301\u3061\u5E30\u308B', pair: null,  note: 'Compound of \u5E30\u308B \u2014 also godan' },
    'v_iru_need':  { surface: '\u8981\u308B', pair: '\u3044\u308B (ichidan, to exist)', note: '\u3044\u308B has a minimal pair: \u8981\u308B (godan, to need) vs \u5C45\u308B (ichidan, to exist)' }
  };

  function getFalseIchidanInfo(termId) {
    return FALSE_ICHIDAN[termId] || null;
  }

  // ---- State ----
  var cfg = {};
  var container = null;
  var activeForms = new Set();
  var excludedForms = loadExcluded();
  var activeVerbClasses = new Set(['godan', 'ichidan', 'irr_suru', 'irr_kuru', 'irr_aru', 'irr_iku', 'i_adj', 'na_adj']);
  var queue = [];
  var qIdx = 0;
  var sessionCorrect = 0;
  var sessionTotal = 0;
  var mistakes = [];
  var helperVisible = false;
  var isComposing = false;
  var sessionLength = loadSessionLength();

  function loadExcluded() {
    try { return new Set(JSON.parse(localStorage.getItem('k-dojo-excluded') || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveExcluded() {
    try { localStorage.setItem('k-dojo-excluded', JSON.stringify(Array.from(excludedForms))); }
    catch (e) { /* ignore */ }
  }
  function loadSessionLength() {
    try {
      var stored = localStorage.getItem('k-dojo-session-len');
      if (stored === null) return 30;
      var n = parseInt(stored, 10);
      return isNaN(n) ? 30 : n;
    } catch (e) { return 30; }
  }
  function saveSessionLength(n) {
    sessionLength = n;
    try { localStorage.setItem('k-dojo-session-len', String(n)); }
    catch (e) { /* ignore */ }
  }

  // ---- Fisher-Yates shuffle ----
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ---- Lesson filter — strict: entry must belong to an active lesson ----
  function isEntryActive(entry) {
    if (!entry.verb_class || (entry.id && entry.id.includes('__'))) return false;
    // Entries with no/empty lesson_ids are excluded — every conjugatable word must belong to a lesson
    if (!entry.lesson_ids) return false;
    return cfg.activeLessons.has(entry.lesson_ids);
  }

  // ---- Pool scanning — detect what's available from active lessons ----
  function scanPool() {
    var verbCount = 0;
    var adjCount = 0;
    var classesFound = new Set();
    cfg.vocabMap.forEach(function (entry) {
      if (!isEntryActive(entry)) return;
      var vc = normalizeClass(entry.verb_class);
      classesFound.add(vc);
      if (vc === 'i_adj' || vc === 'na_adj' || vc === 'irr_ii') adjCount++;
      else if (vc !== 'copula') verbCount++;
    });
    return { verbCount: verbCount, adjCount: adjCount, classesFound: classesFound };
  }

  // ---- Verb class helpers ----
  function normalizeClass(vc) {
    if (vc === 'u') return 'godan';
    if (vc === 'ru') return 'ichidan';
    if (vc === 'verb') return 'godan';
    return vc || 'godan';
  }
  function classLabel(vc) {
    var labels = { godan: 'Godan', ichidan: 'Ichidan', irr_suru: 'Irregular', irr_kuru: 'Irregular', irr_aru: 'Irregular', irr_iku: 'Irregular', i_adj: 'i-Adj', na_adj: 'na-Adj', irr_ii: 'Irregular' };
    return labels[vc] || vc;
  }

  // ---- Form gating ----
  // Map each conjugation form to the grammar lesson that teaches it.
  // Source: GRAMMAR_CONTENT.md (authoritative grammar scope).
  var FORM_TO_GRAMMAR = {
    // G1 — Copula
    polite_adj: 'G1', copula_negative: 'G1', copula_past: 'G1',
    copula_past_negative: 'G1', polite_past_copula: 'G1',
    // G7 — Polite Verb Forms (ます system)
    polite_masu: 'G7', polite_mashita: 'G7', polite_negative: 'G7',
    polite_past_negative: 'G7', masu_stem: 'G7',
    // G8 — て-form & た-form
    te_form: 'G8', plain_past: 'G8', polite_negative_te: 'G8',
    // G9 — Progressive, Desire, Suggestions
    casual_te_iru: 'G9', desire_tai: 'G9', desire_tai_negative: 'G9',
    polite_desire_tai_negative: 'G9', polite_volitional_mashou: 'G9',
    da_past: 'G9', da_negative: 'G9', da_past_negative: 'G9', plain_adj: 'G9',
    // G10 — Plain Forms & Basic Connectors
    plain_negative: 'G10', plain_past_negative: 'G10', plain_past_adj: 'G10',
    plain_desire_tai: 'G10', plain_desire_tai_past: 'G10',
    // G11 — i-Adjective Conjugation
    polite_past_adj: 'G11', adverbial: 'G11', desire_tai_past: 'G11',
    // G12 — na-Adjective Conjugation
    attributive_na: 'G12',
    // G13 — Potential Form
    potential: 'G13', polite_potential: 'G13', potential_negative: 'G13',
    polite_potential_negative: 'G13', plain_potential_negative: 'G13',
    polite_potential_past: 'G13', plain_potential_past: 'G13',
    // G15 — Comparison & Degree (sugiru)
    sugiru_form: 'G15', polite_sugiru_form: 'G15',
    // G19 — Connecting Actions (nagara, tari)
    tari_form: 'G19', nagara_form: 'G19',
    // G22 — Appearance (そうだ)
    appearance_sou_stem: 'G22', appearance_sou: 'G22', plain_appearance_sou: 'G22',
    // G25 — Obligations & Conditionals
    conditional_ba: 'G25', conditional_tara: 'G25', nakereba: 'G25',
    sugiru_past: 'G25', polite_sugiru_past: 'G25',
    // G28 — Passive Form
    passive: 'G28', polite_passive: 'G28', polite_passive_past: 'G28', plain_passive_past: 'G28',
    // G29 — Causative Form
    causative: 'G29', polite_causative: 'G29', polite_causative_past: 'G29', plain_causative_past: 'G29',
    // G34 — Volitional Form & Intentions
    plain_volitional: 'G34',
    // G43 — Causative-Passive & Advanced Voice
    causative_passive: 'G43', polite_causative_passive: 'G43'
  };

  function isFormUnlocked(formKey) {
    var gLesson = FORM_TO_GRAMMAR[formKey];
    if (!gLesson) return false; // unmapped form = not available
    // No unlock system or free mode → all forms available
    if (!cfg.unlock || cfg.unlock.isFree()) return true;
    // Gated mode → check grammar lesson completion
    return cfg.unlock.isCompleted(gLesson);
  }

  function getFormGLesson(formKey) {
    return FORM_TO_GRAMMAR[formKey] || '?';
  }

  // Categories ordered by grammar lesson progression
  var FORM_CATEGORIES = [
    { name: 'Copula (G1/G9)', keys: ['polite_adj','copula_negative','copula_past','copula_past_negative','polite_past_copula','da_past','da_negative','da_past_negative'] },
    { name: 'Polite Verb Forms (G7)', keys: ['polite_masu','polite_mashita','polite_negative','polite_past_negative','masu_stem'] },
    { name: 'Te / Ta Forms (G8)', keys: ['te_form','plain_past','polite_negative_te'] },
    { name: 'Desire & Suggestions (G9)', keys: ['desire_tai','desire_tai_negative','polite_desire_tai_negative','polite_volitional_mashou','casual_te_iru','plain_adj'] },
    { name: 'Plain Forms (G10)', keys: ['plain_negative','plain_past_negative','plain_past_adj','plain_desire_tai','plain_desire_tai_past'] },
    { name: 'i-Adjective (G11)', keys: ['polite_past_adj','adverbial','desire_tai_past'] },
    { name: 'na-Adjective (G12)', keys: ['attributive_na'] },
    { name: 'Potential (G13)', keys: ['potential','polite_potential','potential_negative','polite_potential_negative','plain_potential_negative','polite_potential_past','plain_potential_past'] },
    { name: 'Excessive (G15)', keys: ['sugiru_form','polite_sugiru_form'] },
    { name: 'Tari & Nagara (G19)', keys: ['tari_form','nagara_form'] },
    { name: 'Appearance (G22)', keys: ['appearance_sou_stem','appearance_sou','plain_appearance_sou'] },
    { name: 'Conditionals (G25)', keys: ['conditional_ba','conditional_tara','nakereba','sugiru_past','polite_sugiru_past'] },
    { name: 'Passive (G28)', keys: ['passive','polite_passive','polite_passive_past','plain_passive_past'] },
    { name: 'Causative (G29)', keys: ['causative','polite_causative','polite_causative_past','plain_causative_past'] },
    { name: 'Volitional (G34)', keys: ['plain_volitional'] },
    { name: 'Causative-Passive (G43)', keys: ['causative_passive','polite_causative_passive'] }
  ];

  function getUnlockedForms() {
    var rules = cfg.conjugationRules;
    var unlocked = [];
    for (var key in rules) {
      var form = rules[key];
      if (!form || !form.rules) continue;
      if (key === 'plain_form') continue;
      // Gate by per-form grammar lesson mapping
      if (!isFormUnlocked(key)) continue;
      var classes = Object.keys(form.rules);
      if (!classes.some(function (c) { return c !== 'copula'; })) continue;
      unlocked.push({ key: key, label: form.label, gLesson: getFormGLesson(key), rules: form.rules });
    }
    return unlocked;
  }

  function countQueue() {
    var rules = cfg.conjugationRules;
    var count = 0;
    cfg.vocabMap.forEach(function (entry) {
      if (!isEntryActive(entry)) return;
      var vc = normalizeClass(entry.verb_class);
      if (!activeVerbClasses.has(vc)) return;
      activeForms.forEach(function (ruleKey) {
        var formDef = rules[ruleKey];
        if (!formDef) return;
        var effectiveClass = vc;
        if (vc === 'irr_iku' && !formDef.rules['irr_iku']) effectiveClass = 'godan';
        if (!formDef.rules[effectiveClass]) return;
        if (formDef.rules[effectiveClass].type === 'identity') return;
        count++;
      });
    });
    return sessionLength > 0 ? Math.min(count, sessionLength) : count;
  }

  function buildPoolInfoHTML(pool) {
    var hasVerbs = pool.verbCount > 0;
    var hasAdjs = pool.adjCount > 0;
    var h = '';
    if (hasVerbs || hasAdjs) {
      h += '<strong>' + pool.verbCount + '</strong> verb' + (pool.verbCount !== 1 ? 's' : '');
      h += ' &nbsp;&bull;&nbsp; ';
      h += '<strong>' + pool.adjCount + '</strong> adjective' + (pool.adjCount !== 1 ? 's' : '');
    } else {
      h += '<span style="color:#e74c3c;font-weight:600;">No conjugatable words found</span>';
      h += '<br><span style="font-size:0.8rem;">Select lessons with verbs or adjectives in the main menu</span>';
    }
    return h;
  }

  // ---- Step 2: Form selection (shown after Load Forms) ----
  function renderFormSelection(pool) {
    var unlocked = getUnlockedForms();
    var unlockedKeys = new Set(unlocked.map(function (f) { return f.key; }));
    var formMap = {};
    unlocked.forEach(function (f) { formMap[f.key] = f; });

    var hasVerbs = pool.verbCount > 0;
    var hasAdjs = pool.adjCount > 0;

    // Restore previous selections (default: all on except excluded)
    activeForms.clear();
    unlocked.forEach(function (f) {
      if (!excludedForms.has(f.key)) activeForms.add(f.key);
    });

    var html = '<div class="dojo-wrap">';

    // Pool info (compact)
    html += '<div style="font-size:0.85rem;color:#747d8c;background:#f8f9fa;padding:8px 12px;border-radius:8px;margin-bottom:12px;text-align:center;">';
    html += buildPoolInfoHTML(pool);
    html += '</div>';

    // Word type filter
    html += '<div style="font-weight:700;font-size:0.85rem;color:#555;margin-bottom:4px;">Word Types</div>';
    html += '<div class="dojo-vc-filter">';
    var vcOptions = [
      { vc: 'godan', lbl: 'Godan' },
      { vc: 'ichidan', lbl: 'Ichidan' },
      { vc: 'irr_suru', lbl: 'する' },
      { vc: 'irr_kuru', lbl: '来る' },
      { vc: 'irr_iku', lbl: '行く' },
      { vc: 'i_adj', lbl: 'i-Adj' },
      { vc: 'na_adj', lbl: 'na-Adj' }
    ];
    vcOptions.forEach(function (opt) {
      var available = pool.classesFound.has(opt.vc);
      var disabled = !available;
      var checked = available && activeVerbClasses.has(opt.vc);
      if (!available) activeVerbClasses.delete(opt.vc);
      html += '<label style="' + (disabled ? 'opacity:0.4;' : '') + '"><input type="checkbox" class="dojo-vc-chk" data-vc="' + opt.vc + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + opt.lbl + '</label>';
    });
    html += '</div>';

    // Identify which form categories are adjective-only vs verb-only
    // 'Desire & Suggestions (G9)' and 'Plain Forms (G10)' are mixed, so stay unlocked.
    var ADJ_ONLY_CATS = new Set(['i-Adjective (G11)', 'na-Adjective (G12)']);
    var VERB_ONLY_CATS = new Set([
      'Polite Verb Forms (G7)', 'Te / Ta Forms (G8)',
      'Potential (G13)', 'Excessive (G15)',
      'Tari & Nagara (G19)', 'Appearance (G22)', 'Conditionals (G25)',
      'Passive (G28)', 'Causative (G29)', 'Volitional (G34)', 'Causative-Passive (G43)'
    ]);

    // Form categories
    FORM_CATEGORIES.forEach(function (cat) {
      var catForms = cat.keys.filter(function (k) { return unlockedKeys.has(k); });
      if (catForms.length === 0) return;

      var catLocked = false;
      if (ADJ_ONLY_CATS.has(cat.name) && !hasAdjs) catLocked = true;
      if (VERB_ONLY_CATS.has(cat.name) && !hasVerbs) catLocked = true;

      if (catLocked) {
        catForms.forEach(function (k) { activeForms.delete(k); });
      }

      var allOn = !catLocked && catForms.every(function (k) { return activeForms.has(k); });
      html += '<div class="dojo-section-hdr open" data-cat="' + cat.name + '" style="' + (catLocked ? 'opacity:0.4;' : '') + '">' +
        '<span class="arrow">&#9654;</span>' +
        '<input type="checkbox" class="dojo-cat-chk" data-cat="' + cat.name + '"' + (allOn ? ' checked' : '') + (catLocked ? ' disabled' : '') + '> ' +
        cat.name + (catLocked ? ' <span style="font-size:0.7rem;font-weight:400;color:#e74c3c;">(no matching words)</span>' : '') +
        ' <span style="color:#bbb;font-weight:400;font-size:0.75rem">(' + catForms.length + ')</span></div>';
      html += '<div class="dojo-form-list" data-cat="' + cat.name + '" style="display:flex;">';
      catForms.forEach(function (key) {
        var f = formMap[key];
        var checked = !catLocked && activeForms.has(key) ? ' checked' : '';
        html += '<div class="dojo-form-row">' +
          '<input type="checkbox" class="dojo-form-chk" data-key="' + key + '"' + checked + (catLocked ? ' disabled' : '') + '>' +
          '<span class="dojo-form-label">' + f.label + '</span>' +
          '<span class="dojo-form-tag">' + f.gLesson + '</span></div>';
      });
      html += '</div>';
    });

    // Session length selector
    html += '<div style="margin-top:16px;display:flex;align-items:center;gap:10px;justify-content:center;">';
    html += '<span style="font-weight:700;font-size:0.85rem;color:#555;">Session length:</span>';
    [10, 20, 30, 0].forEach(function (n) {
      var label = n === 0 ? 'All' : String(n);
      var selected = sessionLength === n;
      html += '<button class="dojo-len-btn" data-len="' + n + '" style="padding:6px 14px;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;border:2px solid ' + (selected ? '#8e44ad' : '#ddd') + ';background:' + (selected ? '#f0e6f6' : '#fff') + ';color:' + (selected ? '#8e44ad' : '#555') + ';">' + label + '</button>';
    });
    html += '</div>';

    html += '<button class="dojo-start-btn" id="dojo-start-btn">Start Drill</button>';
    html += '<div class="dojo-queue-info" id="dojo-queue-info"></div>';

    // Back to kanji gate
    html += '<button class="dojo-btn-secondary" id="dojo-back-gate" style="width:100%;padding:10px;margin-top:4px;font-size:0.85rem;">Back to Menu</button>';

    html += '</div>';

    container.innerHTML = html;
    updateQueueInfo();

    // Wire events
    container.querySelectorAll('.dojo-section-hdr').forEach(function (hdr) {
      hdr.addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        hdr.classList.toggle('open');
        var list = hdr.nextElementSibling;
        if (list) list.style.display = hdr.classList.contains('open') ? 'flex' : 'none';
      });
    });

    container.querySelectorAll('.dojo-cat-chk').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var catName = chk.dataset.cat;
        var list = container.querySelector('.dojo-form-list[data-cat="' + catName + '"]');
        if (!list) return;
        list.querySelectorAll('.dojo-form-chk').forEach(function (fc) {
          fc.checked = chk.checked;
          toggleForm(fc.dataset.key, chk.checked);
        });
        updateQueueInfo();
      });
    });

    container.querySelectorAll('.dojo-form-chk').forEach(function (chk) {
      chk.addEventListener('change', function () {
        toggleForm(chk.dataset.key, chk.checked);
        syncCatCheckbox(chk);
        updateQueueInfo();
      });
    });

    container.querySelectorAll('.dojo-vc-chk').forEach(function (chk) {
      chk.addEventListener('change', function () {
        if (chk.checked) activeVerbClasses.add(chk.dataset.vc);
        else activeVerbClasses.delete(chk.dataset.vc);
        updateQueueInfo();
      });
    });

    container.querySelectorAll('.dojo-len-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = parseInt(btn.dataset.len, 10);
        saveSessionLength(n);
        container.querySelectorAll('.dojo-len-btn').forEach(function (b) {
          var sel = parseInt(b.dataset.len, 10) === n;
          b.style.borderColor = sel ? '#8e44ad' : '#ddd';
          b.style.background = sel ? '#f0e6f6' : '#fff';
          b.style.color = sel ? '#8e44ad' : '#555';
        });
        updateQueueInfo();
      });
    });

    document.getElementById('dojo-start-btn').addEventListener('click', function () {
      if (activeForms.size === 0) return;
      startDrill();
    });

    document.getElementById('dojo-back-gate').addEventListener('click', function () {
      cfg.onExit && cfg.onExit();
    });
  }

  function toggleForm(key, on) {
    if (on) { activeForms.add(key); excludedForms.delete(key); }
    else { activeForms.delete(key); excludedForms.add(key); }
    saveExcluded();
  }

  function syncCatCheckbox(formChk) {
    var row = formChk.closest('.dojo-form-list');
    if (!row) return;
    var catName = row.dataset.cat;
    var catChk = container.querySelector('.dojo-cat-chk[data-cat="' + catName + '"]');
    if (!catChk) return;
    var all = row.querySelectorAll('.dojo-form-chk');
    var checked = row.querySelectorAll('.dojo-form-chk:checked');
    catChk.checked = checked.length === all.length;
    catChk.indeterminate = checked.length > 0 && checked.length < all.length;
  }

  function updateQueueInfo() {
    var c = countQueue();
    var info = document.getElementById('dojo-queue-info');
    var btn = document.getElementById('dojo-start-btn');
    if (info) info.textContent = c > 0 ? c + ' questions available' : 'Select forms and lessons to begin';
    if (btn) btn.disabled = c === 0;
  }

  // ---- Queue building ----
  function buildQueue() {
    var rules = cfg.conjugationRules;
    var tp = cfg.textProcessor;
    var pairs = [];
    cfg.vocabMap.forEach(function (entry) {
      if (!isEntryActive(entry)) return;
      var vc = normalizeClass(entry.verb_class);
      if (!activeVerbClasses.has(vc)) return;
      activeForms.forEach(function (ruleKey) {
        var formDef = rules[ruleKey];
        if (!formDef) return;
        var effectiveClass = vc;
        if (vc === 'irr_iku' && !formDef.rules['irr_iku']) effectiveClass = 'godan';
        if (!formDef.rules[effectiveClass]) return;
        if (formDef.rules[effectiveClass].type === 'identity') return;
        var term = { surface: entry.surface, reading: entry.reading, meaning: entry.meaning, verb_class: vc };
        var conjugated = tp.conjugate(term, ruleKey, rules);
        if (conjugated.surface !== entry.surface) {
          var rule = formDef.rules[effectiveClass];
          var altSurfaces = [], altReadings = [];
          if (rule.alternates) {
            var removeLen = rule.remove ? rule.remove.length : 0;
            var surfaceStem = removeLen ? entry.surface.slice(0, -removeLen) : entry.surface;
            var readingStem = removeLen ? entry.reading.slice(0, -removeLen) : entry.reading;
            rule.alternates.forEach(function (altSuffix) {
              altSurfaces.push(surfaceStem + altSuffix);
              altReadings.push(readingStem + altSuffix);
            });
          }
          pairs.push({
            term: entry, vc: vc, ruleKey: ruleKey, formLabel: formDef.label,
            correctSurface: conjugated.surface, correctReading: conjugated.reading,
            altSurfaces: altSurfaces, altReadings: altReadings
          });
        }
      });
    });
    shuffle(pairs);
    return sessionLength > 0 ? pairs.slice(0, sessionLength) : pairs;
  }

  // ---- Drill ----
  function startDrill() {
    queue = buildQueue();
    if (queue.length === 0) return;
    qIdx = 0; sessionCorrect = 0; sessionTotal = 0; mistakes = [];
    helperVisible = false;
    renderDrill();
  }

  function startDrillWithQueue(q) {
    queue = q;
    if (queue.length === 0) { initFormSelection(); return; }
    qIdx = 0; sessionCorrect = 0; sessionTotal = 0; mistakes = [];
    helperVisible = false;
    renderDrill();
  }

  function renderDrill() {
    if (qIdx >= queue.length) { renderSummary(); return; }
    var item = queue[qIdx];
    cfg.onProgress && cfg.onProgress(qIdx + 1, queue.length);

    var html = '<div class="dojo-wrap">';

    // Prompt card
    html += '<div class="dojo-prompt">';
    html += '<div class="dojo-dict">' + esc(item.term.surface) + '</div>';
    html += '<div class="dojo-reading">' + esc(item.term.reading) + '</div>';
    html += '<div class="dojo-meaning">' + esc(item.term.meaning) + '</div>';
    html += '<div class="dojo-target">\u2192 ' + esc(item.formLabel) + '</div>';
    html += '<div class="dojo-badge">' + classLabel(item.vc) + '</div>';
    var falseIchi = getFalseIchidanInfo(item.term.id);
    if (falseIchi) {
      html += '<div class="dojo-warn">\u26A0 Exception: Godan verb (looks ichidan!)</div>';
    }
    html += '</div>';

    // Input
    html += '<div class="dojo-input-wrap">';
    html += '<input type="text" class="dojo-input" id="dojo-input" lang="ja" inputmode="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Type answer...">';
    html += '<button class="dojo-submit" id="dojo-submit-btn">Go</button>';
    html += '</div>';

    // Feedback area
    html += '<div class="dojo-feedback" id="dojo-feedback"></div>';

    // Helper toggle + panel
    html += '<div style="text-align:center">';
    html += '<button class="dojo-helper-toggle" id="dojo-helper-toggle">\uD83D\uDCD6 Helper</button>';
    html += '</div>';
    html += buildHelperHTML(item);

    html += '</div>';
    container.innerHTML = html;

    // Wire IME-safe input
    var inp = document.getElementById('dojo-input');
    var submitted = false;
    isComposing = false;

    inp.addEventListener('compositionstart', function () { isComposing = true; });
    inp.addEventListener('compositionend', function () { isComposing = false; });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !isComposing && !submitted) {
        e.preventDefault();
        submitted = true;
        submitAnswer(item, inp.value);
      }
    });
    document.getElementById('dojo-submit-btn').addEventListener('click', function () {
      if (!submitted) { submitted = true; submitAnswer(item, inp.value); }
    });
    document.getElementById('dojo-helper-toggle').addEventListener('click', function () {
      helperVisible = !helperVisible;
      var panel = document.getElementById('dojo-helper-panel');
      if (panel) panel.classList.toggle('open', helperVisible);
    });

    inp.focus();
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ---- Answer checking + feedback ----
  function submitAnswer(item, input) {
    var normalized = (input || '').trim();
    if (!normalized) return;
    sessionTotal++;
    var isCorrect = normalized === item.correctSurface || normalized === item.correctReading ||
      (item.altSurfaces && item.altSurfaces.indexOf(normalized) >= 0) ||
      (item.altReadings && item.altReadings.indexOf(normalized) >= 0);
    var fb = document.getElementById('dojo-feedback');
    var inp = document.getElementById('dojo-input');
    if (inp) inp.disabled = true;

    if (isCorrect) {
      cfg.onCorrect && cfg.onCorrect();
      if (fb) {
        fb.innerHTML = '<div class="dojo-correct-msg">\u6B63\u89E3\uFF01</div>';
        fb.classList.add('dojo-flash-correct');
      }
      sessionCorrect++;
      setTimeout(function () { qIdx++; renderDrill(); }, 1000);
    } else {
      cfg.onWrong && cfg.onWrong();
      mistakes.push(item);
      // Pick the candidate that shares the longest common prefix with user input,
      // so kanji input is diffed against the surface form (not the hiragana reading)
      var candidates = [item.correctSurface, item.correctReading]
        .concat(item.altSurfaces || [])
        .concat(item.altReadings || []);
      var expected = item.correctReading;
      var bestPrefix = -1;
      candidates.forEach(function (candidate) {
        if (!candidate) return;
        var p = 0;
        while (p < normalized.length && p < candidate.length && normalized[p] === candidate[p]) p++;
        if (p > bestPrefix) { bestPrefix = p; expected = candidate; }
      });
      var diff = buildCharDiff(normalized, expected);
      var hint = getGodanHint(item);
      var h = '<div class="dojo-wrong-msg">\u6B8B\u5FF5\uFF01</div>';
      h += '<div class="dojo-diff">' + diff.map(function (d) {
        return '<span class="dojo-char dojo-char-' + d.status + '">' + esc(d.char) + '</span>';
      }).join('') + '</div>';
      h += '<div class="dojo-answer-reveal">\u6B63\u89E3: ' + esc(item.correctSurface) + ' (' + esc(item.correctReading) + ')</div>';
      if (hint) h += '<div class="dojo-hint">' + esc(hint) + '</div>';
      var falseIchiHint = getFalseIchidanInfo(item.term.id);
      if (falseIchiHint) h += '<div class="dojo-warn-hint">\u26A0 ' + esc(falseIchiHint.note) + (falseIchiHint.pair ? ' \u2014 Compare: ' + esc(falseIchiHint.pair) : '') + '</div>';
      h += '<button class="dojo-next-btn" id="dojo-next-btn">Next \u27A1</button>';
      if (fb) { fb.innerHTML = h; fb.classList.add('dojo-flash-wrong'); }
      var nextBtn = document.getElementById('dojo-next-btn');
      if (nextBtn) nextBtn.addEventListener('click', function () { qIdx++; renderDrill(); });
    }
  }

  function buildCharDiff(userInput, expected) {
    var result = [];
    // Find common prefix length
    var prefixLen = 0;
    while (prefixLen < userInput.length && prefixLen < expected.length &&
           userInput[prefixLen] === expected[prefixLen]) {
      prefixLen++;
    }
    // Matching prefix — green
    for (var i = 0; i < prefixLen; i++) {
      result.push({ char: userInput[i], status: 'ok' });
    }
    // User's wrong suffix — red strikethrough
    for (var i = prefixLen; i < userInput.length; i++) {
      result.push({ char: userInput[i], status: 'wrong' });
    }
    // Full expected correct suffix — yellow (what they should have typed)
    for (var i = prefixLen; i < expected.length; i++) {
      result.push({ char: expected[i], status: 'missing' });
    }
    return result;
  }

  // ---- Godan contextual hints ----
  var SOUND_GROUPS = {
    'te_form': [
      { chars: ['\u3080','\u3076','\u306C'], result: '\u3093\u3067', label: '\u3080/\u3076/\u306C \u2192 \u3093\u3067' },
      { chars: ['\u304F'], result: '\u3044\u3066', label: '\u304F \u2192 \u3044\u3066' },
      { chars: ['\u3050'], result: '\u3044\u3067', label: '\u3050 \u2192 \u3044\u3067' },
      { chars: ['\u3059'], result: '\u3057\u3066', label: '\u3059 \u2192 \u3057\u3066' },
      { chars: ['\u3046','\u3064','\u308B'], result: '\u3063\u3066', label: '\u3046/\u3064/\u308B \u2192 \u3063\u3066' }
    ],
    'plain_past': [
      { chars: ['\u3080','\u3076','\u306C'], result: '\u3093\u3060', label: '\u3080/\u3076/\u306C \u2192 \u3093\u3060' },
      { chars: ['\u304F'], result: '\u3044\u305F', label: '\u304F \u2192 \u3044\u305F' },
      { chars: ['\u3050'], result: '\u3044\u3060', label: '\u3050 \u2192 \u3044\u3060' },
      { chars: ['\u3059'], result: '\u3057\u305F', label: '\u3059 \u2192 \u3057\u305F' },
      { chars: ['\u3046','\u3064','\u308B'], result: '\u3063\u305F', label: '\u3046/\u3064/\u308B \u2192 \u3063\u305F' }
    ],
    'tari_form': [
      { chars: ['\u3080','\u3076','\u306C'], result: '\u3093\u3060\u308A', label: '\u3080/\u3076/\u306C \u2192 \u3093\u3060\u308A' },
      { chars: ['\u304F'], result: '\u3044\u305F\u308A', label: '\u304F \u2192 \u3044\u305F\u308A' },
      { chars: ['\u3050'], result: '\u3044\u3060\u308A', label: '\u3050 \u2192 \u3044\u3060\u308A' },
      { chars: ['\u3059'], result: '\u3057\u305F\u308A', label: '\u3059 \u2192 \u3057\u305F\u308A' },
      { chars: ['\u3046','\u3064','\u308B'], result: '\u3063\u305F\u308A', label: '\u3046/\u3064/\u308B \u2192 \u3063\u305F\u308A' }
    ]
  };

  function getGodanHint(item) {
    if (item.vc !== 'godan') return null;
    var lastChar = item.term.reading.slice(-1);
    var family = null;
    if (item.ruleKey === 'te_form' || item.ruleKey === 'polite_negative_te' || item.ruleKey === 'casual_te_iru') family = 'te_form';
    else if (item.ruleKey === 'plain_past' || item.ruleKey === 'conditional_tara') family = 'plain_past';
    else if (item.ruleKey === 'tari_form') family = 'tari_form';
    if (!family || !SOUND_GROUPS[family]) return null;
    var groups = SOUND_GROUPS[family];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].chars.indexOf(lastChar) !== -1) {
        return lastChar + ' is in the ' + groups[i].label + ' group';
      }
    }
    return null;
  }

  // ---- Helper panel ----
  function buildHelperHTML(item) {
    var openClass = helperVisible ? ' open' : '';
    var h = '<div class="dojo-helper' + openClass + '" id="dojo-helper-panel">';
    h += '<table>';
    // Te-form chart (most commonly needed)
    h += '<tr><td colspan="2" style="font-weight:700;color:#8e44ad;padding-bottom:4px;">\u3066-form Rules (Godan)</td></tr>';
    h += '<tr><td class="hl">\u304F \u2192 \u3044\u3066</td><td class="hl">\u3050 \u2192 \u3044\u3067</td></tr>';
    h += '<tr><td class="hl">\u3059 \u2192 \u3057\u3066</td><td></td></tr>';
    h += '<tr><td class="hl">\u3080/\u3076/\u306C \u2192 \u3093\u3067</td><td></td></tr>';
    h += '<tr><td class="hl">\u3046/\u3064/\u308B \u2192 \u3063\u3066</td><td></td></tr>';
    h += '<tr><td colspan="2" style="padding-top:6px;color:#555;">Ichidan: drop \u308B, add \u3066</td></tr>';
    h += '<tr><td colspan="2" style="color:#555;">\u3059\u308B \u2192 \u3057\u3066 \u3000 \u6765\u308B \u2192 \u304D\u3066</td></tr>';
    h += '<tr><td colspan="2" style="color:#555;">\u884C\u304F \u2192 \u884C\u3063\u3066 (exception)</td></tr>';
    // Masu-stem chart
    h += '<tr><td colspan="2" style="font-weight:700;color:#8e44ad;padding-top:10px;">\u307E\u3059-stem (Godan: \u3046\u2192\u3044 row)</td></tr>';
    h += '<tr><td colspan="2" style="color:#555;">Ichidan: drop \u308B</td></tr>';
    // False ichidan warning section
    h += '<tr><td colspan="2" style="font-weight:700;color:#856404;padding-top:12px;border-top:1px solid #eee;margin-top:8px;">\u26A0 False Ichidan Verbs</td></tr>';
    h += '<tr><td colspan="2" style="color:#555;font-size:0.8rem;">These look ichidan (\u3044\u308B/\u3048\u308B ending) but are godan:</td></tr>';
    h += '<tr><td class="hl">\u5165\u308B (\u306F\u3044\u308B)</td><td style="color:#555">\u2192 \u5165\u3063\u3066</td></tr>';
    h += '<tr><td class="hl">\u5207\u308B (\u304D\u308B)</td><td style="color:#555">\u2192 \u5207\u3063\u3066 (cf. \u7740\u308B\u2192\u7740\u3066)</td></tr>';
    h += '<tr><td class="hl">\u5E30\u308B (\u304B\u3048\u308B)</td><td style="color:#555">\u2192 \u5E30\u3063\u3066</td></tr>';
    h += '<tr><td class="hl">\u8D70\u308B (\u306F\u3057\u308B)</td><td style="color:#555">\u2192 \u8D70\u3063\u3066</td></tr>';
    h += '<tr><td class="hl">\u77E5\u308B (\u3057\u308B)</td><td style="color:#555">\u2192 \u77E5\u3063\u3066</td></tr>';
    h += '</table></div>';
    return h;
  }

  // ---- Summary ----
  function renderSummary() {
    var pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    var streakInfo = cfg.getStreakInfo ? cfg.getStreakInfo() : { streak: 0, best: 0 };

    var html = '<div class="dojo-wrap"><div class="dojo-summary">';
    html += '<div class="dojo-score">' + sessionCorrect + ' / ' + sessionTotal + '</div>';
    html += '<div class="dojo-score-pct">' + pct + '% correct</div>';

    // Breakdown by form
    var formCounts = {};
    var formCorrectCounts = {};
    queue.forEach(function (item, idx) {
      var label = item.formLabel;
      formCounts[label] = (formCounts[label] || 0) + 1;
    });
    var mistakeKeys = {};
    mistakes.forEach(function (item) { mistakeKeys[item.formLabel] = (mistakeKeys[item.formLabel] || 0) + 1; });
    Object.keys(formCounts).forEach(function (label) {
      formCorrectCounts[label] = formCounts[label] - (mistakeKeys[label] || 0);
    });

    if (Object.keys(formCounts).length > 1) {
      html += '<div class="dojo-breakdown"><div style="font-weight:700;margin-bottom:4px;">By Form</div>';
      Object.keys(formCounts).forEach(function (label) {
        html += '<div class="dojo-breakdown-row"><span>' + esc(label) + '</span><span>' +
          formCorrectCounts[label] + '/' + formCounts[label] + '</span></div>';
      });
      html += '</div>';
    }

    // Breakdown by verb class
    var vcCounts = {};
    var vcMistakes = {};
    queue.forEach(function (item) {
      var cl = classLabel(item.vc);
      vcCounts[cl] = (vcCounts[cl] || 0) + 1;
    });
    mistakes.forEach(function (item) {
      var cl = classLabel(item.vc);
      vcMistakes[cl] = (vcMistakes[cl] || 0) + 1;
    });
    if (Object.keys(vcCounts).length > 1) {
      html += '<div class="dojo-breakdown"><div style="font-weight:700;margin-bottom:4px;">By Verb Type</div>';
      Object.keys(vcCounts).forEach(function (cl) {
        var correct = vcCounts[cl] - (vcMistakes[cl] || 0);
        html += '<div class="dojo-breakdown-row"><span>' + esc(cl) + '</span><span>' +
          correct + '/' + vcCounts[cl] + '</span></div>';
      });
      html += '</div>';
    }

    html += '<div class="dojo-summary-btns">';
    if (mistakes.length > 0) {
      html += '<button class="dojo-btn-primary" id="dojo-retry-btn">\uD83D\uDD01 Retry Mistakes (' + mistakes.length + ')</button>';
    }
    html += '<button class="dojo-btn-secondary" id="dojo-new-btn">New Session</button>';
    html += '<button class="dojo-btn-secondary" id="dojo-exit-btn">Back to Menu</button>';
    html += '</div></div></div>';

    container.innerHTML = html;

    if (mistakes.length > 0) {
      document.getElementById('dojo-retry-btn').addEventListener('click', function () {
        var retryQueue = mistakes.map(function (m) { return Object.assign({}, m); });
        shuffle(retryQueue);
        startDrillWithQueue(retryQueue);
      });
    }
    document.getElementById('dojo-new-btn').addEventListener('click', function () { initFormSelection(); });
    document.getElementById('dojo-exit-btn').addEventListener('click', function () { cfg.onExit && cfg.onExit(); });
  }

  // ---- Public API ----
  function renderEmptyState() {
    var html = '<div class="dojo-wrap"><div style="text-align:center;padding:32px 16px;">';
    html += '<div style="font-size:2.4rem;margin-bottom:12px;">\u26A1</div>';
    html += '<div style="font-weight:800;font-size:1.1rem;color:#2f3542;margin-bottom:8px;">Conjugation Station</div>';
    html += '<div style="color:#e74c3c;font-weight:600;margin-bottom:8px;">No conjugatable words found</div>';
    html += '<div style="font-size:0.85rem;color:#747d8c;margin-bottom:20px;">Select lessons with verbs or adjectives on the main page.</div>';
    html += '<button class="dojo-btn-secondary" id="dojo-empty-exit" style="width:100%;padding:12px;">Back to Menu</button>';
    html += '</div></div>';
    container.innerHTML = html;
    document.getElementById('dojo-empty-exit').addEventListener('click', function () {
      cfg.onExit && cfg.onExit();
    });
  }

  function initFormSelection() {
    var pool = scanPool();
    if (pool.verbCount + pool.adjCount === 0) {
      renderEmptyState();
    } else {
      renderFormSelection(pool);
    }
  }

  window.JPShared.conjugationDojo = {
    init: function (containerEl, ctx) {
      injectStyles();
      cfg = ctx;
      container = containerEl;
      container.innerHTML = '';
      initFormSelection();
    },
    destroy: function () {
      if (container) container.innerHTML = '';
    }
  };
})();
