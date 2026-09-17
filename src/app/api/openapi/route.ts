import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  try {
    const specPath = path.join(process.cwd(), 'public', 'openapi.json');
    if (fs.existsSync(specPath)) {
      const data = fs.readFileSync(specPath, 'utf8');
      return new NextResponse(data, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    return NextResponse.json({ error: 'OpenAPI specification not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load OpenAPI spec' }, { status: 500 });
  }
}
