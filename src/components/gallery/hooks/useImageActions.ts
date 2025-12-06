"use client";

import { useState, useCallback } from 'react';
import { ImageInfo, GalleryConfig } from '../types';

interface UseImageActionsReturn {
  isDeleting: boolean;
  isCopying: boolean;
  deleteImage: (image: ImageInfo) => Promise<boolean>;
  copyToInput: (image: ImageInfo) => Promise<{ success: boolean; filename?: string; error?: string }>;
  downloadImage: (image: ImageInfo) => Promise<void>;
}

export function useImageActions(
  config: GalleryConfig,
  getImageUrl: (image: ImageInfo) => string
): UseImageActionsReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  
  // Extract values to use as stable dependencies
  const { comfyUIPath, outputPath } = config;

  const deleteImage = useCallback(async (image: ImageInfo): Promise<boolean> => {
    setIsDeleting(true);
    
    try {
      const params = new URLSearchParams({ id: image.id });
      if (outputPath) params.set('outputPath', outputPath);
      if (comfyUIPath) params.set('comfyUIPath', comfyUIPath);
      
      const response = await fetch(`/api/comfyui/gallery/delete?${params}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      return data.success;
    } catch (err) {
      console.error('Failed to delete image:', err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [comfyUIPath, outputPath]); // Use primitive values

  const copyToInput = useCallback(async (image: ImageInfo): Promise<{ success: boolean; filename?: string; error?: string }> => {
    setIsCopying(true);
    
    try {
      const response = await fetch('/api/comfyui/gallery/copy-to-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: image.id,
          outputPath,
          comfyUIPath,
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        return { success: true, filename: data.inputFilename };
      } else {
        return { success: false, error: data.error || 'Unbekannter Fehler' };
      }
    } catch (err) {
      console.error('Failed to copy to input:', err);
      return { success: false, error: 'Verbindungsfehler' };
    } finally {
      setIsCopying(false);
    }
  }, [comfyUIPath, outputPath]); // Use primitive values

  const downloadImage = useCallback(async (image: ImageInfo): Promise<void> => {
    const url = getImageUrl(image);
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = image.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, [getImageUrl]);

  return {
    isDeleting,
    isCopying,
    deleteImage,
    copyToInput,
    downloadImage,
  };
}

