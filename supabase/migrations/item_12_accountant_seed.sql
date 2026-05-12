-- Item #12 Accounts Dashboard — accountant seed for Suchitra Academy demo.
-- Applied to prod autonomously before PR opened.
-- staff.role='admin' (CHECK constraint), school_users.role_v2='accountant'
-- Email: accountant@suchitracademy.edu.in / Password: schoolos0000

INSERT INTO public.staff (id, school_id, name, role, phone, is_active)
SELECT '00000000-0000-0000-0000-000000000013'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid, 'Accounts Staff', 'admin', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.staff WHERE id='00000000-0000-0000-0000-000000000013'::uuid);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
SELECT '00000000-0000-0000-0000-000000000014'::uuid, 'authenticated', 'authenticated',
  'accountant@suchitracademy.edu.in', crypt('schoolos0000', gen_salt('bf', 6)), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Accounts Staff"}'::jsonb,
  NOW(), NOW(), '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email='accountant@suchitracademy.edu.in');

INSERT INTO public.school_users (id, school_id, auth_user_id, email, name, role, role_v2, staff_id, is_active)
SELECT '00000000-0000-0000-0000-000000000015'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000014'::uuid,
  'accountant@suchitracademy.edu.in', 'Accounts Staff', 'admin', 'accountant',
  '00000000-0000-0000-0000-000000000013'::uuid, true
WHERE NOT EXISTS (SELECT 1 FROM public.school_users WHERE email='accountant@suchitracademy.edu.in');
