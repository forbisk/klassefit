/* KlasseFit – Seitenzeit (19.11.2026): misst je Schüler und Seite Gesamtzeit (Seite offen),
   aktive Zeit (Tab sichtbar + Bedienung in den letzten 60 s, wie der Portal-Heartbeat) und
   Weg-Zeit (Tab versteckt oder Fenster nicht im Fokus). Sichtbarer Leerlauf zählt nur zur Gesamtzeit.
   Meldung alle 30 s und beim Verlassen (sendBeacon/pagehide). Nur mit gültiger Portal-Sitzung
   (tfgs_portal_v1), nicht auf der Portal-Startseite, nicht für Lehrkraft/Testkonten, nicht in der Vorschau.
   Fehler werden still geschluckt. Neuer Schlüssel kf_seitzeit_v1 – bestehende Keys bleiben unberührt.
   Wird nur auf Missions- und Selbstlernseiten eingebunden, nie auf Tests/KAs. */
(function () {
  "use strict";
  var W = window;
  try {
    var LS = "kf_seitzeit_v1", SESS = "tfgs_portal_v1";
    var TICK = 1000, SEND = 30000, IDLE = 60000;
    var API = "https://script.google.com/macros/s/AKfycbxqHjPyJR4CM8LIGLWnROgLTlNUCUy0-FTChC4f062rOlhnhSCx_S8UXwBwfBO7Iwnl/exec";
    if (W.KF_SEITZEIT_TEST) {
      if (W.KF_SEITZEIT_TEST.tick) TICK = W.KF_SEITZEIT_TEST.tick;
      if (W.KF_SEITZEIT_TEST.send) SEND = W.KF_SEITZEIT_TEST.send;
      if (W.KF_SEITZEIT_TEST.idle) IDLE = W.KF_SEITZEIT_TEST.idle;
      if (W.KF_SEITZEIT_TEST.api) API = W.KF_SEITZEIT_TEST.api;
    }

    function swallow(fn) { try { return fn(); } catch (e) { return undefined; } }
    function jget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
    function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    function sess() {
      if (W.KF_VORSCHAU) return null;
      try { if (document.documentElement && document.documentElement.hasAttribute("data-vorschau")) return null; } catch (e) {}
      try { if (/[?&]vorschau=/.test(location.search || "")) return null; } catch (e) {}
      var s = jget(SESS);
      if (!s || !s.token || !s.benutzer) return null;
      var r = String(s.rolle || "schueler");
      if (r === "lehrer" || r === "superuser" || r === "test") return null;
      if (/^test[._]/i.test(String(s.benutzer)) && !(W.KF_SEITZEIT_TEST && W.KF_SEITZEIT_TEST.allowTest)) return null;
      return s;
    }
    function onPortal() { return /\/portal(\/|\/index\.html?)?$/.test(location.pathname || ""); }

    function seiteOf() {
      var path = String((location && location.pathname) || "").replace(/\/+$/, "");
      var parts = path.split("/").filter(Boolean);
      var folder = parts[parts.length - 1] || "";
      if (/\.html?$/i.test(folder)) folder = parts[parts.length - 2] || folder.replace(/\.html?$/i, "");
      folder = String(folder).toLowerCase();
      var h = String((location && location.hash) || "").replace(/^#/, "").toLowerCase();
      if (folder === "informatik6-missionen" && /^(medien|ordner)$/.test(h)) return folder + "#" + h;
      return folder;
    }
    function tagOf(t) {
      var d = new Date(t || Date.now());
      return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    }
    function qk(seite, tag) { return seite + "|" + tag; }

    function st() {
      var s = jget(LS);
      if (!s || typeof s !== "object") s = {};
      s.q = s.q && typeof s.q === "object" ? s.q : {};
      return s;
    }

    var lastIn = Date.now();
    var lastTick = Date.now();
    var lastSeite = "";
    var sending = false;

    function mark() { lastIn = Date.now(); W.__kfSeitzeitIn = lastIn; }

    function modeNow(now) {
      try {
        if (document.visibilityState && document.visibilityState !== "visible") return "weg";
        if (document.hidden) return "weg";
        if (typeof document.hasFocus === "function" && !document.hasFocus()) return "weg";
      } catch (e) {}
      if (now - lastIn <= IDLE) return "aktiv";
      return "idle";
    }

    function addDelta(ms, mode, seite, at) {
      if (!(ms > 0) || !seite) return;
      var sec = ms / 1000;
      var s = st();
      var k = qk(seite, tagOf(at));
      var b = s.q[k] || { seite: seite, tag: tagOf(at), aktiv: 0, weg: 0, offen: 0 };
      b.offen += sec;
      if (mode === "aktiv") b.aktiv += sec;
      else if (mode === "weg") b.weg += sec;
      s.q[k] = b;
      jset(LS, s);
    }

    function tick() {
      if (onPortal() || !sess()) { lastTick = Date.now(); return; }
      var now = Date.now();
      var seite = seiteOf();
      if (!lastSeite) lastSeite = seite;
      var dt = now - lastTick;
      if (dt < 0) dt = 0;
      if (dt > 5000) dt = 5000;
      if (seite !== lastSeite && lastSeite) addDelta(dt, modeNow(lastTick), lastSeite, lastTick);
      else addDelta(dt, modeNow(now), seite, now);
      lastTick = now;
      lastSeite = seite;
    }

    function pending() {
      var s = st(), list = [], k;
      for (k in s.q) {
        if (!Object.prototype.hasOwnProperty.call(s.q, k)) continue;
        var b = s.q[k];
        var a = Math.floor(+b.aktiv || 0), w = Math.floor(+b.weg || 0), o = Math.floor(+b.offen || 0);
        if (a + w + o < 1) continue;
        list.push({ seite: b.seite, tag: b.tag, aktiv: a, weg: w, offen: o });
      }
      return list.slice(0, 20);
    }

    function subtract(list) {
      var s = st(), i;
      for (i = 0; i < list.length; i++) {
        var e = list[i], k = qk(e.seite, e.tag), b = s.q[k];
        if (!b) continue;
        b.aktiv = Math.max(0, (b.aktiv || 0) - e.aktiv);
        b.weg = Math.max(0, (b.weg || 0) - e.weg);
        b.offen = Math.max(0, (b.offen || 0) - e.offen);
        if (b.aktiv < 1 && b.weg < 1 && b.offen < 1) delete s.q[k];
        else s.q[k] = b;
      }
      jset(LS, s);
    }

    function send(beacon) {
      swallow(function () {
        if (sending && !beacon) return;
        var s0 = sess();
        if (!s0 || onPortal()) return;
        if (navigator.onLine === false && !beacon) return;
        tick();
        var list = pending();
        if (!list.length) return;
        var body = JSON.stringify({ action: "seitenzeit", token: s0.token, eintraege: list });
        sending = true;
        var done = function (ok) {
          sending = false;
          if (ok) subtract(list);
        };
        if (beacon && navigator.sendBeacon) {
          try {
            var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
            if (navigator.sendBeacon(API, blob)) { done(true); return; }
          } catch (e) {}
        }
        try {
          fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body, keepalive: !!beacon || body.length < 60000 })
            .then(function (r) { return r.json(); })
            .then(function (j) { done(j && j.ok); }, function () { done(false); });
        } catch (e) { done(false); }
      });
    }

    var EV = ["pointerdown", "keydown", "scroll", "touchstart", "wheel", "input", "mousemove", "click"];
    function attach() {
      if (document.__kfSeitzeitL) return;
      document.__kfSeitzeitL = 1;
      EV.forEach(function (e) { try { document.addEventListener(e, mark, { passive: true, capture: true }); } catch (x) {} });
    }

    if (W.__kfSeitzeitOff) { try { W.__kfSeitzeitOff(); } catch (e) {} }

    var onVis = function () { swallow(function () { tick(); if (document.visibilityState === "hidden") send(true); if (document.visibilityState === "visible") mark(); }); };
    var onHide = function () { swallow(function () { tick(); send(true); }); };
    var onBlur = function () { swallow(function () { tick(); }); };
    var onFocus = function () { swallow(function () { tick(); mark(); }); };
    var onHash = function () { swallow(function () { tick(); lastSeite = seiteOf(); }); };

    var iv = setInterval(function () { swallow(function () { attach(); tick(); }); }, TICK);
    var is = setInterval(function () { swallow(function () { send(false); }); }, SEND);
    var t0 = setTimeout(function () { swallow(function () { send(false); }); }, 4000);

    EV.forEach(function (e) { try { W.addEventListener(e, mark, { passive: true, capture: true }); } catch (x) {} });
    document.addEventListener("visibilitychange", onVis);
    W.addEventListener("pagehide", onHide);
    W.addEventListener("beforeunload", onHide);
    W.addEventListener("blur", onBlur);
    W.addEventListener("focus", onFocus);
    W.addEventListener("hashchange", onHash);
    attach();
    lastSeite = seiteOf();
    lastTick = Date.now();

    W.__kfSeitzeitOff = function () {
      clearInterval(iv); clearInterval(is); clearTimeout(t0);
      EV.forEach(function (e) {
        try { W.removeEventListener(e, mark, { capture: true }); document.removeEventListener(e, mark, { capture: true }); } catch (x) {}
      });
      try {
        document.removeEventListener("visibilitychange", onVis);
        W.removeEventListener("pagehide", onHide);
        W.removeEventListener("beforeunload", onHide);
        W.removeEventListener("blur", onBlur);
        W.removeEventListener("focus", onFocus);
        W.removeEventListener("hashchange", onHash);
        document.__kfSeitzeitL = 0;
      } catch (x) {}
    };

    W.KFSeitzeit = {
      flush: function () { send(false); },
      _tick: tick,
      _state: st,
      _test: { seiteOf: seiteOf, tagOf: tagOf, modeNow: modeNow, addDelta: addDelta, pending: pending, subtract: subtract, sess: sess, LS: LS, IDLE: IDLE }
    };
  } catch (e) { /* Seite nie stören */ }
})();
