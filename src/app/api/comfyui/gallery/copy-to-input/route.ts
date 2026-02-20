import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath, validatePath } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {

  try {
    const body = await request.json();
    const { imageId, outputPath, comfyUIPath } = body;
    
    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID not provided' },
        { status: 400 }
      );
    }
    
    if (!comfyUIPath) {
      return NextResponse.json(
        { success: false, error: 'ComfyUI path not provided' },
        { status: 400 }
      );
    }

    // SEC-2: Validate comfyUIPath (no traversal)
    const safeComfyUIPath = sanitizeBasePath(comfyUIPath);
    if (!safeComfyUIPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid ComfyUI path' },
        { status: 400 }
      );
    }
    
    // Determine output path
    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      finalOutputPath = path.join(safeComfyUIPath, 'ComfyUI', 'output');
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
    
    const sourcePath = path.join(finalOutputPath, relativePath);
    
    // SEC-2: Validate source path stays within output folder
    if (!validatePath(sourcePath, finalOutputPath)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check source file exists
    if (!fs.existsSync(sourcePath)) {
      return NextResponse.json(
        { success: false, error: 'Source image not found' },
        { status: 404 }
      );
    }
    
    // Determine input folder path
    const inputPath = path.join(safeComfyUIPath, 'ComfyUI', 'input');
    
    // Create input folder if it doesn't exist
    if (!fs.existsSync(inputPath)) {
      fs.mkdirSync(inputPath, { recursive: true });
    }
    
    // Generate unique filename to avoid overwriting
    const originalFilename = path.basename(relativePath);
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    
    let targetFilename = originalFilename;
    let targetPath = path.join(inputPath, targetFilename);
    let counter = 1;
    
    // If file exists, add number suffix
    while (fs.existsSync(targetPath)) {
      targetFilename = `${baseName}_${counter}${ext}`;
      targetPath = path.join(inputPath, targetFilename);
      counter++;
    }
    
    // Copy file
    fs.copyFileSync(sourcePath, targetPath);
    
    return NextResponse.json({
      success: true,
      message: 'Image copied to input folder',
      inputFilename: targetFilename,
      inputPath: targetPath,
    });
    
  } catch (error) {
    console.error('Copy to input error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to copy image to input' },
      { status: 500 }
    );
  }
}
