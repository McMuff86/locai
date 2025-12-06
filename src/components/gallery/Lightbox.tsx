"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Star, 
  Trash2, 
  Info,
  Eye,
  ArrowUpFromLine,
  Loader2,
  Calendar,
  HardDrive
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '../ui/button';
import { ImageInfo, ImageMetadata } from './types';
import { MetadataPanel } from './MetadataPanel';

interface LightboxProps {
  image: ImageInfo;
  imageUrl: string;
  isFavorite: boolean;
  metadata: ImageMetadata | null;
  isLoadingMetadata: boolean;
  showMetadata: boolean;
  isCopying: boolean;
  canAnalyze: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onToggleMetadata: () => void;
  onAnalyze: () => void;
  onCopyToInput: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

// Helper to format file size
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function Lightbox({
  image,
  imageUrl,
  isFavorite,
  metadata,
  isLoadingMetadata,
  showMetadata,
  isCopying,
  canAnalyze,
  onClose,
  onPrev,
  onNext,
  onToggleFavorite,
  onToggleMetadata,
  onAnalyze,
  onCopyToInput,
  onDownload,
  onDelete,
}: LightboxProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
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
          onNext();
        }}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>
      
      {/* Image */}
      <motion.img
        key={image.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        src={imageUrl}
        alt={image.filename}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Metadata Panel */}
      <AnimatePresence>
        {showMetadata && (
          <MetadataPanel
            metadata={metadata}
            isLoading={isLoadingMetadata}
            onClose={onToggleMetadata}
          />
        )}
      </AnimatePresence>
      
      {/* Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h3 className="text-white font-medium">{image.filename}</h3>
            <div className="flex items-center gap-4 text-white/70 text-sm mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(image.modifiedAt), { addSuffix: true, locale: de })}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {formatSize(image.size)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Favorite */}
            <Button
              variant="ghost"
              size="sm"
              className={`text-white hover:bg-white/10 ${isFavorite ? 'text-yellow-400' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              title="Favorit (F)"
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
            
            {/* Info/Metadata */}
            <Button
              variant="ghost"
              size="sm"
              className={`text-white hover:bg-white/10 ${showMetadata ? 'bg-white/10' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMetadata();
              }}
              title="Metadaten (I)"
            >
              <Info className="h-4 w-4" />
            </Button>
            
            {/* Analyze with Vision */}
            {canAnalyze && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyze();
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
                onCopyToInput();
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
                onDownload();
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
                onDelete();
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
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

