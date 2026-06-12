"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
} from "react";

import {
  buildHeuristicAnalysis,
  coerceDebateAnalysis,
  createId,
  getOpponentPersonalityMeta,
  getReplyStyleMeta,
  type DebateAnalysis,
  type DebateMetric,
  type DebateSession,
} from "@/lib/debate";
import {
  buildAnalysisSessionKey,
  loadAnalysisRecord,
  loadSession,
  needsAnalysisRefresh,
  saveAnalysis,
} from "@/lib/debate-storage";

import { buildReportInsights } from "./report-insights";
import { ResultsReportPanels } from "./report-panels";

type ResultsViewProps = {
  initialSessionId: string;
};

type AnalyzeResponse = {
  analysis?: DebateAnalysis;
  source?: "heuristic" | "openrouter";
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getStoredSession(initialSessionId: string) {
  return initialSessionId.trim() !== "" ? loadSession(initialSessionId) : null;
}

function getFallbackAnalysis(session: DebateSession) {
  return buildHeuristicAnalysis(session);
}

function subscribeToHydration() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

function getTopMetric(metrics: DebateMetric[]) {
  return [...metrics].sort((left, right) => right.score - left.score)[0] ?? null;
}

function getBottomMetric(metrics: DebateMetric[]) {
  return [...metrics].sort((left, right) => left.score - right.score)[0] ?? null;
}

function describeConfidence(confidence: number) {
  if (confidence >= 82) {
    return "Coach is very confident in this call.";
  }

  if (confidence >= 70) {
    return "Coach sees a real edge, but not a blowout.";
  }

  return "Coach sees this as close enough to swing next time.";
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

function cleanReplayFocus(value: string) {
  return value.replace(/^Replay focus:\s*/i, "").trim();
}

export default function ResultsView({ initialSessionId }: ResultsViewProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const session = useMemo(
    () => (isClient ? getStoredSession(initialSessionId) : null),
    [initialSessionId, isClient],
  );
  const storedAnalysisRecord = useMemo(
    () => (session ? loadAnalysisRecord(session.id) : null),
    [session],
  );
  const fallbackAnalysis = useMemo(
    () => (session ? getFallbackAnalysis(session) : null),
    [session],
  );
  const reportFromStorage = useMemo(() => {
    if (!session || !fallbackAnalysis) {
      return null;
    }

    return storedAnalysisRecord?.analysis
      ? coerceDebateAnalysis(storedAnalysisRecord.analysis, fallbackAnalysis)
      : fallbackAnalysis;
  }, [fallbackAnalysis, session, storedAnalysisRecord]);
  const shouldRefreshAnalysis =
    session && storedAnalysisRecord
      ? needsAnalysisRefresh(session, storedAnalysisRecord)
      : session !== null;
  const sessionKey = session
    ? buildAnalysisSessionKey(session)
    : "";
  const [remoteAnalysis, setRemoteAnalysis] = useState<{
    analysis: DebateAnalysis | null;
    error: string | null;
    sessionKey: string;
    source: "heuristic" | "openrouter";
  }>({
    analysis: null,
    error: null,
    sessionKey: "",
    source: "heuristic",
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isRouting, startTransition] = useTransition();

  useEffect(() => {
    if (!session || !fallbackAnalysis || !shouldRefreshAnalysis) {
      return;
    }

    const activeSession = session;
    const activeSessionKey = sessionKey;
    const activeFallbackAnalysis = fallbackAnalysis;

    let isCancelled = false;

    async function requestAnalysis() {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session: activeSession,
          }),
        });

        const data = (await response.json()) as AnalyzeResponse;
        const nextAnalysis = coerceDebateAnalysis(data.analysis, activeFallbackAnalysis);
        const source = data.source ?? "heuristic";

        if (isCancelled) {
          return;
        }

        setRemoteAnalysis({
          analysis: nextAnalysis,
          error: null,
          sessionKey: activeSessionKey,
          source,
        });
        saveAnalysis(activeSession, nextAnalysis, source);
      } catch {
        if (isCancelled) {
          return;
        }

        setRemoteAnalysis({
          analysis: activeFallbackAnalysis,
          error: "Live coaching was unavailable, so this report used the instant scorer.",
          sessionKey: activeSessionKey,
          source: "heuristic",
        });
        saveAnalysis(activeSession, activeFallbackAnalysis, "heuristic");
      }
    }

    void requestAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [fallbackAnalysis, session, sessionKey, shouldRefreshAnalysis]);

  if (!isClient) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="theme-card mx-auto max-w-3xl rounded-[2rem] border p-8 text-center backdrop-blur">
          <p className="theme-muted text-sm uppercase tracking-[0.35em]">
            Preparing Report
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Loading your round...</h1>
          <p className="theme-copy mt-4 text-lg leading-8">
            Pulling your transcript, score, and coaching map into place.
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="theme-card mx-auto max-w-3xl rounded-[2rem] border p-8 text-center backdrop-blur">
          <p className="theme-muted text-sm uppercase tracking-[0.35em]">
            No Saved Round
          </p>
          <h1 className="mt-4 text-4xl font-semibold">No debate report yet.</h1>
          <p className="theme-copy mt-4 text-lg leading-8">
            Start a round first, then come back here for the scorecard and
            coaching notes.
          </p>
          <Link
            href="/"
            className="theme-button-primary mt-8 inline-flex rounded-full px-6 py-3 font-semibold transition"
          >
            Start a debate
          </Link>
        </div>
      </main>
    );
  }

  const liveAnalysis =
    remoteAnalysis.sessionKey === sessionKey ? remoteAnalysis.analysis : null;
  const analysisSource =
    remoteAnalysis.sessionKey === sessionKey
      ? remoteAnalysis.source
      : storedAnalysisRecord?.source ?? "heuristic";
  const error =
    remoteAnalysis.sessionKey === sessionKey ? remoteAnalysis.error : null;
  const isLoading =
    shouldRefreshAnalysis && remoteAnalysis.sessionKey !== sessionKey;
  const report = liveAnalysis ?? reportFromStorage ?? getFallbackAnalysis(session);
  const transcriptPreview = session.messages.slice(-6);
  const opponentPersonality = getOpponentPersonalityMeta(session.opponentPersonality);
  const replyStyle = getReplyStyleMeta(session.replyStyle);
  const reportLabel = isLoading
    ? "Refreshing with deeper coaching"
    : analysisSource === "openrouter"
      ? "AI coach + instant scoring"
      : storedAnalysisRecord
        ? "Saved coaching report"
        : "Instant scoring report";
  const activeSession = session;
  const winnerLabel =
    report.winner === "You"
      ? "User"
      : report.winner === "AI Opponent"
        ? "AI Opponent"
        : "Tie";
  const resultBanner =
    report.result === "win" ? "WIN" : report.result === "loss" ? "LOSS" : "TIE";
  const resultBannerClass =
    report.result === "win"
      ? "theme-status-anchor"
      : report.result === "loss"
        ? "theme-status-collapse"
        : "theme-status-developing";
  const topMetric = getTopMetric(report.metrics);
  const bottomMetric = getBottomMetric(report.metrics);
  const replayFocus = cleanReplayFocus(report.replayFocus);
  const reportInsights = buildReportInsights(session, report);
  const hasTranscriptArchive = reportInsights.hasTranscriptArchive;
  const turnStatLabel = hasTranscriptArchive ? "Your turns" : "Round source";
  const turnStatValue = hasTranscriptArchive
    ? `${reportInsights.turnCount}`
    : analysisSource === "openrouter"
      ? "Coach"
      : "Saved";
  const wordStatLabel = hasTranscriptArchive ? "Total words" : "Transcript";
  const wordStatValue = hasTranscriptArchive
    ? `${reportInsights.totalWords}`
    : "Missing";
  const confidenceRingStyle = {
    "--score": `${report.winnerConfidence}%`,
  } as CSSProperties;
  const reportSections = [
    { href: "#verdict", label: "Verdict" },
    { href: "#receipts", label: "Receipts" },
    { href: "#skills", label: "Skills" },
    { href: "#coach", label: "Coaching" },
    { href: "#map", label: "Map" },
    { href: "#transcript", label: "Transcript" },
  ];

  function continueDebate() {
    startTransition(() => {
      router.push(
        `/debate?session=${activeSession.id}&topic=${encodeURIComponent(
          activeSession.topic,
        )}&side=${activeSession.userSide}&personality=${activeSession.opponentPersonality}&style=${activeSession.replyStyle}`,
      );
    });
  }

  function replayDebateBetter() {
    startTransition(() => {
      router.push(
        `/debate?session=${createId("session")}&topic=${encodeURIComponent(
          activeSession.topic,
        )}&side=${activeSession.userSide}&personality=${activeSession.opponentPersonality}&style=${activeSession.replyStyle}&focus=${encodeURIComponent(replayFocus)}`,
      );
    });
  }

  function exportFeedbackPdf() {
    const url = `/results/export?session=${activeSession.id}&autoprint=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyReplayBrief() {
    const lines = [
      `Debate topic: ${activeSession.topic}`,
      `Verdict: ${report.verdict}`,
      `Winner confidence: ${report.winnerConfidence}%`,
      `Best next improvement: ${report.bestNextImprovement.title}`,
      `Replay focus: ${replayFocus}`,
      "",
      "Rematch script:",
      ...reportInsights.rematchScript.map(
        (step) => `- ${step.label}: ${step.line}`,
      ),
      "",
      "Judge simulator:",
      ...reportInsights.judgePerspectives.map(
        (judge) => `- ${judge.label}: ${judge.verdict}. ${judge.nextMove}`,
      ),
      "",
      "Counterplay:",
      ...reportInsights.counterplayMoves.map(
        (move) => `- ${move.title}: ${move.answer}`,
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <main className="report-shell relative min-h-screen overflow-hidden px-6 py-8 sm:px-8">
      <div className="report-page-glow pointer-events-none absolute inset-0" />
      <div className="report-page-grid pointer-events-none absolute inset-0" />

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="theme-card report-rise rounded-[2.2rem] border p-6 backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="theme-kicker text-sm uppercase tracking-[0.35em]">
                Debate Report
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-balance md:text-5xl">
                {session.topic}
              </h1>
              <p className="theme-copy mt-4 text-lg leading-8">
                You argued the {session.userSide.toLowerCase()} side against the{" "}
                {session.opponentSide.toLowerCase()} side with the{" "}
                {opponentPersonality.label}-inspired mode in {replyStyle.label} mode.
              </p>
              <div className="theme-copy mt-5 flex flex-wrap gap-3 text-sm">
                <span className="theme-pill rounded-full border px-4 py-2">
                  Persona: {opponentPersonality.label}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  Mode: {replyStyle.label}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  Opponent: {session.opponentSide}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  You: {session.userSide}
                </span>
              </div>
            </div>

            <div className="report-action-stack flex w-full flex-col gap-3 md:w-[18rem] md:flex-none">
              <button
                type="button"
                disabled={isRouting}
                onClick={continueDebate}
                className="theme-button-secondary inline-flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
              >
                Continue debate
              </button>
              <button
                type="button"
                disabled={isRouting}
                onClick={replayDebateBetter}
                className="theme-button-secondary inline-flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
              >
                Replay the Debate Better
              </button>
              <button
                type="button"
                onClick={exportFeedbackPdf}
                className="theme-button-secondary inline-flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition"
              >
                Export Feedback PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyReplayBrief();
                }}
                className="theme-button-secondary inline-flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition"
              >
                {copyState === "copied"
                  ? "Replay brief copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy replay brief"}
              </button>
              <Link
                href="/"
                className="theme-button-primary inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
              >
                New topic
              </Link>
            </div>
          </div>
        </header>

        <nav className="theme-card report-nav sticky top-4 z-20 rounded-[1.6rem] border px-3 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="report-nav-scroll flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
              {reportSections.map((section) => (
                <a
                  key={section.href}
                  href={section.href}
                  className="report-nav-link shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
                >
                  {section.label}
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={exportFeedbackPdf}
              className="theme-button-secondary inline-flex w-full shrink-0 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition sm:w-auto lg:ml-auto"
            >
              Export PDF
            </button>
          </div>
        </nav>

        <section
          id="verdict"
          className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.12fr_0.88fr] xl:items-start"
        >
          <section className="theme-panel report-hero relative overflow-hidden rounded-[2.35rem] border p-6 md:p-8">
            <div className="report-hero-glow absolute inset-x-0 top-0 h-44 opacity-80" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_16rem]">
              <div>
                <p className="theme-muted text-sm uppercase tracking-[0.3em]">
                  Round Verdict
                </p>
                <div className="mt-5 flex flex-wrap items-end gap-4">
                  <span
                    className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.28em] ${resultBannerClass}`}
                  >
                    {resultBanner}
                  </span>
                  <div>
                    <p className="theme-muted text-sm uppercase tracking-[0.18em]">
                      Winner: {winnerLabel} ({report.winnerConfidence}%)
                    </p>
                    <h2 className="mt-2 text-4xl font-semibold md:text-5xl">
                      {report.verdict}
                    </h2>
                  </div>
                </div>

                <p className="theme-copy mt-6 max-w-3xl text-base leading-7 md:text-[1.05rem]">
                  {report.winnerReasoning}
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <div className="theme-surface rounded-3xl border p-4">
                    <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                      {turnStatLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold">{turnStatValue}</p>
                  </div>
                  <div className="theme-surface rounded-3xl border p-4">
                    <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                      {wordStatLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold">{wordStatValue}</p>
                  </div>
                  <div className="theme-surface rounded-3xl border p-4">
                    <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                      Overall score
                    </p>
                    <p className="mt-3 text-3xl font-semibold">{report.score}</p>
                  </div>
                </div>

                {!hasTranscriptArchive ? (
                  <p className="theme-muted mt-4 text-sm leading-6">
                    This saved round still has the full coaching analysis, but the
                    original turn-by-turn transcript archive was not preserved.
                  </p>
                ) : null}

                <div className="theme-subcard report-brief-card mt-6 rounded-[1.55rem] border p-4">
                  <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                    Coach read
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {topMetric ? (
                      <span className="theme-pill rounded-full border px-4 py-2">
                        Top skill: {topMetric.label} ({topMetric.score})
                      </span>
                    ) : null}
                    {bottomMetric ? (
                      <span className="theme-pill rounded-full border px-4 py-2">
                        Main leak: {bottomMetric.label} ({bottomMetric.score})
                      </span>
                    ) : null}
                  </div>
                  <p className="theme-copy mt-3 text-sm leading-6">
                    {reportLabel}. {describeConfidence(report.winnerConfidence)}
                  </p>
                </div>

                {error ? <p className="theme-error mt-5 text-sm">{error}</p> : null}
                {isLoading ? (
                  <p className="theme-muted mt-5 text-sm">
                    Refreshing the report with deeper coaching...
                  </p>
                ) : null}
              </div>

              <aside className="flex flex-col gap-4">
                <div className="report-score-ring mx-auto w-full max-w-[15rem]" style={confidenceRingStyle}>
                  <div className="report-score-ring-inner">
                    <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                      Coach confidence
                    </p>
                    <p className="mt-3 text-5xl font-semibold">
                      {report.winnerConfidence}
                      <span className="text-2xl">%</span>
                    </p>
                    <p className="theme-copy mt-3 text-sm leading-6">
                      {describeConfidence(report.winnerConfidence)}
                    </p>
                  </div>
                </div>

                <div className="theme-surface rounded-[1.5rem] border p-4">
                  <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                    Most valuable edge
                  </p>
                  <p className="mt-3 text-xl font-semibold">
                    {topMetric ? topMetric.label : "Still forming"}
                  </p>
                  <p className="theme-copy mt-2 text-sm leading-6">
                    {topMetric
                      ? `${describeMetricTier(topMetric.score)} enough to give the judge a cleaner route to your ballot.`
                      : "The biggest advantage in the round is still too close to call."}
                  </p>
                </div>

                <div className="theme-surface rounded-[1.5rem] border p-4">
                  <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                    Replay focus
                  </p>
                  <p className="theme-strong mt-3 text-sm leading-6">
                    {replayFocus}
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <section className="theme-card report-rise rounded-[2.2rem] border p-6 backdrop-blur md:p-7">
            <p className="theme-muted text-xs uppercase tracking-[0.32em]">
              Coach&apos;s Notebook
            </p>
            <h2 className="mt-3 text-2xl font-semibold md:text-[2rem]">
              What swung the ballot
            </h2>
            <p className="theme-copy mt-4 text-base leading-7">{report.summary}</p>

            <div className="mt-6 space-y-3">
              {report.highlights.map((item, index) => (
                <div
                  key={item}
                  className="report-highlight-row theme-surface rounded-[1.35rem] border px-4 py-4"
                >
                  <div className="theme-accent-chip flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">
                    {index + 1}
                  </div>
                  <p className="theme-strong text-sm leading-6">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Best skill today
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {topMetric ? `${topMetric.label} (${topMetric.score})` : "Still forming"}
                </p>
              </div>
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Biggest swing area
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {bottomMetric
                    ? `${bottomMetric.label} (${bottomMetric.score})`
                    : "Still forming"}
                </p>
              </div>
            </div>
          </section>
        </section>

        <section
          id="snapshot"
          className="scroll-mt-28 grid gap-4 xl:grid-cols-[1.02fr_0.9fr_0.98fr] xl:items-start"
        >
          <section className="theme-card report-rise report-feature-card rounded-[2rem] border p-6 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.3em]">
              Strongest Argument
            </p>
            <h2 className="mt-3 text-2xl font-semibold">The line worth keeping</h2>
            <blockquote className="report-quote mt-6 rounded-[1.7rem] border px-5 py-5 text-lg leading-8">
              {report.strongestArgument}
            </blockquote>
            <p className="theme-copy mt-5 text-sm leading-6">
              This is the part of your case that most looked like a real ballot path.
              Build outward from this instead of restarting from scratch next round.
            </p>
          </section>

          <div className="grid gap-4 self-start">
            <section className="theme-card report-rise rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Your Biggest Mistake
              </p>
              <p className="theme-strong mt-4 text-base leading-7">
                {report.biggestUserMistake}
              </p>
            </section>

            <section className="theme-card report-rise report-feature-card rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Opponent&apos;s Best Shot
              </p>
              <p className="mt-3 text-xl font-semibold">
                {report.opponentCaseReview.strongestPoint}
              </p>
              <blockquote className="report-quote mt-4 rounded-[1.35rem] border px-4 py-4 text-sm leading-6">
                {report.opponentCaseReview.strongestQuote}
              </blockquote>
              <div className="theme-subcard mt-4 rounded-[1.25rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Best counter
                </p>
                <p className="theme-strong mt-2 text-sm leading-6">
                  {report.opponentCaseReview.bestCounter}
                </p>
              </div>
              <p className="theme-copy mt-4 text-sm leading-6">
                Their own weak spot: {report.biggestOpponentMistake}
              </p>
            </section>
          </div>

          <section className="theme-panel report-rise rounded-[2rem] border p-6">
            <p className="theme-muted text-xs uppercase tracking-[0.3em]">
              Swing The Round
            </p>
            <h2 className="mt-3 text-2xl font-semibold">One sentence that changes the result</h2>
            <p className="theme-strong mt-5 text-lg leading-8">{report.flipSentence}</p>

            <div className="theme-subcard mt-6 rounded-[1.45rem] border p-4">
              <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                Replay directive
              </p>
              <p className="theme-copy mt-3 text-sm leading-6">{replayFocus}</p>
            </div>

            {report.missedOpportunities[0] ? (
              <div className="theme-subcard mt-4 rounded-[1.45rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Best argument you missed
                </p>
                <p className="theme-strong mt-2 text-sm leading-6">
                  {report.missedOpportunities[0].missedArgument}
                </p>
                <p className="theme-copy mt-3 text-sm leading-6">
                  {report.missedOpportunities[0].betterVersion}
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                disabled={isRouting}
                onClick={replayDebateBetter}
                className="theme-button-primary inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
              >
                Replay With This Fix
              </button>
            </div>
          </section>
        </section>

        <ResultsReportPanels analysis={report} session={session} />

        <section
          id="transcript"
          className="theme-panel scroll-mt-28 rounded-[2.1rem] border p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="theme-muted text-xs uppercase tracking-[0.3em]">
                Transcript Tail
              </p>
              <h2 className="mt-2 text-2xl font-semibold">The last exchange that shaped the read</h2>
            </div>
            <p className="theme-copy max-w-xl text-sm leading-6">
              This is the closing pocket of the round the report is reacting to, so you can
              connect every coaching point back to actual debate language.
            </p>
          </div>

          {transcriptPreview.length > 0 ? (
            <div className="report-transcript-scroll mt-6 space-y-3">
              {transcriptPreview.map((message) => (
                <article
                  key={message.id}
                  className={cx(
                    "rounded-[1.55rem] border p-5",
                    message.speaker === "You"
                      ? "theme-chat-user"
                      : "theme-chat-opponent",
                  )}
                >
                  <p className="theme-muted text-xs font-medium uppercase tracking-[0.28em]">
                    {message.speaker}
                  </p>
                  <p className="theme-strong mt-3 break-words text-base leading-7">
                    {message.text}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="theme-surface mt-6 rounded-[1.55rem] border p-5">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Transcript unavailable
              </p>
              <p className="theme-copy mt-3 text-sm leading-6">
                This report still rendered from the saved analysis, but there was no
                local transcript tail available to show here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
