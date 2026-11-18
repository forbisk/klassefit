/* Portal-Tab „Meldungen“: ALLE ⚑-Fehlermeldungen aus allen Quellen, alte wie neue, jeder Status, nach Aufgabe gruppiert.
   Quellen (18.11.2026):
   1) Selbstlern-Backend, Blatt „Meldungen“ (Prüfungsfit, Mathe-10-Selbstlernseiten): listReports / setReportStatus (Portal-Token = SSO).
   2) Portal-Backend, Blatt „Ereignisse“ (Thema "meldung": Tests, Selbstarbeit, Missionen):
      ab portal-8a admin_meldungen (alle, mit Status) / admin_meldung_status; ältere Backends: admin_hinweise (letzte 14 Tage, ohne Status).
   3) Portal-Backend „Meine Lücken“ (Blatt LueckenMeldungen): admin_luecken / admin_luecken_meldung.
   Passwort-Formular nur als Fallback ohne Portal-Sitzung (nur Quelle 1). Alle Texte nur als textContent. */
(function () {
  var URL = "https://script.google.com/macros/s/AKfycbw9iDp8f4R9eOdrTF2CfHNlv3Xn_u7IjPZUO904wGawIZZGin3M7jXTDHjktZTU3tYTDQ/exec";
  if (window.PF_REPORT_API) URL = window.PF_REPORT_API;
  if (window.PORTAL_SL_API) URL = window.PORTAL_SL_API;
  var M = { mode: "", ptoken: "", pw: "", list: null, err: "", busy: false, open: "", auto: false, src: {}, filt: "", res: {}, pst: false, ctx: null };
  var ST = { "new": "neu", confirmed: "bestätigt", rejected: "abgelehnt", fixed: "behoben" };
  var LK = { neu: "new", "bestätigt": "confirmed", abgelehnt: "rejected", behoben: "fixed" }, LK2 = { "new": "neu", confirmed: "bestätigt", rejected: "abgelehnt", fixed: "behoben" };
  var QN = { sl: "Prüfungsfit/Selbstlernen", portal: "Tests/Selbstarbeit/Missionen", luecken: "Meine Lücken" };
  function api(o) { return fetch(URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(o), redirect: "follow" }).then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "Keine Verbindung." }; }); }
  function auth(extra) {
    var o = {}; Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    if (M.mode === "ptoken" && M.ptoken) o.ptoken = M.ptoken;
    else if (M.pw) o.pw = M.pw;
    return o;
  }
  function papi(o) { var c = M.ctx; if (!c || !c.api || M.mode !== "ptoken") return Promise.resolve({ ok: false, error: "ohne Portal-Sitzung" }); o.token = M.ptoken; return c.api(o); }
  function ms(v) { if (typeof v === "number") return v; var t = Date.parse(v); return isFinite(t) ? t : 0; }
  function istTestSeite(s) { return /(^|-)(test|probetest|probe-ka|ka\d+|nachschreiben)(-|$)/.test(String(s || "")); }
  /* ---- Normalisieren: {uid, q, id, gk, gt, z, grund, kommentar, antwort, erwartet, status, test, klasse, name, info, seite, raw} ---- */
  function vonSL(r) {
    var pf = /^pf:/.test(String(r.task_id || ""));
    return { uid: "sl:" + r.report_id, q: "sl", id: r.report_id, gk: "sl:" + r.task_id, gt: (pf ? "Prüfungsfit · Aufgabe " + String(r.task_id).replace(/^pf:/, "") : String(r.task_id || "")),
      z: ms(r.created_at), grund: r.reason, kommentar: r.comment, antwort: r.given_answer, erwartet: r.expected_answer, status: ST[r.status] ? r.status : "new",
      test: r.test_status === "running" ? "running" : r.test_status === "finished" ? "finished" : "", klasse: r.class_code || "", name: "",
      info: (r.mode || "") + (r.task_variant ? " · Variante " + r.task_variant : "") + (r.seed != null && r.seed !== "" ? " / Seed " + r.seed : "") + (r.test_attempt_id ? " · Versuch " + r.test_attempt_id : ""),
      seite: pf ? "pruefungsfit-mathe" : "", link: taskUrl(r), raw: r };
  }
  function vonPortal(m, mitStatus) {
    var seite = String(m.seite || ""), item = String(m.item || ""), test = (m.art ? m.art === "test" : istTestSeite(seite));
    return { uid: "p:" + (m.id || m.rid || (seite + item + m.z + m.benutzer)), q: "portal", id: m.id || m.rid || "", gk: "p:" + seite + "|" + item, gt: String(m.titel || seite) + " · " + (item.indexOf(":") >= 0 ? item.slice(item.indexOf(":") + 1) : item),
      z: +m.z || 0, grund: m.grund, kommentar: m.kommentar, antwort: m.antwort || "", erwartet: "", status: mitStatus && ST[m.status] ? m.status : "new",
      test: test ? "running" : "", klasse: m.klasse || "", name: m.name || "", info: String(m.titel || seite), seite: seite, link: "", raw: m, ohneStatus: !mitStatus };
  }
  function vonLuecken(m) {
    var st = LK[m.status] || (m.status === "test" ? "test" : "new");
    return { uid: "lk:" + m.id, q: "luecken", id: m.id, gk: "lk:" + m.aufgabe, gt: "Meine Lücken · " + String(m.aufgabe || "").replace(/^lk:/, ""), z: +m.zeit || 0, grund: m.grund, kommentar: m.kommentar,
      antwort: m.antwort, erwartet: m.erwartet, status: st, test: "", klasse: "", name: "", info: "Lücken" + (m.seed ? " · Seed " + m.seed : ""), seite: "mathe10-luecken", link: "", raw: m };
  }
  function load(rr) {
    M.busy = true; M.err = ""; rr();
    var a = api(auth({ action: "listReports" }));
    var b = M.mode === "ptoken" ? papi({ action: "admin_meldungen" }).then(function (r) {
      if (r && r.ok) return { r: r, status: !!r.status };
      return papi({ action: "admin_hinweise", frisch: true }).then(function (r2) { return { r: r2, status: false }; });
    }) : Promise.resolve(null);
    var c = M.mode === "ptoken" ? papi({ action: "admin_luecken" }) : Promise.resolve(null);
    Promise.all([a, b, c]).then(function (x) {
      M.busy = false; var l = [], src = {};
      var r = x[0];
      if (r && r.ok) { (r.reports || []).forEach(function (y) { l.push(vonSL(y)); }); src.sl = { ok: true, n: (r.reports || []).length }; }
      else {
        var e = (r && r.error) || "Fehler";
        if (M.mode === "pw" && /berechtigt/.test(e)) { M.pw = ""; }
        if (M.mode === "ptoken" && /berechtigt|unbekannte/.test(e)) e = "Selbstlern-Backend: Portal-Sitzung nicht freigeschaltet";
        src.sl = { ok: false, err: e };
      }
      if (x[1]) {
        var pr = x[1].r;
        if (pr && pr.ok) { (pr.meldungen || []).forEach(function (y) { l.push(vonPortal(y, x[1].status)); }); src.portal = { ok: true, n: (pr.meldungen || []).length, alt: !x[1].status }; M.pst = x[1].status; }
        else src.portal = { ok: false, err: (pr && pr.error) || "Fehler" };
      }
      if (x[2]) {
        if (x[2].ok) { (x[2].meldungen || []).forEach(function (y) { l.push(vonLuecken(y)); }); src.luecken = { ok: true, n: (x[2].meldungen || []).length }; }
        else src.luecken = { ok: false, err: x[2].error || "Fehler" };
      }
      M.src = src;
      var irgendwas = Object.keys(src).some(function (k) { return src[k].ok; });
      if (irgendwas) M.list = l.sort(function (p, q) { return q.z - p.z; });
      else { M.list = null; M.err = Object.keys(src).map(function (k) { return QN[k] + ": " + src[k].err; }).join(" · ") || "Fehler"; if (M.mode === "pw") M.auto = false; }
      rr();
    });
  }
  function setSt(items, st, rr) {
    var sl = [], po = [], lk = [];
    items.forEach(function (m) { if (m.q === "sl") sl.push(m.id); else if (m.q === "portal" && M.pst && m.id) po.push(m.id); else if (m.q === "luecken") lk.push(m.id); });
    var jobs = [];
    if (sl.length) jobs.push(api(auth({ action: "setReportStatus", ids: sl, status: st })).then(function (r) { return [r, sl, "sl"]; }));
    if (po.length) jobs.push(papi({ action: "admin_meldung_status", ids: po, status: st }).then(function (r) { return [r, po, "portal"]; }));
    lk.forEach(function (id) { jobs.push(papi({ action: "admin_luecken_meldung", id: id, status: LK2[st] }).then(function (r) { return [r, [id], "luecken"]; })); });
    if (!jobs.length) return;
    Promise.all(jobs).then(function (res) {
      M.err = "";
      res.forEach(function (x) { if (x[0] && x[0].ok) M.list.forEach(function (m) { if (m.q === x[2] && x[1].indexOf(m.id) >= 0) m.status = st; }); else M.err = (x[0] && x[0].error) || "Status nicht gespeichert"; });
      rr();
    });
  }
  function taskUrl(r) { var t = String(r.task_id).replace(/^pf:/, ""); return "../pruefungsfit-mathe/#/rv/" + encodeURIComponent(t) + "/" + encodeURIComponent(r.seed) + (/^test/.test(r.task_variant) ? "/t" : ""); }
  /* Aufgabentext + Sprunglink der Portal-Seiten (gleiche Auflösung wie die Glocke) */
  function aufl(m, rr) {
    var G = window.PortalGlocke; if (m.q !== "portal" || !G || !G._aufloesen) return null;
    var k = m.seite + "|" + m.raw.item; if (M.res[k] && M.res[k].fertig) return M.res[k];
    if (!M.res[k]) {
      var p = { item: m.raw.item, seite: m.seite }; M.res[k] = G._aufloesen(p, null);
      if (G._daten && /^[a-z0-9][a-z0-9\-]*$/.test(m.seite)) G._daten(m.seite).then(function (D) { var x = D ? G._aufloesen(p, D) : M.res[k]; x.fertig = true; M.res[k] = x; rr(); });
      else M.res[k].fertig = true;
    }
    return M.res[k];
  }
  function reset() { M.mode = ""; M.ptoken = ""; M.pw = ""; M.list = null; M.err = ""; M.busy = false; M.open = ""; M.auto = false; M.src = {}; M.pst = false; }
  function fdt(z) { return z ? new Date(z).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : "–"; }
  window.PortalMeldungen = { state: M, reset: reset, taskUrl: taskUrl, view: function (h, rr, ctx) {
    ctx = ctx || {}; M.ctx = ctx;
    var sess = ctx.sess ? ctx.sess() : null;
    var tok = ctx.token ? ctx.token() : "";
    var portalLehrer = !!(sess && sess.rolle === "lehrer" && tok);

    if (portalLehrer) {
      if (M.mode !== "ptoken" || M.ptoken !== tok) {
        M.mode = "ptoken"; M.ptoken = tok; M.pw = ""; M.list = null; M.err = ""; M.auto = false;
      }
      if (!M.list && !M.busy && !M.auto) { M.auto = true; load(rr); }
    } else if (!M.pw) {
      M.mode = "pw";
      var inp = h("input", { type: "password", placeholder: "Lehrer-Passwort Selbstlernen", autocomplete: "off" });
      return h("form", { class: "glass", style: "padding:16px", onsubmit: function (e) { e.preventDefault(); M.pw = inp.value; M.mode = "pw"; M.list = null; M.auto = false; load(rr); } },
        h("p", { text: "Ohne Portal-Anmeldung lassen sich nur die Prüfungsfit-/Selbstlern-Meldungen laden. Bitte einmal das Lehrer-Passwort eingeben (wird nicht gespeichert)." }), inp, h("button", { class: "btn small", type: "submit", text: "Laden" }), M.err ? h("p", { class: "muted", text: M.err }) : null);
    } else {
      M.mode = "pw";
      if (!M.list && !M.busy && !M.auto) { M.auto = true; load(rr); }
    }

    if (!M.list) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: M.busy ? "Lädt …" : (M.err || "Keine Daten.") }),
      !M.busy && M.mode === "ptoken" ? h("button", { class: "btn ghost small", type: "button", text: "↻ Erneut laden", onclick: function () { load(rr); } }) : null);
    var list = M.list.filter(function (m) { return !M.filt || (M.filt === "offen" ? m.status === "new" : m.status === M.filt); });
    var g = {}, gt = {}; list.forEach(function (r) { (g[r.gk] = g[r.gk] || []).push(r); gt[r.gk] = r.gt; });
    var keys = Object.keys(g).sort(function (a, b) { return g[b].length - g[a].length || g[b][0].z - g[a][0].z || (a < b ? -1 : 1); });
    var quellen = Object.keys(M.src).map(function (k) { var s = M.src[k]; return QN[k] + ": " + (s.ok ? s.n + (s.alt ? " (nur 14 Tage)" : "") : "⚠ " + s.err); }).join(" · ");
    var filt = [["", "Alle"], ["offen", "offen"], ["confirmed", "bestätigt"], ["rejected", "abgelehnt"], ["fixed", "behoben"]].map(function (f) {
      var n = f[0] === "" ? M.list.length : M.list.filter(function (m) { return f[0] === "offen" ? m.status === "new" : m.status === f[0]; }).length;
      return h("button", { class: "btn small" + (M.filt === f[0] ? "" : " ghost"), type: "button", text: f[1] + " (" + n + ")", onclick: function () { M.filt = f[0]; rr(); } }); });
    var top = h("div", { class: "glass", style: "padding:10px 14px" },
      h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, h("b", { text: list.length + " Meldungen · " + keys.length + " Aufgaben" }),
        h("button", { class: "btn ghost small", type: "button", text: M.busy ? "Lädt …" : "↻ Aktualisieren", onclick: function () { load(rr); } })),
      h("div", { class: "mbtns" }, filt),
      h("div", { class: "muted", style: "font-size:.85rem;margin-top:4px", text: "Quellen – " + quellen }),
      M.err ? h("div", { class: "muted", text: "⚠ " + M.err }) : null);
    if (!keys.length) return h("div", { class: "meld" }, top, h("div", { class: "glass empty" }, h("p", { class: "muted", text: M.filt ? "Keine Meldungen mit diesem Status." : "Noch keine Meldungen." })));
    return h("div", { class: "meld" }, top, keys.map(function (k) {
      var l = g[k], test = l.filter(function (r) { return r.test === "running"; }).length, offen = l.filter(function (r) { return r.status === "new"; }).length;
      var aendb = l.filter(function (r) { return !(r.q === "portal" && !M.pst) && r.status !== "test"; });
      var det = M.open === k ? h("div", { class: "mdet" }, l.map(function (r) {
        var res = aufl(r, rr), link = r.link || (res && res.link) || "";
        var frage = res && (res.text || res.ort) ? (res.ort ? res.ort : "") + (res.text ? " – „" + res.text + "“" : "") : "";
        var darf = !(r.q === "portal" && !M.pst) && r.status !== "test";
        return h("div", { class: "mrow" },
          h("div", {}, h("b", { text: r.grund || "–" }), r.test === "running" ? h("span", { class: "mbadge", text: "⏱ im laufenden Test" }) : r.test === "finished" ? h("span", { class: "mbadge f", text: "nach Test" }) : null,
            h("span", { class: "mbadge f", text: ST[r.status] || r.status }),
            h("span", { class: "muted", text: " · " + fdt(r.z) + (r.name ? " · " + r.name : "") + " · Klasse " + (r.klasse || "–") })),
          frage ? h("div", { class: "muted", text: "Frage: " + frage }) : null,
          h("div", { class: "muted", text: "Seite: " + (r.info || "–") + " · Quelle: " + QN[r.q] }),
          h("div", { class: "muted", text: "Antwort: " + (r.antwort || "–") + (r.erwartet ? " · erwartet: " + r.erwartet : "") }),
          r.kommentar ? h("div", { class: "mcom", text: "Kommentar: „" + r.kommentar + "“" }) : null,
          h("div", { class: "mbtns" }, link ? h("a", { class: "btn ghost small", href: link, target: "_blank", rel: "noopener", text: r.q === "sl" ? "Aufgabe (genaue Variante) öffnen" : "Aufgabe öffnen" }) : null,
            darf ? Object.keys(ST).map(function (s) { return h("button", { class: "btn small" + (r.status === s ? "" : " ghost"), type: "button", text: ST[s], onclick: function () { setSt([r], s, rr); } }); })
              : h("span", { class: "muted", text: r.status === "test" ? "Testmeldung" : "Status speichern: braucht Portal-Backend portal-8a" })));
      }), aendb.length ? h("div", { class: "mbtns" }, h("span", { class: "muted", text: "Alle dieser Aufgabe: " }), Object.keys(ST).map(function (s) { return h("button", { class: "btn ghost small", type: "button", text: ST[s], onclick: function () { setSt(aendb, s, rr); } }); })) : null) : null;
      return h("div", { class: "glass mgrp" }, h("button", { class: "mhead", type: "button", onclick: function () { M.open = M.open === k ? "" : k; rr(); } },
        h("span", { class: "mcnt", text: String(l.length) }), h("b", { text: gt[k] }), test ? h("span", { class: "mbadge", text: "⏱ " + test + "× im Test" }) : null, h("span", { class: "muted", text: offen + " neu · zuletzt " + fdt(l[0].z) })), det);
    }));
  } };
})();
