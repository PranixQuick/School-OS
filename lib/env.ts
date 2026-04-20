// lib/env.ts
// Phase 0 Task 0.4 — full env schema. Validated at module load; the server
// refuses to boot (or a Vercel build fails) if anything required is missing
// or malformed. superRefine enforces cross-var constraints.
//
// NEVER import this module from client components — SESSION_SECRET and
// service-role keys must stay server-side.

import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // ── Supabase ──────────────────────────────────────────────────────────
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY too short'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY too short'),

    // ── Auth / session ────────────────────────────────────────────────────
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),

    // ── Public app origin (magic-link redirectTo, outbound links) ─────────
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),

    // ── Anthropic / Claude (required in all environments) ─────────────────
    ANTHROPIC_API_KEY: z
      .string()
      .min(10, 'ANTHROPIC_API_KEY missing')
      .refine(
        (v) => v.startsWith('sk-ant-'),
        'ANTHROPIC_API_KEY must start with "sk-ant-"'
      ),
    ANTHROPIC_MODEL: z.string().optional(),

    // ── WhatsApp / Twilio ────────────────────────────────────────────────
    WHATSAPP_PROVIDER: z.enum(['stub', 'twilio']).optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_FROM: z.string().optional(),

    // ── Cron (used by /api/cron/* routes) ─────────────────────────────────
    CRON_SECRET: z.string().optional(),

    // ── Ops notifications ─────────────────────────────────────────────────
    FOUNDER_EMAIL: z.string().email().optional(),

    // ── Optional integrations — validated as strings when present ─────────
    OPENAI_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['stub', 'resend']).optional(),
    GOOGLE_SHEETS_API_KEY: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // In production, WhatsApp must be Twilio (stub / unset is blocked).
    if (data.NODE_ENV === 'production') {
      if (!data.WHATSAPP_PROVIDER || data.WHATSAPP_PROVIDER === 'stub') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WHATSAPP_PROVIDER'],
          message: 'must be "twilio" in production (stub/unset is blocked)',
        });
      }
    }

    // If Twilio is the active provider, its credentials are all required.
    if (data.WHATSAPP_PROVIDER === 'twilio') {
      for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'] as const) {
        const val = data[key];
        if (!val || val.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `required when WHATSAPP_PROVIDER=twilio`,
          });
        }
      }
    }

    // If EMAIL_PROVIDER=resend, require the key.
    if (data.EMAIL_PROVIDER === 'resend' && !data.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'required when EMAIL_PROVIDER=resend',
      });
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`[env] Environment validation failed — ${details}`);
  }
  return parsed.data;
}

export const env: AppEnv = loadEnv();
