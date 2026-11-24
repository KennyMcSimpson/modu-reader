"use client";

import { copyText } from "@/lib/clipboard";
import { diffDocumentSections } from "@/lib/live-diff";
import { formatMarkdownCitation } from "@/lib/citations";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronRight,
  ClipboardPaste,
  Clock3,
  Columns2,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Keyboard,
  List,
  Loader2,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  PanelLeft,
  Pin,
  Plus,
  Printer,
  Quote,
  Radio,
  RefreshCw,
  Search,
  Sun,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  useSidebar,
} from "@/components/ui/sidebar";
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
import { desktop, type FolderListing, type NativeAction } from "@/lib/desktop";
import { DesktopFind } from "@/components/desktop-find";
import { MarkdownDocument } from "@/components/markdown-document";
import { welcome, formatGuide } from "@/lib/demo";
import { copies, type Locale } from "@/lib/i18n";

type Doc = { id: string; name: string; content: string; sample?: boolean; encoding?: string; nativeId?: string; path?: string };
type Heading = { id: string; title: string; level: number };
type Preferences = { theme: "light" | "dark" | "system"; size: number; line: number; width: string; font: string };
type LiveUpdateBanner = { docId: string; changedCount: number; changedHeadings: string[]; updatedAt: string };

const initial: Preferences = { theme: "light", size: 17, line: 1.95, width: "comfortable", font: "sans" };
const samples: Doc[] = [
  { id: "welcome", name: "Welcome to Inkglass.md", content: welcome, sample: true },
  { id: "guide", name: "Markdown quick reference.md", content: formatGuide, sample: true },
];
const accepted = ".md,.markdown,.mdown,.txt,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif";
const SCROLL_STORAGE_KEY = "inkglass-scroll-positions";
const LEGACY_SCROLL_STORAGE_KEY = "modu-scroll-positions";
const PREFS_STORAGE_KEY = "inkglass-preferences";
const LEGACY_PREFS_STORAGE_KEY = "modu-preferences";

function loadSavedScrolls(): Record<string, number> {
  try {
    const rawText = localStorage.getItem(SCROLL_STORAGE_KEY) || localStorage.getItem(LEGACY_SCROLL_STORAGE_KEY) || "{}";
    const raw = JSON.parse(rawText);
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function persistScroll(key: string, offset: number) {
  try {
    const map = loadSavedScrolls();
    map[key] = Math.round(offset);
    const entries = Object.entries(map);
    const trimmed = entries.length > 100 ? Object.fromEntries(entries.slice(-100)) : map;
    localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function IconButton({
  label,
  children,
  onClick,
  active,
  disabled,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`icon-button ${active ? "is-active" : ""} ${className}`}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function Reader() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "256px" } as CSSProperties}>
      <ReaderApp />
    </SidebarProvider>
  );
}

function ReaderApp() {
  const locale: Locale = "en";
  const copy = copies[locale];
  const { setOpen, setOpenMobile, toggleSidebar } = useSidebar();
  const [documents, setDocuments] = useState<Doc[]>(samples);
  const [activeId, setActiveId] = useState("welcome");
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [loaded, setLoaded] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [focus, setFocus] = useState(false);
  const [mode, setMode] = useState<"read" | "split" | "source">("read");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [liveWatch, setLiveWatch] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [folder, setFolder] = useState<FolderListing | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<Record<string, LiveUpdateBanner>>({});
  const [changeCursor, setChangeCursor] = useState(0);
  const [nav, setNav] = useState<{ items: string[]; index: number }>({ items: ["welcome"], index: 0 });

  const fileInput = useRef<HTMLInputElement>(null);
  const article = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);
  const depth = useRef(0);
  const importing = useRef(false);
  const positions = useRef<Record<string, number>>(loadSavedScrolls());
  const pendingFragment = useRef<string>("");

  const doc = documents.find(d => d.id === activeId) || documents[0];
  const scrollKey = doc.path || doc.id;
  const displayName = doc.sample ? (doc.id === "welcome" ? copy.sidebar.sampleNames.welcome : copy.sidebar.sampleNames.guide) : doc.name;
  const dark = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);

  const stats = useMemo(() => {
    const cjk = (doc.content.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (doc.content.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
    return { count: cjk + words, minutes: Math.max(1, Math.ceil(cjk / 400 + words / 230)) };
  }, [doc.content]);

  useEffect(() => {
    try {
      const savedText = localStorage.getItem(PREFS_STORAGE_KEY) || localStorage.getItem(LEGACY_PREFS_STORAGE_KEY) || "null";
      const saved = JSON.parse(savedText);
      if (saved) {
        setPreferences({
          theme: ["light", "dark", "system"].includes(saved.theme) ? saved.theme : initial.theme,
          size: Number.isFinite(saved.size) ? Math.min(24, Math.max(14, saved.size)) : initial.size,
          line: Number.isFinite(saved.line) ? Math.min(2.4, Math.max(1.5, saved.line)) : initial.line,
          width: ["compact", "comfortable", "wide"].includes(saved.width) ? saved.width : initial.width,
          font: ["sans", "serif"].includes(saved.font) ? saved.font : initial.font,
        });
      }
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
    if (loaded) {
      try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences)); } catch {}
    }
  }, [preferences, loaded, dark]);

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => { document.title = `${displayName} · ${copy.brand.english}`; }, [copy.brand.english, displayName]);

  const saveCurrentScroll = useCallback(() => {
    if (!scrollArea.current) return;
    positions.current[scrollKey] = scrollArea.current.scrollTop;
    if (doc.path) persistScroll(doc.path, scrollArea.current.scrollTop);
  }, [doc.path, scrollKey]);

  const navigateToDoc = useCallback(
    (id: string, recordHistory = true) => {
      saveCurrentScroll();
      setActiveId(id);
      if (mode === "source") setMode("read");
      setTocOpen(false);
      setOpenMobile(false);
      if (recordHistory) {
        setNav(prev => {
          const base = prev.items.slice(0, prev.index + 1);
          if (base[base.length - 1] === id) return prev;
          const items = [...base, id].slice(-40);
          return { items, index: items.length - 1 };
        });
      }
    },
    [mode, saveCurrentScroll, setOpenMobile],
  );

  const goBack = useCallback(() => {
    for (let i = nav.index - 1; i >= 0; i--) {
      const target = nav.items[i];
      if (documents.some(d => d.id === target)) {
        setNav(prev => ({ ...prev, index: i }));
        navigateToDoc(target, false);
        return;
      }
    }
  }, [documents, nav, navigateToDoc]);

  const goForward = useCallback(() => {
    for (let i = nav.index + 1; i < nav.items.length; i++) {
      const target = nav.items[i];
      if (documents.some(d => d.id === target)) {
        setNav(prev => ({ ...prev, index: i }));
        navigateToDoc(target, false);
        return;
      }
    }
  }, [documents, nav, navigateToDoc]);

  const openFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || importing.current) return;
      importing.current = true;
      setBusy(true);
      try {
        const next: Doc[] = [];
        const nextAssets: Record<string, string> = {};
        let ignored = 0;
        for (const file of files) {
          if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(file.name)) {
            if (file.size > 20 * 1024 * 1024) { toast.error(copy.errors.imageTooLarge(file.name)); continue; }
            const url = URL.createObjectURL(file);
            urls.current.push(url);
            nextAssets[file.name] = url;
            continue;
          }
          if (!/\.(md|markdown|mdown|txt)$/i.test(file.name)) { ignored++; continue; }
          if (file.size > 2 * 1024 * 1024) { toast.error(copy.errors.fileTooLarge(file.name)); continue; }
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let content: string;
            let encoding = "UTF-8";
            if (bytes[0] === 255 && bytes[1] === 254) { content = new TextDecoder("utf-16le").decode(bytes); encoding = "UTF-16 LE"; }
            else if (bytes[0] === 254 && bytes[1] === 255) { content = new TextDecoder("utf-16be").decode(bytes); encoding = "UTF-16 BE"; }
            else {
              try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
              catch { content = new TextDecoder("gb18030").decode(bytes); encoding = "GB18030"; }
            }
            if (content.includes("\u0000")) { toast.error(copy.errors.invalidText(file.name)); continue; }
            next.push({ id: crypto.randomUUID(), name: file.name, content: content.replace(/\r\n?/g, "\n"), encoding });
          } catch {
            toast.error(copy.errors.readFailed(file.name));
          }
        }
        if (Object.keys(nextAssets).length) setAssets(old => ({ ...old, ...nextAssets }));
        if (next.length) {
          saveCurrentScroll();
          setDocuments(old => [...old, ...next]);
          navigateToDoc(next[0].id, true);
          toast.success(copy.success.opened(next.length));
        } else if (Object.keys(nextAssets).length) toast.success(copy.success.assetsAdded(Object.keys(nextAssets).length));
        if (ignored) toast.info(copy.errors.unsupported(ignored));
      } finally {
        importing.current = false;
        setBusy(false);
      }
    },
    [copy, navigateToDoc, saveCurrentScroll],
  );

  const chooseFiles = useCallback(() => {
    if (desktop) void desktop.openFiles().catch(error => toast.error(String(error)));
    else fileInput.current?.click();
  }, []);

  const chooseFolder = useCallback(async () => {
    if (!desktop) return;
    try {
      const listing = await desktop.openFolder();
      if (listing) {
        setFolder(listing);
        if (listing.files.length) {
          toast.success(`Opened folder "${listing.name}" (${listing.files.length} files${listing.truncated ? "+" : ""})`);
        } else {
          toast.info(`No Markdown files found in "${listing.name}".`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const toggleFocus = useCallback(() => {
    setFocus(!focus);
    setOpen(focus);
    setOpenMobile(false);
  }, [focus, setOpen, setOpenMobile]);

  const toggleLiveWatch = useCallback(async () => {
    if (!desktop) return;
    try {
      const res = await desktop.setLiveWatch(!liveWatch);
      setLiveWatch(res.liveWatch);
      toast.info(res.liveWatch ? "Live watch enabled." : "Live watch paused.");
    } catch (error) {
      toast.error(String(error));
    }
  }, [liveWatch]);

  const togglePin = useCallback(async () => {
    if (!desktop) return;
    try {
      const res = await desktop.setAlwaysOnTop(!alwaysOnTop);
      setAlwaysOnTop(res.alwaysOnTop);
    } catch (error) {
      toast.error(String(error));
    }
  }, [alwaysOnTop]);

  const exportPdf = useCallback(async () => {
    if (!desktop) return;
    try {
      // Force any off-screen lazy Mermaid diagrams to render before capturing PDF.
      window.dispatchEvent(new Event("inkglass-prepare-print"));
      for (let i = 0; i < 15; i++) {
        if (!document.querySelector(".diagram-loading")) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const res = await desktop.exportPdf(displayName);
      if (res?.ok) toast.success(copy.success.pdfExported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [copy.success.pdfExported, displayName]);

  const copyQuoteCitation = useCallback(async () => {
    const selection = window.getSelection()?.toString().trim() || "";
    const currentHeadingTitle = headings.find(h => h.id === activeHeading)?.title;
    const text = selection || currentHeadingTitle || displayName;
    const formatted = formatMarkdownCitation(text, displayName, currentHeadingTitle);
    if (!formatted) return;
    try {
      await copyText(formatted);
      toast.success(copy.success.citationCopied);
    } catch {
      toast.error(copy.errors.copyFailed);
    }
  }, [activeHeading, copy.errors.copyFailed, copy.success.citationCopied, displayName, headings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!desktop && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); fileInput.current?.click(); }
      if (e.key === "Escape" && focus) { setFocus(false); setOpen(true); }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); goForward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, goBack, goForward, setOpen]);

  const jumpTo = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target || !scrollArea.current) return;
    scrollArea.current.scrollTo({
      top: scrollArea.current.scrollTop + target.getBoundingClientRect().top - scrollArea.current.getBoundingClientRect().top - 42,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    setActiveHeading(id);
    setTocOpen(false);
  }, []);

  useEffect(() => {
    const area = scrollArea.current;
    if (!area || mode === "source") {
      setHeadings([]);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const nodes = [...(article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") || [])];
      setHeadings(nodes.map(el => ({ id: el.id, title: el.textContent || copy.toc.untitled, level: Number(el.tagName[1]) })));
      if (pendingFragment.current) {
        const frag = pendingFragment.current;
        pendingFragment.current = "";
        const targetId = document.getElementById(frag) ? frag : "md-" + frag;
        if (document.getElementById(targetId)) {
          jumpTo(targetId);
          return;
        }
      }
      area.scrollTop = positions.current[scrollKey] || 0;
      update();
    });
    let scheduled = false;
    function update() {
      if (!area) return;
      const total = area.scrollHeight - area.clientHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, Math.round((area.scrollTop / total) * 100))) : 100);
      const nodes = article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
      let selected = nodes?.[0]?.id || "";
      const edge = area.getBoundingClientRect().top + 150;
      nodes?.forEach(el => { if (el.getBoundingClientRect().top <= edge) selected = el.id; });
      setActiveHeading(selected);
      scheduled = false;
    }
    const onScroll = () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    };
    area.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    if (article.current) observer.observe(article.current);
    observer.observe(area);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [copy.toc.untitled, doc.id, doc.content, jumpTo, mode, scrollKey]);

  const handleLink = useCallback(
    (href: string) => {
      if (href.startsWith("#")) {
        let id = href.slice(1);
        try { id = decodeURIComponent(id); } catch {}
        jumpTo(document.getElementById(id) ? id : "md-" + id);
        return;
      }
      if (desktop && doc.nativeId) {
        void desktop.openLinked(doc.nativeId, href).catch(error => {
          toast.error(error instanceof Error ? error.message : copy.errors.missingDocument);
        });
        return;
      }
      let targetPath = href.split("#")[0];
      try { targetPath = decodeURIComponent(targetPath); } catch {}
      const name = targetPath.split("/").pop();
      const found = documents.find(d => d.name === name);
      if (found) navigateToDoc(found.id, true);
      else toast.info(copy.errors.missingDocument);
    },
    [copy.errors.missingDocument, doc.nativeId, documents, jumpTo, navigateToDoc],
  );

  const closeDoc = useCallback(
    (id: string) => {
      if (id === activeId) saveCurrentScroll();
      const target = documents.find(d => d.id === id);
      if (desktop && target?.nativeId) {
        void desktop.closeFile(target.nativeId).catch(() => {});
      }
      const next = documents.filter(d => d.id !== id);
      const nextDocs = next.length ? next : samples;
      const nextActive = id === activeId ? nextDocs[0]?.id || "welcome" : activeId;
      setDocuments(nextDocs);
      if (id === activeId) {
        setActiveId(nextActive);
        if (mode === "source") setMode("read");
      }
      setNav(prev => {
        const alive = new Set(nextDocs.map(d => d.id));
        const filtered: string[] = [];
        for (const item of prev.items) {
          if (alive.has(item) && filtered[filtered.length - 1] !== item) filtered.push(item);
        }
        if (!filtered.length) return { items: [nextActive], index: 0 };
        const idx = filtered.lastIndexOf(nextActive);
        if (idx >= 0) return { items: filtered, index: idx };
        const appended = [...filtered, nextActive].slice(-40);
        return { items: appended, index: appended.length - 1 };
      });
      setLiveUpdates(old => {
        if (!old[id]) return old;
        const copyMap = { ...old };
        delete copyMap[id];
        return copyMap;
      });
    },
    [activeId, documents, mode, saveCurrentScroll],
  );

  const activeLiveUpdate = liveUpdates[doc.id] || null;

  const jumpToNextChange = useCallback(() => {
    if (!activeLiveUpdate) return;
    const changedEls = [...(article.current?.querySelectorAll<HTMLElement>('[data-changed="true"]') || [])];
    if (!changedEls.length) return;
    const target = changedEls[changeCursor % changedEls.length];
    setChangeCursor(c => c + 1);
    if (target.id) jumpTo(target.id);
    else target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLiveUpdate, changeCursor, jumpTo]);

  const nativeActions = useRef<(action: NativeAction) => void>(() => {});
  nativeActions.current = action => {
    if (action === "paste") setPasteOpen(true);
    if (action === "open-folder") void chooseFolder();
    if (action === "export-pdf") void exportPdf();
    if (action === "watch-on") setLiveWatch(true);
    if (action === "watch-off") setLiveWatch(false);
    if (action === "pin-on") setAlwaysOnTop(true);
    if (action === "pin-off") setAlwaysOnTop(false);
    if (action === "find") {
      setFindOpen(true);
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>(".desktop-find input");
        input?.focus();
        input?.select();
      });
    }
    if (action === "focus") toggleFocus();
    if (action === "close") closeDoc(activeId);
    if (action === "reload") {
      if (doc.nativeId) {
        saveCurrentScroll();
        void desktop?.reloadFile(doc.nativeId).catch(error => toast.error(String(error)));
      } else toast.info("Open a local file to reload it.");
    }
  };

  const docsRef = useRef(documents);
  docsRef.current = documents;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const jumpToRef = useRef(jumpTo);
  jumpToRef.current = jumpTo;

  useEffect(() => {
    if (!desktop) return;
    const unsubscribeDocuments = desktop.onDocuments(batch => {
      if (!batch.length) return;
      if (scrollArea.current) {
        const cur = docsRef.current.find(d => d.id === activeIdRef.current);
        if (cur) {
          positions.current[cur.path || cur.id] = scrollArea.current.scrollTop;
          if (cur.path) persistScroll(cur.path, scrollArea.current.scrollTop);
        }
      }
      const incoming = batch.map(item => ({ ...item, nativeId: item.id }));
      setDocuments(old => {
        const next = [...old];
        for (const item of incoming) {
          const index = next.findIndex(existing => existing.id === item.id);
          if (index < 0) next.push(item);
          else next[index] = item;
        }
        return next;
      });
      if (batch[0].fragment) {
        const frag = batch[0].fragment;
        if (incoming[0].id === activeIdRef.current) {
          requestAnimationFrame(() => {
            const targetId = document.getElementById(frag) ? frag : "md-" + frag;
            if (document.getElementById(targetId)) jumpToRef.current(targetId);
          });
        } else {
          pendingFragment.current = frag;
        }
      }
      setActiveId(incoming[0].id);
      setNav(prev => {
        const base = prev.items.slice(0, prev.index + 1);
        if (base[base.length - 1] === incoming[0].id) return prev;
        const items = [...base, incoming[0].id].slice(-40);
        return { items, index: items.length - 1 };
      });
      setOpenMobile(false);
    });

    const unsubscribeUpdated = desktop.onDocumentUpdated(updated => {
      if (scrollArea.current) {
        const cur = docsRef.current.find(d => d.id === activeIdRef.current);
        if (cur) {
          positions.current[cur.path || cur.id] = scrollArea.current.scrollTop;
          if (cur.path) persistScroll(cur.path, scrollArea.current.scrollTop);
        }
      }
      const existing = docsRef.current.find(d => d.id === updated.id);
      const diff = existing ? diffDocumentSections(existing.content, updated.content) : null;
      setDocuments(old => old.map(item => (item.id === updated.id ? { ...item, ...updated, nativeId: updated.id } : item)));
      if (diff && diff.changedCount > 0) {
        setLiveUpdates(old => ({
          ...old,
          [updated.id]: {
            docId: updated.id,
            changedCount: diff.changedCount,
            changedHeadings: diff.changedHeadings,
            updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        }));
        if (updated.id === activeIdRef.current) setChangeCursor(0);
      }
    });

    const unsubscribeActions = desktop.onAction(action => nativeActions.current(action));
    const unsubscribeErrors = desktop.onError(message => toast.error(message));
    void desktop
      .ready()
      .then(info => {
        if (typeof info.liveWatch === "boolean") setLiveWatch(info.liveWatch);
        if (typeof info.alwaysOnTop === "boolean") setAlwaysOnTop(info.alwaysOnTop);
      })
      .catch(error => toast.error(String(error)));

    const onBeforeUnload = () => {
      if (!scrollArea.current) return;
      const cur = docsRef.current.find(d => d.id === activeIdRef.current);
      if (cur?.path) persistScroll(cur.path, scrollArea.current.scrollTop);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      unsubscribeDocuments();
      unsubscribeUpdated();
      unsubscribeActions();
      unsubscribeErrors();
    };
  }, [setOpenMobile]);

  const openText = useCallback(
    (content: string, name: string = "") => {
      if (!content.trim()) throw new Error(copy.errors.emptyPaste);
      if (new Blob([content]).size > 2 * 1024 * 1024) throw new Error(copy.errors.pasteTooLarge);
      const title = name.trim().slice(0, 120) || content.match(/^#\s+(.+)$/m)?.[1]?.slice(0, 60) || copy.paste.defaultName;
      const next = { id: crypto.randomUUID(), name: /\.(md|markdown|txt)$/i.test(title) ? title : `${title}.md`, content: content.replace(/\r\n?/g, "\n"), encoding: "UTF-8" };
      saveCurrentScroll();
      setDocuments(old => [...old, next]);
      navigateToDoc(next.id, true);
      return { id: next.id, name: next.name };
    },
    [copy, navigateToDoc, saveCurrentScroll],
  );

  const openTextRef = useRef(openText);
  useEffect(() => { openTextRef.current = openText; }, [openText]);
  useEffect(() => {
    type Context = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "open_markdown_text",
            title: copy.modelContext.title,
            description: copy.modelContext.description,
            inputSchema: { type: "object", properties: { content: { type: "string" }, name: { type: "string", maxLength: 120 } }, required: ["content"], additionalProperties: false },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute(input) {
              if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(copy.modelContext.inputError);
              const args = input as Record<string, unknown>;
              if (Object.keys(args).some(key => !["content", "name"].includes(key)) || typeof args.content !== "string" || (args.name !== undefined && (typeof args.name !== "string" || args.name.length > 120))) {
                throw new Error(copy.modelContext.argumentError);
              }
              let result: { id: string; name: string } | undefined;
              flushSync(() => { result = openTextRef.current(args.content as string, args.name as string | undefined); });
              return { ...result, status: "opened", persistence: "current_page_only" };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [copy]);

  const readPaste = () => {
    try {
      openText(pasteText, pasteName);
      setPasteOpen(false);
      setPasteText("");
      setPasteName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.errors.readFailed(copy.paste.title));
    }
  };

  const activeChangedHeadings = activeLiveUpdate ? activeLiveUpdate.changedHeadings : [];
  const docIdSet = useMemo(() => new Set(documents.map(d => d.id)), [documents]);
  const canBack = nav.items.slice(0, nav.index).some(id => docIdSet.has(id));
  const canForward = nav.items.slice(nav.index + 1).some(id => docIdSet.has(id));

  const toc = (
    <nav aria-label={copy.toc.title} className="toc-links">
      {headings.length ? (
        headings.map(h => (
          <button
            key={h.id}
            className={`toc-link level-${h.level} ${activeHeading === h.id ? "current" : ""} ${activeChangedHeadings.includes(h.title) ? "is-changed" : ""}`}
            style={{ paddingLeft: `${Math.max(0, h.level - 2) * 12 + 16}px` }}
            onClick={() => jumpTo(h.id)}
            title={h.title}
          >
            {h.title}
          </button>
        ))
      ) : (
        <p className="toc-empty">{mode === "source" ? copy.toc.sourceHint : copy.toc.empty}</p>
      )}
    </nav>
  );

  return (
    <div
      className={`reader-app ${focus ? "focus-mode" : ""}`}
      onDragEnter={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); depth.current++; setDragging(true); } }}
      onDragLeave={e => { e.preventDefault(); depth.current--; if (depth.current <= 0) setDragging(false); }}
      onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={e => { e.preventDefault(); depth.current = 0; setDragging(false); if (!desktop) void openFiles(Array.from(e.dataTransfer.files)); }}
    >
      <input ref={fileInput} type="file" accept={accepted} multiple className="sr-only" aria-label={copy.aria.fileInput} onChange={e => { void openFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <Sidebar className="file-sidebar">
        <SidebarHeader className="brand-area">
          <div className="brand">
            <div className="brand-symbol"><BookOpen size={22} strokeWidth={1.6} /><span /></div>
            <div>
              <strong>{copy.brand.name}<span className="brand-dot">.</span></strong>
              <small>{copy.brand.english}</small>
              <em>{copy.brand.descriptor}</em>
            </div>
            <button className="mobile-close icon-button" onClick={() => setOpenMobile(false)} aria-label={copy.actions.closeSidebar}><X size={18} /></button>
          </div>
          <Button className="open-file-button" onClick={chooseFiles} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={17} /> : <Plus size={18} />}
            <span>{busy ? copy.actions.readingFile : copy.actions.openFile}</span>
            <kbd>{desktop ? "Ctrl O" : "⌘ / Ctrl O"}</kbd>
          </Button>
          <div className="sidebar-secondary-actions">
            {desktop && (
              <button type="button" className="paste-button" onClick={() => void chooseFolder()}>
                <Folder size={15} />
                {copy.actions.openFolder}
              </button>
            )}
            <button type="button" className="paste-button" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste size={15} />
              {copy.actions.pasteText}
            </button>
          </div>
        </SidebarHeader>
        <SidebarContent className="file-list-area">
          <div className="section-label">{copy.sidebar.reading}<span>{documents.filter(d => !d.sample).length}</span></div>
          <SidebarMenu>
            {documents
              .filter(d => !d.sample)
              .map(d => (
                <SidebarMenuItem key={d.id}>
                  <SidebarMenuButton className="file-item" isActive={d.id === activeId} onClick={() => navigateToDoc(d.id, true)} title={d.path || d.name}>
                    <FileText size={17} />
                    <span>{d.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction className="file-close" showOnHover onClick={() => closeDoc(d.id)} aria-label={copy.actions.closeDocument(d.name)}>
                    <X size={13} />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
          {!documents.some(d => !d.sample) && !folder && (
            <div className="files-empty">
              <FolderOpen size={24} strokeWidth={1.25} />
              <p>{copy.sidebar.emptyTitle}</p>
              <span>{copy.sidebar.emptyHint}</span>
            </div>
          )}
          {folder && (
            <>
              <div className="section-label folder-label" title={folder.root}>
                <span>{copy.sidebar.folder}: {folder.name}</span>
                <span>{folder.files.length}{folder.truncated ? "+" : ""}</span>
              </div>
              <SidebarMenu>
                {folder.files.map(entry => (
                  <SidebarMenuItem key={entry.path}>
                    <SidebarMenuButton
                      className="file-item folder-file-item"
                      isActive={doc.path === entry.path}
                      onClick={() => { if (desktop) void desktop.openFolderFile(entry.path).catch(err => toast.error(String(err))); }}
                      title={entry.relativePath}
                    >
                      <FileText size={15} />
                      <span>{entry.relativePath}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </>
          )}
          <div className="section-label sample-label">{copy.sidebar.startHere}</div>
          <SidebarMenu>
            {documents
              .filter(d => d.sample)
              .map(d => (
                <SidebarMenuItem key={d.id}>
                  <SidebarMenuButton className="file-item sample-file" isActive={d.id === activeId} onClick={() => navigateToDoc(d.id, true)} title={d.name}>
                    {d.id === "welcome" ? <BookOpen size={17} /> : <FileCode2 size={17} />}
                    <span>{d.id === "welcome" ? copy.sidebar.sampleNames.welcome : copy.sidebar.sampleNames.guide}</span>
                    {d.id === activeId && <span className="active-mark" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={13} /><span>{copy.sidebar.localPrivacy}</span></div>
          <div className="sidebar-bottom-row">
            <span className="version-label">{copy.sidebar.version}</span>
            <div className="theme-controls">
              {([
                { value: "light", label: copy.settings.themes.light, icon: Sun },
                { value: "dark", label: copy.settings.themes.dark, icon: Moon },
                { value: "system", label: copy.settings.themes.system, icon: Monitor },
              ] as const).map(t => (
                <IconButton key={t.value} label={t.label} active={preferences.theme === t.value} onClick={() => setPreferences(p => ({ ...p, theme: t.value }))}>
                  <t.icon size={15} />
                </IconButton>
              ))}
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="reader-main">
        <Tabs
          className="reader-tabs"
          value={mode}
          onValueChange={value => {
            if (mode !== "source") saveCurrentScroll();
            setMode(value as "read" | "split" | "source");
          }}
        >
          <header className="topbar">
            <div className="file-breadcrumb">
              <IconButton label={copy.actions.toggleSidebar} onClick={() => { if (focus) { setFocus(false); setOpen(true); } else toggleSidebar(); }}>
                <PanelLeft size={18} />
              </IconButton>
              <IconButton label={copy.actions.back} disabled={!canBack} onClick={goBack}>
                <ArrowLeft size={16} />
              </IconButton>
              <IconButton label={copy.actions.forward} disabled={!canForward} onClick={goForward}>
                <ArrowRight size={16} />
              </IconButton>
              <span className="breadcrumb-divider" />
              <span className="breadcrumb-parent">{doc.sample ? copy.breadcrumb.guide : copy.breadcrumb.documents}</span>
              <ChevronRight size={14} className="breadcrumb-chevron" />
              <span className="current-filename" title={doc.path || displayName}>{displayName}</span>
            </div>
            <div className="reading-tools">
              <TabsList className="view-tabs" aria-label={copy.tabs.aria}>
                <TabsTrigger value="read"><BookOpen size={15} /><span>{copy.tabs.read}</span></TabsTrigger>
                <TabsTrigger value="split"><Columns2 size={15} /><span>{copy.tabs.split}</span></TabsTrigger>
                <TabsTrigger value="source"><FileCode2 size={15} /><span>{copy.tabs.source}</span></TabsTrigger>
              </TabsList>
              <span className="tools-divider" />
              {desktop && doc.nativeId && (
                <IconButton label={liveWatch ? copy.actions.liveWatchOn : copy.actions.liveWatchOff} active={liveWatch} className={liveWatch ? "live-watch-active" : ""} onClick={() => void toggleLiveWatch()}>
                  <Radio size={16} />
                </IconButton>
              )}
              {desktop && (
                <IconButton label="Find text (Ctrl+F)" active={findOpen} onClick={() => setFindOpen(!findOpen)}>
                  <Search size={17} />
                </IconButton>
              )}
              {doc.nativeId && (
                <IconButton label="Reload file (F5)" onClick={() => nativeActions.current("reload")}>
                  <RefreshCw size={16} />
                </IconButton>
              )}
              <IconButton label={copy.actions.copyCitation} onClick={() => void copyQuoteCitation()}>
                <Quote size={16} />
              </IconButton>
              {desktop && (
                <IconButton label={copy.actions.exportPdf} onClick={() => void exportPdf()}>
                  <Printer size={16} />
                </IconButton>
              )}
              {desktop && (
                <IconButton label={alwaysOnTop ? copy.actions.pinOn : copy.actions.pinOff} active={alwaysOnTop} onClick={() => void togglePin()}>
                  <Pin size={16} />
                </IconButton>
              )}
              <Popover>
                <PopoverTrigger asChild><button className="type-trigger icon-button" aria-label={copy.actions.settings}>Aa</button></PopoverTrigger>
                <PopoverContent className="reader-settings" align="end">
                  <h2>{copy.settings.title}</h2>
                  <div className="setting-label"><span>{copy.settings.fontSize}</span><span>{preferences.size}px</span></div>
                  <Slider aria-label={copy.settings.bodyFontSize} min={14} max={24} step={1} value={[preferences.size]} onValueChange={([size]) => setPreferences(p => ({ ...p, size }))} />
                  <div className="setting-label"><span>{copy.settings.lineHeight}</span><span>{preferences.line.toFixed(2)}</span></div>
                  <Slider aria-label={copy.settings.bodyLineHeight} min={1.5} max={2.4} step={0.05} value={[preferences.line]} onValueChange={([line]) => setPreferences(p => ({ ...p, line }))} />
                  <div className="setting-row">
                    <label htmlFor="font-choice">{copy.settings.font}</label>
                    <Select value={preferences.font} onValueChange={font => setPreferences(p => ({ ...p, font }))}>
                      <SelectTrigger id="font-choice"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sans">{copy.settings.fonts.sans}</SelectItem><SelectItem value="serif">{copy.settings.fonts.serif}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="setting-row">
                    <label htmlFor="width-choice">{copy.settings.width}</label>
                    <Select value={preferences.width} onValueChange={width => setPreferences(p => ({ ...p, width }))}>
                      <SelectTrigger id="width-choice"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">{copy.settings.widths.compact}</SelectItem>
                        <SelectItem value="comfortable">{copy.settings.widths.comfortable}</SelectItem>
                        <SelectItem value="wide">{copy.settings.widths.wide}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="setting-row">
                    <label htmlFor="theme-choice">{copy.settings.theme}</label>
                    <Select value={preferences.theme} onValueChange={(theme: Preferences["theme"]) => setPreferences(p => ({ ...p, theme }))}>
                      <SelectTrigger id="theme-choice"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{copy.settings.themes.light}</SelectItem>
                        <SelectItem value="dark">{copy.settings.themes.dark}</SelectItem>
                        <SelectItem value="system">{copy.settings.themes.system}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <button className="reset-settings" onClick={() => setPreferences(initial)}>{copy.settings.reset}</button>
                </PopoverContent>
              </Popover>
              <IconButton label={focus ? copy.actions.exitFocus : copy.actions.focus} active={focus} onClick={toggleFocus}>
                {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </IconButton>
              <Popover open={tocOpen} onOpenChange={setTocOpen}>
                <PopoverTrigger asChild><button className="icon-button mobile-toc" aria-label={copy.actions.toc}><List size={18} /></button></PopoverTrigger>
                <PopoverContent align="end" className="mobile-toc-popover"><h2>{copy.toc.title}</h2>{toc}</PopoverContent>
              </Popover>
            </div>
          </header>

          {desktop && findOpen && <DesktopFind documentId={doc.id} content={doc.content} mode={mode} onClose={() => setFindOpen(false)} />}

          {activeLiveUpdate && (
            <div className="live-diff-bar" role="status">
              <span className="live-dot-pulse" />
              <span>
                Updated live at {activeLiveUpdate.updatedAt} · {activeLiveUpdate.changedCount} section{activeLiveUpdate.changedCount === 1 ? "" : "s"} changed
              </span>
              {activeLiveUpdate.changedHeadings.length > 0 && (
                <button type="button" className="live-diff-btn" onClick={jumpToNextChange}>
                  <ArrowDown size={13} />
                  <span>Next change</span>
                </button>
              )}
              <button
                type="button"
                className="live-diff-dismiss"
                onClick={() => setLiveUpdates(old => { const next = { ...old }; delete next[doc.id]; return next; })}
                aria-label="Dismiss live update notice"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className={`content-layout ${mode === "split" ? "is-split" : ""}`}>
            <div className="document-scroll" ref={scrollArea}>
              <div className={`document-inner width-${mode === "split" ? "wide" : preferences.width}`} style={{ "--reading-size": `${preferences.size / 16}rem`, "--reading-line": preferences.line } as CSSProperties}>
                <div className="document-meta">
                  <span className="document-kind">{doc.sample ? copy.stats.sampleKind : copy.stats.markdownKind}</span>
                  <span className="meta-rule" />
                  <span><Clock3 size={13} />{copy.stats.minutes(stats.minutes)}</span>
                  <span>{copy.stats.words(stats.count)}</span>
                  {!doc.sample && <span className="local-badge">{copy.stats.localDocument}</span>}
                </div>
                <TabsContent value="read" className="reading-panel">
                  {doc.content.trim() ? (
                    <article className={`markdown-body font-${preferences.font}`} ref={article}>
                      <MarkdownDocument documentId={doc.nativeId} content={doc.content} dark={dark} assets={assets} onLink={handleLink} locale={locale} changedHeadings={activeChangedHeadings} />
                    </article>
                  ) : (
                    <article ref={article} className="empty-document">
                      <FileText size={34} strokeWidth={1.2} />
                      <h1>{copy.empty.title}</h1>
                      <p>{copy.empty.description}</p>
                      <Button onClick={chooseFiles}>{copy.actions.openFileShort}</Button>
                    </article>
                  )}
                  <div className="document-end"><span /><BookOpen size={15} /><span /></div>
                  <p className="end-note">{copy.stats.end}</p>
                </TabsContent>
                <TabsContent value="split" className="split-panel">
                  <div className="split-pane-rendered reading-panel">
                    <article className={`markdown-body font-${preferences.font}`} ref={mode === "split" ? article : undefined}>
                      <MarkdownDocument documentId={doc.nativeId} content={doc.content} dark={dark} assets={assets} onLink={handleLink} locale={locale} changedHeadings={activeChangedHeadings} />
                    </article>
                  </div>
                  <div className="split-pane-source source-panel">
                    <div className="source-heading">
                      <span>{copy.stats.sourceTitle}</span>
                      <button onClick={async () => { try { await copyText(doc.content); toast.success(copy.success.copied); } catch { toast.error(copy.errors.copyFailed); } }}>
                        {copy.actions.copyAll}
                      </button>
                    </div>
                    <pre tabIndex={0} aria-label={copy.aria.source}>{doc.content || copy.empty.source}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="source" className="source-panel">
                  <div className="source-heading">
                    <span>{copy.stats.sourceTitle}</span>
                    <button onClick={async () => { try { await copyText(doc.content); toast.success(copy.success.copied); } catch { toast.error(copy.errors.copyFailed); } }}>
                      {copy.actions.copyAll}
                    </button>
                  </div>
                  <pre tabIndex={0} aria-label={copy.aria.source}>{doc.content || copy.empty.source}</pre>
                </TabsContent>
              </div>
            </div>
            {!focus && mode === "read" && (
              <aside className="toc-sidebar">
                <div className="toc-title"><AlignLeft size={16} /><h2>{copy.toc.title}</h2></div>
                {toc}
                <div className="toc-tip"><Keyboard size={16} /><span>{copy.toc.shortcutLabel}<br /><small>{copy.toc.findText}</small></span></div>
                <button className="back-to-top" onClick={() => scrollArea.current?.scrollTo({ top: 0, behavior: "smooth" })}><ArrowUp size={14} />{copy.actions.backToTop}</button>
              </aside>
            )}
          </div>

          <footer className="reading-status">
            <div>
              <span className="format-indicator">MD</span>
              <span>{doc.encoding || "UTF-8"}</span>
              {desktop && doc.nativeId && <span className="live-indicator">{liveWatch ? "LIVE WATCH" : "MANUAL RELOAD"}</span>}
              <span className="footer-tip">{focus ? copy.actions.exitFocus : copy.stats.dropHint}</span>
            </div>
            <div className="reading-progress">
              <span>{mode === "source" ? copy.stats.sourceView : mode === "split" ? copy.stats.splitView : `${progress}%`}</span>
              {mode === "read" && <Progress value={progress} aria-label={copy.aria.progress} className="progress-bar" />}
            </div>
          </footer>
        </Tabs>
      </main>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="paste-dialog">
          <DialogHeader>
            <DialogTitle>{copy.paste.title}</DialogTitle>
            <DialogDescription>{copy.paste.description}</DialogDescription>
          </DialogHeader>
          <label htmlFor="paste-name">{copy.paste.name} <span>{copy.paste.optional}</span></label>
          <Input id="paste-name" value={pasteName} onChange={e => setPasteName(e.target.value)} placeholder={copy.paste.namePlaceholder} maxLength={120} />
          <label htmlFor="paste-content">{copy.paste.content}</label>
          <Textarea id="paste-content" className="paste-textarea" placeholder={copy.paste.contentPlaceholder} value={pasteText} onChange={e => setPasteText(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={readPaste} disabled={!pasteText.trim()}>{copy.actions.startReading}<ChevronRight size={16} /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dragging && (
        <div className="drop-overlay">
          <FolderOpen size={48} strokeWidth={1.2} />
          <h2>{copy.drop.title}</h2>
          <p>{copy.drop.description}</p>
        </div>
      )}
      <Toaster position="bottom-center" theme={dark ? "dark" : "light"} richColors closeButton />
    </div>
  );
}
