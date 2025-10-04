-- Remove problematic audit triggers that cause owner_id errors
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.user_roles;
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.profiles;
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.bank_details;
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.bookings;
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.facilities;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.comprehensive_audit_log();

-- Keep only the enhanced_admin_audit triggers which handle the field access correctly
-- The enhanced_admin_audit_trigger already exists and handles this properly by using JSON extraction for owner_id