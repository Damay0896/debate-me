"use client";

import Link from "next/link";
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
import {
  loadActiveSessionId,
  loadAnalysisRecord,
  listStoredSessions,
} from "@/lib/debate-storage";

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
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [isPending, startTransition] = useTransition();
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
    <main className="compact-home px-6 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
            Does your argument survive pressure?
          </h1>
          <p className="theme-copy mt-4 text-lg">Take a side. Make your case. Find out what holds up.</p>
        </header>

        <section id="room-setup" className="theme-card rounded-xl border p-5 sm:p-7">
          <label htmlFor="topic" className="mb-3 block text-sm font-semibold">Your topic</label>
          <textarea id="topic" rows={2} value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="theme-input w-full rounded-lg border p-4 text-lg"
            placeholder={DEFAULT_TOPIC} />
          <details className="mt-3">
            <summary className="theme-muted cursor-pointer text-sm">Need a topic?</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTER_TOPICS.map((item) => (
                <button key={item} type="button" onClick={() => setTopic(item)}
                  className="theme-button-secondary rounded-lg border px-3 py-2 text-sm">{item}</button>
              ))}
            </div>
          </details>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">Your side
              <select value={sideChoice} onChange={(event) => setSideChoice(event.target.value as SideChoice)}
                className="theme-input mt-2 block w-full rounded-lg border p-3">
                {SIDE_CHOICES.map((side) => <option key={side} value={side}>{side === "Pro" ? "For" : side === "Con" ? "Against" : "Surprise me"}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Opponent
              <select value={opponentPersonality} onChange={(event) => setOpponentPersonality(event.target.value as OpponentPersonality)}
                className="theme-input mt-2 block w-full rounded-lg border p-3">
                {OPPONENT_PERSONALITY_GROUPS.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.personalities.map((personality) => <option key={personality} value={personality}>{getOpponentPersonalityMeta(personality).label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <details className="mt-5 border-t border-[var(--border)] pt-4">
            <summary className="theme-copy cursor-pointer text-sm">Round options</summary>
            <div className="mt-4 flex flex-wrap items-end gap-5">
              <label className="text-sm">Reply length
                <select value={replyStyle} onChange={(event) => setReplyStyle(event.target.value as ReplyStyle)}
                  className="theme-input mt-2 block rounded-lg border p-3">
                  {REPLY_STYLES.map((style) => <option key={style} value={style}>{getReplyStyleMeta(style).label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 py-3 text-sm">
                <input type="checkbox" checked={liveFeedbackMode} onChange={(event) => setLiveFeedbackMode(event.target.checked)} />
                Live coach feedback
              </label>
            </div>
          </details>
          <button type="button" disabled={isPending} onClick={launchDebate}
            className="theme-button-primary mt-6 w-full rounded-lg px-5 py-3 font-semibold disabled:opacity-60">
            {isPending ? "Starting..." : "Start debate"}
          </button>
        </section>

        {recentRounds.length > 0 && (
          <details className="mt-8">
            <summary className="theme-copy cursor-pointer text-sm">Recent rounds ({recentRounds.length})</summary>
            <div className="mt-3 divide-y divide-[var(--border)]">
              {recentRounds.map((round) => (
                <article key={round.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{round.topic}</p>
                    <p className="theme-muted mt-1 text-xs">{round.persona} · {formatRelativeTime(round.updatedAt)}</p>
                  </div>
                  <Link href={`/debate?session=${round.sessionId}`} className="text-sm underline underline-offset-4">Resume</Link>
                  <Link href={`/results?session=${round.sessionId}`} className="text-sm underline underline-offset-4">Report</Link>
                </article>
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
