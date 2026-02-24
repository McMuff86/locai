"use client";

import React from "react";
import { AlertTriangle, WifiOff, ServerCrash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ErrorType = "generic" | "network" | "server" | "not-found";
type ErrorVariant = "card" | "inline";

const errorConfig: Record<ErrorType, { icon: React.ComponentType<{ className?: string }>; title: string; message: string }> = {
  generic: { icon: AlertTriangle, title: "Fehler", message: "Ein unerwarteter Fehler ist aufgetreten." },
  network: { icon: WifiOff, title: "Netzwerkfehler", message: "Verbindung fehlgeschlagen. Bitte versuche es erneut." },
  server: { icon: ServerCrash, title: "Serverfehler", message: "Der Server ist nicht erreichbar." },
  "not-found": { icon: AlertTriangle, title: "Nicht gefunden", message: "Die angeforderte Ressource wurde nicht gefunden." },
};

interface ErrorStateProps {
  type?: ErrorType;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

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
      <div
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
      </div>
    );
  }

  return (
    <Card className={cn("border-destructive/20 bg-destructive/5", className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        {icon ?? <Icon className="h-10 w-10 text-destructive/60 mb-3" />}
        <h3 className="font-semibold text-foreground mb-1">{displayTitle}</h3>
        <p className="text-sm text-muted-foreground mb-4">{displayMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
