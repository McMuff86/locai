"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

// ── Variants ─────────────────────────────────────────────────────

type LoadingVariant = "spinner" | "skeleton" | "pulse" | "inline";

interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Text shown below spinner / beside inline */
  message?: string;
  className?: string;
  /** Number of skeleton rows for skeleton variant */
  rows?: number;
  /** Number of pulse cards for pulse variant */
  cards?: number;
  /** Unique key for AnimatePresence tracking */
  animateKey?: string;
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

// ── Spinner (for buttons, actions, centered areas) ──────────────

function SpinnerLoading({ message, className }: Pick<LoadingStateProps, "message" | "className">) {
  return (
    <motion.div
      {...fadeIn}
      className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </motion.div>
  );
}

// ── Skeleton Shimmer (for content areas) ────────────────────────

function SkeletonLoading({ rows = 3, className }: Pick<LoadingStateProps, "rows" | "className">) {
  return (
    <motion.div {...fadeIn} className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </motion.div>
  );
}

// ── Pulse Cards (for card grids) ────────────────────────────────

function PulseLoading({ cards = 3, className }: Pick<LoadingStateProps, "cards" | "className">) {
  return (
    <motion.div {...fadeIn} className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </motion.div>
  );
}

// ── Inline (small, beside text) ─────────────────────────────────

function InlineLoading({ message, className }: Pick<LoadingStateProps, "message" | "className">) {
  return (
    <motion.span
      {...fadeIn}
      className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {message && <span>{message}</span>}
    </motion.span>
  );
}

// ── Main Export ──────────────────────────────────────────────────

export function LoadingState({
  variant = "spinner",
  message,
  className,
  rows,
  cards,
  animateKey,
}: LoadingStateProps) {
  const key = animateKey ?? variant;

  return (
    <AnimatePresence mode="wait">
      <React.Fragment key={key}>
        {variant === "spinner" && <SpinnerLoading message={message} className={className} />}
        {variant === "skeleton" && <SkeletonLoading rows={rows} className={className} />}
        {variant === "pulse" && <PulseLoading cards={cards} className={className} />}
        {variant === "inline" && <InlineLoading message={message} className={className} />}
      </React.Fragment>
    </AnimatePresence>
  );
}
