// lib/super-admin-auth.ts
// Super-admin gate: email must end with @pranixailabs.com.
// Identity is derived from the verified session cookie (getSession) instead of
// an x-user-email request header. middleware.ts does not inject that header and
// a client could set it arbitrarily, so the previous header-based gate was both
// spoofable and non-functional for normal navigations. This mirrors the
// verified-session pattern used by lib/admin-auth.ts / principal-auth.ts.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/authz";

export interface SuperAdminContext {
  email: string;
}

export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const session = await getSession();

  if (!session || !isSuperAdmin(session.userEmail)) {
    redirect("/dashboard");
  }

  return { email: session.userEmail };
}
