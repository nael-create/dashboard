import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import config from "@config";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteHeader } from "@/components/nav";
import "@fontsource-variable/inter-tight";
import { Shortcuts } from "@/components/shortcuts";
import { QuickAddNotion } from "@/components/notions/quick-add";
import { SaveButton } from "@/components/save-button";
import { UpdateButton } from "@/components/update-button";
import { FavoritesProvider } from "@/components/favorites/favorites-context";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { SearchButton } from "@/components/search-button";
import { ZoomControl } from "@/components/zoom-control";
import { ZOOM_INIT_SCRIPT } from "@/lib/zoom";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: config.title, template: `%s · ${config.title}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d6d1c5" },
    { media: "(prefers-color-scheme: dark)", color: "#141310" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce de la CSP (pages de lecture des newsletters) : le petit script du thème doit le porter.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" suppressHydrationWarning style={{ "--accent": config.accentColor } as CSSProperties}>
      <head>
        {/* Zoom mémorisé, appliqué avant l'affichage (voir src/lib/zoom.ts). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ZOOM_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <ThemeProvider nonce={nonce}>
          <FavoritesProvider>
          <SiteHeader
            title={config.title}
            actions={
              <>
                <UpdateButton />
                <SaveButton />
                <SearchButton />
                <QuickAddNotion />
                <span className="hidden lg:block"><ThemeToggle /></span>
              </>
            }
            mobileExtras={<><ThemeToggle /><span className="label text-muted">Thème</span><ZoomControl className="label ml-auto" /></>}
            zoom={<ZoomControl className="-ml-1.5 mt-1" />}
          />
          {/* Conteneur zoomable : le contenu seulement (l'en-tête et les fenêtres flottantes restent à leur taille). */}
          <div id="zoom-root" style={{ zoom: "var(--zoom, var(--zoom-default, 1))" } as CSSProperties}>
            <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6 sm:pt-14 print:max-w-none print:p-0">{children}</main>
          </div>
          <Shortcuts />
          <CommandPalette />
          <ShortcutsHelp />
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
