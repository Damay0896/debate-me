import type { Metadata } from "next";
import Link from "next/link";

import SitePageShell from "@/components/site-page-shell";
import { HOW_IT_WORKS_STEPS } from "@/lib/site-content";

const FLOW_SEGMENTS = [
  {
    title: "Before the round",
    body:
      "Pick the motion, choose a side, choose a personality, and decide how compact or long you want the clash to be.",
  },
  {
    title: "During the round",
    body:
      "Trade turns with an opponent that answers back, applies style pressure, and can surface quick live coaching if you enable it.",
  },
  {
    title: "After the round",
    body:
      "Open the report for verdicts, skill breakdowns, argument maps, pressure tests, fact-check review, and targeted next drills.",
  },
] as const;

export const metadata: Metadata = {
  title: "How It Works | Debate Me",
  description: "See how a Debate Me round is built, how the live debate works, and what feedback you get afterward.",
};

export default function HowItWorksPage() {
  return (
    <SitePageShell
      kicker="How It Works"
      title="A clean loop: build the matchup, survive the clash, learn exactly what to fix."
      description="The app is meant to be quick enough for frequent reps but deep enough that the report still teaches. You should be able to start a round fast, feel real resistance, and finish with a next-step that actually matters."
      highlights={[
        { label: "Setup time", value: "Usually under a minute" },
        { label: "Round feel", value: "Live, adversarial, and coachable" },
        { label: "Best habit", value: "Replay the same topic with one fix" },
      ]}
      ctaHref="/"
      ctaLabel="Build a matchup"
      secondaryCtaHref="/testimonials"
      secondaryCtaLabel="Read sample reactions"
    >
      <section className="theme-card rounded-[2rem] border p-6 md:p-8">
        <p className="theme-kicker text-xs uppercase tracking-[0.28em]">The Main Loop</p>
        <h2 className="mt-3 text-3xl font-semibold">What a strong practice session looks like</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((item, index) => (
            <article key={item.title} className="theme-surface rounded-[1.5rem] border p-5">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Step {index + 1}</p>
              <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
              <p className="theme-copy mt-3 text-sm leading-7">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="theme-panel rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Round Anatomy</p>
          <h2 className="mt-3 text-3xl font-semibold">Before, during, after</h2>
          <div className="mt-6 grid gap-4">
            {FLOW_SEGMENTS.map((item) => (
              <article key={item.title} className="theme-subcard rounded-[1.5rem] border p-5">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="theme-copy mt-3 text-sm leading-7">{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Best Practice Pattern</p>
          <h2 className="mt-3 text-3xl font-semibold">How to get the most out of it</h2>
          <div className="mt-6 space-y-4">
            {[
              "Start with a topic you can already argue so the weaknesses are structural, not just knowledge gaps.",
              "Run a compact round first, then replay it with one new fix rather than changing everything at once.",
              "Use the report to choose a single drill, like better weighing or better warrants, for the next rep.",
            ].map((item) => (
              <div key={item} className="theme-surface rounded-[1.35rem] border p-4">
                <p className="theme-copy text-sm leading-7">{item}</p>
              </div>
            ))}
          </div>

          <Link
            href="/why-we-built-this"
            className="theme-button-secondary mt-6 inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
          >
            Why we designed it this way
          </Link>
        </div>
      </section>
    </SitePageShell>
  );
}
