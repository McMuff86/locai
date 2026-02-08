import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { assertLocalRequest, sanitizeBasePath, validatePath } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const forbidden = assertLocalRequest(request);
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('id');
    const outputPath = searchParams.get('outputPath');
    const comfyUIPath = searchParams.get('comfyUIPath');
    
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID not provided' },
        { status: 400 }
      );
    }
    
    // Determine output path
    let finalOutputPath = outputPath;
    if (!finalOutputPath && comfyUIPath) {
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
    
    // Decode image path
    let relativePath: string;
    try {
      relativePath = Buffer.from(imageId, 'base64url').toString('utf-8');
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid image ID' },
        { status: 400 }
      );
    }
    
    const fullPath = path.join(finalOutputPath, relativePath);
    
    // SEC-2: Validate resolved path stays within output folder
    if (!validatePath(fullPath, finalOutputPath)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    
    // Delete the file
    fs.unlinkSync(fullPath);
    
    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
      deletedPath: relativePath,
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
