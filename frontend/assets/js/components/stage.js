import { html, cx, useRef, useState, useLayoutEffect, useEffect } from "../lib.js";
import { Icon } from "../icons.js";
import { useApp, currentSubject } from "../store.js";
import { iconBtn } from "../ui.js";

const TABS = [["ask", "Ask", "ask"], ["library", "Library", "lib"], ["study", "Study", "study"]];

function EditableTitle({ subject }) {
  const { A } = useApp();
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    el.focus();
    document.getSelection().selectAllChildren(el);
  }, [editing]);
  const finish = () => {
    const el = ref.current;
    const name = el.textContent.trim();
    setEditing(false);
    if (name && name !== subject.name) A.renameSubject(subject.id, name);
    else el.textContent = subject.name;
  };
  return html`<h1 ref=${ref} contentEditable=${editing} suppressContentEditableWarning=${true} title="Double-click to rename"
    onDoubleClick=${() => setEditing(true)} onBlur=${() => editing && finish()}
    onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
    className=${cx("title display mt-1 cursor-text truncate text-[clamp(28px,3.2vw,42px)] font-medium leading-[1.1] tracking-[-.025em]")}>${subject.name}</h1>`;
}

export function Topbar() {
  const { state, A } = useApp();
  const sub = currentSubject(state);
  const wrap = useRef(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const place = () => {
      const a = wrap.current && wrap.current.querySelector("[data-active='true']");
      if (a) setPill({ left: a.offsetLeft, width: a.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [state.tab, state.docs.length, state.currentId]);
  return html`
    <div style=${{ "--h": sub.hue }} className="flex flex-none items-center gap-[18px] px-[34px] pt-5 max-[860px]:flex-wrap max-[860px]:gap-3 max-[860px]:px-[18px] max-[860px]:pt-4">
      <button className=${cx(iconBtn, "hidden max-[860px]:grid")} onClick=${() => A.set({ railOpen: true })} aria-label="Menu"><${Icon} n="menu" /></button>
      <div className="min-w-0 flex-1">
        <div className="eyebrow-line flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em]" style=${{ color: "hsl(var(--h) 80% 66%)" }}>Subject</div>
        <${EditableTitle} key=${sub.id} subject=${sub} />
      </div>
      <div ref=${wrap} className="relative flex gap-1 rounded-2xl border border-line bg-surface p-[5px] backdrop-blur-[14px] max-[860px]:order-3 max-[860px]:w-full">
        <span className="tab-pill absolute bottom-[5px] top-[5px] z-0 rounded-[10px] border border-line2 bg-surface3" style=${{ left: pill.left, width: pill.width }}></span>
        ${TABS.map(([id, label, ic]) => html`
          <button key=${id} data-active=${state.tab === id} onClick=${() => A.set({ tab: id, sourcesOpen: false })}
            className=${cx("relative z-[1] flex items-center gap-2 rounded-xl px-[18px] py-[9px] text-sm font-semibold transition-colors duration-300 max-[860px]:flex-1 max-[860px]:justify-center max-[860px]:px-2", state.tab === id ? "text-ink" : "text-muted hover:text-ink")}>
            <${Icon} n=${ic} className="size-4" /><span>${label}${id === "library" && state.docs.length ? ` · ${state.docs.length}` : ""}</span>
          </button>`)}
      </div>
    </div>`;
}
