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

  const evidenceMetric = getMetric(analysis.metrics, "evidence");
  const rebuttalMetric = getMetric(analysis.metrics, "rebuttal");
  const weighingMetric = getMetric(analysis.metrics, "weighing");
  const clarityMetric = getMetric(analysis.metrics, "clarity");
  const disciplineMetric = getMetric(analysis.metrics, "discipline");
  const topMetric = getTopMetric(analysis.metrics);
  const bottomMetric = getBottomMetric(analysis.metrics);
  const proofPosture = buildProofPosture(evidenceMetric.score, evidenceTurns);
  const clashMode = buildClashMode(rebuttalMetric.score, rebuttalTurns);
  const closingPower = buildClosingPower(weighingMetric.score, weighingTurns);
  const tempo = buildTempoLabel(averageWords);

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
      quote: clampText(
        bestUserMessage?.text ?? userReceipt?.quote ?? analysis.strongestArgument,
        220,
      ),
      speaker: "You",
    },
    {
      label: "Opponent line that landed",
      note:
        "This is the pressure point the report thinks the other side used most effectively.",
      quote: clampText(
        bestOpponentMessage?.text ??
          opponentReceipt?.quote ??
          analysis.opponentCaseReview.strongestQuote,
        220,
      ),
      speaker: "AI Opponent",
    },
    {
      label: "Line to rewrite",
      note:
        "This is the kind of sentence that needed more proof, warrant, or precision to survive contact.",
      quote: clampText(
        repairUserMessage?.text ??
          userReceipt?.quote ??
          analysis.biggestUserMistake,
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

  const patternStats: PatternStat[] = [
    {
      label: "Evidence turns",
      note:
        evidenceTurns > 0
          ? "Concrete proof showed up, but each extra example would still have raised your floor."
          : "The case needed proof much earlier, which is why missing-evidence criticism landed.",
      tone: evidenceTurns > 1 ? "accent" : evidenceTurns === 1 ? "neutral" : "warning",
      value: `${evidenceTurns}/${Math.max(userMessages.length, 1)}`,
    },
    {
      label: "Direct clash",
      note:
        rebuttalTurns > 0
          ? "You did answer pressure at points instead of only extending your own case."
          : "The opponent got too many arguments for free because their assumptions were not directly named.",
      tone: rebuttalTurns > 1 ? "accent" : rebuttalTurns === 1 ? "neutral" : "warning",
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
    patternStats,
    profileSignals,
    quoteInsights,
    replaySteps,
    weakestMetric: bottomMetric,
  };
}
