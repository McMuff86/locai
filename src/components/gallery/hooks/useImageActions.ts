"use client";

import { useState, useCallback } from 'react';
import { ImageInfo, GalleryConfig } from '../types';

interface UploadResult {
  success: boolean;
  uploaded: number;
  rejected: number;
  error?: string;
}

interface UseImageActionsReturn {
  isDeleting: boolean;
  isCopying: boolean;
  isUploading: boolean;
  deleteImage: (image: ImageInfo) => Promise<boolean>;
  copyToInput: (image: ImageInfo) => Promise<{ success: boolean; filename?: string; error?: string }>;
  downloadImage: (image: ImageInfo) => Promise<void>;
  uploadToGallery: (files: File[]) => Promise<UploadResult>;
}

export function useImageActions(
  config: GalleryConfig,
  getImageUrl: (image: ImageInfo) => string
): UseImageActionsReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
  }, [comfyUIPath, outputPath]);

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
      }

      return { success: false, error: data.error || 'Unbekannter Fehler' };
    } catch (err) {
      console.error('Failed to copy to input:', err);
      return { success: false, error: 'Verbindungsfehler' };
    } finally {
      setIsCopying(false);
    }
  }, [comfyUIPath, outputPath]);

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

  const uploadToGallery = useCallback(async (files: File[]): Promise<UploadResult> => {
    if (files.length === 0) {
      return { success: false, uploaded: 0, rejected: 0, error: 'Keine Dateien gewählt' };
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      if (outputPath) formData.append('outputPath', outputPath);
      if (comfyUIPath) formData.append('comfyUIPath', comfyUIPath);
      for (const file of files) {
        formData.append('files', file);
      }

      const response = await fetch('/api/comfyui/gallery/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const uploaded = Array.isArray(data.uploaded) ? data.uploaded.length : 0;
      const rejected = Array.isArray(data.rejected) ? data.rejected.length : 0;

      if (!data.success && uploaded === 0) {
        return {
          success: false,
          uploaded,
          rejected,
          error: data.error || 'Upload fehlgeschlagen',
        };
      }

      return {
        success: uploaded > 0,
        uploaded,
        rejected,
      };
    } catch (err) {
      console.error('Failed to upload files to gallery:', err);
      return { success: false, uploaded: 0, rejected: files.length, error: 'Verbindungsfehler' };
    } finally {
      setIsUploading(false);
    }
  }, [comfyUIPath, outputPath]);

  return {
    isDeleting,
    isCopying,
    isUploading,
    deleteImage,
    copyToInput,
    downloadImage,
    uploadToGallery,
  };
}
