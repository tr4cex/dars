import { esc } from "./lib.js";

export function md(src) {
  const stash = [];
  const keep = (h) => { stash.push(h); return "\u0000" + (stash.length - 1) + "\u0000"; };
  let t = String(src).replace(/\r/g, "");
  t = t.replace(/```[\w-]*\n([\s\S]*?)```/g, (_, c) => keep(`<pre><code>${esc(c.replace(/\n$/, ""))}</code></pre>`));
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (m) => keep(esc(m)));
  t = t.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (m) => keep(esc(m)));
  t = t.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));

  const inline = (s) => {
    s = esc(s);
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\[(\d{1,2})\]/g, '<button class="cite" data-n="$1">$1</button>');
    return s;
  };

  const lines = t.split("\n");
  const out = [];
  let i = 0;
  const listRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { const l = m[1].length; out.push(`<h${l} dir="auto">${inline(m[2])}</h${l}>`); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote dir="auto">${inline(buf.join("<br>"))}</blockquote>`);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="tbl"><table dir="auto"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (listRe.test(line)) {
      const items = [];
      while (i < lines.length && (listRe.test(lines[i]) || (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length))) {
        const lm = lines[i].match(listRe);
        if (lm) items.push({ indent: lm[1].replace(/\t/g, "  ").length, ordered: /\d/.test(lm[2]), text: lm[3] });
        else items[items.length - 1].text += " " + lines[i].trim();
        i++;
      }
      const build = (idx) => {
        const base = items[idx].indent;
        const tag = items[idx].ordered ? "ol" : "ul";
        let h = `<${tag}>`;
        while (idx < items.length && items[idx].indent >= base) {
          if (items[idx].indent > base) {
            const r = build(idx);
            h = h.replace(/<\/li>$/, r.html + "</li>");
            idx = r.next;
            continue;
          }
          h += `<li dir="auto">${inline(items[idx].text)}</li>`;
          idx++;
        }
        return { html: h + `</${tag}>`, next: idx };
      };
      let idx = 0;
      while (idx < items.length) { const r = build(idx); out.push(r.html); idx = r.next; }
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) && !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
    if (buf.length) out.push(`<p dir="auto">${inline(buf.join("\n")).replace(/\n/g, "<br>")}</p>`);
    else i++;
  }
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
}

export function typeset(el) {
  if (!el || typeof window.renderMathInElement !== "function") return;
  try {
    window.renderMathInElement(el, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false, ignoredTags: ["script", "style", "pre", "code"],
    });
  } catch {}
}

export function placeCaret(root) {
  root.querySelectorAll(".caret").forEach((c) => c.remove());
  let t = root;
  while (t.lastElementChild && !["PRE", "TABLE", "BUTTON"].includes(t.lastElementChild.tagName)) t = t.lastElementChild;
  const c = document.createElement("span");
  c.className = "caret";
  t.appendChild(c);
}
