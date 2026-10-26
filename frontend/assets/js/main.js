import { ReactDOM, html, cx, Component, useEffect, useRef } from "./lib.js";
import { Icon } from "./icons.js";
import { AppProvider, useApp, currentSubject } from "./store.js";
import { Backdrop, Toasts, Button } from "./ui.js";
import { Rail } from "./components/rail.js";
import { Home } from "./components/home.js";
import { Topbar } from "./components/stage.js";
import { Ask } from "./components/ask.js";
import { Library } from "./components/library.js";
import { Study } from "./components/study.js";
import { Sources } from "./components/sources.js";
import { Modals } from "./components/modals.js";

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return html`
      <div className="relative z-[5] grid h-full place-items-center p-8 text-center">
        <div><h2 className="display text-4xl">Something broke</h2><p className="mx-auto my-3 max-w-md text-muted">${String(this.state.err.message || this.state.err)}</p>
        <${Button} onClick=${() => location.reload()}>Reload<//></div>
      </div>`;
  }
}

function DropVeil() {
  const { state, A } = useApp();
  const depth = useRef(0);
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const subjectRef = useRef(null);
  subjectRef.current = state.currentId;
  useEffect(() => {
    const enter = (e) => { if (!hasFiles(e) || !subjectRef.current) return; depth.current++; A.set({ dragging: true }); };
    const leave = (e) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) A.set({ dragging: false }); };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      A.set({ dragging: false });
      if (subjectRef.current) A.uploadFiles(e.dataTransfer.files);
      else A.toast("Create a subject first, then drop your files", true);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave); window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
  }, []);
  return html`
    <div className=${cx("dropveil pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] opacity-0 backdrop-blur-[22px] transition-opacity duration-300", state.dragging && "on")}>
      <div className="dropveil-card scale-95 rounded-[24px] border-2 border-dashed border-accent bg-soft px-[70px] py-14 text-center transition-transform duration-500 ease-out max-[860px]:px-8">
        <div className="mx-auto mb-[18px] grid size-[84px] place-items-center rounded-[18px] border border-line2 bg-surface2 text-accent"><${Icon} n="upload" className="size-10" /></div>
        <h2 className="display text-[32px] font-medium tracking-[-.02em]">Drop to add to this subject</h2>
        <p className="mt-1.5 text-ink2">PDF, Word, PowerPoint, Excel, images, EPUB, web pages, text and code</p>
      </div>
    </div>`;
}

function Shell() {
  const { state, A } = useApp();
  const sub = currentSubject(state);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !state.modal) A.set({ sourcesOpen: false, railOpen: false }); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [state.modal]);
  const showSources = !!sub && state.sourcesOpen && state.tab !== "library";
  const Pane = state.tab === "library" ? Library : state.tab === "study" ? Study : Ask;
  return html`
    <${Backdrop} />
    <div className=${cx("app relative z-[2] h-full", showSources && "with-sources", state.railOpen && "rail-open")}>
      <${Rail} />
      <main style=${{ "--h": sub ? sub.hue : 28 }} className="relative flex h-full min-h-0 min-w-0 flex-col">
        ${!state.booted ? null : sub ? html`<${Topbar} /><${Pane} key=${state.currentId + state.tab} />` : html`<${Home} />`}
      </main>
      <${Sources} />
    </div>
    <div onClick=${() => A.set({ railOpen: false })} className="scrim pointer-events-none fixed inset-0 z-[45] hidden bg-[var(--scrim)] opacity-0 transition-opacity duration-500 max-[860px]:block"></div>
    <${DropVeil} /><${Modals} /><${Toasts} />`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${Boundary}><${AppProvider}><${Shell} /><//><//>`);
