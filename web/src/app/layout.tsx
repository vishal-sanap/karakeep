import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";

export const metadata: Metadata = {
  title: "unfold",
  description: "Save what you find interesting. Find it again later.",
  appleWebApp: { capable: true, title: "unfold" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">unfold</Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-500 sm:gap-x-4">
            <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-100">Library</Link>
            <Link href="/threads" className="hover:text-stone-900 dark:hover:text-stone-100">Threads</Link>
            <Link href="/rediscover" className="hover:text-stone-900 dark:hover:text-stone-100">Rediscover</Link>
            <Link href="/tiles" className="hover:text-stone-900 dark:hover:text-stone-100">Tiles</Link>
            <Link href="/settings" className="hover:text-stone-900 dark:hover:text-stone-100">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-16">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
