// k6/cron_load.js — Phase I7: Load test for cron/run-school endpoint
// Simulates 50-school daily cron fan-out.
// Run: k6 run k6/cron_load.js
// CI: .github/workflows/load-test.yml (Monday 2am UTC weekly)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    schools: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 5,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],    // <1% error rate
    http_req_duration: ['p(95)<5000'], // 95th percentile <5s
  },
};

const BASE = __ENV.BASE_URL || 'https://school-os-rh47.vercel.app';
const SECRET = __ENV.CRON_SECRET;

export default function () {
  const res = http.post(
    `${BASE}/api/cron/run-school`,
    JSON.stringify({
      school_id: '00000000-0000-0000-0000-000000000001',
      school_name: 'Load Test School',
      plan: 'free',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`,
      },
    }
  );

  check(res, {
    'status 200': r => r.status === 200,
    'no error in body': r => !r.json('error'),
  });

  sleep(1);
}
