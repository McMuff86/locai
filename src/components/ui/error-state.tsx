"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  WifiOff,
  FileQuestion,
  ShieldAlert,
  Clock,
  RefreshCw,
  ServerCrash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ── Error Types & Defaults ──────────────────────────────────────

type ErrorType = "generic" | "network" | "not-found" | "permission" | "timeout" | "server";
type ErrorVariant = "inline" | "full-page" | "card";

const errorConfig: Record<ErrorType, { icon: React.ElementType; title: string; message: string }> = {
  generic: {
    icon: AlertCircle,
    title: "Etwas ist schiefgelaufen",
    message: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.",
  },
  network: {
    icon: WifiOff,
    title: "Keine Verbindung",
    message: "Die Verbindung zum Server konnte nicht hergestellt werden. Prüfe deine Internetverbindung.",
  },
  "not-found": {
    icon: FileQuestion,
    title: "Nicht gefunden",
    message: "Die angeforderte Ressource wurde nicht gefunden.",
  },
  permission: {
    icon: ShieldAlert,
    title: "Zugriff verweigert",
    message: "Du hast keine Berechtigung für diese Aktion.",
  },
  timeout: {
    icon: Clock,
    title: "Zeitüberschreitung",
    message: "Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.",
  },
  server: {
    icon: ServerCrash,
    title: "Serverfehler",
    message: "Der Server hat einen Fehler gemeldet. Bitte versuche es später erneut.",
  },
};

// ── Props ────────────────────────────────────────────────────────

interface ErrorStateProps {
  /** Error type for default icon/messages */
  type?: ErrorType;
  /** Override the variant layout */
  variant?: ErrorVariant;
  /** Custom title (overrides type default) */
  title?: string;
  /** Custom message (overrides type default) */
  message?: string;
  /** Custom icon (overrides type default) */
  icon?: React.ReactNode;
  /** Retry callback – shows retry button when provided */
  onRetry?: () => void;
  /** Custom retry label */
  retryLabel?: string;
  className?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeOut" },
};

// ── Component ────────────────────────────────────────────────────

export function ErrorState({
  type = "generic",
  variant = "card",
  title,
  message,
  icon,
  onRetry,
  retryLabel = "Erneut versuchen",
  className,
}: ErrorStateProps) {
  const config = errorConfig[type];
  const Icon = config.icon;
  const displayTitle = title ?? config.title;
  const displayMessage = message ?? config.message;

  if (variant === "inline") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          {...fadeIn}
          className={cn(
            "flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm",
            className
          )}
        >
          {icon ?? <Icon className="h-4 w-4 text-destructive flex-shrink-0" />}
          <span className="text-destructive/90">{displayMessage}</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="ml-auto h-7 px-2 text-destructive hover:text-destructive"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  if (variant === "full-page") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          {...fadeIn}
          className={cn(
            "flex flex-col items-center justify-center text-center min-h-[60vh] p-8 space-y-4",
            className
          )}
        >
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border border-destructive/20 bg-destructive/10 shadow-sm"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            {icon ?? <Icon className="h-8 w-8 text-destructive" />}
          </motion.div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{displayTitle}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{displayMessage}</p>
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2 mt-2">
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Default: card variant
  return (
    <AnimatePresence mode="wait">
      <motion.div
        {...fadeIn}
        className={cn(
          "flex flex-col items-center justify-center text-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 space-y-3",
          className
        )}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-destructive/20 bg-destructive/10">
          {icon ?? <Icon className="h-5 w-5 text-destructive" />}
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{displayTitle}</h4>
          <p className="text-xs text-muted-foreground max-w-xs">{displayMessage}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
