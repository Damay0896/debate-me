"use client";

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
  const [activeTool, setActiveTool] = useState<"coach" | "evidence" | "prep" | null>(null);
  const [isRouting, startTransition] = useTransition();
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    router.prefetch("/results");
  }, [router]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    const viewport = transcriptEndRef.current?.parentElement;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
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
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: optimisticSession,
        }),
      });

      if (!response.ok) throw new Error("Debate request failed");
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
  const roundReadStats = liveCoach.stats.slice(0, 3);
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
    setActiveTool("evidence");
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
    setActiveTool(null);
    document.getElementById("argument")?.focus();
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
    <main className="debate-workspace">
      <header className="debate-heading">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{session.topic}</h1>
          <p className="theme-muted mt-2 text-sm">You: {session.userSide} · {opponentPersonality.label} · {replyStyle.label} · {userTurns} {userTurns === 1 ? "turn" : "turns"}</p>
        </div>
        <button type="button" disabled={isRouting || isThinking || userTurns === 0} onClick={openResults}
          className="theme-button-secondary shrink-0 rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Finish round</button>
      </header>
      {initialCoachFocus.trim() && <details className="theme-copy text-sm"><summary className="cursor-pointer">Your replay focus</summary><p className="py-2">{initialCoachFocus}</p></details>}
      <div className="debate-toolbar" aria-label="Debate tools">
        {(["coach", "evidence", "prep"] as const).map((tool) => (
          <button key={tool} type="button" aria-expanded={activeTool === tool} aria-controls="debate-tools"
            onClick={() => setActiveTool(activeTool === tool ? null : tool)}
            className={activeTool === tool ? "tool-selected" : ""}>
            {tool === "coach" ? "Coach" : tool === "evidence" ? "Evidence" : "Draft check"}
          </button>
        ))}
        <span className="theme-muted ml-auto text-xs">{isThinking ? "Opponent replying..." : "Your turn"}</span>
      </div>
      <div className={`debate-body ${activeTool ? "with-tools" : ""}`}>
        <section className="debate-conversation" aria-label="Debate conversation">
          <div className="debate-transcript" role="log" aria-label="Messages" aria-live="polite">
            {session.messages.map((message) => (
              <article key={message.id} className={`debate-message ${message.speaker === "You" ? "from-user" : "from-opponent"}`}>
                <p className="text-sm font-semibold">{message.speaker === "You" ? "You" : opponentPersonality.label}</p>
                <FactCheckedMessageText claims={factChecksByMessage[message.id] ?? []} text={message.text} />
              </article>
            ))}
            {isThinking && <p className="theme-muted px-4 py-3 text-sm" role="status">{getOpponentThinkingCopy(session)}</p>}
            <div ref={transcriptEndRef} />
          </div>
          <div className="debate-composer">
            <label htmlFor="argument" className="sr-only">Your reply</label>
            <textarea id="argument" rows={3} className="theme-input w-full rounded-lg border p-3 text-base"
              placeholder={getDebateInputPlaceholder(session.replyStyle)} value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void sendMessage(); } }} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="theme-muted text-xs">{draftWordCount} words <span className="hidden sm:inline">· Ctrl / Cmd + Enter to send</span></span>
              <button type="button" disabled={isThinking || !input.trim()} onClick={() => void sendMessage()}
                className="theme-button-primary rounded-lg px-6 py-2 text-sm font-semibold disabled:opacity-40">{isThinking ? "Waiting..." : "Send"}</button>
            </div>
            {session.liveFeedbackMode && turnFeedback && <button type="button" onClick={() => setActiveTool("coach")} className="theme-copy mt-2 text-left text-xs">Coach: {turnFeedback.score}/100 · {turnFeedback.critique}</button>}
            {error && <p role="alert" className="theme-error mt-2 text-sm">{error}</p>}
          </div>
        </section>
        {activeTool && <aside id="debate-tools" className="debate-tools" aria-label="Debate tools"
          onKeyDown={(event) => { if (event.key === "Escape") { setActiveTool(null); document.getElementById("argument")?.focus(); } }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">{activeTool === "coach" ? "Coach notes" : activeTool === "evidence" ? "Evidence" : "Draft check"}</h2>
            <button type="button" onClick={() => { setActiveTool(null); document.getElementById("argument")?.focus(); }} className="theme-muted text-sm">Close</button>
          </div>
          {activeTool === "coach" && <>
            {turnFeedback ? <>
              <p className="text-3xl font-semibold">{turnFeedback.score}<span className="theme-muted text-sm"> / 100</span></p>
              <p className="theme-copy mt-3 text-sm leading-6">{turnFeedback.critique}</p>
              <details className="mt-4"><summary className="cursor-pointer text-sm">Score details</summary>
                {turnFeedback.breakdown.map((item) => <p key={item.label} className="theme-copy mt-3 text-sm"><strong>{item.label} {item.score}</strong><br />{item.note}</p>)}
              </details>
            </> : <p className="theme-muted text-sm">Write your opening argument to get feedback.</p>}
            {attackWindow && <div className="mt-6 border-t border-[var(--border)] pt-4">
              <h3 className="text-sm font-semibold">Where to respond</h3>
              <blockquote className="theme-muted mt-3 text-sm leading-6">{attackWindow.targetQuote}</blockquote>
              <p className="theme-copy mt-3 text-sm leading-6">{attackWindow.punch}</p>
            </div>}
          </>}
          {activeTool === "evidence" && <>
            <button type="button" disabled={evidenceState.status === "loading"} onClick={() => void generateEvidence()}
              className="theme-button-secondary mb-4 rounded-lg border px-4 py-2 text-sm disabled:opacity-40">{evidenceState.status === "loading" ? "Finding evidence..." : evidenceState.result ? "Refresh evidence" : "Generate evidence"}</button>
            <EvidenceDeck result={evidenceState.result} status={evidenceState.status} error={evidenceState.error}
              emptyCopy="Find sources and examples for your side. Add any useful item straight to your reply." onUseCard={insertEvidenceIntoDraft} />
          </>}
          {activeTool === "prep" && <>
            {liveCoach.draftChecks.map((check) => <div key={check.label} className="mb-4">
              <p className="text-sm font-semibold">{check.label}<span className="theme-muted ml-2 font-normal">{check.ready ? "Present" : "Worth adding"}</span></p>
              <p className="theme-copy mt-1 text-sm leading-6">{check.note}</p>
            </div>)}
            <details className="mt-5"><summary className="cursor-pointer text-sm">Round statistics</summary>
              {roundReadStats.map((stat) => <p key={stat.label} className="theme-copy mt-3 text-sm">{stat.label}: {stat.value}<br />{stat.note}</p>)}
            </details>
          </>}
        </aside>}
      </div>
    </main>
  );
}
