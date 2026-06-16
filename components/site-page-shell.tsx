import Link from "next/link";

type Highlight = {
  label: string;
  value: string;
};

type SitePageShellProps = {
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  description: string;
  highlights: Highlight[];
  kicker: string;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
  title: string;
};

export default function SitePageShell({
  children,
  ctaHref,
  ctaLabel,
  description,
  highlights,
  kicker,
  secondaryCtaHref,
  secondaryCtaLabel,
  title,
}: SitePageShellProps) {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="theme-card rounded-[2rem] border p-8 backdrop-blur md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="theme-kicker text-xs uppercase tracking-[0.32em]">{kicker}</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-balance md:text-6xl">
                {title}
              </h1>
              <p className="theme-copy mt-5 max-w-3xl text-lg leading-8">{description}</p>

              {ctaHref && ctaLabel ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={ctaHref}
                    className="theme-button-primary inline-flex rounded-full px-5 py-3 text-sm font-semibold transition"
                  >
                    {ctaLabel}
                  </Link>
                  {secondaryCtaHref && secondaryCtaLabel ? (
                    <Link
                      href={secondaryCtaHref}
                      className="theme-button-secondary inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
                    >
                      {secondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {highlights.map((item) => (
                <div key={item.label} className="theme-surface rounded-[1.6rem] border p-5">
                  <p className="theme-muted text-xs uppercase tracking-[0.24em]">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold leading-7">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </main>
  );
}
