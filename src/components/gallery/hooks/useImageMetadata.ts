"use client";

import { useState, useCallback } from 'react';
import { ImageInfo, ImageMetadata, GalleryConfig } from '../types';

interface UseImageMetadataReturn {
  metadata: ImageMetadata | null;
  isLoading: boolean;
  fetchMetadata: (image: ImageInfo) => Promise<void>;
  clearMetadata: () => void;
}

export function useImageMetadata(config: GalleryConfig): UseImageMetadataReturn {
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract values to use as stable dependencies
  const { comfyUIPath, outputPath } = config;

  const fetchMetadata = useCallback(async (image: ImageInfo) => {
    setIsLoading(true);
    setMetadata(null);
    
    try {
      const params = new URLSearchParams({ id: image.id });
      if (outputPath) params.set('outputPath', outputPath);
      if (comfyUIPath) params.set('comfyUIPath', comfyUIPath);
      
      const response = await fetch(`/api/comfyui/gallery/metadata?${params}`);
      const data = await response.json();
      
      if (data.success && data.hasMetadata) {
        setMetadata(data.info);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    } finally {
      setIsLoading(false);
    }
  }, [comfyUIPath, outputPath]); // Use primitive values, not object

  const clearMetadata = useCallback(() => {
    setMetadata(null);
  }, []);

  return {
    metadata,
    isLoading,
    fetchMetadata,
    clearMetadata,
  };
}

