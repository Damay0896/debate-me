"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  appendMessage,
  buildFallbackOpponentReply,
  createMessage,
  createSession,
  getDebateInputPlaceholder,
  getOpponentPersonalityMeta,
  getOpponentThinkingCopy,
  getReplyStyleMeta,
  type DebateSession,
  type OpponentPersonality,
  type ReplyStyle,
  type SideChoice,
} from "@/lib/debate";
import { loadSession, saveSession } from "@/lib/debate-storage";

type DebateExperienceProps = {
  initialSessionId: string;
  initialOpponentPersonality: OpponentPersonality;
  initialReplyStyle: ReplyStyle;
  initialSideChoice: SideChoice;
  initialTopic: string;
  initialCoachFocus: string;
};

function getInitialSession(
  initialSessionId: string,
  initialOpponentPersonality: OpponentPersonality,
  initialReplyStyle: ReplyStyle,
  initialSideChoice: SideChoice,
  initialTopic: string,
) {
  return (
    (initialSessionId.trim() !== "" ? loadSession(initialSessionId) : null) ??
    createSession({
      sessionId: initialSessionId || undefined,
      opponentPersonality: initialOpponentPersonality,
      replyStyle: initialReplyStyle,
      topic: initialTopic,
      sideChoice: initialSideChoice,
    })
  );
}

export default function DebateExperience({
  initialSessionId,
  initialOpponentPersonality,
  initialReplyStyle,
  initialSideChoice,
  initialTopic,
  initialCoachFocus,
}: DebateExperienceProps) {
  const router = useRouter();
  const [session, setSession] = useState<DebateSession>(() =>
    getInitialSession(
      initialSessionId,
      initialOpponentPersonality,
      initialReplyStyle,
      initialSideChoice,
      initialTopic,
    ),
  );
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRouting, startTransition] = useTransition();
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    router.prefetch("/results");
  }, [router]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.messages.length, isThinking]);

  async function sendMessage() {
    if (!session || input.trim() === "" || isThinking) {
      return;
    }

    const userMessage = createMessage("You", input);
    const optimisticSession = appendMessage(session, userMessage);

    setSession(optimisticSession);
    setInput("");
    setError(null);
    setIsThinking(true);

    try {
      const response = await fetch("/api/debate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: optimisticSession,
        }),
      });

      const data = (await response.json()) as { reply?: string };
      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : buildFallbackOpponentReply(optimisticSession);

      setSession(appendMessage(optimisticSession, createMessage("AI Opponent", reply)));
    } catch {
      setError("Connection hiccup. The local fallback opponent took over.");
      setSession(
        appendMessage(
          optimisticSession,
          createMessage("AI Opponent", buildFallbackOpponentReply(optimisticSession)),
        ),
      );
    } finally {
      setIsThinking(false);
    }
  }

  function openResults() {
    startTransition(() => {
      router.push(`/results?session=${session.id}`);
    });
  }

  const userTurns = session.messages.filter((message) => message.speaker === "You").length;
  const opponentPersonality = getOpponentPersonalityMeta(session.opponentPersonality);
  const replyStyle = getReplyStyleMeta(session.replyStyle);

  return (
    <main className="min-h-screen px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="theme-card rounded-[2rem] border p-6 backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="theme-kicker text-sm uppercase tracking-[0.35em]">
                Live Debate Room
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-balance">
                {session.topic}
              </h1>
              <p className="theme-copy mt-3 max-w-3xl text-base leading-7">
                {opponentPersonality.label}-inspired mode is active, so the
                opponent will pressure you with{" "}
                {opponentPersonality.description.toLowerCase()}. Replies are set
                to {replyStyle.label.toLowerCase()}.
              </p>
              <div className="theme-copy mt-4 flex flex-wrap gap-3 text-sm">
                <span className="theme-pill rounded-full border px-4 py-2">
                  You: {session.userSide}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  Opponent: {session.opponentSide}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  Persona: {opponentPersonality.label}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  Mode: {replyStyle.label}
                </span>
                <span className="theme-pill rounded-full border px-4 py-2">
                  {userTurns} user turn{userTurns === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="theme-button-secondary rounded-full border px-5 py-3 text-sm font-medium transition"
              >
                Back to lobby
              </Link>
              <button
                type="button"
                disabled={isRouting}
                onClick={openResults}
                className="theme-button-primary rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60"
              >
                View results
              </button>
            </div>
          </div>
        </header>

        {initialCoachFocus.trim() ? (
          <section className="theme-panel report-rise rounded-[1.8rem] border p-5">
            <p className="theme-kicker text-xs uppercase tracking-[0.3em]">
              Replay Focus
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Fix the last round on purpose.</h2>
            <p className="theme-copy mt-3 max-w-4xl text-base leading-7">
              {initialCoachFocus}
            </p>
          </section>
        ) : null}

        <section className="theme-panel rounded-[2rem] border p-4 md:p-6">
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {session.messages.map((message) => {
              const isUser = message.speaker === "You";

              return (
                <article
                  key={message.id}
                  className={`mb-4 rounded-[1.6rem] border p-5 ${
                    isUser
                      ? "theme-chat-user ml-auto max-w-3xl"
                      : "theme-chat-opponent mr-auto max-w-3xl"
                  }`}
                >
                  <p className="theme-muted text-xs font-medium uppercase tracking-[0.28em]">
                    {message.speaker}
                  </p>
                  <p className="theme-strong mt-3 text-base leading-7">
                    {message.text}
                  </p>
                </article>
              );
            })}

            {isThinking && (
              <article className="theme-chat-opponent mb-4 mr-auto max-w-3xl rounded-[1.6rem] border p-5">
                <p className="theme-muted text-xs font-medium uppercase tracking-[0.28em]">
                  AI Opponent
                </p>
                <p className="theme-strong mt-3 text-base leading-7">
                  {getOpponentThinkingCopy(session)}
                </p>
              </article>
            )}

            <div ref={transcriptEndRef} />
          </div>

          <div className="theme-surface mt-4 rounded-[1.8rem] border p-4">
            <label
              htmlFor="argument"
              className="theme-copy mb-3 block text-sm font-medium"
            >
              Your next argument
            </label>
            <textarea
              id="argument"
              rows={5}
              className="theme-input w-full rounded-[1.5rem] border px-4 py-4 text-base outline-none transition"
              placeholder={getDebateInputPlaceholder(session.replyStyle)}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="theme-muted text-sm">
                Tip: use Ctrl/Cmd + Enter to send a turn.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isThinking}
                  onClick={() => {
                    setInput("");
                    setError(null);
                  }}
                  className="theme-button-secondary rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
                >
                  Clear draft
                </button>
                <button
                  type="button"
                  disabled={isThinking || input.trim() === ""}
                  onClick={() => {
                    void sendMessage();
                  }}
                  className="theme-button-primary rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isThinking ? "Opponent thinking..." : "Send argument"}
                </button>
              </div>
            </div>

            {error ? (
              <p className="theme-error mt-4 text-sm">{error}</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
