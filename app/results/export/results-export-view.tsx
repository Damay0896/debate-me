"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  buildHeuristicAnalysis,
  coerceDebateAnalysis,
  getOpponentPersonalityMeta,
  getReplyStyleMeta,
  type DebateAnalysis,
  type DebateSession,
} from "@/lib/debate";
import {
  buildAnalysisSessionKey,
  loadAnalysisRecord,
  loadSession,
  needsAnalysisRefresh,
  saveAnalysis,
} from "@/lib/debate-storage";

import { buildReportInsights } from "../report-insights";

type ResultsExportViewProps = {
  autoPrint: boolean;
  initialSessionId: string;
};

type AnalyzeResponse = {
  analysis?: DebateAnalysis;
  source?: "heuristic" | "openrouter";
};

function getStoredSession(initialSessionId: string) {
  return initialSessionId.trim() !== "" ? loadSession(initialSessionId) : null;
}

function subscribeToHydration() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

function getFallbackAnalysis(session: DebateSession) {
  return buildHeuristicAnalysis(session);
}

function getDisplayWinnerLabel(winner: string) {
  if (winner === "You") {
    return "User";
  }

  return winner;
}

function cleanReplayFocus(value: string) {
  return value.replace(/^Replay focus:\s*/i, "").trim();
}

export default function ResultsExportView({
  autoPrint,
  initialSessionId,
}: ResultsExportViewProps) {
  const isClient = useIsClient();
  const hasPrintedRef = useRef(false);
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
  const shouldRefreshAnalysis =
    session && storedAnalysisRecord
      ? needsAnalysisRefresh(session, storedAnalysisRecord)
      : session !== null;
  const sessionKey = session ? buildAnalysisSessionKey(session) : "";
  const [remoteAnalysis, setRemoteAnalysis] = useState<{
    analysis: DebateAnalysis | null;
    sessionKey: string;
  }>({
    analysis: null,
    sessionKey: "",
  });

  const reportFromStorage = useMemo(() => {
    if (!session || !fallbackAnalysis) {
      return null;
    }

    return storedAnalysisRecord?.analysis
      ? coerceDebateAnalysis(storedAnalysisRecord.analysis, fallbackAnalysis)
      : fallbackAnalysis;
  }, [fallbackAnalysis, session, storedAnalysisRecord]);

  useEffect(() => {
    if (!session || !fallbackAnalysis || !shouldRefreshAnalysis) {
      return;
    }

    const activeSession = session;
    const activeFallbackAnalysis = fallbackAnalysis;
    const activeSessionKey = sessionKey;
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
          sessionKey: activeSessionKey,
        });
        saveAnalysis(activeSession, nextAnalysis, source);
      } catch {
        if (isCancelled) {
          return;
        }

        setRemoteAnalysis({
          analysis: activeFallbackAnalysis,
          sessionKey: activeSessionKey,
        });
        saveAnalysis(activeSession, activeFallbackAnalysis, "heuristic");
      }
    }

    void requestAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [fallbackAnalysis, session, sessionKey, shouldRefreshAnalysis]);

  useEffect(() => {
    document.body.classList.add("export-mode");

    return () => {
      document.body.classList.remove("export-mode");
    };
  }, []);

  const hasPrintableReport =
    reportFromStorage !== null || remoteAnalysis.sessionKey === sessionKey;

  useEffect(() => {
    if (!autoPrint || hasPrintedRef.current || !hasPrintableReport) {
      return;
    }

    if (shouldRefreshAnalysis && remoteAnalysis.sessionKey !== sessionKey) {
      return;
    }

    hasPrintedRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 320);

    return () => window.clearTimeout(timer);
  }, [
    autoPrint,
    hasPrintableReport,
    remoteAnalysis.sessionKey,
    sessionKey,
    shouldRefreshAnalysis,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    document.title = `${session.topic} - Debate Me Feedback Export`;
  }, [session]);

  if (!isClient) {
    return null;
  }

  const liveReport =
    remoteAnalysis.sessionKey === sessionKey ? remoteAnalysis.analysis : null;
  const report = liveReport ?? reportFromStorage;
  const isLoading =
    shouldRefreshAnalysis && remoteAnalysis.sessionKey !== sessionKey;

  if (!session || !report) {
    return (
      <main className="export-page min-h-screen px-4 py-8">
        <div className="export-sheet mx-auto max-w-[8.27in] rounded-[1.5rem] p-8">
          <h1 className="text-3xl font-semibold">No saved feedback found</h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            Open a debate report first, then export the feedback from there.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const opponentPersonality = getOpponentPersonalityMeta(
    session.opponentPersonality,
  );
  const replyStyle = getReplyStyleMeta(session.replyStyle);
  const winnerLabel = getDisplayWinnerLabel(report.winner);
  const replayFocus = cleanReplayFocus(report.replayFocus);
  const reportInsights = buildReportInsights(session, report);

  return (
    <main className="export-page min-h-screen px-4 py-8">
      <div className="export-actions mx-auto mb-4 flex max-w-[8.27in] flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
        >
          Print / Save as PDF
        </button>
        <Link
          href={`/results?session=${session.id}`}
          className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
        >
          Back to report
        </Link>
      </div>

      <article className="export-sheet mx-auto max-w-[8.27in] rounded-[1.5rem] p-8 md:p-10">
        <header className="export-header border-b border-slate-200 pb-6">
          {isLoading ? (
            <div className="mb-5 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              Refreshing the upgraded coach analysis before export so the PDF matches
              the latest report format.
            </div>
          ) : null}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-700">
                Debate Me Feedback Export
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                {session.topic}
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {session.userSide} vs {session.opponentSide} | {opponentPersonality.label} mode |{" "}
                {replyStyle.label} replies
              </p>
            </div>

            <div className="export-score-box rounded-[1.2rem] border border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Overall score
              </p>
              <p className="mt-2 text-4xl font-semibold text-slate-950">
                {report.score}
              </p>
            </div>
          </div>
        </header>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Verdict
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <span className="export-verdict-pill rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
                {report.result}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Winner: {winnerLabel} ({report.winnerConfidence}%)
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  {report.verdict}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {report.winnerReasoning}
            </p>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Best next improvement
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              {report.bestNextImprovement.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {report.bestNextImprovement.reason}
            </p>
            <div className="mt-4 rounded-[1rem] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Replay focus
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-800">
                {replayFocus}
              </p>
            </div>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Summary
            </p>
            <p className="mt-4 text-base leading-8 text-slate-800">
              {report.summary}
            </p>
            {!reportInsights.hasTranscriptArchive ? (
              <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                This export still includes the full saved coaching report, but the
                original turn-by-turn transcript archive was not preserved for this
                round. Quote and pattern sections below are inferred from the saved
                analysis.
              </div>
            ) : null}
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Quote lab
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.quoteInsights.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {item.label}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.speaker}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Quote
                    </span>
                  </div>
                  <p className="mt-4 rounded-[0.9rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900">
                    {item.quote}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {item.note}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Speech pattern radar
            </p>
            <div className="mt-4 grid gap-4">
              {reportInsights.patternStats.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">
                      {item.label}
                    </p>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {item.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Transcript receipts
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Specific moments from the round
            </h2>
            <div className="mt-5 grid gap-4">
              {report.transcriptReceipts.map((receipt) => (
                <article
                  key={receipt.id}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {receipt.title}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {receipt.speaker}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Receipt
                    </span>
                  </div>
                  <p className="mt-4 rounded-[0.9rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900">
                    {receipt.quote}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Why it mattered
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {receipt.diagnosis}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Coach fix
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {receipt.fix}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strongest argument
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-800">
              {report.strongestArgument}
            </p>
          </div>
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Flip sentence
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-800">
              {report.flipSentence}
            </p>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Your biggest mistake
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-800">
              {report.biggestUserMistake}
            </p>
          </div>
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Opponent strongest part
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              {report.opponentCaseReview.strongestPoint}
            </h2>
            <p className="mt-4 rounded-[0.9rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900">
              {report.opponentCaseReview.strongestQuote}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Why it landed
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {report.opponentCaseReview.whyItWorked}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Best counter
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {report.opponentCaseReview.bestCounter}
            </p>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Skill breakdown
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Seven-skill scorecard
                </h2>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1rem] border border-slate-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3 font-semibold">Skill</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Coach note</th>
                  </tr>
                </thead>
                <tbody>
                  {report.metrics.map((metric) => (
                    <tr
                      key={metric.key}
                      className="border-t border-slate-200 align-top"
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        {metric.label}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                        {metric.score}
                      </td>
                      <td className="px-4 py-4 text-sm leading-6 text-slate-700">
                        {metric.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Coach feedback
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Keep doing this
                </p>
                <ul className="export-list mt-2 space-y-2">
                  {report.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Still leaking here
                </p>
                <ul className="export-list mt-2 space-y-2">
                  {report.weaknesses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Missed arguments
            </p>
            <div className="mt-4 space-y-4">
              {report.missedOpportunities.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="export-plan-index">{index + 1}</div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {item.missedArgument}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Why it was there
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {item.whyItWasAvailable}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Better version
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {item.betterVersion}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Judge ballot
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.ballotCallouts.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Replay blueprint
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.replaySteps.map((item, index) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="export-plan-index">{index + 1}</div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {item.line}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {item.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Judge simulator
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.judgePerspectives.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">
                      {item.label}
                    </p>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {item.verdict}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.note}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    How to win this ballot
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {item.nextMove}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Rematch script
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.rematchScript.map((item, index) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="export-plan-index">{index + 1}</div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {item.line}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Premise to claim structure
            </p>
            <div className="mt-5 grid gap-4">
              {report.argumentFrames.map((frame) => (
                <article
                  key={frame.id}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {frame.title}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        {frame.claim}
                      </h3>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {frame.status.replace("-", " ")}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Premises
                      </p>
                      <ul className="export-list mt-2 space-y-2">
                        {frame.premises.map((premise) => (
                          <li key={premise}>{premise}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Warrant
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {frame.warrant}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Impact
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {frame.impact}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Weak point
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {frame.vulnerability}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Next round plan
            </p>
            <ol className="mt-4 space-y-3">
              {report.nextSteps.map((item, index) => (
                <li key={item} className="export-plan-row">
                  <div className="export-plan-index">{index + 1}</div>
                  <p className="text-sm leading-6 text-slate-800">{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Pressure test
            </p>
            <div className="mt-5 grid gap-4">
              {report.collapsePoints.map((point, index) => (
                <article
                  key={`${point.title}-${index}`}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="export-plan-index">{index + 1}</div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {point.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Attack
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {point.trigger}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    One-sentence fix
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {point.repair}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Crossfire drill
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.drillQuestions.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">
                    {item.prompt}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Best answer
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {item.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Case surgery
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.caseRepairs.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {item.title}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Structural weakness
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {item.weakness}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Best repair
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {item.fix}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8 grid gap-5 md:grid-cols-2">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Counterplay lab
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.counterplayMoves.map((item) => (
                <article
                  key={`${item.title}-${item.trigger}`}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Likely trigger
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.trigger}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Why it lands
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.why}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Best answer
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Evidence upgrade
            </p>
            <div className="mt-4 space-y-4">
              {reportInsights.evidenceUpgrades.map((item) => (
                <article
                  key={`${item.title}-${item.claim}`}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.claim}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Proof needed
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.proofNeed}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Best source angle
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">{item.sourceAngle}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="export-section mt-8">
          <div className="export-card rounded-[1.3rem] border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Language tuning
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {reportInsights.languageTweaks.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Use
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">{item.useLine}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Avoid
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.avoidLine}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Why
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.reason}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
          Export generated from Debate Me feedback. Use your browser&apos;s &quot;Save as PDF&quot;
          option after pressing Print.
        </footer>
      </article>
    </main>
  );
}
