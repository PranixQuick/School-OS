// Removed — root cause identified and fixed.
// auth.identities records were missing, causing signInWithPassword to fail
// with "Invalid login credentials" even with correct password hash.
// Fixed by migration: create_auth_identities_for_ci_demo_accounts
export {};
