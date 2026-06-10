"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Message = {
  speaker: "AI Opponent" | "You";
  text: string;
};

function DebateContent() {
  const searchParams = useSearchParams();

  const topic =
    searchParams.get("topic") || "Social media does more harm than good";

  const side = searchParams.get("side") || "Pro";

  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      speaker: "AI Opponent",
      text: "I will argue against your position. Make your first claim.",
    },
  ]);

  async function sendMessage() {
    if (input.trim() === "") return;

    const userMessage: Message = {
      speaker: "You",
      text: input,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");

    try {
      const response = await fetch("/api/debate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          side,
          messages: updatedMessages,
        }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        speaker: "AI Opponent",
        text: data.reply || "Something went wrong.",
      };

      setMessages([...updatedMessages, aiMessage]);
    } catch {
      const errorMessage: Message = {
        speaker: "AI Opponent",
        text: "Could not reach /api/debate.",
      };

      setMessages([...updatedMessages, errorMessage]);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="mb-6 bg-gray-800 px-4 py-2 rounded-lg"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Debate</h1>

        <p className="text-gray-400 mb-6">
          Topic: {topic} | Side: {side}
        </p>

        <div className="mb-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className="border border-gray-700 rounded-xl p-4 mb-4"
            >
              <p className="text-gray-400">{message.speaker}</p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>

        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4"
          rows={5}
          placeholder="Type your argument..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          onClick={sendMessage}
          className="bg-white text-black px-6 py-3 rounded-xl font-bold"
        >
          Send
        </button>

        <button
          onClick={() => {
            window.location.href = "/results";
          }}
          className="ml-4 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold"
        >
          End Debate
        </button>
      </div>
    </main>
  );
}

export default function DebatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading debate...</div>}>
      <DebateContent />
    </Suspense>
  );
}