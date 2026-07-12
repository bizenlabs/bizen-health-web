import type { Metadata } from "next";
import Link from "next/link";
import { displayFont } from "./fonts";

export const metadata: Metadata = {
  title: "Bizen Health — dictate the note, done with the paperwork",
  description:
    "AI dictation and patient records for Indian clinics. Speak in your own words and get a structured clinical note, prescription, and letterhead printout.",
};

/* The marketing pages are deliberately light regardless of the app theme:
   the palette below is the design, not a themeable surface. */
const tokens = {
  "--m-paper": "#FCFBF8",
  "--m-panel": "#F1F5F1",
  "--m-ink": "#152622",
  "--m-muted": "#51625B",
  "--m-line": "#E3E8E3",
  "--m-green": "#0B6B54",
  "--m-green-dark": "#095844",
} as React.CSSProperties;

const navLinks = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#clinics", label: "For clinics" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={tokens}
      className={`${displayFont.variable} flex min-h-full flex-1 flex-col bg-[var(--m-paper)] text-[var(--m-ink)]`}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--m-line)] bg-[var(--m-paper)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="[font-family:var(--font-display)] text-lg font-semibold tracking-tight whitespace-nowrap"
          >
            Bizen Health
          </Link>
          <nav className="hidden items-center gap-8 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium whitespace-nowrap text-[var(--m-muted)] transition-colors hover:text-[var(--m-ink)]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-full bg-[var(--m-green)] px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-[var(--m-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-green)]"
            >
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Create free account</span>
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-[var(--m-line)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <p className="text-sm text-[var(--m-muted)]">
            © {new Date().getFullYear()} Bizen Health
          </p>
          <div className="flex items-center gap-6 text-sm text-[var(--m-muted)]">
            <Link href="/sign-in" className="hover:text-[var(--m-ink)]">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-[var(--m-ink)]">
              Create free account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
