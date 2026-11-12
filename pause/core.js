/* idle_pause_page/core.js -- the idle pause's rules, ONE copy (Nov 11 2026; fixed Nov 12 2026; docs/FEATURES.md "Idle pause").
   Used by: the app (idle_pause.py puts this text into the page), the pause page (build_pause_page.py copies it in for
   n95IdleBack), and node test_idle_pause.mjs.

   Why: Cloud Run bills the whole time a browser tab holds the app's live connection, even when nobody is looking
   (Nov 9-10 2026: two forgotten Safari tabs kept one copy of the app billed 24 hours a day, ~$33 a month).
   What: after cfg.limitMs with no mouse, key, touch, scroll or typing -- in the page OR in the app's own same-origin
   frames (the consoles, the globe, Try Your Seat) -- the tab moves to the pause page, which has no live connection.
   "Continue" brings it back to the page it was on.
   Never pauses: while a page is still running (Streamlit's own data-test-script-state="running", read off the live
   app Nov 11 2026), while unsaved_guard counts unsaved edits on this page, or on an exempt page (95TV: people watch).

   Nov 12 2026 fixes (Cloud Run log Nov 11): (1) the pause page now lives on GitHub Pages (cfg.pageUrl), not inside the
   app: the app only had it after someone opened a page on that running copy, so both real pauses on Nov 11 landed on
   "Component not found". The page the tab was on travels after '#', which no server ever receives. (2) A Safari tab in
   the background held the connection from 7:56 AM to ~9:20 PM because its timer hardly ran. Now the tab is also checked
   (a) when the app tries to reconnect (Streamlit opens each new connection through window.WebSocket -- seen on the live
   app Nov 12 2026; Cloud Run ends every connection after 1 hour, so a forgotten tab reconnects at least hourly) and
   (b) the moment the tab is shown or focused again. */

function n95IdleDecide(s) {
    // s: {idleMs, limitMs, running, unsaved, exempt} -> 'busy' | 'unsaved' | 'exempt' | 'pause' | 'wait'
    if (s.running) return 'busy';
    if (s.unsaved) return 'unsaved';
    if (s.exempt) return 'exempt';
    return s.idleMs >= s.limitMs ? 'pause' : 'wait';
}

function n95IdleUnsaved(w) {
    // the same rule as unsaved_guard.py's pending(): an entry for THIS address with edits counted or typed
    var u = w.__n95U || {};
    for (var k in u) {
        var e = u[k];
        try { if (new RegExp(e.re, 'i').test(w.location.pathname) && (e.n > 0 || e.typed)) return true; } catch (x) {}
    }
    return false;
}

function n95IdleBack(v) {
    // where Continue goes: only an address on the app's own site ("/..." but never "//other.site"), else the start page
    v = String(v || '');
    return (v.charAt(0) === '/' && v.charAt(1) !== '/' && v.charAt(1) !== '\\') ? v : '/';
}

function n95IdleBackFromHash(hash) {
    // the pause page's address ends "#<page the tab was on>"; anything odd goes to the start page
    var v = String(hash || '').replace(/^#/, '');
    try { v = decodeURIComponent(v); } catch (x) { v = ''; }
    return n95IdleBack(v);
}

var N95_IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll', 'input'];

function n95IdleInstall(w, cfg) {
    // cfg: {limitMs, checkMs, pageUrl, exempt (regex on the address, '' = none)}. Once per browser tab.
    if (w.__n95IdleV2) return false;
    w.__n95IdleV2 = true;
    if (w.__n95IdleTimer) w.clearInterval(w.__n95IdleTimer);   // a tab still running the Nov 11 version: stop its timer
    var last = Date.now(), gone = false;
    function seen() { last = Date.now(); }
    function watch(doc) {
        if (!doc || doc.__n95IdleSeen) return;
        doc.__n95IdleSeen = true;
        N95_IDLE_EVENTS.forEach(function (t) { doc.addEventListener(t, seen, { capture: true, passive: true }); });
    }
    function watchFrames(doc, depth) {
        // the app's own frames are same-origin: activity in them counts. Other sites' frames (YouTube, maps) can't be read.
        if (!doc || depth > 2) return;
        var fs = doc.querySelectorAll('iframe');
        for (var i = 0; i < fs.length; i++) {
            var inner = null;
            try { inner = fs[i].contentDocument; } catch (x) { inner = null; }
            if (inner) { watch(inner); watchFrames(inner, depth + 1); }
        }
    }
    function running() {
        var a = w.document.querySelector('.stApp');
        return !!(a && a.getAttribute('data-test-script-state') === 'running');
    }
    function exempt() {
        try { return !!(cfg.exempt && new RegExp(cfg.exempt, 'i').test(w.location.pathname)); } catch (x) { return false; }
    }
    function verdict() {
        var r = running();
        if (r) seen();                                   // a page still working counts as activity
        return n95IdleDecide({ idleMs: Date.now() - last, limitMs: cfg.limitMs, running: r,
                               unsaved: n95IdleUnsaved(w), exempt: exempt() });
    }
    function go() {
        if (gone) return;
        gone = true;
        w.clearInterval(w.__n95IdleTimer);
        // only the page's name travels (never its ?options), after '#', so no server ever receives it
        w.location.assign(cfg.pageUrl + '#' + encodeURIComponent(w.location.pathname));
    }
    watch(w.document);
    watchFrames(w.document, 0);
    w.__n95IdleCheck = function () {
        watchFrames(w.document, 0);
        var v = verdict();
        w.__n95IdleState = v;
        if (v === 'pause') go();
        return v;
    };
    // (a) the app reconnecting: a tab that has been idle long enough goes to the pause page instead of reconnecting
    var Orig = w.WebSocket;
    if (Orig && !Orig.__n95Idle) {
        var Guarded = function (url, protocols) {
            if (String(url).indexOf('/_stcore/stream') !== -1 && w.__n95IdleCheck() === 'pause') {
                throw new Error('NINETY5IVE idle pause: not reconnecting an idle tab');
            }
            return protocols === undefined ? new Orig(url) : new Orig(url, protocols);
        };
        Guarded.prototype = Orig.prototype;
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { Guarded[k] = Orig[k]; });
        Guarded.__n95Idle = true;
        w.WebSocket = Guarded;
    }
    // (b) the tab shown or focused again: check before the first mouse move counts as activity
    w.document.addEventListener('visibilitychange', function () { if (!w.document.hidden) w.__n95IdleCheck(); }, true);
    w.addEventListener('focus', function () { w.__n95IdleCheck(); }, true);
    w.addEventListener('pageshow', function () { w.__n95IdleCheck(); }, true);
    w.__n95IdleTimer = w.setInterval(w.__n95IdleCheck, cfg.checkMs);
    return true;
}

if (typeof module !== 'undefined') module.exports = { n95IdleDecide: n95IdleDecide, n95IdleUnsaved: n95IdleUnsaved,
                                                       n95IdleBack: n95IdleBack, n95IdleBackFromHash: n95IdleBackFromHash,
                                                       n95IdleInstall: n95IdleInstall };
