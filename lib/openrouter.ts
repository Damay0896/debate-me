type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterOptions = {
  maxTokens?: number;
  temperature?: number;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function requestOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {},
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini",
      messages,
      max_tokens: options.maxTokens ?? 320,
      temperature: options.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenRouter request failed.");
  }

  const content = data.choices?.[0]?.message?.content;

  return typeof content === "string" && content.trim() ? content.trim() : null;
}
