import { NextRequest, NextResponse } from 'next/server';
import { OnboardingService } from '@/server/onboarding/application/onboardingService';
import { enforce, requireAccess } from '@/server/platform/access';
import { fail, requestIdFrom } from '@/server/platform/http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    const access = await requireAccess(req);
    enforce(access.context, 'employee.write', { tenantId: access.tenantId });
    const tenantId = access.tenantId;
    const { item, isProvisioned } = await req.json();
    
    const candidate = await OnboardingService.toggleITProvisionItem(tenantId, candidateId, item, isProvisioned);
    
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    
    return NextResponse.json({ candidate });
  } catch (error) {
    if ((error as { status?: number })?.status) return fail(error, requestIdFrom(req.headers));
    console.error('[Onboarding Provision POST Error]:', (error as { code?: string })?.code ?? 'UNKNOWN');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
