"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Trash2, Edit3, Play, Pause, Loader2, Mic, Upload, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioRecorder } from './AudioRecorder';

interface Voice {
  id: string;
  name: string;
  description: string;
  referenceAudioPath: string;
  referenceText: string;
  createdAt: string;
  updatedAt: string;
}

interface VoiceLibraryProps {
  selectedVoiceId?: string | null;
  onSelectVoice?: (voice: Voice) => void;
}

export function VoiceLibrary({ selectedVoiceId, onSelectVoice }: VoiceLibraryProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Add voice dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newReferenceText, setNewReferenceText] = useState('');
  const [uploadedFilePath, setUploadedFilePath] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Edit dialog
  const [editVoice, setEditVoice] = useState<Voice | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReferenceText, setEditReferenceText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch('/api/voice-library');
      const data = await res.json();
      if (data.success) setVoices(data.voices);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVoices(); }, [fetchVoices]);

  const [uploadError, setUploadError] = useState('');

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/qwen-tts/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.filePath) {
        setUploadedFilePath(data.filePath);
        setUploadedFileName(file.name);
      } else {
        setUploadError(data.error || 'Upload fehlgeschlagen');
      }
    } catch (err) {
      setUploadError('Upload fehlgeschlagen – Verbindungsfehler');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!uploadedFilePath) return;
    setTranscribing(true);
    try {
      const res = await fetch('/api/qwen-tts/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setNewReferenceText(data.text);
      }
    } catch { /* ignore */ }
    finally { setTranscribing(false); }
  }, [uploadedFilePath]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !uploadedFilePath) return;
    setCreating(true);
    try {
      const res = await fetch('/api/voice-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
          referenceAudioPath: uploadedFilePath,
          referenceText: newReferenceText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddOpen(false);
        setNewName('');
        setNewDescription('');
        setNewReferenceText('');
        setUploadedFilePath('');
        setUploadedFileName('');
        fetchVoices();
      }
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }, [newName, newDescription, newReferenceText, uploadedFilePath, fetchVoices]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/voice-library/${id}`, { method: 'DELETE' });
      fetchVoices();
      if (selectedVoiceId === id) onSelectVoice?.(null as unknown as Voice);
    } catch { /* ignore */ }
  }, [fetchVoices, selectedVoiceId, onSelectVoice]);

  const handleUpdate = useCallback(async () => {
    if (!editVoice) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/voice-library/${editVoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          referenceText: editReferenceText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditVoice(null);
        fetchVoices();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [editVoice, editName, editDescription, editReferenceText, fetchVoices]);

  const togglePlay = useCallback((voiceId: string) => {
    if (playingId === voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(`/api/voice-library/${voiceId}/audio`);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(voiceId);
  }, [playingId]);

  const openEdit = useCallback((voice: Voice) => {
    setEditVoice(voice);
    setEditName(voice.name);
    setEditDescription(voice.description);
    setEditReferenceText(voice.referenceText);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stimmen-Bibliothek
          </h3>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Neue Stimme
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neue Stimme hinzufügen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <Input
                  placeholder="z.B. Meine Stimme"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Beschreibung</label>
                <Input
                  placeholder="Optionale Beschreibung"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Referenz-Audio *</label>
                {uploadError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-2">{uploadError}</div>
                )}
                {uploadedFileName ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="truncate">{uploadedFileName}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center justify-center gap-2 border border-dashed border-border/60 rounded-lg px-4 py-4 cursor-pointer hover:bg-muted/20 transition-colors">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {uploading ? 'Wird hochgeladen...' : 'Audio-Datei hochladen'}
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file);
                        }}
                      />
                    </label>
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                      </div>
                      <span className="relative bg-background px-2 text-[10px] text-muted-foreground/60 uppercase">oder</span>
                    </div>
                    <AudioRecorder
                      maxDuration={30}
                      onRecordingComplete={async (blob) => {
                        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
                        await handleUpload(file);
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Referenztext</label>
                  {uploadedFilePath && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={handleTranscribe}
                      disabled={transcribing}
                    >
                      {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Auto-Transkribieren
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Transkript des Referenz-Audios (optional, verbessert Qualität)"
                  value={newReferenceText}
                  onChange={(e) => setNewReferenceText(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || !uploadedFilePath || creating}
                className="gap-1.5"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Stimme speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editVoice} onOpenChange={(open) => { if (!open) setEditVoice(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stimme bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Beschreibung</label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Referenztext</label>
              <Textarea
                value={editReferenceText}
                onChange={(e) => setEditReferenceText(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice List */}
      <ScrollArea className="h-[300px]">
        <AnimatePresence mode="popLayout">
          {voices.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Mic className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Noch keine Stimmen gespeichert</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Füge eine Referenz-Audiodatei hinzu, um Voice Cloning zu nutzen.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {voices.map((voice) => (
                <motion.div
                  key={voice.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`
                    group flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                    ${selectedVoiceId === voice.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/40 bg-background/40 hover:bg-muted/30'
                    }
                  `}
                  onClick={() => onSelectVoice?.(voice)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePlay(voice.id); }}
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-muted/50 hover:bg-primary/10 transition-colors"
                  >
                    {playingId === voice.id ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{voice.name}</p>
                    {voice.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{voice.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(voice); }}
                      className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(voice.id); }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>

                  {selectedVoiceId === voice.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
