import {
  buildDebateSystemPrompt,
  buildFallbackOpponentReply,
  coerceDebateSession,
  getReplyStyleMeta,
  sessionToTranscript,
} from "@/lib/debate";
import { requestOpenRouter } from "@/lib/openrouter";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { session?: unknown };
    const session = coerceDebateSession(body.session);

    if (!session) {
      return Response.json(
        {
          reply: "I could not read that debate turn. Try sending it again.",
        },
        { status: 400 },
      );
    }

    const fallbackReply = buildFallbackOpponentReply(session);

    try {
      const replyStyle = getReplyStyleMeta(session.replyStyle);
      const response = await requestOpenRouter(
        [
          {
            role: "system",
            content: buildDebateSystemPrompt(session),
          },
          {
            role: "user",
            content: sessionToTranscript(session),
          },
        ],
        {
          maxTokens: replyStyle.maxTokens,
          temperature: 0.8,
        },
      );

      if (response) {
        return Response.json({
          reply: response,
        });
      }
    } catch (error) {
      console.error("OpenRouter debate response failed.", error);
    }

    return Response.json({
      reply: fallbackReply,
    });
  } catch (error) {
    console.error("Debate route failed.", error);

    return Response.json(
      {
        reply: "I lost the thread for a moment. Restate your claim in one sharp sentence.",
      },
      { status: 500 },
    );
  }
}
