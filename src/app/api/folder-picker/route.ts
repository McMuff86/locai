import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

// SEC-3: Sanitize user input for use in dialog commands (reject shell metacharacters)
function sanitizeDialogInput(input: string): string | null {
  // Allow only safe characters: alphanumeric, spaces, path separators, dots, hyphens, underscores, colons (drive letters)
  if (/[;&|`$(){}[\]!#~<>*?\\'"\n\r]/.test(input)) {
    return null;
  }
  return input;
}

export async function POST(request: Request) {

  try {
    const body = await request.json();
    const { initialPath, title = 'Ordner auswählen' } = body;

    // SEC-3: Validate inputs to prevent command injection
    const safeTitle = sanitizeDialogInput(title);
    if (!safeTitle) {
      return NextResponse.json(
        { success: false, error: 'Invalid title (contains special characters)' },
        { status: 400 }
      );
    }
    const safeInitialPath = initialPath ? sanitizeDialogInput(initialPath) : null;
    if (initialPath && !safeInitialPath) {
      return NextResponse.json(
        { success: false, error: 'Invalid initialPath (contains special characters)' },
        { status: 400 }
      );
    }
    
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    
    let selectedPath = '';
    
    if (isWindows) {
      // SEC-3: Use execFile with argument array to prevent injection
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$browser = New-Object System.Windows.Forms.FolderBrowserDialog',
        `$browser.Description = "${safeTitle}"`,
        ...(safeInitialPath ? [`$browser.SelectedPath = "${safeInitialPath.replace(/\\/g, '\\\\')}"`] : []),
        '$browser.ShowNewFolderButton = $true',
        '$result = $browser.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $browser.SelectedPath }',
      ].join('; ');
      
      try {
        const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript], {
          timeout: 60000,
        });
        selectedPath = stdout.trim();
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'killed' in err && err.killed) {
          return NextResponse.json({ 
            success: false, 
            cancelled: true,
            error: 'Dialog timeout' 
          });
        }
      }
    } else if (isMac) {
      // SEC-3: Use execFile with argument array to prevent injection
      const appleScript = safeInitialPath
        ? `POSIX path of (choose folder with prompt "${safeTitle}" default location "${safeInitialPath}")`
        : `POSIX path of (choose folder with prompt "${safeTitle}")`;
      
      try {
        const { stdout } = await execFileAsync('osascript', [
          '-e', 'tell application "System Events" to activate',
          '-e', appleScript
        ], { timeout: 60000 });
        selectedPath = stdout.trim();
      } catch {
        // User cancelled
      }
    } else if (isLinux) {
      // SEC-3: Use execFile with argument array to prevent injection
      try {
        const args = ['--file-selection', '--directory', `--title=${safeTitle}`];
        if (safeInitialPath) args.push(`--filename=${safeInitialPath}/`);
        const { stdout } = await execFileAsync('zenity', args, { timeout: 60000 });
        selectedPath = stdout.trim();
      } catch {
        // Try kdialog as fallback
        try {
          const { stdout } = await execFileAsync('kdialog', [
            '--getexistingdirectory', safeInitialPath || '~', '--title', safeTitle
          ], { timeout: 60000 });
          selectedPath = stdout.trim();
        } catch {
          // No dialog available
          return NextResponse.json({
            success: false,
            error: 'No file dialog available. Please install zenity or kdialog.',
          });
        }
      }
    }
    
    if (selectedPath) {
      // Verify the path exists
      if (fs.existsSync(selectedPath)) {
        return NextResponse.json({
          success: true,
          path: selectedPath,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Selected path does not exist',
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      cancelled: true,
    });
    
  } catch (error) {
    console.error('Folder picker error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to open folder picker' 
      },
      { status: 500 }
    );
  }
}
