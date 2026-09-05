"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import {
  buildHeuristicAnalysis,
  coerceDebateAnalysis,
  createId,
  getOpponentPersonalityMeta,
  getReplyStyleMeta,
  sessionToTranscript,
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
import {
  buildHeuristicEvidence,
  coerceEvidenceResult,
  type EvidenceCard,
  type EvidenceRequest,
  type EvidenceResult,
} from "@/lib/research";

import { buildReportInsights } from "./report-insights";
import { ResultsReportPanels } from "./report-panels";

type ResultsViewProps = {
  initialSessionId: string;
};

type AnalyzeResponse = {
  analysis?: DebateAnalysis;
  source?: "heuristic" | "openrouter";
};

type EvidenceResponse = {
  error?: string;
  result?: EvidenceResult;
  source?: "heuristic" | "openrouter";
};

type EvidenceState = {
  error: string | null;
  result: EvidenceResult | null;
  status: "idle" | "loading" | "ready" | "error";
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
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({
    error: null,
    result: null,
    status: "idle",
  });
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);
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
  const activeSession = session;
  const winnerLabel =
    report.winner === "You"
      ? "You"
      : report.winner === "AI Opponent"
        ? "Opponent"
        : "Tie";
  const resultBanner =
    report.result === "win" ? "WIN" : report.result === "loss" ? "LOSS" : "TIE";
  const topMetric = getTopMetric(report.metrics);
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
  const topSkillValue = topMetric
    ? `${topMetric.label} ${topMetric.score}`
    : "Still forming";
  const heuristicEvidence = buildHeuristicEvidence({
    topic: activeSession.topic,
    userSide: activeSession.userSide,
    opponentSide: activeSession.opponentSide,
    transcript: sessionToTranscript(activeSession),
    focus: report.strongestArgument || activeSession.topic,
    maxCards: 8,
  });
  const displayedEvidenceState: EvidenceState =
    evidenceState.status === "loading"
      ? {
          ...evidenceState,
          result: evidenceState.result ?? heuristicEvidence,
        }
      : evidenceState.result
        ? evidenceState
        : {
            error: null,
            result: heuristicEvidence,
            status: "ready",
          };

  async function generateEvidence() {
    const evidenceRequest: EvidenceRequest = {
      topic: activeSession.topic,
      userSide: activeSession.userSide,
      opponentSide: activeSession.opponentSide,
      transcript: sessionToTranscript(activeSession),
      focus: report.strongestArgument || activeSession.topic,
      maxCards: 8,
    };
    const fallback = heuristicEvidence;

    setEvidenceState((current) => ({
      error: null,
      result: current.result,
      status: "loading",
    }));

    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request: evidenceRequest,
        }),
      });

      const data = (await response.json()) as EvidenceResponse;

      if (!response.ok) {
        throw new Error(data.error || "Evidence generation failed.");
      }

      setEvidenceState({
        error: null,
        result: coerceEvidenceResult(data.result, fallback),
        status: "ready",
      });
    } catch {
      setEvidenceState({
        error: "Live evidence was unavailable, so the report loaded research leads instead.",
        result: fallback,
        status: "ready",
      });
    }
  }

  function continueDebate() {
    startTransition(() => {
      router.push(
        `/debate?session=${activeSession.id}&topic=${encodeURIComponent(
          activeSession.topic,
        )}&side=${activeSession.userSide}&personality=${activeSession.opponentPersonality}&style=${activeSession.replyStyle}&coach=${activeSession.liveFeedbackMode ? "1" : "0"}`,
      );
    });
  }

  function replayDebateBetter() {
    startTransition(() => {
      router.push(
        `/debate?session=${createId("session")}&topic=${encodeURIComponent(
          activeSession.topic,
        )}&side=${activeSession.userSide}&personality=${activeSession.opponentPersonality}&style=${activeSession.replyStyle}&focus=${encodeURIComponent(replayFocus)}&coach=${activeSession.liveFeedbackMode ? "1" : "0"}`,
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
      `Live coach mode: ${activeSession.liveFeedbackMode ? "Private Coach" : "Standard"}`,
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

  async function copyEvidenceForReplay(card: EvidenceCard) {
    try {
      await navigator.clipboard.writeText(card.debateLine);
    } catch {
      // Silent failure keeps the report flow simple if clipboard access is denied.
    }
  }

  return (
    <main className="report-shell report-editorial px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header>
          <p className="theme-muted text-sm">Round report</p>
          <h1 className="mt-2 text-2xl font-semibold leading-snug sm:text-3xl">{session.topic}</h1>
          <p className="theme-muted mt-2 text-sm">{session.userSide} against {opponentPersonality.label} · {replyStyle.label}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={isRouting} onClick={replayDebateBetter} className="theme-button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40">Run it back with this fix</button>
            <button type="button" onClick={exportFeedbackPdf} className="theme-button-secondary rounded-lg border px-4 py-2 text-sm">Export PDF</button>
            <button type="button" disabled={isRouting} onClick={continueDebate} className="theme-muted px-2 py-2 text-sm">Resume round</button>
            <Link href="/" className="theme-muted px-2 py-2 text-sm">New topic</Link>
          </div>
        </header>
        <section className="report-verdict-line">
          <div>
            <p className="text-6xl font-semibold tracking-tight">{report.score}<span className="theme-muted text-xl font-normal"> / 100</span></p>
            <p className="theme-muted mt-2 text-xs">Pressure score</p>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold">{resultBanner} <span className="theme-muted text-sm font-normal">· {winnerLabel} · {report.winnerConfidence}% confidence</span></p>
            <p className="theme-copy mt-3 text-sm leading-7">{report.winnerReasoning}</p>
          </div>
        </section>
        <div className="theme-muted flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>{turnStatValue} {turnStatLabel.toLowerCase()}</span>
          <span>{wordStatValue} {wordStatLabel.toLowerCase()}</span>
          <span>Best skill: {topSkillValue}</span>
        </div>
        {isLoading && <p role="status" className="theme-muted text-sm">Updating analysis...</p>}
        {error && <p role="alert" className="theme-error text-sm">{error}</p>}
        <section className="report-takeaways" aria-label="Key findings">
          <article><h2>What landed</h2><p>{report.strongestArgument}</p></article>
          <article><h2>What cost you</h2><p>{report.biggestUserMistake}</p></article>
          <article className="report-main-fix"><h2>Your next move</h2><p>{report.flipSentence}</p></article>
        </section>
        <button type="button" aria-expanded={showFullBreakdown} aria-controls="full-report" onClick={() => setShowFullBreakdown((current) => !current)}
          className="theme-button-secondary rounded-lg border px-4 py-3 text-left text-sm">{showFullBreakdown ? "Hide full breakdown" : "Explore full breakdown"} <span className="theme-muted ml-2">Skills, evidence, strategy & transcript</span></button>
        {showFullBreakdown ? (
          <div id="full-report">
            <section className="theme-card report-rise rounded-[2rem] border p-5 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                    Full breakdown
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Receipts, evidence, maps, and transcript detail
                  </h2>
                  <p className="theme-copy mt-3 text-sm leading-6">
                    Open the deeper analysis when you want skill bars, argument maps, fact-check
                    review, evidence upgrades, and judge-level receipts.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    disabled={evidenceState.status === "loading"}
                    onClick={() => {
                      void generateEvidence();
                    }}
                    className="theme-button-secondary inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
                  >
                    {evidenceState.status === "loading"
                      ? "Finding evidence..."
                      : evidenceState.result
                        ? "Refresh evidence"
                        : "Generate evidence"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyReplayBrief();
                    }}
                    className="theme-button-secondary inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition"
                  >
                    {copyState === "copied"
                      ? "Replay brief copied"
                      : copyState === "failed"
                        ? "Copy failed"
                        : "Copy replay brief"}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <section className="theme-card report-rise report-feature-card rounded-[1.9rem] border p-5 backdrop-blur">
                <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                  Opponent&apos;s best shot
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {report.opponentCaseReview.strongestPoint}
                </p>
                <blockquote className="report-quote mt-4 rounded-[1.35rem] border px-4 py-4 text-sm leading-6">
                  {report.opponentCaseReview.strongestQuote}
                </blockquote>
                <p className="theme-copy mt-4 text-sm leading-6">
                  {report.opponentCaseReview.whyItWorked}
                </p>
                <div className="theme-subcard mt-4 rounded-[1.25rem] border p-4">
                  <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                    Best counter
                  </p>
                  <p className="theme-strong mt-2 text-sm leading-6">
                    {report.opponentCaseReview.bestCounter}
                  </p>
                </div>
              </section>

              {report.missedOpportunities[0] ? (
                <section className="theme-card report-rise rounded-[1.9rem] border p-5 backdrop-blur">
                  <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                    Best argument you missed
                  </p>
                  <p className="theme-strong mt-3 text-base leading-7">
                    {report.missedOpportunities[0].missedArgument}
                  </p>
                  <p className="theme-copy mt-4 text-sm leading-6">
                    {report.missedOpportunities[0].whyItWasAvailable}
                  </p>
                  <div className="theme-subcard mt-4 rounded-[1.25rem] border p-4">
                    <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                      Better version
                    </p>
                    <p className="theme-strong mt-2 text-sm leading-6">
                      {report.missedOpportunities[0].betterVersion}
                    </p>
                  </div>
                </section>
              ) : null}
            </section>

            <ResultsReportPanels
              analysis={report}
              evidenceState={displayedEvidenceState}
              onCopyEvidence={copyEvidenceForReplay}
              onGenerateEvidence={() => {
                void generateEvidence();
              }}
              session={session}
            />

            <section
              id="transcript"
              className="theme-panel scroll-mt-28 rounded-[2.1rem] border p-6"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="theme-muted text-xs uppercase tracking-[0.3em]">
                    Transcript tail
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    The exchange that shaped the read
                  </h2>
                </div>
                <p className="theme-copy max-w-xl text-sm leading-6">
                  This closing pocket is what the report is reacting to, so you can tie the
                  coaching back to actual debate language.
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
                    This report still rendered from the saved analysis, but there was no local
                    transcript tail available to show here.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
