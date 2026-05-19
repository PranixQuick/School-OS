// app/login/route.ts
// Handles POST /login — browser cache replay or direct form posts.
// Next.js App Router only handles GET for page routes by default.
// A POST to /login returns 404 ("Failed to find Server Action").
// This route catches it and redirects to GET /login cleanly.
import { redirect } from 'next/navigation';

export async function POST() {
  redirect('/login');
}
