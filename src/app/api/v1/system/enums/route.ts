import { NextRequest, NextResponse } from 'next/server';
import { getSystemEnums } from '@/lib/enums';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const locale = searchParams.get('locale') || 'en';

    const enums = await getSystemEnums(category, locale);

    return NextResponse.json({
      success: true,
      data: enums,
      category: category || 'all',
      locale,
      count: enums.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch system enums',
      },
      { status: 500 }
    );
  }
}
