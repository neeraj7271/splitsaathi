import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    TEST_DATABASE_URL: z.ZodOptional<z.ZodString>;
    JWT_ACCESS_SECRET: z.ZodString;
    JWT_REFRESH_SECRET: z.ZodString;
    OTP_DEV_CODE: z.ZodDefault<z.ZodString>;
    APP_PUBLIC_URL: z.ZodDefault<z.ZodString>;
    MOBILE_API_URL: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    PORT: number;
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    OTP_DEV_CODE: string;
    APP_PUBLIC_URL: string;
    MOBILE_API_URL: string;
    TEST_DATABASE_URL?: string | undefined;
}, {
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    PORT?: number | undefined;
    TEST_DATABASE_URL?: string | undefined;
    OTP_DEV_CODE?: string | undefined;
    APP_PUBLIC_URL?: string | undefined;
    MOBILE_API_URL?: string | undefined;
}>;
export type AppEnv = z.infer<typeof envSchema>;
export declare function loadEnv(source?: NodeJS.ProcessEnv): AppEnv;
