import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="px-6 py-6">
      <div className="theme-muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5 text-sm">
        <span>Counterpoint</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link href="/about">About</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/why-we-built-this">Our story</Link>
        </nav>
      </div>
    </footer>
  );
}
