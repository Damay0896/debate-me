"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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

const sideCopy: Record<SideChoice, string> = {
  Pro: "You'll defend the statement.",
  Con: "You'll challenge the statement.",
  Random: "We will assign your side at launch.",
};

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [sideChoice, setSideChoice] = useState<SideChoice>("Pro");
  const [opponentPersonality, setOpponentPersonality] =
    useState<OpponentPersonality>(DEFAULT_OPPONENT_PERSONALITY);
  const [replyStyle, setReplyStyle] = useState<ReplyStyle>(DEFAULT_REPLY_STYLE);
  const [personalityQuery, setPersonalityQuery] = useState("");
  const [isPending, startTransition] = useTransition();

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

  function launchDebate() {
    const normalizedTopic = normalizeTopic(topic);
    const resolvedSide = resolveDebateSide(sideChoice);
    const params = new URLSearchParams({
      topic: normalizedTopic,
      side: resolvedSide,
      personality: opponentPersonality,
      session: createId("session"),
      style: replyStyle,
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
    </main>
  );
}
