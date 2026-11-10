/* Prüfungs-Ring "Meine Vorbereitung für die Prüfung" + "Mein Weg zur Prüfung" (Mathe 10a) – zentrale Themenliste, Berechnung und Anzeige.
   Schüler: Knopf unten rechts (nur mit Anmeldung), liest den gespeicherten Stand (localStorage sl10a-*). Lehrer: THEMEN.fromText(Zusammenfassung) + THEMEN.teacherTable().
   Themen, Gewichte, Schwellen: nur HIER ändern. Aufgaben-Zuordnung und Kürzel-Tooltips: themen-data.js (erzeugt aus den Aufgabenquellen, inkl. Abschnittstitel + KFTip). Startwerte (Diagnose): Schlüssel sl10a-start = {v:1, t:{themaId: 0..1}}. */
(function(){
"use strict";
var D = window.THEMEN_DATA || {sites:{}, legacy:{}};
/* Gewicht w = grobe Schätzung der Bedeutung in der Realschulabschlussprüfung (Anpassung durch die Lehrkraft möglich). */
var LIST = [
  {id:"prozent", name:"Prozent und Wachstum", kurz:"Prozent", w:14},
  {id:"linear", name:"Lineare Funktionen", kurz:"Linear", w:14},
  {id:"quad", name:"Quadratische Funktionen", kurz:"Quadrat.", w:14},
  {id:"aehn", name:"Ähnlichkeit", kurz:"Ähnlichk.", w:10},
  {id:"pyth", name:"Pythagoras", kurz:"Pythag.", w:10},
  {id:"trig", name:"Trigonometrie", kurz:"Trigon.", w:12},
  {id:"koerper", name:"Körper (Volumen, Oberfläche)", kurz:"Körper", w:10},
  {id:"wahrsch", name:"Wahrscheinlichkeit", kurz:"Wahrsch.", w:12},
  {id:"terme", name:"Terme und Gleichungen", kurz:"Terme", w:10}
];
var BY = {}; LIST.forEach(function(t){ BY[t.id] = t; });
var LW = {muss:1, soll:1, kann:0.5};
var GRADE = [[93,1],[75,2],[60,3],[40,4],[20,5]];   /* Realschul-Skala wie bei den Mini-Tests */
var T_ROT = 40, T_GELB = 70;
var COL = {n:"#adb5bd", r:"#e03131", y:"#f2b01e", g:"#2f9e44"};
var esc = function(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
function cls(p){ return p == null ? "n" : p < T_ROT ? "r" : p < T_GELB ? "y" : "g"; }
function noteOf(p){ for(var i = 0; i < GRADE.length; i++) if(p >= GRADE[i][0]) return GRADE[i][1]; return 6; }

/* ---------- Eingangsdaten ---------- */
function rd(k){ try{ return JSON.parse(localStorage.getItem("sl10a-"+k)); }catch(e){ return null; } }
/* Startwert = Diagnose (sl10a-start) und – falls vorhanden – Ergebnisse geschriebener Tests/Mini-Tests (sl10a-test, gleiche Form {v:1,t:{thema:0..1}}); Test zählt stärker */
function merged(){
  var s = rd("start"), x = rd("test"), a = s && s.t ? s.t : null, b = x && x.t ? x.t : null; if(!a && !b) return null;
  var o = {}; LIST.forEach(function(t){ var p = a && a[t.id] != null ? +a[t.id] : null, q = b && b[t.id] != null ? +b[t.id] : null;
    if(p != null && q != null) o[t.id] = Math.round(100 * (0.4 * p + 0.6 * q)) / 100; else if(p != null) o[t.id] = p; else if(q != null) o[t.id] = q; });
  return o;
}
function fromStorage(){
  var src = {done:{}, slk:0, wdh:0, start:null};
  Object.keys(D.sites).forEach(function(k){ var t = rd(k), o = {}; if(t && t.t) Object.keys(t.t).forEach(function(id){ if(t.t[id] && t.t[id].ok) o[id] = 1; }); src.done[k] = o; });
  var v = rd("v1"); if(v && v.task) src.slk = Object.keys(v.task).filter(function(k){ return v.task[k] && /^m[0-5]-(\d+|c\d|d\d|det|lab.*)$/.test(k); }).length;
  var w = rd("wdh"); if(w && w.a) src.wdh = Object.keys(w.a).filter(function(k){ return w.a[k] && w.a[k].ok; }).length;
  src.start = merged();
  return src;
}
function line(text, tag){ var m = new RegExp("^"+tag+" (\\{.*\\})$", "m").exec(String(text||"")); try{ return m ? JSON.parse(m[1]) : null; }catch(e){ return null; } }
function fromText(text){
  var src = {done:{}, slk:0, wdh:0, start:null};
  [["trig","TRIG"],["pyth","PYTH"],["aehn","AEHN"]].forEach(function(kk){ var l = line(text, kk[1]), o = {}; if(l && l.d) l.d.forEach(function(id){ o[id] = 1; }); src.done[kk[0]] = o; });
  var s = line(text, "SLK"); if(s) src.slk = s.n || 0;
  var w = line(text, "WDH"); if(w && w.d) src.wdh = w.d.length;
  var st = line(text, "START"); if(st && st.t) src.start = st.t;
  return src;
}

/* ---------- Berechnung ---------- */
function compute(src){
  var th = LIST.map(function(t){ return {id:t.id, name:t.name, kurz:t.kurz, w:t.w, done:0, all:0, units:0, left:[], s:null}; });
  var by = {}; th.forEach(function(t){ by[t.id] = t; });
  Object.keys(D.sites).forEach(function(k){
    var dn = (src.done && src.done[k]) || {};
    D.sites[k].tasks.forEach(function(x){ var t = by[x[2]]; if(!t) return; var w = LW[x[1]] || 1; t.all += w; t.units++;
      if(dn[x[0]]) t.done += w; else t.left.push({site:D.sites[k].site, id:x[0], lvl:x[1]}); });
  });
  var lg = D.legacy || {};
  [["slk", src.slk], ["wdh", src.wdh]].forEach(function(kv){ var L = lg[kv[0]]; if(!L || !by[L.thema]) return; var t = by[L.thema], n = Math.min(kv[1] || 0, L.total);
    t.all += L.total; t.units += L.total; t.done += n; if(n < L.total) t.left.push({site:L.site, id:"", lvl:"muss", legacy:true, n:L.total - n}); });
  th.forEach(function(t){
    t.s = src.start && src.start[t.id] != null ? Math.max(0, Math.min(1, +src.start[t.id])) : null;
    t.tp = t.all ? t.done / t.all : null;
    var p = t.tp == null ? t.s : (t.s == null ? t.tp : t.s + (1 - t.s) * t.tp);
    t.p = p == null ? null : Math.round(100 * p); t.c = cls(t.p);
    var order = {muss:0, soll:1, kann:2}; t.left.sort(function(a, b){ return order[a.lvl] - order[b.lvl]; });
    t.hasTasks = t.all > 0;
  });
  var meas = th.filter(function(t){ return t.p != null; }), W = 0, S = 0; meas.forEach(function(t){ W += t.w; S += t.w * t.p; });
  var g = {n:meas.length, of:th.length, p:W ? Math.round(S / W) : null};
  g.note = g.p == null ? null : noteOf(g.p); g.c = cls(g.p);
  /* nächste Note + schnellste Punkte */
  g.next = null; g.fast = [];
  if(g.p != null && W){
    var nx = null; for(var i = GRADE.length - 1; i >= 0; i--) if(GRADE[i][0] > g.p){ nx = GRADE[i]; break; }
    if(nx) g.next = {note:nx[1], thr:nx[0], gap:nx[0] - g.p};
    var gains = th.filter(function(t){ return t.hasTasks && t.left.length && t.tp != null; }).map(function(t){
      var per = (t.w / W) * (1 - (t.s || 0)) * 100 / (t.all || 1); /* Prozentpunkte Gesamtstand je gelöster Aufgabe (Gewicht 1) */
      return {id:t.id, name:t.name, per:per, left:t.left.reduce(function(a, x){ return a + (x.n || 1); }, 0), units:t.units}; }).sort(function(a, b){ return b.per - a.per; });
    g.fast = gains.slice(0, 2);
    if(g.next){ var need = g.next.gap, cnt = 0; for(var j = 0; j < gains.length && need > 0; j++){ var take = Math.min(gains[j].left, Math.ceil(need / gains[j].per)); cnt += take; need -= take * gains[j].per; }
      g.next.tasks = need > 0 ? null : cnt; }
  }
  th.forEach(function(t){ var f = t.left[0]; t.link = f ? (f.legacy ? "../" + f.site + "/" : "../" + f.site + "/#" + f.id) : null; });
  return {themen:th, gesamt:g};
}

/* ---------- Anzeige: Balken, Ring, Tabelle ---------- */
var nz = function(x){ return String(Math.round(x*10)/10).replace(".", ","); };
var pct = function(p){ return p == null ? "–" : p + " %"; };
function bar(t, linkOK){
  var a = linkOK && t.link ? '<a href="'+esc(t.link)+'">' : '<span>', b = linkOK && t.link ? '</a>' : '</span>';
  var sub = !t.hasTasks ? (t.p == null ? "noch keine Übungsaufgaben" : "Startwert aus Diagnose, noch keine Übungsaufgaben") : nz(t.done) + " von " + nz(t.all) + " Aufgabenpunkten" + (t.s != null ? " · Startwert " + Math.round(100 * t.s) + " %" : "");
  return '<li class="thrw '+t.c+'">'+a+'<span class="thn">'+esc(t.name)+'</span><span class="thb"><i style="width:'+(t.p||0)+'%"></i></span><span class="thp">'+pct(t.p)+'</span>'+b+'<small>'+esc(sub)+(linkOK && t.link ? ' · ▶ weiter üben' : '')+'</small></li>';
}
function ringSvg(res, clickable){
  var C = 170, R = 128, n = res.themen.length, out = '<svg viewBox="0 0 340 340" class="thsvg" role="img" aria-label="Prüfungs-Ring">';
  [0.34, 0.67, 1].forEach(function(f){ out += '<circle cx="'+C+'" cy="'+C+'" r="'+(R*f)+'" fill="none" stroke="#dee2e6" stroke-dasharray="'+(f===1?'':'3 3')+'"/>'; });
  res.themen.forEach(function(t, i){
    var a0 = -Math.PI/2 + i * 2*Math.PI/n + 0.02, a1 = -Math.PI/2 + (i+1) * 2*Math.PI/n - 0.02, r = 14 + (R - 14) * ((t.p||0) / 100);
    var P = function(a, rr){ return (C + rr*Math.cos(a)).toFixed(1) + " " + (C + rr*Math.sin(a)).toFixed(1); };
    var d = "M"+C+" "+C+" L"+P(a0, r)+" A"+r+" "+r+" 0 0 1 "+P(a1, r)+" Z";
    out += '<path d="'+d+'" fill="'+COL[t.c]+'" fill-opacity="'+(t.p==null?.35:.85)+'" stroke="#fff" stroke-width="1.5" data-th="'+t.id+'" class="thseg'+(clickable && t.link ? ' lnk':'')+'"><title>'+esc(t.name)+': '+pct(t.p)+'</title></path>';
    var am = (a0 + a1) / 2, lx = C + (R + 22) * Math.cos(am), ly = C + (R + 20) * Math.sin(am);
    out += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#343a40">'+esc(t.kurz)+'</text><text x="'+lx.toFixed(1)+'" y="'+(ly+12).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#495057">'+pct(t.p)+'</text>';
  });
  return out + '</svg>';
}
function wayHtml(res){
  var g = res.gesamt;
  if(g.p == null) return '<p>Noch keine Daten. Sobald du Aufgaben gelöst hast (oder dein Startwert aus der Diagnose da ist), siehst du hier deinen Stand.</p>';
  var h = '<div class="thway"><div class="thbig '+g.c+'"><b>'+g.p+' %</b><span>Stand<br><small>'+g.n+' von '+g.of+' Themen erfasst</small></span></div>'
    + '<div><p>Das entspricht etwa <b>Note '+g.note+'</b> (Richtwert nach der Prüfungs-Skala – keine Notenprognose).</p>';
  if(g.next) h += '<p>Nächste Note: <b>Note '+g.next.note+'</b> ab '+g.next.thr+' % – dir fehlen noch <b>'+g.next.gap+' Prozentpunkte</b>'+(g.next.tasks ? ', das sind ungefähr <b>'+g.next.tasks+(g.next.tasks === 1 ? ' Aufgabe' : ' Aufgaben')+'</b>' : '')+'.</p>'; else h += '<p>🏆 Du bist in der besten Notenstufe. Halte den Stand!</p>';
  if(g.fast.length) h += '<p>Schnellste Punkte: ' + g.fast.map(function(f){ return '<b>'+esc(f.name)+'</b> (jede Aufgabe ≈ +'+(Math.round(f.per*10)/10).toString().replace(".", ",")+' %)'; }).join(" und ") + '.</p>';
  return h + '</div></div>';
}
function teacherCell(t){ return '<td class="thc '+t.c+'" title="'+esc(t.name)+'">'+(t.p == null ? "" : t.p)+'</td>'; }
function teacherTable(list){
  var rows = list.map(function(r){ return {r:r, res:compute(fromText(r.text))}; });
  var h = '<p class="leg">Prüfungs-Ring je Schüler (Stand in % je Thema aus Startwert [Diagnose/Test] + gelösten Aufgaben aller Seiten). <span class="thc g">≥ '+T_GELB+'</span> <span class="thc y">'+T_ROT+'–'+(T_GELB-1)+'</span> <span class="thc r">&lt; '+T_ROT+'</span> <span class="thc n">keine Daten</span>. „Gesamt“ = gewichteter Mittelwert der erfassten Themen, Note nach Skala 93/75/60/40/20 %. Richtwert, keine Notenvergabe.</p>'
    + '<table class="thtab"><thead><tr><th>Name</th>' + LIST.map(function(t){ return '<th class="num" title="'+esc(t.name)+'">'+esc(t.kurz)+'</th>'; }).join("") + '<th class="num">Gesamt</th><th class="num">Note ≈</th></tr></thead><tbody>';
  rows.forEach(function(x){ var g = x.res.gesamt; h += '<tr class="row" data-u="'+esc(x.r.user)+'"><td>'+esc(x.r.name)+'</td>' + x.res.themen.map(teacherCell).join("") + '<td class="thc '+g.c+'">'+(g.p == null ? "" : g.p)+'</td><td class="num">'+(g.note || "")+'</td></tr>'; });
  var avg = LIST.map(function(t, i){ var v = rows.map(function(x){ return x.res.themen[i].p; }).filter(function(p){ return p != null; }); return {n:v.length, p:v.length ? Math.round(v.reduce(function(a, b){ return a + b; }, 0) / v.length) : null}; });
  h += '<tr class="thavg"><td><b>Klasse Ø</b></td>' + avg.map(function(a){ return '<td class="thc '+cls(a.p)+'" title="'+a.n+' Schüler mit Daten">'+(a.p == null ? "" : a.p)+'</td>'; }).join("") + '<td></td><td></td></tr>'
    + '<tr class="thavg"><td>unter '+T_ROT+' % (rot)</td>' + LIST.map(function(t, i){ return '<td class="num">'+rows.filter(function(x){ var p = x.res.themen[i].p; return p != null && p < T_ROT; }).length+'</td>'; }).join("") + '<td></td><td></td></tr>';
  return h + '</tbody></table>';
}
function detailHtml(text){ var res = compute(fromText(text)); return '<h3>Prüfungs-Ring</h3><div class="thdet">'+wayHtml(res)+'<ul class="thl">'+res.themen.map(function(t){ return bar(t, false); }).join("")+'</ul></div>'; }

var CSS = ".thrw{list-style:none;margin:.2rem 0;padding:.3rem .5rem;border-radius:10px;background:#f8f9fa;display:block}.thrw a,.thrw>span:first-child{display:grid;grid-template-columns:minmax(150px,1.2fr) 2fr 3.2em;gap:.6rem;align-items:center;color:inherit;text-decoration:none}"
  + ".thrw a:hover{background:#edf2ff;border-radius:8px}.thrw small{display:block;color:#6c757d;font-size:.78rem;margin:.1rem 0 0 0}.thn{font-weight:600}.thb{display:block;height:12px;background:#e9ecef;border-radius:99px;overflow:hidden}.thb i{display:block;height:100%;border-radius:99px;background:#adb5bd}"
  + ".thrw.r .thb i{background:#e03131}.thrw.y .thb i{background:#f2b01e}.thrw.g .thb i{background:#2f9e44}.thp{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.thl{padding:0;margin:.4rem 0}"
  + ".thway{display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;background:#f1f3f5;border-radius:12px;padding:.7rem .9rem;margin:.4rem 0}.thway p{margin:.25rem 0}.thbig{flex:none;text-align:center;border-radius:14px;padding:.5rem .9rem;color:#fff;background:#adb5bd}.thbig b{display:block;font-size:2rem;line-height:1.1}.thbig span{font-size:.8rem}.thbig.r{background:#e03131}.thbig.y{background:#f2b01e;color:#212529}.thbig.g{background:#2f9e44}"
  + ".thtab{border-collapse:collapse}.thtab th,.thtab td{padding:.25rem .45rem;border-bottom:1px solid #e9ecef}.thc{text-align:center;font-weight:700;min-width:2.3rem}.thc.g{background:#d3f9d8}.thc.y{background:#fff3bf}.thc.r{background:#ffe3e3}.thc.n{background:#f1f3f5;color:#868e96}.thavg td{background:#f8f9fa}"
  + "#thBtn{position:fixed;right:12px;bottom:12px;z-index:8500;border:0;border-radius:999px;background:#1c3d5a;color:#fff;font:700 15px system-ui,sans-serif;padding:.65rem 1rem;box-shadow:0 4px 16px #0006;cursor:pointer}#thBtn:hover{background:#1971c2}"
  + "#thModal{position:fixed;inset:0;z-index:99990;background:#000a;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:1rem;font-family:system-ui,sans-serif}#thModal.on{display:flex}#thModal .thbox{background:#fff;color:#212529;border-radius:16px;max-width:980px;width:100%;padding:1rem 1.3rem 1.4rem;box-shadow:0 10px 40px #0008}"
  + "#thModal h2{margin:.1rem 2rem .2rem 0;font-size:1.3rem}#thModal .thx{float:right;border:0;background:#e9ecef;border-radius:8px;font-size:1.1rem;padding:.2rem .6rem;cursor:pointer}#thModal .thgrid{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:1rem;align-items:start}@media(max-width:720px){#thModal .thgrid{grid-template-columns:1fr}}"
  + ".thsvg{width:100%;height:auto}.thseg.lnk{cursor:pointer}.thseg.lnk:hover{filter:brightness(1.1)}#thModal .note{color:#6c757d;font-size:.82rem}.thhome{margin:1rem 0}.thsmall{color:#495057;font-size:.88rem}.thhome form{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}";

/* ---------- Persönliche Startübersicht (Heimseite): schwächste Themen aus Diagnose/Test, Links zum Üben ---------- */
function homeHtml(){
  var st = rd("start");
  if(!st || !st.t){
    return '<h3>🎯 Deine persönliche Startübersicht</h3><p>Aus dem Diagnosetest und dem Test zur Ähnlichkeit zeigen wir dir, was du <b>zuerst</b> üben solltest. Gib dafür <b>einmal</b> deinen Zugangscode ein (derselbe wie bei der Anmeldung):</p>'
      + '<form id="thLoad"><input type="password" name="c" placeholder="Zugangscode" autocomplete="off" size="20" aria-label="Zugangscode"> <button>Startübersicht laden</button> <span class="thmsg" role="status"></span></form>';
  }
  var res = compute(fromStorage()), meas = res.themen.filter(function(t){ return t.s != null && t.p != null; }).sort(function(a, b){ return a.p - b.p; }), weak = meas.filter(function(t){ return t.p < T_GELB; }).slice(0, 3);
  var h = '<h3>🎯 Deine persönliche Startübersicht</h3>';
  if(!weak.length) h += '<p>Alle Themen mit Startwert sind im grünen oder gelben Bereich – prima! Sieh dir trotzdem „🎯 Meine Vorbereitung für die Prüfung“ an.</p>';
  else h += '<p>Hier lohnt sich das Üben am meisten (nach Diagnosetest und deinem Fortschritt):</p><ul class="thl">' + weak.map(function(t){ return bar(t, true); }).join("") + '</ul>';
  var w = (st.w || []).slice(0, 6);
  if(w.length) h += '<p class="thsmall">Besonders knifflig im Diagnosetest: ' + w.map(function(x){ return esc(x[0]) + ' (' + x[2] + ' %)'; }).join(" · ") + '</p>';
  var tx = rd("test"), wt = tx && tx.wt ? tx.wt.slice(0, 4) : [];
  if(wt.length) h += '<p class="thsmall">Besonders knifflig im Ähnlichkeit-Test: ' + wt.map(function(x){ return esc(x[0]) + ' (' + x[1] + ' %)'; }).join(" · ") + '</p>';
  return h + '<p class="thsmall">Der Startwert ist nur eine Momentaufnahme. Jede gelöste Aufgabe verbessert deinen Stand im Prüfungs-Ring.</p>';
}
function home(){
  var el = document.getElementById("thHome"); if(!el) return;
  var s; try{ s = JSON.parse(localStorage.getItem("sl10a_sess")); }catch(e){} if(!s || !s.token){ el.innerHTML = ""; return; }
  el.className = "card thhome"; el.innerHTML = (window.WOCHE ? '<div class="wkbox">' + WOCHE.html() + '</div>' : '') + homeHtml();
  var f = el.querySelector("#thLoad"); if(f) f.addEventListener("submit", function(ev){ ev.preventDefault(); var m = f.querySelector(".thmsg"); m.textContent = "Lädt …";
    if(!window.SLX || !SLX.startImport){ m.textContent = "Gerade nicht möglich."; return; }
    SLX.startImport(s.user, f.c.value).then(function(ok){ if(ok) home(); else m.textContent = "Der Code passt nicht – oder für dich gibt es keine Diagnose-Werte."; }); });
}
function ui(){
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  var b = document.createElement("button"); b.id = "thBtn"; b.type = "button"; b.textContent = "🎯 Meine Vorbereitung für die Prüfung"; document.body.appendChild(b);
  var m = document.createElement("div"); m.id = "thModal"; document.body.appendChild(m);
  function open(){
    var res = compute(fromStorage());
    m.innerHTML = '<div class="thbox"><button class="thx" type="button" aria-label="schließen">✕</button><h2>🎯 Meine Vorbereitung für die Prüfung</h2><p class="note">Realschulabschluss Mathematik am 23.04.2027. Farben: <b style="color:#e03131">rot</b> unter '+T_ROT+' %, <b style="color:#c99200">gelb</b> '+T_ROT+'–'+(T_GELB-1)+' %, <b style="color:#2f9e44">grün</b> ab '+T_GELB+' %, <b style="color:#868e96">grau</b> = noch keine Daten. Klick auf ein Thema führt zu den nächsten offenen Aufgaben.</p>'
      + '<h3 style="margin:.6rem 0 0">Mein Weg zur Prüfung</h3>'+wayHtml(res)+'<div class="thgrid"><div>'+ringSvg(res, true)+'</div><ul class="thl">'+res.themen.map(function(t){ return bar(t, true); }).join("")+'</ul></div>'
      + (window.WOCHE ? WOCHE.mini() : '') + '<p class="note">Stand = Startwert (Diagnose/Test, falls vorhanden) + gelöste Aufgaben auf allen Selbstarbeit-Seiten (KANN-Aufgaben zählen halb). Das ist eine Orientierung, keine Note.</p></div>';
    m.classList.add("on");
    m.querySelectorAll(".thseg.lnk").forEach(function(p){ p.addEventListener("click", function(){ var t = res.themen.filter(function(x){ return x.id === p.dataset.th; })[0]; if(t && t.link) location.href = t.link; }); });
    if (window.KFZurueck) window.KFZurueck.push(hide);
  }
  function hide(){ m.classList.remove("on"); }
  function close(){ if(m.classList.contains("on") && window.KFZurueck){ try{ window.KFZurueck.pop(); }catch(e){} } hide(); }
  b.addEventListener("click", open);
  m.addEventListener("click", function(e){ if(e.target === m || e.target.closest(".thx")) close(); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") close(); });
  window.THEMEN.open = open;
  setInterval(function(){ if(document.body && !b.isConnected){ document.body.appendChild(b); document.body.appendChild(m); } }, 1200);   /* Seiten, die den body neu aufbauen (Wiederholung) */
}

/* ---------- Für Lehrer-Druck / Portal-Dashboard (t137u/t138u): gleiche Berechnung, zusätzliche HTML-Bausteine. Schüler-UI unverändert. ---------- */
function fromRing(o){
  if(!o) return {done:{}, slk:0, wdh:0, start:null};
  if(typeof o === "string") return fromText(o);
  return {done:o.done || {}, slk:o.slk || 0, wdh:o.wdh || 0, start:o.start || null};
}
function poolHtml(res, limit){
  limit = limit || 8;
  var blocks = res.themen.filter(function(t){ return t.left && t.left.length; });
  if(!blocks.length) return '<p class="thsmall">Keine offenen Übungsaufgaben in den erfassten Themen – Stand halten.</p>';
  var h = '<h3>Übungspool (nächste offene Aufgaben)</h3><div class="thpool">';
  blocks.forEach(function(t){
    var items = t.left.slice(0, limit).map(function(x){
      var lab = x.legacy ? ((x.n || 1) + " Aufgaben auf der älteren Übungsseite") : (x.id || "");
      var hint = x.legacy ? (x.site || "") : ((x.site || "") + (x.id ? "/#" + x.id : ""));
      var lvl = x.lvl ? ' <small>'+esc(x.lvl.toUpperCase())+'</small>' : "";
      return '<li><b>'+esc(lab)+'</b>'+lvl+(hint ? ' <span class="thhint">'+esc(hint)+'</span>' : "")+'</li>';
    }).join("");
    var more = t.left.length > limit ? '<li class="thsmall">… '+(t.left.length-limit)+' weitere</li>' : "";
    h += '<div class="thpc '+t.c+'"><h4>'+esc(t.name)+' <span>'+pct(t.p)+'</span></h4><ul>'+items+more+'</ul></div>';
  });
  return h + '</div>';
}
function studentViewHtml(res, opts){
  opts = opts || {};
  var title = opts.title || "Meine Vorbereitung für die Prüfung";
  var note = opts.note || ("Realschulabschluss Mathematik am 23.04.2027. Farben: <b style=\"color:#e03131\">rot</b> unter "+T_ROT+" %, <b style=\"color:#c99200\">gelb</b> "+T_ROT+"–"+(T_GELB-1)+" %, <b style=\"color:#2f9e44\">grün</b> ab "+T_GELB+" %, <b style=\"color:#868e96\">grau</b> = noch keine Daten. Richtwert nach der Prüfungs-Skala, keine Notenvergabe.");
  var links = !!opts.links;
  var h = (opts.heading === false ? "" : "<h2>"+esc(title)+"</h2>") + '<p class="note">'+note+"</p>";
  h += "<h3>Mein Weg zur Prüfung</h3>"+wayHtml(res);
  h += '<div class="thgrid"><div>'+ringSvg(res, links)+'</div><ul class="thl">'+res.themen.map(function(t){ return bar(t, links); }).join("")+"</ul></div>";
  if(opts.pool !== false) h += poolHtml(res, opts.poolLimit);
  if(opts.foot !== false) h += '<p class="note">Stand = Startwert (Diagnose/Test, falls vorhanden) + gelöste Aufgaben auf allen Selbstarbeit-Seiten (KANN-Aufgaben zählen halb). Das ist eine Orientierung, keine Note.</p>';
  return h;
}
var PRINT_CSS = CSS
  + ".thpool{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.5rem;margin:.4rem 0}.thpc{background:#f8f9fa;border-radius:10px;padding:.45rem .6rem;border-left:4px solid #adb5bd}.thpc h4{margin:0 0 .25rem;font-size:.92rem;display:flex;justify-content:space-between;gap:.4rem}.thpc ul{margin:0;padding-left:1.1rem}.thpc.r{border-left-color:#e03131}.thpc.y{border-left-color:#f2b01e}.thpc.g{border-left-color:#2f9e44}.thhint{color:#6c757d;font-size:.78rem}"
  + ".thgrid{display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:1rem;align-items:start}@media(max-width:720px){.thgrid{grid-template-columns:1fr}}"
  + "@page{size:A4;margin:12mm}@media print{.no-print{display:none!important}body{background:#fff;color:#212529}.kfd-page{break-after:page;page-break-after:always}.kfd-page:last-child{break-after:auto;page-break-after:auto}.thgrid{grid-template-columns:62mm 1fr;gap:.5rem}.thsvg{max-width:62mm;max-height:62mm}.thway{padding:.45rem .6rem;gap:.6rem}.thway .thbig b{font-size:1.5rem}.kfd-head,.thway{break-inside:avoid;page-break-inside:avoid}.thl{margin:0}}";;

window.THEMEN = {merged:merged, home:home, homeHtml:homeHtml, LIST:LIST, compute:compute, fromStorage:fromStorage, fromText:fromText, fromRing:fromRing, teacherTable:teacherTable, detailHtml:detailHtml, wayHtml:wayHtml, ringSvg:ringSvg, bar:bar, studentViewHtml:studentViewHtml, poolHtml:poolHtml, CSS:CSS, PRINT_CSS:PRINT_CSS, T_ROT:T_ROT, T_GELB:T_GELB, noteOf:noteOf, cls:cls, taskTip:function(id){ return window.KFTip ? KFTip.text(id) : ""; }, tipHtml:function(id, inner){ return window.KFTip ? KFTip.html(id, inner) : String(id==null?"":id); }};
/* Knopf nur auf Schülerseiten mit Anmeldung */
function boot(){ if(document.documentElement.getAttribute("data-kf")==="portal" || /\/portal(\/|$)/.test(location.pathname)) return; home(); var s; try{ s = JSON.parse(localStorage.getItem("sl10a_sess")); }catch(e){} if(s && s.token && !/lehrer/.test(location.pathname) && !document.getElementById("thBtn")) ui(); }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
