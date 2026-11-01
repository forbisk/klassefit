/* „Meine Aufgaben“ im Briefings-Tab (nur Lehrkraft). Enthält KEINE Aufgaben-Daten: alles kommt nach dem Lehrer-Login vom Backend
   (aufgaben_list / aufgaben_update / aufgaben_nachricht, privates Blatt „Aufgaben“). Ausgabe nur per textContent. Kein Löschen: Erledigtes kann wieder geöffnet werden. */
(function () {
  var A = { d: null, err: "", busy: false, open: {}, saving: {} };
  var KATS = [["Beruflich/Schule", "🏫"], ["Services", "🧑‍💻"], ["X", "𝕏"], ["Kinder", "🧒"], ["Familie/Haushalt", "🏠"], ["Steuern & Behörden", "🧾"], ["Finanzen/Trading", "📈"], ["Gesundheit", "🩺"], ["Sonstiges", "📌"]];
  var KAT = {}; KATS.forEach(function (k) { KAT[k[0].toLowerCase()] = k[1]; });
  function katOf(it) { var c = String(it.category || ""); return KAT[c.toLowerCase()] ? KATS.filter(function (k) { return k[0].toLowerCase() === c.toLowerCase(); })[0][0] : "Sonstiges"; }
  function berlin(d) { return new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" })); }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function fmt(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : (s || ""); }
  function gruppe(it, heute, woche) { var f = it.due || it.date || ""; if (!f || f <= heute) return 0; return f <= woche ? 1 : 2; }
  function load(ctx) {
    A.busy = true; ctx.render();
    ctx.api({ action: "aufgaben_list", token: ctx.token() }).then(function (r) {
      A.busy = false;
      if (r.ok) { A.d = r; A.err = ""; } else if (r.relogin) return ctx.relogin(); else A.err = r.error === "unbekannte Aktion" ? "Das Backend kennt „Meine Aufgaben“ noch nicht (neue Code.gs-Version fehlt)." : (r.error || "Konnte nicht geladen werden.");
      ctx.render();
    });
  }
  function save(ctx, body, it, after) {
    body.token = ctx.token(); A.saving[it ? it.id : "msg"] = "speichert …"; ctx.render();
    ctx.api(body).then(function (r) {
      var k = it ? it.id : "msg";
      if (r.ok) { A.saving[k] = "✓ gespeichert"; if (after) after(r); } else if (r.relogin) return ctx.relogin(); else A.saving[k] = "⚠ nicht gespeichert: " + (r.error || "Fehler");
      ctx.render();
    });
  }
  function item(h, ctx, it) {
    var done = it.status === "erledigt", open = A.open[it.id];
    var cb = h("input", { type: "checkbox", "aria-label": "erledigt", checked: done, onchange: function () { var st = cb.checked ? "erledigt" : "offen"; save(ctx, { action: "aufgaben_update", id: it.id, status: st }, it, function () { it.status = st; }); } });
    var ta = h("textarea", { rows: "2", placeholder: "Kommentar an Grok Bot …", maxlength: "1500" }); ta.value = it.kommentar || "";
    return h("div", { class: "au-it glass" + (done ? " done" : "") },
      h("div", { class: "au-row" }, cb,
        h("div", { class: "au-tx", onclick: function () { A.open[it.id] = !open; ctx.render(); } },
          h("b", { text: it.title }),
          h("span", { class: "muted", text: [ctx.badge ? ctx.badge(it) : "", it.due ? "fällig " + fmt(it.due) : ""].filter(Boolean).join(" · ") }),
          it.kommentar && !open ? h("span", { class: "au-c", text: "💬 " + it.kommentar }) : null),
        done ? h("button", { class: "btn ghost small", text: "Wieder öffnen", onclick: function () { save(ctx, { action: "aufgaben_update", id: it.id, status: "offen" }, it, function () { it.status = "offen"; }); } }) : null),
      open ? h("div", { class: "au-det" }, it.details ? h("p", { text: it.details }) : null, it.source ? h("p", { class: "muted", text: "Quelle: " + it.source }) : null, ta,
        h("button", { class: "btn small", text: "Kommentar speichern", onclick: function () { var v = ta.value; save(ctx, { action: "aufgaben_update", id: it.id, kommentar: v }, it, function () { it.kommentar = v; }); } })) : null,
      A.saving[it.id] ? h("div", { class: "muted au-s", text: A.saving[it.id] }) : null);
  }
  window.PortalAufgaben = {
    reset: function () { A.d = null; A.err = ""; },
    view: function (h, ctx) {
      if (!A.d && !A.busy && !A.err) load(ctx);
      var head = h("h2", { text: "✅ Meine Aufgaben" });
      if (!A.d) return h("div", { class: "au" }, head, h("div", { class: "glass empty" }, h("p", { class: "muted", text: A.err || "Lade …" }), A.err ? h("button", { class: "btn small", text: "Erneut versuchen", onclick: function () { A.err = ""; load(ctx); } }) : null));
      var now = berlin(new Date()), heute = iso(now), w = new Date(now); w.setDate(w.getDate() + 7); var woche = iso(w);
      var offen = A.d.items.filter(function (x) { return x.status !== "erledigt"; }), erl = A.d.items.filter(function (x) { return x.status === "erledigt"; });
      offen.sort(function (a, b) { return (a.due || a.date || "9") < (b.due || b.date || "9") ? -1 : 1; });
      var B = ["⚠ heute/überfällig", "diese Woche", ""]; ctx.badge = function (x) { return x.status === "erledigt" ? "" : B[gruppe(x, heute, woche)]; };
      var dueSoon = offen.filter(function (x) { return gruppe(x, heute, woche) < 2; }).length;
      var msg = h("textarea", { rows: "3", placeholder: "Nachricht an Grok Bot (lese ich beim nächsten Briefing) …", maxlength: "2000" });
      return h("div", { class: "au" }, head,
        h("p", { class: "muted", text: offen.length + " offen · " + dueSoon + " heute/diese Woche fällig" }),
        KATS.map(function (k) { var l = offen.filter(function (x) { return katOf(x) === k[0]; }); if (!l.length) return null;
          var nah = l.filter(function (x) { return gruppe(x, heute, woche) < 2; }).length;
          return h("details", { class: "au-kat", open: nah > 0 || A.open["k:" + k[0]], ontoggle: function (e) { A.open["k:" + k[0]] = e.target.open; } },
            h("summary", { text: k[1] + " " + k[0] + " (" + l.length + (nah ? ", " + nah + " bald fällig" : "") + ")" }), l.map(function (x) { return item(h, ctx, x); })); }),
        !offen.length ? h("p", { class: "muted", text: "Keine offenen Aufgaben 🎉" }) : null,
        erl.length ? h("details", {}, h("summary", { text: "Erledigt (" + erl.length + ")" }), erl.map(function (x) { return item(h, ctx, x); })) : null,
        h("div", { class: "glass au-msg" }, h("b", { text: "💬 Nachricht an Grok Bot" }), msg,
          h("button", { class: "btn small", text: "Senden", onclick: function () { var t = msg.value.trim(); if (!t) return; save(ctx, { action: "aufgaben_nachricht", text: t }, null, function () { A.d.nachrichten.push({ zeit: Date.now(), text: t }); }); } }),
          A.saving.msg ? h("span", { class: "muted", text: " " + A.saving.msg }) : null,
          (A.d.nachrichten || []).slice(-3).map(function (m) { return h("div", { class: "muted au-c", text: new Date(m.zeit).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) + ": " + m.text }); })),
        h("button", { class: "btn ghost small", text: A.busy ? "Lädt …" : "↻ Aufgaben aktualisieren", onclick: function () { load(ctx); } }));
    }
  };
})();
