import React from 'react';
import { Conversation } from '../../types/chat';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Trash2, MessageSquare, PlusCircle, Download, Upload, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onExportConversations?: () => void;
  onImportConversations?: () => void;
  onClearAllConversations?: () => void;
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
  className = ''
}: ConversationSidebarProps) {
  // Function to get conversation summary/preview
  const getConversationPreview = (conversation: Conversation): string => {
    // Get the last user message or fallback to system message
    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find(msg => msg.role === 'user');
      
    if (lastUserMessage) {
      return lastUserMessage.content.length > 60 
        ? `${lastUserMessage.content.substring(0, 60)}...` 
        : lastUserMessage.content;
    }
    
    // Fallback to conversation title
    return conversation.title;
  };
  
  return (
    <div className={`border-r border-border flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Button 
            className="w-full flex items-center justify-center gap-2" 
            onClick={onNewConversation}
          >
            <PlusCircle className="h-4 w-4" />
            Neue Konversation
          </Button>
        </div>
        
        {/* Import/Export buttons */}
        <div className="flex items-center gap-2 mt-2">
          {onImportConversations && (
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 flex items-center justify-center gap-1"
              onClick={onImportConversations}
            >
              <Upload className="h-3 w-3" />
              Importieren
            </Button>
          )}
          
          {onExportConversations && (
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 flex items-center justify-center gap-1"
              onClick={onExportConversations}
              disabled={conversations.length === 0}
            >
              <Download className="h-3 w-3" />
              Exportieren
            </Button>
          )}
        </div>
        
        {/* Clear all button */}
        {onClearAllConversations && conversations.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full mt-2 text-destructive border-destructive/20 hover:bg-destructive/10 flex items-center justify-center gap-1"
            onClick={() => {
              if (window.confirm("Sind Sie sicher, dass Sie ALLE gespeicherten Konversationen löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.")) {
                onClearAllConversations();
              }
            }}
          >
            <Trash className="h-3 w-3" />
            Alle Konversationen löschen
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Keine gespeicherten Konversationen
            </div>
          ) : (
            conversations.map(conversation => (
              <div 
                key={conversation.id} 
                className={`p-3 rounded-md cursor-pointer group transition-colors ${
                  currentConversationId === conversation.id 
                    ? 'bg-secondary/50' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {getConversationPreview(conversation)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{conversation.messages.filter(m => m.role !== 'system').length} Nachrichten</span>
                      <span className="mx-1">•</span>
                      <span>{formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 