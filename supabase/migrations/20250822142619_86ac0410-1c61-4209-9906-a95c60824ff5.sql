-- Security Fix 1: Create secure RPC for public facilities access
CREATE OR REPLACE FUNCTION public.get_public_facilities()
RETURNS TABLE (
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  address text,
  description text,
  price_per_hour numeric,
  capacity integer,
  images text[],
  amenities text[],
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.images,
    f.amenities,
    f.created_at
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$$;

-- Grant execute permission to public (anonymous users)
GRANT EXECUTE ON FUNCTION public.get_public_facilities() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_facilities() TO authenticated;

-- Security Fix 2: Add trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'client'::user_role
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security Fix 3: Create audit log table for admin actions
CREATE TABLE public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_user_email text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
USING (has_role('admin'::user_role));

-- Security Fix 4: Add foreign key constraints
ALTER TABLE public.bookings 
ADD CONSTRAINT fk_bookings_client_id 
FOREIGN KEY (client_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.bookings 
ADD CONSTRAINT fk_bookings_facility_id 
FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;

ALTER TABLE public.facilities 
ADD CONSTRAINT fk_facilities_owner_id 
FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Security Fix 5: Update admin functions to include audit logging
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to promote users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  -- Update user role
  UPDATE public.profiles 
  SET role = 'admin'::user_role 
  WHERE user_id = _user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'promote_to_admin',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email before deletion
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  -- Log the action before deletion
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'delete_user_account',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  -- Delete from profiles table first (cascade will handle the rest)
  DELETE FROM public.profiles WHERE user_id = _user_id;
  
  -- Delete from auth.users (this will cascade delete all related data)
  DELETE FROM auth.users WHERE id = _user_id;
  
  RETURN FOUND;
END;
$$;