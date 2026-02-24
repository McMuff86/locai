"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MemoryBadgeProps {
  memories: Array<{ key: string; value: string; category: string }>;
  className?: string;
}

export function MemoryBadge({ memories, className }: MemoryBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (!memories || memories.length === 0) return null;

  return (
    <div className={cn("mt-1", className)}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
          "text-[11px] font-medium transition-colors",
          "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
          "border border-purple-500/20"
        )}
      >
        <span>🧠</span>
        <span>
          {memories.length} {memories.length === 1 ? "Memory" : "Memories"}
        </span>
        <span className="text-[10px] opacity-60">{expanded ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-1 pl-1">
              {memories.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-[11px] text-muted-foreground/80 leading-tight",
                    "pl-2 border-l border-purple-500/30"
                  )}
                >
                  <span className="font-medium text-purple-400/80">
                    [{m.category}]
                  </span>{" "}
                  <span className="text-foreground/70">{m.key}:</span>{" "}
                  <span>{m.value.length > 120 ? m.value.slice(0, 120) + "…" : m.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
