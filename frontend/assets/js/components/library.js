import { html, cx, memo, useRef, useState } from "../lib.js";
import { Icon } from "../icons.js";
import { fmtSize } from "../lib.js";
import { useApp } from "../store.js";
import { Button, IconButton, fieldInput } from "../ui.js";

const KIND = {
  pdf: ["PDF", 8], docx: ["DOCX", 214], pptx: ["PPTX", 24], xlsx: ["XLSX", 146], csv: ["CSV", 164],
  image: ["IMG", 300], epub: ["EPUB", 262], html: ["HTML", 38], text: ["TXT", 200], code: ["CODE", 182],
};

const FileCard = memo(function FileCard({ d, index }) {
  const { A } = useApp();
  const [tag, hue] = KIND[d.kind] || ["FILE", 40];
  const busy = !["ready", "error"].includes(d.status);
  const spot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", e.clientX - r.left + "px");
    e.currentTarget.style.setProperty("--my", e.clientY - r.top + "px");
  };
  const status = d.status === "ready" ? ["ready", `Ready · ${d.chunk_count} passage${d.chunk_count === 1 ? "" : "s"}`, "bg-goodsoft text-good"]
    : d.status === "error" ? ["error", "Failed", "bg-badsoft text-bad"]
    : ["busy", `${d.stage || "Working"} · ${d.progress}%`, "bg-soft text-accent"];
  return html`
    <div onMouseMove=${spot} style=${{ animationDelay: Math.min(index, 8) * 40 + "ms" }} className="file group relative flex animate-rise gap-[15px] overflow-hidden rounded-2xl border border-line bg-surface p-4 transition duration-500 ease-out hover:-translate-y-px hover:border-line2 hover:bg-surface2">
      <div style=${{ "--k": hue }} className=${cx("badge relative grid h-16 w-14 flex-none place-items-end justify-center rounded-xl pb-[9px] font-mono text-[11px] font-semibold tracking-[.04em] text-white", busy && "busy")}>${tag}</div>
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-[14.5px] font-semibold" title=${d.name}>${d.name}</div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] text-muted"><span>${fmtSize(d.size)}</span>${d.source_url ? html`<span>web link</span>` : null}${d.parts ? html`<span>${d.parts} part${d.parts === 1 ? "" : "s"}</span>` : null}</div>
        <span className=${cx("status mt-1 inline-flex w-fit items-center gap-1.5 rounded-full py-[3px] pl-2 pr-2.5 text-xs font-semibold", status[0] === "busy" && "busy", status[2])}><i className="size-[7px] rounded-full bg-current"></i>${status[1]}</span>
        ${busy ? html`<div className="pbar mt-2 h-1 overflow-hidden rounded bg-line"><i style=${{ width: d.progress + "%" }}></i></div>` : null}
        ${d.error ? html`<div className="mt-0.5 break-words text-xs text-bad">${d.error}</div>` : null}
      </div>
      <div className="relative z-[1] flex flex-col gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
        ${d.status === "ready" ? html`<${IconButton} n="eye" label="Preview extracted text" onClick=${() => A.modal({ type: "preview", id: d.id })} />` : null}
        ${d.status === "error" ? html`<${IconButton} n="retry" label="Retry" onClick=${() => A.retryDoc(d.id)} />` : null}
        <${IconButton} n="trash" label="Remove file" className="hover:!bg-badsoft hover:!text-bad" onClick=${() => A.modal({ type: "confirm", title: "Remove this file?", text: `"${d.name}" will be removed from this subject.`, label: "Remove", run: () => A.removeDoc(d.id) })} />
      </div>
    </div>`;
});

export function Library() {
  const { state, A } = useApp();
  const input = useRef(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const accept = state.formats.flatMap((f) => f.ext).join(",");
  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim() || adding) return;
    setAdding(true);
    if (await A.addUrl(url.trim())) setUrl("");
    setAdding(false);
  };
  return html`
    <div className="flex-1 animate-rise overflow-y-auto px-[34px] pb-[60px] pt-[26px] max-[860px]:px-[18px]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-[26px]">
        <div role="button" tabIndex="0" onClick=${() => input.current.click()} onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current.click(); } }}
          className="dropzone relative cursor-pointer overflow-hidden rounded-[18px] bg-[radial-gradient(120%_140%_at_50%_0%,var(--accent-soft),transparent_60%),var(--surface)] px-7 py-[38px] text-center transition duration-500 ease-out hover:-translate-y-px">
          <svg className="dz-border pointer-events-none absolute inset-0 size-full"><rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" /></svg>
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-line2 bg-surface2 text-accent"><${Icon} n="upload" className="size-[30px]" /></div>
          <h3 className="display text-[26px] font-medium tracking-[-.02em]">Drop files here, or click to browse</h3>
          <p className="mt-1.5 text-sm text-muted">Select as many as you like. Scanned pages are read with vision automatically.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">${state.formats.map((f) => html`<span key=${f.id} title=${f.note} className="rounded-[9px] border border-line bg-surface2 px-[11px] py-[5px] text-xs font-semibold text-ink2">${f.label}</span>`)}</div>
          <input ref=${input} type="file" multiple hidden accept=${accept} onChange=${(e) => { A.uploadFiles(e.target.files); e.target.value = ""; }} />
        </div>
        <form onSubmit=${submit} className="flex gap-2.5 rounded-[18px] border border-line bg-surface p-1.5 transition-colors focus-within:border-accent">
          <${Icon} n="link" className="ml-3 mt-3 size-[18px] flex-none text-muted" />
          <input value=${url} onChange=${(e) => setUrl(e.target.value)} placeholder="Or paste a link to an article or PDF" autoComplete="off" disabled=${adding} className="min-w-0 flex-1 bg-transparent px-1.5 py-2.5 outline-none placeholder:text-faint" />
          <${Button} kind="ghost" small type="submit" disabled=${adding || !url.trim()}>${adding ? "Fetching" : "Add link"}<//>
        </form>
        <div className="flex items-baseline gap-3"><h2 className="display text-2xl font-medium tracking-[-.02em]">Files</h2><span className="text-[13px] text-muted">${state.docs.length} in this subject</span></div>
        ${state.docs.length
          ? html`<div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">${state.docs.map((d, i) => html`<${FileCard} key=${d.id} d=${d} index=${i} />`)}</div>`
          : html`<div className="py-[30px] text-center text-sm text-muted">Nothing here yet. Drop a file above to begin.</div>`}
      </div>
    </div>`;
}
