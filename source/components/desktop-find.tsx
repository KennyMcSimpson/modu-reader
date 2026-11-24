import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";

const MAX_MATCHES = 5000;
const BLOCK_SELECTOR = "p,div,li,td,th,tr,h1,h2,h3,h4,h5,h6,pre,blockquote,dt,dd";

export function DesktopFind({
  documentId,
  content,
  mode,
  seed,
  onClose,
}: {
  documentId: string;
  content: string;
  mode: string;
  seed?: { text: string; seq: number };
  onClose: () => void;
}) {
  const [query, setQuery] = useState(() => seed?.text || "");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [result, setResult] = useState({ active: 0, total: 0 });
  const input = useRef<HTMLInputElement>(null);
  const matches = useRef<Range[]>([]);
  const matchOffsets = useRef<number[]>([]);
  const active = useRef(-1);
  const lastActiveOffset = useRef(-1);
  const lastSearchKey = useRef("");
  const lastSeedSeq = useRef(seed?.seq ?? 0);

  const selectMatch = useCallback((index: number, shouldScroll = true) => {
    const ranges = matches.current;
    if (!ranges.length) {
      active.current = -1;
      lastActiveOffset.current = -1;
      setResult({ active: 0, total: 0 });
      CSS.highlights.delete("inkglass-find-active");
      return;
    }
    const selected = (index + ranges.length) % ranges.length;
    active.current = selected;
    lastActiveOffset.current = matchOffsets.current[selected] ?? -1;
    CSS.highlights.set("inkglass-find-active", new Highlight(ranges[selected]));
    setResult({ active: selected + 1, total: ranges.length });
    if (!shouldScroll) return;
    const area = document.querySelector<HTMLElement>(".document-scroll");
    const bounds = ranges[selected].getBoundingClientRect();
    if (area && bounds.height) {
      area.scrollTo({
        top: area.scrollTop + bounds.top - area.getBoundingClientRect().top - area.clientHeight / 2,
        behavior: "instant",
      });
    }
    const scrollParent = ranges[selected].startContainer.parentElement?.closest<HTMLElement>('pre, [data-slot="table-container"]');
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      if (bounds.left < parentRect.left || bounds.right > parentRect.right) {
        scrollParent.scrollLeft += bounds.left - parentRect.left - 24;
      }
    }
  }, []);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Re-seed query when Ctrl+F is triggered again with a new selection while Find is already open.
  useEffect(() => {
    if (!seed || seed.seq === lastSeedSeq.current) return;
    lastSeedSeq.current = seed.seq;
    if (seed.text) setQuery(seed.text);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, [seed]);

  const next = useCallback(
    (forward: boolean) => {
      if (query) selectMatch(active.current + (forward ? 1 : -1), true);
    },
    [query, selectMatch],
  );

  // Support F3 / Shift+F3 globally while Find is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F3") {
        event.preventDefault();
        next(!event.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const root = document.querySelector(mode === "source" ? ".source-panel pre[aria-label]" : ".reading-panel article");
    const searchKey = `${documentId}\u0001${mode}\u0001${caseSensitive ? 1 : 0}\u0001${wholeWord ? 1 : 0}\u0001${query}`;

    const rebuild = () => {
      CSS.highlights.delete("inkglass-find");
      CSS.highlights.delete("inkglass-find-active");
      matches.current = [];
      matchOffsets.current = [];
      if (!root || !query) {
        active.current = -1;
        lastActiveOffset.current = -1;
        lastSearchKey.current = searchKey;
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
      let lastBlock: Element | null = null;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const block = node.parentElement?.closest(BLOCK_SELECTOR) || null;
        if (lastBlock && block !== lastBlock && text.length > 0 && !text.endsWith("\u0000")) {
          text += "\u0000";
        }
        lastBlock = block;
        segments.push({ node, start: text.length, end: text.length + node.data.length });
        text += node.data;
      }

      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const lead = wholeWord && /^[\p{L}\p{N}_]/u.test(query) ? "(?<![\\p{L}\\p{N}_])" : "";
      const trail = wholeWord && /[\p{L}\p{N}_]$/u.test(query) ? "(?![\\p{L}\\p{N}_])" : "";
      const pattern = new RegExp(`${lead}${escaped}${trail}`, caseSensitive ? "gu" : "giu");
      const ranges: Range[] = [];
      const offsets: number[] = [];
      let first = 0;
      let last = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        while (first < segments.length && segments[first].end <= start) first++;
        last = Math.max(first, last);
        while (last < segments.length && segments[last].end < end) last++;
        if (!segments[first] || !segments[last]) continue;
        const range = document.createRange();
        range.setStart(segments[first].node, start - segments[first].start);
        range.setEnd(segments[last].node, end - segments[last].start);
        ranges.push(range);
        offsets.push(start);
        if (ranges.length >= MAX_MATCHES) break;
      }

      matches.current = ranges;
      matchOffsets.current = offsets;
      if (ranges.length) {
        CSS.highlights.set("inkglass-find", new Highlight(...ranges));
      }

      const keyChanged = lastSearchKey.current !== searchKey;
      lastSearchKey.current = searchKey;

      if (!ranges.length) {
        selectMatch(0, false);
        return;
      }

      if (keyChanged) {
        selectMatch(0, true);
      } else {
        // Preserve active match without yanking scroll position on Mermaid lazy render or Live Watch edits.
        let targetIdx = active.current >= 0 ? Math.min(active.current, ranges.length - 1) : 0;
        if (lastActiveOffset.current >= 0) {
          let bestDist = Infinity;
          for (let i = 0; i < offsets.length; i++) {
            const dist = Math.abs(offsets[i] - lastActiveOffset.current);
            if (dist < bestDist) {
              bestDist = dist;
              targetIdx = i;
            }
          }
        }
        selectMatch(targetIdx, false);
      }
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
  }, [query, documentId, content, mode, caseSensitive, wholeWord, selectMatch]);

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
      <button
        type="button"
        className={`find-toggle-btn ${caseSensitive ? "is-active" : ""}`}
        aria-label="Match case"
        aria-pressed={caseSensitive}
        title="Match case"
        onClick={() => setCaseSensitive(v => !v)}
      >
        Aa
      </button>
      <button
        type="button"
        className={`find-toggle-btn ${wholeWord ? "is-active" : ""}`}
        aria-label="Match whole word"
        aria-pressed={wholeWord}
        title="Match whole word"
        onClick={() => setWholeWord(v => !v)}
      >
        \b
      </button>
      <span className="find-count" aria-live="polite">
        {query ? `${result.active} / ${result.total}${result.total >= MAX_MATCHES ? "+" : ""}` : ""}
      </span>
      <button type="button" className="icon-button" aria-label="Previous match" disabled={!result.total} onClick={() => next(false)}>
        <ArrowUp size={16} />
      </button>
      <button type="button" className="icon-button" aria-label="Next match" disabled={!result.total} onClick={() => next(true)}>
        <ArrowDown size={16} />
      </button>
      <button type="button" className="icon-button" aria-label="Close find" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
