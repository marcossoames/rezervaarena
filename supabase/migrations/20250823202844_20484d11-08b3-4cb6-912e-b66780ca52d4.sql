-- Check the current delete function
SELECT proname, prosrc FROM pg_proc WHERE proname = 'delete_user_account_secure';

-- Test if the function exists and works
SELECT delete_user_account_secure('7dbf170c-028e-4b2e-97ff-aef77f769c79'::uuid);