/* Geteilte Schulgeräte: Beim Abmelden im Portal (oder beim Wechsel auf ein anderes Portal-Konto) werden die Sitzungen der
   einzelnen Seiten beendet, damit der nächste Schüler nie im Konto des vorherigen landet.
   - Bereits mit dem Server synchronisierte Gerätekopien werden gelöscht (der Stand liegt auf dem Server).
   - Nicht synchronisierte Kopien und rein lokale Fortschritte (Prüfungsfit frei/Gymnasium) werden NICHT gelöscht, sondern unter
     "kf_park_<benutzer>" geparkt und beim nächsten Anmelden desselben Benutzers zurückgelegt (danach synchronisieren die Seiten wie gewohnt).
   - Missionen 6 und Gleichungen 8b speichern ohnehin pro Benutzer; dort wird nur die Missionen-Sitzung beendet.
   Läuft nur auf der Portal-Seite (eingebunden über config.js). Ändert keine Schlüssel/Formate der Seiten. */
(function () {
  "use strict";
  var LS = "tfgs_portal_v1", OWNER = "kf_geraet_owner", PARK = "kf_park_";
  var ls; try { ls = window.localStorage; } catch (e) { return; }
  var SP = Storage.prototype, set0 = SP.setItem, rem0 = SP.removeItem, get0 = SP.getItem;
  function g(k) { return get0.call(ls, k); }
  function s(k, v) { try { set0.call(ls, k, v); } catch (e) {} }
  function r(k) { rem0.call(ls, k); }
  function j(v) { try { return JSON.parse(v); } catch (e) { return null; } }
  function keysWith(p) { var o = []; for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(p) === 0) o.push(k); } return o; }
  function canon(v) { var x = j(v); return x === null && v !== "null" ? String(v) : JSON.stringify(x); }
  function benutzer(v) { var p = j(v); return p && p.benutzer ? String(p.benutzer).toLowerCase() : ""; }

  /* Selbstlernen-Familie (Mathe 10, Wiederholung, Karteikarten, Prüfungsfit Schule): synchron, wenn der Gerätestand dem zuletzt gesendeten entspricht */
  function slxDirty(sess, keys) {
    var last = sess && sess.lastSent ? j(sess.lastSent) : null; if (!last || typeof last !== "object") return keys.length > 0;
    var all = {}; keys.forEach(function (k) { all[k] = 1; }); Object.keys(last).forEach(function (k) { all[k] = 1; });
    return Object.keys(all).some(function (k) {
      if (k === "sl10a-ui" || k === "sl10a-profil") return false;
      var a = g(k), b = last[k]; if (a === null) return b !== undefined && b !== null;
      return canon(a) !== JSON.stringify(b === undefined ? null : b);
    });
  }
  function park(u) {
    var st = {}, put = function (k) { var v = g(k); if (v !== null) st[k] = v; };
    var sk = keysWith("sl10a-"), ss = j(g("sl10a_sess"));
    if (ss || sk.length) { if (slxDirty(ss, sk)) { sk.forEach(put); put("sl10a_sess"); } sk.forEach(r); r("sl10a_sess"); }
    var m = j(g("m9g_sess")), mst = g("m9g-st");
    if (m || mst !== null) { if (mst !== null && (!m || canon(mst) !== m.lastSent)) { put("m9g-st"); put("m9g_sess"); } r("m9g-st"); r("m9g_sess"); r("m9g_portal"); }
    r("inf6_missionen_sitzung");
    ["pf-v1", "pf-g9", "pf-mode"].forEach(function (k) { put(k); r(k); });
    if (!u || !Object.keys(st).length) return;
    var old = j(g(PARK + u)) || {}; Object.keys(st).forEach(function (k) { old[k] = st[k]; });
    s(PARK + u, JSON.stringify(old));
  }
  function restore(u) {
    var p = u && j(g(PARK + u)); if (!p) return;
    var slxFrei = g("sl10a_sess") === null, m9Frei = g("m9g_sess") === null;
    Object.keys(p).forEach(function (k) {
      if (/^sl10a/.test(k) && !slxFrei) return; if (/^m9g/.test(k) && !m9Frei) return;
      if (g(k) === null) s(k, p[k]);
    });
    r(PARK + u);
  }
  function wechsel(neu) {
    var alt = g(OWNER) || "";
    if (alt === neu) return;
    park(alt);                                   /* Gerätedaten des vorherigen Benutzers beenden/parken */
    if (neu) { restore(neu); s(OWNER, neu); } else r(OWNER);
  }
  /* Beim Laden: Portal abgemeldet, aber Gerätedaten eines Benutzers vorhanden -> beenden. Erstes Laden mit Sitzung: Besitzer merken. */
  try {
    var cur = benutzer(g(LS));
    if (!cur) { if (g(OWNER)) wechsel(""); }
    else if (!g(OWNER)) s(OWNER, cur);
    else if (g(OWNER) !== cur) wechsel(cur);
  } catch (e) {}
  /* Anmelden/Abmelden der Portal-Seite erkennen (portal.js schreibt/löscht tfgs_portal_v1) */
  SP.setItem = function (k, v) {
    if (this === ls && k === LS) { try { var n = benutzer(v); if (n) wechsel(n); } catch (e) {} }
    return set0.apply(this, arguments);
  };
  SP.removeItem = function (k) {
    if (this === ls && k === LS) { try { wechsel(""); } catch (e) {} }
    return rem0.apply(this, arguments);
  };
  window.KF_GERAET = { park: park, restore: restore };
})();
