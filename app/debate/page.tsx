import {
  normalizeLiveFeedbackMode,
  normalizeOpponentPersonality,
  normalizeReplyStyle,
  normalizeSideChoice,
  normalizeTopic,
  readSearchParam,
} from "@/lib/debate";

import DebateExperience from "./debate-experience";

type DebatePageProps = {
  searchParams: Promise<{
    topic?: string | string[];
    side?: string | string[];
    session?: string | string[];
    personality?: string | string[];
    style?: string | string[];
    focus?: string | string[];
    coach?: string | string[];
  }>;
};

export default async function DebatePage({ searchParams }: DebatePageProps) {
  const params = await searchParams;

  return (
    <DebateExperience
      initialSessionId={readSearchParam(params.session) ?? ""}
      initialOpponentPersonality={normalizeOpponentPersonality(
        readSearchParam(params.personality),
      )}
      initialReplyStyle={normalizeReplyStyle(readSearchParam(params.style))}
      initialSideChoice={normalizeSideChoice(readSearchParam(params.side))}
      initialTopic={normalizeTopic(readSearchParam(params.topic))}
      initialCoachFocus={readSearchParam(params.focus) ?? ""}
      initialLiveFeedbackMode={normalizeLiveFeedbackMode(
        readSearchParam(params.coach),
      )}
    />
  );
}
