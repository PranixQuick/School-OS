// app/admin/page.tsx
// A2: Super-admin page moved to /super-admin
// This redirect ensures any old bookmarks still work
import { redirect } from 'next/navigation';
export default function AdminRedirect() {
  redirect('/super-admin');
}
