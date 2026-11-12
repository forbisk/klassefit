/* Portal „💡 Fehler / Wunsch“: Knopf + Formular für alle Angemeldeten, Liste für die Lehrkraft (Tab „Wünsche“).
   Daten: Portal-Backend (wunsch_senden, admin_wuensche, admin_wunsch_update). Identität kommt serverseitig aus der Sitzung.
   Der Knopf erscheint nur, wenn das Backend die Funktion meldet (payload.wuensche) – mit älterem Backend bleibt alles wie vorher.
   Getrennt vom „⚑ Fehler melden“ je Aufgabe (meldungen.js / Prüfungsfit). Alle Texte nur per textContent. */
(function () {
  "use strict";
  var MAXT = 1000, MAXB = 2000000;
  var L = { list: null, err: "", busy: false, st: "", typ: "", kl: "", open: {} };

  function el(tag, a, kids) { var e = document.createElement(tag); Object.keys(a || {}).forEach(function (k) { var v = a[k]; if (v == null) return; if (k === "text") e.textContent = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }); return e; }

  /* Bild verkleinern (max. 1600 px, JPEG) -> data-URL, damit Handy-Fotos unter 2 MB bleiben */
  function shrink(file) {
    return new Promise(function (ok, no) {
      if (!file || !/^image\//.test(file.type)) return no("typ");
      var fr = new FileReader();
      fr.onerror = function () { no("lesen"); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { no("typ"); };
        img.onload = function () {
          var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
          var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          var q = 0.85, d = c.toDataURL("image/jpeg", q);
          while (d.length * 0.75 > MAXB && q > 0.3) { q -= 0.15; d = c.toDataURL("image/jpeg", q); }
          if (d.length * 0.75 > MAXB) return no("gross");
          ok(d);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function close() { var o = document.getElementById("wu-modal"); if (o) o.remove(); document.removeEventListener("keydown", esc); }
  function esc(e) { if (e.key === "Escape") close(); }

  function openForm(ctx) {
    close();
    var sess = ctx.sess(), lehrer = sess.rolle === "lehrer", info = ctx.info() || {}, bildOk = !!info.bild;
    var typ = "", bild = "";
    var tF = el("button", { type: "button", class: "wu-typ", "aria-pressed": "false", text: "🐞 Fehler", "data-typ": "Fehler" });
    var tW = el("button", { type: "button", class: "wu-typ", "aria-pressed": "false", text: "✨ Wunsch", "data-typ": "Wunsch" });
    [tF, tW].forEach(function (b) { b.addEventListener("click", function () { typ = b.getAttribute("data-typ"); tF.setAttribute("aria-pressed", String(typ === "Fehler")); tW.setAttribute("aria-pressed", String(typ === "Wunsch")); }); });
    var sel = el("select", { id: "wu-seite", "aria-label": "Welche Seite?" }, [el("option", { value: "", text: "– bitte wählen –" }), el("option", { value: "portal", text: "Portal allgemein" })]
      .concat((ctx.seiten() || []).filter(function (s) { return s && s.key; }).map(function (s) { return el("option", { value: s.key, text: s.titel || s.key }); }))
      .concat([el("option", { value: "sonstiges", text: "Sonstiges" })]));
    var ta = el("textarea", { id: "wu-text", maxlength: String(MAXT), rows: "5", placeholder: lehrer ? "Was ist aufgefallen / was soll anders werden?" : "Was ist passiert? Oder was wünschst du dir? Schreib es kurz auf." });
    var cnt = el("div", { class: "wu-cnt", text: "0 / " + MAXT });
    ta.addEventListener("input", function () { cnt.textContent = ta.value.length + " / " + MAXT; });
    var prev = el("div", { class: "wu-prev" }), fin = el("input", { type: "file", accept: "image/*", id: "wu-bild" });
    var msg = el("p", { class: "err", role: "alert" });
    fin.addEventListener("change", function () {
      bild = ""; prev.replaceChildren(); msg.textContent = "";
      var f = fin.files && fin.files[0]; if (!f) return;
      shrink(f).then(function (d) { bild = d; var im = el("img", { alt: "Vorschau" }); im.src = d; prev.replaceChildren(im, el("button", { type: "button", class: "btn ghost small", text: "Bild entfernen", onclick: function () { bild = ""; fin.value = ""; prev.replaceChildren(); } })); },
        function (e) { fin.value = ""; msg.textContent = e === "gross" ? "Das Bild ist zu groß (höchstens 2 MB)." : "Das ist leider kein Bild, das wir lesen können."; });
    });
    var send = el("button", { type: "submit", class: "btn", text: "Abschicken" });
    var box = el("form", { class: "wu-box glass", role: "dialog", "aria-modal": "true", "aria-labelledby": "wu-h" }, [
      el("div", { class: "wu-top" }, [el("h3", { id: "wu-h", text: "💡 Fehler / Wunsch" }), el("button", { type: "button", class: "btn ghost small", text: "Schließen", onclick: close })]),
      el("p", { class: "muted small", text: lehrer ? "Landet im Blatt „Wünsche“." : "Hast du einen Fehler gefunden oder eine Idee, was besser werden kann? Schreib es hier – dein Lehrer liest alles." }),
      el("div", { class: "wu-lbl", text: "Was möchtest du melden?" }), el("div", { class: "wu-typs" }, [tF, tW]),
      el("label", { class: "wu-lbl", for: "wu-seite", text: "Wo?" }), sel,
      el("label", { class: "wu-lbl", for: "wu-text", text: "Beschreibung" }), ta, cnt,
      bildOk ? el("label", { class: "wu-lbl", for: "wu-bild", text: "Bildschirmfoto (freiwillig, max. 2 MB)" }) : null, bildOk ? fin : null, bildOk ? prev : null,
      msg, send]);
    box.addEventListener("submit", function (e) {
      e.preventDefault(); msg.textContent = "";
      if (!typ) { msg.textContent = "Bitte wähle „Fehler“ oder „Wunsch“."; return; }
      if (!sel.value) { msg.textContent = "Bitte wähle aus, wo es ist."; return; }
      var t = ta.value.trim(); if (!t) { msg.textContent = "Bitte schreib kurz, worum es geht."; return; }
      send.disabled = true; send.textContent = "Wird gesendet …";
      var body = { action: "wunsch_senden", token: ctx.token(), typ: typ, seite: sel.value, text: t.slice(0, MAXT) };
      if (bild && bildOk) body.bild = { data: bild };
      ctx.api(body).then(function (r) {
        if (r && r.ok) {
          box.replaceChildren(el("div", { class: "wu-done" }, [el("div", { class: "wu-big", text: "✅" }), el("h3", { text: "Danke!" }),
            el("p", { text: lehrer ? "Gespeichert." : "Deine Nachricht ist angekommen. Dein Lehrer schaut sie sich an." }),
            r.max ? el("p", { class: "muted small", text: "Heute: " + r.heute + " von " + r.max }) : null,
            el("button", { type: "button", class: "btn", text: "Fertig", onclick: close })]));
          return;
        }
        send.disabled = false; send.textContent = "Abschicken";
        if (r && r.relogin) { close(); ctx.relogin(); return; }
        msg.textContent = (r && r.error === "unbekannte Aktion") ? "Diese Funktion ist gleich da – bitte versuch es später noch einmal." : ((r && r.error) || "Hat leider nicht geklappt. Bitte später noch einmal versuchen.");
      });
    });
    var bg = el("div", { id: "wu-modal", class: "wu-bg", onclick: function (e) { if (e.target === bg) close(); } }, [box]);
    document.body.appendChild(bg); document.addEventListener("keydown", esc);
    setTimeout(function () { tF.focus(); }, 30);
  }

  function button(h, ctx) {
    if (!ctx.info()) return null;
    return h("button", { class: "btn ghost wu-btn", type: "button", "aria-label": "Fehler oder Wunsch melden", onclick: function () { openForm(ctx); } }, h("span", { text: "💡 " }), h("span", { class: "wu-l", text: "Fehler / Wunsch" }));
  }

  /* ---------- Lehrkraft: Liste ---------- */
  function load(ctx) {
    L.busy = true; L.err = ""; ctx.render();
    ctx.api({ action: "admin_wuensche", token: ctx.token() }).then(function (r) {
      L.busy = false;
      if (r.ok) L.list = r.items || [];
      else if (r.relogin) return ctx.relogin();
      else L.err = r.error === "unbekannte Aktion" ? "Das Portal-Backend kennt „Wünsche“ noch nicht (neue Version portal-7w bereitstellen)." : (r.error || "Fehler beim Laden.");
      ctx.render();
    });
  }
  function upd(ctx, x, patch, done) {
    ctx.api(Object.assign({ action: "admin_wunsch_update", token: ctx.token(), id: x.id }, patch)).then(function (r) {
      if (r.ok) Object.keys(patch).forEach(function (k) { x[k] = patch[k]; }); else L.err = r.error || "Speichern fehlgeschlagen";
      if (done) done(r.ok); ctx.render();
    });
  }
  function fdt(z) { return z ? new Date(z).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""; }
  var STC = { neu: "st-neu", "in Arbeit": "st-arb", erledigt: "st-ok", abgelehnt: "st-no" };
  function view(h, ctx) {
    if (!L.list && !L.busy && !L.err) { setTimeout(function () { load(ctx); }, 0); }
    if (!L.list) return h("div", { class: "glass empty" }, h("p", { class: "muted", text: L.busy || !L.err ? "Wünsche werden geladen …" : L.err }), L.err ? h("div", { style: "margin-top:12px" }, h("button", { class: "btn small", text: "Erneut versuchen", onclick: function () { load(ctx); } })) : null);
    var all = L.list, kls = {}; all.forEach(function (x) { if (x.klasse) kls[x.klasse] = 1; });
    var list = all.filter(function (x) { return (!L.st || x.status === L.st) && (!L.typ || x.typ === L.typ) && (!L.kl || (L.kl === "-" ? !x.klasse : x.klasse === L.kl)); });
    /* 12.11.2026: Filter als Drop-downs (wie Dashboard, „überall Drop-downs“) statt Chip-Reihen; Werte L.st/L.typ/L.kl unverändert */
    var chips = function (opts, cur, pick, lab, cls) { var sel = h("select", { class: "wsel " + cls, "aria-label": lab });
      opts.forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); if (o[0] === cur) op.selected = true; sel.appendChild(op); });
      sel.value = cur; sel.addEventListener("change", function () { pick(sel.value); ctx.render(); });
      return h("label", { class: "wahl-f f-" + cls }, h("span", { class: "wahl-l", text: lab }), sel); };
    var cntSt = function (s) { return all.filter(function (x) { return x.status === s; }).length; };
    return h("div", { class: "wu-list" },
      h("div", { class: "src" }, all.length + " Einträge · Blatt „Wünsche“ · getrennt von den ⚑-Meldungen je Aufgabe ", h("button", { class: "btn ghost small", disabled: L.busy ? true : null, text: L.busy ? "Lädt …" : "↻ Aktualisieren", onclick: function () { load(ctx); } })),
      L.err ? h("div", { class: "banner", text: L.err }) : null,
      h("div", { class: "wahl", role: "group", "aria-label": "Filter" }, chips([["", "Alle Status"], ["neu", "neu (" + cntSt("neu") + ")"], ["in Arbeit", "in Arbeit (" + cntSt("in Arbeit") + ")"], ["erledigt", "erledigt"], ["abgelehnt", "abgelehnt"]], L.st, function (v) { L.st = v; }, "Status", "wsel-wust"),
      chips([["", "Alle Typen"], ["Fehler", "🐞 Fehler"], ["Wunsch", "✨ Wunsch"]], L.typ, function (v) { L.typ = v; }, "Typ", "wsel-wutyp"),
      chips([["", "Alle Klassen"]].concat(Object.keys(kls).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); }).map(function (k) { return [k, k]; })).concat([["-", "Lehrkraft"]]), L.kl, function (v) { L.kl = v; }, "Klasse", "wsel-wukl")),
      list.length ? h("div", { class: "list" }, list.map(function (x) {
        var note = h("textarea", { class: "wu-note", rows: "2", placeholder: "Notiz (nur für dich)" }); note.value = x.notiz || "";
        var saved = h("span", { class: "muted small" });
        var stSel = h("select", { "aria-label": "Status", onchange: function (e) { upd(ctx, x, { status: e.target.value }); } }, ["neu", "in Arbeit", "erledigt", "abgelehnt"].map(function (s) { var o = h("option", { value: s, text: s }); if (s === x.status) o.selected = true; return o; }));
        var link = /^https:\/\/drive\.google\.com\//.test(x.bild) ? h("a", { href: x.bild, target: "_blank", rel: "noopener", text: "🖼 Screenshot" }) : (x.bild ? h("span", { class: "muted small", text: x.bild }) : null);
        return h("div", { class: "wu-item glass" },
          h("div", { class: "wu-meta" }, h("span", { class: "tag " + (x.typ === "Fehler" ? "test" : ""), text: x.typ === "Fehler" ? "🐞 Fehler" : "✨ Wunsch" }), h("span", { class: "tag " + (STC[x.status] || ""), text: x.status }),
            h("b", { text: (x.name || x.benutzer) }), h("span", { class: "muted small", text: (x.klasse ? x.klasse + " · " : "") + x.rolle + (x.rolle === "test" ? " (Testkonto)" : "") + " · " + fdt(x.zeit) })),
          h("div", { class: "muted small", text: "Seite: " + x.seite }),
          h("p", { class: "wu-txt", text: x.text }),
          h("div", { class: "wu-act" }, stSel, link, note, h("button", { class: "btn ghost small", text: "Notiz speichern", onclick: function () { upd(ctx, x, { notiz: note.value }, function (ok) { saved.textContent = ok ? "gespeichert" : ""; }); } }), saved));
      })) : h("div", { class: "glass empty" }, h("p", { class: "muted", text: all.length ? "Keine Einträge für diese Auswahl." : "Noch keine Fehler oder Wünsche eingegangen." })));
  }
  window.PortalWuensche = { button: button, open: openForm, view: view, reset: function () { L.list = null; L.err = ""; L.busy = false; close(); }, _state: L };
})();
