# Engineering Decisions
- **Session-Based Route Gating**: Decided to use `getSession()` inside Next.js API route handlers instead of relying on incoming headers to prevent tenant forgery.
- **SECURITY DEFINER Privileges**: Revoked PUBLIC execute from elevated privilege functions and restricted access strictly to service_role.
- **CI Build-and-Serve**: Integrated local Next.js compilation step in GitHub Actions before running Playwright smoke tests.
- **E2E Bypass Hook**: Authenticated tests bypass Next.js API rate-limiting via signed bypass tokens.
