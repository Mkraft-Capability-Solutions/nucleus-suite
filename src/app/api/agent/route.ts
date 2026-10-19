import { NextResponse } from 'next/server';
import catalog from '@/config/assistant.json';
import { getMessagesForLocale } from '@/lib/i18n';
import { defaultLocale, type SupportedLocale } from '@/locales';
import { AssistantActionTypeEnum } from '@/lib/enums';

interface RouteDefinition {
  id: string;
  replyKey: string;
  keywordsKey: string;
  action: {
    type: string;
    payload: string;
  };
}

export async function POST(request: Request) {
  let body: { message?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }

  if (typeof body?.message !== 'string' || body.message.length > 4000) {
    return NextResponse.json({ error: 'A message of at most 4000 characters is required.' }, { status: 400 });
  }

  const locale = (body.locale || defaultLocale) as SupportedLocale;
  const messages = getMessagesForLocale(locale);
  const assistantMessages = (messages.assistant || {}) as Record<string, any>;
  const replies = assistantMessages.replies || {};
  const keywordsDict = assistantMessages.keywords || {};

  const query = body.message.trim().toLowerCase();

  const matchedRoute = (catalog.routes as RouteDefinition[]).find((route) => {
    const keywords: string[] = keywordsDict[route.id] || [];
    return keywords.some((kw: string) => query.includes(kw.toLowerCase()));
  });

  const reply = matchedRoute
    ? replies[matchedRoute.id] || `Opening ${matchedRoute.action.payload}.`
    : query
      ? assistantMessages.fallback || 'I am not sure how to help with that yet.'
      : assistantMessages.greeting || 'How can I help you navigate the workspace?';

  const action = matchedRoute
    ? {
        type: AssistantActionTypeEnum.NAVIGATE,
        payload: matchedRoute.action.payload,
      }
    : null;

  return NextResponse.json({
    reply,
    action,
    locale,
  });
}
