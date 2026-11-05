/* Legacy browser lifecycle diagnostics. No account, token, or character data stored. */
(function () {
  'use strict';
  var KEY = 'legacy_lifecycle_trace_v1';
  var MAX_EVENTS = 30;
  var now = function () { return Date.now(); };
  var read = function () {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  };
  var previous = read();
  var navigation = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  var trace = {
    pageId: (previous.pageId || 0) + 1,
    started: now(),
    navigationType: navigation ? navigation.type : 'unknown',
    previousEvent: previous.lastEvent || 'none',
    previousTime: previous.lastTime || 0,
    lastEvent: 'page-start',
    lastTime: now(),
    events: (previous.events || []).slice(-MAX_EVENTS + 1)
  };
  function record(name) {
    trace.lastEvent = name;
    trace.lastTime = now();
    trace.events.push({event: name, time: trace.lastTime, page: trace.pageId});
    trace.events = trace.events.slice(-MAX_EVENTS);
    try { sessionStorage.setItem(KEY, JSON.stringify(trace)); }
    catch (_) {}
    console.info('[Legacy lifecycle]', name, 'page', trace.pageId);
  }
  window.LegacyLifecycleDiagnostics = {
    snapshot: function () { return JSON.parse(JSON.stringify(trace)); },
    record: record
  };
  record('page-start');
  document.addEventListener('visibilitychange', function () {
    record(document.hidden ? 'visibility-hidden' : 'visibility-visible');
    if (!document.hidden) showReport();
  });
  window.addEventListener('pagehide', function (event) {
    record('pagehide-persisted-' + Boolean(event.persisted));
  });
  window.addEventListener('pageshow', function (event) {
    record('pageshow-persisted-' + Boolean(event.persisted));
    if (event.persisted) showReport();
  });
  window.addEventListener('freeze', function () { record('freeze'); });
  window.addEventListener('resume', function () { record('resume'); showReport(); });
  function showReport() {
    if (!document.body) return;
    var old = document.getElementById('legacy-lifecycle-report');
    if (old) old.remove();
    var before = trace.pageId === 1 ? '' :
      'NEW PAGE #' + trace.pageId + ' | previous: ' + trace.previousEvent;
    var report = before || 'RETURNED TO PAGE | ' + trace.lastEvent;
    var note = document.createElement('div');
    note.id = 'legacy-lifecycle-report';
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;z-index:2147483646;' +
      'background:rgba(7,17,27,.94);color:#fff;font:12px/1.4 monospace;' +
      'padding:9px;border:1px solid #8ac7ff;border-radius:6px;pointer-events:auto';
    var message = document.createElement('span');
    message.textContent = 'LEGACY LIFECYCLE: ' + report;
    var close = document.createElement('button');
    close.textContent = 'X';
    close.setAttribute('aria-label', 'Dismiss lifecycle diagnostic');
    close.style.cssText = 'float:right;margin-left:10px';
    close.onclick = function () { note.remove(); };
    note.appendChild(close);
    note.appendChild(message);
    document.body.appendChild(note);
  }
  if (trace.pageId > 1) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showReport, {once:true});
    } else {
      showReport();
    }
  }
})();
