-- Rewrite audit trigger functions to avoid referencing non-existent columns across tables
CREATE OR REPLACE FUNCTION public.enhanced_admin_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Log all admin actions on sensitive tables
  IF has_role('admin'::user_role) AND TG_TABLE_NAME IN ('profiles', 'bank_details', 'facilities', 'bookings') THEN
    IF TG_TABLE_NAME = 'profiles' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.user_id, OLD.user_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr()
        )
      );
    ELSIF TG_TABLE_NAME = 'bank_details' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.user_id, OLD.user_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr()
        )
      );
    ELSIF TG_TABLE_NAME = 'facilities' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.owner_id, OLD.owner_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr()
        )
      );
    ELSIF TG_TABLE_NAME = 'bookings' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.client_id, OLD.client_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr()
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.comprehensive_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Enhanced audit for admin actions on all sensitive tables
  IF has_role('admin'::user_role) THEN
    IF TG_TABLE_NAME = 'profiles' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.user_id, OLD.user_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr(),
          'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
        )
      );
    ELSIF TG_TABLE_NAME = 'bank_details' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.user_id, OLD.user_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr(),
          'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
        )
      );
    ELSIF TG_TABLE_NAME = 'facilities' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.owner_id, OLD.owner_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr(),
          'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
        )
      );
    ELSIF TG_TABLE_NAME = 'bookings' THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.client_id, OLD.client_id),
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr(),
          'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;