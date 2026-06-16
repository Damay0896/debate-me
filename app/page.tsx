"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  DEFAULT_OPPONENT_PERSONALITY,
  DEFAULT_REPLY_STYLE,
  DEFAULT_TOPIC,
  OPPONENT_PERSONALITY_GROUPS,
  REPLY_STYLES,
  SIDE_CHOICES,
  STARTER_TOPICS,
  createId,
  getOpponentPersonalityMeta,
  getReplyStyleMeta,
  normalizeTopic,
  resolveDebateSide,
  type OpponentPersonality,
  type ReplyStyle,
  type SideChoice,
} from "@/lib/debate";
import {
  loadActiveSessionId,
  loadAnalysisRecord,
  listStoredSessions,
} from "@/lib/debate-storage";
import { HOW_IT_WORKS_STEPS, ORIGIN_NOTES, SAMPLE_TESTIMONIALS } from "@/lib/site-content";

const sideCopy: Record<SideChoice, string> = {
  Pro: "You'll defend the statement.",
  Con: "You'll challenge the statement.",
  Random: "We will assign your side at launch.",
};

type RecentRound = {
  active: boolean;
  analysisSummary: string | null;
  liveFeedbackMode: boolean;
  result: "win" | "loss" | "tie" | "live";
  score: number | null;
  sessionId: string;
  topic: string;
  turns: number;
  updatedAt: string;
  winner: string | null;
  mode: string;
  persona: string;
};

const EXPLORE_PAGES = [
  {
    href: "/about",
    label: "About",
    description: "What the app is for, who it helps, and what it actually trains.",
  },
  {
    href: "/why-we-built-this",
    label: "Why We Built This",
    description: "The origin story, the frustrations, and the design bets behind the app.",
  },
  {
    href: "/how-it-works",
    label: "How It Works",
    description: "A clean walkthrough of the setup, live round, and premium report flow.",
  },
  {
    href: "/testimonials",
    label: "Testimonials",
    description: "Illustrative praise and quick social-proof flavor for the product.",
  },
] as const;

function formatRelativeTime(value: string) {
  const then = new Date(value).getTime();

  if (Number.isNaN(then)) {
    return "Updated recently";
  }

  const diffMs = then - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 36) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [sideChoice, setSideChoice] = useState<SideChoice>("Pro");
  const [opponentPersonality, setOpponentPersonality] =
    useState<OpponentPersonality>(DEFAULT_OPPONENT_PERSONALITY);
  const [replyStyle, setReplyStyle] = useState<ReplyStyle>(DEFAULT_REPLY_STYLE);
  const [liveFeedbackMode, setLiveFeedbackMode] = useState(false);
  const [personalityQuery, setPersonalityQuery] = useState("");
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [isPending, startTransition] = useTransition();
  const selectedPersonalityMeta = useMemo(
    () => getOpponentPersonalityMeta(opponentPersonality),
    [opponentPersonality],
  );
  const selectedReplyStyleMeta = useMemo(
    () => getReplyStyleMeta(replyStyle),
    [replyStyle],
  );

  const normalizedPersonalityQuery = personalityQuery.trim().toLowerCase();
  const visiblePersonalityGroups = OPPONENT_PERSONALITY_GROUPS.map((group) => ({
    ...group,
    personalities: group.personalities.filter((personality) => {
      const meta = getOpponentPersonalityMeta(personality);
      const searchText = `${personality} ${meta.label} ${meta.description}`.toLowerCase();

      return (
        normalizedPersonalityQuery === "" ||
        searchText.includes(normalizedPersonalityQuery)
      );
    }),
  })).filter((group) => group.personalities.length > 0);

  useEffect(() => {
    router.prefetch("/debate");
  }, [router]);

  useEffect(() => {
    function hydrateRecentRounds() {
      const activeSessionId = loadActiveSessionId();
      const sessions = listStoredSessions().slice(0, 6);
      const nextRecentRounds = sessions.map((session) => {
        const analysisRecord = loadAnalysisRecord(session.id);
        const analysis = analysisRecord?.analysis ?? null;
        const turnCount = session.messages.filter(
          (message) => message.speaker === "You",
        ).length;

        return {
          active: session.id === activeSessionId,
          analysisSummary: analysis?.summary ?? null,
          result: analysis?.result ?? (turnCount > 0 ? "live" : "tie"),
          score: analysis?.score ?? null,
          sessionId: session.id,
          liveFeedbackMode: session.liveFeedbackMode,
          topic: session.topic,
          turns: turnCount,
          updatedAt: session.updatedAt,
          winner: analysis?.winner ?? null,
          mode: getReplyStyleMeta(session.replyStyle).label,
          persona: getOpponentPersonalityMeta(session.opponentPersonality).label,
        } satisfies RecentRound;
      });

      setRecentRounds(nextRecentRounds);
    }

    hydrateRecentRounds();
    window.addEventListener("focus", hydrateRecentRounds);
    window.addEventListener("storage", hydrateRecentRounds);

    return () => {
      window.removeEventListener("focus", hydrateRecentRounds);
      window.removeEventListener("storage", hydrateRecentRounds);
    };
  }, []);

  function launchDebate() {
    const normalizedTopic = normalizeTopic(topic);
    const resolvedSide = resolveDebateSide(sideChoice);
    const params = new URLSearchParams({
      topic: normalizedTopic,
      side: resolvedSide,
      personality: opponentPersonality,
      session: createId("session"),
      style: replyStyle,
      coach: liveFeedbackMode ? "1" : "0",
    });

    startTransition(() => {
      router.push(`/debate?${params.toString()}`);
    });
  }

  return (
    <main className="min-h-screen px-6 py-10 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="theme-card flex flex-col justify-between rounded-[2rem] border p-8 backdrop-blur md:p-10">
          <div>
            <p className="theme-kicker mb-4 text-sm font-medium uppercase tracking-[0.35em]">
              Practice Live Rebuttals
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-balance md:text-7xl">
              Debate like the room is watching.
            </h1>
            <p className="theme-copy mt-6 max-w-2xl text-lg leading-8">
              Pick a claim, choose a side, and get pressed by an opponent that
              fights back. When the round ends, you get a quick coaching report
              instead of a placeholder screen.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="theme-surface rounded-3xl border p-5">
              <p className="theme-muted text-sm uppercase tracking-[0.2em]">
                Instant Setup
              </p>
              <p className="mt-3 text-xl font-medium">
                Start from a topic seed or write your own motion.
              </p>
            </div>
            <div className="theme-surface rounded-3xl border p-5">
              <p className="theme-muted text-sm uppercase tracking-[0.2em]">
                Pressure Test
              </p>
              <p className="mt-3 text-xl font-medium">
                The opponent challenges weak evidence, logic, and tradeoffs.
              </p>
            </div>
            <div className="theme-surface rounded-3xl border p-5">
              <p className="theme-muted text-sm uppercase tracking-[0.2em]">
                Scorecard
              </p>
              <p className="mt-3 text-xl font-medium">
                Finish the round and get strengths, weaknesses, and next drills.
              </p>
            </div>
          </div>
        </section>

        <section className="theme-panel rounded-[2rem] border p-8 md:p-10">
          <p className="theme-kicker text-sm font-medium uppercase tracking-[0.35em]">
            New Round
          </p>
          <h2 className="mt-4 text-3xl font-semibold">Build your matchup.</h2>

          <div className="mt-8">
            <label htmlFor="topic" className="theme-copy mb-3 block text-sm font-medium">
              Debate topic
            </label>
            <textarea
              id="topic"
              rows={4}
              className="theme-input w-full rounded-3xl border px-5 py-4 text-lg outline-none transition"
              placeholder={DEFAULT_TOPIC}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {STARTER_TOPICS.map((starterTopic) => (
              <button
                key={starterTopic}
                type="button"
                onClick={() => setTopic(starterTopic)}
                className="theme-button-secondary rounded-full border px-4 py-2 text-sm transition"
              >
                {starterTopic}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <p className="theme-copy mb-3 text-sm font-medium">Your side</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {SIDE_CHOICES.map((choice) => {
                const isActive = sideChoice === choice;

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setSideChoice(choice)}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "theme-option-active"
                        : "theme-option"
                    }`}
                  >
                    <span className="block text-lg font-semibold">{choice}</span>
                    <span className="theme-option-copy mt-1 block text-sm">
                      {sideCopy[choice]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="theme-copy mb-3 text-sm font-medium">
                  Opponent personality
                </p>
                <p className="theme-muted text-sm">
                  Pick from a much larger roster of public-figure-inspired debate modes without changing the side.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="personality-search" className="sr-only">
                Search personalities
              </label>
              <input
                id="personality-search"
                type="text"
                value={personalityQuery}
                onChange={(event) => setPersonalityQuery(event.target.value)}
                placeholder="Search personalities, styles, or labels..."
                className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
              />
            </div>

            <div className="mt-4 max-h-[32rem] space-y-5 overflow-y-auto pr-2">
              {visiblePersonalityGroups.length === 0 ? (
                <div className="theme-surface rounded-3xl border px-4 py-5">
                  <p className="text-base font-semibold">
                    No personality matches that search.
                  </p>
                  <p className="theme-muted mt-2 text-sm">
                    Try a name like AOC, Obama, Fuentes, Reagan, or Hitchens.
                  </p>
                </div>
              ) : (
                visiblePersonalityGroups.map((group) => (
                  <section key={group.id}>
                    <p className="theme-kicker mb-3 text-xs uppercase tracking-[0.28em]">
                      {group.label}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.personalities.map((personality) => {
                        const meta = getOpponentPersonalityMeta(personality);
                        const isActive = opponentPersonality === personality;

                        return (
                          <button
                            key={personality}
                            type="button"
                            onClick={() => setOpponentPersonality(personality)}
                            className={`rounded-3xl border px-4 py-4 text-left transition ${
                              isActive ? "theme-option-active" : "theme-option"
                            }`}
                          >
                            <span className="block text-lg font-semibold">
                              {meta.label}
                            </span>
                            <span className="theme-option-copy mt-1 block text-sm leading-6">
                              {meta.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>

          <div className="mt-8">
            <p className="theme-copy mb-3 text-sm font-medium">Reply mode</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {REPLY_STYLES.map((style) => {
                const meta = getReplyStyleMeta(style);
                const isActive = replyStyle === style;

                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setReplyStyle(style)}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      isActive ? "theme-option-active" : "theme-option"
                    }`}
                  >
                    <span className="block text-lg font-semibold">
                      {meta.label}
                    </span>
                    <span className="theme-option-copy mt-1 block text-sm leading-6">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="theme-surface mt-8 rounded-[1.8rem] border p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <p className="theme-kicker text-xs uppercase tracking-[0.28em]">
                  Sparring Coach
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  Live turn scoring and weak-point detection
                </h3>
                <p className="theme-copy mt-3 text-sm leading-6">
                  Turn this on if you want every live draft scored, critiqued in one
                  sentence, and paired with the cleanest place to hit the opponent after
                  they answer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiveFeedbackMode((current) => !current)}
                className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  liveFeedbackMode ? "theme-option-active" : "theme-button-secondary"
                }`}
              >
                {liveFeedbackMode ? "Sparring Coach on" : "Turn on Sparring Coach"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  After you type
                </p>
                <p className="theme-copy mt-2 text-sm leading-6">
                  The app scores the turn live and gives one short coach critique.
                </p>
              </div>
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  After they answer
                </p>
                <p className="theme-copy mt-2 text-sm leading-6">
                  You get a `hit here hardest` read on the opponent&apos;s latest point.
                </p>
              </div>
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Best use
                </p>
                <p className="theme-copy mt-2 text-sm leading-6">
                  Great for practice rounds when you want fast correction instead of only end-of-round feedback.
                </p>
              </div>
            </div>
          </div>

          <div className="theme-surface mt-8 rounded-[1.8rem] border p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <p className="theme-kicker text-xs uppercase tracking-[0.28em]">
                  Opponent scouting report
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  {selectedPersonalityMeta.label} in {selectedReplyStyleMeta.label} mode
                </h3>
                <p className="theme-copy mt-3 text-sm leading-6">
                  {selectedReplyStyleMeta.description} Expect {selectedPersonalityMeta.label} to
                  push with {selectedPersonalityMeta.description.toLowerCase()}
                </p>
              </div>
              <span className="theme-pill rounded-full border px-4 py-2 text-sm">
                Best prep: claim, warrant, impact
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Likely pressure points
                </p>
                <div className="mt-3 space-y-3">
                  {selectedPersonalityMeta.followUps.slice(0, 3).map((item) => (
                    <div key={item} className="report-list-item">
                      <span className="report-list-dot bg-[var(--accent)]" />
                      <span className="theme-copy text-sm leading-6">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-subcard rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  What wins this matchup
                </p>
                <div className="mt-3 space-y-3">
                  {selectedPersonalityMeta.argumentHabits.slice(0, 3).map((item) => (
                    <div key={item} className="report-list-item">
                      <span className="report-list-dot bg-emerald-400/80" />
                      <span className="theme-copy text-sm leading-6">
                        Beat this by directly answering: {item.charAt(0).toLowerCase()}
                        {item.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={launchDebate}
            className="theme-button-primary mt-10 inline-flex w-full items-center justify-center rounded-full px-6 py-4 text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Preparing the round..." : "Start debate"}
          </button>

          <p className="theme-muted mt-4 text-sm">
            You can keep the topic blank if you want the default motion.
          </p>
        </section>
      </div>

      {recentRounds.length > 0 ? (
        <section className="mx-auto mt-8 max-w-6xl">
          <div className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="theme-kicker text-xs uppercase tracking-[0.32em]">
                  Round history
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Jump back into your best work</h2>
              </div>
              <p className="theme-copy max-w-2xl text-sm leading-6">
                Recent rounds stay on this device so you can resume live debates, reopen reports,
                and replay good matchups without rebuilding the setup.
              </p>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {recentRounds.map((round) => {
                const badgeClass =
                  round.result === "win"
                    ? "theme-status-anchor"
                    : round.result === "loss"
                      ? "theme-status-collapse"
                      : round.result === "live"
                        ? "theme-flag-low"
                        : "theme-status-developing";
                const badgeLabel =
                  round.result === "live"
                    ? "Live round"
                    : round.result === "tie"
                      ? "Tie"
                      : round.result.toUpperCase();

                return (
                  <article
                    key={round.sessionId}
                    className="theme-surface rounded-[1.6rem] border p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                          {round.active ? (
                            <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em]">
                              Current session
                            </span>
                          ) : null}
                          {round.liveFeedbackMode ? (
                            <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em]">
                              Sparring Coach
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold">{round.topic}</h3>
                        <p className="theme-copy mt-3 text-sm leading-6">
                          {round.persona} in {round.mode} mode. {round.turns} user turn
                          {round.turns === 1 ? "" : "s"} logged. Updated{" "}
                          {formatRelativeTime(round.updatedAt)}.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                          Score
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {round.score ?? "--"}
                        </p>
                      </div>
                    </div>

                    <div className="theme-subcard mt-5 rounded-[1.3rem] border p-4">
                      <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                        Stored coach read
                      </p>
                      <p className="theme-copy mt-2 text-sm leading-6">
                        {round.analysisSummary ??
                          "No full report saved yet. Resume the round or open it to generate feedback."}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/debate?session=${round.sessionId}`}
                        className="theme-button-secondary inline-flex rounded-full border px-4 py-2 text-sm font-medium transition"
                      >
                        Resume round
                      </Link>
                      <Link
                        href={`/results?session=${round.sessionId}`}
                        className="theme-button-primary inline-flex rounded-full px-4 py-2 text-sm font-semibold transition"
                      >
                        Open report
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-8 max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
            <p className="theme-kicker text-xs uppercase tracking-[0.32em]">Explore Debate Me</p>
            <h2 className="mt-3 text-3xl font-semibold">
              More than a single landing page now.
            </h2>
            <p className="theme-copy mt-4 max-w-2xl text-sm leading-7">
              If someone lands here and wants more context, there are now proper pages for the
              story, the workflow, and the kind of people this product is built for.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {EXPLORE_PAGES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="theme-surface rounded-[1.5rem] border p-5 transition hover:-translate-y-0.5"
                >
                  <p className="text-lg font-semibold">{item.label}</p>
                  <p className="theme-copy mt-3 text-sm leading-7">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="theme-panel rounded-[2rem] border p-6 md:p-8">
              <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Why It Exists</p>
              <h2 className="mt-3 text-3xl font-semibold">Built for sharper reps, not empty encouragement.</h2>
              <div className="mt-6 space-y-3">
                {ORIGIN_NOTES.slice(0, 2).map((item) => (
                  <div key={item.title} className="theme-subcard rounded-[1.35rem] border p-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="theme-copy mt-2 text-sm leading-7">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
              <p className="theme-kicker text-xs uppercase tracking-[0.28em]">Sample Praise</p>
              <p className="mt-3 text-lg leading-8">
                &ldquo;{SAMPLE_TESTIMONIALS[0].quote}&rdquo;
              </p>
              <p className="theme-copy mt-4 text-sm">
                {SAMPLE_TESTIMONIALS[0].name}, {SAMPLE_TESTIMONIALS[0].role}
              </p>

              <div className="mt-6 grid gap-3">
                {HOW_IT_WORKS_STEPS.slice(0, 2).map((item) => (
                  <div key={item.title} className="theme-surface rounded-[1.25rem] border p-4">
                    <p className="theme-muted text-xs uppercase tracking-[0.22em]">{item.title}</p>
                    <p className="theme-copy mt-2 text-sm leading-7">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
