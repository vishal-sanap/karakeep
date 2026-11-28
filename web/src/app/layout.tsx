import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible_Next, Literata } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";
import { NavLinks } from "@/components/nav-links";

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
    <html lang="en" className={`${literata.variable} ${atkinson.variable}`}>
      <body className="min-h-dvh">
        <header className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-4 pt-6 pb-5">
          <Link href="/" className="font-serif text-heading font-semibold tracking-tight">
            unfold
          </Link>
          <NavLinks />
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-20">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
