# Operational Certification Strategy
- **Identity Bypass**: Leverage `x-e2e-bypass` header to mock and login as all 16 supported roles (owner, principal, parent, student, teacher, counsellor, etc.).
- **Polymorphism Gating**: Test custom school-type sidebar layout rules for government schools, junior colleges, degree colleges, and Anganwadis.
- **Environment Loading**: Native `.env` file parsing in the Playwright configuration ensures that the test runner correctly passes `E2E_BYPASS_SECRET` during the identity bypass steps.
- **Verification Gating**: Integrations with Razorpay, Twilio, and VidyaGrid are tested using sandbox mock wrappers in local environments and verified manually on the staging environment.
