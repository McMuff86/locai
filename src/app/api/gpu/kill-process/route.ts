import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assertLocalRequest } from '../../_utils/security';

const execFileAsync = promisify(execFile);

/**
 * API Route to kill a GPU process
 * POST /api/gpu/kill-process
 * Body: { pid: number }
 * 
 * WARNING: This is a powerful operation. Use with caution.
 */

// List of protected process names that should not be killed
const PROTECTED_PROCESSES = [
  'dwm.exe',           // Desktop Window Manager
  'explorer.exe',      // Windows Explorer
  'csrss.exe',         // Client Server Runtime
  'services.exe',      // Service Control Manager
  'svchost.exe',       // Service Host
  'system',            // System process
  'winlogon.exe',      // Windows Logon
  'lsass.exe',         // Local Security Authority
];

export async function POST(request: Request) {
  const forbidden = assertLocalRequest(request);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { pid, processName } = body;

    if (!pid || typeof pid !== 'number') {
      return NextResponse.json(
        { error: 'Invalid PID provided' },
        { status: 400 }
      );
    }

    // Check if it's a protected process
    if (processName) {
      const lowerName = processName.toLowerCase();
      if (PROTECTED_PROCESSES.some(p => lowerName.includes(p.toLowerCase()))) {
        return NextResponse.json(
          { error: 'Cannot kill protected system process' },
          { status: 403 }
        );
      }
    }

    // SEC-3: Validate PID is a positive integer (defense in depth)
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json(
        { error: 'PID must be a positive integer' },
        { status: 400 }
      );
    }

    // Determine OS and kill command
    const isWindows = process.platform === 'win32';

    try {
      // SEC-3: Use execFile (no shell) to prevent command injection
      if (isWindows) {
        await execFileAsync('taskkill', ['/PID', String(pid), '/F'], { timeout: 5000 });
      } else {
        await execFileAsync('kill', ['-9', String(pid)], { timeout: 5000 });
      }
      
      return NextResponse.json({
        success: true,
        message: `Process ${pid} terminated successfully`,
        pid
      });
    } catch (killError) {
      // Process might already be dead or permission denied
      const errorMessage = killError instanceof Error ? killError.message : 'Unknown error';
      
      if (errorMessage.includes('Access is denied') || errorMessage.includes('Operation not permitted')) {
        return NextResponse.json(
          { error: 'Permission denied. The process may require administrator privileges to terminate.' },
          { status: 403 }
        );
      }
      
      if (errorMessage.includes('not found') || errorMessage.includes('No such process')) {
        return NextResponse.json(
          { error: 'Process not found. It may have already terminated.' },
          { status: 404 }
        );
      }

      throw killError;
    }
  } catch (error) {
    console.error('Error killing process:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to kill process' },
      { status: 500 }
    );
  }
}

// GET method to check if kill is supported
export async function GET(request: Request) {
  const forbidden = assertLocalRequest(request);
  if (forbidden) return forbidden;

  return NextResponse.json({
    supported: true,
    platform: process.platform,
    warning: 'Killing GPU processes can cause data loss or system instability. Use with caution.'
  });
}
