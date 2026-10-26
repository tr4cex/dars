import { html } from "./lib.js";

const P = {
  logo: ['<path d="M9 20c0-5 3-9 8-9 4 0 6.5 2.6 6.5 6.2 0 4.2-3.6 6.3-8 6.3" /><circle cx="11.5" cy="25.5" r="2" fill="currentColor" stroke="none"/>', "0 0 32 32", 3],
  plus: ['<path d="M12 5v14M5 12h14"/>', null, 2],
  trash: ['<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>'],
  sun: ['<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  moon: ['<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>'],
  gear: ['<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'],
  send: ['<path d="M12 19V5M5 12l7-7 7 7"/>', null, 2.2],
  stop: ['<rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" stroke="none"/>'],
  ask: ['<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>'],
  lib: ['<path d="M4 5a2 2 0 012-2h3v18H6a2 2 0 01-2-2zM9 3h4v18H9zM15 5.5l3.7-1 3 15.3-3.8.9z"/>'],
  study: ['<path d="M2 9l10-5 10 5-10 5zM6 11.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>'],
  upload: ['<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', null, 2],
  link: ['<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'],
  eye: ['<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
  retry: ['<path d="M3 12a9 9 0 0115.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.3L3 16M3 21v-5h5"/>'],
  close: ['<path d="M6 6l12 12M18 6L6 18"/>', null, 2],
  menu: ['<path d="M4 7h16M4 12h16M4 17h10"/>', null, 2],
  copy: ['<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 012-2h9"/>'],
  quote: ['<path d="M4 5h16v11H9l-5 4z"/>'],
  scope: ['<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', null, 2],
  check: ['<path d="M5 12.5l4.5 4.5L19 7.5"/>', null, 3.2],
  left: ['<path d="M15 5l-7 7 7 7"/>', null, 2.2],
  right: ['<path d="M9 5l7 7-7 7"/>', null, 2.2],
  summary: ['<path d="M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4"/>'],
  quiz: ['<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/>'],
  cards: ['<rect x="3" y="7" width="14" height="12" rx="2.5"/><path d="M7 4h12a2 2 0 012 2v9"/>'],
  bolt: ['<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
  layers: ['<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>'],
  spark: ['<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'],
};

export function Icon({ n, className = "" }) {
  const [inner, vb, w] = P[n];
  return html`<svg className=${className} viewBox=${vb || "0 0 24 24"} fill="none" stroke="currentColor" strokeWidth=${w || 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: inner }} />`;
}
