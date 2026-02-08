"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload } from 'lucide-react';
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
  isOpen = true,
  onClose,
  onAnalyzeImage,
  onShowToast,
  standalone = false
}: ImageGalleryProps) {
  // Config object for hooks
  const config: GalleryConfig = { comfyUIPath: comfyUIPath || '', outputPath };
  
  // State
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showMetadata, setShowMetadata] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Hooks
  const { 
    images, 
    isLoading, 
    error, 
    total,
    imageCount,
    videoCount,
    hasMore, 
    fetchImages, 
    removeImage 
  } = useGalleryImages(config);
  
  const { 
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
    isUploading,
    deleteImage: performDelete, 
    copyToInput: performCopy, 
    downloadImage,
    uploadToGallery,
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
        } else if (onClose) {
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
      onClose?.();
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const hasFiles = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const result = await uploadToGallery(files);
    if (result.success) {
      await fetchImages(true);
      onShowToast?.(
        'Upload abgeschlossen',
        `${result.uploaded} Datei(en) hochgeladen${result.rejected > 0 ? `, ${result.rejected} abgelehnt` : ''}.`,
      );
    } else {
      onShowToast?.('Upload fehlgeschlagen', result.error || 'Dateien konnten nicht importiert werden.', 'destructive');
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
        imageCount={imageCount}
        videoCount={videoCount}
        onFilterChange={setFilterMode}
        onGridSizeChange={setGridSize}
        onRefresh={() => fetchImages(true)}
        onClose={standalone ? undefined : onClose}
      />
      
      {/* Gallery Content */}
      <div
        className="relative flex-1 min-h-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ScrollArea className={standalone ? "h-[calc(100vh-140px)]" : "h-[calc(100vh-73px)]"}>
          <div className="p-4">
            {isUploading && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 text-primary px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Dateien werden importiert...
              </div>
            )}
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

        {isDragOver && (
          <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-primary bg-background/90 px-3 py-2 rounded-md border border-primary/30">
              <Upload className="h-4 w-4" />
              Dateien loslassen, um sie zur Galerie hinzuzufügen
            </div>
          </div>
        )}
      </div>
      
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
