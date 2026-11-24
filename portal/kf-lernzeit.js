/* KlasseFit – Lernzeit-Diagramme „In der Schule“ / „Zuhause“ (24.11.2026, portal-8d).
   EIN Baustein für das Lehrer-Dashboard (portal.js) UND den Elternbereich (/eltern/), damit beide gleich aussehen und gleich rechnen.
   Nur Anzeige: bekommt fertige Minuten je Tag {tag:"yyyy-MM-dd", a, s, z, o, offen?, frei?} vom Server (portal.gs lzTage_).
   Regel (Server): Schultag Mo–Fr vor 13 Uhr (Europe/Berlin) = Schule, sonst Zuhause; Wochenende/Ferien/Feiertage = Zuhause.
   o = nicht zuordenbar (vor Messbeginn oder nachgereicht). Alle Texte nur als textContent. Keine Namen, keine Vergleiche. */
(function (root) {
  "use strict";
  var WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function el(tag, a) {
    var e = document.createElement(tag); a = a || {};
    Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return;
      if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k === "style") e.setAttribute("style", v); else e.setAttribute(k, v === true ? "" : v); });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) e.appendChild(x.nodeType ? x : document.createTextNode(String(x))); }); }
    return e;
  }
  function css() {
    if (document.getElementById("kfLzCss")) return;
    var s = document.createElement("style"); s.id = "kfLzCss";
    s.textContent = [
      ".lz{--lz-s:#6366f1;--lz-z:#14b8a6;--lz-o:rgba(120,120,128,.38);--lz-off:rgba(10,132,255,.13)}",
      ".lz-bars{display:flex;align-items:flex-end;gap:4px;height:120px;margin:8px 0 4px}",
      ".lz-bars .b{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0;height:100%}",
      ".lz-bars .st{position:relative;width:100%;max-width:28px;height:100%;display:flex;flex-direction:column;justify-content:flex-end}",
      ".lz-bars.w .st{max-width:64px}",
      ".lz-bars .st i{display:block;width:100%;flex:none}",
      ".lz-bars .st i:last-child{border-radius:0 0 3px 3px}",
      ".lz-bars .st i.lz-top{border-radius:6px 6px 0 0;margin:0}.lz-bars .st i.lz-top:last-child{border-radius:6px 6px 3px 3px}",
      ".lz-bars .st .off{position:absolute;left:0;right:0;bottom:0;background:var(--lz-off);border-radius:6px 6px 3px 3px}",
      ".lz-bars .b span{font-size:10px;color:var(--ink2);margin-top:4px;white-space:nowrap}",
      ".lz-bars .b.fr span{opacity:.6}",
      ".lz-bars .b.leer .st::after{content:'';position:absolute;left:20%;right:20%;bottom:0;height:2px;border-radius:2px;background:var(--line)}",
      ".lz i.s{background:var(--lz-s)}.lz i.z{background:var(--lz-z)}.lz i.o{background:var(--lz-o)}",
      ".lz-leg{display:flex;gap:6px 14px;font-size:12px;color:var(--ink2);flex-wrap:wrap;margin-top:4px}",
      ".lz-leg span{white-space:nowrap}.lz-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}",
      ".lz-leg i.off{background:var(--lz-off);border:1px solid rgba(10,132,255,.35)}",
      ".lz-split{display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--line);margin:8px 0 6px}",
      ".lz-split i{display:block;height:100%}",
      ".lz-sum{display:flex;gap:4px 14px;flex-wrap:wrap;font-size:13px}.lz-sum b{font-weight:800}",
      ".lz-rule{font-size:12px;color:var(--ink2);margin-top:6px;line-height:1.4}"
    ].join("\n");
    document.head.appendChild(s);
  }
  function dauer(min) { min = Math.round(min || 0); if (min < 60) return min + " min"; var h = Math.floor(min / 60), m = min % 60; return h + " h" + (m ? " " + m + " min" : ""); }
  function wt(t) { var p = String(t).split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function pct(x, mx) { return mx > 0 ? Math.max(0, Math.min(100, 100 * x / mx)) : 0; }
  /* Tagesbalken: tage = [{tag, a, s, z, o, offen?, frei?}] (alt -> neu). opts: {aria, offen:true = „geöffnet“ als Hintergrund, min: Mindest-Skala} */
  function balken(tage, opts) {
    css(); opts = opts || {};
    var mx = Math.max(opts.min || 10, Math.max.apply(null, tage.map(function (x) { return Math.max(x.a || 0, opts.offen ? (x.offen || 0) : 0); }).concat([0])));
    return el("div", { class: "lz lz-bars", role: "img", "aria-label": opts.aria || "Lernzeit je Tag" }, tage.map(function (x) {
      var p = String(x.tag).split("-"), segs = [["o", x.o], ["z", x.z], ["s", x.s]].filter(function (q) { return q[1] > 0; });
      var tip = WT[wt(x.tag)] + " " + p[2] + "." + p[1] + ".: " + (x.a ? dauer(x.a) + (x.s ? " · Schule " + dauer(x.s) : "") + (x.z ? " · Zuhause " + dauer(x.z) : "") + (x.o ? " · ohne Zuordnung " + dauer(x.o) : "") : "keine Lernzeit") +
        (opts.offen && x.offen > x.a ? " · geöffnet " + dauer(x.offen) : "") + (x.frei ? " · schulfrei" : "");
      return el("div", { class: "b" + (x.frei ? " fr" : "") + (x.a ? "" : " leer"), title: tip },
        el("div", { class: "st" }, opts.offen && x.offen > x.a ? el("i", { class: "off", style: "height:" + pct(x.offen, mx).toFixed(1) + "%" }) : null,
          segs.map(function (q, i) { return el("i", { class: q[0] + (i === 0 ? " lz-top" : ""), style: "height:" + pct(q[1], mx).toFixed(1) + "%;position:relative" }); })),
        el("span", { text: opts.labels ? opts.labels(x) : WT[wt(x.tag)] }));
    }));
  }
  /* Wochenbalken: wochen = [{label, aktiv, schule, zuhause}] */
  function wochen(wo, opts) {
    css(); opts = opts || {};
    var mx = Math.max(30, Math.max.apply(null, wo.map(function (x) { return x.aktiv || 0; }).concat([0])));
    return el("div", { class: "lz lz-bars w", role: "img", "aria-label": opts.aria || "Lernzeit je Woche" }, wo.map(function (x) {
      var s = x.schule || 0, z = x.zuhause || 0, o = Math.max(0, (x.aktiv || 0) - s - z), segs = [["o", o], ["z", z], ["s", s]].filter(function (q) { return q[1] > 0; });
      return el("div", { class: "b" + (x.aktiv ? "" : " leer"), title: x.label + ": " + dauer(x.aktiv) + (s ? " · Schule " + dauer(s) : "") + (z ? " · Zuhause " + dauer(z) : "") + (x.tage != null ? " · " + x.tage + " Lerntage" : "") },
        el("div", { class: "st" }, segs.map(function (q, i) { return el("i", { class: q[0] + (i === 0 ? " lz-top" : ""), style: "height:" + pct(q[1], mx).toFixed(1) + "%" }); })),
        el("span", { text: String(x.label).replace("vor ", "−").replace(" Wochen", " Wo.") }));
    }));
  }
  /* Anteil Schule/Zuhause als 100-%-Balken + Zahlen */
  function anteil(s, z, o, opts) {
    css(); opts = opts || {}; s = s || 0; z = z || 0; o = o || 0; var t = s + z + o;
    if (!t) return el("p", { class: "lz-rule", text: opts.leer || "Noch keine Lernzeit in diesem Zeitraum." });
    var pc = function (x) { return Math.round(100 * x / t); };
    return el("div", { class: "lz" },
      el("div", { class: "lz-split", role: "img", "aria-label": "In der Schule " + pc(s) + " Prozent, zu Hause " + pc(z) + " Prozent" },
        s ? el("i", { class: "s", style: "width:" + pct(s, t).toFixed(1) + "%" }) : null, z ? el("i", { class: "z", style: "width:" + pct(z, t).toFixed(1) + "%" }) : null, o ? el("i", { class: "o", style: "width:" + pct(o, t).toFixed(1) + "%" }) : null),
      el("div", { class: "lz-sum" },
        el("span", {}, "🏫 In der Schule ", el("b", { text: dauer(s) }), " (" + pc(s) + " %)"),
        el("span", {}, "🏠 Zuhause ", el("b", { text: dauer(z) }), " (" + pc(z) + " %)"),
        o ? el("span", { class: "muted" }, "ohne Zuordnung " + dauer(o)) : null));
  }
  function legende(opts) {
    css(); opts = opts || {};
    return el("div", { class: "lz lz-leg" }, el("span", {}, el("i", { class: "s" }), "in der Schule"), el("span", {}, el("i", { class: "z" }), "zu Hause"),
      opts.o ? el("span", {}, el("i", { class: "o" }), "ohne Zuordnung") : null, opts.offen ? el("span", {}, el("i", { class: "off" }), "geöffnet (auch Pausen)") : null);
  }
  function regel(grenze, seit) {
    var g = grenze || 13, s = /^(\d{4})-(\d{2})-(\d{2})$/.exec(seit || "");
    return "In der Schule = Schultag Mo–Fr vor " + g + " Uhr. Zuhause = ab " + g + " Uhr, Wochenende, Ferien und Feiertage." +
      (s ? " Schule/Zuhause wird seit " + s[3] + "." + s[2] + "." + s[1] + " erfasst; ältere Schultage erscheinen grau (ohne Zuordnung)." : " Schule/Zuhause wird ab jetzt erfasst; ältere Schultage erscheinen grau (ohne Zuordnung).");
  }
  /* Summen über Tage [{a,s,z,o}] */
  function summe(tage) { var r = { a: 0, s: 0, z: 0, o: 0, tage: 0 }; (tage || []).forEach(function (x) { r.a += x.a || 0; r.s += x.s || 0; r.z += x.z || 0; r.o += x.o || 0; if ((x.a || 0) >= 1) r.tage++; }); return r; }
  /* Server-Format lernzeit {tage:[t], frei:[0/1], u:{id:{a:[],s:[],z:[],o:[]}}} -> Tagesliste für einen Schüler oder Ø über mehrere */
  function tageFuer(lz, ids, schnitt) {
    if (!lz || !lz.tage) return [];
    var n = Math.max(1, schnitt ? ids.length : 1);
    return lz.tage.map(function (t, i) { var x = { tag: t, a: 0, s: 0, z: 0, o: 0, frei: lz.frei ? lz.frei[i] : 0 };
      ids.forEach(function (id) { var u = lz.u && lz.u[id]; if (!u) return; x.a += u.a[i] || 0; x.s += u.s[i] || 0; x.z += u.z[i] || 0; x.o += u.o[i] || 0; });
      if (schnitt) { x.a = x.a / n; x.s = x.s / n; x.z = x.z / n; x.o = x.o / n; }
      return x; });
  }
  root.KFLernzeit = { v: 1, balken: balken, wochen: wochen, anteil: anteil, legende: legende, regel: regel, summe: summe, tageFuer: tageFuer, dauer: dauer, css: css };
})(window);
