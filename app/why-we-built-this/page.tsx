import type { Metadata } from "next";
import Link from "next/link";

import SitePageShell from "@/components/site-page-shell";
import { ORIGIN_NOTES } from "@/lib/site-content";

const FRUSTRATIONS = [
  "Practice tools that reward confidence even when the warrant is mush.",
  "Feedback that says almost nothing beyond good job or be more clear.",
  "Practice partners that nod along instead of forcing real clash.",
] as const;

const DESIGN_BETS = [
  "Pressure should be immediate, but the coaching should stay useful and specific.",
  "A great report should make you want another round, not make you feel graded and done.",
  "Different personalities should force different habits so the practice does not get stale.",
] as const;

export const metadata: Metadata = {
  title: "Why We Built This | Counterpoint",
  description: "The product philosophy behind Counterpoint and the frustrations it was designed to fix.",
};

export default function WhyWeBuiltThisPage() {
  return (
    <SitePageShell
      kicker="Why We Built This"
      title="Because too many argument tools are either lifeless, flattering, or both."
      description="We wanted something that actually pressures your reasoning and then tells you, in plain English, what swung the round. The goal was never another generic tool. The goal was a private practice loop that makes your next attempt measurably stronger."
      highlights={[
        { label: "Built against", value: "Polite but useless feedback" },
        { label: "Built for", value: "Rooms that feel serious" },
        { label: "North star", value: "Clear fixes after real clash" },
      ]}
      ctaHref="/"
      ctaLabel="Enter Counterpoint"
      secondaryCtaHref="/about"
      secondaryCtaLabel="Read about the app"
    >
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="theme-panel rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">The Problem</p>
          <h2 className="mt-3 text-3xl font-semibold">What we were tired of</h2>
          <div className="mt-6 space-y-3">
            {FRUSTRATIONS.map((item) => (
              <div key={item} className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-copy text-sm leading-7">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">The Build Philosophy</p>
          <h2 className="mt-3 text-3xl font-semibold">What we wanted instead</h2>
          <div className="mt-6 grid gap-4">
            {ORIGIN_NOTES.map((item) => (
              <article key={item.title} className="theme-surface rounded-[1.5rem] border p-5">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="theme-copy mt-3 text-sm leading-7">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="theme-card rounded-[2rem] border p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Three Bets</p>
            <h2 className="mt-3 text-3xl font-semibold">Principles we keep building around</h2>
          </div>
          <Link
            href="/testimonials"
            className="theme-button-secondary inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
          >
            See selected praise
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {DESIGN_BETS.map((item, index) => (
            <article key={item} className="theme-surface rounded-[1.5rem] border p-5">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Bet {index + 1}</p>
              <p className="mt-3 text-sm leading-7">{item}</p>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}
