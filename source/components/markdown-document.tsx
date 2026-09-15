"use client";

import { copyText } from "@/lib/clipboard";

import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { Check, Copy, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copies, type Locale, type LocaleCopy } from "@/lib/i18n";

function textOf(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) return textOf(value.props.children);
  return "";
}

function CopyButton({ value, labels }: { value: string; labels: LocaleCopy["renderer"] }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timer); }, [copied]);
  return <button className="copy-code" aria-label={copied ? labels.copied : labels.copy} onClick={async () => {
    try { await copyText(value); setCopied(true); }
    catch { toast.error(labels.copyFailed); }
  }}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? labels.copied : labels.copy}</span></button>;
}

let diagramQueue: Promise<void> = Promise.resolve();
function MermaidDiagram({ source, dark, labels }: { source: string; dark: boolean; labels: LocaleCopy["renderer"] }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setReady(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSvg(""); setError(false);
    diagramQueue = diagramQueue.catch(() => {}).then(async () => {
      if (cancelled) return;
      try {
        const [{ default: mermaid }, { default: purify }] = await Promise.all([import("mermaid"), import("dompurify")]);
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", suppressErrorRendering: true, maxTextSize: 50000, maxEdges: 300, flowchart: { htmlLabels: false }, themeVariables: { fontFamily: 'system-ui, "Microsoft YaHei", sans-serif', primaryColor: dark ? "#29343c" : "#eef2f4", primaryBorderColor: "#a0adb5", lineColor: "#788890" } });
        const result = await mermaid.render(`diagram${id}`, source);
        const safe = purify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        if (!cancelled) setSvg(safe);
      } catch { if (!cancelled) setError(true); }
    });
    return () => { cancelled = true; };
  }, [source, dark, id, ready]);
  return <div className="diagram-block" ref={container}>
    <div className="code-toolbar"><span>MERMAID</span><CopyButton value={source} labels={labels} /></div>
    {error ? <div className="diagram-error">{labels.mermaidError}</div> : svg ? <div className="diagram-svg" role="img" aria-label={labels.mermaidAlt} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="diagram-loading">{labels.mermaidLoading}</div>}
    <details className="diagram-source"><summary>{labels.mermaidSource}</summary><pre><code>{source}</code></pre></details>
  </div>;
}

function CodeBlock({ children, dark, labels }: { children?: React.ReactNode; dark: boolean; labels: LocaleCopy["renderer"] }) {
  const code = React.Children.toArray(children).find(child => React.isValidElement(child)) as React.ReactElement<{className?: string; children?: React.ReactNode}> | undefined;
  const source = textOf(code?.props.children ?? children).replace(/\n$/, "");
  const language = /language-([^\s]+)/.exec(code?.props.className || "")?.[1] || "text";
  if (language === "mermaid") return <MermaidDiagram source={source} dark={dark} labels={labels} />;
  return <div className="code-block"><div className="code-toolbar"><span>{language}</span><CopyButton value={source} labels={labels} /></div><pre>{children}</pre></div>;
}

function DocumentImage({ src, alt, title, labels }: { src?: string; alt?: string; title?: string; labels: LocaleCopy["renderer"] }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="image-missing"><ImageOff size={18} /><span>{labels.missingImage(alt || "")}</span></span>;
  return <img src={src} alt={alt || labels.imageAlt} title={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export const MarkdownDocument = memo(function MarkdownDocument({ content, dark, assets, onLink, locale }: {
  content: string; dark: boolean; assets: Record<string, string>; onLink: (href: string) => void; locale: Locale;
}) {
  const labels = copies[locale].renderer;
  const components = useMemo(() => ({
    pre: ({ children }: {children?: React.ReactNode}) => <CodeBlock dark={dark} labels={labels}>{children}</CodeBlock>,
    img: ({ src, alt, title }: {src?: string | Blob; alt?: string; title?: string}) => <DocumentImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} labels={labels} />,
    a: ({ href, children }: {href?: string; children?: React.ReactNode}) => {
      const external = /^https?:|^mailto:/i.test(href || "");
      return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} onClick={external ? undefined : (e) => {e.preventDefault(); if (href) onLink(href);}}>{children}</a>;
    },
    table: ({children}: {children?: React.ReactNode}) => <Table className="document-table">{children}</Table>,
    thead: ({children}: {children?: React.ReactNode}) => <TableHeader>{children}</TableHeader>,
    tbody: ({children}: {children?: React.ReactNode}) => <TableBody>{children}</TableBody>,
    tr: ({children}: {children?: React.ReactNode}) => <TableRow>{children}</TableRow>,
    th: ({children, style}: {children?: React.ReactNode; style?: React.CSSProperties}) => <TableHead style={style}>{children}</TableHead>,
    td: ({children, style}: {children?: React.ReactNode; style?: React.CSSProperties}) => <TableCell style={style}>{children}</TableCell>,
  }), [dark, labels, onLink]);
  return <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, {throwOnError: false, trust: false}], [rehypeHighlight, {ignoreMissing: true, detect: false}], [rehypeSlug, {prefix: "md-"}]]} components={components} urlTransform={(url, key) => {
    if (key === "src" && !/^(https?:)?\/\//i.test(url)) {
      let decoded = url;
      try {decoded = decodeURIComponent(url);} catch {}
      const name = decoded.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "";
      return assets[decoded] || assets[name] || "";
    }
    return defaultUrlTransform(url);
  }}>{content}</Markdown>;
});
