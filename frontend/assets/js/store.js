import { React, html, createContext, useContext, useReducer, useRef, useMemo, useEffect, store, api } from "./lib.js";

const Ctx = createContext(null);

const initial = () => ({
  booted: false,
  subjects: [],
  currentId: null,
  docs: [],
  messages: [],
  tab: "ask",
  scope: [],
  formats: [],
  health: null,
  theme: store.get("dars-theme", "dark"),
  sources: [],
  sourcesOpen: false,
  focus: null,
  streaming: false,
  modal: null,
  toasts: [],
  railOpen: false,
  dragging: false,
  study: { kind: null, busy: false, result: null, doc: "", topic: "", count: 8 },
});

function reducer(state, action) {
  if (action.type === "set") return { ...state, ...(typeof action.p === "function" ? action.p(state) : action.p) };
  return state;
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const ref = useRef(state);
  ref.current = state;
  const run = useRef({ abort: null });

  const A = useMemo(() => {
    const set = (p) => dispatch({ type: "set", p });
    const get = () => ref.current;

    const toast = (msg, err = false) => {
      const id = Math.random().toString(36).slice(2);
      set((s) => ({ toasts: [...s.toasts, { id, msg, err }] }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), err ? 5200 : 2800);
    };

    const refreshSubjects = async () => { set({ subjects: await api("/collections") }); };

    const loadDocs = async () => {
      const id = get().currentId;
      if (!id) return;
      const docs = await api(`/collections/${id}/documents`);
      if (get().currentId === id) set({ docs });
    };

    const selectSubject = async (id, tab) => {
      if (run.current.abort) run.current.abort.abort();
      store.set("dars-subject", id || "");
      set((s) => ({ currentId: id, scope: [], sources: [], sourcesOpen: false, messages: [], docs: [], railOpen: false, streaming: false, study: { ...s.study, kind: null, result: null, busy: false }, modal: null }));
      if (!id) return;
      const [docs, messages] = await Promise.all([api(`/collections/${id}/documents`), api(`/collections/${id}/messages`)]);
      if (get().currentId !== id) return;
      set({ docs, messages, tab: tab || (docs.length ? "ask" : "library") });
    };

    const createSubject = async (name) => {
      try {
        const c = await api("/collections", { method: "POST", json: { name } });
        await refreshSubjects();
        await selectSubject(c.id, "library");
      } catch (e) { toast(e.message, true); }
    };

    const renameSubject = async (id, name) => {
      try { await api(`/collections/${id}`, { method: "PATCH", json: { name } }); await refreshSubjects(); } catch (e) { toast(e.message, true); }
    };

    const deleteSubject = async (id) => {
      await api(`/collections/${id}`, { method: "DELETE" });
      await refreshSubjects();
      if (get().currentId === id) await selectSubject(null);
    };

    const uploadFiles = async (files) => {
      const id = get().currentId;
      files = [...files];
      if (!id) { toast("Create a subject first", true); return; }
      if (!files.length) return;
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      toast(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}`);
      try {
        const r = await api(`/collections/${id}/upload`, { method: "POST", form });
        (r.errors || []).forEach((e) => toast(`${e.name}: ${e.error}`, true));
        set({ tab: "library" });
        await loadDocs();
        refreshSubjects();
      } catch (e) { toast(e.message, true); }
    };

    const addUrl = async (url) => {
      try {
        await api(`/collections/${get().currentId}/url`, { method: "POST", json: { url } });
        toast("Link added");
        await loadDocs();
        refreshSubjects();
        return true;
      } catch (e) { toast(e.message, true); return false; }
    };

    const removeDoc = async (id) => {
      await api(`/documents/${id}`, { method: "DELETE" });
      set((s) => ({ scope: s.scope.filter((x) => x !== id) }));
      await loadDocs();
      refreshSubjects();
    };

    const retryDoc = async (id) => { await api(`/documents/${id}/retry`, { method: "POST" }); loadDocs(); };

    const clearChat = async () => {
      await api(`/collections/${get().currentId}/messages`, { method: "DELETE" });
      set({ messages: [], sources: [], sourcesOpen: false });
    };

    const stop = () => { if (run.current.abort) run.current.abort.abort(); };

    const send = async (question) => {
      question = question.trim();
      const s0 = get();
      if (!question || s0.streaming || !s0.currentId) return;
      if (!s0.docs.some((d) => d.status === "ready")) { toast("Add a file first, then I can answer from it", true); return; }
      const cid = s0.currentId;
      set((s) => ({
        streaming: true,
        messages: [...s.messages, { role: "user", content: question }, { role: "assistant", content: "", sources: [], pending: true }],
      }));
      const patchLast = (p) => set((s) => {
        if (s.currentId !== cid) return {};
        const m = s.messages.slice();
        m[m.length - 1] = { ...m[m.length - 1], ...p };
        return { messages: m };
      });
      const ctl = new AbortController();
      run.current.abort = ctl;
      let text = "";
      let sources = [];
      let raf = 0;
      const flush = () => { raf = 0; patchLast({ content: text, pending: false, live: true }); };
      try {
        const res = await fetch(`/api/collections/${cid}/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
          body: JSON.stringify({ question, doc_ids: s0.scope.length ? s0.scope : null }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Request failed"); }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.t === "sources") { sources = ev.data; patchLast({ sources }); }
            else if (ev.t === "tok") { text += ev.d; if (!raf) raf = requestAnimationFrame(flush); }
            else if (ev.t === "error") throw new Error(ev.d);
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") { text += (text ? "\n\n" : "") + "Something went wrong: " + e.message; toast(e.message, true); }
      }
      if (raf) cancelAnimationFrame(raf);
      patchLast({ content: text || "(stopped)", pending: false, live: false, sources });
      run.current.abort = null;
      set({ streaming: false });
      refreshSubjects();
      if (sources.length && text && window.innerWidth > 1180 && get().currentId === cid) set({ sources, sourcesOpen: true, focus: null });
    };

    const openSources = (sources, n) => set({ sources, sourcesOpen: true, focus: { n, t: Date.now() } });

    const generateStudy = async () => {
      const s = get();
      if (s.study.busy || !s.study.kind) return;
      const st = s.study;
      set({ study: { ...st, busy: true, result: null } });
      try {
        const result = await api(`/collections/${s.currentId}/study`, {
          method: "POST",
          json: { kind: st.kind, doc_id: st.doc ? +st.doc : null, topic: st.topic.trim() || null, count: Math.max(3, Math.min(20, parseInt(st.count, 10) || 8)) },
        });
        set((x) => ({ study: { ...x.study, busy: false, result } }));
      } catch (e) {
        toast(e.message, true);
        set((x) => ({ study: { ...x.study, busy: false } }));
      }
    };

    const setStudy = (p) => set((s) => ({ study: { ...s.study, ...p } }));
    const modal = (m) => set({ modal: m });

    return {
      set, toast, refreshSubjects, loadDocs, selectSubject, createSubject, renameSubject, deleteSubject, uploadFiles,
      addUrl, removeDoc, retryDoc, clearChat, send, stop, openSources, generateStudy, setStudy, modal,
    };
  }, []);

  const busy = state.docs.some((d) => !["ready", "error"].includes(d.status));

  useEffect(() => {
    if (!busy || !state.currentId) return;
    const t = setTimeout(() => A.loadDocs().catch(() => {}), 1400);
    return () => clearTimeout(t);
  }, [busy, state.docs, state.currentId]);

  useEffect(() => { if (!busy && state.booted) A.refreshSubjects().catch(() => {}); }, [busy]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    store.set("dars-theme", state.theme);
  }, [state.theme]);

  useEffect(() => {
    (async () => {
      try {
        const [formats, health] = await Promise.all([api("/formats"), api("/health")]);
        A.set({ formats, health });
      } catch {}
      await A.refreshSubjects();
      const saved = +store.get("dars-subject", 0);
      if (saved && ref.current.subjects.some((x) => x.id === saved)) await A.selectSubject(saved);
      A.set({ booted: true });
    })();
  }, []);

  const value = useMemo(() => ({ state, A }), [state, A]);
  return html`<${Ctx.Provider} value=${value}>${children}<//>`;
}

export function useApp() { return useContext(Ctx); }

export function currentSubject(state) { return state.subjects.find((s) => s.id === state.currentId) || null; }
export function readyDocs(state) { return state.docs.filter((d) => d.status === "ready"); }
export function busyDocs(state) { return state.docs.filter((d) => !["ready", "error"].includes(d.status)); }
