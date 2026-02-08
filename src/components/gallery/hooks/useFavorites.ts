"use client";

import { useState, useEffect, useCallback } from 'react';

interface UseFavoritesReturn {
  favorites: Set<string>;
  toggleFavorite: (imageId: string, e?: React.MouseEvent) => void;
  isFavorite: (imageId: string) => boolean;
  removeFavorite: (imageId: string) => void;
  favoriteCount: number;
}

async function loadFavoritesFromServer(): Promise<string[]> {
  try {
    const res = await fetch('/api/preferences/favorites');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.favorites) ? data.favorites : [];
  } catch {
    return [];
  }
}

async function saveFavoritesToServer(favorites: string[]): Promise<void> {
  try {
    await fetch('/api/preferences/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites }),
    });
  } catch {
    console.error('Failed to save favorites to server');
  }
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from server on mount
  useEffect(() => {
    loadFavoritesFromServer().then(items => {
      setFavorites(new Set(items));
    });
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback((imageId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(imageId)) {
        newFavorites.delete(imageId);
      } else {
        newFavorites.add(imageId);
      }
      saveFavoritesToServer([...newFavorites]);
      return newFavorites;
    });
  }, []);

  // Check if an image is favorited
  const isFavorite = useCallback((imageId: string) => {
    return favorites.has(imageId);
  }, [favorites]);

  // Remove from favorites
  const removeFavorite = useCallback((imageId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      newFavorites.delete(imageId);
      saveFavoritesToServer([...newFavorites]);
      return newFavorites;
    });
  }, []);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    removeFavorite,
    favoriteCount: favorites.size,
  };
}
