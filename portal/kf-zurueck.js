/* KlasseFit – gemeinsamer „Zurück“-Knopf (Handy/App ohne Browser-Zurück).
   Build bettet ihn in jede Schüler-HTML-Seite ein (wie PWA). API für In-Page-Navigation:
     KFZurueck.push(fn)  – eine Ebene auf den Stack (fn wird beim Zurück aufgerufen)
     KFZurueck.pop()     – oberste Ebene entfernen (ohne auszuführen)
     KFZurueck.clear()   – Stack leeren
     KFZurueck.setGuard(fn) – fn() → string (Bestätigungstext) oder falsy; vor dem Verlassen
   Verhalten: Stack → history.back() (wenn sinnvoll) → Portal-Start.
   Keine Passwörter/Logins/localStorage-Schlüssel der Seiten. */
(function () {
  if (window.KFZurueck && window.KFZurueck._v === 1) return;
  var PORTAL = (function () {
    try {
      var p = location.pathname || "";
      var i = p.indexOf("/portal");
      if (i >= 0) return p.slice(0, i + "/portal".length) + "/";
      // /unterricht/<site>/… → /unterricht/portal/
      var m = p.match(/^(.*?\/(?:unterricht\/)?)(?:[^/]+\/)/);
      if (m) return m[1] + "portal/";
    } catch (e) {}
    return "/unterricht/portal/";
  })();
  var stack = [];
  var guard = null;
  var btn = null;
  var spacer = null;

  function portalHome() {
    var p = (location.pathname || "").replace(/\/index\.html?$/, "/");
    return /\/portal\/?$/.test(p) && !(location.hash || "").replace(/^#\/?$/, "");
  }
  function canHistoryBack() {
    try {
      if (history.length <= 1) return false;
      var ref = document.referrer || "";
      if (!ref) return history.length > 1; // App/PWA: oft kein referrer, trotzdem zurück versuchen
      var a = document.createElement("a"); a.href = ref;
      return a.origin === location.origin;
    } catch (e) { return history.length > 1; }
  }
  function confirmLeave() {
    if (!guard) return true;
    var msg = null;
    try { msg = guard(); } catch (e) { msg = null; }
    if (!msg) return true;
    try { return confirm(String(msg)); } catch (e) { return true; }
  }
  function goPortal() {
    try { location.href = PORTAL; } catch (e) {}
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
  function update() {
    if (!btn) return;
    var hide = portalHome() && !stack.length;
    btn.hidden = hide;
    btn.setAttribute("aria-hidden", hide ? "true" : "false");
    if (spacer) spacer.hidden = hide;
    btn.setAttribute("aria-label", stack.length ? "Zurück (in der Seite)" : "Zurück");
  }
  function ensure() {
    if (btn) return;
    var st = document.createElement("style");
    st.setAttribute("data-kf-zurueck", "1");
    st.textContent =
      "#kfZurueck{position:fixed;top:max(8px,env(safe-area-inset-top,0px));left:max(8px,env(safe-area-inset-left,0px));z-index:2147482000;"
      + "min-width:44px;min-height:44px;padding:8px 12px;border:0;border-radius:999px;background:#0f172ae6;color:#fff;"
      + "font:700 14px/1.1 system-ui,Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;"
      + "-webkit-tap-highlight-color:transparent;touch-action:manipulation;display:inline-flex;align-items:center;gap:6px}"
      + "#kfZurueck[hidden],#kfZurueckPad[hidden]{display:none!important}"
      + "#kfZurueck:active{transform:scale(.97)}"
      + "#kfZurueckPad{height:52px;pointer-events:none;flex-shrink:0}"
      + "@media print{#kfZurueck,#kfZurueckPad{display:none!important}}";
    (document.head || document.documentElement).appendChild(st);
    spacer = document.createElement("div");
    spacer.id = "kfZurueckPad";
    spacer.setAttribute("data-kf-zurueck", "1");
    spacer.setAttribute("aria-hidden", "true");
    btn = document.createElement("button");
    btn.id = "kfZurueck";
    btn.type = "button";
    btn.setAttribute("data-kf-zurueck", "1");
    btn.innerHTML = "<span aria-hidden=\"true\">←</span><span>Zurück</span>";
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); back(); });
    function mount() {
      if (!document.body) return;
      if (!spacer.parentNode) document.body.insertBefore(spacer, document.body.firstChild);
      if (!btn.parentNode) document.body.appendChild(btn);
      update();
    }
    if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", function () { setTimeout(update, 0); });
  }

  window.KFZurueck = {
    _v: 1,
    push: function (fn) { if (typeof fn === "function") { stack.push(fn); update(); } },
    pop: function () { var f = stack.pop(); update(); return f; },
    clear: function () { stack.length = 0; update(); },
    setGuard: function (fn) { guard = typeof fn === "function" ? fn : null; },
    back: back,
    portalUrl: function () { return PORTAL; }
  };
  ensure();
})();
