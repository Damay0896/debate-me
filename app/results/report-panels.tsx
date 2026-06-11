"use client";

import { useEffect, useState, type ReactNode } from "react";

import type {
  ArgumentFrame,
  ArgumentMap,
  ArgumentMapEdge,
  ArgumentMapNode,
  CollapsePoint,
  DebateAnalysis,
  DebateMetric,
  FallacyFlag,
  MomentumBeat,
} from "@/lib/debate";

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

const relationColors: Record<ArgumentMapEdge["relation"], string> = {
  supports: "#f4c34d",
  attacks: "#fb923c",
  depends: "#8b5cf6",
};

const nodeColors: Record<ArgumentMapNode["kind"], { fill: string; stroke: string }> = {
  premise: { fill: "var(--map-premise-fill)", stroke: "var(--map-premise-stroke)" },
  claim: { fill: "var(--map-claim-fill)", stroke: "var(--map-claim-stroke)" },
  impact: { fill: "var(--map-impact-fill)", stroke: "var(--map-impact-stroke)" },
  counter: { fill: "var(--map-counter-fill)", stroke: "var(--map-counter-stroke)" },
  assumption: { fill: "var(--map-assumption-fill)", stroke: "var(--map-assumption-stroke)" },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function wrapText(value: string, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = "";
    }

    if (lines.length === 3) {
      return [lines[0], lines[1], `${lines[2].replace(/[. ]+$/, "")}...`];
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function mapNodePosition(node: ArgumentMapNode) {
  const columnX = [154, 450, 746] as const;
  return {
    x: columnX[node.column],
    y: 112 + node.row * 102,
  };
}

function getNodeDimensions(node: ArgumentMapNode, lineCount: number) {
  const width = node.kind === "claim" ? 214 : node.kind === "impact" ? 220 : 208;
  const height = Math.max(84, 50 + Math.max(1, lineCount) * 16);

  return { width, height };
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
      className="theme-card report-panel-shell report-rise scroll-mt-28 rounded-[2rem] border p-6 shadow-xl backdrop-blur"
    >
      <p className="theme-muted text-xs uppercase tracking-[0.32em]">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="theme-strong text-2xl font-semibold">{title}</h2>
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
    <div className="grid gap-4 lg:grid-cols-2">
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
    <div className="grid gap-3 sm:grid-cols-2">
      {momentum.map((beat, index) => (
        <article key={`${beat.label}-${index}`} className="theme-surface rounded-[1.5rem] border p-4">
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
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <article className="theme-surface rounded-[1.55rem] border p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">Keep doing this</p>
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
          <p className="theme-muted text-xs uppercase tracking-[0.24em]">Still leaking here</p>
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
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">Coach feedback</p>
        <h3 className="mt-3 text-xl font-semibold">What to fix in the very next round</h3>
        <div className="mt-5 space-y-3">
          {nextSteps.map((item, index) => (
            <div
              key={item}
              className="theme-subcard rounded-[1.3rem] border p-4"
            >
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
      <p className="theme-muted text-xs uppercase tracking-[0.24em]">Highest-value fix</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="theme-accent-chip rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          {bestNextImprovement.skill}
        </span>
        <h3 className="text-2xl font-semibold">{bestNextImprovement.title}</h3>
      </div>
      <p className="theme-copy mt-4 text-base leading-7">{bestNextImprovement.reason}</p>
      <div className="theme-subcard mt-5 rounded-[1.35rem] border p-4">
        <p className="theme-muted text-xs uppercase tracking-[0.24em]">Drill for the replay</p>
        <p className="theme-strong mt-2 text-sm leading-6">{bestNextImprovement.drill}</p>
      </div>
    </article>
  );
}

function ArgumentMapDiagram({ argumentMap }: { argumentMap: ArgumentMap }) {
  const nodesById = new Map(argumentMap.nodes.map((node) => [node.id, node]));
  const nodeLayouts = new Map(
    argumentMap.nodes.map((node) => {
      const textLines = wrapText(
        node.label,
        node.kind === "impact" || node.kind === "counter" ? 28 : 24,
      );

      return [
        node.id,
        {
          position: mapNodePosition(node),
          textLines,
          ...getNodeDimensions(node, textLines.length),
        },
      ] as const;
    }),
  );

  return (
    <div className="theme-surface report-diagram-shell overflow-x-auto rounded-[1.7rem] border p-4">
      <svg viewBox="0 0 900 432" className="min-w-[48rem]" aria-label="Argument map">
        <rect x="0" y="0" width="900" height="432" rx="28" fill="var(--diagram-bg)" />

        {["Premises", "Core claim", "Impact / opponent counter"].map((label, index) => (
          <text
            key={label}
            x={index === 0 ? 154 : index === 1 ? 450 : 746}
            y="42"
            fill="var(--diagram-muted)"
            fontSize="12"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {argumentMap.edges.map((edge, index) => {
          const from = nodesById.get(edge.from);
          const to = nodesById.get(edge.to);
          const fromLayout = nodeLayouts.get(edge.from);
          const toLayout = nodeLayouts.get(edge.to);

          if (!from || !to || !fromLayout || !toLayout) {
            return null;
          }

          const fromPos = fromLayout.position;
          const toPos = toLayout.position;
          const direction = fromPos.x < toPos.x ? 1 : -1;
          const x1 = fromPos.x + direction * (fromLayout.width / 2 - 10);
          const x2 = toPos.x - direction * (toLayout.width / 2 - 10);
          const midX = (x1 + x2) / 2;
          const midY = (fromPos.y + toPos.y) / 2;
          const controlOffset = Math.min(96, Math.max(48, Math.abs(x2 - x1) / 2));
          const path = `M ${x1} ${fromPos.y} C ${x1 + direction * controlOffset} ${fromPos.y}, ${x2 - direction * controlOffset} ${toPos.y}, ${x2} ${toPos.y}`;

          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <path
                d={path}
                fill="none"
                stroke={relationColors[edge.relation]}
                strokeWidth="2.4"
                strokeDasharray={edge.relation === "depends" ? "7 7" : undefined}
                opacity="0.9"
                strokeLinecap="round"
              />
              <rect
                x={midX - 34}
                y={midY - 11}
                width="68"
                height="22"
                rx="11"
                fill="var(--diagram-chip)"
                stroke="var(--diagram-chip-border)"
              />
              <text
                x={midX}
                y={midY + 4}
                fill="var(--diagram-label)"
                fontSize="10"
                textAnchor="middle"
              >
                {edge.relation}
              </text>
            </g>
          );
        })}

        {argumentMap.nodes.map((node) => {
          const layout = nodeLayouts.get(node.id);

          if (!layout) {
            return null;
          }

          const position = layout.position;
          const palette = nodeColors[node.kind];
          const left = position.x - layout.width / 2;
          const top = position.y - layout.height / 2;
          const badgeCenterX = left + layout.width - 24;
          const headerY = top + 20;
          const bodyStartY = top + 42;

          return (
            <g key={node.id}>
              <rect
                x={left}
                y={top}
                width={layout.width}
                height={layout.height}
                rx="20"
                fill={palette.fill}
                stroke={palette.stroke}
                strokeWidth="1.7"
              />
              <text
                x={left + 18}
                y={headerY}
                fill="var(--diagram-muted)"
                fontSize="9"
                letterSpacing="1.8"
              >
                {node.kind.toUpperCase()}
              </text>
              <circle
                cx={badgeCenterX}
                cy={headerY - 4}
                r="12"
                fill="var(--track)"
                stroke="var(--diagram-chip-border)"
              />
              <text
                x={badgeCenterX}
                y={headerY}
                fill="var(--diagram-label)"
                fontSize="9"
                textAnchor="middle"
              >
                {node.weight}
              </text>
              <text x={left + 18} y={bodyStartY} fill="var(--diagram-label)" fontSize="12">
                {layout.textLines.map((line, index) => (
                  <tspan key={`${node.id}-${index}`} x={left + 18} dy={index === 0 ? 0 : 16}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-premise-stroke)]" />{" "}
          Premise
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-claim-stroke)]" />{" "}
          Core claim
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-impact-stroke)]" />{" "}
          Impact
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-counter-stroke)]" />{" "}
          Opponent counter
        </span>
        <span className="theme-subcard rounded-full border px-3 py-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--map-assumption-stroke)]" />{" "}
          Unsupported assumption
        </span>
      </div>
    </div>
  );
}

function PremiseClaimStacks({ frames }: { frames: ArgumentFrame[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {frames.map((frame) => (
        <article key={frame.id} className="theme-surface rounded-[1.7rem] border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="theme-muted text-sm uppercase tracking-[0.2em]">{frame.title}</p>
              <p className="theme-strong mt-3 text-lg font-medium leading-7">{frame.claim}</p>
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
            <p className="theme-muted text-xs uppercase tracking-[0.24em]">Premises</p>
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
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Warrant</p>
              <p className="theme-copy mt-2 text-sm leading-6">{frame.warrant}</p>
            </div>
            <div className="theme-subcard rounded-[1.25rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Impact</p>
              <p className="theme-copy mt-2 text-sm leading-6">{frame.impact}</p>
            </div>
            <div className="theme-subcard rounded-[1.25rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">Weak point</p>
              <p className="theme-copy mt-2 text-sm leading-6">{frame.vulnerability}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LogicalWeaknessCards({ fallacies }: { fallacies: FallacyFlag[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fallacies.map((flag) => (
        <article key={`${flag.name}-${flag.evidence}`} className="theme-surface rounded-[1.5rem] border p-5">
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
            <p className="theme-muted text-xs uppercase tracking-[0.22em]">Where it shows up</p>
            <p className="theme-copy mt-2 text-sm leading-6">{flag.evidence}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function PressureCards({ collapsePoints }: { collapsePoints: CollapsePoint[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {collapsePoints.map((point, index) => (
        <article key={`${point.title}-${point.trigger}`} className="theme-surface rounded-[1.5rem] border p-5">
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
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">Likely attack</p>
              <p className="theme-copy mt-2 text-sm leading-6">{point.trigger}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">Why it lands</p>
              <p className="theme-copy mt-2 text-sm leading-6">{point.whyItBreaks}</p>
            </div>
            <div className="theme-subcard rounded-[1.2rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.22em]">One-sentence fix</p>
              <p className="theme-strong mt-2 text-sm leading-6">{point.repair}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ResultsReportPanels({ analysis }: { analysis: DebateAnalysis }) {
  return (
    <div className="grid gap-6">
      <section
        id="skills"
        className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"
      >
        <Panel
          eyebrow="Skill Breakdown"
          title="Seven-skill scorecard"
          description="This replaces the one-number read with a coach-style breakdown of the exact skills deciding your round."
        >
          <SkillBreakdown metrics={analysis.metrics} />
        </Panel>

        <div className="grid gap-6">
          <Panel
            eyebrow="Round Story"
            title="How the round rose or sagged"
            description="This is the tempo read: where the round had energy, where it slipped, and where the judge mentally leaned."
          >
            <MomentumPanel momentum={analysis.momentum} />
          </Panel>

          <Panel
            eyebrow="Best Next Improvement"
            title="The single highest-value fix"
            description="If you improve only one thing before the next debate, make it this."
          >
            <BestNextImprovementCard analysis={analysis} />
          </Panel>
        </div>
      </section>

      <section
        id="coach"
        className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.02fr_0.98fr]"
      >
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

        <Panel
          eyebrow="Pressure Test"
          title="The 3 fastest attacks against your case"
          description="These are the easiest pressure points an opponent can hit and the exact one-line fix that patches each one."
        >
          <PressureCards collapsePoints={analysis.collapsePoints} />
        </Panel>
      </section>

      <section
        id="map"
        className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"
      >
        <Panel
          eyebrow="Argument Map"
          title={analysis.argumentMap.headline}
          description="Premises flow into the core claim, which drives the impact, while unsupported assumptions are highlighted separately."
        >
          <ArgumentMapDiagram argumentMap={analysis.argumentMap} />
        </Panel>

        <Panel
          eyebrow="Logical Weaknesses"
          title="Where a sharp opponent can punish the reasoning"
          description="These are not just style problems. They are the fastest ways your case can get structurally undercut."
        >
          <LogicalWeaknessCards fallacies={analysis.fallacies} />
        </Panel>
      </section>

      <Panel
        eyebrow="Premise To Claim"
        title="How your best lines are built"
        description="This structure view shows the premises, warrant, impact, and likely collapse point for the core claims in your round."
      >
        <PremiseClaimStacks frames={analysis.argumentFrames} />
      </Panel>
    </div>
  );
}
