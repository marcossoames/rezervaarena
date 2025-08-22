import { supabase } from "@/integrations/supabase/client";

// Function to create admin user
export const createAdminUser = async () => {
  try {
    // Sign up the admin user
    const { data, error } = await supabase.auth.signUp({
      email: 'soamespaul@gmail.com',
      password: 'Bunicuion3!',
      options: {
        emailRedirectTo: `${window.location.origin}/admin/dashboard`,
        data: {
          full_name: 'Paul Admin'
        }
      }
    });

    if (error) {
      throw error;
    }

    console.log('Admin user created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

// Call this function to create the admin user
// createAdminUser();