"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Global keyboard shortcuts registered at the app layout level.
 * Aware of page-specific handlers (e.g., Flow page's own Cmd+K).
 */

const NAV_ROUTES = ["/chat", "/documents", "/flow", "/notes", "/settings"] as const;

export interface GlobalShortcutsOptions {
  onToggleShortcutsDialog?: () => void;
}

export function useGlobalShortcuts(options: GlobalShortcutsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // --- Escape: close any open dialog (radix portals use [data-state="open"]) ---
      if (key === "escape") {
        const openDialog = document.querySelector(
          '[role="dialog"][data-state="open"]'
        );
        if (openDialog) {
          // Find close button or press escape on the dialog
          const closeBtn = openDialog.querySelector(
            'button[data-dialog-close], button[aria-label="Close"]'
          ) as HTMLButtonElement | null;
          if (closeBtn) {
            closeBtn.click();
            e.preventDefault();
            return;
          }
        }
        return; // let default escape behaviour pass through
      }

      if (!mod) return;

      // --- Cmd+K: skip on flow page (has its own handler) ---
      if (key === "k" && pathname !== "/flow") {
        e.preventDefault();
        // Try to focus a chat input
        const chatInput =
          document.querySelector<HTMLTextAreaElement>(
            'textarea[placeholder*="Nachricht"], textarea[placeholder*="message"], textarea[name="chat-input"]'
          ) ??
          document.querySelector<HTMLTextAreaElement>("textarea");
        if (chatInput) {
          chatInput.focus();
        } else {
          router.push("/chat");
        }
        return;
      }

      // --- Cmd+N: New chat ---
      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        router.push("/chat");
        // Dispatch a custom event so the chat page can reset the conversation
        window.dispatchEvent(new CustomEvent("locai:new-chat"));
        return;
      }

      // --- Cmd+, : Settings ---
      if (key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }

      // --- Cmd+1-5: Navigate to sections ---
      const numIndex = parseInt(key, 10);
      if (numIndex >= 1 && numIndex <= NAV_ROUTES.length) {
        e.preventDefault();
        router.push(NAV_ROUTES[numIndex - 1]);
        return;
      }

      // --- Cmd+/  or  Cmd+? : show shortcuts dialog ---
      if (key === "/" || key === "?") {
        e.preventDefault();
        options.onToggleShortcutsDialog?.();
        return;
      }
    },
    [router, pathname, options]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/** List of shortcuts for display */
export const GLOBAL_SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Suche / Chat-Fokus" },
  { keys: ["⌘", "N"], description: "Neuer Chat" },
  { keys: ["⌘", ","], description: "Einstellungen" },
  { keys: ["⌘", "1"], description: "Chat" },
  { keys: ["⌘", "2"], description: "Dokumente" },
  { keys: ["⌘", "3"], description: "Flow" },
  { keys: ["⌘", "4"], description: "Notizen" },
  { keys: ["⌘", "5"], description: "Einstellungen" },
  { keys: ["⌘", "/"], description: "Shortcuts anzeigen" },
  { keys: ["Esc"], description: "Dialog schliessen" },
] as const;
