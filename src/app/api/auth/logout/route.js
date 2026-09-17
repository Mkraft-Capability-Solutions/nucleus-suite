import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  res.cookies.set('nucleus_session', '', { path: '/', maxAge: 0 });
  res.cookies.set('nucleus_token', '', { path: '/', maxAge: 0 });
  res.cookies.set('better-auth.session_token', '', { path: '/', maxAge: 0 });
  return res;
}
