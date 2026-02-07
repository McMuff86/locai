"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { User } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";

export interface ChatAvatarProps {
  type: 'user' | 'ai';
  size?: number;  // px, default 40 for AI, 36 for user
  className?: string;
}

export function ChatAvatar({ type, size, className }: ChatAvatarProps) {
  const { settings } = useSettings();
  const [imgError, setImgError] = useState(false);
  
  const defaultSize = type === 'ai' ? 40 : 36;
  const resolvedSize = size ?? defaultSize;
  
  const avatarType = type === 'ai' ? settings.aiAvatarType : settings.userAvatarType;
  const avatarUrl = type === 'ai' ? settings.aiAvatarUrl : settings.userAvatarUrl;
  
  const hasCustomImage = avatarType === 'image' && avatarUrl && !imgError;
  
  const sizeStyle = { width: resolvedSize, height: resolvedSize };
  
  if (hasCustomImage) {
    return (
      <div
        className={cn("flex-shrink-0 rounded-full overflow-hidden", className)}
        style={sizeStyle}
      >
        <img
          src={avatarUrl}
          alt={type === 'ai' ? 'AI Avatar' : 'User Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  
  // Default icons
  if (type === 'ai') {
    return (
      <div
        className={cn("flex-shrink-0", className)}
        style={sizeStyle}
      >
        <img
          src="/LocAI_logo_v0.2.svg"
          alt="LocAI"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }
  
  // Default user icon
  const iconSize = Math.round(resolvedSize * 0.5);
  return (
    <Avatar className={cn("flex-shrink-0", className)} style={sizeStyle}>
      <div className="flex items-center justify-center w-full h-full bg-background text-primary">
        <User style={{ width: iconSize, height: iconSize }} />
      </div>
      <AvatarFallback className="bg-primary text-primary-foreground text-xs">U</AvatarFallback>
    </Avatar>
  );
}
