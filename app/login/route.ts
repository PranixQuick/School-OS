// This module is intentionally NOT a route handler.
// Next.js App Router treats route.ts as a route handler ONLY when it exports
// HTTP method names (GET, POST, PUT, etc.).
// This file exports nothing to prevent the "parallel pages" build error.
// POST /login is handled by middleware.ts which intercepts and redirects.

export const _loginRouteNoop = true;
