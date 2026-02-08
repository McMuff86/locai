"use client";

import { useState, useEffect, useCallback } from 'react';

const MIGRATION_FLAG = 'locai-migration-complete';
const CONVERSATIONS_KEY = 'locai-conversations';
const SETTINGS_KEY = 'locai-settings';
const FAVORITES_KEY = 'locai-gallery-favorites';
const KG_SETTINGS_KEY = 'locai-kg-settings';

export interface UseMigrationReturn {
  needsMigration: boolean;
  isMigrating: boolean;
  migrationResult: MigrationResult | null;
  startMigration: () => Promise<void>;
  dismissMigration: () => void;
}

interface MigrationResult {
  success: boolean;
  conversations: number;
  settings: boolean;
  favorites: boolean;
  graphSettings: boolean;
}

export function useMigration(): UseMigrationReturn {
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  // Check if migration is needed on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG) === 'true';
    if (alreadyMigrated) return;

    // Check if any data exists in localStorage
    const hasConversations = !!localStorage.getItem(CONVERSATIONS_KEY);
    const hasSettings = !!localStorage.getItem(SETTINGS_KEY);
    const hasFavorites = !!localStorage.getItem(FAVORITES_KEY);
    const hasGraphSettings = !!localStorage.getItem(KG_SETTINGS_KEY);

    if (hasConversations || hasSettings || hasFavorites || hasGraphSettings) {
      setNeedsMigration(true);
    }
  }, []);

  const startMigration = useCallback(async () => {
    setIsMigrating(true);

    try {
      // Read all localStorage data
      const conversationsRaw = localStorage.getItem(CONVERSATIONS_KEY);
      const settingsRaw = localStorage.getItem(SETTINGS_KEY);
      const favoritesRaw = localStorage.getItem(FAVORITES_KEY);
      const graphSettingsRaw = localStorage.getItem(KG_SETTINGS_KEY);

      const payload: Record<string, unknown> = {};

      if (conversationsRaw) {
        try {
          payload.conversations = JSON.parse(conversationsRaw);
        } catch { /* skip invalid data */ }
      }

      if (settingsRaw) {
        try {
          payload.settings = JSON.parse(settingsRaw);
        } catch { /* skip */ }
      }

      if (favoritesRaw) {
        try {
          payload.favorites = JSON.parse(favoritesRaw);
        } catch { /* skip */ }
      }

      if (graphSettingsRaw) {
        try {
          payload.graphSettings = JSON.parse(graphSettingsRaw);
        } catch { /* skip */ }
      }

      // Send to server
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const result: MigrationResult = {
          success: true,
          conversations: data.results?.conversations ?? 0,
          settings: data.results?.settings ?? false,
          favorites: data.results?.favorites ?? false,
          graphSettings: data.results?.graphSettings ?? false,
        };

        setMigrationResult(result);

        // Mark migration as complete
        localStorage.setItem(MIGRATION_FLAG, 'true');
        setNeedsMigration(false);
      } else {
        setMigrationResult({
          success: false,
          conversations: 0,
          settings: false,
          favorites: false,
          graphSettings: false,
        });
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationResult({
        success: false,
        conversations: 0,
        settings: false,
        favorites: false,
        graphSettings: false,
      });
    } finally {
      setIsMigrating(false);
    }
  }, []);

  const dismissMigration = useCallback(() => {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    setNeedsMigration(false);
  }, []);

  return {
    needsMigration,
    isMigrating,
    migrationResult,
    startMigration,
    dismissMigration,
  };
}
