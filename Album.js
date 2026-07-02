/**
 * Album.js — 印帳 (the stamp album).
 *
 * Three shelves of earned seals, opened by tapping the masthead 力 hanko:
 *   1. Mastered kanji — every kanji whose SRS item reached the top rung
 *      (r === 5, the 90-day interval) gets its hanko tile.
 *   2. Achievements — the milestone stamps from app/shared/achievements.js
 *      (locked ones show as silhouettes; the collection is never hidden).
 *   3. Lesson & level seals — one small seal per completed lesson, plus the
 *      oversized 五 / 四 level seals bound to the n5/n4-complete grants.
 *
 * Header carries the seal-ink picker (keiko sink) and the keiko chip.
 * Kanji characters are resolved from the glossaries lazily on open (the SRS
 * map stores only ids — see app/shared/srs.js key contract).
 */

window.AlbumModule = {
  start: async function (container, config, onExit) {
    'use strict';

    const S = window.JPShared || {};
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const assetUrl = (p) => (window.getAssetUrl ? window.getAssetUrl(config, p) : p);

    if (window.JPApp) window.JPApp.hideTabBar();

    // ---------- styles ----------
    if (!document.getElementById('jp-album-style')) {
      const style = document.createElement('style');
      style.id = 'jp-album-style';
      style.textContent = `
        .jp-album { min-height: 100vh; min-height: 100dvh; background: var(--washi-2, #f2ecde); padding-bottom: 40px; }
        .jp-album-top { display: flex; align-items: center; gap: 12px; padding: max(28px, env(safe-area-inset-top)) 18px 8px; }
        .jp-album-back { width: 32px; height: 32px; border-radius: 999px; border: 1px solid var(--hairline); background: var(--washi); color: var(--ink-2); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .jp-album-h { padding: 4px 20px 0; }
        .jp-album-title { font-family: var(--font-jp-display); font-size: 30px; color: var(--ink); }
        .jp-album-sub { font-size: 12.5px; color: var(--ink-3); margin-top: 2px; }
        .jp-album-inks { display: flex; align-items: center; gap: 10px; padding: 14px 20px 4px; }
        .jp-album-ink { width: 26px; height: 26px; border-radius: 999px; border: none; cursor: pointer; position: relative; flex-shrink: 0; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55); }
        .jp-album-ink.active { outline: 2px solid var(--ink); outline-offset: 2px; }
        .jp-album-ink .lk { position: absolute; right: -4px; bottom: -4px; font-size: 10px; }
        .jp-album-sec { padding: 20px 20px 8px; display: flex; align-items: baseline; gap: 10px; }
        .jp-album-sec .t { font-family: var(--font-jp-serif, serif); font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
        .jp-album-sec .line { flex: 1; height: 1px; background: var(--hairline); }
        .jp-album-sec .n { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); }
        .jp-album-grid { display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 20px; }
        .jp-album-seal { width: 54px; height: 54px; border-radius: 10px; background: var(--seal-ink, var(--vermilion)); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--font-jp-display); font-size: 27px; border: none; cursor: pointer; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.14); }
        .jp-album-empty { font-size: 12.5px; color: var(--ink-3); padding: 6px 20px 0; line-height: 1.5; }
        .jp-album-ach { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 4px 20px; }
        .jp-album-ach-tile { background: var(--washi); border: 1px solid var(--hairline); border-radius: var(--r-md, 14px); padding: 12px 8px 10px; text-align: center; }
        .jp-album-ach-tile .ic { height: 40px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .jp-album-ach-tile .ic img { height: 34px; width: auto; }
        .jp-album-ach-tile .tt { font-size: 11px; font-weight: 600; color: var(--ink); margin-top: 6px; line-height: 1.25; }
        .jp-album-ach-tile .dt { font-family: var(--font-mono); font-size: 9px; color: var(--ink-3); margin-top: 3px; }
        .jp-album-ach-tile.locked { opacity: 0.5; }
        .jp-album-ach-tile.locked .ic { filter: grayscale(1); opacity: 0.5; }
        .jp-album-lessons { display: flex; flex-wrap: wrap; gap: 7px; padding: 4px 20px; }
        .jp-album-lseal { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 9.5px; }
        .jp-album-lseal.done { background: var(--seal-ink, var(--vermilion)); color: #fff; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.4); }
        .jp-album-lseal.todo { border: 1.5px dashed var(--hairline); color: var(--ink-3); }
        .jp-album-bigseal { width: 76px; height: 76px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-family: var(--font-jp-display); font-size: 44px; }
        .jp-album-bigseal.done { background: var(--seal-ink, var(--vermilion)); color: #fff; box-shadow: inset 0 0 0 3px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.18); transform: rotate(-3deg); }
        .jp-album-bigseal.todo { border: 2px dashed var(--hairline); color: var(--ink-3); opacity: 0.6; }
      `;
      document.head.appendChild(style);
    }

    // ---------- data ----------
    const readMap = (key) => {
      try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
    };

    const manifest = (window.JPApp && window.JPApp._manifest) || null;
    const srsItems = readMap('k-srs-items');
    const completed = readMap('k-lesson-completed');
    const ach = S.achievements;
    const cos = S.cosmetics;

    const masteredKeys = Object.keys(srsItems)
      .filter(k => /^N\d+:k_/.test(k) && srsItems[k] && srsItems[k].r === 5);
    const enrolledKanji = Object.keys(srsItems).filter(k => /^N\d+:k_/.test(k)).length;

    // Kanji-char resolution: fetch glossaries lazily (mirrors srs.js loadIndex).
    // Only kanji entries are indexed — that's all the album needs.
    let kanjiIndex = null; // srsKey -> {surface, reading, meaning}
    async function loadKanjiIndex() {
      if (kanjiIndex || !manifest || !manifest.data) return kanjiIndex;
      try {
        const parts = await Promise.all((manifest.levels || []).map(async lvl => {
          const path = manifest.data[lvl] && manifest.data[lvl].glossary;
          if (!path) return null;
          const res = await fetch(assetUrl(path) + '?t=' + Date.now());
          return { lvl, entries: (await res.json()).entries || [] };
        }));
        kanjiIndex = {};
        parts.forEach(part => {
          if (!part) return;
          part.entries.forEach(e => {
            if (e && e.type === 'kanji' && e.id) {
              kanjiIndex[part.lvl + ':' + e.id] = { surface: e.surface, reading: e.reading || e.kun || e.on || '', meaning: e.meaning || '' };
            }
          });
        });
      } catch (e) { kanjiIndex = null; }
      return kanjiIndex;
    }

    const hashStr = (s) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    };

    const fmtDate = (ts) => {
      if (!ts) return '';
      try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
      catch (e) { return ''; }
    };

    // "Seen" bookkeeping for the masthead new-dot: total collectible count.
    const earnedTotal =
      (ach ? ach.earnedCount() : 0) +
      masteredKeys.length +
      Object.keys(completed).filter(k => completed[k] && /^N\d\.\d+$/.test(k)).length;
    try { localStorage.setItem('k-album-seen-count', String(earnedTotal)); } catch (e) {}

    // ---------- render ----------
    function inkRow() {
      if (!cos) return '';
      const active = cos.getInk();
      return '<div class="jp-album-inks">' +
        '<span class="mono" style="font-size:10px;color:var(--ink-3);letter-spacing:0.12em;text-transform:uppercase;">Seal ink</span>' +
        cos.INKS.map(ink => {
          const owned = cos.ownsInk(ink.id);
          const cls = 'jp-album-ink' + (ink.id === active ? ' active' : '');
          const lock = owned ? '' : '<span class="lk">🔒</span>';
          return '<button class="' + cls + '" style="background:' + ink.color + ';" data-ink="' + ink.id + '" title="' + esc(ink.label) + (owned ? '' : ' · ' + ink.price + ' けいこ') + '">' + lock + '</button>';
        }).join('') +
        '<span id="jp-album-ink-msg" style="font-size:11px;color:var(--ink-3);flex:1;"></span>' +
      '</div>';
    }

    function achShelf() {
      if (!ach) return '';
      const granted = ach.getGranted();
      const tiles = ach.DEFS.map(def => {
        const ts = granted[def.id];
        const icon = (def.icon && def.icon.belt)
          ? '<img src="' + assetUrl('assets/ui/' + def.icon.belt) + '" alt="">'
          : esc(typeof def.icon === 'string' ? def.icon : '🏅');
        return '<div class="jp-album-ach-tile' + (ts ? '' : ' locked') + '">' +
          '<div class="ic">' + icon + '</div>' +
          '<div class="tt">' + esc(def.title) + (ts ? '' : ' 🔒') + '</div>' +
          '<div class="dt">' + (ts ? esc(fmtDate(ts)) : esc(def.sub)) + '</div>' +
        '</div>';
      }).join('');
      const n = Object.keys(granted).length;
      return sec('きろく · Achievements', n + ' / ' + ach.DEFS.length) +
        '<div class="jp-album-ach">' + tiles + '</div>';
    }

    function lessonShelf() {
      if (!manifest || !manifest.data) return '';
      let html = '';
      (manifest.levels || []).forEach(lvl => {
        const lessons = (manifest.data[lvl] || {}).lessons || [];
        if (!lessons.length) return;
        const doneCount = lessons.filter(l => completed[l.id]).length;
        const bigDone = ach && ach.isGranted(lvl.toLowerCase() + '-complete');
        const bigChar = lvl === 'N5' ? '五' : lvl === 'N4' ? '四' : lvl.slice(1);
        html += sec(lvl + ' · Lessons', doneCount + ' / ' + lessons.length) +
          '<div class="jp-album-lessons">' +
            '<div class="jp-album-bigseal ' + (bigDone ? 'done' : 'todo') + '" title="' + lvl + ' complete">' + bigChar + '</div>' +
            lessons.map(l => {
              const num = (l.id || '').split('.')[1] || '';
              return '<div class="jp-album-lseal ' + (completed[l.id] ? 'done' : 'todo') + '" title="' + esc(l.id) + '">' + esc(num) + '</div>';
            }).join('') +
          '</div>';
      });
      return html;
    }

    function sec(label, meta) {
      return '<div class="jp-album-sec"><div class="t">' + esc(label) + '</div><div class="line"></div>' +
        (meta ? '<div class="n">' + esc(meta) + '</div>' : '') + '</div>';
    }

    function kanjiShelfSkeleton() {
      if (!masteredKeys.length) {
        return sec('マスターした漢字 · Sealed kanji', '0 / ' + enrolledKanji) +
          '<div class="jp-album-empty">Master a kanji — keep answering it right in reviews until it reaches the 90-day rung — and its seal is pressed here.</div>';
      }
      return sec('マスターした漢字 · Sealed kanji', masteredKeys.length + ' / ' + enrolledKanji) +
        '<div class="jp-album-grid" id="jp-album-kanji">' +
          '<div class="jp-album-empty">…</div>' +
        '</div>';
    }

    const keikoBal = S.keiko ? S.keiko.getBalance() : 0;
    container.innerHTML =
      '<div class="jp-album">' +
        '<div class="jp-album-top">' +
          '<button class="jp-album-back" id="jp-album-back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<div style="flex:1;"></div>' +
          '<button onclick="JPApp._openKeikoSheet()" class="mono" style="display:inline-flex;align-items:center;gap:5px;border:1px solid var(--hairline);border-radius:999px;background:var(--washi);color:var(--ink-2);font-size:11px;font-weight:600;padding:5px 10px;cursor:pointer;">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>' +
            keikoBal + ' けいこ</button>' +
        '</div>' +
        '<div class="jp-album-h">' +
          '<div class="jp-album-title">いんちょう <span style="font-size:16px;color:var(--ink-3);">· Stamp Album</span></div>' +
          '<div class="jp-album-sub">Seals for everything you\'ve made stick.</div>' +
        '</div>' +
        inkRow() +
        kanjiShelfSkeleton() +
        achShelf() +
        lessonShelf() +
      '</div>';

    document.getElementById('jp-album-back').onclick = onExit;

    // ink picker wiring
    container.querySelectorAll('.jp-album-ink').forEach(btn => {
      btn.onclick = () => {
        if (!cos) return;
        const id = btn.getAttribute('data-ink');
        const msg = document.getElementById('jp-album-ink-msg');
        if (cos.ownsInk(id)) {
          cos.setInk(id);
          try { S.sfx && S.sfx.stamp(); } catch (e) {}
          rerenderInks();
        } else {
          const ink = cos.INKS.find(x => x.id === id);
          if (msg && !btn.dataset.confirm) {
            btn.dataset.confirm = '1';
            msg.innerHTML = 'Unlock ' + esc(ink.label) + ' · ' + ink.price + ' けいこ — tap again to buy';
            setTimeout(() => { delete btn.dataset.confirm; if (msg.textContent.includes('tap again')) msg.textContent = ''; }, 3500);
          } else {
            const r = cos.buyInk(id);
            if (r.ok) {
              try { S.sfx && S.sfx.stamp(); } catch (e) {}
              try { S.haptics && S.haptics.success(); } catch (e) {}
              if (window.JPApp) window.JPApp._toast('Seal ink unlocked: ' + ink.label);
              rerenderInks();
            } else if (msg) {
              msg.textContent = 'Not enough keiko yet (' + (S.keiko ? S.keiko.getBalance() : 0) + ' / ' + ink.price + ')';
            }
          }
        }
      };
    });

    function rerenderInks() {
      // Full restart: refreshes the active-ring, lock badges, AND every
      // seal's color (they all read --seal-ink, already re-applied by setInk).
      window.AlbumModule.start(container, config, onExit);
    }

    // ---------- kanji shelf (async fill) ----------
    if (masteredKeys.length) {
      const idx = await loadKanjiIndex();
      const grid = document.getElementById('jp-album-kanji');
      if (grid) {
        if (!idx) {
          grid.innerHTML = '<div class="jp-album-empty">Couldn\'t load kanji data — check your connection and reopen.</div>';
        } else {
          grid.innerHTML = masteredKeys.map(key => {
            const info = idx[key];
            if (!info) return '';
            const rot = ((hashStr(key) % 7) - 3);
            return '<button class="jp-album-seal" style="transform:rotate(' + rot + 'deg);" data-key="' + esc(key) + '">' + esc(info.surface) + '</button>';
          }).join('');
          grid.querySelectorAll('.jp-album-seal').forEach(btn => {
            btn.onclick = () => {
              const key = btn.getAttribute('data-key');
              const info = idx[key];
              const it = srsItems[key] || {};
              try { S.sfx && S.sfx.stamp(); } catch (e) {}
              try { S.haptics && S.haptics.light(); } catch (e) {}
              const overlay = document.createElement('div');
              overlay.className = 'jp-return-overlay';
              overlay.innerHTML =
                '<div class="jp-return-card">' +
                  '<div style="font-family:var(--font-jp-display);font-size:64px;color:var(--seal-ink, var(--vermilion));line-height:1.2;">' + esc(info.surface) + '</div>' +
                  '<div style="font-size:15px;color:var(--ink);font-weight:600;margin-top:4px;">' + esc(info.reading) + '</div>' +
                  '<div style="font-size:13px;color:var(--ink-2);margin-top:2px;">' + esc(info.meaning) + '</div>' +
                  (it.ts ? '<div class="mono" style="font-size:10px;color:var(--ink-3);margin-top:10px;letter-spacing:0.1em;">SEALED ' + esc(fmtDate(it.ts).toUpperCase()) + '</div>' : '') +
                  '<button onclick="this.closest(\'.jp-return-overlay\').remove()" style="margin-top:14px;background:var(--seal-ink, var(--vermilion));color:#fff;border:none;padding:9px 26px;border-radius:999px;font-size:0.95rem;font-weight:600;cursor:pointer;">Close</button>' +
                '</div>';
              overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
              document.body.appendChild(overlay);
            };
          });
        }
      }
    }
  }
};
