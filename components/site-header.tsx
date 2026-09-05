import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

export default function SiteHeader() {
  return (
    <header className="app-topbar px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">Counterpoint<span className="text-[var(--accent)]">.</span></Link>
        <div className="flex items-center gap-5">
          <Link href="/" className="text-sm font-medium">Debate</Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
