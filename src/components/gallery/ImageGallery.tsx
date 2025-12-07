"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { ImageGridSkeleton } from '../ui/skeleton';

import { ImageInfo, GridSize, FilterMode, GRID_CLASSES, GalleryConfig } from './types';
import { useGalleryImages, useFavorites, useImageMetadata, useImageActions } from './hooks';
import { GalleryHeader } from './GalleryHeader';
import { ImageCard } from './ImageCard';
import { Lightbox } from './Lightbox';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { EmptyState } from './EmptyState';

interface ImageGalleryProps {
  comfyUIPath?: string;
  outputPath?: string;
  inputPath?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onAnalyzeImage?: (imageUrl: string, filename: string) => void;
  onShowToast?: (title: string, description: string, variant?: 'default' | 'destructive') => void;
  /** Standalone mode (no modal wrapper) */
  standalone?: boolean;
}

export function ImageGallery({ 
  comfyUIPath, 
  outputPath,
  inputPath,
  isOpen = true,
  onClose,
  onAnalyzeImage,
  onShowToast,
  standalone = false
}: ImageGalleryProps) {
  // Config object for hooks
  const config: GalleryConfig = { comfyUIPath: comfyUIPath || '', outputPath };
  
  // Use inputPath if provided, otherwise derive from comfyUIPath
  const actualInputPath = inputPath || (comfyUIPath ? `${comfyUIPath}\\ComfyUI\\input` : undefined);
  
  // State
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showMetadata, setShowMetadata] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Hooks
  const { 
    images, 
    isLoading, 
    error, 
    total, 
    hasMore, 
    fetchImages, 
    removeImage 
  } = useGalleryImages(config);
  
  const { 
    favorites, 
    toggleFavorite, 
    isFavorite, 
    removeFavorite,
    favoriteCount 
  } = useFavorites();
  
  const { 
    metadata, 
    isLoading: isLoadingMetadata, 
    fetchMetadata, 
    clearMetadata 
  } = useImageMetadata(config);
  
  // Get image URL helper
  const getImageUrl = useCallback((image: ImageInfo, thumbnail: boolean = false) => {
    const params = new URLSearchParams();
    if (outputPath) params.set('outputPath', outputPath);
    if (comfyUIPath) params.set('comfyUIPath', comfyUIPath);
    if (thumbnail) params.set('thumbnail', 'true');
    return `/api/comfyui/gallery/${image.id}?${params}`;
  }, [comfyUIPath, outputPath]);
  
  const { 
    isDeleting, 
    isCopying, 
    deleteImage: performDelete, 
    copyToInput: performCopy, 
    downloadImage 
  } = useImageActions(config, getImageUrl);

  // Filtered images
  const displayImages = filterMode === 'favorites' 
    ? images.filter(img => isFavorite(img.id))
    : images;

  // Initial load
  useEffect(() => {
    if (isOpen && (comfyUIPath || outputPath)) {
      fetchImages(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, comfyUIPath, outputPath]); // fetchImages is stable now

  // Load metadata when image is selected
  useEffect(() => {
    if (selectedImage) {
      fetchMetadata(selectedImage);
    } else {
      clearMetadata();
      setShowMetadata(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage]); // fetchMetadata and clearMetadata are stable

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (showMetadata) {
          setShowMetadata(false);
        } else if (selectedImage) {
          setSelectedImage(null);
        } else {
          onClose();
        }
      }
      
      if (selectedImage) {
        if (e.key === 'ArrowLeft') navigateLightbox('prev');
        if (e.key === 'ArrowRight') navigateLightbox('next');
        if (e.key === 'f' || e.key === 'F') toggleFavorite(selectedImage.id);
        if (e.key === 'i' || e.key === 'I') setShowMetadata(!showMetadata);
        if (e.key === 'Delete' && !deleteConfirm) setDeleteConfirm(selectedImage.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedImage, showMetadata, deleteConfirm, toggleFavorite]);

  // Navigate lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    
    const currentIndex = displayImages.findIndex(img => img.id === selectedImage.id);
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : displayImages.length - 1;
    } else {
      newIndex = currentIndex < displayImages.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedImage(displayImages[newIndex]);
  };

  // Handle delete
  const handleDelete = async (image: ImageInfo) => {
    const success = await performDelete(image);
    if (success) {
      removeImage(image.id);
      removeFavorite(image.id);
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
    }
    setDeleteConfirm(null);
  };

  // Handle copy to input
  const handleCopyToInput = async (image: ImageInfo) => {
    const result = await performCopy(image);
    if (result.success && onShowToast) {
      onShowToast(
        'Bild kopiert zu ComfyUI Input',
        `Datei: ${result.filename}\nPfad: ComfyUI/input/`
      );
    } else if (!result.success && onShowToast) {
      onShowToast('Fehler beim Kopieren', result.error || 'Unbekannter Fehler', 'destructive');
    }
  };

  // Handle analyze
  const handleAnalyze = (image: ImageInfo) => {
    if (onAnalyzeImage) {
      onAnalyzeImage(getImageUrl(image), image.filename);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Gallery content (shared between modal and standalone)
  const galleryContent = (
    <>
      {/* Header */}
      <GalleryHeader
        total={total}
        filterMode={filterMode}
        gridSize={gridSize}
        favoriteCount={favoriteCount}
        isLoading={isLoading}
        displayCount={displayImages.length}
        onFilterChange={setFilterMode}
        onGridSizeChange={setGridSize}
        onRefresh={() => fetchImages(true)}
        onClose={standalone ? undefined : onClose}
      />
      
      {/* Gallery Content */}
      <ScrollArea className={standalone ? "h-[calc(100vh-140px)]" : "h-[calc(100vh-73px)]"}>
        <div className="p-4">
          {error ? (
            <EmptyState 
              type="error" 
              errorMessage={error} 
              onRetry={() => fetchImages(true)} 
            />
          ) : displayImages.length === 0 && !isLoading ? (
            <EmptyState type="empty" filterMode={filterMode} />
          ) : (
            <>
              {/* Image Grid */}
              <div className={`grid ${GRID_CLASSES[gridSize]}`}>
                {displayImages.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    imageUrl={getImageUrl(image)}
                    gridSize={gridSize}
                    isFavorite={isFavorite(image.id)}
                    onSelect={() => setSelectedImage(image)}
                    onToggleFavorite={(e) => toggleFavorite(image.id, e)}
                    onDelete={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(image.id);
                    }}
                  />
                ))}
              </div>
              
              {/* Load More */}
              {hasMore && filterMode === 'all' && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => fetchImages(false)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Laden...
                      </>
                    ) : (
                      `Mehr laden (${images.length} von ${total})`
                    )}
                  </Button>
                </div>
              )}
              
              {/* Loading skeleton */}
              {isLoading && images.length === 0 && (
                <ImageGridSkeleton count={24} />
              )}
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <DeleteConfirmDialog
            isDeleting={isDeleting}
            onConfirm={() => {
              const imageToDelete = images.find(img => img.id === deleteConfirm);
              if (imageToDelete) handleDelete(imageToDelete);
            }}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <Lightbox
            image={selectedImage}
            imageUrl={getImageUrl(selectedImage)}
            isFavorite={isFavorite(selectedImage.id)}
            metadata={metadata}
            isLoadingMetadata={isLoadingMetadata}
            showMetadata={showMetadata}
            isCopying={isCopying}
            canAnalyze={!!onAnalyzeImage}
            onClose={() => setSelectedImage(null)}
            onPrev={() => navigateLightbox('prev')}
            onNext={() => navigateLightbox('next')}
            onToggleFavorite={() => toggleFavorite(selectedImage.id)}
            onToggleMetadata={() => setShowMetadata(!showMetadata)}
            onAnalyze={() => handleAnalyze(selectedImage)}
            onCopyToInput={() => handleCopyToInput(selectedImage)}
            onDownload={() => downloadImage(selectedImage)}
            onDelete={() => setDeleteConfirm(selectedImage.id)}
          />
        )}
      </AnimatePresence>
    </>
  );

  // Standalone mode - no modal wrapper
  if (standalone) {
    return <div className="h-full flex flex-col">{galleryContent}</div>;
  }

  // Modal mode
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
      >
        {galleryContent}
      </motion.div>
    </AnimatePresence>
  );
}

export default ImageGallery;

