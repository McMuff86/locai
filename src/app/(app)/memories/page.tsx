"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Search,
  Scissors,
  Loader2,
  Pencil,
  Clock,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemoryEntry, MemoryCategory, MemoryType } from "@/lib/memory/types";

// ── Helpers ─────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateHeader(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function dateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

const categoryColors: Record<string, string> = {
  fact: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  preference: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  project_context: "bg-green-500/20 text-green-400 border-green-500/30",
  instruction: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  general: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const typeColors: Record<string, string> = {
  conversation: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  agent: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  preference: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

type ViewMode = "list" | "timeline";

// ── Memory Card (shared between views) ──────────────────────────

function MemoryCard({
  mem,
  onEdit,
  onDelete,
}: {
  mem: MemoryEntry;
  onEdit: (m: MemoryEntry) => void;
  onDelete: (m: MemoryEntry) => void;
}) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(mem)}>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-sm font-semibold text-foreground">
                {mem.key}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${categoryColors[mem.category] ?? categoryColors.general}`}
              >
                {mem.category}
              </Badge>
              {mem.type && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${typeColors[mem.type] ?? ""}`}
                >
                  {mem.type}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {mem.value}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {mem.tags && mem.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {mem.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <span className="text-[11px] text-muted-foreground/60">
                {formatDate(mem.updatedAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(mem)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(mem)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Timeline View ───────────────────────────────────────────────

function TimelineView({
  memories,
  onEdit,
  onDelete,
}: {
  memories: MemoryEntry[];
  onEdit: (m: MemoryEntry) => void;
  onDelete: (m: MemoryEntry) => void;
}) {
  // Group by date (createdAt)
  const grouped = memories.reduce<Record<string, MemoryEntry[]>>((acc, mem) => {
    const dk = dateKey(mem.createdAt);
    if (!acc[dk]) acc[dk] = [];
    acc[dk].push(mem);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date} className="relative">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {formatDateHeader(grouped[date][0].createdAt)}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({grouped[date].length})
              </span>
            </div>
          </div>
          {/* Timeline line + cards */}
          <div className="ml-1.5 border-l-2 border-border/40 pl-5 space-y-2">
            {grouped[date]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((mem) => (
                <div key={mem.id} className="relative">
                  <div className="absolute -left-[1.65rem] top-4 h-2 w-2 rounded-full bg-muted-foreground/40" />
                  <MemoryCard mem={mem} onEdit={onEdit} onDelete={onDelete} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export default function MemoriesPage() {
  const { toast } = useToast();

  // State
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Edit state
  const [editTarget, setEditTarget] = useState<MemoryEntry | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formCategory, setFormCategory] = useState<MemoryCategory>("fact");
  const [formType, setFormType] = useState<MemoryType>("conversation");
  const [formTags, setFormTags] = useState("");

  // Edit form
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryCategory>("fact");
  const [editTags, setEditTags] = useState("");

  // ── Fetch ───────────────────────────────────────────────────

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memories?limit=100");
      const data = await res.json();
      if (data.success) {
        const sorted = (data.data?.memories ?? []).sort(
          (a: MemoryEntry, b: MemoryEntry) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setMemories(sorted);
      }
    } catch {
      toast({ title: "Fehler", description: "Memories konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  // ── Search ──────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/memories/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
        const data = await res.json();
        if (data.success) {
          setMemories(data.data?.memories ?? []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchMemories]);

  // ── Create ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formKey.trim() || !formValue.trim()) return;
    setCreating(true);
    try {
      const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: formKey,
          value: formValue,
          category: formCategory,
          type: formType,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Memory erstellt", description: `"${formKey}" wurde gespeichert.` });
        setShowCreate(false);
        setFormKey("");
        setFormValue("");
        setFormTags("");
        fetchMemories();
      } else {
        toast({ title: "Fehler", description: data.error || "Erstellen fehlgeschlagen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler", description: "Erstellen fehlgeschlagen", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────

  const openEdit = (mem: MemoryEntry) => {
    setEditTarget(mem);
    setEditKey(mem.key);
    setEditValue(mem.value);
    setEditCategory(mem.category);
    setEditTags((mem.tags ?? []).join(", "));
  };

  const handleEdit = async () => {
    if (!editTarget || !editKey.trim() || !editValue.trim()) return;
    setSaving(true);
    try {
      const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/memories/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editKey,
          value: editValue,
          category: editCategory,
          tags: tags.length > 0 ? tags : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Memory aktualisiert", description: `"${editKey}" wurde gespeichert.` });
        setEditTarget(null);
        fetchMemories();
      } else {
        toast({ title: "Fehler", description: data.error || "Speichern fehlgeschlagen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memories/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Gelöscht", description: `"${deleteTarget.key}" wurde entfernt.` });
        setDeleteTarget(null);
        fetchMemories();
      } else {
        toast({ title: "Fehler", description: "Löschen fehlgeschlagen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Prune ───────────────────────────────────────────────────

  const handlePrune = async () => {
    setPruning(true);
    try {
      const res = await fetch("/api/memories/prune", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = data.data ?? {};
        toast({
          title: "Prune abgeschlossen",
          description: `${d.archived ?? 0} archiviert, ${d.remaining ?? 0} verbleibend.`,
        });
        fetchMemories();
      } else {
        toast({ title: "Fehler", description: "Prune fehlgeschlagen", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler", description: "Prune fehlgeschlagen", variant: "destructive" });
    } finally {
      setPruning(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 md:p-6 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Memories</h1>
            <p className="text-sm text-muted-foreground">
              {memories.length} {memories.length === 1 ? "Eintrag" : "Einträge"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-2.5"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-2.5"
              onClick={() => setViewMode("timeline")}
            >
              <Clock className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrune} disabled={pruning}>
            {pruning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Prune</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">Neu</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Semantische Suche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Memory List / Timeline */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? "Keine Ergebnisse gefunden" : "Noch keine Memories vorhanden"}
            </p>
          </div>
        ) : viewMode === "timeline" ? (
          <TimelineView memories={memories} onEdit={openEdit} onDelete={setDeleteTarget} />
        ) : (
          <div className="space-y-2">
            {memories.map((mem) => (
              <MemoryCard key={mem.id} mem={mem} onEdit={openEdit} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Memory erstellen</DialogTitle>
            <DialogDescription>
              Speichere ein neues Wissens-Fragment im Memory Store.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Key (z.B. user_preference_language)"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
            />
            <Textarea
              placeholder="Value — der eigentliche Inhalt"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as MemoryCategory)}>
                <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fact">Fact</SelectItem>
                  <SelectItem value="preference">Preference</SelectItem>
                  <SelectItem value="project_context">Project Context</SelectItem>
                  <SelectItem value="instruction">Instruction</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formType} onValueChange={(v) => setFormType(v as MemoryType)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversation">Conversation</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="preference">Preference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Tags (komma-getrennt)"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating || !formKey.trim() || !formValue.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Memory bearbeiten</DialogTitle>
            <DialogDescription>
              Ändere die Werte dieser Memory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Key"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
            />
            <Textarea
              placeholder="Value"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={3}
            />
            <Select value={editCategory} onValueChange={(v) => setEditCategory(v as MemoryCategory)}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fact">Fact</SelectItem>
                <SelectItem value="preference">Preference</SelectItem>
                <SelectItem value="project_context">Project Context</SelectItem>
                <SelectItem value="instruction">Instruction</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Tags (komma-getrennt)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editKey.trim() || !editValue.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Memory löschen?</DialogTitle>
            <DialogDescription>
              Möchtest du <strong>&quot;{deleteTarget?.key}&quot;</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
