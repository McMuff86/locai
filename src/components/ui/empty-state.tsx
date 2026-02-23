"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Upload, 
  PenTool, 
  Sparkles, 
  ArrowRight,
  FileText,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  className?: string;
  variant?: "default" | "chat" | "documents" | "notes" | "search";
}

const emptyStateConfigs = {
  default: {
    icon: <Sparkles className="h-8 w-8" />,
    iconBg: "bg-muted/50 border-border/40",
    iconColor: "text-muted-foreground"
  },
  chat: {
    icon: <MessageSquare className="h-8 w-8" />,
    iconBg: "bg-gradient-to-br from-cyan-400/10 to-blue-500/10 border-cyan-400/20",
    iconColor: "text-cyan-400"
  },
  documents: {
    icon: <Upload className="h-8 w-8" />,
    iconBg: "bg-gradient-to-br from-emerald-400/10 to-green-500/10 border-emerald-400/20", 
    iconColor: "text-emerald-400"
  },
  notes: {
    icon: <PenTool className="h-8 w-8" />,
    iconBg: "bg-gradient-to-br from-amber-400/10 to-orange-500/10 border-amber-400/20",
    iconColor: "text-amber-400"
  },
  search: {
    icon: <Search className="h-8 w-8" />,
    iconBg: "bg-gradient-to-br from-purple-400/10 to-pink-500/10 border-purple-400/20",
    iconColor: "text-purple-400"
  }
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = "default"
}: EmptyStateProps) {
  const config = emptyStateConfigs[variant];
  const displayIcon = icon || config.icon;

  return (
    <motion.div 
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 space-y-4",
        "min-h-[320px]",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Icon Container */}
      <motion.div
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center",
          "border shadow-sm",
          config.iconBg
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
      >
        <div className={config.iconColor}>
          {displayIcon}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        className="space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <h3 className="text-lg font-semibold text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
      </motion.div>

      {/* Action */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Button 
            onClick={action.onClick}
            variant={action.variant || "default"}
            className="gap-2"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

// Specific empty state components
export function ChatEmptyState({
  onNewChat,
  className
}: {
  onNewChat?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="chat"
      title="Starte ein Gespräch"
      description="Beginne eine neue Unterhaltung mit dem AI-Assistenten. Stelle Fragen, lass dir helfen oder chatte einfach."
      action={onNewChat ? {
        label: "Neuen Chat beginnen",
        onClick: onNewChat
      } : undefined}
      className={className}
    />
  );
}

export function DocumentsEmptyState({
  onUpload,
  className
}: {
  onUpload?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="documents"
      title="Noch keine Dokumente"
      description="Lade Dokumente hoch, um sie zu durchsuchen und mit dem AI-Assistenten zu besprechen."
      action={onUpload ? {
        label: "Dokument hochladen",
        onClick: onUpload
      } : undefined}
      className={className}
    />
  );
}

export function NotesEmptyState({
  onCreateNote,
  className
}: {
  onCreateNote?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      variant="notes"
      title="Noch keine Notizen"
      description="Erstelle Notizen, um wichtige Informationen festzuhalten und zu organisieren."
      action={onCreateNote ? {
        label: "Erste Notiz erstellen",
        onClick: onCreateNote
      } : undefined}
      className={className}
    />
  );
}