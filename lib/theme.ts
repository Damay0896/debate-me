export const THEME_STORAGE_KEY = "debate-me.theme";

export const THEME_INIT_SCRIPT = `
(() => {
  const root = document.documentElement;
  const storageKey = "${THEME_STORAGE_KEY}";

  try {
    const stored = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const theme = stored === "light" || stored === "dark" ? stored : systemTheme;

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
  }
})();
`;
