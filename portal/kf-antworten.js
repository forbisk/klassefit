/* KlasseFit – „Neue Antwort von Herrn Kurlavičius“ (gemeinsam: Portal, Selbstlernen 10a, Wiederholung 10a, Fit für die KA 7a über kf-fragen.js).
   Quelle: Selbstlern-Backend Aktion myQuestions (Frage/Antwort je Aufgabe). Gelesen-Status:
   - serverseitig, wenn das Backend Feld "gelesen" liefert + Aktion markRead kennt (Code.gs ab 03.11.2026 „Antworten gelesen“),
   - sonst / zusätzlich lokal je Benutzer (localStorage kf-antw-gelesen:<user>).
   Link: ../<ordner>/<seite>#frage=<Aufgaben-ID> – die Zielseite springt zur Aufgabe und markiert sie. Keine Namen/Geheimnisse hier. */
(function(){
"use strict";
if(window.KFAntworten) return;
var SL_SEITEN = {"aufwaermen":"Aufwärmen","gruppenarbeit":"Gruppenarbeit","index":"Start","modul0-wiederholung":"Modul 0 – Wiederholung",
  "modul1-zentrische-streckung":"Modul 1 – Zentrische Streckung","modul2-aehnliche-dreiecke":"Modul 2 – Ähnliche Dreiecke","modul3-strahlensaetze":"Modul 3 – Strahlensätze",
  "modul4-flaeche-volumen":"Modul 4 – Fläche und Volumen","modul5-anwendungen":"Modul 5 – Anwendungen","pruefung":"Prüfungsteil","selbsttest":"Selbsttest","training":"Training","merksaetze":"Merksätze"};
var MOD = {m0:"modul0-wiederholung",m1:"modul1-zentrische-streckung",m2:"modul2-aehnliche-dreiecke",m3:"modul3-strahlensaetze",m4:"modul4-flaeche-volumen",m5:"modul5-anwendungen",gr:"gruppenarbeit"};
var ANDERE = {   /* Präfix der Aufgaben-ID bzw. Seite -> [Ordner, Anzeigename] */
  wdh:["mathe10-wiederholung","Wiederholung Ähnlichkeit"], wiederholung:["mathe10-wiederholung","Wiederholung Ähnlichkeit"],
  pf:["pruefungsfit-mathe","Prüfungsfit Mathe"], pruefungsfit:["pruefungsfit-mathe","Prüfungsfit Mathe"],
  pyth:["mathe10-pythagoras-selbst","Pythagoras – Selbstlernen"], "pythagoras-selbst":["mathe10-pythagoras-selbst","Pythagoras – Selbstlernen"],
  trig:["mathe10-trigonometrie-selbst","Trigonometrie – Selbstlernen"], "trigonometrie-selbst":["mathe10-trigonometrie-selbst","Trigonometrie – Selbstlernen"],
  aehn:["mathe10-aehnlichkeit-abschluss","Ähnlichkeit – Abschluss"], "aehnlichkeit-abschluss":["mathe10-aehnlichkeit-abschluss","Ähnlichkeit – Abschluss"],
  tbk:["mathe10-testberichtigung-aehnlichkeit","Testberichtigung Ähnlichkeit"], "mathe10a-testberichtigung-aehnlichkeit":["mathe10-testberichtigung-aehnlichkeit","Testberichtigung Ähnlichkeit"],
  kk:["mathe10-karteikarten","Karteikarten"],
  sa7:["mathe7-selbstarbeit","Mathe 7a – Fit für die KA"], "mathe7-selbstarbeit":["mathe7-selbstarbeit","Mathe 7a – Fit für die KA"]
};
function ziel(q){
  var id = String(q.taskId||""), seite = String(q.seite||""), pre = id.split(":")[0];
  if(SL_SEITEN[seite]) return {ordner:"mathe10-selbstlernen", datei:seite+".html", name:SL_SEITEN[seite], sprung:true};
  if(ANDERE[seite] || ANDERE[pre]){ var a = ANDERE[seite] || ANDERE[pre]; return {ordner:a[0], datei:"", name:a[1], sprung:a[0]==="mathe10-wiederholung"}; }
  if(SL_SEITEN[pre]) return {ordner:"mathe10-selbstlernen", datei:pre+".html", name:SL_SEITEN[pre], sprung:true};
  var m = /^([a-z]{1,2}\d?)-/.exec(id); if(m && MOD[m[1]]) return {ordner:"mathe10-selbstlernen", datei:MOD[m[1]]+".html", name:SL_SEITEN[MOD[m[1]]], sprung:true};
  return {ordner:"mathe10-selbstlernen", datei:"", name:"Mathe 10a – Selbstlernen", sprung:false};
}
function link(q, vonOrdner){
  var z = ziel(q), pfad = (vonOrdner===z.ordner ? "" : "../"+z.ordner+"/") + z.datei;
  return (pfad || "./") + "#frage=" + encodeURIComponent(String(q.taskId||""));
}
function aufgabe(q){   /* lesbarer Aufgaben-Titel: aus dem gespeicherten Aufgabentext (neues Backend), sonst aus der ID */
  var z = ziel(q), t = String(q.task||""), teile = t ? t.split(" | ") : [];
  if(teile.length >= 2){
    var kopf = teile[1].replace(/✓ gelöst/g,"").replace(/\s+/g," ").trim(), lv = /^(.{0,8}?)(MUSS|SOLL|KANN)\s*(.*)$/.exec(kopf);
    if(lv){ var nr = lv[1].replace(/[^0-9a-z.]/gi,""); kopf = lv[3].replace(/^(Abschreiben|Beispiel ins Heft|Nur lesen|Diskutieren|Schriftlich)\s*/,"");
      kopf = (nr ? "Aufgabe " + nr + (kopf ? ": " : "") : "") + kopf; }
    var erster = teile[0].replace(/\s*·.*$/,"").trim();
    if(/^Wiederholung$/.test(erster) && teile[2]) kopf = teile[1] + " · " + teile[2];
    return (erster || z.name) + (kopf ? " · " + kopf.slice(0,90) : "");
  }
  var id = String(q.taskId||""), rest = id.replace(/^[^:]*:/, "");
  var nr = /^m\d-(\d+)/.exec(id); if(nr) return z.name + " · Aufgabe " + nr[1];
  if(rest && rest!==id && !/[A-Za-z0-9]/.test(rest)) return z.name + " · Zufallsaufgabe";
  return z.name + (rest && rest!==id ? " · " + rest.replace(/:(\d+)$/, function(_, n){ return " · Übungsaufgabe " + (+n+1); }) : "");
}
function lsKey(user){ return "kf-antw-gelesen:" + String(user||""); }
function lokal(user){ try{ return JSON.parse(localStorage.getItem(lsKey(user))||"{}") || {}; }catch(e){ return {}; } }
function neu(list, user){
  var l = lokal(user);
  return (list||[]).filter(function(q){ return q && q.antwort && !q.gelesen && !l[q.id]; })
    .sort(function(a,b){ return (b.beantwortet||0) - (a.beantwortet||0); });
}
function gelesen(api, user, token, ids){
  ids = (ids||[]).filter(Boolean); if(!ids.length) return Promise.resolve();
  var l = lokal(user), now = Date.now(); ids.forEach(function(i){ l[i] = now; });
  try{ var ks = Object.keys(l); if(ks.length > 400) ks.sort(function(a,b){ return l[a]-l[b]; }).slice(0, ks.length-400).forEach(function(k){ delete l[k]; });
    localStorage.setItem(lsKey(user), JSON.stringify(l)); }catch(e){}
  try{ window.dispatchEvent(new CustomEvent("kf-antworten-gelesen", {detail:ids})); }catch(e){}
  if(!api || !token) return Promise.resolve();
  return Promise.resolve().then(function(){ return api({action:"markRead", user:user, token:token, ids:ids}); }).catch(function(){});   /* altes Backend: "unbekannte Aktion" -> nur lokal */
}
function kurz(s, n){ s = String(s||"").replace(/\s+/g," ").trim(); return s.length > n ? s.slice(0, n-1) + "…" : s; }
/* Ziel-Seite: #frage=<ID> -> Element finden (finder(id) liefert Element oder null), hinscrollen, hervorheben. */
function springe(finder, onFound){
  var m = /[#&]frage=([^&]+)/.exec(location.hash||""); if(!m) return;
  var id; try{ id = decodeURIComponent(m[1]); }catch(e){ return; }
  if(!document.getElementById("kfAntwCss")){ var c = document.createElement("style"); c.id = "kfAntwCss";
    c.textContent = ".kf-ziel{outline:3px solid #f08c00!important;outline-offset:4px;border-radius:10px;animation:kfZiel 1.2s ease 3}@keyframes kfZiel{50%{outline-color:#ffd43b}}"; document.head.appendChild(c); }
  var tries = 0;
  (function look(){
    var el = null; try{ el = finder(id); }catch(e){}
    if(el){ el.classList.add("kf-ziel"); try{ el.scrollIntoView({behavior:"smooth", block:"start"}); }catch(e){ el.scrollIntoView(); }
      setTimeout(function(){ try{ el.scrollIntoView({block:"start"}); }catch(e){} }, 900);
      if(onFound) try{ onFound(id, el); }catch(e){}
      return; }
    if(++tries < 40) setTimeout(look, 250);
  })();
}
window.KFAntworten = {ziel:ziel, link:link, aufgabe:aufgabe, neu:neu, gelesen:gelesen, kurz:kurz, springe:springe, lokal:lokal};
})();
