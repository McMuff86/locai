import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface ImageInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  dimensions?: { width: number; height: number };
}

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

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
    const images: ImageInfo[] = [];
    
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
              
              images.push({
                id: Buffer.from(relPath).toString('base64url'),
                filename: entry.name,
                path: relPath,
                size: stats.size,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
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
    
    // Sort images
    images.sort((a, b) => {
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
    const total = images.length;
    const paginatedImages = images.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      images: paginatedImages,
      total,
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

