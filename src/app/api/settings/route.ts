import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Default settings
const DEFAULT_SETTINGS = {
  comfyUIPath: '',
  comfyUIPort: 8188,
  comfyUIAutoStart: false,
  comfyUIOutputPath: '',
  ollamaHost: 'http://localhost:11434',
  sidebarWidth: 400,
  theme: 'dark',
  autoSave: true,
  streamingEnabled: true,
  notesPath: '',
  notesEmbeddingModel: 'nomic-embed-text',
  notesAllowAI: true,
};

// Get settings file path - always under ~/.locai/
function getSettingsPath(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(homeDir, '.locai', 'settings.json');
}

// Ensure directory exists
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// GET - Load settings from file
export async function GET() {
  try {
    const settingsPath = getSettingsPath();
    
    if (!fs.existsSync(settingsPath)) {
      return NextResponse.json({
        success: true,
        settings: DEFAULT_SETTINGS,
        source: 'default',
        path: settingsPath,
      });
    }
    
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    
    return NextResponse.json({
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      source: 'file',
      path: settingsPath,
    });
    
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load settings',
      settings: DEFAULT_SETTINGS,
    });
  }
}

// POST - Save settings to file
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'No settings provided' },
        { status: 400 }
      );
    }

    const settingsPath = getSettingsPath();
    
    // Ensure directory exists
    ensureDir(settingsPath);
    
    // Write settings
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'Settings saved',
      path: settingsPath,
    });
    
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save settings' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Reset settings
export async function DELETE() {
  try {
    const settingsPath = getSettingsPath();
    
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Settings reset',
    });
    
  } catch (error) {
    console.error('Error deleting settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset settings' 
      },
      { status: 500 }
    );
  }
}

