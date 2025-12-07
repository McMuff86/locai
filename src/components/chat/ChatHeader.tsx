"use client";

import React from 'react';
import Link from 'next/link';
import { 
  Home, ChevronDown, Check, Save, FolderOpen, 
  Download, Upload, Trash, Menu, Plus, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Conversation } from '../../types/chat';
import { OllamaModel } from '../../lib/ollama';

interface ChatHeaderProps {
  // Model props
  models: OllamaModel[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  showModelSelector: boolean;
  onPullModel?: () => void;
  
  // Conversation props
  savedConversations: Conversation[];
  onSaveConversation: () => void;
  onSelectConversation: (conv: Conversation) => void;
  onImportConversations: () => void;
  onExportConversations: () => void;
  onClearAllConversations: () => void;
  
  // Sidebar toggle props
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
  
  // Mobile props
  isMobile?: boolean;
}

export function ChatHeader({
  models,
  selectedModel,
  onModelChange,
  showModelSelector,
  onPullModel,
  savedConversations,
  onSaveConversation,
  onSelectConversation,
  onImportConversations,
  onExportConversations,
  onClearAllConversations,
  onToggleSidebar,
  showSidebarToggle = false,
  isSidebarOpen = true,
  isMobile = false
}: ChatHeaderProps) {
  
  const ConversationDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={isMobile ? "ghost" : "outline"} size={isMobile ? "icon" : "sm"} className={isMobile ? "" : "flex items-center gap-1"}>
          <FolderOpen className="h-4 w-4" />
          {!isMobile && "Laden"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Gespeicherte Konversationen</DropdownMenuLabel>
        {savedConversations.length === 0 ? (
          <DropdownMenuItem disabled>Keine gespeicherten Konversationen</DropdownMenuItem>
        ) : (
          savedConversations.map(conv => (
            <DropdownMenuItem 
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
            >
              {typeof conv.title === 'string' ? conv.title : 'Bildkonversation'}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onImportConversations}>
          <Upload className="h-4 w-4 mr-2" />
          Konversationen importieren
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportConversations}>
          <Download className="h-4 w-4 mr-2" />
          Konversationen exportieren
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onClearAllConversations} 
          className="text-destructive focus:text-destructive"
        >
          <Trash className="h-4 w-4 mr-2" />
          Alle Konversationen löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ModelDropdown = () => (
    <DropdownMenu>
      {models.length > 0 && showModelSelector && (
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-1">
            {selectedModel}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Change Model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.map((model) => (
          <DropdownMenuItem 
            key={model.name}
            onClick={() => onModelChange(model.name)}
            className="flex items-center justify-between"
          >
            {model.name}
            {model.name === selectedModel && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
        ))}
        {onPullModel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPullModel}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Modell herunterladen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Mobile Header
  if (isMobile) {
    return (
      <div className="flex items-center justify-between p-2 border-b md:hidden">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={onSaveConversation}
          >
            <Save className="h-5 w-5" />
          </Button>
          <ConversationDropdown />
          <ModelDropdown />
        </div>
        <ThemeToggle />
      </div>
    );
  }

  // Desktop Header
  return (
    <div className="flex items-center justify-between p-3 border-b">
      <div className="flex items-center gap-2">
        {showSidebarToggle && onToggleSidebar && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Sidebar ausblenden" : "Sidebar einblenden"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        )}
        <h1 className="text-lg font-semibold">Chat</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={onSaveConversation}
        >
          <Save className="h-4 w-4" />
          Speichern
        </Button>
        <ConversationDropdown />
        <ModelDropdown />
        <ThemeToggle />
      </div>
    </div>
  );
}

export default ChatHeader;

