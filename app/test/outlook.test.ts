import { describe, expect, it } from "vitest";
import { explainAuthError, sanitizeEmail } from "@/lib/outlook";
import { emailDocument, type EmailTheme } from "@/lib/email-document";

const THEME: EmailTheme = { bg: "#141310", text: "#e9e5da", muted: "#a7a194", border: "#3a372f", accent: "#c97a5a", fontFaces: "" };

describe("nettoyage du HTML des newsletters", () => {
  const dirty = `
    <style>.x{color:red}</style>
    <script>alert(1)</script>
    <p onclick="steal()" style="color:blue">Bonjour <a href="javascript:alert(1)">piège</a> <a href="https://exemple.fr/article">lien</a></p>
    <img src="https://tracker.exemple/pixel.gif" onerror="x()">
    <img src="data:image/png;base64,AAAA">
    <iframe src="https://exemple.fr"></iframe>
    <form action="https://exemple.fr"><input name="mdp"></form>
    <object data="x.swf"></object>
    <svg><script>alert(2)</script></svg>
    <table cellpadding="4"><tr><td bgcolor="#fff">cellule</td></tr></table>`;
  const clean = sanitizeEmail(dirty);

  it("retire scripts, formulaires, iframes, objets et gestionnaires d'événements", () => {
    for (const bad of ["<script", "onclick", "onerror", "<iframe", "<form", "<input", "<object", "javascript:", "<svg"]) {
      expect(clean.toLowerCase()).not.toContain(bad);
    }
  });

  it("garde la mise en forme utile et ouvre les liens dans un nouvel onglet", () => {
    expect(clean).toContain("<style>");
    expect(clean).toContain('style="color:blue"');
    expect(clean).toContain('href="https://exemple.fr/article"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('bgcolor="#fff"');
  });

  it("bloque les images distantes par défaut via la politique de sécurité du cadre", () => {
    for (const view of ["lecture", "original"] as const) {
      expect(emailDocument(clean, false, view, THEME)).toContain("img-src data:;");
      expect(emailDocument(clean, true, view, THEME)).toContain("img-src data: https: http:");
      expect(emailDocument(clean, false, view, THEME)).toContain("default-src 'none'");
      expect(emailDocument(clean, false, view, THEME)).toContain("font-src 'self'");
    }
  });

  it("mode lecture : couleurs du thème, colonne de lecture ; original : fond blanc", () => {
    const lecture = emailDocument("<p>Bonjour</p>", false, "lecture", THEME);
    expect(lecture).toContain('<div class="nl"><p>Bonjour</p></div>');
    expect(lecture).toContain("background:#141310!important");
    const original = emailDocument("<p>Bonjour</p>", false, "original", THEME);
    expect(original).not.toContain('class="nl"');
    expect(original).toContain("background:#fff");
  });

  it("une valeur de thème ne peut pas fermer la balise <style>", () => {
    const doc = emailDocument("<p>x</p>", false, "lecture", { ...THEME, bg: "red</style><script>alert(1)</script>" });
    expect(doc).not.toContain("<script>");
  });
});

describe("messages d'erreur de connexion", () => {
  it("explique le consentement administrateur", () => {
    expect(explainAuthError("access_denied", "AADSTS65001: The user or administrator has not consented")).toMatch(/administrateur/);
  });
  it("explique un mauvais type de compte", () => {
    expect(explainAuthError("invalid_request", "AADSTS50020: User account from identity provider does not exist")).toMatch(/type de compte/);
  });
});
