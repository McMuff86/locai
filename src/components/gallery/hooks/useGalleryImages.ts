"use client";

import { useState, useCallback, useRef } from 'react';
import { ImageInfo, GalleryConfig } from '../types';

interface UseGalleryImagesReturn {
  images: ImageInfo[];
  isLoading: boolean;
  error: string | null;
  total: number;
  imageCount: number;
  videoCount: number;
  hasMore: boolean;
  fetchImages: (reset?: boolean) => Promise<void>;
  removeImage: (imageId: string) => void;
}

export function useGalleryImages(config: GalleryConfig): UseGalleryImagesReturn {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  
  const limit = 100;
  
  // Extract values to use as stable dependencies
  const { comfyUIPath, outputPath } = config;

  const fetchImages = useCallback(async (reset: boolean = false) => {
    if (!comfyUIPath && !outputPath) {
      setError('Kein Pfad konfiguriert');
      return;
    }

    setIsLoading(true);
    setError(null);

    const currentOffset = reset ? 0 : offsetRef.current;

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
        sortBy: 'modifiedAt',
        sortOrder: 'desc',
      });
      
      if (outputPath) {
        params.set('outputPath', outputPath);
      }
      if (comfyUIPath) {
        params.set('comfyUIPath', comfyUIPath);
      }

      const response = await fetch(`/api/comfyui/gallery?${params}`);
      const data = await response.json();

      if (data.success) {
        if (reset) {
          setImages(data.images);
          offsetRef.current = limit;
        } else {
          setImages(prev => [...prev, ...data.images]);
          offsetRef.current = currentOffset + limit;
        }
        setTotal(data.total);
        setImageCount(data.imageCount || 0);
        setVideoCount(data.videoCount || 0);
        setHasMore(data.hasMore);
      } else {
        setError(data.error || 'Fehler beim Laden der Bilder');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setIsLoading(false);
    }
  }, [comfyUIPath, outputPath]); // Use primitive values, not object

  const removeImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    setTotal(prev => prev - 1);
  }, []);

  return {
    images,
    isLoading,
    error,
    total,
    imageCount,
    videoCount,
    hasMore,
    fetchImages,
    removeImage,
  };
}

