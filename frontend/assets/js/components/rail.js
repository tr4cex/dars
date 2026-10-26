import { html, cx, memo } from "../lib.js";
import { Icon } from "../icons.js";
import { useApp } from "../store.js";
import { iconBtn } from "../ui.js";

const Subject = memo(function Subject({ s, active, index, onSelect, onDelete }) {
  return html`
    <div role="button" tabindex="0" onClick=${() => onSelect(s.id)} onKeyDown=${(e) => { if (e.key === "Enter") onSelect(s.id); }} style=${{ "--h": s.hue, animationDelay: index * 40 + "ms" }}
      className=${cx("subject group relative flex w-full animate-rise items-center gap-3 rounded-xl px-3 py-[11px] text-left outline-none transition duration-300 ease-out hover:bg-surface2 focus-visible:bg-surface2", active && "active bg-surface2")}>
      <span className="dot size-2.5 shrink-0 rounded-full"></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">${s.name}</span>
        <span className="text-xs text-muted">${s.ready}/${s.docs} file${s.docs === 1 ? "" : "s"} ready</span>
      </span>
      <button className="del grid size-[26px] place-items-center rounded-lg text-muted opacity-0 transition hover:bg-badsoft hover:text-bad [&>svg]:size-[15px]" aria-label="Delete subject" title="Delete subject" onClick=${(e) => { e.stopPropagation(); onDelete(s); }}><${Icon} n="trash" /></button>
    </div>`;
});

export function Rail() {
  const { state, A } = useApp();
  const dark = state.theme !== "light";
  const askDelete = (s) => A.modal({ type: "confirm", title: "Delete this subject?", text: `"${s.name}" and all of its files and chat history will be permanently removed.`, label: "Delete", run: () => A.deleteSubject(s.id) });
  return html`
    <aside className="rail flex min-h-0 flex-col gap-1.5 border-r border-line bg-gradient-to-b from-glass to-transparent px-4 pb-4 pt-[22px] backdrop-blur-[28px] backdrop-saturate-150">
      <button className="flex items-center gap-3 px-2 pb-[18px] pt-1 text-left" onClick=${() => A.selectSubject(null)} aria-label="Home">
        <div className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-line2 bg-surface2"><${Icon} n="logo" className="size-[24px] text-accent" /></div>
        <div className="leading-none">
          <b className="display text-[26px] font-semibold tracking-[-.02em]">Dars</b>
        </div>
      </button>
      <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-[.16em] text-faint">
        <span>Subjects</span>
        <button className=${iconBtn} onClick=${() => A.modal({ type: "newSubject" })} aria-label="New subject" title="New subject"><${Icon} n="plus" /></button>
      </div>
      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1.5">
        ${state.subjects.length
          ? state.subjects.map((s, i) => html`<${Subject} key=${s.id} s=${s} index=${i} active=${s.id === state.currentId} onSelect=${A.selectSubject} onDelete=${askDelete} />`)
          : html`<div className="mx-1.5 my-1.5 rounded-2xl border border-dashed border-line2 px-4 py-[18px] text-[13.5px] leading-relaxed text-muted">Every course you study gets its own subject. Create one, drop your slides and notes in, then ask away.</div>`}
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-line px-1.5 pt-3">
        <button className=${iconBtn} onClick=${() => A.set({ theme: dark ? "light" : "dark" })} aria-label="Toggle theme" title="Toggle theme"><${Icon} n=${dark ? "sun" : "moon"} /></button>
        <button className=${iconBtn} onClick=${() => A.modal({ type: "settings" })} aria-label="Settings" title="Settings"><${Icon} n="gear" /></button>
        <span className="flex-1 pl-1.5 text-xs text-faint">Local, private, yours</span>
      </div>
    </aside>`;
}
