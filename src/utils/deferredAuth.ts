/**
 * Deferred auth utilities to reduce initial bundle size
 * Only loads auth-related code when actually needed
 */

export const deferredSecureSignOut = async (supabase: any) => {
  const { secureSignOut } = await import('@/utils/authCleanup');
  return secureSignOut(supabase);
};

export const deferredAuthCleanup = async () => {
  const authModule = await import('@/utils/authCleanup');
  return authModule;
};