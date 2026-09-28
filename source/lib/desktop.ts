export type NativeDocument = { id: string; name: string; content: string; path: string; encoding: string; modifiedAt: number };
export type NativeAction = "paste" | "reload" | "close" | "focus" | "find";
type Unsubscribe = () => void;
export interface DesktopBridge {
  platform: string;
  openFiles(): Promise<void>;
  ready(): Promise<{ version: string }>;
  reloadFile(id: string): Promise<void>;
  setLocale(locale: "zh" | "en"): Promise<void>;
  onDocuments(callback: (documents: NativeDocument[]) => void): Unsubscribe;
  onAction(callback: (action: NativeAction) => void): Unsubscribe;
  onError(callback: (message: string) => void): Unsubscribe;
}
declare global { interface Window { moduDesktop?: DesktopBridge } }
export const desktop = window.moduDesktop;
