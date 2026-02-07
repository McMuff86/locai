import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath } from '../../_utils/security';

export const dynamic = 'force-dynamic';

interface MediaInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: 'image' | 'video';
  dimensions?: { width: number; height: number };
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

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
    
    // Read directory recursively (include subfolders)
    const media: MediaInfo[] = [];
    
    function scanDirectory(dirPath: string, relativePath: string = '') {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, relPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            try {
              const stats = fs.statSync(fullPath);
              const isVideo = VIDEO_EXTENSIONS.includes(ext);
              
              media.push({
                id: Buffer.from(relPath).toString('base64url'),
                filename: entry.name,
                path: relPath,
                size: stats.size,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
                type: isVideo ? 'video' : 'image',
              });
            } catch (err) {
              // Skip files we can't read
              console.error(`Error reading file ${fullPath}:`, err);
            }
          }
        }
      }
    }
    
    scanDirectory(finalOutputPath);
    
    // Sort media
    media.sort((a, b) => {
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
    const total = media.length;
    const paginatedMedia = media.slice(offset, offset + limit);
    
    // Count images and videos
    const imageCount = media.filter(m => m.type === 'image').length;
    const videoCount = media.filter(m => m.type === 'video').length;
    
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

