"use client";

import { useState } from "react";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [side, setSide] = useState("Pro");

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl border border-gray-700 rounded-2xl p-8">
        <h1 className="text-4xl font-bold mb-2">Debate Me</h1>
        <p className="text-gray-400 mb-8">Sharpen your arguments.</p>

        <label className="block mb-2 font-semibold">Topic</label>
        <input
          className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 mb-6"
          placeholder="Social media does more harm than good"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <label className="block mb-2 font-semibold">Side</label>
        <div className="flex gap-3 mb-8">
          {["Pro", "Con", "Random"].map((option) => (
            <button
              key={option}
              onClick={() => setSide(option)}
              className={`px-4 py-2 rounded-lg border ${
                side === option
                  ? "bg-white text-black"
                  : "bg-gray-900 border-gray-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

  <button
  onClick={() => {
    const params = new URLSearchParams({
      topic: topic || "Social media does more harm than good",
      side: side,
    });

    window.location.href = `/debate?${params.toString()}`;
  }}
  className="w-full bg-white text-black py-3 rounded-lg font-bold"
>
  Start Debate
</button>
      </div>
    </main>
  );
}