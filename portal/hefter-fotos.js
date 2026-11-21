/* KlasseFit Portal (Lehrkraft) – Hefter-Fotos der Berichtigungen im Schüler-Detail (21.11.2026).
   Eigenständiges Modul: portal.js ruft nur KFHefterFotos.box(benutzer, token) im Detail-Blatt auf.
   Lädt die Liste per POST /api/gas/hefter {action:"liste", benutzer} (nur Rolle lehrer), Bilder per POST {action:"bild"} als Blob (keine öffentlichen Adressen).
   Vorschaubilder je Seite und Aufgabe mit Uhrzeit, Klick = groß. Ohne Fotos bleibt der Abschnitt weg. */
(function () {
  "use strict";
  var API = "/api/gas/hefter", L = {}, URLS = {};
  var TITEL = { "mathe7-ka1-berichtigung": "Berichtigung KA 1 (7a)", "mathe8b-test-gleichungen-berichtigung": "Berichtigung Test Gleichungen (8b)" };
  function post(b) { return fetch(API, { method: "POST", cache: "no-store", body: JSON.stringify(b), headers: { "Content-Type": "text/plain;charset=utf-8" } }); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function zeit(z) { try { return new Date(z).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function css() { if (document.getElementById("hfpCss")) return; var s = document.createElement("style"); s.id = "hfpCss";
    s.textContent = ".hfp-seite{margin:.35rem 0 .6rem}.hfp-a{display:flex;flex-wrap:wrap;align-items:flex-start;gap:.45rem;margin:.3rem 0}.hfp-nr{min-width:5.5rem;font-weight:700;font-size:.85rem;padding-top:.2rem}"
      + ".hfp-t{margin:0;width:92px}.hfp-t button{display:block;width:92px;height:92px;padding:0;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff;cursor:zoom-in}.hfp-t img{width:100%;height:100%;object-fit:cover;display:block}"
      + ".hfp-t figcaption{font-size:.7rem;opacity:.8;margin-top:.1rem}.hf-lb{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.9);display:flex;align-items:center;justify-content:center;padding:1rem}"
      + ".hf-lb img{max-width:100%;max-height:100%;border-radius:6px;background:#fff}.hf-lb .hf-x{position:absolute;top:.6rem;right:.6rem;width:44px;height:44px;border-radius:50%;border:0;font-size:1.3rem;background:#fff;cursor:pointer}";
    document.head.appendChild(s); }
  function bild(id, token) { if (URLS[id]) return Promise.resolve(URLS[id]);
    return post({ action: "bild", token: token, id: id }).then(function (r) { if (!r.ok) throw new Error("http"); return r.blob(); }).then(function (b) { return (URLS[id] = URL.createObjectURL(b)); }); }
  function zoom(id, token) { bild(id, token).then(function (u) { var o = el("div", "hf-lb"); o.setAttribute("role", "dialog");
    var i = el("img"); i.alt = "Foto Heftseite"; i.src = u; var x = el("button", "hf-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Schließen"); o.appendChild(i); o.appendChild(x);
    function zu(e) { if (e) e.stopPropagation(); o.remove(); document.removeEventListener("keydown", k, true); } function k(e) { if (e.key === "Escape") { e.stopPropagation(); zu(); } }
    o.addEventListener("click", zu); document.addEventListener("keydown", k, true); document.body.appendChild(o); }); }
  function fuelle(box, fotos, token) {
    box.innerHTML = ""; if (!fotos.length) { box.style.display = "none"; return; } box.style.display = "";
    var dh = el("div", "dh"); dh.appendChild(el("b", null, "📷 Hefter-Fotos (" + fotos.length + ")")); box.appendChild(dh);
    var by = {}; fotos.forEach(function (f) { var s = by[f.seite] = by[f.seite] || {}; (s[f.a] = s[f.a] || []).push(f); });
    Object.keys(by).forEach(function (seite) {
      var sec = el("div", "hfp-seite"); sec.appendChild(el("div", "muted", TITEL[seite] || seite));
      Object.keys(by[seite]).sort(function (a, b) { return a.charAt(0) === b.charAt(0) ? (+a.slice(1)) - (+b.slice(1)) : a < b ? -1 : 1; }).forEach(function (a) {
        var row = el("div", "hfp-a"); row.appendChild(el("span", "hfp-nr", "Aufgabe " + a.slice(1) + " · Satz " + a.charAt(0)));
        by[seite][a].forEach(function (f) { var fig = el("figure", "hfp-t"), b = el("button"); b.type = "button"; b.setAttribute("aria-label", "Foto vergrößern"); b.textContent = "…";
          b.onclick = function (ev) { ev.stopPropagation(); zoom(f.id, token); };
          bild(f.id, token).then(function (u) { b.textContent = ""; var i = el("img"); i.alt = "Foto Aufgabe " + a; i.src = u; b.appendChild(i); }).catch(function () { b.textContent = "⚠"; });
          fig.appendChild(b); fig.appendChild(el("figcaption", null, zeit(f.z))); row.appendChild(fig); });
        sec.appendChild(row); });
      box.appendChild(sec); });
  }
  function box(benutzer, token) {
    css(); var b = el("div", "dsec hfp"); b.style.display = "none"; if (!benutzer || !token) return b;
    var c = L[benutzer];
    if (c && c.fotos && Date.now() - c.at < 60000) { fuelle(b, c.fotos, token); return b; }
    post({ action: "liste", token: token, benutzer: benutzer }).then(function (r) { return r.json(); }).then(function (r) {
      if (r && r.ok) { L[benutzer] = { fotos: r.fotos || [], at: Date.now() }; fuelle(b, L[benutzer].fotos, token); }
    }).catch(function () {});
    return b;
  }
  window.KFHefterFotos = { box: box };
})();
