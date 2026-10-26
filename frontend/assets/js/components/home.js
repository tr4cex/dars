import { html, useState } from "../lib.js";
import { Icon } from "../icons.js";
import { useApp } from "../store.js";
import { Button } from "../ui.js";

const FEATURES = [
  ["layers", "Reads everything", "PDF, Word, slides, sheets, EPUB, web pages, code and even photos of handwritten pages."],
  ["quote", "Cites its sources", "Every claim links back to the file and page it was taken from, so you can trust it."],
  ["bolt", "Turns notes into practice", "Instant summaries, multiple-choice quizzes and flip cards from your own material."],
];

export function Home() {
  const { A } = useApp();
  const [name, setName] = useState("");
  const submit = (e) => { e.preventDefault(); if (name.trim()) { A.createSubject(name); setName(""); } };
  return html`
    <div className="grid flex-1 animate-rise place-items-center overflow-y-auto p-10 max-[860px]:p-5">
      <div className="w-full max-w-[720px] text-center">
        <div className="mx-auto mb-7 flex items-center justify-center gap-4 text-accent"><span className="h-px w-14 bg-line2"></span><span className="text-[11px] font-semibold uppercase tracking-[.3em]">Study assistant</span><span className="h-px w-14 bg-line2"></span></div>
        <h1 className="display text-[clamp(36px,4.6vw,58px)] font-normal leading-[1.08] tracking-[-.025em]">What are we <em className="text-accent font-normal italic">studying</em> today?</h1>
        <p className="mx-auto mb-[30px] mt-[18px] max-w-[520px] text-[17px] leading-[1.6] text-ink2">Drop in your slides, scans and notes. Ask in any language and get answers with the exact page they came from.</p>
        <form onSubmit=${submit} className="mx-auto flex max-w-[520px] gap-2.5 rounded-2xl border border-line2 bg-surface2 p-2 shadow-float backdrop-blur-[20px]">
          <input value=${name} onChange=${(e) => setName(e.target.value)} placeholder="Name a subject, e.g. Discrete Structures" maxLength="80" autoComplete="off" className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-base outline-none placeholder:text-faint" />
          <${Button} type="submit"><${Icon} n="plus" /><span>Create</span><//>
        </form>
        <div className="mt-[46px] grid grid-cols-3 gap-3.5 text-left max-[860px]:grid-cols-1">
          ${FEATURES.map(([ic, t, d], i) => html`
            <div key=${t} style=${{ animationDelay: 150 + i * 100 + "ms" }} className="animate-rise rounded-2xl border border-line bg-surface p-[18px] transition duration-500 ease-out hover:-translate-y-0.5 hover:border-line2 hover:bg-surface2">
              <div className="mb-3.5 grid size-[38px] place-items-center rounded-xl bg-soft text-accent"><${Icon} n=${ic} className="size-5" /></div>
              <b className="display mb-1 block text-lg font-medium">${t}</b>
              <span className="text-[13.5px] leading-normal text-muted">${d}</span>
            </div>`)}
        </div>
      </div>
    </div>`;
}
