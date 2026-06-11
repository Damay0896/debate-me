export const THEME_STYLE_BLOCK = `
:root {
  --background: #090909;
  --page-background:
    radial-gradient(circle at top, rgba(255, 139, 61, 0.18), transparent 30%),
    radial-gradient(circle at 18% 18%, rgba(244, 201, 93, 0.16), transparent 20%),
    linear-gradient(180deg, #090909 0%, #121212 55%, #0c0c0c 100%);
  --foreground: #f5efe4;
  --foreground-soft: #d8cfc2;
  --muted: #afa496;
  --card: rgba(255, 255, 255, 0.06);
  --card-soft: rgba(255, 255, 255, 0.045);
  --panel: rgba(20, 17, 12, 0.9);
  --surface-soft: rgba(0, 0, 0, 0.24);
  --surface-strong: rgba(0, 0, 0, 0.34);
  --surface-hover: rgba(255, 255, 255, 0.09);
  --input: rgba(0, 0, 0, 0.3);
  --input-strong: rgba(0, 0, 0, 0.4);
  --border: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.22);
  --accent: #f4c95d;
  --accent-strong: #ff8b3d;
  --accent-muted: rgba(244, 201, 93, 0.82);
  --accent-shadow: rgba(244, 201, 93, 0.22);
  --accent-ink: #23170e;
  --accent-focus: rgba(244, 201, 93, 0.58);
  --accent-border: rgba(244, 201, 93, 0.3);
  --accent-surface: linear-gradient(135deg, #f4c95d 0%, #f1ab4c 52%, #ff8b3d 100%);
  --user-message: rgba(244, 201, 93, 0.12);
  --shadow-strong: rgba(0, 0, 0, 0.28);
  --track: rgba(255, 255, 255, 0.08);
  --error: #f7b267;
  --selection: rgba(244, 201, 93, 0.35);
  --diagram-bg: rgba(255, 255, 255, 0.02);
  --diagram-grid: rgba(255, 255, 255, 0.14);
  --diagram-spoke: rgba(255, 255, 255, 0.12);
  --diagram-label: #e7e5e4;
  --diagram-muted: #a8a29e;
  --diagram-chip: #120f0d;
  --diagram-chip-border: rgba(255, 255, 255, 0.08);
  --radar-fill: rgba(245, 194, 77, 0.2);
  --radar-stroke: #f4c34d;
  --radar-point: #f4c34d;
  --radar-point-glow: rgba(244, 195, 77, 0.16);
  --map-premise-fill: #201711;
  --map-premise-stroke: #f4c34d;
  --map-claim-fill: #23170e;
  --map-claim-stroke: #fb923c;
  --map-impact-fill: #161d28;
  --map-impact-stroke: #7dd3fc;
  --map-counter-fill: #231211;
  --map-counter-stroke: #f97316;
  --map-assumption-fill: #17162a;
  --map-assumption-stroke: #a78bfa;
}

html[data-theme="light"] {
  --background: #f6efe5;
  --page-background:
    radial-gradient(circle at top, rgba(255, 139, 61, 0.16), transparent 32%),
    radial-gradient(circle at 18% 18%, rgba(244, 201, 93, 0.18), transparent 22%),
    linear-gradient(180deg, #fffaf3 0%, #f7efe4 56%, #f0e5d7 100%);
  --foreground: #1f1711;
  --foreground-soft: #4f4235;
  --muted: #76695e;
  --card: rgba(255, 255, 255, 0.72);
  --card-soft: rgba(255, 255, 255, 0.62);
  --panel: rgba(255, 248, 239, 0.94);
  --surface-soft: rgba(99, 77, 50, 0.08);
  --surface-strong: rgba(99, 77, 50, 0.12);
  --surface-hover: rgba(99, 77, 50, 0.16);
  --input: rgba(255, 255, 255, 0.84);
  --input-strong: rgba(255, 255, 255, 0.96);
  --border: rgba(76, 61, 46, 0.14);
  --border-strong: rgba(76, 61, 46, 0.24);
  --accent-muted: #bf6d25;
  --accent-shadow: rgba(208, 123, 45, 0.2);
  --accent-ink: #20140d;
  --accent-focus: rgba(208, 123, 45, 0.38);
  --accent-border: rgba(208, 123, 45, 0.26);
  --user-message: rgba(244, 201, 93, 0.24);
  --shadow-strong: rgba(104, 79, 53, 0.14);
  --track: rgba(61, 46, 34, 0.12);
  --error: #a3431b;
  --selection: rgba(255, 139, 61, 0.24);
  --diagram-bg: rgba(99, 77, 50, 0.05);
  --diagram-grid: rgba(99, 77, 50, 0.18);
  --diagram-spoke: rgba(99, 77, 50, 0.14);
  --diagram-label: #423427;
  --diagram-muted: #76695e;
  --diagram-chip: rgba(255, 248, 239, 0.96);
  --diagram-chip-border: rgba(76, 61, 46, 0.12);
  --radar-fill: rgba(245, 194, 77, 0.16);
  --radar-stroke: #d28436;
  --radar-point: #cf7c31;
  --radar-point-glow: rgba(208, 123, 45, 0.18);
  --map-premise-fill: #fff6eb;
  --map-premise-stroke: #d68b2e;
  --map-claim-fill: #fff0dd;
  --map-claim-stroke: #d66f2d;
  --map-impact-fill: #edf6ff;
  --map-impact-stroke: #5497c8;
  --map-counter-fill: #fff0ec;
  --map-counter-stroke: #d26b33;
  --map-assumption-fill: #f3efff;
  --map-assumption-stroke: #8f74de;
}

html {
  background-color: var(--background);
  color-scheme: dark;
}

body {
  background: var(--page-background);
  color: var(--foreground);
  transition:
    background 180ms ease,
    color 180ms ease;
}

::selection {
  background: var(--selection);
  color: var(--foreground);
}

html[data-theme="light"] {
  color-scheme: light;
}

button,
textarea,
svg circle,
svg line,
svg path,
svg polygon,
svg rect,
svg text {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease,
    fill 160ms ease,
    stroke 160ms ease;
}

.theme-strong {
  color: var(--foreground);
}

.theme-copy {
  color: var(--foreground-soft);
}

.theme-muted {
  color: var(--muted);
}

.theme-accent {
  color: var(--accent);
}

.theme-kicker {
  color: var(--accent-muted);
}

.theme-card {
  background: var(--card);
  border-color: var(--border);
  box-shadow: 0 24px 72px var(--shadow-strong);
}

.theme-panel {
  background: var(--panel);
  border-color: var(--border);
  box-shadow: 0 30px 80px var(--shadow-strong);
}

.theme-surface {
  background: var(--surface-soft);
  border-color: var(--border);
}

.theme-surface-strong {
  background: var(--surface-strong);
  border-color: var(--border);
}

.theme-subcard {
  background: var(--card-soft);
  border-color: var(--border);
}

.theme-pill {
  background: var(--surface-soft);
  border-color: var(--border);
  color: var(--foreground-soft);
}

.theme-button-secondary {
  background: var(--surface-soft);
  border-color: var(--border);
  color: var(--foreground);
}

.theme-button-secondary:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.theme-button-primary {
  background: var(--accent-surface);
  box-shadow: 0 16px 40px var(--accent-shadow);
  color: var(--accent-ink);
}

.theme-button-primary:hover {
  filter: brightness(1.03);
}

.theme-input {
  background: var(--input);
  border-color: var(--border);
  color: var(--foreground);
}

.theme-input::placeholder {
  color: var(--muted);
}

.theme-input:focus {
  background: var(--input-strong);
  border-color: var(--accent-focus);
}

.theme-option {
  background: var(--surface-soft);
  border-color: var(--border);
  color: var(--foreground);
}

.theme-option:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.theme-option-copy {
  color: var(--muted);
}

.theme-option-active {
  background: var(--accent-surface);
  border-color: transparent;
  box-shadow: 0 16px 34px var(--accent-shadow);
  color: var(--accent-ink);
}

.theme-option-active .theme-option-copy {
  color: rgba(35, 23, 14, 0.76);
}

.theme-chat-opponent {
  background: var(--surface-strong);
  border-color: var(--border);
}

.theme-chat-user {
  background: var(--user-message);
  border-color: var(--accent-border);
}

.theme-error {
  color: var(--error);
}

.theme-status-anchor {
  background: rgba(16, 185, 129, 0.14);
  border-color: rgba(16, 185, 129, 0.28);
  color: #d1fae5;
}

.theme-status-developing {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.28);
  color: #fef3c7;
}

.theme-status-collapse {
  background: rgba(249, 115, 22, 0.14);
  border-color: rgba(249, 115, 22, 0.28);
  color: #ffedd5;
}

.theme-flag-low {
  background: rgba(14, 165, 233, 0.14);
  border-color: rgba(14, 165, 233, 0.28);
  color: #e0f2fe;
}

.theme-flag-medium {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.28);
  color: #fef3c7;
}

.theme-flag-high {
  background: rgba(249, 115, 22, 0.14);
  border-color: rgba(249, 115, 22, 0.28);
  color: #ffedd5;
}

.theme-accent-chip {
  background: rgba(244, 201, 93, 0.12);
  border-color: rgba(244, 201, 93, 0.28);
  color: var(--accent);
}

html[data-theme="light"] .theme-status-anchor {
  color: #166534;
}

html[data-theme="light"] .theme-status-developing,
html[data-theme="light"] .theme-flag-medium {
  color: #9a5808;
}

html[data-theme="light"] .theme-status-collapse,
html[data-theme="light"] .theme-flag-high {
  color: #9a3412;
}

html[data-theme="light"] .theme-flag-low {
  color: #155e75;
}

html[data-theme="light"] .theme-accent-chip {
  color: #a65d1a;
}

.theme-toggle {
  background: var(--card);
  border-color: var(--border);
  box-shadow: 0 14px 36px var(--shadow-strong);
  color: var(--foreground);
}

.theme-toggle:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.theme-toggle-icon {
  background: var(--surface-soft);
  border-color: var(--border);
}
`;
