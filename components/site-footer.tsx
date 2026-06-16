import Link from "next/link";

import { SAMPLE_TESTIMONIALS, SITE_FOOTER_LINKS } from "@/lib/site-content";

export default function SiteFooter() {
  return (
    <footer className="site-footer px-6 pb-8 pt-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="theme-kicker text-xs uppercase tracking-[0.32em]">
                Private Circle
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Built for people who care about sharper reasoning, cleaner rebuttals, and room control.
              </h2>
              <p className="theme-copy mt-4 max-w-2xl text-sm leading-7">
                Counterpoint is a private debate room, a pressure-tested coaching desk, and a premium
                archive of your best and worst rounds. The point is simple: make the next room more
                winnable than the last one.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/testimonials"
                  className="theme-button-primary inline-flex rounded-full px-5 py-3 text-sm font-semibold transition"
                >
                  Read the praise
                </Link>
                <Link
                  href="/why-we-built-this"
                  className="theme-button-secondary inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
                >
                  Read the origin story
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="theme-surface rounded-[1.5rem] border p-5">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Selected praise
                </p>
                <p className="theme-strong mt-3 text-sm leading-6">
                  &ldquo;{SAMPLE_TESTIMONIALS[0]?.quote}&rdquo;
                </p>
                <p className="theme-copy mt-3 text-sm">
                  {SAMPLE_TESTIMONIALS[0]?.name}, {SAMPLE_TESTIMONIALS[0]?.role}
                </p>
              </div>

              <div className="theme-surface rounded-[1.5rem] border p-5">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Explore
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {SITE_FOOTER_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="theme-subcard rounded-[1.15rem] border px-4 py-3 text-sm font-medium transition hover:translate-y-[-1px]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
