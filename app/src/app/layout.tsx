import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import config from "@config";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, TopNav } from "@/components/nav";
import { Shortcuts } from "@/components/shortcuts";
import { QuickAddNotion } from "@/components/notions/quick-add";
import { SaveButton } from "@/components/save-button";
import { FavoritesProvider } from "@/components/favorites/favorites-context";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: config.title, template: `%s · ${config.title}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning style={{ "--accent": config.accentColor } as CSSProperties}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          <FavoritesProvider>
          <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur print:hidden">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="size-2.5 rounded-full bg-accent" aria-hidden />
                {config.title}
              </Link>
              <div className="flex items-center gap-1">
                <TopNav />
                <SaveButton />
                <QuickAddNotion />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-16 print:max-w-none print:p-0">{children}</main>
          <BottomNav />
          <Shortcuts />
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
