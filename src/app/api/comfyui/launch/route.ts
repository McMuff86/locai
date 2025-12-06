import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { comfyUIPath } = body;
    
    if (!comfyUIPath) {
      return NextResponse.json(
        { success: false, error: 'ComfyUI path not provided' },
        { status: 400 }
      );
    }
    
    // Normalize path
    const normalizedPath = path.normalize(comfyUIPath);
    
    // Check if path exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { success: false, error: `Path does not exist: ${normalizedPath}` },
        { status: 400 }
      );
    }
    
    // Look for common ComfyUI start scripts
    const possibleStartFiles = [
      'run_nvidia_gpu.bat',
      'run_cpu.bat', 
      'run.bat',
      'main.py',
      'ComfyUI/main.py',
    ];
    
    let startFile = '';
    let startCommand = '';
    let startArgs: string[] = [];
    
    for (const file of possibleStartFiles) {
      const fullPath = path.join(normalizedPath, file);
      if (fs.existsSync(fullPath)) {
        startFile = fullPath;
        
        if (file.endsWith('.bat')) {
          startCommand = 'cmd';
          startArgs = ['/c', fullPath];
        } else if (file.endsWith('.py')) {
          startCommand = 'python';
          startArgs = [fullPath];
        }
        break;
      }
    }
    
    if (!startFile) {
      // List available files for debugging
      const files = fs.readdirSync(normalizedPath).slice(0, 20);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Could not find ComfyUI start script',
          hint: 'Looking for: run_nvidia_gpu.bat, run_cpu.bat, run.bat, or main.py',
          foundFiles: files,
        },
        { status: 400 }
      );
    }
    
    // Launch ComfyUI in detached mode
    const child = spawn(startCommand, startArgs, {
      cwd: normalizedPath,
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    
    // Unref to allow Node.js to exit independently
    child.unref();
    
    return NextResponse.json({
      success: true,
      message: 'ComfyUI launch initiated',
      startFile,
      pid: child.pid,
    });
    
  } catch (error) {
    console.error('ComfyUI launch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to launch ComfyUI' 
      },
      { status: 500 }
    );
  }
}

