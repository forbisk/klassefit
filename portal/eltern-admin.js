/* Portal-Tab „Eltern“ (nur Lehrkraft, 21.11.2026): Eltern-Codes je Kind erzeugen/widerrufen, Verknüpfungen sehen/trennen,
   Testergebnisse je Test+Klasse für Eltern freigeben, Elternansicht als Vorschau öffnen.
   Backend: /api/kf/konto (eltern_admin_*, nur auf klassefit.de/Hetzner). Der Klartext-Code steht nur einmal in der Antwort und
   nur im Browser der Lehrkraft (Anzeige + Elternbrief zum Drucken); er wird nirgends gespeichert. Alle Texte nur als textContent. */
(function () {
  var API = "/api/kf/konto";
  var E = { data: null, err: "", busy: false, klasse: "", neu: null, ctx: null };
  function api(o) {
    return fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(o) })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "Keine Verbindung oder Elternbereich hier nicht verfügbar (nur klassefit.de)." }; });
  }
  function dat(ms) { return ms ? new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"; }
  function laden(render) {
    var c = E.ctx; if (!c) return; E.busy = true; E.err = "";
    api({ action: "eltern_admin_liste", token: c.token() }).then(function (r) { E.busy = false; if (r && r.ok) E.data = r; else E.err = (r && r.error) || "Fehler"; render(); });
  }
  function brief(neu) {
    var w = window.open("", "_blank"); if (!w) { alert("Bitte Pop-ups für den Elternbrief erlauben."); return; }
    var d = w.document; d.open(); d.write("<!DOCTYPE html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Elternbrief</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 20px;color:#111}h1{font-size:20px}.code{font:700 26px/1.2 ui-monospace,monospace;letter-spacing:.08em;border:2px dashed #555;padding:12px 16px;display:inline-block;margin:6px 0 12px}ol li{margin:4px 0}small{color:#555}</style></head><body></body></html>"); d.close();
    var b = d.body, add = function (tag, txt, cls) { var e = d.createElement(tag); if (txt) e.textContent = txt; if (cls) e.className = cls; b.appendChild(e); return e; };
    add("h1", "KlasseFit – Zugang zum Elternbereich");
    add("p", "Für: " + neu.kind.name + " (Klasse " + neu.kind.klasse + ")");
    add("p", "Liebe Eltern, im Elternbereich von KlasseFit sehen Sie den Lernfortschritt Ihres Kindes: bearbeitete Themen, Lernzeit und Lerntage. Der Zugang ist freiwillig und nur lesend.");
    add("p", "Ihr persönlicher Eltern-Code (gilt einmal, bis " + dat(neu.gueltig_bis) + "):");
    add("div", neu.code, "code");
    var ol = add("ol"); ["klassefit.de/eltern aufrufen (oder in der KlasseFit-App bei der Anmeldung Ihre E-Mail-Adresse eingeben).", "„Eltern-Code einlösen“ wählen, den Code eingeben.", "E-Mail-Adresse als Anmeldenamen und ein eigenes Passwort festlegen.", "Für ein Geschwisterkind: mit dem weiteren Code „Weiteres Kind verknüpfen“."].forEach(function (t) { var li = d.createElement("li"); li.textContent = t; ol.appendChild(li); });
    add("p", "Bitte bewahren Sie den Code sicher auf und geben Sie ihn nicht weiter. Für einen zweiten Elternteil gibt es auf Wunsch einen eigenen Code.");
    add("small", "Informationen zum Datenschutz: klassefit.de/datenschutz");
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
  }
  function smInfo(r) { return (r.neu ? r.neu + " Eltern-Code(s) für die Schulmanager-Zustellung vorbereitet. " : "Kein neuer Code nötig. ") + (r.schonWartend ? r.schonWartend + " wartete(n) schon. " : "") + (r.voll ? r.voll + " übersprungen (schon 3 offene Codes). " : "") + (r.bereit ? "Die Nachricht an die Eltern geht automatisch über Schulmanager raus." : "Die automatische Zustellung ist noch nicht eingerichtet – die Codes warten so lange."); }
  function view(h, render, ctx) {
    E.ctx = ctx; if (!E.data && !E.busy && !E.err) laden(render);
    var box = h("div", {});
    box.appendChild(h("p", { class: "muted small", style: "margin:8px 6px 10px", text: "Eltern bekommen je Kind einen Eltern-Code (einmalig, 30 Tage gültig) – als private Schulmanager-Nachricht an die Eltern oder als gedruckter Elternbrief – und legen damit ihren eigenen Zugang an. Sie sehen nur ihr Kind, nur lesend: Fortschritt, Lernzeit, Selbsteinschätzung, Anzahl der Fragen. Testergebnisse und Noten nur, wenn Sie sie unten freigeben. Das Kind sieht in „Mein Konto“, dass Eltern verknüpft sind, und kann widersprechen (Zugang pausiert, bis Sie es klären)." }));
    if (E.neu) {
      var n = E.neu;
      box.appendChild(h("div", { class: "glass", style: "padding:14px 16px;margin:0 0 12px;border:2px solid var(--acc)" },
        h("p", { style: "font-weight:700", text: "Neuer Eltern-Code für " + n.kind.name + " (" + n.kind.klasse + ")" }),
        h("p", { style: "font:700 24px ui-monospace,monospace;letter-spacing:.08em;margin:8px 0", text: n.code }),
        h("p", { class: "muted small", text: "Gültig bis " + dat(n.gueltig_bis) + ". Der Code wird nur jetzt angezeigt und nirgends gespeichert." }),
        h("div", { style: "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap" },
          h("button", { class: "btn small", text: "Elternbrief drucken", onclick: function () { brief(n); } }),
          h("button", { class: "btn ghost", text: "Schließen", onclick: function () { E.neu = null; render(); } }))));
    }
    if (E.err) box.appendChild(h("div", { class: "banner", text: E.err }));
    if (E.busy && !E.data) { box.appendChild(h("div", { class: "spin" })); return box; }
    if (!E.data) return box;
    var sf = ctx.schulform ? ctx.schulform() : "", by = {};
    E.data.schueler.forEach(function (s) { if (sf && (/^\d+g$/i.test(s.klasse) ? "gym" : "sek") !== sf) return; (by[s.klasse] = by[s.klasse] || []).push(s); });
    var ks = Object.keys(by).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); });
    if (!E.klasse || !by[E.klasse]) E.klasse = ks[0] || "";
    var sel = h("select", { class: "wsel el-kl", "aria-label": "Klasse" }); ks.forEach(function (k) { var o = h("option", { value: k, text: "Klasse " + k }); if (k === E.klasse) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { E.klasse = sel.value; render(); });
    var nL = 0, nS = 0; (by[E.klasse] || []).forEach(function (s) { if (s.eltern.length) nS++; nL += s.eltern.length; });
    box.appendChild(h("div", { class: "wahl" }, h("label", { class: "wahl-f" }, h("span", { class: "wahl-l", text: "Klasse" }), sel),
      h("span", { class: "muted small", style: "align-self:center", text: nS + " von " + (by[E.klasse] || []).length + " Kindern mit Eltern-Zugang (" + nL + " Zugänge)" }),
      h("button", { class: "btn ghost", text: "↻", title: "Neu laden", onclick: function () { laden(render); } })));
    var sm = E.data.schulmanager || {}, ohne = (by[E.klasse] || []).filter(function (s) { return !s.test && !s.eltern.length && !s.codes.some(function (c) { return c.offen && !c.abgelaufen; }); }).length;
    box.appendChild(h("div", { class: "glass el-sm", style: "padding:10px 14px;margin:0 0 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap" },
      h("span", { class: "small", style: "flex:1;min-width:220px", text: (sm.bereit ? "📨 Zustellung per Schulmanager ist eingerichtet." : "📨 Automatische Schulmanager-Zustellung ist noch nicht eingerichtet – Codes warten, bis sie aktiv ist (oder Elternbrief drucken).") + (sm.wartet ? " " + sm.wartet + " Code(s) warten auf Zustellung." : "") }),
      ohne ? h("button", { class: "btn small", text: "Alle " + ohne + " ohne Eltern-Zugang/Code per Schulmanager", onclick: function (ev) {
        if (!confirm("Für " + ohne + " Kinder der Klasse " + E.klasse + " ohne Eltern-Zugang je einen Eltern-Code erzeugen und als private Schulmanager-Nachricht an die Eltern schicken lassen?")) return;
        var b = ev.currentTarget; b.disabled = true; api({ action: "eltern_admin_schulmanager", token: ctx.token(), klasse: E.klasse }).then(function (r) { b.disabled = false; if (!r.ok) alert(r.error || "Fehler"); else E.info = smInfo(r); laden(render); }); } }) : null));
    if (E.info) box.appendChild(h("div", { class: "banner", style: "margin-bottom:10px", role: "status", text: E.info }));
    var list = h("div", { class: "list" });
    (by[E.klasse] || []).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (s) {
      var zeilen = [];
      s.eltern.forEach(function (l) { zeilen.push(h("div", { class: "small", style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px" },
        h("span", { text: "👤 " + l.login + " · seit " + dat(l.seit) + (l.zuletzt ? " · zuletzt " + dat(l.zuletzt) : "") + (l.kindGesehen ? " · Kind informiert" : "") }),
        l.pausiert ? h("span", { class: "chip", style: "background:rgba(255,159,10,.2)", text: "⏸ Kind hat widersprochen (" + dat(l.widerspruch) + ")" }) : null,
        l.pausiert ? h("button", { class: "btn ghost small", text: "Wieder freigeben", onclick: function () { if (!confirm("Nur nach Klärung mit dem Kind und den Eltern: Eltern-Zugang wieder freigeben?")) return; api({ action: "eltern_admin_link_fortsetzen", token: ctx.token(), id: l.id }).then(function (r) { if (!r.ok) alert(r.error || "Fehler"); laden(render); }); } }) : null,
        h("button", { class: "btn ghost small", text: "Trennen", onclick: function () { if (!confirm("Verknüpfung trennen? Dieser Eltern-Zugang sieht das Kind dann nicht mehr.")) return; api({ action: "eltern_admin_link_widerrufen", token: ctx.token(), id: l.id }).then(function (r) { if (!r.ok) alert(r.error || "Fehler"); laden(render); }); } }))); });
      s.codes.forEach(function (c) { zeilen.push(h("div", { class: "small muted", style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px" },
        h("span", { text: !c.offen ? "⚠ Schulmanager-Zustellung nicht möglich – bitte Elternbrief drucken" : "🔑 Code offen" + (c.weg === "schulmanager" ? (c.zustellung === "gesendet" ? " · per Schulmanager gesendet " + dat(c.zugestellt) : " · wartet auf Schulmanager-Zustellung") : " · Brief") + (c.abgelaufen ? " (abgelaufen)" : " bis " + dat(c.bis)) }),
        !c.offen ? null : h("button", { class: "btn ghost small", text: "Widerrufen", onclick: function () { api({ action: "eltern_admin_code_widerrufen", token: ctx.token(), id: c.id }).then(function (r) { if (!r.ok) alert(r.error || "Fehler"); laden(render); }); } }))); });
      list.appendChild(h("div", { class: "glass", style: "padding:12px 14px" },
        h("div", { style: "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap" },
          h("div", {}, h("b", { text: s.name }), s.test ? h("span", { class: "chip", text: "Testkonto" }) : null,
            h("div", { class: "small muted", text: s.eltern.length ? s.eltern.length + " Eltern-Zugang" + (s.eltern.length > 1 ? "e" : "") : "kein Eltern-Zugang" })),
          h("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
            h("button", { class: "btn ghost small", text: "Vorschau", title: "Elternansicht dieses Kindes ansehen", onclick: function () { try { sessionStorage.setItem("kf_eltern_vorschau", s.benutzer); } catch (e) {} location.href = "/eltern/?vorschau=1"; } }),
            h("button", { class: "btn ghost small", text: "Per Schulmanager", title: "Eltern-Code als private Schulmanager-Nachricht an die Eltern", onclick: function (ev) { var b = ev.currentTarget; b.disabled = true; api({ action: "eltern_admin_schulmanager", token: ctx.token(), benutzer: s.benutzer }).then(function (r) { b.disabled = false; if (!r.ok) alert(r.error || "Fehler"); else E.info = smInfo(r); laden(render); }); } }),
            h("button", { class: "btn small", text: "Elternbrief", title: "Eltern-Code jetzt anzeigen und Elternbrief drucken", onclick: function (ev) { var b = ev.currentTarget; b.disabled = true; api({ action: "eltern_admin_code", token: ctx.token(), benutzer: s.benutzer }).then(function (r) { b.disabled = false; if (r.ok) { E.neu = r; laden(render); try { window.scrollTo(0, 0); } catch (e) {} } else alert(r.error || "Fehler"); }); } }))),
        zeilen));
    });
    box.appendChild(list);
    // Testergebnisse für Eltern freigeben (je Test + Klasse)
    var fr = {}; E.data.freigaben.forEach(function (f) { fr[f.seite + "|" + f.klasse] = 1; });
    var tests = E.data.tests.filter(function (t) { return (t.klassen || []).indexOf(E.klasse) >= 0; });
    box.appendChild(h("h2", { text: "Testergebnisse für Eltern (Klasse " + E.klasse + ")" }));
    if (!tests.length) box.appendChild(h("p", { class: "muted small", style: "margin:0 6px", text: "Keine Tests für diese Klasse." }));
    tests.forEach(function (t) {
      var on = !!fr[t.key + "|" + E.klasse.toLowerCase()];
      var cb = h("input", { type: "checkbox" }); cb.checked = on;
      cb.addEventListener("change", function () { cb.disabled = true; api({ action: "eltern_admin_freigabe", token: ctx.token(), seite: t.key, klasse: E.klasse, aktiv: cb.checked }).then(function (r) { if (!r.ok) alert(r.error || "Fehler"); laden(render); }); });
      box.appendChild(h("label", { class: "glass", style: "display:flex;gap:10px;align-items:center;padding:10px 14px;margin-bottom:6px;font-size:14px" }, cb, h("span", { text: t.titel + " – Ergebnis (Punkte, %, Note) für Eltern sichtbar" })));
    });
    return box;
  }
  window.PortalEltern = { view: view, reset: function () { E.data = null; E.err = ""; E.neu = null; E.info = ""; } };
})();
