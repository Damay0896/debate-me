import type { Metadata } from "next";
import Link from "next/link";

import SitePageShell from "@/components/site-page-shell";
import { SAMPLE_TESTIMONIALS } from "@/lib/site-content";

const FAVORITE_BITS = [
  "Personality matchups that force different habits",
  "Reports that explain where the round actually swung",
  "A practice flow that feels more like sparring than chatting",
] as const;

export const metadata: Metadata = {
  title: "Testimonials | Counterpoint",
  description: "Testimonials and the kind of users Counterpoint was designed to serve.",
};

export default function TestimonialsPage() {
  return (
    <SitePageShell
      kicker="Testimonials"
      title="The kind of praise we want to earn from people who actually care about arguing better."
      description="These testimonials reflect the kinds of users Counterpoint was built for and the reasons the product clicks with people who care about arguing well."
      highlights={[
        { label: "Tone", value: "Discreet, sharp, and ambitious" },
        { label: "Most loved", value: "Specific reports and real pressure" },
        { label: "Built for", value: "People who want better reps fast" },
      ]}
      ctaHref="/"
      ctaLabel="Enter your room"
      secondaryCtaHref="/about"
      secondaryCtaLabel="See what the app is for"
    >
      <section className="theme-card rounded-[2rem] border p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Selected Praise</p>
            <h2 className="mt-3 text-3xl font-semibold">What the right users notice almost immediately</h2>
          </div>
          <span className="theme-pill inline-flex rounded-full border px-4 py-2 text-sm">
            Selected praise
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_TESTIMONIALS.map((item) => (
            <article key={`${item.name}-${item.role}`} className="theme-surface rounded-[1.6rem] border p-5">
              <p className="text-lg leading-8">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-5 text-sm font-semibold">{item.name}</p>
              <p className="theme-copy mt-1 text-sm">{item.role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr]">
        <div className="theme-panel rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">What People Notice</p>
          <h2 className="mt-3 text-3xl font-semibold">The favorite bits tend to be the same</h2>
          <div className="mt-6 space-y-3">
            {FAVORITE_BITS.map((item) => (
              <div key={item} className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-copy text-sm leading-7">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">What To Do Next</p>
          <h2 className="mt-3 text-3xl font-semibold">If the vibe clicks, go get a real report.</h2>
          <p className="theme-copy mt-5 text-sm leading-7">
            The best way to understand the product is still to use it. Pick a topic, take a few
            turns, and open the report. That is where the app usually stops feeling like a gimmick
            and starts feeling useful.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="theme-button-primary inline-flex rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Start debating
            </Link>
            <Link
              href="/how-it-works"
              className="theme-button-secondary inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
            >
              See the workflow
            </Link>
          </div>
        </div>
      </section>
    </SitePageShell>
  );
}
