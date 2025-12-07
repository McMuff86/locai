"use client";

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, Trash2, Play, Film } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { ImageInfo, GridSize } from './types';

interface ImageCardProps {
  image: ImageInfo;
  imageUrl: string;
  gridSize: GridSize;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function ImageCard({
  image,
  imageUrl,
  gridSize,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onDelete,
}: ImageCardProps) {
  const isTiny = gridSize === 'tiny';
  const isVideo = image.type === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle hover preview for videos
  const handleMouseEnter = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  
  const handleMouseLeave = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer"
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            src={imageUrl}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            muted
            loop
            playsInline
            preload="metadata"
          />
          {/* Video indicator */}
          <div className="absolute top-1 right-1 z-10 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Film className="h-3 w-3 text-white" />
            {!isTiny && <span className="text-white text-xs">Video</span>}
          </div>
          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-70 group-hover:opacity-0 transition-opacity">
              <Play className="h-6 w-6 text-white fill-white ml-1" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={imageUrl}
          alt={image.filename}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}
      
      {/* Favorite indicator */}
      {isFavorite && (
        <div className="absolute top-1 left-1 z-10">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
        </div>
      )}
      
      {/* Quick actions on hover */}
      <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between ${isTiny ? 'p-0.5' : 'p-2'}`}>
        {/* Top actions */}
        {!isTiny && (
          <div className="flex justify-end gap-1">
            <button
              className={`p-1 rounded hover:bg-white/20 transition-colors ${isFavorite ? 'text-yellow-400' : 'text-white'}`}
              onClick={onToggleFavorite}
              title="Favorit"
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              className="p-1 rounded hover:bg-white/20 transition-colors text-white hover:text-red-400"
              onClick={onDelete}
              title="Löschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Bottom info */}
        {!isTiny && (
          <div>
            <p className="text-white text-xs truncate">{image.filename}</p>
            <p className="text-white/70 text-xs">
              {formatDistanceToNow(new Date(image.modifiedAt), { addSuffix: true, locale: de })}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

