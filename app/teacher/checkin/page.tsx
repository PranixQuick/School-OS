// app/teacher/checkin/page.tsx
// This path is a legacy duplicate of /teacher/check-in.
// Redirect to canonical route to prevent confusion and dead API calls.
// The canonical page is at app/teacher/check-in/page.tsx.

import { redirect } from 'next/navigation';

export default function CheckinLegacyPage() {
  redirect('/teacher/check-in');
}
