# Playwright E2E Testing Strategy
- **Configuration**: Always run tests with trace, video, and screenshot options enabled to generate certification reports.
- **Bypass Token**: Use the unencrypted `E2E_BYPASS_SECRET` environment variable for authenticated sessions in smoke tests.
