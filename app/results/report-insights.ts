import type {
  ArgumentFrame,
  DebateAnalysis,
  DebateMetric,
  DebateSession,
} from "@/lib/debate";

const evidencePattern =
  /\b(data|study|research|evidence|statistic|according to|for example|for instance|report)\b/i;
const rebuttalPattern =
  /\b(however|but|although|while|even if|that assumes|your argument|your claim|rebut|counter)\b/i;
const weighingPattern =
  /\b(outweigh|weigh|more important|more than|greater harm|bigger impact|matters more|on balance)\b/i;
const definitionPattern =
  /\b(define|definition|when i say|what i mean by|understand .* as|by .* i mean)\b/i;
const absolutePattern =
  /\b(always|never|everyone|nobody|all|none|obviously|clearly|proves once and for all)\b/i;
const warrantPattern =
  /\b(because|since|therefore|thus|which means|this means|as a result|leads to|results in)\b/i;

export type PatternStat = {
  label: string;
  note: string;
  tone: "accent" | "neutral" | "warning";
  value: string;
};

export type ProfileSignal = {
  label: string;
  note: string;
  value: string;
};

export type QuoteInsight = {
  label: string;
  note: string;
  quote: string;
  speaker: "You" | "AI Opponent";
};

export type BallotCallout = {
  label: string;
  tone: "accent" | "neutral" | "warning";
  value: string;
};

export type ReplayStep = {
  label: string;
  line: string;
  note: string;
};

export type DrillQuestion = {
  answer: string;
  prompt: string;
  title: string;
};

export type CaseRepair = {
  fix: string;
  title: string;
  weakness: string;
};

const personaPrefacePattern =
  /\b(i am using a .*inspired|inspired lane here|i will answer in one tight paragraph|quick premise stacking)\b/i;

type MessageScore = {
  score: number;
  text: string;
};

function clampText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}...`;
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getMetric(metrics: DebateMetric[], key: DebateMetric["key"]) {
  return metrics.find((metric) => metric.key === key) ?? metrics[0];
}

function getTopMetric(metrics: DebateMetric[]) {
  return [...metrics].sort((left, right) => right.score - left.score)[0] ?? null;
}

function getBottomMetric(metrics: DebateMetric[]) {
  return [...metrics].sort((left, right) => left.score - right.score)[0] ?? null;
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function pickBestMessage(
  texts: string[],
  scorer: (text: string) => number,
): MessageScore | null {
  return texts.reduce<MessageScore | null>((best, text) => {
    const score = scorer(text);

    if (!best || score > best.score) {
      return {
        score,
        text,
      };
    }

    return best;
  }, null);
}

function scoreStrongText(text: string) {
  let score = Math.min(countWords(text), 60);

  if (evidencePattern.test(text)) {
    score += 18;
  }

  if (rebuttalPattern.test(text)) {
    score += 16;
  }

  if (weighingPattern.test(text)) {
    score += 12;
  }

  if (definitionPattern.test(text)) {
    score += 8;
  }

  if (warrantPattern.test(text)) {
    score += 8;
  }

  return score;
}

function scoreRepairText(text: string) {
  let score = Math.max(28 - countWords(text), 0);

  if (absolutePattern.test(text)) {
    score += 18;
  }

  if (!evidencePattern.test(text)) {
    score += 14;
  }

  if (!warrantPattern.test(text)) {
    score += 10;
  }

  if (!rebuttalPattern.test(text)) {
    score += 6;
  }

  return score;
}

function getOpeningClause(value: string) {
  return splitSentences(value)[0] ?? clampText(value, 140);
}

function getMetricTone(score: number) {
  if (score >= 72) {
    return "accent" as const;
  }

  if (score >= 56) {
    return "neutral" as const;
  }

  return "warning" as const;
}

function isWeakQuoteCandidate(value: string, topic: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return true;
  }

  if (normalized.toLowerCase() === topic.toLowerCase()) {
    return true;
  }

  if (countWords(normalized) < 5) {
    return true;
  }

  return personaPrefacePattern.test(normalized);
}

function pickBestQuote(
  topic: string,
  candidates: Array<string | null | undefined>,
  maxLength: number,
) {
  const cleaned = candidates
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((candidate) => candidate.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const strongCandidate = cleaned.find(
    (candidate) => !isWeakQuoteCandidate(candidate, topic),
  );

  if (strongCandidate) {
    return clampText(strongCandidate, maxLength);
  }

  return clampText(cleaned[0] ?? topic, maxLength);
}

function buildProofPosture(evidenceScore: number, evidenceTurns: number) {
  if (evidenceScore >= 72 && evidenceTurns >= 2) {
    return {
      note: "You regularly gave the judge something concrete to hold onto.",
      value: "Backed",
    };
  }

  if (evidenceScore >= 58 || evidenceTurns >= 1) {
    return {
      note: "There was some proof language, but not enough to fully stabilize the case.",
      value: "Developing",
    };
  }

  return {
    note: "Too much of the round asked the judge to trust your wording instead of proof.",
    value: "Thin",
  };
}

function buildClashMode(rebuttalScore: number, rebuttalTurns: number) {
  if (rebuttalScore >= 72 && rebuttalTurns >= 2) {
    return {
      note: "You were actively contesting the other side instead of only extending your own case.",
      value: "Direct",
    };
  }

  if (rebuttalScore >= 56 || rebuttalTurns >= 1) {
    return {
      note: "The round had some clash, but not enough to own the opponent's framing.",
      value: "Partial",
    };
  }

  return {
    note: "Most of the round stayed on your own offense, leaving opponent assumptions under-punished.",
    value: "Soft",
  };
}

function buildClosingPower(weighingScore: number, weighingTurns: number) {
  if (weighingScore >= 72 && weighingTurns >= 1) {
    return {
      note: "You gave the judge a real reason to prefer your impact story over theirs.",
      value: "Judgeable",
    };
  }

  if (weighingScore >= 56) {
    return {
      note: "There were hints of comparison, but the final ballot path still needed more explicit weighing.",
      value: "Emerging",
    };
  }

  return {
    note: "The round still needed a cleaner why-my-world-is-better sentence before the close.",
    value: "Loose",
  };
}

function buildTempoLabel(averageWords: number) {
  if (averageWords >= 65) {
    return {
      note: "Your turns were long enough to build structure, but they also needed tighter prioritization.",
      value: "Long-form",
    };
  }

  if (averageWords >= 32) {
    return {
      note: "The pacing was measured enough to develop arguments without stalling the round.",
      value: "Measured",
    };
  }

  return {
    note: "The round moved quickly, but some turns needed one more sentence of warrant or impact.",
    value: "Rapid",
  };
}

export function buildReportInsights(
  session: DebateSession,
  analysis: DebateAnalysis,
) {
  const userMessages = session.messages
    .filter((message) => message.speaker === "You")
    .map((message) => message.text);
  const opponentMessages = session.messages
    .filter((message) => message.speaker === "AI Opponent")
    .map((message) => message.text);
  const evidenceTurns = userMessages.filter((text) => evidencePattern.test(text)).length;
  const rebuttalTurns = userMessages.filter((text) => rebuttalPattern.test(text)).length;
  const weighingTurns = userMessages.filter((text) => weighingPattern.test(text)).length;
  const definitionTurns = userMessages.filter((text) => definitionPattern.test(text)).length;
  const absoluteTurns = userMessages.filter((text) => absolutePattern.test(text)).length;
  const totalWords = userMessages.reduce((sum, text) => sum + countWords(text), 0);
  const averageWords =
    userMessages.length > 0 ? Math.round(totalWords / userMessages.length) : 0;
  const hasTranscriptArchive = userMessages.length > 0 || opponentMessages.length > 0;

  const evidenceMetric = getMetric(analysis.metrics, "evidence");
  const rebuttalMetric = getMetric(analysis.metrics, "rebuttal");
  const weighingMetric = getMetric(analysis.metrics, "weighing");
  const clarityMetric = getMetric(analysis.metrics, "clarity");
  const disciplineMetric = getMetric(analysis.metrics, "discipline");
  const topMetric = getTopMetric(analysis.metrics);
  const bottomMetric = getBottomMetric(analysis.metrics);
  const proofPosture = hasTranscriptArchive
    ? buildProofPosture(evidenceMetric.score, evidenceTurns)
    : {
        note: "Turn-by-turn transcript data was not stored, so this proof read is inferred from the saved coaching analysis.",
        value: evidenceMetric.score >= 58 ? "Inferred support" : "Inferred thin",
      };
  const clashMode = hasTranscriptArchive
    ? buildClashMode(rebuttalMetric.score, rebuttalTurns)
    : {
        note: "This clash read is inferred from the saved report rather than a full visible transcript archive.",
        value: rebuttalMetric.score >= 58 ? "Inferred pressure" : "Inferred soft",
      };
  const closingPower = hasTranscriptArchive
    ? buildClosingPower(weighingMetric.score, weighingTurns)
    : {
        note: "The closing read is being reconstructed from the saved analysis because the round archive is incomplete.",
        value: weighingMetric.score >= 58 ? "Inferred edge" : "Inferred loose",
      };
  const tempo = hasTranscriptArchive
    ? buildTempoLabel(averageWords)
    : {
        note: "The report is preserving the saved judge read, but turn-by-turn pacing data is unavailable.",
        value: "Archive missing",
      };

  const bestUserMessage = pickBestMessage(userMessages, scoreStrongText);
  const repairUserMessage = pickBestMessage(userMessages, scoreRepairText);
  const bestOpponentMessage = pickBestMessage(opponentMessages, scoreStrongText);
  const userReceipt =
    analysis.transcriptReceipts.find((receipt) => receipt.speaker === "You") ?? null;
  const opponentReceipt =
    analysis.transcriptReceipts.find((receipt) => receipt.speaker === "AI Opponent") ?? null;

  const quoteInsights: QuoteInsight[] = [
    {
      label: "Your best line",
      note:
        "This is the cleanest sentence to preserve and expand when you replay the round.",
      quote: pickBestQuote(
        session.topic,
        [
          bestUserMessage?.text,
          userReceipt?.quote,
          analysis.strongestArgument,
          analysis.argumentFrames[0]?.claim,
          analysis.flipSentence,
        ],
        220,
      ),
      speaker: "You",
    },
    {
      label: "Opponent line that landed",
      note:
        "This is the pressure point the report thinks the other side used most effectively.",
      quote: pickBestQuote(
        session.topic,
        [
          bestOpponentMessage?.text,
          opponentReceipt?.quote,
          analysis.opponentCaseReview.strongestQuote,
          analysis.collapsePoints[0]?.trigger,
        ],
        220,
      ),
      speaker: "AI Opponent",
    },
    {
      label: "Line to rewrite",
      note:
        "This is the kind of sentence that needed more proof, warrant, or precision to survive contact.",
      quote: pickBestQuote(
        session.topic,
        [
          repairUserMessage?.text,
          analysis.biggestUserMistake,
          analysis.collapsePoints[0]?.trigger,
          analysis.transcriptReceipts[0]?.quote,
        ],
        220,
      ),
      speaker: "You",
    },
  ];

  const profileSignals: ProfileSignal[] = [
    {
      label: "Case identity",
      note:
        topMetric
          ? `Your most credible lane in this round was ${topMetric.label.toLowerCase()}.`
          : "The case never fully settled into one dominant strength.",
      value: topMetric?.label ?? "Still forming",
    },
    {
      label: "Proof posture",
      note: proofPosture.note,
      value: proofPosture.value,
    },
    {
      label: "Clash mode",
      note: clashMode.note,
      value: clashMode.value,
    },
    {
      label: "Round tempo",
      note: tempo.note,
      value: tempo.value,
    },
    {
      label: "Closing power",
      note: closingPower.note,
      value: closingPower.value,
    },
    {
      label: "Control discipline",
      note:
        disciplineMetric.score >= 68 && clarityMetric.score >= 68
          ? "The structure stayed usable enough that the judge could track your intent."
          : "The round needed cleaner prioritization and less leakage between claims.",
      value:
        disciplineMetric.score >= 68 && clarityMetric.score >= 68
          ? "Composed"
          : "Needs tightening",
    },
  ];

  const patternStats: PatternStat[] = hasTranscriptArchive
    ? [
        {
          label: "Evidence turns",
          note:
            evidenceTurns > 0
              ? "Concrete proof showed up, but each extra example would still have raised your floor."
              : "The case needed proof much earlier, which is why missing-evidence criticism landed.",
          tone:
            evidenceTurns > 1 ? "accent" : evidenceTurns === 1 ? "neutral" : "warning",
          value: `${evidenceTurns}/${Math.max(userMessages.length, 1)}`,
        },
        {
          label: "Direct clash",
          note:
            rebuttalTurns > 0
              ? "You did answer pressure at points instead of only extending your own case."
              : "The opponent got too many arguments for free because their assumptions were not directly named.",
          tone:
            rebuttalTurns > 1 ? "accent" : rebuttalTurns === 1 ? "neutral" : "warning",
          value: `${rebuttalTurns}/${Math.max(userMessages.length, 1)}`,
        },
        {
          label: "Impact comparison",
          note:
            weighingTurns > 0
              ? "There was at least some why-my-world-is-better language for the judge."
              : "The close needed an explicit comparison sentence, not just another claim.",
          tone: weighingTurns > 0 ? "accent" : "warning",
          value: `${weighingTurns}`,
        },
        {
          label: "Definitions set",
          note:
            definitionTurns > 0
              ? "You did some framing work yourself instead of letting the opponent define the terms."
              : "Key words stayed loose enough for the opponent to contest your standard.",
          tone: definitionTurns > 0 ? "neutral" : "warning",
          value: `${definitionTurns}`,
        },
        {
          label: "Absolute claims",
          note:
            absoluteTurns > 0
              ? "Absolute wording increased vulnerability to counterexamples and exceptions."
              : "You mostly avoided overcommitting with universal language.",
          tone: absoluteTurns === 0 ? "accent" : "warning",
          value: `${absoluteTurns}`,
        },
        {
          label: "Average turn length",
          note:
            averageWords >= 32
              ? "There was enough room to build warrant and impact into each turn."
              : "Turns were short enough that the hidden logic often stayed unstated.",
          tone: averageWords >= 32 ? "neutral" : "warning",
          value: averageWords > 0 ? `${averageWords} words` : "No turns",
        },
      ]
    : [
        {
          label: "Evidence support",
          note:
            "Turn-by-turn evidence counts are unavailable, so this card uses the saved evidence score instead.",
          tone: getMetricTone(evidenceMetric.score),
          value: `${evidenceMetric.score}/100`,
        },
        {
          label: "Rebuttal pressure",
          note:
            "The transcript archive was not stored, so this is inferred from the rebuttal read in the saved report.",
          tone: getMetricTone(rebuttalMetric.score),
          value: `${rebuttalMetric.score}/100`,
        },
        {
          label: "Impact comparison",
          note:
            "This is the inferred weighing strength from the saved coach analysis rather than raw turn counting.",
          tone: getMetricTone(weighingMetric.score),
          value: `${weighingMetric.score}/100`,
        },
        {
          label: "Clarity under pressure",
          note:
            "This clarity read comes from the saved report because the transcript archive is incomplete.",
          tone: getMetricTone(clarityMetric.score),
          value: `${clarityMetric.score}/100`,
        },
        {
          label: "Control discipline",
          note:
            "This discipline score is inferred from the saved analysis instead of a visible turn history.",
          tone: getMetricTone(disciplineMetric.score),
          value: `${disciplineMetric.score}/100`,
        },
        {
          label: "Strongest lane",
          note:
            "Even without the full transcript archive, the saved report still points to the skill most likely carrying your case.",
          tone: topMetric ? getMetricTone(topMetric.score) : "neutral",
          value: topMetric ? `${topMetric.label} (${topMetric.score})` : "Still forming",
        },
      ];

  const ballotCallouts: BallotCallout[] = [
    {
      label: "Judge ballot",
      tone: analysis.result === "win" ? "accent" : analysis.result === "loss" ? "warning" : "neutral",
      value: `Judge votes ${analysis.winner === "You" ? "for you" : analysis.winner === "AI Opponent" ? "for the AI opponent" : "this round a tie"} because ${analysis.winnerReasoning}`,
    },
    {
      label: "Deciding issue",
      tone: "accent",
      value: getOpeningClause(analysis.strongestArgument),
    },
    {
      label: "Round-breaking leak",
      tone: "warning",
      value: analysis.biggestUserMistake,
    },
    {
      label: "What flips it",
      tone: "neutral",
      value: analysis.flipSentence,
    },
  ];

  const replaySteps: ReplayStep[] = [
    {
      label: "Opening",
      line: getOpeningClause(
        bestUserMessage?.text ?? analysis.strongestArgument,
      ),
      note:
        "Lead with your cleanest claim, then attach one concrete example or statistic before the opponent can call it bare assertion.",
    },
    {
      label: "Mid-round answer",
      line: getOpeningClause(analysis.opponentCaseReview.bestCounter),
      note:
        "The first time their strongest point appears, answer it directly instead of hoping your original claim survives on its own.",
    },
    {
      label: "Closing sentence",
      line: getOpeningClause(analysis.flipSentence),
      note:
        "End by forcing a comparison. Judges need one sentence that tells them why your impact matters more.",
    },
  ];

  const drillQuestions: DrillQuestion[] = [
    {
      title: "Question 1",
      prompt: `What proof actually makes "${analysis.opponentCaseReview.strongestPoint}" true instead of merely asserted?`,
      answer: clampText(analysis.opponentCaseReview.bestCounter, 180),
    },
    {
      title: "Question 2",
      prompt: `What hidden assumption lets this attack land: "${analysis.collapsePoints[0]?.trigger ?? analysis.biggestUserMistake}"?`,
      answer: clampText(
        analysis.collapsePoints[0]?.repair ?? analysis.bestNextImprovement.drill,
        180,
      ),
    },
    {
      title: "Question 3",
      prompt: `Why should the judge weigh their world above yours once you say "${analysis.flipSentence}"?`,
      answer: clampText(
        analysis.missedOpportunities[0]?.betterVersion ??
          analysis.bestNextImprovement.reason,
        180,
      ),
    },
  ];

  const caseRepairs: CaseRepair[] = analysis.argumentFrames
    .slice(0, 3)
    .map((frame: ArgumentFrame) => ({
      fix: clampText(
        `${getOpeningClause(frame.warrant)} Then explicitly cash it out into: ${getOpeningClause(frame.impact)}`,
        190,
      ),
      title: frame.title,
      weakness: frame.vulnerability,
    }));

  return {
    ballotCallouts,
    caseRepairs,
    drillQuestions,
    hasTranscriptArchive,
    patternStats,
    profileSignals,
    quoteInsights,
    replaySteps,
    totalWords,
    turnCount: userMessages.length,
    weakestMetric: bottomMetric,
  };
}
