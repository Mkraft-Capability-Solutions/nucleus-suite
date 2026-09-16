import { NextRequest, NextResponse } from 'next/server';
import { OnboardingService } from '@/server/onboarding/application/onboardingService';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    const session = await auth.api.getSession({
      headers: req.headers
    });
    
    const tenantId = (session?.user as any)?.tenantId || 'tenant_default_123';
    const { item, isProvisioned } = await req.json();
    
    const candidate = await OnboardingService.toggleITProvisionItem(tenantId, candidateId, item, isProvisioned);
    
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    
    return NextResponse.json({ candidate });
  } catch (error) {
    console.error('[Onboarding Provision POST Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
