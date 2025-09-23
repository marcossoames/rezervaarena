-- Fix foreign key constraint issue in bank_details_audit_logs table
-- The issue is that admin_user_id column references users that might be deleted
-- We need to allow NULL values or change the constraint behavior

-- First, let's drop the existing foreign key constraint
ALTER TABLE public.bank_details_audit_logs 
DROP CONSTRAINT IF EXISTS bank_details_audit_logs_admin_user_id_fkey;

-- Recreate the constraint with ON DELETE SET NULL
-- This will set admin_user_id to NULL when the referenced user is deleted
ALTER TABLE public.bank_details_audit_logs 
ADD CONSTRAINT bank_details_audit_logs_admin_user_id_fkey 
FOREIGN KEY (admin_user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;