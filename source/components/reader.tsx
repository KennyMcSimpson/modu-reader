"use client";

import { copyText } from "@/lib/clipboard";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { BookOpen, PanelLeft, FileText, FolderOpen, Plus, ClipboardPaste, Sun, Moon, Monitor, Maximize2, Minimize2, List, ArrowUp, ChevronRight, X, FileCode2, Clock3, AlignLeft, Keyboard, LockKeyhole, Loader2, Languages } from "lucide-react";
import { toast, Toaster } from "sonner";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownDocument } from "@/components/markdown-document";
import { welcome, formatGuide } from "@/lib/demo";
import { copies, getInitialLocale, localeStorageKey, type Locale, type LocaleCopy } from "@/lib/i18n";

type Doc = { id: string; name: string; content: string; sample?: boolean; encoding?: string; };
type Heading = {id: string; title: string; level: number};
type Preferences = {theme: "light" | "dark" | "system"; size: number; line: number; width: string; font: string};
const initial: Preferences = {theme: "light", size: 17, line: 1.95, width: "comfortable", font: "sans"};
const samples: Doc[] = [{id: "welcome", name: "欢迎使用墨读.md", content: welcome, sample: true}, {id: "guide", name: "Markdown 格式速查.md", content: formatGuide, sample: true}];
const accepted = ".md,.markdown,.mdown,.txt,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif";

function IconButton({ label, children, onClick, active, className = "" }: {label: string; children: React.ReactNode; onClick?: () => void; active?: boolean; className?: string}) {
  return <Tooltip><TooltipTrigger asChild><button type="button" className={`icon-button ${active ? "is-active" : ""} ${className}`} aria-label={label} aria-pressed={active} onClick={onClick}>{children}</button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function LocaleSwitch({ locale, onChange, labels }: {locale: Locale; onChange: (value: Locale) => void; labels: LocaleCopy["language"]}) {
  return <div className="locale-switch" role="group" aria-label={labels.group}>
    <Languages size={14} aria-hidden="true" />
    <button type="button" className={`locale-option ${locale === "zh" ? "is-active" : ""}`} aria-pressed={locale === "zh"} onClick={() => onChange("zh")} title={labels.chinese}>中</button>
    <span aria-hidden="true">/</span>
    <button type="button" className={`locale-option ${locale === "en" ? "is-active" : ""}`} aria-pressed={locale === "en"} onClick={() => onChange("en")} title={labels.english}>EN</button>
  </div>;
}

export default function Reader() {
  return <SidebarProvider style={{"--sidebar-width": "248px"} as CSSProperties}><ReaderApp /></SidebarProvider>;
}

function ReaderApp() {
  const { setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const [documents, setDocuments] = useState<Doc[]>(samples);
  const [activeId, setActiveId] = useState("welcome");
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
  const [loaded, setLoaded] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [focus, setFocus] = useState(false);
  const [mode, setMode] = useState("read");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const article = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);
  const depth = useRef(0);
  const importing = useRef(false);
  const positions = useRef<Record<string, number>>({});
  const doc = documents.find(d => d.id === activeId) || documents[0];
  const copy = copies[locale];
  const displayName = doc.sample ? (doc.id === "welcome" ? copy.sidebar.sampleNames.welcome : copy.sidebar.sampleNames.guide) : doc.name;
  const dark = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);
  const stats = useMemo(() => {
    const cjk = (doc.content.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (doc.content.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
    return { count: cjk + words, minutes: Math.max(1, Math.ceil(cjk / 400 + words / 230)) };
  }, [doc.content]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("modu-preferences") || "null");
      if (saved) setPreferences({
        theme: ["light", "dark", "system"].includes(saved.theme) ? saved.theme : initial.theme,
        size: Number.isFinite(saved.size) ? Math.min(24, Math.max(14, saved.size)) : initial.size,
        line: Number.isFinite(saved.line) ? Math.min(2.4, Math.max(1.5, saved.line)) : initial.line,
        width: ["compact", "comfortable", "wide"].includes(saved.width) ? saved.width : initial.width,
        font: ["sans", "serif"].includes(saved.font) ? saved.font : initial.font,
      });
    } catch {}
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    setLoaded(true);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (loaded) { try {localStorage.setItem("modu-preferences", JSON.stringify(preferences));} catch {} }
  }, [preferences, loaded, dark]);
  useEffect(() => {
    if (loaded) { try {localStorage.setItem(localeStorageKey, locale);} catch {} }
  }, [locale, loaded]);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {document.title = `${displayName} · ${copy.brand.name}`;}, [copy.brand.name, displayName]);

  const selectDoc = useCallback((id: string) => {
    if (scrollArea.current) positions.current[activeId] = scrollArea.current.scrollTop;
    setActiveId(id); setMode("read"); setTocOpen(false); setOpenMobile(false);
  }, [activeId, setOpenMobile]);

  const openFiles = useCallback(async (files: File[]) => {
    if (!files.length || importing.current) return;
    importing.current = true; setBusy(true);
    try {
      const next: Doc[] = [];
      const nextAssets: Record<string, string> = {};
      let ignored = 0;
      for (const file of files) {
        if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(file.name)) {
          if (file.size > 20 * 1024 * 1024) { toast.error(copy.errors.imageTooLarge(file.name)); continue; }
          const url = URL.createObjectURL(file); urls.current.push(url); nextAssets[file.name] = url;
          continue;
        }
        if (!/\.(md|markdown|mdown|txt)$/i.test(file.name)) {ignored++; continue;}
        if (file.size > 2 * 1024 * 1024) {toast.error(copy.errors.fileTooLarge(file.name)); continue;}
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let content: string; let encoding = "UTF-8";
          if (bytes[0] === 255 && bytes[1] === 254) {content = new TextDecoder("utf-16le").decode(bytes); encoding = "UTF-16 LE";}
          else if (bytes[0] === 254 && bytes[1] === 255) {content = new TextDecoder("utf-16be").decode(bytes); encoding = "UTF-16 BE";}
          else {try {content = new TextDecoder("utf-8", {fatal: true}).decode(bytes);} catch {content = new TextDecoder("gb18030").decode(bytes); encoding = "GB18030";}}
          if (content.includes("\u0000")) {toast.error(copy.errors.invalidText(file.name)); continue;}
          next.push({id: crypto.randomUUID(), name: file.name, content: content.replace(/\r\n?/g, "\n"), encoding});
        } catch {toast.error(copy.errors.readFailed(file.name));}
      }
      if (Object.keys(nextAssets).length) setAssets(old => ({...old, ...nextAssets}));
      if (next.length) {
        if (scrollArea.current) positions.current[activeId] = scrollArea.current.scrollTop;
        setDocuments(old => [...old, ...next]); setActiveId(next[0].id); setMode("read"); setOpenMobile(false);
        toast.success(copy.success.opened(next.length));
      } else if (Object.keys(nextAssets).length) toast.success(copy.success.assetsAdded(Object.keys(nextAssets).length));
      if (ignored) toast.info(copy.errors.unsupported(ignored));
    } finally { importing.current = false; setBusy(false); }
  }, [activeId, copy, setOpenMobile]);

  const toggleFocus = useCallback(() => {setFocus(!focus); setOpen(focus); setOpenMobile(false);}, [focus, setOpen, setOpenMobile]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {e.preventDefault(); fileInput.current?.click();}
      if (e.key === "Escape" && focus) {setFocus(false); setOpen(true);}
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, setOpen]);

  useEffect(() => {
    const area = scrollArea.current;
    if (!area || mode !== "read") {setHeadings([]); return;}
    const frame = requestAnimationFrame(() => {
      const nodes = [...(article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") || [])];
      setHeadings(nodes.map(el => ({id: el.id, title: el.textContent || copy.toc.untitled, level: Number(el.tagName[1])})));
      area.scrollTop = positions.current[doc.id] || 0;
      update();
    });
    let scheduled = false;
    function update() {
      if (!area) return;
      const total = area.scrollHeight - area.clientHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, Math.round(area.scrollTop / total * 100))) : 100);
      const nodes = article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
      let selected = nodes?.[0]?.id || "";
      const edge = area.getBoundingClientRect().top + 150;
      nodes?.forEach(el => {if (el.getBoundingClientRect().top <= edge) selected = el.id;});
      setActiveHeading(selected); scheduled = false;
    }
    const onScroll = () => { if (!scheduled) {scheduled = true; requestAnimationFrame(update);} };
    area.addEventListener("scroll", onScroll, {passive: true});
    const observer = new ResizeObserver(onScroll);
    if (article.current) observer.observe(article.current);
    observer.observe(area);
    return () => {cancelAnimationFrame(frame); area.removeEventListener("scroll", onScroll); observer.disconnect();};
  }, [copy.toc.untitled, doc.id, doc.content, mode]);

  const jumpTo = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target || !scrollArea.current) return;
    scrollArea.current.scrollTo({top: scrollArea.current.scrollTop + target.getBoundingClientRect().top - scrollArea.current.getBoundingClientRect().top - 42, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    setActiveHeading(id); setTocOpen(false);
  }, []);
  const handleLink = useCallback((href: string) => {
    if (href.startsWith("#")) {let id = href.slice(1); try {id = decodeURIComponent(id);} catch {} jumpTo(document.getElementById(id) ? id : "md-" + id); return;}
    let path = href.split("#")[0]; try {path = decodeURIComponent(path);} catch {}
    const name = path.split("/").pop();
    const found = documents.find(d => d.name === name);
    if (found) {selectDoc(found.id);}
    else toast.info(copy.errors.missingDocument);
  }, [copy, documents, selectDoc, jumpTo]);

  const closeDoc = (id: string) => {
    const next = documents.filter(d => d.id !== id);
    setDocuments(next.length ? next : samples);
    if (id === activeId) {setActiveId(next[0]?.id || "welcome"); setMode("read");}
    delete positions.current[id];
  };
  const openText = useCallback((content: string, name: string = "") => {
    if (!content.trim()) throw new Error(copy.errors.emptyPaste);
    if (new Blob([content]).size > 2 * 1024 * 1024) throw new Error(copy.errors.pasteTooLarge);
    const title = name.trim().slice(0, 120) || content.match(/^#\s+(.+)$/m)?.[1]?.slice(0, 60) || copy.paste.defaultName;
    const next = {id: crypto.randomUUID(), name: /\.(md|markdown|txt)$/i.test(title) ? title : `${title}.md`, content: content.replace(/\r\n?/g, "\n"), encoding: "UTF-8"};
    if (scrollArea.current) positions.current[activeId] = scrollArea.current.scrollTop;
    setDocuments(old => [...old, next]); setActiveId(next.id); setMode("read"); setOpenMobile(false);
    return {id: next.id, name: next.name};
  }, [activeId, copy, setOpenMobile]);
  const openTextRef = useRef(openText);
  useEffect(() => {openTextRef.current = openText;}, [openText]);
  useEffect(() => {
    type Context = {registerTool: (tool: {name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown}, options: {signal: AbortSignal}) => void | Promise<void>};
    const context = (document as Document & {modelContext?: Context}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "open_markdown_text", title: copy.modelContext.title, description: copy.modelContext.description,
        inputSchema: {type: "object", properties: {content: {type: "string"}, name: {type: "string", maxLength: 120}}, required: ["content"], additionalProperties: false},
        annotations: {readOnlyHint: false, untrustedContentHint: true},
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(copy.modelContext.inputError);
          const args = input as Record<string, unknown>;
          if (Object.keys(args).some(key => !["content", "name"].includes(key)) || typeof args.content !== "string" || (args.name !== undefined && (typeof args.name !== "string" || args.name.length > 120))) throw new Error(copy.modelContext.argumentError);
          let result: {id: string; name: string} | undefined;
          flushSync(() => { result = openTextRef.current(args.content as string, args.name as string | undefined); });
          return {...result, status: "opened", persistence: "current_page_only"};
        },
      }, {signal: lifecycle.signal})).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [copy]);
  const readPaste = () => {
    try {openText(pasteText, pasteName); setPasteOpen(false); setPasteText(""); setPasteName("");}
    catch (error) {toast.error(error instanceof Error ? error.message : copy.errors.readFailed(copy.paste.title));}
  };

  const toc = <nav aria-label={copy.toc.title} className="toc-links">{headings.length ? headings.map(h => <button key={h.id} className={`toc-link level-${h.level} ${activeHeading === h.id ? "current" : ""}`} style={{paddingLeft: `${Math.max(0, h.level - 2) * 12 + 16}px`}} onClick={() => jumpTo(h.id)} title={h.title}>{h.title}</button>) : <p className="toc-empty">{mode === "source" ? copy.toc.sourceHint : copy.toc.empty}</p>}</nav>;

  return <div className={`reader-app ${focus ? "focus-mode" : ""}`} onDragEnter={e => {if (e.dataTransfer.types.includes("Files")) {e.preventDefault(); depth.current++; setDragging(true);}}} onDragLeave={e => {e.preventDefault(); depth.current--; if (depth.current <= 0) setDragging(false);}} onDragOver={e => {if (e.dataTransfer.types.includes("Files")) {e.preventDefault(); e.dataTransfer.dropEffect = "copy";}}} onDrop={e => {e.preventDefault(); depth.current = 0; setDragging(false); void openFiles(Array.from(e.dataTransfer.files));}}>
    <input ref={fileInput} type="file" accept={accepted} multiple className="sr-only" aria-label={copy.aria.fileInput} onChange={e => {void openFiles(Array.from(e.target.files || [])); e.target.value = "";}} />
    <Sidebar className="file-sidebar">
      <SidebarHeader className="brand-area">
        <div className="brand"><div className="brand-symbol"><BookOpen size={22} strokeWidth={1.6} /><span /></div><div><strong>{copy.brand.name}<span className="brand-dot">.</span></strong><small>{copy.brand.english}</small><em>{copy.brand.descriptor}</em></div><button className="mobile-close icon-button" onClick={() => setOpenMobile(false)} aria-label={copy.actions.closeSidebar}><X size={18} /></button></div>
        <Button className="open-file-button" onClick={() => fileInput.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={17} /> : <Plus size={18} />}<span>{busy ? copy.actions.readingFile : copy.actions.openFile}</span><kbd>⌘ / Ctrl O</kbd></Button>
        <button className="paste-button" onClick={() => setPasteOpen(true)}><ClipboardPaste size={16} />{copy.actions.pasteText}</button>
      </SidebarHeader>
      <SidebarContent className="file-list-area">
        <div className="section-label">{copy.sidebar.reading}<span>{documents.filter(d => !d.sample).length}</span></div>
        <SidebarMenu>{documents.filter(d => !d.sample).map(d => <SidebarMenuItem key={d.id}><SidebarMenuButton className="file-item" isActive={d.id === activeId} onClick={() => selectDoc(d.id)} title={d.name}><FileText size={17} /><span>{d.name}</span></SidebarMenuButton><SidebarMenuAction className="file-close" showOnHover onClick={() => closeDoc(d.id)} aria-label={copy.actions.closeDocument(d.name)}><X size={13} /></SidebarMenuAction></SidebarMenuItem>)}</SidebarMenu>
        {!documents.some(d => !d.sample) && <div className="files-empty"><FolderOpen size={24} strokeWidth={1.25} /><p>{copy.sidebar.emptyTitle}</p><span>{copy.sidebar.emptyHint}</span></div>}
        <div className="section-label sample-label">{copy.sidebar.startHere}</div>
        <SidebarMenu>{documents.filter(d => d.sample).map(d => <SidebarMenuItem key={d.id}><SidebarMenuButton className="file-item sample-file" isActive={d.id === activeId} onClick={() => selectDoc(d.id)} title={d.name}>{d.id === "welcome" ? <BookOpen size={17} /> : <FileCode2 size={17} />}<span>{d.id === "welcome" ? copy.sidebar.sampleNames.welcome : copy.sidebar.sampleNames.guide}</span>{d.id === activeId && <span className="active-mark" />}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <div className="privacy-note"><LockKeyhole size={13} /><span>{copy.sidebar.localPrivacy}</span></div>
        <div className="sidebar-bottom-row"><span className="version-label">{copy.sidebar.version}</span><div className="theme-controls">{([{value: "light", label: copy.settings.themes.light, icon: Sun}, {value: "dark", label: copy.settings.themes.dark, icon: Moon}, {value: "system", label: copy.settings.themes.system, icon: Monitor}] as const).map(t => <IconButton key={t.value} label={t.label} active={preferences.theme === t.value} onClick={() => setPreferences(p => ({...p, theme: t.value}))}><t.icon size={15} /></IconButton>)}</div></div>
        <LocaleSwitch locale={locale} onChange={setLocale} labels={copy.language} />
      </SidebarFooter>
    </Sidebar>

    <main className="reader-main">
      <Tabs className="reader-tabs" value={mode} onValueChange={value => {if (scrollArea.current && mode === "read") positions.current[activeId] = scrollArea.current.scrollTop; setMode(value);}}>
        <header className="topbar">
          <div className="file-breadcrumb"><IconButton label={copy.actions.toggleSidebar} onClick={() => {if (focus) {setFocus(false); setOpen(true);} else toggleSidebar();}}><PanelLeft size={18} /></IconButton><span className="breadcrumb-divider" /><span className="breadcrumb-parent">{doc.sample ? copy.breadcrumb.guide : copy.breadcrumb.documents}</span><ChevronRight size={14} className="breadcrumb-chevron" /><span className="current-filename" title={displayName}>{displayName}</span></div>
          <div className="reading-tools">
            <TabsList className="view-tabs" aria-label={copy.tabs.aria}><TabsTrigger value="read"><BookOpen size={15} /><span>{copy.tabs.read}</span></TabsTrigger><TabsTrigger value="source"><FileCode2 size={15} /><span>{copy.tabs.source}</span></TabsTrigger></TabsList>
            <span className="tools-divider" />
            <Popover><PopoverTrigger asChild><button className="type-trigger icon-button" aria-label={copy.actions.settings}>Aa</button></PopoverTrigger><PopoverContent className="reader-settings" align="end"><h2>{copy.settings.title}</h2><div className="setting-label"><span>{copy.settings.fontSize}</span><span>{preferences.size}px</span></div><Slider aria-label={copy.settings.bodyFontSize} min={14} max={24} step={1} value={[preferences.size]} onValueChange={([size]) => setPreferences(p => ({...p, size}))} /><div className="setting-label"><span>{copy.settings.lineHeight}</span><span>{preferences.line.toFixed(2)}</span></div><Slider aria-label={copy.settings.bodyLineHeight} min={1.5} max={2.4} step={0.05} value={[preferences.line]} onValueChange={([line]) => setPreferences(p => ({...p, line}))} /><div className="setting-row"><label htmlFor="font-choice">{copy.settings.font}</label><Select value={preferences.font} onValueChange={font => setPreferences(p => ({...p, font}))}><SelectTrigger id="font-choice"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sans">{copy.settings.fonts.sans}</SelectItem><SelectItem value="serif">{copy.settings.fonts.serif}</SelectItem></SelectContent></Select></div><div className="setting-row"><label htmlFor="width-choice">{copy.settings.width}</label><Select value={preferences.width} onValueChange={width => setPreferences(p => ({...p, width}))}><SelectTrigger id="width-choice"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">{copy.settings.widths.compact}</SelectItem><SelectItem value="comfortable">{copy.settings.widths.comfortable}</SelectItem><SelectItem value="wide">{copy.settings.widths.wide}</SelectItem></SelectContent></Select></div><div className="setting-row"><label htmlFor="theme-choice">{copy.settings.theme}</label><Select value={preferences.theme} onValueChange={(theme: Preferences["theme"]) => setPreferences(p => ({...p, theme}))}><SelectTrigger id="theme-choice"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">{copy.settings.themes.light}</SelectItem><SelectItem value="dark">{copy.settings.themes.dark}</SelectItem><SelectItem value="system">{copy.settings.themes.system}</SelectItem></SelectContent></Select></div><button className="reset-settings" onClick={() => setPreferences(initial)}>{copy.settings.reset}</button></PopoverContent></Popover>
            <IconButton label={focus ? copy.actions.exitFocus : copy.actions.focus} active={focus} onClick={toggleFocus}>{focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</IconButton>
            <Popover open={tocOpen} onOpenChange={setTocOpen}><PopoverTrigger asChild><button className="icon-button mobile-toc" aria-label={copy.actions.toc}><List size={18} /></button></PopoverTrigger><PopoverContent align="end" className="mobile-toc-popover"><h2>{copy.toc.title}</h2>{toc}</PopoverContent></Popover>
          </div>
        </header>
        <div className="content-layout">
          <div className="document-scroll" ref={scrollArea}>
            <div className={`document-inner width-${preferences.width}`} style={{"--reading-size": `${preferences.size / 16}rem`, "--reading-line": preferences.line} as CSSProperties}>
              <div className="document-meta"><span className="document-kind">{doc.sample ? copy.stats.sampleKind : copy.stats.markdownKind}</span><span className="meta-rule" /><span><Clock3 size={13} />{copy.stats.minutes(stats.minutes)}</span><span>{copy.stats.words(stats.count)}</span>{!doc.sample && <span className="local-badge">{copy.stats.localDocument}</span>}</div>
              <TabsContent value="read" className="reading-panel">
                {doc.content.trim() ? <article className={`markdown-body font-${preferences.font}`} ref={article}><MarkdownDocument content={doc.content} dark={dark} assets={assets} onLink={handleLink} locale={locale} /></article> : <article ref={article} className="empty-document"><FileText size={34} strokeWidth={1.2} /><h1>{copy.empty.title}</h1><p>{copy.empty.description}</p><Button onClick={() => fileInput.current?.click()}>{copy.actions.openFileShort}</Button></article>}
                <div className="document-end"><span /><BookOpen size={15} /><span /></div><p className="end-note">{copy.stats.end}</p>
              </TabsContent>
              <TabsContent value="source" className="source-panel"><div className="source-heading"><span>{copy.stats.sourceTitle}</span><button onClick={async () => {try {await copyText(doc.content); toast.success(copy.success.copied);} catch {toast.error(copy.errors.copyFailed);}}}>{copy.actions.copyAll}</button></div><pre tabIndex={0} aria-label={copy.aria.source}>{doc.content || copy.empty.source}</pre></TabsContent>
            </div>
          </div>
          {!focus && <aside className="toc-sidebar"><div className="toc-title"><AlignLeft size={16} /><h2>{copy.toc.title}</h2></div>{toc}<div className="toc-tip"><Keyboard size={16} /><span>{copy.toc.shortcutLabel}<br /><small>{copy.toc.findText}</small></span></div><button className="back-to-top" onClick={() => scrollArea.current?.scrollTo({top: 0, behavior: "smooth"})}><ArrowUp size={14} />{copy.actions.backToTop}</button></aside>}
        </div>
        <footer className="reading-status"><div><span className="format-indicator">MD</span><span>{doc.encoding || "UTF-8"}</span><span className="footer-tip">{focus ? copy.actions.exitFocus : copy.stats.dropHint}</span></div><div className="reading-progress"><span>{mode === "source" ? copy.stats.sourceView : `${progress}%`}</span>{mode === "read" && <Progress value={progress} aria-label={copy.aria.progress} className="progress-bar" />}</div></footer>
      </Tabs>
    </main>

    <Dialog open={pasteOpen} onOpenChange={setPasteOpen}><DialogContent className="paste-dialog"><DialogHeader><DialogTitle>{copy.paste.title}</DialogTitle><DialogDescription>{copy.paste.description}</DialogDescription></DialogHeader><label htmlFor="paste-name">{copy.paste.name} <span>{copy.paste.optional}</span></label><Input id="paste-name" value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder={copy.paste.namePlaceholder} maxLength={120} /><label htmlFor="paste-content">{copy.paste.content}</label><Textarea id="paste-content" className="paste-textarea" placeholder={copy.paste.contentPlaceholder} value={pasteText} onChange={e => setPasteText(e.target.value)} /><DialogFooter><Button variant="ghost" onClick={() => setPasteOpen(false)}>{copy.actions.cancel}</Button><Button onClick={readPaste} disabled={!pasteText.trim()}>{copy.actions.startReading}<ChevronRight size={16} /></Button></DialogFooter></DialogContent></Dialog>
    {dragging && <div className="drop-overlay"><FolderOpen size={48} strokeWidth={1.2} /><h2>{copy.drop.title}</h2><p>{copy.drop.description}</p></div>}
    <Toaster position="bottom-center" theme={dark ? "dark" : "light"} richColors closeButton />
  </div>;
}
