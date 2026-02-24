"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { GLOBAL_SHORTCUTS } from "@/hooks/useGlobalShortcuts";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md border border-border bg-muted text-xs font-mono font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Tastaturkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {GLOBAL_SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-1"
            >
              <span className="text-sm text-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && (
                      <span className="text-muted-foreground text-xs">+</span>
                    )}
                    <Kbd>{key}</Kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Auf Windows/Linux: Ctrl statt ⌘
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** Small floating button to open the shortcuts dialog */
export function KeyboardShortcutsButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
      onClick={onClick}
      title="Tastaturkürzel (⌘/)"
    >
      <Keyboard className="h-4 w-4" />
    </Button>
  );
}
