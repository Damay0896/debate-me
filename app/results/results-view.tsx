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
  type DebateAnalysis,
  type DebateSession,
} from "@/lib/debate";
import {
  loadActiveSession,
  loadAnalysis,
  loadSession,
  saveAnalysis,
} from "@/lib/debate-storage";

import { ResultsReportPanels } from "./report-panels";

type ResultsViewProps = {
  initialSessionId: string;
};

type AnalyzeResponse = {
  analysis?: DebateAnalysis;
  source?: "heuristic" | "openrouter";
};

function getStoredSession(initialSessionId: string) {
  return (
    (initialSessionId.trim() !== "" ? loadSession(initialSessionId) : null) ??
    loadActiveSession()
  );
}

function getFallbackAnalysis(session: DebateSession) {
  return buildHeuristicAnalysis(session);
}

function hasStoredAnalysis(session: DebateSession) {
  return loadAnalysis(session.id) !== null;
}

function subscribeToHydration() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

export default function ResultsView({ initialSessionId }: ResultsViewProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const session = useMemo(
    () => (isClient ? getStoredSession(initialSessionId) : null),
    [initialSessionId, isClient],
  );
  const storedAnalysis = useMemo(
    () => (session ? loadAnalysis(session.id) : null),
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

    return storedAnalysis
      ? coerceDebateAnalysis(storedAnalysis, fallbackAnalysis)
      : fallbackAnalysis;
  }, [fallbackAnalysis, session, storedAnalysis]);
  const hadCachedAnalysis = session ? hasStoredAnalysis(session) : false;
  const sessionKey = session
    ? `${session.id}:${session.updatedAt}:${session.messages.length}`
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
  const [isRouting, startTransition] = useTransition();

  useEffect(() => {
    if (!session || !fallbackAnalysis || hadCachedAnalysis) {
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
        saveAnalysis(activeSession.id, nextAnalysis);
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
        saveAnalysis(activeSession.id, activeFallbackAnalysis);
      }
    }

    void requestAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [fallbackAnalysis, hadCachedAnalysis, session, sessionKey]);

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
      : "heuristic";
  const error =
    remoteAnalysis.sessionKey === sessionKey ? remoteAnalysis.error : null;
  const isLoading = !hadCachedAnalysis && remoteAnalysis.sessionKey !== sessionKey;
  const report = liveAnalysis ?? reportFromStorage ?? getFallbackAnalysis(session);
  const userMessages = session.messages.filter((message) => message.speaker === "You");
  const transcriptPreview = session.messages.slice(-4);
  const totalWords = userMessages.reduce(
    (count, message) => count + message.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const opponentPersonality = getOpponentPersonalityMeta(session.opponentPersonality);
  const replyStyle = getReplyStyleMeta(session.replyStyle);
  const reportLabel = isLoading
    ? "Refreshing with deeper coaching"
    : analysisSource === "openrouter"
      ? "AI coach + instant scoring"
      : hadCachedAnalysis
        ? "Saved coaching report"
        : "Instant scoring report";
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

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="theme-kicker text-sm uppercase tracking-[0.35em]">
                Debate Report
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-balance">
                {session.topic}
              </h1>
              <p className="theme-copy mt-3 text-lg">
                You argued the {session.userSide.toLowerCase()} side against the{" "}
                {session.opponentSide.toLowerCase()} side with the{" "}
                {opponentPersonality.label}-inspired mode in {replyStyle.label} mode.
              </p>
              <div className="theme-copy mt-4 flex flex-wrap gap-3 text-sm">
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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isRouting}
                onClick={() => {
                  startTransition(() => {
                    router.push(
                      `/debate?session=${session.id}&topic=${encodeURIComponent(
                        session.topic,
                      )}&side=${session.userSide}&personality=${session.opponentPersonality}&style=${session.replyStyle}`,
                    );
                  });
                }}
                className="theme-button-secondary rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
              >
                Continue debate
              </button>
              <button
                type="button"
                disabled={isRouting}
                onClick={() => {
                  startTransition(() => {
                    router.push(
                      `/debate?session=${createId("session")}&topic=${encodeURIComponent(
                        session.topic,
                      )}&side=${session.userSide}&personality=${session.opponentPersonality}&style=${session.replyStyle}&focus=${encodeURIComponent(report.replayFocus)}`,
                    );
                  });
                }}
                className="theme-button-secondary rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
              >
                Replay the Debate Better
              </button>
              <Link
                href="/"
                className="theme-button-primary rounded-full px-5 py-3 text-sm font-semibold transition"
              >
                New topic
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="theme-panel report-hero relative overflow-hidden rounded-[2.2rem] border p-6">
            <div className="report-hero-glow absolute inset-x-0 top-0 h-40 opacity-80" />
            <div className="relative">
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
                  <h2 className="mt-2 text-4xl font-semibold">{report.verdict}</h2>
                </div>
              </div>

              <p className="theme-copy mt-6 max-w-3xl text-base leading-7">
                {report.winnerReasoning}
              </p>
              <p className="theme-muted mt-4 text-sm">{reportLabel}</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="theme-surface rounded-3xl border p-4">
                  <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                    Your turns
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{userMessages.length}</p>
                </div>
                <div className="theme-surface rounded-3xl border p-4">
                  <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                    Total words
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{totalWords}</p>
                </div>
                <div className="theme-surface rounded-3xl border p-4">
                  <p className="theme-muted text-sm uppercase tracking-[0.22em]">
                    Overall score
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{report.score}</p>
                </div>
              </div>

              {error ? <p className="theme-error mt-5 text-sm">{error}</p> : null}
              {isLoading ? (
                <p className="theme-muted mt-5 text-sm">
                  Refreshing the report with deeper coaching...
                </p>
              ) : null}
            </div>
          </section>

          <section className="theme-card rounded-[2rem] border p-6 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.32em]">
              Round Snapshot
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Why the round landed there</h2>
            <p className="theme-copy mt-4 text-base leading-7">{report.summary}</p>

            <div className="mt-6 grid gap-3">
              {report.highlights.map((item, index) => (
                <div
                  key={item}
                  className="theme-surface rounded-[1.4rem] border px-4 py-4"
                >
                  <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                    Highlight {index + 1}
                  </p>
                  <p className="theme-strong mt-2 text-base leading-6">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <section className="theme-card report-rise rounded-[1.8rem] border p-5 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.28em]">
              Strongest Argument
            </p>
            <p className="theme-strong mt-4 text-base leading-7">
              {report.strongestArgument}
            </p>
          </section>

          <section className="theme-card report-rise rounded-[1.8rem] border p-5 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.28em]">
              Your Biggest Mistake
            </p>
            <p className="theme-strong mt-4 text-base leading-7">
              {report.biggestUserMistake}
            </p>
          </section>

          <section className="theme-card report-rise rounded-[1.8rem] border p-5 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.28em]">
              AI Opponent Mistake
            </p>
            <p className="theme-strong mt-4 text-base leading-7">
              {report.biggestOpponentMistake}
            </p>
          </section>

          <section className="theme-card report-rise rounded-[1.8rem] border p-5 backdrop-blur">
            <p className="theme-muted text-xs uppercase tracking-[0.28em]">
              Flip Sentence
            </p>
            <p className="theme-strong mt-4 text-base leading-7">
              {report.flipSentence}
            </p>
          </section>
        </section>

        <ResultsReportPanels analysis={report} />

        <section className="theme-panel rounded-[2rem] border p-6">
          <h2 className="text-2xl font-semibold">Transcript tail</h2>
          <div className="mt-5 space-y-3">
            {transcriptPreview.map((message) => (
              <article
                key={message.id}
                className="theme-surface rounded-[1.4rem] border p-4"
              >
                <p className="theme-muted text-xs font-medium uppercase tracking-[0.28em]">
                  {message.speaker}
                </p>
                <p className="theme-strong mt-3 text-base leading-7">
                  {message.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
