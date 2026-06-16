import type {
  DebateMessage,
  DebateSession,
  DebateSide,
  DebateSpeaker,
} from "@/lib/debate";

export type FactCheckStatus = "supported" | "needs-source" | "false";

export type FactCheckCategory =
  | "statistical"
  | "historical"
  | "legal"
  | "scientific"
  | "economic"
  | "policy"
  | "current-events";

export type FactCheckClaim = {
  id: string;
  claim: string;
  sentence: string;
  sentenceIndex: number;
  messageId?: string;
  speaker: DebateSpeaker;
  category: FactCheckCategory;
  status: FactCheckStatus;
  explanation: string;
  sourceLabel?: string;
};

export type EvidenceCardType =
  | "statistic"
  | "study"
  | "historical-example"
  | "authority";

export type EvidenceCard = {
  id: string;
  type: EvidenceCardType;
  title: string;
  summary: string;
  source: string;
  helps: string;
  debateLine: string;
};

export type EvidenceRequest = {
  topic: string;
  userSide: DebateSide;
  opponentSide?: DebateSide;
  transcript?: string;
  focus?: string;
  maxCards?: number;
};

export type EvidenceResult = {
  focus: string;
  bestUse: string;
  cards: EvidenceCard[];
  source: "heuristic" | "openrouter";
  generatedAt: string;
};

export type ResearchSummary = {
  supportedClaims: FactCheckClaim[];
  unsupportedClaims: FactCheckClaim[];
  strongestFactArgument: string;
  weakestClaimOriginal: string | null;
  weakestClaimRewrite: string;
};

const sourceCuePattern =
  /\b(according to|study|studies|research|data|report|evidence|survey|analysis|meta-analysis|paper|review|statistic)\b/i;
const exactNumberPattern =
  /\b\d+(?:\.\d+)?(?:%| percent| million| billion| trillion)?\b/i;
const opinionPattern =
  /\b(i think|i believe|i feel|in my view|to me|morally|ethically|should|ought|good|bad|better|worse)\b/i;
const hypotheticalPattern =
  /\b(imagine|suppose|hypothetically|what if|would|could)\b/i;
const absolutePattern =
  /\b(always|never|everyone|nobody|all|none|proves once and for all|completely|entirely)\b/i;
const namedAuthorityPattern =
  /\b(pew|cdc|nih|nasa|ipcc|unesco|oecd|world bank|bureau of labor statistics|federal reserve|congressional budget office|brookings|harvard|stanford|mit|supreme court)\b/i;

export const factCheckStatusMeta: Record<
  FactCheckStatus,
  {
    emoji: string;
    label: string;
    toneClass: string;
    chipClass: string;
  }
> = {
  supported: {
    emoji: "🟢",
    label: "Supported",
    toneClass: "text-emerald-200",
    chipClass: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
  },
  "needs-source": {
    emoji: "🟡",
    label: "Needs source",
    toneClass: "text-amber-100",
    chipClass: "border-amber-300/35 bg-amber-400/10 text-amber-50",
  },
  false: {
    emoji: "🔴",
    label: "False or likely false",
    toneClass: "text-rose-100",
    chipClass: "border-rose-300/35 bg-rose-400/10 text-rose-50",
  },
};

const knowledgeBase: Array<{
  pattern: RegExp;
  category: FactCheckCategory;
  status: FactCheckStatus;
  explanation: string;
  sourceLabel?: string;
}> = [
  {
    pattern: /\b(first amendment).*(only applies|restricts).*(government|state action)\b/i,
    category: "legal",
    status: "supported",
    explanation:
      "The First Amendment limits government censorship and state action, not the editorial choices of private platforms.",
    sourceLabel: "U.S. constitutional doctrine",
  },
  {
    pattern: /\b(campaign|presidential).*(ads|ad spending|visits|travel).*(swing|battleground) states\b/i,
    category: "policy",
    status: "supported",
    explanation:
      "Modern presidential campaigns usually concentrate money and candidate time in competitive battleground states.",
    sourceLabel: "Campaign ad and travel analyses",
  },
  {
    pattern: /\b(vaccines?).*(cause|causes).*(autism)\b/i,
    category: "scientific",
    status: "false",
    explanation:
      "Large medical reviews have repeatedly found no credible causal link between vaccines and autism.",
    sourceLabel: "Major medical consensus",
  },
  {
    pattern: /\b(climate change).*(human|greenhouse gas|emissions)\b/i,
    category: "scientific",
    status: "supported",
    explanation:
      "Mainstream climate science holds that recent warming is driven primarily by human greenhouse gas emissions.",
    sourceLabel: "IPCC consensus",
  },
  {
    pattern: /\b(social media).*(always|inevitably).*(depression|anxiety|mental health)\b/i,
    category: "scientific",
    status: "false",
    explanation:
      "The research is real but mixed; treating the relationship as automatic or universal overstates what the evidence shows.",
    sourceLabel: "Mental health research reviews",
  },
  {
    pattern: /\b(homework).*(mixed evidence|mixed results|limited benefit)\b/i,
    category: "policy",
    status: "supported",
    explanation:
      "Research on homework effects is mixed and often varies by age, subject, and how much homework is assigned.",
    sourceLabel: "Education meta-analyses",
  },
  {
    pattern: /\b(ai).*(hallucinate|hallucinates|make things up)\b/i,
    category: "scientific",
    status: "supported",
    explanation:
      "Language models can produce confident but inaccurate outputs, which is a known failure mode in current systems.",
    sourceLabel: "AI safety and evaluation literature",
  },
  {
    pattern: /\b(inflation).*(always|only).*(printing money)\b/i,
    category: "economic",
    status: "false",
    explanation:
      "Money supply can matter, but inflation also depends on supply shocks, demand, expectations, and policy responses.",
    sourceLabel: "Macroeconomics literature",
  },
  {
    pattern: /\b(college graduates?).*(earn|make).*(more|higher).*(lifetime|over a lifetime)\b/i,
    category: "economic",
    status: "supported",
    explanation:
      "On average, degree holders tend to earn more over a lifetime, even though returns vary by field and debt burden.",
    sourceLabel: "Labor market earnings studies",
  },
  {
    pattern: /\b(remote work).*(always|necessarily).*(hurts|kills|destroys) productivity\b/i,
    category: "economic",
    status: "false",
    explanation:
      "Remote-work productivity results vary widely by job design, management, and worker type, so the all-or-nothing version is too strong.",
    sourceLabel: "Remote work productivity research",
  },
];

type TopicLens =
  | "education"
  | "technology"
  | "economy"
  | "politics"
  | "labor"
  | "health"
  | "environment"
  | "general";

function makeId(prefix: string, seed: string, index: number) {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${prefix}-${slug || "item"}-${index + 1}`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getTopicLens(topic: string): TopicLens {
  const normalized = topic.toLowerCase();

  if (/\b(homework|school|college|university|student|education|classroom|teacher)\b/.test(normalized)) {
    return "education";
  }

  if (/\b(ai|artificial intelligence|social media|algorithm|internet|technology|platform)\b/.test(normalized)) {
    return "technology";
  }

  if (/\b(wage|salary|inflation|economy|economic|tax|gdp|market|tuition|revenue|spending)\b/.test(normalized)) {
    return "economy";
  }

  if (/\b(remote work|labor|union|worker|employment|job|office)\b/.test(normalized)) {
    return "labor";
  }

  if (/\b(election|campaign|vote|constitutional|law|government|policy|electoral|president)\b/.test(normalized)) {
    return "politics";
  }

  if (/\b(health|mental health|autism|vaccine|disease|obesity|sleep)\b/.test(normalized)) {
    return "health";
  }

  if (/\b(climate|emissions|energy|pollution|environment)\b/.test(normalized)) {
    return "environment";
  }

  return "general";
}

function matchesOpinionOnly(sentence: string) {
  return opinionPattern.test(sentence) && !exactNumberPattern.test(sentence) && !sourceCuePattern.test(sentence);
}

function isFactCheckableSentence(sentence: string) {
  const normalized = normalizeText(sentence);

  if (!normalized || normalized.length < 24) {
    return false;
  }

  if (normalized.endsWith("?")) {
    return false;
  }

  if (hypotheticalPattern.test(normalized) && !sourceCuePattern.test(normalized) && !exactNumberPattern.test(normalized)) {
    return false;
  }

  if (matchesOpinionOnly(normalized)) {
    return false;
  }

  return (
    exactNumberPattern.test(normalized) ||
    sourceCuePattern.test(normalized) ||
    /\b(history|historically|court|constitutional|legal|law|election|campaign|inflation|wages|jobs|study|science|scientific|research|data|policy|government|emissions|mental health|economy|market|tuition|gdp|federal|state)\b/i.test(
      normalized,
    )
  );
}

export function splitFactCheckSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean);
}

export function detectClaimCategory(sentence: string): FactCheckCategory | null {
  const normalized = sentence.toLowerCase();

  if (/\b(today|currently|right now|this year|recently|latest|202\d|20\d\d)\b/.test(normalized)) {
    return "current-events";
  }

  if (/\b(amendment|constitutional|constitution|supreme court|illegal|legal|law|rights|first amendment)\b/.test(normalized)) {
    return "legal";
  }

  if (/\b(climate|emissions|vaccine|mental health|brain|biology|science|scientific|study|research|medical|health)\b/.test(normalized)) {
    return "scientific";
  }

  if (/\b(inflation|wages|tuition|economy|economic|gdp|tax|market|unemployment|productivity|revenue|salary)\b/.test(normalized)) {
    return "economic";
  }

  if (/\b(history|historically|historical|decade|century|war|election of|civil rights|industrial revolution)\b/.test(normalized)) {
    return "historical";
  }

  if (/\b(percent|percentage|majority|minority|most|many|more than|less than|double|half)\b/.test(normalized) || exactNumberPattern.test(normalized)) {
    return "statistical";
  }

  if (/\b(policy|government|campaign|school|college|remote work|social media|electoral college|program|regulation)\b/.test(normalized)) {
    return "policy";
  }

  return null;
}

function getDefaultNeedsSourceExplanation(category: FactCheckCategory) {
  switch (category) {
    case "current-events":
      return "This is a time-sensitive claim, so it needs a current source rather than raw confidence.";
    case "statistical":
      return "This sounds quantitative, so the judge will want a named dataset, survey, or number source.";
    case "historical":
      return "Historical claims land better when they name the case, period, or event doing the work.";
    case "legal":
      return "Legal and constitutional claims usually need a doctrine, case, or official text behind them.";
    case "scientific":
      return "Scientific claims sound plausible here, but they still need a study, review, or expert consensus source.";
    case "economic":
      return "Economic claims are usually argued with data or studies, so this needs proof rather than intuition.";
    case "policy":
      return "Policy-effect claims need an example, study, or comparable real-world case before a judge should bank on them.";
  }
}

function inferClaimStatus(
  sentence: string,
  category: FactCheckCategory,
): Pick<FactCheckClaim, "explanation" | "sourceLabel" | "status"> {
  const known = knowledgeBase.find((entry) => entry.pattern.test(sentence));

  if (known) {
    return {
      explanation: known.explanation,
      sourceLabel: known.sourceLabel,
      status: known.status,
    };
  }

  if (absolutePattern.test(sentence) && category !== "current-events") {
    return {
      explanation:
        "This turns a factual trend into an all-or-nothing statement, which makes it much easier to crack with one counterexample.",
      status: "false",
    };
  }

  if (category === "current-events") {
    return {
      explanation: getDefaultNeedsSourceExplanation(category),
      status: "needs-source",
    };
  }

  if (exactNumberPattern.test(sentence) && !sourceCuePattern.test(sentence)) {
    return {
      explanation: "This uses a concrete number or measurement, so it needs a source attached to it.",
      status: "needs-source",
    };
  }

  const authorityMatch = sentence.match(namedAuthorityPattern)?.[0];

  if (authorityMatch && !absolutePattern.test(sentence)) {
    return {
      explanation:
        "This is framed around a recognizable authority, so it is plausible as written, but you should still be ready to name the exact finding.",
      sourceLabel: authorityMatch,
      status: "supported",
    };
  }

  return {
    explanation: getDefaultNeedsSourceExplanation(category),
    status: "needs-source",
  };
}

export function buildFactCheckClaims(
  message: Pick<DebateMessage, "id" | "speaker" | "text">,
): FactCheckClaim[] {
  return splitFactCheckSentences(message.text).flatMap((sentence, sentenceIndex) => {
    if (!isFactCheckableSentence(sentence)) {
      return [];
    }

    const category = detectClaimCategory(sentence);

    if (!category) {
      return [];
    }

    const { explanation, sourceLabel, status } = inferClaimStatus(sentence, category);

    return [
      {
        id: makeId("claim", `${message.id}-${sentence}`, sentenceIndex),
        claim: sentence,
        sentence,
        sentenceIndex,
        messageId: message.id,
        speaker: message.speaker,
        category,
        status,
        explanation,
        ...(sourceLabel ? { sourceLabel } : {}),
      } satisfies FactCheckClaim,
    ];
  });
}

export function buildSessionFactChecks(
  session: DebateSession,
  speaker?: DebateSpeaker,
) {
  const lookup: Record<string, FactCheckClaim[]> = {};

  for (const message of session.messages) {
    if (speaker && message.speaker !== speaker) {
      continue;
    }

    lookup[message.id] = buildFactCheckClaims(message);
  }

  return lookup;
}

function getKeywordOverlap(left: string, right: string) {
  const leftWords = new Set(
    normalizeText(left)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5),
  );

  return normalizeText(right)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && leftWords.has(word)).length;
}

function buildFallbackDebateLine(
  topic: string,
  userSide: DebateSide,
  summary: string,
) {
  const direction =
    userSide === "Pro" ? "supports the side I am defending" : "undercuts the side I am opposing";

  return `${summary} That matters because it ${direction} on ${topic.toLowerCase()}.`;
}

function buildHeuristicCards(request: EvidenceRequest) {
  const lens = getTopicLens(request.topic);
  const focus = normalizeText(request.focus || request.topic);
  const cards: EvidenceCard[] = [];

  const templates: Record<
    TopicLens,
    Array<{
      type: EvidenceCardType;
      title: string;
      summary: string;
      source: string;
      helps: string;
    }>
  > = {
    education: [
      {
        type: "statistic",
        title: "Large-scale student outcome trend",
        summary: `Use a national education dataset showing how ${focus.toLowerCase()} affects student performance or time use at scale.`,
        source: "NCES or OECD data to verify",
        helps: "Gives the round a measurable education-wide trend instead of a single anecdote.",
      },
      {
        type: "statistic",
        title: "Distribution effect",
        summary: `Find a number showing which students benefit or lose most under ${focus.toLowerCase()}.`,
        source: "District or national education survey",
        helps: "Lets you argue not just effect, but who actually bears the burden.",
      },
      {
        type: "study",
        title: "Meta-analysis on learning outcomes",
        summary: `A strong study card here would summarize the best review literature on ${focus.toLowerCase()} and learning outcomes.`,
        source: "Education meta-analysis",
        helps: "Turns the point into a research-backed pattern rather than intuition.",
      },
      {
        type: "study",
        title: "Equity or behavioral finding",
        summary: `Look for a study showing whether ${focus.toLowerCase()} widens or narrows existing gaps.`,
        source: "Peer-reviewed education research",
        helps: "Adds a fairness angle without abandoning evidence.",
      },
      {
        type: "historical-example",
        title: "Policy pilot or district rollout",
        summary: `Use a real district, state, or national rollout that tested a version of ${focus.toLowerCase()}.`,
        source: "Comparable education case study",
        helps: "Shows that this is not a purely theoretical debate.",
      },
      {
        type: "historical-example",
        title: "Before-and-after example",
        summary: `A before-and-after classroom or district example helps show what changed once the policy actually moved.`,
        source: "Implementation example to verify",
        helps: "Makes causal language easier to defend in the round.",
      },
      {
        type: "authority",
        title: "Named education authority",
        summary: `Use a clear finding or statement from a major education researcher or institution on ${focus.toLowerCase()}.`,
        source: "Research lead: OECD, Brookings, or major education scholar",
        helps: "Signals that serious expert analysis points your way.",
      },
      {
        type: "authority",
        title: "Practitioner voice",
        summary: `A principal, superintendent, or teacher-union authority can anchor the lived-effects side of ${focus.toLowerCase()}.`,
        source: "Named practitioner or association",
        helps: "Gives the argument a human and operational voice, not just abstract theory.",
      },
    ],
    technology: [
      {
        type: "statistic",
        title: "Usage and exposure trend",
        summary: `Use a large survey or platform dataset showing how often people are actually exposed to ${focus.toLowerCase()}.`,
        source: "Pew or platform-scale reporting",
        helps: "Shows the scope of the issue instead of treating it as niche.",
      },
      {
        type: "statistic",
        title: "Outcome concentration",
        summary: `A strong number here would show who gains or loses most from ${focus.toLowerCase()}.`,
        source: "National or platform-level trend data",
        helps: "Lets you weigh not just whether it matters, but how much it matters.",
      },
      {
        type: "study",
        title: "Behavioral or performance study",
        summary: `Look for a study measuring how ${focus.toLowerCase()} changes behavior, attention, or performance outcomes.`,
        source: "Peer-reviewed social science or HCI study",
        helps: "Creates a mechanism instead of just a vibe.",
      },
      {
        type: "study",
        title: "Review of mixed evidence",
        summary: `A review article helps if the debate turns on whether the effect of ${focus.toLowerCase()} is consistent or mixed.`,
        source: "Systematic review or research summary",
        helps: "Stops the other side from oversimplifying a messy literature.",
      },
      {
        type: "historical-example",
        title: "Real platform or product shift",
        summary: `Use a concrete historical example where a platform or tool changed incentives around ${focus.toLowerCase()}.`,
        source: "Tech-policy case study",
        helps: "Shows how incentives actually work in the wild.",
      },
      {
        type: "historical-example",
        title: "Adoption wave comparison",
        summary: `A before-and-after adoption example can show what changed once the technology scaled.`,
        source: "Implementation history",
        helps: "Makes the impact story feel concrete and chronological.",
      },
      {
        type: "authority",
        title: "Named technical authority",
        summary: `Use a warning or finding from a major technologist, regulator, or research lab on ${focus.toLowerCase()}.`,
        source: "Named technical or regulatory authority",
        helps: "Adds institutional credibility when the round turns empirical.",
      },
      {
        type: "authority",
        title: "Public-interest authority",
        summary: `A civil society or safety authority can frame the public-risk side of ${focus.toLowerCase()}.`,
        source: "Research lead: major watchdog or safety body",
        helps: "Helps when you need a judge to care about downstream harm.",
      },
    ],
    economy: [],
    politics: [],
    labor: [],
    health: [],
    environment: [],
    general: [],
  };

  if (templates.economy.length === 0) {
    templates.economy = [
      {
        type: "statistic",
        title: "Macro or market trend",
        summary: `Use a hard number showing how ${focus.toLowerCase()} affects prices, earnings, spending, or broader economic outcomes.`,
        source: "BLS, CBO, OECD, or World Bank data",
        helps: "Transforms the claim from intuition into a measurable economic effect.",
      },
      {
        type: "statistic",
        title: "Who bears the cost",
        summary: `A distributional statistic helps show which group pays most under ${focus.toLowerCase()}.`,
        source: "Household or labor-market dataset",
        helps: "Gives you a fairness and incentives angle at the same time.",
      },
      {
        type: "study",
        title: "Causal evidence",
        summary: `Use a strong empirical paper that isolates what changes when ${focus.toLowerCase()} changes.`,
        source: "Economics working paper or peer-reviewed study",
        helps: "Lets you defend the mechanism instead of just asserting the outcome.",
      },
      {
        type: "study",
        title: "Tradeoff study",
        summary: `A good second study here would show the main tradeoff or unintended consequence around ${focus.toLowerCase()}.`,
        source: "Economic policy study",
        helps: "Pre-empts the easy 'you ignored the cost' attack.",
      },
      {
        type: "historical-example",
        title: "Policy-era comparison",
        summary: `Use a before-and-after policy example that made the economic tradeoff visible in practice.`,
        source: "Historical policy comparison",
        helps: "Turns abstract incentives into something judges can picture.",
      },
      {
        type: "historical-example",
        title: "Comparable market example",
        summary: `A comparable city, state, or country example makes the argument feel less theoretical.`,
        source: "Comparative economic case study",
        helps: "Provides a real-world baseline the opponent has to answer.",
      },
      {
        type: "authority",
        title: "Named economist or institution",
        summary: `Use a clear position from a major economist or economic institution on ${focus.toLowerCase()}.`,
        source: "Named economist, central bank, or research body",
        helps: "Signals that the claim is not just armchair economics.",
      },
      {
        type: "authority",
        title: "Implementation authority",
        summary: `A policymaker, regulator, or labor-market authority can ground the real-world effects side.`,
        source: "Named public authority",
        helps: "Adds operational credibility instead of only theory.",
      },
    ];
  }

  if (templates.politics.length === 0) {
    templates.politics = [
      {
        type: "statistic",
        title: "Participation or attention trend",
        summary: `Use a number showing how ${focus.toLowerCase()} changes turnout, campaign attention, representation, or institutional power.`,
        source: "Election or governance dataset",
        helps: "Shows the scale of the institutional effect.",
      },
      {
        type: "statistic",
        title: "Uneven distribution",
        summary: `A second number should show which regions, voters, or institutions get disproportionate weight.`,
        source: "Election, campaign, or governance reporting",
        helps: "Makes the fairness argument measurable.",
      },
      {
        type: "study",
        title: "Institutional effect study",
        summary: `Find a study on how ${focus.toLowerCase()} changes behavior inside the political system.`,
        source: "Political science research",
        helps: "Turns a civics claim into a documented institutional effect.",
      },
      {
        type: "study",
        title: "Comparative democracy finding",
        summary: `A comparative study helps if the other side says the current system is the only practical one.`,
        source: "Comparative politics literature",
        helps: "Lets you argue that alternatives are not imaginary.",
      },
      {
        type: "historical-example",
        title: "Election-cycle example",
        summary: `Use a recent election or policy cycle where the effect of ${focus.toLowerCase()} became visible.`,
        source: "Historical election example",
        helps: "Gives the round a concrete historical anchor.",
      },
      {
        type: "historical-example",
        title: "Institutional precedent",
        summary: `A precedent-setting reform or court-era example can show what changed when the rules shifted.`,
        source: "Institutional history",
        helps: "Helps when the round turns on consequences, not just values.",
      },
      {
        type: "authority",
        title: "Named constitutional or policy authority",
        summary: `Use a major scholar, judge, or commission position on ${focus.toLowerCase()}.`,
        source: "Named legal or policy authority",
        helps: "Adds credibility when the other side tries to posture as the serious one.",
      },
      {
        type: "authority",
        title: "Practitioner authority",
        summary: `A campaign, governance, or administration authority can explain the real incentives operating behind the scenes.`,
        source: "Named practitioner or public body",
        helps: "Turns theory into lived institutional behavior.",
      },
    ];
  }

  if (templates.labor.length === 0) {
    templates.labor = [
      {
        type: "statistic",
        title: "Productivity or retention number",
        summary: `Use a company-scale or labor-market number on productivity, retention, or attrition tied to ${focus.toLowerCase()}.`,
        source: "Employer or labor-market dataset",
        helps: "Gives the debate a real work-output anchor.",
      },
      {
        type: "statistic",
        title: "Worker distribution effect",
        summary: `A second number should show which workers benefit or lose most from ${focus.toLowerCase()}.`,
        source: "Workforce survey",
        helps: "Lets you argue both efficiency and fairness.",
      },
      {
        type: "study",
        title: "Work design study",
        summary: `Use a study on how job design changes when ${focus.toLowerCase()} changes.`,
        source: "Organizational behavior or labor study",
        helps: "Builds a mechanism instead of only offering a preference.",
      },
      {
        type: "study",
        title: "Managerial tradeoff finding",
        summary: `A good second paper here shows the tradeoff between autonomy, coordination, and output.`,
        source: "Labor economics or management research",
        helps: "Pre-empts the opponent's tradeoff argument.",
      },
      {
        type: "historical-example",
        title: "Large employer example",
        summary: `Use a large employer or sector example that changed course on ${focus.toLowerCase()}.`,
        source: "Employer policy history",
        helps: "Makes the labor story concrete and recent.",
      },
      {
        type: "historical-example",
        title: "Pandemic-era shift",
        summary: `A before-and-after labor shift example helps show what happened once the change scaled in the real world.`,
        source: "Labor market transition example",
        helps: "Turns the debate from theory to lived policy experimentation.",
      },
      {
        type: "authority",
        title: "Named workplace expert",
        summary: `Use a labor economist or management scholar with a specific view on ${focus.toLowerCase()}.`,
        source: "Named workplace authority",
        helps: "Adds a serious voice beyond personal preference.",
      },
      {
        type: "authority",
        title: "Operational authority",
        summary: `A CEO, HR leader, or union authority can speak to the implementation side of ${focus.toLowerCase()}.`,
        source: "Named practitioner authority",
        helps: "Grounds the debate in how workplaces actually function.",
      },
    ];
  }

  if (templates.health.length === 0) {
    templates.health = [
      {
        type: "statistic",
        title: "Population-health trend",
        summary: `Use a prevalence, exposure, or harm trend tied to ${focus.toLowerCase()}.`,
        source: "CDC, NIH, or public-health dataset",
        helps: "Gives the round a clear scale of risk or benefit.",
      },
      {
        type: "statistic",
        title: "High-risk group effect",
        summary: `A second number should show which group is most exposed to the health effect in question.`,
        source: "Public-health reporting",
        helps: "Makes the impact comparison more morally concrete.",
      },
      {
        type: "study",
        title: "Clinical or behavioral finding",
        summary: `Use a study isolating the health, behavioral, or psychological effect connected to ${focus.toLowerCase()}.`,
        source: "Peer-reviewed health study",
        helps: "Supplies causation instead of only correlation language.",
      },
      {
        type: "study",
        title: "Evidence review",
        summary: `A review or meta-analysis helps if the other side tries to overstate certainty either way.`,
        source: "Systematic review",
        helps: "Lets you sound precise instead of alarmist.",
      },
      {
        type: "historical-example",
        title: "Public-health response example",
        summary: `Use a real intervention or policy example that changed outcomes related to ${focus.toLowerCase()}.`,
        source: "Public-health case study",
        helps: "Shows what happens when theory is actually implemented.",
      },
      {
        type: "historical-example",
        title: "Comparable risk example",
        summary: `A comparison to a past health-risk debate can clarify how institutions responded before.`,
        source: "Historical health example",
        helps: "Gives the judge a precedent instead of a guess.",
      },
      {
        type: "authority",
        title: "Named medical authority",
        summary: `Use a statement or finding from a major medical or public-health authority on ${focus.toLowerCase()}.`,
        source: "Named medical authority",
        helps: "Adds confidence without leaning on empty certainty.",
      },
      {
        type: "authority",
        title: "Behavioral health voice",
        summary: `A behavioral health expert can explain how the mechanism actually affects people day to day.`,
        source: "Named researcher or public-health official",
        helps: "Turns the effect into something judges can picture.",
      },
    ];
  }

  if (templates.environment.length === 0) {
    templates.environment = [
      {
        type: "statistic",
        title: "Emissions or exposure trend",
        summary: `Use a number showing the scale of the environmental effect tied to ${focus.toLowerCase()}.`,
        source: "Climate or environmental dataset",
        helps: "Makes the magnitude of the issue measurable.",
      },
      {
        type: "statistic",
        title: "Downstream cost number",
        summary: `A second statistic should show the cost, risk, or burden that follows from the environmental change.`,
        source: "Environmental damage or risk assessment",
        helps: "Lets you translate science into judgeable impact.",
      },
      {
        type: "study",
        title: "Causal environmental study",
        summary: `Use a study showing the mechanism by which ${focus.toLowerCase()} changes environmental outcomes.`,
        source: "Peer-reviewed environmental research",
        helps: "Protects the warrant, not just the conclusion.",
      },
      {
        type: "study",
        title: "Policy-effect evaluation",
        summary: `A second study should show what happened when a policy tried to address this problem in practice.`,
        source: "Environmental policy evaluation",
        helps: "Adds a real-world policy angle.",
      },
      {
        type: "historical-example",
        title: "Policy transition example",
        summary: `Use a country, state, or city example that changed course and produced visible environmental effects.`,
        source: "Historical policy case",
        helps: "Turns abstract risk into institutional history.",
      },
      {
        type: "historical-example",
        title: "Failure-to-act example",
        summary: `A case where institutions delayed action can show the cost of inaction on ${focus.toLowerCase()}.`,
        source: "Historical environmental case",
        helps: "Strengthens urgency without needing melodrama.",
      },
      {
        type: "authority",
        title: "Named scientific body",
        summary: `Use the position of a major scientific body on the environmental mechanism at issue.`,
        source: "Named climate or environmental authority",
        helps: "Signals broad expert grounding.",
      },
      {
        type: "authority",
        title: "Risk-assessment authority",
        summary: `A regulator, insurer, or risk authority can frame why the environmental effect matters in practice.`,
        source: "Named risk or regulatory authority",
        helps: "Connects science to real-world consequences.",
      },
    ];
  }

  if (templates.general.length === 0) {
    templates.general = [
      {
        type: "statistic",
        title: "One hard number",
        summary: `Use one credible number that shows how ${focus.toLowerCase()} actually affects people or institutions at scale.`,
        source: "Named dataset to verify",
        helps: "Prevents the debate from sounding like pure assertion.",
      },
      {
        type: "statistic",
        title: "Distribution or tradeoff number",
        summary: `A second number should show who gains, who loses, or how the tradeoff actually falls.`,
        source: "Survey or administrative data",
        helps: "Lets you move from 'it matters' to 'it matters more for these reasons.'",
      },
      {
        type: "study",
        title: "Mechanism study",
        summary: `Find a study that explains why ${focus.toLowerCase()} produces the effect you care about.`,
        source: "Peer-reviewed or institutional study",
        helps: "Builds the warrant instead of just the conclusion.",
      },
      {
        type: "study",
        title: "Comparison study",
        summary: `A comparative study helps if the round turns on whether your side really beats the alternative.`,
        source: "Comparative policy or behavioral study",
        helps: "Makes the weighing more explicit.",
      },
      {
        type: "historical-example",
        title: "Real-world case",
        summary: `Use a concrete historical case where the same pressure around ${focus.toLowerCase()} already played out.`,
        source: "Historical case study",
        helps: "Turns abstraction into an example judges can remember.",
      },
      {
        type: "historical-example",
        title: "Before-and-after precedent",
        summary: `A before-and-after example helps show what changed when similar rules or incentives changed.`,
        source: "Comparable precedent",
        helps: "Gives the round an observable baseline.",
      },
      {
        type: "authority",
        title: "Named expert",
        summary: `Use a respected scholar, practitioner, or institution willing to say the key thing out loud about ${focus.toLowerCase()}.`,
        source: "Named authority to verify",
        helps: "Adds instant credibility to your core frame.",
      },
      {
        type: "authority",
        title: "Institutional authority",
        summary: `A second authority should come from the institution or field closest to implementation.`,
        source: "Named field authority",
        helps: "Shows the argument survives contact with practice.",
      },
    ];
  }

  for (const [index, template] of templates[lens].entries()) {
    cards.push({
      id: makeId("evidence", `${request.topic}-${template.title}`, index),
      type: template.type,
      title: template.title,
      summary: template.summary,
      source: template.source,
      helps: template.helps,
      debateLine: buildFallbackDebateLine(request.topic, request.userSide, template.summary),
    });
  }

  return cards;
}

export function buildHeuristicEvidence(request: EvidenceRequest): EvidenceResult {
  const focus = normalizeText(request.focus || request.topic);
  const cards = buildHeuristicCards(request).slice(0, request.maxCards ?? 8);
  const bestCard = cards[0];

  return {
    focus,
    bestUse: bestCard
      ? `Use ${bestCard.title.toLowerCase()} first, then extend with one study card and one historical example so the judge gets proof, mechanism, and precedent in three sentences.`
      : `Start with one hard number on ${focus.toLowerCase()}, then add a study and a concrete example so the argument stops sounding speculative.`,
    cards,
    source: "heuristic",
    generatedAt: new Date().toISOString(),
  };
}

function coerceEvidenceCard(value: unknown, fallback: EvidenceCard, index: number): EvidenceCard {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const type =
    record.type === "statistic" ||
    record.type === "study" ||
    record.type === "historical-example" ||
    record.type === "authority"
      ? record.type
      : fallback.type;

  const title =
    typeof record.title === "string" && normalizeText(record.title)
      ? normalizeText(record.title).slice(0, 90)
      : fallback.title;
  const summary =
    typeof record.summary === "string" && normalizeText(record.summary)
      ? normalizeText(record.summary).slice(0, 220)
      : fallback.summary;
  const source =
    typeof record.source === "string" && normalizeText(record.source)
      ? normalizeText(record.source).slice(0, 120)
      : fallback.source;
  const helps =
    typeof record.helps === "string" && normalizeText(record.helps)
      ? normalizeText(record.helps).slice(0, 180)
      : fallback.helps;
  const debateLine =
    typeof record.debateLine === "string" && normalizeText(record.debateLine)
      ? normalizeText(record.debateLine).slice(0, 260)
      : fallback.debateLine;

  return {
    id:
      typeof record.id === "string" && normalizeText(record.id)
        ? normalizeText(record.id)
        : makeId("evidence", title || fallback.title, index),
    type,
    title,
    summary,
    source,
    helps,
    debateLine,
  };
}

export function coerceEvidenceResult(
  value: unknown,
  fallback: EvidenceResult,
): EvidenceResult {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const cards = Array.isArray(record.cards)
    ? record.cards
        .map((card, index) =>
          coerceEvidenceCard(card, fallback.cards[index] ?? fallback.cards[0], index),
        )
        .slice(0, 8)
    : fallback.cards;

  return {
    focus:
      typeof record.focus === "string" && normalizeText(record.focus)
        ? normalizeText(record.focus).slice(0, 120)
        : fallback.focus,
    bestUse:
      typeof record.bestUse === "string" && normalizeText(record.bestUse)
        ? normalizeText(record.bestUse).slice(0, 280)
        : fallback.bestUse,
    cards: cards.length > 0 ? cards : fallback.cards,
    source: record.source === "openrouter" ? "openrouter" : fallback.source,
    generatedAt:
      typeof record.generatedAt === "string" && normalizeText(record.generatedAt)
        ? normalizeText(record.generatedAt)
        : fallback.generatedAt,
  };
}

function pickRelevantEvidenceCard(
  claim: FactCheckClaim,
  cards: EvidenceCard[],
) {
  return [...cards]
    .map((card) => ({
      card,
      score:
        getKeywordOverlap(claim.claim, card.title) * 2 +
        getKeywordOverlap(claim.claim, card.summary) +
        getKeywordOverlap(claim.claim, card.helps),
    }))
    .sort((left, right) => right.score - left.score)[0]?.card ?? cards[0] ?? null;
}

function softenClaim(sentence: string) {
  return normalizeText(
    sentence
      .replace(/\b(always|never|everyone|nobody|all|none|completely|entirely)\b/gi, "often")
      .replace(/\b(obviously|clearly)\b/gi, "the evidence suggests")
      .replace(/\s+/g, " "),
  );
}

export function buildResearchSummary(
  session: DebateSession,
  evidenceResult: EvidenceResult | null,
): ResearchSummary {
  const userClaims = session.messages
    .filter((message) => message.speaker === "You")
    .flatMap((message) => buildFactCheckClaims(message));
  const supportedClaims = userClaims.filter((claim) => claim.status === "supported");
  const unsupportedClaims = [...userClaims]
    .filter((claim) => claim.status !== "supported")
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "false" ? -1 : 1;
      }

      return right.claim.length - left.claim.length;
    });
  const weakestClaim = unsupportedClaims[0] ?? null;
  const bestEvidenceCard =
    weakestClaim && evidenceResult ? pickRelevantEvidenceCard(weakestClaim, evidenceResult.cards) : null;

  return {
    supportedClaims,
    unsupportedClaims,
    strongestFactArgument:
      evidenceResult?.bestUse ??
      (supportedClaims[0]
        ? `Build around "${supportedClaims[0].claim}" and attach one named source so the judge treats it as a fact lane instead of a mere assertion.`
        : `Your next replay should open with one sourced empirical claim on ${session.topic.toLowerCase()} before the opponent can call the case speculative.`),
    weakestClaimOriginal: weakestClaim?.claim ?? null,
    weakestClaimRewrite:
      weakestClaim && bestEvidenceCard
        ? `${softenClaim(weakestClaim.claim)} ${bestEvidenceCard.debateLine}`
        : weakestClaim
          ? `${softenClaim(weakestClaim.claim)} according to a named source, which turns the point from assertion into proof.`
          : `Your weakest unsourced claim is not obvious from the transcript, so the next upgrade is simply adding one named source to the first empirical point you make.`,
  };
}
