/* KlasseFit Portal – „Wie gelöst?“ (21.11.2026, nur Lehrkraft-Dashboard).
   Quelle: Backend-Aktion admin_hilfe (portal-8b, nur lesend aus AppStand: Zähler + Zeitstempel, keine Antworten).
   Status je Aufgabe:  sofort = 1. Versuch richtig, ohne Tipp · versuche = mehrere Prüfen-Versuche, ohne Tipp ·
                       tipp = Tipp geöffnet (vor dem Richtig) · loesung = Lösung angezeigt (zählt NICHT als gelöst) · offen / leer.
   Altdaten ohne Tipp-Zeitstempel: Tipp zählt als „mit Tipp“, Zeitpunkt unbekannt (Hinweis „~“).
   Schüleransicht unverändert. Ältere Backends ohne admin_hilfe: Funktion bleibt unsichtbar. */
(function () {
  "use strict";
  var TZ = "Europe/Berlin";
  /* Seiten mit automatisch sichtbarem Lösungsweg ab dem 2. Fehlversuch (showL = ok || n >= 2 || l) */
  var AUTO2 = ["mathe8g-gleichungen-selbst", "informatik8-binaer-missionen", "mathe8-gleichungen-selbst", "mathe5-kommutativ-selbst", "mathe8g-terme-selbst",
    "mathe8g-funktionen-selbst", "mathe9g-qfunktionen-selbst", "mathe8-gleichungen-ha", "informatik67-daten-missionen", "mathe8-kreise-selbst", "mathe9g-potenzen-selbst"];
  /* Seiten, auf denen ein Tipp auch NACH dem Richtig noch die Stufe h erhöht (Altdaten: Zeitpunkt unbekannt) */
  var HNACH = /-berichtigung$|^mathe7-selbstarbeit$|^mathe7-begabte$/;
  var ST = {
    sofort: { c: "#16a34a", l: "sofort richtig", k: "✅" },
    versuche: { c: "#eab308", l: "selbst nach Versuchen", k: "🟡" },
    tipp: { c: "#f97316", l: "mit Tipp", k: "🟠" },
    loesung: { c: "#9ca3af", l: "Lösung angezeigt", k: "⚪" },
    offen: { c: "rgba(148,163,184,.28)", l: "noch offen", k: "·" }
  };
  var ORDER = ["sofort", "versuche", "tipp", "loesung", "offen"];
  var state = { sort: "name", viel: false };

  function profil(seite) { return { auto2: AUTO2.indexOf(seite) >= 0, hNach: HNACH.test(seite), ber: /-berichtigung$/.test(seite) }; }
  function status(x, seite) {
    x = x || {}; var p = profil(seite), ok = +x.ok > 0, n = +x.n || 0, h = +x.h || 0, r = { st: "", unsicher: false, sichtbar: false };
    /* Nur eine AKTIV geöffnete Lösung (Knopf „Lösungsweg zeigen“, l/lz) zählt als „Lösung angezeigt“.
       Automatisch sichtbarer Lösungsweg ab dem 2. Fehlversuch (la) zählt laut Paulius (21.11.2026) als selbst gelöst -> nur Hinweis. */
    var lsg = !!x.l && !(ok && x.lz && x.lz > x.ok);
    if (p.auto2 && (x.la || (n >= 2 && (!ok || n >= 3)))) r.sichtbar = true;
    if (lsg) { r.st = "loesung"; return r; }
    if (ok) {
      if (h >= 1) {
        if (x.t1) { if (x.t1 <= x.ok) { r.st = "tipp"; return r; } }      // Tipp erst nach dem Richtig -> zählt nicht
        else if (p.hNach) { r.st = "tipp"; r.unsicher = true; return r; }
        else { r.st = "tipp"; return r; }
      }
      r.st = n <= 1 ? "sofort" : "versuche"; return r;
    }
    r.st = (n > 0 || x.b || h > 0) ? "offen" : "";
    return r;
  }
  function liste(e, seite) {   // -> [{k, x, st, unsicher}]
    var t = (e && e.t) || {}, keys = e && Array.isArray(e.soll) ? e.soll.slice() : Object.keys(t).filter(function (k) { return status(t[k], seite).st; });
    keys.sort(function (a, b) { var na = parseInt(String(a).replace(/^\D+/, ""), 10), nb = parseInt(String(b).replace(/^\D+/, ""), 10); return (na - nb) || (a < b ? -1 : a > b ? 1 : 0); });
    return keys.map(function (k) { var s = status(t[k], seite); return { k: k, x: t[k] || {}, st: s.st || "offen", unsicher: s.unsicher, sichtbar: s.sichtbar }; });
  }
  function summe(e, seite) {
    var L = liste(e, seite), c = { sofort: 0, versuche: 0, tipp: 0, loesung: 0, offen: 0 }, tipps = 0, unsicher = 0, fo = 0, sichtbar = 0;
    L.forEach(function (a) { c[a.st]++; tipps += Math.min(2, +a.x.h || 0); if (a.unsicher) unsicher++; if (a.sichtbar && a.st === "versuche") sichtbar++; fo += +a.x.fo || 0; });
    var n = L.length, pc = function (v) { return n ? Math.round(100 * v / n) : 0; };
    return { n: n, c: c, tipps: tipps, fo: fo, unsicher: unsicher, sichtbar: sichtbar, erledigt: pc(c.sofort + c.versuche + c.tipp), selbst: pc(c.sofort + c.versuche),
      hilfe: pc(c.tipp + c.loesung), tpa: n ? tipps / n : 0, viel: n > 0 && (c.tipp + c.loesung) / n > 0.5, soll: !!(e && Array.isArray(e.soll)) };
  }
  function satzText(s) {
    return s.erledigt + " % erledigt · " + s.selbst + " % selbstständig · " + s.tipps + (s.tipps === 1 ? " Tipp" : " Tipps") + " · " + s.c.loesung + "× Lösung" + (s.sichtbar ? " · bei " + s.sichtbar + " davon war der Lösungsweg nach dem 2. Fehlversuch sichtbar" : "") +
      (s.unsicher ? " · ~ bei " + s.unsicher + (s.unsicher === 1 ? " Aufgabe" : " Aufgaben") + " Tipp-Zeitpunkt unbekannt (vor dem neuen Logging, evtl. erst nach dem Richtig geöffnet)" : "") + (s.soll ? "" : " · Basis: " + s.n + " bearbeitete Aufgaben");
  }
  function fz(ms) { return ms ? new Date(ms).toLocaleString("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""; }
  function dauer(a, b) { if (!a || !b || b < a) return ""; var m = Math.round((b - a) / 60000); return m < 1 ? "< 1 min" : m < 90 ? m + " min" : Math.round(m / 6) / 10 + " h"; }
  function css() {
    if (document.getElementById("kfHilfeCss")) return;
    var s = document.createElement("style"); s.id = "kfHilfeCss";
    s.textContent = ".kfh-bar{display:flex;height:6px;border-radius:4px;overflow:hidden;background:rgba(148,163,184,.25);min-width:40px}.kfh-bar i{display:block;height:100%}" +
      ".heat td .kfh-bar{margin:3px auto 0;width:100%;max-width:56px;height:4px}.kfh-t .kfh-bar{width:100%;height:9px;margin:0}.kfh-box h3{margin:0 0 4px}.kfh-box{padding:14px;margin-top:14px}" +
      ".kfh-leg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--ink2);margin:6px 0 10px}.kfh-leg span{display:inline-flex;align-items:center;gap:5px}.kfh-leg i{width:12px;height:8px;border-radius:3px;display:inline-block}" +
      ".kfh-tools{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13px;margin-bottom:8px}.kfh-tools label{display:inline-flex;gap:6px;align-items:center;cursor:pointer}" +
      ".kfh-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.kfh-t{border-collapse:collapse;width:100%;font-size:13px}.kfh-t th,.kfh-t td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}" +
      ".kfh-t th{font-size:12px;color:var(--ink2);font-weight:700}.kfh-t .l{text-align:left}.kfh-t th button{font:inherit;background:none;border:0;color:inherit;cursor:pointer;padding:0;text-decoration:underline dotted}" +
      ".kfh-t td.kfh-bc{min-width:90px;width:30%}.kfh-t tr.viel td.l b::after{content:' ⚠';color:#f97316}.kfh-t tbody tr{cursor:pointer}" +
      ".kfh-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;color:#0b1220}.kfh-chip.loesung{text-decoration:line-through;color:#374151}" +
      ".kfh-det .kfh-t{table-layout:auto}.kfh-det .kfh-t td:last-child{min-width:120px}.kfh-chip{white-space:nowrap}.kfh-chip.offen{background:rgba(148,163,184,.3)!important;color:var(--ink2)}.kfh-det .kfh-t td{white-space:normal}.kfh-det .kfh-t td.l{white-space:nowrap}.kfh-sum{font-size:13px;margin:4px 0 8px}";
    s.textContent += ".kfh-einfach{margin-top:12px;padding-top:10px;border-top:1px solid var(--line,#e5e7eb)}.kfh-e1{font-size:14px;margin:0 0 6px}.kfh-e2{font-size:12px;color:var(--ink2,#6b7280);margin:6px 0 0}.kfh-einfach .kfh-bar{height:8px}.kf-hilfe-seite .kfh-einfach{border-top:0;margin-top:0;padding-top:0}.kfh-einfach .kfh-leg{margin:6px 0 4px;color:var(--ink2,#6b7280)}" +
      ".kfh-auf summary{cursor:pointer;font-size:13px;color:var(--ink2,#6b7280);margin-top:4px}.kfh-al{display:grid;gap:4px;margin-top:6px}.kfh-ar{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px}.kfh-ar .kfh-chip.offen{background:rgba(148,163,184,.3)!important}";
    document.head.appendChild(s);
  }
  function bar(h, s, title) {
    return h("div", { class: "kfh-bar", title: title || satzText(s), role: "img", "aria-label": title || satzText(s) },
      ORDER.map(function (k) { var v = s.c[k]; return v ? h("i", { style: "width:" + (100 * v / s.n) + "%;background:" + ST[k].c }) : null; }));
  }
  function legende(h) {
    return h("div", { class: "kfh-leg" }, ORDER.map(function (k) { return h("span", {}, h("i", { style: "background:" + ST[k].c }), ST[k].l); }));
  }
  function eintrag(daten, seite, id) { return daten && daten[seite] ? daten[seite][id] || null : null; }
  /* Mini-Balken in der Dashboard-Zelle */
  function zelle(h, daten, seite, id) {
    var e = eintrag(daten, seite, id); if (!e) return null; var s = summe(e, seite); if (!s.n || s.c.offen === s.n) return null; css();   // nichts begonnen -> Zelle bleibt wie bisher
    return bar(h, s);
  }
  /* Klassen-Box unter der Tabelle: je Schüler Balken + Kennzahlen, sortierbar, Filter „viel Hilfe“ */
  function klassenBox(h, daten, seite, titel, schueler, opts) {
    if (!daten || !daten[seite]) return null; css();
    var rows = schueler.map(function (s) { var e = eintrag(daten, seite, s.id); return e ? { s: s, z: summe(e, seite) } : null; }).filter(function (r) { return r && r.z.n; });
    if (!rows.length) return null;
    var nViel = rows.filter(function (r) { return r.z.viel; }).length;
    if (state.viel) rows = rows.filter(function (r) { return r.z.viel; });
    var srt = state.sort;
    rows.sort(function (a, b) {
      var d = srt === "tpa" ? b.z.tpa - a.z.tpa : srt === "selbst" ? a.z.selbst - b.z.selbst : srt === "hilfe" ? b.z.hilfe - a.z.hilfe : 0;
      return d || (a.s.anzeige < b.s.anzeige ? -1 : a.s.anzeige > b.s.anzeige ? 1 : 0);
    });
    function sb(key, text, tip) { return h("th", { title: tip }, h("button", { type: "button", text: text + (srt === key ? " ▾" : ""), onclick: function (ev) { ev.stopPropagation(); state.sort = srt === key ? "name" : key; opts.rerender(); } })); }
    return h("div", { class: "kfh-box glass", "data-seite": seite },
      h("h3", { text: "Wie gelöst? · " + titel }),
      h("p", { class: "szhint", text: "Nur für dich sichtbar. Grün + Gelb = selbstständig. Tipp-Zeitpunkte, Lösungs-Zeitpunkte und Folien werden erst ab dem neuen Stand mitgeschrieben (nicht rückwirkend); bei älteren Einträgen ist nur bekannt, DASS ein Tipp geöffnet wurde (~)." }),
      legende(h),
      h("div", { class: "kfh-tools" },
        h("label", {}, h("input", { type: "checkbox", checked: state.viel ? true : null, onchange: function (ev) { state.viel = !!ev.target.checked; opts.rerender(); } }), "nur „viel Hilfe“ (> 50 % mit Tipp oder Lösung) · " + nViel),
        h("span", { class: "muted", text: "Sortieren: Spaltenkopf antippen" })),
      h("div", { class: "kfh-scroll" }, h("table", { class: "kfh-t" },
        h("thead", {}, h("tr", {}, h("th", { class: "l" }, h("button", { type: "button", text: "Schüler" + (srt === "name" ? " ▾" : ""), onclick: function (ev) { ev.stopPropagation(); state.sort = "name"; opts.rerender(); } })),
          h("th", { class: "l", text: "Wie gelöst" }), h("th", { text: "erledigt" }), sb("selbst", "selbstständig", "aufsteigend: wenig selbstständig zuerst"), sb("tpa", "Tipps/Aufgabe", "absteigend"), h("th", { text: "Lösung" }), sb("hilfe", "Hilfe-Anteil", "Anteil Aufgaben mit Tipp oder Lösung, absteigend"))),
        h("tbody", {}, rows.map(function (r) {
          return h("tr", { class: r.z.viel ? "viel" : null, onclick: function () { opts.open(r.s.id, seite); }, title: satzText(r.z) },
            h("td", { class: "l" }, h("b", { text: r.s.anzeige })), h("td", { class: "kfh-bc" }, bar(h, r.z)),
            h("td", { text: r.z.erledigt + " %" }), h("td", { text: r.z.selbst + " %" }), h("td", { text: String(Math.round(r.z.tpa * 10) / 10).replace(".", ",") + (r.z.unsicher ? " ~" : "") }),
            h("td", { text: r.z.c.loesung ? r.z.c.loesung + "×" : "–" }), h("td", { text: r.z.hilfe + " %" }));
        })))),
      h("p", { class: "note", text: rows.length + " Schüler mit Einträgen. Klick auf eine Zeile öffnet die Aufgabenliste mit Zeitstempeln." }));
  }
  function aufgLabel(k, seite) { var m = /-berichtigung$/.test(seite) && /^([A-E])(.+)$/.exec(k); return m ? "Aufgabe " + m[2] + " (Satz " + m[1] + ")" : k; }
  /* Detail je Schüler und Seite: Aufgabenliste mit Status + Zeitstempeln */
  function detail(h, daten, seite, id) {
    var e = eintrag(daten, seite, id); if (!e) return null; var L = liste(e, seite); if (!L.length) return null; css();
    var s = summe(e, seite);
    return h("div", { class: "kfh-det", "data-seite": seite },
      h("div", { class: "dh" }, h("b", { text: "Wie gelöst?" })),
      bar(h, s), h("p", { class: "kfh-sum", text: satzText(s) }),
      h("div", { class: "kfh-scroll" }, h("table", { class: "kfh-t" },
        h("thead", {}, h("tr", {}, h("th", { class: "l", text: "Aufgabe" }), h("th", { class: "l", text: "Status" }), h("th", { text: "Prüfen" }), h("th", { class: "l", text: "Tipps" }), h("th", { class: "l", text: "Zeit" }))),
        h("tbody", {}, L.map(function (a) {
          var x = a.x, tp = [], zt = [];
          if (x.h) tp.push("Tipp " + (x.h >= 2 ? "1+2" : "1") + (x.t1 ? " (" + fz(x.t1) + (x.t2 ? " / " + fz(x.t2) : "") + ")" : a.unsicher ? " ~" : ""));
          if (x.fo) tp.push("📖 Folie " + x.fo + "×" + (x.fz ? " (" + fz(x.fz) + ")" : ""));
          if (x.l) tp.push("Lösung gezeigt" + (x.lz ? " (" + fz(x.lz) + ")" : ""));
          if (+x.ok > 0) zt.push("richtig " + fz(x.ok)); else if (x.zt || x.z) zt.push("letzter Versuch " + fz(x.zt || x.z));
          if (x.t1 && x.ok && x.t1 <= x.ok) zt.push("Tipp → richtig: " + dauer(x.t1, x.ok));
          if (x.lz && x.ok && x.lz <= x.ok) zt.push("Lösung → richtig: " + dauer(x.lz, x.ok));
          return h("tr", {}, h("td", { class: "l", text: aufgLabel(a.k, seite) }),
            h("td", { class: "l" }, h("span", { class: "kfh-chip " + a.st, style: "background:" + ST[a.st].c, text: ST[a.st].l + (a.unsicher ? " ~" : "") }), a.sichtbar ? h("small", { class: "muted", text: " Lösungsweg war sichtbar" + (x.la ? " (" + fz(x.la) + ")" : "") }) : null),
            h("td", { text: x.n ? String(x.n) : "–" }), h("td", { class: "l", text: tp.join(" · ") || "–" }), h("td", { class: "l", text: zt.join(" · ") || "–" }));
        })))));
  }
  /* Einfache Ansicht für Schüler („So hast du gelöst“) und Eltern („So wurde gelöst“): Balken, Zähler, Aufgaben einzeln aufklappbar.
     Keine Uhrzeiten, kein „~“, keine Vergleiche. opts.du = Schüler-Anrede. */
  function einfach(h, e, seite, opts) {
    opts = opts || {}; if (!e) return null; var s = summe(e, seite); if (!s.n || s.c.offen === s.n) return null; css();
    var du = !!opts.du, L = liste(e, seite), selbst = s.c.sofort + s.c.versuche;
    var lab = { sofort: "sofort richtig", versuche: "nach Versuchen", tipp: "mit Tipp", loesung: du ? "Lösung angesehen" : "Lösung angezeigt", offen: "offen" };
    var teile = ORDER.filter(function (k) { return s.c[k]; }).map(function (k) { return h("span", {}, h("i", { style: "background:" + ST[k].c }), s.c[k] + " " + lab[k]); });
    return h("div", { class: "kfh-einfach" },
      h("p", { class: "kfh-e1" }, h("b", { text: du ? "So hast du gelöst" : "So wurde gelöst" }), " · " + selbst + " von " + s.n + (s.soll ? "" : " bearbeiteten") + " Aufgaben selbstständig"),
      bar(h, s, (du ? "So hast du gelöst: " : "So wurde gelöst: ") + selbst + " von " + s.n + " selbstständig"),
      h("div", { class: "kfh-leg" }, teile),
      h("details", { class: "kfh-auf" }, h("summary", { text: "Aufgaben einzeln" }),
        h("div", { class: "kfh-al" }, L.map(function (a) { return h("div", { class: "kfh-ar" }, h("span", { text: aufgLabel(a.k, seite) }),
          h("span", { class: "kfh-chip " + a.st, style: "background:" + ST[a.st].c, text: lab[a.st] })); }))),
      opts.hinweis ? h("p", { class: "kfh-e2", text: opts.hinweis }) : null);
  }
  window.KFHilfe = { einfach: einfach, status: status, liste: liste, summe: summe, satzText: satzText, zelle: zelle, klassenBox: klassenBox, detail: detail, state: state, ST: ST };
})();
