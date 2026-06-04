export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({
        reply: "Missing OPENROUTER_API_KEY in .env.local.",
      });
    }

    const body = await request.json();
    const { topic, side, messages } = body;

    const transcript = messages
      .map((message: { speaker: string; text: string }) => {
        return `${message.speaker}: ${message.text}`;
      })
      .join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content: `You are Debate Me, a sharp but fair AI debate opponent. The user is arguing the ${side} side of this topic: "${topic}". You must argue the opposite side. Keep responses under 120 words. Challenge evidence, logic, assumptions, or ask a pointed follow-up question. Do not say "good point." Do not simply agree.`,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        reply: data?.error?.message || "OpenRouter request failed.",
      });
    }

    return Response.json({
      reply:
        data?.choices?.[0]?.message?.content ||
        "No response from OpenRouter.",
    });
  } catch (error) {
    console.error(error);

    return Response.json({
      reply: "OpenRouter failed. Check PowerShell.",
    });
  }
}