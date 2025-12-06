"use client";

import React, { useMemo } from 'react';
import { Conversation, MessageContent } from '../../types/chat';
import { 
  MessageSquare, 
  User, 
  Bot, 
  Clock, 
  Calendar,
  FileText,
  Image,
  Hash
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ConversationStatsProps {
  conversation: Conversation;
  className?: string;
  compact?: boolean;
}

// Helper to count words in content
function countWords(content: MessageContent): number {
  if (typeof content === 'string') {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }
  
  if (Array.isArray(content)) {
    return content.reduce((acc, item) => {
      if (typeof item === 'string') {
        return acc + item.trim().split(/\s+/).filter(Boolean).length;
      }
      return acc;
    }, 0);
  }
  
  return 0;
}

// Helper to count characters
function countCharacters(content: MessageContent): number {
  if (typeof content === 'string') {
    return content.length;
  }
  
  if (Array.isArray(content)) {
    return content.reduce((acc, item) => {
      if (typeof item === 'string') {
        return acc + item.length;
      }
      return acc;
    }, 0);
  }
  
  return 0;
}

// Helper to check for images
function hasImages(content: MessageContent): boolean {
  if (typeof content === 'object' && 'type' in content && content.type === 'image') {
    return true;
  }
  
  if (Array.isArray(content)) {
    return content.some(item => 
      typeof item === 'object' && 'type' in item && item.type === 'image'
    );
  }
  
  return false;
}

export function ConversationStats({ 
  conversation, 
  className = '',
  compact = false 
}: ConversationStatsProps) {
  const stats = useMemo(() => {
    const messages = conversation.messages.filter(m => m.role !== 'system');
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    // Word counts
    const userWords = userMessages.reduce((acc, m) => acc + countWords(m.content), 0);
    const assistantWords = assistantMessages.reduce((acc, m) => acc + countWords(m.content), 0);
    
    // Character counts
    const userChars = userMessages.reduce((acc, m) => acc + countCharacters(m.content), 0);
    const assistantChars = assistantMessages.reduce((acc, m) => acc + countCharacters(m.content), 0);
    
    // Image count
    const imageCount = messages.filter(m => hasImages(m.content)).length;
    
    // Duration
    const createdAt = new Date(conversation.createdAt);
    const updatedAt = new Date(conversation.updatedAt);
    const durationMinutes = differenceInMinutes(updatedAt, createdAt);
    
    // Model name from system message
    const systemMessage = conversation.messages.find(m => m.role === 'system');
    const modelName = systemMessage?.modelName || 'Unknown';
    
    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      userWords,
      assistantWords,
      totalWords: userWords + assistantWords,
      userChars,
      assistantChars,
      totalChars: userChars + assistantChars,
      imageCount,
      durationMinutes,
      createdAt,
      updatedAt,
      modelName
    };
  }, [conversation]);

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-3 text-xs text-muted-foreground ${className}`}>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {stats.totalMessages}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {stats.totalWords.toLocaleString()} Wörter
        </span>
        {stats.imageCount > 0 && (
          <span className="flex items-center gap-1">
            <Image className="h-3 w-3" />
            {stats.imageCount}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {stats.durationMinutes < 1 ? '<1 min' : `${stats.durationMinutes} min`}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-muted/30 rounded-lg p-4 space-y-4 ${className}`}>
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Hash className="h-4 w-4 text-primary" />
        Konversationsstatistik
      </h3>
      
      {/* Messages Section */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Gesamt"
          value={stats.totalMessages}
          color="text-foreground"
        />
        <StatCard
          icon={<User className="h-4 w-4" />}
          label="Du"
          value={stats.userMessages}
          color="text-primary"
        />
        <StatCard
          icon={<Bot className="h-4 w-4" />}
          label="AI"
          value={stats.assistantMessages}
          color="text-muted-foreground"
        />
      </div>
      
      {/* Content Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inhalt</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded p-2">
            <div className="text-lg font-semibold">{stats.totalWords.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Wörter total</div>
            <div className="text-xs text-muted-foreground/70 mt-1">
              Du: {stats.userWords.toLocaleString()} | AI: {stats.assistantWords.toLocaleString()}
            </div>
          </div>
          <div className="bg-background/50 rounded p-2">
            <div className="text-lg font-semibold">{stats.totalChars.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Zeichen total</div>
            <div className="text-xs text-muted-foreground/70 mt-1">
              ~{Math.round(stats.totalChars / 4).toLocaleString()} Tokens (geschätzt)
            </div>
          </div>
        </div>
        
        {stats.imageCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Image className="h-4 w-4 text-primary" />
            <span>{stats.imageCount} Bild{stats.imageCount !== 1 ? 'er' : ''} analysiert</span>
          </div>
        )}
      </div>
      
      {/* Time Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zeit</h4>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Erstellt
            </span>
            <span>{format(stats.createdAt, 'dd.MM.yyyy HH:mm', { locale: de })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Dauer
            </span>
            <span>
              {stats.durationMinutes < 1 
                ? 'Weniger als 1 Minute' 
                : stats.durationMinutes < 60 
                  ? `${stats.durationMinutes} Minuten`
                  : `${Math.round(stats.durationMinutes / 60)} Stunden`
              }
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Letzte Aktivität</span>
            <span>{formatDistanceToNow(stats.updatedAt, { addSuffix: true, locale: de })}</span>
          </div>
        </div>
      </div>
      
      {/* Model Info */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Modell</span>
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{stats.modelName}</span>
        </div>
      </div>
    </div>
  );
}

// Small stat card component
function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  color: string;
}) {
  return (
    <div className="bg-background/50 rounded p-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-lg font-semibold">{value}</span>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default ConversationStats;

