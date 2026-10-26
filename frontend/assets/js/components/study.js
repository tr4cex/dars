import { html, cx, useState, useEffect, useMemo } from "../lib.js";
import { Icon } from "../icons.js";
import { md } from "../markdown.js";
import { useApp, readyDocs } from "../store.js";
import { Button, Prose, Ink, fieldInput, labelCls } from "../ui.js";

const TOOLS = [
  ["summary", "summary", "Summary", "A clean study sheet with the key ideas, definitions and formulas."],
  ["quiz", "quiz", "Quiz", "Multiple-choice questions with instant feedback and explanations."],
  ["flashcards", "cards", "Flashcards", "Flip cards for the concepts you need to remember."],
];

function Quiz({ items }) {
  const { A } = useApp();
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const letters = "ABCD";
  const done = i >= items.length;
  if (done) {
    const pct = Math.round((score / items.length) * 100);
    return html`
      <div className="animate-rise rounded-[18px] border border-line bg-surface px-[30px] py-[46px] text-center">
        <div className="display text-accent text-[clamp(64px,9vw,108px)] font-normal leading-none tracking-[-.05em]">${score}/${items.length}</div>
        <p className="mb-[26px] mt-2.5 text-base text-muted">${pct >= 80 ? "Excellent. You know this material." : pct >= 50 ? "Solid start. Review the misses and go again." : "Keep going. Re-read the summary and retry."}</p>
        <${Button} onClick=${() => { setI(0); setScore(0); setPicked(null); }}><${Icon} n="retry" /><span>Try again</span><//>
      </div>`;
  }
  const q = items[i];
  const choose = (k) => { if (picked !== null) return; setPicked(k); if (k === q.answer) setScore(score + 1); };
  return html`
    <div key=${i} className="animate-rise rounded-[18px] border border-line bg-surface px-[30px] py-7 max-[860px]:px-5 max-[860px]:py-[22px]">
      <div className="mb-[18px] flex items-center justify-between font-mono text-xs tracking-[.06em] text-muted"><span>QUESTION ${i + 1} OF ${items.length}</span><span>SCORE ${score}</span></div>
      <div className="mb-[22px] h-1 overflow-hidden rounded bg-line"><i className="block h-full rounded bg-accent transition-[width] duration-700 ease-out" style=${{ width: (i / items.length) * 100 + "%" }}></i></div>
      <div dir="auto" className="display mb-6 text-[clamp(21px,2.3vw,27px)] font-normal leading-[1.35] tracking-[-.015em]">${q.q}</div>
      <div className="flex flex-col gap-2.5">
        ${q.options.map((o, k) => {
          const state = picked === null ? "" : k === q.answer ? "right" : k === picked ? "wrong" : "dim";
          return html`
            <button key=${k} dir="auto" onClick=${() => choose(k)} className=${cx("opt flex items-center gap-3.5 rounded-2xl border-[1.5px] border-line bg-[var(--field)] px-[18px] py-[15px] text-left text-[15.5px] transition duration-300 ease-out", picked === null ? "hover:translate-x-1 hover:border-accent" : "locked", state)}>
              <span className="lt grid size-[30px] flex-none place-items-center rounded-[10px] bg-surface3 font-mono text-[13px] font-semibold transition-colors">${letters[k] || k + 1}</span><span>${o}</span>
            </button>`;
        })}
      </div>
      ${picked !== null ? html`
        <div className="animate-rise">
          ${q.explanation ? html`<div dir="auto" className="mt-[18px] rounded-2xl border border-line bg-soft px-[18px] py-4 text-[14.5px] leading-[1.65]"><b className="text-accent">${picked === q.answer ? "Correct. " : "Not quite. "}</b>${q.explanation}</div>` : null}
          <div className="mt-5 flex justify-end"><${Button} onClick=${() => { setI(i + 1); setPicked(null); }}><span>${i + 1 === items.length ? "See score" : "Next question"}</span><${Icon} n="right" /><//></div>
        </div>` : null}
    </div>`;
}

function Deck({ items }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const go = (d) => { setFlip(false); setI((i + d + items.length) % items.length); };
  useEffect(() => {
    const k = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") { e.preventDefault(); setFlip((f) => !f); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const c = items[i];
  const face = "face absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[18px] border border-line2 px-[38px] py-[34px] text-center shadow-float";
  return html`
    <div className="flex animate-rise flex-col items-center gap-6 py-1.5">
      <div className="card-stage relative aspect-[1.45] w-[min(560px,100%)] [perspective:1600px]">
        <div onClick=${() => setFlip(!flip)} className=${cx("flip absolute inset-0 z-[2] cursor-pointer", flip && "on")}>
          <div className=${cx(face, "front")}><span className="absolute left-6 top-5 text-[11px] font-semibold uppercase tracking-[.18em] text-faint">Front</span><div dir="auto" className="display max-h-full overflow-auto text-[clamp(20px,2.4vw,29px)] font-normal leading-[1.4] tracking-[-.01em] [overflow-wrap:anywhere]">${c.front}</div><span className="absolute bottom-[18px] text-xs text-faint">Tap to flip</span></div>
          <div className=${cx(face, "back")}><span className="absolute left-6 top-5 text-[11px] font-semibold uppercase tracking-[.18em] text-faint">Back</span><div dir="auto" className="display max-h-full overflow-auto text-[clamp(20px,2.4vw,29px)] font-normal leading-[1.4] tracking-[-.01em] [overflow-wrap:anywhere]">${c.back}</div><span className="absolute bottom-[18px] text-xs text-faint">Tap to flip back</span></div>
        </div>
      </div>
      <div className="mt-[18px] flex items-center gap-[18px]">
        <button onClick=${() => go(-1)} aria-label="Previous" className="grid size-[50px] place-items-center rounded-full border border-line2 bg-surface2 transition duration-300 ease-out hover:scale-110 hover:border-accent hover:bg-accent hover:text-onaccent"><${Icon} n="left" className="size-5" /></button>
        <span className="min-w-16 text-center font-mono text-[13px] text-muted">${i + 1} / ${items.length}</span>
        <button onClick=${() => go(1)} aria-label="Next" className="grid size-[50px] place-items-center rounded-full border border-line2 bg-surface2 transition duration-300 ease-out hover:scale-110 hover:border-accent hover:bg-accent hover:text-onaccent"><${Icon} n="right" className="size-5" /></button>
      </div>
    </div>`;
}

function Result({ result }) {
  const { A } = useApp();
  const markup = useMemo(() => (result.kind === "summary" ? md(result.markdown) : ""), [result]);
  if (result.kind === "summary") return html`<div className="animate-rise rounded-[18px] border border-line bg-surface px-[34px] py-[30px] shadow-float max-[860px]:px-5"><${Prose} markup=${markup} onCite=${(n) => A.openSources(result.sources, n)} /></div>`;
  if (!result.items.length) return html`<div className="py-[30px] text-center text-sm text-muted">The model returned nothing usable. Try again.</div>`;
  return result.kind === "quiz" ? html`<${Quiz} key=${result.items.length + result.items[0].q} items=${result.items} />` : html`<${Deck} key=${result.items.length + result.items[0].front} items=${result.items} />`;
}

export function Study() {
  const { state, A } = useApp();
  const st = state.study;
  const ready = readyDocs(state);
  return html`
    <div className="flex-1 animate-rise overflow-y-auto px-[34px] pb-[60px] pt-[26px] max-[860px]:px-[18px]">
      <div className="mx-auto flex max-w-[940px] flex-col gap-[26px]">
        <div className="grid grid-cols-3 gap-3.5 max-[860px]:grid-cols-1">
          ${TOOLS.map(([id, ic, title, desc]) => html`
            <button key=${id} onClick=${() => A.setStudy({ kind: id, result: null })} className=${cx("tool relative flex flex-col gap-1.5 overflow-hidden rounded-[18px] border border-line bg-surface p-[22px] text-left transition duration-500 ease-out hover:-translate-y-0.5 hover:border-line2", st.kind === id && "on")}>
              <div className="mb-3.5 grid size-[46px] place-items-center rounded-xl border border-line2 bg-surface2 text-accent"><${Icon} n=${ic} className="size-[23px]" /></div>
              <b className="display text-[21px] font-normal tracking-[-.02em]">${title}</b>
              <span className="text-[13.5px] leading-normal text-muted">${desc}</span>
            </button>`)}
        </div>
        ${st.kind ? html`
          <div className="flex animate-rise flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-[18px]">
            <div className="flex min-w-[160px] flex-1 flex-col gap-1.5"><label className=${labelCls}>Material</label>
              <select value=${st.doc} onChange=${(e) => A.setStudy({ doc: e.target.value })} className=${fieldInput}>
                <option value="">Everything in this subject</option>
                ${ready.map((d) => html`<option key=${d.id} value=${d.id}>${d.name}</option>`)}
              </select></div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1.5"><label className=${labelCls}>Focus (optional)</label><input value=${st.topic} onChange=${(e) => A.setStudy({ topic: e.target.value })} placeholder="e.g. rules of inference" className=${fieldInput} /></div>
            ${st.kind !== "summary" ? html`<div className="flex w-[100px] flex-col gap-1.5"><label className=${labelCls}>Count</label><input value=${st.count} inputMode="numeric" onChange=${(e) => A.setStudy({ count: e.target.value.replace(/\D/g, "").slice(0, 2) })} className=${fieldInput} /></div>` : null}
            <${Button} onClick=${A.generateStudy} disabled=${!ready.length || st.busy}><${Icon} n="bolt" /><span>${st.busy ? "Working" : "Generate"}</span><//>
          </div>` : null}
        ${st.busy ? html`<div className="flex animate-fade flex-col items-center gap-[18px] px-5 py-[60px] text-muted"><${Ink} /><span>Reading your material and writing it up...</span></div>`
          : st.result && st.result.kind === st.kind ? html`<${Result} result=${st.result} />`
          : !ready.length ? html`<div className="py-[30px] text-center text-sm text-muted">Add and index a file in the Library first.</div>` : null}
      </div>
    </div>`;
}
