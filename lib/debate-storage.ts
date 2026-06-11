import {
  coerceDebateSession,
  type DebateAnalysis,
  type DebateSession,
} from "@/lib/debate";

const ACTIVE_SESSION_KEY = "debate-me.active-session";
const SESSION_PREFIX = "debate-me.session.";
const ANALYSIS_PREFIX = "debate-me.analysis.";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

export function saveAnalysis(sessionId: string, analysis: DebateAnalysis) {
  writeJson(`${ANALYSIS_PREFIX}${sessionId}`, analysis);
}

export function loadAnalysis(sessionId: string) {
  return readJson<DebateAnalysis>(`${ANALYSIS_PREFIX}${sessionId}`);
}
