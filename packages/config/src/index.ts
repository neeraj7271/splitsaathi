import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
  OTP_PROVIDER_DRIVER: z.enum(['dev', 'twilio_verify']).default('dev'),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().min(1).optional(),
  EMAIL_PROVIDER_DRIVER: z.enum(['dev', 'resend']).default('dev'),
  EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  UPI_INTENT_PROVIDER_DRIVER: z.enum(['dev']).default('dev'),
  PAYMENT_GATEWAY_DRIVER: z.enum(['manual', 'razorpay']).default('manual'),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  NOTIFICATION_PROVIDER_DRIVER: z.enum(['dev', 'expo']).default('dev'),
  EXPO_PUSH_ACCESS_TOKEN: z.string().min(1).optional(),
  OCR_PROVIDER_DRIVER: z.enum(['noop', 'tesseract']).default('noop'),
  OBJECT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_USE_SSL: z.coerce.boolean().default(true),
  BANK_IMPORT_PROVIDER_DRIVER: z.enum(['csv', 'setu_aa']).default('csv'),
  SETU_AA_BASE_URL: z.string().url().optional(),
  SETU_AA_CLIENT_ID: z.string().min(1).optional(),
  SETU_AA_CLIENT_SECRET: z.string().min(1).optional(),
  FX_PROVIDER_DRIVER: z.enum(['frankfurter', 'static']).default('frankfurter'),
  FRANKFURTER_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v1'),
  METRICS_ENABLED: z.coerce.boolean().default(true)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
