import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath } from '../../_utils/security';
import { getGalleryMedia, type MediaInfo } from '@/lib/galleryCache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const outputPath = searchParams.get('outputPath'); // Absolute path to output folder
    const comfyUIPath = searchParams.get('comfyUIPath'); // Fallback for relative paths
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'modifiedAt'; // 'modifiedAt', 'createdAt', 'filename'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc', 'desc'
    
    // Determine the actual output path
    let finalOutputPath = outputPath;
    
    if (!finalOutputPath && comfyUIPath) {
      // Default fallback: ComfyUI/output within the comfyUIPath
      finalOutputPath = path.join(comfyUIPath, 'ComfyUI', 'output');
    }
    
    if (!finalOutputPath) {
      return NextResponse.json(
        { success: false, error: 'Output path not provided' },
        { status: 400 }
      );
    }

    // SEC-2: Validate output path (no traversal)
    const safePath = sanitizeBasePath(finalOutputPath);
    if (!safePath) {
      return NextResponse.json(
        { success: false, error: 'Invalid output path' },
        { status: 400 }
      );
    }
    finalOutputPath = safePath;
    
    // Check if path exists
    if (!fs.existsSync(finalOutputPath)) {
      return NextResponse.json({
        success: true,
        images: [],
        total: 0,
        message: `Output folder not found: ${finalOutputPath}`,
        searchedPath: finalOutputPath,
      });
    }
    
    // PERF-1: Use cached gallery scan with file watcher invalidation
    const media: MediaInfo[] = await getGalleryMedia(finalOutputPath);

    // Sort media (cache stores unsorted for flexibility)
    const sorted = [...media].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'modifiedAt':
        default:
          comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Apply pagination
    const total = sorted.length;
    const paginatedMedia = sorted.slice(offset, offset + limit);
    
    // Count images and videos
    const imageCount = sorted.filter(m => m.type === 'image').length;
    const videoCount = sorted.filter(m => m.type === 'video').length;
    
    return NextResponse.json({
      success: true,
      images: paginatedMedia, // Keep as 'images' for backwards compatibility
      total,
      imageCount,
      videoCount,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
    
  } catch (error) {
    console.error('Error reading images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to read images' 
      },
      { status: 500 }
    );
  }
}

