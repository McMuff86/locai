"use client";

import React from 'react';
import { useMigration } from '@/hooks/useMigration';
import { Button } from '@/components/ui/button';
import { Loader2, X, Database, CheckCircle2 } from 'lucide-react';

export function MigrationBanner() {
  const { needsMigration, isMigrating, migrationResult, startMigration, dismissMigration } = useMigration();

  // Show success result briefly
  if (migrationResult?.success) {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-emerald-400">Migration erfolgreich!</span>
            <span className="text-muted-foreground ml-2">
              {migrationResult.conversations} Konversationen migriert.
              Daten sind jetzt auf dem Filesystem gespeichert.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show error result
  if (migrationResult && !migrationResult.success) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Database className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 text-sm text-red-400">
            Migration fehlgeschlagen. Bitte versuche es erneut.
          </div>
          <Button variant="ghost" size="sm" onClick={dismissMigration}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!needsMigration) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/30 px-4 py-3">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        <Database className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-medium">Lokale Daten gefunden!</span>
          <span className="text-muted-foreground ml-2">
            Deine Konversationen und Einstellungen können auf das Filesystem migriert werden.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={startMigration}
            disabled={isMigrating}
          >
            {isMigrating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Migriere...
              </>
            ) : (
              'Jetzt migrieren'
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissMigration} disabled={isMigrating}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
