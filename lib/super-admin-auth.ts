// lib/super-admin-auth.ts
// Super-admin gate: email must end with @pranixailabs.com
// Uses same middleware-injected header pattern as lib/admin-auth.ts
// Next.js 15: headers() returns a Promise — must be awaited
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface SuperAdminContext {
  email: string;
}

export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const headersList = await headers();
  const email = (headersList.get("x-user-email") ?? "").toLowerCase();

  if (!email.endsWith("@pranixailabs.com")) {
    redirect("/dashboard");
  }

  return { email };
}
