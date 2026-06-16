"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  appendMessage,
  buildFallbackOpponentReply,
  createMessage,
  createSession,
  getDebateInputPlaceholder,
  getOpponentPersonalityMeta,
  getOpponentThinkingCopy,
  getReplyStyleMeta,
  sessionToTranscript,
  type DebateSession,
  type OpponentPersonality,
  type ReplyStyle,
  type SideChoice,
} from "@/lib/debate";
import { loadSession, saveSession } from "@/lib/debate-storage";
import { EvidenceDeck } from "@/components/evidence-deck";
import {
  buildFactCheckClaims,
  buildHeuristicEvidence,
  coerceEvidenceResult,
  factCheckStatusMeta,
  splitFactCheckSentences,
  type EvidenceCard,
  type EvidenceRequest,
  type EvidenceResult,
  type FactCheckClaim,
} from "@/lib/research";

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
const examplePattern =
  /\b(for example|for instance|look at|consider|case of|history shows)\b/i;
const qualifierPattern =
  /\b(often|usually|likely|tends to|can|may|in many cases|sometimes)\b/i;
const directReferencePattern =
  /\b(you said|you claim|your claim|your case|your point|their claim|their case|their point|that point|that claim|that argument|the opponent)\b/i;
const coachStopWords = new Set([
  "about",
  "after",
  "again",
  "against",
  "almost",
  "also",
  "although",
  "among",
  "because",
  "before",
  "being",
  "between",
  "could",
  "every",
  "going",
  "having",
  "might",
  "other",
  "point",
  "claim",
  "argument",
  "really",
  "said",
  "says",
  "should",
  "since",
  "still",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "turn",
  "under",
  "until",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

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

type ScoreBreakdownItem = {
  label: string;
  note: string;
  score: number;
  tone: "accent" | "neutral" | "warning";
};

type TurnFeedback = {
  breakdown: ScoreBreakdownItem[];
  critique: string;
  nextFix: string;
  opponentQuote: string | null;
  score: number;
  strongestPart: string;
  userQuote: string;
};

type AttackWindow = {
  label: string;
  punch: string;
  reason: string;
  targetQuote: string;
  title: string;
};

type EvidenceState = {
  error: string | null;
  result: EvidenceResult | null;
  status: "idle" | "loading" | "ready" | "error";
};

type EvidenceResponse = {
  result?: EvidenceResult;
  source?: "heuristic" | "openrouter";
};

function FactCheckBadge({ claim }: { claim: FactCheckClaim }) {
  const statusMeta = factCheckStatusMeta[claim.status];

  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${statusMeta.label}: ${claim.claim}`}
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[0.68rem] leading-none shadow-sm transition ${statusMeta.chipClass}`}
      >
        {statusMeta.emoji}
      </button>
      <span className="theme-card pointer-events-none absolute left-0 top-[calc(100%+0.55rem)] z-30 hidden w-[18rem] rounded-[1rem] border p-3 text-left shadow-2xl group-hover:block group-focus-within:block">
        <span className="theme-muted text-[0.62rem] uppercase tracking-[0.18em]">
          Claim detected
        </span>
        <span className="theme-copy mt-2 block text-xs leading-5">{claim.claim}</span>
        <span className="theme-muted mt-3 block text-[0.62rem] uppercase tracking-[0.18em]">
          Status
        </span>
        <span className="theme-strong mt-2 block text-xs leading-5">
          {statusMeta.emoji} {statusMeta.label}
        </span>
        <span className="theme-copy mt-3 block text-xs leading-5">
          {claim.explanation}
        </span>
        {claim.sourceLabel ? (
          <span className="theme-muted mt-3 block text-[0.68rem] leading-5">
            Source: {claim.sourceLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function FactCheckedMessageText({
  claims,
  text,
}: {
  claims: FactCheckClaim[];
  text: string;
}) {
  if (claims.length === 0) {
    return <p className="theme-strong mt-3 whitespace-pre-wrap text-base leading-7">{text}</p>;
  }

  const claimBySentence = new Map(claims.map((claim) => [claim.sentenceIndex, claim]));
  const sentences = splitFactCheckSentences(text);

  if (sentences.length === 0) {
    return <p className="theme-strong mt-3 whitespace-pre-wrap text-base leading-7">{text}</p>;
  }

  return (
    <div className="theme-strong mt-3 whitespace-pre-wrap text-base leading-7">
      {sentences.map((sentence, index) => {
        const claim = claimBySentence.get(index);

        return (
          <span key={`${index}-${sentence}`} className="mr-1.5 inline">
            {sentence}
            {claim ? (
              <span className="ml-1 inline-flex align-middle">
                <FactCheckBadge claim={claim} />
              </span>
            ) : null}{" "}
          </span>
        );
      })}
    </div>
  );
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clampText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

function clampRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getScoreTone(score: number) {
  if (score >= 78) {
    return "accent" as const;
  }

  if (score >= 60) {
    return "neutral" as const;
  }

  return "warning" as const;
}

function extractKeywords(value: string) {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/^'+|'+$/g, ""))
      .filter((token) => token.length >= 4 && !coachStopWords.has(token)),
  )];
}

function findSharedKeywords(left: string, right: string) {
  const rightKeywords = new Set(extractKeywords(right));

  return extractKeywords(left)
    .filter((keyword) => rightKeywords.has(keyword))
    .slice(0, 3);
}

function pickQuote(value: string, maxLength = 112) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const sentences = splitSentences(normalized);
  const preferredSentence =
    sentences.find((sentence) => countWords(sentence) >= 6) ??
    sentences[0] ??
    normalized;

  return clampText(preferredSentence, maxLength);
}

function scoreSentenceWeakness(sentence: string) {
  let score = 0;

  if (!evidencePattern.test(sentence)) {
    score += 4;
  }

  if (!warrantPattern.test(sentence)) {
    score += 4;
  }

  if (!weighingPattern.test(sentence)) {
    score += 2;
  }

  if (absolutePattern.test(sentence)) {
    score += 5;
  }

  if (contestedTermPattern.test(sentence) && !definitionPattern.test(sentence)) {
    score += 3;
  }

  score += Math.max(0, 10 - Math.min(countWords(sentence), 10));

  return score;
}

function pickWeakestSentence(value: string) {
  const sentences = splitSentences(value);

  if (sentences.length === 0) {
    return value;
  }

  return sentences.reduce((weakest, sentence) =>
    scoreSentenceWeakness(sentence) > scoreSentenceWeakness(weakest) ? sentence : weakest,
  );
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
  return clampRange(score, 24, 95);
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

function getLatestUserTurnContext(session: DebateSession) {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];

    if (message.speaker !== "You") {
      continue;
    }

    const previousOpponent =
      [...session.messages.slice(0, index)]
        .reverse()
        .find((candidate) => candidate.speaker === "AI Opponent")?.text ?? "";

    return {
      opponentText: previousOpponent,
      userText: message.text,
    };
  }

  return {
    opponentText: "",
    userText: "",
  };
}

function buildTurnFeedback(text: string, opponentText: string): TurnFeedback | null {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const trimmedOpponent = opponentText.trim();
  const wordCount = countWords(trimmed);
  const hasEvidence = evidencePattern.test(trimmed);
  const hasExample = examplePattern.test(trimmed);
  const hasWarrant = warrantPattern.test(trimmed);
  const hasImpact = impactPattern.test(trimmed);
  const hasRebuttal = rebuttalPattern.test(trimmed);
  const hasWeighing = weighingPattern.test(trimmed);
  const hasDefinition = definitionPattern.test(trimmed);
  const hasAbsolute = absolutePattern.test(trimmed);
  const hasQualifier = qualifierPattern.test(trimmed);
  const mentionsOpponent = directReferencePattern.test(trimmed);
  const sharedKeywords =
    trimmedOpponent !== "" ? findSharedKeywords(trimmed, trimmedOpponent) : [];
  const answersOpponent =
    trimmedOpponent !== ""
      ? hasRebuttal || mentionsOpponent || sharedKeywords.length >= 2
      : hasRebuttal;
  const userQuote = pickQuote(trimmed);
  const opponentQuote =
    trimmedOpponent !== "" ? pickQuote(pickWeakestSentence(trimmedOpponent), 104) : null;
  const lengthAdjustment =
    wordCount >= 18 && wordCount <= 72
      ? 18
      : wordCount >= 12 && wordCount <= 96
        ? 10
        : wordCount >= 8
          ? 2
          : -12;
  const proofScore = clampRange(
    38 + (hasEvidence ? 26 : -8) + (hasExample ? 8 : 0) + (hasWarrant ? 12 : -4),
    18,
    95,
  );
  const clashScore = clampRange(
    (trimmedOpponent !== "" ? 34 : 48) +
      (hasRebuttal ? 18 : trimmedOpponent !== "" ? -6 : 0) +
      Math.min(sharedKeywords.length, 3) * 7 +
      (mentionsOpponent ? 6 : 0) +
      (answersOpponent ? 8 : 0),
    18,
    95,
  );
  const impactScore = clampRange(
    34 +
      (hasImpact ? 24 : -6) +
      (hasWeighing ? 18 : trimmedOpponent !== "" ? -4 : 0) +
      (answersOpponent ? 4 : 0),
    18,
    95,
  );
  const structureScore = clampRange(
    48 +
      lengthAdjustment +
      (hasWarrant ? 6 : 0) +
      (hasDefinition ? 4 : 0) -
      (wordCount > 120 ? 10 : 0),
    18,
    95,
  );
  const disciplineScore = clampRange(
    78 -
      (hasAbsolute ? 18 : 0) -
      (wordCount > 140 ? 10 : 0) +
      (hasQualifier ? 4 : 0) -
      (!hasEvidence && wordCount > 55 ? 6 : 0),
    18,
    95,
  );
  const breakdown: ScoreBreakdownItem[] = [
    {
      label: "Proof",
      note: hasEvidence
        ? "You gave the judge something more concrete than a bare claim."
        : "This still needs proof attached to the claim.",
      score: proofScore,
      tone: getScoreTone(proofScore),
    },
    {
      label: "Direct reply",
      note:
        trimmedOpponent !== ""
          ? answersOpponent
            ? "You are actually touching the opponent's point instead of free-floating."
            : "The turn is drifting away from the exact point you need to beat."
          : "No opponent turn to answer yet, so this reads as setup offense.",
      score: clashScore,
      tone: getScoreTone(clashScore),
    },
    {
      label: "Impact",
      note: hasImpact
        ? "The turn starts cashing the argument out into consequences."
        : "The judge still needs to hear why winning this point matters.",
      score: impactScore,
      tone: getScoreTone(impactScore),
    },
    {
      label: "Structure",
      note:
        structureScore >= 72
          ? "There is enough shape here to follow it in a live round."
          : "The sentence flow still needs a cleaner claim-to-warrant path.",
      score: structureScore,
      tone: getScoreTone(structureScore),
    },
    {
      label: "Discipline",
      note:
        disciplineScore >= 72
          ? "The wording avoids most easy self-own openings."
          : "Loose wording is creating avoidable attack lanes.",
      score: disciplineScore,
      tone: getScoreTone(disciplineScore),
    },
  ];
  const weightedScore =
    proofScore * 0.26 +
    clashScore * 0.24 +
    impactScore * 0.2 +
    structureScore * 0.18 +
    disciplineScore * 0.12;
  const score = clampScore(weightedScore);
  const overlapLabel =
    sharedKeywords.length > 0 ? sharedKeywords.join(", ") : "their main point";

  const strongestPart =
    proofScore >= clashScore &&
    proofScore >= impactScore &&
    proofScore >= structureScore &&
    proofScore >= disciplineScore
      ? `Best part: "${userQuote}" at least gives the judge something more concrete than pure insistence.`
      : clashScore >= impactScore &&
          clashScore >= structureScore &&
          clashScore >= disciplineScore
        ? opponentQuote
          ? `Best part: "${userQuote}" is pointed at "${opponentQuote}" instead of wandering away from the clash.`
          : `Best part: "${userQuote}" is actually doing argumentative work instead of just filling space.`
        : impactScore >= structureScore && impactScore >= disciplineScore
          ? `Best part: "${userQuote}" starts turning the claim into a consequence the judge can weigh.`
          : structureScore >= disciplineScore
            ? `Best part: "${userQuote}" is organized enough that a judge can track it live.`
            : `Best part: "${userQuote}" avoids some of the easy overclaim traps that get punished fast.`;

  let critique = "The turn is usable, but it still needs one sharper layer before it really bites.";
  let nextFix = "Add one direct comparison line so the judge knows why your world matters more.";

  if (trimmedOpponent !== "" && !answersOpponent) {
    critique = opponentQuote
      ? `Your draft says "${userQuote}", but it barely engages the opponent's line "${opponentQuote}". Right now it reads like a parallel speech instead of a rebuttal.`
      : `Your draft says "${userQuote}", but it is still not clearly hitting the opponent's actual point.`;
    nextFix = opponentQuote
      ? `Open by naming "${opponentQuote}" and tell the judge exactly why that premise fails or matters less.`
      : "Start with one sentence that names the opponent's premise before extending your own case.";
  } else if (!hasEvidence) {
    critique =
      trimmedOpponent !== "" && opponentQuote
        ? `You are answering "${opponentQuote}", but "${userQuote}" still asks the judge to trust you without proof.`
        : `The line "${userQuote}" is clear, but it still sounds asserted rather than proven.`;
    nextFix =
      sharedKeywords.length > 0
        ? `Attach one study, example, or concrete case directly tied to ${overlapLabel}.`
        : "Add one study, statistic, or real example before you send it.";
  } else if (!hasWarrant) {
    critique =
      trimmedOpponent !== "" && opponentQuote
        ? `You pushed back on "${opponentQuote}", but "${userQuote}" never fully explains why your proof gets you to the ballot.`
        : `The line "${userQuote}" has proof language, but the bridge to the conclusion is still thin.`;
    nextFix = "Add one because-sentence that explicitly connects the evidence to your conclusion.";
  } else if (!hasImpact) {
    critique =
      trimmedOpponent !== "" && opponentQuote
        ? `You answer "${opponentQuote}", but the judge still does not hear why winning that point changes the round.`
        : `The logic is there, but "${userQuote}" still needs a clearer why-it-matters ending.`;
    nextFix = "Finish with the consequence: what harm, cost, or benefit follows if you are right?";
  } else if (trimmedOpponent !== "" && !hasWeighing) {
    critique = opponentQuote
      ? `This responds to "${opponentQuote}", but it still stops short of saying why your impact matters more than theirs.`
      : "The response has offense, but the judge still needs a direct why-your-world-wins comparison.";
    nextFix = "Add one weighing sentence that says why your impact is larger, earlier, or harder to reverse.";
  } else if (hasAbsolute) {
    critique = `The hit in "${userQuote}" is punchy, but the absolute wording makes it easier to crack with one counterexample.`;
    nextFix = "Trade the universal wording for a tighter claim unless you can defend every exception.";
  } else if (score >= 84) {
    critique =
      trimmedOpponent !== "" && opponentQuote
        ? `This is a strong live turn: it clearly targets "${opponentQuote}", gives a mechanism, and points toward a consequence.`
        : "This is a strong live turn: it has structure, consequence, and real pressure.";
    nextFix = "Your highest-value upgrade now is one explicit weighing sentence instead of leaving the comparison implied.";
  } else if (score >= 70) {
    critique =
      trimmedOpponent !== "" && opponentQuote
        ? `This is live: you are contesting "${opponentQuote}" with a real response, but one cleaner comparison would make it judge-ready.`
        : `This is solid: "${userQuote}" has a usable shape, but one more precise layer would make it sharper.`;
    nextFix = "Tighten the cleanest sentence and make the impact comparison unmistakable.";
  }

  return {
    breakdown,
    critique,
    nextFix,
    opponentQuote,
    score,
    strongestPart,
    userQuote,
  };
}

function buildAttackWindow(
  session: DebateSession,
  latestOpponentMessage: string,
  latestUserMessage: string,
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

  const targetSentence = pickWeakestSentence(trimmed);
  const targetQuote = pickQuote(targetSentence, 110);
  const shortTarget = clampText(targetQuote, 76);
  const bridgeTerms =
    latestUserMessage.trim() !== "" ? findSharedKeywords(latestUserMessage, targetSentence) : [];
  const followThrough =
    bridgeTerms.length > 0
      ? `Then tie it back to your ${bridgeTerms.join(", ")} point.`
      : "Then collapse back to why your standard matters more.";

  if (!evidencePattern.test(targetSentence)) {
    return {
      label: "Missing evidence",
      punch: `On "${shortTarget}," what evidence actually proves that, instead of just asserting it? ${followThrough}`,
      reason: `Their line "${targetQuote}" sounds settled, but it never gives the judge anything concrete to hold on to.`,
      targetQuote,
      title: "Ask for proof",
    };
  }

  if (!warrantPattern.test(targetSentence)) {
    return {
      label: "Missing warrant",
      punch: `Even if I grant "${shortTarget}," how does that actually get you to your conclusion? ${followThrough}`,
      reason: `Their line "${targetQuote}" names a premise, but it never explains the mechanism connecting that premise to the ballot.`,
      targetQuote,
      title: "Break the missing link",
    };
  }

  if (absolutePattern.test(targetSentence)) {
    return {
      label: "Overclaim",
      punch: `That only works if "${shortTarget}" holds in every case, so why should the judge buy wording that absolute? ${followThrough}`,
      reason: `Their line "${targetQuote}" uses universal phrasing, which opens an easy counterexample lane and makes the turn more brittle than it sounds.`,
      targetQuote,
      title: "Punish the overclaim",
    };
  }

  if (contestedTermPattern.test(targetSentence) && !definitionPattern.test(targetSentence)) {
    return {
      label: "Definition gap",
      punch: `When you say "${shortTarget}," what do you mean by the key term there, and why should the judge accept your standard over mine? ${followThrough}`,
      reason: `Their line "${targetQuote}" leans on a contested word without locking down the standard behind it.`,
      targetQuote,
      title: "Force the definition",
    };
  }

  if (!weighingPattern.test(targetSentence)) {
    return {
      label: "Weak comparison",
      punch: `Why does "${shortTarget}" matter more than the harm on my side, instead of just existing alongside it? ${followThrough}`,
      reason: `Their line "${targetQuote}" offers a point, but not a reason the judge should rank it above your best impact.`,
      targetQuote,
      title: "Win the weighing",
    };
  }

  return {
    label: "Soft seam",
    punch: `Even if "${shortTarget}" is partly true, it still does not get you to a better ballot than mine. ${followThrough}`,
    reason: `Their line "${targetQuote}" is more complete than most, so the cleanest move is to concede the safe part and beat the leap to the ballot on comparison.`,
    targetQuote,
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
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({
    error: null,
    result: null,
    status: "idle",
  });
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
  const latestUserContext = getLatestUserTurnContext(session);
  const latestUserTurn = latestUserContext.userText;
  const latestOpponentTurn =
    [...session.messages].reverse().find((message) => message.speaker === "AI Opponent")?.text ??
    "";
  const opponentPersonality = getOpponentPersonalityMeta(session.opponentPersonality);
  const replyStyle = getReplyStyleMeta(session.replyStyle);
  const liveCoach = buildLiveCoach(session, input, opponentPersonality);
  const draftWordCount = countWords(input);
  const feedbackSourceText = input.trim() ? input : latestUserTurn;
  const feedbackOpponentText = input.trim() ? latestOpponentTurn : latestUserContext.opponentText;
  const turnFeedback = buildTurnFeedback(feedbackSourceText, feedbackOpponentText);
  const attackWindow = buildAttackWindow(session, latestOpponentTurn, latestUserTurn);
  const factChecksByMessage = useMemo(
    () =>
      Object.fromEntries(
        session.messages.map((message) => [message.id, buildFactCheckClaims(message)]),
      ) as Record<string, FactCheckClaim[]>,
    [session.messages],
  );

  async function generateEvidence() {
    const evidenceRequest: EvidenceRequest = {
      topic: session.topic,
      userSide: session.userSide,
      opponentSide: session.opponentSide,
      transcript: sessionToTranscript(session),
      focus: input.trim() || latestOpponentTurn || latestUserTurn || session.topic,
      maxCards: 8,
    };
    const fallback = buildHeuristicEvidence(evidenceRequest);

    setEvidenceState({
      error: null,
      result: evidenceState.result,
      status: "loading",
    });

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

      const data = (await response.json()) as EvidenceResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Evidence generation failed.");
      }

      const nextResult = coerceEvidenceResult(data.result, fallback);
      setEvidenceState({
        error: null,
        result: nextResult,
        status: "ready",
      });
    } catch {
      setEvidenceState({
        error: "Live evidence was unavailable, so the research desk loaded source leads.",
        result: fallback,
        status: "ready",
      });
    }
  }

  function insertEvidenceIntoDraft(card: EvidenceCard) {
    const line = card.debateLine.trim();

    setInput((current) => {
      if (!current.trim()) {
        return line;
      }

      const trimmedCurrent = current.trimEnd();
      const spacer =
        /[.!?]$/.test(trimmedCurrent) || trimmedCurrent.length > 120 ? "\n\n" : " ";

      return `${trimmedCurrent}${spacer}${line}`;
    });
  }

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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="theme-muted text-xs uppercase tracking-[0.24em]">
                  Transcript + Light Fact Check
                </p>
                <p className="theme-copy mt-2 text-sm leading-6">
                  Claim markers stay small on purpose: they flag which factual lines look solid,
                  which need proof, and which sound overstated.
                </p>
              </div>
              <span className="theme-pill rounded-full border px-4 py-2 text-sm">
                Claim check ready
              </span>
            </div>

            <div className="max-h-[55vh] overflow-y-auto pr-1">
              {session.messages.map((message) => {
                const isUser = message.speaker === "You";
                const messageClaims = factChecksByMessage[message.id] ?? [];

                return (
                  <article
                    key={message.id}
                    className={`mb-4 rounded-[1.6rem] border p-5 ${
                      isUser
                        ? "theme-chat-user ml-auto max-w-3xl"
                        : "theme-chat-opponent mr-auto max-w-3xl"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="theme-muted text-xs font-medium uppercase tracking-[0.28em]">
                        {message.speaker}
                      </p>
                      {messageClaims.length > 0 ? (
                        <span className="theme-pill rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.14em]">
                          {messageClaims.length} claim{messageClaims.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <FactCheckedMessageText claims={messageClaims} text={message.text} />
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
                    disabled={evidenceState.status === "loading"}
                    onClick={() => {
                      void generateEvidence();
                    }}
                    className="theme-button-secondary rounded-full border px-5 py-3 text-sm font-medium transition disabled:opacity-60"
                  >
                    {evidenceState.status === "loading"
                      ? "Finding evidence..."
                      : evidenceState.result
                        ? "Refresh evidence"
                        : "Generate Evidence"}
                  </button>
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
                            turnFeedback.score >= 84
                              ? "theme-status-anchor"
                              : turnFeedback.score >= 68
                                ? "theme-status-developing"
                                : "theme-status-collapse"
                          }`}
                        >
                          {turnFeedback.score >= 84
                            ? "strong"
                            : turnFeedback.score >= 68
                              ? "live"
                              : "fragile"}
                        </span>
                      </div>
                      <p className="theme-copy mt-4 text-sm leading-6">
                        {turnFeedback.critique}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {turnFeedback.breakdown.map((item) => (
                          <div
                            key={item.label}
                            className="theme-subcard rounded-[1.1rem] border p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">{item.label}</p>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${
                                  item.tone === "accent"
                                    ? "theme-status-anchor"
                                    : item.tone === "neutral"
                                      ? "theme-status-developing"
                                      : "theme-status-collapse"
                                }`}
                              >
                                {item.score}
                              </span>
                            </div>
                            <p className="theme-copy mt-2 text-xs leading-5">{item.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="theme-subcard rounded-[1.35rem] border p-4">
                      <p className="theme-muted text-xs uppercase tracking-[0.22em]">
                        Line-by-line read
                      </p>
                      <div className="mt-3 grid gap-3">
                        <div className="theme-surface rounded-[1.1rem] border p-3">
                          <p className="theme-muted text-[0.68rem] uppercase tracking-[0.16em]">
                            Your line
                          </p>
                          <p className="theme-strong mt-2 text-sm leading-6 break-words">
                            &ldquo;{turnFeedback.userQuote}&rdquo;
                          </p>
                        </div>
                        {turnFeedback.opponentQuote ? (
                          <div className="theme-surface rounded-[1.1rem] border p-3">
                            <p className="theme-muted text-[0.68rem] uppercase tracking-[0.16em]">
                              Line you are answering
                            </p>
                            <p className="theme-copy mt-2 text-sm leading-6 break-words">
                              &ldquo;{turnFeedback.opponentQuote}&rdquo;
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <p className="theme-copy mt-4 text-sm leading-6">
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
                      <div className="theme-subcard mt-4 rounded-[1.1rem] border p-3">
                        <p className="theme-muted text-[0.68rem] uppercase tracking-[0.16em]">
                          Target quote
                        </p>
                        <p className="theme-strong mt-2 text-sm leading-6 break-words">
                          &ldquo;{attackWindow.targetQuote}&rdquo;
                        </p>
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="theme-muted text-xs uppercase tracking-[0.28em]">
                    Research Desk
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">Generate evidence</h2>
                </div>
                <button
                  type="button"
                  disabled={evidenceState.status === "loading"}
                  onClick={() => {
                    void generateEvidence();
                  }}
                  className="theme-button-secondary rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60"
                >
                  {evidenceState.status === "loading"
                    ? "Finding evidence..."
                    : evidenceState.result
                      ? "Refresh"
                      : "Generate"}
                </button>
              </div>

              <div className="mt-5 max-h-[34rem] overflow-y-auto pr-1">
                <EvidenceDeck
                  result={evidenceState.result}
                  status={evidenceState.status}
                  error={evidenceState.status === "error" ? evidenceState.error : null}
                  emptyCopy="Pull in two stats, two studies, two historical examples, and two named authorities without leaving the round."
                  onUseCard={insertEvidenceIntoDraft}
                />
                {evidenceState.error && evidenceState.status === "ready" ? (
                  <p className="theme-muted mt-4 text-sm leading-6">{evidenceState.error}</p>
                ) : null}
              </div>
            </section>

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
