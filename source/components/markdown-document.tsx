"use client";

import { copyText } from "@/lib/clipboard";
import { extractFrontmatter } from "@/lib/frontmatter";
import { parseGitHubAlert, type AlertKind } from "@/lib/alerts";
import { serializeTable } from "@/lib/table-export";

import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  Flame,
  ImageOff,
  Info,
  Lightbulb,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copies, type Locale, type LocaleCopy } from "@/lib/i18n";

function textOf(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) return textOf(value.props.children);
  return "";
}

type LightboxItem =
  | { kind: "svg"; svg: string; source: string; title: string }
  | { kind: "image"; src: string; title: string };

function CopyButton({ value, labels, title }: { value: string; labels: LocaleCopy["renderer"]; title?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-code"
      aria-label={copied ? labels.copied : title || labels.copy}
      onClick={async () => {
        try {
          await copyText(value);
          setCopied(true);
        } catch {
          toast.error(labels.copyFailed);
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? labels.copied : title || labels.copy}</span>
    </button>
  );
}

function MediaLightbox({
  item,
  onClose,
  labels,
  onCopySvg,
}: {
  item: LightboxItem | null;
  onClose: () => void;
  labels: LocaleCopy["renderer"];
  onCopySvg: (svg: string) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); }
      if (e.key === "+" || e.key === "=") setScale(s => Math.min(4, +(s + 0.25).toFixed(2)));
      if (e.key === "-") setScale(s => Math.max(0.4, +(s - 0.25).toFixed(2)));
      if (e.key === "0") { setScale(1); setOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [item, onClose]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!item || !stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setScale(s => Math.min(4, Math.max(0.4, +(s + delta).toFixed(2))));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [item]);

  if (!item) return null;

  return (
    <div
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lightbox-toolbar">
        <span className="lightbox-title">{item.title}</span>
        <div className="lightbox-actions">
          <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => setScale(s => Math.max(0.4, +(s - 0.25).toFixed(2)))}>
            <ZoomOut size={16} />
          </button>
          <span className="lightbox-zoom">{Math.round(scale * 100)}%</span>
          <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2)))}>
            <ZoomIn size={16} />
          </button>
          <button type="button" className="icon-button" aria-label="Reset zoom" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
            <RotateCcw size={15} />
          </button>
          {item.kind === "svg" && (
            <button type="button" className="copy-code" onClick={() => onCopySvg(item.svg)}>
              <Copy size={14} />
              <span>{labels.copySvg}</span>
            </button>
          )}
          <button type="button" className="icon-button" aria-label="Close preview" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </div>
      <div
        ref={stageRef}
        className="lightbox-stage"
        onPointerDown={e => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
        }}
        onPointerMove={e => {
          const drag = dragRef.current;
          if (!drag) return;
          setOffset({ x: drag.origX + (e.clientX - drag.startX), y: drag.origY + (e.clientY - drag.startY) });
        }}
        onPointerUp={e => {
          dragRef.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <div className="lightbox-canvas" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
          {item.kind === "svg" ? (
            <div className="lightbox-svg" dangerouslySetInnerHTML={{ __html: item.svg }} />
          ) : (
            <img src={item.src} alt={item.title} draggable={false} />
          )}
        </div>
      </div>
    </div>
  );
}

let diagramQueue: Promise<void> = Promise.resolve();
function MermaidDiagram({
  source,
  dark,
  labels,
  onInspect,
}: {
  source: string;
  dark: boolean;
  labels: LocaleCopy["renderer"];
  onInspect: (item: LightboxItem) => void;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const forceRender = () => setReady(true);
    window.addEventListener("beforeprint", forceRender);
    window.addEventListener("modu-prepare-print", forceRender);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => {
      window.removeEventListener("beforeprint", forceRender);
      window.removeEventListener("modu-prepare-print", forceRender);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSvg("");
    setError(false);
    diagramQueue = diagramQueue
      .catch(() => {})
      .then(async () => {
        if (cancelled) return;
        try {
          const [{ default: mermaid }, { default: purify }] = await Promise.all([import("mermaid"), import("dompurify")]);
          if (cancelled) return;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: dark ? "dark" : "neutral",
            suppressErrorRendering: true,
            maxTextSize: 50000,
            maxEdges: 300,
            htmlLabels: false,
            flowchart: { htmlLabels: false },
            themeVariables: {
              fontFamily: 'system-ui, "Segoe UI", sans-serif',
              primaryColor: dark ? "#29343c" : "#eef2f4",
              primaryBorderColor: "#a0adb5",
              lineColor: "#788890",
            },
          });
          const result = await mermaid.render(`diagram${id}`, source);
          const safe = purify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
          if (!cancelled) setSvg(safe);
        } catch {
          if (!cancelled) setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, dark, id, ready]);

  return (
    <div className="diagram-block" ref={container}>
      <div className="code-toolbar">
        <span>MERMAID</span>
        <div className="toolbar-group">
          {svg && (
            <button
              type="button"
              className="copy-code"
              aria-label="Inspect Mermaid diagram"
              onClick={() => onInspect({ kind: "svg", svg, source, title: "Mermaid Diagram" })}
            >
              <ZoomIn size={14} />
              <span>{labels.zoomDiagram}</span>
            </button>
          )}
          <CopyButton value={source} labels={labels} />
        </div>
      </div>
      {error ? (
        <div className="diagram-error">{labels.mermaidError}</div>
      ) : svg ? (
        <div
          className="diagram-svg is-zoomable"
          role="img"
          aria-label={labels.mermaidAlt}
          title="Click to zoom and pan"
          onClick={() => onInspect({ kind: "svg", svg, source, title: "Mermaid Diagram" })}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="diagram-loading">{labels.mermaidLoading}</div>
      )}
      <details className="diagram-source">
        <summary>{labels.mermaidSource}</summary>
        <pre>
          <code>{source}</code>
        </pre>
      </details>
    </div>
  );
}

function CodeBlock({
  children,
  dark,
  labels,
  onInspect,
}: {
  children?: React.ReactNode;
  dark: boolean;
  labels: LocaleCopy["renderer"];
  onInspect: (item: LightboxItem) => void;
}) {
  const code = React.Children.toArray(children).find(child => React.isValidElement(child)) as
    | React.ReactElement<{ className?: string; children?: React.ReactNode }>
    | undefined;
  const source = textOf(code?.props.children ?? children).replace(/\n$/, "");
  const language = /language-([^\s]+)/.exec(code?.props.className || "")?.[1] || "text";
  if (language === "mermaid") return <MermaidDiagram source={source} dark={dark} labels={labels} onInspect={onInspect} />;
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{language}</span>
        <CopyButton value={source} labels={labels} />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function DocumentImage({
  src,
  alt,
  title,
  labels,
  onInspect,
}: {
  src?: string;
  alt?: string;
  title?: string;
  labels: LocaleCopy["renderer"];
  onInspect: (item: LightboxItem) => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="image-missing">
        <ImageOff size={18} />
        <span>{labels.missingImage(alt || "")}</span>
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt || labels.imageAlt}
      title={title || "Click to zoom"}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="is-zoomable"
      onClick={() => onInspect({ kind: "image", src, title: alt || labels.imageAlt })}
      onError={() => setFailed(true)}
    />
  );
}

const ALERT_ICONS: Record<AlertKind, React.ComponentType<{ size?: number }>> = {
  note: Info,
  tip: Lightbulb,
  important: AlertCircle,
  warning: AlertTriangle,
  caution: Flame,
};

function SmartBlockquote({ children }: { children?: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(child => !(typeof child === "string" && !child.trim()));
  const first = items[0];
  if (React.isValidElement<{ children?: React.ReactNode }>(first) && first.type === "p") {
    const firstChildren = React.Children.toArray(first.props.children);
    const firstLeaf = firstChildren[0];
    if (typeof firstLeaf === "string") {
      const parsed = parseGitHubAlert(firstLeaf);
      if (parsed) {
        const Icon = ALERT_ICONS[parsed.kind];
        let tail = firstChildren.slice(1);
        if (parsed.remainder === "" && React.isValidElement(tail[0]) && tail[0].type === "br") {
          tail = tail.slice(1);
        }
        const updatedFirstChildren = [parsed.remainder, ...tail].filter(c => c !== "");
        const rest = items.slice(1);
        return (
          <div className={`gh-alert gh-alert-${parsed.kind}`} role="note" data-alert={parsed.kind}>
            <div className="gh-alert-title">
              <Icon size={15} />
              <span>{parsed.label}</span>
            </div>
            <div className="gh-alert-body">
              {updatedFirstChildren.length > 0 && <p>{updatedFirstChildren}</p>}
              {rest}
            </div>
          </div>
        );
      }
    }
  }
  return <blockquote>{children}</blockquote>;
}

function SmartTable({ children, labels }: { children?: React.ReactNode; labels: LocaleCopy["renderer"] }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const exportRows = async (format: "csv" | "tsv") => {
    const table = wrapRef.current?.querySelector("table");
    if (!table) return;
    const rows = [...table.querySelectorAll("tr")].map(tr =>
      [...tr.querySelectorAll("th,td")].map(cell => (cell.textContent || "").trim()),
    );
    if (!rows.length) return;
    try {
      await copyText(serializeTable(rows, format));
      toast.success(copies.en.success.tableCopied(format));
    } catch {
      toast.error(labels.copyFailed);
    }
  };

  return (
    <div className="table-shell" ref={wrapRef}>
      <div className="table-actions">
        <button type="button" className="table-copy-btn" onClick={() => void exportRows("csv")} aria-label="Copy table as CSV">
          <Copy size={12} />
          <span>{labels.copyCsv}</span>
        </button>
        <button type="button" className="table-copy-btn" onClick={() => void exportRows("tsv")} aria-label="Copy table as TSV">
          <span>{labels.copyTsv}</span>
        </button>
      </div>
      <Table className="document-table">{children}</Table>
    </div>
  );
}

export const MarkdownDocument = memo(function MarkdownDocument({
  content,
  dark,
  assets,
  onLink,
  locale,
  documentId,
  changedHeadings = [],
}: {
  documentId?: string;
  content: string;
  dark: boolean;
  assets: Record<string, string>;
  onLink: (href: string) => void;
  locale: Locale;
  changedHeadings?: string[];
}) {
  const labels = copies[locale].renderer;
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const { metadata, body } = useMemo(() => extractFrontmatter(content), [content]);
  const changedSet = useMemo(() => new Set(changedHeadings.map(h => h.trim())), [changedHeadings]);

  const handleCopySvg = useCallback(async (svg: string) => {
    try {
      await copyText(svg);
      toast.success(copies[locale].success.svgCopied);
    } catch {
      toast.error(labels.copyFailed);
    }
  }, [labels.copyFailed, locale]);

  // Attach unobtrusive 1-click raw LaTeX copy buttons to rendered KaTeX display formulas.
  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;
    const blocks = container.querySelectorAll<HTMLElement>(".katex-display");
    const cleanups: Array<() => void> = [];
    blocks.forEach(block => {
      const annotation = block.querySelector('annotation[encoding="application/x-tex"]');
      const tex = annotation?.textContent?.trim();
      if (!tex) return;
      if (block.querySelector(".katex-copy-tex")) return;
      block.classList.add("has-tex-copy");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "katex-copy-tex";
      btn.textContent = labels.copyTex;
      btn.setAttribute("aria-label", "Copy raw LaTeX");
      btn.title = "Copy raw LaTeX";
      const onClick = async (e: MouseEvent) => {
        e.stopPropagation();
        try {
          await copyText(tex);
          toast.success(copies[locale].success.texCopied);
        } catch {
          toast.error(labels.copyFailed);
        }
      };
      btn.addEventListener("click", onClick);
      block.appendChild(btn);
      cleanups.push(() => {
        btn.removeEventListener("click", onClick);
        btn.remove();
      });
    });
    return () => cleanups.forEach(fn => fn());
  }, [body, labels.copyFailed, labels.copyTex, locale]);

  const makeHeading = useCallback(
    (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
      function Heading({ children, id, node: _node, className, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown }) {
        const title = textOf(children).replace(/\s+/g, " ").trim();
        const isChanged = changedSet.size > 0 && changedSet.has(title);
        const mergedClass = [className, isChanged ? "section-changed" : ""].filter(Boolean).join(" ") || undefined;
        return (
          <Tag id={id} data-changed={isChanged ? "true" : undefined} className={mergedClass} {...props}>
            {children}
          </Tag>
        );
      },
    [changedSet],
  );

  const components = useMemo(
    () => ({
      h1: makeHeading("h1"),
      h2: makeHeading("h2"),
      h3: makeHeading("h3"),
      h4: makeHeading("h4"),
      h5: makeHeading("h5"),
      h6: makeHeading("h6"),
      pre: ({ children }: { children?: React.ReactNode }) => (
        <CodeBlock dark={dark} labels={labels} onInspect={setLightbox}>
          {children}
        </CodeBlock>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => <SmartBlockquote>{children}</SmartBlockquote>,
      img: ({ src, alt, title }: { src?: string | Blob; alt?: string; title?: string }) => (
        <DocumentImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} labels={labels} onInspect={setLightbox} />
      ),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
        const external = /^https?:|^mailto:/i.test(href || "");
        return (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            onClick={
              external
                ? undefined
                : e => {
                    e.preventDefault();
                    if (href) onLink(href);
                  }
            }
          >
            {children}
          </a>
        );
      },
      table: ({ children }: { children?: React.ReactNode }) => <SmartTable labels={labels}>{children}</SmartTable>,
      thead: ({ children }: { children?: React.ReactNode }) => <TableHeader>{children}</TableHeader>,
      tbody: ({ children }: { children?: React.ReactNode }) => <TableBody>{children}</TableBody>,
      tr: ({ children }: { children?: React.ReactNode }) => <TableRow>{children}</TableRow>,
      th: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <TableHead style={style}>{children}</TableHead>,
      td: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <TableCell style={style}>{children}</TableCell>,
    }),
    [dark, labels, makeHeading, onLink],
  );

  return (
    <div ref={rootRef}>
      {metadata.length > 0 && (
        <details className="frontmatter-card" open>
          <summary>{labels.metadataTitle}</summary>
          <dl className="frontmatter-grid">
            {metadata.map(entry => (
              <div key={entry.key} className="frontmatter-item">
                <dt>{entry.key}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, trust: false }],
          [rehypeHighlight, { ignoreMissing: true, detect: false }],
          [rehypeSlug, { prefix: "md-" }],
        ]}
        components={components}
        urlTransform={(url, key) => {
          if (key === "src" && !/^(https?:)?\/\//i.test(url)) {
            let decoded = url;
            try {
              decoded = decodeURIComponent(url);
            } catch {}
            const name = decoded.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "";
            return assets[decoded] || assets[name] || (documentId && !/^(?:[a-z][a-z\d+.-]*:|[\\/])/i.test(decoded) ? `modu-media://${documentId}/${url}` : "");
          }
          return defaultUrlTransform(url);
        }}
      >
        {body}
      </Markdown>
      <MediaLightbox item={lightbox} onClose={() => setLightbox(null)} labels={labels} onCopySvg={svg => void handleCopySvg(svg)} />
    </div>
  );
});
