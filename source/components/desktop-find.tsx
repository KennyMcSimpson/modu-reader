import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { desktop } from "@/lib/desktop";
import type { Locale } from "@/lib/i18n";

export function DesktopFind({ locale, documentId, onClose }: { locale: Locale; documentId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ active: 0, total: 0 });
  const input = useRef<HTMLInputElement>(null);
  const en = locale === "en";
  useEffect(() => { input.current?.focus(); return desktop?.onFindResult(setResult); }, []);
  useEffect(() => {
    setResult({ active: 0, total: 0 });
    const timer = setTimeout(() => { void desktop?.find(query); }, 180);
    return () => clearTimeout(timer);
  }, [query, documentId]);
  useEffect(() => () => { void desktop?.stopFind(); }, []);
  const next = (forward: boolean) => { if (query) void desktop?.find(query, forward, true); };
  return <div className="desktop-find" role="search" aria-label={en ? "Find in document" : "查找文档"}>
    <Search size={15} aria-hidden="true" />
    <input ref={input} value={query} maxLength={1000} aria-label={en ? "Find text" : "查找文字"} placeholder={en ? "Find text…" : "查找文字…"} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
      if (event.key === "Enter") { event.preventDefault(); next(!event.shiftKey); }
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    }} />
    <span className="find-count" aria-live="polite">{query ? `${result.active} / ${result.total}` : ""}</span>
    <button className="icon-button" aria-label={en ? "Previous match" : "上一处"} disabled={!query} onClick={() => next(false)}><ArrowUp size={16} /></button>
    <button className="icon-button" aria-label={en ? "Next match" : "下一处"} disabled={!query} onClick={() => next(true)}><ArrowDown size={16} /></button>
    <button className="icon-button" aria-label={en ? "Close find" : "关闭查找"} onClick={onClose}><X size={16} /></button>
  </div>;
}
