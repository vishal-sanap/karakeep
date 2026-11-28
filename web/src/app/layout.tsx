import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible_Next, Literata } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle, themeInitScript } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";

// Literata: a reading face (titles, summaries). Atkinson Hyperlegible Next: interface text.
const literata = Literata({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-literata", display: "swap" });
// Next has no fallback metrics for this newer family, so skip the size-adjusted fallback.
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "unfold",
  description: "Save what you find interesting. Find it again later.",
  appleWebApp: { capable: true, title: "unfold" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#14171b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${atkinson.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* Floating glass bar: content scrolls underneath, blurred. */}
        <header className="sticky top-3 z-40 mx-auto mt-3 w-full max-w-3xl px-3">
          <div className="flex items-center gap-2 rounded-2xl border border-rule/80 bg-paper/70 py-2 pl-3.5 pr-1.5 sm:gap-3 sm:pl-4 sm:pr-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150">
            <Link href="/" className="shrink-0 font-serif text-heading font-semibold tracking-tight">
              unfold
            </Link>
            <NavLinks />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8">{children}</main>
        <SiteFooter />
        <RegisterSW />
      </body>
    </html>
  );
}
