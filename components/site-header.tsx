"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/theme-toggle";
import { SITE_NAV_LINKS } from "@/lib/site-content";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <div className="app-topbar relative z-40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="theme-card inline-flex items-center gap-3 rounded-full border px-4 py-3 backdrop-blur-xl transition"
          >
            <span className="theme-accent-chip flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold">
              DM
            </span>
            <span className="flex flex-col leading-none">
              <span className="theme-muted text-[11px] uppercase tracking-[0.28em]">
                Debate Me
              </span>
              <span className="mt-1 text-sm font-semibold">
                Train your argument live
              </span>
            </span>
          </Link>

          <nav className="theme-card flex flex-wrap items-center gap-2 rounded-full border px-2 py-2 backdrop-blur-xl">
            {SITE_NAV_LINKS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive ? "theme-option-active" : "theme-button-secondary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="theme-button-primary inline-flex rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            Start a round
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
