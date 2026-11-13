import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import config from "@config";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteHeader } from "@/components/nav";
import "@fontsource-variable/inter-tight";
import { Shortcuts } from "@/components/shortcuts";
import { QuickAddNotion } from "@/components/notions/quick-add";
import { SaveButton } from "@/components/save-button";
import { FavoritesProvider } from "@/components/favorites/favorites-context";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { SearchButton } from "@/components/search-button";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning style={{ "--accent": config.accentColor } as CSSProperties}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          <FavoritesProvider>
          <SiteHeader
            title={config.title}
            actions={
              <>
                <SaveButton />
                <SearchButton />
                <QuickAddNotion />
                <span className="hidden lg:block"><ThemeToggle /></span>
              </>
            }
            mobileExtras={<><ThemeToggle /><span className="label text-muted">Thème</span></>}
          />
          <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6 sm:pt-14 print:max-w-none print:p-0">{children}</main>
          <Shortcuts />
          <CommandPalette />
          <ShortcutsHelp />
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
