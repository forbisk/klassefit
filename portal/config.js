/* Adresse der Apps-Script-Web-App "Schüler-Portal" (forbisk@gmail.com), endet auf /exec.
   Leer = Portal noch nicht eingerichtet (zeigt einen Hinweis). Eingetragen am 25.10.2026 nach der Bereitstellung. */
window.PORTAL_API = 'https://script.google.com/macros/s/AKfycbxqHjPyJR4CM8LIGLWnROgLTlNUCUy0-FTChC4f062rOlhnhSCx_S8UXwBwfBO7Iwnl/exec';

/* Kopplung "Karte erst nach Freischaltung durch die Lehrkraft": Schüler sehen die Karte nur, wenn der Test im Selbstlern-Backend
   (Aktion testStatus) freigeschaltet ist (Lehrer-Ansicht der Seite -> „Jetzt freischalten“). Lehrkräfte sehen sie immer. Keine Geheimnisse hier. */
window.PORTAL_KOPPLUNG = {
  "mathe10-testberichtigung-aehnlichkeit": {
    url: 'https://script.google.com/macros/s/AKfycbw9iDp8f4R9eOdrTF2CfHNlv3Xn_u7IjPZUO904wGawIZZGin3M7jXTDHjktZTU3tYTDQ/exec',
    testId: 'mathe10a-testberichtigung-aehnlichkeit'
  }
};

/* Geteilte Geräte: Seiten-Sitzungen beim Abmelden/Kontowechsel beenden (siehe geraet.js). Synchron, vor portal.js. */
document.write('<script src="geraet.js"><\/script>');

/* Selbstlern-Backend Mathe 10a (Fragen/Antworten zu Aufgaben): Hinweis „Neue Antwort von Herrn Kurlavičius“ (antworten.js). Keine Geheimnisse hier. */
window.PORTAL_SL_API = 'https://script.google.com/macros/s/AKfycbw9iDp8f4R9eOdrTF2CfHNlv3Xn_u7IjPZUO904wGawIZZGin3M7jXTDHjktZTU3tYTDQ/exec';
