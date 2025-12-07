"use client";

import React from 'react';
import { ImageGallery } from '@/components/gallery';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { FolderOpen, Image, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GalleryPage() {
  const { settings, isLoaded } = useSettings();

  // Show loading while settings are being fetched
  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Lade Einstellungen...</p>
      </div>
    );
  }

  // If no output path is configured, show setup message
  if (!settings?.comfyUIOutputPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-muted/30 rounded-full p-6 mb-6">
          <Image className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Bildergalerie</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Um die Bildergalerie zu nutzen, konfiguriere bitte zuerst den ComfyUI Output-Pfad in den Einstellungen.
        </p>
        <Link href="/settings">
          <Button className="gap-2">
            <Settings className="h-4 w-4" />
            Einstellungen öffnen
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <FolderOpen className="h-4 w-4" />
          <span>Einstellungen → ComfyUI → Output Pfad</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <ImageGallery
        outputPath={settings.comfyUIOutputPath}
        comfyUIPath={settings.comfyUIPath}
        inputPath={settings.comfyUIPath ? `${settings.comfyUIPath}\\ComfyUI\\input` : undefined}
        standalone={true}
        onAnalyzeImage={(imageUrl) => {
          // Navigate to chat with image for analysis
          console.log('Analyze image:', imageUrl);
        }}
      />
    </div>
  );
}

