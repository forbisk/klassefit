/* Lehrer-Druck und Prüfungsansicht im Portal-Dashboard (t137u, t138u).
   Nur für die Lehrkraft. Baut A4-Druckansichten aus den Dashboard-Daten (admin_fortschritt,
   inkl. ring falls das Backend sie liefert). Keine Schülerseite, kein Download-Link für Schüler. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var deDate = function (ms) {
    return new Date(ms || Date.now()).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  function isExamKlasse(kl) { return /^10/i.test(String(kl || "")); }

  function ringSrc(dash, id) {
    if (!dash || !dash.ring) return null;
    return dash.ring[id] || null;
  }
  function ringRes(dash, id) {
    if (!window.THEMEN) return null;
    var src = ringSrc(dash, id);
    if (!src) return null;
    return THEMEN.compute(THEMEN.fromRing(src));
  }
  function hasExamView(dash, sch) {
    return !!(sch && isExamKlasse(sch.klasse) && ringRes(dash, sch.id));
  }

  function ampCls(c, helpers) {
    if (helpers && helpers.cls) return helpers.cls(c);
    if (!c) return "c0";
    var p = c.pct;
    if (c.skala === "pct" && p != null) return p >= 85 ? "c4" : p >= 66 ? "c3" : p >= 33 ? "c2" : "c1";
    if (c.status === "fertig") return "c4";
    if (c.zwischenstand) return "cz";
    return p == null ? (c.wert != null ? "cn" : "c1") : p >= 66 ? "c3" : p >= 33 ? "c2" : "c1";
  }
  function cellText(c, helpers) {
    if (helpers && helpers.ctext) return helpers.ctext(c);
    if (!c) return "–";
    if (c.skala === "pct") return c.pct != null ? String(Math.round(c.pct)) : "·";
    if (c.status === "fertig") return "✓";
    if (c.pct != null) return String(Math.round(c.pct));
    return c.wert != null ? String(c.wert) : "·";
  }
  function cellDesc(c, helpers) {
    if (helpers && helpers.cdesc) return helpers.cdesc(c);
    if (!c) return "nicht begonnen";
    if (c.zwischenstand) return "Test begonnen, noch nicht abgegeben";
    if (c.pct != null) return Math.round(c.pct) + " %" + (c.note ? " · Note " + c.note : "");
    return c.status || "";
  }

  function css() {
    var th = (window.THEMEN && THEMEN.PRINT_CSS) || (window.THEMEN && THEMEN.CSS) || "";
    return th + [
      "#kfdPrint{position:fixed;inset:0;z-index:100000;background:#e9ecef;color:#212529;overflow:auto;font:15px/1.45 system-ui,sans-serif}",
      "#kfdPrint .kfd-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;padding:.7rem 1rem;background:#1c3d5a;color:#fff;box-shadow:0 2px 10px #0004}",
      "#kfdPrint .kfd-bar h2{margin:0;font-size:1.05rem;font-weight:700}",
      "#kfdPrint .kfd-bar .btns{display:flex;gap:.5rem;flex-wrap:wrap}",
      "#kfdPrint .kfd-bar button{font:700 14px system-ui,sans-serif;border:0;border-radius:10px;padding:.45rem .9rem;cursor:pointer;background:#fff;color:#1c3d5a}",
      "#kfdPrint .kfd-bar button.ghost{background:transparent;color:#fff;border:1px solid #fff8}",
      "#kfdPrint .kfd-doc{max-width:210mm;margin:1rem auto 2rem;padding:0 8px}",
      "#kfdPrint .kfd-page{background:#fff;color:#212529;padding:12mm;margin:0 0 1rem;box-shadow:0 2px 14px #0002;min-height:277mm;box-sizing:border-box}",
      "#kfdPrint .kfd-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;border-bottom:2px solid #1c3d5a;padding-bottom:.4rem;margin-bottom:.7rem}",
      "#kfdPrint .kfd-head h1{margin:0;font-size:1.25rem}",
      "#kfdPrint .kfd-head .meta{text-align:right;color:#495057;font-size:.85rem}",
      "#kfdPrint table.kfd-tab{border-collapse:collapse;width:100%;font-size:.82rem;margin:.4rem 0 0.8rem}",
      "#kfdPrint table.kfd-tab th,#kfdPrint table.kfd-tab td{border:1px solid #dee2e6;padding:.2rem .35rem;text-align:center}",
      "#kfdPrint table.kfd-tab th.l,#kfdPrint table.kfd-tab td.l{text-align:left;font-weight:600}",
      "#kfdPrint .c0{background:#f1f3f5;color:#868e96}.c1{background:#ffe3e3}.c2{background:#fff3bf}.c3{background:#d3f9d8}.c4{background:#8ce99a}.cz{background:#d0ebff}.cn{background:#e7f5ff}",
      "#kfdPrint .leg{display:flex;flex-wrap:wrap;gap:.4rem .8rem;font-size:.78rem;color:#495057;margin:.3rem 0 .6rem}",
      "#kfdPrint .leg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:4px;vertical-align:-1px;border:1px solid #0002}",
      "#kfdPrint .kfd-foot{margin-top:1rem;font-size:.78rem;color:#6c757d;border-top:1px solid #dee2e6;padding-top:.4rem}",
      "#kfdPrint .kfd-tests h3{margin:.8rem 0 .3rem;font-size:1rem}",
      "#kfdPrint .kfd-tests .row{display:flex;justify-content:space-between;gap:.6rem;padding:.25rem 0;border-bottom:1px solid #f1f3f5}",
      "@media print{html,body{background:#fff!important;margin:0}#kfdPrint{position:static;background:#fff;overflow:visible}#kfdPrint .kfd-bar,.no-print,[data-kfd-ignore]{display:none!important}#kfdPrint .kfd-doc{max-width:none;margin:0;padding:0}#kfdPrint .kfd-page{box-shadow:none;margin:0;min-height:0;padding:0;break-after:page;page-break-after:always}#kfdPrint .kfd-page:last-child{break-after:auto;page-break-after:auto}body.kfd-printing > *:not(#kfdPrint){display:none!important}}",
      "@page{size:A4;margin:12mm}"
    ].join("");
  }

  function pageHead(title, sub, stand) {
    return '<div class="kfd-head"><div><h1>' + esc(title) + "</h1>" + (sub ? '<div class="meta" style="text-align:left">' + sub + "</div>" : "") + '</div><div class="meta">Stand ' + esc(stand) + "<br>KlasseFit · nur für die Lehrkraft</div></div>";
  }

  function legend() {
    return '<div class="leg"><span><i class="c0"></i>nicht begonnen</span><span><i class="c1"></i>&lt; 33 %</span><span><i class="c2"></i>33–66 %</span><span><i class="c3"></i>&gt; 66 %</span><span><i class="c4"></i>fertig / Test ≥ 85 %</span><span><i class="cz"></i>Test nur begonnen</span></div>';
  }

  function testsTable(dash, schList, pages, helpers) {
    if (!pages || !pages.length || !schList.length) return "";
    var h = '<table class="kfd-tab"><thead><tr><th class="l">Schüler</th>';
    pages.forEach(function (p) { h += "<th>" + esc(p.titel) + "</th>"; });
    h += "<th>Ø</th></tr></thead><tbody>";
    schList.forEach(function (s) {
      var z = (dash.zellen && dash.zellen[s.id]) || {};
      h += '<tr><td class="l">' + esc(s.anzeige) + (s.klasse && !helpers.hideKlasse ? ' <small>' + esc(s.klasse) + "</small>" : "") + "</td>";
      var sum = 0, n = 0;
      pages.forEach(function (p) {
        var c = z[p.key + "|gesamt"] || z[p.key + "|ergebnis"] || z[p.key + "|pt1"] || null;
        if (!c) {
          var th = (dash.themen || []).filter(function (t) { return t.seite === p.key; });
          var ps = [];
          th.forEach(function (t) { var x = z[p.key + "|" + t.thema]; if (x && x.pct != null) ps.push(x.pct); });
          if (ps.length) c = { pct: ps.reduce(function (a, b) { return a + b; }, 0) / ps.length, skala: "pct" };
        }
        if (c && c.pct != null) { sum += c.pct; n++; }
        h += '<td class="' + ampCls(c, helpers) + '" title="' + esc(cellDesc(c, helpers)) + '">' + esc(cellText(c, helpers)) + "</td>";
      });
      h += "<td>" + (n ? Math.round(sum / n) : "–") + "</td></tr>";
    });
    return h + "</tbody></table>";
  }

  function testBlock(dash, sch, pages, helpers) {
    var z = (dash.zellen && dash.zellen[sch.id]) || {};
    var rows = [];
    (pages || dash.seiten || []).forEach(function (p) {
      var themen = (dash.themen || []).filter(function (t) { return t.seite === p.key; });
      var any = themen.some(function (t) { return z[p.key + "|" + t.thema]; });
      if (!any) return;
      themen.forEach(function (t) {
        var c = z[p.key + "|" + t.thema];
        if (!c) return;
        rows.push('<div class="row"><span>' + esc(p.titel) + " · " + esc(t.label) + '</span><span class="' + ampCls(c, helpers) + '" style="padding:0 .4rem;border-radius:6px">' + esc(cellDesc(c, helpers)) + "</span></div>");
      });
    });
    if (!rows.length) return "";
    return '<div class="kfd-tests"><h3>Ergebnisse auf der Plattform</h3>' + rows.join("") + "</div>";
  }

  function overviewHtml(dash, schList, pages, klasse, helpers, stand) {
    var title = "Klassenübersicht" + (klasse ? " · Klasse " + klasse : "");
    var h = pageHead(title, "Bewertungen zum Ausdrucken (ein Blatt je Schüler folgt).", stand) + legend();
    var withRing = schList.filter(function (s) { return hasExamView(dash, s); });
    if (withRing.length && window.THEMEN) {
      h += "<h3>Prüfungs-Ring (Mathe 10a)</h3>";
      h += THEMEN.teacherTable(withRing.map(function (s) {
        return { user: s.id, name: s.anzeige, text: "", res: ringRes(dash, s.id) };
      }).map(function (x) {
        /* teacherTable expects {user,name,text} and computes fromText. If we have structured ring, feed a synthetic text? */
        return x;
      }));
    }
    /* teacherTable uses fromText on r.text. If we pass rows with empty text it will be empty.
       Build a compatible table ourselves if we have res, or temporarily patch.
       Better: build rows using compute results via a small local table if teacherTable needs text.
       We'll render our own ring table when we have res. */
    if (withRing.length && window.THEMEN) {
      /* replace the possibly empty teacherTable if we called it with empty text – don't call it. Redo: */
    }
    return { start: pageHead(title, "Bewertungen zum Ausdrucken (ein Blatt je Schüler folgt).", stand) + legend(), withRing: withRing, klasse: klasse };
  }

  function ringTable(dash, schList) {
    if (!window.THEMEN || !schList.length) return "";
    var LIST = THEMEN.LIST;
    var rows = schList.map(function (s) { return { s: s, res: ringRes(dash, s.id) }; }).filter(function (x) { return x.res; });
    if (!rows.length) return "";
    var h = '<h3>Prüfungs-Ring (Mathe 10a) – Ampel je Thema</h3><p class="note">Stand in % je Thema aus Startwert (Diagnose/Test) + gelösten Aufgaben. Gesamt = gewichteter Mittelwert, Note nach Skala 93/75/60/40/20 %. Richtwert, keine Notenvergabe.</p>';
    h += '<table class="kfd-tab thtab"><thead><tr><th class="l">Schüler</th>' + LIST.map(function (t) { return '<th title="' + esc(t.name) + '">' + esc(t.kurz) + "</th>"; }).join("") + "<th>Gesamt</th><th>Note ≈</th></tr></thead><tbody>";
    rows.forEach(function (x) {
      var g = x.res.gesamt;
      h += '<tr><td class="l">' + esc(x.s.anzeige) + "</td>" + x.res.themen.map(function (t) {
        return '<td class="thc ' + t.c + '">' + (t.p == null ? "" : t.p) + "</td>";
      }).join("") + '<td class="thc ' + g.c + '">' + (g.p == null ? "" : g.p) + '</td><td>' + (g.note || "") + "</td></tr>";
    });
    var avg = LIST.map(function (t, i) {
      var v = rows.map(function (x) { return x.res.themen[i].p; }).filter(function (p) { return p != null; });
      return { n: v.length, p: v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null };
    });
    function clsP(p) { return window.THEMEN.cls ? THEMEN.cls(p) : (p == null ? "n" : p < 40 ? "r" : p < 70 ? "y" : "g"); }
    h += '<tr class="thavg"><td class="l"><b>Klasse Ø</b></td>' + avg.map(function (a) { return '<td class="thc ' + clsP(a.p) + '">' + (a.p == null ? "" : a.p) + "</td>"; }).join("") + "<td></td><td></td></tr>";
    h += '<tr class="thavg"><td class="l">unter 40 % (rot)</td>' + LIST.map(function (t, i) {
      return "<td>" + rows.filter(function (x) { var p = x.res.themen[i].p; return p != null && p < 40; }).length + "</td>";
    }).join("") + "<td></td><td></td></tr>";
    return h + "</tbody></table>";
  }

  function studentPage(dash, sch, pages, helpers, stand) {
    var sub = "Klasse " + esc(sch.klasse);
    var h = pageHead(sch.anzeige, sub, stand);
    var res = ringRes(dash, sch.id);
    if (res && window.THEMEN) {
      h += THEMEN.studentViewHtml(res, { links: false, heading: true, title: "Vorbereitung für die Prüfung", pool: true, poolLimit: 5 });
    } else {
      h += '<p class="note">Einzelübersicht der vorliegenden Ergebnisse. (Die Prüfungsansicht mit Ring und Richtwert-Note gibt es für Klassen mit „Meine Vorbereitung für die Prüfung“, sobald die Ring-Daten vom Backend vorliegen.)</p>';
    }
    h += testBlock(dash, sch, pages, helpers);
    h += '<div class="kfd-foot">Dieses Blatt ist für die Lehrkraft zum Ausdrucken (z. B. für ein Elterngespräch). Die Schülerinnen und Schüler sehen auf der Plattform nur ihr eigenes Ergebnis. Orientierung, keine offizielle Note. Links auf Übungsseiten sind Lernhinweise.</div>';
    return h;
  }

  function docHtml(dash, schList, pages, helpers) {
    var stand = deDate(dash && dash.erzeugt);
    var byK = {}, klassen = [];
    schList.forEach(function (s) {
      var k = s.klasse || "";
      if (!byK[k]) { byK[k] = []; klassen.push(k); }
      byK[k].push(s);
    });
    klassen.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10) || (a < b ? -1 : 1); });
    var parts = [];
    klassen.forEach(function (k) {
      var list = byK[k];
      var ov = pageHead("Klassenübersicht" + (k ? " · Klasse " + k : ""), "Eine Datei: Übersicht plus ein Blatt je Schüler.", stand) + legend();
      var exam = list.filter(function (s) { return hasExamView(dash, s); });
      if (exam.length) ov += ringTable(dash, exam);
      ov += "<h3>Ergebnisse (sichtbare Seiten / Tests)</h3>" + testsTable(dash, list, pages, Object.assign({}, helpers, { hideKlasse: true }));
      ov += '<div class="kfd-foot">Ampel: rot / gelb / grün nach den Schwellen der jeweiligen Ansicht. Nur für die Lehrkraft.</div>';
      parts.push('<section class="kfd-page kfd-ov">' + ov + "</section>");
      list.forEach(function (s) {
        parts.push('<section class="kfd-page kfd-st">' + studentPage(dash, s, pages, helpers, stand) + "</section>");
      });
    });
    return parts.join("");
  }

  function detailExamHtml(dash, sch) {
    var res = ringRes(dash, sch.id);
    if (!res || !window.THEMEN) return "";
    return '<div class="kfd-exam">' + THEMEN.studentViewHtml(res, { links: false, title: "Meine Vorbereitung für die Prüfung", pool: true }) + "</div>";
  }

  function closePrint() {
    var el = document.getElementById("kfdPrint");
    if (el) el.remove();
    document.body.classList.remove("kfd-printing");
    var st = document.getElementById("kfdPrintStyle");
    if (st) st.remove();
  }

  function openDoc(inner, title) {
    closePrint();
    var st = document.createElement("style");
    st.id = "kfdPrintStyle";
    st.textContent = css();
    document.head.appendChild(st);
    var wrap = document.createElement("div");
    wrap.id = "kfdPrint";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", title || "Druckansicht");
    wrap.innerHTML = '<div class="kfd-bar no-print"><h2>' + esc(title || "Druckansicht") + '</h2><div class="btns">'
      + '<button type="button" id="kfdDoPrint">Drucken / Als PDF speichern</button>'
      + '<button type="button" class="ghost" id="kfdClose">Schließen</button></div></div>'
      + '<div class="kfd-doc">' + inner + "</div>";
    document.body.appendChild(wrap);
    document.getElementById("kfdDoPrint").addEventListener("click", function () {
      document.body.classList.add("kfd-printing");
      window.print();
      setTimeout(function () { document.body.classList.remove("kfd-printing"); }, 500);
    });
    document.getElementById("kfdClose").addEventListener("click", closePrint);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closePrint(); });
    if (window.KFZurueck) window.KFZurueck.push(closePrint);
    wrap.scrollTop = 0;
    return wrap;
  }

  function printAll(dash, view, helpers) {
    if (!dash || !view || !view.sch || !view.sch.length) {
      window.alert("Keine Schüler in der aktuellen Auswahl.");
      return;
    }
    var html = docHtml(dash, view.sch, view.pages || dash.seiten || [], helpers || {});
    openDoc(html, "Alle Bewertungen ausdrucken");
  }

  function printOne(dash, sch, view, helpers) {
    if (!dash || !sch) return;
    var stand = deDate(dash.erzeugt);
    var pages = (view && view.pages) || dash.seiten || [];
    var html = '<section class="kfd-page kfd-st">' + studentPage(dash, sch, pages, helpers || {}, stand) + "</section>";
    openDoc(html, "Als PDF speichern · " + sch.anzeige);
  }

  window.KFDruck = {
    printAll: printAll,
    printOne: printOne,
    hasExamView: hasExamView,
    ringRes: ringRes,
    detailExamHtml: detailExamHtml,
    documentHtml: docHtml,
    studentPage: studentPage,
    close: closePrint,
    css: css
  };
})();
