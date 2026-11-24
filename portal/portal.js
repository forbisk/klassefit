/* Schüler-Portal – Oberfläche (reines JavaScript, keine Fremdbibliotheken).
   - Anmeldung einmal (Benutzername + Code), Sitzung bleibt auf dem Gerät (localStorage), Abmelden-Knopf.
   - Menü nur mit den Seiten der eigenen Klasse; Klassenpasswörter kommen erst nach dem Login vom Server (als StatiCrypt-Schlüssel)
     und werden in den "Angemeldet bleiben"-Speicher der jeweiligen Seite geschrieben (tfgs_sc_<ordner>) – die Schüler tippen sie nie.
   - Lehrer (Superuser): alle Klassen/Seiten, Freigaben für Tests, Sitzungen widerrufen, Fortschritts-Dashboard (echte Daten, nur Lehrer). */
(function () {
  "use strict";
  var LS = "tfgs_portal_v1", LSC = "tfgs_portal_cache", LSG = "tfgs_portal_gates";
  var API = window.PORTAL_API || "";
  var FACH = { mathe: "Mathe", informatik: "Informatik", klasse: "Klasse", privat: "Sonstiges" };
  var ART = { material: ["Material", "📘"], mission: ["Missionen", "🚀"], selbstlernen: ["Selbstlernen", "🧠"], karten: ["Karteikarten", "🗂️"], tool: ["Werkzeug", "🧮"], folien: ["Folien", "🎞️"], test: ["Test", "📝"], hausaufgabe: ["Hausaufgabe", "📝"] };
  var app = document.getElementById("app");
  var S = { kop: {}, br: null, brErr: "", brLoading: false, deckId: "", deckCtl: null, sess: null, seiten: [], offline: false, tab: "menue", klasse: "", admin: null, dash: null, dashKlasse: "", dashSeite: "", dashSort: "name", dashDetail: "", dashLoading: false, dashErr: "", dashAt: 0, busy: false, schulform: "", thema: "", fach: "", lthema: "", fthema: "", dauerWahl: "", dashTyp: "", dashThema: "" };
  /* Lehrkraft: Bereich Gymnasium / Sekundarschule (07.11.2026). Gymnasium = Klassen mit Endung "g" (8g, 9g). Wahl gilt nur in diesem Tab (sessionStorage),
     nach jeder neuen Anmeldung wird neu gefragt. Schüler-Logins sind davon nicht betroffen.
     21.11.2026: Demo-Klasse "play" (Store-Prüfung) zählt nicht für die Bereichszuordnung – sonst erscheinen Gym-Seiten mit „8g, play“ fälschlich unter Sekundarschule. */
  var SF_KEY = "kf_lehrer_schulform";
  function isGymKl(k) { return /^\d+g$/i.test(String(k || "")); }
  function isBereichKl(k) { k = String(k || ""); return !!k && k !== "*" && !/^play$/i.test(k); }
  function formOfPage(s) { var kl = (s.klassen || []).filter(isBereichKl); return kl.length && kl.every(isGymKl) ? "gym" : "sek"; }
  function sfGet() { try { var v = sessionStorage.getItem(SF_KEY); return v === "gym" || v === "sek" ? v : ""; } catch (e) { return ""; } }
  function sfSet(v) { S.schulform = v; try { if (v) sessionStorage.setItem(SF_KEY, v); else sessionStorage.removeItem(SF_KEY); } catch (e) {} }
  S.schulform = sfGet();
  /* 09.11.2026 (t18u): danach Fachwahl Mathematik / Informatik (+ „Weiteres“ für fachübergreifende Seiten). Nur Tab-Dauer (sessionStorage),
     wird bei Anmelden/Abmelden und beim Bereichswechsel gelöscht. */
  var FW_KEY = "kf_lehrer_fach", FWAHL = { mathe: ["Mathematik", "📐"], informatik: ["Informatik", "💻"], weiteres: ["Weiteres · Klasse & Lernen", "🤝"] };
  function fachWahlOf(s) { var f = fachKey(s.fach); return f === "mathe" || f === "informatik" ? f : "weiteres"; }
  function fwGet() { try { var v = sessionStorage.getItem(FW_KEY); return FWAHL[v] ? v : ""; } catch (e) { return ""; } }
  function fwSet(v) { S.fach = v; S.lthema = ""; try { if (v) sessionStorage.setItem(FW_KEY, v); else sessionStorage.removeItem(FW_KEY); } catch (e) {} }
  S.fach = fwGet();
  /* 10.11.2026 (t34u): /portal/?start=1 (schwebender Start auf Unterseiten) = echte Startseite: gespeicherten Bereich/Fach verwerfen, Parameter entfernen. */
  (function () {
    if (!/[?&]start=1(&|$)/.test(location.search)) return;
    sfSet(""); fwSet("");
    try { var q = location.search.replace(/([?&])start=1(&|$)/, "$1").replace(/[?&]$/, ""); history.replaceState(null, "", location.pathname + q + location.hash); } catch (e) {}
  })();

  /* ---------- Hilfen ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v == null || v === false) return;
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    });
    (function add(list) { for (var i = 0; i < list.length; i++) { var c = list[i]; if (c == null || c === false) continue;
      if (Array.isArray(c)) add(c); else e.appendChild(c.nodeType ? c : document.createTextNode(String(c))); } })(Array.prototype.slice.call(arguments, 2));
    return e;
  }
  function tipId(id) {
    if (!id) return null;
    if (window.KFTip && KFTip.el) { var n = KFTip.el(id); if (n) return n; }
    var tx = window.KFTip && KFTip.text(id);
    return tx ? h("span", { class: "kf-tid", title: tx, "data-tip": tx, tabindex: "0", text: String(id).replace(/^[a-z]+:/, "") }) : null;
  }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function okFolder(o) { return /^[a-z0-9][a-z0-9\-]*$/.test(String(o)); }
  function fachKey(f) { f = String(f || "").toLowerCase(); return FACH[f] ? f : "privat"; }
  function api(body) {
    if (!API) return Promise.resolve({ ok: false, error: "Das Portal ist noch nicht eingerichtet." });
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 25000);
    return fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { if (t) clearTimeout(t); return j; })
      .catch(function () { if (t) clearTimeout(t); return { ok: false, network: true, error: "Keine Verbindung. Bitte Internet prüfen." }; });
  }

  /* ---------- Kopplung "Karte nur nach Freischaltung" (z. B. Testberichtigung) ----------
     Seiten, die ihre Freischaltung selbst im Selbstlern-Backend verwalten (testStatus), stehen in config.js unter PORTAL_KOPPLUNG:
     { "<Seiten-Key>": { url: "<Web-App-Adresse>", testId: "<Test-Kennung>" } }. Schüler sehen die Karte erst, wenn die Lehrkraft dort
     „Jetzt freischalten“ geklickt hat (Prüfung beim Öffnen, beim Zurückkehren und alle 30 s); Lehrkräfte sehen sie immer, mit Statusmarke.
     Unbekannter Status (kein Netz/Fehler) = Karte bleibt unsichtbar. Die Seite selbst ist zusätzlich gesperrt, solange nicht freigeschaltet. */
  var KOP = window.PORTAL_KOPPLUNG || {};
  function kopStatus(c) {
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "testStatus", testId: c.testId }), redirect: "follow", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { if (t) clearTimeout(t); return (j && j.ok) ? (j.open === true) : undefined; })
      .catch(function () { if (t) clearTimeout(t); return undefined; });
  }
  function kopPruefen() {
    if (!S.sess) return;
    var keys = S.seiten.map(function (s) { return s.key; }).filter(function (k) { return KOP[k] && KOP[k].url && KOP[k].testId; });
    if (!keys.length) return;
    Promise.all(keys.map(function (k) { return kopStatus(KOP[k]).then(function (v) { return [k, v]; }); })).then(function (res) {
      var changed = false;
      res.forEach(function (r) { if (r[1] === undefined) return; if (S.kop[r[0]] !== r[1]) { S.kop[r[0]] = r[1]; changed = true; } });
      S.kopDone = true;
      if (changed && S.sess) render();
    });
  }
  function kopSichtbar(s) { return !KOP[s.key] || S.kop[s.key] === true; }
  /* Schüleransicht: zusätzlich zur Server-Filterung nur Seiten der eigenen Klasse (oder "*") – nie Reste eines anderen Kontos. */
  function eigeneKlasse(s) { var k = String((S.sess && S.sess.klasse) || "").toLowerCase(); if (!k) return true; var l = (s.klassen || []).map(function (x) { return String(x).toLowerCase(); }); return l.indexOf(k) >= 0 || l.indexOf("*") >= 0; }
  setInterval(function () { if (!document.hidden && S.sess) kopPruefen(); }, 30000);

  /* ---------- Klassenpasswort-Schlüssel der Seiten (StatiCrypt "Angemeldet bleiben") ---------- */
  function gateKeyName(o) { return "tfgs_sc_" + o; }
  /* Befristete Konten (z. B. Vertretung): Gate nur bis Freigaben-Bis; tfgs_sc_exp_<ordner>.
     Quelle (B3, ab portal-7o): profil.gateBis vom Backend (aus Blatt „Freigaben“, Spalte Bis). GATE_BIS nur noch Fallback für ältere Backends –
     gleicher Wert steht in unterricht-build/template*.html (build.py check_gate_bis bricht ab, wenn die Stellen nicht übereinstimmen). */
  var GATE_BIS = { vertretung: Date.parse("2026-11-24T07:00:00+01:00") };
  function gateBisFor(profil) {
    if (!profil) return 0;
    var g = +profil.gateBis || 0;
    if (g > 0) return g;
    var u = String(profil.benutzer || "").toLowerCase();
    return GATE_BIS[u] || 0;
  }
  /* Spalte "Gate-Key" im Blatt: entweder nur der Schlüssel der eigenen Seite, oder "schluessel;ordner=schluessel;…" (zusätzliche Ordner,
     die von dieser Seite aus verlinkt sind bzw. dasselbe Klassenpasswort haben). Nur 64 Hex-Zeichen und gültige Ordnernamen werden übernommen. */
  function parseGate(own, g) {
    var m = {}; String(g || "").split(";").forEach(function (p, i) {
      p = p.trim(); var e = p.indexOf("="), f = own, k = p;
      if (e > 0) { f = p.slice(0, e); k = p.slice(e + 1); } else if (i > 0) return;
      if (okFolder(f) && /^[0-9a-f]{64}$/.test(k) && !m[f]) m[f] = k;
    });
    return m;
  }
  function gatesOf(seiten) {
    var all = {};
    seiten.forEach(function (s) { if (!s.gate || !okFolder(s.ordner)) return; var m = parseGate(s.ordner, s.gate); Object.keys(m).forEach(function (f) { if (!all[f] || f === s.ordner) all[f] = m[f]; }); });
    return all;
  }
  function applyGates(all, bis) {
    var old = lsGet(LSG) || {}, now = {};
    bis = +bis || 0;
    Object.keys(all).forEach(function (o) {
      try {
        localStorage.setItem(gateKeyName(o), all[o]); now[o] = all[o];
        if (bis) localStorage.setItem("tfgs_sc_exp_" + o, String(bis));
        else localStorage.removeItem("tfgs_sc_exp_" + o);
      } catch (e) {}
    });
    Object.keys(old).forEach(function (o) {   // nicht mehr sichtbare Seiten: nur entfernen, wenn der Schlüssel vom Portal stammt
      if (!now[o] && okFolder(o)) {
        try {
          if (localStorage.getItem(gateKeyName(o)) === old[o]) localStorage.removeItem(gateKeyName(o));
          localStorage.removeItem("tfgs_sc_exp_" + o);
        } catch (e) {}
      }
    });
    lsSet(LSG, now);
  }
  function clearGates() {
    var old = lsGet(LSG) || {};
    Object.keys(old).forEach(function (o) {
      if (!okFolder(o)) return;
      try {
        if (localStorage.getItem(gateKeyName(o)) === old[o]) localStorage.removeItem(gateKeyName(o));
        localStorage.removeItem("tfgs_sc_exp_" + o);
      } catch (e) {}
    });
    lsDel(LSG);
  }

  /* ---------- Sitzung ---------- */
  function takePayload(p) {
    S.sess = { token: (p.token || (S.sess && S.sess.token)), benutzer: p.profil.benutzer, name: p.profil.name, klasse: p.profil.klasse, rolle: p.profil.rolle, wuensche: (p.wuensche && typeof p.wuensche === "object") ? p.wuensche : null, gateBis: gateBisFor(p.profil) || undefined };
    S.seiten = p.seiten || []; S.offline = false; S.bestaetigt = true;
    S.gates = gatesOf(S.seiten);
    applyGates(S.gates, gateBisFor(p.profil));
    lsSet(LS, S.sess);
    lsSet(LSC, { benutzer: S.sess.benutzer, seiten: S.seiten.map(function (s) { var c = {}; Object.keys(s).forEach(function (k) { if (k !== "gate") c[k] = s[k]; }); return c; }) });
  }
  /* Identität/Sitzungen räumen – Lernfortschritt (sl10a-*, kg5-*, lk10a-*, Missionen-Antworten o. ä.) bleibt erhalten. */
  function clearIdentity() {
    clearGates(); lsDel(LS); lsDel(LSC); lsDel(LSG);
    ["sl10a_sess", "inf6_missionen_sitzung", "kf_antw_sess", "m9g_sess", "m9g_portal"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (/^tfgs_sc(_exp)?_/.test(k) || /^tfgs_ok_/.test(k)) localStorage.removeItem(k);
      });
    } catch (e) {}
    try { sessionStorage.removeItem("sl10a_fresh"); sessionStorage.removeItem("slx_skip"); } catch (e) {}
  }
  function dropSession(msg) {
    deckStop(); S.br = null;
    clearIdentity(); S.sess = null; if (window.PortalAufgaben) window.PortalAufgaben.reset(); if (window.PortalWuensche) window.PortalWuensche.reset(); if (window.PortalGlocke) window.PortalGlocke.reset(); if (window.PortalAntworten) window.PortalAntworten.reset(); if (window.PortalMeldungen && window.PortalMeldungen.reset) window.PortalMeldungen.reset(); S.seiten = []; S.kop = {}; S.kopDone = false; S.bestaetigt = false; S.admin = null; S.dash = null; S.sv = null; S.svLk = null; S.dashDetail = ""; S.dashKlasse = ""; S.dashSeite = ""; S.tab = "menue"; S.klasse = ""; S.thema = ""; sfSet(""); fwSet(""); S.dashTyp = ""; S.dashThema = "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    renderLogin(msg || "");
  }
  function logout() {
    /* SEC-20261121 M4: erst die Sitzung auf dem Server beenden (max. 4 s warten), dann lokal abmelden */
    var tok = S.sess && S.sess.token, fertig = false;
    var weiter = function () { if (fertig) return; fertig = true; dropSession("Du bist abgemeldet."); };
    if (!tok) return weiter();
    setTimeout(weiter, 4000);
    try { Promise.resolve(api({ action: "logout", token: tok })).then(weiter, weiter); } catch (e) { weiter(); }
  }
  /* Rücksprung von einer verschlüsselten Seite: ?weiter=<ordner>/<datei> -> nach der Anmeldung dorthin (Schlüssel liegen dann schon im Speicher). */
  function weiterZiel() {
    var m = /[?&]weiter=([^&#]*)/.exec(location.search); if (!m) return "";
    var w; try { w = decodeURIComponent(m[1]); } catch (e) { return ""; }
    var p = /^([a-z0-9][a-z0-9\-]*)\/([A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+)?)?$/.exec(w);
    return p && w.indexOf("..") < 0 ? "../" + w : "";
  }
  function gehWeiter() { var z = weiterZiel(); if (z) { try { history.replaceState(null, "", location.pathname); } catch (e) {} location.replace(z); return true; } return false; }
  /* 09.11.2026: Nichts aus dem Speicher anzeigen, bevor der Server Sitzung + klassengefilterte Liste bestätigt hat (vorher blitzte die
     Liste vom letzten Mal auf – bei geteilten Geräten auch die eines anderen Kontos). Bis dahin nur ein neutraler Ladezustand.
     Der Cache dient nur noch als Offline-Notanzeige und nur für genau dasselbe Konto. */
  function cacheFuer(sess) {
    var c = lsGet(LSC); if (!c || !c.seiten || !sess || !c.benutzer) return null;
    return String(c.benutzer).toLowerCase() === String(sess.benutzer || "").toLowerCase() ? c.seiten : null;
  }
  function renderLaden() {
    app.className = "";
    app.replaceChildren(h("div", { class: "laden", role: "status", "aria-live": "polite" }, h("div", { class: "spin", "aria-hidden": "true" }), h("p", { class: "muted", text: "Deine Seiten werden geladen …" })));
  }
  function boot() {
    var s = lsGet(LS);
    if ((!s || !s.token) && elternSitzung()) { location.replace("/eltern/"); return; }   // 21.11.2026: Eltern-Zugang auf diesem Gerät -> Elternbereich
    if (!s || !s.token) { lsDel(LSC); return renderLogin(""); }
    S.sess = s; S.seiten = []; S.kop = {}; S.bestaetigt = false;
    renderLaden();
    refresh();
  }
  /* 21.11.2026 Elternbereich: Eltern melden sich mit ihrer E-Mail-Adresse an (Schüler-Benutzernamen enthalten nie „@“) und landen unter /eltern/.
     Eigene Sitzung (localStorage kf_eltern_v1), Schüler-Sitzung/-Speicher bleiben unberührt. Nur auf klassefit.de (Backend /api/kf/konto). */
  function elternSitzung() { var e = lsGet("kf_eltern_v1"); return !!(e && e.token); }
  function elternLogin(mail, pw) {
    return fetch("/api/kf/konto", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "eltern_login", login: mail, passwort: pw, geraet: (navigator.userAgent || "").replace(/\(.*?\)/g, "").slice(0, 50) }) })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "Der Elternbereich ist nur auf klassefit.de erreichbar." }; });
  }
  function refresh() {
    if (!S.sess) return;
    api({ action: "sitzung", token: S.sess.token }).then(function (r) {
      if (r.ok) { takePayload(r); if (gehWeiter()) return; render(); kopPruefen(); }
      else if (r.relogin) dropSession("Bitte melde dich neu an.");
      else {
        if (!S.bestaetigt) { var c = cacheFuer(S.sess); S.seiten = c || []; }
        S.offline = true;
        if (S.bestaetigt || S.seiten.length) render(); else renderLogin(r.error || "Keine Verbindung. Bitte Internet prüfen.");
      }
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && S.sess && Date.now() - (S.last || 0) > 300000) { S.last = Date.now(); refresh(); } });
  /* Zurück-Taste / bfcache: ohne gültige Portal-Sitzung im Speicher nicht als alter Nutzer weiterlaufen. */
  window.addEventListener("pageshow", function (ev) {
    var stored = null; try { stored = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
    if (!stored || !stored.token) { if (S.sess) dropSession(""); return; }
    if (S.sess && stored.benutzer && S.sess.benutzer && stored.benutzer !== S.sess.benutzer) location.reload();
    if (ev.persisted && S.sess && stored.token !== S.sess.token) location.reload();
  });

  /* ---------- Ansichten ---------- */
  function renderLogin(msg) {
    var user = h("input", { id: "u", type: "text", autocomplete: "username", autocapitalize: "none", autocorrect: "off", spellcheck: "false", required: true });
    var code = h("input", { id: "c", type: "password", autocomplete: "current-password", autocapitalize: "none", autocorrect: "off", spellcheck: "false", required: true });
    var err = h("div", { class: "err", role: "alert", text: msg || "" });
    var btn = h("button", { class: "btn", type: "submit", text: "Anmelden" });
    var form = h("form", { class: "glass login", onsubmit: function (e) {
      e.preventDefault(); if (!user.value.trim() || !code.value.trim()) return;
      if (user.value.indexOf("@") >= 0) { btn.disabled = true; err.textContent = ""; elternLogin(user.value.trim(), code.value).then(function (r) {
          if (r && r.ok && r.token) { lsSet("kf_eltern_v1", { token: r.token, login: r.profil && r.profil.login }); location.replace("/eltern/"); }
          else { btn.disabled = false; err.textContent = (r && r.error) || "Anmeldung fehlgeschlagen."; code.value = ""; code.focus(); } }); return; }
      btn.disabled = true; err.textContent = ""; S.seiten = []; S.kop = {}; S.kopDone = false; S.thema = ""; S.bestaetigt = false; lsDel(LSC);
      api({ action: "login", user: user.value.trim(), code: code.value, geraet: (navigator.userAgent || "").replace(/\(.*?\)/g, "").slice(0, 50) }).then(function (r) {
        if (r.ok) { sfSet(""); fwSet(""); takePayload(r); S.tab = "menue"; if (gehWeiter()) return; render(); kopPruefen(); }
        else { btn.disabled = false; err.textContent = r.error || "Anmeldung fehlgeschlagen."; code.value = ""; code.focus(); }
      });
    } },
      h("div", { class: "logo kf" }, h("img", { src: "../fp/brand/klassefit-icon.svg", alt: "", width: "76", height: "76" })), h("h1", { class: "kf-wm" }, h("img", { src: "../fp/brand/klassefit-wordmark.svg", alt: "KlasseFit", width: "220", height: "41" })),
      h("p", { class: "sub muted", text: "Melde dich einmal an. Danach bleibst du auf diesem Gerät angemeldet." }),
      h("label", { class: "field" }, h("span", { text: "Benutzername" }), user),
      h("label", { class: "field" }, h("span", { text: "Code" }), code),
      btn, err,
      h("p", { class: "note", text: "Benutzername und Code stehen auf deinem Zettel von Herrn Kurlavičius. Auf fremden Geräten bitte danach abmelden." }),
      h("p", { class: "note", style: "margin-top:6px" }, h("a", { href: "/eltern/", text: "Für Eltern: Elternbereich" })));
    app.replaceChildren(form); user.focus();
  }

  var VORSCHAU_ART = { selbstlernen: 1, mission: 1, karten: 1, test: 1, hausaufgabe: 1 };   // Seiten mit Schüler-Anmeldung/Abgabe: Lehrkraft öffnet sie als Vorschau (?vorschau, nichts wird gespeichert/gesendet)
  function card(s) {
    var f = fachKey(s.fach), isTest = s.art === "test", a = ART[s.art] || ART.material;
    var vor = !!(S.sess && S.sess.rolle === "lehrer" && VORSCHAU_ART[s.art] && okFolder(s.ordner));
    if (S.sv) return svCard(s, vor);
    var setGate = function () {
      if (!(S.gates && S.gates[s.ordner])) return;
      try {
        localStorage.setItem(gateKeyName(s.ordner), S.gates[s.ordner]);
        var bis = (S.sess && S.sess.gateBis) || 0;
        if (bis) localStorage.setItem("tfgs_sc_exp_" + s.ordner, String(bis));
        else localStorage.removeItem("tfgs_sc_exp_" + s.ordner);
      } catch (e) {}
    };
    var normal = vor && h("span", { class: "tag lg", role: "link", tabindex: "0", style: "cursor:pointer", text: "normal öffnen",
      onclick: function (e) { e.preventDefault(); e.stopPropagation(); setGate(); location.href = "../" + s.ordner + "/"; } });
    var tags = h("div", { class: "tags" }, h("span", { class: "tag" + (isTest ? " test" : ""), text: a[0] }), s.eigenerLogin && h("span", { class: "tag lg", text: "eigener Login" }), s.unsichtbarFuerSchueler && h("span", { class: "tag test", text: "(unsichtbar für Schüler)" }), vor && h("span", { class: "tag", text: "👁 Vorschau" }), normal,
      !!(S.sess && S.sess.rolle === "lehrer" && KOP[s.key]) && h("span", { class: "tag" + (S.kop[s.key] === true ? "" : " test"), text: S.kop[s.key] === true ? "🔓 für Schüler freigeschaltet" : (S.kop[s.key] === false ? "🔒 für Schüler gesperrt (unsichtbar)" : "Status wird geprüft …") }));
    var link = h("a", { class: "card glass", href: okFolder(s.ordner) ? "../" + s.ordner + "/" + (vor ? "?vorschau" : "") : "#",
      onclick: setGate },
      h("div", { class: "ico " + (isTest ? "test" : f), text: a[1], "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: s.titel }), s.untertitel && h("div", { class: "s", text: s.untertitel }), tags),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
    return link;
  }
  function groups(list) {
    var by = {}, order = [];
    list.forEach(function (s) { var f = fachKey(s.fach); if (!by[f]) { by[f] = []; order.push(f); } by[f].push(s); });
    var box = h("div", {});
    var tests = list.filter(function (s) { return s.art === "test"; });
    order.forEach(function (f) {
      var items = by[f].filter(function (s) { return s.art !== "test"; }); if (!items.length) return;
      box.appendChild(h("h2", { text: FACH[f] })); box.appendChild(h("div", { class: "list" }, items.map(card)));
    });
    if (tests.length) { box.appendChild(h("h2", { text: "Tests – vom Lehrer freigegeben" })); box.appendChild(h("div", { class: "list" }, tests.map(card))); }
    if (!list.length) box.appendChild(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Für dich sind gerade keine Seiten freigeschaltet." })));
    return box;
  }
  /* ---------- Schüler-Menü nach Themen (07.11.2026) ----------
     Oben: „Meine Lücken“ und „Prüfungsfit“ – nur wenn die Klasse eine passende Seite hat (seit 09.11.2026 sonst ganz unsichtbar).
     Darunter Themen-Kacheln je Fach; ein Thema öffnet alle passenden Seiten gebündelt (Theorie/Folien → Üben/Selbstarbeit → Weiteres).
     Sichtbarkeit kommt unverändert vom Server (Blatt „Seiten“: Klasse, Aktiv, Standard sichtbar, Freigaben) – hier wird nur gruppiert.
     Zuordnung über Titel/Untertitel (keine Ordnernamen im öffentlichen Code); unbekannte Seiten: „Folien X“/„Selbstarbeit X“ → Thema „X“. */
  var HAUPT = [
    { id: "luecken", re: /meine\s+l(ü|ue)cken/i, titel: "Meine Lücken", sub: "Deine wichtigsten Themen – gezielt üben", ico: "🎯" },
    { id: "pruefungsfit", re: /pr(ü|ue)fungsfit/i, titel: "Prüfungsfit", sub: "Training für die Prüfung", ico: "🏁" }];
  var THEMEN = [
    ["aehnlichkeit", "Ähnlichkeit", "📐", /ähnlichkeit/i],
    ["pythagoras", "Satz des Pythagoras", "📏", /pythagoras/i],
    ["trigonometrie", "Trigonometrie", "🔺", /trigonometrie|sinus|kosinus|tangens/i],
    ["pruefungswissen", "Prüfungswissen", "🗂️", /merkkarten|realschulabschluss|diagnosetest/i],
    ["terme", "Terme & binomische Formeln", "🧩", /terme|binomisch/i],
    ["quadratisch", "Quadratische Gleichungen", "📈", /quadratisch/i],
    ["gleichungen", "Gleichungen lösen", "⚖️", /gleichungen/i],
    ["rationale", "Rationale Zahlen", "➗", /rationale\s+zahlen|multiplizieren\s+und\s+dividieren/i],
    ["kommutativ", "Kommutativgesetz", "🔁", /kommutativ/i],
    ["daten", "Bits, Bytes & Sicherheit", "💾", /bits,?\s+bytes/i],          // Informatik 6/7 (10.11.2026) – vor „ordner“, weil dort /missionen/ greift
    ["binaer", "Binärcode, Pixel & Speicher", "🔢", /bin(ä|ae)rcode/i],      // Informatik 8 (10.11.2026)
    ["studium", "Studium", "🎓", /studium\s*:\s*modellierung/i],             // persönliche Studien-Folien, nur Lehrkraft (10.11.2026)
    ["ordner", "Ordner und Dateien", "🗂️", /ordner\s+und\s+dateien|missionen/i],
    ["medien", "Informationen und Medien", "📰", /informationen\s+und\s+medien/i],
    ["klasse", "Klasse & Lernen", "🤝", /klassenregeln|warum\s+lernen|\bki\b/i],
    ["werkzeuge", "Werkzeuge", "🧮", /taschenrechner/i]];
  var ROLLE = { material: [0, "Theorie & Folien"], folien: [0, "Theorie & Folien"], selbstlernen: [1, "Üben & Selbstarbeit"], mission: [1, "Üben & Selbstarbeit"], karten: [1, "Üben & Selbstarbeit"], hausaufgabe: [1, "Üben & Selbstarbeit"], tool: [2, "Weiteres"] };
  function hauptOf(s) { var t = s.titel || ""; for (var i = 0; i < HAUPT.length; i++) if (HAUPT[i].re.test(t)) return HAUPT[i].id; return ""; }
  function themaOf(s) {
    var txt = (s.titel || "") + " · " + (s.untertitel || "");
    for (var i = 0; i < THEMEN.length; i++) if (THEMEN[i][3].test(s.titel || "")) return THEMEN[i];
    for (var j = 0; j < THEMEN.length; j++) if (THEMEN[j][3].test(txt)) return THEMEN[j];
    var base = String(s.titel || "Weitere Seiten").replace(/^(folien|selbstarbeit|selbstlernen|wiederholung|übungen|uebungen)\s+/i, "").replace(/\s*\(.*?\)\s*$/, "").trim() || "Weitere Seiten";
    return ["t-" + base.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-"), base, "📘", null];
  }
  function themenListe(list) {   // [{id,titel,ico,fach,sort,seiten:[]}] in Sortierreihenfolge
    var by = {}, out = [];
    list.forEach(function (s) { var t = themaOf(s), f = fachKey(s.fach), k = f + "|" + t[0];
      if (!by[k]) { by[k] = { id: k, titel: t[1], ico: t[2], fach: f, sort: 1e9, seiten: [] }; out.push(by[k]); }
      by[k].seiten.push(s); by[k].sort = Math.min(by[k].sort, +s.sort || 0); });
    out.forEach(function (t) { t.seiten.sort(function (a, b) { return ((ROLLE[a.art] || [3])[0] - (ROLLE[b.art] || [3])[0]) || ((+a.sort || 0) - (+b.sort || 0)); }); });
    var spaet = function (t) { return /\|werkzeuge$/.test(t.id) ? 1 : 0; };   // Werkzeuge (Taschenrechner) ans Ende
    out.sort(function (a, b) { return (spaet(a) - spaet(b)) || (a.sort - b.sort); });
    return out;
  }
  /* 09.11.2026 (t18u): Karten nur, wenn die Klasse wirklich eine passende Seite hat – sonst ganz weg (nicht ausgegraut). */
  function hauptKarten(all) {
    var cards = HAUPT.map(function (m) {
      var s = all.filter(function (x) { return hauptOf(x) === m.id && x.art !== "test"; })[0];
      if (s) { var c = card(s); c.classList.add("hauptcard"); c.setAttribute("data-haupt", m.id); var ic = c.querySelector(".ico"); if (ic) { ic.textContent = m.ico; ic.className = "ico haupt-" + m.id; } return c; }
      return null;
    }).filter(Boolean);
    return cards.length ? h("div", { class: "list haupt" }, cards) : null;
  }
  function immerDabei(all) { var k = hauptKarten(all); return k ? [h("h2", { text: "Immer dabei" }), k] : []; }
  function themaKarte(t) {
    var arten = {}; t.seiten.forEach(function (s) { arten[(ROLLE[s.art] || [3, "Weiteres"])[1]] = 1; });
    return h("a", { class: "card glass themacard", href: "#", "data-thema": t.id, onclick: function (e) { e.preventDefault(); oeffneThema(t.id); } },
      h("div", { class: "ico " + t.fach, text: t.ico, "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: t.titel }), h("div", { class: "s", text: t.seiten.length + (t.seiten.length === 1 ? " Seite" : " Seiten") + " · " + Object.keys(arten).join(" · ") })),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
  }
  function oeffneThema(id) {
    S.thema = id; render(); try { window.scrollTo(0, 0); } catch (e) {}
    if (window.KFZurueck) window.KFZurueck.push(function () { S.thema = ""; render(); });
  }
  function schliesseThema() { if (window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } S.thema = ""; render(); }
  /* ---------- Hausaufgaben (09.11.2026) ----------
     Eine Seite gilt als Hausaufgabe, wenn im Blatt „Seiten“ Art = „hausaufgabe“ ist ODER der Titel mit „Hausaufgabe“ beginnt.
     Klassen/Sichtbarkeit wie bei allen Seiten (Server). Reihenfolge: offene zuerst, neueste (höchste „Sortierung“) oben; die oberste offene = „Aktuell“.
     Fälligkeit optional im Untertitel oder Titel: „bis 13.11.“, „bis Fr 13.11.2026“, „fällig am 13.11.“ (nach dem Tag gilt sie als „früher“). */
  var WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function isHA(s) { return s && s.art !== "test" && (String(s.art || "").toLowerCase() === "hausaufgabe" || /^\s*hausaufgabe/i.test(s.titel || "")); }
  function haFaellig(s) {
    var m = /(?:bis|f(?:ä|ae)llig(?:\s+am)?|abgabe(?:\s+am)?)\s*(?:(?:mo|di|mi|do|fr|sa|so)\.?,?\s*)?(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?/i.exec((s.untertitel || "") + " " + (s.titel || ""));
    if (!m) return null;
    var now = new Date(), y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear(), d = new Date(y, +m[2] - 1, +m[1], 23, 59, 59);
    if (!m[3] && d.getTime() < now.getTime() - 200 * 864e5) d.setFullYear(y + 1);
    return isNaN(d.getTime()) ? null : d;
  }
  function haListe(list) {   // [{s, due, offen, aktuell}]
    var now = Date.now(), out = list.filter(isHA).map(function (s) { var d = haFaellig(s); return { s: s, due: d, offen: !d || d.getTime() >= now }; });
    out.sort(function (a, b) { return (b.offen - a.offen) || ((+b.s.sort || 0) - (+a.s.sort || 0)); });
    if (out.length && out[0].offen) out[0].aktuell = true;
    return out;
  }
  function dueTxt(d) { return d ? "bis " + WT[d.getDay()] + " " + ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." : ""; }
  function haKarte(x) {
    var c = card(x.s); c.classList.add("hacard"); if (x.aktuell) c.classList.add("aktuell"); if (!x.offen) c.classList.add("frueher");
    var tags = c.querySelector(".tags"), lab = x.aktuell ? "⭐ Aktuell" : (x.offen ? "offen" : "frühere Hausaufgabe");
    if (tags) { tags.insertBefore(h("span", { class: "tag ha-badge" + (x.aktuell ? " akt" : x.offen ? "" : " alt"), text: lab }), tags.firstChild); if (x.due) tags.appendChild(h("span", { class: "tag ha-due", text: "📅 " + dueTxt(x.due) })); }
    if (S.sess && S.sess.rolle === "lehrer") { var t = c.querySelector(".t"); if (t && x.s.klassen) t.appendChild(h("span", { class: "chip", style: "margin-left:6px", text: (x.s.klassen || []).join(", ") })); }
    return c;
  }
  function haHauptKarte(all) {
    var l = haListe(all), akt = l.filter(function (x) { return x.aktuell; })[0], n = l.filter(function (x) { return x.offen; }).length;
    var sub = akt ? "Aktuell: " + akt.s.titel + (akt.due ? " · " + dueTxt(akt.due) : "") : (l.length ? "Keine offene Hausaufgabe – frühere findest du hier." : "Gerade keine Hausaufgaben – schön!");
    return h("a", { class: "card glass hauptcard ha-haupt" + (akt ? " hat-akt" : ""), href: "#", "data-haupt": "hausaufgaben", onclick: function (e) { e.preventDefault(); oeffneThema("__ha"); } },
      h("div", { class: "ico haupt-ha", text: "📝", "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: "Hausaufgaben" }), h("div", { class: "s", text: sub }), h("div", { class: "tags" }, n ? h("span", { class: "tag ha-badge akt", text: n + " offen" }) : null)),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
  }
  function haAnsicht(all, zurueck) {
    var box = h("div", { class: "smenu" }), l = haListe(all);
    box.appendChild(h("div", { class: "thema-kopf" }, zurueck ? h("button", { class: "btn ghost small", text: zurueck, onclick: schliesseThema }) : null, h("h2", { class: "thema-titel", text: "📝 Hausaufgaben" })));
    if (!l.length) { box.appendChild(h("div", { class: "glass empty" }, h("p", { text: "🎉 Gerade keine Hausaufgaben." }), h("p", { class: "muted", text: "Sobald dein Lehrer eine Hausaufgabe freischaltet, erscheint sie hier ganz oben." }))); return box; }
    var offen = l.filter(function (x) { return x.offen; }), alt = l.filter(function (x) { return !x.offen; });
    if (offen.length) { box.appendChild(h("h2", { text: "Offen" })); box.appendChild(h("div", { class: "list" }, offen.map(haKarte))); }
    else box.appendChild(h("div", { class: "glass empty" }, h("p", { text: "✅ Keine offene Hausaufgabe." })));
    if (alt.length) { box.appendChild(h("h2", { text: "Frühere Hausaufgaben" })); box.appendChild(h("div", { class: "list" }, alt.map(haKarte))); }
    return box;
  }
  function teacherHA() {
    var list = S.seiten.filter(function (s) { return inForm(s) && isHA(s) && (!S.klasse || (s.klassen || []).indexOf(S.klasse) >= 0); });
    var box = h("div", {}, wahlLeiste(bereichSel(), klasseSel(klassenNamen(), S.klasse, function (k) { S.klasse = k; render(); })));
    var kl = {}; list.forEach(function (s) { (s.klassen || []).forEach(function (k) { if (k && k !== "*" && (!S.klasse || k === S.klasse)) (kl[k] = kl[k] || []).push(s); }); });
    var ks = Object.keys(kl).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); });
    if (!ks.length) box.appendChild(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Keine Hausaufgaben für diese Auswahl. Neue Hausaufgabe: Seite im Blatt „Seiten“ mit Titel „Hausaufgabe …“ (oder Art „hausaufgabe“), Fälligkeit optional im Untertitel („bis 13.11.“)." })));
    ks.forEach(function (k) { box.appendChild(h("h2", { text: "Klasse " + k })); box.appendChild(h("div", { class: "list" }, haListe(kl[k]).map(haKarte))); });
    return box;
  }
  /* ---------- Klassenstufen-Wahl (13.11.2026) ----------
     Nur für Schüler, deren sichtbare Seiten zu MEHR als einer Jahrgangsstufe gehören (z. B. 7a mit persönlich freigeschalteten 10a-Materialien):
     oben ein Drop-down „Klasse 7 / Klasse 10“, darunter nur die Seiten dieser Stufe (Themen, Folien, Übungen, Hausaufgaben, Tests, Prüfungsfit/Lücken).
     Alle anderen Schüler (eine Stufe): kein Drop-down, Menü genau wie vorher.
     Zuordnungsregel je Seite (Stufe = führende Zahl der Klasse, „10a“ → 10; eigene Klasse K mit Stufe g):
       1. Stehen in „Klassen“ nur Klassen der Stufe g (oder „*“/leer) → Stufe g.
       2. Teilt K die Seite mit einer anderen Klasse derselben Stufe g (z. B. 6a+6b) → Stufe g (echte gemeinsame Seite).
       3. Sonst Zahl im Key-Präfix (mathe10-… → 10, mathe7-… → 7, mathe8g-… → 8): ist sie HÖHER als g und steht eine Klasse dieser Stufe
          in der Liste, gehört die Seite zu dieser Stufe (K steht dort nur technisch für die Sichtbarkeit, Freigabe läuft über @benutzer).
          Präfix = g oder niedriger → Stufe g (z. B. informatik6-… für 7b bleibt bei 7).
       4. Ohne Zahl im Key (z. B. Prüfungsfit): genau EINE andere, höhere Stufe in der Liste UND diese Stufe ist schon über Regel 3 belegt → diese Stufe; sonst g.
     Seiten mit „unsichtbar für Schüler“ (nur Testkonten) bleiben immer bei Stufe g – Testkonten zeigen das normale Klassenmenü.
     Die Sichtbarkeit selbst kommt unverändert vom Server; hier wird nur sortiert. Gemerkt wird die zuletzt gewählte Stufe im NEUEN Schlüssel
     „kf_portal_stufe_v1“ ({u: benutzer, s: stufe}); bestehende Schlüssel bleiben unberührt. Lehrer-Schülersicht: gleiche Regel, nichts gespeichert. */
  var LS_STUFE = "kf_portal_stufe_v1";
  function stufeVon(k) { var m = /^(\d{1,2})/.exec(String(k || "")); return m ? +m[1] : 0; }
  function seitenStufen(all, eigene) {   // → { key: stufe }
    var g = stufeVon(eigene), ek = String(eigene || "").toLowerCase(), out = {}, offen = [], belegt = {};
    all.forEach(function (s) {
      out[s.key] = g; if (!g || s.unsichtbarFuerSchueler) return;   // Testkonten: für die Klasse gesperrte Seiten bleiben bei der eigenen Stufe (Testkonto = normales Klassenmitglied)
      var kl = (s.klassen || []).map(function (x) { return String(x).toLowerCase(); }).filter(function (x) { return x && x !== "*"; });
      var andere = kl.filter(function (x) { return stufeVon(x) !== g; });
      if (!andere.length || kl.indexOf(ek) < 0 || kl.filter(function (x) { return stufeVon(x) === g; }).length !== 1) return;
      var m = /^[a-zäöü]+?(\d{1,2})(?=[a-z]?(?:-|$))/i.exec(String(s.key || "")), n = m ? +m[1] : 0;
      if (n) { if (n > g && andere.some(function (x) { return stufeVon(x) === n; })) { out[s.key] = n; belegt[n] = 1; } return; }
      var hs = {}; andere.forEach(function (x) { hs[stufeVon(x)] = 1; }); hs = Object.keys(hs).map(Number);
      if (hs.length === 1 && hs[0] > g) offen.push([s.key, hs[0]]);
    });
    offen.forEach(function (x) { if (belegt[x[1]]) out[x[0]] = x[1]; });
    return out;
  }
  /* all = sichtbare Seiten, eigene = Klasse des Kontos; get/set = gewählte Stufe (Schüler: localStorage, Schülersicht: nur Speicher) */
  function stufenMenu(all, eigene, get, set) {
    var map = seitenStufen(all, eigene), g = stufeVon(eigene), st = {};
    all.forEach(function (s) { st[map[s.key]] = 1; });
    var stufen = Object.keys(st).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
    if (stufen.length < 2) return studentMenu(all);
    var cur = +get() || g; if (stufen.indexOf(cur) < 0) cur = stufen.indexOf(g) >= 0 ? g : stufen[0];
    var box = studentMenu(all.filter(function (s) { return map[s.key] === cur; }));
    var wahl = wahlLeiste(wahlSel("Klasse", "wsel-stufe", stufen.map(function (n) { return [String(n), "Klasse " + n]; }), String(cur), function (v) {
      if (+v === cur) return; set(+v);
      if (S.thema) { if (window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } S.thema = ""; }
      render(); try { window.scrollTo(0, 0); } catch (e) {} }));
    wahl.classList.add("stufenwahl"); box.insertBefore(wahl, box.firstChild);
    return box;
  }
  function eigeneStufeGet() { var v = lsGet(LS_STUFE); return v && S.sess && String(v.u || "").toLowerCase() === String(S.sess.benutzer || "").toLowerCase() ? v.s : 0; }
  function eigeneStufeSet(n) { if (S.sess) lsSet(LS_STUFE, { u: S.sess.benutzer, s: n }); }
  function studentMenu(all) {
    var box = h("div", { class: "smenu" });
    if (S.thema === "__ha") { var hb = haAnsicht(all, "‹ Zurück"); immerDabei(all).forEach(function (x) { hb.appendChild(x); }); return hb; }
    var rest = all.filter(function (s) { return s.art !== "test" && !hauptOf(s) && !isHA(s); });
    var tests = all.filter(function (s) { return s.art === "test"; });
    var themen = themenListe(rest);
    var offen = S.thema && themen.filter(function (t) { return t.id === S.thema; })[0];
    if (S.thema && !offen) S.thema = "";
    if (offen) {
      box.appendChild(h("div", { class: "thema-kopf" }, h("button", { class: "btn ghost small", text: "‹ Alle Themen", onclick: schliesseThema }), h("h2", { class: "thema-titel", text: offen.ico + " " + offen.titel })));
      var grp = {}, ord = [];
      offen.seiten.forEach(function (s) { var r = (ROLLE[s.art] || [3, "Weiteres"])[1]; if (!grp[r]) { grp[r] = []; ord.push(r); } grp[r].push(s); });
      ord.forEach(function (r) { box.appendChild(h("h2", { text: r })); box.appendChild(h("div", { class: "list" }, grp[r].map(card))); });
      immerDabei(all).forEach(function (x) { box.appendChild(x); });
      return box;
    }
    if (S.sess && S.sess.rolle !== "lehrer" && window.KFStand) {
      var standWrap = h("div", { id: "kfStandPortal" });
      box.appendChild(standWrap);
      try { KFStand.mountPortal(standWrap, { api: api, token: function () { return S.sess && S.sess.token; }, sess: S.sess, themen: themen.map(function (t) { return { id: t.id, name: t.titel }; }) }); } catch (e) {}
    }
    box.appendChild(h("h2", { text: "Schnellzugriff" })); box.appendChild(h("div", { class: "list haupt" }, haHauptKarte(all))); var hk = hauptKarten(all); if (hk) box.appendChild(hk);
    var fo = [], byF = {}; themen.forEach(function (t) { if (!byF[t.fach]) { byF[t.fach] = []; fo.push(t.fach); } byF[t.fach].push(t); });
    fo.forEach(function (f) { box.appendChild(h("h2", { text: "Themen · " + FACH[f] })); box.appendChild(h("div", { class: "list" }, byF[f].map(function (t) { return t.seiten.length === 1 ? card(t.seiten[0]) : themaKarte(t); }))); });   // 12.11.2026: Thema mit nur einer Seite → direkt die Seite (keine Zwischenebene)
    if (tests.length) { box.appendChild(h("h2", { text: "Tests – vom Lehrer freigegeben" })); box.appendChild(h("div", { class: "list" }, tests.map(card))); }
    if (!all.length) box.appendChild(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Für dich sind gerade keine Seiten freigeschaltet." })));
    return box;
  }
  /* Portal-Kopf: Start immer, Zurück eine Ebene (PWA ohne Browser-Chrom). history.back() hier nie – sonst about:blank. */
  function canPortalBack() {
    if (!S.sess) return false;
    if (briefingId()) return true;
    if (S.sess.rolle === "lehrer") {
      if (S.sv) return true;
      if (S.lthema) return true;
      if (S.tab !== "menue") return true;
      if (!S.schulform) return false;
      return true;                       // Themenliste → Bereichswahl (Fach/Klasse sind seit 12.11.2026 Drop-downs, keine eigene Ebene)
    }
    return !!S.thema;                    // Schüler: Thema oder Hausaufgaben (__ha)
  }
  /* Start = echte Startseite (10.11.2026, t34u): Lehrkraft → Bereichswahl (wie nach dem Login, ohne Abmelden), Schüler → „Meine Seiten“.
     Bereich/Fach werden auch im sessionStorage gelöscht, damit nichts die alte Wahl sofort wiederherstellt. */
  function goPortalStart() {
    if (!S.sess) return;
    if (briefingId()) {
      deckStop();
      try { history.pushState(null, "", location.pathname + location.search); } catch (e) { try { location.hash = ""; } catch (e2) {} }
    }
    if (window.KFZurueck) { try { window.KFZurueck.clear(); } catch (e) {} }
    S.thema = ""; S.lthema = ""; S.fthema = ""; S.sv = null;
    if (S.sess.rolle === "lehrer") {
      S.tab = "menue"; sfSet(""); fwSet(""); S.klasse = ""; S.dashKlasse = ""; S.dashSeite = ""; S.dashDetail = "";
      var n = { gym: 0, sek: 0 }; S.seiten.forEach(function (s) { n[formOfPage(s)]++; });
      if (n.gym && !n.sek) sfSet("gym"); else if (n.sek && !n.gym) sfSet("sek");   // nur ein Bereich → nächste Ebene (Fachwahl bzw. einziges Fach)
    }
    render();
    try { window.scrollTo(0, 0); } catch (e) {}
    try { var f = document.querySelector(".top h1"); if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); } } catch (e) {}
  }
  function goPortalBack() {
    if (!S.sess || !canPortalBack()) return;
    if (briefingId()) { leaveBriefing(); return; }
    if (S.sess.rolle === "lehrer") {
      if (S.sv) { if (S.thema) schliesseThema(); else svBeenden(); return; }
      if (S.lthema) { schliesseThemaT(); return; }
      if (S.tab === "freigaben" && S.admin) {   // Freigaben: Thema → Fach → Seiten-Tab
        var tf = {}; S.admin.seiten.forEach(function (s) { if (s.art === "test" && inForm(s)) tf[fachWahlOf(s)] = 1; });
        var nT = 0; if (S.fthema) S.admin.seiten.forEach(function (s) { if (s.art === "test" && inForm(s) && fachWahlOf(s) === S.fach) { var id = freigThema(s).id; if (!tf["t:" + id]) { tf["t:" + id] = 1; nT++; } } });
        if (S.fthema && nT > 1) { S.fthema = ""; render(); try { window.scrollTo(0, 0); } catch (e) {} return; }
      }
      if (S.tab !== "menue") { S.tab = "menue"; S.fthema = ""; render(); try { window.scrollTo(0, 0); } catch (e) {} return; }
      sfSet(""); fwSet(""); S.klasse = ""; S.dashKlasse = ""; S.dashSeite = ""; render(); try { window.scrollTo(0, 0); } catch (e) {}
      return;
    }
    if (S.thema) schliesseThema();
  }
  function header() {
    var s = S.sess, lehrer = s.rolle === "lehrer", showBack = canPortalBack();
    return h("div", { class: "top" },
      h("div", { class: "top-main" },
        h("div", { class: "navrow", role: "navigation", "aria-label": "Portal-Navigation" },
          showBack ? h("button", { type: "button", class: "btn ghost small nav-back", onclick: goPortalBack, "aria-label": "Zurück", text: "← Zurück" }) : null,
          h("button", { type: "button", class: "btn ghost small nav-start", onclick: goPortalStart, "aria-label": "Start – Übersicht", text: "⌂ Start" })),
        h("div", { class: "hello angemeldet", title: "Du bleibst angemeldet, bis du auf „Abmelden“ tippst." }, h("span", { class: "als", text: "👤 Angemeldet als " }), h("b", { class: "wer", text: s.name || s.benutzer || "" }), !lehrer && s.klasse && h("span", { class: "chip", text: "Klasse " + s.klasse }), lehrer && h("span", { class: "chip", text: "Lehrkraft" })),
        h("h1", { text: lehrer && S.sv ? "Meine Seiten" : lehrer ? (S.schulform === "gym" ? "Gymnasium" : S.schulform === "sek" ? "Sekundarschule" : "Bereich wählen") : "Meine Seiten" })),
      h("div", { class: "acts" }, lehrer ? glockeButton() : null, wunschButton(), h("button", { class: "btn ghost", onclick: logout, "aria-label": "Abmelden", text: "Abmelden" })));
  }
  function wunschCtx() { return { api: api, token: function () { return S.sess && S.sess.token; }, sess: function () { return S.sess; }, info: function () { return S.sess && S.sess.wuensche; }, seiten: function () { return S.seiten.filter(kopSichtbar); }, render: function () { if (S.tab === "wuensche") render(); }, relogin: function () { dropSession("Bitte melde dich neu an."); } }; }
  /* 10.11.2026: Glocke (neue Schülerfragen/Meldungen) – glocke.js */
  function glockeButton() {
    if (!window.PortalGlocke) return null;
    return window.PortalGlocke.button(h, { api: api, token: function () { return S.sess && S.sess.token; }, sess: function () { return S.sess; },
      relogin: function () { dropSession("Bitte melde dich neu an."); },
      openTab: function (t) { if (!S.schulform) { S.schulform = "sek"; try { sfSet("sek"); } catch (e) {} } S.tab = t; if (t === "dash" && typeof loadDash === "function" && !S.dash) loadDash(false); render(); try { window.scrollTo(0, 0); } catch (e) {} } });
  }
  function wunschButton() { return window.PortalWuensche ? window.PortalWuensche.button(h, wunschCtx()) : null;
  }

  /* Hinweis 6b: neue Grundlagen-Missionen (20.11.–21.11.2026, nur Schüler 6b, frontend-only). */
  var KF_GRUND_POP = { from: "2026-11-20", until: "2026-11-21", href: "/informatik6-missionen-grundlagen/", ls: "kf_popup_6b_grundlagen_tag", ss: "kf_popup_6b_grundlagen_shown" };
  function kfBerlinYmd(override) {
    if (override) return String(override);
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { var d = new Date(); var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), da = String(d.getDate()).padStart(2,"0"); return y+"-"+m+"-"+da; }
  }
  function kfGrundlagenPopupShouldShow(opts) {
    opts = opts || {};
    var sess = opts.sess, today = kfBerlinYmd(opts.today || (typeof window !== "undefined" && window.KF_POPUP_TODAY) || null);
    if (!sess || sess.rolle === "lehrer") return false;
    if (String(sess.klasse || "").toLowerCase() !== "6b") return false;
    if (today < KF_GRUND_POP.from || today > KF_GRUND_POP.until) return false;
    try { if (localStorage.getItem(KF_GRUND_POP.ls) === today) return false; } catch (e) {}
    try { if (sessionStorage.getItem(KF_GRUND_POP.ss) === today) return false; } catch (e2) {}
    return true;
  }
  function kfGrundlagenPopupDismiss(foreverToday) {
    var today = kfBerlinYmd((typeof window !== "undefined" && window.KF_POPUP_TODAY) || null);
    try { sessionStorage.setItem(KF_GRUND_POP.ss, today); } catch (e) {}
    if (foreverToday) { try { localStorage.setItem(KF_GRUND_POP.ls, today); } catch (e2) {} }
    var el = document.getElementById("kfGrundPop"); if (el) el.remove();
  }
  function maybe6bGrundlagenPopup() {
    if (document.getElementById("kfGrundPop")) return;
    if (!kfGrundlagenPopupShouldShow({ sess: S.sess })) return;
    var today = kfBerlinYmd((typeof window !== "undefined" && window.KF_POPUP_TODAY) || null);
    try { sessionStorage.setItem(KF_GRUND_POP.ss, today); } catch (e) {}
    var wrap = document.createElement("div");
    wrap.id = "kfGrundPop";
    wrap.className = "kf-grund-pop";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "kfGrundPopTitel");
    wrap.innerHTML = '<div class="kf-grund-pop-card">'
      + '<button type="button" class="kf-grund-pop-x" aria-label="Schließen">×</button>'
      + '<h2 id="kfGrundPopTitel">Neue Missionen für den 20.11.</h2>'
      + '<p>Für Informatik 6b gibt es neue Missionen: <b>Ordner und Dateien – Grundlagen</b>. Dort übst du Ordner, Pfade, Kopieren und Verschieben.</p>'
      + '<p>Engagement und aktive Mitarbeit fließen in die Mitarbeitsnote ein. Dinge, die nichts mit dem Unterricht zu tun haben (zum Beispiel Spielen oder ständiges Fensterwechseln), wirken sich negativ aus.</p>'
      + '<div class="kf-grund-pop-btns">'
      + '<a class="kf-grund-pop-go" href="' + KF_GRUND_POP.href + '">Zu den Missionen</a>'
      + '<button type="button" class="kf-grund-pop-ok">Verstanden</button>'
      + '</div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector(".kf-grund-pop-x").addEventListener("click", function () { kfGrundlagenPopupDismiss(false); });
    wrap.querySelector(".kf-grund-pop-ok").addEventListener("click", function () { kfGrundlagenPopupDismiss(true); });
    wrap.querySelector(".kf-grund-pop-go").addEventListener("click", function () { kfGrundlagenPopupDismiss(true); });
  }
  window.kfGrundlagenPopupShouldShow = kfGrundlagenPopupShouldShow;
  window.kfBerlinYmd = kfBerlinYmd;

  function render() {
    if (!S.sess) return renderLogin("");
    tabFromHash();
    var bid = briefingId();
    if (bid) return S.sess.rolle === "lehrer" ? showBriefing(bid) : briefingDenied();
    deckStop();
    app.className = (S.sess.rolle === "lehrer" && S.tab === "dash") ? "wide" : "";
    var kids = [header()];
    if (S.offline) kids.push(h("div", { class: "banner", text: "Offline – Anzeige vom letzten Mal. Zum Öffnen der Seiten brauchst du Internet." }));
    if (S.sess.rolle === "lehrer" && S.sv) { kids.push.apply(kids, schuelersichtView()); app.replaceChildren.apply(app, kids); return; }
    if (S.sess.rolle === "lehrer" && !S.schulform) kids.push(schulformWahl()); else if (S.sess.rolle === "lehrer") kids.push(teacherTabs()); else { var antw = window.PortalAntworten ? window.PortalAntworten.view(h, S.sess, function () { if (S.sess && S.sess.rolle !== "lehrer") render(); }) : null; if (antw) kids.push(antw); kids.push(stufenMenu(S.seiten.filter(kopSichtbar).filter(eigeneKlasse), S.sess.klasse, eigeneStufeGet, eigeneStufeSet)); }
    app.replaceChildren.apply(app, kids);
    maybe6bGrundlagenPopup();
  }

/* ---------- Briefings als Lernfolien (nur Lehrkraft) ----------
   Liste (Tab "Briefings") und Folien-Ansicht (#/briefing/<id>): Inhalt kommt erst nach dem Lehrer-Login vom Backend (briefing_list / briefing_open),
   der Renderer (briefing.js/.css) wird erst dann nachgeladen. Das Öffnen der Liste öffnet kein Briefing; erst der Klick auf einen Eintrag (=erster Aufruf,
   startet die 60 Minuten). Im öffentlichen Code steht kein Briefing-Inhalt. */
  var BR_RE = /^#\/briefing\/([a-f0-9]{8,40})$/;
  function briefingId() { var m = BR_RE.exec(location.hash || ""); return m ? m[1] : ""; }
  function deckStop() { if (S.deckCtl) { try { S.deckCtl.destroy(); } catch (e) {} } S.deckCtl = null; S.deckId = ""; }
  function loadBriefingLib() {
    if (window.PortalBriefing) return Promise.resolve();
    return new Promise(function (ok, no) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "briefing.css"; document.head.appendChild(l);
      var sc = document.createElement("script"); sc.src = "briefing.js"; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc);
    });
  }
  function leaveBriefingCore() { deckStop(); try { history.pushState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; } S.tab = "briefings"; loadBriefings(); render(); }
  function leaveBriefing() { if (window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } leaveBriefingCore(); }
  function showBriefing(id) {
    if (S.deckId === id) return;   // schon geöffnet oder wird gerade geladen (z. B. Sitzungs-Auffrischung): nicht neu laden/öffnen
    deckStop(); S.deckId = id; app.className = "deckmode";
    app.replaceChildren(h("div", { class: "spin", "aria-label": "Folien werden geladen" }));
    loadBriefingLib().then(function () {
      if (S.deckId !== id || !S.sess) return;
      S.deckCtl = window.PortalBriefing.mount(app, { id: id, token: S.sess.token, api: api, onExit: leaveBriefing, onRelogin: function () { dropSession("Bitte melde dich neu an."); } });
      if (window.KFZurueck) window.KFZurueck.push(leaveBriefingCore);
    }, function () { if (S.deckId === id) { app.replaceChildren(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Die Folien-Ansicht konnte nicht geladen werden (keine Verbindung?)." }), h("div", { style: "margin-top:12px" }, h("button", { class: "btn small", text: "Zurück", onclick: leaveBriefing })))); } });
  }
  function briefingDenied() {
    deckStop(); app.className = "";
    app.replaceChildren(h("div", { class: "glass empty", style: "margin-top:20vh" }, h("p", { text: "Kein Zugriff." }), h("div", { style: "margin-top:12px" }, h("button", { class: "btn small", text: "Zum Portal", onclick: function () { try { history.pushState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; } render(); } }))));
  }
  function tabFromHash() { if (location.hash === "#/briefings" && S.sess && S.sess.rolle === "lehrer" && S.tab !== "briefings") { S.tab = "briefings"; loadBriefings(); } }
  window.addEventListener("hashchange", function () { tabFromHash(); if (S.sess) render(); });
  function loadBriefings() {
    if (!S.sess || S.brLoading) return;
    S.brLoading = true; S.brErr = ""; if (S.tab === "briefings" && !briefingId()) render();
    api({ action: "briefing_list", token: S.sess.token }).then(function (r) {
      S.brLoading = false;
      if (r.ok) S.br = r; else if (r.relogin) return dropSession("Bitte melde dich neu an."); else S.brErr = r.error === "unbekannte Aktion" ? "Das Backend kennt Briefings noch nicht (neue Code.gs-Version fehlt, siehe DEPLOY-briefing.md)." : (r.error || "Konnte nicht geladen werden.");
      if (S.tab === "briefings" && !briefingId()) render();
    });
  }
  function brLabel(b) {
    var m;
    if (b.typ === "weekly") { m = /^(\d{4})-W(\d{2})$/.exec(b.periodKey); return "Wochenbriefing · KW " + (m ? +m[2] + " / " + m[1] : b.periodKey); }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.periodKey);
    return (b.typ === "afternoon" ? "Nachmittagsbriefing · " : "Tagesbriefing · ") + (m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : b.periodKey);
  }
  function aufgabenView() { return window.PortalAufgaben ? window.PortalAufgaben.view(h, { api: api, token: function () { return S.sess.token; }, render: function () { if (S.tab === "briefings" && !briefingId()) render(); }, relogin: function () { dropSession("Bitte melde dich neu an."); } }) : null; }
  function teacherBriefings() { return h("div", {}, aufgabenView(), teacherBriefingsList()); }
  function teacherBriefingsList() {
    if (!S.br) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: S.brErr || "Lade …" }), S.brErr ? h("div", { style: "margin-top:12px" }, h("button", { class: "btn small", text: "Erneut versuchen", onclick: loadBriefings })) : null);
    var list = S.br.briefings || [], now = Date.now();
    return h("div", {},
      h("p", { class: "note", text: "Briefings als Lernfolien. Die Folien löschen sich 60 Minuten nach dem ersten Öffnen; nie geöffnete verfallen nach 7 (Tag/Nachmittag) bzw. 14 (Woche) Tagen. Ein Klick öffnet das Briefing und startet die Uhr." }),
      h("div", { class: "list" }, list.map(function (b) {
        var st = b.status === "geoeffnet" ? "geöffnet · noch " + (b.minLeft != null ? b.minLeft : "?") + " Min." : "neu · nicht geöffnet · verfällt " + new Date(b.loeschenAb).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
        return h("a", { class: "card glass", href: "#/briefing/" + b.id },
          h("div", { class: "ico " + (b.typ === "weekly" ? "informatik" : "mathe"), text: b.typ === "weekly" ? "🗂️" : b.typ === "afternoon" ? "🌤️" : "🗓️", "aria-hidden": "true" }),
          h("div", {}, h("div", { class: "t", text: brLabel(b) }), h("div", { class: "s", text: st }), h("div", { class: "tags" }, h("span", { class: "tag" + (b.status === "neu" ? " test" : ""), text: b.status === "neu" ? "Neu" : "Offen" }))),
          h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
      })), !list.length ? h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Keine aktiven Briefings. Das nächste erscheint mit dem nächsten Tages-, Nachmittags- oder Wochenbriefing." })) : null,
      h("div", { style: "margin-top:12px" }, h("button", { class: "btn ghost small", text: "↻ Aktualisieren", onclick: loadBriefings })));
  }

  /* ---------- Schülersicht (12.11.2026, Paulius t81u) ----------
     Lehrkraft sieht die Schüler-Startseite GENAU wie ein bestimmter Schüler – ohne dessen Login/Token. Nur lesen:
     Sichtbarkeit wie im Backend (seiten_: Seite aktiv · Klasse passt oder „*“ · Freigabe @benutzer vor Klassen-Freigabe vor „Standard sichtbar“, abgelaufene Freigaben = aus),
     Daten aus admin_uebersicht (Konten, Freigaben), admin_fortschritt (Fortschritt) und admin_luecken (Lücken 10a). Karten öffnen die Lehrer-Vorschau (?vorschau, Tests mit
     &gruppe= der letzten Abgabe). Nichts wird an das Backend geschrieben, kein Schüler-Speicher (localStorage) wird gelesen oder geändert, keine Melde-Aufrufe. */
  function svKonten() { return ((S.admin && S.admin.konten) || []).filter(function (k) { return k.rolle !== "lehrer" && k.rolle !== "test" && !/^test[._]/i.test(k.benutzer) && k.aktiv !== false && k.klasse; }); }
  function svFrei(s, k) {
    var now = Date.now(), f, fu; ((S.admin && S.admin.freigaben) || []).forEach(function (x) {
      var kk = String(x.klasse || "").toLowerCase(), ok = !!x.aktiv && !(x.bis && now > x.bis); if (x.seite !== s.key) return;
      if (kk === "@" + String(k.benutzer).toLowerCase()) fu = ok; else if (kk === String(k.klasse).toLowerCase()) f = ok; });
    return fu !== undefined ? fu : (f !== undefined ? f : !!s.standardSichtbar);
  }
  function svSeiten() {
    var k = S.sv, kl = String(k.klasse).toLowerCase();
    return S.seiten.filter(function (s) { var l = (s.klassen || []).map(function (x) { return String(x).toLowerCase(); }); return (l.indexOf(kl) >= 0 || l.indexOf("*") >= 0) && svFrei(s, k); }).filter(kopSichtbar);
  }
  function svZelle(key) {   // Fortschritt des Schülers auf einer Seite (wie Dashboard: gesamt/ergebnis, sonst Ø der Themen)
    var d = S.dash, z = d && d.zellen && d.zellen[S.sv.benutzer]; if (!z) return null;
    var g = z[key + "|gesamt"] || z[key + "|ergebnis"]; if (g) return { pct: g.status === "fertig" && g.pct == null ? 100 : g.pct, note: g.note, gruppe: g.gruppe || "", test: !!z[key + "|ergebnis"] };
    var ps = []; (d.themen || []).forEach(function (t) { var c = z[key + "|" + t.thema]; if (t.seite === key && c && c.pct != null) ps.push(c.pct); });
    return ps.length ? { pct: ps.reduce(function (a, b) { return a + b; }, 0) / ps.length } : null;
  }
  function svCard(s, vor) {
    var f = fachKey(s.fach), isTest = s.art === "test", a = ART[s.art] || ART.material, z = svZelle(s.key);
    var href = okFolder(s.ordner) ? "../" + s.ordner + "/" + (vor ? "?vorschau" + (isTest && z && /^[A-E]$/.test(z.gruppe) ? "&gruppe=" + z.gruppe : "") : "") : "#";
    var tags = h("div", { class: "tags" }, h("span", { class: "tag" + (isTest ? " test" : ""), text: a[0] }), s.eigenerLogin && h("span", { class: "tag lg", text: "eigener Login" }),
      z && z.pct != null ? h("span", { class: "tag sv-pc", title: "Fortschritt laut Dashboard (nur für dich sichtbar)", text: "📊 " + Math.round(z.pct) + " %" + (z.note ? " · Note " + z.note : "") }) : null);
    return h("a", { class: "card glass", href: href, target: "_blank", rel: "noopener" },
      h("div", { class: "ico " + (isTest ? "test" : f), text: a[1], "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: s.titel }), s.untertitel && h("div", { class: "s", text: s.untertitel }), tags),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
  }
  function svStart(k) {
    S.sv = { benutzer: k.benutzer, name: k.name || k.benutzer, klasse: k.klasse }; S.thema = ""; S.svStufe = 0;
    if (!S.dash) loadDash(false);
    if (String(k.klasse).toLowerCase() === "10a" && !S.svLk) { S.svLk = { busy: true }; api({ action: "admin_luecken", token: S.sess.token }).then(function (r) { S.svLk = r && r.ok ? r : { err: true }; if (S.sv) render(); }); }
    render(); try { window.scrollTo(0, 0); } catch (e) {}
  }
  function svBeenden() { S.sv = null; S.thema = ""; S.tab = "schueler"; render(); try { window.scrollTo(0, 0); } catch (e) {} }
  function svVorname() { return String(S.sv.name || "").split(/\s+/)[0] || S.sv.benutzer; }
  function schuelersichtView() {
    var k = S.sv, all = svSeiten(), out = [];
    var mitKl = svKonten().filter(function (x) { return x.klasse === k.klasse; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    out.push(h("div", { class: "sv-banner", role: "status" },
      h("div", { class: "sv-bt" }, h("b", { text: "👁 Schülersicht: " + svVorname() + " – nur Ansicht" }), h("span", { class: "muted", text: "Klasse " + k.klasse + " · so sieht die Startseite für dieses Konto aus. Nichts wird gespeichert oder gesendet." })),
      h("div", { class: "sv-act" }, mitKl.length > 1 ? wahlSel("Schüler", "wsel-sv", mitKl.map(function (x) { return [x.benutzer, x.name || x.benutzer]; }), k.benutzer, function (u) { var n = mitKl.filter(function (x) { return x.benutzer === u; })[0]; if (n) svStart(n); }) : null,
        h("button", { class: "btn small", type: "button", text: "Beenden", onclick: svBeenden }))));
    /* „Meine Vorbereitung“: Fortschritt + Lücken dieses Schülers (Lehrer-Info aus Dashboard/Lücken – im echten Portal sieht der Schüler das in den jeweiligen Seiten) */
    var d = S.dash, info = [];
    if (d && d.zellen) {
      var ps = all.filter(function (s) { return s.art !== "test"; }).map(function (s) { var z = svZelle(s.key); return z && z.pct != null ? z.pct : null; }).filter(function (x) { return x !== null; });
      info.push(h("div", { class: "sv-kpi" }, h("b", { text: ps.length ? Math.round(ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) + " %" : "–" }), h("span", { text: "Ø Fortschritt auf " + ps.length + (ps.length === 1 ? " genutzter Lernseite" : " genutzten Lernseiten") })));
    } else info.push(h("div", { class: "sv-kpi" }, h("b", { text: "…" }), h("span", { text: S.dashErr || "Fortschritt wird geladen" })));
    if (S.svLk && S.svLk.schueler && String(k.klasse).toLowerCase() === "10a") {
      var me = S.svLk.schueler.filter(function (x) { return x.benutzer === k.benutzer; })[0], T = {}; (S.svLk.themen || []).forEach(function (t) { T[t.id] = t.titel; });
      var off = me ? Object.keys(me.zellen || {}).filter(function (t) { return me.zellen[t].status === "offen"; }).sort(function (a, b) { return (me.zellen[a].rang || 99) - (me.zellen[b].rang || 99); }) : [];
      info.push(h("div", { class: "sv-kpi" }, h("b", { text: String(off.length) }), h("span", { text: off.length ? "offene Lücken: " + off.slice(0, 4).map(function (t) { return T[t] || t; }).join(", ") : "keine offene Lücke" })));
      if (me && window.PortalLuecken && window.PortalLuecken.state) { window.PortalLuecken.state.d = window.PortalLuecken.state.d || S.svLk;
        info.push(h("button", { class: "btn ghost small", type: "button", text: "🕸️ Spinnennetz", onclick: function () { window.PortalLuecken._detail(h, k.benutzer); } })); }
    }
    out.push(h("details", { class: "glass sv-info", open: true }, h("summary", { text: "📊 Meine Vorbereitung (Lehrer-Info)" }), h("div", { class: "sv-kpis" }, info)));
    out.push(stufenMenu(all, k.klasse, function () { return S.svStufe; }, function (n) { S.svStufe = n; }));
    return out;
  }
  function teacherSchuelersicht() {
    if (!S.admin) { loadAdminOnce(); return h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Konten werden geladen …" })); }
    var ks = svKonten().filter(function (x) { return !S.schulform || (isGymKl(x.klasse) ? "gym" : "sek") === S.schulform; });
    var kls = {}; ks.forEach(function (x) { kls[x.klasse] = 1; });
    var namen = Object.keys(kls).sort(klSort); if (S.svKlasse && !kls[S.svKlasse]) S.svKlasse = "";
    var inK = ks.filter(function (x) { return x.klasse === S.svKlasse; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return h("div", { class: "svwahl" },
      wahlLeiste(bereichSel(), wahlSel("Klasse", "wsel-svkl", [["", "Klasse wählen …"]].concat(namen.map(function (x) { return [x, x]; })), S.svKlasse || "", function (v) { S.svKlasse = v; render(); }),
        S.svKlasse ? wahlSel("Schüler", "wsel-sv", [["", "Schüler wählen …"]].concat(inK.map(function (x) { return [x.benutzer, x.name || x.benutzer]; })), "", function (u) { var n = inK.filter(function (x) { return x.benutzer === u; })[0]; if (n) svStart(n); }) : null),
      h("p", { class: "note", text: "Zeigt die Portal-Startseite genau so, wie dieses Konto sie sieht (sichtbare Seiten, Freigaben, Hausaufgaben, Meine Lücken/Prüfungsfit). Kein Login als Schüler, nichts wird gespeichert oder gesendet. Karten öffnen die Lehrer-Vorschau." }));
  }
  var adminLaedt = false;
  function loadAdminOnce() { if (adminLaedt) return; adminLaedt = true; api({ action: "admin_uebersicht", token: S.sess.token }).then(function (r) { adminLaedt = false; if (r.ok) { S.admin = r; render(); } else if (r.relogin) dropSession("Bitte melde dich neu an."); }); }

  /* ---------- Lehrer ---------- */
  function teacherTabs() {
    var tabs = [["menue", "Seiten"], ["ha", "Hausaufgaben"], ["freigaben", "Freigaben"], ["konten", "Sitzungen"], ["eltern", "Eltern"], ["dash", "Dashboard"], ["schueler", "Schülersicht"], ["briefings", "Briefings"], ["meldungen", "Meldungen"], ["wuensche", "Wünsche"], ["luecken", "Lücken"]];
    var bar = h("div", { class: "tabs glass", role: "tablist" }, tabs.map(function (t) {
      return h("button", { role: "tab", "aria-selected": S.tab === t[0] ? "true" : "false", text: t[1], onclick: function () { S.tab = t[0]; if (t[0] === "freigaben" || t[0] === "konten") loadAdmin(); if (t[0] === "dash") loadDash(false); if (t[0] === "schueler") { loadAdminOnce(); loadDash(false); } if (t[0] === "wuensche" && window.PortalWuensche) window.PortalWuensche.reset(); if (t[0] === "luecken" && window.PortalLuecken) window.PortalLuecken.reset(); if (t[0] === "eltern" && window.PortalEltern) window.PortalEltern.reset(); if (t[0] === "meldungen" && window.PortalMeldungen && window.PortalMeldungen.reset) window.PortalMeldungen.reset(); if (t[0] === "briefings") { loadBriefings(); if (window.PortalAufgaben) window.PortalAufgaben.reset(); } render(); } });
    }));
    var body = h("div", {});
    if (S.tab === "menue") body = teacherMenu(); else if (S.tab === "ha") body = teacherHA(); else if (S.tab === "freigaben") body = teacherFreigaben(); else if (S.tab === "konten") body = teacherKonten(); else if (S.tab === "briefings") body = teacherBriefings(); else if (S.tab === "schueler") body = teacherSchuelersicht(); else if (S.tab === "wuensche") body = window.PortalWuensche ? window.PortalWuensche.view(h, wunschCtx()) : h("p", { text: "Wünsche-Modul fehlt." }); else if (S.tab === "luecken") body = window.PortalLuecken ? window.PortalLuecken.view(h, { api: api, token: function () { return S.sess && S.sess.token; } }, render) : h("p", { text: "Lücken-Modul fehlt." }); else if (S.tab === "eltern") body = window.PortalEltern ? window.PortalEltern.view(h, render, { token: function () { return S.sess && S.sess.token; }, schulform: function () { return S.schulform; } }) : h("p", { text: "Eltern-Modul fehlt." }); else if (S.tab === "meldungen") body = window.PortalMeldungen ? window.PortalMeldungen.view(h, render, { api: api, token: function () { return S.sess && S.sess.token; }, sess: function () { return S.sess; } }) : h("p", { text: "Meldungen-Modul fehlt." }); else body = teacherDash();
    return h("div", {}, h("div", { class: "tabs-wrap" }, bar), body);
  }
  function klSort(a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); }
  function klassenNamen() {
    var ks = (S.admin && Object.keys(S.admin.klassen)) || []; var seen = {}; ks.forEach(function (k) { seen[k] = 1; });
    S.seiten.forEach(function (s) { (s.klassen || []).forEach(function (k) { if (k && k !== "*") seen[k] = 1; }); });
    return Object.keys(seen).filter(function (k) { return !S.schulform || (isGymKl(k) ? "gym" : "sek") === S.schulform; }).sort(klSort);
  }
  /* 12.11.2026 (Paulius: „lieber alles als Drop-down-Liste“): Bereich · Fach · Klasse als EINE kompakte Zeile nativer <select>.
     Gleiche Zustände/Logik wie vorher (sfSet, fwSet, S.klasse bzw. S.dashKlasse); sessionStorage-Schlüssel und Hash-Routen unverändert. */
  function wahlSel(lab, cls, opts, cur, onpick, dis) {
    var sel = h("select", { class: "wsel " + cls, "aria-label": lab, disabled: dis ? true : null });
    opts.forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); if (o[0] === cur) op.selected = true; sel.appendChild(op); });
    sel.value = cur; sel.addEventListener("change", function () { onpick(sel.value); });
    return h("label", { class: "wahl-f f-" + cls }, h("span", { class: "wahl-l", text: lab }), sel);
  }
  function wahlLeiste() { return h("div", { class: "wahl", role: "group", "aria-label": "Auswahl" }, Array.prototype.slice.call(arguments)); }
  function bereichSel() {
    return wahlSel("Bereich", "wsel-sf", [["sek", "🏫 Sekundarschule"], ["gym", "🎓 Gymnasium"]], S.schulform, function (v) {
      if (!v || v === S.schulform) return;
      sfSet(v); fwSet(""); S.klasse = ""; S.dashKlasse = ""; S.dashSeite = ""; S.dashThema = ""; S.fthema = ""; render(); kopPruefen(); try { window.scrollTo(0, 0); } catch (e) {} });
  }
  function fachSel(keys, onpick) {
    return wahlSel("Fach", "wsel-fach", keys.map(function (k) { return [k, FWAHL[k][1] + " " + FWAHL[k][0]]; }), S.fach, onpick || function (v) { if (v === S.fach) return; fwSet(v); S.klasse = ""; render(); try { window.scrollTo(0, 0); } catch (e) {} }, keys.length < 2);
  }
  function klasseSel(names, cur, onpick) { return wahlSel("Klasse", "wsel-kl", [["", "Alle Klassen"]].concat(names.map(function (k) { return [k, k]; })), cur || "", onpick); }
  function schulformWahl() {
    var n = { gym: 0, sek: 0 }, kl = { gym: {}, sek: {} };
    S.seiten.forEach(function (s) { var f = formOfPage(s); n[f]++; (s.klassen || []).forEach(function (k) { if (k && k !== "*" && (isGymKl(k) ? "gym" : "sek") === f) kl[f][k] = 1; }); });
    var srt = function (o) { return Object.keys(o).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); }).join(", "); };
    var opt = function (f, ico, t) { return h("a", { class: "card glass sfw", href: "#", "data-sf": f, onclick: function (e) { e.preventDefault(); sfSet(f); fwSet(""); S.tab = "menue"; S.klasse = ""; S.dashKlasse = ""; S.dashSeite = ""; render(); kopPruefen(); } },
      h("div", { class: "ico " + (f === "gym" ? "mathe" : "informatik"), text: ico, "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: t }), h("div", { class: "s", text: (srt(kl[f]) ? "Klassen " + srt(kl[f]) + " · " : "") + n[f] + " Seiten" })),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" })); };
    return h("div", { class: "sfwahl" }, h("h2", { text: "Welcher Bereich?" }), h("div", { class: "list" }, opt("gym", "🎓", "Gymnasium"), opt("sek", "🏫", "Sekundarschule")),
      h("p", { class: "note", text: "Die Auswahl gilt, bis du dich abmeldest oder den Tab schließt. Wechseln geht jederzeit oben über die Auswahlliste „Bereich“." }));
  }

  function inForm(s) { return !S.schulform || formOfPage(s) === S.schulform; }
  /* ---------- Lehrer-Seiten: Bereich → Fach → Themen → Theorie/Folien, Missionen bzw. Selbstarbeit, Hausaufgaben, Tests (09.11.2026, t18u) ---------- */
  function rolleT(s) {
    if (s.art === "test") return [4, "📝 Tests (Schüler sehen sie nur nach Freigabe)"];
    if (isHA(s)) return [3, "🏠 Hausaufgaben"];
    if (s.art === "material" || s.art === "folien") return [0, "🎞️ Theorie & Folien"];
    if (s.art === "mission") return [1, "🚀 Missionen"];
    if (s.art === "selbstlernen" || s.art === "karten") return [2, fachWahlOf(s) === "informatik" ? "🧠 Üben" : "🧠 Selbstarbeit & Üben"];
    return [5, "🧮 Weiteres"];
  }
  function themaOfT(s) { var hp = hauptOf(s); return hp ? ["haupt", "Meine Lücken & Prüfungsfit", "🎯", null] : themaOf(s); }
  function themenT(list) {
    var by = {}, out = [];
    list.forEach(function (s) { var t = themaOfT(s), k = t[0];
      if (!by[k]) { by[k] = { id: k, titel: t[1], ico: t[2], sort: 1e9, seiten: [] }; out.push(by[k]); }
      by[k].seiten.push(s); if (s.art !== "test" && !isHA(s)) by[k].sort = Math.min(by[k].sort, +s.sort || 0); });
    out.forEach(function (t) { if (t.sort === 1e9) t.sort = Math.min.apply(null, t.seiten.map(function (s) { return +s.sort || 0; })) + 1000;
      t.seiten.sort(function (a, b) { return (rolleT(a)[0] - rolleT(b)[0]) || ((+a.sort || 0) - (+b.sort || 0)); }); });
    var spaet = function (t) { return t.id === "werkzeuge" ? 2 : t.id === "haupt" ? 1 : 0; };
    out.sort(function (a, b) { return (spaet(a) - spaet(b)) || (a.sort - b.sort); });
    return out;
  }
  function seitenForm() { return S.seiten.filter(inForm); }
  function faecherForm() { var f = {}; seitenForm().forEach(function (s) { f[fachWahlOf(s)] = (f[fachWahlOf(s)] || 0) + 1; }); return f; }
  var FACH_ORD = ["mathe", "informatik", "weiteres"];
  function oeffneThemaT(id) { S.lthema = id; render(); try { window.scrollTo(0, 0); } catch (e) {} if (window.KFZurueck) window.KFZurueck.push(function () { S.lthema = ""; render(); }); }
  function schliesseThemaT() { if (window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } S.lthema = ""; render(); }
  function themaKarteT(t) {
    var n = {}; t.seiten.forEach(function (s) { var r = rolleT(s); n[r[0]] = n[r[0]] || [r[1], 0]; n[r[0]][1]++; });
    var kl = {}; t.seiten.forEach(function (s) { (s.klassen || []).forEach(function (x) { if (isBereichKl(x)) kl[x] = 1; }); });
    var parts = Object.keys(n).sort().map(function (k) { var lab = n[k][0].replace(/^\S+\s/, "").replace(/\s*\(.*\)$/, ""); return n[k][1] + " " + lab; });
    return h("a", { class: "card glass themacard", href: "#", "data-lthema": t.id, onclick: function (e) { e.preventDefault(); oeffneThemaT(t.id); } },
      h("div", { class: "ico " + (S.fach === "informatik" ? "informatik" : S.fach === "mathe" ? "mathe" : "klasse"), text: t.ico, "aria-hidden": "true" }),
      h("div", {}, h("div", { class: "t", text: t.titel }), h("div", { class: "s", text: parts.join(" · ") }),
        h("div", { class: "tags" }, Object.keys(kl).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); }).map(function (x) { return h("span", { class: "tag", text: x }); }),
          t.seiten.some(isHA) ? h("span", { class: "tag ha-badge", text: "🏠 HA" }) : null, t.seiten.some(function (s) { return s.art === "test"; }) ? h("span", { class: "tag test", text: "📝 Test" }) : null)),
      h("div", { class: "chev", text: "›", "aria-hidden": "true" }));
  }
  function teacherMenu() {
    var f = faecherForm(), keys = Object.keys(f);
    if (S.fach && !f[S.fach]) fwSet("");
    keys = FACH_ORD.filter(function (k) { return f[k]; });
    if (!S.fach && keys.length) fwSet(keys[0]);   // 12.11.2026: keine Fach-Karten mehr – erstes Fach vorgewählt, Wechsel über die Liste „Fach“
    if (!S.fach) return h("div", {}, wahlLeiste(bereichSel()), h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Keine Seiten in diesem Bereich." })));
    var inF = seitenForm().filter(function (s) { return fachWahlOf(s) === S.fach; });
    var kls = {}; inF.forEach(function (s) { (s.klassen || []).forEach(function (k) { if (isBereichKl(k)) kls[k] = 1; }); });
    if (S.klasse && !kls[S.klasse]) S.klasse = "";
    var list = inF.filter(function (s) { return !S.klasse || (s.klassen || []).indexOf(S.klasse) >= 0; });
    var kchips = klasseSel(Object.keys(kls).sort(klSort), S.klasse, function (k) { S.klasse = k; S.lthema = ""; render(); });
    var themen = themenT(list), offen = S.lthema && themen.filter(function (t) { return t.id === S.lthema; })[0];
    if (S.lthema && !offen) S.lthema = "";
    var box = h("div", { class: "lmenu" }, wahlLeiste(bereichSel(), fachSel(keys), kchips));
    if (offen) {
      box.appendChild(h("div", { class: "thema-kopf" }, h("button", { class: "btn ghost small", text: "‹ Alle Themen", onclick: schliesseThemaT }), h("h2", { class: "thema-titel", text: offen.ico + " " + offen.titel })));
      var grp = {}, ord = [], hm = {}; haListe(offen.seiten).forEach(function (x) { hm[x.s.key] = x; });
      offen.seiten.forEach(function (s) { var r = rolleT(s)[1]; if (!grp[r]) { grp[r] = []; ord.push(r); } grp[r].push(s); });
      ord.forEach(function (r) { var items = grp[r]; if (/Hausaufgaben/.test(r)) items = haListe(items).map(function (x) { return x.s; });
        box.appendChild(h("h2", { class: "rolle", text: r })); box.appendChild(h("div", { class: "list" }, items.map(function (s) { return hm[s.key] ? haKarte(hm[s.key]) : card(s); }))); });
      return box;
    }
    box.appendChild(h("h2", { text: "Themen · " + FWAHL[S.fach][0] + (S.klasse ? " · Klasse " + S.klasse : "") }));
    if (!themen.length) box.appendChild(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Keine Seiten für diese Auswahl." })));
    else box.appendChild(h("div", { class: "list" }, themen.map(themaKarteT)));
    box.appendChild(h("p", { class: "note", text: "Tests und Hausaufgaben stehen im jeweiligen Thema. Alle Hausaufgaben auf einen Blick: Tab „Hausaufgaben“; Tests freischalten: Tab „Freigaben“." }));
    return box;
  }
  function groupsTeacher(list) {   // Lehrer sehen Tests immer, gekennzeichnet
    var box = groups(list.filter(function (s) { return s.art !== "test"; })), tests = list.filter(function (s) { return s.art === "test"; });
    if (tests.length) { box.appendChild(h("h2", { text: "Tests (Schüler sehen sie nur nach Freigabe)" })); box.appendChild(h("div", { class: "list" }, tests.map(card))); }
    return box;
  }
  function loadAdmin() { api({ action: "admin_uebersicht", token: S.sess.token }).then(function (r) { if (r.ok) { S.admin = r; render(); } else if (r.relogin) dropSession("Bitte melde dich neu an."); }); }
  /* ---------- Freigaben: Fach → Thema → Test (10.11.2026, t35u) ----------
     Nur Darstellung/Gruppierung: Schalter, API-Aufruf admin_freigabe (seite, klasse, aktiv, bis) und Werte unverändert.
     Fach = kf_lehrer_fach (wie Tab „Seiten“), Thema aus Titel/Untertitel (THEMEN), sonst „Ohne Thema“.
     Datum: nur wenn im Titel/Untertitel ein Datum steht (z. B. 11.11.) – nichts erfinden. Einzel-Freigaben (@benutzer) unter dem Test, eingeklappt. */
  function testDatum(s) {
    var m = /(^|[^\d])(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)/.exec((s.titel || "") + " · " + (s.untertitel || ""));
    if (!m) return "";
    var d = +m[2], mo = +m[3]; if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
    return (d < 10 ? "0" : "") + d + "." + (mo < 10 ? "0" : "") + mo + "." + (m[4] ? (m[4].length === 2 ? "20" + m[4] : m[4]) : "");
  }
  function freigThema(s) { var t = themaOf(s); return t[3] ? { id: t[0], titel: t[1], ico: t[2], ord: THEMEN.indexOf(t) } : { id: "ohne", titel: "Ohne Thema", ico: "📄", ord: 1e6 }; }
  function freigSwitch(s, k, f, dauer, label) {
    var on = !!(f && f.aktiv && !(f.bis && Date.now() > f.bis));
    var sw = h("button", { class: "sw", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": s.titel + " für " + label, onclick: function () {
      var want = sw.getAttribute("aria-checked") !== "true", bis = 0, d = dauer.value;
      if (want && d === "hour") bis = Date.now() + 3600e3; if (want && d === "day") { var e = new Date(); e.setHours(23, 59, 59, 0); bis = e.getTime(); }
      sw.setAttribute("aria-checked", want ? "true" : "false");
      api({ action: "admin_freigabe", token: S.sess.token, seite: s.key, klasse: k, aktiv: want, bis: bis }).then(function (r) { if (!r.ok) sw.setAttribute("aria-checked", want ? "false" : "true"); else loadAdmin(); });
    } });
    return { on: on, row: h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t", text: label }), !!(on && f.bis) && h("div", { class: "s", text: "bis " + new Date(f.bis).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) })), sw) };
  }
  function freigTest(s, fr, einzel, dauer) {
    var dat = testDatum(s), nOn = 0;
    var g = h("div", { class: "ftest", "data-ftest": "1" }, h("div", { class: "ftest-hd" }, h("span", { class: "ftest-name", text: s.titel }), dat ? h("small", { class: "ftest-datum", text: dat }) : null,
      s.untertitel ? h("div", { class: "ftest-sub", text: s.untertitel }) : null));
    (s.klassen || []).forEach(function (k) { var x = freigSwitch(s, k, fr[s.key + "|" + k.toLowerCase()], dauer, "Klasse " + k); if (x.on) nOn++; g.appendChild(x.row); });
    var ez = einzel[s.key] || [];
    if (ez.length) {
      var nm = {}; (S.admin.konten || []).forEach(function (k) { nm[String(k.benutzer).toLowerCase()] = k.name || k.benutzer; });
      var aktivN = ez.filter(function (f) { return f.aktiv && !(f.bis && Date.now() > f.bis); }).length;
      var d = h("details", { class: "feinzel" }, h("summary", { text: "Einzel-Freigaben · " + ez.length + (ez.length === 1 ? " Person" : " Personen") + (aktivN ? " (" + aktivN + " an)" : "") }));
      ez.forEach(function (f) { var b = String(f.klasse).replace(/^@/, ""); d.appendChild(freigSwitch(s, f.klasse, f, dauer, nm[b.toLowerCase()] || b).row); });
      g.appendChild(d);
    }
    return { el: g, on: nOn };
  }
  function oeffneFThema(id) { S.fthema = S.fthema === id ? "" : id; render(); }
  function teacherFreigaben() {
    if (!S.admin) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Lade …" }));
    var dauer = h("select", { id: "dauer", "aria-label": "Dauer der Freigabe" }, h("option", { value: "0", text: "bis ich ausschalte" }), h("option", { value: "day", text: "nur heute" }), h("option", { value: "hour", text: "1 Stunde" }));
    if (S.dauerWahl) dauer.value = S.dauerWahl; dauer.addEventListener("change", function () { S.dauerWahl = dauer.value; });
    var box = h("div", { class: "freig" });
    var tests = S.admin.seiten.filter(function (s) { return s.art === "test" && inForm(s); });
    var fr = {}, einzel = {}; S.admin.freigaben.forEach(function (f) { var k = String(f.klasse || ""); if (k.charAt(0) === "@") (einzel[f.seite] = einzel[f.seite] || []).push(f); else fr[f.seite + "|" + k.toLowerCase()] = f; });
    var ff = {}; tests.forEach(function (s) { ff[fachWahlOf(s)] = (ff[fachWahlOf(s)] || 0) + 1; });
    var fk = ["mathe", "informatik", "weiteres"].filter(function (k) { return ff[k]; });
    if (!tests.length) { box.appendChild(h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Keine Test-Seiten vorhanden." }))); return box; }
    if (S.fach && !ff[S.fach]) { if (fk.length === 1) fwSet(fk[0]); else fwSet(""); }
    if (!S.fach) fwSet(fk[0]);   // 12.11.2026: keine Fach-Karten mehr – erstes Fach vorgewählt
    box.appendChild(wahlLeiste(bereichSel(), fachSel(fk, function (k) { if (S.fach !== k) { fwSet(k); S.fthema = ""; render(); } })));
    box.appendChild(h("div", { class: "row glass", style: "margin-top:8px;border-radius:18px" }, h("div", { class: "grow" }, h("div", { class: "t", text: "Dauer beim Einschalten" }), h("div", { class: "s", text: "Tests sind für Schüler standardmäßig unsichtbar." })), dauer));
    var by = {}, th = [];
    tests.filter(function (s) { return fachWahlOf(s) === S.fach; }).forEach(function (s) { var t = freigThema(s); if (!by[t.id]) { by[t.id] = t; t.tests = []; th.push(t); } by[t.id].tests.push(s); });
    th.sort(function (a, b) { return a.ord - b.ord; });
    th.forEach(function (t) { t.tests.sort(function (a, b) { return ((+a.sort || 0) - (+b.sort || 0)) || (a.titel < b.titel ? -1 : 1); }); });
    if (S.fthema && !by[S.fthema]) S.fthema = "";
    if (!S.fthema && th.length === 1) S.fthema = th[0].id;
    box.appendChild(h("h2", { text: "Themen · " + FWAHL[S.fach][0] }));
    th.forEach(function (t) {
      var open = S.fthema === t.id, items = t.tests.map(function (s) { return freigTest(s, fr, einzel, dauer); }), nOn = items.reduce(function (a, x) { return a + x.on; }, 0);
      var kl = {}; t.tests.forEach(function (s) { (s.klassen || []).forEach(function (x) { if (x && x !== "*") kl[x] = 1; }); });
      var g = h("div", { class: "group glass fthema" + (open ? " open" : ""), "data-fthema": t.id },
        h("button", { class: "fthema-hd", "aria-expanded": open ? "true" : "false", onclick: function () { oeffneFThema(t.id); } },
          h("span", { class: "fthema-ico", text: t.ico, "aria-hidden": "true" }),
          h("span", { class: "fthema-t" }, h("span", { class: "t", text: t.titel }), h("span", { class: "s", text: t.tests.length + (t.tests.length === 1 ? " Test" : " Tests") + (Object.keys(kl).length ? " · " + Object.keys(kl).sort().join(", ") : "") })),
          nOn ? h("span", { class: "tag ok", text: nOn + " frei" }) : null,
          h("span", { class: "chev", text: open ? "▾" : "›", "aria-hidden": "true" })));
      if (open) items.forEach(function (x) { g.appendChild(x.el); });
      box.appendChild(g);
    });
    return box;
  }
  function teacherKonten() {
    if (!S.admin) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Lade …" }));
    var box = h("div", {}, h("p", { class: "note", text: "Widerrufen beendet alle angemeldeten Geräte einer Person (verlorenes Handy). Mit dem Code kann sie sich danach wieder anmelden." }));
    var by = {}; S.admin.konten.forEach(function (k) { if (k.rolle === "lehrer") return; if (S.schulform && (isGymKl(k.klasse) ? "gym" : "sek") !== S.schulform) return; (by[k.klasse] = by[k.klasse] || []).push(k); });
    Object.keys(by).sort().forEach(function (kl) {
      var g = h("div", { class: "group glass" }, h("div", { class: "hd", text: "Klasse " + kl + " · " + by[kl].length + " Konten" }));
      by[kl].forEach(function (k) {
        g.appendChild(h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t", text: k.name || k.benutzer }), h("div", { class: "s", text: k.sitzungen + " Gerät(e)" + (k.zuletzt ? " · zuletzt " + new Date(k.zuletzt).toLocaleDateString("de-DE") : "") + (k.aktiv ? "" : " · gesperrt") })),
          h("button", { class: "btn ghost small", disabled: k.sitzungen ? null : true, text: "Widerrufen", onclick: function () { api({ action: "admin_widerrufen", token: S.sess.token, benutzer: k.benutzer }).then(loadAdmin); } })));
      });
      box.appendChild(g);
    });
    box.appendChild(h("div", { style: "margin:14px 0" }, h("button", { class: "btn ghost", text: "Alle Schüler-Sitzungen beenden", onclick: function () { if (confirm("Wirklich alle Schüler auf allen Geräten abmelden?")) api({ action: "admin_widerrufen", token: S.sess.token, alle: true }).then(loadAdmin); } })));
    return box;
  }

  /* ---------- Dashboard (Lehrer): echte Daten aus admin_fortschritt (Portal + alte Backends, nur lesend) ---------- */
  var INFO = [["logins", "Anmeldungen"], ["aufgaben", "Aufgaben gelöst"], ["quote", "1. Versuch richtig (%)"], ["lernzeitMin", "Lernzeit (Min.)"], ["aufwaermen", "Aufwärmen gelöst"],
    ["training", "Training richtig"], ["pruefung", "Prüfungsaufgaben bearbeitet"], ["beispiele", "Beispiele angesehen"], ["zuletztSeite", "Zuletzt auf"]];
  function loadDash(frisch) {
    if (!S.sess || S.dashLoading) return;
    if (!frisch && S.dash && Date.now() - (S.dashAt || 0) < 60000) return;
    S.dashLoading = true; S.dashErr = ""; if (S.tab === "dash") render();
    api({ action: "admin_fortschritt", token: S.sess.token, frisch: !!frisch }).then(function (r) {
      S.dashLoading = false;
      if (r.ok) { S.dash = r; S.dashAt = Date.now(); S.dashErr = ""; loadHilfe(); }
      else if (r.relogin) return dropSession("Bitte melde dich neu an.");
      else S.dashErr = r.error || "Daten konnten nicht geladen werden.";
      if (S.tab === "dash" || S.sv) render();
    });
  }
  /* 21.11.2026: „Wie gelöst?“ – Hilfe-Status je Aufgabe (admin_hilfe, Backend portal-8b, nur lesend). Ältere Backends: S.hilfe bleibt leer, nichts wird angezeigt. */
  function loadHilfe() {
    if (!S.sess || !window.KFHilfe || S.hilfeLoading) return;
    S.hilfeLoading = true;
    api({ action: "admin_hilfe", token: S.sess.token }).then(function (r) {
      S.hilfeLoading = false; S.hilfe = r && r.ok && r.seiten ? r.seiten : null;
      if (S.hilfe && (S.tab === "dash" || S.dashDetail)) render();
    });
  }
  function hilfeBoxes(d, v) {
    if (!window.KFHilfe || !S.hilfe) return null;
    var pg = v.pages.filter(function (p) { return S.hilfe[p.key]; });
    if (!pg.length) return null;
    if (pg.length > 3) return h("div", { class: "glass kfh-box" }, h("p", { class: "muted", text: "„Wie gelöst?“ (sofort / nach Versuchen / mit Tipp / Lösung) gibt es für " + pg.length + " der sichtbaren Seiten – in der Tabelle einen Seitentitel antippen, dann erscheint sie hier je Schüler." }));
    return pg.map(function (p) { return KFHilfe.klassenBox(h, S.hilfe, p.key, p.titel, v.sch, { rerender: render, open: function (id, seite) { openDetail(id, seite); } }); });
  }
  /* portal-7: Detail je Schüler (Verlauf, Meldungen) – lädt nach; ältere Backends antworten ohne Daten -> Abschnitt bleibt still weg */
  function loadDetail(id, frisch) {
    S.dd = S.dd || {}; if (!S.sess || (!frisch && S.dd[id])) return;
    S.dd[id] = { loading: true };
    api({ action: "admin_schueler", token: S.sess.token, benutzer: id, frisch: !!frisch }).then(function (r) {
      if (r && r.relogin) return dropSession("Bitte melde dich neu an.");
      S.dd[id] = r && r.ok && r.verlauf ? r : { none: true }; if (S.dashDetail === id) render();
    });
  }
  function openDetail(id, fokus) { S.dashDetail = id; S.dashFokus = typeof fokus === "string" ? fokus : ""; loadDetail(id); render();
    if (window.KFZurueck) window.KFZurueck.push(function () { S.dashDetail = ""; render(); }); }
  function meldOf(id) { var m = S.dash && S.dash.meldungen; return m ? (m[id] || { gesamt: 0, offen: 0 }) : null; }
  var MST = { "new": "neu", confirmed: "bestätigt", rejected: "abgelehnt", fixed: "behoben" };
  function ago(ms) {
    if (!ms) return "–"; var m = (Date.now() - ms) / 60000;
    if (m < 2) return "gerade eben"; if (m < 60) return "vor " + Math.round(m) + " Min."; var hh = m / 60; if (hh < 24) return "vor " + Math.round(hh) + " Std.";
    var dd = hh / 24; if (dd < 14) return "vor " + Math.round(dd) + " Tg."; return new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }
  function fdt(ms) { return ms ? new Date(ms).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–"; }
  function r1(n) { return String(Math.round(n * 10) / 10).replace(".", ","); }
  function cls(c) {
    if (!c) return "c0"; var p = c.pct;
    if (c.skala === "pct" && p != null) return p >= 85 ? "c4" : p >= 66 ? "c3" : p >= 33 ? "c2" : "c1";
    if (c.status === "fertig") return "c4"; if (c.zwischenstand) return "cz";
    return p == null ? (c.wert != null ? "cn" : "c1") : p >= 66 ? "c3" : p >= 33 ? "c2" : "c1";
  }
  function zvText(c) { var v = c.vorlaeufig; return v ? (v.pc != null ? "≈" + Math.round(v.pc) : v.b != null ? v.b + "/" + v.n : "·") : "·"; }   // 11.11.2026: vorläufig (nicht abgegeben)
  function ctext(c) {
    if (!c) return "–"; if (c.zwischenstand) return zvText(c); if (c.skala === "pct") return c.pct != null ? String(Math.round(c.pct)) : "·";
    if (c.status === "fertig") return "✓"; if (c.pct != null) return String(Math.round(c.pct)); return c.wert != null ? String(c.wert) : "·";
  }
  function cdesc(c) {   // Klartext für Tooltip und Detail
    if (!c) return "nicht begonnen";
    if (c.zwischenstand) { var v = c.vorlaeufig; if (!v) return "Test begonnen, noch nicht abgegeben (Zwischenstand)";
      return "NICHT abgegeben – vorläufig" + (v.p != null ? " " + r1(v.p) + " von " + r1(v.mx) + " P. (" + r1(v.pc) + " %, nur automatisch bewertete Aufgaben)" : "") +
        (v.b != null ? " · " + v.b + "/" + v.n + " Aufgaben bearbeitet" : "") + (v.gr ? " · Version " + v.gr : "") + " · letzter Zwischenstand " + fdt(v.z); }
    var s = [];
    if (c.skala === "pct") { if (c.wert != null && c.max) s.push(r1(c.wert) + " von " + r1(c.max) + " P."); if (c.pct != null) s.push(r1(c.pct) + " %"); if (c.note) s.push((c.endnote ? "Endnote " : "Note ") + c.note); if (c.endnote && (c.autoNote || c.autoP != null)) s.push("(automatisch: " + (c.autoP != null ? r1(c.autoP) + " von " + r1(c.autoMx) + " P." : "") + (c.autoNote ? ", Note " + c.autoNote : "") + ")"); if (c.gruppe) s.push("Version " + c.gruppe); if (c.versuche > 1) s.push(c.versuche + " Abgaben (letzte gezählt)"); }
    else if (c.max === 100) s.push(r1(c.wert) + " %"); else if (c.max) s.push(c.wert + " von " + c.max + (c.pct != null ? " (" + r1(c.pct) + " %)" : "")); else if (c.wert != null) s.push(String(c.wert));
    s.push(c.status === "fertig" && c.skala !== "pct" ? "fertig" : c.status === "begonnen" && c.skala !== "pct" ? "begonnen" : "");
    return s.filter(Boolean).join(" · ");
  }
  /* sichtbare Seiten/Spalten/Schüler nach den Filtern */
  /* 10.11.2026 (t39u): Aktivität = Ø aktive Lernminuten pro Tag, letzte 7 Tage (Backend portal-7n, Feld aktivMin; ältere Backends: „noch keine Daten“).
     Messbeginn d.aktivMin.seit: vorher gibt es keine Werte – dann grau statt rot. Farben rot (0) → gelb → grün (≥ AK_ZIEL). Trend gegen Tag -13…-7. */
  var AK_ZIEL = 15;
  function akDays(a, b) { var x = Date.parse(a + "T12:00:00"), y = Date.parse(b + "T12:00:00"); return isFinite(x) && isFinite(y) ? Math.round((y - x) / 86400e3) : NaN; }
  function akInfo(d, id) {
    var A = d && d.aktivMin; if (!A || !A.seit || !A.heute) return { st: "none" };
    var lauf = akDays(A.seit, A.heute) + 1; if (!(lauf >= 1)) return { st: "none" };
    var cov = Math.min(7, lauf), covP = Math.max(0, Math.min(7, lauf - 7)), x = (A.u || {})[id] || { m7: 0, m14: 0, t7: 0, letzte: "" };
    var avg = x.m7 / cov, o = { id: id, st: cov >= 3 ? "ok" : "warm", avg: avg, cov: cov, t7: x.t7 || 0, letzte: x.letzte || "", seit: A.seit, heute: A.heute, arrow: "" };
    if (covP >= 3) { var pv = x.m14 / covP, df = avg - pv; o.prev = pv;
      o.arrow = (Math.abs(df) >= 2 && (pv === 0 ? avg >= 2 : Math.abs(df) / pv >= 0.2)) ? (df > 0 ? "up" : "down") : "eq"; }
    return o;
  }
  function akColor(avg) { var f = Math.max(0, Math.min(1, avg / AK_ZIEL)), hue = Math.round(f * 125); return "hsl(" + hue + ",72%," + (f > 0.4 && f < 0.75 ? 36 : 40) + "%)"; }
  function akFmtDay(t) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || ""); return m ? m[3] + "." + m[2] + "." : t; }
  function akTip(o) {
    if (o.st === "none") return "Aktivität: noch keine Daten (Messung startet mit dem neuen Backend). Ø Minuten pro Tag, letzte 7 Tage, Ziel " + AK_ZIEL + ".";
    var l = ["Ø " + (Math.round(o.avg * 10) / 10).toString().replace(".", ",") + " min pro Tag, letzte " + (o.cov < 7 ? o.cov + " Tage (Messung seit " + akFmtDay(o.seit) + ")" : "7 Tage") + ", Ziel " + AK_ZIEL];
    l.push("aktive Tage: " + o.t7 + "/" + o.cov);
    if (o.letzte) { var n = akDays(o.letzte, o.heute); l.push("zuletzt aktiv " + (n <= 0 ? "heute" : n === 1 ? "gestern" : "vor " + n + " Tagen")); } else l.push("seit Messbeginn nicht aktiv");
    if (lzOk(S.dash) && o.id) { var lt = KFLernzeit.summe(lzTage(S.dash, o.id).slice(-7)); if (lt.a) l.push("7 Tage: Schule " + KFLernzeit.dauer(lt.s) + ", Zuhause " + KFLernzeit.dauer(lt.z) + (lt.o ? ", ohne Zuordnung " + KFLernzeit.dauer(lt.o) : "")); }
    if (o.prev != null) l.push("davor: Ø " + (Math.round(o.prev * 10) / 10).toString().replace(".", ",") + " min/Tag");
    else l.push("Trend: noch kein Vergleichszeitraum");
    if (o.st === "warm") l.push("noch wenig Daten – aussagekräftig ab " + akFmtDay(new Date(Date.parse(o.seit + "T12:00:00") + 2 * 86400e3).toISOString().slice(0, 10)));
    return l.join(" · ");
  }
  function akChip(d, id) {
    var o = akInfo(d, id), ar = { up: "↑", down: "↓", eq: "→" }[o.arrow] || "";
    if (o.st === "none") return h("span", { class: "akw", title: akTip(o), "aria-label": akTip(o) }, h("span", { class: "akt ak0", text: "–" }));
    var v = Math.round(o.avg);
    return h("span", { class: "akw", title: akTip(o), "aria-label": akTip(o) },
      h("span", { class: "akt" + (o.st === "warm" ? " ak0" : ""), style: o.st === "ok" ? "background:" + akColor(o.avg) : null }, h("b", { text: String(v) }), h("i", { text: "min" })),
      ar ? h("em", { class: "akp ak-" + o.arrow, text: ar }) : null, h("small", { class: "akd", text: o.t7 + "/" + o.cov }));
  }
  function akSortVal(d, id) { var o = akInfo(d, id); return o.st === "none" ? -1 : o.avg; }

  function szTitle(d, key) {
    var base = String(key || "").split("#")[0], hash = String(key || "").indexOf("#") >= 0 ? String(key).split("#")[1] : "";
    var titel = base;
    (d && d.seiten || []).forEach(function (pg) { if (pg.key === base) titel = pg.titel || base; });
    if (hash === "medien") titel += " · Medien im Alltag";
    else if (hash === "ordner") titel += " · Ordner und Dateien";
    else if (hash) titel += " · " + hash;
    return titel;
  }
  function szMin(sec) { var m = Math.round(Math.max(0, +sec || 0) / 60); return m + " min"; }
  function szPct(a, o) { if (!(+o > 0)) return "–"; return Math.round(100 * (+a || 0) / o) + " %"; }
  var SZ_HINWEIS = "Messung erst ab dem Start dieser Funktion, nicht rückwirkend. Die Zeiten sind eine Orientierung für die Lernbegleitung, keine alleinige Notenbasis.";
  function szTable(d, entries, withN) {
    if (!entries.length) return h("p", { class: "muted", text: "Noch keine Zeiten (Messung beginnt mit dem nächsten Unterricht)." });
    var head = [h("th", { class: "l", text: "Seite" }), h("th", { text: "Gesamt" }), h("th", { text: "Aktiv" }), h("th", { text: "Weg" }), h("th", { text: "Aktiv/Gesamt" })];
    if (withN) head.push(h("th", { text: "Schüler" }));
    return h("div", { class: "szscroll" }, h("table", { class: "sztable" },
      h("thead", {}, h("tr", {}, head)),
      h("tbody", {}, entries.map(function (e) {
        var cells = [h("td", { class: "l", text: szTitle(d, e.key) }), h("td", { text: szMin(e.offen) }), h("td", { text: szMin(e.aktiv) }), h("td", { text: szMin(e.weg) }), h("td", { text: szPct(e.aktiv, e.offen) })];
        if (withN) cells.push(h("td", { text: String(e.n || 0) }));
        return h("tr", {}, cells);
      }))));
  }
  function szEntries(map) {
    return Object.keys(map || {}).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }).map(function (k) {
      var p = map[k] || {};
      return { key: k, aktiv: p.aktiv || 0, weg: p.weg || 0, offen: p.offen || 0, n: p.n || 0 };
    });
  }
  function szClassBox(d, v, eingebettet) {
    var sz = d && d.seitenzeit;
    var ids = {}; (v && v.sch || []).forEach(function (s) { ids[s.id] = 1; });
    var agg = {}, seen = {};
    if (sz && sz.u) Object.keys(sz.u).forEach(function (uid) {
      if (!ids[uid]) return;
      var pages = (sz.u[uid] && sz.u[uid].s) || {};
      Object.keys(pages).forEach(function (k) {
        var p = pages[k], g = agg[k] = agg[k] || { aktiv: 0, weg: 0, offen: 0, n: 0 };
        g.aktiv += p.aktiv || 0; g.weg += p.weg || 0; g.offen += p.offen || 0;
        var sk = k + "|" + uid; if (!seen[sk]) { seen[sk] = 1; g.n++; }
      });
    });
    return h("div", { class: eingebettet ? "szbox lzk-in" : "szbox glass" },
      eingebettet ? null : h("h3", { text: "Lernzeit je Mission / Selbstlernseite" }),
      h("p", { class: "szhint", text: SZ_HINWEIS + (sz && sz.seit ? " Erste Messung: " + akFmtDay(sz.seit) : "") }),
      szTable(d, szEntries(agg), true));
  }
  function szStudentBox(d, id, eingebettet) {
    var sz = d && d.seitenzeit, u = sz && sz.u && sz.u[id], pages = u && u.s || {}, sum = u && u.sum;
    return h("div", { class: eingebettet ? "szbox lzk-in" : "dsec szbox" },
      eingebettet ? null : h("div", { class: "dh" }, h("b", { text: "Lernzeit je Seite" })),
      h("p", { class: "szhint", text: SZ_HINWEIS + (sz && sz.seit ? " Erste Messung: " + akFmtDay(sz.seit) : "") }),
      sum && (sum.offen || sum.aktiv) ? h("p", { class: "muted", text: "Summe: " + szMin(sum.offen) + " Gesamt · " + szMin(sum.aktiv) + " aktiv · " + szPct(sum.aktiv, sum.offen) }) : null,
      szTable(d, szEntries(pages), false));
  }

  /* 24.11.2026 (portal-8d): Klassenüberblick + Lernzeit „in der Schule“ / „zu Hause“ (Daten d.lernzeit aus lzDash_, Diagramme kf-lernzeit.js).
     Ersetzt die vier Kacheln + die Aktivitäts-Zeile über der Tabelle und die Kacheln im Schüler-Detail. Ältere Backends (ohne d.lernzeit): alte Ansicht. */
  function lzOk(d) { return !!(window.KFLernzeit && d && d.lernzeit && d.lernzeit.tage && d.lernzeit.u); }
  function lzTage(d, id) { return KFLernzeit.tageFuer(d.lernzeit, [id], false); }
  function aktiv7(d, s) {   // EINE Definition von „aktiv (7 Tage)“: ≥ 1 aktive Lernminute in den letzten 7 Tagen (ohne Lernzeit-Daten: letzte Aktivität)
    if (lzOk(d)) { var u = d.lernzeit.u[s.id]; return !!(u && u.a.slice(-7).some(function (m) { return m >= 1; })); }
    return !!(s._last && Date.now() - s._last < 7 * 86400e3);
  }
  function seitenWert(d, z, key) { var g = z[key + "|gesamt"] || z[key + "|ergebnis"];   // wie dashView/classCards
    if (g) return g.status === "fertig" && g.pct == null ? 100 : g.pct;
    var ps = []; d.themen.forEach(function (t) { var c = z[key + "|" + t.thema]; if (t.seite === key && c && c.pct != null) ps.push(c.pct); });
    return ps.length ? ps.reduce(function (x, y) { return x + y; }, 0) / ps.length : null; }
  function lzKachel(wert, label, sub) { return h("div", { class: "tile glass" }, h("b", { text: String(wert) }), h("span", { text: label }), sub ? h("small", { class: "lzk-sub", text: sub }) : null); }
  function lzKlassenBox(d, v) {
    var L = window.KFLernzeit, n = v.sch.length, ids = v.sch.map(function (s) { return s.id; });
    var akt = v.sch.filter(function (s) { return aktiv7(d, s); }).length, mitF = v.sch.filter(function (s) { return s._any; }).length;
    var tage = L.tageFuer(d.lernzeit, ids, true), w7 = L.summe(tage.slice(-7));
    var lp = d.lernzeit, titelKl = S.dashKlasse ? "Klasse " + S.dashKlasse : "Auswahl";
    /* Fortschritt je Lernseite (ohne Tests): Ø der ausgewählten Schüler, wie die Lernbereiche im Elternbereich */
    var seiten = v.pages.filter(function (p) { return p.art !== "test"; }).map(function (p) {
      var sum = 0, fertig = 0, beg = 0; v.sch.forEach(function (s) { var w = seitenWert(d, d.zellen[s.id] || {}, p.key); if (w != null) { sum += w; beg++; if (w >= 100) fertig++; } });
      return { p: p, avg: n ? sum / n : 0, fertig: fertig, beg: beg }; }).filter(function (x) { return x.beg > 0; });
    var mehr = Math.max(0, seiten.length - 8), avgF = seiten.length ? seiten.reduce(function (a, x) { return a + x.avg; }, 0) / seiten.length : 0;   // wie Klassenkarte: Ø über die genutzten Lernseiten (ohne Tests)
    return h("div", { class: "lzk glass" },
      h("div", { class: "lzk-h" }, h("h3", { text: "Überblick " + titelKl }), h("span", { class: "muted", text: n + " Schüler · Lernzeit = aktive Minuten auf den Lernseiten" })),
      h("div", { class: "tiles lzk-t" },
        lzKachel(akt + " / " + n, "aktiv (7 Tage)"),
        lzKachel(L.dauer(w7.a), "Ø Lernzeit je Schüler (7 Tage)", "🏫 " + L.dauer(w7.s) + " · 🏠 " + L.dauer(w7.z)),
        lzKachel(mitF + " / " + n, "mit Fortschritt"),
        lzKachel(seiten.length ? Math.round(avgF) + " %" : "–", "Ø Fortschritt", "genutzte Lernseiten, ohne Tests")),
      h("div", { class: "lzk-g" },
        h("div", { class: "lzk-c" }, h("h4", { text: "Lernzeit: Ø Minuten je Schüler und Tag (14 Tage)" }),
          L.balken(tage, { min: 5, aria: "Durchschnittliche Lernzeit je Schüler und Tag, in der Schule und zu Hause" }), L.legende({ o: tage.some(function (x) { return x.o > 0.5; }) }),
          h("h4", { style: "margin-top:12px", text: "Letzte 7 Tage: in der Schule und zu Hause" }), L.anteil(w7.s, w7.z, w7.o)),
        h("div", { class: "lzk-c" }, h("h4", { text: "Fortschritt je Lernseite (Ø " + titelKl + ")" }),
          seiten.length ? seiten.slice(0, 8).map(function (x) { return h("div", { class: "lzk-p", title: x.p.titel + ": Ø " + Math.round(x.avg) + " % · " + x.fertig + " von " + n + " fertig · " + x.beg + " begonnen" },
            h("span", { class: "t", text: x.p.titel }), h("span", { class: "v", text: Math.round(x.avg) + " %" }),
            h("span", { class: "bar" }, h("i", { class: cls({ pct: x.avg, skala: "pct" }), style: "width:" + Math.max(2, Math.min(100, x.avg)) + "%" })),
            h("span", { class: "s muted", text: x.fertig + " von " + n + " fertig · " + x.beg + " begonnen" })); }) : h("p", { class: "muted", text: "Auf den gezeigten Lernseiten noch kein Fortschritt." }),
          mehr ? h("p", { class: "muted small", text: "+ " + mehr + " weitere Seiten in der Tabelle unten." }) : null)),
      h("p", { class: "lz-rule", text: L.regel(lp.grenze, lp.seit) + " In der Tabelle: Ø min/Tag der letzten 7 Tage (Ziel " + AK_ZIEL + "), Pfeil = Trend zur Woche davor, x/7 = aktive Tage." }),
      h("details", { class: "lzk-d" }, h("summary", { text: "Lernzeit je Mission / Selbstlernseite (Tabelle)" }), szClassBox(d, v, true)));
  }
  function lzSchuelerBox(d, st) {
    var L = window.KFLernzeit, tage = lzTage(d, st.id), w7 = L.summe(tage.slice(-7));
    return h("div", { class: "dsec" }, h("div", { class: "dh" }, h("b", { text: "Lernzeit (14 Tage)" }), h("span", { class: "tag", text: "🏫 Schule · 🏠 Zuhause" })),
      L.balken(tage, { aria: "Lernzeit der letzten 14 Tage, in der Schule und zu Hause" }), L.legende({ o: tage.some(function (x) { return x.o > 0; }) }),
      h("p", { class: "muted small", style: "margin-top:8px", text: "Letzte 7 Tage:" }), L.anteil(w7.s, w7.z, w7.o),
      h("p", { class: "lz-rule", text: L.regel(d.lernzeit.grenze, d.lernzeit.seit) }),
      h("details", { class: "lzk-d" }, h("summary", { text: "Lernzeit je Seite (Tabelle)" }), szStudentBox(d, st.id, true)));
  }
  function dashView(ohneTab) {   // 24.11.2026: ohneTab = ohne Tabellenfilter (Typ/Thema/Seite) – für den Klassenüberblick über der Tabelle
    var d = S.dash, sites = d.seiten || [], byKey = {}; sites.forEach(function (s) { byKey[s.key] = s; });
    var fSeite = ohneTab ? "" : S.dashSeite, fTyp = function (s) { return ohneTab || dashTypOk(s); }, fThema = function (s) { return ohneTab || dashThemaOk(s); };
    var klassen = []; d.schueler.forEach(function (s) { if (s.klasse && klassen.indexOf(s.klasse) < 0 && (!S.schulform || (isGymKl(s.klasse) ? "gym" : "sek") === S.schulform)) klassen.push(s.klasse); });
    sites = sites.filter(inForm);
    klassen.sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); });
    var pages = sites.filter(function (s) { return fSeite ? s.key === fSeite : ((!S.dashKlasse || (s.klassen || []).indexOf(S.dashKlasse) >= 0) && fTyp(s) && fThema(s)); });
    var keep = {}; pages.forEach(function (s) { keep[s.key] = 1; });
    var th = d.themen.filter(function (t) { return keep[t.seite]; });
    var sch = d.schueler.filter(function (s) {
      if (S.schulform && (isGymKl(s.klasse) ? "gym" : "sek") !== S.schulform) return false;
      if (S.dashKlasse) return s.klasse === S.dashKlasse;
      if (fSeite && byKey[fSeite]) return (byKey[fSeite].klassen || []).indexOf(s.klasse) >= 0;
      return true;
    });
    sch.forEach(function (s) { var z = d.zellen[s.id] || {}, sum = 0, any = false, last = s.zuletzt || 0;
      pages.forEach(function (p) { var g = z[p.key + "|gesamt"] || z[p.key + "|ergebnis"], v = null;
        if (g) v = g.status === "fertig" && g.pct == null ? 100 : g.pct;
        else { var ps = []; th.forEach(function (t) { if (t.seite === p.key && z[p.key + "|" + t.thema] && z[p.key + "|" + t.thema].pct != null) ps.push(z[p.key + "|" + t.thema].pct); }); if (ps.length) v = ps.reduce(function (a, b) { return a + b; }, 0) / ps.length; }
        if (v != null) sum += v; });
      th.forEach(function (t) { var c = z[t.seite + "|" + t.thema]; if (c && (c.status === "begonnen" || c.status === "fertig")) any = true; });
      s._score = pages.length ? sum / pages.length : 0; s._any = any; s._last = last; });
    sch.sort(function (a, b) {
      if (S.dashSort === "zuletzt") return (b._last - a._last) || (a.anzeige < b.anzeige ? -1 : 1);
      if (S.dashSort === "fortschritt") return (b._score - a._score) || (a.anzeige < b.anzeige ? -1 : 1);
      if (S.dashSort === "aktiv") return (akSortVal(d, b.id) - akSortVal(d, a.id)) || (a.anzeige < b.anzeige ? -1 : 1);
      return (parseInt(a.klasse) - parseInt(b.klasse)) || (a.klasse < b.klasse ? -1 : a.klasse > b.klasse ? 1 : (a.anzeige < b.anzeige ? -1 : a.anzeige > b.anzeige ? 1 : 0));
    });
    return { klassen: klassen, pages: pages, th: th, sch: sch, byKey: byKey };
  }
  /* 09.11.2026 (t18u): Dashboard-Filter Themen (Lernseiten) / Tests / Hausaufgaben + Thema. Nur Anzeige – Datenquelle admin_fortschritt unverändert. */
  function dashFull(p) { var x = null; S.seiten.forEach(function (s) { if (s.key === p.key) x = s; }); return x ? Object.assign({}, p, { untertitel: x.untertitel, art: p.art || x.art, titel: p.titel || x.titel }) : p; }
  function dashTypOf(p) { p = dashFull(p); return p.art === "test" ? "tests" : isHA(p) ? "ha" : "themen"; }
  function dashTypOk(p) { return !S.dashTyp || dashTypOf(p) === S.dashTyp; }
  function dashThemaOf(p) { return themaOfT(dashFull(p)); }
  function dashThemaOk(p) { return !S.dashThema || dashThemaOf(p)[0] === S.dashThema; }
  function dashFilterLeiste(d) {
    var basis = d.seiten.filter(inForm).filter(function (s) { return !S.dashKlasse || (s.klassen || []).indexOf(S.dashKlasse) >= 0; });
    var cnt = { "": basis.length, themen: 0, tests: 0, ha: 0 }; basis.forEach(function (s) { cnt[dashTypOf(s)]++; });
    var typ = chipRow([["", "Alles (" + cnt[""] + ")"], ["themen", "📚 Themen (" + cnt.themen + ")"], ["tests", "📝 Tests (" + cnt.tests + ")"], ["ha", "🏠 Hausaufgaben (" + cnt.ha + ")"]], S.dashTyp, function (k) { S.dashTyp = k; S.dashSeite = ""; S.dashThema = ""; tabSave(); render(); }, "Spalten", "dtyp");
    var th = {}, tho = []; basis.filter(dashTypOk).forEach(function (s) { var t = dashThemaOf(s); if (!th[t[0]]) { th[t[0]] = t; tho.push(t); } });
    if (S.dashThema && !th[S.dashThema]) S.dashThema = "";
    var them = tho.length > 1 ? chipRow([["", "Alle Themen"]].concat(tho.map(function (t) { return [t[0], t[2] + " " + t[1]]; })), S.dashThema, function (k) { S.dashThema = k; S.dashSeite = ""; tabSave(); render(); }, "Thema", "dthema") : null;
    return [typ, them];
  }
  /* portal-7: Übersicht je Klasse (Karten) – klick = Klasse filtern */
  function classCards(d, v) {
    var g = {}, now = Date.now(), pv = function (z, key) { var gg = z[key + "|gesamt"] || z[key + "|ergebnis"];   // Seitenwert wie in dashView
        if (gg) return gg.status === "fertig" && gg.pct == null ? 100 : gg.pct; var ps = []; d.themen.forEach(function (t) { var c = z[key + "|" + t.thema]; if (t.seite === key && c && c.pct != null) ps.push(c.pct); });
        return ps.length ? ps.reduce(function (x, y) { return x + y; }, 0) / ps.length : null; };
    var used = {}; v.sch.forEach(function (s) { var z = d.zellen[s.id] || {}; Object.keys(z).forEach(function (k) { used[s.klasse + "|" + k.split("|")[0]] = 1; }); });
    v.sch.forEach(function (s) { var k = g[s.klasse] = g[s.klasse] || { n: 0, sum: 0, act: 0, any: 0, m: 0, low: 0 }, z = d.zellen[s.id] || {}, ps = d.seiten.filter(function (p) { return used[s.klasse + "|" + p.key] && p.art !== "test"; }), sm = 0;
      ps.forEach(function (p) { sm += pv(z, p.key) || 0; });
      k.n++; k.sum += ps.length ? sm / ps.length : 0; if (aktiv7(d, s)) k.act++; if (s._any) k.any++; else k.low++; var m = meldOf(s.id); if (m) k.m += m.offen; });
    var FACH = { "5": "Mathe", "6a": "Informatik", "6b": "Informatik", "7a": "Mathe", "8b": "Mathe", "10a": "Mathe", "9g": "Mathe (Gym)", "8g": "Mathe (Gym)" };
    return h("div", { class: "klcards" }, v.klassen.map(function (kl) { var k = g[kl]; if (!k) return null; var avg = k.n ? k.sum / k.n : 0;
      return h("button", { class: "klc glass", type: "button", onclick: function () { S.dashKlasse = kl; render(); } },
        h("div", { class: "kt" }, h("b", { text: kl }), h("span", { class: "muted", text: FACH[kl] || "" })),
        h("div", { class: "ring", title: "Ø Fortschritt auf den genutzten Lernseiten (ohne Tests)", style: "--p:" + Math.round(avg) }, h("span", { text: Math.round(avg) + " %" })),
        h("div", { class: "ks" }, h("span", { text: k.n + " Schüler" }), h("span", { text: k.act + " aktiv (7 T.)" }), h("span", { text: k.any + " mit Fortschritt" }), d.meldungen ? h("span", { class: k.m ? "hot" : "", text: "⚑ " + k.m + " offen" }) : null));
    }));
  }
  /* 12.11.2026: Dashboard-Auswahlreihen (Typ, Thema, Seite/Test, Sortierung) als <select> statt Chip-Reihe – gleiche Werte und Callbacks. */
  function chipRow(list, cur, onpick, lab, cls) {
    return wahlSel(lab || "Auswahl", cls || "", list, cur || "", onpick);
  }

  function reopenAbgabe(benutzer, seite, titel) {
    if (!S.sess || S.reopenBusy) return;
    if (!window.confirm("Abgabe für „" + (titel || "diesen Test") + "“ wieder öffnen?\n\nDie alte Abgabe bleibt gespeichert. Der Schüler kann auf dem Gerät, auf dem er abgegeben hat, weiterarbeiten und erneut abgeben. Gewertet wird die letzte Abgabe.")) return;
    S.reopenBusy = true; S.reopenErr = ""; render();
    api({ action: "admin_reopen", token: S.sess.token, benutzer: benutzer, seite: seite }).then(function (r) {
      S.reopenBusy = false;
      if (r && r.ok) {
        S.dash = S.dash || {}; S.dash.reopen = S.dash.reopen || {};
        S.dash.reopen[benutzer] = S.dash.reopen[benutzer] || {};
        S.dash.reopen[benutzer][seite] = { status: "offen", z: r.z || Date.now(), verbraucht: 0, label: "geoeffnet" };
      } else S.reopenErr = (r && r.error) || "Nachfreigabe nicht gespeichert. Bitte später erneut versuchen.";
      render();
    });
  }
  function detailSheet(v) {
    var d = S.dash, st = null; d.schueler.forEach(function (s) { if (s.id === S.dashDetail) st = s; }); if (!st) return null;
    var z = d.zellen[st.id] || {}, inf = d.info[st.id] || {}, body = [], ohneDaten = [];
    d.seiten.forEach(function (p) {
      var rows = d.themen.filter(function (t) { return t.seite === p.key; }), has = rows.some(function (t) { return z[p.key + "|" + t.thema]; }) || inf[p.key];
      if (!has && (p.klassen || []).indexOf(st.klasse) < 0) return;
      if (!has && !(window.KFHilfe && S.hilfe && S.hilfe[p.key])) { ohneDaten.push(p.titel); return; }   // 24.11.2026: Seiten ohne Daten als eine Zeile statt je ein leerer Kasten
      var box = h("div", { class: "dsec" }, h("div", { class: "dh" }, h("b", { text: p.titel }), !has && h("span", { class: "tag", text: "keine Daten" })));
      rows.forEach(function (t) {
        var c = z[p.key + "|" + t.thema]; if (!c && !has) return;
        var w = c ? (c.pct != null ? c.pct : c.vorlaeufig && c.vorlaeufig.pc != null ? c.vorlaeufig.pc : (c.status === "fertig" ? 100 : 0)) : 0;
        box.appendChild(h("div", { class: "drow" }, h("span", { class: "dl", text: t.label }),
          h("span", { class: "bar" }, h("i", { class: cls(c), style: "width:" + Math.max(c ? 4 : 0, Math.min(100, w)) + "%" })), h("span", { class: "dv", text: cdesc(c) })));
      });
      var i = inf[p.key];
      if (i) {
        var kv = [];
        if (i.zuletzt) kv.push(["Letzte Aktivität", fdt(i.zuletzt)]); if (i.erste) kv.push(["Erste Aktivität", fdt(i.erste)]);
        if (i.felder && i.felder[1]) kv.push(["Felder ausgefüllt", i.felder[0] + " von " + i.felder[1]]);
        INFO.forEach(function (k) { if (i[k[0]] != null && i[k[0]] !== "") kv.push([k[1], String(i[k[0]])]); });
        if (kv.length) box.appendChild(h("div", { class: "kv" }, kv.map(function (x) { return h("span", {}, h("em", { text: x[0] }), " " + x[1]); })));
      }

      rows.forEach(function (t) { var c = z[p.key + "|" + t.thema]; if (c && c.abgaben && c.abgaben.length) box.appendChild(h("div", { class: "abg" }, h("em", { text: "Abgaben" }),
        c.abgaben.slice().reverse().map(function (a) { return h("span", { class: "ab" }, fdt(a.z) + " · " + (a.gruppe ? "Version " + a.gruppe + " · " : "") + (a.p != null ? r1(a.p) + "/" + r1(a.mx) + " P." : "") + (a.pc != null ? " (" + r1(a.pc) + " %)" : "") + (a.note ? " · Note " + a.note : "")); }))); });
      if (p.art === "test") {
        var rg = d.reopen && d.reopen[st.id] && d.reopen[st.id][p.key], abgs = [], fertig = false, lastAb = 0;
        rows.forEach(function (t) { var c = z[p.key + "|" + t.thema]; if (!c) return;
          if (c.status === "fertig" || (c.abgaben && c.abgaben.length)) fertig = true;
          (c.abgaben || []).forEach(function (a) { abgs.push(a); if (a.z > lastAb) lastAb = a.z; }); });
        var stLabel = "";
        if (rg && rg.status === "offen") stLabel = "geöffnet – der Schüler kann auf seinem Gerät weiterarbeiten (Seite neu laden oder kurz warten).";
        else if (rg && rg.status === "verbraucht" && lastAb && rg.verbraucht && lastAb >= rg.verbraucht - 5000) stLabel = "wieder abgegeben";
        else if (rg && rg.status === "verbraucht") stLabel = "geöffnet (vom Schüler übernommen)";
        if (fertig || (rg && rg.status === "offen")) {
          box.appendChild(h("div", { class: "reopen-box" },
            stLabel ? h("p", { class: "muted reopen-st", text: stLabel }) : null,
            (fertig && (!rg || rg.status !== "offen")) ? h("button", { class: "btn small", type: "button", disabled: S.reopenBusy ? true : null, text: S.reopenBusy ? "Wird geöffnet …" : "Abgabe wieder öffnen", onclick: function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); reopenAbgabe(st.id, p.key, p.titel); } }) : null,
            S.reopenErr ? h("p", { class: "muted", text: S.reopenErr }) : null));
        }
      }
      if (window.KFHilfe && S.hilfe) { var hd = KFHilfe.detail(h, S.hilfe, p.key, st.id); if (hd) box.appendChild(hd); }
      body.push(box);
    });
    if (ohneDaten.length) body.push(h("div", { class: "dsec" }, h("div", { class: "dh" }, h("b", { text: "Noch ohne Daten (" + ohneDaten.length + ")" })), h("p", { class: "muted small", text: ohneDaten.join(" · ") })));
    if (!body.length) body.push(h("p", { class: "muted", text: "Keine Daten vorhanden." }));
    if (window.KFDruck && window.THEMEN && KFDruck.hasExamView(d, st)) {
      if (!document.getElementById("thStyle")) {
        var ths = document.createElement("style"); ths.id = "thStyle"; ths.textContent = THEMEN.CSS + (THEMEN.PRINT_CSS || ""); document.head.appendChild(ths);
      }
      var exam = h("div", { class: "kfd-exam dsec" }); exam.innerHTML = KFDruck.detailExamHtml(d, st); body.unshift(exam);
    }
    var dd = (S.dd || {})[st.id], mo = meldOf(st.id), ak = d.aktivitaet ? d.aktivitaet[st.id] : null;
    var sc = 0, n = 0; v.sch.forEach(function (x) { if (x.id === st.id) { sc = x._score; n = 1; } });
    var lzD = lzOk(d) ? KFLernzeit.summe(lzTage(d, st.id).slice(-7)) : null;
    var top = h("div", { class: "tiles dt" }, (lzD ? [[n ? Math.round(sc) + " %" : "–", "Ø Fortschritt"], [KFLernzeit.dauer(lzD.a), "Lernzeit (7 Tage)"], [lzD.tage + " / 7", "aktive Tage"]] : [[n ? Math.round(sc) + " %" : "–", "Ø Fortschritt"], [ak ? String(ak.tage7 || 0) : "–", "aktive Tage (7)"], [ak ? String(ak.n7 || 0) : "–", "Aktionen (7 Tage)"]]).concat([ mo ? [String(mo.offen) + (mo.gesamt > mo.offen ? " / " + mo.gesamt : ""), "⚑ Meldungen offen"] : null]).filter(Boolean).map(function (t) { return h("div", { class: "tile glass" }, h("b", { text: t[0] }), h("span", { text: t[1] })); }));
    body.unshift(top);
    if (window.KFStand && d.stand && d.stand[st.id]) {
      var stBox = h("div", { class: "dsec", id: "kfStandDash" });
      try { KFStand.mountTeacher(stBox, d.stand[st.id], { zellen: z, seiten: d.seiten, themen: d.themen }); } catch (e) {}
      body.splice(1, 0, stBox);
    }
    body.splice((window.KFStand && d.stand && d.stand[st.id]) ? 2 : 1, 0, lzOk(d) ? lzSchuelerBox(d, st) : szStudentBox(d, st.id));
    if (window.KFHefterFotos && S.sess) body.push(KFHefterFotos.box(st.id, S.sess.token));   /* 21.11.2026 Hefter-Fotos (hefter-fotos.js) */
    if (dd && dd.loading) body.push(h("p", { class: "muted", text: "Verlauf wird geladen …" }));
    else if (dd && dd.verlauf) {
      var ml = dd.meldungen || [];
      if (ml.length) body.push(h("div", { class: "dsec" }, h("div", { class: "dh" }, h("b", { text: "⚑ Fehler gemeldet (" + ml.length + ")" })), ml.map(function (m) {
        return h("div", { class: "mrow2" }, h("div", {}, h("b", { text: m.grund || "Meldung" }), h("span", { class: "tag" + (m.status === "new" ? " hot" : ""), text: MST[m.status] || m.status || "neu" }), h("span", { class: "muted" }, " · " + fdt(m.z) + " · " + (m.seite || ""), m.aufgabe ? [" · ", tipId(m.aufgabe) || m.aufgabe] : null)),
          m.kommentar ? h("div", { class: "mcom", text: "„" + m.kommentar + "“" }) : null); })));
      var byDay = {}, days = []; dd.verlauf.forEach(function (e) { var k = new Date(e.z).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }); if (!byDay[k]) { byDay[k] = []; days.push(k); } byDay[k].push(e); });
      var tt = {}; d.themen.forEach(function (t) { tt[t.seite + "|" + t.thema] = t.label; });
      var ttl = {}; d.seiten.forEach(function (p) { ttl[p.key] = p.titel; });
      body.push(h("div", { class: "dsec" }, h("div", { class: "dh" }, h("b", { text: "Verlauf (Portal-Seiten)" }), h("span", { class: "tag", text: dd.verlaufGesamt + " Einträge" })),
        days.length ? days.slice(0, 14).map(function (k) { return h("div", { class: "tlday" }, h("em", { text: k }), byDay[k].slice(0, 12).map(function (e) {
          return h("div", { class: "tl" }, h("span", { class: "tm", text: new Date(e.z).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) }),
            h("span", {}, (ttl[e.seite] || e.seite) + " · " + (tt[e.seite + "|" + e.thema] || e.thema || ""), e.item ? [" · ", tipId(e.item) || e.item] : null),
            h("span", { class: "tv", text: e.typ === "fertig" ? "✓ fertig" : e.wert != null ? (e.max ? e.wert + "/" + e.max : String(e.wert)) : e.typ })); }), byDay[k].length > 12 ? h("div", { class: "muted", text: "… " + (byDay[k].length - 12) + " weitere" }) : null); })
        : h("p", { class: "muted", text: "Noch keine Einträge auf den neuen Portal-Seiten (Altdaten siehe oben)." })));
    }
    if (S.dashFokus) { var fk = S.dashFokus; setTimeout(function () { var el = document.querySelector('.sheet .kfh-det[data-seite="' + fk + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }, 30); }
    function close() { if (window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } S.dashDetail = ""; render(); }
    return h("div", { class: "sheet-bg", onclick: function (e) { if (e.target === e.currentTarget) close(); } },
      h("div", { class: "sheet glass", role: "dialog", "aria-modal": "true", "aria-label": "Details " + st.anzeige },
        h("div", { class: "sh-top" }, h("div", {}, h("h3", { text: st.anzeige }), h("div", { class: "s muted", text: "Klasse " + st.klasse + " · zuletzt aktiv: " + (st.zuletzt ? fdt(st.zuletzt) + " (" + ago(st.zuletzt) + ")" : "noch nie") })),
          h("div", { class: "sh-actions" },
            window.KFDruck ? h("button", { class: "btn small", type: "button", id: "kfdPrintOne", text: "Als PDF speichern",
              onclick: function (ev) { ev.stopPropagation(); KFDruck.printOne(d, st, v, { cls: cls, ctext: ctext, cdesc: cdesc, r1: r1, fdt: fdt }); } }) : null,
            h("button", { class: "btn ghost small", text: "Schließen", onclick: close }))), body));
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.dashDetail) { S.dashDetail = ""; render(); } });
  /* 24.11.2026 (t390u): Tabellen-Leiste direkt an der Tabelle – Spalten (Typ/Thema/Seite), Ansicht kurz (1 Spalte je Seite) oder alle Teilspalten,
     Schülersuche, Schnellfilter, Sortierung. Merkt sich Spalten-Auswahl + Ansicht je Klasse (localStorage LS_TAB, neuer Schlüssel; nur Anzeige-Einstellungen,
     keine Schülerdaten). Kopfzeile und Namensspalte bleiben beim Scrollen stehen; die Tabelle scrollt in ihrem Kasten. */
  var LS_TAB = "kf_dash_tabelle_v1";
  function tabAll() { var o = lsGet(LS_TAB); return o && typeof o === "object" && o.k && typeof o.k === "object" ? o : { v: 1, k: {} }; }
  function tabKey() { return (S.schulform || "-") + "|" + (S.dashKlasse || "*"); }
  function tabSave() { var o = tabAll(); o.k[tabKey()] = { typ: S.dashTyp || "", thema: S.dashThema || "", seite: S.dashSeite || "", ansicht: S.dashAnsicht || "kurz" }; lsSet(LS_TAB, o); }
  function tabRestore() {
    var key = tabKey() + "|" + (S.sess && S.sess.token || ""); if (S._tabKey === key) return; S._tabKey = key;
    var x = tabAll().k[tabKey()] || {}, d = S.dash;
    S.dashTyp = { themen: 1, tests: 1, ha: 1 }[x.typ] ? x.typ : ""; S.dashThema = x.thema || ""; S.dashAnsicht = x.ansicht === "alle" ? "alle" : "kurz";
    var ok = (d.seiten || []).some(function (p) { return p.key === x.seite && inForm(p) && (!S.dashKlasse || (p.klassen || []).indexOf(S.dashKlasse) >= 0); });
    S.dashSeite = ok ? x.seite : ""; S.dashSuche = ""; S.dashZeige = "";
  }
  function tabSchmal() { try { return window.matchMedia("(max-width:520px)").matches; } catch (e) { return false; } }
  function tabNorm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function tabSeiteZelle(d, z, p, th) {   // eine Spalte je Seite: Gesamt/Ergebnis-Zelle, sonst Ø der Teilspalten
    var g = z[p.key + "|gesamt"] || z[p.key + "|ergebnis"]; if (g) return g;
    var ps = [], beg = 0, n = 0; th.forEach(function (t) { if (t.seite !== p.key) return; n++; var c = z[p.key + "|" + t.thema]; if (!c) return; beg++; if (c.pct != null) ps.push(c.pct); else if (c.status === "fertig") ps.push(100); });
    if (!beg) return null;
    var avg = ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : null;
    return avg == null ? { status: "begonnen" } : { pct: avg, skala: "pct", _txt: beg + " von " + n + " Teilen bearbeitet" };
  }
  function tabZeigeOk(d, s) {
    if (S.dashZeige === "u50") return !s._any || s._score < 50;
    if (S.dashZeige === "ohne") return !s._any;
    if (S.dashZeige === "meld") { var m = meldOf(s.id); return !!(m && m.offen); }
    if (S.dashZeige === "inaktiv") return !aktiv7(d, s);
    return true;
  }
  function tabSucheAnwenden(box) {
    var q = tabNorm(S.dashSuche).trim(), rows = box.querySelectorAll("tbody tr.rw"), n = 0;
    Array.prototype.forEach.call(rows, function (r) { var hit = !q || r.getAttribute("data-nm").indexOf(q) >= 0; r.hidden = !hit; if (hit) n++; });
    var c = box.querySelector(".tb-n"); if (c) c.textContent = n + " von " + box.getAttribute("data-gesamt") + " Schülern";
    var e = box.querySelector(".tb-leer"); if (e) e.hidden = n > 0;
  }
  /* Spaltenköpfe der Kurz-Ansicht: weiche Trennstellen (Silben V-K-V + häufige Wortanfänge), damit lange Titel schmal umbrechen */
  var TAB_PRE = /^(Selbst|Wieder|Diagnose|Realschul|Prüfungs|Nach|Haus|Test|Mini)(?=[a-zäöüß]{3,})/i;
  function tabKurzTitel(t) { return String(t || "").replace(/[A-Za-zÄÖÜäöüß]{8,}/g, function (w) {
    var m = TAB_PRE.exec(w), pre = m ? m[1] : "", rest = w.slice(pre.length);
    rest = rest.replace(/([a-zäöüß]{3,})(keit|heit|schaft|karten|abschluss|aufgaben)$/i, "$1\u00ad$2").replace(/([aeiouäöüy])([bdfgklmnprstvwzß])(?=[aeiouäöüy][a-zäöüß])/gi, "$1\u00ad$2");
    return pre ? pre + "\u00ad" + rest : rest; }); }
  function dashTabelle(d, v) {
    var fokus = !!S.dashSeite, kurz = !fokus && S.dashAnsicht !== "alle";
    var seitenListe = (S.dashKlasse ? d.seiten.filter(function (s) { return inForm(s) && (s.klassen || []).indexOf(S.dashKlasse) >= 0; }) : d.seiten.filter(inForm)).filter(function (s) { return dashTypOk(s) && dashThemaOk(s); });
    var fl = dashFilterLeiste(d);
    var seiteSel = chipRow([["", "Alle Seiten"]].concat(seitenListe.map(function (s) { return [s.key, s.titel]; })), S.dashSeite, function (k) { S.dashSeite = k; tabSave(); render(); }, "Seite / Test", "dseite");
    var meld = !!d.meldungen;
    var zeigeSel = wahlSel("Schüler zeigen", "dzeige", [["", "Alle"], ["u50", "Ø unter 50 %"], ["ohne", "noch ohne Fortschritt"], ["inaktiv", "7 Tage nicht aktiv"]].concat(meld ? [["meld", "mit offener Meldung"]] : []), S.dashZeige || "", function (k) { S.dashZeige = k; render(); });
    var sortSel = chipRow([["name", "Name"], ["zuletzt", "Zuletzt aktiv"], ["fortschritt", "Fortschritt"], ["aktiv", "Aktivität"]], S.dashSort, function (k) { S.dashSort = k; render(); }, "Sortieren", "dsort");
    var such = h("input", { type: "search", class: "tb-such", placeholder: "Name suchen …", "aria-label": "Schüler suchen", value: S.dashSuche || "", autocomplete: "off" });
    var ansicht = fokus ? h("div", { class: "wahl-f f-dans" }, h("span", { class: "wahl-l", text: "Ansicht" }),
        h("button", { class: "btn small tb-zur", type: "button", text: "← Alle Seiten", title: "Zurück zur Übersicht aller Seiten", onclick: function () { S.dashSeite = ""; tabSave(); render(); } }))
      : h("div", { class: "wahl-f f-dans" }, h("span", { class: "wahl-l", text: "Ansicht" }), h("div", { class: "seg", role: "group", "aria-label": "Ansicht" },
        [["kurz", "Kurz", "Eine Spalte je Seite (Klick auf eine Seite zeigt ihre Teilspalten)"], ["alle", "Alle Spalten", "Alle Teilspalten nebeneinander"]].map(function (o) {
          return h("button", { type: "button", class: "seg-b" + ((kurz ? "kurz" : "alle") === o[0] ? " on" : ""), "aria-pressed": (kurz ? "kurz" : "alle") === o[0] ? "true" : "false", title: o[2], text: o[1], onclick: function () { S.dashAnsicht = o[0]; tabSave(); render(); } }); })));
    var rows = v.sch.filter(function (s) { return tabZeigeOk(d, s); });
    var hasM = meld, firstTh = {}; v.th.forEach(function (t) { if (!firstTh[t.seite]) firstTh[t.seite] = t; });
    var pagesMit = v.pages.filter(function (p) { return v.th.some(function (t) { return t.seite === p.key; }); });
    var head1 = [h("th", { class: "l", rowspan: kurz ? null : "2", title: "Aktivität: Ø Minuten pro Tag, letzte 7 Tage, Ziel " + AK_ZIEL + " · Pfeil = Trend gegen die 7 Tage davor · x/7 = aktive Tage" }, "Schüler ", h("span", { class: "akh", text: "· Ø min/Tag" }))], head2 = [];
    var fokusBtn = function (p, txt, extra) { return h("button", { type: "button", class: "pgb", title: (fokus ? "" : "Nur diese Seite mit allen Teilspalten zeigen · ") + p.titel, text: txt, onclick: function (e) { e.stopPropagation(); S.dashSeite = fokus ? "" : p.key; tabSave(); render(); } }, extra); };
    if (kurz) pagesMit.forEach(function (p) { head1.push(h("th", { class: "pg kz" }, fokusBtn(p, tabKurzTitel(p.titel)))); });
    else {
      pagesMit.forEach(function (p) { var n = v.th.filter(function (t) { return t.seite === p.key; }).length; head1.push(h("th", { class: "pg", colspan: String(n) }, fokus ? h("span", { text: p.titel, title: p.key }) : fokusBtn(p, p.titel))); });
      v.th.forEach(function (t) { head2.push(h("th", { text: t.label, title: (v.byKey[t.seite] ? v.byKey[t.seite].titel + " · " : "") + t.label })); });
    }
    var rs = kurz ? null : "2";
    head1.push(h("th", { rowspan: rs, text: "Ø", title: "Durchschnitt der sichtbaren Seiten" })); if (hasM) head1.push(h("th", { rowspan: rs, text: "⚑", title: "Fehler-Meldungen offen" }));
    head1.push(h("th", { rowspan: rs, text: "Zuletzt" }));
    var q = tabNorm(S.dashSuche).trim();
    var tbl = h("table", { class: kurz ? "kurz" : "" }, h("thead", {}, h("tr", {}, head1), kurz ? null : h("tr", {}, head2)),
      h("tbody", {}, rows.map(function (s) {
        var z = d.zellen[s.id] || {}, nm = tabNorm(s.anzeige);
        var cells = kurz ? pagesMit.map(function (p) { var c = tabSeiteZelle(d, z, p, v.th), hb = window.KFHilfe && S.hilfe ? KFHilfe.zelle(h, S.hilfe, p.key, s.id) : null;
              return h("td", { class: cls(c), title: p.titel + ": " + (c && c._txt ? "Ø " + r1(c.pct) + " % · " + c._txt : cdesc(c)) + (c && c.zuletzt ? " · " + fdt(c.zuletzt) : "") + (hb ? " · " + hb.title : "") }, ctext(c), hb); })
          : v.th.map(function (t) { var c = z[t.seite + "|" + t.thema], hb = firstTh[t.seite] === t && window.KFHilfe && S.hilfe ? KFHilfe.zelle(h, S.hilfe, t.seite, s.id) : null;
              return h("td", { class: cls(c), title: t.label + ": " + cdesc(c) + (c && c.zuletzt ? " · " + fdt(c.zuletzt) : "") + (hb ? " · " + hb.title : "") }, ctext(c), hb); });
        return h("tr", { class: "rw", "data-nm": nm, hidden: q && nm.indexOf(q) < 0 ? true : null, onclick: function () { openDetail(s.id); } }, h("th", { class: "l" }, h("div", { class: "nmrow" }, h("button", { class: "nm", type: "button", text: s.anzeige, title: "Klasse " + s.klasse + " – Details" }), !S.dashKlasse && h("small", { text: " " + s.klasse }), akChip(d, s.id))),
          cells,
          h("td", { class: "avg " + (s._any ? cls({ pct: s._score, skala: "pct" }) : "c0"), text: s._any ? String(Math.round(s._score)) : "–", title: "Ø " + r1(s._score) + " %" }),
          hasM ? (function () { var m = meldOf(s.id); return h("td", { class: m.offen ? "mh" : "c0", text: m.gesamt ? String(m.offen) : "", title: m.gesamt ? m.offen + " offen von " + m.gesamt : "keine Meldungen" }); })() : null,
          h("td", { class: "lt", text: ago(s._last), title: s._last ? fdt(s._last) : "keine Aktivität" }));
      })));
    var leer = !v.sch.length || !v.th.length;
    var box = h("div", { class: "tabbox glass" },
      h("div", { class: "wahl tb-leiste", role: "group", "aria-label": "Tabelle filtern" },
        fl[0], h("label", { class: "wahl-f f-dsuch" }, h("span", { class: "wahl-l", text: "Schüler" }), such), ansicht,
        tabSchmal() ? h("details", { class: "tb-mehr", open: S.dashMehr ? true : null, ontoggle: function (e) { S.dashMehr = e.currentTarget.open; } },   // Handy: weitere Filter eingeklappt
          h("summary", { text: "Weitere Filter" + (S.dashThema || S.dashSeite || S.dashZeige || (S.dashSort && S.dashSort !== "name") ? " (aktiv)" : "") }),
          h("div", { class: "tb-mehr-in" }, fl[1], seiteSel, zeigeSel, sortSel)) : [fl[1], seiteSel, zeigeSel, sortSel]),
      h("div", { class: "tb-info muted" }, h("span", { class: "tb-n", text: rows.length + " von " + v.sch.length + " Schülern" }),
        h("span", { text: " · " + (kurz ? pagesMit.length + (pagesMit.length === 1 ? " Seite" : " Seiten") + " (je 1 Spalte – Seitentitel antippen für die Teilspalten)" : fokus ? v.th.length + " Spalten dieser Seite" : v.th.length + " Spalten") })),
      leer ? h("div", { class: "empty" }, h("p", { class: "muted", text: "Für diese Auswahl gibt es keine Schüler oder Spalten." })) : h("div", { class: "heat" }, tbl),
      h("p", { class: "tb-leer muted", hidden: rows.length ? true : null, text: "Kein Schüler passt zu dieser Auswahl." }));
    var hilfeSeiten = window.KFHilfe && S.hilfe ? pagesMit.filter(function (p) { return S.hilfe[p.key]; }).length : 0;   // 24.11.2026 (t393u): Legende zum „Wie gelöst?“-Balken in den Kästchen
    if (hilfeSeiten && !leer) box.appendChild(h("div", { class: "tb-hleg", title: "Der kleine Balken im Kästchen zeigt je Schüler und Seite, wie die Aufgaben gelöst wurden (Tooltip: Anzahl, Tipps, Lösungen)." },
      h("b", { text: "Balken im Kästchen = wie gelöst:" }), ["sofort", "versuche", "tipp", "loesung"].map(function (k) { var x = KFHilfe.ST[k]; return h("span", {}, h("i", { style: "background:" + x.c }), x.l); })));
    box.setAttribute("data-gesamt", String(v.sch.length));
    such.addEventListener("input", function () { S.dashSuche = such.value; tabSucheAnwenden(box); });
    if (q) tabSucheAnwenden(box);
    return box;
  }

  function teacherDash() {
    if (!S.dash) {
      if (S.dashLoading) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Fortschritt wird geladen … (beim ersten Mal ca. 5–10 Sekunden)" }));
      return h("div", { class: "glass empty" }, h("p", { class: "muted", text: S.dashErr || "Noch keine Daten." }), h("div", { style: "margin-top:12px" }, h("button", { class: "btn small", text: "Erneut versuchen", onclick: function () { loadDash(true); } })));
    }
    if (!S.dash.seiten) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: "Das Backend liefert noch keine Altdaten (neue Code.gs-Version fehlt, siehe DEPLOY-dashboard.md)." }));
    var d = S.dash; tabRestore(); var now = Date.now(), week = 0, started = 0;
    var vU = dashView(true), lzBox = lzOk(d) && vU.sch.length ? lzKlassenBox(d, vU) : null;   // 24.11.2026: Überblick unabhängig von den Tabellenfiltern
    var v = dashView();
    v.sch.forEach(function (s) { if (aktiv7(d, s)) week++; if (s._any) started++; });
    var bad = (d.quellen || []).filter(function (q) { return !q.ok; });
    var srcLine = h("div", { class: "src" }, "Stand " + new Date(d.erzeugt || now).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " · ",
      (d.quellen || []).map(function (q) { return h("span", { class: q.ok ? "ok" : "bad", title: q.ok ? (q.n + " Zeilen gelesen" + (q.zugeordnet != null ? ", " + q.zugeordnet + " zugeordnet" : "") + (q.nichtZugeordnet ? ", " + q.nichtZugeordnet + " nicht zuordenbar" : "")) : (q.fehler || "nicht lesbar"), text: (q.ok ? "✓ " : "⚠ ") + q.titel.replace(/ \(.*\)/, "") + " "}); }),
      h("button", { class: "btn ghost small", disabled: S.dashLoading ? true : null, text: S.dashLoading ? "Lädt …" : "↻ Aktualisieren", onclick: function () { loadDash(true); } }));
    var tb = dashTabelle(d, v);
    return h("div", {}, wahlLeiste(bereichSel(), klasseSel(v.klassen, S.dashKlasse, function (k) { S.dashKlasse = k; render(); })),
      bad.length > 0 && h("div", { class: "banner", text: "Nicht lesbar: " + bad.map(function (q) { return q.titel; }).join(", ") + ". Die übrigen Daten sind trotzdem aktuell. (Zugriff/Freigabe prüfen, dann „Aktualisieren“.)" }),
      srcLine,
      window.KFDruck ? h("div", { class: "dprintbar" },
        h("button", { class: "btn small", type: "button", id: "kfdPrintAll", text: "Alle Bewertungen ausdrucken", title: "Eine Datei: Klassenübersicht und ein Blatt je sichtbarem Schüler (A4, Drucken / Als PDF speichern).",
          onclick: function () { KFDruck.printAll(d, v, { cls: cls, ctext: ctext, cdesc: cdesc, r1: r1, fdt: fdt }); } })) : null,
      !S.dashKlasse ? classCards(d, vU) : null,
      lzBox,
      lzOk(d) && v.sch.length ? null : h("div", { class: "tiles" }, [[v.sch.length, "Schüler"], [week, "aktiv (7 Tage)"], [started, "mit Fortschritt"], [v.sch.length - started, "ohne Fortschritt"]].map(function (t) { return h("div", { class: "tile glass" }, h("b", { text: String(t[0]) }), h("span", { text: t[1] })); })),
      lzOk(d) && v.sch.length ? null : h("div", { class: "aklg", title: "Gezählt werden nur Minuten mit geöffneter Lernseite und Bedienung (Tippen/Scrollen) in der letzten Minute, nur bei Anmeldung im Portal." },
        h("span", { class: "akbar" }), h("span", { text: "Aktivität: Ø Minuten pro Tag, letzte 7 Tage, Ziel " + AK_ZIEL + " · ↑↓ Trend zu den 7 Tagen davor · x/7 aktive Tage" + (d.aktivMin && d.aktivMin.seit ? " · Messung seit " + akFmtDay(d.aktivMin.seit) : " · noch keine Daten") })),
      tb,
      lzOk(d) && v.sch.length ? null : szClassBox(d, v),
      hilfeBoxes(d, v),
      h("div", { class: "legend" }, [["c0", "nicht begonnen"], ["c1", "< 33 %"], ["c2", "33–66 %"], ["c3", "> 66 %"], ["c4", "fertig / Test ≥ 85 %"], ["cz", "Test nur begonnen"], ["cn", "Anzahl (ohne Prozent)"]].map(function (l) { return h("span", {}, h("i", { class: l[0] }), l[1]); })),
      h("p", { class: "note", text: "Zahl = Prozent bzw. Aufgaben, ✓ = fertig, Tests in Prozent (Tooltip: Punkte, Note). Klick auf einen Namen öffnet die Details mit Lernzeit und Verlauf." }),
      S.dashDetail ? detailSheet(v) : null);
  }

  boot();
})();
