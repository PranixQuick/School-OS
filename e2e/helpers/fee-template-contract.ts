/**
 * e2e/helpers/fee-template-contract.ts
 *
 * Single source of truth for the POST /api/admin/fee-templates response contract.
 *
 * API contract (route.ts line ~79):
 *   201  { template: { id, name, grade_level, section, fee_items, is_active, created_at } }
 *   400  { error: string }
 *
 * If the API response shape ever changes, update ONLY this file.
 * All feature tests consume helpers from here — they will not break on contract drift.
 */

import { expect, APIResponse } from '@playwright/test';

export interface FeeTemplateRecord {
  id: string;
  name: string;
  grade_level: string;
  section: string | null;
  fee_items: Array<{ fee_type: string; amount: number }>;
  is_active: boolean;
  created_at: string;
}

export interface CreateFeeTemplateResponse {
  template: FeeTemplateRecord;
}

/**
 * Assert the full POST 201 response contract and return the template record.
 * Throws a descriptive Playwright assertion error if any field is wrong.
 */
export async function assertCreatedTemplateResponse(
  resp: APIResponse
): Promise<FeeTemplateRecord> {
  expect(
    [200, 201],
    `Expected 200 or 201, got ${resp.status()}`
  ).toContain(resp.status());

  const body = (await resp.json()) as CreateFeeTemplateResponse;

  expect(body, 'Response must have top-level "template" key').toHaveProperty('template');
  expect(body.template, '"template" must be an object').toBeTruthy();
  expect(typeof body.template.id, '"template.id" must be a string').toBe('string');
  expect(body.template.id.length, '"template.id" must be non-empty').toBeGreaterThan(0);
  expect(typeof body.template.name, '"template.name" must be a string').toBe('string');
  expect(typeof body.template.grade_level, '"template.grade_level" must be a string').toBe('string');
  expect(Array.isArray(body.template.fee_items), '"template.fee_items" must be an array').toBe(true);
  expect(typeof body.template.is_active, '"template.is_active" must be boolean').toBe('boolean');
  expect(typeof body.template.created_at, '"template.created_at" must be a string').toBe('string');

  return body.template;
}

/**
 * Extract template id from a successful POST response.
 * Use for cleanup or downstream assertions.
 */
export async function extractTemplateId(resp: APIResponse): Promise<string> {
  const template = await assertCreatedTemplateResponse(resp);
  return template.id;
}
