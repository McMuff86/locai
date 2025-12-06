"use client";

import React, { useState } from 'react';
import { Conversation, MessageContent } from '../../types/chat';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Trash2, 
  MessageSquare, 
  PlusCircle, 
  Download, 
  Upload, 
  Image, 
  BarChart2, 
  X,
  Settings,
  HelpCircle,
  Moon,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
  Paintbrush,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChatSearch } from './ChatSearch';
import { ConversationStats } from './ConversationStats';
import { ComfyUIWidget } from '../ComfyUIWidget';
import { useTheme } from 'next-themes';
import { AppSettings } from '../../hooks/useSettings';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onExportConversations?: () => void;
  onImportConversations?: () => void;
  onClearAllConversations?: () => void;
  settings?: AppSettings;
  onUpdateSettings?: (updates: Partial<AppSettings>) => void;
  onOpenGallery?: () => void;
  className?: string;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onExportConversations,
  onImportConversations,
  onClearAllConversations,
  settings,
  onUpdateSettings,
  onOpenGallery,
  className = ''
}: ConversationSidebarProps) {
  const [showStats, setShowStats] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [showComfySettings, setShowComfySettings] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState<'comfyPath' | 'outputPath' | null>(null);
  const { theme, setTheme } = useTheme();
  
  // Open native folder picker
  const pickFolder = async (type: 'comfyPath' | 'outputPath') => {
    if (!onUpdateSettings) return;
    
    setIsPickingFolder(type);
    
    try {
      // Determine initial path for the dialog
      let initialPath = '';
      if (type === 'comfyPath') {
        initialPath = settings?.comfyUIPath || '';
      } else {
        // For output, use existing outputPath or construct default
        initialPath = settings?.comfyUIOutputPath || 
          (settings?.comfyUIPath ? `${settings.comfyUIPath}\\ComfyUI\\output` : '');
      }
      
      const response = await fetch('/api/folder-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          initialPath,
          title: type === 'comfyPath' ? 'ComfyUI Ordner auswählen' : 'Output Ordner auswählen'
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.path) {
        if (type === 'comfyPath') {
          onUpdateSettings({ comfyUIPath: data.path });
        } else {
          // Store absolute path for output folder
          onUpdateSettings({ comfyUIOutputPath: data.path });
        }
      }
    } catch (err) {
      console.error('Folder picker error:', err);
    } finally {
      setIsPickingFolder(null);
    }
  };
  
  // Get the current conversation for stats
  const currentConversation = conversations.find(c => c.id === showStats);
  
  // Helper function to extract preview text from message content
  const getTextFromContent = (content: MessageContent): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object' && 'type' in content && content.type === 'image') {
      return '[Bild]';
    }
    
    if (Array.isArray(content)) {
      const textItem = content.find(item => typeof item === 'string');
      if (textItem && typeof textItem === 'string') {
        return textItem;
      }
      if (content.some(item => typeof item === 'object' && 'type' in item && item.type === 'image')) {
        return '[Bild]';
      }
    }
    
    return 'Inhalt';
  };
  
  // Function to get conversation summary/preview
  const getConversationPreview = (conversation: Conversation): string => {
    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find(msg => msg.role === 'user');
      
    if (lastUserMessage) {
      const previewText = getTextFromContent(lastUserMessage.content);
      return previewText.length > 50 
        ? `${previewText.substring(0, 50)}...` 
        : previewText;
    }
    
    return typeof conversation.title === 'string' 
      ? conversation.title 
      : 'Konversation';
  };
  
  // Function to check if a conversation contains images
  const hasImages = (conversation: Conversation): boolean => {
    return conversation.messages.some(msg => {
      const content = msg.content;
      
      if (typeof content === 'object' && 'type' in content && content.type === 'image') {
        return true;
      }
      
      if (Array.isArray(content)) {
        return content.some(item => typeof item === 'object' && 'type' in item && item.type === 'image');
      }
      
      return false;
    });
  };
  
  return (
    <div className={`flex flex-col h-full bg-sidebar ${className}`}>
      {/* Header Section */}
      <div className="p-4 space-y-3">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2 px-2 mb-4">
          <img 
            src="/LocAI_logo_v0.2.svg" 
            alt="LocAI" 
            className="h-8 w-8"
          />
          <span className="font-semibold text-lg text-foreground">LocAI</span>
        </div>
        
        {/* New Conversation Button */}
        <Button 
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90" 
          onClick={onNewConversation}
        >
          <PlusCircle className="h-4 w-4" />
          Neuer Chat
        </Button>
        
        {/* Search */}
        <ChatSearch 
          conversations={conversations}
          onSelectConversation={onSelectConversation}
        />
      </div>
      
      {/* ComfyUI Widget - if settings available */}
      {settings && (
        <div className="px-4 pb-3 space-y-2">
          <ComfyUIWidget
            comfyUIPath={settings.comfyUIPath}
            comfyUIPort={settings.comfyUIPort}
            onOpenSettings={() => {
              setShowSettings(true);
              setShowComfySettings(true);
            }}
            compact
          />
          
          {/* Gallery Button */}
          {settings.comfyUIPath && onOpenGallery && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onOpenGallery}
            >
              <Image className="h-4 w-4" />
              Bildergalerie öffnen
            </Button>
          )}
        </div>
      )}
      
      {/* Section Label */}
      <div className="px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Chat-Verlauf
        </span>
      </div>
      
      {/* Stats Panel (slide-in) */}
      {showStats && currentConversation && (
        <div className="border-y border-border bg-background/95 backdrop-blur mx-2 rounded-lg mb-2">
          <div className="flex items-center justify-between p-2 border-b border-border">
            <span className="text-sm font-medium">Statistiken</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => setShowStats(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2">
            <ConversationStats conversation={currentConversation} />
          </div>
        </div>
      )}
      
      {/* Conversations List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-4">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Chats vorhanden</p>
              <p className="text-xs mt-1">Starte einen neuen Chat!</p>
            </div>
          ) : (
            conversations.map(conversation => (
              <div 
                key={conversation.id} 
                className={`p-2.5 rounded-lg cursor-pointer group transition-all duration-200 ${
                  currentConversationId === conversation.id 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      {hasImages(conversation) && (
                        <Image className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {typeof conversation.title === 'string' ? conversation.title : 'Bildkonversation'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {getConversationPreview(conversation)}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                      <span>{conversation.messages.filter(m => m.role !== 'system').length} Msg</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: false, locale: de })}</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Always visible but subtle */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStats(showStats === conversation.id ? null : conversation.id);
                      }}
                      title="Statistiken"
                    >
                      <BarChart2 className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Chat "${conversation.title}" löschen?`)) {
                          onDeleteConversation(conversation.id);
                        }
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Bottom Section - Settings & Actions */}
      <div className="border-t border-border bg-sidebar">
        {/* Settings Panel (expandable) */}
        {showSettings && (
          <div className="p-3 border-b border-border space-y-2 animate-in slide-in-from-bottom-2 duration-200 max-h-[60vh] overflow-y-auto">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
            >
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span>Dark Mode</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {theme === 'dark' ? 'An' : 'Aus'}
              </span>
            </button>
            
            {/* ComfyUI Settings */}
            {settings && onUpdateSettings && (
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => setShowComfySettings(!showComfySettings)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                >
                  <Paintbrush className="h-4 w-4 text-muted-foreground" />
                  <span>ComfyUI</span>
                  {showComfySettings ? (
                    <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  )}
                </button>
                
                {showComfySettings && (
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg space-y-3">
                    {/* ComfyUI Path */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        ComfyUI Pfad
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="C:\ComfyUI oder /home/user/ComfyUI"
                          value={settings.comfyUIPath}
                          onChange={(e) => onUpdateSettings({ comfyUIPath: e.target.value })}
                          className="text-sm h-8"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 flex-shrink-0"
                          title="Ordner auswählen"
                          onClick={() => pickFolder('comfyPath')}
                          disabled={isPickingFolder === 'comfyPath'}
                        >
                          {isPickingFolder === 'comfyPath' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FolderOpen className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pfad zum ComfyUI Ordner (enthält run_nvidia_gpu.bat etc.)
                      </p>
                    </div>
                    
                    {/* Output Path */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Output Ordner (für Galerie)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder={settings.comfyUIPath ? `${settings.comfyUIPath}\\ComfyUI\\output` : 'Ordner auswählen...'}
                          value={settings.comfyUIOutputPath || ''}
                          onChange={(e) => onUpdateSettings({ comfyUIOutputPath: e.target.value })}
                          className="text-sm h-8"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 flex-shrink-0"
                          title="Output Ordner auswählen"
                          onClick={() => pickFolder('outputPath')}
                          disabled={isPickingFolder === 'outputPath'}
                        >
                          {isPickingFolder === 'outputPath' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FolderOpen className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Absoluter Pfad zum Output-Ordner (oder leer für Standard)
                      </p>
                    </div>
                    
                    {/* Port */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Port
                      </label>
                      <Input
                        type="number"
                        value={settings.comfyUIPort}
                        onChange={(e) => onUpdateSettings({ comfyUIPort: parseInt(e.target.value) || 8188 })}
                        className="text-sm h-8 w-24"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Import */}
            {onImportConversations && (
              <button
                onClick={onImportConversations}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span>Chats importieren</span>
              </button>
            )}
            
            {/* Export */}
            {onExportConversations && (
              <button
                onClick={onExportConversations}
                disabled={conversations.length === 0}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                <span>Chats exportieren</span>
              </button>
            )}
            
            {/* Danger Zone - Expandable */}
            {onClearAllConversations && conversations.length > 0 && (
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => setShowDangerZone(!showDangerZone)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive/80"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Gefahrenzone</span>
                  {showDangerZone ? (
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  ) : (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </button>
                
                {showDangerZone && (
                  <div className="mt-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-2">
                      Diese Aktion kann nicht rückgängig gemacht werden!
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (window.confirm("ACHTUNG: Alle Konversationen werden unwiderruflich gelöscht. Fortfahren?")) {
                          onClearAllConversations();
                          setShowDangerZone(false);
                          setShowSettings(false);
                        }
                      }}
                    >
                      Alle Chats löschen ({conversations.length})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Bottom Menu Items */}
        <div className="p-2 space-y-1">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span>Hilfe</span>
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
              showSettings ? 'bg-muted/50' : 'hover:bg-muted/50'
            }`}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Einstellungen</span>
            {showSettings ? (
              <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
