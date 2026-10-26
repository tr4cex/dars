import { ReactDOM, html, cx, useRef, useEffect, useLayoutEffect, useState } from "./lib.js";
import { Icon } from "./icons.js";
import { typeset, placeCaret } from "./markdown.js";
import { useApp } from "./store.js";

export const btn = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-[18px] py-[11px] text-sm font-semibold transition duration-300 ease-out active:scale-[.97] disabled:pointer-events-none disabled:opacity-45 [&>svg]:size-[17px] [&>svg]:shrink-0";
export const btnPrimary = "bg-btn text-btnink hover:opacity-90";
export const btnGhost = "border border-line bg-surface2 hover:-translate-y-px hover:border-line2 hover:bg-surface3";
export const btnDanger = "bg-bad text-[#1c0a06] hover:opacity-90";
export const btnSm = "!px-[13px] !py-2 !text-[13px] !rounded-[11px]";
export const iconBtn = "grid size-8 shrink-0 place-items-center rounded-[10px] text-muted transition duration-300 ease-out hover:scale-105 hover:bg-surface3 hover:text-ink [&>svg]:size-[17px]";
export const fieldInput = "w-full min-w-0 rounded-[10px] border border-line2 bg-[var(--field)] px-3.5 py-[11px] text-[15px] outline-none transition-colors focus:border-accent placeholder:text-faint";
export const labelCls = "text-[11px] font-semibold uppercase tracking-[.14em] text-faint";

export function Button({ kind = "primary", small, className, children, ...rest }) {
  return html`<button className=${cx(btn, kind === "primary" ? btnPrimary : kind === "danger" ? btnDanger : btnGhost, small && btnSm, className)} ...${rest}>${children}</button>`;
}

export function IconButton({ n, label, className, ...rest }) {
  return html`<button className=${cx(iconBtn, className)} aria-label=${label} title=${label} ...${rest}><${Icon} n=${n} /></button>`;
}

export function Prose({ markup, caret, onCite, className }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (caret) placeCaret(el);
    else { el.querySelectorAll(".caret").forEach((c) => c.remove()); typeset(el); }
  }, [markup, caret]);
  const click = (e) => {
    const c = e.target.closest(".cite");
    if (c && onCite) onCite(+c.dataset.n);
  };
  return html`<div ref=${ref} className=${cx("prose", className)} onClick=${click} dangerouslySetInnerHTML=${{ __html: markup }} />`;
}

export function Ink({ label }) {
  return html`<div className="flex items-center gap-3 py-1.5 text-sm text-muted"><div className="ink"><i></i><i></i><i></i></div>${label ? html`<span>${label}</span>` : null}</div>`;
}

export function Modal({ title, wide, onClose, children, footer }) {
  const host = document.getElementById("modals");
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return ReactDOM.createPortal(html`
    <div className="fixed inset-0 z-[60] grid animate-fade place-items-center bg-[var(--scrim)] p-6 backdrop-blur-[10px]" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className=${cx("flex max-h-[min(86vh,760px)] w-full flex-col overflow-hidden rounded-[18px] border border-line2 bg-bg2 shadow-float animate-pop", wide ? "max-w-[820px]" : "max-w-[560px]")}>
        <div className="flex items-center gap-3 px-7 pb-1.5 pt-6">
          <h3 className="display min-w-0 flex-1 truncate text-[26px] font-medium tracking-[-.02em]">${title}</h3>
          <${IconButton} n="close" label="Close" onClick=${onClose} />
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-7 pb-6 pt-3.5">${children}</div>
        ${footer ? html`<div className="flex items-center justify-end gap-2.5 px-7 pb-6">${footer}</div>` : null}
      </div>
    </div>`, host);
}

export function Toasts() {
  const { state } = useApp();
  return ReactDOM.createPortal(html`
    <div className="pointer-events-none fixed bottom-7 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2.5" aria-live="polite">
      ${state.toasts.map((t) => html`
        <div key=${t.id} className=${cx("toast flex max-w-[min(520px,90vw)] items-center gap-3 rounded-2xl border bg-bg2 px-5 py-[13px] text-sm font-medium shadow-float", t.err ? "err border-bad" : "border-line2")}>
          <i className="size-[9px] shrink-0 rounded-full bg-good"></i><span>${t.msg}</span>
        </div>`)}
    </div>`, document.body);
}

export function Backdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const move = (e) => {
      const el = ref.current;
      if (!el) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el.children[0].style.translate = `${x * 24}px ${y * 18}px`;
      el.children[1].style.translate = `${x * -30}px ${y * -22}px`;
      el.children[2].style.translate = `${x * 14}px ${y * -12}px`;
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return html`
    <div ref=${ref} className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"><i className="glow g1"></i><i className="glow g2"></i><i className="glow g3"></i></div>
    <div className="grain" aria-hidden="true"></div>`;
}

export function useHotkey(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const k = (e) => ref.current(e);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
}

export function useOutside(ref, onOut, active) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [active]);
}
