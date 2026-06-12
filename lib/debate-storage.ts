import {
  coerceDebateSession,
  type DebateAnalysis,
  type DebateSession,
} from "@/lib/debate";

const ACTIVE_SESSION_KEY = "debate-me.active-session";
const SESSION_PREFIX = "debate-me.session.";
const ANALYSIS_PREFIX = "debate-me.analysis.";
export const ANALYSIS_STORAGE_VERSION = 2;

export type DebateAnalysisSource = "heuristic" | "openrouter";

type StoredAnalysisPayload = {
  version: number;
  sessionKey: string;
  source: DebateAnalysisSource;
  savedAt: string;
  analysis: DebateAnalysis;
};

export type LoadedAnalysisRecord = {
  analysis: DebateAnalysis;
  legacy: boolean;
  savedAt: string | null;
  sessionKey: string | null;
  source: DebateAnalysisSource | null;
  version: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson<T>(key: string) {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function getAnalysisKey(sessionId: string) {
  return `${ANALYSIS_PREFIX}${sessionId}`;
}

function isAnalysisSource(value: unknown): value is DebateAnalysisSource {
  return value === "heuristic" || value === "openrouter";
}

function isStoredAnalysisPayload(value: unknown): value is StoredAnalysisPayload {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    typeof value.sessionKey === "string" &&
    isAnalysisSource(value.source) &&
    typeof value.savedAt === "string" &&
    "analysis" in value
  );
}

export function buildAnalysisSessionKey(
  session: Pick<DebateSession, "id" | "messages" | "updatedAt">,
) {
  return `${session.id}:${session.updatedAt}:${session.messages.length}`;
}

export function saveSession(session: DebateSession) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
  writeJson(`${SESSION_PREFIX}${session.id}`, session);
}

export function loadSession(sessionId: string) {
  return coerceDebateSession(readJson<unknown>(`${SESSION_PREFIX}${sessionId}`));
}

export function loadActiveSessionId() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function loadActiveSession() {
  const sessionId = loadActiveSessionId();
  return sessionId ? loadSession(sessionId) : null;
}

export function listStoredSessions() {
  if (!canUseStorage()) {
    return [] as DebateSession[];
  }

  const sessions: DebateSession[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key || !key.startsWith(SESSION_PREFIX)) {
      continue;
    }

    const session = coerceDebateSession(readJson<unknown>(key));

    if (session) {
      sessions.push(session);
    }
  }

  return sessions.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function saveAnalysis(
  session: Pick<DebateSession, "id" | "messages" | "updatedAt">,
  analysis: DebateAnalysis,
  source: DebateAnalysisSource = "heuristic",
) {
  writeJson(getAnalysisKey(session.id), {
    version: ANALYSIS_STORAGE_VERSION,
    sessionKey: buildAnalysisSessionKey(session),
    source,
    savedAt: new Date().toISOString(),
    analysis,
  } satisfies StoredAnalysisPayload);
}

export function loadAnalysisRecord(sessionId: string): LoadedAnalysisRecord | null {
  const value = readJson<unknown>(getAnalysisKey(sessionId));

  if (!value) {
    return null;
  }

  if (isStoredAnalysisPayload(value)) {
    return {
      analysis: value.analysis,
      legacy: false,
      savedAt: value.savedAt,
      sessionKey: value.sessionKey,
      source: value.source,
      version: value.version,
    };
  }

  return {
    analysis: value as DebateAnalysis,
    legacy: true,
    savedAt: null,
    sessionKey: null,
    source: null,
    version: 0,
  };
}

export function loadAnalysis(sessionId: string) {
  return loadAnalysisRecord(sessionId)?.analysis ?? null;
}

export function needsAnalysisRefresh(
  session: Pick<DebateSession, "id" | "messages" | "updatedAt">,
  record: LoadedAnalysisRecord | null,
) {
  if (!record) {
    return true;
  }

  if (record.version !== ANALYSIS_STORAGE_VERSION) {
    return true;
  }

  if (record.sessionKey !== buildAnalysisSessionKey(session)) {
    return true;
  }

  return record.source !== "openrouter";
}
