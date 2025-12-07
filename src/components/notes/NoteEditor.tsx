"use client";

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, Hash, Link2, Bold, Italic, 
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { NoteForm } from './types';

// Markdown toolbar button component
interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      title={label}
    >
      {icon}
    </button>
  );
}

interface NoteEditorProps {
  form: NoteForm;
  selectedId: string | null;
  saving: boolean;
  isMinimized: boolean;
  highlightTerm: string | null;
  onFormChange: (form: NoteForm) => void;
  onSave: () => void;
  onDelete: () => void;
  onToggleMinimize: () => void;
  onClearHighlight: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  children?: React.ReactNode; // For AI actions slot
}

export function NoteEditor({
  form,
  selectedId,
  saving,
  isMinimized,
  highlightTerm,
  onFormChange,
  onSave,
  onDelete,
  onToggleMinimize,
  onClearHighlight,
  textareaRef: externalRef,
  children,
}: NoteEditorProps) {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalTextareaRef;

  // Markdown toolbar actions
  const insertMarkdown = useCallback((before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = form.content.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newContent = 
      form.content.substring(0, start) + 
      before + textToInsert + after + 
      form.content.substring(end);
    
    onFormChange({ ...form, content: newContent });

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(
        selectedText ? start + before.length : newCursorPos,
        selectedText ? start + before.length + selectedText.length : newCursorPos
      );
    }, 0);
  }, [form, onFormChange, textareaRef]);

  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const content = form.content;
    
    // Find the start of the current line
    let lineStart = start;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    const newContent = 
      content.substring(0, lineStart) + 
      prefix + 
      content.substring(lineStart);
    
    onFormChange({ ...form, content: newContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  }, [form, onFormChange, textareaRef]);

  return (
    <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30 flex-shrink-0">
        <h2 className="text-sm font-medium">
          {selectedId ? 'Notiz bearbeiten' : 'Neue Notiz'}
        </h2>
        {selectedId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onToggleMinimize}
            title={isMinimized ? 'Erweitern' : 'Minimieren'}
          >
            {isMinimized ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {/* Highlight indicator */}
          {highlightTerm && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                Gefunden: <strong>&quot;{highlightTerm}&quot;</strong> - Text ist im Editor markiert
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-yellow-600 dark:text-yellow-400"
                onClick={onClearHighlight}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <Input
            placeholder="Titel"
            value={form.title}
            onChange={(e) => onFormChange({ ...form, title: e.target.value })}
          />
          
          {/* Collapsible content */}
          {!isMinimized && (
            <>
              {/* Markdown Toolbar */}
              <div className="flex items-center gap-0.5 p-1 bg-muted/30 rounded-md border border-border/60">
                <ToolbarButton 
                  icon={<Heading1 className="h-4 w-4" />} 
                  label="Überschrift 1" 
                  onClick={() => insertAtLineStart('# ')} 
                />
                <ToolbarButton 
                  icon={<Heading2 className="h-4 w-4" />} 
                  label="Überschrift 2" 
                  onClick={() => insertAtLineStart('## ')} 
                />
                <ToolbarButton 
                  icon={<Heading3 className="h-4 w-4" />} 
                  label="Überschrift 3" 
                  onClick={() => insertAtLineStart('### ')} 
                />
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarButton 
                  icon={<Bold className="h-4 w-4" />} 
                  label="Fett (Ctrl+B)" 
                  onClick={() => insertMarkdown('**', '**', 'fett')} 
                />
                <ToolbarButton 
                  icon={<Italic className="h-4 w-4" />} 
                  label="Kursiv (Ctrl+I)" 
                  onClick={() => insertMarkdown('*', '*', 'kursiv')} 
                />
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarButton 
                  icon={<List className="h-4 w-4" />} 
                  label="Liste" 
                  onClick={() => insertAtLineStart('- ')} 
                />
                <ToolbarButton 
                  icon={<ListOrdered className="h-4 w-4" />} 
                  label="Nummerierte Liste" 
                  onClick={() => insertAtLineStart('1. ')} 
                />
                <ToolbarButton 
                  icon={<Quote className="h-4 w-4" />} 
                  label="Zitat" 
                  onClick={() => insertAtLineStart('> ')} 
                />
                <div className="w-px h-5 bg-border mx-1" />
                <ToolbarButton 
                  icon={<Link2 className="h-4 w-4" />} 
                  label="[[Wikilink]]" 
                  onClick={() => insertMarkdown('[[', ']]', 'Notiz-Titel')} 
                />
                <ToolbarButton 
                  icon={<Hash className="h-4 w-4" />} 
                  label="#Tag" 
                  onClick={() => insertMarkdown('#', '', 'tag')} 
                />
              </div>
              
              <Textarea
                ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                placeholder="Inhalt (Markdown, [[Links]], #tags)"
                value={form.content}
                onChange={(e) => onFormChange({ ...form, content: e.target.value })}
                className="min-h-[140px] font-mono text-sm"
                onKeyDown={(e) => {
                  // Keyboard shortcuts
                  if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'b') {
                      e.preventDefault();
                      insertMarkdown('**', '**', 'fett');
                    } else if (e.key === 'i') {
                      e.preventDefault();
                      insertMarkdown('*', '*', 'kursiv');
                    }
                  }
                }}
              />
              
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onSave} disabled={saving}>
                  {saving ? 'Speichere...' : selectedId ? 'Änderungen speichern' : 'Notiz speichern'}
                </Button>
                {selectedId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDelete}
                    disabled={saving}
                  >
                    Löschen
                  </Button>
                )}
              </div>
              
              {/* AI Actions slot */}
              {children}
            </>
          )}
          
          {/* Minimized state indicator */}
          {isMinimized && selectedId && (
            <div className="text-xs text-muted-foreground text-center py-2 border-t border-border/60">
              Notiz minimiert • Klicke ↓ zum Erweitern
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

