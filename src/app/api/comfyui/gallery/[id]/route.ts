import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath, validatePath } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

// MIME types for images
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const outputPath = searchParams.get('outputPath'); // Absolute path to output folder
    const comfyUIPath = searchParams.get('comfyUIPath'); // Fallback
    
    // Determine the actual output path
    let finalOutputPath = outputPath;
    
    if (!finalOutputPath && comfyUIPath) {
      finalOutputPath = path.join(comfyUIPath, 'ComfyUI', 'output');
    }
    
    if (!finalOutputPath) {
      return NextResponse.json(
        { error: 'Output path not provided' },
        { status: 400 }
      );
    }

    // SEC-2: Validate output path (no traversal)
    const safePath = sanitizeBasePath(finalOutputPath);
    if (!safePath) {
      return NextResponse.json(
        { error: 'Invalid output path' },
        { status: 400 }
      );
    }
    finalOutputPath = safePath;
    
    // Decode the file path from base64url
    let relativePath: string;
    try {
      relativePath = Buffer.from(id, 'base64url').toString('utf-8');
    } catch {
      return NextResponse.json(
        { error: 'Invalid image ID' },
        { status: 400 }
      );
    }
    
    // Construct full path
    const fullPath = path.join(finalOutputPath, relativePath);
    
    // SEC-2: Validate resolved path stays within output folder
    if (!validatePath(fullPath, finalOutputPath)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }
    
    // Get MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Read and serve the image
    const imageBuffer = fs.readFileSync(fullPath);
    
    // Return with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}

