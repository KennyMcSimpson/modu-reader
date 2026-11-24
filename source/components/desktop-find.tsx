import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";

const MAX_MATCHES = 5000;

export function DesktopFind({
  documentId,
  content,
  mode,
  onClose,
}: {
  documentId: string;
  content: string;
  mode: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ active: 0, total: 0 });
  const input = useRef<HTMLInputElement>(null);
  const matches = useRef<Range[]>([]);
  const active = useRef(-1);

  const selectMatch = useCallback((index: number) => {
    const ranges = matches.current;
    if (!ranges.length) {
      active.current = -1;
      setResult({ active: 0, total: 0 });
      CSS.highlights.delete("inkglass-find-active");
      return;
    }
    const selected = (index + ranges.length) % ranges.length;
    active.current = selected;
    CSS.highlights.set("inkglass-find-active", new Highlight(ranges[selected]));
    setResult({ active: selected + 1, total: ranges.length });
    const area = document.querySelector<HTMLElement>(".document-scroll");
    const bounds = ranges[selected].getBoundingClientRect();
    if (area && bounds.height) {
      area.scrollTo({
        top: area.scrollTop + bounds.top - area.getBoundingClientRect().top - area.clientHeight / 2,
        behavior: "instant",
      });
    }
    const pre = ranges[selected].startContainer.parentElement?.closest("pre");
    if (pre) pre.scrollLeft += bounds.left - pre.getBoundingClientRect().left - 24;
  }, []);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const root = document.querySelector(mode === "source" ? ".source-panel pre[aria-label]" : ".reading-panel article");
    const rebuild = () => {
      CSS.highlights.delete("inkglass-find");
      CSS.highlights.delete("inkglass-find-active");
      matches.current = [];
      active.current = -1;
      if (!root || !query) {
        setResult({ active: 0, total: 0 });
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
          const parent = node.parentElement;
          if (!parent || parent.closest("script,style,button,[hidden],.katex-mathml,details:not([open])")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const segments: { node: Text; start: number; end: number }[] = [];
      let text = "";
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        segments.push({ node, start: text.length, end: text.length + node.data.length });
        text += node.data;
      }
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "giu");
      const ranges: Range[] = [];
      let first = 0, last = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index, end = start + match[0].length;
        while (first < segments.length && segments[first].end <= start) first++;
        last = Math.max(first, last);
        while (last < segments.length && segments[last].end < end) last++;
        if (!segments[first] || !segments[last]) continue;
        const range = document.createRange();
        range.setStart(segments[first].node, start - segments[first].start);
        range.setEnd(segments[last].node, end - segments[last].start);
        ranges.push(range);
        if (ranges.length >= MAX_MATCHES) break;
      }
      matches.current = ranges;
      CSS.highlights.set("inkglass-find", new Highlight(...ranges));
      selectMatch(0);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 160);
    };
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { childList: true, characterData: true, subtree: true });
    schedule();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      CSS.highlights.delete("inkglass-find");
      CSS.highlights.delete("inkglass-find-active");
    };
  }, [query, documentId, content, mode, selectMatch]);

  const next = (forward: boolean) => {
    if (query) selectMatch(active.current + (forward ? 1 : -1));
  };

  return (
    <div className="desktop-find" role="search" aria-label="Find in document">
      <Search size={15} aria-hidden="true" />
      <input
        ref={input}
        value={query}
        maxLength={1000}
        aria-label="Find text"
        placeholder="Find text…"
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            next(!event.shiftKey);
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <span className="find-count" aria-live="polite">
        {query ? `${result.active} / ${result.total}${result.total >= MAX_MATCHES ? "+" : ""}` : ""}
      </span>
      <button className="icon-button" aria-label="Previous match" disabled={!result.total} onClick={() => next(false)}>
        <ArrowUp size={16} />
      </button>
      <button className="icon-button" aria-label="Next match" disabled={!result.total} onClick={() => next(true)}>
        <ArrowDown size={16} />
      </button>
      <button className="icon-button" aria-label="Close find" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
