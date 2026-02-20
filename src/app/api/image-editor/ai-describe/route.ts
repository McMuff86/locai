import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function getSettings(): Record<string, unknown> {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '.';
  const settingsPath = path.join(homeDir, '.locai', 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {

  try {
    const body = await req.json() as { image?: string };
    const { image } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: 'Kein Bild übergeben' }, { status: 400 });
    }

    const settings = getSettings();
    const ollamaHost = (settings.ollamaHost as string) || 'http://localhost:11434';

    const visionModels = ['llama3.2-vision', 'granite3.1-vision', 'llava'];

    let description = '';
    let succeeded = false;

    for (const model of visionModels) {
      try {
        const res = await fetch(`${ollamaHost}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: 'Describe this image in detail. What do you see?',
            images: [image],
            stream: false,
          }),
        });

        if (res.ok) {
          const data = await res.json() as { response?: string };
          description = data.response || '';
          succeeded = true;
          break;
        }
      } catch {
        // Try next model
      }
    }

    if (!succeeded) {
      return NextResponse.json(
        { success: false, error: 'Kein Vision-Modell verfügbar. Installiere llama3.2-vision oder llava.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true, description });
  } catch (err) {
    console.error('[ImageEditor] AI describe error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 },
    );
  }
}
