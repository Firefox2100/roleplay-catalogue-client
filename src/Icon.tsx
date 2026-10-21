import type { ReactNode } from "react";

export type IconName = "assistant" | "assets" | "back" | "book" | "close" | "dialogue" | "extensions" | "foundation" | "import" | "menu" | "metadata" | "overview" | "play" | "preset" | "refresh" | "scenes" | "settings" | "sync" | "world";

const paths: Record<IconName, ReactNode> = {
  assistant: <><path d="M12 3.5 13.7 8l4.8 1.8-4.8 1.8L12 16l-1.7-4.4-4.8-1.8L10.3 8 12 3.5Z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/></>,
  assets: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 4.5-4.5 3 3 2-2 6.5 6.5"/></>,
  back: <path d="m15 18-6-6 6-6"/>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  dialogue: <><path d="M7 8h10M7 12h7"/><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></>,
  extensions: <><path d="M8 3v4M16 3v4M5 7h14v4a7 7 0 0 1-14 0V7Z"/><path d="M12 18v3"/></>,
  foundation: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  import: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 21h14"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  metadata: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></>,
  preset: <><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
  scenes: <><path d="M4 5h16v14H4z"/><path d="m4 9 4-4 4 4 4-4 4 4M8 13h8"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  sync: <><path d="M20 7h-6V1M20 7A9 9 0 0 0 5 5M4 17h6v6M4 17a9 9 0 0 0 15 2"/></>,
  world: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
