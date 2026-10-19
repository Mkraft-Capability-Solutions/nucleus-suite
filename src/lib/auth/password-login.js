import { signIn } from '@/lib/auth-client';

export const PASSWORD_LOGIN_PATH = '/api/auth/login';

/**
 * Remembers the signed-in user the way AuthContext reads it back on load (localStorage `nucleus_user` plus the
 * `nucleus_session` cookie the middleware checks), then opens the better-auth session.
 */
export async function storeSignedInUser(user, email, password) {
    localStorage.setItem('nucleus_user', JSON.stringify(user));
    document.cookie = `nucleus_session=${encodeURIComponent(user.id)}; path=/; max-age=604800; SameSite=Lax`;
    await signIn.email({ email, password }).catch(() => {});
}
