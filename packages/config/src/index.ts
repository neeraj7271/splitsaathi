import { z } from 'zod';

/** Env-safe boolean: "false"/"0"/"no" → false (z.coerce.boolean treats "false" as true). */
const envBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }
  return value;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  PHONE_HASH_PEPPER: z.string().min(16).optional(),
  OTP_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  MOBILE_API_URL: z.string().url().default('http://localhost:3000'),
  LOCAL_OBJECT_STORAGE_DIR: z.string().min(1).optional(),
  /** Early VM / staging only. Must be false (or unset) before real user data. */
  ALLOW_INSECURE_DEV_PROVIDERS: envBoolean.default(false),
  OTP_PROVIDER_DRIVER: z.enum(['dev', 'twilio_verify']).default('dev'),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().min(1).optional(),
  EMAIL_PROVIDER_DRIVER: z.enum(['dev', 'resend']).default('dev'),
  /** Plain email or Resend display form, e.g. `SplitSaathi <noreply@example.com>`. */
  EMAIL_FROM: z.string().min(3).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  /** Shared secret for external cron hitting `POST /v1/jobs/*` (`x-cron-secret` header). */
  CRON_SECRET: z.string().min(16).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  UPI_INTENT_PROVIDER_DRIVER: z.enum(['dev']).default('dev'),
  PAYMENT_GATEWAY_DRIVER: z.enum(['manual', 'razorpay', 'cashfree']).default('manual'),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  CASHFREE_APP_ID: z.string().min(1).optional(),
  CASHFREE_SECRET_KEY: z.string().min(1).optional(),
  CASHFREE_WEBHOOK_SECRET: z.string().min(1).optional(),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  NOTIFICATION_PROVIDER_DRIVER: z.enum(['dev', 'expo', 'fcm']).default('dev'),
  EXPO_PUSH_ACCESS_TOKEN: z.string().min(1).optional(),
  /** Raw Firebase service-account JSON string for FCM. */
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /** Path to a Firebase service-account JSON file for FCM. */
  FCM_SERVICE_ACCOUNT_PATH: z.string().min(1).optional(),
  FCM_PROJECT_ID: z.string().min(1).optional(),
  OCR_PROVIDER_DRIVER: z.enum(['noop', 'tesseract']).default('noop'),
  OBJECT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_USE_SSL: envBoolean.default(true),
  BANK_IMPORT_PROVIDER_DRIVER: z.enum(['csv', 'setu_aa']).default('csv'),
  SETU_AA_BASE_URL: z.string().url().optional(),
  SETU_AA_CLIENT_ID: z.string().min(1).optional(),
  SETU_AA_CLIENT_SECRET: z.string().min(1).optional(),
  FX_PROVIDER_DRIVER: z.enum(['frankfurter', 'static']).default('frankfurter'),
  FRANKFURTER_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v1'),
  METRICS_ENABLED: envBoolean.default(true)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
