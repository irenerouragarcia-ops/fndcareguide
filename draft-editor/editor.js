/*
 * Draft Editor overlay for irenerouragarcia.com (local tool, never deployed).
 *
 * - Click any text to edit it in place
 * - Delete / restore blocks
 * - Attach a comment to any block
 * - General comments box for the whole page
 * - Drafts auto-save to draft-editor/drafts/<page>.json via the local server
 */
(function () {
  'use strict';

  var PAGE = location.pathname === '/' ? '/index.html' : location.pathname;
  var PAGES = (window.__DE_PAGES__ || ['index.html']).map(function (f) {
    var label = f === 'index.html' ? 'Home'
      : f.replace('.html', '').replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return [f, label];
  });

  var EDITABLE_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'BLOCKQUOTE',
    'FIGCAPTION', 'A', 'BUTTON', 'SPAN', 'LABEL', 'DT', 'DD', 'TD', 'TH', 'DIV', 'SUMMARY', 'EM', 'STRONG'];

  var blocks = {};          // id -> {el, tag, i18n, originalText, originalHtml}
  var edits = {};           // id -> true (text differs from original)
  var deletions = {};       // id -> true
  var comments = {};        // id -> string
  var generalComments = '';
  var editMode = true;
  var dirty = false;
  var saveTimer = null;
  var currentCommentId = null;

  /* ---------------- styles ---------------- */
  var css = [
    '.de-block-hover { outline: 2px dashed #7c5cd4 !important; outline-offset: 2px; cursor: text; }',
    '.de-block-editing { outline: 2px solid #7c5cd4 !important; outline-offset: 2px; background: rgba(124,92,212,.07); }',
    '.de-block-edited { outline: 2px solid #2e9e6b !important; outline-offset: 2px; }',
    '.de-block-deleted { opacity: .35 !important; text-decoration: line-through !important; outline: 2px solid #d4574e !important; outline-offset: 2px; }',
    '.de-block-commented { position: relative; }',
    '.de-badge { position: absolute; top: -10px; right: -10px; background: #e8a531; color: #fff; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; line-height: 20px; text-align: center; z-index: 99990; pointer-events: none; }',
    '#de-toolbar { position: absolute; z-index: 99995; display: none; gap: 4px; background: #2b2140; border-radius: 8px; padding: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); }',
    '#de-toolbar button { border: 0; background: #453563; color: #fff; border-radius: 6px; padding: 4px 9px; font: 12px/1.4 -apple-system, sans-serif; cursor: pointer; }',
    '#de-toolbar button:hover { background: #7c5cd4; }',
    '#de-comment-pop { position: absolute; z-index: 99996; background: #fffbe9; border: 2px solid #e8a531; border-radius: 10px; padding: 10px; width: 280px; box-shadow: 0 6px 18px rgba(0,0,0,.3); font: 13px -apple-system, sans-serif; }',
    '#de-comment-pop textarea { width: 100%; height: 70px; box-sizing: border-box; border: 1px solid #d8c78a; border-radius: 6px; padding: 6px; font: 13px -apple-system, sans-serif; resize: vertical; }',
    '#de-comment-pop .de-row { display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end; }',
    '#de-comment-pop button { border: 0; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }',
    '#de-panel { position: fixed; bottom: 16px; right: 16px; z-index: 99999; width: 300px; background: #2b2140; color: #eee; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.45); font: 13px/1.45 -apple-system, "Segoe UI", sans-serif; }',
    '#de-panel * { box-sizing: border-box; }',
    '#de-panel .de-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; cursor: pointer; font-weight: 600; }',
    '#de-panel .de-body { padding: 0 14px 14px; }',
    '#de-panel.de-min .de-body { display: none; }',
    '#de-panel select, #de-panel textarea { width: 100%; border-radius: 8px; border: 1px solid #574a77; background: #382c52; color: #eee; padding: 6px 8px; font: 13px -apple-system, sans-serif; margin-bottom: 8px; }',
    '#de-panel textarea { height: 72px; resize: vertical; }',
    '#de-panel .de-counts { display: flex; gap: 10px; margin-bottom: 8px; font-size: 12px; color: #cfc6e8; }',
    '#de-panel .de-counts b { color: #fff; }',
    '#de-panel .de-btns { display: flex; gap: 8px; }',
    '#de-panel .de-btns button { flex: 1; border: 0; border-radius: 8px; padding: 8px 6px; font-size: 13px; font-weight: 600; cursor: pointer; }',
    '#de-save { background: #2e9e6b; color: #fff; }',
    '#de-save:hover { background: #37b87e; }',
    '#de-discard { background: #55486f; color: #eee; }',
    '#de-discard:hover { background: #d4574e; }',
    '#de-export { width: 100%; margin-top: 8px; border: 0; border-radius: 8px; padding: 9px 6px; font-size: 13px; font-weight: 600; cursor: pointer; background: #e8a531; color: #fff; }',
    '#de-export:hover { background: #f5b846; }',
    '#de-status { margin-top: 8px; font-size: 12px; color: #9fd8b8; min-height: 16px; }',
    '#de-panel .de-mode { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }',
    '#de-panel .de-mode button { border: 0; border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; background: #382c52; color: #bbb; }',
    '#de-panel .de-mode button.de-on { background: #7c5cd4; color: #fff; }',
    '#de-panel .de-hint { font-size: 11px; color: #a99cc9; margin-top: 8px; }',
    '#de-panel label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #a99cc9; display: block; margin-bottom: 3px; }'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------------- block discovery ---------------- */
  function hasDirectText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim().length > 0) return true;
    }
    return false;
  }

  function collectBlocks() {
    var counter = 0;
    var seen = {};
    var all = document.body.querySelectorAll(EDITABLE_TAGS.join(','));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('#de-panel, #de-toolbar, #de-comment-pop')) continue;
      if (el.classList.contains('lang-btn') || el.closest('.menu-toggle, .lang-toggle, .lang-switch')) continue;
      if (!hasDirectText(el)) continue;
      // Skip if an ancestor is already an editable block (edit the outermost text unit,
      // except keep li/a/figcaption/blockquote as their own blocks)
      var anc = el.parentElement && el.parentElement.closest('[data-eid]');
      if (anc && ['LI', 'A', 'BLOCKQUOTE', 'FIGCAPTION', 'BUTTON'].indexOf(el.tagName) === -1) continue;

      var id = el.getAttribute('data-i18n') || ('auto:' + el.tagName.toLowerCase() + ':' + counter);
      counter++;
      if (seen[id]) { id = id + '#' + (++seen[id]); } else { seen[id] = 1; }
      el.setAttribute('data-eid', id);
      blocks[id] = {
        el: el,
        tag: el.tagName.toLowerCase(),
        i18n: el.getAttribute('data-i18n') || null,
        originalText: el.innerText,
        originalHtml: el.innerHTML
      };
    }
  }

  /* ---------------- toolbar ---------------- */
  var toolbar = document.createElement('div');
  toolbar.id = 'de-toolbar';
  document.body.appendChild(toolbar);
  var toolbarTarget = null;

  function showToolbar(el) {
    if (!editMode) return;
    toolbarTarget = el;
    var id = el.getAttribute('data-eid');
    var isDeleted = !!deletions[id];
    toolbar.innerHTML = '';
    var del = document.createElement('button');
    del.textContent = isDeleted ? '↩ Restore' : '🗑 Delete';
    del.onclick = function (e) { e.stopPropagation(); toggleDelete(id); showToolbar(el); };
    var com = document.createElement('button');
    com.textContent = comments[id] ? '💬 Edit comment' : '💬 Comment';
    com.onclick = function (e) { e.stopPropagation(); openCommentPop(id); };
    toolbar.appendChild(del);
    toolbar.appendChild(com);
    var r = el.getBoundingClientRect();
    toolbar.style.display = 'flex';
    toolbar.style.top = (window.scrollY + r.top - 34) + 'px';
    toolbar.style.left = Math.max(8, window.scrollX + r.left) + 'px';
  }
  function hideToolbar() { toolbar.style.display = 'none'; toolbarTarget = null; }

  /* ---------------- comments popup ---------------- */
  var pop = document.createElement('div');
  pop.id = 'de-comment-pop';
  pop.style.display = 'none';
  pop.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:#7a5c10;">Comment on this block</div>' +
    '<textarea placeholder="e.g. Make this warmer / mention the free consult / wrong date..."></textarea>' +
    '<div class="de-row">' +
    '<button id="de-com-remove" style="background:#eee;color:#a33;">Remove</button>' +
    '<button id="de-com-save" style="background:#e8a531;color:#fff;">Save comment</button></div>';
  document.body.appendChild(pop);

  function openCommentPop(id) {
    currentCommentId = id;
    var el = blocks[id].el;
    pop.querySelector('textarea').value = comments[id] || '';
    var r = el.getBoundingClientRect();
    pop.style.display = 'block';
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.innerWidth - 300)) + 'px';
    pop.querySelector('textarea').focus();
    hideToolbar();
  }
  pop.querySelector('#de-com-save').onclick = function () {
    var txt = pop.querySelector('textarea').value.trim();
    if (txt) { comments[currentCommentId] = txt; } else { delete comments[currentCommentId]; }
    refreshBlockMarks(currentCommentId);
    pop.style.display = 'none';
    markDirty();
  };
  pop.querySelector('#de-com-remove').onclick = function () {
    delete comments[currentCommentId];
    refreshBlockMarks(currentCommentId);
    pop.style.display = 'none';
    markDirty();
  };

  /* ---------------- block state ---------------- */
  function toggleDelete(id) {
    var b = blocks[id];
    if (deletions[id]) {
      delete deletions[id];
      b.el.classList.remove('de-block-deleted');
    } else {
      deletions[id] = true;
      b.el.classList.add('de-block-deleted');
      b.el.blur();
    }
    refreshBlockMarks(id);
    markDirty();
  }

  function refreshBlockMarks(id) {
    var b = blocks[id];
    var badge = b.el.querySelector(':scope > .de-badge');
    if (comments[id]) {
      b.el.classList.add('de-block-commented');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'de-badge';
        badge.textContent = '💬';
        b.el.appendChild(badge);
      }
    } else {
      b.el.classList.remove('de-block-commented');
      if (badge) badge.remove();
    }
    b.el.classList.toggle('de-block-edited', !!edits[id] && !deletions[id]);
    updateCounts();
  }

  function currentText(el) {
    var clone = el.cloneNode(true);
    var badges = clone.querySelectorAll('.de-badge');
    for (var i = 0; i < badges.length; i++) badges[i].remove();
    return clone.innerText !== undefined ? clone.innerText : clone.textContent;
  }
  function currentHtml(el) {
    var clone = el.cloneNode(true);
    var badges = clone.querySelectorAll('.de-badge');
    for (var i = 0; i < badges.length; i++) badges[i].remove();
    clone.removeAttribute && clone.removeAttribute('contenteditable');
    return clone.innerHTML;
  }

  function onBlockInput(id) {
    var b = blocks[id];
    if (currentText(b.el).trim() === b.originalText.trim()) {
      delete edits[id];
    } else {
      edits[id] = true;
    }
    refreshBlockMarks(id);
    markDirty();
  }

  /* ---------------- edit mode wiring ---------------- */
  function applyMode() {
    Object.keys(blocks).forEach(function (id) {
      var el = blocks[id].el;
      if (editMode && !deletions[id]) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
      } else {
        el.removeAttribute('contenteditable');
      }
    });
    document.getElementById('de-mode-edit').classList.toggle('de-on', editMode);
    document.getElementById('de-mode-browse').classList.toggle('de-on', !editMode);
    if (!editMode) { hideToolbar(); pop.style.display = 'none'; }
  }

  document.addEventListener('mouseover', function (e) {
    if (!editMode) return;
    var el = e.target.closest && e.target.closest('[data-eid]');
    if (el) {
      el.classList.add('de-block-hover');
      showToolbar(el);
    }
  });
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest && e.target.closest('[data-eid]');
    if (el) el.classList.remove('de-block-hover');
  });
  // Keep toolbar visible while hovering it
  toolbar.addEventListener('mouseover', function (e) { e.stopPropagation(); });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#de-toolbar, #de-comment-pop, #de-panel')) return;
    if (!e.target.closest('[data-eid]')) { hideToolbar(); }
    if (!e.target.closest('#de-comment-pop')) { pop.style.display = 'none'; }
    if (editMode) {
      var link = e.target.closest('a[href]');
      if (link && link.getAttribute('data-eid') !== null) {
        // In edit mode clicking a link edits it instead of navigating
        e.preventDefault();
      }
    }
  }, true);

  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('[data-eid]');
    if (el) onBlockInput(el.getAttribute('data-eid'));
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-eid]');
    if (el && editMode) el.classList.add('de-block-editing');
  });
  document.addEventListener('focusout', function (e) {
    var el = e.target.closest && e.target.closest('[data-eid]');
    if (el) el.classList.remove('de-block-editing');
  });

  /* ---------------- panel ---------------- */
  var panel = document.createElement('div');
  panel.id = 'de-panel';
  var pageOptions = PAGES.map(function (p) {
    var sel = ('/' + p[0]) === PAGE ? ' selected' : '';
    return '<option value="' + p[0] + '"' + sel + '>' + p[1] + '</option>';
  }).join('');
  panel.innerHTML =
    '<div class="de-head"><span>✏️ Draft Editor</span><span id="de-collapse">▾</span></div>' +
    '<div class="de-body">' +
    '<div class="de-mode"><button id="de-mode-edit">✏️ Edit</button><button id="de-mode-browse">🖱 Browse</button></div>' +
    '<label>Page</label><select id="de-pagesel">' + pageOptions + '</select>' +
    '<div class="de-counts"><span>Edits <b id="de-c-edits">0</b></span><span>Deleted <b id="de-c-del">0</b></span><span>Comments <b id="de-c-com">0</b></span></div>' +
    '<label>Comments for Claude (this page)</label>' +
    '<textarea id="de-general" placeholder="Overall notes… e.g. \'Tone should be softer here\', \'swap photo\', anything!"></textarea>' +
    '<div class="de-btns"><button id="de-save">💾 Save draft</button><button id="de-discard">Discard</button></div>' +
    '<button id="de-export">📤 Export update request (all pages)</button>' +
    '<div id="de-status"></div>' +
    '<div class="de-hint">Click text to edit · hover for 🗑/💬 · drafts save to draft-editor/drafts/ · tip: pick your language (EN/ES) before editing</div>' +
    '</div>';
  document.body.appendChild(panel);

  panel.querySelector('.de-head').onclick = function () { panel.classList.toggle('de-min'); };
  document.getElementById('de-mode-edit').onclick = function (e) { e.stopPropagation(); editMode = true; applyMode(); };
  document.getElementById('de-mode-browse').onclick = function (e) { e.stopPropagation(); editMode = false; applyMode(); };
  document.getElementById('de-pagesel').onchange = function () { location.href = '/' + this.value; };
  document.getElementById('de-general').addEventListener('input', function () {
    generalComments = this.value;
    markDirty();
  });
  document.getElementById('de-save').onclick = function () { save(true); };
  document.getElementById('de-export').onclick = function () {
    // Save the current page first, then bundle every page's draft
    save(false).then(function () {
      return fetch('/__export__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) { setStatus('Export failed', true); return; }
      // Also offer it as a browser download
      var blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('Exported ✓ saved in "website update requests" as ' + res.filename);
    }).catch(function () {
      setStatus('Export failed — is the server still running?', true);
    });
  };
  document.getElementById('de-discard').onclick = function () {
    if (!confirm('Discard the saved draft for this page and reload the original?')) return;
    fetch('/__discard__', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: PAGE }) })
      .then(function () { dirty = false; location.reload(); });
  };

  function updateCounts() {
    document.getElementById('de-c-edits').textContent = Object.keys(edits).length;
    document.getElementById('de-c-del').textContent = Object.keys(deletions).length;
    document.getElementById('de-c-com').textContent = Object.keys(comments).length;
  }

  function setStatus(msg, isError) {
    var s = document.getElementById('de-status');
    s.textContent = msg;
    s.style.color = isError ? '#f2a49e' : '#9fd8b8';
  }

  /* ---------------- save / load ---------------- */
  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { save(false); }, 2000); // autosave
  }

  function detectLang() {
    try {
      if (localStorage.getItem('siteLang')) return localStorage.getItem('siteLang');
    } catch (e) { }
    if (typeof window.currentLang === 'string') return window.currentLang;
    var active = document.querySelector('.lang-toggle button.active, .lang-switch .active');
    if (active) return active.textContent.trim().toLowerCase();
    return (document.documentElement.lang || 'en').slice(0, 2);
  }

  function buildDraft() {
    var lang = detectLang();
    var draft = {
      page: PAGE,
      lang: lang,
      savedAt: new Date().toISOString(),
      generalComments: generalComments,
      edits: [],
      deletions: [],
      comments: []
    };
    Object.keys(edits).forEach(function (id) {
      if (deletions[id]) return;
      var b = blocks[id];
      draft.edits.push({
        id: id, i18n: b.i18n, tag: b.tag,
        original: b.originalText,
        newText: currentText(b.el),
        newHtml: currentHtml(b.el)
      });
    });
    Object.keys(deletions).forEach(function (id) {
      var b = blocks[id];
      draft.deletions.push({ id: id, i18n: b.i18n, tag: b.tag, original: b.originalText });
    });
    Object.keys(comments).forEach(function (id) {
      var b = blocks[id];
      draft.comments.push({
        id: id, i18n: b.i18n, tag: b.tag,
        blockText: currentText(b.el).slice(0, 200),
        comment: comments[id]
      });
    });
    return draft;
  }

  function save(manual) {
    clearTimeout(saveTimer);
    var draft = buildDraft();
    return fetch('/__save__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res.ok) {
        dirty = false;
        var t = new Date().toLocaleTimeString();
        setStatus((manual ? 'Saved ✓ ' : 'Auto-saved ✓ ') + t);
      } else {
        setStatus('Save failed: ' + (res.error || '?'), true);
      }
    }).catch(function () {
      setStatus('Save failed — is the server still running?', true);
    });
  }

  function loadDraft() {
    return fetch('/__draft__?page=' + encodeURIComponent(PAGE))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.exists === false || !d.page) return;
        generalComments = d.generalComments || '';
        document.getElementById('de-general').value = generalComments;
        (d.edits || []).forEach(function (e) {
          var b = blocks[e.id];
          if (!b) return;
          b.el.innerHTML = e.newHtml != null ? e.newHtml : b.originalHtml;
          if (e.newHtml == null && e.newText != null) b.el.innerText = e.newText;
          edits[e.id] = true;
          refreshBlockMarks(e.id);
        });
        (d.deletions || []).forEach(function (del) {
          var b = blocks[del.id];
          if (!b) return;
          deletions[del.id] = true;
          b.el.classList.add('de-block-deleted');
          refreshBlockMarks(del.id);
        });
        (d.comments || []).forEach(function (c) {
          if (!blocks[c.id]) return;
          comments[c.id] = c.comment;
          refreshBlockMarks(c.id);
        });
        updateCounts();
        setStatus('Loaded saved draft (' + new Date(d.savedAt).toLocaleString() + ')');
      })
      .catch(function () { /* no draft yet */ });
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { save(false); }
  });

  // Cmd/Ctrl+S saves the draft
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save(true);
    }
    if (e.key === 'Escape') { hideToolbar(); pop.style.display = 'none'; }
  });

  /* ---------------- init (after i18n has run) ---------------- */
  function init() {
    collectBlocks();
    loadDraft().then(function () {
      applyMode();
      updateCounts();
      if (!document.getElementById('de-status').textContent) {
        setStatus('Ready — click any text to edit');
      }
    });
  }
  if (document.readyState === 'complete') {
    setTimeout(init, 300);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 300); });
  }
})();
