const REFRESH_KEY = "rewear_refresh";

let accessToken: string | null = null;

/**
 * In-memory access token + refresh token in localStorage for now.
 * Swap both for an httpOnly cookie refresh once the cookie flow exists
 * (see README: SECURITY section).
 */
export const tokenStore = {
  getAccess: () => accessToken,

  getRefresh: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  setSession: (access: string, refresh: string) => {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* private browsing — keep in-memory only */
    }
  },

  clear: () => {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};
