import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { assertLocalRequest } from '../_utils/security';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const forbidden = assertLocalRequest(request);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const { initialPath, title = 'Ordner auswählen' } = body;
    
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    
    let selectedPath = '';
    
    if (isWindows) {
      // PowerShell folder picker dialog
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $browser = New-Object System.Windows.Forms.FolderBrowserDialog
        $browser.Description = "${title}"
        ${initialPath ? `$browser.SelectedPath = "${initialPath.replace(/\\/g, '\\\\')}"` : ''}
        $browser.ShowNewFolderButton = $true
        $result = $browser.ShowDialog()
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $browser.SelectedPath
        }
      `;
      
      try {
        const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
          timeout: 60000, // 60 second timeout for user to select
        });
        selectedPath = stdout.trim();
      } catch (err: any) {
        // User cancelled or timeout
        if (err.killed) {
          return NextResponse.json({ 
            success: false, 
            cancelled: true,
            error: 'Dialog timeout' 
          });
        }
      }
    } else if (isMac) {
      // macOS osascript folder picker
      const script = `osascript -e 'tell application "System Events" to activate' -e 'POSIX path of (choose folder with prompt "${title}"${initialPath ? ` default location "${initialPath}"` : ''})'`;
      
      try {
        const { stdout } = await execAsync(script, { timeout: 60000 });
        selectedPath = stdout.trim();
      } catch {
        // User cancelled
      }
    } else if (isLinux) {
      // Try zenity or kdialog
      try {
        const { stdout } = await execAsync(
          `zenity --file-selection --directory --title="${title}"${initialPath ? ` --filename="${initialPath}/"` : ''}`,
          { timeout: 60000 }
        );
        selectedPath = stdout.trim();
      } catch {
        // Try kdialog as fallback
        try {
          const { stdout } = await execAsync(
            `kdialog --getexistingdirectory ${initialPath || '~'} --title "${title}"`,
            { timeout: 60000 }
          );
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
