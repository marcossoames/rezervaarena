-- Corectează funcția enhanced_admin_audit pentru a funcționa cu user_roles
CREATE OR REPLACE FUNCTION public.enhanced_admin_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_id uuid;
  table_name text := TG_TABLE_NAME;
BEGIN
  -- Verifică dacă utilizatorul curent are roluri admin în user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) AND table_name IN ('profiles', 'bank_details', 'facilities', 'bookings', 'user_roles') THEN
    
    IF table_name = 'profiles' THEN
      target_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF table_name = 'bank_details' THEN
      target_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF table_name = 'facilities' THEN
      -- Safely extract owner_id even if not typed in record
      target_id := COALESCE(
        NULLIF((row_to_json(NEW)::jsonb ->> 'owner_id'), '')::uuid,
        NULLIF((row_to_json(OLD)::jsonb ->> 'owner_id'), '')::uuid
      );
    ELSIF table_name = 'bookings' THEN
      target_id := COALESCE(NEW.client_id, OLD.client_id);
    ELSIF table_name = 'user_roles' THEN
      target_id := COALESCE(NEW.user_id, OLD.user_id);
    END IF;

    INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
    VALUES (
      auth.uid(),
      TG_OP || '_' || table_name,
      target_id,
      jsonb_build_object(
        'table', table_name,
        'operation', TG_OP,
        'timestamp', now(),
        'ip_address', inet_client_addr()
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Verifică dacă există trigger pe user_roles și îl adaugă dacă lipsește
DROP TRIGGER IF EXISTS enhanced_admin_audit_trigger ON public.user_roles;
CREATE TRIGGER enhanced_admin_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enhanced_admin_audit();