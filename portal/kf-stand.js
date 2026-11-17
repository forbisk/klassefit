/* KlasseFit „Mein Stand“: Wochenziel, Ampel-Selbsteinschätzung, Sterne 1–5 je Bereich, Barometer.
   Liest vorhandene Aufgabenstände (Schlüssel unverändert). Eigener Schlüssel nur kf_stand_v1 (Ziel + Ampel + Sterne-Cache).
   „Fehler melden“ fließt nicht ein. Quelle: unterricht-src/_lib/ (Kopien per sync.py, nicht nach pruefungsfit-mathe). */
(function (root) {
"use strict";
var KEY = "kf_stand_v1";
var AMP = { kann: "kann ich", unsicher: "unsicher", nicht: "kann ich nicht" };
var AREAS = [
  { id: "pyth", name: "Pythagoras", sl: ["sl10a-pyth"], re: /pyth/i },
  { id: "aeh",  name: "Ähnlichkeit", sl: ["sl10a-aehn", "sl10a-v1"], re: /aehn|ähnlich|\baeh\b/i },
  { id: "trig", name: "Trigonometrie", sl: ["sl10a-trig"], re: /trig/i },
  { id: "proz", name: "Prozent", re: /proz/i },
  { id: "fkt",  name: "Funktionen", re: /funk|lin\b|fkt/i },
  { id: "term", name: "Terme und Gleichungen", re: /term|gleich/i },
  { id: "baum", name: "Wahrscheinlichkeit", re: /baum|wahrsch/i },
  { id: "pot",  name: "Potenzen", re: /potenz/i },
  { id: "qfk",  name: "Quadratische Funktionen", re: /qfunk|quadrat/i }
];
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function jget(k) { try { return JSON.parse((root.localStorage && localStorage.getItem(k)) || "null"); } catch (e) { return null; } }
function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ISO-Kalenderwoche (Donnerstagsregel), wie _lib/wochen.js */
function weekKey(ts) {
  var d = ts ? new Date(ts) : new Date();
  var day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dow = (day.getDay() + 6) % 7;
  var mon = new Date(day); mon.setDate(day.getDate() - dow);
  var th = new Date(mon); th.setDate(mon.getDate() + 3);
  var y = th.getFullYear();
  var jan4 = new Date(y, 0, 4);
  var w1 = new Date(jan4); w1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  var w = 1 + Math.round((mon.getTime() - w1.getTime()) / 604800000);
  return y + "-W" + ("0" + w).slice(-2);
}
function inWeek(ts, kw) { return !!ts && weekKey(ts) === (kw || weekKey()); }

/* Qualität wie Meine Lücken / lkSammeln_. a: {ok,n,h,l,f1,ok1,w,c,z} */
function quality(a) {
  if (!a) return 0;
  var ok = !!(a.ok || a.c);
  if (!ok) return 0;
  var h = +a.h || 0, l = !!(a.l);
  var n = a.n != null ? +a.n : ((+a.w || 0) + 1);
  if (l) return 0;
  if ((a.c || a.f1 || a.ok1 || n <= 1) && h === 0 && n <= 1) return 1;
  if (n <= 1 && h === 0) return 1;
  return Math.max(0.25, 1 - 0.25 * Math.max(0, n - 1) - 0.15 * h);
}
function starsOf(a) {
  if (!a || !(a.ok || a.c)) return 0;
  var q = quality(a);
  if (q >= 1) return 5;
  if (q >= 0.75) return 4;
  if (q >= 0.5) return 3;
  if (q >= 0.25) return 2;
  return 1;
}
function starsForArea(list) {
  var sol = (list || []).filter(function (a) { return a && (a.ok || a.c); });
  if (!sol.length) return { s: 0, n: 0, sauber: 0, avg: 0 };
  var sum = 0, sauber = 0;
  sol.forEach(function (a) { var st = starsOf(a); sum += st; if (st === 5) sauber++; });
  var avg = sum / sol.length;
  return { s: Math.max(1, Math.round(avg)), n: sol.length, sauber: sauber, avg: avg };
}

function areaOf(id, hint) {
  var s = String(id || "") + " " + String(hint || "");
  for (var i = 0; i < AREAS.length; i++) if (AREAS[i].re && AREAS[i].re.test(s)) return AREAS[i];
  return null;
}
/* Portal-Themen kommen als fach|slug (z. B. mathe|pythagoras) – auf Bereichs-IDs (pyth) abbilden. */
var SLUG_NAME = {
  pruefungswissen: "Prüfungswissen", werkzeuge: "Werkzeuge", aehnlichkeit: "Ähnlichkeit",
  pythagoras: "Satz des Pythagoras", trigonometrie: "Trigonometrie",
  terme: "Terme & binomische Formeln", quadratisch: "Quadratische Funktionen",
  gleichungen: "Gleichungen lösen", rationale: "Rationale Zahlen", kommutativ: "Kommutativgesetz",
  daten: "Bits, Bytes & Sicherheit", binaer: "Binärcode, Pixel & Speicher",
  ordner: "Ordner und Dateien", medien: "Informationen und Medien", klasse: "Klasse & Lernen",
  studium: "Studium"
};
/* Nur bekannte Bereiche/Themen — keine Speicher-Schlüssel (kf_sync_meta_v1, kf_*, *_meta, …). */
var EXTRA_NAME = { kreis: "Kreise", komm: "Kommutativgesetz", mathe7: "Mathematik 7", inf: "Informatik" };
function topicSlug(id) {
  var s = String(id || "").trim();
  var i = s.indexOf("|");
  return i >= 0 ? s.slice(i + 1) : s;
}
function isKnownArea(id, hint) {
  if (areaOf(id, hint)) return true;
  var raw = String(id || "").trim(), slug = topicSlug(raw);
  if (!slug) return false;
  if (areaOf(slug, hint)) return true;
  if (SLUG_NAME[slug] || EXTRA_NAME[slug]) return true;
  for (var i = 0; i < AREAS.length; i++) if (AREAS[i].id === slug) return true;
  /* Offizielles Portal-Thema fach|slug mit lesbarem Namen, das noch nicht in der Liste steht. */
  var h = String(hint || "").trim();
  if (h && /\|/.test(raw) && /^[a-z][a-z0-9]+$/i.test(raw.split("|")[0]) && /^[a-z][a-z0-9_-]+$/i.test(slug) && h !== raw && h !== slug) return true;
  return false;
}
function areaIdOf(id, hint) {
  if (!isKnownArea(id, hint)) return "";
  var a = areaOf(id, hint);
  if (a) return a.id;
  var slug = topicSlug(id);
  a = areaOf(slug, hint);
  if (a) return a.id;
  return slug.slice(0, 40);
}
function areaName(id, hint) {
  var canon = areaIdOf(id, hint);
  for (var i = 0; i < AREAS.length; i++) if (AREAS[i].id === canon) return AREAS[i].name;
  if (SLUG_NAME[canon]) return SLUG_NAME[canon];
  if (EXTRA_NAME[canon]) return EXTRA_NAME[canon];
  if (hint) return String(hint);
  if (SLUG_NAME[id]) return SLUG_NAME[id];
  return canon || id;
}

/* Aufgabenstände aus bekannten (unveränderten) Schlüsseln sammeln. */
function collect(store) {
  var get, names = [];
  if (!store) {
    get = function (k) { return jget(k); };
    if (root.localStorage) try { for (var i = 0; i < localStorage.length; i++) names.push(localStorage.key(i)); } catch (e) {}
  } else if (typeof store === "function") {
    get = store;
  } else {
    get = function (k) { return store.get ? store.get(k) : store[k]; };
    names = store.keys ? store.keys() : Object.keys(store);
  }
  var by = {}, out = [];
  function add(area, rec, meta) {
    area = isKnownArea(area) ? (areaIdOf(area) || area) : "";
    if (!area) return;
    rec = rec || {};
    var ts = 0, cands = [rec.z, rec.t, rec.s, rec.ok, rec.rk];
    cands.forEach(function (x) { if (!ts && typeof x === "number" && x > 1e11) ts = x; });
    var a = { ok: !!(rec.ok || rec.c), n: rec.n, h: rec.h, l: rec.l, f1: rec.f1, ok1: rec.ok1, w: rec.w, c: rec.c, z: ts, kern: !!(meta && meta.kern), id: meta && meta.id };
    (by[area] = by[area] || []).push(a);
    out.push(a);
  }
  function walkSl(obj, areaHint) {
    if (!obj || typeof obj !== "object") return;
    var t = obj.t;
    if (t && typeof t === "object") {
      Object.keys(t).forEach(function (id) {
        var rec = t[id], ar = areaHint || (areaOf(id) || {}).id;
        if (/^st:/.test(id)) { var m = /^st:([^:]+):/.exec(id); ar = (areaOf(m && m[1], id) || {}).id || ar; }
        add(ar, rec, { id: id });
      });
    }
    if (obj.att && typeof obj.att === "object") {
      Object.keys(obj.att).forEach(function (id) { add((areaOf(id, "aeh") || { id: "aeh" }).id, obj.att[id], { id: id }); });
    }
    ["ev", "log", "out", "e"].forEach(function (k) {
      if (Array.isArray(obj[k])) obj[k].forEach(function (e) { if (e && (e.t || e.c || e.ok)) add((areaOf(e.t) || {}).id || e.t, e, { id: e.a }); });
    });
  }
  /* sl10a-* (Selbstarbeit 10a, PF, Selbstlernen) – Schlüssel unverändert, nur lesen */
  names.forEach(function (k) {
    if (!k || k === KEY) return;
    var val = get(k);
    if (!val || typeof val !== "object") return;
    if (k.indexOf("sl10a-") === 0) {
      var short = k.slice(6);
      var preset = null;
      AREAS.forEach(function (A) { if (A.sl && A.sl.indexOf(k) >= 0) preset = A.id; });
      if (short === "pf" || short === "v1" || short === "wdh" || short === "merk" || short === "away" || short === "start" || short === "tbk" || short === "test") preset = preset;
      if (short === "pyth") preset = "pyth";
      if (short === "trig") preset = "trig";
      if (short === "aehn" || short === "aeh") preset = "aeh";
      walkSl(val, preset);
    } else if (k.indexOf("lk10a-v1|") === 0 || k.indexOf("lk10a-v1") === 0) {
      walkSl(val);
      if (val.e || val.ev) (val.e || val.ev || []).forEach(function (e) { add(e.t, e, { id: e.a }); });
    } else if (k === "m9g-st" || k === "m9g-st-vorschau") {
      walkSl(val);
    } else if (val.t && typeof val.t === "object" && !val.seite) {
      /* app.js-Familien: gl8b-*, kr8-*, kg5-*, sa7-*, bg7-*, gt8-*, Prefix+Benutzer.
         Keine Meta-/Sync-Schlüssel (kf_sync_meta_v1 hat ebenfalls ein Feld t). */
      var looks = false;
      Object.keys(val.t).some(function (id) {
        var sample = val.t[id];
        looks = !!(sample && typeof sample === "object" && (sample.ok || sample.n || sample.h || sample.f1 || sample.ok1 || sample.c));
        return looks;
      });
      if (looks) {
        var hint = k;
        Object.keys(val.t).forEach(function (id) {
          var rec = val.t[id];
          var ar = (areaOf(id, hint) || areaOf(k) || {}).id || guessPageArea(k) || areaIdOf(id, hint);
          add(ar, rec, { id: id, kern: !!(rec && rec.kern) });
        });
      }
    }
  });
  var areas = {};
  Object.keys(by).forEach(function (id) { areas[id] = Object.assign({ id: id, name: areaName(id) }, starsForArea(by[id]), { tasks: by[id] }); });
  return { by: by, areas: areas, all: out };
}
function guessPageArea(k) {
  k = String(k || "");
  if (/gl8|gleich/.test(k)) return "term";
  if (/kr8|kreis/.test(k)) return "kreis";
  if (/kg5|komm/.test(k)) return "komm";
  if (/sa7|bg7/.test(k)) return "mathe7";
  if (/gt8|terme/.test(k)) return "term";
  if (/potenz/.test(k)) return "pot";
  if (/qfunk/.test(k)) return "qfk";
  if (/inf|daten|binaer/.test(k)) return "inf";
  return null;
}

function overall(col, themenPct) {
  if (themenPct != null && isFinite(themenPct)) return { pct: Math.round(themenPct), quelle: "ring" };
  var ids = Object.keys(col.areas || {}), sum = 0, n = 0, st = 0, stn = 0;
  ids.forEach(function (id) {
    var a = col.areas[id];
    if (a.n) { sum += a.avg * 20; n++; st += a.s; stn++; }
  });
  return { pct: n ? Math.round(sum / n) : 0, sterne: stn ? Math.round(st / stn) : 0, n: n, quelle: "sterne" };
}

function defaultGoals(col, opts) {
  opts = opts || {};
  var list = [
    { typ: "sauber", n: 5, label: "5 Aufgaben sauber lösen (ohne Hilfe, 1. Versuch)" },
    { typ: "sauber", n: 10, label: "10 Aufgaben sauber lösen" }
  ];
  Object.keys(col.areas || {}).sort().forEach(function (id) {
    if (!isKnownArea(id)) return;
    var a = col.areas[id];
    list.push({ typ: "thema", thema: id, n: 4, label: (a.name || areaName(id)) + " sicher machen (mindestens 4 von 5 Sternen)" });
  });
  if ((opts.klasse || "").toLowerCase() === "10a" || opts.luecken) {
    list.push({ typ: "luecken", n: 1, label: "1 offene Lücke schließen" });
    list.push({ typ: "luecken", n: 3, label: "3 offene Lücken schließen" });
  }
  var kern = (col.all || []).filter(function (t) { return t.kern; }).length;
  if (kern) list.push({ typ: "kern", n: 5, label: "5 Kernaufgaben lösen" });
  return list;
}
function closedLuecken(col, kw) {
  /* Events mit c und Statuswechsel können wir lokal nur grob zählen: saubere Serien je Thema diese Woche. */
  var byT = {}, n = 0;
  (col.all || []).forEach(function (a) {
    if (!a.c || !inWeek(a.z, kw)) return;
    byT[a.id || "x"] = (byT[a.id || "x"] || 0) + 1;
  });
  /* Fallback: Anzahl sauberer Aufgaben / 5, nach unten gerundet, max. Themen */
  var sauber = (col.all || []).filter(function (a) { return starsOf(a) === 5 && inWeek(a.z, kw); }).length;
  n = Math.floor(sauber / 5);
  return n;
}
function goalProgress(ziel, col, opts) {
  opts = opts || {};
  var kw = (ziel && ziel.kw) || weekKey();
  if (!ziel || !ziel.typ) return { ist: 0, soll: 1, pct: 0, done: false, text: "Noch kein Wochenziel gewählt." };
  var ist = 0, soll = +ziel.n || 1, text;
  if (ziel.typ === "sauber") {
    ist = (col.all || []).filter(function (a) { return starsOf(a) === 5 && inWeek(a.z, kw); }).length;
    text = ist + " von " + soll + " Aufgaben sauber gelöst";
  } else if (ziel.typ === "thema") {
    var a = (col.areas || {})[ziel.thema] || { s: 0, n: 0 };
    soll = 1;
    ist = (a.s >= 4 && a.n >= 5) ? 1 : 0;
    var teil = Math.min(1, (a.n / 5) * (a.s / 4) || 0);
    return { ist: ist, soll: 1, pct: Math.round(100 * (ist ? 1 : teil)), done: !!ist, text: (a.n ? a.s + " von 5 Sternen · " + a.n + " Aufgabe" + (a.n === 1 ? "" : "n") : "noch keine Aufgaben") + (ist ? " – sicher!" : "") };
  } else if (ziel.typ === "luecken") {
    ist = Math.min(soll, (opts.lueckenClosed != null ? opts.lueckenClosed : closedLuecken(col, kw)));
    text = ist + " von " + soll + " Lücke" + (soll === 1 ? "" : "n") + " geschlossen";
  } else if (ziel.typ === "kern") {
    ist = (col.all || []).filter(function (a) { return a.kern && a.ok && inWeek(a.z, kw); }).length;
    text = ist + " von " + soll + " Kernaufgaben";
  } else {
    text = ziel.label || "Wochenziel";
  }
  var pct = soll ? Math.min(100, Math.round(100 * ist / soll)) : 0;
  return { ist: ist, soll: soll, pct: pct, done: ist >= soll, text: text };
}

function blank() { return { v: 1, ziel: null, ampel: {}, sterne: {}, gesamt: null, z: 0 }; }
function cleanState(s) {
  s = s || {};
  var o = { v: 1, z: +s.z || Date.now(), ampel: {}, sterne: {} };
  if (s.ziel && typeof s.ziel === "object") {
    var thema = areaIdOf(s.ziel.thema || "", s.ziel.label);
    o.ziel = { kw: String(s.ziel.kw || "").slice(0, 16), typ: String(s.ziel.typ || "").slice(0, 20), n: +s.ziel.n || 0, thema: thema, label: String(s.ziel.label || "").slice(0, 160), z: +s.ziel.z || 0 };
    if (o.ziel.typ === "thema" && !thema) o.ziel = null;
  } else o.ziel = null;
  if (s.ampel && typeof s.ampel === "object") {
    Object.keys(s.ampel).slice(0, 80).forEach(function (k) {
      var a = s.ampel[k]; if (!a || typeof a !== "object") return;
      var w = String(a.w || ""); if (w !== "kann" && w !== "unsicher" && w !== "nicht") return;
      var id = areaIdOf(k);
      if (!id) return;
      var rec = { w: w, z: +a.z || 0 };
      if (!o.ampel[id] || rec.z >= (+o.ampel[id].z || 0)) o.ampel[id] = rec;
    });
  }
  if (s.sterne && typeof s.sterne === "object") {
    Object.keys(s.sterne).slice(0, 80).forEach(function (k) {
      var a = s.sterne[k]; if (!a || typeof a !== "object") return;
      var id = areaIdOf(k);
      if (!id) return;
      var rec = { s: Math.max(0, Math.min(5, +a.s || 0)), n: +a.n || 0, sauber: +a.sauber || 0, z: +a.z || 0 };
      if (!o.sterne[id] || rec.z >= (+o.sterne[id].z || 0)) o.sterne[id] = rec;
    });
  }
  if (s.gesamt && typeof s.gesamt === "object") o.gesamt = { pct: s.gesamt.pct == null ? null : +s.gesamt.pct, sterne: +s.gesamt.sterne || 0, n: +s.gesamt.n || 0 };
  return o;
}
function loadLocal(user) {
  var raw = jget(KEY);
  if (!raw || typeof raw !== "object") return blank();
  if (raw.u && user && String(raw.u) !== String(user)) return blank();
  return cleanState(raw.s || raw.state || raw);
}
function saveLocal(user, state) { jset(KEY, { u: user || "", s: cleanState(state), z: Date.now() }); }

function mergeState(local, remote, remoteZ) {
  local = cleanState(local); remote = remote ? cleanState(remote) : null;
  if (!remote) return local;
  var lz = +local.z || 0, rz = +remoteZ || +remote.z || 0;
  var out = lz >= rz ? local : remote;
  /* Ampel je Thema: neuerer Zeitstempel gewinnt */
  var ampel = {};
  function take(src) {
    Object.keys(src.ampel || {}).forEach(function (k) {
      var a = src.ampel[k]; if (!ampel[k] || (+a.z || 0) >= (+ampel[k].z || 0)) ampel[k] = a;
    });
  }
  take(remote); take(local);
  out.ampel = ampel;
  if (local.ziel && remote.ziel && local.ziel.kw === remote.ziel.kw) {
    out.ziel = (lz >= rz ? local.ziel : remote.ziel);
  } else if (local.ziel && local.ziel.kw === weekKey()) out.ziel = local.ziel;
  else if (remote.ziel && remote.ziel.kw === weekKey()) out.ziel = remote.ziel;
  else out.ziel = lz >= rz ? local.ziel : remote.ziel;
  return cleanState(out);
}

function deviation(ampelW, stars, pct) {
  var p = pct != null ? pct : (stars ? stars * 20 : null);
  if (!ampelW || p == null) return null;
  if (ampelW === "kann" && p < 40) return "sicherer";
  if (ampelW === "nicht" && p >= 70) return "bescheiden";
  if (ampelW === "unsicher" && p >= 85) return "bescheiden";
  if (ampelW === "unsicher" && p < 25) return "sicherer";
  return null;
}

/* ---------- Darstellung ---------- */
function starsHtml(n, opts) {
  opts = opts || {};
  n = +n || 0;
  var h = "";
  for (var i = 1; i <= 5; i++) h += '<span class="' + (i <= n ? "on" : "off") + '">★</span>';
  return '<span class="kf-st-stars" title="' + (opts.title || (n ? n + " von 5 Sternen" : "noch keine Daten")) + '" aria-label="' + (n ? n + " von 5 Sternen" : "keine Sterne") + '">' + h + "</span>";
}
function gaugeSvg(pct, size) {
  pct = Math.max(0, Math.min(100, +pct || 0));
  size = size || 140;
  var col = pct >= 70 ? "#2f9e44" : pct >= 40 ? "#c99200" : "#e03131";
  var r = 48, c = Math.PI * r, d = c * pct / 100;
  return '<svg class="kf-st-gauge" width="' + size + '" height="' + Math.round(size * 0.72) + '" viewBox="0 0 120 88" role="img" aria-label="Stand ' + pct + ' Prozent">'
    + '<path d="M12 70 A 48 48 0 0 1 108 70" fill="none" stroke="#e9ecef" stroke-width="10" stroke-linecap="round"/>'
    + '<path d="M12 70 A 48 48 0 0 1 108 70" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + d.toFixed(1) + ' ' + (c + 2).toFixed(1) + '"/>'
    + '<text x="60" y="62" text-anchor="middle" font-size="22" font-weight="800" fill="#212529">' + pct + '%</text>'
    + '<text x="60" y="78" text-anchor="middle" font-size="8" fill="#6c757d">Mein Stand</text></svg>';
}
function bar(pct) {
  pct = Math.max(0, Math.min(100, +pct || 0));
  return '<div class="kf-st-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>';
}
function ampelBtns(cur, areaId) {
  return '<div class="kf-st-ampel" data-area="' + esc(areaId) + '" role="group" aria-label="Selbsteinschätzung">'
    + [["kann", "kann ich"], ["unsicher", "unsicher"], ["nicht", "kann ich nicht"]].map(function (x) {
      return '<button type="button" class="kf-st-am ' + x[0] + (cur === x[0] ? " on" : "") + '" data-w="' + x[0] + '">' + x[1] + "</button>";
    }).join("") + "</div>";
}

function ensureCss() {
  if (document.getElementById("kfStandCss")) return;
  var href = "kf-stand.css";
  var cur = document.currentScript || document.querySelector("script[src*='kf-stand.js']");
  if (cur && cur.src) href = cur.src.replace(/kf-stand\.js.*$/, "kf-stand.css");
  else if (/\/portal(\/|$)/.test(location.pathname)) href = "kf-stand.css";
  var l = document.createElement("link"); l.id = "kfStandCss"; l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}

var apiFn = null, tokenFn = null, userFn = null, onChange = null, lastCol = null, lastState = null;

function ctxUser() { try { return userFn && userFn(); } catch (e) { return ""; } }
function refreshCol() {
  lastCol = collect();
  var thPct = null;
  try { if (root.THEMEN && THEMEN.fromStorage) { var r = THEMEN.fromStorage(); if (r && r.gesamt && r.gesamt.p != null) thPct = r.gesamt.p; } } catch (e) {}
  lastCol.gesamt = overall(lastCol, thPct);
  return lastCol;
}
function stampSterne(state, col) {
  state = cleanState(state);
  state.sterne = {};
  Object.keys(col.areas).forEach(function (id) {
    if (!isKnownArea(id)) return;
    var a = col.areas[id];
    state.sterne[id] = { s: a.s, n: a.n, sauber: a.sauber, z: Date.now() };
  });
  state.gesamt = { pct: col.gesamt.pct, sterne: col.gesamt.sterne || 0, n: col.gesamt.n || 0 };
  state.z = Date.now();
  return state;
}
var loadState = "idle"; /* idle | loading | ready */
var queuedSave = false;

function configure(opts) {
  opts = opts || {};
  if (opts.api) apiFn = opts.api;
  if (opts.token) tokenFn = opts.token;
  if (opts.user) userFn = opts.user;
}
function resetSync() {
  loadState = "idle";
  queuedSave = false;
  lastState = null;
  lastCol = null;
  apiFn = tokenFn = userFn = null;
}
function beginStandLoad() { loadState = "loading"; queuedSave = false; }
function localIsNewer(local, remote, remoteZ) {
  local = cleanState(local || blank());
  var has = !!(local.ziel || Object.keys(local.ampel || {}).length);
  if (!remote) return has;
  remote = cleanState(remote);
  if (local.ziel && (!remote.ziel || (+local.ziel.z || 0) > (+remote.ziel.z || 0))) return true;
  var keys = Object.keys(local.ampel || {}), i, k;
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    if (!remote.ampel[k] || (+local.ampel[k].z || 0) > (+remote.ampel[k].z || 0)) return true;
  }
  return false;
}
function pushStand(state) {
  if (!apiFn || !tokenFn) return;
  var tok = tokenFn(); if (!tok) return;
  apiFn({ action: "stand_save", token: tok, state: cleanState(state) }).then(function () {}, function () {});
}
function standLoadFinished(remote, updated) {
  var local = lastState || loadLocal(ctxUser());
  var merged = mergeState(local, remote, updated);
  lastState = merged;
  saveLocal(ctxUser(), merged);
  var shouldPush = queuedSave || localIsNewer(local, remote, updated);
  queuedSave = false;
  loadState = "ready";
  if (shouldPush) pushStand(merged);
  return merged;
}
function persist(state, push) {
  lastState = cleanState(state);
  saveLocal(ctxUser(), lastState);
  if (push === false) return;
  if (loadState === "loading") { queuedSave = true; return; }
  pushStand(lastState);
}

function sheetHtml(state, col, opts) {
  opts = opts || {};
  var kw = weekKey();
  var ziel = state.ziel && state.ziel.kw === kw ? state.ziel : null;
  var gp = goalProgress(ziel, col, opts);
  var ov = col.gesamt || { pct: 0 };
  var h = '<div class="kf-st-sheet" role="dialog" aria-label="Mein Stand">';
  h += '<div class="kf-st-head"><h2>Mein Stand</h2><button type="button" class="kf-st-x" aria-label="schließen">✕</button></div>';
  h += '<div class="kf-st-hero">' + gaugeSvg(ov.pct, 180) + '<div><p class="kf-st-lead">Das Barometer zeigt deinen Stand über die Themen, an denen du schon gearbeitet hast. Die Sterne sagen, wie selbstständig du die Aufgaben gelöst hast (weniger Hilfe = mehr Sterne). Das ist eine Orientierung, keine Note.</p>';
  h += '<p class="kf-st-meta">' + (ov.n ? ov.n + " Bereich" + (ov.n === 1 ? "" : "e") + " mit Aufgaben" : "Noch keine gelösten Aufgaben auf diesem Gerät.") + '</p></div></div>';
  h += '<section class="kf-st-block"><h3>Wochenziel <span class="kf-st-kw">KW ' + kw.slice(6) + "</span></h3>";
  if (ziel) {
    h += '<p>' + esc(ziel.label || "Wochenziel") + "</p>" + bar(gp.pct) + '<p class="kf-st-meta">' + esc(gp.text) + (gp.done ? " ✔" : "") + '</p><p><button type="button" class="kf-st-chg" data-act="ziel-aendern">Anderes Ziel wählen</button></p>';
  } else {
    h += '<p>Wähle ein Ziel für diese Woche – du siehst am Balken, wie weit du bist.</p><div class="kf-st-goals">';
    defaultGoals(col, opts).forEach(function (g, i) {
      h += '<button type="button" class="kf-st-goal" data-act="ziel" data-i="' + i + '">' + esc(g.label) + "</button>";
    });
    h += "</div>";
  }
  h += "</section>";
  h += '<section class="kf-st-block"><h3>Bereiche</h3><p class="kf-st-meta">Sterne: wie viel Hilfe du gebraucht hast. Ampel: wie sicher du dich fühlst. Wenn beides nicht zusammenpasst, lohnt sich ein Blick in die Aufgaben.</p>';
  var ids = Object.keys(col.areas).filter(isKnownArea).sort(function (a, b) { return (col.areas[b].n || 0) - (col.areas[a].n || 0); });
  if (!ids.length) {
    /* Ampel trotzdem anbieten, falls Themenliste bekannt */
    var extra = (opts.themen || []).map(function (t) { return areaIdOf(t.id, t.name || t.titel); }).filter(Boolean);
    ids = extra.length ? extra : [];
  }
  /* Union: areas with data + ampel + themen opts */
  var seen = {};
  function row(id, a) {
    id = areaIdOf(id, a && a.name);
    if (!id || seen[id]) return "";
    seen[id] = 1;
    a = a || { s: 0, n: 0, sauber: 0, name: areaName(id) };
    var w = (state.ampel[id] || {}).w || "";
    var dev = deviation(w, a.s, a.n ? a.s * 20 : null);
    return '<div class="kf-st-row" data-area="' + esc(id) + '"><div class="kf-st-rn"><b>' + esc(a.name || areaName(id)) + "</b>"
      + starsHtml(a.s, { title: a.n ? a.s + " von 5 · " + a.n + " gelöst" + (a.n < 3 ? " (noch wenig Daten)" : "") + " · " + a.sauber + " sauber" : "noch keine Daten" })
      + (a.n && a.n < 3 ? '<small class="kf-st-wenig">noch wenig Daten</small>' : (a.n ? '<small>' + a.n + " gelöst</small>" : '<small>noch keine Aufgaben</small>'))
      + (dev ? '<small class="kf-st-dev">' + (dev === "sicherer" ? "Dein Gefühl ist sicherer als die Ergebnisse." : "Die Ergebnisse sind stärker als dein Gefühl.") + "</small>" : "")
      + "</div>" + ampelBtns(w, id) + "</div>";
  }
  var rows = "";
  ids.forEach(function (id) { rows += row(id, col.areas[id]); });
  Object.keys(state.ampel || {}).forEach(function (id) { rows += row(id, col.areas[id]); });
  (opts.themen || []).forEach(function (t) {
    var id = areaIdOf(t.id, t.name || t.titel);
    rows += row(id, col.areas[id] || { s: 0, n: 0, name: areaName(id, t.name || t.titel) });
  });
  h += (rows || '<p class="kf-st-meta">Sobald du Aufgaben löst, erscheinen hier Sterne je Thema.</p>') + "</section></div>";
  return h;
}
function cardHtml(state, col, opts) {
  var kw = weekKey();
  var ziel = state.ziel && state.ziel.kw === kw ? state.ziel : null;
  var gp = goalProgress(ziel, col, opts);
  var ov = col.gesamt || { pct: 0 };
  var mean = 0, nst = 0;
  Object.keys(col.areas).forEach(function (id) { if (col.areas[id].n) { mean += col.areas[id].s; nst++; } });
  mean = nst ? Math.round(mean / nst) : 0;
  return '<section class="kf-st-card" aria-label="Mein Stand">'
    + '<div class="kf-st-cardin">' + gaugeSvg(ov.pct, 120)
    + '<div class="kf-st-cardtxt"><h2>Mein Stand</h2><p>' + ov.pct + " % · " + (nst ? starsHtml(mean) : "noch keine Sterne") + "</p>"
    + (ziel ? '<p class="kf-st-zline">Diese Woche: ' + esc(ziel.label) + "</p>" + bar(gp.pct) + '<p class="kf-st-meta">' + esc(gp.text) + (gp.done ? " ✔" : "") + "</p>"
      : '<p class="kf-st-zline">Wochenziel festlegen – damit du siehst, woran du diese Woche arbeitest.</p>')
    + '<p><button type="button" class="kf-st-open">Mein Stand öffnen</button></p></div></div></section>';
}

function bindSheet(box, opts) {
  box.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act], .kf-st-x, .kf-st-am, .kf-st-open");
    if (!t || !box.contains(t)) return;
    if (t.classList.contains("kf-st-x") || ev.target === box) { box.classList.remove("on"); box.innerHTML = ""; return; }
    if (t.classList.contains("kf-st-am")) {
      var id = t.parentNode.getAttribute("data-area"), w = t.getAttribute("data-w");
      lastState = lastState || blank();
      lastState.ampel[id] = { w: w, z: Date.now() };
      lastState.z = Date.now();
      persist(lastState);
      openSheet(opts);
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "ziel-aendern") {
      lastState.ziel = null; lastState.z = Date.now(); persist(lastState); openSheet(opts); return;
    }
    if (act === "ziel") {
      var list = defaultGoals(lastCol, opts), g = list[+t.getAttribute("data-i")];
      if (!g) return;
      lastState.ziel = { kw: weekKey(), typ: g.typ, n: g.n, thema: g.thema || "", label: g.label, z: Date.now() };
      lastState.z = Date.now();
      persist(lastState);
      openSheet(opts);
    }
  });
}

var sheetEl = null;
function openSheet(opts) {
  opts = opts || {};
  ensureCss();
  refreshCol();
  lastState = stampSterne(lastState || loadLocal(ctxUser()), lastCol);
  if (!sheetEl) {
    sheetEl = document.createElement("div");
    sheetEl.id = "kfStandOverlay";
    sheetEl.className = "kf-st-ov";
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener("click", function (ev) { if (ev.target === sheetEl) { sheetEl.classList.remove("on"); sheetEl.innerHTML = ""; } });
    bindSheet(sheetEl, opts);
  }
  sheetEl.innerHTML = sheetHtml(lastState, lastCol, opts);
  sheetEl.classList.add("on");
  var x = sheetEl.querySelector(".kf-st-x"); if (x) x.focus();
}

function mountPortal(el, opts) {
  opts = opts || {};
  ensureCss();
  apiFn = opts.api || apiFn;
  tokenFn = opts.token || tokenFn;
  userFn = opts.user || function () { return opts.sess && opts.sess.benutzer; };
  var klasse = opts.sess && opts.sess.klasse;
  function paint() {
    refreshCol();
    lastState = stampSterne(mergeState(loadLocal(ctxUser()), lastState, lastState && lastState.z), lastCol);
    if (lastState.ziel && lastState.ziel.kw !== weekKey()) lastState.ziel = null;
    el.innerHTML = cardHtml(lastState, lastCol, { klasse: klasse });
    var b = el.querySelector(".kf-st-open");
    if (b) b.onclick = function () { openSheet({ klasse: klasse, themen: opts.themen }); };
  }
  var tok = tokenFn && tokenFn();
  if (apiFn && tok) beginStandLoad();
  paint();
  if (apiFn && tok) {
    apiFn({ action: "stand_load", token: tok }).then(function (r) {
      if (r && r.ok) standLoadFinished(r.state, r.updated);
      else standLoadFinished(null, 0);
      paint();
    }, function () { standLoadFinished(null, 0); paint(); });
  } else loadState = "ready";
  return { refresh: paint, open: function () { openSheet({ klasse: klasse, themen: opts.themen }); } };
}

function teacherHtml(entry, ctx) {
  ctx = ctx || {};
  var st = cleanState((entry && entry.state) || entry || {});
  var sterne = st.sterne || {}, ampel = st.ampel || {};
  var ids = {};
  Object.keys(sterne).forEach(function (k) { var id = areaIdOf(k); if (id) ids[id] = 1; });
  Object.keys(ampel).forEach(function (k) { var id = areaIdOf(k); if (id) ids[id] = 1; });
  var rows = Object.keys(ids).map(function (id) {
    var s = sterne[id] || { s: 0, n: 0 };
    var w = (ampel[id] || {}).w || "";
    var pct = null;
    if (ctx.zellen && ctx.themen) {
      ctx.themen.forEach(function (t) { if (areaIdOf(t.thema, t.label) === id || t.thema === id) {
        var c = ctx.zellen[t.seite + "|" + t.thema]; if (c && c.pct != null) pct = c.pct;
      } });
    }
    var dev = deviation(w, s.s, pct != null ? pct : (s.n ? s.s * 20 : null));
    return '<div class="kf-st-trow' + (dev ? " dev" : "") + '"><b>' + esc(areaName(id)) + "</b> " + starsHtml(s.s)
      + (w ? ' <span class="kf-st-am ' + w + ' on">' + AMP[w] + "</span>" : " <span class=\"kf-st-meta\">keine Ampel</span>")
      + (pct != null ? " · " + Math.round(pct) + " %" : "")
      + (dev ? ' <em class="kf-st-dev">' + (dev === "sicherer" ? "zu sicher (Gefühl stärker als Ergebnis)" : "zu bescheiden (Ergebnis stärker als Gefühl)") + "</em>" : "")
      + "</div>";
  }).join("");
  var ziel = st.ziel && st.ziel.kw === weekKey() ? st.ziel : null;
  var devN = 0;
  Object.keys(ids).forEach(function (id) { if (deviation((ampel[id] || {}).w, (sterne[id] || {}).s, (sterne[id] && sterne[id].n) ? sterne[id].s * 20 : null)) devN++; });
  return '<div class="kf-st-teacher"><div class="dh"><b>Mein Stand</b>'
    + (devN ? ' <span class="tag hot">' + devN + " Abweichung" + (devN === 1 ? "" : "en") + "</span>" : "") + "</div>"
    + (ziel ? "<p>Wochenziel: " + esc(ziel.label) + "</p>" : "<p class=\"muted\">Kein Wochenziel in dieser Woche.</p>")
    + (rows || "<p class=\"muted\">Noch keine Sterne oder Ampel gespeichert.</p>")
    + '<p class="note">Ampel = Selbsteinschätzung. Sterne = Hilfeverbrauch (5 = sauber ohne Tipp/Lösung). Fehler melden zählt nicht.</p></div>';
}
function mountTeacher(el, entry, ctx) {
  ensureCss();
  el.innerHTML = teacherHtml(entry, ctx);
}

/* Vorbereitung (themen.js-Modal) anreichern, ohne die untere Navigation zu ändern */
function enhanceVorbereitung(rootEl) {
  if (!rootEl || rootEl.querySelector(".kf-st-prep")) return;
  ensureCss();
  refreshCol();
  lastState = stampSterne(mergeState(loadLocal(ctxUser()), lastState, lastState && lastState.z), lastCol);
  var kw = weekKey();
  var ziel = lastState.ziel && lastState.ziel.kw === kw ? lastState.ziel : null;
  var gp = goalProgress(ziel, lastCol, {});
  var ov = lastCol.gesamt || { pct: 0 };
  var box = document.createElement("div");
  box.className = "kf-st-prep";
  box.innerHTML = '<h3>Mein Stand</h3><div class="kf-st-prepgrid">' + gaugeSvg(ov.pct, 130)
    + '<div>' + (ziel ? "<p>" + esc(ziel.label) + "</p>" + bar(gp.pct) + '<p class="kf-st-meta">' + esc(gp.text) + "</p>" : "<p>Wochenziel festlegen</p>")
    + '<p><button type="button" class="kf-st-open">Mein Stand öffnen</button></p></div></div>';
  var host = rootEl.querySelector(".thbox") || rootEl;
  var h2 = host.querySelector("h2");
  if (h2 && h2.nextSibling) host.insertBefore(box, h2.nextSibling); else host.insertBefore(box, host.firstChild);
  box.querySelector(".kf-st-open").onclick = function () { openSheet({}); };
  /* Sterne + Ampel an vorhandene Themenbalken setzen */
  host.querySelectorAll(".thl > li, li.thitem, .thl li").forEach(function (li) {
    if (li.querySelector(".kf-st-mini")) return;
    var label = (li.textContent || "").slice(0, 80);
    var ar = areaOf(label, label);
    if (!ar) return;
    var a = lastCol.areas[ar.id];
    var w = (lastState.ampel[ar.id] || {}).w || "";
    var mini = document.createElement("div");
    mini.className = "kf-st-mini";
    mini.innerHTML = (a && a.n ? starsHtml(a.s) : "") + (w ? '<span class="kf-st-am ' + w + ' on">' + AMP[w] + "</span>" : "");
    li.appendChild(mini);
  });
}

function boot() {
  ensureCss();
  lastState = loadLocal(ctxUser());
  /* Modal „Meine Vorbereitung“ beobachten */
  var obs = new MutationObserver(function () {
    document.querySelectorAll(".thbox, #thModal, .thway").forEach(function (n) {
      var box = n.classList && n.classList.contains("thbox") ? n.parentNode || n : n.closest && n.closest(".thbox") || n;
      if (box && (box.querySelector("h2") || box.querySelector(".thway")) && !box.querySelector(".kf-st-prep")) enhanceVorbereitung(box);
    });
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}

var KFStand = {
  KEY: KEY, weekKey: weekKey, quality: quality, starsOf: starsOf, starsForArea: starsForArea,
  collect: collect, overall: overall, defaultGoals: defaultGoals, goalProgress: goalProgress,
  cleanState: cleanState, mergeState: mergeState, deviation: deviation, loadLocal: loadLocal, saveLocal: saveLocal,
  areaOf: areaOf, areaIdOf: areaIdOf, areaName: areaName, isKnownArea: isKnownArea,
  persist: persist, beginStandLoad: beginStandLoad, standLoadFinished: standLoadFinished,
  localIsNewer: localIsNewer, resetSync: resetSync, configure: configure,
  gaugeSvg: gaugeSvg, starsHtml: starsHtml, cardHtml: cardHtml, sheetHtml: sheetHtml, teacherHtml: teacherHtml,
  mountPortal: mountPortal, mountTeacher: mountTeacher, openSheet: openSheet, enhanceVorbereitung: enhanceVorbereitung,
  boot: boot, AMP: AMP, AREAS: AREAS
};
if (typeof module !== "undefined" && module.exports) module.exports = KFStand;
else {
  root.KFStand = KFStand;
  if (root.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
}
})(typeof window !== "undefined" ? window : global);
