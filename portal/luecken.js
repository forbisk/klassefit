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
  /* 12.11.2026 (Paulius): Name anklicken → Detail mit Spinnennetz (inline-SVG, keine Bibliothek). Nur vorhandene admin_luecken-Daten:
     c.s = Schwierigkeit 0..1 (≥ 0,4 = Lücke) → erreicht = (1 − s) · 100 %. Klassen-Schnitt ebenso aus M.d.klasse. */
  var SVG = "http://www.w3.org/2000/svg";
  function sv(tag, a, txt) { var e = document.createElementNS(SVG, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; return e; }
  function erreicht(c) { if (!c) return null; if (c.s === null || c.s === "" || c.s === undefined) return c.status === "geschafft" ? 100 : null; return Math.round(100 * (1 - Math.max(0, Math.min(1, +c.s)))); }
  function art(c) { if (!c || c.status === "zuWenig" || (c.status !== "geschafft" && erreicht(c) === null)) return "grau"; if (c.status === "geschafft") return "gruen"; if (c.status === "aus") return "aus";
    if (c.status === "offen") return "rot"; if (c.status === "naechstes") return "orange"; return "stark"; }
  var FARBE = { rot: "#dc2626", orange: "#f59e0b", gruen: "#16a34a", grau: "#94a3b8", aus: "#94a3b8", stark: "#2563eb" };
  var ORD = { rot: 0, orange: 1, stark: 2, gruen: 3, grau: 4, aus: 5 };
  function kurzT(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function radar(T, s, kl) {
    var n = T.length, W = 360, Hh = 330, cx = W / 2, cy = Hh / 2 + 4, R = 112, maxL = n > 10 ? 12 : 18;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + Hh, class: "lk-radar", role: "img", "aria-label": "Spinnennetz: erreichter Anteil je Thema" });
    function pt(i, v) { var a = -Math.PI / 2 + 2 * Math.PI * i / n, r = R * v / 100; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    [25, 50, 75, 100].forEach(function (g) { var p = T.map(function (t, i) { return pt(i, g).join(","); }).join(" ");
      svg.appendChild(sv("polygon", { points: p, fill: "none", stroke: "currentColor", "stroke-opacity": g === 100 ? ".35" : ".15" }));
      svg.appendChild(sv("text", { x: cx + 3, y: cy - R * g / 100 + 10, "font-size": "9", fill: "currentColor", "fill-opacity": ".55" }, g + "%")); });
    T.forEach(function (t, i) { var c = s.zellen[t.id], k = art(c), e = pt(i, 100), l = pt(i, 100 + (n > 10 ? 16 : 20));
      var ax = sv("line", { x1: cx, y1: cy, x2: e[0], y2: e[1], stroke: FARBE[k], "stroke-width": k === "rot" || k === "orange" ? "2.2" : "1.2", "stroke-opacity": k === "grau" || k === "aus" ? ".7" : ".9" });
      if (k === "grau" || k === "aus") ax.setAttribute("stroke-dasharray", "4 3"); svg.appendChild(ax);
      var anc = Math.abs(l[0] - cx) < 8 ? "middle" : (l[0] > cx ? "start" : "end");
      var tx = sv("text", { x: l[0], y: l[1] + 3, "text-anchor": anc, "font-size": n > 10 ? "9.5" : "11", "font-weight": k === "rot" || k === "orange" ? "700" : "500", fill: k === "stark" ? "currentColor" : FARBE[k] }, kurzT(t.titel, maxL));
      tx.appendChild(sv("title", {}, t.titel + " · " + (erreicht(c) === null ? "zu wenig Daten" : erreicht(c) + " %"))); svg.appendChild(tx); });
    if (kl) { var kp = T.map(function (t, i) { var v = kl[t.id]; return pt(i, v === undefined || v === null || v === "" ? 0 : 100 * (1 - +v)).join(","); }).join(" ");
      svg.appendChild(sv("polygon", { points: kp, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "3 3", class: "lk-kl" })); }
    var sp = T.map(function (t, i) { var v = erreicht(s.zellen[t.id]); return pt(i, v === null ? 0 : v).join(","); }).join(" ");
    svg.appendChild(sv("polygon", { points: sp, fill: "#6d4aff", "fill-opacity": ".18", stroke: "#6d4aff", "stroke-width": "2", class: "lk-sch" }));
    T.forEach(function (t, i) { var c = s.zellen[t.id], v = erreicht(c); if (v === null) return; var p = pt(i, v);
      var dot = sv("circle", { cx: p[0], cy: p[1], r: "3.6", fill: FARBE[art(c)], stroke: "#fff", "stroke-width": "1" }); dot.appendChild(sv("title", {}, t.titel + ": " + v + " %")); svg.appendChild(dot); });
    return svg;
  }
  var SH = null;
  function schliesse(fromBack) { if (!SH) return; try { SH.remove(); } catch (e) {} SH = null; M.detail = ""; if (!fromBack && window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} } }
  function detail(h, u) {
    schliesse(); var s = M.d && M.d.schueler.filter(function (x) { return x.benutzer === u; })[0]; if (!s) return; M.detail = u;
    var T = M.d.themen.filter(function (t) { var c = s.zellen[t.id]; return !c || c.status !== "aus"; });
    var l = T.map(function (t) { var c = s.zellen[t.id]; return { t: t, c: c, k: art(c), v: erreicht(c) }; })
      .sort(function (a, b) { return (ORD[a.k] - ORD[b.k]) || ((a.c && a.c.rang || 99) - (b.c && b.c.rang || 99)) || ((a.v === null ? 101 : a.v) - (b.v === null ? 101 : b.v)); });
    var nL = l.filter(function (x) { return x.k === "rot"; }).length, nG = l.filter(function (x) { return x.k === "gruen"; }).length;
    var bg = h("div", { class: "sheet-bg lk-bg", onclick: function (e) { if (e.target === bg) schliesse(); } });
    var sh = h("div", { class: "sheet glass lk-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Lücken von " + s.name },
      h("div", { class: "lk-top" }, h("h3", { text: "🕸️ " + s.name }), h("button", { class: "btn ghost small", type: "button", text: "Schließen", onclick: function () { schliesse(); } })),
      h("p", { class: "muted lk-sum", text: nL + (nL === 1 ? " offene Lücke" : " offene Lücken") + " · " + nG + " geschafft · " + T.length + " Themen" }),
      h("div", { class: "lk-chart" }, radar(T, s, M.d.klasse)),
      h("div", { class: "lk-leg" }, [["#6d4aff", "erreicht (" + s.name.split(/\s+/)[0] + ")", ""], ["#64748b", "Klassen-Schnitt", "d"], [FARBE.rot, "offene Lücke", ""], [FARBE.orange, "als Nächstes", ""], [FARBE.gruen, "geschafft", ""], [FARBE.grau, "zu wenig Daten", "d"]].map(function (x) {
        return h("span", {}, h("i", { class: x[2] ? "d" : "", style: "border-color:" + x[0] + ";background:" + (x[2] ? "transparent" : x[0]) }), x[1]); })),
      h("div", { class: "lk-list" }, l.map(function (x) {
        return h("div", { class: "lk-row " + x.k, title: x.t.titel + (x.c && x.c.grund ? " · " + x.c.grund : "") },
          h("div", { class: "lk-rt" }, h("b", { text: x.t.titel }), h("span", { class: "lk-st", text: (x.c && x.c.rang ? "#" + x.c.rang + " " : "") + (x.c ? (ST[x.c.status] || x.c.status) : "noch nicht berechnet") + (x.c && x.c.ov ? " ✋" : "") })),
          h("div", { class: "lk-bar" }, h("i", { style: "width:" + (x.v === null ? 0 : x.v) + "%;background:" + FARBE[x.k] })),
          h("span", { class: "lk-pc", text: x.v === null ? "–" : x.v + " %" }));
      })),
      h("p", { class: "muted small", text: "Erreicht = 100 % − Schwierigkeit aus „Meine Lücken“ (ab 40 % Schwierigkeit gilt ein Thema als Lücke). Gestrichelt = Klassen-Schnitt bzw. zu wenig Daten." }));
    bg.appendChild(sh); document.body.appendChild(bg); SH = bg;
    if (window.KFZurueck) { try { window.KFZurueck.push(function () { schliesse(true); }); } catch (e) {} }
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && SH) schliesse(); });
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
      return h("tr", {}, [h("td", {}, h("button", { class: "lk-name", type: "button", title: "Spinnennetz und Lücken von " + s.name + " anzeigen", text: s.name + (s.test ? " (Test)" : ""), onclick: function () { detail(h, s.benutzer); } }))].concat(T.map(function (t) {
        var c = s.zellen[t.id], key = s.benutzer + "|" + t.id, txt = !c ? "–" : (c.rang ? "#" + c.rang + " " : "") + (c.s === null || c.s === "" ? "" : Math.round(c.s * 100) + "%") + (c.ov ? " ✋" : "") + (c.status === "geschafft" ? " ✅" : "");
        var td = h("td", { text: txt, title: c ? (ST[c.status] || c.status) + " · " + (c.grund || "") : "noch nicht berechnet", style: "text-align:center;cursor:pointer;white-space:nowrap;background:" + farbe(c) + (M.sel === key ? ";outline:2px solid #6d4aff" : ""), onclick: function () { M.sel = M.sel === key ? "" : key; rr(); } });
        return td; })));
    });
    var tab = h("div", { class: "glass", style: "padding:10px;overflow-x:auto" }, h("table", { style: "border-collapse:collapse;width:100%;font-size:13px" }, h("thead", {}, head), h("tbody", {}, [avg].concat(rows))),
      h("p", { class: "muted small", text: "Farbe = Schwierigkeit (grün leicht … rot schwer) · #1–3 = aktive Lücke · ✅ geschafft · ✋ von dir gesetzt. Zelle anklicken zum Ändern · Namen anklicken für das Spinnennetz." }));
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
  }, reset: function () { M.d = null; M.err = ""; M.sel = ""; schliesse(); }, _detail: detail };
})();
