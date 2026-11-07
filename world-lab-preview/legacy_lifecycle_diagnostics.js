/* Legacy browser lifecycle diagnostics; stores no account, token, or character data. */
(function () {
  'use strict';
  var KEY = 'legacy_lifecycle_trace_v2';
  var MAX_EVENTS = 40;
  var now = function () { return Date.now(); };
  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }
  var previous = read();
  var navigation = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
  var trace = {
    pageId: (previous.pageId || 0) + 1,
    started: now(),
    navigationType: navigation ? navigation.type : 'unknown',
    previousEvent: previous.lastEvent || 'none',
    previousRejection: previous.lastRejection || null,
    previousIntent: previous.navigationIntent || '',
    previousTime: previous.lastTime || 0,
    previousAgeSeconds: previous.lastTime ? Math.max(0, Math.round((now() - previous.lastTime) / 1000)) : -1,
    previousVisibility: previous.visibility || 'unknown',
    previousPageHide: Boolean(previous.pageHide),
    visibility: document.visibilityState,
    pageHide: false,
    navigationIntent: '',
    lastEvent: 'page-start',
    lastTime: now(),
    events: (previous.events || []).slice(-MAX_EVENTS + 1)
  };
  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(trace)); }
    catch (_) {}
  }
  function record(name) {
    trace.lastEvent = name;
    trace.visibility = document.visibilityState;
    if (name.indexOf('pagehide-') === 0) trace.pageHide = true;
    trace.lastTime = now();
    trace.events.push({event: name, time: trace.lastTime, page: trace.pageId});
    trace.events = trace.events.slice(-MAX_EVENTS);
    persist();
    console.info('[Legacy lifecycle]', name, 'page', trace.pageId);
  }
  function markNavigation(reason) {
    // Explicitly record only our own approved navigation paths; never intercept browser navigation.
    trace.navigationIntent = String(reason).slice(0, 80);
    record('intent-' + trace.navigationIntent);
  }
  window.LegacyLifecycleDiagnostics = {
    snapshot: function () { return JSON.parse(JSON.stringify(trace)); },
    record: record,
    markNavigation: markNavigation
  };
  // Capture browser-side failures before WebKit can terminate the page.
  // No game state or account information is retained.
  window.addEventListener('error', function (event) {
    record('js-error-' + String(event.message || 'unknown').slice(0, 100));
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message = String(reason && reason.message || reason || 'unknown');
    // Preserve the script origin across unexpected WebKit restarts.
    trace.lastRejection = {
      name: String(reason && reason.name || 'unknown').slice(0, 80),
      message: message.slice(0, 240),
      stack: String(reason && reason.stack || '').slice(0, 1200),
      time: now()
    };
    record('promise-rejection-' + message.slice(0, 100));
    console.error('[Legacy startup rejection]', trace.lastRejection);
  });
  var startupMilestones = ['page-start', 'godot-ready', 'title-ready'];
  window.LegacyLifecycleDiagnostics.markStartup = function (stage) {
    var name = String(stage || 'unknown').slice(0, 60);
    record('startup-' + name);
  };
  record('page-start');
  // A persisted heartbeat helps distinguish a page killed without pagehide from a normal exit.
  // Do not append heartbeat events: keep the event history focused on transitions.
  window.setInterval(function () {
    trace.lastTime = now();
    // Safari does not expose reliable JS/WASM heap usage. Record only
    // available memory estimates; do not invent a device-memory reading.
    if (performance && performance.memory) {
      trace.jsHeapUsed = performance.memory.usedJSHeapSize || 0;
      trace.jsHeapLimit = performance.memory.jsHeapSizeLimit || 0;
    }
    persist();
  }, 5000);
  // Make the previous page's last recorded event inspectable after a crash.
  // This does not cause a reload and stores no personal or gameplay data.
  window.LegacyLifecycleDiagnostics.previous = function () {
    return {event: trace.previousEvent, intent: trace.previousIntent,
      ageSeconds: trace.previousAgeSeconds, pagehide: trace.previousPageHide};
  };
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
    var report = trace.pageId > 1 ?
      'NEW PAGE #' + trace.pageId + ' | nav: ' + trace.navigationType +
      ' | previous: ' + trace.previousEvent +
      ' | requested: ' + (trace.previousIntent || 'none recorded') +
      ' | last seen: ' + (trace.previousAgeSeconds < 0 ? 'unknown' : trace.previousAgeSeconds + 's ago') +
      ' | visibility: ' + trace.previousVisibility +
      ' | pagehide: ' + (trace.previousPageHide ? 'yes' : 'no') :
      'PAGE ALIVE | ' + trace.lastEvent;
    if (trace.previousRejection) {
      var failure = trace.previousRejection;
      report += ' | rejection: ' + String(failure.name || 'unknown') + ': ' + String(failure.message || 'unknown') +
        ' | stack: ' + String(failure.stack || 'unavailable');
    }
    var note = document.createElement('div');
    note.id = 'legacy-lifecycle-report';
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;z-index:2147483646;' +
      'background:rgba(7,17,27,.94);color:#fff;font:12px/1.4 monospace;' +
      'padding:9px;border:1px solid #8ac7ff;border-radius:6px;pointer-events:auto';
    var message = document.createElement('span');
    message.textContent = 'LEGACY LIFECYCLE: ' + report;
    message.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
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
