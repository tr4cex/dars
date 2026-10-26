import { html, cx, memo, useState, useRef, useEffect, useLayoutEffect, useMemo, useDeferredValue } from "../lib.js";
import { Icon } from "../icons.js";
import { md } from "../markdown.js";
import { useApp, currentSubject, readyDocs, busyDocs } from "../store.js";
import { Button, Prose, Ink, IconButton, useOutside } from "../ui.js";

const SUGGEST = [
  "Summarize the key ideas in my files",
  "What are the most important definitions I should memorize?",
  "Explain the first topic as if I'm new to it",
  "What would an exam likely ask from this material?",
];

function UserMessage({ m }) {
  return html`<div className="flex animate-rise justify-end"><div dir="auto" className="max-w-[min(78%,620px)] whitespace-pre-wrap break-words rounded-[16px_16px_4px_16px] border border-line2 bg-gradient-to-br from-soft to-surface2 px-5 py-[13px] text-base leading-[1.55] backdrop-blur-[10px]">${m.content}</div></div>`;
}

function AssistantMessage({ m, onCite, onOpen, onCopy }) {
  const deferred = useDeferredValue(m.content);
  const markup = useMemo(() => md(m.live ? deferred : m.content), [m.live ? deferred : m.content, m.live]);
  const sources = (m.sources || []).slice(0, 6);
  return html`
    <div className="group/msg flex animate-rise gap-4 max-[860px]:gap-3">
      <div className="mt-0.5 grid size-[34px] flex-none place-items-center rounded-xl border border-line2 bg-surface2 max-[860px]:size-[30px]"><${Icon} n="logo" className="size-5 text-accent" /></div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.12em] text-faint">
          <span>Dars</span>
          ${m.pending ? null : html`<span className="ml-auto opacity-0 transition-opacity group-hover/msg:opacity-100"><${IconButton} n="copy" label="Copy answer" onClick=${() => onCopy(m.content)} /></span>`}
        </div>
        ${m.pending ? html`<${Ink} label="Reading your sources" />` : html`<${Prose} markup=${markup} caret=${!!m.live} onCite=${(n) => onCite(m, n)} />`}
        ${sources.length && !m.live && !m.pending ? html`
          <div className="mt-4 flex flex-wrap gap-2">
            ${sources.map((s) => html`
              <button key=${s.n} onClick=${() => onOpen(m, s.n)} className="inline-flex max-w-full items-center gap-2 rounded-[11px] border border-line bg-surface py-1.5 pl-2 pr-[11px] text-[12.5px] text-ink2 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-accent hover:bg-surface3">
                <span className="grid size-5 flex-none place-items-center rounded-md bg-soft font-mono text-[11px] text-accent">${s.n}</span>
                <span className="max-w-[190px] truncate">${s.doc}</span>
                <span className="font-mono text-[11px] text-faint">${s.loc}</span>
              </button>`)}
          </div>` : null}
      </div>
    </div>`;
}

const Message = memo(function Message({ m, onCite, onOpen, onCopy }) {
  return m.role === "user" ? html`<${UserMessage} m=${m} />` : html`<${AssistantMessage} m=${m} onCite=${onCite} onOpen=${onOpen} onCopy=${onCopy} />`;
});

function PickRow({ on, onClick, children }) {
  return html`
    <button onClick=${onClick} className=${cx("pick flex w-full items-center gap-3 rounded-xl px-2.5 py-[9px] text-left transition-colors hover:bg-surface2", on && "on")}>
      <span className="tick grid size-5 flex-none place-items-center rounded-[7px] border-[1.5px] border-line2 transition duration-300 ease-out"><${Icon} n="check" className="size-[13px] scale-0 text-onaccent transition duration-300 ease-out" /></span>
      <span className="min-w-0 flex-1 truncate text-sm">${children}</span>
    </button>`;
}

function Scope() {
  const { state, A } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false), open);
  const ready = readyDocs(state);
  const label = !state.scope.length ? "All files" : state.scope.length === 1 ? (state.docs.find((d) => d.id === state.scope[0]) || { name: "1 file" }).name : state.scope.length + " files";
  const toggle = (id) => A.set((s) => ({ scope: s.scope.includes(id) ? s.scope.filter((x) => x !== id) : [...s.scope, id] }));
  return html`
    <div ref=${ref} className="relative self-end">
      <button onClick=${() => setOpen(!open)} title="Limit answers to chosen files"
        className=${cx("mb-px inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] border px-[13px] py-[9px] text-[13px] font-semibold transition duration-300", state.scope.length ? "border-accent bg-soft text-accent" : "border-line bg-surface2 text-ink2 hover:border-accent hover:text-ink")}>
        <${Icon} n="scope" className="size-[15px] text-accent" /><span className="max-w-[160px] truncate max-[860px]:hidden">${label}</span>
      </button>
      ${open ? html`
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-10 max-h-[340px] w-[min(380px,86vw)] origin-bottom-left animate-pop overflow-y-auto rounded-2xl border border-line2 bg-bg2 p-2.5 shadow-float">
          <div className="px-2.5 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-faint">Answer from</div>
          <${PickRow} on=${!state.scope.length} onClick=${() => A.set({ scope: [] })}>All files<//>
          ${ready.length ? ready.map((d) => html`<${PickRow} key=${d.id} on=${state.scope.includes(d.id)} onClick=${() => toggle(d.id)}>${d.name}<//>`) : html`<div className="p-3 text-[13px] text-muted">No ready files yet.</div>`}
        </div>` : null}
    </div>`;
}

function Composer() {
  const { state, A } = useApp();
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 190) + "px";
  }, [q]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !state.modal) { e.preventDefault(); ref.current.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [state.modal]);
  const go = () => { if (q.trim() && !state.streaming) { A.send(q); setQ(""); } };
  return html`
    <div className="dock-fade pointer-events-none absolute inset-x-0 bottom-0 px-[34px] pb-6 pt-[70px] max-[860px]:px-3.5 max-[860px]:pb-4 max-[860px]:pt-[60px]">
      <div className="pointer-events-auto mx-auto max-w-[820px]">
        <div className="composer rounded-[18px] p-0.5">
          <div className="flex items-end gap-2 rounded-[18px] bg-bg2 py-2.5 pl-3 pr-2.5 shadow-float">
            <${Scope} />
            <textarea ref=${ref} rows="1" dir="auto" value=${q} onChange=${(e) => setQ(e.target.value)} placeholder="Ask about your material..."
              onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); } }}
              className="max-h-[190px] min-h-[26px] flex-1 resize-none bg-transparent px-1.5 py-2.5 text-base leading-normal outline-none placeholder:text-faint"></textarea>
            <button onClick=${() => (state.streaming ? A.stop() : go())} disabled=${!state.streaming && !q.trim()} aria-label=${state.streaming ? "Stop" : "Send"}
              className=${cx("grid size-11 flex-none place-items-center rounded-xl transition duration-300 ease-out hover:-translate-y-0.5 active:scale-90 disabled:pointer-events-none disabled:opacity-35", state.streaming ? "border border-line2 bg-surface3 text-ink" : "bg-btn text-btnink")}>
              <${Icon} n=${state.streaming ? "stop" : "send"} className="size-5" />
            </button>
          </div>
        </div>
        <div className="mt-2.5 text-center text-[11.5px] text-faint max-[860px]:hidden">
          <kbd className="rounded-[5px] border border-line2 px-1.5 font-mono text-[10.5px]">Enter</kbd> to send · <kbd className="rounded-[5px] border border-line2 px-1.5 font-mono text-[10.5px]">Shift</kbd>+<kbd className="rounded-[5px] border border-line2 px-1.5 font-mono text-[10.5px]">Enter</kbd> new line · <kbd className="rounded-[5px] border border-line2 px-1.5 font-mono text-[10.5px]">/</kbd> to focus
          ${state.messages.length && !state.streaming ? html` · <button className="underline" onClick=${() => A.modal({ type: "confirm", title: "Clear this chat?", text: "The conversation history for this subject will be removed. Your files stay.", label: "Clear", run: A.clearChat })}>Clear chat</button>` : null}
        </div>
      </div>
    </div>`;
}

export function Ask() {
  const { state, A } = useApp();
  const sub = currentSubject(state);
  const ready = readyDocs(state);
  const th = useRef(null);
  const stick = useRef(true);
  const last = state.messages[state.messages.length - 1];
  useLayoutEffect(() => {
    const el = th.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [state.messages.length, last && last.content, last && last.pending]);
  useLayoutEffect(() => { th.current.scrollTop = th.current.scrollHeight; stick.current = true; }, [state.currentId]);
  const onScroll = () => { const el = th.current; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160; };
  const onCite = (m, n) => A.openSources(m.sources, n);
  const onCopy = async (text) => { try { await navigator.clipboard.writeText(text); A.toast("Copied"); } catch { A.toast("Could not copy", true); } };
  const welcome = !state.messages.length ? (ready.length ? html`
    <div className="animate-rise pt-[8vh] text-center">
      <h2 className="display text-[clamp(30px,3.6vw,46px)] font-normal leading-[1.1] tracking-[-.03em]">Ask anything about <em className="font-normal italic text-accent">${sub.name}</em></h2>
      <p className="mx-auto mb-7 mt-3 max-w-[460px] text-muted">${ready.length} file${ready.length === 1 ? "" : "s"} indexed. Answers cite the exact page.</p>
      <div className="mx-auto flex max-w-[680px] flex-wrap justify-center gap-2.5">
        ${SUGGEST.map((s, i) => html`<button key=${s} style=${{ animationDelay: 120 + i * 70 + "ms" }} onClick=${() => A.send(s)} className="animate-rise rounded-xl border border-line bg-surface px-4 py-[11px] text-left text-sm text-ink2 transition duration-300 ease-out hover:-translate-y-px hover:border-accent hover:bg-surface3 hover:text-ink">${s}</button>`)}
      </div>
    </div>` : html`
    <div className="animate-rise pt-[8vh] text-center">
      <h2 className="display text-[clamp(30px,3.6vw,46px)] font-normal leading-[1.1] tracking-[-.03em]">Your library is <em className="font-normal italic text-accent">empty</em></h2>
      <p className="mx-auto mb-7 mt-3 max-w-[460px] text-muted">${busyDocs(state).length ? "Your files are being read. This takes a moment." : "Add a file and Dars will read it so you can start asking."}</p>
      <${Button} onClick=${() => A.set({ tab: "library" })}><${Icon} n="upload" /><span>Add files</span><//>
    </div>`) : null;
  return html`
    <div className="relative flex min-h-0 flex-1 animate-rise flex-col">
      <div ref=${th} onScroll=${onScroll} className="flex-1 overflow-y-auto scroll-smooth px-[34px] pb-[190px] pt-[26px] max-[860px]:px-[18px]">
        <div className="mx-auto flex max-w-[820px] flex-col gap-[30px]">
          ${welcome}
          ${state.messages.map((m, i) => html`<${Message} key=${i} m=${m} onCite=${onCite} onOpen=${onCite} onCopy=${onCopy} />`)}
        </div>
      </div>
      <${Composer} />
    </div>`;
}
