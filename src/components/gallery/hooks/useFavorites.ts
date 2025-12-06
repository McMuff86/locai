"use client";

import { useState, useEffect, useCallback } from 'react';
import { FAVORITES_KEY } from '../types';

interface UseFavoritesReturn {
  favorites: Set<string>;
  toggleFavorite: (imageId: string, e?: React.MouseEvent) => void;
  isFavorite: (imageId: string) => boolean;
  removeFavorite: (imageId: string) => void;
  favoriteCount: number;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFavorites(new Set(parsed));
      } catch (e) {
        console.error('Failed to load favorites:', e);
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
    setFavorites(newFavorites);
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
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
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
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
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

