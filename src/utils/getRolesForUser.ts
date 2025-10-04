import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'facility_owner' | 'client';

/**
 * SECURITY: Fetches user roles from user_roles table
 * This prevents privilege escalation by using the secure user_roles table
 */
export async function getRolesForUser(userId: string): Promise<AppRole[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  return (data || []).map(r => r.role as AppRole);
}

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}
