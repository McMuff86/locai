"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  ImageIcon,
  Calendar,
  HardDrive,
  RefreshCw,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  FolderOpen,
  Star,
  Trash2,
  Info,
  Wand2,
  ArrowUpFromLine,
  Filter,
  Copy,
  Check,
  Eye
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ImageGridSkeleton } from './ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ImageInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
}

interface ImageMetadata {
  positivePrompt?: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  model?: string;
  width?: number;
  height?: number;
}

interface ImageGalleryProps {
  comfyUIPath: string;
  outputPath?: string;
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeImage?: (imageUrl: string, filename: string) => void;
  onShowToast?: (title: string, description: string, variant?: 'default' | 'destructive') => void;
}

type GridSize = 'tiny' | 'small' | 'medium' | 'large';
type FilterMode = 'all' | 'favorites';

// LocalStorage key for favorites
const FAVORITES_KEY = 'locai-gallery-favorites';

export function ImageGallery({ 
  comfyUIPath, 
  outputPath,
  isOpen, 
  onClose,
  onAnalyzeImage,
  onShowToast
}: ImageGalleryProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 100;
  
  // New state for features
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage
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
  const saveFavorites = (newFavorites: Set<string>) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
    setFavorites(newFavorites);
  };

  // Toggle favorite
  const toggleFavorite = (imageId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newFavorites = new Set(favorites);
    if (newFavorites.has(imageId)) {
      newFavorites.delete(imageId);
    } else {
      newFavorites.add(imageId);
    }
    saveFavorites(newFavorites);
  };

  // Fetch images
  const fetchImages = useCallback(async (reset: boolean = false) => {
    if (!comfyUIPath && !outputPath) {
      setError('Kein Pfad konfiguriert');
      return;
    }

    setIsLoading(true);
    setError(null);

    const currentOffset = reset ? 0 : offset;

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
          setOffset(limit);
        } else {
          setImages(prev => [...prev, ...data.images]);
          setOffset(currentOffset + limit);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
      } else {
        setError(data.error || 'Fehler beim Laden der Bilder');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setIsLoading(false);
    }
  }, [comfyUIPath, outputPath, offset]);

  // Fetch metadata for selected image
  const fetchMetadata = useCallback(async (image: ImageInfo) => {
    setIsLoadingMetadata(true);
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
      setIsLoadingMetadata(false);
    }
  }, [comfyUIPath, outputPath]);

  // Delete image
  const deleteImage = async (image: ImageInfo) => {
    setIsDeleting(true);
    
    try {
      const params = new URLSearchParams({ id: image.id });
      if (outputPath) params.set('outputPath', outputPath);
      if (comfyUIPath) params.set('comfyUIPath', comfyUIPath);
      
      const response = await fetch(`/api/comfyui/gallery/delete?${params}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        // Remove from local state
        setImages(prev => prev.filter(img => img.id !== image.id));
        setTotal(prev => prev - 1);
        
        // Remove from favorites if present
        if (favorites.has(image.id)) {
          const newFavorites = new Set(favorites);
          newFavorites.delete(image.id);
          saveFavorites(newFavorites);
        }
        
        // Close lightbox if deleting current image
        if (selectedImage?.id === image.id) {
          setSelectedImage(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // Copy to ComfyUI input
  const copyToInput = async (image: ImageInfo) => {
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
        // Show success feedback with toast
        if (onShowToast) {
          onShowToast(
            'Bild kopiert zu ComfyUI Input',
            `Datei: ${data.inputFilename}\nPfad: ComfyUI/input/`
          );
        }
      } else {
        if (onShowToast) {
          onShowToast('Fehler beim Kopieren', data.error || 'Unbekannter Fehler', 'destructive');
        }
      }
    } catch (err) {
      console.error('Failed to copy to input:', err);
      if (onShowToast) {
        onShowToast('Fehler beim Kopieren', 'Verbindungsfehler', 'destructive');
      }
    } finally {
      setIsCopying(false);
    }
  };

  // Copy prompt to clipboard
  const copyPrompt = async () => {
    if (metadata?.positivePrompt) {
      await navigator.clipboard.writeText(metadata.positivePrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  // Analyze image with vision model
  const analyzeImage = (image: ImageInfo) => {
    if (onAnalyzeImage) {
      const imageUrl = getImageUrl(image);
      onAnalyzeImage(imageUrl, image.filename);
      onClose();
    }
  };

  // Initial load
  useEffect(() => {
    if (isOpen && comfyUIPath) {
      fetchImages(true);
    }
  }, [isOpen, comfyUIPath]);

  // Load metadata when image is selected
  useEffect(() => {
    if (selectedImage) {
      fetchMetadata(selectedImage);
    } else {
      setMetadata(null);
      setShowMetadata(false);
    }
  }, [selectedImage, fetchMetadata]);

  // Get image URL
  const getImageUrl = (image: ImageInfo, thumbnail: boolean = false) => {
    const params = new URLSearchParams();
    if (outputPath) params.set('outputPath', outputPath);
    if (comfyUIPath) params.set('comfyUIPath', comfyUIPath);
    if (thumbnail) params.set('thumbnail', 'true');
    return `/api/comfyui/gallery/${image.id}?${params}`;
  };

  // Download image
  const downloadImage = async (image: ImageInfo) => {
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
  };

  // Navigate lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    
    const displayImages = filterMode === 'favorites' 
      ? images.filter(img => favorites.has(img.id))
      : images;
    
    const currentIndex = displayImages.findIndex(img => img.id === selectedImage.id);
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : displayImages.length - 1;
    } else {
      newIndex = currentIndex < displayImages.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedImage(displayImages[newIndex]);
  };

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
  }, [isOpen, selectedImage, showMetadata, deleteConfirm]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Grid classes
  const gridClasses = {
    tiny: 'grid-cols-6 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1',
    small: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5',
    medium: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2',
    large: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3',
  };

  // Filtered images
  const displayImages = filterMode === 'favorites' 
    ? images.filter(img => favorites.has(img.id))
    : images;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">ComfyUI Gallery</h2>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {filterMode === 'favorites' 
                ? `${displayImages.length} Favoriten`
                : `${total} Bilder`
              }
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={filterMode === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3"
                onClick={() => setFilterMode('all')}
              >
                Alle
              </Button>
              <Button
                variant={filterMode === 'favorites' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3"
                onClick={() => setFilterMode('favorites')}
              >
                <Star className="h-3.5 w-3.5 mr-1 fill-current" />
                Favoriten ({favorites.size})
              </Button>
            </div>
            
            {/* Grid Size Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
              <Button
                variant={gridSize === 'tiny' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setGridSize('tiny')}
                title="Sehr klein (max. Bilder)"
              >
                XS
              </Button>
              <Button
                variant={gridSize === 'small' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('small')}
                title="Klein"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === 'medium' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('medium')}
                title="Mittel"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === 'large' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('large')}
                title="Groß"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchImages(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            
            {/* Close */}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Gallery Content */}
        <ScrollArea className="h-[calc(100vh-73px)]" ref={scrollRef}>
          <div className="p-4">
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg mb-2">Fehler beim Laden</p>
                <p className="text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => fetchImages(true)}
                >
                  Erneut versuchen
                </Button>
              </div>
            ) : displayImages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg mb-2">
                  {filterMode === 'favorites' ? 'Keine Favoriten' : 'Keine Bilder gefunden'}
                </p>
                <p className="text-sm">
                  {filterMode === 'favorites' 
                    ? 'Klicke auf den Stern um Bilder zu favorisieren'
                    : 'Der Output-Ordner ist leer'
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Image Grid */}
                <div className={`grid ${gridClasses[gridSize]}`}>
                  {displayImages.map((image) => (
                    <motion.div
                      key={image.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    >
                      <img
                        src={getImageUrl(image)}
                        alt={image.filename}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      
                      {/* Favorite indicator */}
                      {favorites.has(image.id) && (
                        <div className="absolute top-1 left-1 z-10">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                        </div>
                      )}
                      
                      {/* Quick actions on hover */}
                      <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between ${gridSize === 'tiny' ? 'p-0.5' : 'p-2'}`}>
                        {/* Top actions */}
                        {gridSize !== 'tiny' && (
                          <div className="flex justify-end gap-1">
                            <button
                              className={`p-1 rounded hover:bg-white/20 transition-colors ${favorites.has(image.id) ? 'text-yellow-400' : 'text-white'}`}
                              onClick={(e) => toggleFavorite(image.id, e)}
                              title="Favorit"
                            >
                              <Star className={`h-4 w-4 ${favorites.has(image.id) ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-white/20 transition-colors text-white hover:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(image.id);
                              }}
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        
                        {/* Bottom info */}
                        {gridSize !== 'tiny' && (
                          <div>
                            <p className="text-white text-xs truncate">{image.filename}</p>
                            <p className="text-white/70 text-xs">
                              {formatDistanceToNow(new Date(image.modifiedAt), { addSuffix: true, locale: de })}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-card p-6 rounded-lg shadow-xl max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-2">Bild löschen?</h3>
                <p className="text-muted-foreground mb-4">
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const imageToDelete = images.find(img => img.id === deleteConfirm);
                      if (imageToDelete) deleteImage(imageToDelete);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Löschen
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Lightbox */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center"
              onClick={() => setSelectedImage(null)}
            >
              {/* Navigation Arrows */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
              
              {/* Image */}
              <motion.img
                key={selectedImage.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                src={getImageUrl(selectedImage)}
                alt={selectedImage.filename}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Metadata Panel */}
              <AnimatePresence>
                {showMetadata && (
                  <motion.div
                    initial={{ opacity: 0, x: 300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 300 }}
                    className="absolute right-0 top-0 bottom-0 w-96 bg-card/95 backdrop-blur-sm overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold">Metadaten</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMetadata(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {isLoadingMetadata ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : metadata ? (
                        <>
                          {/* Positive Prompt */}
                          {metadata.positivePrompt && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium text-muted-foreground">
                                  Prompt
                                </label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={copyPrompt}
                                >
                                  {copiedPrompt ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-sm bg-muted p-2 rounded max-h-32 overflow-y-auto">
                                {metadata.positivePrompt}
                              </p>
                            </div>
                          )}
                          
                          {/* Negative Prompt */}
                          {metadata.negativePrompt && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Negative Prompt
                              </label>
                              <p className="text-sm bg-muted p-2 rounded max-h-24 overflow-y-auto text-muted-foreground">
                                {metadata.negativePrompt}
                              </p>
                            </div>
                          )}
                          
                          {/* Generation Settings */}
                          <div className="grid grid-cols-2 gap-2">
                            {metadata.model && (
                              <div className="col-span-2">
                                <label className="text-xs text-muted-foreground">Model</label>
                                <p className="text-sm truncate">{metadata.model}</p>
                              </div>
                            )}
                            {metadata.seed !== undefined && (
                              <div>
                                <label className="text-xs text-muted-foreground">Seed</label>
                                <p className="text-sm font-mono">{metadata.seed}</p>
                              </div>
                            )}
                            {metadata.steps !== undefined && (
                              <div>
                                <label className="text-xs text-muted-foreground">Steps</label>
                                <p className="text-sm">{metadata.steps}</p>
                              </div>
                            )}
                            {metadata.cfg !== undefined && (
                              <div>
                                <label className="text-xs text-muted-foreground">CFG Scale</label>
                                <p className="text-sm">{metadata.cfg}</p>
                              </div>
                            )}
                            {metadata.sampler && (
                              <div>
                                <label className="text-xs text-muted-foreground">Sampler</label>
                                <p className="text-sm">{metadata.sampler}</p>
                              </div>
                            )}
                            {metadata.scheduler && (
                              <div>
                                <label className="text-xs text-muted-foreground">Scheduler</label>
                                <p className="text-sm">{metadata.scheduler}</p>
                              </div>
                            )}
                            {metadata.width && metadata.height && (
                              <div>
                                <label className="text-xs text-muted-foreground">Dimensions</label>
                                <p className="text-sm">{metadata.width} × {metadata.height}</p>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Keine Metadaten verfügbar</p>
                          <p className="text-xs mt-1">PNG mit ComfyUI-Workflow benötigt</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Info Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div>
                    <h3 className="text-white font-medium">{selectedImage.filename}</h3>
                    <div className="flex items-center gap-4 text-white/70 text-sm mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(selectedImage.modifiedAt), { addSuffix: true, locale: de })}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5" />
                        {formatSize(selectedImage.size)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Favorite */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-white hover:bg-white/10 ${favorites.has(selectedImage.id) ? 'text-yellow-400' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(selectedImage.id);
                      }}
                      title="Favorit (F)"
                    >
                      <Star className={`h-4 w-4 ${favorites.has(selectedImage.id) ? 'fill-current' : ''}`} />
                    </Button>
                    
                    {/* Info/Metadata */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-white hover:bg-white/10 ${showMetadata ? 'bg-white/10' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMetadata(!showMetadata);
                      }}
                      title="Metadaten (I)"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                    
                    {/* Analyze with Vision */}
                    {onAnalyzeImage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          analyzeImage(selectedImage);
                        }}
                        title="Mit Vision-Modell analysieren"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Use as Input */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToInput(selectedImage);
                      }}
                      disabled={isCopying}
                      title="Als ComfyUI Input verwenden"
                    >
                      {isCopying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Download */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(selectedImage);
                      }}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Download
                    </Button>
                    
                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-red-500/20 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(selectedImage.id);
                      }}
                      title="Löschen (Del)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    {/* Close */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10"
                      onClick={() => setSelectedImage(null)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export default ImageGallery;
