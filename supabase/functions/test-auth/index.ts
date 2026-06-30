import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Test with anon key
  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: d1, error: e1 } = await anonClient.auth.signInWithPassword({
    email: 'admin@suchitracademy.edu.in',
    password: 'edprosys0000',
  });

  // Test with service role
  const svcClient = createClient(url, svcKey, { auth: { persistSession: false } });
  const { data: d2, error: e2 } = await svcClient.auth.signInWithPassword({
    email: 'admin@suchitracademy.edu.in',
    password: 'edprosys0000',
  });

  // Also try resetting via admin
  const { data: d3, error: e3 } = await svcClient.auth.admin.updateUserById(
    '93d08262-8fc4-49f2-8dab-57279687f5e0',
    { password: 'EdProSys2026!', email_confirm: true }
  );

  // Then immediately test the new password
  const { data: d4, error: e4 } = await anonClient.auth.signInWithPassword({
    email: 'admin@suchitracademy.edu.in',
    password: 'EdProSys2026!',
  });

  return new Response(JSON.stringify({
    anon_key_prefix: anonKey.slice(0, 20),
    url_prefix: url.slice(0, 30),
    test1_anon_edprosys0000: { ok: !e1, error: e1?.message, user_id: d1?.user?.id?.slice(0,8) },
    test2_svc_edprosys0000: { ok: !e2, error: e2?.message, user_id: d2?.user?.id?.slice(0,8) },
    test3_reset_to_EdProSys2026: { ok: !e3, error: e3?.message },
    test4_anon_EdProSys2026: { ok: !e4, error: e4?.message, user_id: d4?.user?.id?.slice(0,8) },
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
