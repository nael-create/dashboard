"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { emailDocument, type EmailView } from "@/lib/email-document";

/** Couleurs et police du dashboard, lues sur la page (suivent le thème clair / sombre). */
function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  // Règles @font-face d'Inter Tight (fichiers servis par l'app elle-même) pour les reprendre dans le cadre.
  const fontFaces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule && /inter tight/i.test(rule.style.getPropertyValue("font-family"))) fontFaces.push(rule.cssText);
    }
  }
  return {
    bg: v("--bg", "#d6d1c5"),
    text: v("--text", "#111"),
    muted: v("--muted", "#4e4a42"),
    border: v("--border", "#b3ad9f"),
    accent: v("--accent-text", "#7a3417"),
    fontFaces: fontFaces.join("\n"),
  };
}

/** Cadre isolé dont la hauteur suit le contenu (pas de double barre de défilement). */
export function EmailFrame({ html, images, view, title }: { html: string; images: boolean; view: EmailView; title: string }) {
  const { resolvedTheme } = useTheme();
  const [doc, setDoc] = useState<string | null>(null);
  const [height, setHeight] = useState(480);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setDoc(emailDocument(html, images, view, readTheme()));
  }, [html, images, view, resolvedTheme]);

  const measure = useCallback(() => {
    const d = ref.current?.contentDocument;
    if (!d?.documentElement) return;
    setHeight(Math.max(200, Math.ceil(d.documentElement.scrollHeight)));
  }, []);

  const onLoad = useCallback(() => {
    const d = ref.current?.contentDocument;
    if (!d) return;
    measure();
    // Les images (si autorisées) et la police changent la hauteur après le chargement.
    d.querySelectorAll("img").forEach((img) => img.addEventListener("load", measure));
    d.fonts?.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    ro.observe(d.body);
    (ref.current as HTMLIFrameElement & { _ro?: ResizeObserver })._ro?.disconnect();
    (ref.current as HTMLIFrameElement & { _ro?: ResizeObserver })._ro = ro;
  }, [measure]);

  useEffect(() => {
    const el = ref.current as (HTMLIFrameElement & { _ro?: ResizeObserver }) | null;
    return () => el?._ro?.disconnect();
  }, []);

  if (!doc) return <div className="h-96 animate-pulse bg-surface-2" />;
  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={doc}
      onLoad={onLoad}
      // Pas de « allow-scripts » : aucun code de l'e-mail ne peut s'exécuter. « allow-same-origin » sert
      // uniquement à mesurer la hauteur du contenu et à réutiliser la police de l'app.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ height }}
      className={`block w-full ${view === "original" ? "bg-white" : "bg-transparent"}`}
    />
  );
}
