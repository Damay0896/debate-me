import {
  buildHeuristicEvidence,
  coerceEvidenceResult,
  type EvidenceRequest,
} from "@/lib/research";
import { requestOpenRouter } from "@/lib/openrouter";

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function coerceEvidenceRequest(value: unknown): EvidenceRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const topic =
    typeof record.topic === "string" && record.topic.trim() ? record.topic.trim() : "";
  const userSide = record.userSide === "Pro" || record.userSide === "Con" ? record.userSide : null;

  if (!topic || !userSide) {
    return null;
  }

  return {
    topic,
    userSide,
    opponentSide: record.opponentSide === "Pro" || record.opponentSide === "Con" ? record.opponentSide : undefined,
    transcript:
      typeof record.transcript === "string" && record.transcript.trim()
        ? record.transcript.trim()
        : undefined,
    focus:
      typeof record.focus === "string" && record.focus.trim() ? record.focus.trim() : undefined,
    maxCards:
      typeof record.maxCards === "number" && Number.isFinite(record.maxCards)
        ? Math.max(1, Math.min(8, Math.round(record.maxCards)))
        : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { request?: unknown };
    const evidenceRequest = coerceEvidenceRequest(body.request);

    if (!evidenceRequest) {
      return Response.json(
        {
          error: "Invalid evidence request.",
        },
        { status: 400 },
      );
    }

    const fallback = buildHeuristicEvidence(evidenceRequest);

    try {
      const response = await requestOpenRouter(
        [
          {
            role: "system",
            content:
              'You generate concise debate evidence. Return strict JSON only. Top-level keys: "focus" (string), "bestUse" (string), "cards" (array of exactly 8 objects). Each card must have keys "id" (string), "type" (one of statistic|study|historical-example|authority), "title" (string), "summary" (string), "source" (string), "helps" (string), and "debateLine" (string). Requirements: exactly 2 statistic cards, 2 study cards, 2 historical-example cards, and 2 authority cards. Make every item support the USER side of the debate. Keep each summary to one sentence, keep source fields short, and make debateLine a single natural sentence ready to paste into a debate turn. Use real named authorities or source labels when reasonably confident. If a precise number or quote is uncertain, prefer careful wording and label the source as "Source to verify" rather than inventing certainty. Do not include markdown or any text outside the JSON object.',
          },
          {
            role: "user",
            content: [
              `Topic: ${evidenceRequest.topic}`,
              `User side: ${evidenceRequest.userSide}`,
              evidenceRequest.opponentSide ? `Opponent side: ${evidenceRequest.opponentSide}` : null,
              evidenceRequest.focus ? `Current focus: ${evidenceRequest.focus}` : null,
              evidenceRequest.transcript ? `Transcript:\n${evidenceRequest.transcript}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        {
          maxTokens: 1400,
          temperature: 0.35,
        },
      );

      const json = response ? extractJsonObject(response) : null;

      if (!json) {
        throw new Error("Model did not return a JSON object.");
      }

      const result = coerceEvidenceResult(
        {
          ...(JSON.parse(json) as unknown as object),
          source: "openrouter",
          generatedAt: new Date().toISOString(),
        },
        fallback,
      );

      return Response.json({
        result,
        source: "openrouter",
      });
    } catch (error) {
      console.error("Evidence generation via OpenRouter failed.", error);

      return Response.json({
        result: fallback,
        source: "heuristic",
      });
    }
  } catch (error) {
    console.error("Evidence route failed.", error);

    return Response.json(
      {
        error: "Could not generate evidence right now.",
      },
      { status: 500 },
    );
  }
}
