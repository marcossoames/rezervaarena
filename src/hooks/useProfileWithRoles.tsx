import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'facility_owner' | 'client';

interface ProfileWithRoles {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
  roles: AppRole[];
  total_bookings?: number;
  completed_bookings?: number;
  no_show_bookings?: number;
  cancelled_bookings?: number;
}

/**
 * SECURITY: Hook to fetch user profile with roles from user_roles table
 * This prevents privilege escalation by using the secure user_roles table
 */
export const useProfileWithRoles = (userId?: string) => {
  const [profile, setProfile] = useState<ProfileWithRoles | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!profileData) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Fetch roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        const roles = (rolesData || []).map(r => r.role as AppRole);

        setProfile({
          ...profileData,
          roles
        });
      } catch (error) {
        console.error('Error fetching profile with roles:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const hasRole = (role: AppRole): boolean => {
    return profile?.roles.includes(role) || false;
  };

  return {
    profile,
    loading,
    hasRole,
    isAdmin: hasRole('admin'),
    isFacilityOwner: hasRole('facility_owner'),
    isClient: hasRole('client'),
  };
};
