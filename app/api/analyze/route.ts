import {
  buildHeuristicAnalysis,
  coerceDebateAnalysis,
  coerceDebateSession,
  sessionToTranscript,
} from "@/lib/debate";
import { requestOpenRouter } from "@/lib/openrouter";

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { session?: unknown };
    const session = coerceDebateSession(body.session);

    if (!session) {
      return Response.json(
        {
          error: "Invalid debate session.",
        },
        { status: 400 },
      );
    }

    const fallbackAnalysis = buildHeuristicAnalysis(session);

    try {
      const response = await requestOpenRouter(
        [
          {
            role: "system",
            content:
              'You are an elite debate coach. Evaluate the entire transcript, but judge whether the USER or AI OPPONENT won the round. Return strict JSON with exactly these top-level keys: "score" (number 0-100), "result" (string), "winner" (string), "winnerConfidence" (number 50-100), "verdict" (string), "summary" (string), "winnerReasoning" (string, 2-3 sentences), "strongestArgument" (string), "biggestUserMistake" (string), "biggestOpponentMistake" (string), "flipSentence" (string), "strengths" (array of 2-4 short strings), "weaknesses" (array of 2-4 short strings), "nextSteps" (array of 3-4 concrete coaching strings), "highlights" (array of 2-4 short strings), "metrics" (array of exactly 7 objects with keys "key", "label", "score", "note"), "argumentFrames" (array of 2-4 objects with keys "id", "title", "claim", "premises", "warrant", "impact", "vulnerability", "status"), "fallacies" (array of 3-6 objects with keys "name", "severity", "description", "evidence"), "collapsePoints" (array of exactly 3 objects with keys "title", "severity", "trigger", "whyItBreaks", "repair"), "momentum" (array of 4 objects with keys "label", "score", "note"), "argumentMap" (object with keys "headline", "nodes", "edges"), "bestNextImprovement" (object with keys "skill", "title", "reason", "drill"), "transcriptReceipts" (array of 3-4 objects with keys "id", "title", "speaker", "quote", "diagnosis", "fix"), "missedOpportunities" (array of 2-3 objects with keys "title", "missedArgument", "whyItWasAvailable", "betterVersion"), "opponentCaseReview" (object with keys "strongestPoint", "strongestQuote", "whyItWorked", "bestCounter"), and "replayFocus" (string). Use only these enum values: result -> win|loss|tie; winner -> You|AI Opponent|Tie; metrics.key -> logic|evidence|rebuttal|persuasion|weighing|clarity|discipline; argumentFrames.status -> anchor|developing|collapse-risk; fallacies.severity -> low|medium|high; collapsePoints.severity -> medium|high; bestNextImprovement.skill -> logic|evidence|rebuttal|persuasion|weighing|clarity|discipline; argumentMap.nodes[].kind -> premise|claim|impact|counter|assumption; argumentMap.nodes[].column -> 0|1|2; argumentMap.edges[].relation -> supports|attacks|depends; transcriptReceipts.speaker -> You|AI Opponent. Make the advice highly specific to the actual transcript, use short direct transcript quotes for quote fields, and explain what the user missed, what the opponent did best, and the cleanest counter. Keep strings concise, grounded in the transcript, actionable, and coach-like. Use the fallacies array specifically for logical weaknesses such as bare assertions, sweeping generalizations, missing evidence, missing warrant, weak impact comparison, and definition ambiguity when applicable. Do not include markdown or any prose outside the JSON object.',
          },
          {
            role: "user",
            content: `Topic: ${session.topic}\nUser side: ${session.userSide}\nOpponent side: ${session.opponentSide}\nOpponent personality: ${session.opponentPersonality}\nReply style: ${session.replyStyle}\nTranscript:\n${sessionToTranscript(session)}`,
          },
        ],
        {
          maxTokens: 1700,
          temperature: 0.4,
        },
      );

      const json = response ? extractJsonObject(response) : null;

      if (!json) {
        throw new Error("Model did not return a JSON object.");
      }

      const analysis = coerceDebateAnalysis(
        JSON.parse(json) as unknown,
        fallbackAnalysis,
      );

      return Response.json({
        analysis,
        source: "openrouter",
      });
    } catch (error) {
      console.error("OpenRouter analysis failed.", error);

      return Response.json({
        analysis: fallbackAnalysis,
        source: "heuristic",
      });
    }
  } catch (error) {
    console.error("Analyze route failed.", error);

    return Response.json(
      {
        error: "Could not analyze that debate.",
      },
      { status: 500 },
    );
  }
}
