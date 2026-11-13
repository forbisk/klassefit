/* Portal: „Neue Antwort von Herrn Kurlavičius“ für Schüler (10a, 7a + Testkonten).
   Identität kommt aus der Portal-Sitzung – keine zweite Anmeldung: vorhandene Selbstlern-Sitzung (sl10a_sess) desselben Benutzers wird
   nur gelesen; sonst holt das Portal per Aktion "sso" (Portal-Token, serverseitig geprüft) ein eigenes Selbstlern-Token und merkt es unter
   kf_antw_sess (nie in sl10a_sess, damit Fortschrittsdaten der Seiten unberührt bleiben). Liste: myQuestions; gelesen: kf-antworten.js. */
(function () {
  "use strict";
  var K = function () { return window.KFAntworten; };
  var URL = window.PORTAL_SL_API || "", OWN = "kf_antw_sess";
  var A = { list: null, user: "", token: "", pu: "", busy: false, err: "", offen: true };
  function j(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function api(o) { return fetch(URL, { method: "POST", body: JSON.stringify(o), redirect: "follow" }).then(function (r) { return r.json(); }); }
  function passt(slUser, benutzer) { slUser = String(slUser || "").toLowerCase(); benutzer = String(benutzer || "").toLowerCase();
    return !!slUser && (slUser === benutzer || slUser === benutzer.replace(/\.10a$/, "") || slUser === benutzer.replace(/[^a-z0-9._-]/g, "").slice(0, 40)); }
  /* Klassen mit Fragen-Knopf: 10a (Selbstlernseiten) und 7a (Fit für die KA, kf-fragen.js). Lehnt das Backend ab, bleibt die Liste still leer. */
  var KLASSEN = { "10a": 1, "7a": 1 };
  function berechtigt(s) { return !!s && s.rolle !== "lehrer" && (KLASSEN[String(s.klasse || "").toLowerCase()] === 1 || s.rolle === "test" || /^test\./.test(String(s.benutzer || ""))); }
  function kandidaten(s) {
    var out = [], sl = j("sl10a_sess"), own = j(OWN);
    if (sl && sl.token && passt(sl.user, s.benutzer)) out.push({ user: sl.user, token: sl.token });
    if (own && own.token && own.pu === s.benutzer) out.push({ user: own.user, token: own.token });
    return out;
  }
  function holen(s, kand) {
    if (kand.length) { var c = kand.shift();
      return api({ action: "myQuestions", user: c.user, token: c.token }).then(function (r) {
        if (r && r.ok) return { c: c, r: r };
        if (r && /unbekannte Aktion/.test(r.error || "")) return null;
        return holen(s, kand); }); }
    return api({ action: "sso", ptoken: s.token }).then(function (r) {
      if (!r || !r.ok || !r.token) return null;
      var c = { user: r.user, token: r.token }; try { localStorage.setItem(OWN, JSON.stringify({ pu: s.benutzer, user: r.user, token: r.token })); } catch (e) {}
      return api({ action: "myQuestions", user: c.user, token: c.token }).then(function (q) { return q && q.ok ? { c: c, r: q } : null; });
    });
  }
  function load(sess, render) {
    if (!K() || !URL || !berechtigt(sess) || A.busy) return;
    if (A.pu === sess.benutzer && A.list) return;
    A.busy = true; A.pu = sess.benutzer;
    holen(sess, kandidaten(sess)).then(function (x) {
      A.busy = false; if (!x) { A.list = []; return; }
      A.user = x.c.user; A.token = x.c.token; A.list = x.r.questions || []; render();
    }).catch(function () { A.busy = false; A.list = []; });
  }
  function gelesen(ids, render) { K().gelesen(api, A.user, A.token, ids); render(); }
  function view(h, sess, render) {
    if (!sess || !berechtigt(sess)) return null;
    load(sess, render);
    if (!A.list || A.pu !== sess.benutzer) return null;
    var n = K().neu(A.list, A.user); if (!n.length) return null;
    var items = n.map(function (q) {
      return h("div", { class: "kfa-it" },
        h("div", { class: "kfa-ti", text: K().aufgabe(q) }),
        h("div", { class: "kfa-fr" }, h("b", { text: "Deine Frage: " }), K().kurz(q.frage, 160)),
        h("div", { class: "kfa-an" }, h("b", { text: "Antwort: " }), K().kurz(q.antwort, 260)),
        h("div", { class: "kfa-act" },
          h("a", { class: "btn", href: K().link(q, "portal"), text: "Zur Aufgabe ›", onclick: function () { K().gelesen(api, A.user, A.token, [q.id]); } }),
          h("button", { class: "btn ghost", type: "button", text: "Gelesen ✓", onclick: function () { gelesen([q.id], render); } })));
    });
    return h("section", { class: "glass kfa", role: "status" },
      h("div", { class: "kfa-h" }, h("h2", {}, "💬 Neue Antwort von Herrn Kurlavičius ", h("span", { class: "kfa-n", text: String(n.length) })),
        n.length > 1 && h("button", { class: "btn ghost", type: "button", text: "Alle als gelesen", onclick: function () { gelesen(n.map(function (q) { return q.id; }), render); } })),
      items);
  }
  function reset() { A.list = null; A.user = ""; A.token = ""; A.pu = ""; try { localStorage.removeItem(OWN); } catch (e) {} }
  window.PortalAntworten = { view: view, reset: reset, _state: A };
})();
