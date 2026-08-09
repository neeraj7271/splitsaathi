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

/** Optional string env var: converts empty string "" or whitespace to undefined before validation. */
const optionalString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().min(1).optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: optionalString,
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ADMIN_ACCESS_SECRET: z.string().min(16).default('super-admin-secret-access-key-32chars-min'),
  JWT_ADMIN_REFRESH_SECRET: z.string().min(16).default('super-admin-secret-refresh-key-32chars-min'),
  PHONE_HASH_PEPPER: optionalString,
  OTP_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  MOBILE_API_URL: z.string().url().default('http://localhost:3000'),
  LOCAL_OBJECT_STORAGE_DIR: optionalString,
  /** Early VM / staging only. Must be false (or unset) before real user data. */
  ALLOW_INSECURE_DEV_PROVIDERS: envBoolean.default(false),
  OTP_PROVIDER_DRIVER: z.enum(['dev', 'twilio_verify']).default('dev'),
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_VERIFY_SERVICE_SID: optionalString,
  EMAIL_PROVIDER_DRIVER: z.enum(['dev', 'resend', 'brevo']).default('dev'),
  /** Plain email or display form, e.g. `SplitSaathi <noreply@example.com>`. Used by Resend and as Brevo fallback. */
  EMAIL_FROM: optionalString,
  RESEND_API_KEY: optionalString,
  BREVO_API_KEY: optionalString,
  BREVO_SENDER_EMAIL: optionalString,
  BREVO_SENDER_NAME: optionalString,
  EMAIL_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  /** Shared secret for external cron hitting `POST /v1/jobs/*` (`x-cron-secret` header). */
  CRON_SECRET: optionalString,
  GOOGLE_OAUTH_CLIENT_ID: optionalString,
  UPI_INTENT_PROVIDER_DRIVER: z.enum(['dev']).default('dev'),
  PAYMENT_GATEWAY_DRIVER: z.enum(['manual', 'razorpay', 'cashfree']).default('manual'),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  CASHFREE_APP_ID: optionalString,
  CASHFREE_SECRET_KEY: optionalString,
  CASHFREE_WEBHOOK_SECRET: optionalString,
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  NOTIFICATION_PROVIDER_DRIVER: z.enum(['dev', 'expo', 'fcm']).default('dev'),
  EXPO_PUSH_ACCESS_TOKEN: optionalString,
  /** Raw Firebase service-account JSON string for FCM. */
  FCM_SERVICE_ACCOUNT_JSON: optionalString,
  /** Path to a Firebase service-account JSON file for FCM. */
  FCM_SERVICE_ACCOUNT_PATH: optionalString,
  FCM_PROJECT_ID: optionalString,
  OCR_PROVIDER_DRIVER: z.enum(['noop', 'tesseract']).default('noop'),
  OBJECT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_USE_SSL: envBoolean.default(true),
  BANK_IMPORT_PROVIDER_DRIVER: z.enum(['csv', 'setu_aa']).default('csv'),
  SETU_AA_BASE_URL: optionalString,
  SETU_AA_CLIENT_ID: optionalString,
  SETU_AA_CLIENT_SECRET: optionalString,
  FX_PROVIDER_DRIVER: z.enum(['frankfurter', 'static']).default('frankfurter'),
  FRANKFURTER_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v1'),
  METRICS_ENABLED: envBoolean.default(true)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
