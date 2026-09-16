import { NextRequest, NextResponse } from 'next/server';
import { OnboardingService } from '@/server/onboarding/application/onboardingService';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers
    });
    
    // In our bifurcated architecture, tenantId is inferred from session or middleware
    // We will use a mock tenant ID for the example if session is missing, 
    // but in production it comes from the auth context.
    const tenantId = (session?.user as any)?.tenantId || 'tenant_default_123';
    
    const candidates = await OnboardingService.getOnboardingPipeline(tenantId);
    const stats = await OnboardingService.getOnboardingStats(tenantId);
    
    return NextResponse.json({ candidates, stats });
  } catch (error) {
    console.error('[Onboarding GET Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
