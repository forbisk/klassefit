/* Lehrerportal-Glocke (10.11.2026, v2 12.11.2026): Hinweis auf neue Schülerfragen (Selbstlern-Backend, listQuestions/answer per Portal-Token)
   und neue ⚑-Meldungen (Selbstlern-Backend listReports; Portal-Seiten über admin_hinweise ab portal-7n).
   v2: Gelesen-Status JE EINTRAG (localStorage kf_lehrer_glocke_v2 {g:{id:zeit}, basis}); gelesen = im geöffneten Panel angezeigt oder Link/Knopf geklickt,
   sofort gespeichert. Badge/Toast nur Ungelesenes. Gelesene, noch unbeantwortete Fragen bleiben eingeklappt erreichbar. Der alte Schlüssel
   kf_lehrer_glocke_v1 (seen) wird gelesen (Startwert) und weiter gepflegt. Erstes Öffnen auf einem Gerät: älter als 3 Tage = gelesen.
   ⚑ von Portal-Seiten: Aufgabentext aus den Aufgaben-Daten der Seite (lazy: Seite holen, mit dem gespeicherten Seiten-Schlüssel tfgs_sc_<ordner>
   im Browser entschlüsseln, Daten-Literal ohne eval parsen, HTML → Text), „Zur Aufgabe ›“ öffnet die Lehrer-Vorschau direkt an der Aufgabe.
   Alles als Text (textContent), keine Daten in Logs. */
(function () {
  "use strict";
  var SL = window.PORTAL_SL_API || "", LS = "kf_lehrer_glocke_v1", LS2 = "kf_lehrer_glocke_v2", EVERY = 120000, D3 = 3 * 86400e3;
  var G = { ctx: null, q: null, r: null, p: null, err: "", busy: false, last: 0, toast: false, timer: null, panel: null, tok: "", shown: {}, known: null, openOld: false };
  function jget(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /* ---- Gelesen-Status ---- */
  function st() {
    if (G.st) return G.st;
    var o = jget(LS2);
    if (!o || typeof o !== "object" || !o.g) { var v1 = +jget(LS).seen || 0; o = { g: {}, basis: v1 || (Date.now() - D3) }; jset(LS2, o); if (!v1) { var a = jget(LS); a.seen = o.basis; jset(LS, a); } }
    G.st = o; return o;
  }
  function stSave() {
    var o = st(), ks = Object.keys(o.g), cut = Date.now() - 30 * 86400e3;
    ks.forEach(function (k) { if (o.g[k] < cut) delete o.g[k]; });
    ks = Object.keys(o.g); if (ks.length > 1500) ks.sort(function (a, b) { return o.g[a] - o.g[b]; }).slice(0, ks.length - 1500).forEach(function (k) { delete o.g[k]; });
    jset(LS2, o); var a = jget(LS); a.seen = Math.max(+a.seen || 0, o.basis); jset(LS, a);
  }
  function istGelesen(x) { var o = st(); return !!o.g[x.id] || (x.z && x.z <= o.basis); }
  function markiere(ids) { var o = st(), n = 0, t = Date.now(); ids.forEach(function (id) { if (id && !o.g[id]) { o.g[id] = t; n++; } }); if (n) { stSave(); paintBadge(); } }
  /* Fremde Tabs (zweites Portal-Fenster) übernehmen */
  window.addEventListener("storage", function (e) { if (e.key === LS2) { G.st = null; paintBadge(); } });
  function post(url, body) {
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 30000);
    return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); }).then(function (j) { if (t) clearTimeout(t); return j; }, function () { if (t) clearTimeout(t); return { ok: false, error: "Keine Verbindung" }; });
  }
  function lehrer() { var s = G.ctx && G.ctx.sess(); return !!(s && s.rolle === "lehrer" && G.ctx.token()); }
  function ms(v) { return typeof v === "number" ? v : (Date.parse(v) || 0); }
  /* ---- Einträge ---- */
  function alle() {
    var out = [];
    (G.q || []).forEach(function (q) { out.push({ art: "frage", id: "frage:" + q.id, z: ms(q.zeit), offen: !q.antwort, q: q }); });
    (G.r || []).forEach(function (r) { out.push({ art: "meldung", id: "meldung:" + r.report_id, z: ms(r.created_at), offen: r.status === "new", r: r }); });
    (G.p || []).forEach(function (m) { out.push({ art: "pmeldung", id: "pmeldung:" + (m.rid || (m.seite + "|" + m.item + "|" + m.z)), z: ms(m.z), offen: false, m: m }); });
    out.forEach(function (x) { x.gel = istGelesen(x); });
    return out;
  }
  function sortiert(l) { return l.sort(function (a, b) { return (b.offen && b.art === "frage") - (a.offen && a.art === "frage") || (b.z - a.z); }); }
  function listen() {
    var l = alle(), neu = [], alt = [];
    l.forEach(function (x) { if (!x.gel || G.shown[x.id]) neu.push(x); else if (x.art === "frage" && x.offen) alt.push(x); });
    return { neu: sortiert(neu), alt: sortiert(alt) };
  }
  function counts() { var c = { n: 0, fragen: 0, meld: 0 }; alle().forEach(function (x) { if (x.gel) return; c.n++; if (x.art === "frage") c.fragen++; else c.meld++; }); return c; }
  function paintBadge() {
    var c = counts(), btns = document.querySelectorAll(".kfg-btn");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], badge = b.querySelector(".kfg-n");
      b.classList.toggle("on", c.n > 0);
      badge.textContent = c.n > 99 ? "99+" : String(c.n); badge.hidden = !c.n;
      var t = c.n ? (c.fragen ? c.fragen + (c.fragen === 1 ? " neue Frage" : " neue Fragen") : "") + (c.fragen && c.meld ? " und " : "") + (c.meld ? c.meld + (c.meld === 1 ? " neue Meldung" : " neue Meldungen") : "") + " – ansehen" : (G.err ? "Hinweise: " + G.err : "Keine neuen Fragen oder Meldungen");
      b.title = t; b.setAttribute("aria-label", "🔔 " + t);
    }
  }
  function paint() { paintBadge(); if (G.panel) fillPanel(); }
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
      /* Toast nur für NEUE ungelesene (nicht bei jedem Abruf dieselben) */
      var un = alle().filter(function (x) { return !x.gel; }), frisch = un.filter(function (x) { return !G.known || !G.known[x.id]; });
      G.known = G.known || {}; un.forEach(function (x) { G.known[x.id] = 1; });
      if (frisch.length && !G.panel) toast("🔔 " + frisch.length + (frisch.length === 1 ? " neue Frage/Meldung" : " neue Fragen/Meldungen") + " – tippen zum Ansehen");
      paint();
    });
  }
  function startPoll() {
    if (G.timer) return;
    G.timer = setInterval(function () { if (document.visibilityState === "visible") load(false); }, EVERY);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && Date.now() - G.last > EVERY) load(false); });
  }
  /* ---- Aufgabentext der Portal-Seiten (⚑ über admin_hinweise) ---- */
  var CACHE = {};
  function kurz(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function htmlText(s) { try { var d = new DOMParser().parseFromString("<body>" + String(s || "") + "</body>", "text/html"); return (d.body.textContent || "").replace(/\s+/g, " ").trim(); } catch (e) { return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); } }
  /* Daten-Literal (JSON oder JS-Objekt-Literal mit Schlüsseln ohne Anführungszeichen) lesen – ohne eval */
  function literal(src, i) {
    var n = src.length;
    function ws() { for (;;) { var c = src[i];
      if (c === " " || c === "\n" || c === "\r" || c === "\t") i++;
      else if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; }
      else if (c === "/" && src[i + 1] === "*") { var e = src.indexOf("*/", i + 2); if (e < 0) throw 0; i = e + 2; }
      else return; } }
    function str() { var q = src[i++], out = "";
      while (i < n) { var c = src[i++]; if (c === q) return out;
        if (c === "\\") { var d = src[i++];
          if (d === "n") out += "\n"; else if (d === "t") out += "\t"; else if (d === "r") out += "\r";
          else if (d === "u") { out += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; }
          else if (d === "x") { out += String.fromCharCode(parseInt(src.substr(i, 2), 16)); i += 2; }
          else if (d === "\n") {} else out += d; }
        else out += c; }
      throw 0; }
    function val() { ws(); var c = src[i], m;
      if (c === "{") { i++; var o = {}; for (;;) { ws(); if (src[i] === "}") { i++; return o; } var k;
          if (src[i] === '"' || src[i] === "'") k = str(); else { m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 80)); if (!m) throw 0; k = m[0]; i += k.length; }
          ws(); if (src[i++] !== ":") throw 0; o[k] = val(); ws(); if (src[i] === ",") i++; else if (src[i] !== "}") throw 0; } }
      if (c === "[") { i++; var a = []; for (;;) { ws(); if (src[i] === "]") { i++; return a; } a.push(val()); ws(); if (src[i] === ",") i++; else if (src[i] !== "]") throw 0; } }
      if (c === '"' || c === "'") return str();
      m = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i, i + 40)); if (!m) throw 0; i += m[0].length;
      return m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : +m[0]; }
    return val();
  }
  function hex(s) { var a = new Uint8Array(s.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16); return a; }
  function entschluesseln(msg, key) {   /* StatiCrypt v3: HMAC(64 hex) + IV(32 hex) + AES-CBC-Chiffretext; Schlüssel = gespeichertes „gehashtes Passwort“ */
    var c = window.crypto && window.crypto.subtle; if (!c || !/^[0-9a-f]{64}$/i.test(key || "")) return Promise.reject(0);
    var body = msg.slice(64), iv = hex(body.slice(0, 32)), ct = hex(body.slice(32));
    return c.importKey("raw", hex(key), "AES-CBC", false, ["decrypt"]).then(function (k) { return c.decrypt({ name: "AES-CBC", iv: iv }, k, ct); })
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function skripte(html, base) {   /* Inline-Skripte; im Quellbaum (unverschlüsselt, lokal) zusätzlich eigene js/*.js nachladen */
    var d = new DOMParser().parseFromString(html, "text/html"), inl = [], src = [];
    Array.prototype.forEach.call(d.querySelectorAll("script"), function (s) { var u = s.getAttribute("src"); if (u) { if (/^js\/[\w.\-]+\.js(\?|$)/.test(u)) src.push(u); } else inl.push(s.textContent || ""); });
    return Promise.all(src.map(function (u) { return fetch(base + u, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }); }))
      .then(function (l) { return inl.concat(l); });
  }
  function datenAus(texte) {
    var out = { themen: null, sets: null, mission: false };
    texte.forEach(function (t) {
      if (/MISSION_CFG\s*=/.test(t)) out.mission = true;
      var re = /window\.([A-Za-z_$][\w$]*)\s*=\s*(?=[{\[])/g, m;
      while ((m = re.exec(t))) {
        if (m[1] === "MISSION_CFG" || /APP$/.test(m[1])) continue;
        var v; try { v = literal(t, re.lastIndex); } catch (e) { continue; }
        if (v && Array.isArray(v.themen) && !out.themen) out.themen = v.themen;
        else if (v && !Array.isArray(v) && !out.sets && /_SETS$/.test(m[1])) out.sets = v;
      }
    });
    return out;
  }
  function seitenDaten(seite) {
    if (CACHE[seite]) return CACHE[seite];
    var base = "../" + seite + "/";
    CACHE[seite] = fetch(base, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (html) {
      var m = /"staticryptEncryptedMsgUniqueVariableName":\s*"([0-9a-f]+)"/.exec(html), key = "";
      if (!m) return skripte(html, base);
      try { key = localStorage.getItem("tfgs_sc_" + seite) || ""; } catch (e) {}
      return entschluesseln(m[1], key).then(function (plain) { return skripte(plain, base); });
    }).then(datenAus).catch(function () { return null; });
    return CACHE[seite];
  }
  function thLabel(th) { return String(th.label || th.name || th.titel || th.id || ""); }
  function alleTasks(th) { var l = []; (th.tasks || []).forEach(function (t) { l.push(t); }); (th.stufen || []).forEach(function (s) { (s.tasks || []).forEach(function (t) { l.push(t); }); }); return l; }
  /* Item → {ort, text, link}. Item-Formen: „<kürzel>:<Thema>-<Aufgabe>“ (Missionen/Selbstarbeit), „<kürzel>:<Aufgabe>“, „<kürzel>:<Gruppe><Nr>“ (Tests) */
  function aufloesen(m, D) {
    var seite = String(m.seite || ""), item = String(m.item || ""), rest = item.indexOf(":") >= 0 ? item.slice(item.indexOf(":") + 1) : item;
    var okSeite = /^[a-z0-9][a-z0-9\-]*$/.test(seite), base = okSeite ? "../" + seite + "/?vorschau" : "";
    var tm = /^([A-Za-z]+\d*)-(.+)$/.exec(rest), res = { ort: "", text: "", link: base, sprung: false };
    if (tm) { res.ort = "Thema " + tm[1] + " · Aufgabe " + tm[2]; res.link = base && base + "#" + encodeURIComponent(tm[1]) + "/" + encodeURIComponent(tm[2]); res.sprung = !!base; }
    else if (rest) res.ort = "Aufgabe " + rest;
    if (!D) return res;
    if (D.themen) {
      var hit = null;
      D.themen.forEach(function (th) { alleTasks(th).forEach(function (t) { if (!hit && (th.id + "-" + t.id === rest)) hit = [th, t, true]; }); });
      if (!hit) D.themen.forEach(function (th) { alleTasks(th).forEach(function (t) { if (!hit && String(t.id) === rest) hit = [th, t, false]; }); });
      if (!hit) D.themen.forEach(function (th) { if (!hit && th.id === rest) hit = [th, null, true]; });
      if (hit) {
        var th = hit[0], t = hit[1];
        res.ort = thLabel(th) + (t ? " · Aufgabe " + (t.folie && /^\d/.test(String(t.folie)) ? t.folie : t.id) : "");
        res.text = t ? kurz(htmlText(t.q || t.text || t.frage || ""), 100) : "";
        if (hit[2] && base) {
          if (t && D.mission) res.link = base + "#frage=" + encodeURIComponent(th.id + "-" + t.id);
          else res.link = base + "#" + encodeURIComponent(th.id) + (t ? "/" + encodeURIComponent(t.id) : "");
          res.sprung = true;
        }
      }
    } else if (D.sets) {
      var gm = /^([A-Z])(.+)$/.exec(rest), set = gm && D.sets[gm[1]];
      var a = set && set.filter ? set.filter(function (x) { return String(x.id) === gm[2]; })[0] : null;
      if (a) { res.ort = "Gruppe " + gm[1] + " · Aufgabe " + a.id + (a.titel ? " · " + a.titel : ""); res.text = kurz(htmlText(a.text || ""), 100); res.link = base && base + "&gruppe=" + gm[1]; }
    }
    return res;
  }
  /* ---- Liste ---- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fdt(z) { return z ? new Date(z).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : ""; }
  function linkBtn(x, txt, href, haupt) { var a = el("a", "btn small" + (haupt ? "" : " ghost"), txt); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", function () { markiere([x.id]); }); return a; }
  function kopf(x, typ, info) {
    var k = el("div", "kfg-kopf"); k.appendChild(el("span", "kfg-typ", typ)); if (!x.gel || G.shown[x.id] === "neu") k.appendChild(el("span", "kfg-neu", "neu"));
    k.appendChild(el("span", "muted", info)); return k;
  }
  function frageRow(x) {
    var q = x.q, K = window.KFAntworten, row = el("div", "kfg-it" + (x.offen ? " offen" : ""));
    row.appendChild(kopf(x, x.offen ? "❓ Frage · offen" : "❓ Frage · beantwortet", (q.name ? q.name + " · " : "") + fdt(x.z)));
    row.appendChild(el("div", "kfg-auf", K ? K.aufgabe(q) : String(q.taskId || "")));
    row.appendChild(el("div", "kfg-txt", "„" + kurz(q.frage, 400) + "“"));
    var acts = el("div", "kfg-acts");
    if (K) acts.appendChild(linkBtn(x, "Zur Aufgabe ›", K.link(q, "portal"), true));
    if (q.antwort) { row.appendChild(el("div", "kfg-ans", "Antwort: " + String(q.antwort).replace(/^'/, ""))); row.appendChild(acts); return row; }
    var ta = el("textarea", "kfg-ta"); ta.rows = 3; ta.maxLength = 8000; ta.placeholder = "Antwort an die Schülerin / den Schüler …";
    if (G.draft && G.draft[q.id]) ta.value = G.draft[q.id];
    ta.oninput = function () { (G.draft = G.draft || {})[q.id] = ta.value; };
    var msg = el("span", "muted"), send = el("button", "btn small", "Antwort senden"); send.type = "button";
    send.onclick = function () {
      var t = ta.value.trim(); if (!t) { msg.textContent = "Bitte eine Antwort schreiben."; return; }
      send.disabled = true; msg.textContent = "wird gesendet …"; markiere([x.id]);
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
    var pf = /^pf:/.test(String(r.task_id || ""));
    row.appendChild(kopf(x, "⚑ Meldung · " + (pf ? "Prüfungsfit Mathe" : "Selbstlernen") + (x.offen ? "" : " · " + String(r.status || "")), fdt(x.z) + (r.class_code ? " · Klasse " + r.class_code : "")));
    row.appendChild(el("div", "kfg-auf", (pf ? "Aufgabe " + String(r.task_id).replace(/^pf:/, "") : String(r.task_id || "")) + (r.task_variant ? " · Variante " + r.task_variant : "")));
    row.appendChild(el("div", "kfg-txt", "Grund: " + String(r.reason || "–") + (r.comment ? " – „" + kurz(r.comment, 300) + "“" : "")));
    var acts = el("div", "kfg-acts");
    if (window.PortalMeldungen && window.PortalMeldungen.taskUrl) acts.appendChild(linkBtn(x, "Zur Aufgabe ›", window.PortalMeldungen.taskUrl(r), true));
    var b = el("button", "btn ghost small", "Im Tab „Meldungen“ bearbeiten"); b.type = "button"; b.onclick = function () { markiere([x.id]); closePanel(); G.ctx.openTab("meldungen"); }; acts.appendChild(b);
    row.appendChild(acts); return row;
  }
  function pmeldRow(x) {
    var m = x.m, row = el("div", "kfg-it");
    row.appendChild(kopf(x, "⚑ " + String(m.titel || m.seite || ""), (m.name ? m.name + " · " : "") + (m.klasse ? m.klasse + " · " : "") + fdt(x.z)));
    var ort = el("div", "kfg-auf"), txt = el("div", "kfg-aufg"), acts = el("div", "kfg-acts");
    var a = el("a", "btn small", "Zur Aufgabe ›"); a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", function () { markiere([x.id]); });
    function setz(res) { ort.textContent = res.ort || "Aufgabe"; txt.textContent = res.text ? "„" + res.text + "“" : ""; txt.hidden = !res.text;
      if (res.link) { a.href = res.link; a.textContent = res.sprung ? "Zur Aufgabe ›" : "Seite öffnen ›"; a.hidden = false; } else a.hidden = true; }
    setz(aufloesen(m, null));
    if (/^[a-z0-9][a-z0-9\-]*$/.test(String(m.seite || ""))) seitenDaten(m.seite).then(function (D) { if (D) setz(aufloesen(m, D)); });
    row.appendChild(ort); row.appendChild(txt);
    row.appendChild(el("div", "kfg-txt", "Grund: " + String(m.grund || "–") + (m.kommentar ? " – „" + kurz(m.kommentar, 300) + "“" : "")));
    acts.appendChild(a);
    var b = el("button", "btn ghost small", "Im Dashboard ansehen"); b.type = "button"; b.onclick = function () { markiere([x.id]); closePanel(); G.ctx.openTab("dash"); }; acts.appendChild(b);
    row.appendChild(acts); return row;
  }
  function row(x) { return x.art === "frage" ? frageRow(x) : x.art === "meldung" ? meldRow(x) : pmeldRow(x); }
  function fillPanel() {
    var body = G.panel.querySelector(".kfg-body"); if (!body) return;
    var keep = document.activeElement && body.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA";
    if (keep) return;   // nicht neu zeichnen, während getippt wird
    body.textContent = "";
    var L = listen(), neu = L.neu.slice(0, 60);
    if (!neu.length) body.appendChild(el("p", "muted kfg-leer", G.busy && !G.q ? "Lädt …" : (G.err || "Keine neuen Fragen oder Meldungen. 👍")));
    neu.forEach(function (x) { body.appendChild(row(x)); });
    if (L.alt.length) {
      var det = el("details", "kfg-alt"); if (G.openOld) det.open = true;
      det.addEventListener("toggle", function () { G.openOld = det.open; });
      det.appendChild(el("summary", "", "Gelesen, noch offen (" + L.alt.length + ")"));
      L.alt.slice(0, 60).forEach(function (x) { det.appendChild(row(x)); });
      body.appendChild(det);
    }
    /* Angezeigt = gelesen (sofort speichern); bleiben bis zum Schließen oben mit „neu“ */
    var ids = []; neu.forEach(function (x) { if (!x.gel) { G.shown[x.id] = "neu"; ids.push(x.id); } });
    markiere(ids);
    var stn = G.panel.querySelector(".kfg-stand"); if (stn) stn.textContent = G.last ? "Stand " + new Date(G.last).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
  }
  function openPanel() {
    if (G.panel) return;
    G.shown = {};
    var bg = el("div", "sheet-bg kfg-bg"), sh = el("div", "sheet glass kfg-sheet"); sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-label", "Neue Fragen und Meldungen");
    var top = el("div", "kfg-top"); top.appendChild(el("h3", "", "🔔 Fragen & Meldungen"));
    var r = el("div", "kfg-topr"); r.appendChild(el("span", "muted kfg-stand", ""));
    var re = el("button", "btn ghost small", "↻"); re.type = "button"; re.title = "Aktualisieren"; re.onclick = function () { load(true); };
    var x = el("button", "btn ghost small", "Schließen"); x.type = "button"; x.onclick = function () { closePanel(); }; r.appendChild(re); r.appendChild(x); top.appendChild(r);
    sh.appendChild(top); sh.appendChild(el("p", "muted kfg-hint", "Hier steht nur Neues. Was du hier gesehen hast, gilt als gelesen und kommt nicht wieder. Unbeantwortete Fragen bleiben unten unter „Gelesen, noch offen“."));
    sh.appendChild(el("div", "kfg-body")); bg.appendChild(sh);
    bg.addEventListener("click", function (e) { if (e.target === bg) closePanel(); });
    document.body.appendChild(bg); G.panel = bg; fillPanel();
    if (window.KFZurueck) { try { window.KFZurueck.push(function () { closePanel(true); }); } catch (e) {} }
    load(true);
  }
  function closePanel(fromBack) {
    if (!G.panel) return; try { G.panel.remove(); } catch (e) {} G.panel = null; G.shown = {};
    if (!fromBack && window.KFZurueck) { try { window.KFZurueck.pop(); } catch (e) {} }
    paint();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && G.panel) closePanel(); });
  window.PortalGlocke = {
    /* ctx: {api, token(), sess(), openTab(name), relogin()} */
    button: function (h, ctx) {
      G.ctx = ctx; if (!lehrer()) return null;
      if (G.tok !== ctx.token()) { G.tok = ctx.token(); G.q = G.r = G.p = null; G.last = 0; G.toast = false; G.known = null; }
      var b = h("button", { type: "button", class: "btn ghost kfg-btn", onclick: openPanel }, h("span", { "aria-hidden": "true", text: "🔔" }), h("span", { class: "kfg-n", hidden: true }));
      setTimeout(function () { paint(); load(false); startPoll(); }, 0);
      return b;
    },
    reset: function () { G.q = G.r = G.p = null; G.last = 0; G.toast = false; G.tok = ""; G.draft = null; G.known = null; G.st = null; if (G.panel) { try { G.panel.remove(); } catch (e) {} G.panel = null; } },
    _state: G, _items: function () { return listen(); }, _aufloesen: aufloesen, _daten: seitenDaten, _literal: literal, load: load, open: openPanel
  };
})();
