-- First, let's promote the robsor user to facility_owner since they were registered as one
UPDATE public.profiles 
SET role = 'facility_owner'::user_role 
WHERE user_id = '7dbf170c-028e-4b2e-97ff-aef77f769c79';

-- Now let's try to delete the user account again
-- But first, let's check what admin user is currently logged in
SELECT user_id, email, full_name, role FROM profiles WHERE role = 'admin';

-- Delete the robsor user account
DELETE FROM public.profiles WHERE user_id = '7dbf170c-028e-4b2e-97ff-aef77f769c79';

-- Also delete from auth.users to complete the deletion
DELETE FROM auth.users WHERE id = '7dbf170c-028e-4b2e-97ff-aef77f769c79';