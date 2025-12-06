"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface DeleteConfirmDialogProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-card p-6 rounded-lg shadow-xl max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Bild löschen?</h3>
        <p className="text-muted-foreground mb-4">
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Löschen
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

