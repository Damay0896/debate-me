import type { Metadata } from "next";
import Link from "next/link";

import SitePageShell from "@/components/site-page-shell";
import { ABOUT_FAQS } from "@/lib/site-content";

const TRAINING_AREAS = [
  {
    title: "Live rebuttal instincts",
    body:
      "You are not just drafting a polished paragraph. You are learning how to answer pressure when the other side actually pushes back.",
  },
  {
    title: "Cleaner argument structure",
    body:
      "The app rewards claim, warrant, impact discipline so you stop relying on vibes and start landing reasoning people can follow.",
  },
  {
    title: "Useful post-round coaching",
    body:
      "Reports focus on what changed the round, which argument carried, which response failed, and what fix is worth drilling next.",
  },
] as const;

const AUDIENCE_TYPES = [
  "Students doing debate, civics, or mock trial",
  "Founders and operators sharpening persuasion",
  "Interview preppers who need stronger verbal reasoning",
  "Writers and creators stress-testing controversial takes",
] as const;

export const metadata: Metadata = {
  title: "About | Counterpoint",
  description: "What Counterpoint is, who it is for, and why it is designed as a private premium debate room.",
};

export default function AboutPage() {
  return (
    <SitePageShell
      kicker="About Counterpoint"
      title="A private room for people who want sharper arguments, not softer praise."
      description="Counterpoint is built to make your reasoning cleaner under pressure. It combines hard sparring, premium coaching, and post-round film review for people who improve by taking serious reps."
      highlights={[
        { label: "Best for", value: "Private reps with real resistance" },
        { label: "Training target", value: "Logic, rebuttal, weighing, clarity" },
        { label: "End goal", value: "Cleaner wins and stronger judgment" },
      ]}
      ctaHref="/"
      ctaLabel="Enter Counterpoint"
      secondaryCtaHref="/how-it-works"
      secondaryCtaLabel="See how it works"
    >
      <section className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="theme-card rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">What It Trains</p>
          <h2 className="mt-3 text-3xl font-semibold">The point is not to sound smart. The point is to argue well.</h2>
          <div className="mt-6 grid gap-4">
            {TRAINING_AREAS.map((item) => (
              <article key={item.title} className="theme-surface rounded-[1.5rem] border p-5">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="theme-copy mt-3 text-sm leading-7">{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="theme-panel rounded-[2rem] border p-6 md:p-8">
          <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Who Uses It</p>
          <h2 className="mt-3 text-3xl font-semibold">Not just for formal debate kids.</h2>
          <div className="mt-6 space-y-3">
            {AUDIENCE_TYPES.map((item) => (
              <div key={item} className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-copy text-sm leading-7">{item}</p>
              </div>
            ))}
          </div>

          <div className="theme-surface mt-6 rounded-[1.6rem] border p-5">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">What makes it different</p>
            <p className="theme-copy mt-3 text-sm leading-7">
              A lot of tools either flatter the user or drown them in theory. Counterpoint sits
              in the useful middle: real friction during the round, then specific coaching
              after the round.
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-[2rem] border p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="theme-kicker text-xs uppercase tracking-[0.28em]">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold">A few sensible questions</h2>
          </div>
          <Link
            href="/why-we-built-this"
            className="theme-button-secondary inline-flex rounded-full border px-5 py-3 text-sm font-medium transition"
          >
            Read the origin story
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {ABOUT_FAQS.map((item) => (
            <article key={item.question} className="theme-surface rounded-[1.5rem] border p-5">
              <h3 className="text-lg font-semibold">{item.question}</h3>
              <p className="theme-copy mt-3 text-sm leading-7">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}
