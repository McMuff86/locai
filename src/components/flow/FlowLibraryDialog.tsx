"use client";

import React, { useMemo, useState } from 'react';
import { BookOpen, Layers, Search, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FLOW_TEMPLATES, type FlowTemplateId } from '@/lib/flow/registry';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Category mapping                                                    */
/* ------------------------------------------------------------------ */

type Category = 'Alle' | 'Analyse' | 'Kreativ' | 'RAG' | 'Utility';

const CATEGORY_MAP: Record<FlowTemplateId, Category> = {
  default: 'Utility',
  'pdf-processing': 'Analyse',
  'excel-processing': 'Analyse',
  'web-research': 'RAG',
  'code-review': 'Analyse',
  'content-creation': 'Kreativ',
  'music-generation': 'Kreativ',
  'data-pipeline': 'Utility',
};

const CATEGORY_COLORS: Record<Category, string> = {
  Alle: 'bg-white/10 text-white',
  Analyse: 'bg-cyan-500/20 text-cyan-300',
  Kreativ: 'bg-fuchsia-500/20 text-fuchsia-300',
  RAG: 'bg-emerald-500/20 text-emerald-300',
  Utility: 'bg-amber-500/20 text-amber-300',
};

const CATEGORIES: Category[] = ['Alle', 'Analyse', 'Kreativ', 'RAG', 'Utility'];

/* ------------------------------------------------------------------ */
/* Template Card                                                       */
/* ------------------------------------------------------------------ */

function TemplateCard({
  template,
  category,
  onUse,
}: {
  template: (typeof FLOW_TEMPLATES)[number];
  category: Category;
  onUse: () => void;
}) {
  const workflow = useMemo(() => template.create(), [template]);
  const nodeCount = workflow.nodes.length;
  const edgeCount = workflow.edges.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.08]"
    >
      {/* Category badge */}
      <span
        className={cn(
          'mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
          CATEGORY_COLORS[category],
        )}
      >
        {category}
      </span>

      {/* Title */}
      <h3 className="mb-1 text-sm font-semibold text-white">{template.name}</h3>

      {/* Description */}
      <p className="mb-3 flex-1 text-xs leading-relaxed text-white/60">{template.description}</p>

      {/* Stats row */}
      <div className="mb-3 flex items-center gap-3 text-[11px] text-white/40">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {nodeCount} Nodes
        </span>
        <span>{edgeCount} Edges</span>
      </div>

      {/* Use button */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-full gap-1.5 border-white/10 bg-white/5 text-xs hover:bg-white/10"
        onClick={onUse}
      >
        <Sparkles className="h-3 w-3" />
        Template verwenden
      </Button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* FlowLibraryDialog                                                   */
/* ------------------------------------------------------------------ */

interface FlowLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateId: FlowTemplateId) => void;
}

export function FlowLibraryDialog({ open, onOpenChange, onSelectTemplate }: FlowLibraryDialogProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('Alle');

  // Skip the "default" template (plain new flow)
  const templates = useMemo(() => FLOW_TEMPLATES.filter((t) => t.id !== 'default'), []);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const cat = CATEGORY_MAP[t.id];
      if (activeCategory !== 'Alle' && cat !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templates, activeCategory, search]);

  const handleUse = (templateId: FlowTemplateId) => {
    onSelectTemplate(templateId);
    onOpenChange(false);
    setSearch('');
    setActiveCategory('Alle');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden border-white/10 bg-gray-950/95 backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <BookOpen className="h-5 w-5 text-fuchsia-400" />
            Flow-Bibliothek
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Wähle ein vorgefertigtes Template als Startpunkt für deinen Flow.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            placeholder="Templates durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-white/30"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    category={CATEGORY_MAP[t.id]}
                    onUse={() => handleUse(t.id)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12 text-center text-sm text-white/30"
              >
                Keine Templates gefunden.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
