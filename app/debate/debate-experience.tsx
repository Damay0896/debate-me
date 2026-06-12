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

const evidencePattern =
  /\b(data|study|research|evidence|statistic|according to|for example|for instance|report)\b/i;
const rebuttalPattern =
  /\b(however|but|although|while|even if|that assumes|your argument|your claim|rebut|counter)\b/i;
const weighingPattern =
  /\b(outweigh|weigh|more important|more than|greater harm|bigger impact|matters more|on balance)\b/i;
const definitionPattern =
  /\b(define|definition|when i say|what i mean by|understand .* as|by .* i mean)\b/i;
const warrantPattern =
  /\b(because|since|therefore|thus|which means|this means|as a result|leads to|results in|so that)\b/i;
const impactPattern =
  /\b(harm|benefit|impact|consequence|risk|cost|matters because|means that|leads to)\b/i;
const absolutePattern =
  /\b(always|never|everyone|nobody|all|none|obviously|clearly)\b/i;
const contestedTermPattern =
  /\b(harm|good|better|fair|freedom|rights|justice|safe|dangerous|benefit|strong)\b/i;

type DebateExperienceProps = {
  initialSessionId: string;
  initialOpponentPersonality: OpponentPersonality;
  initialReplyStyle: ReplyStyle;
  initialSideChoice: SideChoice;
  initialTopic: string;
  initialCoachFocus: string;
  initialLiveFeedbackMode: boolean;
};

type CoachStat = {
  label: string;
  note: string;
  tone: "accent" | "neutral" | "warning";
  value: string;
};

type DraftCheck = {
  label: string;
  note: string;
  ready: boolean;
};

type TurnFeedback = {
  critique: string;
  nextFix: string;
  score: number;
  strongestPart: string;
};

type AttackWindow = {
  label: string;
  punch: string;
  reason: string;
  title: string;
};

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function getTone(count: number, strongThreshold: number, midThreshold: number) {
  if (count >= strongThreshold) {
    return "accent" as const;
  }

  if (count >= midThreshold) {
    return "neutral" as const;
  }

  return "warning" as const;
}

function clampScore(score: number) {
  return Math.max(18, Math.min(96, Math.round(score)));
}

function getInitialSession(
  initialSessionId: string,
  initialOpponentPersonality: OpponentPersonality,
  initialReplyStyle: ReplyStyle,
  initialSideChoice: SideChoice,
  initialTopic: string,
  initialLiveFeedbackMode: boolean,
) {
  return (
    (initialSessionId.trim() !== "" ? loadSession(initialSessionId) : null) ??
    createSession({
      sessionId: initialSessionId || undefined,
      liveFeedbackMode: initialLiveFeedbackMode,
      opponentPersonality: initialOpponentPersonality,
      replyStyle: initialReplyStyle,
      topic: initialTopic,
      sideChoice: initialSideChoice,
    })
  );
}

function buildTurnFeedback(text: string): TurnFeedback | null {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const wordCount = countWords(trimmed);
  const hasEvidence = evidencePattern.test(trimmed);
  const hasWarrant = warrantPattern.test(trimmed);
  const hasImpact = impactPattern.test(trimmed);
  const hasRebuttal = rebuttalPattern.test(trimmed);
  const hasWeighing = weighingPattern.test(trimmed);
  const hasDefinition = definitionPattern.test(trimmed);
  const hasAbsolute = absolutePattern.test(trimmed);

  let score = 26;
  score += Math.min(wordCount, 28) * 0.9;
  score += hasEvidence ? 15 : -6;
  score += hasWarrant ? 14 : -8;
  score += hasImpact ? 13 : -6;
  score += hasRebuttal ? 10 : 0;
  score += hasWeighing ? 8 : 0;
  score += hasDefinition ? 5 : 0;
  score += hasAbsolute ? -9 : 0;
  score += wordCount >= 22 ? 6 : -4;
  score += wordCount > 95 ? -4 : 0;

  const strongestPart = hasEvidence
    ? "Best part: you are at least trying to ground the turn in proof."
    : hasWarrant
      ? "Best part: the turn has a visible mechanism instead of only a slogan."
      : hasImpact
        ? "Best part: you are at least pointing the judge toward consequences."
        : hasRebuttal
          ? "Best part: you are engaging the opponent instead of free-floating."
          : "Best part: there is a clear claim to build from.";

  let critique = "The turn is usable, but it still needs one sharper layer before it really bites.";
  let nextFix = "Add one direct comparison line so the judge knows why your world matters more.";

  if (!hasEvidence) {
    critique = "This sounds more asserted than proven right now.";
    nextFix = "Add one study, statistic, or real example before you send it.";
  } else if (!hasWarrant) {
    critique = "The claim has proof language, but the bridge to your conclusion is still thin.";
    nextFix = "Add one because-sentence that explains how the evidence gets you to the claim.";
  } else if (!hasImpact) {
    critique = "The logic is forming, but the judge still needs to hear why it matters.";
    nextFix = "Finish with the consequence: what harm, cost, or benefit follows if you are right?";
  } else if (!hasRebuttal) {
    critique = "This builds your offense, but it does not yet pin the other side down.";
    nextFix = "Name the opponent's assumption in one sentence before extending your point.";
  } else if (hasAbsolute) {
    critique = "The sentence is punchy, but the universal wording makes it easier to crack.";
    nextFix = "Trade the absolute language for something tighter unless you can defend every exception.";
  } else if (score >= 82) {
    critique = "This is a strong live turn: it has structure, consequence, and real pressure.";
    nextFix = "Your highest-value upgrade now is to make the comparison explicit instead of implied.";
  } else if (score >= 70) {
    critique = "This is solid and debate-ready with one more precise layer.";
    nextFix = "Tighten the cleanest sentence and make sure the impact comparison is explicit.";
  }

  return {
    critique,
    nextFix,
    score: clampScore(score),
    strongestPart,
  };
}

function buildAttackWindow(
  session: DebateSession,
  latestOpponentMessage: string,
): AttackWindow | null {
  const trimmed = latestOpponentMessage.trim();

  if (!trimmed) {
    return null;
  }

  const userTurns = session.messages.filter((message) => message.speaker === "You").length;
  const opponentTurns = session.messages.filter(
    (message) => message.speaker === "AI Opponent",
  ).length;

  if (userTurns === 0 || opponentTurns <= userTurns) {
    return null;
  }

  if (!evidencePattern.test(trimmed)) {
    return {
      label: "Missing evidence",
      punch: "What actual evidence proves that point instead of just repeating it more confidently?",
      reason: "They made the claim sound settled without giving the judge anything concrete to hold on to.",
      title: "Ask for proof",
    };
  }

  if (!warrantPattern.test(trimmed)) {
    return {
      label: "Missing warrant",
      punch: "Even if I grant that premise, how does it actually get you to your conclusion?",
      reason: "They named a premise, but they did not explain the mechanism connecting it to the ballot.",
      title: "Break the missing link",
    };
  }

  if (absolutePattern.test(trimmed)) {
    return {
      label: "Overclaim",
      punch: "That only works if your claim holds in every case, so why should the judge buy wording that absolute?",
      reason: "Universal phrasing creates an easy counterexample lane and makes the turn more brittle than it sounds.",
      title: "Punish the overclaim",
    };
  }

  if (contestedTermPattern.test(trimmed) && !definitionPattern.test(trimmed)) {
    return {
      label: "Definition gap",
      punch: "What do you mean by that key term, and why should the judge accept your version instead of mine?",
      reason: "They are leaning on a contested word without locking down the standard behind it.",
      title: "Force the definition",
    };
  }

  if (!weighingPattern.test(trimmed)) {
    return {
      label: "Weak comparison",
      punch: "Why does that matter more than the harm on my side, instead of just existing alongside it?",
      reason: "They offered a point, but not a reason the judge should rank it above your best impact.",
      title: "Win the weighing",
    };
  }

  return {
    label: "Soft seam",
    punch: "Even if part of that is true, it still does not get you to a better ballot than mine.",
    reason: "The line is more complete than most, so the best move is to concede the premise and beat it on comparison.",
    title: "Turn the conclusion",
  };
}

function buildLiveCoach(
  session: DebateSession,
  draft: string,
  opponentPersonality: ReturnType<typeof getOpponentPersonalityMeta>,
) {
  const userMessages = session.messages.filter((message) => message.speaker === "You");
  const opponentMessages = session.messages.filter(
    (message) => message.speaker === "AI Opponent",
  );
  const userTexts = userMessages.map((message) => message.text);
  const evidenceTurns = userTexts.filter((text) => evidencePattern.test(text)).length;
  const rebuttalTurns = userTexts.filter((text) => rebuttalPattern.test(text)).length;
  const weighingTurns = userTexts.filter((text) => weighingPattern.test(text)).length;
  const definitionTurns = userTexts.filter((text) => definitionPattern.test(text)).length;
  const absoluteTurns = userTexts.filter((text) => absolutePattern.test(text)).length;
  const totalWords = userTexts.reduce((sum, text) => sum + countWords(text), 0);
  const averageWords =
    userTexts.length > 0 ? Math.round(totalWords / userTexts.length) : 0;
  const latestOpponentMessage =
    opponentMessages.length > 0 ? opponentMessages[opponentMessages.length - 1].text : "";
  const draftWordCount = countWords(draft);

  const stats: CoachStat[] = [
    {
      label: "Evidence lane",
      note:
        evidenceTurns > 0
          ? "You have at least some proof language in the round."
          : "No hard proof has landed yet, so unsupported-claim attacks stay live.",
      tone: getTone(evidenceTurns, 2, 1),
      value: `${evidenceTurns}/${Math.max(userMessages.length, 1)}`,
    },
    {
      label: "Clash rate",
      note:
        rebuttalTurns > 0
          ? "You are answering pressure instead of only extending offense."
          : "The opponent is still getting too many assumptions for free.",
      tone: getTone(rebuttalTurns, 2, 1),
      value: `${rebuttalTurns}/${Math.max(userMessages.length, 1)}`,
    },
    {
      label: "Impact weighing",
      note:
        weighingTurns > 0
          ? "There is at least some judge-directed comparison in the round."
          : "You still need a clean why-my-world-is-better sentence.",
      tone: getTone(weighingTurns, 1, 1),
      value: `${weighingTurns}`,
    },
    {
      label: "Turn depth",
      note:
        averageWords >= 32
          ? "Your average turn has enough room for claim, warrant, and impact."
          : "Most turns still need one more sentence of warrant or impact.",
      tone: averageWords >= 32 ? "accent" : averageWords >= 22 ? "neutral" : "warning",
      value: averageWords > 0 ? `${averageWords} words` : "No turns",
    },
  ];

  const draftChecks: DraftCheck[] = [
    {
      label: "Claim",
      note: "State the position in a sentence sturdy enough to defend.",
      ready: draftWordCount >= 8,
    },
    {
      label: "Warrant",
      note: "Explain why the claim follows instead of merely asserting it.",
      ready: warrantPattern.test(draft),
    },
    {
      label: "Impact",
      note: "Tell the judge why the consequence matters.",
      ready: impactPattern.test(draft),
    },
    {
      label: "Clash",
      note: "Name the opponent's assumption or answer their best point directly.",
      ready: rebuttalPattern.test(draft),
    },
  ];

  const nudges: string[] = [];

  if (!evidencePattern.test(draft) && evidenceTurns === 0) {
    nudges.push("Add one statistic, study, or real-world example before you send this turn.");
  }

  if (latestOpponentMessage && !rebuttalPattern.test(draft)) {
    nudges.push("Directly name one assumption from the opponent before extending your own case.");
  }

  if (!impactPattern.test(draft) && weighingTurns === 0) {
    nudges.push("End with a ballot sentence that compares your impact to theirs.");
  }

  if (
    contestedTermPattern.test(draft) &&
    !definitionPattern.test(draft) &&
    definitionTurns === 0
  ) {
    nudges.push("Define the key contested term so the opponent cannot choose the standard for you.");
  }

  if (absolutePattern.test(draft) || absoluteTurns > 0) {
    nudges.push("Trim universal wording unless you are ready to defend every exception.");
  }

  if (draftWordCount > 0 && draftWordCount < 24) {
    nudges.push("One more sentence probably helps more than one more adjective right now.");
  }

  const momentumRead =
    userMessages.length === 0
      ? "Opening move"
      : evidenceTurns === 0 || rebuttalTurns === 0
        ? "Pressure building"
        : weighingTurns > 0
          ? "Judgeable"
          : "Live but incomplete";

  return {
    draftChecks,
    momentumRead,
    nudges: nudges.slice(0, 4),
    pressureHabits: opponentPersonality.argumentHabits.slice(0, 3),
    pressureQuestions: opponentPersonality.followUps.slice(0, 3),
    stats,
  };
}

export default function DebateExperience({
  initialSessionId,
  initialOpponentPersonality,
  initialReplyStyle,
  initialSideChoice,
  initialTopic,
  initialCoachFocus,
  initialLiveFeedbackMode,
}: DebateExperienceProps) {
  const router = useRouter();
  const [session, setSession] = useState<DebateSession>(() =>
    getInitialSession(
      initialSessionId,
      initialOpponentPersonality,
      initialReplyStyle,
      initialSideChoice,
      initialTopic,
      initialLiveFeedbackMode,
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
  }, [session.messages.length, isThinking]);

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
  const latestUserTurn =
    [...session.messages].reverse().find((message) => message.speaker === "You")?.text ?? "";
  const latestOpponentTurn =
    [...session.messages].reverse().find((message) => message.speaker === "AI Opponent")?.text ??
    "";
  const opponentPersonality = getOpponentPersonalityMeta(session.opponentPersonality);
  const replyStyle = getReplyStyleMeta(session.replyStyle);
  const liveCoach = buildLiveCoach(session, input, opponentPersonality);
  const draftWordCount = countWords(input);
  const feedbackSourceText = input.trim() ? input : latestUserTurn;
  const turnFeedback = buildTurnFeedback(feedbackSourceText);
  const attackWindow = buildAttackWindow(session, latestOpponentTurn);

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
                {opponentPersonality.label}-inspired mode is active, so the opponent
                will pressure you with{" "}
                {opponentPersonality.description.toLowerCase()}. Replies are set to{" "}
                {replyStyle.label.toLowerCase()}.
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
                  Coach: {session.liveFeedbackMode ? "Sparring" : "Standard"}
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

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
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
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <label
                    htmlFor="argument"
                    className="theme-copy mb-3 block text-sm font-medium"
                  >
                    Your next argument
                  </label>
                  <p className="theme-muted text-sm">
                    {session.liveFeedbackMode
                      ? "Sparring Coach is scoring this turn live."
                      : `Momentum read: ${liveCoach.momentumRead}`}
                  </p>
                </div>
                <span className="theme-pill rounded-full border px-4 py-2 text-sm">
                  {draftWordCount > 0 ? `${draftWordCount} draft words` : "Draft empty"}
                </span>
              </div>

              <textarea
                id="argument"
                rows={5}
                className="theme-input mt-4 w-full rounded-[1.5rem] border px-4 py-4 text-base outline-none transition"
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

              {error ? <p className="theme-error mt-4 text-sm">{error}</p> : null}
            </div>
          </section>

          <aside className="grid gap-4">
            {session.liveFeedbackMode ? (
              <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
                <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                  Sparring Coach
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {input.trim() ? "Current draft score" : "Last turn score"}
                </h2>

                {turnFeedback ? (
                  <div className="mt-5 grid gap-4">
                    <div className="theme-surface rounded-[1.45rem] border p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                            Turn score
                          </p>
                          <p className="theme-strong mt-2 text-4xl font-semibold">
                            {turnFeedback.score}
                            <span className="text-lg">/100</span>
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${
                            turnFeedback.score >= 80
                              ? "theme-status-anchor"
                              : turnFeedback.score >= 64
                                ? "theme-status-developing"
                                : "theme-status-collapse"
                          }`}
                        >
                          {turnFeedback.score >= 80
                            ? "strong"
                            : turnFeedback.score >= 64
                              ? "live"
                              : "fragile"}
                        </span>
                      </div>
                      <p className="theme-copy mt-4 text-sm leading-6">
                        {turnFeedback.critique}
                      </p>
                    </div>

                    <div className="theme-subcard rounded-[1.35rem] border p-4">
                      <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                        Coach read
                      </p>
                      <p className="theme-copy mt-2 text-sm leading-6">
                        {turnFeedback.strongestPart}
                      </p>
                      <p className="theme-strong mt-3 text-sm leading-6">
                        Next fix: {turnFeedback.nextFix}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="theme-surface mt-5 rounded-[1.45rem] border p-4">
                    <p className="theme-copy text-sm leading-6">
                      Start typing and Sparring Coach will score the turn, flag the weakest seam,
                      and tell you the fastest upgrade before you send it.
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            {session.liveFeedbackMode ? (
              <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
                <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                  Hardest Hit
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Where the opponent is softest</h2>

                {attackWindow ? (
                  <div className="mt-5 grid gap-4">
                    <div className="theme-surface rounded-[1.45rem] border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{attackWindow.title}</p>
                        <span className="theme-status-collapse rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">
                          {attackWindow.label}
                        </span>
                      </div>
                      <p className="theme-copy mt-4 text-sm leading-6">
                        {attackWindow.reason}
                      </p>
                    </div>

                    <div className="theme-subcard rounded-[1.35rem] border p-4">
                      <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                        Best pressure line
                      </p>
                      <p className="theme-strong mt-2 text-sm leading-6">
                        {attackWindow.punch}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="theme-surface mt-5 rounded-[1.45rem] border p-4">
                    <p className="theme-copy text-sm leading-6">
                      Once the opponent answers your first actual argument, this panel will point
                      to the softest seam and give you the cleanest attack line.
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Live coach
              </p>
              <h2 className="mt-3 text-2xl font-semibold">Round pressure dashboard</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {liveCoach.stats.map((stat) => (
                  <article
                    key={stat.label}
                    className="theme-surface rounded-[1.35rem] border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                        {stat.label}
                      </p>
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${
                          stat.tone === "accent"
                            ? "theme-status-anchor"
                            : stat.tone === "warning"
                              ? "theme-status-collapse"
                              : "theme-status-developing"
                        }`}
                      >
                        {stat.value}
                      </span>
                    </div>
                    <p className="theme-copy mt-3 text-sm leading-6">{stat.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Draft builder
              </p>
              <h2 className="mt-3 text-2xl font-semibold">Before you hit send</h2>
              <div className="mt-5 grid gap-3">
                {liveCoach.draftChecks.map((check) => (
                  <article
                    key={check.label}
                    className="theme-surface rounded-[1.35rem] border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{check.label}</p>
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${
                          check.ready ? "theme-status-anchor" : "theme-status-collapse"
                        }`}
                      >
                        {check.ready ? "ready" : "missing"}
                      </span>
                    </div>
                    <p className="theme-copy mt-3 text-sm leading-6">{check.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Coach nudges
              </p>
              <h2 className="mt-3 text-2xl font-semibold">Highest-value fixes right now</h2>
              <div className="mt-5 space-y-3">
                {(liveCoach.nudges.length > 0
                  ? liveCoach.nudges
                  : [
                      "Your draft has the core pieces. Tighten the strongest sentence and send with confidence.",
                    ]
                ).map((item) => (
                  <div
                    key={item}
                    className="theme-surface report-list-item rounded-[1.35rem] border p-4"
                  >
                    <span className="report-list-dot bg-[var(--accent)]" />
                    <span className="theme-copy text-sm leading-6">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="theme-card rounded-[1.8rem] border p-5 backdrop-blur">
              <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                Opponent scout
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                How {opponentPersonality.label} usually punishes
              </h2>

              <div className="theme-subcard mt-5 rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Likely cross-ex questions
                </p>
                <div className="mt-3 space-y-3">
                  {liveCoach.pressureQuestions.map((item) => (
                    <div key={item} className="report-list-item">
                      <span className="report-list-dot bg-rose-400/80" />
                      <span className="theme-copy text-sm leading-6">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="theme-subcard mt-4 rounded-[1.35rem] border p-4">
                <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                  Habits to pre-empt
                </p>
                <div className="mt-3 space-y-3">
                  {liveCoach.pressureHabits.map((item) => (
                    <div key={item} className="report-list-item">
                      <span className="report-list-dot bg-emerald-400/80" />
                      <span className="theme-copy text-sm leading-6">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
