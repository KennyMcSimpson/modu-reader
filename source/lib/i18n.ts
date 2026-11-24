export type Locale = "en";

export type LocaleCopy = {
  brand: { name: string; english: string; descriptor: string };
  actions: {
    openFile: string;
    openFolder: string;
    readingFile: string;
    pasteText: string;
    closeSidebar: string;
    toggleSidebar: string;
    settings: string;
    focus: string;
    exitFocus: string;
    toc: string;
    cancel: string;
    startReading: string;
    openFileShort: string;
    copyAll: string;
    copyCitation: string;
    exportPdf: string;
    backToTop: string;
    back: string;
    forward: string;
    liveWatchOn: string;
    liveWatchOff: string;
    pinOn: string;
    pinOff: string;
    closeDocument: (name: string) => string;
  };
  sidebar: {
    reading: string;
    folder: string;
    startHere: string;
    emptyTitle: string;
    emptyHint: string;
    localPrivacy: string;
    version: string;
    sampleNames: { welcome: string; guide: string };
  };
  breadcrumb: { guide: string; documents: string };
  tabs: { read: string; split: string; source: string; aria: string };
  settings: {
    title: string;
    fontSize: string;
    lineHeight: string;
    font: string;
    fonts: { sans: string; serif: string };
    width: string;
    widths: { compact: string; comfortable: string; wide: string };
    theme: string;
    themes: { light: string; dark: string; system: string };
    bodyFontSize: string;
    bodyLineHeight: string;
    reset: string;
  };
  toc: {
    title: string;
    sourceHint: string;
    empty: string;
    untitled: string;
    shortcutLabel: string;
    findText: string;
  };
  stats: {
    sampleKind: string;
    markdownKind: string;
    minutes: (value: number) => string;
    words: (value: number) => string;
    localDocument: string;
    end: string;
    sourceView: string;
    splitView: string;
    dropHint: string;
    sourceTitle: string;
  };
  empty: { title: string; description: string; source: string };
  paste: {
    title: string;
    description: string;
    name: string;
    optional: string;
    defaultName: string;
    namePlaceholder: string;
    content: string;
    contentPlaceholder: string;
  };
  drop: { title: string; description: string };
  errors: {
    imageTooLarge: (name: string) => string;
    fileTooLarge: (name: string) => string;
    invalidText: (name: string) => string;
    readFailed: (name: string) => string;
    unsupported: (count: number) => string;
    missingDocument: string;
    emptyPaste: string;
    pasteTooLarge: string;
    copyFailed: string;
  };
  success: {
    opened: (count: number) => string;
    assetsAdded: (count: number) => string;
    copied: string;
    citationCopied: string;
    texCopied: string;
    svgCopied: string;
    tableCopied: (fmt: string) => string;
    pdfExported: string;
  };
  renderer: {
    copy: string;
    copied: string;
    copyFailed: string;
    copyTex: string;
    copySvg: string;
    copyCsv: string;
    copyTsv: string;
    zoomDiagram: string;
    missingImage: (alt: string) => string;
    imageAlt: string;
    mermaidError: string;
    mermaidLoading: string;
    mermaidAlt: string;
    mermaidSource: string;
    metadataTitle: string;
  };
  aria: {
    fileInput: string;
    progress: string;
    source: string;
  };
  modelContext: {
    title: string;
    description: string;
    inputError: string;
    argumentError: string;
  };
};

export const localeStorageKey = "inkglass-locale";

export function getInitialLocale(): Locale {
  return "en";
}

const en: LocaleCopy = {
  brand: { name: "Inkglass", english: "Inkglass", descriptor: "Living Markdown Reader" },
  actions: {
    openFile: "Open file",
    openFolder: "Open folder",
    readingFile: "Reading…",
    pasteText: "Paste text",
    closeSidebar: "Close file sidebar",
    toggleSidebar: "Show or hide file sidebar",
    settings: "Reading settings",
    focus: "Focus mode",
    exitFocus: "Leave focus mode (Esc)",
    toc: "Open document table of contents",
    cancel: "Cancel",
    startReading: "Start reading",
    openFileShort: "Open file",
    copyAll: "Copy all",
    copyCitation: "Copy quote with citation",
    exportPdf: "Export PDF (Ctrl+P)",
    backToTop: "Back to top",
    back: "Back (Alt+Left)",
    forward: "Forward (Alt+Right)",
    liveWatchOn: "Live watch enabled (auto-reloads external edits)",
    liveWatchOff: "Live watch paused (click to enable)",
    pinOn: "Pinned on top (Ctrl+Shift+T)",
    pinOff: "Keep window on top (Ctrl+Shift+T)",
    closeDocument: name => `Close ${name}`,
  },
  sidebar: {
    reading: "Reading",
    folder: "Folder",
    startHere: "Start here",
    emptyTitle: "Your documents will appear here",
    emptyHint: "Drop files or open a folder",
    localPrivacy: "Read-only · Zero repo pollution",
    version: "Inkglass 2.2",
    sampleNames: { welcome: "Welcome to Inkglass", guide: "Markdown quick reference" },
  },
  breadcrumb: { guide: "Reading guide", documents: "Documents" },
  tabs: { read: "Read", split: "Split", source: "Source", aria: "Document display mode" },
  settings: {
    title: "Reading settings",
    fontSize: "Type size",
    lineHeight: "Line height",
    font: "Font",
    fonts: { sans: "Modern sans", serif: "Classic serif" },
    width: "Page width",
    widths: { compact: "Compact", comfortable: "Comfortable", wide: "Wide" },
    theme: "Theme",
    themes: { light: "Light", dark: "Dark", system: "System" },
    bodyFontSize: "Body type size",
    bodyLineHeight: "Body line height",
    reset: "Reset to defaults",
  },
  toc: {
    title: "On this page",
    sourceHint: "Switch to Read or Split view to browse contents",
    empty: "Headings will appear here",
    untitled: "Untitled heading",
    shortcutLabel: "Ctrl + F",
    findText: "Find text in the document",
  },
  stats: {
    sampleKind: "READING GUIDE",
    markdownKind: "MARKDOWN",
    minutes: value => `${value} min read`,
    words: value => `${value.toLocaleString("en-US")} words`,
    localDocument: "Read-only local file",
    end: "End of document",
    sourceView: "Source view",
    splitView: "Split view",
    dropHint: "Drop files in · Auto-watches external edits",
    sourceTitle: "Markdown source",
  },
  empty: { title: "This document is empty", description: "Open another Markdown file, open a folder, or paste some text.", source: "(Empty document)" },
  paste: {
    title: "Paste Markdown",
    description: "Paste Markdown text to inspect it in a calm, read-only reading surface.",
    name: "Document name",
    optional: "(optional)",
    defaultName: "Pasted document",
    namePlaceholder: "untitled.md",
    content: "Markdown content",
    contentPlaceholder: "# A note worth reading\n\nPaste Markdown here…",
  },
  drop: { title: "Drop files to start reading", description: "Markdown, text, or images from your document" },
  errors: {
    imageTooLarge: name => `Image ${name} is over 20 MB and was not opened.`,
    fileTooLarge: name => `${name} is over 2 MB. Please split it first.`,
    invalidText: name => `${name} does not look like a text file.`,
    readFailed: name => `Could not read ${name}. Please choose it again.`,
    unsupported: count => `Skipped ${count} unsupported file${count === 1 ? "" : "s"}. Choose Markdown, text, or images.`,
    missingDocument: "Could not resolve that relative Markdown document inside the authorized folder.",
    emptyPaste: "Please provide some Markdown content.",
    pasteTooLarge: "This text is over 2 MB. Please split it first.",
    copyFailed: "Could not copy. Select the text manually instead.",
  },
  success: {
    opened: count => `Opened ${count} document${count === 1 ? "" : "s"}`,
    assetsAdded: count => `Added ${count} local image${count === 1 ? "" : "s"}`,
    copied: "Copied all",
    citationCopied: "Copied Markdown citation",
    texCopied: "Copied raw LaTeX",
    svgCopied: "Copied diagram SVG",
    tableCopied: fmt => `Copied table as ${fmt.toUpperCase()}`,
    pdfExported: "Exported PDF",
  },
  renderer: {
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Could not copy directly. Select the text and copy it instead.",
    copyTex: "TeX",
    copySvg: "Copy SVG",
    copyCsv: "CSV",
    copyTsv: "TSV",
    zoomDiagram: "Zoom",
    missingImage: alt => `${alt || "Image"} · Image not found; drop the local image with the document`,
    imageAlt: "Document image",
    mermaidError: "This Mermaid diagram could not be rendered. Expand the source to inspect it.",
    mermaidLoading: "Preparing diagram…",
    mermaidAlt: "Mermaid diagram in the document",
    mermaidSource: "View diagram source",
    metadataTitle: "Frontmatter",
  },
  aria: { fileInput: "Choose Markdown files or images", progress: "Reading progress", source: "Markdown source" },
  modelContext: {
    title: "Read Markdown in Inkglass",
    description: "Create and open a temporary Markdown document in the current window, just like Paste text. It is read-only and never touches disk.",
    inputError: "An object containing content is required.",
    argumentError: "content must be text; name is an optional name of up to 120 characters.",
  },
};

export const copies: Record<Locale, LocaleCopy> = { en };
