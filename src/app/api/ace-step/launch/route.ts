import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { aceStepPath } = body;

    if (!aceStepPath) {
      return NextResponse.json(
        { success: false, error: 'ACE-Step path not provided' },
        { status: 400 }
      );
    }

    // Normalize path
    const normalizedPath = path.normalize(aceStepPath);

    // Check if path exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { success: false, error: `Path does not exist: ${normalizedPath}` },
        { status: 400 }
      );
    }

    // Look for ACE-Step start scripts
    const possibleStartFiles = [
      'start_api_server.bat',
      'start.bat',
      'run.bat',
      'api_server.py',
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
      const files = fs.readdirSync(normalizedPath).slice(0, 20);
      return NextResponse.json(
        {
          success: false,
          error: 'Could not find ACE-Step start script',
          hint: 'Looking for: start_api_server.bat, start.bat, run.bat, or api_server.py',
          foundFiles: files,
        },
        { status: 400 }
      );
    }

    // Validate path has no shell metacharacters
    const shellMetachars = /[;&|`$(){}[\]!#~<>*?'"]/;
    if (shellMetachars.test(normalizedPath) || shellMetachars.test(startFile)) {
      return NextResponse.json(
        { success: false, error: 'Path contains invalid characters' },
        { status: 400 }
      );
    }

    // Launch ACE-Step in detached mode (shell: false to prevent command injection)
    const child = spawn(startCommand, startArgs, {
      cwd: normalizedPath,
      detached: true,
      stdio: 'ignore',
      shell: false,
    });

    // Unref to allow Node.js to exit independently
    child.unref();

    return NextResponse.json({
      success: true,
      message: 'ACE-Step launch initiated',
      startFile,
      pid: child.pid,
    });

  } catch (error) {
    console.error('ACE-Step launch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to launch ACE-Step'
      },
      { status: 500 }
    );
  }
}
