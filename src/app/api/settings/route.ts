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
  dataPath: '', // Local data path for chats, etc.
};

// Get settings file path - either from query param or default location
function getSettingsPath(dataPath?: string | null): string {
  if (dataPath) {
    return path.join(dataPath, 'locai-settings.json');
  }
  // Default to user's home directory
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
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataPath = searchParams.get('dataPath');
    
    const settingsPath = getSettingsPath(dataPath);
    
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
    const { settings, dataPath } = body;
    
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'No settings provided' },
        { status: 400 }
      );
    }
    
    // Use dataPath from settings if provided, otherwise from body
    const effectiveDataPath = settings.dataPath || dataPath;
    const settingsPath = getSettingsPath(effectiveDataPath);
    
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
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataPath = searchParams.get('dataPath');
    
    const settingsPath = getSettingsPath(dataPath);
    
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

