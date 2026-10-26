export const React = window.React;
export const ReactDOM = window.ReactDOM;
export const {
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useReducer, useContext,
  createContext, memo, useDeferredValue, useTransition, useId, Fragment, Component,
} = React;
export const html = window.htm.bind(React.createElement);
export const cx = (...a) => a.flat(Infinity).filter(Boolean).join(" ");

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

export async function api(path, opts = {}) {
  const init = { method: opts.method || "GET", headers: {} };
  if (opts.json !== undefined) { init.body = JSON.stringify(opts.json); init.headers["Content-Type"] = "application/json"; }
  if (opts.form) init.body = opts.form;
  const res = await fetch("/api" + path, init);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.detail) || `Request failed (${res.status})`);
  return data;
}
