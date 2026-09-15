export type Locale = "zh" | "en";

export type LocaleCopy = {
  brand: {name: string; english: string; descriptor: string};
  language: {group: string; chinese: string; english: string};
  actions: {
    openFile: string;
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
    backToTop: string;
    closeDocument: (name: string) => string;
  };
  sidebar: {
    reading: string;
    startHere: string;
    emptyTitle: string;
    emptyHint: string;
    localPrivacy: string;
    version: string;
    sampleNames: {welcome: string; guide: string};
  };
  breadcrumb: {guide: string; documents: string};
  tabs: {read: string; source: string; aria: string};
  settings: {
    title: string;
    fontSize: string;
    lineHeight: string;
    font: string;
    fonts: {sans: string; serif: string};
    width: string;
    widths: {compact: string; comfortable: string; wide: string};
    theme: string;
    themes: {light: string; dark: string; system: string};
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
    dropHint: string;
    sourceTitle: string;
  };
  empty: {title: string; description: string; source: string};
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
  drop: {title: string; description: string};
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
  };
  renderer: {
    copy: string;
    copied: string;
    copyFailed: string;
    missingImage: (alt: string) => string;
    imageAlt: string;
    mermaidError: string;
    mermaidLoading: string;
    mermaidAlt: string;
    mermaidSource: string;
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

export const localeStorageKey = "modu-locale";

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  try {
    const saved = window.localStorage.getItem(localeStorageKey);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const zh: LocaleCopy = {
  brand: {name: "墨读", english: "MoDu Reader", descriptor: "本地 Markdown 阅读器"},
  language: {group: "界面语言", chinese: "中", english: "EN"},
  actions: {
    openFile: "打开文件", readingFile: "正在读取…", pasteText: "粘贴文本", closeSidebar: "关闭文件栏",
    toggleSidebar: "显示或收起文件栏", settings: "阅读设置", focus: "专注模式", exitFocus: "退出专注模式（Esc）",
    toc: "打开文档目录", cancel: "取消", startReading: "开始阅读", openFileShort: "打开文件", copyAll: "复制全文", backToTop: "回到顶部", closeDocument: name => `关闭 ${name}`,
  },
  sidebar: {
    reading: "正在阅读", startHere: "从这里开始", emptyTitle: "你的文档会出现在这里", emptyHint: "支持拖入多个文件",
    localPrivacy: "本地阅读 · 文件不上传", version: "墨读 1.0", sampleNames: {welcome: "欢迎使用墨读", guide: "Markdown 格式速查"},
  },
  breadcrumb: {guide: "阅读指南", documents: "我的文档"},
  tabs: {read: "阅读", source: "源码", aria: "文档显示模式"},
  settings: {
    title: "阅读设置", fontSize: "字号", lineHeight: "行距", font: "字体", fonts: {sans: "现代黑体", serif: "经典宋体"},
    width: "页面宽度", widths: {compact: "紧凑", comfortable: "舒适", wide: "宽阔"}, theme: "主题",
    themes: {light: "浅色", dark: "深色", system: "跟随系统"}, bodyFontSize: "正文字号", bodyLineHeight: "正文行距", reset: "恢复默认设置",
  },
  toc: {title: "本页目录", sourceHint: "切回阅读视图查看目录", empty: "添加标题后，目录会出现在这里", untitled: "未命名标题", shortcutLabel: "Ctrl / ⌘ + F", findText: "查找文中的文字"},
  stats: {
    sampleKind: "READING GUIDE", markdownKind: "MARKDOWN", minutes: value => `约 ${value} 分钟`, words: value => `${value.toLocaleString("zh-CN")} 字 / 词`,
    localDocument: "本地文档", end: "已读至文末", sourceView: "源码视图", dropHint: "拖入文件，即刻阅读",
    sourceTitle: "Markdown 原文",
  },
  empty: {title: "这是一份空白文档", description: "试着打开另一份 Markdown，或粘贴一段文字。", source: "（空白文档）"},
  paste: {
    title: "粘贴 Markdown", description: "把文字放在这里，换一个舒服的方式阅读。", name: "文档名称", optional: "（选填）", defaultName: "粘贴的文档",
    namePlaceholder: "未命名文档.md", content: "Markdown 内容", contentPlaceholder: "# 一份值得读的笔记\n\n在这里粘贴 Markdown 内容…",
  },
  drop: {title: "放下文件，开始阅读", description: "Markdown、文本，或文档中的图片"},
  errors: {
    imageTooLarge: name => `图片 ${name} 超过 20 MB，未打开。`, fileTooLarge: name => `${name} 超过 2 MB，请拆分后打开。`,
    invalidText: name => `${name} 看起来不是文本文件。`, readFailed: name => `无法读取 ${name}，请重新选择文件。`,
    unsupported: count => `已略过 ${count} 个不支持的文件。请选择 Markdown、文本或图片。`, missingDocument: "请先用「打开文件」加入这个本地文档。",
    emptyPaste: "请提供非空的 Markdown 内容。", pasteTooLarge: "文本超过 2 MB，请拆分后阅读。", copyFailed: "无法复制，请手动选择文本。",
  },
  success: {opened: count => `已打开 ${count} 份文档`, assetsAdded: count => `已添加 ${count} 张本地图片`, copied: "已复制全文"},
  renderer: {
    copy: "复制", copied: "已复制", copyFailed: "无法直接复制，请选中代码后复制。", missingImage: alt => `${alt || "图片"} · 图片未找到，可将本地图片一并拖入`,
    imageAlt: "文档图片", mermaidError: "这段 Mermaid 暂时无法绘制，可以展开查看原文。", mermaidLoading: "正在准备图表…", mermaidAlt: "文档中的 Mermaid 图表", mermaidSource: "查看图表源码",
  },
  aria: {fileInput: "选择 Markdown 文件或图片", progress: "阅读进度", source: "Markdown 源码"},
  modelContext: {title: "在墨读中阅读 Markdown", description: "在当前浏览器页面中新建并打开一份临时 Markdown 文档，与粘贴文本按钮一致。刷新后不会保留。", inputError: "需要一个包含 content 的对象。", argumentError: "content 必须是文本，name 为最多 120 字的可选名称。"},
};

const en: LocaleCopy = {
  brand: {name: "墨读", english: "MoDu Reader", descriptor: "Local Markdown reader"},
  language: {group: "Interface language", chinese: "中", english: "EN"},
  actions: {
    openFile: "Open file", readingFile: "Reading…", pasteText: "Paste text", closeSidebar: "Close file sidebar",
    toggleSidebar: "Show or hide file sidebar", settings: "Reading settings", focus: "Focus mode", exitFocus: "Leave focus mode (Esc)",
    toc: "Open document table of contents", cancel: "Cancel", startReading: "Start reading", openFileShort: "Open file", copyAll: "Copy all", backToTop: "Back to top", closeDocument: name => `Close ${name}`,
  },
  sidebar: {
    reading: "Reading", startHere: "Start here", emptyTitle: "Your documents will appear here", emptyHint: "Drop in multiple files",
    localPrivacy: "Local reading · No uploads", version: "MoDu 1.0", sampleNames: {welcome: "Welcome to MoDu", guide: "Markdown quick reference"},
  },
  breadcrumb: {guide: "Reading guide", documents: "My documents"},
  tabs: {read: "Read", source: "Source", aria: "Document display mode"},
  settings: {
    title: "Reading settings", fontSize: "Type size", lineHeight: "Line height", font: "Font", fonts: {sans: "Modern sans", serif: "Classic serif"},
    width: "Page width", widths: {compact: "Compact", comfortable: "Comfortable", wide: "Wide"}, theme: "Theme",
    themes: {light: "Light", dark: "Dark", system: "System"}, bodyFontSize: "Body type size", bodyLineHeight: "Body line height", reset: "Reset to defaults",
  },
  toc: {title: "On this page", sourceHint: "Return to Read view to see the contents", empty: "Headings will appear here", untitled: "Untitled heading", shortcutLabel: "Ctrl / ⌘ + F", findText: "Find text in the document"},
  stats: {
    sampleKind: "READING GUIDE", markdownKind: "MARKDOWN", minutes: value => `${value} min read`, words: value => `${value.toLocaleString("en-US")} words`,
    localDocument: "Local document", end: "End of document", sourceView: "Source view", dropHint: "Drop files in to start reading", sourceTitle: "Markdown source",
  },
  empty: {title: "This document is empty", description: "Open another Markdown file, or paste in some text.", source: "(Empty document)"},
  paste: {
    title: "Paste Markdown", description: "Put your text here and give it a comfortable reading surface.", name: "Document name", optional: "(optional)", defaultName: "Pasted document",
    namePlaceholder: "untitled.md", content: "Markdown content", contentPlaceholder: "# A note worth reading\n\nPaste Markdown here…",
  },
  drop: {title: "Drop files to start reading", description: "Markdown, text, or images from your document"},
  errors: {
    imageTooLarge: name => `Image ${name} is over 20 MB and was not opened.`, fileTooLarge: name => `${name} is over 2 MB. Please split it first.`,
    invalidText: name => `${name} does not look like a text file.`, readFailed: name => `Could not read ${name}. Please choose it again.`,
    unsupported: count => `Skipped ${count} unsupported file${count === 1 ? "" : "s"}. Choose Markdown, text, or images.`, missingDocument: "Open the file first to add this local document.",
    emptyPaste: "Please provide some Markdown content.", pasteTooLarge: "This text is over 2 MB. Please split it first.", copyFailed: "Could not copy. Select the text manually instead.",
  },
  success: {opened: count => `Opened ${count} document${count === 1 ? "" : "s"}`, assetsAdded: count => `Added ${count} local image${count === 1 ? "" : "s"}`, copied: "Copied all"},
  renderer: {
    copy: "Copy", copied: "Copied", copyFailed: "Could not copy directly. Select the code and copy it instead.", missingImage: alt => `${alt || "Image"} · Image not found; drop the local image with the document`,
    imageAlt: "Document image", mermaidError: "This Mermaid diagram could not be rendered. Expand the source to inspect it.", mermaidLoading: "Preparing diagram…", mermaidAlt: "Mermaid diagram in the document", mermaidSource: "View diagram source",
  },
  aria: {fileInput: "Choose Markdown files or images", progress: "Reading progress", source: "Markdown source"},
  modelContext: {title: "Read Markdown in MoDu Reader", description: "Create and open a temporary Markdown document in the current browser page, just like the paste button. It will not survive a refresh.", inputError: "An object containing content is required.", argumentError: "content must be text; name is an optional name of up to 120 characters."},
};

export const copies: Record<Locale, LocaleCopy> = {zh, en};
