/* Portal-Tab „Lücken“ (Meine Lücken 10a): Heatmap Schüler × Thema, Override je Zelle, „Neu berechnen“, Meldungen aus ⚑.
   Daten: Portal-Backend (admin_luecken*, ab portal-7l). Ohne neues Backend: Hinweis „kommt mit dem nächsten Deploy“. Alle Texte per textContent. */
(function () {
  var M = { d: null, err: "", busy: false, sel: "", zeigTest: false };
  var ST = { offen: "offen", naechstes: "als Nächstes", stark: "stark", geschafft: "geschafft ✅", zuWenig: "zu wenig Daten", aus: "aus" };
  function farbe(c) { if (!c) return "#eee"; if (c.status === "geschafft") return "#bdeccb"; if (c.status === "aus") return "#ddd"; if (c.s === null || c.s === "" || c.s === undefined) return "#f3f0ff";
    var s = Math.max(0, Math.min(1, +c.s)); return "hsl(" + Math.round(120 - 120 * s) + ",75%," + Math.round(88 - 18 * s) + "%)"; }
  function load(ctx, rr, aktion) { M.busy = true; M.err = ""; rr();
    ctx.api({ action: aktion || "admin_luecken", token: ctx.token() }).then(function (r) {
      if (aktion && r && r.ok) return load(ctx, rr);
      M.busy = false; if (r && r.ok) M.d = r; else M.err = r && r.error === "unbekannte Aktion" ? "Das Lücken-Backend ist noch nicht deployt (portal-7l)." : (r && r.error) || "Keine Verbindung."; rr(); }); }
  function ov(ctx, rr, u, t, w) { M.busy = true; rr(); ctx.api({ action: "admin_luecken_override", token: ctx.token(), benutzer: u, thema: t, wert: w }).then(function (r) { if (!r || !r.ok) { M.busy = false; M.err = (r && r.error) || "Fehler"; return rr(); } load(ctx, rr); }); }
  function mst(ctx, rr, id, st) { ctx.api({ action: "admin_luecken_meldung", token: ctx.token(), id: id, status: st }).then(function (r) { if (r && r.ok) M.d.meldungen.forEach(function (m) { if (m.id === id) m.status = st; }); else M.err = (r && r.error) || "Fehler"; rr(); }); }
  function dt(ms) { return ms ? new Date(ms).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : "–"; }
  window.PortalLuecken = { state: M, view: function (h, ctx, rr) {
    if (!M.d && !M.busy && !M.err) { load(ctx, rr); }
    var top = h("div", { class: "glass", style: "padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap" },
      h("b", { text: "Meine Lücken · 10a" }), M.d ? h("span", { class: "muted", text: "berechnet " + dt(M.d.berechnet) + " · aktiv (7 T.): " + M.d.aktiv7 + " · Antworten: " + M.d.antworten7 + (M.d.zuordnungOffen ? " · ⚠ " + M.d.zuordnungOffen + " Namen ohne Zuordnung (Blatt LueckenZuordnung)" : "") }) : null,
      h("button", { class: "btn small", text: M.busy ? "Rechnet …" : "↻ Neu berechnen", disabled: M.busy ? "disabled" : null, onclick: function () { load(ctx, rr, "admin_luecken_neu"); } }),
      h("label", { class: "muted small" }, h("input", { type: "checkbox", checked: M.zeigTest ? "checked" : null, onchange: function (e) { M.zeigTest = e.target.checked; rr(); } }), " Testkonten zeigen"),
      M.err ? h("span", { class: "muted", text: M.err }) : null);
    if (!M.d) return h("div", {}, top, h("div", { class: "glass empty" }, h("p", { class: "muted", text: M.busy ? "Lädt …" : (M.err || "Keine Daten.") })));
    var T = M.d.themen, L = M.d.schueler.filter(function (s) { return M.zeigTest || !s.test; });
    var head = h("tr", {}, [h("th", { text: "Schüler/in" })].concat(T.map(function (t) { return h("th", { text: t.titel, style: "font-size:12px" }); })));
    var avg = h("tr", {}, [h("td", { text: "Klassen-Schnitt", style: "font-weight:700" })].concat(T.map(function (t) { var s = M.d.klasse[t.id]; return h("td", { text: s === undefined ? "–" : Math.round(s * 100) + " %", style: "text-align:center;background:" + farbe({ s: s }) }); })));
    var rows = L.map(function (s) {
      return h("tr", {}, [h("td", { text: s.name + (s.test ? " (Test)" : "") })].concat(T.map(function (t) {
        var c = s.zellen[t.id], key = s.benutzer + "|" + t.id, txt = !c ? "–" : (c.rang ? "#" + c.rang + " " : "") + (c.s === null || c.s === "" ? "" : Math.round(c.s * 100) + "%") + (c.ov ? " ✋" : "") + (c.status === "geschafft" ? " ✅" : "");
        var td = h("td", { text: txt, title: c ? (ST[c.status] || c.status) + " · " + (c.grund || "") : "noch nicht berechnet", style: "text-align:center;cursor:pointer;white-space:nowrap;background:" + farbe(c) + (M.sel === key ? ";outline:2px solid #6d4aff" : ""), onclick: function () { M.sel = M.sel === key ? "" : key; rr(); } });
        return td; })));
    });
    var tab = h("div", { class: "glass", style: "padding:10px;overflow-x:auto" }, h("table", { style: "border-collapse:collapse;width:100%;font-size:13px" }, h("thead", {}, head), h("tbody", {}, [avg].concat(rows))),
      h("p", { class: "muted small", text: "Farbe = Schwierigkeit (grün leicht … rot schwer) · #1–3 = aktive Lücke · ✅ geschafft · ✋ von dir gesetzt. Zelle anklicken zum Ändern." }));
    var edit = null;
    if (M.sel) { var p = M.sel.split("|"), s0 = M.d.schueler.filter(function (x) { return x.benutzer === p[0]; })[0], c0 = s0 && s0.zellen[p[1]], t0 = T.filter(function (x) { return x.id === p[1]; })[0];
      if (s0 && t0) edit = h("div", { class: "glass", style: "padding:12px 14px" }, h("b", { text: s0.name + " · " + t0.titel }),
        h("p", { class: "muted", text: c0 ? (ST[c0.status] || c0.status) + " · " + (c0.grund || "") + (c0.ges ? " · geschafft am " + dt(c0.ges) : "") : "noch kein Profil" }),
        h("div", { class: "mbtns", style: "display:flex;gap:8px;flex-wrap:wrap" }, [["", "Automatisch"], ["offen", "Als Lücke setzen"], ["geschafft", "Als geschafft markieren"], ["aus", "Ausblenden"]].map(function (o) {
          return h("button", { class: "btn small" + ((c0 && c0.ov || "") === o[0] ? "" : " ghost"), text: o[1], onclick: function () { ov(ctx, rr, p[0], p[1], o[0]); } }); }))); }
    var ml = (M.d.meldungen || []).filter(function (m) { return M.zeigTest || m.status !== "test"; });
    var meld = h("div", { class: "glass", style: "padding:10px 14px" }, h("h3", { text: "⚑ Gemeldete Aufgaben (" + ml.filter(function (m) { return m.status === "neu"; }).length + " neu)" }),
      ml.length ? ml.slice(0, 50).map(function (m) { return h("div", { class: "mrow", style: "border-top:1px solid #eee;padding:6px 0" },
        h("div", {}, h("b", { text: m.aufgabe.replace(/^lk:/, "") + " · " + m.grund }), h("span", { class: "muted", text: " · " + dt(m.zeit) + " · " + m.status })),
        h("div", { class: "muted", text: "Antwort: " + (m.antwort || "–") + " · erwartet: " + (m.erwartet || "–") + " · Seed " + (m.seed || "–") }), m.kommentar ? h("div", { text: "„" + m.kommentar + "“" }) : null,
        h("div", { style: "display:flex;gap:6px;margin-top:4px" }, ["bestätigt", "abgelehnt", "behoben"].map(function (st) { return h("button", { class: "btn ghost small", text: st, onclick: function () { mst(ctx, rr, m.id, st); } }); }))); }) : h("p", { class: "muted", text: "Keine Meldungen." }));
    return h("div", {}, top, edit, tab, meld);
  }, reset: function () { M.d = null; M.err = ""; M.sel = ""; } };
})();
