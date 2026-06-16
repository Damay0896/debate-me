"use client";

import { useEffect, useState, type ReactNode } from "react";

import { EvidenceDeck } from "@/components/evidence-deck";
import type {
  ArgumentFrame,
  ArgumentMap,
  CollapsePoint,
  DebateAnalysis,
  DebateMetric,
  DebateSession,
  FallacyFlag,
  MissedOpportunity,
  MomentumBeat,
  OpponentCaseReview,
  TranscriptReceipt,
} from "@/lib/debate";
import {
  buildResearchSummary,
  factCheckStatusMeta,
  type EvidenceCard,
  type EvidenceResult,
} from "@/lib/research";

import { buildReportInsights } from "./report-insights";

const metricGlow: Record<DebateMetric["key"], string> = {
  logic: "from-sky-300 via-cyan-300 to-teal-200",
  evidence: "from-emerald-300 via-lime-300 to-amber-200",
  rebuttal: "from-rose-300 via-orange-300 to-amber-200",
  persuasion: "from-fuchsia-300 via-rose-300 to-orange-200",
  weighing: "from-amber-300 via-orange-300 to-rose-300",
  clarity: "from-violet-300 via-indigo-300 to-sky-200",
  discipline: "from-slate-300 via-zinc-300 to-stone-200",
};

const frameStatusStyles: Record<ArgumentFrame["status"], string> = {
  anchor: "theme-status-anchor",
  developing: "theme-status-developing",
  "collapse-risk": "theme-status-collapse",
};

const fallacySeverityStyles: Record<FallacyFlag["severity"], string> = {
  low: "theme-flag-low",
  medium: "theme-flag-medium",
  high: "theme-flag-high",
};

const collapseSeverityStyles: Record<CollapsePoint["severity"], string> = {
  medium: "theme-flag-medium",
  high: "theme-flag-high",
};

const toneStyles = {
  accent: "theme-status-anchor",
  neutral: "theme-status-developing",
  warning: "theme-status-collapse",
} as const;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function describeMetricTier(score: number) {
  if (score >= 78) {
    return "Elite";
  }

  if (score >= 66) {
    return "Strong";
  }

  if (score >= 52) {
    return "Live";
  }

  if (score >= 38) {
    return "Fragile";
  }

  return "Critical";
}

function Panel({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="theme-card report-panel-shell report-rise scroll-mt-28 self-start rounded-[2rem] border p-6 shadow-xl backdrop-blur"
    >
      <p className="theme-muted text-xs uppercase tracking-[0.32em]">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="theme-strong max-w-2xl text-2xl font-semibold text-balance">
          {title}
        </h2>
        <p className="theme-muted max-w-xl text-sm leading-6">{description}</p>
      </div>
      <div className="report-section-rule mt-5" />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SkillBreakdown({ metrics }: { metrics: DebateMetric[] }) {
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimateBars(true), 40);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      {metrics.map((metric, index) => (
        <article
          key={metric.key}
          className="theme-surface rounded-[1.7rem] border p-4"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                  {metric.label}
                </p>
                <span className="report-tier-chip rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em]">
                  {describeMetricTier(metric.score)}
                </span>
              </div>
              <p className="theme-copy mt-2 text-sm leading-6">{metric.note}</p>
            </div>
            <div className="text-right">
              <p className="theme-strong text-3xl font-semibold">{metric.score}</p>
              <p className="theme-muted mt-1 text-xs uppercase tracking-[0.18em]">
                out of 100
              </p>
            </div>
          </div>

          <div className="report-meter-track mt-5 h-3 overflow-hidden rounded-full">
            <div
              className={cx(
                "report-meter-fill h-full origin-left rounded-full bg-gradient-to-r transition-[width,transform] duration-700 ease-out",
                metricGlow[metric.key],
              )}
              style={{
                width: animateBars ? `${metric.score}%` : "0%",
                boxShadow: "0 0 22px rgba(244, 201, 93, 0.16)",
              }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function MomentumPanel({ momentum }: { momentum: MomentumBeat[] }) {
  return (
    <div className="grid gap-3 2xl:grid-cols-2">
      {momentum.map((beat, index) => (
        <article
          key={`${beat.label}-${index}`}
          className="theme-surface rounded-[1.5rem] border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="theme-accent-chip flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold">
                {index + 1}
              </div>
              <div>
                <p className="theme-strong text-base font-semibold">{beat.label}</p>
                <p className="theme-muted text-xs uppercase tracking-[0.18em]">
                  Round temperature
                </p>
              </div>
            </div>
            <p className="theme-strong text-2xl font-semibold">{beat.score}</p>
          </div>

          <div className="report-meter-track mt-4 h-2 overflow-hidden rounded-full">
            <div
              className="report-meter-fill h-full rounded-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent-strong)] to-white/75"
              style={{ width: `${beat.score}%` }}
            />
          </div>

          <p className="theme-copy mt-3 text-sm leading-6">{beat.note}</p>
        </article>
      ))}
    </div>
  );
}

function CoachFeedback({
  strengths,
  weaknesses,
  nextSteps,
}: Pick<DebateAnalysis, "strengths" | "weaknesses" | "nextSteps">) {
  return (
    <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <article className="theme-surface rounded-[1.55rem] border p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Keep doing this
          </p>
          <ul className="mt-4 space-y-3">
            {strengths.map((item) => (
              <li key={item} className="report-list-item">
                <span className="report-list-dot bg-emerald-400/80" />
                <span className="theme-copy text-sm leading-6">{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="theme-surface rounded-[1.55rem] border p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Still leaking here
          </p>
          <ul className="mt-4 space-y-3">
            {weaknesses.map((item) => (
              <li key={item} className="report-list-item">
                <span className="report-list-dot bg-amber-400/80" />
                <span className="theme-copy text-sm leading-6">{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="theme-surface rounded-[1.7rem] border p-5">
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">
          Coach feedback
        </p>
        <h3 className="mt-3 text-xl font-semibold">
          What to fix in the very next round
        </h3>
        <div className="mt-5 space-y-3">
          {nextSteps.map((item, index) => (
            <div key={item} className="theme-subcard rounded-[1.3rem] border p-4">
              <div className="flex items-center gap-3">
                <div className="theme-accent-chip flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">
                  {index + 1}
                </div>
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Move {index + 1}
                </p>
              </div>
              <p className="theme-strong mt-3 text-sm leading-6">{item}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function BestNextImprovementCard({ analysis }: { analysis: DebateAnalysis }) {
  const { bestNextImprovement } = analysis;

  return (
    <article className="theme-surface report-feature-card rounded-[1.75rem] border p-5">
      <p className="theme-muted text-xs uppercase tracking-[0.24em]">
        Highest-value fix
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="theme-accent-chip rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          {bestNextImprovement.skill}
        </span>
        <h3 className="text-2xl font-semibold">{bestNextImprovement.title}</h3>
      </div>
      <p className="theme-copy mt-4 text-base leading-7">
        {bestNextImprovement.reason}
      </p>
      <div className="theme-subcard mt-5 rounded-[1.35rem] border p-4">
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">
          Drill for the replay
        </p>
        <p className="theme-strong mt-2 text-sm leading-6">
          {bestNextImprovement.drill}
        </p>
      </div>
    </article>
  );
}

function DebatePatternRadar({
  patternStats,
}: {
  patternStats: ReturnType<typeof buildReportInsights>["patternStats"];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {patternStats.map((stat) => (
        <article
          key={stat.label}
          className="theme-surface rounded-[1.45rem] border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              {stat.label}
            </p>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                toneStyles[stat.tone],
              )}
            >
              {stat.value}
            </span>
          </div>
          <p className="theme-copy mt-3 text-sm leading-6">{stat.note}</p>
        </article>
      ))}
    </div>
  );
}

function DebateProfilePanel({
  analysis,
  profileSignals,
}: {
  analysis: DebateAnalysis;
  profileSignals: ReturnType<typeof buildReportInsights>["profileSignals"];
}) {
  return (
    <div className="grid gap-4">
      <BestNextImprovementCard analysis={analysis} />

      <div className="grid gap-3 md:grid-cols-2">
        {profileSignals.map((signal) => (
          <article
            key={signal.label}
            className="theme-surface rounded-[1.45rem] border p-4"
          >
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              {signal.label}
            </p>
            <p className="theme-strong mt-3 text-lg font-semibold">
              {signal.value}
            </p>
            <p className="theme-copy mt-2 text-sm leading-6">{signal.note}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function QuoteWorkshop({
  quoteInsights,
}: {
  quoteInsights: ReturnType<typeof buildReportInsights>["quoteInsights"];
}) {
  return (
    <div className="grid gap-4">
      {quoteInsights.map((item) => (
        <article
          key={item.label}
          className="theme-surface report-feature-card rounded-[1.6rem] border p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                {item.label}
              </p>
              <p className="theme-strong mt-2 text-sm font-semibold uppercase tracking-[0.18em]">
                {item.speaker}
              </p>
            </div>
            <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em]">
              Quote lab
            </span>
          </div>

          <blockquote className="report-quote mt-4 rounded-[1.45rem] border px-4 py-4 text-base leading-7 break-words">
            {item.quote}
          </blockquote>

          <p className="theme-copy mt-4 text-sm leading-6">{item.note}</p>
        </article>
      ))}
    </div>
  );
}

function JudgeBallotPanel({
  ballotCallouts,
}: {
  ballotCallouts: ReturnType<typeof buildReportInsights>["ballotCallouts"];
}) {
  return (
    <div className="grid gap-3">
      {ballotCallouts.map((item) => (
        <article
          key={item.label}
          className="theme-surface rounded-[1.45rem] border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              {item.label}
            </p>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                toneStyles[item.tone],
              )}
            >
              Coach call
            </span>
          </div>
          <p className="theme-strong mt-3 text-sm leading-6">{item.value}</p>
        </article>
      ))}
    </div>
  );
}

function ReplayBlueprintPanel({
  replaySteps,
}: {
  replaySteps: ReturnType<typeof buildReportInsights>["replaySteps"];
}) {
  return (
    <div className="grid gap-3">
      {replaySteps.map((step, index) => (
        <article
          key={step.label}
          className="theme-surface rounded-[1.5rem] border p-5"
        >
          <div className="flex items-center gap-3">
            <div className="theme-accent-chip flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold">
              {index + 1}
            </div>
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                {step.label}
              </p>
              <p className="theme-strong mt-1 text-lg font-semibold">
                {step.line}
              </p>
            </div>
          </div>
          <p className="theme-copy mt-4 text-sm leading-6">{step.note}</p>
        </article>
      ))}
    </div>
  );
}

function CrossfireDrillPanel({
  drillQuestions,
}: {
  drillQuestions: ReturnType<typeof buildReportInsights>["drillQuestions"];
}) {
  return (
    <div className="grid gap-4">
      {drillQuestions.map((item) => (
        <article
          key={item.title}
          className="theme-surface rounded-[1.55rem] border p-5"
        >
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            {item.title}
          </p>
          <p className="theme-strong mt-3 text-base leading-7">{item.prompt}</p>
          <div className="theme-subcard mt-4 rounded-[1.2rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              Best answer you want ready
            </p>
            <p className="theme-copy mt-2 text-sm leading-6">{item.answer}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function CaseRepairPanel({
  caseRepairs,
  weakestMetricLabel,
}: {
  caseRepairs: ReturnType<typeof buildReportInsights>["caseRepairs"];
  weakestMetricLabel: string | null;
}) {
  return (
    <div className="grid gap-4">
      {caseRepairs.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                {item.title}
              </p>
              <p className="theme-strong mt-2 text-lg font-semibold">
                Structural weakness
              </p>
            </div>
            {weakestMetricLabel ? (
              <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em]">
                Protect {weakestMetricLabel}
              </span>
            ) : null}
          </div>

          <p className="theme-copy mt-4 text-sm leading-6">{item.weakness}</p>

          <div className="theme-subcard mt-4 rounded-[1.2rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              Best repair
            </p>
            <p className="theme-strong mt-2 text-sm leading-6">{item.fix}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function JudgeSimulationPanel({
  judgePerspectives,
}: {
  judgePerspectives: ReturnType<typeof buildReportInsights>["judgePerspectives"];
}) {
  return (
    <div className="grid gap-4">
      {judgePerspectives.map((judge) => (
        <article
          key={judge.label}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                {judge.label}
              </p>
              <p className="theme-strong mt-2 text-lg font-semibold">
                {judge.verdict}
              </p>
            </div>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                toneStyles[judge.tone],
              )}
            >
              Judge sim
            </span>
          </div>

          <p className="theme-copy mt-4 text-sm leading-6">{judge.note}</p>

          <div className="theme-subcard mt-4 rounded-[1.2rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              How to win this ballot
            </p>
            <p className="theme-strong mt-2 text-sm leading-6">{judge.nextMove}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function RematchScriptPanel({
  rematchScript,
}: {
  rematchScript: ReturnType<typeof buildReportInsights>["rematchScript"];
}) {
  return (
    <div className="grid gap-4">
      {rematchScript.map((step, index) => (
        <article
          key={step.label}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <div className="flex items-start gap-3">
            <div className="theme-accent-chip flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold">
              {index + 1}
            </div>
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                {step.label}
              </p>
              <p className="theme-strong mt-2 text-lg font-semibold">
                {step.line}
              </p>
            </div>
          </div>
          <p className="theme-copy mt-4 text-sm leading-6">{step.note}</p>
        </article>
      ))}
    </div>
  );
}

function CounterplayLabPanel({
  counterplayMoves,
}: {
  counterplayMoves: ReturnType<typeof buildReportInsights>["counterplayMoves"];
}) {
  return (
    <div className="grid gap-4">
      {counterplayMoves.map((move) => (
        <article
          key={`${move.title}-${move.trigger}`}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            {move.title}
          </p>
          <div className="theme-subcard mt-4 rounded-[1.2rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              Likely trigger
            </p>
            <p className="theme-strong mt-2 text-sm leading-6">{move.trigger}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Why it lands
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{move.why}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Best answer
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">{move.answer}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EvidenceUpgradePanel({
  evidenceUpgrades,
}: {
  evidenceUpgrades: ReturnType<typeof buildReportInsights>["evidenceUpgrades"];
}) {
  return (
    <div className="grid gap-4">
      {evidenceUpgrades.map((item) => (
        <article
          key={`${item.title}-${item.claim}`}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            {item.title}
          </p>
          <p className="theme-strong mt-3 text-base leading-7">{item.claim}</p>
          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Proof needed
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{item.proofNeed}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Best source angle
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">{item.sourceAngle}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LanguageTuningPanel({
  languageTweaks,
}: {
  languageTweaks: ReturnType<typeof buildReportInsights>["languageTweaks"];
}) {
  return (
    <div className="grid gap-4">
      {languageTweaks.map((item) => (
        <article
          key={item.label}
          className="theme-surface rounded-[1.6rem] border p-5"
        >
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            {item.label}
          </p>
          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Use this line shape
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">{item.useLine}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Avoid this move
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{item.avoidLine}</p>
            </div>
          </div>
          <p className="theme-copy mt-4 text-sm leading-6">{item.reason}</p>
        </article>
      ))}
    </div>
  );
}

function MapNodeCard({
  label,
  eyebrow,
  weight,
  tone,
}: {
  label: string;
  eyebrow: string;
  weight: number;
  tone:
    | "premise"
    | "claim"
    | "impact"
    | "counter"
    | "assumption";
}) {
  const toneStyles = {
    premise:
      "border-[color:var(--map-premise-stroke)] bg-[color:var(--map-premise-fill)]",
    claim:
      "border-[color:var(--map-claim-stroke)] bg-[color:var(--map-claim-fill)]",
    impact:
      "border-[color:var(--map-impact-stroke)] bg-[color:var(--map-impact-fill)]",
    counter:
      "border-[color:var(--map-counter-stroke)] bg-[color:var(--map-counter-fill)]",
    assumption:
      "border-[color:var(--map-assumption-stroke)] bg-[color:var(--map-assumption-fill)]",
  } as const;

  return (
    <article className={cx("rounded-[1.35rem] border p-4", toneStyles[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--diagram-muted)]">
          {eyebrow}
        </p>
        <span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--diagram-label)]">
          {weight}
        </span>
      </div>
      <p className="mt-3 break-words text-sm font-medium leading-6 text-[var(--diagram-label)]">
        {label}
      </p>
    </article>
  );
}

function MapStage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="theme-subcard report-map-stage rounded-[1.55rem] border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="theme-muted text-xs uppercase tracking-[0.22em]">{eyebrow}</p>
          <p className="theme-strong mt-2 text-lg font-semibold">{title}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function ArgumentMapDiagram({ argumentMap }: { argumentMap: ArgumentMap }) {
  const premiseNodes = argumentMap.nodes
    .filter((node) => node.kind === "premise")
    .sort((left, right) => left.row - right.row);
  const assumptionNodes = argumentMap.nodes
    .filter((node) => node.kind === "assumption")
    .sort((left, right) => left.row - right.row);
  const claimNode =
    argumentMap.nodes.find((node) => node.kind === "claim") ?? argumentMap.nodes[0];
  const impactNodes = argumentMap.nodes
    .filter((node) => node.kind === "impact")
    .sort((left, right) => left.row - right.row);
  const counterNodes = argumentMap.nodes
    .filter((node) => node.kind === "counter")
    .sort((left, right) => left.row - right.row);

  return (
    <div className="theme-surface report-diagram-shell rounded-[1.7rem] border p-5">
      <div className="report-map-flow">
        <MapStage eyebrow="Step 1" title="Premises and assumptions">
          <>
            {premiseNodes.map((node) => (
              <MapNodeCard
                key={node.id}
                label={node.label}
                eyebrow="Premise"
                weight={node.weight}
                tone="premise"
              />
            ))}
            {assumptionNodes.map((node) => (
              <MapNodeCard
                key={node.id}
                label={node.label}
                eyebrow="Unsupported assumption"
                weight={node.weight}
                tone="assumption"
              />
            ))}
          </>
        </MapStage>

        <div className="report-map-step">Supports</div>

        <MapStage eyebrow="Step 2" title="Core claim">
          {claimNode ? (
            <MapNodeCard
              label={claimNode.label}
              eyebrow="Claim"
              weight={claimNode.weight}
              tone="claim"
            />
          ) : null}
        </MapStage>

        <div className="report-map-step">Creates</div>

        <MapStage eyebrow="Step 3" title="Impact path">
          <>
            {impactNodes.map((node) => (
              <MapNodeCard
                key={node.id}
                label={node.label}
                eyebrow="Impact"
                weight={node.weight}
                tone="impact"
              />
            ))}
          </>
        </MapStage>

        <div className="report-map-step">Meets</div>

        <MapStage eyebrow="Step 4" title="Opponent counter">
          <>
            {counterNodes.map((node) => (
              <MapNodeCard
                key={node.id}
                label={node.label}
                eyebrow="Counter"
                weight={node.weight}
                tone="counter"
              />
            ))}
          </>
        </MapStage>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-xs">
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-premise-stroke)]" />{" "}
          Premise
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-claim-stroke)]" />{" "}
          Claim
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-impact-stroke)]" />{" "}
          Impact
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-counter-stroke)]" />{" "}
          Counter
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-assumption-stroke)]" />{" "}
          Unsupported assumption
        </span>
      </div>
    </div>
  );
}

function TranscriptReceipts({
  receipts,
}: {
  receipts: TranscriptReceipt[];
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      {receipts.map((receipt) => (
        <article
          key={receipt.id}
          className="theme-surface report-feature-card rounded-[1.65rem] border p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                {receipt.title}
              </p>
              <p className="theme-strong mt-2 text-sm font-semibold uppercase tracking-[0.18em]">
                {receipt.speaker}
              </p>
            </div>
            <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em]">
              Transcript receipt
            </span>
          </div>

          <blockquote className="report-quote mt-4 rounded-[1.45rem] border px-4 py-4 text-base leading-7 break-words">
            {receipt.quote}
          </blockquote>

          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Why it mattered
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">
                {receipt.diagnosis}
              </p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Coach fix
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">{receipt.fix}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function OpponentCaseCard({
  opponentCaseReview,
}: {
  opponentCaseReview: OpponentCaseReview;
}) {
  return (
    <article className="theme-surface report-feature-card rounded-[1.7rem] border p-5">
      <p className="theme-muted text-xs uppercase tracking-[0.24em]">
        Opponent&apos;s strongest part
      </p>
      <h3 className="mt-3 break-words text-2xl font-semibold">
        {opponentCaseReview.strongestPoint}
      </h3>
      <blockquote className="report-quote mt-5 rounded-[1.45rem] border px-4 py-4 text-base leading-7 break-words">
        {opponentCaseReview.strongestQuote}
      </blockquote>
      <div className="mt-4 grid gap-3">
        <div className="theme-subcard rounded-[1.25rem] border p-4">
          <p className="theme-muted text-xs uppercase tracking-[0.22em]">
            Why it landed
          </p>
          <p className="theme-copy mt-2 text-sm leading-6">
            {opponentCaseReview.whyItWorked}
          </p>
        </div>
        <div className="theme-subcard rounded-[1.25rem] border p-4">
          <p className="theme-muted text-xs uppercase tracking-[0.22em]">
            Best counter
          </p>
          <p className="theme-strong mt-2 text-sm leading-6">
            {opponentCaseReview.bestCounter}
          </p>
        </div>
      </div>
    </article>
  );
}

function MissedOpportunitiesList({
  opportunities,
}: {
  opportunities: MissedOpportunity[];
}) {
  return (
    <div className="grid gap-4">
      {opportunities.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          className="theme-surface rounded-[1.55rem] border p-5"
        >
          <div className="flex items-start gap-3">
            <div className="theme-accent-chip flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold">
              {index + 1}
            </div>
            <div>
              <p className="theme-strong text-lg font-semibold">{item.title}</p>
              <p className="theme-copy mt-2 text-sm leading-6">
                {item.missedArgument}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Why it was available
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">
                {item.whyItWasAvailable}
              </p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Better version
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">
                {item.betterVersion}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function PremiseClaimStacks({ frames }: { frames: ArgumentFrame[] }) {
  return (
    <div className="grid gap-4">
      {frames.map((frame) => (
        <article
          key={frame.id}
          className="theme-surface rounded-[1.7rem] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="theme-muted text-sm uppercase tracking-[0.2em]">
                {frame.title}
              </p>
              <p className="theme-strong mt-3 text-lg font-medium leading-7">
                {frame.claim}
              </p>
            </div>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                frameStatusStyles[frame.status],
              )}
            >
              {frame.status.replace("-", " ")}
            </span>
          </div>

          <div className="theme-subcard mt-5 rounded-[1.35rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.24em]">
              Premises
            </p>
            <ul className="mt-3 space-y-2">
              {frame.premises.map((premise) => (
                <li key={premise} className="report-list-item">
                  <span className="report-list-dot bg-[var(--accent)]" />
                  <span className="theme-copy text-sm leading-6">{premise}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.25rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Warrant
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{frame.warrant}</p>
            </div>
            <div className="theme-subcard rounded-[1.25rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Impact
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{frame.impact}</p>
            </div>
            <div className="theme-subcard rounded-[1.25rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Weak point
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">
                {frame.vulnerability}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LogicalWeaknessCards({ fallacies }: { fallacies: FallacyFlag[] }) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      {fallacies.map((flag) => (
        <article
          key={`${flag.name}-${flag.evidence}`}
          className="theme-surface rounded-[1.5rem] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="theme-strong text-lg font-medium">{flag.name}</h3>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                fallacySeverityStyles[flag.severity],
              )}
            >
              {flag.severity}
            </span>
          </div>
          <p className="theme-copy mt-3 text-sm leading-6">{flag.description}</p>
          <div className="theme-subcard mt-4 rounded-[1.2rem] border p-4">
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">
              Where it shows up
            </p>
            <p className="theme-copy mt-2 text-sm leading-6">{flag.evidence}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function PressureCards({ collapsePoints }: { collapsePoints: CollapsePoint[] }) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      {collapsePoints.map((point, index) => (
        <article
          key={`${point.title}-${point.trigger}`}
          className="theme-surface rounded-[1.5rem] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="theme-accent-chip flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="theme-strong text-lg font-medium">{point.title}</h3>
            </div>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                collapseSeverityStyles[point.severity],
              )}
            >
              {point.severity}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Likely attack
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">{point.trigger}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Why it lands
              </p>
              <p className="theme-copy mt-2 text-sm leading-6">
                {point.whyItBreaks}
              </p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                One-sentence fix
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">{point.repair}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

type ResearchEvidenceState = {
  error: string | null;
  result: EvidenceResult | null;
  status: "idle" | "loading" | "ready" | "error";
};

function ResearchUpgradePanel({
  evidenceState,
  onCopyEvidence,
  onGenerateEvidence,
  session,
}: {
  evidenceState: ResearchEvidenceState;
  onCopyEvidence: (card: EvidenceCard) => void;
  onGenerateEvidence: () => void;
  session: DebateSession;
}) {
  const researchSummary = buildResearchSummary(session, evidenceState.result);

  return (
    <div className="grid gap-4">
      <div className="theme-surface rounded-[1.6rem] border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="theme-muted text-xs uppercase tracking-[0.24em]">
              Strongest fact lane
            </p>
            <h3 className="mt-3 text-xl font-semibold">The empirical version of your case</h3>
          </div>
          <button
            type="button"
            disabled={evidenceState.status === "loading"}
            onClick={onGenerateEvidence}
            className="theme-button-secondary rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60"
          >
            {evidenceState.status === "loading"
              ? "Finding evidence..."
              : evidenceState.result
                ? "Refresh evidence"
                : "Generate Evidence"}
          </button>
        </div>
        <p className="theme-strong mt-4 text-sm leading-6">
          {researchSummary.strongestFactArgument}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="theme-surface rounded-[1.6rem] border p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Unsupported claims you made
          </p>
          <div className="mt-4 space-y-3">
            {researchSummary.unsupportedClaims.slice(0, 3).map((claim) => {
              const statusMeta = factCheckStatusMeta[claim.status];

              return (
                <div key={claim.id} className="theme-subcard rounded-[1.2rem] border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{statusMeta.label}</p>
                    <span
                      className={cx(
                        "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
                        statusMeta.chipClass,
                      )}
                    >
                      {statusMeta.emoji} {claim.category}
                    </span>
                  </div>
                  <p className="theme-strong mt-3 text-sm leading-6">{claim.claim}</p>
                  <p className="theme-copy mt-3 text-sm leading-6">{claim.explanation}</p>
                  {claim.sourceLabel ? (
                    <p className="theme-muted mt-3 text-xs leading-5">
                      Source angle: {claim.sourceLabel}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {researchSummary.unsupportedClaims.length === 0 ? (
              <div className="theme-subcard rounded-[1.2rem] border p-4">
                <p className="theme-copy text-sm leading-6">
                  You did not leave behind any obvious unsupported factual claims in the saved transcript. The next leap is better proof density, not emergency cleanup.
                </p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="theme-surface rounded-[1.6rem] border p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">
            Rewrite the weakest claim
          </p>
          <div className="mt-4 grid gap-3">
            {researchSummary.weakestClaimOriginal ? (
              <div className="theme-subcard rounded-[1.2rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Original line
                </p>
                <p className="theme-copy mt-2 text-sm leading-6">
                  {researchSummary.weakestClaimOriginal}
                </p>
              </div>
            ) : null}
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                Better version
              </p>
              <p className="theme-strong mt-2 text-sm leading-6">
                {researchSummary.weakestClaimRewrite}
              </p>
            </div>
          </div>
        </article>
      </div>

      <EvidenceDeck
        result={evidenceState.result}
        status={evidenceState.status}
        error={evidenceState.status === "error" ? evidenceState.error : null}
        emptyCopy="The report can build a full research pack with cards for statistics, studies, historical examples, and named authorities."
        actionLabel="Copy for replay"
        onUseCard={onCopyEvidence}
      />

      {evidenceState.error && evidenceState.status === "ready" ? (
        <p className="theme-muted text-sm leading-6">{evidenceState.error}</p>
      ) : null}
    </div>
  );
}

export function ResultsReportPanels({
  analysis,
  evidenceState,
  onCopyEvidence,
  onGenerateEvidence,
  session,
}: {
  analysis: DebateAnalysis;
  evidenceState: ResearchEvidenceState;
  onCopyEvidence: (card: EvidenceCard) => void;
  onGenerateEvidence: () => void;
  session: DebateSession;
}) {
  const insights = buildReportInsights(session, analysis);

  return (
    <div className="grid gap-6">
      <section id="receipts" className="scroll-mt-28">
        <div className="report-masonry-grid">
          <div className="report-masonry-item">
            <Panel
              eyebrow="Transcript Receipts"
              title="What the judge actually heard"
              description="These are the exact moments that helped you, hurt you, or left an upgrade sitting on the table."
            >
              <TranscriptReceipts receipts={analysis.transcriptReceipts} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Quote Lab"
              title="The lines to keep, punish, and rewrite"
              description="A premium report should not just summarize the round. It should show you the exact sentences carrying the real weight."
            >
              <QuoteWorkshop quoteInsights={insights.quoteInsights} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Opponent Read"
              title="Their strongest point and your best counter"
              description="This isolates the sharpest thing the opponent said and gives you the cleanest answer to it."
            >
              <OpponentCaseCard opponentCaseReview={analysis.opponentCaseReview} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Missed Arguments"
              title="Good arguments you left on the table"
              description="These were available from the transcript you already had, so they are the fastest gains for the replay."
            >
              <MissedOpportunitiesList opportunities={analysis.missedOpportunities} />
            </Panel>
          </div>
        </div>
      </section>

      <section id="research" className="scroll-mt-28">
        <Panel
          eyebrow="Research Upgrade"
          title="Unsupported claims, missing evidence, and the fact lane you should have used"
          description="This is the research layer: what needed proof, what evidence would have made the round harder to answer, and how to rewrite the weakest unsupported line."
        >
          <ResearchUpgradePanel
            evidenceState={evidenceState}
            onCopyEvidence={onCopyEvidence}
            onGenerateEvidence={onGenerateEvidence}
            session={session}
          />
        </Panel>
      </section>

      <section id="skills" className="scroll-mt-28">
        <div className="report-masonry-grid">
          <div className="report-masonry-item">
            <Panel
              eyebrow="Skill Breakdown"
              title="Seven-skill scorecard"
              description="This replaces the one-number read with a coach-style breakdown of the exact skills deciding your round."
            >
              <SkillBreakdown metrics={analysis.metrics} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Speech Pattern Radar"
              title="How your debate habits actually showed up"
              description="This is the practical pattern read: evidence use, clash frequency, weighing, definitions, absolutism, and turn density."
            >
              <DebatePatternRadar patternStats={insights.patternStats} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Round Story"
              title="How the round rose or sagged"
              description="This is the tempo read: where the round had energy, where it slipped, and where the judge mentally leaned."
            >
              <MomentumPanel momentum={analysis.momentum} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Debate DNA"
              title="Your round identity and next-level focus"
              description="This gives the premium-profile read: what kind of debater you looked like in this round, and what that means for the replay."
            >
              <DebateProfilePanel
                analysis={analysis}
                profileSignals={insights.profileSignals}
              />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Judge Simulator"
              title="How different judges would read the same round"
              description="Not every ballot sees the debate through the same lens. This shows what changes when the judging standard shifts."
            >
              <JudgeSimulationPanel judgePerspectives={insights.judgePerspectives} />
            </Panel>
          </div>
        </div>
      </section>

      <section id="coach" className="scroll-mt-28">
        <div className="report-masonry-grid">
          <div className="report-masonry-item">
            <Panel
              eyebrow="Coach Feedback"
              title="Actionable coaching, not generic criticism"
              description="What you should keep, what is still leaking, and what to deliberately fix on the replay."
            >
              <CoachFeedback
                strengths={analysis.strengths}
                weaknesses={analysis.weaknesses}
                nextSteps={analysis.nextSteps}
              />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Judge Ballot"
              title="What a sharp judge would actually write down"
              description="This is the ballot-language version of the round: why it broke the way it did, what decided it, and what flips the call."
            >
              <JudgeBallotPanel ballotCallouts={insights.ballotCallouts} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Pressure Test"
              title="The fastest attacks against your case"
              description="These are the easiest pressure points an opponent can hit and the exact one-line fix that patches each one."
            >
              <PressureCards collapsePoints={analysis.collapsePoints} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Replay Blueprint"
              title="What to say differently next time"
              description="This turns the report into a practical rematch plan: how to open, how to answer pressure, and how to close with intent."
            >
              <ReplayBlueprintPanel replaySteps={insights.replaySteps} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Rematch Script"
              title="A cleaner opener, proof step, answer, and close"
              description="This is the short script version of the report: what to say first, what to prove, how to answer pressure, and how to end."
            >
              <RematchScriptPanel rematchScript={insights.rematchScript} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Counterplay Lab"
              title="What they are likely to do next and your best answer"
              description="The rematch is not only about your offense. It is also about predicting the next pressure move before it lands."
            >
              <CounterplayLabPanel counterplayMoves={insights.counterplayMoves} />
            </Panel>
          </div>
        </div>
      </section>

      <section id="map" className="scroll-mt-28">
        <div className="report-masonry-grid">
          <div className="report-masonry-item">
            <Panel
              eyebrow="Argument Map"
              title={analysis.argumentMap.headline}
              description="Premises feed the core claim, the claim turns into impact, and the opponent's best counter is isolated so the flow stays readable."
            >
              <ArgumentMapDiagram argumentMap={analysis.argumentMap} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Premise To Claim"
              title="How your core lines are structurally built"
              description="This structure view shows the premises, warrant, impact, and likely collapse point for the core claims in your round."
            >
              <PremiseClaimStacks frames={analysis.argumentFrames} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Logical Weaknesses"
              title="Where a sharp opponent can punish the reasoning"
              description="These are not just style problems. They are the fastest ways your case can get structurally undercut."
            >
              <LogicalWeaknessCards fallacies={analysis.fallacies} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Crossfire Drill"
              title="Questions you should be ready to ask and answer"
              description="These are the cross-ex questions that put pressure on the opponent's best lane while protecting your weakest point."
            >
              <CrossfireDrillPanel drillQuestions={insights.drillQuestions} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Case Surgery"
              title="The highest-value structural repairs"
              description="If the report could mark up your case like a coach before the next round, these are the repairs it would make first."
            >
              <CaseRepairPanel
                caseRepairs={insights.caseRepairs}
                weakestMetricLabel={insights.weakestMetric?.label ?? null}
              />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Evidence Upgrade"
              title="Exactly where stronger proof would change the round"
              description="This isolates the claims that needed better evidence and the kind of source that would have done the most work."
            >
              <EvidenceUpgradePanel evidenceUpgrades={insights.evidenceUpgrades} />
            </Panel>
          </div>

          <div className="report-masonry-item">
            <Panel
              eyebrow="Language Tuning"
              title="Sharper sentence shapes for the rematch"
              description="Sometimes the fastest upgrade is not a new idea but a stronger line shape that carries proof, clash, and weighing more clearly."
            >
              <LanguageTuningPanel languageTweaks={insights.languageTweaks} />
            </Panel>
          </div>
        </div>
      </section>
    </div>
  );
}
