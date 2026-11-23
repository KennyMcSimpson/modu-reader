export type NativeDocument = {
  id: string;
  name: string;
  content: string;
  path: string;
  encoding: string;
  modifiedAt: number;
  fragment?: string;
  watched?: boolean;
};

export type FolderEntry = {
  path: string;
  relativePath: string;
  name: string;
  modifiedAt: number;
};

export type FolderListing = {
  root: string;
  name: string;
  files: FolderEntry[];
  truncated: boolean;
};

export type NativeAction =
  | "paste"
  | "reload"
  | "close"
  | "focus"
  | "find"
  | "open-folder"
  | "export-pdf"
  | "watch-on"
  | "watch-off"
  | "pin-on"
  | "pin-off";

type Unsubscribe = () => void;

export interface DesktopBridge {
  platform: string;
  openFiles(): Promise<void>;
  openFolder(): Promise<FolderListing | null>;
  openFolderFile(targetPath: string): Promise<void>;
  openLinked(sourceId: string, href: string): Promise<{ ok: boolean; fragment: string }>;
  closeFile(id: string): Promise<void>;
  ready(): Promise<{ version: string; liveWatch: boolean; alwaysOnTop: boolean }>;
  reloadFile(id: string): Promise<void>;
  setLiveWatch(enabled: boolean): Promise<{ liveWatch: boolean }>;
  setAlwaysOnTop(enabled: boolean): Promise<{ alwaysOnTop: boolean }>;
  exportPdf(suggestedName?: string): Promise<{ ok?: boolean; canceled?: boolean; path?: string }>;
  onDocuments(callback: (documents: NativeDocument[]) => void): Unsubscribe;
  onDocumentUpdated(callback: (document: NativeDocument) => void): Unsubscribe;
  onAction(callback: (action: NativeAction) => void): Unsubscribe;
  onError(callback: (message: string) => void): Unsubscribe;
}

declare global {
  interface Window {
    moduDesktop?: DesktopBridge;
  }
}

export const desktop = typeof window !== "undefined" ? window.moduDesktop : undefined;
