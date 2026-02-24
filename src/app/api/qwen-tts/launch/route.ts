import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qwenTTSPath } = body;

    if (!qwenTTSPath) {
      return NextResponse.json(
        { success: false, error: 'Qwen3-TTS path not provided' },
        { status: 400 }
      );
    }

    const normalizedPath = path.normalize(qwenTTSPath);

    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { success: false, error: `Path does not exist: ${normalizedPath}` },
        { status: 400 }
      );
    }

    // Look for start scripts or use python -m src.app
    const possibleStartFiles = [
      'start.bat',
      'run.bat',
      'start_server.bat',
    ];

    let startCommand = '';
    let startArgs: string[] = [];
    let startFile = '';

    for (const file of possibleStartFiles) {
      const fullPath = path.join(normalizedPath, file);
      if (fs.existsSync(fullPath)) {
        startFile = fullPath;
        startCommand = 'cmd';
        startArgs = ['/c', fullPath];
        break;
      }
    }

    // Fallback: python -m src.app (standard Gradio start)
    if (!startFile) {
      const srcApp = path.join(normalizedPath, 'src', 'app.py');
      if (fs.existsSync(srcApp)) {
        startFile = 'python -m src.app';
        startCommand = 'python';
        startArgs = ['-m', 'src.app'];
      }
    }

    // Fallback: uv run python -m src.app
    if (!startFile) {
      try {
        const { execFileSync } = await import('child_process');
        execFileSync('uv', ['--version'], { timeout: 5000, stdio: 'pipe' });
        startFile = 'uv run python -m src.app';
        startCommand = 'uv';
        startArgs = ['run', 'python', '-m', 'src.app'];
      } catch {
        const files = fs.readdirSync(normalizedPath).slice(0, 20);
        return NextResponse.json(
          {
            success: false,
            error: 'Could not find Qwen3-TTS start script',
            hint: 'Looking for: start.bat, run.bat, or src/app.py',
            foundFiles: files,
          },
          { status: 400 }
        );
      }
    }

    // Validate path
    const shellMetachars = /[;&|`$(){}[\]!#~<>*?'"]/;
    if (shellMetachars.test(normalizedPath)) {
      return NextResponse.json(
        { success: false, error: 'Path contains invalid characters' },
        { status: 400 }
      );
    }

    const child = spawn(startCommand, startArgs, {
      cwd: normalizedPath,
      detached: true,
      stdio: 'ignore',
      shell: false,
    });

    child.unref();

    return NextResponse.json({
      success: true,
      message: 'Qwen3-TTS launch initiated',
      startFile,
      pid: child.pid,
    });

  } catch (error) {
    console.error('Qwen3-TTS launch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to launch Qwen3-TTS'
      },
      { status: 500 }
    );
  }
}
