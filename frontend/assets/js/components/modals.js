import { html, useState, useEffect, useRef } from "../lib.js";
import { Icon } from "../icons.js";
import { api } from "../lib.js";
import { useApp } from "../store.js";
import { Button, Modal, fieldInput, labelCls, Ink } from "../ui.js";

function NewSubject({ onClose }) {
  const { A } = useApp();
  const [name, setName] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current.focus(); }, []);
  const submit = (e) => { e.preventDefault(); if (name.trim()) { onClose(); A.createSubject(name); } };
  return html`
    <${Modal} title="New subject" onClose=${onClose}>
      <form onSubmit=${submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5"><label className=${labelCls}>Name</label><input ref=${ref} value=${name} onChange=${(e) => setName(e.target.value)} maxLength="80" autoComplete="off" placeholder="e.g. Operating Systems" className=${fieldInput} /></div>
        <div className="flex justify-end gap-2.5"><${Button} kind="ghost" type="button" onClick=${onClose}>Cancel<//><${Button} type="submit" disabled=${!name.trim()}><${Icon} n="plus" /><span>Create subject</span><//></div>
      </form>
    <//>`;
}

function Confirm({ m, onClose }) {
  return html`
    <${Modal} title=${m.title} onClose=${onClose} footer=${html`<${Button} kind="ghost" onClick=${onClose}>Cancel<//><${Button} kind="danger" onClick=${() => { onClose(); m.run(); }}>${m.label}<//>`}>
      <p className="leading-relaxed text-ink2">${m.text}</p>
    <//>`;
}

function Settings({ onClose }) {
  const { state } = useApp();
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState("");
  const first = useRef(true);
  useEffect(() => { api("/settings").then(setData); }, []);
  useEffect(() => {
    if (!data) return;
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      await api("/settings", { method: "PUT", json: { ocr_batch: data.values.ocr_batch, ocr_scale: data.values.ocr_scale } });
      setSaved("Saved");
      setTimeout(() => setSaved(""), 1400);
    }, 350);
    return () => clearTimeout(t);
  }, [data && data.values.ocr_batch, data && data.values.ocr_scale]);
  const h = state.health || {};
  const set = (k, v) => setData({ ...data, values: { ...data.values, [k]: v } });
  const fill = (v, lo, hi) => ({ "--fill": ((v - lo) / (hi - lo)) * 100 + "%" });
  const body = !data ? html`<${Ink} />` : html`
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
      <div className="flex items-center justify-between gap-3.5"><b className="text-[15px]">Pages per OCR request</b><span className="display text-[30px] font-normal tracking-[-.02em] text-accent">${data.values.ocr_batch}</span></div>
      <input type="range" min=${data.limits.ocr_batch[0]} max=${data.limits.ocr_batch[1]} step="1" value=${data.values.ocr_batch} style=${fill(data.values.ocr_batch, ...data.limits.ocr_batch)} onChange=${(e) => set("ocr_batch", +e.target.value)} />
      <div className="flex justify-between px-1 font-mono text-[11px] text-faint">${Array.from({ length: data.limits.ocr_batch[1] }, (_, i) => html`<span key=${i}>${i + 1}</span>`)}</div>
      <p className="text-[13px] leading-[1.55] text-muted">Scanned pages are stitched into one tall image and read in a single request, so a 90 page scan costs about ${Math.ceil(90 / data.values.ocr_batch)} requests instead of 90. Higher saves more quota but may blur small print. Applies to files added from now on.</p>
    </div>
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
      <div className="flex items-center justify-between gap-3.5"><b className="text-[15px]">Scan sharpness</b><span className="display text-[30px] font-normal tracking-[-.02em] text-accent">${Number(data.values.ocr_scale).toFixed(1)}x</span></div>
      <input type="range" min=${data.limits.ocr_scale[0]} max=${data.limits.ocr_scale[1]} step="0.25" value=${data.values.ocr_scale} style=${fill(data.values.ocr_scale, ...data.limits.ocr_scale)} onChange=${(e) => set("ocr_scale", +e.target.value)} />
      <p className="text-[13px] leading-[1.55] text-muted">Render resolution for scanned pages. 2x is a good balance. Raise it for tiny text, lower it to go faster.</p>
    </div>
    <div className="grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
      ${[["Chat model", h.chat_model], ["Embeddings", h.embed_model], ["API keys in rotation", h.keys], ["Storage", "SQLite, local"]].map(([k, v]) => html`
        <div key=${k} className="rounded-2xl border border-line bg-surface px-4 py-3.5"><span className=${"block " + labelCls}>${k}</span><b className="break-all font-mono text-[13px] font-medium">${v ?? "-"}</b></div>`)}
    </div>`;
  return html`<${Modal} title="Settings" onClose=${onClose} footer=${html`<span className="mr-auto text-xs font-semibold text-good">${saved}</span><${Button} onClick=${onClose}>Done<//>`}>${body}<//>`;
}

function Preview({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api(`/documents/${id}/text`).then(setData); }, [id]);
  return html`
    <${Modal} wide title=${data ? data.doc.name : "Preview"} onClose=${onClose}>
      ${!data ? html`<${Ink} />` : data.chunks.length
        ? data.chunks.map((c, i) => html`<div key=${i} className="rounded-2xl border border-line bg-surface px-[18px] py-4"><span className="mb-2 inline-block rounded-[7px] bg-soft px-[9px] py-0.5 font-mono text-[11px] text-accent">${c.loc}</span><div dir="auto" className="whitespace-pre-wrap text-sm leading-[1.75] text-ink2">${c.text}</div></div>`)
        : html`<div className="py-[30px] text-center text-sm text-muted">No text extracted.</div>`}
    <//>`;
}

export function Modals() {
  const { state, A } = useApp();
  const m = state.modal;
  if (!m) return null;
  const close = () => A.modal(null);
  if (m.type === "newSubject") return html`<${NewSubject} onClose=${close} />`;
  if (m.type === "confirm") return html`<${Confirm} m=${m} onClose=${close} />`;
  if (m.type === "settings") return html`<${Settings} onClose=${close} />`;
  if (m.type === "preview") return html`<${Preview} id=${m.id} onClose=${close} />`;
  return null;
}
