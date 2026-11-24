"use client";

import { copyText } from "@/lib/clipboard";
import { disambiguateDocLabels, extractCleanText, formatRelativeToRoot } from "@/lib/clean-text";
import { computeLineDiff, diffDocumentSections, extractHeadingLines, type DiffLine } from "@/lib/live-diff";
import { formatMarkdownCitation } from "@/lib/citations";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import {
  AlignLeft,
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Clock3,
  Columns2,
  Compass,
  Copy,
  Eye,
  FileCode2,
  FileDiff,
  FileText,
  Folder,
  FolderOpen,
  Hash,
  History,
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
import { desktop, type FolderListing, type NativeAction, type RecentEntry } from "@/lib/desktop";
import { DesktopFind } from "@/components/desktop-find";
import { MarkdownDocument } from "@/components/markdown-document";
import { welcome, formatGuide } from "@/lib/demo";
import { copies, type Locale } from "@/lib/i18n";

type Doc = { id: string; name: string; content: string; sample?: boolean; encoding?: string; nativeId?: string; path?: string };
type Heading = { id: string; title: string; level: number; headingIndex: number };
type Preferences = { theme: "light" | "dark" | "system"; size: number; line: number; width: string; font: string };
type NavEntry = { docId: string; scrollTop?: number; headingId?: string };
type LiveUpdateBanner = {
  docId: string;
  changedCount: number;
  changedHeadings: string[];
  changedSectionIndices: number[];
  addedLines: number;
  removedLines: number;
  hunks: DiffLine[];
  truncated: boolean;
  appendedAtEof: boolean;
  updatedAt: string;
};
type QuickJumpItem = {
  key: string;
  kind: "heading" | "doc" | "folder" | "recent";
  label: string;
  subtitle?: string;
  badge: string;
  searchText: string;
  onSelect: () => void;
};

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
  const [findSeed, setFindSeed] = useState<{ text: string; seq: number }>({ text: "", seq: 0 });
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [liveWatch, setLiveWatch] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [folder, setFolder] = useState<FolderListing | null>(null);
  const [folderRevision, setFolderRevision] = useState(0);
  const [folderFilter, setFolderFilter] = useState("");
  const [folderSort, setFolderSort] = useState<"name" | "recent">("name");
  const [liveUpdates, setLiveUpdates] = useState<Record<string, LiveUpdateBanner>>({});
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [followLive, setFollowLive] = useState(false);
  const [changeCursor, setChangeCursor] = useState(0);
  const [nav, setNav] = useState<{ items: NavEntry[]; index: number }>({ items: [{ docId: "welcome" }], index: 0 });
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState("");
  const [quickJumpIndex, setQuickJumpIndex] = useState(0);
  const [recentFiles, setRecentFiles] = useState<RecentEntry[]>([]);
  const [copiedPath, setCopiedPath] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const article = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const splitSourceRef = useRef<HTMLDivElement>(null);
  const quickJumpInputRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const depth = useRef(0);
  const importing = useRef(false);
  const positions = useRef<Record<string, number>>(loadSavedScrolls());
  const pendingFragment = useRef<string>("");
  const pendingScrollTop = useRef<number | null>(null);
  const diffBaselinesRef = useRef<Record<string, string>>({});
  const followLiveRef = useRef(false);
  followLiveRef.current = followLive;

  const doc = documents.find(d => d.id === activeId) || documents[0];
  const scrollKey = doc.path || doc.id;
  const displayName = doc.sample ? (doc.id === "welcome" ? copy.sidebar.sampleNames.welcome : copy.sidebar.sampleNames.guide) : doc.name;
  const dark = preferences.theme === "dark" || (preferences.theme === "system" && systemDark);

  const openedDocs = useMemo(() => documents.filter(d => !d.sample), [documents]);
  const docLabels = useMemo(() => disambiguateDocLabels(openedDocs), [openedDocs]);
  const breadcrumbLabel = useMemo(() => {
    if (doc.sample) return displayName;
    const rel = doc.path ? formatRelativeToRoot(doc.path, folder?.root) : null;
    if (rel) return rel;
    return docLabels[doc.id] || displayName;
  }, [displayName, doc.id, doc.path, doc.sample, docLabels, folder?.root]);

  const headingLinesInfo = useMemo(() => extractHeadingLines(doc.content), [doc.content]);

  const filteredFolderFiles = useMemo(() => {
    if (!folder) return [];
    const tokens = folderFilter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = tokens.length
      ? folder.files.filter(entry => {
          const hay = entry.relativePath.toLowerCase();
          return tokens.every(tok => hay.includes(tok));
        })
      : [...folder.files];
    if (folderSort === "recent") {
      list.sort((a, b) => b.modifiedAt - a.modifiedAt || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: "base" }));
    } else {
      list.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: "base" }));
    }
    return list;
  }, [folder, folderFilter, folderSort]);

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
  useEffect(() => { setDiffDrawerOpen(false); }, [activeId]);
  useEffect(() => {
    if (!copiedPath) return;
    const t = setTimeout(() => setCopiedPath(false), 1600);
    return () => clearTimeout(t);
  }, [copiedPath]);

  const saveCurrentScroll = useCallback(() => {
    if (!scrollArea.current) return;
    positions.current[scrollKey] = scrollArea.current.scrollTop;
    if (doc.path) persistScroll(doc.path, scrollArea.current.scrollTop);
  }, [doc.path, scrollKey]);

  const navigateToDoc = useCallback(
    (id: string, recordHistory = true) => {
      saveCurrentScroll();
      setActiveId(id);
      setTocOpen(false);
      setOpenMobile(false);
      if (recordHistory) {
        setNav(prev => {
          const base = prev.items.slice(0, prev.index + 1);
          const last = base[base.length - 1];
          if (last && last.docId === id && !last.headingId) return prev;
          const items = [...base, { docId: id }].slice(-40);
          return { items, index: items.length - 1 };
        });
      }
    },
    [saveCurrentScroll, setOpenMobile],
  );

  const findArticleAnchor = useCallback((rawId: string): HTMLElement | null => {
    const root = article.current;
    if (!root || !rawId) return null;
    if (rawId.startsWith("__heading_index__:")) {
      const rawIdx = rawId.slice("__heading_index__:".length);
      if (/^\d+$/.test(rawIdx)) {
        return root.querySelector<HTMLElement>(`[data-heading-index="${rawIdx}"]`);
      }
      return null;
    }
    const candidates = rawId.startsWith("md-") ? [rawId] : ["md-" + rawId, rawId];
    for (const candidate of candidates) {
      const byId = document.getElementById(candidate);
      if (byId && root.contains(byId)) return byId;
    }
    return null;
  }, []);

  const jumpTo = useCallback(
    (id: string) => {
      const target = findArticleAnchor(id);
      if (!target || !scrollArea.current) return;
      scrollArea.current.scrollTo({
        top: scrollArea.current.scrollTop + target.getBoundingClientRect().top - scrollArea.current.getBoundingClientRect().top - 42,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
      if (target.id) setActiveHeading(target.id);
      setTocOpen(false);
    },
    [findArticleAnchor],
  );

  const restoreNavEntry = useCallback(
    (entry: NavEntry, targetIndex: number) => {
      setNav(prev => ({ ...prev, index: targetIndex }));
      if (entry.docId === activeId) {
        if (entry.headingId) {
          if (mode === "source") {
            pendingFragment.current = entry.headingId;
            pendingScrollTop.current = typeof entry.scrollTop === "number" ? entry.scrollTop : null;
            setMode("read");
          } else if (findArticleAnchor(entry.headingId)) {
            jumpTo(entry.headingId);
          } else if (typeof entry.scrollTop === "number" && scrollArea.current) {
            scrollArea.current.scrollTo({
              top: entry.scrollTop,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
            });
          }
        } else if (typeof entry.scrollTop === "number") {
          if (mode === "source") {
            pendingScrollTop.current = entry.scrollTop;
            pendingFragment.current = "";
            setMode("read");
          } else if (scrollArea.current) {
            scrollArea.current.scrollTo({
              top: entry.scrollTop,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
            });
          }
        }
        return;
      }
      if (entry.headingId) {
        pendingFragment.current = entry.headingId;
        pendingScrollTop.current = typeof entry.scrollTop === "number" ? entry.scrollTop : null;
      } else if (typeof entry.scrollTop === "number") {
        pendingScrollTop.current = entry.scrollTop;
        pendingFragment.current = "";
      }
      navigateToDoc(entry.docId, false);
    },
    [activeId, findArticleAnchor, jumpTo, mode, navigateToDoc],
  );

  const goBack = useCallback(() => {
    for (let i = nav.index - 1; i >= 0; i--) {
      const target = nav.items[i];
      if (documents.some(d => d.id === target.docId)) {
        restoreNavEntry(target, i);
        return;
      }
    }
  }, [documents, nav, restoreNavEntry]);

  const goForward = useCallback(() => {
    for (let i = nav.index + 1; i < nav.items.length; i++) {
      const target = nav.items[i];
      if (documents.some(d => d.id === target.docId)) {
        restoreNavEntry(target, i);
        return;
      }
    }
  }, [documents, nav, restoreNavEntry]);

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
        setFolderFilter("");
        setFolderRevision(v => v + 1);
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

  const refreshFolder = useCallback(async () => {
    if (!desktop || !folder) return;
    try {
      const listing = await desktop.refreshFolder();
      if (listing) {
        setFolder(listing);
        setFolderRevision(v => v + 1);
        toast.success(`Refreshed "${listing.name}" (${listing.files.length} files${listing.truncated ? "+" : ""})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [folder]);

  const closeFolderDrawer = useCallback(async () => {
    if (!desktop) return;
    try {
      await desktop.closeFolder();
      setFolder(null);
      setFolderFilter("");
      setFolderRevision(v => v + 1);
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
    if (!doc.content.trim()) {
      toast.info("This document is empty — nothing to export.");
      return;
    }
    const previousMode = mode;
    try {
      if (previousMode === "source") {
        flushSync(() => setMode("read"));
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
      }
      // Force any off-screen lazy Mermaid diagrams and lazy images to load before capturing PDF.
      window.dispatchEvent(new Event("inkglass-prepare-print"));
      const lazyImages = [...document.querySelectorAll<HTMLImageElement>('article img[loading="lazy"]')];
      lazyImages.forEach(img => { img.loading = "eager"; });
      const allImages = [...document.querySelectorAll<HTMLImageElement>("article img")];
      if (allImages.length) {
        const imageWait = Promise.allSettled(
          allImages.map(img => {
            if (img.complete) {
              return typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve();
            }
            return new Promise<void>(resolve => {
              const finish = () => {
                if (typeof img.decode === "function") void img.decode().catch(() => {}).finally(resolve);
                else resolve();
              };
              img.addEventListener("load", finish, { once: true });
              img.addEventListener("error", finish, { once: true });
            });
          }),
        );
        await Promise.race([imageWait, new Promise<void>(resolve => setTimeout(resolve, 2000))]);
      }
      const diagramDeadline = Date.now() + 2000;
      while (document.querySelector(".diagram-loading") && Date.now() < diagramDeadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const res = await desktop.exportPdf(displayName);
      if (res?.ok) toast.success(copy.success.pdfExported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      if (previousMode === "source") {
        setMode("source");
      }
    }
  }, [copy.success.pdfExported, displayName, doc.content, mode]);

  const copyQuoteCitation = useCallback(async () => {
    const sel = window.getSelection();
    let selection = "";
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const ancestorEl =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const insideKatex = ancestorEl?.closest(".katex-display, .katex");
      if (insideKatex) {
        selection = extractCleanText(insideKatex, "markdown").trim();
      } else {
        const frag = range.cloneContents();
        if (frag.querySelector(".katex, .katex-mathml, .katex-copy-tex")) {
          selection = extractCleanText(frag, "markdown").trim();
        } else {
          selection = sel.toString().trim();
        }
      }
    }
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

  const openFindBar = useCallback(() => {
    const rawSel = window.getSelection()?.toString().trim() || "";
    const seedText = rawSel && !rawSel.includes("\n") && rawSel.length <= 200 ? rawSel : "";
    setFindSeed(prev => ({ text: seedText, seq: prev.seq + 1 }));
    setFindOpen(true);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(".desktop-find input");
      input?.focus();
      input?.select();
    });
  }, []);

  const openQuickJump = useCallback(() => {
    setQuickJumpQuery("");
    setQuickJumpIndex(0);
    setQuickJumpOpen(true);
    if (desktop) {
      void desktop.getRecent().then(setRecentFiles).catch(() => {});
    }
    requestAnimationFrame(() => {
      quickJumpInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!desktop && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openQuickJump();
      }
      if (!desktop && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copyQuoteCitation();
      }
      if (e.key === "Escape" && focus) { setFocus(false); setOpen(true); }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); goForward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyQuoteCitation, focus, goBack, goForward, openQuickJump, setOpen]);

  // Auto-scroll active TOC link inside .toc-sidebar without disturbing document scroll.
  useEffect(() => {
    if (!activeHeading) return;
    const sidebar = document.querySelector<HTMLElement>(".toc-sidebar");
    const current = sidebar?.querySelector<HTMLElement>(".toc-link.current");
    if (!sidebar || !current) return;
    const sRect = sidebar.getBoundingClientRect();
    const cRect = current.getBoundingClientRect();
    if (cRect.top < sRect.top + 16) {
      sidebar.scrollTop -= sRect.top + 16 - cRect.top;
    } else if (cRect.bottom > sRect.bottom - 16) {
      sidebar.scrollTop += cRect.bottom - (sRect.bottom - 16);
    }
  }, [activeHeading]);

  useEffect(() => {
    const area = scrollArea.current;
    if (!area || mode === "source") {
      setHeadings([]);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const nodes = [...(article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") || [])].filter(
        el => !el.closest("blockquote, li"),
      );
      setHeadings(
        nodes.map(el => {
          const rawIdx = el.getAttribute("data-heading-index");
          const parsedIdx = rawIdx !== null ? Number(rawIdx) : -1;
          return {
            id: el.id,
            title: extractCleanText(el, "plain").replace(/\s+/g, " ").trim() || copy.toc.untitled,
            level: Number(el.tagName[1]),
            headingIndex: Number.isInteger(parsedIdx) ? parsedIdx : -1,
          };
        }),
      );
      if (pendingFragment.current) {
        const frag = pendingFragment.current;
        pendingFragment.current = "";
        const targetEl = findArticleAnchor(frag);
        if (targetEl) {
          pendingScrollTop.current = null;
          jumpTo(targetEl.id || frag);
          return;
        }
      }
      if (pendingScrollTop.current !== null) {
        area.scrollTop = pendingScrollTop.current;
        pendingScrollTop.current = null;
      } else {
        area.scrollTop = positions.current[scrollKey] || 0;
      }
      update();
    });
    let scheduled = false;
    function update() {
      if (!area) return;
      const total = area.scrollHeight - area.clientHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, Math.round((area.scrollTop / total) * 100))) : 100);
      const rawNodes = article.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
      const topNodes = rawNodes ? [...rawNodes].filter(el => !el.closest("blockquote, li")) : [];
      let selected = topNodes[0]?.id || "";
      const edge = area.getBoundingClientRect().top + 150;
      topNodes.forEach(el => { if (el.getBoundingClientRect().top <= edge) selected = el.id; });
      setActiveHeading(selected);

      // One-way heading-aligned scroll sync from rendered pane to sticky source pane in Split view.
      if (mode === "split" && splitSourceRef.current) {
        const sourceEl = splitSourceRef.current;
        const maxSource = sourceEl.scrollHeight - sourceEl.clientHeight;
        if (maxSource > 0) {
          let ratio = total > 0 ? area.scrollTop / total : 0;
          const hLines = headingLinesInfo.headings;
          const domHeadings = topNodes.filter(el => {
            const raw = el.getAttribute("data-heading-index");
            return raw !== null && Number.isInteger(Number(raw)) && Number(raw) >= 0;
          });
          if (hLines.length > 0 && domHeadings.length > 0) {
            const areaTop = area.getBoundingClientRect().top + 80;
            let curDomIdx = -1;
            for (let i = 0; i < domHeadings.length; i++) {
              if (domHeadings[i].getBoundingClientRect().top <= areaTop) curDomIdx = i;
              else break;
            }
            if (curDomIdx < 0) {
              const firstTop = domHeadings[0].getBoundingClientRect().top - areaTop;
              const firstHIdx = Number(domHeadings[0].getAttribute("data-heading-index"));
              const firstLine = hLines[firstHIdx]?.line ?? 0;
              const scrolled = Math.max(0, area.scrollTop);
              const span = Math.max(1, scrolled + firstTop);
              const targetLine = (scrolled / span) * firstLine;
              ratio = targetLine / Math.max(1, headingLinesInfo.totalLines);
            } else {
              const curHIdx = Number(domHeadings[curDomIdx].getAttribute("data-heading-index"));
              const curLine = hLines[curHIdx]?.line ?? 0;
              const nextDom = domHeadings[curDomIdx + 1];
              const nextHIdx = nextDom ? Number(nextDom.getAttribute("data-heading-index")) : -1;
              const nextLine = nextHIdx >= 0 && hLines[nextHIdx] ? hLines[nextHIdx].line : headingLinesInfo.totalLines;
              const curTop = domHeadings[curDomIdx].getBoundingClientRect().top - areaTop;
              const nextTop = nextDom
                ? nextDom.getBoundingClientRect().top - areaTop
                : (article.current?.getBoundingClientRect().bottom ?? areaTop + 1) - areaTop;
              const span = Math.max(1, nextTop - curTop);
              const frac = Math.min(1, Math.max(0, -curTop / span));
              const targetLine = curLine + frac * Math.max(0, nextLine - curLine);
              ratio = targetLine / Math.max(1, headingLinesInfo.totalLines);
            }
          }
          sourceEl.scrollTop = Math.round(Math.min(1, Math.max(0, ratio)) * maxSource);
        }
      }
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
  }, [copy.toc.untitled, doc.id, doc.content, findArticleAnchor, headingLinesInfo, jumpTo, mode, scrollKey]);

  const handleLink = useCallback(
    (href: string) => {
      if (href.startsWith("#")) {
        let id = href.slice(1);
        try { id = decodeURIComponent(id); } catch {}
        const targetEl = findArticleAnchor(id);
        const targetId = targetEl?.id || (id.startsWith("md-") ? id : "md-" + id);
        if (targetEl && scrollArea.current) {
          const currentScroll = scrollArea.current.scrollTop;
          const targetScroll = Math.max(
            0,
            scrollArea.current.scrollTop + targetEl.getBoundingClientRect().top - scrollArea.current.getBoundingClientRect().top - 42,
          );
          setNav(prev => {
            const base = prev.items.slice(0, prev.index + 1);
            const updatedBase = [...base];
            if (updatedBase.length > 0 && updatedBase[updatedBase.length - 1].docId === doc.id) {
              updatedBase[updatedBase.length - 1] = { docId: doc.id, scrollTop: currentScroll };
            } else {
              updatedBase.push({ docId: doc.id, scrollTop: currentScroll });
            }
            const items = [...updatedBase, { docId: doc.id, headingId: targetId, scrollTop: targetScroll }].slice(-40);
            return { items, index: items.length - 1 };
          });
        }
        jumpTo(targetId);
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
    [copy.errors.missingDocument, doc.id, doc.nativeId, documents, findArticleAnchor, jumpTo, navigateToDoc],
  );

  const closeDoc = useCallback(
    (id: string) => {
      if (id === activeId) saveCurrentScroll();
      const target = documents.find(d => d.id === id);
      if (desktop && target?.nativeId) {
        void desktop.closeFile(target.nativeId).catch(() => {});
      }
      delete diffBaselinesRef.current[id];
      const next = documents.filter(d => d.id !== id);
      const nextDocs = next.length ? next : samples;
      const nextActive = id === activeId ? nextDocs[0]?.id || "welcome" : activeId;
      setDocuments(nextDocs);
      if (id === activeId) {
        setActiveId(nextActive);
      }
      setNav(prev => {
        const alive = new Set(nextDocs.map(d => d.id));
        const filtered: NavEntry[] = [];
        for (const item of prev.items) {
          if (!alive.has(item.docId)) continue;
          const prevItem = filtered[filtered.length - 1];
          if (prevItem && prevItem.docId === item.docId && !prevItem.headingId && !item.headingId) continue;
          filtered.push(item);
        }
        if (!filtered.length) return { items: [{ docId: nextActive }], index: 0 };
        let idx = -1;
        for (let i = filtered.length - 1; i >= 0; i--) {
          if (filtered[i].docId === nextActive) { idx = i; break; }
        }
        if (idx >= 0) return { items: filtered, index: idx };
        const appended = [...filtered, { docId: nextActive }].slice(-40);
        return { items: appended, index: appended.length - 1 };
      });
      setLiveUpdates(old => {
        if (!old[id]) return old;
        const copyMap = { ...old };
        delete copyMap[id];
        return copyMap;
      });
    },
    [activeId, documents, saveCurrentScroll],
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

  const dismissLiveUpdate = useCallback(() => {
    diffBaselinesRef.current[doc.id] = doc.content;
    setDiffDrawerOpen(false);
    setLiveUpdates(old => {
      if (!old[doc.id]) return old;
      const next = { ...old };
      delete next[doc.id];
      return next;
    });
  }, [doc.content, doc.id]);

  const copyFilePath = useCallback(async () => {
    if (!doc.path) return;
    try {
      await copyText(doc.path);
      setCopiedPath(true);
      toast.success("Copied file path");
    } catch {
      toast.error(copy.errors.copyFailed);
    }
  }, [copy.errors.copyFailed, doc.path]);

  const nativeActions = useRef<(action: NativeAction) => void>(() => {});
  nativeActions.current = action => {
    if (action === "paste") setPasteOpen(true);
    if (action === "open-folder") void chooseFolder();
    if (action === "export-pdf") void exportPdf();
    if (action === "copy-citation") void copyQuoteCitation();
    if (action === "quick-jump") openQuickJump();
    if (action === "watch-on") setLiveWatch(true);
    if (action === "watch-off") setLiveWatch(false);
    if (action === "pin-on") setAlwaysOnTop(true);
    if (action === "pin-off") setAlwaysOnTop(false);
    if (action === "find") openFindBar();
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

    const applyDiffForDoc = (docId: string, prevContent: string | undefined, nextContent: string, isActive: boolean, fromLiveWatch: boolean) => {
      if (!(docId in diffBaselinesRef.current)) {
        diffBaselinesRef.current[docId] = prevContent ?? nextContent;
      }
      const baseline = diffBaselinesRef.current[docId];
      if (nextContent === baseline) {
        setLiveUpdates(old => {
          if (!old[docId]) return old;
          const next = { ...old };
          delete next[docId];
          return next;
        });
        return;
      }
      const secDiff = diffDocumentSections(baseline, nextContent);
      const lineDiff = computeLineDiff(baseline, nextContent);
      if (secDiff.changedCount > 0 || lineDiff.addedLines > 0 || lineDiff.removedLines > 0) {
        setLiveUpdates(old => ({
          ...old,
          [docId]: {
            docId,
            changedCount: secDiff.changedCount,
            changedHeadings: secDiff.changedHeadings,
            changedSectionIndices: secDiff.changedSectionIndices,
            addedLines: lineDiff.addedLines,
            removedLines: lineDiff.removedLines,
            hunks: lineDiff.hunks,
            truncated: lineDiff.truncated,
            appendedAtEof: lineDiff.appendedAtEof,
            updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        }));
        if (isActive) {
          setChangeCursor(0);
          if (fromLiveWatch && followLiveRef.current) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (lineDiff.appendedAtEof && lineDiff.removedLines === 0 && scrollArea.current) {
                  scrollArea.current.scrollTo({
                    top: scrollArea.current.scrollHeight,
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                  });
                  return;
                }
                const firstChanged = article.current?.querySelector<HTMLElement>('[data-changed="true"]');
                if (firstChanged?.id) {
                  jumpToRef.current(firstChanged.id);
                } else if (firstChanged) {
                  firstChanged.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              });
            });
          }
        }
      }
    };

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
      for (const item of incoming) {
        const existing = docsRef.current.find(d => d.id === item.id);
        if (!existing) {
          diffBaselinesRef.current[item.id] = item.content;
        } else if (existing.content !== item.content) {
          applyDiffForDoc(item.id, existing.content, item.content, item.id === activeIdRef.current || item.id === incoming[0].id, false);
        }
      }
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
        const last = base[base.length - 1];
        if (last && last.docId === incoming[0].id && !last.headingId) return prev;
        const items = [...base, { docId: incoming[0].id }].slice(-40);
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
      setDocuments(old => old.map(item => (item.id === updated.id ? { ...item, ...updated, nativeId: updated.id } : item)));
      applyDiffForDoc(updated.id, existing?.content, updated.content, updated.id === activeIdRef.current, true);
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

  const quickJumpItems = useMemo<QuickJumpItem[]>(() => {
    const items: QuickJumpItem[] = [];
    const seenPaths = new Set<string>();

    // 1. Current document headings (derived from source lines when in Source mode)
    const activeHeadings: Heading[] =
      mode === "source"
        ? headingLinesInfo.headings.map(h => ({
            id: `__heading_index__:${h.index}`,
            title: h.title || copy.toc.untitled,
            level: h.level,
            headingIndex: h.index,
          }))
        : headings;

    for (const h of activeHeadings) {
      items.push({
        key: `heading:${h.id}:${h.headingIndex}`,
        kind: "heading",
        label: h.title,
        subtitle: displayName,
        badge: `H${h.level}`,
        searchText: `${h.title} h${h.level}`.toLowerCase(),
        onSelect: () => {
          if (mode === "source") {
            pendingFragment.current = h.id;
            setMode("read");
          } else {
            jumpTo(h.id);
          }
        },
      });
    }

    // 2. Opened documents (local + sample)
    for (const d of documents) {
      if (d.path) seenPaths.add(d.path.toLowerCase());
      const label = d.sample
        ? d.id === "welcome"
          ? copy.sidebar.sampleNames.welcome
          : copy.sidebar.sampleNames.guide
        : docLabels[d.id] || d.name;
      items.push({
        key: `doc:${d.id}`,
        kind: "doc",
        label,
        subtitle: d.path || (d.sample ? "Built-in guide" : "Pasted document"),
        badge: d.id === activeId ? "Current" : "Open",
        searchText: `${label} ${d.name} ${d.path || ""}`.toLowerCase(),
        onSelect: () => navigateToDoc(d.id, true),
      });
    }

    // 3. Active folder files
    if (folder) {
      for (const entry of folder.files) {
        if (seenPaths.has(entry.path.toLowerCase())) continue;
        seenPaths.add(entry.path.toLowerCase());
        items.push({
          key: `folder:${entry.path}`,
          kind: "folder",
          label: entry.relativePath,
          subtitle: folder.name,
          badge: "Folder",
          searchText: `${entry.relativePath} ${entry.name}`.toLowerCase(),
          onSelect: () => {
            if (desktop) void desktop.openFolderFile(entry.path).catch(err => toast.error(String(err)));
          },
        });
      }
    }

    // 4. Recent files (main process validates target is inside state.recent)
    if (desktop) {
      for (const rec of recentFiles) {
        if (seenPaths.has(rec.path.toLowerCase())) continue;
        seenPaths.add(rec.path.toLowerCase());
        items.push({
          key: `recent:${rec.path}`,
          kind: "recent",
          label: rec.name,
          subtitle: rec.dir,
          badge: "Recent",
          searchText: `${rec.name} ${rec.dir} ${rec.path}`.toLowerCase(),
          onSelect: () => {
            if (desktop) void desktop.openRecent(rec.path).catch(err => toast.error(String(err)));
          },
        });
      }
    }

    const tokens = quickJumpQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return items.slice(0, 60);
    return items.filter(item => tokens.every(tok => item.searchText.includes(tok))).slice(0, 60);
  }, [
    activeId,
    copy.sidebar.sampleNames.guide,
    copy.sidebar.sampleNames.welcome,
    copy.toc.untitled,
    displayName,
    docLabels,
    documents,
    folder,
    headingLinesInfo,
    headings,
    jumpTo,
    mode,
    navigateToDoc,
    quickJumpQuery,
    recentFiles,
  ]);

  useEffect(() => {
    setQuickJumpIndex(0);
  }, [quickJumpQuery, quickJumpOpen]);

  useEffect(() => {
    if (!quickJumpOpen) return;
    const activeEl = document.querySelector<HTMLElement>('.quick-jump-item[data-selected="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [quickJumpIndex, quickJumpOpen]);

  const executeQuickJump = (item?: QuickJumpItem) => {
    if (!item) return;
    setQuickJumpOpen(false);
    item.onSelect();
  };

  const activeChangedHeadings = activeLiveUpdate ? activeLiveUpdate.changedHeadings : [];
  const activeChangedIndices = activeLiveUpdate ? activeLiveUpdate.changedSectionIndices : [];
  const activeChangedIndexSet = useMemo(() => new Set(activeChangedIndices), [activeChangedIndices]);
  const docIdSet = useMemo(() => new Set(documents.map(d => d.id)), [documents]);
  const canBack = nav.items.slice(0, nav.index).some(item => docIdSet.has(item.docId));
  const canForward = nav.items.slice(nav.index + 1).some(item => docIdSet.has(item.docId));

  const toc = (
    <nav aria-label={copy.toc.title} className="toc-links">
      {headings.length ? (
        headings.map(h => {
          const isChanged =
            activeChangedIndexSet.size > 0
              ? activeChangedIndexSet.has(h.headingIndex)
              : activeChangedHeadings.includes(h.title);
          return (
            <button
              key={`${h.id}-${h.headingIndex}`}
              className={`toc-link level-${h.level} ${activeHeading === h.id ? "current" : ""} ${isChanged ? "is-changed" : ""}`}
              style={{ paddingLeft: `${Math.max(0, h.level - 2) * 12 + 16}px` }}
              onClick={() => jumpTo(h.id)}
              title={h.title}
            >
              {h.title}
            </button>
          );
        })
      ) : (
        <p className="toc-empty">{mode === "source" ? copy.toc.sourceHint : copy.toc.empty}</p>
      )}
    </nav>
  );

  return (
    <div
      className={`reader-app ${focus ? "focus-mode" : ""} ${mode === "split" ? "is-split-mode" : ""}`}
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
          <div className="section-label">{copy.sidebar.reading}<span>{openedDocs.length}</span></div>
          <SidebarMenu>
            {openedDocs.map(d => {
              const hasUnreadDiff = d.id !== activeId && Boolean(liveUpdates[d.id]);
              return (
                <SidebarMenuItem key={d.id}>
                  <SidebarMenuButton className="file-item" isActive={d.id === activeId} onClick={() => navigateToDoc(d.id, true)} title={d.path || d.name}>
                    <FileText size={17} />
                    <span>{docLabels[d.id] || d.name}</span>
                    {hasUnreadDiff && <span className="unread-diff-dot" title="Updated on disk" aria-label="Updated on disk" />}
                  </SidebarMenuButton>
                  <SidebarMenuAction className="file-close" showOnHover onClick={() => closeDoc(d.id)} aria-label={copy.actions.closeDocument(d.name)}>
                    <X size={13} />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          {!openedDocs.length && !folder && (
            <div className="files-empty">
              <FolderOpen size={24} strokeWidth={1.25} />
              <p>{copy.sidebar.emptyTitle}</p>
              <span>{copy.sidebar.emptyHint}</span>
            </div>
          )}
          {folder && (
            <>
              <div className="section-label folder-label" title={folder.root}>
                <span className="folder-title-text">{copy.sidebar.folder}: {folder.name}</span>
                <div className="folder-header-actions">
                  <span className="folder-count">{filteredFolderFiles.length}{folder.truncated ? "+" : ""}</span>
                  <button
                    type="button"
                    className="folder-action-btn"
                    aria-label="Refresh folder"
                    title="Refresh folder"
                    onClick={() => void refreshFolder()}
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    type="button"
                    className="folder-action-btn"
                    aria-label="Close folder"
                    title="Close folder"
                    onClick={() => void closeFolderDrawer()}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="folder-controls">
                <input
                  type="text"
                  className="folder-filter-input"
                  value={folderFilter}
                  onChange={e => setFolderFilter(e.target.value)}
                  placeholder="Filter files…"
                  aria-label="Filter folder files"
                />
                <button
                  type="button"
                  className="folder-sort-btn"
                  aria-label="Sort folder files"
                  title={folderSort === "name" ? "Sorted A–Z (click for Recent)" : "Sorted by Recent (click for A–Z)"}
                  onClick={() => setFolderSort(s => (s === "name" ? "recent" : "name"))}
                >
                  <ArrowDownUp size={11} />
                  <span>{folderSort === "name" ? "A–Z" : "Recent"}</span>
                </button>
              </div>
              <SidebarMenu>
                {filteredFolderFiles.length ? (
                  filteredFolderFiles.map(entry => (
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
                  ))
                ) : (
                  <p className="folder-empty-filter">No matching files</p>
                )}
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
              <span className="current-filename" title={doc.path || displayName}>{breadcrumbLabel}</span>
              {doc.path && (
                <button
                  type="button"
                  className="copy-path-btn"
                  aria-label="Copy file path"
                  title="Copy full file path"
                  onClick={() => void copyFilePath()}
                >
                  {copiedPath ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
            <div className="reading-tools">
              <TabsList className="view-tabs" aria-label={copy.tabs.aria}>
                <TabsTrigger value="read"><BookOpen size={15} /><span>{copy.tabs.read}</span></TabsTrigger>
                <TabsTrigger value="split"><Columns2 size={15} /><span>{copy.tabs.split}</span></TabsTrigger>
                <TabsTrigger value="source"><FileCode2 size={15} /><span>{copy.tabs.source}</span></TabsTrigger>
              </TabsList>
              <span className="tools-divider" />
              <IconButton label="Quick jump (Ctrl+K)" onClick={openQuickJump}>
                <Compass size={16} />
              </IconButton>
              {desktop && doc.nativeId && (
                <IconButton label={liveWatch ? copy.actions.liveWatchOn : copy.actions.liveWatchOff} active={liveWatch} className={liveWatch ? "live-watch-active" : ""} onClick={() => void toggleLiveWatch()}>
                  <Radio size={16} />
                </IconButton>
              )}
              {desktop && (
                <IconButton label="Find text (Ctrl+F)" active={findOpen} onClick={() => { if (findOpen) setFindOpen(false); else openFindBar(); }}>
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

          {desktop && findOpen && <DesktopFind documentId={doc.id} content={doc.content} mode={mode} seed={findSeed} onClose={() => setFindOpen(false)} />}

          {activeLiveUpdate && (
            <>
              <div className="live-diff-bar" role="status">
                <span className="live-dot-pulse" />
                <span className="live-diff-summary">
                  Updated at {activeLiveUpdate.updatedAt} ·{" "}
                  <strong className="diff-stat-add">+{activeLiveUpdate.addedLines}</strong> /{" "}
                  <strong className="diff-stat-del">-{activeLiveUpdate.removedLines}</strong> lines
                  {activeLiveUpdate.changedCount > 0 && (
                    <> · {activeLiveUpdate.changedCount} section{activeLiveUpdate.changedCount === 1 ? "" : "s"} changed</>
                  )}
                </span>
                <div className="live-diff-actions">
                  {activeLiveUpdate.hunks.length > 0 && (
                    <button
                      type="button"
                      className={`live-diff-toggle ${diffDrawerOpen ? "is-active" : ""}`}
                      aria-expanded={diffDrawerOpen}
                      onClick={() => setDiffDrawerOpen(v => !v)}
                    >
                      <FileDiff size={13} />
                      <span>{diffDrawerOpen ? "Hide diff" : "Show diff"}</span>
                      {diffDrawerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`live-diff-toggle ${followLive ? "is-active" : ""}`}
                    aria-pressed={followLive}
                    title="Auto-scroll to incoming live edits"
                    onClick={() => setFollowLive(v => !v)}
                  >
                    <Eye size={13} />
                    <span>{followLive ? "Following" : "Follow"}</span>
                  </button>
                  {(activeLiveUpdate.changedSectionIndices.length > 0 || activeLiveUpdate.changedHeadings.length > 0) && (
                    <button type="button" className="live-diff-btn" onClick={jumpToNextChange}>
                      <ArrowDown size={13} />
                      <span>Next change</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="live-diff-dismiss"
                    onClick={dismissLiveUpdate}
                    aria-label="Dismiss live update notice"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {diffDrawerOpen && activeLiveUpdate.hunks.length > 0 && (
                <div className="live-diff-drawer" aria-label="Line-level diff">
                  <pre>
                    {activeLiveUpdate.hunks.map((line, i) => (
                      <div key={i} className={`diff-line diff-line-${line.kind}`}>
                        <span className="diff-gutter">{line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}</span>
                        <span>{line.text || " "}</span>
                      </div>
                    ))}
                  </pre>
                  {activeLiveUpdate.truncated && (
                    <div className="diff-truncated-note">Showing compact preview of a large change set.</div>
                  )}
                </div>
              )}
            </>
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
                      <MarkdownDocument
                        documentId={doc.nativeId}
                        content={doc.content}
                        dark={dark}
                        assets={assets}
                        onLink={handleLink}
                        locale={locale}
                        changedHeadings={activeChangedHeadings}
                        changedSectionIndices={activeChangedIndices}
                        mediaVersion={folderRevision}
                      />
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
                      <MarkdownDocument
                        documentId={doc.nativeId}
                        content={doc.content}
                        dark={dark}
                        assets={assets}
                        onLink={handleLink}
                        locale={locale}
                        changedHeadings={activeChangedHeadings}
                        changedSectionIndices={activeChangedIndices}
                        mediaVersion={folderRevision}
                      />
                    </article>
                  </div>
                  <div className="split-pane-source source-panel" ref={splitSourceRef}>
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

      <Dialog open={quickJumpOpen} onOpenChange={setQuickJumpOpen}>
        <DialogContent className="quick-jump-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Jump</DialogTitle>
            <DialogDescription>Jump to headings, opened documents, folder files, or recent files.</DialogDescription>
          </DialogHeader>
          <div className="quick-jump-input-row">
            <Search size={16} aria-hidden="true" />
            <input
              ref={quickJumpInputRef}
              type="text"
              className="quick-jump-input"
              aria-label="Quick jump search"
              placeholder="Jump to heading, open doc, folder file, or recent…"
              value={quickJumpQuery}
              onChange={e => setQuickJumpQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (quickJumpItems.length) setQuickJumpIndex(i => (i + 1) % quickJumpItems.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (quickJumpItems.length) setQuickJumpIndex(i => (i - 1 + quickJumpItems.length) % quickJumpItems.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  executeQuickJump(quickJumpItems[quickJumpIndex]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setQuickJumpOpen(false);
                }
              }}
            />
          </div>
          <div className="quick-jump-list" role="listbox" aria-label="Quick jump results">
            {quickJumpItems.length ? (
              quickJumpItems.map((item, idx) => (
                <button
                  key={item.key}
                  type="button"
                  role="option"
                  aria-selected={idx === quickJumpIndex}
                  data-selected={idx === quickJumpIndex ? "true" : "false"}
                  className="quick-jump-item"
                  onMouseEnter={() => setQuickJumpIndex(idx)}
                  onClick={() => executeQuickJump(item)}
                >
                  <span className="quick-jump-icon">
                    {item.kind === "heading" ? (
                      <Hash size={14} />
                    ) : item.kind === "folder" ? (
                      <Folder size={14} />
                    ) : item.kind === "recent" ? (
                      <History size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                  </span>
                  <span className="quick-jump-text">
                    <span className="quick-jump-label">{item.label}</span>
                    {item.subtitle && <span className="quick-jump-sub">{item.subtitle}</span>}
                  </span>
                  <span className="quick-jump-badge">{item.badge}</span>
                </button>
              ))
            ) : (
              <div className="quick-jump-empty">No matching headings or documents</div>
            )}
          </div>
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
