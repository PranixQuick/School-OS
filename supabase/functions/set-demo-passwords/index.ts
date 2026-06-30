import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  // Set passwords for the accounts that are properly linked in school_users
  // Using their actual auth.users IDs confirmed from DB
  const accounts = [
    { id: '93d08262-8fc4-49f2-8dab-57279687f5e0', email: 'admin@suchitracademy.edu.in' },
    { id: '06aa9f9b-31b0-401f-b434-1abcb9538639', email: 'test.teacher@schoolos.local' },
    { id: 'bae1367f-824f-4bf6-874a-aa42a320bfa0', email: 'principal@suchitracademy.edu.in' },
    // These were recreated via Admin API with new UUIDs:
    { id: '16077444-b88f-4dc9-ac1c-f76aea7a0c91', email: 'ravi.kumar@suchitracademy.edu.in' },
    { id: '22be36c4-c6f8-4a36-880d-8c7f7f577d03', email: 'priya.sharma@suchitracademy.edu.in' },
    { id: '877424c8-f4b1-449c-8ae6-24a2bd0590d0', email: 'owner@suchitracademy.edu.in' },
    { id: '14e05aad-0369-4132-99aa-abdd1104b7f5', email: 'accountant@suchitracademy.edu.in' },
  ];

  const results = [];

  for (const account of accounts) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      account.id,
      { password: 'edprosys0000', email_confirm: true }
    );
    results.push({
      email: account.email,
      ok: !error,
      error: error?.message ?? null,
      updated: data?.user?.updated_at ?? null,
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
