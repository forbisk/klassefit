/* Lehrerportal-Glocke (10.11.2026): Hinweis auf neue Schülerfragen (Selbstlern-Backend, listQuestions/answer per Portal-Token)
   und neue ⚑-Meldungen (Selbstlern-Backend listReports, Status „neu“; Portal-Seiten über admin_hinweise ab portal-7n).
   „Neu“ = Frage noch unbeantwortet ODER seit dem letzten Öffnen der Glocke eingegangen; Meldung mit Status „neu“ bzw. seit dem letzten Öffnen.
   Zuletzt-angesehen nur im Browser (localStorage kf_lehrer_glocke_v1, nur Zeitstempel). Abruf beim Öffnen des Portals und alle 2 Min. bei sichtbarem Tab.
   Nur lesen + Antworten (gleiche Aktion wie lehrer.html). Alles als Text (textContent), keine Daten in Logs. */
(function () {
  "use strict";
  var SL = window.PORTAL_SL_API || "", LS = "kf_lehrer_glocke_v1", EVERY = 120000;
  var G = { ctx: null, q: null, r: null, p: null, err: "", busy: false, last: 0, toast: false, timer: null, panel: null, tok: "" };
  function lsGet() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  /* Erstes Mal auf diesem Gerät: nur die letzten 3 Tage gelten als „neu“ (sonst wären alle alten Fragen neu) */
  function seen() { var v = +lsGet().seen || 0; if (!v) { v = Date.now() - 3 * 86400e3; setSeen(v); } return v; }
  function setSeen(t) { try { var o = lsGet(); o.seen = t; localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function post(url, body) {
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 30000);
    return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { if (t) clearTimeout(t); return j; }, function () { if (t) clearTimeout(t); return { ok: false, error: "Keine Verbindung" }; });
  }
  function lehrer() { var s = G.ctx && G.ctx.sess(); return !!(s && s.rolle === "lehrer" && G.ctx.token()); }
  function ms(v) { return typeof v === "number" ? v : (Date.parse(v) || 0); }
  /* ---- Zählung ---- */
  function items() {
    var sn = seen(), out = [];
    (G.q || []).forEach(function (q) { var z = ms(q.zeit), offen = !q.antwort; if (offen || z > sn) out.push({ art: "frage", z: z, neu: z > sn, offen: offen, q: q }); });
    (G.r || []).forEach(function (r) { var z = ms(r.created_at), offen = r.status === "new"; if (offen || z > sn) out.push({ art: "meldung", z: z, neu: z > sn, offen: offen, r: r }); });
    (G.p || []).forEach(function (m) { var z = ms(m.z); if (z > sn) out.push({ art: "pmeldung", z: z, neu: true, offen: false, m: m }); });
    out.sort(function (a, b) { return (b.offen - a.offen) || (b.z - a.z); });
    return out;
  }
  function counts() { var l = items(), c = { n: l.length, neu: 0, fragen: 0, meld: 0 }; l.forEach(function (x) { if (x.neu) c.neu++; if (x.art === "frage") c.fragen++; else c.meld++; }); return c; }
  function paint() {
    var c = counts(), btns = document.querySelectorAll(".kfg-btn");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], badge = b.querySelector(".kfg-n");
      b.classList.toggle("on", c.n > 0);
      badge.textContent = c.n > 99 ? "99+" : String(c.n); badge.hidden = !c.n;
      var t = c.n ? (c.fragen ? c.fragen + (c.fragen === 1 ? " Frage" : " Fragen") : "") + (c.fragen && c.meld ? " und " : "") + (c.meld ? c.meld + (c.meld === 1 ? " Meldung" : " Meldungen") : "") + " – ansehen" : (G.err ? "Hinweise: " + G.err : "Keine neuen Fragen oder Meldungen");
      b.title = t; b.setAttribute("aria-label", "🔔 " + t);
    }
    if (G.panel) fillPanel();
  }
  function toast(txt) {
    var d = document.createElement("div"); d.className = "kfg-toast"; d.setAttribute("role", "status"); d.textContent = txt;
    d.onclick = function () { d.remove(); openPanel(); }; document.body.appendChild(d); setTimeout(function () { try { d.remove(); } catch (e) {} }, 6000);
  }
  /* ---- Laden ---- */
  function load(force) {
    if (!lehrer() || G.busy) return Promise.resolve();
    if (!force && Date.now() - G.last < 30000) return Promise.resolve();
    G.busy = true; var tok = G.ctx.token();
    var a = SL ? post(SL, { action: "listQuestions", ptoken: tok }) : Promise.resolve({ ok: false });
    var b = SL ? post(SL, { action: "listReports", ptoken: tok }) : Promise.resolve({ ok: false });
    var c = G.ctx.api({ action: "admin_hinweise", token: tok });
    return Promise.all([a, b, c]).then(function (r) {
      G.busy = false; G.last = Date.now(); G.err = "";
      if (r[0] && r[0].ok) G.q = r[0].questions || []; else if (!G.q) G.err = "Fragen nicht ladbar";
      if (r[1] && r[1].ok) G.r = r[1].reports || [];
      if (r[2] && r[2].ok) G.p = r[2].meldungen || [];   // altes Backend (bis portal-7m): „unbekannte Aktion“ → ohne Portal-Meldungen
      if (r[2] && r[2].relogin && G.ctx.relogin) G.ctx.relogin();
      var c2 = counts();
      if (!G.toast && c2.neu > 0) { G.toast = true; toast("🔔 " + c2.neu + (c2.neu === 1 ? " neue Frage/Meldung" : " neue Fragen/Meldungen") + " – tippen zum Ansehen"); }
      paint();
    });
  }
  function startPoll() {
    if (G.timer) return;
    G.timer = setInterval(function () { if (document.visibilityState === "visible") load(false); }, EVERY);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && Date.now() - G.last > EVERY) load(false); });
  }
  /* ---- Liste ---- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fdt(z) { return z ? new Date(z).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : ""; }
  function frageRow(x) {
    var q = x.q, K = window.KFAntworten, row = el("div", "kfg-it" + (x.offen ? " offen" : ""));
    var kopf = el("div", "kfg-kopf"); kopf.appendChild(el("span", "kfg-typ", x.offen ? "❓ Frage · offen" : "❓ Frage · beantwortet")); if (x.neu) kopf.appendChild(el("span", "kfg-neu", "neu"));
    kopf.appendChild(el("span", "muted", (q.name ? q.name + " · " : "") + fdt(x.z))); row.appendChild(kopf);
    row.appendChild(el("div", "kfg-auf", K ? K.aufgabe(q) : String(q.taskId || "")));
    row.appendChild(el("div", "kfg-txt", "„" + String(q.frage || "") + "“"));
    var acts = el("div", "kfg-acts");
    if (K) { var a = el("a", "btn ghost small", "Zur Aufgabe ›"); a.href = K.link(q, "portal"); a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
    if (q.antwort) { row.appendChild(el("div", "kfg-ans", "Antwort: " + String(q.antwort).replace(/^'/, ""))); row.appendChild(acts); return row; }
    var ta = el("textarea", "kfg-ta"); ta.rows = 3; ta.maxLength = 8000; ta.placeholder = "Antwort an die Schülerin / den Schüler …";
    if (G.draft && G.draft[q.id]) ta.value = G.draft[q.id];
    ta.oninput = function () { (G.draft = G.draft || {})[q.id] = ta.value; };
    var msg = el("span", "muted"), send = el("button", "btn small", "Antwort senden"); send.type = "button";
    send.onclick = function () {
      var t = ta.value.trim(); if (!t) { msg.textContent = "Bitte eine Antwort schreiben."; return; }
      send.disabled = true; msg.textContent = "wird gesendet …";
      post(SL, { action: "answer", ptoken: G.ctx.token(), id: q.id, answer: t }).then(function (r) {
        send.disabled = false;
        if (r && r.ok) { q.antwort = t; q.status = "beantwortet"; q.beantwortet = Date.now(); if (G.draft) delete G.draft[q.id]; msg.textContent = "✓ gesendet"; paint(); }
        else msg.textContent = "⚠ " + ((r && r.error) || "nicht gesendet");
      });
    };
    row.appendChild(ta); acts.appendChild(send); acts.appendChild(msg); row.appendChild(acts);
    return row;
  }
  function meldRow(x) {
    var r = x.r, row = el("div", "kfg-it" + (x.offen ? " offen" : ""));
    var kopf = el("div", "kfg-kopf"); kopf.appendChild(el("span", "kfg-typ", "⚑ Meldung · " + (x.offen ? "neu" : String(r.status || "")))); if (x.neu) kopf.appendChild(el("span", "kfg-neu", "neu"));
    kopf.appendChild(el("span", "muted", fdt(x.z) + (r.class_code ? " · Klasse " + r.class_code : ""))); row.appendChild(kopf);
    row.appendChild(el("div", "kfg-auf", String(r.task_id || "") + " · " + String(r.reason || "")));
    if (r.comment) row.appendChild(el("div", "kfg-txt", "„" + String(r.comment) + "“"));
    var acts = el("div", "kfg-acts");
    if (window.PortalMeldungen && window.PortalMeldungen.taskUrl) { var a = el("a", "btn ghost small", "Zur Aufgabe ›"); a.href = window.PortalMeldungen.taskUrl(r); a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
    var b = el("button", "btn small", "Im Tab „Meldungen“ bearbeiten"); b.type = "button"; b.onclick = function () { closePanel(); G.ctx.openTab("meldungen"); }; acts.appendChild(b);
    row.appendChild(acts); return row;
  }
  function pmeldRow(x) {
    var m = x.m, row = el("div", "kfg-it");
    var kopf = el("div", "kfg-kopf"); kopf.appendChild(el("span", "kfg-typ", "⚑ Meldung · " + String(m.titel || m.seite || ""))); kopf.appendChild(el("span", "kfg-neu", "neu"));
    kopf.appendChild(el("span", "muted", (m.name ? m.name + " · " : "") + (m.klasse ? m.klasse + " · " : "") + fdt(x.z))); row.appendChild(kopf);
    row.appendChild(el("div", "kfg-auf", String(m.item || "") + (m.grund ? " · " + m.grund : "")));
    if (m.kommentar) row.appendChild(el("div", "kfg-txt", "„" + String(m.kommentar) + "“"));
    var acts = el("div", "kfg-acts");
    if (/^[a-z0-9][a-z0-9\-]*$/.test(String(m.seite || ""))) { var a = el("a", "btn ghost small", "Seite öffnen ›"); a.href = "../" + m.seite + "/?vorschau"; a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
    var b = el("button", "btn small", "Im Dashboard ansehen"); b.type = "button"; b.onclick = function () { closePanel(); G.ctx.openTab("dash"); }; acts.appendChild(b);
    row.appendChild(acts); return row;
  }
  function fillPanel() {
    var body = G.panel.querySelector(".kfg-body"); if (!body) return;
    var keep = document.activeElement && body.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA";
    if (keep) return;   // nicht neu zeichnen, während getippt wird
    body.textContent = "";
    var l = items();
    if (!l.length) body.appendChild(el("p", "muted", G.busy && !G.q ? "Lädt …" : (G.err || "Keine neuen oder offenen Fragen und Meldungen. 👍")));
    l.slice(0, 60).forEach(function (x) { body.appendChild(x.art === "frage" ? frageRow(x) : x.art === "meldung" ? meldRow(x) : pmeldRow(x)); });
    var st = G.panel.querySelector(".kfg-stand"); if (st) st.textContent = G.last ? "Stand " + new Date(G.last).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
  }
  function openPanel() {
    if (G.panel) return;
    var bg = el("div", "sheet-bg kfg-bg"), sh = el("div", "sheet glass kfg-sheet"); sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-label", "Neue Fragen und Meldungen");
    var top = el("div", "kfg-top"); top.appendChild(el("h3", "", "🔔 Fragen & Meldungen"));
    var r = el("div", "kfg-topr"); r.appendChild(el("span", "muted kfg-stand", ""));
    var re = el("button", "btn ghost small", "↻"); re.type = "button"; re.title = "Aktualisieren"; re.onclick = function () { load(true); };
    var x = el("button", "btn ghost small", "Schließen"); x.type = "button"; x.onclick = closePanel; r.appendChild(re); r.appendChild(x); top.appendChild(r);
    sh.appendChild(top); sh.appendChild(el("p", "muted kfg-hint", "Offene Fragen stehen oben. „neu“ = seit dem letzten Öffnen dieser Liste eingegangen."));
    sh.appendChild(el("div", "kfg-body")); bg.appendChild(sh);
    bg.addEventListener("click", function (e) { if (e.target === bg) closePanel(); });
    document.body.appendChild(bg); G.panel = bg; fillPanel();
    if (window.KFZurueck) { try { window.KFZurueck.push(function () { closePanel(true); }); } catch (e) {} }
    load(true);
  }
  function closePanel(fromBack) {
    if (!G.panel) return; try { G.panel.remove(); } catch (e) {} G.panel = null;
    if (!fromBack && window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} }
    setSeen(Math.max(Date.now(), G.last)); paint();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && G.panel) closePanel(); });
  window.PortalGlocke = {
    /* ctx: {api, token(), sess(), openTab(name), relogin()} */
    button: function (h, ctx) {
      G.ctx = ctx; if (!lehrer()) return null;
      if (G.tok !== ctx.token()) { G.tok = ctx.token(); G.q = G.r = G.p = null; G.last = 0; G.toast = false; }
      var b = h("button", { type: "button", class: "btn ghost kfg-btn", onclick: openPanel }, h("span", { "aria-hidden": "true", text: "🔔" }), h("span", { class: "kfg-n", hidden: true }));
      setTimeout(function () { paint(); load(false); startPoll(); }, 0);
      return b;
    },
    reset: function () { G.q = G.r = G.p = null; G.last = 0; G.toast = false; G.tok = ""; G.draft = null; if (G.panel) { try { G.panel.remove(); } catch (e) {} G.panel = null; } },
    _state: G, _items: items, load: load, open: openPanel
  };
})();
