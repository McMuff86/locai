import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const licenseKey = process.env.SYNCFUSION_LICENSE_KEY;

  if (!licenseKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'SYNCFUSION_LICENSE_KEY ist nicht konfiguriert. Bitte in .env.local setzen.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, licenseKey });
}
