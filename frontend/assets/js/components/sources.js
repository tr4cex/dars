import { html, cx, useEffect, useRef, useState, memo } from "../lib.js";
import { Icon } from "../icons.js";
import { useApp } from "../store.js";
import { IconButton } from "../ui.js";

const Passage = memo(function Passage({ s, index, flash }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!flash) return;
    setOpen(true);
    const t = setTimeout(() => ref.current && ref.current.scrollIntoView({ behavior: "smooth", block: "center" }), 140);
    return () => clearTimeout(t);
  }, [flash]);
  return html`
    <div ref=${ref} style=${{ animationDelay: index * 50 + "ms" }} className=${cx("passage relative animate-rise rounded-[18px] border border-line bg-surface py-3.5 pl-[18px] pr-4 transition duration-500 ease-out hover:border-line2 hover:bg-surface2", open && "open", flash && "flash")}>
      <div className="mb-[9px] flex items-center gap-[9px]">
        <span className="grid size-[22px] min-w-[22px] flex-none place-items-center rounded-[7px] bg-accent font-mono text-[11.5px] font-semibold text-onaccent">${s.n}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title=${s.doc}>${s.doc}</span>
        <span className="rounded-[7px] border border-line px-2 py-0.5 font-mono text-[11px] text-muted">${s.loc}</span>
      </div>
      <div dir="auto" className="passage-text text-[13.5px] leading-[1.7] text-ink2">${s.text}</div>
      ${s.text.length > 320 ? html`<button className="mt-2 text-xs font-semibold text-accent" onClick=${() => setOpen(!open)}>${open ? "Show less" : "Show more"}</button>` : null}
    </div>`;
});

export function Sources() {
  const { state, A } = useApp();
  const [flashN, setFlashN] = useState(null);
  useEffect(() => {
    if (!state.focus) return;
    setFlashN(state.focus.n);
    const t = setTimeout(() => setFlashN(null), 1900);
    return () => clearTimeout(t);
  }, [state.focus]);
  return html`
    <aside className="sources relative min-w-0 overflow-hidden border-l border-line bg-gradient-to-b from-glass to-transparent backdrop-blur-[28px] backdrop-saturate-150" aria-label="Sources">
      <div className="sources-inner flex h-full flex-col">
        <div className="flex items-center gap-2.5 px-[22px] pb-3.5 pt-6">
          <h3 className="display flex-1 text-[22px] font-medium tracking-[-.02em]">Sources</h3>
          <span className="rounded-lg bg-soft px-[9px] py-[3px] font-mono text-xs text-accent">${state.sources.length}</span>
          <${IconButton} n="close" label="Close sources" onClick=${() => A.set({ sourcesOpen: false })} />
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] pb-[30px] pt-1">
          ${state.sources.length ? state.sources.map((s, i) => html`<${Passage} key=${state.sources[0].doc_id + "-" + s.n + "-" + s.loc} s=${s} index=${i} flash=${flashN === s.n} />`) : html`<div className="px-7 py-10 text-center text-sm text-muted">Sources for an answer appear here.</div>`}
        </div>
      </div>
    </aside>`;
}
