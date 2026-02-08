import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeBasePath, validatePath } from '../../../_utils/security';

export const dynamic = 'force-dynamic';

interface ComfyUIMetadata {
  prompt?: any;
  workflow?: any;
  extraPngInfo?: {
    workflow?: any;
    prompt?: any;
  };
}

// Read PNG text chunks to extract ComfyUI metadata
function readPngMetadata(filePath: string): ComfyUIMetadata | null {
  try {
    const buffer = fs.readFileSync(filePath);
    
    // PNG signature check
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) {
      return null;
    }
    
    const metadata: ComfyUIMetadata = {};
    let offset = 8; // Skip PNG signature
    
    while (offset < buffer.length) {
      // Read chunk length (4 bytes, big-endian)
      const length = buffer.readUInt32BE(offset);
      offset += 4;
      
      // Read chunk type (4 bytes)
      const type = buffer.subarray(offset, offset + 4).toString('ascii');
      offset += 4;
      
      // Check for tEXt or iTXt chunks (where ComfyUI stores metadata)
      if (type === 'tEXt' || type === 'iTXt') {
        const chunkData = buffer.subarray(offset, offset + length);
        
        // Find null separator
        let nullIndex = 0;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIndex = i;
            break;
          }
        }
        
        const keyword = chunkData.subarray(0, nullIndex).toString('latin1');
        let textData: string;
        
        if (type === 'iTXt') {
          // iTXt has more complex structure: keyword, null, compression flag, compression method, language tag, null, translated keyword, null, text
          // For simplicity, skip to the text part
          let textStart = nullIndex + 1;
          // Skip compression flag, method, and find text after nulls
          let nullCount = 0;
          for (let i = nullIndex + 1; i < chunkData.length && nullCount < 3; i++) {
            if (chunkData[i] === 0) nullCount++;
            textStart = i + 1;
          }
          textData = chunkData.subarray(textStart).toString('utf8');
        } else {
          // tEXt: keyword, null, text
          textData = chunkData.subarray(nullIndex + 1).toString('latin1');
        }
        
        // Parse ComfyUI specific metadata
        if (keyword === 'prompt') {
          try {
            metadata.prompt = JSON.parse(textData);
          } catch {
            metadata.prompt = textData;
          }
        } else if (keyword === 'workflow') {
          try {
            metadata.workflow = JSON.parse(textData);
          } catch {
            metadata.workflow = textData;
          }
        } else if (keyword === 'parameters') {
          // A1111 style parameters
          metadata.extraPngInfo = { prompt: textData };
        }
      }
      
      // Move to next chunk (skip data + CRC)
      offset += length + 4;
      
      // Stop at IEND
      if (type === 'IEND') break;
    }
    
    return Object.keys(metadata).length > 0 ? metadata : null;
    
  } catch (error) {
    console.error('Error reading PNG metadata:', error);
    return null;
  }
}

// Extract useful info from ComfyUI workflow
function extractWorkflowInfo(metadata: ComfyUIMetadata) {
  const info: {
    positivePrompt?: string;
    negativePrompt?: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    sampler?: string;
    scheduler?: string;
    model?: string;
    width?: number;
    height?: number;
  } = {};
  
  const prompt = metadata.prompt || metadata.workflow?.extra_pnginfo?.workflow;
  
  if (prompt && typeof prompt === 'object') {
    // Search through nodes for relevant info
    for (const nodeId in prompt) {
      const node = prompt[nodeId];
      if (!node || !node.inputs) continue;
      
      const classType = node.class_type;
      const inputs = node.inputs;
      
      // KSampler nodes
      if (classType?.includes('KSampler') || classType?.includes('Sampler')) {
        if (inputs.seed !== undefined) info.seed = inputs.seed;
        if (inputs.steps !== undefined) info.steps = inputs.steps;
        if (inputs.cfg !== undefined) info.cfg = inputs.cfg;
        if (inputs.sampler_name) info.sampler = inputs.sampler_name;
        if (inputs.scheduler) info.scheduler = inputs.scheduler;
      }
      
      // CLIP Text Encode (prompts)
      if (classType === 'CLIPTextEncode') {
        const text = inputs.text;
        if (text && typeof text === 'string') {
          // Try to determine if positive or negative based on connections
          if (!info.positivePrompt) {
            info.positivePrompt = text;
          } else if (!info.negativePrompt) {
            info.negativePrompt = text;
          }
        }
      }
      
      // Checkpoint loader (model)
      if (classType?.includes('CheckpointLoader')) {
        if (inputs.ckpt_name) info.model = inputs.ckpt_name;
      }
      
      // Empty Latent Image (dimensions)
      if (classType === 'EmptyLatentImage') {
        if (inputs.width) info.width = inputs.width;
        if (inputs.height) info.height = inputs.height;
      }
    }
  }
  
  return info;
}

export async function GET(request: Request) {
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
    
    // Check file exists and is PNG
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.png') {
      return NextResponse.json({
        success: true,
        hasMetadata: false,
        message: 'Metadata only available for PNG files',
      });
    }
    
    // Read metadata
    const rawMetadata = readPngMetadata(fullPath);
    
    if (!rawMetadata) {
      return NextResponse.json({
        success: true,
        hasMetadata: false,
      });
    }
    
    // Extract useful info
    const info = extractWorkflowInfo(rawMetadata);
    
    return NextResponse.json({
      success: true,
      hasMetadata: true,
      info,
      raw: rawMetadata, // Include raw for advanced users
    });
    
  } catch (error) {
    console.error('Metadata read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read metadata' },
      { status: 500 }
    );
  }
}

