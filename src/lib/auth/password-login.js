export const PASSWORD_LOGIN_PATH = '/api/auth/login';

/**
 * Remembers the signed-in user's profile the way AuthContext reads it back on load. The session
 * itself is the httpOnly Better Auth cookie set by PASSWORD_LOGIN_PATH; `nucleus_session` is only a
 * hint that a cached profile exists and never identifies anyone to the server.
 */
export async function storeSignedInUser(user) {
    localStorage.setItem('nucleus_user', JSON.stringify(user));
}
