/* KlasseFit – gemeinsamer „Zurück“- und „Start“-Knopf (Handy/App ohne Browser-Zurück).
   Build bettet ihn in jede Schüler-HTML-Seite ein (wie PWA). API für In-Page-Navigation:
     KFZurueck.push(fn)  – eine Ebene auf den Stack (fn wird beim Zurück aufgerufen)
     KFZurueck.pop()     – oberste Ebene entfernen (ohne auszuführen)
     KFZurueck.clear()   – Stack leeren
     KFZurueck.setGuard(fn) – fn() → string (Bestätigungstext) oder falsy; vor dem Verlassen
   Verhalten Zurück: Stack → history.back() (wenn sinnvoll) → Portal-Start.
   Start: immer zur Portal-Startseite (/portal/?start=1), außer man ist schon dort.
   Keine Passwörter/Logins/localStorage-Schlüssel der Seiten. */
(function () {
  /* Nach StatiCrypt-Entschlüsselung wird das DOM ersetzt – Knopf neu einhängen. */
  if (window.KFZurueck && window.KFZurueck._v === 2) {
    try { window.KFZurueck.remount && window.KFZurueck.remount(); } catch (e) {}
    return;
  }
  var PORTAL = (function () {
    try {
      var p = location.pathname || "";
      var i = p.indexOf("/portal");
      if (i >= 0) return p.slice(0, i + "/portal".length) + "/";
      // GitHub-Pages-Kopie: /unterricht/<site>/… → /unterricht/portal/; klassefit.de: /<site>/… → /portal/
      if (/^\/unterricht\//.test(p)) return "/unterricht/portal/";
    } catch (e) {}
    return "/portal/";
  })();
  var stack = [];
  var guard = null;
  var nav = null;
  var btn = null;
  var startBtn = null;
  var spacer = null;

  function portalHome() {
    var p = (location.pathname || "").replace(/\/index\.html?$/, "/");
    return /\/portal\/?$/.test(p) && !(location.hash || "").replace(/^#\/?$/, "");
  }
  function canHistoryBack() {
    /* Nur zu einer ANDEREN Seite derselben Origin (z.B. Portal→Missionen).
       Gleicher Pfad = typisch StatiCrypt-Reload; ohne Referrer kein history.back (sonst about:blank). */
    try {
      var ref = document.referrer || "";
      if (!ref) return false;
      var a = document.createElement("a"); a.href = ref;
      if (a.origin !== location.origin) return false;
      var norm = function (x) { return String(x || "").replace(/\/index\.html?$/, "/"); };
      return norm(a.pathname) !== norm(location.pathname);
    } catch (e) { return false; }
  }
  function confirmLeave() {
    if (!guard) return true;
    var msg = null;
    try { msg = guard(); } catch (e) { msg = null; }
    if (!msg) return true;
    try { return confirm(String(msg)); } catch (e) { return true; }
  }
  /* start=true → /portal/?start=1: Portal öffnet die echte Startseite (Lehrkraft: Bereichswahl), nicht das zuletzt gewählte Fach. */
  function goPortal(startSeite) {
    var ziel = PORTAL + (startSeite ? "?start=1" : "");
    try { location.assign(new URL(ziel, location.origin).href); } catch (e) {
      try { location.href = ziel; } catch (e2) {}
    }
  }
  function back() {
    if (stack.length) {
      if (!confirmLeave()) return;
      var fn = stack.pop();
      update();
      try { fn && fn(); } catch (e) {}
      return;
    }
    if (portalHome()) return;
    if (!confirmLeave()) return;
    if (canHistoryBack()) {
      try { history.back(); return; } catch (e) {}
    }
    goPortal();
  }
  function start() {
    if (portalHome()) return;
    if (!confirmLeave()) return;
    stack.length = 0;
    update();
    goPortal(true);
  }
  function update() {
    if (!nav) return;
    /* Auf dem Portal-Start übernimmt der Portal-Kopf Start/Zurück – schwebende Knöpfe ausblenden
       (sonst Doppelung; auf /portal/ ohne Stack war Zurück bisher schon versteckt). */
    var hide = portalHome();
    nav.hidden = hide;
    nav.setAttribute("aria-hidden", hide ? "true" : "false");
    if (spacer) spacer.hidden = hide;
    if (btn) {
      btn.hidden = hide;
      btn.setAttribute("aria-label", stack.length ? "Zurück (in der Seite)" : "Zurück");
    }
    if (startBtn) {
      startBtn.hidden = hide;
      startBtn.setAttribute("aria-label", "Start – zum Portal");
    }
  }
  function ensure() {
    if (nav && document.body && document.body.contains(nav)) { update(); return; }
    nav = null; btn = null; startBtn = null; spacer = null;
    var old = document.querySelectorAll("[data-kf-zurueck]");
    for (var i = 0; i < old.length; i++) { try { old[i].parentNode && old[i].parentNode.removeChild(old[i]); } catch (e) {} }
    var st = document.createElement("style");
    st.setAttribute("data-kf-zurueck", "1");
    st.textContent =
      "#kfNav{position:fixed;top:max(8px,env(safe-area-inset-top,0px));left:max(8px,env(safe-area-inset-left,0px));z-index:2147482000;"
      + "display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 16px)}"
      + "#kfNav[hidden],#kfZurueckPad[hidden]{display:none!important}"
      + "#kfZurueck,#kfStart{min-width:44px;min-height:44px;padding:8px 12px;border:0;border-radius:999px;background:#0f172ae6;color:#fff;"
      + "font:700 14px/1.1 system-ui,Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;"
      + "-webkit-tap-highlight-color:transparent;touch-action:manipulation;display:inline-flex;align-items:center;gap:6px}"
      /* Tests: Warte-Sperre der Test-Engine blendet body>* aus – Navigation bleibt trotzdem sichtbar (09.11.2026) */
      + "html.testgesperrt body>#kfNav#kfNav:not([hidden]){display:inline-flex!important}"
      + "#kfZurueck:active,#kfStart:active{transform:scale(.97)}"
      + "#kfZurueckPad{height:52px;pointer-events:none;flex-shrink:0}"
      + "@media print{#kfNav,#kfZurueckPad{display:none!important}}";
    (document.head || document.documentElement).appendChild(st);
    spacer = document.createElement("div");
    spacer.id = "kfZurueckPad";
    spacer.setAttribute("data-kf-zurueck", "1");
    spacer.setAttribute("aria-hidden", "true");
    nav = document.createElement("div");
    nav.id = "kfNav";
    nav.setAttribute("data-kf-zurueck", "1");
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "KlasseFit Navigation");
    btn = document.createElement("button");
    btn.id = "kfZurueck";
    btn.type = "button";
    btn.setAttribute("data-kf-zurueck", "1");
    btn.innerHTML = "<span aria-hidden=\"true\">←</span><span>Zurück</span>";
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); back(); });
    startBtn = document.createElement("button");
    startBtn.id = "kfStart";
    startBtn.type = "button";
    startBtn.setAttribute("data-kf-zurueck", "1");
    startBtn.innerHTML = "<span aria-hidden=\"true\">⌂</span><span>Start</span>";
    startBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); start(); });
    nav.appendChild(btn);
    nav.appendChild(startBtn);
    function mount() {
      if (!document.body) return;
      if (!spacer.parentNode) document.body.insertBefore(spacer, document.body.firstChild);
      if (!nav.parentNode) document.body.appendChild(nav);
      update();
    }
    if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", function () { setTimeout(update, 0); });
  }

  function remount() {
    nav = document.getElementById("kfNav");
    btn = document.getElementById("kfZurueck");
    startBtn = document.getElementById("kfStart");
    spacer = document.getElementById("kfZurueckPad");
    if (!nav || (nav && document.body && !document.body.contains(nav))) {
      nav = null; btn = null; startBtn = null; spacer = null;
    }
    ensure();
  }
  window.KFZurueck = {
    _v: 2,
    push: function (fn) { if (typeof fn === "function") { stack.push(fn); update(); } },
    pop: function () { var f = stack.pop(); update(); return f; },
    clear: function () { stack.length = 0; update(); },
    setGuard: function (fn) { guard = typeof fn === "function" ? fn : null; },
    back: back,
    start: start,
    remount: remount,
    portalUrl: function () { return PORTAL; }
  };
  ensure();
  document.addEventListener("staticrypt-decrypted", remount);
  window.addEventListener("pageshow", function () { setTimeout(remount, 0); });
  /* StatiCrypt ersetzt oft body ohne Event – kurz nachladen prüfen */
  setTimeout(remount, 50);
  setTimeout(remount, 400);
  setTimeout(remount, 1200);
  try {
    var mo = new MutationObserver(function () {
      if (!document.getElementById("kfNav") || (nav && document.body && !document.body.contains(nav))) remount();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
