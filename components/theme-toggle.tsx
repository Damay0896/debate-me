"use client";

import { useEffect, useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

type ThemeMode = "light" | "dark";
const THEME_EVENT = "debate-me-theme-change";
const BODY_THEME_STYLES: Record<ThemeMode, { background: string; color: string }> = {
  dark: {
    background:
      "radial-gradient(circle at top, rgba(255, 139, 61, 0.18), transparent 30%), radial-gradient(circle at 18% 18%, rgba(244, 201, 93, 0.16), transparent 20%), linear-gradient(180deg, #090909 0%, #121212 55%, #0c0c0c 100%)",
    color: "#f5efe4",
  },
  light: {
    background:
      "radial-gradient(circle at top, rgba(255, 139, 61, 0.16), transparent 32%), radial-gradient(circle at 18% 18%, rgba(244, 201, 93, 0.18), transparent 22%), linear-gradient(180deg, #fffaf3 0%, #f7efe4 56%, #f0e5d7 100%)",
    color: "#1f1711",
  },
};

function getThemeFromDom(): ThemeMode {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function syncBodyTheme(theme: ThemeMode) {
  if (typeof document === "undefined" || !document.body) {
    return;
  }

  document.body.style.background = BODY_THEME_STYLES[theme].background;
  document.body.style.color = BODY_THEME_STYLES[theme].color;
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  syncBodyTheme(theme);
  window.requestAnimationFrame(() => {
    syncBodyTheme(theme);
  });
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribeToTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function subscribeToHydration() {
  return () => {};
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2" />
      <path d="M12 19.3v2.2" />
      <path d="M4.9 4.9l1.6 1.6" />
      <path d="M17.5 17.5l1.6 1.6" />
      <path d="M2.5 12h2.2" />
      <path d="M19.3 12h2.2" />
      <path d="M4.9 19.1l1.6-1.6" />
      <path d="M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.2A7.9 7.9 0 0 1 9.8 4a8.6 8.6 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeFromDom,
    () => "dark" as ThemeMode,
  );
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    syncBodyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle inline-flex items-center gap-3 rounded-full border px-4 py-3 backdrop-blur-xl"
      aria-label={
        mounted
          ? `Switch to ${theme === "dark" ? "light" : "dark"} mode`
          : "Toggle theme"
      }
    >
      <span className="theme-toggle-icon flex h-9 w-9 items-center justify-center rounded-full border">
        <span className="theme-accent">
          {mounted && theme === "light" ? <SunIcon /> : <MoonIcon />}
        </span>
      </span>

      <span className="flex flex-col items-start leading-none">
        <span className="theme-muted text-[11px] uppercase tracking-[0.28em]">
          Theme
        </span>
        <span className="mt-1 text-sm font-semibold">
          {mounted ? (theme === "dark" ? "Dark" : "Light") : "Theme"}
        </span>
      </span>
    </button>
  );
}
