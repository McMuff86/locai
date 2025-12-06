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
  FolderOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
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

interface ImageGalleryProps {
  comfyUIPath: string;
  outputPath?: string; // Absolute path to output folder
  isOpen: boolean;
  onClose: () => void;
}

type GridSize = 'tiny' | 'small' | 'medium' | 'large';

export function ImageGallery({ 
  comfyUIPath, 
  outputPath,
  isOpen, 
  onClose 
}: ImageGalleryProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  
  const scrollRef = useRef<HTMLDivElement>(null);

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
      
      // Use outputPath if available, otherwise use comfyUIPath for default location
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

  // Initial load
  useEffect(() => {
    if (isOpen && comfyUIPath) {
      fetchImages(true);
    }
  }, [isOpen, comfyUIPath]);

  // Get image URL
  const getImageUrl = (image: ImageInfo, thumbnail: boolean = false) => {
    const params = new URLSearchParams();
    
    if (outputPath) {
      params.set('outputPath', outputPath);
    }
    if (comfyUIPath) {
      params.set('comfyUIPath', comfyUIPath);
    }
    if (thumbnail) {
      params.set('thumbnail', 'true');
    }
    
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
    
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    } else {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedImage(images[newIndex]);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (selectedImage) {
          setSelectedImage(null);
        } else {
          onClose();
        }
      }
      
      if (selectedImage) {
        if (e.key === 'ArrowLeft') navigateLightbox('prev');
        if (e.key === 'ArrowRight') navigateLightbox('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedImage, images]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Grid classes based on size
  const gridClasses = {
    small: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2',
    medium: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3',
    large: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
  };

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
              {total} Bilder
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Grid Size Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={gridSize === 'small' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('small')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === 'medium' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('medium')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === 'large' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setGridSize('large')}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
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
            ) : images.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg mb-2">Keine Bilder gefunden</p>
                <p className="text-sm">Der Output-Ordner ist leer</p>
              </div>
            ) : (
              <>
                {/* Image Grid */}
                <div className={`grid ${gridClasses[gridSize]}`}>
                  {images.map((image) => (
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
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-white text-xs truncate">{image.filename}</p>
                        <p className="text-white/70 text-xs">
                          {formatDistanceToNow(new Date(image.modifiedAt), { addSuffix: true, locale: de })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Load More */}
                {hasMore && (
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
                
                {/* Loading indicator */}
                {isLoading && images.length === 0 && (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
        
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

