import { NextRequest, NextResponse } from 'next/server';
import { OnboardingService } from '@/server/onboarding/application/onboardingService';
import { enforce, requireAccess } from '@/server/platform/access';
import { fail, requestIdFrom } from '@/server/platform/http';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const access = await requireAccess(req);
    enforce(access.context, 'employee.write', { tenantId: access.tenantId });
    const tenantId = access.tenantId;
    const { documentType, isVerified } = await req.json();
    
    const candidate = await OnboardingService.verifyDocument(tenantId, candidateId, documentType, isVerified);
    
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    
    return NextResponse.json({ candidate });
  } catch (error) {
    if ((error as { status?: number })?.status) return fail(error, requestIdFrom(req.headers));
    console.error('[Onboarding Document POST Error]:', (error as { code?: string })?.code ?? 'UNKNOWN');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
