"use client";

import dynamic from "next/dynamic";
import { DesktopOnlyGuard } from "@/components/ui/desktop-only-guard";

const TerminalInstance = dynamic(
  () => import("@/components/terminal/TerminalInstance"),
  { ssr: false }
);

export default function TerminalPage() {
  return (
    <DesktopOnlyGuard
      title="Terminal — Desktop only"
      description="Das Web-Terminal benötigt eine Tastatur und einen grösseren Bildschirm."
      breakpoint="md"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0">
          <h1 className="text-sm font-semibold tracking-wide">Terminal</h1>
        </div>
        <div className="flex-1 min-h-0 p-2">
          <TerminalInstance />
        </div>
      </div>
    </DesktopOnlyGuard>
  );
}
