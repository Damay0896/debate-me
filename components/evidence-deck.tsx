"use client";

import type { EvidenceCard, EvidenceResult } from "@/lib/research";

const evidenceTypeLabel: Record<EvidenceCard["type"], string> = {
  statistic: "Statistic",
  study: "Study",
  "historical-example": "Historical example",
  authority: "Authority",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EvidenceDeck({
  result,
  status,
  emptyCopy,
  error,
  actionLabel = "Copy into argument",
  onUseCard,
}: {
  result: EvidenceResult | null;
  status: "idle" | "loading" | "ready" | "error";
  emptyCopy: string;
  error?: string | null;
  actionLabel?: string;
  onUseCard?: ((card: EvidenceCard) => void) | null;
}) {
  if (status === "loading") {
    return (
      <div className="theme-surface rounded-[1.45rem] border p-4">
        <p className="theme-muted text-xs uppercase tracking-[0.22em]">Finding evidence...</p>
        <p className="theme-copy mt-3 text-sm leading-6">
          Pulling together usable stats, studies, examples, and authorities for this side.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="theme-surface rounded-[1.45rem] border p-4">
        <p className="theme-muted text-xs uppercase tracking-[0.22em]">Research desk</p>
        <p className="theme-copy mt-3 text-sm leading-6">
          {error || "Evidence generation hit a snag. Try again in a moment."}
        </p>
      </div>
    );
  }

  if (!result || result.cards.length === 0) {
    return (
      <div className="theme-surface rounded-[1.45rem] border p-4">
        <p className="theme-copy text-sm leading-6">{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="theme-surface rounded-[1.45rem] border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="theme-muted text-xs uppercase tracking-[0.22em]">Evidence ready</p>
          <span className="theme-status-anchor rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">
            {result.source === "openrouter" ? "AI sourced" : "Source leads"}
          </span>
        </div>
        <p className="theme-strong mt-3 text-sm leading-6">{result.bestUse}</p>
      </div>

      <div className="grid gap-4">
        {result.cards.map((card) => (
          <article
            key={card.id}
            className="theme-subcard rounded-[1.35rem] border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="theme-muted text-[0.68rem] uppercase tracking-[0.16em]">
                  {evidenceTypeLabel[card.type]}
                </p>
                <h3 className="mt-2 text-base font-semibold">{card.title}</h3>
              </div>
              <span
                className={cx(
                  "rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
                  card.type === "statistic"
                    ? "theme-status-anchor"
                    : card.type === "study"
                      ? "theme-status-developing"
                      : "theme-status-collapse",
                )}
              >
                {evidenceTypeLabel[card.type]}
              </span>
            </div>

            <p className="theme-copy mt-3 text-sm leading-6">{card.summary}</p>

            <div className="mt-4 grid gap-3">
              <div className="theme-surface rounded-[1.05rem] border p-3">
                <p className="theme-muted text-[0.65rem] uppercase tracking-[0.14em]">Source</p>
                <p className="theme-copy mt-2 text-sm leading-5">{card.source}</p>
              </div>
              <div className="theme-surface rounded-[1.05rem] border p-3">
                <p className="theme-muted text-[0.65rem] uppercase tracking-[0.14em]">
                  Why it helps
                </p>
                <p className="theme-copy mt-2 text-sm leading-5">{card.helps}</p>
              </div>
            </div>

            {onUseCard ? (
              <button
                type="button"
                onClick={() => onUseCard(card)}
                className="theme-button-secondary mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-medium transition"
              >
                {actionLabel}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
