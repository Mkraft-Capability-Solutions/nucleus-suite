import { NextRequest, NextResponse } from 'next/server';
import { OnboardingService } from '@/server/onboarding/application/onboardingService';
import { enforce, requireAccess } from '@/server/platform/access';
import { fail, requestIdFrom } from '@/server/platform/http';

export async function GET(req: NextRequest) {
  try {
    const access = await requireAccess(req);
    enforce(access.context, 'employee.read', { tenantId: access.tenantId });
    const tenantId = access.tenantId;
    
    const candidates = await OnboardingService.getOnboardingPipeline(tenantId);
    const stats = await OnboardingService.getOnboardingStats(tenantId);
    
    return NextResponse.json({ candidates, stats });
  } catch (error) {
    if ((error as { status?: number })?.status) return fail(error, requestIdFrom(req.headers));
    console.error('[Onboarding GET Error]:', (error as { code?: string })?.code ?? 'UNKNOWN');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
