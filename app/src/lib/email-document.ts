/**
 * Document HTML affiché dans le cadre isolé de lecture d'une newsletter (fonction pure, testée).
 */

export type EmailView = "lecture" | "original";

/** Couleurs du dashboard et règles @font-face de sa police (lues sur la page côté navigateur). */
export interface EmailTheme {
  bg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  fontFaces: string;
}

const FONT = `"Inter Tight Variable", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`;

/**
 * Document affiché dans le cadre isolé.
 * - « lecture » : la newsletter reprend la typographie et les couleurs du dashboard (colonne de lecture,
 *   fonds et couleurs imposés de l'e-mail neutralisés, images conservées).
 * - « original » : la mise en page de l'expéditeur, sur fond blanc.
 * Dans les deux cas : aucun script (sandbox sans allow-scripts), chargements externes bloqués par la CSP
 * (images seulement si l'utilisateur les autorise), polices uniquement depuis l'app.
 */
export function emailDocument(html: string, images: boolean, view: EmailView, t: EmailTheme) {
  const safe = (x: string) => x.replace(/[<>]/g, "");
  t = { bg: safe(t.bg), text: safe(t.text), muted: safe(t.muted), border: safe(t.border), accent: safe(t.accent), fontFaces: safe(t.fontFaces) };
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src data:${images ? " https: http:" : ""}`,
    "font-src 'self'",
    "form-action 'none'",
  ].join("; ");
  const base = `img{max-width:100%!important;height:auto!important}html,body{margin:0}body{overflow:hidden;word-wrap:break-word;-webkit-font-smoothing:antialiased}`;
  const reader = `
${t.fontFaces}
html,body{background:${t.bg}!important}
body{padding:4px 0 24px;color:${t.text};font:350 17px/1.65 ${FONT};letter-spacing:-0.005em}
.nl{max-width:680px}
.nl *{background-color:transparent!important;background-image:none!important;color:inherit!important;font-family:inherit!important;
  border-color:${t.border}!important;box-shadow:none!important;text-shadow:none!important;position:static!important;
  max-width:100%!important;min-width:0!important;letter-spacing:inherit!important;text-align:left!important}
.nl table{width:100%!important;border-collapse:collapse}
.nl td,.nl th{padding-left:0!important;padding-right:0!important;height:auto!important}
.nl p,.nl td,.nl th,.nl li,.nl div,.nl span,.nl font{font-size:inherit!important;line-height:inherit!important}
.nl p{margin:0 0 1em!important}
.nl h1,.nl h2,.nl h3,.nl h4{font-weight:400!important;letter-spacing:-0.025em!important;line-height:1.15!important;margin:1.6em 0 .5em!important;text-align:left!important}
.nl h1{font-size:2rem!important}.nl h2{font-size:1.6rem!important}.nl h3{font-size:1.3rem!important}.nl h4{font-size:1.1rem!important}
.nl strong,.nl b{font-weight:600!important}
.nl a{padding:0!important;border:0!important;color:${t.accent}!important;text-decoration:underline!important;text-decoration-thickness:1px!important;text-underline-offset:3px!important}
.nl hr{border:0!important;border-top:1px solid ${t.border}!important;margin:2em 0!important}
.nl blockquote{border-left:1px solid ${t.text}!important;margin:1em 0!important;padding-left:1em!important;color:${t.muted}!important}
.nl img{display:inline-block}${images ? "" : ".nl img:not([src^=\"data:\"]){display:none!important}"}
.nl small{font-size:14px!important;color:${t.muted}!important}
::selection{background:${t.text};color:${t.bg}}`;
  const original = `html,body{background:#fff}body{padding:16px;font-family:-apple-system,system-ui,sans-serif;color:#15181e}`;
  const content = view === "lecture" ? `<div class="nl">${html}</div>` : html;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${base}${view === "lecture" ? reader : original}</style></head><body>${content}</body></html>`;
}
