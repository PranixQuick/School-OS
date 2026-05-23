// k6/dashboard-load.js
// Bible Phase 6 Step 6.2: Performance test suite
// Simulates concurrent users hitting dashboard + attendance APIs.
//
// Usage:
//   k6 run --env BASE_URL=https://www.edprosys.com k6/dashboard-load.js
//
// Prerequisites:
//   - k6 installed (https://k6.io/docs/get-started/installation/)
//   - TEST_ADMIN_COOKIE env var set to a valid school_session cookie value
//     (or the test will hit unauthenticated endpoints and get 401s)
//
// Thresholds:
//   - 95th percentile response time < 2000ms
//   - Error rate < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Warm up to 50 users
    { duration: '2m', target: 200 },   // Ramp to 200 users
    { duration: '1m', target: 500 },   // Peak at 500 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],      // <1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://www.edprosys.com';
const COOKIE = __ENV.TEST_ADMIN_COOKIE || '';

const headers = {
  'Content-Type': 'application/json',
  ...(COOKIE ? { Cookie: `school_session=${COOKIE}` } : {}),
};

export default function () {
  // 1. Dashboard summary API (most common load)
  const dashRes = http.get(`${BASE_URL}/api/dashboard/summary`, { headers });
  check(dashRes, {
    'dashboard 200': (r) => r.status === 200,
    'dashboard <1s': (r) => r.timings.duration < 1000,
  });

  // 2. Health endpoint (lightweight, used by monitoring)
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health 200': (r) => r.status === 200,
  });

  // 3. Students list (paginated, common admin operation)
  const studRes = http.get(`${BASE_URL}/api/students?limit=20`, { headers });
  check(studRes, {
    'students 200': (r) => r.status === 200,
    'students <1.5s': (r) => r.timings.duration < 1500,
  });

  // 4. Config endpoint (called on every page load by Layout)
  const configRes = http.get(`${BASE_URL}/api/config`, { headers });
  check(configRes, {
    'config 200': (r) => r.status === 200,
    'config <500ms': (r) => r.timings.duration < 500,
  });

  // 5. Auth/me endpoint (called on every page load by Layout)
  const meRes = http.get(`${BASE_URL}/api/auth/me`, { headers });
  check(meRes, {
    'auth/me responds': (r) => r.status === 200 || r.status === 401,
    'auth/me <500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
